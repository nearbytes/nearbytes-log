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

Spec: `nearbytes-specs/storage/log-api-v1.md`
