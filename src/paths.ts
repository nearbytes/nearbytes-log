import type { PublicKey } from 'nearbytes-crypto';
import type { Hash } from 'nearbytes-crypto';
import { createHash } from 'nearbytes-crypto';
import type { ChannelPathMapper } from './api.js';

/**
 * Lowercase hex encoding of an uncompressed P-256 public key (130 hex chars).
 */
export function publicKeyToHex(publicKey: PublicKey): string {
  return Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase();
}

/**
 * Default channel directory: `channels/<public-key-hex>`.
 */
export const defaultPathMapper: ChannelPathMapper = (publicKey) =>
  `channels/${publicKeyToHex(publicKey)}`;

export function blockPath(hash: Hash): string {
  return `blocks/${hash}.bin`;
}

export function eventPath(
  pathMapper: ChannelPathMapper,
  publicKey: PublicKey,
  eventHash: Hash,
): string {
  return `${pathMapper(publicKey)}/${eventHash}.bin`;
}

export function eventHashFromFileName(fileName: string): Hash | null {
  const match = fileName.trim().match(/^([a-f0-9]{64})\.bin$/i);
  if (!match?.[1]) {
    return null;
  }
  return createHash(match[1]);
}
