import type { Hash, PublicKey } from 'nearbytes-crypto';
import type { BlockStoreApi, EventLogApi, Log } from '../api.js';
import type { ChannelPathMapper } from '../api.js';
import { publicKeyFromHex } from '../integrity.js';
import { receptionRefForEvent, createReceptionJournal } from './receptionJournal.js';
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
    store: async (data, skipIfExists) => {
      const hash = await base.store(data, skipIfExists);
      // The reception journal is idempotent on duplicates; we don't need a
      // pre-check (the hash is only knowable after `base.store` returns).
      await onStored(hash);
      return hash;
    },
    storeAlreadyVerified: async (hash, data, skipIfExists) => {
      const existed = skipIfExists ? await base.has(hash) : false;
      await base.storeAlreadyVerified(hash, data, skipIfExists);
      if (!existed) {
        await onStored(hash);
      }
    },
    retrieve: (hash, options) => base.retrieve(hash, options),
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
      const flush = (reception as { flushLocalHave?: () => void }).flushLocalHave;
      queueMicrotask(() => flush?.());
    },
    listChannels,
  );

  // Block blobs are named in the event's visible `blockRefs`; a separate reception
  // row would race ahead of the event and produce a blocks-only urgent `have`.
  const blocks = wrapBlockStore(baseBlocks, async () => {});

  return { events, blocks, reception, sync };
}
