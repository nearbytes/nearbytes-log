import type { Log } from '../api.js';
import type { ChannelPathMapper } from '../api.js';
import type { LogIo } from './io.js';
/**
 * Attaches reception journal and sync activity to a {@link LogIo} backend.
 */
export declare function createLogFromIo(io: LogIo, pathMapper: ChannelPathMapper): Log;
//# sourceMappingURL=enhanceLog.d.ts.map