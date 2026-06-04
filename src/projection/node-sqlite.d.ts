/**
 * Minimal ambient types for Node's built-in `node:sqlite` (Node 22+), so the
 * store compiles without pinning a newer `@types/node`. Only the surface used by
 * `sqliteStore.ts` is declared.
 */
declare module 'node:sqlite' {
  type SqliteValue = string | number | bigint | Uint8Array | null;
  export interface StatementSync {
    run(...params: SqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: SqliteValue[]): Record<string, SqliteValue> | undefined;
    all(...params: SqliteValue[]): Record<string, SqliteValue>[];
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readonly open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
