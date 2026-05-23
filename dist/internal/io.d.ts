/**
 * Internal byte I/O surface used by log implementations. Not part of the public API.
 */
export interface LogIo {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
    listFiles(directory: string): Promise<string[]>;
    /** Immediate child directory names under `directory/` (not recursive). */
    listDirectories(directory: string): Promise<string[]>;
    createDirectory(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    deleteFile(path: string): Promise<void>;
}
//# sourceMappingURL=io.d.ts.map