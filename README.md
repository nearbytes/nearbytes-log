# nearbytes-log

Append-only, content-addressed event log and block store for the Nearbytes protocol.

## What's inside

- **`EventLog`** — append-only log of ECDSA-signed events per channel (public key). Events are content-addressed by `SHA-256(envelope-bytes)`, verified on read, and stored as `channels/<pubkey-hex>/<event-hash>.bin`.
- **`BlockStore`** — key→value store for encrypted data blobs (`blocks/<hash>.bin`). Integrity is checked on every read.
- **`createLog(storage, pathMapper?)`** — factory that wires both into a `Log` handle.
- **Serialization** — `serializeEvent` / `deserializeEvent`, `serializeInnerEventPayload` / `deserializeInnerEventPayload`, and JSON variants for trusted local use.
- **Integrity helpers** — `validateBlockBytes`, `validateEventBytes`, `parseCanonicalBlockRelativePath`, etc.

## Install

```sh
yarn add nearbytes/nearbytes-log#main
```

## Quick start

```ts
import { createLog } from 'nearbytes-log';
import { FilesystemStorageBackend } from 'nearbytes-storage';

const storage = new FilesystemStorageBackend('/path/to/data');
const log = createLog(storage);

// Store a signed event
const eventHash = await log.events.storeEvent(publicKey, signedEvent);

// Retrieve it
const event = await log.events.retrieveEvent(publicKey, eventHash);

// Store a block
await log.blocks.store(hash, encryptedData);
const block = await log.blocks.retrieve(hash);
```

## Package structure

```
src/
  log.ts           — Log interface + createLog() factory
  eventLog.ts      — EventLog class (storeEvent, retrieveEvent, listEvents)
  blockStore.ts    — BlockStore class (store, retrieve, has)
  serialization.ts — event ↔ binary/JSON serialization
  integrity.ts     — hash/signature validation helpers
  eventEnvelope.ts — createSignedEvent, eventEnvelopePublicKeyMatches, hydrateSignedEvent
  types.ts         — EventLogEntry
```
