/**
 * Order-agnostic projection engine (browser-safe surface). The Node-only SQLite
 * store lives in `sqliteStore.ts` and is exported from the package root, not from
 * the browser entry point.
 */
export type {
  Projector,
  Projection,
  OrderKey,
  MaterializedStore,
  ProjectionNamespace,
  SnapshotMeta,
} from './types.js';
export { createProjection, type CreateProjectionOptions } from './engine.js';
export { appendReorder } from './appendOrder.js';
export {
  nearestSnapshot,
  shouldWriteSnapshot,
  snapshotsToPrune,
  DEFAULT_SNAPSHOT_POLICY,
  type SnapshotPolicy,
} from './snapshots.js';
export { createInMemoryMaterializedStore } from './memoryStore.js';
export { createEventRouter, type EventRouter } from './router.js';
