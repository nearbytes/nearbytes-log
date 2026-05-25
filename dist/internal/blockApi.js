import { computeHash, StorageError } from 'nearbytes-crypto';
import { blockPath } from '../paths.js';
import { validateBlockBytes } from '../integrity.js';
/**
 * Block store backed by a `LogIo` implementation. The log is the sole
 * authority of the block content-address (see `storage/log-api-v1.md` §2.3):
 * `store(data)` computes the SHA-256 and returns the hash; the
 * `storeAlreadyVerified(hash, data)` fast path is reserved for the streaming
 * receiver of `nearbytes-sync`.
 */
export function createBlockStoreApi(io) {
    const writeAt = async (hash, data, skipIfExists) => {
        const path = blockPath(hash);
        if (skipIfExists && (await io.exists(path))) {
            return;
        }
        await io.writeFile(path, data);
    };
    const store = async (data, skipIfExists = false) => {
        try {
            const hash = await computeHash(data);
            await writeAt(hash, data, skipIfExists);
            return hash;
        }
        catch (error) {
            if (error instanceof StorageError)
                throw error;
            throw new StorageError(`Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const storeAlreadyVerified = async (hash, data, skipIfExists = false) => {
        try {
            await writeAt(hash, data, skipIfExists);
        }
        catch (error) {
            if (error instanceof StorageError)
                throw error;
            throw new StorageError(`Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const retrieve = async (hash, options) => {
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
            return data;
        }
        catch (error) {
            if (error instanceof StorageError) {
                throw error;
            }
            throw new StorageError(`Failed to retrieve block: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const has = async (hash) => io.exists(blockPath(hash));
    return { store, storeAlreadyVerified, retrieve, has };
}
//# sourceMappingURL=blockApi.js.map