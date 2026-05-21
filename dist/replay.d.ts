import type { CryptoOperations } from 'nearbytes-crypto';
import type { Channel } from './channel.js';
import type { Log } from './api.js';
import type { EventLogEntry } from './types.js';
/**
 * Loads all events for a channel from the log and returns them in deterministic order.
 */
export declare function loadEventLog(channel: Channel, log: Log, crypto: CryptoOperations): Promise<EventLogEntry[]>;
/**
 * Verifies envelope signatures for all replayed entries against the channel public key.
 */
export declare function verifyEventLog(entries: readonly EventLogEntry[], channel: Channel, crypto: CryptoOperations): Promise<void>;
//# sourceMappingURL=replay.d.ts.map