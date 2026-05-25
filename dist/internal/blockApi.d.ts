import type { BlockStoreApi } from '../api.js';
import type { LogIo } from './io.js';
/**
 * Block store backed by a `LogIo` implementation. The log is the sole
 * authority of the block content-address (see `storage/log-api-v1.md` §2.3):
 * `store(data)` computes the SHA-256 and returns the hash; the
 * `storeAlreadyVerified(hash, data)` fast path is reserved for the streaming
 * receiver of `nearbytes-sync`.
 */
export declare function createBlockStoreApi(io: LogIo): BlockStoreApi;
//# sourceMappingURL=blockApi.d.ts.map