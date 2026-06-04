import type { Hash, PublicKey, SerializedEvent, SignedEvent } from 'nearbytes-crypto';
import { StorageError, computeHash, verifyPU } from 'nearbytes-crypto';
import type { ChannelPathMapper, EventLogApi } from '../api.js';
import { publicKeyFromHex } from '../integrity.js';
import { defaultPathMapper, eventHashFromFileName, eventPath, publicKeyToHex } from '../paths.js';
import { deserializeEvent, serializeEvent, serializeEventEnvelope } from '../serialization.js';
import { validateEventBytes } from '../integrity.js';
import type { LogIo } from './io.js';

/**
 * Event log backed by a `LogIo` implementation.
 */
export function createEventLogApi(
  io: LogIo,
  pathMapper: ChannelPathMapper = defaultPathMapper,
): Omit<EventLogApi, 'subscribe'> {
  const storeEvent = async (publicKey: PublicKey, event: SignedEvent): Promise<Hash> => {
    try {
      const envelopeBytes = serializeEventEnvelope(event.envelope);
      const eventHash = await computeHash(envelopeBytes);
      const serialized = serializeEvent(event);
      const eventBytes = new TextEncoder().encode(JSON.stringify(serialized));
      await io.writeFile(eventPath(pathMapper, publicKey, eventHash), eventBytes);
      return eventHash;
    } catch (error) {
      throw new StorageError(
        `Failed to store event: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const retrieveEvent = async (
    publicKey: PublicKey,
    eventHash: Hash,
    options?: { readonly verifySignature?: boolean },
  ): Promise<SignedEvent> => {
    const channelHex = publicKeyToHex(publicKey);
    const path = eventPath(pathMapper, publicKey, eventHash);
    try {
      const eventBytes = await io.readFile(path);
      const validation = await validateEventBytes(channelHex, eventHash, eventBytes);
      if (!validation.ok) {
        await io.deleteFile(path).catch(() => undefined);
        throw new StorageError(`Failed to retrieve event: ${validation.detail ?? 'event validation failed'}`);
      }

      const serialized = JSON.parse(new TextDecoder().decode(eventBytes)) as SerializedEvent;
      const event = deserializeEvent(serialized);
      const envelopeBytes = serializeEventEnvelope(event.envelope);
      const payloadHash = await computeHash(envelopeBytes);
      if (payloadHash !== eventHash) {
        await io.deleteFile(path).catch(() => undefined);
        throw new StorageError(`Failed to retrieve event: event hash mismatch for ${eventHash}`);
      }
      // Signature re-verification is skippable for replay of an already-accepted
      // local log (events are signature-verified at reception/emit). The hash
      // check above still guarantees the bytes match the content-address.
      if (options?.verifySignature !== false) {
        const valid = await verifyPU(envelopeBytes, event.signature, publicKey).catch(() => false);
        if (!valid) {
          await io.deleteFile(path).catch(() => undefined);
          throw new StorageError(`Failed to retrieve event: signature verification failed for ${eventHash}`);
        }
      }
      return event;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to retrieve event: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const listEvents = async (publicKey: PublicKey): Promise<Hash[]> => {
    try {
      const files = await io.listFiles(pathMapper(publicKey));
      return files
        .map((file) => eventHashFromFileName(file))
        .filter((hash): hash is Hash => hash !== null);
    } catch (error) {
      throw new StorageError(
        `Failed to list events: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  };

  const listChannels = async (): Promise<PublicKey[]> => {
    const dirs = await io.listDirectories('channels');
    const keys: PublicKey[] = [];
    for (const hex of dirs) {
      const pk = publicKeyFromHex(hex);
      if (pk) {
        keys.push(pk);
      }
    }
    return keys;
  };

  return { storeEvent, retrieveEvent, listEvents, listChannels };
}
