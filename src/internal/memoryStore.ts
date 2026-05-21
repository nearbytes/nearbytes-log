export interface StoredRecord {
  readonly path: string;
  readonly data: Uint8Array;
}

export interface MemoryStore {
  put(path: string, data: Uint8Array): void;
  get(path: string): Uint8Array | undefined;
  delete(path: string): void;
  listPaths(): readonly string[];
  markDirectory(path: string): void;
  hasDirectory(path: string): boolean;
}

export function createMemoryStore(): MemoryStore {
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();

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

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '').trim();
}

export function directoryPrefix(path: string): string {
  const normalized = normalizePath(path);
  return normalized === '' ? '' : `${normalized}/`;
}
