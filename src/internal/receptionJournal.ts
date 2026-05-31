import type { Hash, PublicKey } from 'nearbytes-crypto';
import type { ReceptionApi, ReceptionListResult, ReceptionObjectRef } from '../reception.js';
import { publicKeyToHex } from '../paths.js';
import type { LogIo } from './io.js';

const RECEPTION_PATH = 'sync/reception.jsonl';
const CHANNEL_DIR_RE = /^[a-f0-9]{130}$/i;
const OBJECT_FILE_RE = /^([a-f0-9]{64})\.bin$/i;

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
  } catch (err) {
    console.warn('[nearbytes-log:reception] malformed journal line:', raw.slice(0, 80), err);
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

/**
 * Append one reception line. The seq counter is maintained in-process by the
 * caller (see `createReceptionJournal` below): we MUST NOT scan the journal on
 * every append, otherwise the cost grows quadratically with the number of
 * receptions. The file is opened in append mode, so single-line writes are
 * atomic on POSIX (`O_APPEND`).
 */
async function appendLine(io: LogIo, seq: number, ref: ReceptionObjectRef): Promise<string> {
  const entry: ReceptionLine = { seq, ref };
  const payload = `${JSON.stringify(entry)}\n`;
  await io.appendFile(RECEPTION_PATH, new TextEncoder().encode(payload));
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

function refKey(ref: ReceptionObjectRef): string {
  if (ref.kind === 'event') {
    return `event:${ref.channel.toLowerCase()}:${ref.hash.toLowerCase()}`;
  }
  return `block:${ref.hash.toLowerCase()}`;
}

async function inventoryRefs(io: LogIo): Promise<ReceptionObjectRef[]> {
  const refs: ReceptionObjectRef[] = [];
  const blockFiles = await io.listFiles('blocks');
  for (const file of blockFiles) {
    const match = file.match(OBJECT_FILE_RE);
    if (match?.[1]) {
      refs.push({ kind: 'block', hash: match[1].toLowerCase() as Hash });
    }
  }
  const channels = (await io.listDirectories('channels'))
    .filter((name) => CHANNEL_DIR_RE.test(name))
    .map((name) => name.toLowerCase())
    .sort((a, b) => a.localeCompare(b));
  for (const channel of channels) {
    const files = await io.listFiles(`channels/${channel}`);
    for (const file of files) {
      const match = file.match(OBJECT_FILE_RE);
      if (match?.[1]) {
        refs.push({
          kind: 'event',
          channel,
          hash: match[1].toLowerCase() as Hash,
        });
      }
    }
  }
  return refs.sort((a, b) => refKey(a).localeCompare(refKey(b)));
}

export function createReceptionJournal(io: LogIo): ReceptionApi {
  /**
   * Monotonic seq counter held in process memory. Initial value is loaded
   * lazily from the journal once; subsequent appends increment it locally.
   * Concurrent appends are serialised through a promise chain so the on-disk
   * order matches the seq order.
   */
  let nextSeq: number | null = null;
  let appendChain: Promise<string> = Promise.resolve('0');

  const ensureSeqLoaded = async (): Promise<number> => {
    if (nextSeq !== null) return nextSeq;
    const lines = await readAllLines(io);
    nextSeq = lines.length > 0 ? lines[lines.length - 1]!.seq + 1 : 0;
    return nextSeq;
  };

  const appendReception = (ref: ReceptionObjectRef): Promise<string> => {
    const next = appendChain.then(async () => {
      const seq = await ensureSeqLoaded();
      nextSeq = seq + 1;
      return appendLine(io, seq, ref);
    });
    appendChain = next.catch((err) => {
      console.error('[nearbytes-log:reception] append failed:', err);
      return appendChain;
    });
    return next;
  };

  return {
    appendReception,

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

    async repairFromInventory(): Promise<{ appended: number }> {
      const existing = new Set<string>();
      for (const line of await readAllLines(io)) {
        existing.add(refKey(line.ref));
      }
      let appended = 0;
      for (const ref of await inventoryRefs(io)) {
        const key = refKey(ref);
        if (existing.has(key)) {
          continue;
        }
        await appendReception(ref);
        existing.add(key);
        appended += 1;
      }
      return { appended };
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
