import type {
  EventEnvelope,
  EventPayload,
  SerializedEvent,
  SerializedEventPayload,
  SignedEvent,
  CreateFilePayload,
  MkdirPayload,
  DeletePayload,
  RenamePayload,
  DeclareIdentityPayload,
  ChatMessagePayload,
  AppRecordPayload,
} from 'nearbytes-crypto';
import {
  EVENT_ENVELOPE_VERSION,
  EventType,
  createEncryptedData,
  createHash,
  createSignature,
} from 'nearbytes-crypto';
import { base64ToBytes, bytesToBase64 } from 'nearbytes-crypto';

export function serializeEvent(event: SignedEvent): SerializedEvent {
  return {
    envelope: {
      version: event.envelope.version,
      publicKey: event.envelope.publicKey,
      blockRefs: event.envelope.blockRefs,
      ciphertext: bytesToBase64(event.envelope.ciphertext),
    },
    signature: bytesToBase64(event.signature),
  };
}

export function deserializeEvent(data: SerializedEvent): SignedEvent {
  if (data.envelope.version !== EVENT_ENVELOPE_VERSION) {
    throw new Error(`Unsupported event envelope version: ${String(data.envelope.version)}`);
  }
  if (typeof data.envelope.publicKey !== 'string' || !/^[0-9a-f]{130}$/i.test(data.envelope.publicKey)) {
    throw new Error('Invalid event public key');
  }
  if (!Array.isArray(data.envelope.blockRefs)) {
    throw new Error('Invalid event blockRefs');
  }
  const blockRefs = data.envelope.blockRefs.map((value) => {
    if (typeof value !== 'string') {
      throw new Error('Invalid event blockRef');
    }
    return createHash(value);
  });

  return {
    envelope: {
      version: EVENT_ENVELOPE_VERSION,
      publicKey: data.envelope.publicKey.toLowerCase(),
      blockRefs,
      ciphertext: createEncryptedData(base64ToBytes(data.envelope.ciphertext)),
    },
    signature: createSignature(base64ToBytes(data.signature)),
  };
}

export function serializeEventEnvelope(envelope: EventEnvelope): Uint8Array {
  if (envelope.version !== EVENT_ENVELOPE_VERSION) {
    throw new Error(`Unsupported event envelope version: ${String(envelope.version)}`);
  }
  if (!/^[0-9a-f]{130}$/i.test(envelope.publicKey)) {
    throw new Error('Invalid event public key');
  }
  const encoded = JSON.stringify({
    version: envelope.version,
    publicKey: envelope.publicKey.toLowerCase(),
    blockRefs: envelope.blockRefs,
    ciphertext: bytesToBase64(envelope.ciphertext),
  });
  return new TextEncoder().encode(encoded);
}

export function serializeInnerEventPayload(payload: EventPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(serializeInnerEventPayloadJson(payload)));
}

export function deserializeInnerEventPayload(data: Uint8Array): EventPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(data));
  } catch (error) {
    throw new Error(`Invalid inner event payload JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  return deserializeInnerEventPayloadJson(parsed);
}

export function serializeInnerEventPayloadJson(payload: EventPayload): SerializedEventPayload {
  switch (payload.type) {
    case EventType.CREATE_FILE: {
      const p = payload as CreateFilePayload;
      const result: Record<string, unknown> = {
        type: p.type,
        path: p.path,
        content: p.content,
        wrappedKey: bytesToBase64(p.wrappedKey),
        createdAt: p.createdAt,
      };
      if (p.mimeType !== undefined) result.mimeType = p.mimeType;
      return result;
    }
    case EventType.MKDIR: {
      const p = payload as MkdirPayload;
      return {
        type: p.type,
        path: p.path,
        createdAt: p.createdAt,
      };
    }
    case EventType.DELETE: {
      const p = payload as DeletePayload;
      return {
        type: p.type,
        path: p.path,
        deletedAt: p.deletedAt,
      };
    }
    case EventType.RENAME: {
      const p = payload as RenamePayload;
      return {
        type: p.type,
        fromPath: p.fromPath,
        toPath: p.toPath,
        renamedAt: p.renamedAt,
      };
    }
    case EventType.DECLARE_IDENTITY: {
      const p = payload as DeclareIdentityPayload;
      const result: Record<string, unknown> = { type: p.type };
      if (p.record !== undefined) result.record = p.record;
      if (p.authorPublicKey !== undefined) result.authorPublicKey = p.authorPublicKey;
      if (p.publishedAt !== undefined) result.publishedAt = p.publishedAt;
      return result;
    }
    case EventType.CHAT_MESSAGE: {
      const p = payload as ChatMessagePayload;
      const result: Record<string, unknown> = { type: p.type };
      if (p.message !== undefined) result.message = p.message;
      if (p.authorPublicKey !== undefined) result.authorPublicKey = p.authorPublicKey;
      if (p.publishedAt !== undefined) result.publishedAt = p.publishedAt;
      return result;
    }
    case EventType.APP_RECORD: {
      const p = payload as AppRecordPayload;
      return {
        type: p.type,
        protocol: p.protocol,
        record: p.record,
        authorPublicKey: p.authorPublicKey,
        publishedAt: p.publishedAt,
      };
    }
  }
}

/** @deprecated Use `serializeInnerEventPayload`. */
export const serializeEventPayload = serializeInnerEventPayload;

export function deserializeInnerEventPayloadJson(data: unknown): EventPayload {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Event payload must be an object');
  }
  const payload = data as Record<string, unknown>;
  if (!Object.values(EventType).includes(payload.type as EventType)) {
    throw new Error(`Invalid event type: ${String(payload.type)}`);
  }
  const type = payload.type as EventType;

  switch (type) {
    case EventType.CREATE_FILE: {
      if (typeof payload.path !== 'string') throw new Error('CREATE_FILE: invalid path');
      if (typeof payload.wrappedKey !== 'string') throw new Error('CREATE_FILE: invalid wrappedKey');
      if (typeof payload.createdAt !== 'number') throw new Error('CREATE_FILE: invalid createdAt');
      assertFiniteUint(payload.createdAt, 'createdAt');
      const content = parseContentDescriptor(payload.content);
      const result: CreateFilePayload = {
        type: EventType.CREATE_FILE,
        path: payload.path,
        content,
        wrappedKey: createEncryptedData(base64ToBytes(payload.wrappedKey)),
        createdAt: payload.createdAt,
      };
      if (payload.mimeType !== undefined) {
        if (typeof payload.mimeType !== 'string') throw new Error('CREATE_FILE: invalid mimeType');
        return { ...result, mimeType: payload.mimeType };
      }
      return result;
    }
    case EventType.MKDIR: {
      if (typeof payload.path !== 'string') throw new Error('MKDIR: invalid path');
      if (typeof payload.createdAt !== 'number') throw new Error('MKDIR: invalid createdAt');
      assertFiniteUint(payload.createdAt, 'createdAt');
      return {
        type: EventType.MKDIR,
        path: payload.path,
        createdAt: payload.createdAt,
      };
    }
    case EventType.DELETE: {
      if (typeof payload.path !== 'string') throw new Error('DELETE: invalid path');
      if (typeof payload.deletedAt !== 'number') throw new Error('DELETE: invalid deletedAt');
      assertFiniteUint(payload.deletedAt, 'deletedAt');
      return {
        type: EventType.DELETE,
        path: payload.path,
        deletedAt: payload.deletedAt,
      };
    }
    case EventType.RENAME: {
      if (typeof payload.fromPath !== 'string') throw new Error('RENAME: invalid fromPath');
      if (typeof payload.toPath !== 'string') throw new Error('RENAME: invalid toPath');
      if (typeof payload.renamedAt !== 'number') throw new Error('RENAME: invalid renamedAt');
      assertFiniteUint(payload.renamedAt, 'renamedAt');
      return {
        type: EventType.RENAME,
        fromPath: payload.fromPath,
        toPath: payload.toPath,
        renamedAt: payload.renamedAt,
      };
    }
    case EventType.DECLARE_IDENTITY: {
      const result: DeclareIdentityPayload = { type: EventType.DECLARE_IDENTITY };
      if (payload.record !== undefined) {
        if (typeof payload.record !== 'string') throw new Error('DECLARE_IDENTITY: invalid record');
        return { ...result, record: payload.record,
          authorPublicKey: typeof payload.authorPublicKey === 'string' ? payload.authorPublicKey : undefined,
          publishedAt: typeof payload.publishedAt === 'number' ? payload.publishedAt : undefined,
        };
      }
      return {
        ...result,
        authorPublicKey: typeof payload.authorPublicKey === 'string' ? payload.authorPublicKey : undefined,
        publishedAt: typeof payload.publishedAt === 'number' ? payload.publishedAt : undefined,
      };
    }
    case EventType.CHAT_MESSAGE: {
      const result: ChatMessagePayload = { type: EventType.CHAT_MESSAGE };
      return {
        ...result,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        authorPublicKey: typeof payload.authorPublicKey === 'string' ? payload.authorPublicKey : undefined,
        publishedAt: typeof payload.publishedAt === 'number' ? payload.publishedAt : undefined,
      };
    }
    case EventType.APP_RECORD: {
      if (typeof payload.protocol !== 'string') throw new Error('APP_RECORD: invalid protocol');
      if (typeof payload.record !== 'string') throw new Error('APP_RECORD: invalid record');
      if (typeof payload.authorPublicKey !== 'string') throw new Error('APP_RECORD: invalid authorPublicKey');
      if (typeof payload.publishedAt !== 'number') throw new Error('APP_RECORD: invalid publishedAt');
      assertFiniteUint(payload.publishedAt, 'publishedAt');
      return {
        type: EventType.APP_RECORD,
        protocol: payload.protocol,
        record: payload.record,
        authorPublicKey: payload.authorPublicKey,
        publishedAt: payload.publishedAt,
      };
    }
  }
}

function parseContentDescriptor(raw: unknown): import('nearbytes-crypto').ContentDescriptor {
  if (typeof raw !== 'object' || raw === null) throw new Error('CREATE_FILE: invalid content descriptor');
  const c = raw as Record<string, unknown>;
  if (c.protocol === 'nb.content.single.v1') {
    if (typeof c.blockHash !== 'string') throw new Error('CREATE_FILE: invalid content.blockHash');
    return { protocol: 'nb.content.single.v1', blockHash: createHash(c.blockHash) };
  }
  if (c.protocol === 'nb.content.manifest.v1') {
    if (typeof c.manifestHash !== 'string') throw new Error('CREATE_FILE: invalid content.manifestHash');
    return { protocol: 'nb.content.manifest.v1', manifestHash: createHash(c.manifestHash) };
  }
  throw new Error(`CREATE_FILE: unknown content protocol: ${String(c.protocol)}`);
}

function assertFiniteUint(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }
}
