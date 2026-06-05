/**
 * Order-agnostic projection engine — `storage/projection-engine-v1.md` §6 (PROJ-4).
 *
 * Owns the reusable incremental mechanics: push routing, fold, snapshots,
 * persistence, and replay-from-nearest-snapshot. Ordering is delegated entirely
 * to the projector's `reorder`.
 */
import type { CryptoOperations, Hash, KeyPair } from 'nearbytes-crypto';
import { bytesToHex } from 'nearbytes-crypto';
import type { Channel } from '../channel.js';
import type { Log } from '../api.js';
import type { EventLogEntry } from '../types.js';
import { eventEnvelopePublicKeyMatches, hydrateSignedEvent } from '../eventEnvelope.js';
import {
  nearestSnapshot,
  shouldWriteSnapshot,
  snapshotsToPrune,
  type SnapshotPolicy,
} from './snapshots.js';
import type {
  MaterializedStore,
  Projection,
  ProjectionNamespace,
  Projector,
  OrderKey,
  SnapshotMeta,
} from './types.js';

const HYDRATE_CONCURRENCY = 128;
/** Coalesce live-state writes within this window (one flush per burst). */
const PERSIST_DEBOUNCE_MS = 25;

/** Map with bounded concurrency, preserving input order in the result. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

export interface CreateProjectionOptions {
  readonly now?: () => number;
  readonly snapshotPolicy?: SnapshotPolicy;
  /** Subscribe to the log router for live pushes (default true). */
  readonly live?: boolean;
}

export async function createProjection<TState, TKey extends OrderKey>(
  log: Log,
  channel: Channel,
  crypto: CryptoOperations,
  projector: Projector<TState, TKey>,
  store: MaterializedStore,
  options: CreateProjectionOptions = {},
): Promise<Projection<TState>> {
  const now = options.now ?? (() => Date.now());
  const keyPair: KeyPair = await crypto.deriveKeys(channel.secret);
  const channelHex = bytesToHex(channel.publicKey).toLowerCase();
  const ns: ProjectionNamespace = { projectorId: projector.id, channelHex };

  let keys: TKey[] = [];
  let live: TState = projector.initial();
  let snapshotMetas: SnapshotMeta[] = [];
  const knownSet = new Set<string>();
  const listeners = new Set<(state: TState) => void>();

  // ── load persisted state ────────────────────────────────────────────────
  const orderJson = await store.loadOrderIndex(ns);
  if (orderJson !== null) keys = JSON.parse(orderJson) as TKey[];
  for (const key of keys) knownSet.add(key.hash);
  snapshotMetas = await store.listSnapshots(ns);
  const persistedLive = await store.loadLiveState(ns);
  if (persistedLive !== null && persistedLive.position === keys.length) {
    live = projector.deserializeState(persistedLive.bytes);
  } else if (keys.length > 0) {
    // Order index without a matching live blob: rebuild from nearest snapshot.
    live = await rebuildFrom(keys.length);
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  // Fully trusted replay: events in the local log were hash-verified and
  // signature-verified at reception (nearbytes-sync) or local emit; re-running
  // two SHA-256 passes + ECDSA verify per event on every catchUp is pure cost.
  // See storage/projection-engine-v1.md PROJ-7 and log-api-v1 §2.2.
  async function hydrateOne(eventHash: Hash): Promise<EventLogEntry | undefined> {
    try {
      const signed = await log.events.retrieveEvent(keyPair.publicKey, eventHash, {
        verifySignature: false,
        verifyIntegrity: false,
      });
      if (!eventEnvelopePublicKeyMatches(signed, keyPair.publicKey)) return undefined;
      return { eventHash, signedEvent: await hydrateSignedEvent(crypto, keyPair.privateKey, signed) };
    } catch {
      return undefined;
    }
  }

  /** Resolve entries for `keys[from..to)` using the in-hand batch, else the log. */
  async function entriesForRange(
    from: number,
    to: number,
    batch: Map<string, EventLogEntry>,
  ): Promise<EventLogEntry[]> {
    const out: EventLogEntry[] = [];
    for (let i = from; i < to; i += 1) {
      const hash = keys[i]!.hash;
      const fromBatch = batch.get(hash);
      if (fromBatch !== undefined) {
        out.push(fromBatch);
        continue;
      }
      const hydrated = await hydrateOne(hash as Hash);
      if (hydrated !== undefined) out.push(hydrated);
    }
    return out;
  }

  async function rebuildFrom(target: number): Promise<TState> {
    const snap = nearestSnapshot(snapshotMetas, target);
    let base = projector.initial();
    let from = 0;
    if (snap !== undefined) {
      const bytes = await store.loadSnapshot(ns, snap.id);
      if (bytes !== null) {
        base = projector.deserializeState(bytes);
        from = snap.position;
      }
    }
    const tail = await entriesForRange(from, target, new Map());
    return tail.length > 0 ? await projector.reduce(base, tail) : base;
  }

  // Live-state persistence is coalesced: writing the full serialized state on
  // every single-event ingest is O(n) per event → O(n²) over a live sync burst.
  // We debounce instead. Durability is not weakened: snapshots are written on the
  // ladder, and on restart `catchUp()` folds any events newer than the persisted
  // live state straight from the log. The order index and live state are always
  // flushed together so their positions stay consistent.
  let persistDirty = false;
  let stopped = false;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  async function flushPersist(): Promise<void> {
    if (persistTimer !== undefined) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
    if (!persistDirty) return;
    persistDirty = false;
    // Best-effort: persisted state is a rebuildable cache (catchUp re-folds from
    // the log on the next open), so a transient store error or a teardown race
    // must never crash the projection.
    try {
      await store.saveOrderIndex(ns, JSON.stringify(keys));
      await store.saveLiveState(ns, projector.serializeState(live), keys.length);
    } catch {
      /* rebuilt from the log on next catchUp */
    }
  }
  function schedulePersist(): void {
    if (stopped) return;
    persistDirty = true;
    if (persistTimer !== undefined) return;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
    if (typeof persistTimer.unref === 'function') persistTimer.unref();
  }

  async function maybeSnapshot(): Promise<void> {
    const at = now();
    if (!shouldWriteSnapshot(snapshotMetas, keys.length, at, options.snapshotPolicy)) return;
    const meta: SnapshotMeta = { id: `${keys.length}-${at}`, position: keys.length, createdAt: at };
    await store.putSnapshot(ns, meta, projector.serializeState(live));
    snapshotMetas = [...snapshotMetas, meta];
    const prune = snapshotsToPrune(snapshotMetas, at);
    if (prune.length > 0) {
      await store.deleteSnapshots(ns, prune);
      const pruned = new Set(prune);
      snapshotMetas = snapshotMetas.filter((m) => !pruned.has(m.id));
    }
  }

  // ── ingest (serialized) ────────────────────────────────────────────────────
  let queue: Promise<unknown> = Promise.resolve();

  async function ingestNow(entries: readonly EventLogEntry[]): Promise<TState> {
    const fresh = entries.filter((e) => !knownSet.has(e.eventHash));
    if (fresh.length === 0) return live;

    const batch = new Map<string, EventLogEntry>(fresh.map((e) => [e.eventHash, e]));
    const newKeys = fresh.map((e) => projector.key(e));
    const prevLen = keys.length;
    const { keys: merged, insertAt } = projector.reorder(keys, newKeys);
    keys = merged;
    for (const k of newKeys) knownSet.add(k.hash);

    if (insertAt >= prevLen) {
      const tail = await entriesForRange(prevLen, keys.length, batch);
      if (tail.length > 0) live = await projector.reduce(live, tail);
    } else {
      live = await rebuildFrom(keys.length);
    }

    schedulePersist();
    await maybeSnapshot();
    for (const listener of listeners) listener(live);
    return live;
  }

  function ingest(entries: readonly EventLogEntry[]): Promise<TState> {
    const next = queue.then(() => ingestNow(entries));
    queue = next.catch(() => undefined);
    return next;
  }

  /**
   * Bring the projection up to date with the channel's on-disk events not yet in
   * the order index. Cold (empty store) ⇒ full materialization; warm ⇒ only the
   * unknown tail. Hydration is trusted (no per-event ECDSA re-verify) and runs
   * with bounded concurrency so large cold builds saturate I/O without
   * exhausting file handles. This is the single shared implementation used by
   * every domain service (chat, files); callers MUST NOT reimplement it.
   */
  async function catchUp(): Promise<TState> {
    const listed = await log.events.listEvents(keyPair.publicKey);
    const unknown = listed.filter((hash) => !knownSet.has(hash));
    if (unknown.length === 0) return live;
    const hydrated = await mapWithConcurrency(unknown, HYDRATE_CONCURRENCY, (hash) =>
      hydrateOne(hash),
    );
    const entries = hydrated.filter((entry): entry is EventLogEntry => entry !== undefined);
    return entries.length > 0 ? ingest(entries) : live;
  }

  // ── live router subscription ────────────────────────────────────────────────
  let unsubscribe = (): void => {};
  if (options.live !== false) {
    unsubscribe = log.events.subscribe({ channel: channelHex }, (events) => {
      void (async () => {
        const hydrated: EventLogEntry[] = [];
        for (const ev of events) {
          if (!eventEnvelopePublicKeyMatches(ev.signedEvent, keyPair.publicKey)) continue;
          try {
            hydrated.push({
              eventHash: ev.eventHash,
              signedEvent: await hydrateSignedEvent(crypto, keyPair.privateKey, ev.signedEvent),
            });
          } catch {
            /* unreadable inbound event; skip until repaired */
          }
        }
        if (hydrated.length > 0) await ingest(hydrated);
      })();
    });
  }

  return {
    state: () => live,
    ingest,
    catchUp,
    version: () => keys.length,
    has: (eventHash) => knownSet.has(eventHash),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    meta: {
      get: (key) => store.getMeta(ns, key),
      set: (key, value) => store.setMeta(ns, key, value),
    },
    async stop() {
      unsubscribe();
      listeners.clear();
      // Flush any pending debounced write so a following drop/restart is durable,
      // then mark stopped so no late timer can write after the store is closed.
      await flushPersist();
      stopped = true;
      if (persistTimer !== undefined) {
        clearTimeout(persistTimer);
        persistTimer = undefined;
      }
    },
  };
}
