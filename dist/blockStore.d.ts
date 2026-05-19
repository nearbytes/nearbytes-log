import type { Hash as HashType, EncryptedData } from 'nearbytes-crypto';
import type { PublicKey } from 'nearbytes-crypto';
import type { StorageBackend } from 'nearbytes-storage';
/**
 * Content-addressed store for encrypted data blocks.
 *
 * Blocks are keyed by the SHA-256 hash of their bytes.
 * There is no ordering on blocks — they are a pure key→value store.
 */
export declare class BlockStore {
    private readonly storage;
    constructor(storage: StorageBackend);
    private blockPath;
    store(hash: HashType, data: EncryptedData, skipIfExists?: boolean, publicKey?: PublicKey): Promise<void>;
    retrieve(hash: HashType, publicKey?: PublicKey): Promise<EncryptedData>;
    has(hash: HashType, publicKey?: PublicKey): Promise<boolean>;
}
//# sourceMappingURL=blockStore.d.ts.map