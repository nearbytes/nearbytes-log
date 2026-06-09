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

  const readFileFrom = async (path: string, offset: number): Promise<Uint8Array> => {
    const data = store.get(path);
    if (!data || offset >= data.length) {
      return new Uint8Array(0);
    }
    return data.subarray(offset);
  };

  const fileSize = async (path: string): Promise<number> => {
    const data = store.get(path);
    return data?.length ?? 0;
  };

  const writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    store.put(path, data);
  };

  const appendFile = async (path: string, data: Uint8Array): Promise<void> => {
    const existing = store.get(path);
    if (!existing || existing.length === 0) {
      store.put(path, data);
      return;
    }
    const merged = new Uint8Array(existing.length + data.length);
    merged.set(existing, 0);
    merged.set(data, existing.length);
    store.put(path, merged);
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

  const listDirectories = async (directory: string): Promise<string[]> => {
    const prefix = directoryPrefix(directory);
    const names = new Set<string>();
    for (const path of store.listPaths()) {
      if (prefix !== '' && !path.startsWith(prefix)) {
        continue;
      }
      const remainder = prefix === '' ? path : path.slice(prefix.length);
      const slash = remainder.indexOf('/');
      if (slash > 0) {
        names.add(remainder.slice(0, slash));
      }
    }
    return [...names].filter((n) => n.length > 0).sort((a, b) => a.localeCompare(b));
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

  return {
    readFile,
    readFileFrom,
    fileSize,
    writeFile,
    appendFile,
    listFiles,
    listDirectories,
    createDirectory,
    exists,
    deleteFile,
  };
}
