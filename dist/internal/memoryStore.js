export function createMemoryStore() {
    const files = new Map();
    const directories = new Set();
    return {
        put(path, data) {
            files.set(normalizePath(path), new Uint8Array(data));
        },
        get(path) {
            const record = files.get(normalizePath(path));
            return record ? new Uint8Array(record) : undefined;
        },
        delete(path) {
            files.delete(normalizePath(path));
        },
        listPaths() {
            return [...files.keys()];
        },
        markDirectory(path) {
            directories.add(normalizePath(path));
        },
        hasDirectory(path) {
            return directories.has(normalizePath(path));
        },
    };
}
export function normalizePath(path) {
    return path.replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '').trim();
}
export function directoryPrefix(path) {
    const normalized = normalizePath(path);
    return normalized === '' ? '' : `${normalized}/`;
}
//# sourceMappingURL=memoryStore.js.map