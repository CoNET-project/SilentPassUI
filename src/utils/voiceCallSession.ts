export type VoiceCallSignal = {
	type: 'voice_call_offer_v1' | 'voice_call_accept_v1' | 'voice_call_reject_v1' | 'voice_end_v1'
	callId: string
	sessionId: string
	from: string
	to: string
	createdAt: number
	expiresAt: number
	sessionKey?: string
	tempWalletAddress?: string
	entryDomains?: string[]
	peerSessionId?: string
	codec?: string
	reason?: string
}

const reportedIncomingVoiceCallIds = new Set<string>()

export function claimIncomingVoiceCallReport(callId: string, sessionId: string): boolean {
	const key = `${callId.trim()}:${sessionId.trim()}`
	if (!callId.trim() || !sessionId.trim() || reportedIncomingVoiceCallIds.has(key)) return false
	reportedIncomingVoiceCallIds.add(key)
	return true
}

export function hasReportedIncomingVoiceCall(callId: string, sessionId: string): boolean {
	return reportedIncomingVoiceCallIds.has(`${callId.trim()}:${sessionId.trim()}`)
}

export const VOICE_MAX_FRAME_B64 = 12_000
export const VOICE_FRAME_TIMESTAMP_SKEW_SEC = 30
export const VOICE_CALL_MAX_DURATION_MS = 15 * 60 * 1000

export const randomVoiceId = (prefix: string): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return `${prefix}-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

export const createVoiceSessionKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32))

export const voiceSessionKeyToBase64 = (key: Uint8Array): string =>
	btoa(String.fromCharCode(...key))

export const voiceSessionKeyFromBase64 = (value: string): Uint8Array => {
	const raw = atob(value)
	const key = Uint8Array.from(raw, char => char.charCodeAt(0))
	if (key.length !== 32) throw new Error('voice_session_key_invalid')
	return key
}

export const makeVoiceCallSignal = (
	signal: Omit<VoiceCallSignal, 'createdAt' | 'expiresAt'> & { expiresAt?: number },
): VoiceCallSignal => ({
	...signal,
	createdAt: Date.now(),
	expiresAt: signal.expiresAt ?? Date.now() + VOICE_CALL_MAX_DURATION_MS,
})

export const encryptVoiceFrame = async (key: Uint8Array, plain: Uint8Array): Promise<string> => {
	const nonce = crypto.getRandomValues(new Uint8Array(12))
	const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
	const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, plain)
	const packed = new Uint8Array(nonce.length + cipher.byteLength)
	packed.set(nonce)
	packed.set(new Uint8Array(cipher), nonce.length)
	return btoa(String.fromCharCode(...packed))
}

export const decryptVoiceFrame = async (key: Uint8Array, payload: string): Promise<Uint8Array> => {
	const packed = Uint8Array.from(atob(payload), char => char.charCodeAt(0))
	if (packed.length < 28) throw new Error('voice_frame_too_short')
	const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
	const plain = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: packed.slice(0, 12) },
		cryptoKey,
		packed.slice(12),
	)
	return new Uint8Array(plain)
}

export const isFreshVoiceFrame = (frame: { payload?: unknown; seq?: unknown; timestamp?: unknown }): boolean => {
	if (typeof frame.payload !== 'string' || frame.payload.length > VOICE_MAX_FRAME_B64) return false
	const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(frame.timestamp))
	return Number.isSafeInteger(frame.seq) && Number(frame.seq) >= 0 && skew <= VOICE_FRAME_TIMESTAMP_SKEW_SEC
}
