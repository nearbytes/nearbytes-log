import type { ChannelPathMapper } from 'nearbytes-storage';
import type { StorageBackend } from 'nearbytes-storage';
import { EventLog } from './eventLog.js';
import { BlockStore } from './blockStore.js';
/**
 * Combined log handle: an EventLog + BlockStore sharing the same storage backend.
 * Convenience for callers that need both — use the individual classes if you only need one.
 */
export interface Log {
    readonly events: EventLog;
    readonly blocks: BlockStore;
}
export declare function createLog(storage: StorageBackend, pathMapper?: ChannelPathMapper): Log;
//# sourceMappingURL=log.d.ts.map