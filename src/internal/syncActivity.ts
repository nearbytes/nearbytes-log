import type { SyncActivityApi } from '../reception.js';
import type { LogIo } from './io.js';

const ACTIVITY_PATH = 'sync/activity.log';

/** Parse complete newline-delimited lines from a tail chunk (may include one byte before offset). */
function splitTailLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  let body = text;
  if (body.startsWith('\n')) {
    body = body.slice(1);
  } else {
    const nl = body.indexOf('\n');
    if (nl < 0) {
      return [];
    }
    body = body.slice(nl + 1);
  }
  if (body.length === 0) {
    return [];
  }
  if (body.endsWith('\n')) {
    body = body.slice(0, -1);
  }
  return body.length === 0 ? [] : body.split('\n');
}

export function createSyncActivity(io: LogIo): SyncActivityApi {
  return {
    async appendMarker(line: string): Promise<void> {
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

    async readMarkers(): Promise<string[]> {
      const size = await io.fileSize(ACTIVITY_PATH);
      if (size === 0) {
        return [];
      }
      const text = new TextDecoder().decode(await io.readFileFrom(ACTIVITY_PATH, 0)).trim();
      if (text.length === 0) {
        return [];
      }
      return text.split('\n');
    },

    async readMarkersFrom(offset: number): Promise<{ lines: string[]; size: number }> {
      const size = await io.fileSize(ACTIVITY_PATH);
      if (size === 0 || offset >= size) {
        return { lines: [], size };
      }
      const readStart = offset > 0 ? offset - 1 : 0;
      const chunk = await io.readFileFrom(ACTIVITY_PATH, readStart);
      return { lines: splitTailLines(new TextDecoder().decode(chunk)), size };
    },
  };
}
