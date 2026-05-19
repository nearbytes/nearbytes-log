import type { Hash as HashType, EncryptedData } from 'nearbytes-crypto';
import { StorageError } from 'nearbytes-crypto';
import type { PublicKey } from 'nearbytes-crypto';
import type { StorageBackend } from 'nearbytes-storage';
import { validateBlockBytes } from './integrity.js';
import { isMultiRootStorageBackend, publicKeyToHex } from './multiRootCompat.js';

/**
 * Content-addressed store for encrypted data blocks.
 *
 * Blocks are keyed by the SHA-256 hash of their bytes.
 * There is no ordering on blocks — they are a pure key→value store.
 */
export class BlockStore {
  constructor(private readonly storage: StorageBackend) {}

  private blockPath(hash: HashType): string {
    return `blocks/${hash}.bin`;
  }

  async store(
    hash: HashType,
    data: EncryptedData,
    skipIfExists = false,
    publicKey?: PublicKey
  ): Promise<void> {
    try {
      const path = this.blockPath(hash);
      const channelHex = publicKey ? publicKeyToHex(publicKey) : undefined;

      if (
        skipIfExists &&
        (isMultiRootStorageBackend(this.storage) && channelHex
          ? await this.storage.existsForChannel(path, channelHex)
          : await this.storage.exists(path))
      ) {
        return;
      }

      if (isMultiRootStorageBackend(this.storage)) {
        if (!channelHex) {
          throw new StorageError('Public key is required for multi-root block writes');
        }
        await this.storage.writeFileForChannel(path, data, channelHex);
      } else {
        await this.storage.writeFile(path, data);
      }
    } catch (error) {
      throw new StorageError(
        `Failed to store block: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async retrieve(hash: HashType, publicKey?: PublicKey): Promise<EncryptedData> {
    try {
      const path = this.blockPath(hash);
      const channelHex = publicKey ? publicKeyToHex(publicKey) : undefined;

      const data = isMultiRootStorageBackend(this.storage) && channelHex
        ? await this.storage.readValidatedFileForChannel(path, channelHex, (bytes) => validateBlockBytes(hash, bytes))
        : isMultiRootStorageBackend(this.storage)
          ? await this.storage.readValidatedFile(path, (bytes) => validateBlockBytes(hash, bytes))
          : await this.storage.readFile(path);

      if (!isMultiRootStorageBackend(this.storage)) {
        const validation = await validateBlockBytes(hash, data);
        if (!validation.ok) {
          await this.storage.deleteFile(path).catch(() => undefined);
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
        error instanceof Error ? error : undefined
      );
    }
  }

  async has(hash: HashType, publicKey?: PublicKey): Promise<boolean> {
    const path = this.blockPath(hash);
    const channelHex = publicKey ? publicKeyToHex(publicKey) : undefined;
    if (isMultiRootStorageBackend(this.storage) && channelHex) {
      return this.storage.existsForChannel(path, channelHex);
    }
    return this.storage.exists(path);
  }
}
