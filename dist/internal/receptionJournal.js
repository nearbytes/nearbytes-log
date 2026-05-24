import { publicKeyToHex } from '../paths.js';
const RECEPTION_PATH = 'sync/reception.jsonl';
function parseLine(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.seq !== 'number' || !parsed.ref?.kind) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
async function readAllLines(io) {
    if (!(await io.exists(RECEPTION_PATH))) {
        return [];
    }
    const bytes = await io.readFile(RECEPTION_PATH);
    const text = new TextDecoder().decode(bytes).trim();
    if (text.length === 0) {
        return [];
    }
    const lines = [];
    for (const line of text.split('\n')) {
        const entry = parseLine(line);
        if (entry) {
            lines.push(entry);
        }
    }
    return lines;
}
async function appendLine(io, ref) {
    const lines = await readAllLines(io);
    const seq = lines.length > 0 ? lines[lines.length - 1].seq + 1 : 0;
    const entry = { seq, ref };
    const payload = `${JSON.stringify(entry)}\n`;
    const existing = lines.length > 0 ? new TextDecoder().decode(await io.readFile(RECEPTION_PATH)) : '';
    await io.writeFile(RECEPTION_PATH, new TextEncoder().encode(existing + payload));
    return String(seq);
}
function headSet(heads) {
    const keys = new Set();
    for (const head of heads) {
        if (head.kind === 'event') {
            keys.add(`event:${head.channel}:${head.hash}`);
        }
        else {
            keys.add(`block:${head.hash}`);
        }
    }
    return keys;
}
export function createReceptionJournal(io) {
    /** Serializes concurrent appends (sync may store events/blocks in parallel). */
    let appendChain = Promise.resolve('0');
    const appendReception = (ref) => {
        const next = appendChain.then(() => appendLine(io, ref));
        appendChain = next.catch(() => appendChain);
        return next;
    };
    return {
        appendReception,
        async listAfter(cursor, limit = 256) {
            const lines = await readAllLines(io);
            const startSeq = cursor === undefined ? -1 : Number.parseInt(cursor, 10);
            const refs = [];
            let next;
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
        async listHubDelta(hubChannelHex, heads, limit = 256) {
            const known = headSet(heads);
            const lines = await readAllLines(io);
            const refs = [];
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
export function receptionRefForEvent(publicKey, eventHash) {
    return { kind: 'event', channel: publicKeyToHex(publicKey), hash: eventHash };
}
/** Build a reception ref after storing a block. */
export function receptionRefForBlock(hash) {
    return { kind: 'block', hash };
}
//# sourceMappingURL=receptionJournal.js.map