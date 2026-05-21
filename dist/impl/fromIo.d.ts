import type { ChannelPathMapper, Log } from '../api.js';
import type { LogIo } from '../internal/io.js';
/**
 * Builds a `Log` from a custom `LogIo` (advanced composition, e.g. multi-root routers).
 */
export declare function createLogFromIo(io: LogIo, pathMapper?: ChannelPathMapper): Log;
//# sourceMappingURL=fromIo.d.ts.map