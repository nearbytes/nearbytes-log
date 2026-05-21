import type { EncryptedData, Hash } from 'nearbytes-crypto';
import { StorageError } from 'nearbytes-crypto';
import type { BlockStoreApi } from '../api.js';
import { blockPath } from '../paths.js';
import { validateBlockBytes } from '../integrity.js';
import type { LogIo } from './io.js';

/**
 * Block store backed by a `LogIo` implementation.
 */
export function createBlockStoreApi(io: LogIo): BlockStoreApi {
  const store = async (
    hash: Hash,
    data: EncryptedData,
    skipIfExists = false,
  ): Promise<void> => {
    try {
      const path = blockPath(hash);
      if (skipIfExists && (await io.exists(path))) {
        return;
      }
      await io.writeFile(path, data);
    } catch (error) {
      throw new StorageError(
        `Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const retrieve = async (hash: Hash): Promise<EncryptedData> => {
    const path = blockPath(hash);
    try {
      const data = await io.readFile(path);
      const validation = await validateBlockBytes(hash, data);
      if (!validation.ok) {
        await io.deleteFile(path).catch(() => undefined);
        throw new StorageError(`Failed to retrieve block: ${validation.detail ?? 'block hash mismatch'}`);
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

  return { store, retrieve, has };
}
