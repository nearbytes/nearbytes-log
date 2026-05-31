import type { EncryptedData, Hash } from 'nearbytes-crypto';
import { computeHash, StorageError } from 'nearbytes-crypto';
import type { BlockStoreApi } from '../api.js';
import { blockPath } from '../paths.js';
import { validateBlockBytes } from '../integrity.js';
import type { LogIo } from './io.js';

const BLOCK_FILE_RE = /^([a-f0-9]{64})\.bin$/i;

/**
 * Block store backed by a `LogIo` implementation. The log is the sole
 * authority of the block content-address (see `storage/log-api-v1.md` §2.3):
 * `store(data)` computes the SHA-256 and returns the hash; the
 * `storeAlreadyVerified(hash, data)` fast path is reserved for the streaming
 * receiver of `nearbytes-sync`.
 */
export function createBlockStoreApi(io: LogIo): BlockStoreApi {
  const writeAt = async (hash: Hash, data: EncryptedData, skipIfExists: boolean): Promise<void> => {
    const path = blockPath(hash);
    if (skipIfExists && (await io.exists(path))) {
      return;
    }
    await io.writeFile(path, data);
  };

  const store = async (data: EncryptedData, skipIfExists = false): Promise<Hash> => {
    try {
      const hash = await computeHash(data);
      await writeAt(hash, data, skipIfExists);
      return hash;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const storeAlreadyVerified = async (
    hash: Hash,
    data: EncryptedData,
    skipIfExists = false,
  ): Promise<void> => {
    try {
      await writeAt(hash, data, skipIfExists);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const retrieve = async (hash: Hash, options?: { verifyIntegrity?: boolean }): Promise<EncryptedData> => {
    const path = blockPath(hash);
    try {
      const data = await io.readFile(path);
      if (options?.verifyIntegrity !== false) {
        const validation = await validateBlockBytes(hash, data);
        if (!validation.ok) {
          await io.deleteFile(path).catch(() => undefined);
          throw new StorageError(`Failed to retrieve block: ${validation.detail ?? 'block hash mismatch'}`);
        }
      }
      return data as EncryptedData;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to retrieve block: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const has = async (hash: Hash): Promise<boolean> => io.exists(blockPath(hash));
  const listBlocks = async (): Promise<Hash[]> => {
    const files = await io.listFiles('blocks');
    const hashes: Hash[] = [];
    for (const file of files) {
      const match = file.match(BLOCK_FILE_RE);
      if (match?.[1]) {
        hashes.push(match[1].toLowerCase() as Hash);
      }
    }
    return hashes.sort((a, b) => a.localeCompare(b));
  };

  return { store, storeAlreadyVerified, retrieve, has, listBlocks };
}
