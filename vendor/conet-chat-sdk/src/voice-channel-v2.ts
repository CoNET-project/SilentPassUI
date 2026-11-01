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

export const VOICE_CHUNK_MAGIC = new Uint8Array([0x43, 0x56, 0x43, 0x32]) // CVC2
export const VOICE_V2_HEADER = 28
export const VOICE_V2_PAD = 256
export const VOICE_V2_MAX_BLOB = 9_000
export const VOICE_KIND_AUDIO = 0
export const VOICE_KIND_VIDEO = 1
export const VOICE_KIND_CONTROL = 2

export interface VoiceV2Opened {
	kind: number
	seq: number
	captureMs: number
	frameId: number
	data: Uint8Array
}

/** WebCrypto wants ArrayBuffer-backed views (TS 5.7 typed-array generics). */
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource

const concat = (...parts: Uint8Array[]): Uint8Array => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
	let at = 0
	for (const p of parts) {
		out.set(p, at)
		at += p.length
	}
	return out
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
	let bin = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(bin)
}

export const base64ToBytes = (b64: string): Uint8Array => {
	const bin = atob(b64.trim())
	const out = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
	return out
}

export const randomWriteKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32))

/** 32 lowercase hex chars → 16 bytes; null for any other session id. */
export const locatorFromSessionId = (sessionId: string): Uint8Array | null => {
	const hex = sessionId.trim()
	if (!/^[0-9a-f]{32}$/.test(hex)) return null
	const out = new Uint8Array(16)
	for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
	return out
}

const aesKey = (raw: Uint8Array): Promise<CryptoKey> =>
	crypto.subtle.importKey('raw', bs(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

/** v1 frame payload (no AAD): nonce(12) ‖ ciphertext‖tag → base64. Same as the PWA media code. */
export const aesEncryptV1 = async (key: Uint8Array, plain: Uint8Array): Promise<string> => {
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, await aesKey(key), bs(plain)))
	return bytesToBase64(concat(iv, ct))
}

export const aesDecryptV1 = async (key: Uint8Array, payloadB64: string): Promise<Uint8Array> => {
	const packed = base64ToBytes(payloadB64)
	return new Uint8Array(await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bs(packed.subarray(0, 12)) },
		await aesKey(key),
		bs(packed.subarray(12)),
	))
}

/** Route literal for one chunk; encrypt it as a binary OpenPGP message. */
export const sealVoiceChunk = async (args: {
	sessionKey: Uint8Array
	locator: Uint8Array
	writeKey: Uint8Array
	kind: number
	seq: number
	captureMs: number
	frameId?: number
	data: Uint8Array
}): Promise<Uint8Array> => {
	const bare = 12 + VOICE_V2_HEADER + args.data.length + 16
	if (bare > VOICE_V2_MAX_BLOB) throw new Error('voice chunk too large')
	const padded = Math.min(VOICE_V2_MAX_BLOB, Math.ceil(bare / VOICE_V2_PAD) * VOICE_V2_PAD)
	const plain = new Uint8Array(padded - 28)
	const view = new DataView(plain.buffer)
	plain[0] = 2
	plain[1] = args.kind
	view.setUint32(4, args.seq >>> 0, true)
	view.setBigUint64(8, BigInt(Math.max(0, Math.floor(args.captureMs))), true)
	view.setUint32(16, (args.frameId ?? 0) >>> 0, true)
	view.setUint16(20, 0, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, args.data.length, true)
	plain.set(args.data, VOICE_V2_HEADER)
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const ct = new Uint8Array(await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: bs(iv), additionalData: bs(concat(VOICE_CHUNK_MAGIC, args.locator)) },
		await aesKey(args.sessionKey),
		bs(plain),
	))
	const blob = concat(iv, ct)
	const hmacKey = await crypto.subtle.importKey('raw', bs(args.writeKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, bs(concat(args.locator, blob)))).subarray(0, 16)
	return concat(VOICE_CHUNK_MAGIC, args.locator, mac, blob)
}

/** Decrypt a chunk blob written to our own channel. */
export const openVoiceChunk = async (
	sessionKey: Uint8Array,
	ownLocator: Uint8Array,
	blob: Uint8Array,
): Promise<VoiceV2Opened> => {
	const plain = new Uint8Array(await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bs(blob.subarray(0, 12)), additionalData: bs(concat(VOICE_CHUNK_MAGIC, ownLocator)) },
		await aesKey(sessionKey),
		bs(blob.subarray(12)),
	))
	if (plain.length < VOICE_V2_HEADER || plain[0] !== 2) throw new Error('bad voice chunk header')
	const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength)
	const dataLen = view.getUint32(24, true)
	if (VOICE_V2_HEADER + dataLen > plain.length) throw new Error('bad voice chunk length')
	return {
		kind: plain[1],
		seq: view.getUint32(4, true),
		captureMs: Number(view.getBigUint64(8, true)),
		frameId: view.getUint32(16, true),
		data: plain.slice(VOICE_V2_HEADER, VOICE_V2_HEADER + dataLen),
	}
}
