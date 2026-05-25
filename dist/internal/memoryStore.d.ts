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
export declare function createMemoryStore(): MemoryStore;
export declare function normalizePath(path: string): string;
export declare function directoryPrefix(path: string): string;
//# sourceMappingURL=memoryStore.d.ts.map