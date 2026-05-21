import type { ChannelPathMapper, Log } from '../api.js';
import type { MemoryStore } from '../internal/memoryStore.js';
export interface InMemoryLogOptions {
    readonly pathMapper?: ChannelPathMapper;
    readonly store?: MemoryStore;
}
/**
 * Log implementation backed by an in-memory path map (tests, embedded runtimes).
 */
export declare function createInMemoryLog(options?: InMemoryLogOptions): Log;
//# sourceMappingURL=memory.d.ts.map