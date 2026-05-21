import type { ChannelPathMapper, Log } from '../api.js';
import { defaultPathMapper } from '../paths.js';
import { createBlockStoreApi } from '../internal/blockApi.js';
import { createEventLogApi } from '../internal/eventApi.js';
import type { LogIo } from '../internal/io.js';

/**
 * Builds a `Log` from a custom `LogIo` (advanced composition, e.g. multi-root routers).
 */
export function createLogFromIo(
  io: LogIo,
  pathMapper: ChannelPathMapper = defaultPathMapper,
): Log {
  return {
    events: createEventLogApi(io, pathMapper),
    blocks: createBlockStoreApi(io),
  };
}
