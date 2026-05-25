const ACTIVITY_PATH = 'sync/activity.log';
export function createSyncActivity(io) {
    return {
        async appendMarker(line) {
            const sanitized = line.replace(/\r?\n/g, ' ').trim();
            if (sanitized.length === 0) {
                return;
            }
            // O(1) append: `fs.appendFile` on POSIX is a single `write(2)` with
            // `O_APPEND` semantics, so concurrent calls cannot interleave bytes
            // within one line (writes are at most PIPE_BUF, ~4 KiB). The previous
            // read-then-write implementation was O(file_size) per call and became
            // the dominant cost under sustained activity.
            await io.appendFile(ACTIVITY_PATH, new TextEncoder().encode(`${sanitized}\n`));
        },
        async readMarkers() {
            if (!(await io.exists(ACTIVITY_PATH))) {
                return [];
            }
            const text = new TextDecoder().decode(await io.readFile(ACTIVITY_PATH)).trim();
            if (text.length === 0) {
                return [];
            }
            return text.split('\n');
        },
    };
}
//# sourceMappingURL=syncActivity.js.map