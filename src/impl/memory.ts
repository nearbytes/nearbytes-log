import type { ChannelPathMapper, Log } from '../api.js';
import { defaultPathMapper } from '../paths.js';
import { createBlockStoreApi } from '../internal/blockApi.js';
import { createEventLogApi } from '../internal/eventApi.js';
import { createMemoryIo } from '../internal/memoryIo.js';
import type { MemoryStore } from '../internal/memoryStore.js';
import { createMemoryStore } from '../internal/memoryStore.js';

export interface InMemoryLogOptions {
  readonly pathMapper?: ChannelPathMapper;
  readonly store?: MemoryStore;
}

/**
 * Log implementation backed by an in-memory path map (tests, embedded runtimes).
 */
export function createInMemoryLog(options: InMemoryLogOptions = {}): Log {
  const store = options.store ?? createMemoryStore();
  const io = createMemoryIo(store);
  const pathMapper = options.pathMapper ?? defaultPathMapper;
  return {
    events: createEventLogApi(io, pathMapper),
    blocks: createBlockStoreApi(io),
  };
}
