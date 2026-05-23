import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { StorageError } from 'nearbytes-crypto';
/**
 * Node.js filesystem I/O rooted at `basePath`.
 */
export function createFsIo(basePath) {
    const readFile = async (path) => {
        try {
            const buffer = await fs.readFile(join(basePath, path));
            return new Uint8Array(buffer);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                throw new StorageError(`File not found: ${path}`, error);
            }
            throw new StorageError(`Failed to read file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const writeFile = async (path, data) => {
        try {
            const fullPath = join(basePath, path);
            await fs.mkdir(dirname(fullPath), { recursive: true });
            const tempPath = `${fullPath}.tmp`;
            await fs.writeFile(tempPath, data);
            await fs.rename(tempPath, fullPath);
        }
        catch (error) {
            throw new StorageError(`Failed to write file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const listFiles = async (directory) => {
        try {
            const entries = await fs.readdir(join(basePath, directory), { withFileTypes: true });
            return entries.filter((e) => e.isFile()).map((e) => e.name);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return [];
            }
            throw new StorageError(`Failed to list files in ${directory}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const listDirectories = async (directory) => {
        try {
            const entries = await fs.readdir(join(basePath, directory), { withFileTypes: true });
            return entries.filter((e) => e.isDirectory()).map((e) => e.name);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return [];
            }
            throw new StorageError(`Failed to list directories in ${directory}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const createDirectory = async (path) => {
        try {
            await fs.mkdir(join(basePath, path), { recursive: true });
        }
        catch (error) {
            throw new StorageError(`Failed to create directory ${path}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const exists = async (path) => {
        try {
            await fs.access(join(basePath, path));
            return true;
        }
        catch {
            return false;
        }
    };
    const deleteFile = async (path) => {
        try {
            await fs.unlink(join(basePath, path));
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return;
            }
            throw new StorageError(`Failed to delete file ${path}: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    return { readFile, writeFile, listFiles, listDirectories, createDirectory, exists, deleteFile };
}
//# sourceMappingURL=fsIo.js.map