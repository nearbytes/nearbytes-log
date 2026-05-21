import { StorageError } from 'nearbytes-crypto';
import { createMemoryStore, directoryPrefix, normalizePath, } from './memoryStore.js';
/**
 * In-memory log I/O for tests and browser-like environments.
 */
export function createMemoryIo(store = createMemoryStore()) {
    const readFile = async (path) => {
        const data = store.get(path);
        if (!data) {
            throw new StorageError(`File not found: ${path}`);
        }
        return data;
    };
    const writeFile = async (path, data) => {
        store.put(path, data);
    };
    const listFiles = async (directory) => {
        const prefix = directoryPrefix(directory);
        const names = new Set();
        for (const path of store.listPaths()) {
            if (prefix !== '' && !path.startsWith(prefix)) {
                continue;
            }
            const remainder = prefix === '' ? path : path.slice(prefix.length);
            if (remainder === '' || remainder.includes('/')) {
                continue;
            }
            names.add(remainder);
        }
        return [...names].sort((a, b) => a.localeCompare(b));
    };
    const createDirectory = async (path) => {
        store.markDirectory(normalizePath(path));
    };
    const exists = async (path) => {
        const normalized = normalizePath(path);
        if (normalized === '') {
            return true;
        }
        if (store.get(normalized)) {
            return true;
        }
        if (store.hasDirectory(normalized)) {
            return true;
        }
        const prefix = `${normalized}/`;
        return store.listPaths().some((entry) => entry.startsWith(prefix));
    };
    const deleteFile = async (path) => {
        store.delete(path);
    };
    return { readFile, writeFile, listFiles, createDirectory, exists, deleteFile };
}
//# sourceMappingURL=memoryIo.js.map