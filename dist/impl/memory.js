import { defaultPathMapper } from '../paths.js';
import { createMemoryIo } from '../internal/memoryIo.js';
import { createMemoryStore } from '../internal/memoryStore.js';
import { createLogFromIo } from './fromIo.js';
/**
 * Log implementation backed by an in-memory path map (tests, embedded runtimes).
 */
export function createInMemoryLog(options = {}) {
    const store = options.store ?? createMemoryStore();
    const io = createMemoryIo(store);
    const pathMapper = options.pathMapper ?? defaultPathMapper;
    return createLogFromIo(io, pathMapper);
}
//# sourceMappingURL=memory.js.map