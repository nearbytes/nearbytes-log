import { EVENT_ENVELOPE_VERSION, createEncryptedData } from 'nearbytes-crypto';
import { bytesToHex } from 'nearbytes-crypto';
import { deserializeInnerEventPayload, serializeEventEnvelope, serializeInnerEventPayload } from './serialization.js';
export async function createSignedEvent(crypto, keyPair, payload, blockRefs) {
    const eventKey = await crypto.deriveSymKey(keyPair.privateKey);
    const ciphertext = await crypto.encryptSym(serializeInnerEventPayload(payload), eventKey);
    const envelope = {
        version: EVENT_ENVELOPE_VERSION,
        publicKey: bytesToHex(keyPair.publicKey),
        blockRefs: dedupeHashes(blockRefs),
        ciphertext,
    };
    const signature = await crypto.signPR(serializeEventEnvelope(envelope), keyPair.privateKey);
    return {
        envelope,
        payload,
        signature,
    };
}
export async function decryptSignedEventPayload(crypto, privateKey, event) {
    const eventKey = await crypto.deriveSymKey(privateKey);
    const plaintext = await crypto.decryptSym(createEncryptedData(event.envelope.ciphertext), eventKey);
    return deserializeInnerEventPayload(plaintext);
}
export async function hydrateSignedEvent(crypto, privateKey, event) {
    const payload = await decryptSignedEventPayload(crypto, privateKey, event);
    return { ...event, payload };
}
export function eventEnvelopePublicKeyMatches(event, publicKey) {
    return event.envelope.publicKey === bytesToHex(publicKey);
}
function dedupeHashes(blockRefs) {
    const seen = new Set();
    const deduped = [];
    for (const hash of blockRefs) {
        if (seen.has(hash)) {
            continue;
        }
        seen.add(hash);
        deduped.push(hash);
    }
    return deduped;
}
//# sourceMappingURL=eventEnvelope.js.map