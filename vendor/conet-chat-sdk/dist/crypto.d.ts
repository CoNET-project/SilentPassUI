/**
 * Crypto + encoding helpers. Runtime-agnostic (works in Worker and main thread).
 * Uses WebCrypto SubtleCrypto and `ethers` (keccak256 for content-addressing +
 * HKDF domain separation for history keys). No `Buffer` dependency.
 */
declare const textEncoder: TextEncoder;
declare const textDecoder: TextDecoder;
/** UTF-8 string → base64 (browser/worker safe, no Buffer). */
export declare function utf8ToBase64(input: string): string;
/** base64 → UTF-8 string. */
export declare function base64ToUtf8(b64: string): string;
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function base64ToBytes(b64: string): Uint8Array;
export declare function hexToBytes(hex: string): Uint8Array;
/** keccak256 content address of a UTF-8 payload → `0x`+64hex (Beamio fragment hash rule). */
export declare function keccakUtf8(input: string): string;
/** keccak256 of raw bytes → `0x`+64hex. */
export declare function keccakBytes(bytes: Uint8Array): string;
/**
 * HKDF-SHA256 domain-separated derivation.
 * @returns `length`-byte derived key.
 */
export declare function hkdf(masterBytes: Uint8Array, info: string, length?: number, salt?: Uint8Array): Promise<Uint8Array>;
/** AES-256-GCM encrypt. Returns base64 of `nonce(12) || ciphertext||tag`. */
export declare function aesGcmEncryptBytes(key: Uint8Array, plaintext: Uint8Array): Promise<string>;
/** AES-256-GCM decrypt of base64 `nonce(12) || ciphertext||tag`. */
export declare function aesGcmDecryptBytes(key: Uint8Array, b64: string): Promise<Uint8Array>;
export declare function aesGcmEncryptString(key: Uint8Array, plaintext: string): Promise<string>;
export declare function aesGcmDecryptString(key: Uint8Array, b64: string): Promise<string>;
export { textEncoder, textDecoder };
//# sourceMappingURL=crypto.d.ts.map