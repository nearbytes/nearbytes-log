import type { EncryptedData, Hash, PublicKey, SignedEvent } from 'nearbytes-crypto';
import type { ReceptionApi, SyncActivityApi } from './reception.js';
/**
 * Maps a channel public key to its storage directory path (e.g. `channels/<hex>`).
 */
export type ChannelPathMapper = (publicKey: PublicKey) => string;
/**
 * Append-only event log for a single channel.
 */
export interface EventLogApi {
    storeEvent(publicKey: PublicKey, event: SignedEvent): Promise<Hash>;
    retrieveEvent(publicKey: PublicKey, eventHash: Hash): Promise<SignedEvent>;
    listEvents(publicKey: PublicKey): Promise<Hash[]>;
    /** Channel public keys that have a `channels/<hex>/` directory. */
    listChannels(): Promise<PublicKey[]>;
}
/**
 * Content-addressed encrypted block store.
 *
 * The log is the sole authority of the block content-address namespace; see
 * `storage/log-api-v1.md` (v1.1) and `engineering/hash-evolution-v1.md` in
 * `nearbytes-specs`. Callers MUST NOT precompute a block hash and pass it to
 * the log via `store`; they receive the hash from the log as the return value.
 * The only exception is `storeAlreadyVerified`, reserved exclusively for the
 * `nearbytes-sync` streaming receiver, which verifies the digest incrementally
 * as bytes arrive over the wire and so does not need a second pass.
 */
export interface BlockRetrieveOptions {
    /** When false, skip SHA-256 verify on read (sync sender already addressed by hash). Default true. */
    readonly verifyIntegrity?: boolean;
}
export interface BlockStoreApi {
    /**
     * Persist `data` under its content-address. The log computes the SHA-256
     * of the bytes it writes and returns the resulting `Hash`. When
     * `skipIfExists` is true and a block with the computed hash is already on
     * disk, the call is a no-op aside from returning the hash.
     */
    store(data: EncryptedData, skipIfExists?: boolean): Promise<Hash>;
    /**
     * Streaming-receiver fast path. The caller asserts that
     * `hash === SHA-256(data)` has already been verified incrementally (e.g.
     * in `nearbytes-sync`'s block stream sink) and the log MUST NOT
     * recompute the digest. Misuse of this method (passing a hash that does
     * not match `data`) silently corrupts the content-address namespace and
     * is a programming error. Use `store` everywhere else.
     */
    storeAlreadyVerified(hash: Hash, data: EncryptedData, skipIfExists?: boolean): Promise<void>;
    retrieve(hash: Hash, options?: BlockRetrieveOptions): Promise<EncryptedData>;
    has(hash: Hash): Promise<boolean>;
}
/**
 * Combined log handle — the persistence contract for the Nearbytes protocol.
 */
export interface Log {
    readonly events: EventLogApi;
    readonly blocks: BlockStoreApi;
    readonly reception: ReceptionApi;
    readonly sync: SyncActivityApi;
}
//# sourceMappingURL=api.d.ts.map