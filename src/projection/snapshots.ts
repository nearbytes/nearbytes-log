/**
 * Logarithmic snapshot ladder — `storage/projection-engine-v1.md` §6.3 (PROJ-5).
 *
 * Retention keeps at most one snapshot per day for recent days, collapsing to
 * one per week further back and one per month oldest, always keeping the latest.
 */
import type { SnapshotMeta } from './types.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** Minimum spacing (by position or time) before a fresh snapshot is written. */
export interface SnapshotPolicy {
  readonly minEvents: number;
  readonly minMillis: number;
}

export const DEFAULT_SNAPSHOT_POLICY: SnapshotPolicy = { minEvents: 256, minMillis: DAY };

export function shouldWriteSnapshot(
  metas: readonly SnapshotMeta[],
  position: number,
  now: number,
  policy: SnapshotPolicy = DEFAULT_SNAPSHOT_POLICY,
): boolean {
  if (position === 0) return false;
  const latest = latestSnapshot(metas);
  if (latest === undefined) return true;
  if (position <= latest.position) return false;
  return position - latest.position >= policy.minEvents || now - latest.createdAt >= policy.minMillis;
}

/** Returns the ids to delete so the surviving set obeys the day/week/month ladder. */
export function snapshotsToPrune(metas: readonly SnapshotMeta[], now: number): string[] {
  if (metas.length <= 1) return [];
  const sorted = [...metas].sort((a, b) => b.createdAt - a.createdAt);
  const latest = sorted[0]!;
  const keep = new Set<string>([latest.id]);
  const seenBucket = new Set<string>();
  for (const meta of sorted) {
    if (meta.id === latest.id) continue;
    const age = now - meta.createdAt;
    const bucket =
      age < WEEK
        ? `d:${Math.floor(meta.createdAt / DAY)}`
        : age < MONTH
          ? `w:${Math.floor(meta.createdAt / WEEK)}`
          : `m:${Math.floor(meta.createdAt / MONTH)}`;
    if (seenBucket.has(bucket)) continue;
    seenBucket.add(bucket);
    keep.add(meta.id);
  }
  return sorted.filter((m) => !keep.has(m.id)).map((m) => m.id);
}

/** Nearest snapshot with `position <= target`, or undefined. */
export function nearestSnapshot(
  metas: readonly SnapshotMeta[],
  target: number,
): SnapshotMeta | undefined {
  let best: SnapshotMeta | undefined;
  for (const meta of metas) {
    if (meta.position <= target && (best === undefined || meta.position > best.position)) {
      best = meta;
    }
  }
  return best;
}

function latestSnapshot(metas: readonly SnapshotMeta[]): SnapshotMeta | undefined {
  let best: SnapshotMeta | undefined;
  for (const meta of metas) {
    if (best === undefined || meta.position > best.position) best = meta;
  }
  return best;
}
