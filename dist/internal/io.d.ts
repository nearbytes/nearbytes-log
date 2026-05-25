/**
 * Internal byte I/O surface used by log implementations. Not part of the public API.
 */
export interface LogIo {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
    /**
     * Append-only write. MUST be implemented as O(1) in the existing file size
     * (e.g. `fs.appendFile` on POSIX, `open('a').write` on Win32). Used by the
     * reception journal and the sync activity log, both of which append once
     * per sync event and would otherwise become quadratic if implemented as
     * read-then-rewrite on top of `writeFile`.
     */
    appendFile(path: string, data: Uint8Array): Promise<void>;
    listFiles(directory: string): Promise<string[]>;
    /** Immediate child directory names under `directory/` (not recursive). */
    listDirectories(directory: string): Promise<string[]>;
    createDirectory(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    deleteFile(path: string): Promise<void>;
}
//# sourceMappingURL=io.d.ts.map