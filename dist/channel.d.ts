import type { CryptoOperations, PublicKey, Secret } from 'nearbytes-crypto';
/**
 * A Nearbytes channel: deterministic identity derived from a secret seed.
 * Events are stored under this channel's public key in the log.
 */
export interface Channel {
    readonly publicKey: PublicKey;
    readonly secret: Secret;
}
/**
 * Opens a channel from a secret (derives keys; no I/O).
 */
export declare function openChannel(secret: Secret, crypto: CryptoOperations): Promise<Channel>;
//# sourceMappingURL=channel.d.ts.map