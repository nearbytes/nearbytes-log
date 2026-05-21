import { StorageError, computeHash, verifyPU } from 'nearbytes-crypto';
import { defaultPathMapper, eventHashFromFileName, eventPath, publicKeyToHex } from '../paths.js';
import { deserializeEvent, serializeEvent, serializeEventEnvelope } from '../serialization.js';
import { validateEventBytes } from '../integrity.js';
/**
 * Event log backed by a `LogIo` implementation.
 */
export function createEventLogApi(io, pathMapper = defaultPathMapper) {
    const storeEvent = async (publicKey, event) => {
        try {
            const envelopeBytes = serializeEventEnvelope(event.envelope);
            const eventHash = await computeHash(envelopeBytes);
            const serialized = serializeEvent(event);
            const eventBytes = new TextEncoder().encode(JSON.stringify(serialized));
            await io.writeFile(eventPath(pathMapper, publicKey, eventHash), eventBytes);
            return eventHash;
        }
        catch (error) {
            throw new StorageError(`Failed to store event: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    const retrieveEvent = async (publicKey, eventHash) => {
        const channelHex = publicKeyToHex(publicKey);
        const path = eventPath(pathMapper, publicKey, eventHash);
        try {
            const eventBytes = await io.readFile(path);
            const validation = await validateEventBytes(channelHex, eventHash, eventBytes);
            if (!validation.ok) {
                await io.deleteFile(path).catch(() => undefined);
                throw new StorageError(`Failed to retrieve event: ${validation.detail ?? 'event validation failed'}`);
            }
            const serialized = JSON.parse(new TextDecoder().decode(eventBytes));
            const event = deserializeEvent(serialized);
            const envelopeBytes = serializeEventEnvelope(event.envelope);
            const payloadHash = await computeHash(envelopeBytes);
            if (payloadHash !== eventHash) {
                await io.deleteFile(path).catch(() => undefined);
                throw new StorageError(`Failed to retrieve event: event hash mismatch for ${eventHash}`);
            }
            const valid = await verifyPU(envelopeBytes, event.signature, publicKey).catch(() => false);
            if (!valid) {
                await io.deleteFile(path).catch(() => undefined);
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
    };
    const listEvents = async (publicKey) => {
        try {
            const files = await io.listFiles(pathMapper(publicKey));
            return files
                .map((file) => eventHashFromFileName(file))
                .filter((hash) => hash !== null);
        }
        catch (error) {
            throw new StorageError(`Failed to list events: ${error instanceof Error ? error.message : 'unknown error'}`, error instanceof Error ? error : undefined);
        }
    };
    return { storeEvent, retrieveEvent, listEvents };
}
//# sourceMappingURL=eventApi.js.map