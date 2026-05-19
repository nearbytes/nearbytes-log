import type { EventEnvelope, EventPayload, SerializedEvent, SerializedEventPayload, SignedEvent } from 'nearbytes-crypto';
export declare function serializeEvent(event: SignedEvent): SerializedEvent;
export declare function deserializeEvent(data: SerializedEvent): SignedEvent;
export declare function serializeEventEnvelope(envelope: EventEnvelope): Uint8Array;
export declare function serializeInnerEventPayload(payload: EventPayload): Uint8Array;
export declare function deserializeInnerEventPayload(data: Uint8Array): EventPayload;
export declare function serializeInnerEventPayloadJson(payload: EventPayload): SerializedEventPayload;
export declare const serializeEventPayload: typeof serializeInnerEventPayload;
export declare function deserializeInnerEventPayloadJson(data: unknown): EventPayload;
//# sourceMappingURL=serialization.d.ts.map