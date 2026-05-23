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
 */
export interface BlockStoreApi {
    store(hash: Hash, data: EncryptedData, skipIfExists?: boolean): Promise<void>;
    retrieve(hash: Hash): Promise<EncryptedData>;
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