import { defaultPathMapper } from '../paths.js';
import { createBlockStoreApi } from '../internal/blockApi.js';
import { createEventLogApi } from '../internal/eventApi.js';
/**
 * Builds a `Log` from a custom `LogIo` (advanced composition, e.g. multi-root routers).
 */
export function createLogFromIo(io, pathMapper = defaultPathMapper) {
    return {
        events: createEventLogApi(io, pathMapper),
        blocks: createBlockStoreApi(io),
    };
}
//# sourceMappingURL=fromIo.js.map