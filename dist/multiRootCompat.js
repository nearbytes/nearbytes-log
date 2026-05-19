export function isMultiRootStorageBackend(storage) {
    return typeof storage.writeFileForChannel === 'function';
}
export function publicKeyToHex(publicKey) {
    return Array.from(publicKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase();
}
//# sourceMappingURL=multiRootCompat.js.map