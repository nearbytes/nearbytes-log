# nearbytes-log

Append-only event log and content-addressed block store for the Nearbytes protocol.

## API

- **`Log`** — `{ events: EventLogApi, blocks: BlockStoreApi }`
- **`createFilesystemLog(dataDir)`** — Node.js disk root
- **`createInMemoryLog(options?)`** — in-memory (tests)
- **Protocol** — `serializeEventEnvelope`, `validateEventBytes`, `createSignedEvent`, …

## Install

```sh
yarn add nearbytes/nearbytes-log#main
```

## Example

```ts
import { createFilesystemLog } from 'nearbytes-log';

const log = createFilesystemLog('/path/to/data');
const hash = await log.events.storeEvent(publicKey, signedEvent);
const block = await log.blocks.retrieve(contentHash);
```

## Layout

```
src/
  api.ts              — Log, EventLogApi, BlockStoreApi
  paths.ts            — channel/block path helpers
  impl/filesystem.ts  — createFilesystemLog
  impl/memory.ts      — createInMemoryLog
  internal/           — not exported
  serialization.ts    — protocol codecs
  integrity.ts        — validation
  eventEnvelope.ts    — sign / decrypt helpers
```

## Concurrent-writer safety

`createFilesystemLog` is safe to use from multiple processes pointing at the same `dataDir` simultaneously (e.g. the `nbsync` daemon plus an interactive `nbf` CLI). Every file is published via the canonical content-addressable-store idiom:

```
write bytes to <final>.<randomBytes(8)>.tmp
link(2)       <final>.<…>.tmp  →  <final>
unlink(tmp)
```

`link(2)` is the only POSIX atomic verb that refuses to overwrite an existing target, so the first writer to call it wins; concurrent writers see `EEXIST` and treat it as success (content-addressed naming guarantees the bytes already on disk are bit-for-bit identical). On filesystems without hardlink support (FAT, some NFS variants), implementations fall back to `rename(2)` — correctness is preserved by the same content-addressing argument. Crash-orphaned `*.tmp` scratches are reaped on storage-root init by `nearbytes-skeleton`'s `initializeStorageRoot` after a safety window.

Specs:

- [`nearbytes-specs/storage/log-api-v1.md`](https://github.com/nearbytes/nearbytes-specs/blob/main/storage/log-api-v1.md) — log API surface
- [`nearbytes-specs/requirements/sync-discovery-v1.md`](https://github.com/nearbytes/nearbytes-specs/blob/main/requirements/sync-discovery-v1.md) — DISC-27.3 concurrent-writer publish, DISC-27.4 cross-process propagation
