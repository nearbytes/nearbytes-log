import type { Hash, PublicKey } from 'nearbytes-crypto';
import type { ReceptionApi, ReceptionListResult, ReceptionObjectRef } from '../reception.js';
import { publicKeyToHex } from '../paths.js';
import type { LogIo } from './io.js';

const RECEPTION_PATH = 'sync/reception.jsonl';

interface ReceptionLine {
  readonly seq: number;
  readonly ref: ReceptionObjectRef;
}

function parseLine(raw: string): ReceptionLine | null {
  try {
    const parsed = JSON.parse(raw) as ReceptionLine;
    if (typeof parsed.seq !== 'number' || !parsed.ref?.kind) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readAllLines(io: LogIo): Promise<ReceptionLine[]> {
  if (!(await io.exists(RECEPTION_PATH))) {
    return [];
  }
  const bytes = await io.readFile(RECEPTION_PATH);
  const text = new TextDecoder().decode(bytes).trim();
  if (text.length === 0) {
    return [];
  }
  const lines: ReceptionLine[] = [];
  for (const line of text.split('\n')) {
    const entry = parseLine(line);
    if (entry) {
      lines.push(entry);
    }
  }
  return lines;
}

async function appendLine(io: LogIo, ref: ReceptionObjectRef): Promise<string> {
  const lines = await readAllLines(io);
  const seq = lines.length > 0 ? lines[lines.length - 1]!.seq + 1 : 0;
  const entry: ReceptionLine = { seq, ref };
  const payload = `${JSON.stringify(entry)}\n`;
  const existing =
    lines.length > 0 ? new TextDecoder().decode(await io.readFile(RECEPTION_PATH)) : '';
  await io.writeFile(RECEPTION_PATH, new TextEncoder().encode(existing + payload));
  return String(seq);
}

function headSet(heads: ReceptionObjectRef[]): Set<string> {
  const keys = new Set<string>();
  for (const head of heads) {
    if (head.kind === 'event') {
      keys.add(`event:${head.channel}:${head.hash}`);
    } else {
      keys.add(`block:${head.hash}`);
    }
  }
  return keys;
}

export function createReceptionJournal(io: LogIo): ReceptionApi {
  return {
    appendReception: (ref) => appendLine(io, ref),

    async listAfter(cursor?: string, limit = 256): Promise<ReceptionListResult> {
      const lines = await readAllLines(io);
      const startSeq = cursor === undefined ? -1 : Number.parseInt(cursor, 10);
      const refs: ReceptionObjectRef[] = [];
      let next: string | undefined;
      let more = false;
      for (const line of lines) {
        if (line.seq <= startSeq) {
          continue;
        }
        if (refs.length >= limit) {
          more = true;
          next = String(line.seq - 1);
          break;
        }
        refs.push(line.ref);
        next = String(line.seq);
      }
      return { refs, next: more ? next : next, more };
    },

    async listHubDelta(
      hubChannelHex: string,
      heads: ReceptionObjectRef[],
      limit = 256,
    ): Promise<ReceptionListResult> {
      const known = headSet(heads);
      const lines = await readAllLines(io);
      const refs: ReceptionObjectRef[] = [];
      for (const line of lines) {
        const { ref } = line;
        if (ref.kind === 'event' && ref.channel === hubChannelHex) {
          const key = `event:${ref.channel}:${ref.hash}`;
          if (!known.has(key)) {
            refs.push(ref);
          }
        }
        if (refs.length >= limit) {
          return { refs, more: true };
        }
      }
      return { refs, more: false };
    },
  };
}

/** Build a reception ref after storing an event. */
export function receptionRefForEvent(publicKey: PublicKey, eventHash: Hash): ReceptionObjectRef {
  return { kind: 'event', channel: publicKeyToHex(publicKey), hash: eventHash };
}

/** Build a reception ref after storing a block. */
export function receptionRefForBlock(hash: Hash): ReceptionObjectRef {
  return { kind: 'block', hash };
}
