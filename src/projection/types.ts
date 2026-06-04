/**
 * Order-agnostic projection engine contracts — `storage/projection-engine-v1.md`.
 *
 * The engine never sorts and never assumes a total order. Ordering is entirely
 * the projector's policy, expressed by `reorder`. A projector is two callbacks
 * (`reorder` + `reduce`) plus a compact order-key extractor and a state codec.
 */
import type { EventLogEntry } from '../types.js';

/**
 * A projector's compact, JSON-serializable order key. It MUST carry the event
 * hash so the engine can map an order position back to an event for bounded
 * rehydration, and small enough to persist for every event without the payload.
 */
export interface OrderKey {
  readonly hash: string;
}

export interface Projector<TState, TKey extends OrderKey> {
  /** Registry protocol id; namespaces the store (e.g. 'nb.files.v0.5'). */
  readonly id: string;
  initial(): TState;
  serializeState(state: TState): Uint8Array;
  deserializeState(bytes: Uint8Array): TState;
  /** Extract the order key for an entry. */
  key(entry: EventLogEntry): TKey;
  /**
   * The protocol's ordering policy. Returns the canonical key sequence for the
   * union of `prevKeys` and `newKeys`, plus `insertAt`: the smallest index whose
   * key differs from `prevKeys`. Append-only protocols use `appendReorder`.
   */
  reorder(
    prevKeys: readonly TKey[],
    newKeys: readonly TKey[],
  ): { keys: TKey[]; insertAt: number };
  /**
   * Deterministic fold of a contiguous ordered run onto `base`. MAY be async
   * (e.g. a projector that verifies record signatures while folding).
   */
  reduce(base: TState, orderedTail: readonly EventLogEntry[]): TState | Promise<TState>;
}

export interface ProjectionNamespace {
  readonly projectorId: string;
  readonly channelHex: string;
}

export interface SnapshotMeta {
  readonly id: string;
  readonly position: number;
  readonly createdAt: number;
}

/**
 * Pluggable persistence for projection state. The reference durable
 * implementation is `createSqliteMaterializedStore`; `createInMemory
 * MaterializedStore` serves tests and browser builds.
 */
export interface MaterializedStore {
  loadOrderIndex(ns: ProjectionNamespace): Promise<string | null>;
  saveOrderIndex(ns: ProjectionNamespace, json: string): Promise<void>;
  loadLiveState(
    ns: ProjectionNamespace,
  ): Promise<{ readonly bytes: Uint8Array; readonly position: number } | null>;
  saveLiveState(ns: ProjectionNamespace, bytes: Uint8Array, position: number): Promise<void>;
  listSnapshots(ns: ProjectionNamespace): Promise<SnapshotMeta[]>;
  loadSnapshot(ns: ProjectionNamespace, id: string): Promise<Uint8Array | null>;
  putSnapshot(ns: ProjectionNamespace, meta: SnapshotMeta, bytes: Uint8Array): Promise<void>;
  deleteSnapshots(ns: ProjectionNamespace, ids: readonly string[]): Promise<void>;
  getMeta(ns: ProjectionNamespace, key: string): Promise<string | null>;
  setMeta(ns: ProjectionNamespace, key: string, value: string): Promise<void>;
  close?(): void;
}

export interface Projection<TState> {
  /** O(1) warm read of live materialized state. */
  state(): TState;
  /** Push new events (router sink and boot path). Returns the updated state. */
  ingest(entries: readonly EventLogEntry[]): Promise<TState>;
  /** Current order-index length (= live position). */
  version(): number;
  /** Subscribe to materialized-state changes. */
  onChange(listener: (state: TState) => void): () => void;
  /** Per-channel KV (e.g. chat last-seen / reply target). */
  meta: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  /** Detach the log-router subscription. */
  stop(): void;
}
