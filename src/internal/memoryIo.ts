import { StorageError } from 'nearbytes-crypto';
import type { LogIo } from './io.js';
import {
  createMemoryStore,
  directoryPrefix,
  normalizePath,
  type MemoryStore,
} from './memoryStore.js';

/**
 * In-memory log I/O for tests and browser-like environments.
 */
export function createMemoryIo(store: MemoryStore = createMemoryStore()): LogIo {
  const readFile = async (path: string): Promise<Uint8Array> => {
    const data = store.get(path);
    if (!data) {
      throw new StorageError(`File not found: ${path}`);
    }
    return data;
  };

  const writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    store.put(path, data);
  };

  const listFiles = async (directory: string): Promise<string[]> => {
    const prefix = directoryPrefix(directory);
    const names = new Set<string>();
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

  const createDirectory = async (path: string): Promise<void> => {
    store.markDirectory(normalizePath(path));
  };

  const exists = async (path: string): Promise<boolean> => {
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

  const deleteFile = async (path: string): Promise<void> => {
    store.delete(path);
  };

  return { readFile, writeFile, listFiles, createDirectory, exists, deleteFile };
}
