import type { Hash } from 'nearbytes-crypto';

/** Object reference recorded in the local reception journal (sync-facing). */
export type ReceptionObjectRef =
  | { readonly kind: 'block'; readonly hash: Hash }
  | { readonly kind: 'event'; readonly channel: string; readonly hash: Hash };

export interface ReceptionListResult {
  readonly refs: ReceptionObjectRef[];
  readonly next?: string;
  readonly more: boolean;
}

/**
 * Append-only local reception journal for efficient {@link global_delta} queries.
 */
export interface ReceptionApi {
  appendReception(ref: ReceptionObjectRef): Promise<string>;
  listAfter(cursor?: string, limit?: number): Promise<ReceptionListResult>;
  listHubDelta(
    hubChannelHex: string,
    heads: ReceptionObjectRef[],
    limit?: number,
  ): Promise<ReceptionListResult>;
}

/** Append-only sync lifecycle markers (plain UTF-8 lines). */
export interface SyncActivityApi {
  appendMarker(line: string): Promise<void>;
  readMarkers(): Promise<string[]>;
}
