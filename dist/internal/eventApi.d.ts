import type { ChannelPathMapper, EventLogApi } from '../api.js';
import type { LogIo } from './io.js';
/**
 * Event log backed by a `LogIo` implementation.
 */
export declare function createEventLogApi(io: LogIo, pathMapper?: ChannelPathMapper): EventLogApi;
//# sourceMappingURL=eventApi.d.ts.map