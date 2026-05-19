import { StorageError } from 'nearbytes-crypto';
import { createHash, computeHash, verifyPU } from 'nearbytes-crypto';
import { defaultPathMapper } from 'nearbytes-storage';
import { serializeEvent, deserializeEvent, serializeEventEnvelope } from './serialization.js';
import { validateEventBytes } from './integrity.js';
import { isMultiRootStorageBackend, publicKeyToHex } from './multiRootCompat.js';
/**
 * Append-only, partially-ordered event log for a single channel (public key).
 *
 * Events are content-addressed by the SHA-256 hash of their serialized envelope.
 * Ordering is partial: events are sorted deterministically by hash on replay,
 * but there is no global sequence number or causal total order imposed here.
 */
export class EventLog {
    constructor(storage, pathMapper = defaultPathMapper) {
        this.storage = storage;
        this.pathMapper = pathMapper;
    }
    channelPath(publicKey) {
        return this.pathMapper(publicKey);
    }
    eventPath(publicKey, eventHash) {
        return `${this.channelPath(publicKey)}/${eventHash}.bin`;
    }
    async storeEvent(publicKey, event) {
        try {
            const envelopeBytes = serializeEventEnvelope(event.envelope);
            const eventHash = await computeHash(envelopeBytes);
            const serialized = serializeEvent(event);
            const eventBytes = new TextEncoder().encode(JSON.stringify(serialized));
            const eventPath = this.eventPath(publicKey, eventHash);
            const channelHex = publicKeyToHex(publicKey);
            if (isMultiRootStorageBackend(this.storage)) {
                await this.storage.writeFileForChannel(eventPath, eventBytes, channelHex);
            }
            else {
                await this.storage.writeFile(eventPath, eventBytes);
            }
            return eventHash;
        }
        catch (error) {
            throw new StorageError(`Failed to store event: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
    async retrieveEvent(publicKey, eventHash) {
        try {
            const eventPath = this.eventPath(publicKey, eventHash);
            const channelHex = publicKeyToHex(publicKey);
            const eventBytes = isMultiRootStorageBackend(this.storage)
                ? await this.storage.readValidatedFileForChannel(eventPath, channelHex, (data) => validateEventBytes(channelHex, eventHash, data))
                : await this.storage.readFile(eventPath);
            if (!isMultiRootStorageBackend(this.storage)) {
                const validation = await validateEventBytes(channelHex, eventHash, eventBytes);
                if (!validation.ok) {
                    await this.storage.deleteFile(eventPath).catch(() => undefined);
                    throw new StorageError(`Failed to retrieve event: ${validation.detail ?? 'event validation failed'}`);
                }
            }
            const serialized = JSON.parse(new TextDecoder().decode(eventBytes));
            const event = deserializeEvent(serialized);
            const envelopeBytes = serializeEventEnvelope(event.envelope);
            const payloadHash = await computeHash(envelopeBytes);
            if (payloadHash !== eventHash) {
                await this.storage.deleteFile(eventPath).catch(() => undefined);
                throw new StorageError(`Failed to retrieve event: event hash mismatch for ${eventHash}`);
            }
            const valid = await verifyPU(envelopeBytes, event.signature, publicKey).catch(() => false);
            if (!valid) {
                await this.storage.deleteFile(eventPath).catch(() => undefined);
                throw new StorageError(`Failed to retrieve event: signature verification failed for ${eventHash}`);
            }
            return event;
        }
        catch (error) {
            if (error instanceof StorageError) {
                throw error;
            }
            throw new StorageError(`Failed to retrieve event: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
    async listEvents(publicKey) {
        try {
            const channelPath = this.channelPath(publicKey);
            const files = isMultiRootStorageBackend(this.storage)
                ? await this.storage.listFilesAcrossRoots(channelPath)
                : await this.storage.listFiles(channelPath);
            return files
                .map((file) => normalizeEventHashFromFileName(file))
                .filter((hash) => hash !== null);
        }
        catch (error) {
            throw new StorageError(`Failed to list events: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    }
}
function normalizeEventHashFromFileName(fileName) {
    const normalized = fileName.trim();
    const match = normalized.match(/^([a-f0-9]{64})\.bin$/i);
    if (!match || !match[1]) {
        return null;
    }
    return createHash(match[1]);
}
//# sourceMappingURL=eventLog.js.map