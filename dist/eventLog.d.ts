import type { Hash as HashType, SignedEvent } from 'nearbytes-crypto';
import type { PublicKey } from 'nearbytes-crypto';
import type { StorageBackend, ChannelPathMapper } from 'nearbytes-storage';
/**
 * Append-only, partially-ordered event log for a single channel (public key).
 *
 * Events are content-addressed by the SHA-256 hash of their serialized envelope.
 * Ordering is partial: events are sorted deterministically by hash on replay,
 * but there is no global sequence number or causal total order imposed here.
 */
export declare class EventLog {
    private readonly storage;
    private readonly pathMapper;
    constructor(storage: StorageBackend, pathMapper?: ChannelPathMapper);
    private channelPath;
    private eventPath;
    storeEvent(publicKey: PublicKey, event: SignedEvent): Promise<HashType>;
    retrieveEvent(publicKey: PublicKey, eventHash: HashType): Promise<SignedEvent>;
    listEvents(publicKey: PublicKey): Promise<HashType[]>;
}
//# sourceMappingURL=eventLog.d.ts.map