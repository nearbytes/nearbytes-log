import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { StorageError } from 'nearbytes-crypto';
import type { LogIo } from './io.js';

/**
 * Node.js filesystem I/O rooted at `basePath`.
 *
 * ## Concurrent-write model
 *
 * Every `writeFile` target in the nearbytes-log family is **content-
 * addressed** — the file name is a SHA-256 of the bytes — so two writers
 * publishing the same file are by construction publishing byte-identical
 * data. We exploit this with the canonical content-addressed publish
 * pattern (the same idiom git, restic, and ipfs use):
 *
 *   1. Write to a *unique* tmp path: `${final}.${randomBytes(8)}.tmp`.
 *      The random suffix means concurrent writers never share scratch
 *      space, even when targeting the same final name.
 *   2. `link(tmp, final)` — POSIX hardlink, atomic, fails with `EEXIST`
 *      if the target already exists. The first writer to call `link`
 *      wins. The loser observes `EEXIST` and moves on: the bytes on
 *      disk under `final` are identical to what the loser would have
 *      written, so the result is bit-for-bit correct either way.
 *      (`rename(tmp, final)` would *overwrite* atomically, doing
 *      pointless extra I/O; `link` is the right verb for "publish
 *      iff absent".)
 *   3. `unlink(tmp)` in `finally` so the loser's scratch file is
 *      reaped immediately.
 *
 * ## Crash leaks
 *
 * If the process is killed between `writeFile` (the bytes are on disk
 * in `tmp`) and the `unlink` in `finally`, the tmp file is orphaned.
 * These accumulate as `<hash>.<rand>.tmp` next to legitimate blocks.
 * `initializeStorageRoot` reaps stale `*.tmp` entries on every startup,
 * so the steady-state count is bounded by "tmp files created during
 * the current run".
 *
 * ## When `link(2)` is not available
 *
 * On filesystems without hardlink support (FAT, some network FS), this
 * implementation degrades: the first `link` succeeds, subsequent ones
 * fail with `EPERM`/`ENOSYS` rather than `EEXIST`. We treat `EXDEV`,
 * `EPERM`, and `ENOSYS` as "fall back to rename" since the only
 * correctness requirement is that the final bytes equal the hash. On
 * the supported platforms (ext4, btrfs, xfs, APFS, NTFS, ZFS) `link`
 * is available and `EEXIST` is the only relevant non-success branch.
 */
const LINK_NOT_SUPPORTED = new Set(['EXDEV', 'EPERM', 'ENOSYS']);

export function createFsIo(basePath: string): LogIo {
  const readFile = async (path: string): Promise<Uint8Array> => {
    try {
      const buffer = await fs.readFile(join(basePath, path));
      return new Uint8Array(buffer);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new StorageError(`File not found: ${path}`, error);
      }
      throw new StorageError(
        `Failed to read file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    const fullPath = join(basePath, path);
    const tempPath = `${fullPath}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(tempPath, data);
      try {
        await fs.link(tempPath, fullPath);
      } catch (linkErr) {
        const code = (linkErr as NodeJS.ErrnoException).code;
        if (code === 'EEXIST') {
          // Another writer beat us to it. Content-addressed naming
          // guarantees their bytes ≡ our bytes; nothing more to do.
          return;
        }
        if (code !== undefined && LINK_NOT_SUPPORTED.has(code)) {
          // Filesystem doesn't support hardlinks (rare: FAT, some NFS).
          // Fall back to rename — loses the "first writer wins"
          // optimisation but is still correct because bytes are identical.
          await fs.rename(tempPath, fullPath);
          return;
        }
        throw linkErr;
      }
    } catch (error) {
      throw new StorageError(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    } finally {
      // Best-effort cleanup of the scratch file. Either we successfully
      // linked it (final exists; tmp is now a redundant second hardlink
      // to the same inode and unlinking only removes the directory
      // entry, not the inode) or the link failed and tmp is orphaned.
      // EEXIST/ENOENT on unlink are both fine.
      await fs.unlink(tempPath).catch(() => undefined);
    }
  };

  const appendFile = async (path: string, data: Uint8Array): Promise<void> => {
    try {
      const fullPath = join(basePath, path);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, data);
    } catch (error) {
      throw new StorageError(
        `Failed to append to file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const listFiles = async (directory: string): Promise<string[]> => {
    try {
      const entries = await fs.readdir(join(basePath, directory), { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }
      throw new StorageError(
        `Failed to list files in ${directory}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const listDirectories = async (directory: string): Promise<string[]> => {
    try {
      const entries = await fs.readdir(join(basePath, directory), { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }
      throw new StorageError(
        `Failed to list directories in ${directory}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const createDirectory = async (path: string): Promise<void> => {
    try {
      await fs.mkdir(join(basePath, path), { recursive: true });
    } catch (error) {
      throw new StorageError(
        `Failed to create directory ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const exists = async (path: string): Promise<boolean> => {
    try {
      await fs.access(join(basePath, path));
      return true;
    } catch {
      return false;
    }
  };

  const deleteFile = async (path: string): Promise<void> => {
    try {
      await fs.unlink(join(basePath, path));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }
      throw new StorageError(
        `Failed to delete file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  return { readFile, writeFile, appendFile, listFiles, listDirectories, createDirectory, exists, deleteFile };
}
