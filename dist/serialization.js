import { EVENT_ENVELOPE_VERSION, EventType, createEncryptedData, createHash, createSignature, } from 'nearbytes-crypto';
import { base64ToBytes, bytesToBase64 } from 'nearbytes-crypto';
export function serializeEvent(event) {
    return {
        envelope: {
            version: event.envelope.version,
            publicKey: event.envelope.publicKey,
            blockRefs: event.envelope.blockRefs,
            ciphertext: bytesToBase64(event.envelope.ciphertext),
        },
        signature: bytesToBase64(event.signature),
    };
}
export function deserializeEvent(data) {
    if (data.envelope.version !== EVENT_ENVELOPE_VERSION) {
        throw new Error(`Unsupported event envelope version: ${String(data.envelope.version)}`);
    }
    if (typeof data.envelope.publicKey !== 'string' || !/^[0-9a-f]{130}$/i.test(data.envelope.publicKey)) {
        throw new Error('Invalid event public key');
    }
    if (!Array.isArray(data.envelope.blockRefs)) {
        throw new Error('Invalid event blockRefs');
    }
    const blockRefs = data.envelope.blockRefs.map((value) => {
        if (typeof value !== 'string') {
            throw new Error('Invalid event blockRef');
        }
        return createHash(value);
    });
    return {
        envelope: {
            version: EVENT_ENVELOPE_VERSION,
            publicKey: data.envelope.publicKey.toLowerCase(),
            blockRefs,
            ciphertext: createEncryptedData(base64ToBytes(data.envelope.ciphertext)),
        },
        signature: createSignature(base64ToBytes(data.signature)),
    };
}
export function serializeEventEnvelope(envelope) {
    if (envelope.version !== EVENT_ENVELOPE_VERSION) {
        throw new Error(`Unsupported event envelope version: ${String(envelope.version)}`);
    }
    if (!/^[0-9a-f]{130}$/i.test(envelope.publicKey)) {
        throw new Error('Invalid event public key');
    }
    const encoded = JSON.stringify({
        version: envelope.version,
        publicKey: envelope.publicKey.toLowerCase(),
        blockRefs: envelope.blockRefs,
        ciphertext: bytesToBase64(envelope.ciphertext),
    });
    return new TextEncoder().encode(encoded);
}
export function serializeInnerEventPayload(payload) {
    return new TextEncoder().encode(JSON.stringify(serializeInnerEventPayloadJson(payload)));
}
export function deserializeInnerEventPayload(data) {
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder().decode(data));
    }
    catch (error) {
        throw new Error(`Invalid inner event payload JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return deserializeInnerEventPayloadJson(parsed);
}
export function serializeInnerEventPayloadJson(payload) {
    const result = {
        type: payload.type,
        fileName: payload.fileName,
        hash: payload.hash,
        encryptedKey: bytesToBase64(payload.encryptedKey),
    };
    if (payload.toFileName !== undefined)
        result.toFileName = payload.toFileName;
    if (payload.contentType !== undefined)
        result.contentType = payload.contentType;
    if (payload.size !== undefined)
        result.size = payload.size;
    if (payload.mimeType !== undefined)
        result.mimeType = payload.mimeType;
    if (payload.createdAt !== undefined)
        result.createdAt = payload.createdAt;
    if (payload.deletedAt !== undefined)
        result.deletedAt = payload.deletedAt;
    if (payload.renamedAt !== undefined)
        result.renamedAt = payload.renamedAt;
    if (payload.authorPublicKey !== undefined)
        result.authorPublicKey = payload.authorPublicKey;
    if (payload.protocol !== undefined)
        result.protocol = payload.protocol;
    if (payload.record !== undefined)
        result.record = payload.record;
    if (payload.message !== undefined)
        result.message = payload.message;
    if (payload.publishedAt !== undefined)
        result.publishedAt = payload.publishedAt;
    return result;
}
// Transitional alias while callers move from cleartext payload signing to envelope signing.
export const serializeEventPayload = serializeInnerEventPayload;
export function deserializeInnerEventPayloadJson(data) {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Event payload must be an object');
    }
    const payload = data;
    if (!Object.values(EventType).includes(payload.type)) {
        throw new Error(`Invalid event type: ${String(payload.type)}`);
    }
    if (typeof payload.fileName !== 'string') {
        throw new Error('Invalid fileName');
    }
    if (typeof payload.hash !== 'string') {
        throw new Error('Invalid hash');
    }
    if (typeof payload.encryptedKey !== 'string') {
        throw new Error('Invalid encryptedKey');
    }
    if (payload.toFileName !== undefined && typeof payload.toFileName !== 'string') {
        throw new Error('Invalid toFileName');
    }
    if (payload.contentType !== undefined && payload.contentType !== 'b' && payload.contentType !== 'm') {
        throw new Error('Invalid contentType');
    }
    if (payload.size !== undefined)
        assertFiniteUint(payload.size, 'size');
    if (payload.createdAt !== undefined)
        assertFiniteUint(payload.createdAt, 'createdAt');
    if (payload.deletedAt !== undefined)
        assertFiniteUint(payload.deletedAt, 'deletedAt');
    if (payload.renamedAt !== undefined)
        assertFiniteUint(payload.renamedAt, 'renamedAt');
    if (payload.publishedAt !== undefined)
        assertFiniteUint(payload.publishedAt, 'publishedAt');
    if (payload.mimeType !== undefined && typeof payload.mimeType !== 'string')
        throw new Error('Invalid mimeType');
    if (payload.authorPublicKey !== undefined && typeof payload.authorPublicKey !== 'string') {
        throw new Error('Invalid authorPublicKey');
    }
    if (payload.protocol !== undefined && typeof payload.protocol !== 'string')
        throw new Error('Invalid protocol');
    if (payload.record !== undefined && typeof payload.record !== 'string')
        throw new Error('Invalid record');
    if (payload.message !== undefined && typeof payload.message !== 'string')
        throw new Error('Invalid message');
    return {
        type: payload.type,
        fileName: payload.fileName,
        toFileName: payload.toFileName,
        hash: createHash(payload.hash),
        encryptedKey: createEncryptedData(base64ToBytes(payload.encryptedKey)),
        contentType: payload.contentType,
        size: payload.size,
        mimeType: payload.mimeType,
        createdAt: payload.createdAt,
        deletedAt: payload.deletedAt,
        renamedAt: payload.renamedAt,
        authorPublicKey: payload.authorPublicKey,
        protocol: payload.protocol,
        record: payload.record,
        message: payload.message,
        publishedAt: payload.publishedAt,
    };
}
function assertFiniteUint(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid ${label}`);
    }
}
//# sourceMappingURL=serialization.js.map