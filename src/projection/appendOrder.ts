/**
 * The trivial ordering policy for commutative / append-only projectors: keep the
 * prior order, append new keys in arrival order, never insert before the live
 * position. No total order is maintained. See `storage/projection-engine-v1.md`
 * PROJ-2.2.
 */
import type { OrderKey } from './types.js';

export function appendReorder<TKey extends OrderKey>(
  prevKeys: readonly TKey[],
  newKeys: readonly TKey[],
): { keys: TKey[]; insertAt: number } {
  const known = new Set(prevKeys.map((k) => k.hash));
  const added = newKeys.filter((k) => !known.has(k.hash));
  return { keys: [...prevKeys, ...added], insertAt: prevKeys.length };
}
