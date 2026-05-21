import { defaultPathMapper } from '../paths.js';
import { createBlockStoreApi } from '../internal/blockApi.js';
import { createEventLogApi } from '../internal/eventApi.js';
import { createFsIo } from '../internal/fsIo.js';
/**
 * Log implementation backed by a single on-disk storage root (Node.js `fs`).
 */
export function createFilesystemLog(dataDir, pathMapper = defaultPathMapper) {
    const io = createFsIo(dataDir);
    return {
        events: createEventLogApi(io, pathMapper),
        blocks: createBlockStoreApi(io),
    };
}
//# sourceMappingURL=filesystem.js.map