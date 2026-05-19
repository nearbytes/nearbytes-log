/**
 * Internal interface matching the extended multi-root storage backend
 * used in the app. Allows EventLog and BlockStore to route writes
 * through the channel-aware multi-root backend without depending on it.
 */
import type { StorageBackend } from 'nearbytes-storage';
import type { IntegrityValidationResult } from './integrity.js';

export interface MultiRootStorageLike extends StorageBackend {
  writeFileForChannel(path: string, data: Uint8Array, channelKeyHex: string): Promise<void>;
  readValidatedFileForChannel(
    path: string,
    channelKeyHex: string,
    validator: (data: Uint8Array) => Promise<IntegrityValidationResult> | IntegrityValidationResult
  ): Promise<Uint8Array>;
  readValidatedFile(
    path: string,
    validator: (data: Uint8Array) => Promise<IntegrityValidationResult> | IntegrityValidationResult
  ): Promise<Uint8Array>;
  listFilesAcrossRoots(directory: string): Promise<string[]>;
  existsForChannel(path: string, channelKeyHex: string): Promise<boolean>;
}

export function isMultiRootStorageBackend(storage: StorageBackend): storage is MultiRootStorageLike {
  return typeof (storage as Partial<MultiRootStorageLike>).writeFileForChannel === 'function';
}

export function publicKeyToHex(publicKey: Uint8Array): string {
  return Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase();
}
