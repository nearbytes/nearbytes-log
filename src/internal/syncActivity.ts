import type { SyncActivityApi } from '../reception.js';
import type { LogIo } from './io.js';

const ACTIVITY_PATH = 'sync/activity.log';

export function createSyncActivity(io: LogIo): SyncActivityApi {
  return {
    async appendMarker(line: string): Promise<void> {
      const sanitized = line.replace(/\r?\n/g, ' ').trim();
      if (sanitized.length === 0) {
        return;
      }
      const existing = (await io.exists(ACTIVITY_PATH))
        ? new TextDecoder().decode(await io.readFile(ACTIVITY_PATH))
        : '';
      await io.writeFile(
        ACTIVITY_PATH,
        new TextEncoder().encode(`${existing}${sanitized}\n`),
      );
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
