import { publicKeyFromHex } from '../integrity.js';
import { receptionRefForBlock, receptionRefForEvent, createReceptionJournal, } from './receptionJournal.js';
import { createSyncActivity } from './syncActivity.js';
import { createBlockStoreApi } from './blockApi.js';
import { createEventLogApi } from './eventApi.js';
async function listChannelHex(io) {
    const entries = await io.listDirectories('channels');
    return entries.filter((name) => /^[a-f0-9]{130}$/i.test(name));
}
function wrapEventLog(base, onStored, listChannels) {
    return {
        storeEvent: async (publicKey, event) => {
            const hash = await base.storeEvent(publicKey, event);
            await onStored(publicKey, hash);
            return hash;
        },
        retrieveEvent: (publicKey, eventHash) => base.retrieveEvent(publicKey, eventHash),
        listEvents: (publicKey) => base.listEvents(publicKey),
        listChannels,
    };
}
function wrapBlockStore(base, onStored) {
    return {
        store: async (hash, data, skipIfExists) => {
            const existed = await base.has(hash);
            await base.store(hash, data, skipIfExists);
            if (!existed || !skipIfExists) {
                await onStored(hash);
            }
        },
        retrieve: (hash) => base.retrieve(hash),
        has: (hash) => base.has(hash),
    };
}
/**
 * Attaches reception journal and sync activity to a {@link LogIo} backend.
 */
export function createLogFromIo(io, pathMapper) {
    const reception = createReceptionJournal(io);
    const sync = createSyncActivity(io);
    const baseEvents = createEventLogApi(io, pathMapper);
    const baseBlocks = createBlockStoreApi(io);
    const listChannels = async () => {
        const hexes = await listChannelHex(io);
        const keys = [];
        for (const hex of hexes) {
            const pk = publicKeyFromHex(hex);
            if (pk) {
                keys.push(pk);
            }
        }
        return keys;
    };
    const events = wrapEventLog(baseEvents, async (pk, hash) => {
        await reception.appendReception(receptionRefForEvent(pk, hash));
    }, listChannels);
    const blocks = wrapBlockStore(baseBlocks, async (hash) => {
        await reception.appendReception(receptionRefForBlock(hash));
    });
    return { events, blocks, reception, sync };
}
//# sourceMappingURL=enhanceLog.js.map