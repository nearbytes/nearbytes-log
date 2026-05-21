import type { ChannelPathMapper } from 'nearbytes-storage';
import type { StorageBackend } from 'nearbytes-storage';
import { defaultPathMapper } from 'nearbytes-storage';
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

/**
 * Creates a `Log` handle wired to the given storage backend.
 *
 * This is the primary entry point for the log layer. Pass the result to
 * `nearbytes-files` or any higher-level consumer that needs both events and
 * blocks.
 *
 * @param storage    - Environment-specific storage backend (filesystem, in-memory, …)
 * @param pathMapper - Maps a channel public key to its storage directory path.
 *                     Defaults to `channels/<hex-public-key>`.
 */
export function createLog(
  storage: StorageBackend,
  pathMapper: ChannelPathMapper = defaultPathMapper
): Log {
  return {
    events: new EventLog(storage, pathMapper),
    blocks: new BlockStore(storage),
  };
}
