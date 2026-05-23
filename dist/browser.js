/**
 * Browser-safe exports (no Node.js fs/path). Use from Vite/renderer instead of the package root.
 */
export { openChannel } from './channel.js';
export { loadEventLog, verifyEventLog } from './replay.js';
export { createInMemoryLog } from './impl/memory.js';
export { createLogFromIo } from './impl/fromIo.js';
export { createMemoryStore } from './internal/memoryStore.js';
export { defaultPathMapper, publicKeyToHex, blockPath, eventPath, eventHashFromFileName, } from './paths.js';
export * from './eventEnvelope.js';
export * from './types.js';
export { serializeEvent, deserializeEvent, serializeEventEnvelope, serializeInnerEventPayload, deserializeInnerEventPayload, serializeInnerEventPayloadJson, deserializeInnerEventPayloadJson, serializeEventPayload, } from './serialization.js';
export { validateBlockBytes, validateEventBytes, validateCanonicalStorageFile, parseCanonicalBlockRelativePath, parseCanonicalEventRelativePath, normalizeHash, normalizeVolumeId, publicKeyFromHex, HASH_HEX_REGEX, VOLUME_ID_HEX_REGEX, } from './integrity.js';
//# sourceMappingURL=browser.js.map