/**
 * Opens a channel from a secret (derives keys; no I/O).
 */
export async function openChannel(secret, crypto) {
    const keyPair = await crypto.deriveKeys(secret);
    return {
        publicKey: keyPair.publicKey,
        secret,
    };
}
//# sourceMappingURL=channel.js.map