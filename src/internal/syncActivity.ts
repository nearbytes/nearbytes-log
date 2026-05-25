import type { SyncActivityApi } from '../reception.js';
import type { LogIo } from './io.js';

const ACTIVITY_PATH = 'sync/activity.log';

export function createSyncActivity(io: LogIo): SyncActivityApi {
  let writeChain: Promise<void> = Promise.resolve();
  const enqueueAppend = (line: string): Promise<void> => {
    const next = writeChain.then(async () => {
      const existing = (await io.exists(ACTIVITY_PATH))
        ? new TextDecoder().decode(await io.readFile(ACTIVITY_PATH))
        : '';
      await io.writeFile(
        ACTIVITY_PATH,
        new TextEncoder().encode(`${existing}${line}\n`),
      );
    });
    writeChain = next.catch(() => undefined);
    return next;
  };

  return {
    async appendMarker(line: string): Promise<void> {
      const sanitized = line.replace(/\r?\n/g, ' ').trim();
      if (sanitized.length === 0) {
        return;
      }
      await enqueueAppend(sanitized);
    },

    async readMarkers(): Promise<string[]> {
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
