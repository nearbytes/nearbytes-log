import { createHash, } from 'nearbytes-crypto';
import { computeHash } from 'nearbytes-crypto';
import { verifyPU } from 'nearbytes-crypto';
import { createPublicKey } from 'nearbytes-crypto';
import { deserializeEvent, serializeEventEnvelope } from './serialization.js';
export const HASH_HEX_REGEX = /^[a-f0-9]{64}$/i;
export const VOLUME_ID_HEX_REGEX = /^[a-f0-9]{130}$/i;
const BLOCK_RELATIVE_PATH_REGEX = /^blocks\/([a-f0-9]{64})\.bin$/i;
const EVENT_RELATIVE_PATH_REGEX = /^channels\/([a-f0-9]{130})\/([a-f0-9]{64})\.bin$/i;
export async function validateBlockBytes(expectedHash, data) {
    const normalizedHash = normalizeHash(expectedHash);
    if (!normalizedHash) {
        return {
            ok: false,
            code: 'invalid-block-path',
            detail: `Block path does not contain a valid hash: ${expectedHash}`,
        };
    }
    const actualHash = await computeHash(data);
    if (actualHash !== normalizedHash) {
        return {
            ok: false,
            code: 'block-hash-mismatch',
            detail: `Expected block hash ${normalizedHash}, got ${actualHash}`,
        };
    }
    return { ok: true };
}
export async function validateEventBytes(publicKeyHex, expectedEventHash, data) {
    const publicKey = publicKeyFromHex(publicKeyHex);
    if (!publicKey) {
        return {
            ok: false,
            code: 'invalid-channel-path',
            detail: `Channel path does not contain a valid public key: ${publicKeyHex}`,
        };
    }
    const normalizedHash = normalizeHash(expectedEventHash);
    if (!normalizedHash) {
        return {
            ok: false,
            code: 'invalid-event-path',
            detail: `Event path does not contain a valid hash: ${expectedEventHash}`,
        };
    }
    let parsedEvent;
    try {
        parsedEvent = deserializeEvent(JSON.parse(new TextDecoder().decode(data)));
    }
    catch (error) {
        return {
            ok: false,
            code: 'event-deserialize-failed',
            detail: error instanceof Error ? error.message : 'Event data is not readable',
        };
    }
    const envelopeBytes = serializeEventEnvelope(parsedEvent.envelope);
    const payloadHash = await computeHash(envelopeBytes);
    if (payloadHash !== normalizedHash) {
        return {
            ok: false,
            code: 'event-hash-mismatch',
            detail: `Expected event hash ${normalizedHash}, got ${payloadHash}`,
        };
    }
    const signatureValid = await verifyPU(envelopeBytes, parsedEvent.signature, publicKey).catch(() => false);
    if (!signatureValid) {
        return {
            ok: false,
            code: 'event-signature-invalid',
            detail: `Signature verification failed for event ${normalizedHash}`,
        };
    }
    if (parsedEvent.envelope.publicKey !== publicKeyHex.toLowerCase()) {
        return {
            ok: false,
            code: 'event-format-invalid',
            detail: 'Event envelope public key does not match channel path',
        };
    }
    return { ok: true };
}
export function normalizeHash(value) {
    try {
        return createHash(value.trim().toLowerCase());
    }
    catch {
        return null;
    }
}
export function normalizeVolumeId(value) {
    const normalized = value.trim().toLowerCase();
    return VOLUME_ID_HEX_REGEX.test(normalized) ? normalized : null;
}
export function parseCanonicalBlockRelativePath(relativePath) {
    const match = BLOCK_RELATIVE_PATH_REGEX.exec(normalizeRelativePath(relativePath));
    if (!match || !match[1]) {
        return null;
    }
    const hash = normalizeHash(match[1]);
    return hash ? { hash } : null;
}
export function parseCanonicalEventRelativePath(relativePath) {
    const match = EVENT_RELATIVE_PATH_REGEX.exec(normalizeRelativePath(relativePath));
    if (!match || !match[1] || !match[2]) {
        return null;
    }
    const volumeId = normalizeVolumeId(match[1]);
    const eventHash = normalizeHash(match[2]);
    if (!volumeId || !eventHash) {
        return null;
    }
    return { volumeId, eventHash };
}
export async function validateCanonicalStorageFile(relativePath, data) {
    const block = parseCanonicalBlockRelativePath(relativePath);
    if (block) {
        return validateBlockBytes(block.hash, data);
    }
    const event = parseCanonicalEventRelativePath(relativePath);
    if (event) {
        return validateEventBytes(event.volumeId, event.eventHash, data);
    }
    return {
        ok: false,
        code: 'invalid-storage-path',
        detail: `Path is not canonical Nearbytes storage data: ${relativePath}`,
    };
}
export function publicKeyFromHex(value) {
    const normalized = normalizeVolumeId(value);
    if (!normalized) {
        return null;
    }
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
        bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
    }
    return createPublicKey(bytes);
}
function normalizeRelativePath(value) {
    return value.replace(/\\/g, '/').replace(/^\/+/u, '').trim();
}
//# sourceMappingURL=integrity.js.map