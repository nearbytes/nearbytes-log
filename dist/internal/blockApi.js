import { StorageError } from 'nearbytes-crypto';
import { blockPath } from '../paths.js';
import { validateBlockBytes } from '../integrity.js';
/**
 * Block store backed by a `LogIo` implementation.
 */
export function createBlockStoreApi(io) {
    const store = async (hash, data, skipIfExists = false) => {
        try {
            const path = blockPath(hash);
            if (skipIfExists && (await io.exists(path))) {
                return;
            }
            await io.writeFile(path, data);
        }
        catch (error) {
            throw new StorageError(`Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const retrieve = async (hash) => {
        const path = blockPath(hash);
        try {
            const data = await io.readFile(path);
            const validation = await validateBlockBytes(hash, data);
            if (!validation.ok) {
                await io.deleteFile(path).catch(() => undefined);
                throw new StorageError(`Failed to retrieve block: ${validation.detail ?? 'block hash mismatch'}`);
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
    return { store, retrieve, has };
}
//# sourceMappingURL=blockApi.js.map