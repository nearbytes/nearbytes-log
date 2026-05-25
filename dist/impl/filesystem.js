import { defaultPathMapper } from '../paths.js';
import { createFsIo } from '../internal/fsIo.js';
import { createLogFromIo } from './fromIo.js';
/**
 * Log implementation backed by a single on-disk storage root (Node.js `fs`).
 */
export function createFilesystemLog(dataDir, pathMapper = defaultPathMapper) {
    return createLogFromIo(createFsIo(dataDir), pathMapper);
}
//# sourceMappingURL=filesystem.js.map