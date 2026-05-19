import type { DecryptedEvent, Hash } from 'nearbytes-crypto';

export interface EventLogEntry {
  readonly eventHash: Hash;
  readonly signedEvent: DecryptedEvent;
}
