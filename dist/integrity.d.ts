import { type Hash } from 'nearbytes-crypto';
import { type PublicKey } from 'nearbytes-crypto';
export interface IntegrityValidationResult {
    readonly ok: boolean;
    readonly code?: string;
    readonly detail?: string;
}
export declare const HASH_HEX_REGEX: RegExp;
export declare const VOLUME_ID_HEX_REGEX: RegExp;
export declare function validateBlockBytes(expectedHash: string, data: Uint8Array): Promise<IntegrityValidationResult>;
export declare function validateEventBytes(publicKeyHex: string, expectedEventHash: string, data: Uint8Array): Promise<IntegrityValidationResult>;
export declare function normalizeHash(value: string): Hash | null;
export declare function normalizeVolumeId(value: string): string | null;
export declare function parseCanonicalBlockRelativePath(relativePath: string): {
    readonly hash: Hash;
} | null;
export declare function parseCanonicalEventRelativePath(relativePath: string): {
    readonly volumeId: string;
    readonly eventHash: Hash;
} | null;
export declare function validateCanonicalStorageFile(relativePath: string, data: Uint8Array): Promise<IntegrityValidationResult>;
export declare function publicKeyFromHex(value: string): PublicKey | null;
//# sourceMappingURL=integrity.d.ts.map