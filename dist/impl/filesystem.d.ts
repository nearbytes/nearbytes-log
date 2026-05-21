import type { ChannelPathMapper, Log } from '../api.js';
/**
 * Log implementation backed by a single on-disk storage root (Node.js `fs`).
 */
export declare function createFilesystemLog(dataDir: string, pathMapper?: ChannelPathMapper): Log;
//# sourceMappingURL=filesystem.d.ts.map