import type { CryptoOperations } from 'nearbytes-crypto';
import type { DecryptedEvent, EventPayload, Hash, SignedEvent } from 'nearbytes-crypto';
import type { KeyPair, PrivateKey, PublicKey } from 'nearbytes-crypto';
export declare function createSignedEvent(crypto: CryptoOperations, keyPair: KeyPair, payload: EventPayload, blockRefs: readonly Hash[]): Promise<DecryptedEvent>;
export declare function decryptSignedEventPayload(crypto: CryptoOperations, privateKey: PrivateKey, event: SignedEvent): Promise<EventPayload>;
export declare function hydrateSignedEvent(crypto: CryptoOperations, privateKey: PrivateKey, event: SignedEvent): Promise<DecryptedEvent>;
export declare function eventEnvelopePublicKeyMatches(event: SignedEvent, publicKey: PublicKey): boolean;
//# sourceMappingURL=eventEnvelope.d.ts.map