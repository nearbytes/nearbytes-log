/**
 * Durable `MaterializedStore` over Node's built-in `node:sqlite` — the reference
 * persistence backend (`storage/projection-engine-v1.md` §5, PROJ-3.2). Node-only;
 * never import this from a browser entry point. Tables are namespaced by
 * `(projector_id, channel_hex)`.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  MaterializedStore,
  ProjectionNamespace,
  SnapshotMeta,
} from './types.js';

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  throw new Error('Expected BLOB column to be bytes');
}

export function createSqliteMaterializedStore(path: string): MaterializedStore {
  if (path !== ':memory:') {
    try {
      mkdirSync(dirname(path), { recursive: true });
    } catch {
      /* directory may already exist */
    }
  }
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS order_index (
      projector_id TEXT NOT NULL, channel_hex TEXT NOT NULL, json TEXT NOT NULL,
      PRIMARY KEY (projector_id, channel_hex));
    CREATE TABLE IF NOT EXISTS live_state (
      projector_id TEXT NOT NULL, channel_hex TEXT NOT NULL, bytes BLOB NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (projector_id, channel_hex));
    CREATE TABLE IF NOT EXISTS snapshots (
      projector_id TEXT NOT NULL, channel_hex TEXT NOT NULL, id TEXT NOT NULL,
      position INTEGER NOT NULL, created_at INTEGER NOT NULL, bytes BLOB NOT NULL,
      PRIMARY KEY (projector_id, channel_hex, id));
    CREATE TABLE IF NOT EXISTS meta (
      projector_id TEXT NOT NULL, channel_hex TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL,
      PRIMARY KEY (projector_id, channel_hex, k));
  `);

  const upsertOrder = db.prepare(
    `INSERT INTO order_index (projector_id, channel_hex, json) VALUES (?, ?, ?)
     ON CONFLICT(projector_id, channel_hex) DO UPDATE SET json = excluded.json`,
  );
  const getOrder = db.prepare(
    `SELECT json FROM order_index WHERE projector_id = ? AND channel_hex = ?`,
  );
  const upsertLive = db.prepare(
    `INSERT INTO live_state (projector_id, channel_hex, bytes, position) VALUES (?, ?, ?, ?)
     ON CONFLICT(projector_id, channel_hex) DO UPDATE SET bytes = excluded.bytes, position = excluded.position`,
  );
  const getLive = db.prepare(
    `SELECT bytes, position FROM live_state WHERE projector_id = ? AND channel_hex = ?`,
  );
  const listSnap = db.prepare(
    `SELECT id, position, created_at FROM snapshots WHERE projector_id = ? AND channel_hex = ?`,
  );
  const getSnap = db.prepare(
    `SELECT bytes FROM snapshots WHERE projector_id = ? AND channel_hex = ? AND id = ?`,
  );
  const putSnap = db.prepare(
    `INSERT INTO snapshots (projector_id, channel_hex, id, position, created_at, bytes) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(projector_id, channel_hex, id) DO UPDATE SET position = excluded.position, created_at = excluded.created_at, bytes = excluded.bytes`,
  );
  const delSnap = db.prepare(
    `DELETE FROM snapshots WHERE projector_id = ? AND channel_hex = ? AND id = ?`,
  );
  const upsertMeta = db.prepare(
    `INSERT INTO meta (projector_id, channel_hex, k, v) VALUES (?, ?, ?, ?)
     ON CONFLICT(projector_id, channel_hex, k) DO UPDATE SET v = excluded.v`,
  );
  const getMetaStmt = db.prepare(
    `SELECT v FROM meta WHERE projector_id = ? AND channel_hex = ? AND k = ?`,
  );
  const dropOrder = db.prepare(
    `DELETE FROM order_index WHERE projector_id = ? AND channel_hex = ?`,
  );
  const dropLive = db.prepare(
    `DELETE FROM live_state WHERE projector_id = ? AND channel_hex = ?`,
  );
  const dropSnapshots = db.prepare(
    `DELETE FROM snapshots WHERE projector_id = ? AND channel_hex = ?`,
  );
  const dropMeta = db.prepare(`DELETE FROM meta WHERE projector_id = ? AND channel_hex = ?`);

  const id = (ns: ProjectionNamespace): [string, string] => [ns.projectorId, ns.channelHex];

  // Once closed the database is gone; derived materialized state is rebuildable
  // from the log, so post-close calls (e.g. a debounced flush timer firing during
  // teardown) are safe no-ops rather than `ERR_INVALID_STATE` crashes.
  let closed = false;

  return {
    async loadOrderIndex(ns) {
      if (closed) return null;
      const row = getOrder.get(...id(ns));
      return row === undefined ? null : (row.json as string);
    },
    async saveOrderIndex(ns, json) {
      if (closed) return;
      upsertOrder.run(...id(ns), json);
    },
    async loadLiveState(ns) {
      if (closed) return null;
      const row = getLive.get(...id(ns));
      if (row === undefined) return null;
      return { bytes: toBytes(row.bytes), position: Number(row.position) };
    },
    async saveLiveState(ns, bytes, position) {
      if (closed) return;
      upsertLive.run(...id(ns), bytes, position);
    },
    async listSnapshots(ns) {
      if (closed) return [];
      return listSnap.all(...id(ns)).map(
        (row): SnapshotMeta => ({
          id: row.id as string,
          position: Number(row.position),
          createdAt: Number(row.created_at),
        }),
      );
    },
    async loadSnapshot(ns, snapId) {
      if (closed) return null;
      const row = getSnap.get(...id(ns), snapId);
      return row === undefined ? null : toBytes(row.bytes);
    },
    async putSnapshot(ns, meta, bytes) {
      if (closed) return;
      putSnap.run(...id(ns), meta.id, meta.position, meta.createdAt, bytes);
    },
    async deleteSnapshots(ns, ids) {
      if (closed) return;
      for (const snapId of ids) delSnap.run(...id(ns), snapId);
    },
    async getMeta(ns, k) {
      if (closed) return null;
      const row = getMetaStmt.get(...id(ns), k);
      return row === undefined ? null : (row.v as string);
    },
    async setMeta(ns, k, value) {
      if (closed) return;
      upsertMeta.run(...id(ns), k, value);
    },
    async dropNamespace(ns) {
      if (closed) return;
      dropOrder.run(...id(ns));
      dropLive.run(...id(ns));
      dropSnapshots.run(...id(ns));
      dropMeta.run(...id(ns));
    },
    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
