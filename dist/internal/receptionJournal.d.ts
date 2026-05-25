import type { Hash, PublicKey } from 'nearbytes-crypto';
import type { ReceptionApi, ReceptionObjectRef } from '../reception.js';
import type { LogIo } from './io.js';
export declare function createReceptionJournal(io: LogIo): ReceptionApi;
/** Build a reception ref after storing an event. */
export declare function receptionRefForEvent(publicKey: PublicKey, eventHash: Hash): ReceptionObjectRef;
/** Build a reception ref after storing a block. */
export declare function receptionRefForBlock(hash: Hash): ReceptionObjectRef;
//# sourceMappingURL=receptionJournal.d.ts.map