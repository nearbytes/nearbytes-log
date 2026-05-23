import type { Hash, PublicKey } from 'nearbytes-crypto';
import type { BlockStoreApi, EventLogApi, Log } from '../api.js';
import type { ChannelPathMapper } from '../api.js';
import { publicKeyFromHex } from '../integrity.js';
import {
  receptionRefForBlock,
  receptionRefForEvent,
  createReceptionJournal,
} from './receptionJournal.js';
import { createSyncActivity } from './syncActivity.js';
import { createBlockStoreApi } from './blockApi.js';
import { createEventLogApi } from './eventApi.js';
import type { LogIo } from './io.js';

async function listChannelHex(io: LogIo): Promise<string[]> {
  const entries = await io.listDirectories('channels');
  return entries.filter((name) => /^[a-f0-9]{130}$/i.test(name));
}

function wrapEventLog(
  base: Omit<EventLogApi, 'listChannels'>,
  onStored: (pk: PublicKey, hash: Hash) => Promise<void>,
  listChannels: () => Promise<PublicKey[]>,
): EventLogApi {
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

function wrapBlockStore(base: BlockStoreApi, onStored: (hash: Hash) => Promise<void>): BlockStoreApi {
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
export function createLogFromIo(io: LogIo, pathMapper: ChannelPathMapper): Log {
  const reception = createReceptionJournal(io);
  const sync = createSyncActivity(io);
  const baseEvents = createEventLogApi(io, pathMapper);
  const baseBlocks = createBlockStoreApi(io);

  const listChannels = async (): Promise<PublicKey[]> => {
    const hexes = await listChannelHex(io);
    const keys: PublicKey[] = [];
    for (const hex of hexes) {
      const pk = publicKeyFromHex(hex);
      if (pk) {
        keys.push(pk);
      }
    }
    return keys;
  };

  const events = wrapEventLog(
    baseEvents,
    async (pk, hash) => {
      await reception.appendReception(receptionRefForEvent(pk, hash));
    },
    listChannels,
  );

  const blocks = wrapBlockStore(baseBlocks, async (hash) => {
    await reception.appendReception(receptionRefForBlock(hash));
  });

  return { events, blocks, reception, sync };
}
