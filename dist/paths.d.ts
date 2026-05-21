import type { PublicKey } from 'nearbytes-crypto';
import type { Hash } from 'nearbytes-crypto';
import type { ChannelPathMapper } from './api.js';
/**
 * Lowercase hex encoding of an uncompressed P-256 public key (130 hex chars).
 */
export declare function publicKeyToHex(publicKey: PublicKey): string;
/**
 * Default channel directory: `channels/<public-key-hex>`.
 */
export declare const defaultPathMapper: ChannelPathMapper;
export declare function blockPath(hash: Hash): string;
export declare function eventPath(pathMapper: ChannelPathMapper, publicKey: PublicKey, eventHash: Hash): string;
export declare function eventHashFromFileName(fileName: string): Hash | null;
//# sourceMappingURL=paths.d.ts.map