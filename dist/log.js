import { defaultPathMapper } from 'nearbytes-storage';
import { EventLog } from './eventLog.js';
import { BlockStore } from './blockStore.js';
export function createLog(storage, pathMapper = defaultPathMapper) {
    return {
        events: new EventLog(storage, pathMapper),
        blocks: new BlockStore(storage),
    };
}
//# sourceMappingURL=log.js.map