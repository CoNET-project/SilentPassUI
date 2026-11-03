/**
 * Voice channel v2 (CoNET Chat rules 22/23). Same wire as the iOS shell
 * `BeamioVoiceChannelV2.swift` and the Android shell `BeamioVoiceChannelV2.kt`.
 *
 * Setup once per direction: `voice_listen` with `v: 2` and a random 32-byte write
 * key `wk` on the 32-hex session (the channel locator); the node answers
 * `voice_ready` with `v: 2`; the peer learns `wk` from the AES caps frame
 * (`voice_media_caps_v1` with `chan: 2`, `wk`).
 *
 * Each chunk is a binary OpenPGP literal to the peer's route key:
 * `CVC2 ‖ locator(16) ‖ HMAC-SHA256(wk, locator ‖ blob)[0..16) ‖ blob`. The node
 * sees nothing else. `blob` = AES-GCM (session key, AAD = `CVC2 ‖ locator`) over a
 * 28-byte little-endian header `ver=2 | kind | flags | rsv | seq u32 | captureMs u64 |
 * frameId u32 | fragIdx u16 | fragCnt u16 | dataLen u32`, then data, then zero
 * padding so the blob is a multiple of 256 bytes (max 9000).
 */
export declare const VOICE_CHUNK_MAGIC: Uint8Array<ArrayBuffer>;
export declare const VOICE_V2_HEADER = 28;
export declare const VOICE_V2_PAD = 256;
export declare const VOICE_V2_MAX_BLOB = 9000;
export declare const VOICE_KIND_AUDIO = 0;
export declare const VOICE_KIND_VIDEO = 1;
export declare const VOICE_KIND_CONTROL = 2;
export interface VoiceV2Opened {
    kind: number;
    seq: number;
    captureMs: number;
    frameId: number;
    data: Uint8Array;
}
export declare const bytesToBase64: (bytes: Uint8Array) => string;
export declare const base64ToBytes: (b64: string) => Uint8Array;
export declare const randomWriteKey: () => Uint8Array;
/** 32 lowercase hex chars → 16 bytes; null for any other session id. */
export declare const locatorFromSessionId: (sessionId: string) => Uint8Array | null;
/** v1 frame payload (no AAD): nonce(12) ‖ ciphertext‖tag → base64. Same as the PWA media code. */
export declare const aesEncryptV1: (key: Uint8Array, plain: Uint8Array) => Promise<string>;
export declare const aesDecryptV1: (key: Uint8Array, payloadB64: string) => Promise<Uint8Array>;
/** Route literal for one chunk; encrypt it as a binary OpenPGP message. */
export declare const sealVoiceChunk: (args: {
    sessionKey: Uint8Array;
    locator: Uint8Array;
    writeKey: Uint8Array;
    kind: number;
    seq: number;
    captureMs: number;
    frameId?: number;
    data: Uint8Array;
}) => Promise<Uint8Array>;
/** Decrypt a chunk blob written to our own channel. */
export declare const openVoiceChunk: (sessionKey: Uint8Array, ownLocator: Uint8Array, blob: Uint8Array) => Promise<VoiceV2Opened>;
//# sourceMappingURL=voice-channel-v2.d.ts.map