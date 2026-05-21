import { createHash } from 'nearbytes-crypto';
/**
 * Lowercase hex encoding of an uncompressed P-256 public key (130 hex chars).
 */
export function publicKeyToHex(publicKey) {
    return Array.from(publicKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase();
}
/**
 * Default channel directory: `channels/<public-key-hex>`.
 */
export const defaultPathMapper = (publicKey) => `channels/${publicKeyToHex(publicKey)}`;
export function blockPath(hash) {
    return `blocks/${hash}.bin`;
}
export function eventPath(pathMapper, publicKey, eventHash) {
    return `${pathMapper(publicKey)}/${eventHash}.bin`;
}
export function eventHashFromFileName(fileName) {
    const match = fileName.trim().match(/^([a-f0-9]{64})\.bin$/i);
    if (!match?.[1]) {
        return null;
    }
    return createHash(match[1]);
}
//# sourceMappingURL=paths.js.map