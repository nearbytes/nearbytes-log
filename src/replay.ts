import type { CryptoOperations } from 'nearbytes-crypto';
import type { Channel } from './channel.js';
import type { Log } from './api.js';
import type { EventLogEntry } from './types.js';
import { serializeEventEnvelope } from './serialization.js';
import { eventEnvelopePublicKeyMatches, hydrateSignedEvent } from './eventEnvelope.js';

/**
 * Loads all events for a channel from the log and returns them in deterministic order.
 */
export async function loadEventLog(
  channel: Channel,
  log: Log,
  crypto: CryptoOperations,
): Promise<EventLogEntry[]> {
  const keyPair = await crypto.deriveKeys(channel.secret);
  const eventHashes = await log.events.listEvents(keyPair.publicKey);

  const entries: EventLogEntry[] = [];
  for (const eventHash of eventHashes) {
    try {
      const signedEvent = await log.events.retrieveEvent(keyPair.publicKey, eventHash);
      if (!eventEnvelopePublicKeyMatches(signedEvent, keyPair.publicKey)) {
        continue;
      }
      entries.push({
        eventHash,
        signedEvent: await hydrateSignedEvent(crypto, keyPair.privateKey, signedEvent),
      });
    } catch {
      // Skip unreadable/corrupt events so one bad file does not brick the whole channel.
      continue;
    }
  }

  entries.sort((left, right) => {
    if (left.eventHash < right.eventHash) return -1;
    if (left.eventHash > right.eventHash) return 1;
    return 0;
  });

  return entries;
}

/**
 * Verifies envelope signatures for all replayed entries against the channel public key.
 */
export async function verifyEventLog(
  entries: readonly EventLogEntry[],
  channel: Channel,
  crypto: CryptoOperations,
): Promise<void> {
  for (const entry of entries) {
    const payloadBytes = serializeEventEnvelope(entry.signedEvent.envelope);
    const isValid = await crypto.verifyPU(
      payloadBytes,
      entry.signedEvent.signature,
      channel.publicKey,
    );
    if (!isValid) {
      throw new Error(`Event signature verification failed for event ${entry.eventHash}`);
    }
  }
}
