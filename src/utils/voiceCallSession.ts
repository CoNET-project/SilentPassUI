import { Wallet, verifyMessage } from 'ethers'
import {
	ensureBeamioTagProfiles,
	lookupBeamioTagProfile,
	searchBeamioTagRemote,
} from '@/services/beamioTagWorkerBridge'
import { dispatchNativeSystemCallAction } from './cashTreesNativeNfc'
import { publishNativePwaLog } from './cashTreesNativePwaLog'

/** Unanswered incoming-call window. The Android shell closes at this mark and tells the caller. */
export const INCOMING_CALL_RING_TIMEOUT_MS = 180_000

/**
 * Wake receipt window. The callee's device sends `voice_call_ringing_v1` as soon
 * as it rings; without one in this time the dialer says the callee's phone may
 * be blocking the wake-up push (Samsung deep sleep, force stop). The call keeps
 * ringing until the normal timeout.
 */
export const VOICE_PEER_WAKE_TIMEOUT_MS = 8_000

/**
 * No wake receipt after five ringback rings: the callee's phone never got the
 * call (force stopped, switched off, push blocked). The dialer says
 * "Unreachable", sends the cancel and records the call as `unreachable`, so a
 * late push cannot ring the callee for a call that is over. A receipt that
 * comes later is ignored.
 *
 * Five rings of the 1 s on / 4 s off ringback (browser, iOS) = 25 s from the
 * offer's timestamp. Android counts five rings of its SIM-country tone and keeps
 * the result between 20 and 30 s (`BeamioNativeVoiceSignaling.peerUnreachableMs`).
 */
export const VOICE_PEER_UNREACHABLE_MS = 25_000

/** How long the dial screen shows "Unreachable" before it closes. */
export const VOICE_PEER_UNREACHABLE_NOTICE_MS = 2_000

/**
 * Dialer wake state: `restricted` = no receipt after 8 s (call keeps ringing),
 * `unreachable` = no receipt after five rings (call is over).
 */
export type VoicePeerWake = 'waiting' | 'ringing' | 'restricted' | 'unreachable'

/** A receipt shows "Ringing…", unless the call already ended as unreachable. */
export function voicePeerWakeAfterReceipt(current: VoicePeerWake): VoicePeerWake {
	return current === 'unreachable' ? current : 'ringing'
}

/** The 8 s or five-ring timer fired. A receipt that already came always wins. */
export function voicePeerWakeAfterTimer(
	current: VoicePeerWake,
	timer: 'restricted' | 'unreachable',
): VoicePeerWake {
	if (current === 'ringing' || current === 'unreachable') return current
	if (timer === 'unreachable') return 'unreachable'
	return current === 'waiting' ? 'restricted' : current
}

/**
 * Wake receipts already received (callId / sessionId → time), so a dial screen
 * that subscribes after the receipt arrived still shows "Ringing…".
 */
const peerRingingSeen = new Map<string, number>()
const PEER_RINGING_KEEP_MS = 10 * 60_000

export function noteVoicePeerRinging(callId?: string, sessionId?: string, now = Date.now()): void {
	peerRingingSeen.forEach((at, key) => {
		if (now - at > PEER_RINGING_KEEP_MS) peerRingingSeen.delete(key)
	})
	const c = String(callId || '').trim()
	const s = String(sessionId || '').trim()
	if (c) peerRingingSeen.set(`c:${c}`, now)
	if (s) peerRingingSeen.set(`s:${s}`, now)
}

/** Does this receipt (event detail) belong to our dial? */
export function voicePeerRingingMatches(
	detail: { callId?: string; sessionId?: string } | null | undefined,
	offer: { callId?: string; sessionId?: string } | null | undefined,
): boolean {
	const callId = String(detail?.callId || '').trim()
	const sessionId = String(detail?.sessionId || '').trim()
	return Boolean(
		(callId && callId === String(offer?.callId || '').trim()) ||
			(sessionId && sessionId === String(offer?.sessionId || '').trim()),
	)
}

export function wasVoicePeerRinging(
	offer: { callId?: string; sessionId?: string } | null | undefined,
	now = Date.now(),
): boolean {
	const fresh = (key: string) => {
		const at = peerRingingSeen.get(key)
		return at !== undefined && now - at <= PEER_RINGING_KEEP_MS
	}
	const c = String(offer?.callId || '').trim()
	const s = String(offer?.sessionId || '').trim()
	return Boolean((c && fresh(`c:${c}`)) || (s && fresh(`s:${s}`)))
}

export type VoiceCallSignal = {
	type:
		| 'voice_call_offer_v1'
		| 'voice_call_accept_v1'
		| 'voice_call_reject_v1'
		| 'voice_call_timeout_v1'
		| 'voice_end_v1'
		| 'voice_call_ringing_v1'
	callId: string
	sessionId: string
	from: string
	to: string
	createdAt: number
	expiresAt: number
	timestamp: number
	codec?: string
	reason?: string
	/** EIP-191 signature by the caller over {@link voiceCallOfferSignText}. Not an identity field. */
	callerSignature?: string
	/** Claim inside the encrypted offer. Display only after comparing it with the signature. */
	callerTag?: string
	/** Voice protocol v3 (paid channels created by the callee). Offers and accepts carry `3`. */
	proto?: number
	/** v3 offer: base64 of the caller's user-PGP public key (the callee answers to it). */
	callerPgp?: string
	/** v3 offer: base64 of the caller's mailbox route public key. */
	callerRoute?: string
	/** v3 accept: the four channels (memory only; never logged). */
	ch?: unknown
}

export const VOICE_CALL_IDENTITY_WARNING = 'Does not match the signing key'

export function claimedVoiceCallerTag(signal: { callerTag?: string } | null | undefined): string {
	return formatLookedUpBeamioTag(signal?.callerTag)
}

export function claimedVoiceCallerAddress(signal: { from?: string } | null | undefined): string {
	const from = String(signal?.from || '').trim()
	return /^0x[0-9a-fA-F]{40}$/.test(from) ? from : ''
}

/** True when the offer's claimed tag or wallet is not the key that signed it. */
export function voiceCallClaimMismatchesKey(
	signal: { callerTag?: string; from?: string } | null | undefined,
	recoveredAddress: string | null,
	lookedUpTag: string,
	lookupFinished = false,
): boolean {
	const claimedTag = claimedVoiceCallerTag(signal)
	const claimedAddress = claimedVoiceCallerAddress(signal).toLowerCase()
	const recovered = String(recoveredAddress || '').toLowerCase()
	if (!recovered) return Boolean(claimedTag || claimedAddress)
	if (claimedAddress && claimedAddress !== recovered) return true
	if (!claimedTag) return false
	if (!lookedUpTag) return lookupFinished
	return claimedTag.toLowerCase() !== lookedUpTag.toLowerCase()
}

/** `@BeamioTag` looked up for a signature-recovered address. Offer payload text is ignored. */
export function formatLookedUpBeamioTag(username?: string | null): string {
	const raw = String(username || '').trim().replace(/^@/, '')
	if (!/^[A-Za-z0-9_]{1,32}$/.test(raw) || /^[0-9a-fA-F]{16,32}$/.test(raw)) return ''
	return `@${raw}`
}

/** Canonical text signed by the caller. Identity fields (`from`, tag) are excluded. */
export function voiceCallOfferSignText(signal: Pick<
	VoiceCallSignal,
	'callId' | 'sessionId' | 'to' | 'createdAt' | 'expiresAt' | 'timestamp' | 'codec' | 'callerPgp' | 'callerRoute'
>): string {
	// Voice protocol v3 only: no channel material in the offer; the callee
	// creates the channels on Answer. Older offers do not verify.
	return [
		'CoNET voice_call_offer_v3',
		`callId:${signal.callId}`,
		`sessionId:${signal.sessionId}`,
		`to:${String(signal.to || '').toLowerCase()}`,
		`createdAt:${signal.createdAt}`,
		`expiresAt:${signal.expiresAt}`,
		`timestamp:${signal.timestamp}`,
		`codec:${signal.codec || ''}`,
		`callerPgp:${signal.callerPgp || ''}`,
		`callerRoute:${signal.callerRoute || ''}`,
	].join('\n')
}

export async function signVoiceCallOffer(signal: VoiceCallSignal, privateKey: string): Promise<VoiceCallSignal> {
	const callerSignature = await new Wallet(privateKey).signMessage(voiceCallOfferSignText(signal))
	return { ...signal, callerSignature }
}

/** Recover the caller EOA from the offer signature. Returns null when the proof is missing or invalid. */
export function recoverVoiceCallOfferSigner(signal: VoiceCallSignal | null | undefined): string | null {
	if (!signal || signal.type !== 'voice_call_offer_v1' || Number(signal.proto) !== 3 || !signal.callerSignature) return null
	try {
		const recovered = verifyMessage(voiceCallOfferSignText(signal), signal.callerSignature)
		return /^0x[0-9a-fA-F]{40}$/.test(recovered) ? recovered.toLowerCase() : null
	} catch {
		return null
	}
}

/** Unwrap the nested Chat envelope used by gossip before inspecting a call signal. */
export function parseVoiceCallSignal(raw: unknown): VoiceCallSignal | null {
	let value: unknown = raw
	for (let depth = 0; depth < 4; depth += 1) {
		if (typeof value === 'string') {
			try {
				value = JSON.parse(value)
			} catch {
				return null
			}
		}
		if (!value || typeof value !== 'object') return null
		const candidate = value as Partial<VoiceCallSignal> & { text?: unknown }
		if (
			(candidate.type === 'voice_call_offer_v1'
				|| candidate.type === 'voice_call_accept_v1'
				|| candidate.type === 'voice_call_reject_v1'
				|| candidate.type === 'voice_call_timeout_v1'
				|| candidate.type === 'voice_end_v1'
				|| candidate.type === 'voice_call_ringing_v1')
			&& typeof candidate.callId === 'string'
			&& typeof candidate.sessionId === 'string'
		) {
			return candidate as VoiceCallSignal
		}
		if (typeof candidate.text !== 'string') return null
		value = candidate.text
	}
	return null
}

const VOICE_CALL_END_TYPES: ReadonlySet<string> = new Set([
	'voice_end_v1',
	'voice_call_reject_v1',
	'voice_call_timeout_v1',
])

/**
 * callIds and sessionIds of calls that end (hangup, decline, timeout) somewhere
 * in one inbound batch. A cold start hands the whole native inbox to the page
 * at once, so an offer and its end can arrive together: that offer must not be
 * reported to the shell again. Only lines with a valid chat signature count
 * (`signerOf` returns the recovered signer, or nothing).
 */
export function voiceCallHandlesEndedInBatch(
	lines: readonly string[],
	signerOf: (text: string, signature: string) => string | null | undefined,
): Set<string> {
	const ended = new Set<string>()
	for (const raw of lines) {
		try {
			const msg = JSON.parse(raw) as { text?: unknown; signMessage?: unknown }
			if (typeof msg?.text !== 'string' || typeof msg.signMessage !== 'string') continue
			const signal = parseVoiceCallSignal(msg.text)
			if (!signal || !VOICE_CALL_END_TYPES.has(signal.type)) continue
			let signed = Boolean(signerOf(msg.text, msg.signMessage))
			if (!signed) {
				try {
					const inner = JSON.parse(msg.text) as { text?: unknown }
					if (typeof inner?.text === 'string') signed = Boolean(signerOf(inner.text, msg.signMessage))
				} catch {
					/* not nested */
				}
			}
			if (!signed) continue
			if (signal.callId.trim()) ended.add(signal.callId.trim())
			if (signal.sessionId.trim()) ended.add(signal.sessionId.trim())
		} catch {
			/* not a chat line */
		}
	}
	return ended
}

export function isVoiceCallProtocolMessage(raw: unknown): boolean {
	let value: unknown = raw
	for (let depth = 0; depth < 4; depth += 1) {
		if (typeof value === 'string') {
			try {
				value = JSON.parse(value)
			} catch {
				return false
			}
		}
		if (!value || typeof value !== 'object') return false
		const candidate = value as { type?: unknown; text?: unknown }
		if (typeof candidate.type === 'string' && candidate.type.startsWith('voice_')) return true
		if (typeof candidate.text !== 'string') return false
		value = candidate.text
	}
	return false
}

const reportedIncomingVoiceCallIds = new Set<string>()
const incomingVoiceOffersByHandle = new Map<string, VoiceCallSignal>()
const terminalVoiceCallHandles = new Set<string>()
const TERMINAL_VOICE_CALL_STORAGE_KEY = 'beamio:voice-call-terminal-handles:v1'

function voiceCallHandleKey(callId: unknown, sessionId: unknown): string {
	const call = String(callId || '').trim()
	const session = String(sessionId || '').trim()
	return call && session ? `${call}:${session}` : ''
}

function loadTerminalVoiceCallHandles(): void {
	if (terminalVoiceCallHandles.size > 0 || typeof window === 'undefined') return
	try {
		const raw = window.localStorage.getItem(TERMINAL_VOICE_CALL_STORAGE_KEY)
		const values = raw ? JSON.parse(raw) : []
		if (Array.isArray(values)) {
			values
				.filter((value): value is string => typeof value === 'string' && value.includes(':'))
				.slice(-200)
				.forEach(value => terminalVoiceCallHandles.add(value))
		}
	} catch {
		/* local storage is best effort; in-memory suppression still applies */
	}
}

/** Persist a terminal state so replaying an old Chat line cannot ring again. */
export function markVoiceCallTerminal(callId: string, sessionId: string): void {
	const key = voiceCallHandleKey(callId, sessionId)
	if (!key) return
	loadTerminalVoiceCallHandles()
	terminalVoiceCallHandles.add(key)
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(
			TERMINAL_VOICE_CALL_STORAGE_KEY,
			JSON.stringify(Array.from(terminalVoiceCallHandles).slice(-200)),
		)
	} catch {
		/* local storage is best effort */
	}
}

export function isVoiceCallTerminal(signal: { callId?: unknown; sessionId?: unknown } | null | undefined): boolean {
	if (!signal) return false
	loadTerminalVoiceCallHandles()
	const key = voiceCallHandleKey(signal.callId, signal.sessionId)
	return Boolean(key && terminalVoiceCallHandles.has(key))
}

/** Keep the decrypted offer so a later native Decline can reject the caller. */
export function rememberIncomingVoiceOffer(signal: VoiceCallSignal | null | undefined): void {
	if (!signal || signal.type !== 'voice_call_offer_v1') return
	if (signal.callId) incomingVoiceOffersByHandle.set(signal.callId, signal)
	if (signal.sessionId) incomingVoiceOffersByHandle.set(signal.sessionId, signal)
}

export function lookupIncomingVoiceOffer(callId: string, sessionId: string): VoiceCallSignal | null {
	return incomingVoiceOffersByHandle.get(callId) || incomingVoiceOffersByHandle.get(sessionId) || null
}

export function forgetIncomingVoiceOffer(callId: string, sessionId: string): void {
	const signal = lookupIncomingVoiceOffer(callId, sessionId)
	if (!signal) return
	incomingVoiceOffersByHandle.delete(signal.callId)
	incomingVoiceOffersByHandle.delete(signal.sessionId)
}

const nativeIncomingVoiceRetryTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Caller hung up. Stop any pending native banner retry, then ask this app's
 * own shell to remove the CallStyle card. The shell is not exported, so an
 * outside Decline broadcast cannot do this.
 */
export function dismissNativeIncomingVoiceCall(callId: string, sessionId: string): void {
	const signal = lookupIncomingVoiceOffer(callId, sessionId)
	const nativeCallId = String(signal?.callId || callId || sessionId || '').trim()
	const nativeSessionId = String(signal?.sessionId || sessionId || callId || '').trim()
	const keys = new Set<string>()
	if (nativeCallId && nativeSessionId) keys.add(`${nativeCallId}:${nativeSessionId}`)
	if (callId.trim() && sessionId.trim()) keys.add(`${callId.trim()}:${sessionId.trim()}`)
	keys.forEach((key) => {
		const timer = nativeIncomingVoiceRetryTimers.get(key)
		if (timer !== undefined) clearTimeout(timer)
		nativeIncomingVoiceRetryTimers.delete(key)
	})
	forgetIncomingVoiceOffer(nativeCallId, nativeSessionId)
	if (!nativeCallId && !nativeSessionId) return
	dispatchNativeSystemCallAction('endSystemCall', {
		callId: nativeCallId || nativeSessionId,
		sessionId: nativeSessionId,
	})
}

/** Accept both browser millisecond timestamps and mailbox/FCM unix-second timestamps. */
export function normalizeVoiceTimestampMs(value: unknown): number {
	const numeric = Number(value)
	if (!Number.isFinite(numeric) || numeric <= 0) return 0
	return numeric < 100_000_000_000 ? numeric * 1000 : numeric
}

/** Accept both millisecond and Unix-second expiry values from mailbox/FCM paths. */
export function isVoiceCallOfferActive(signal: {
	expiresAt?: unknown
	callId?: unknown
	sessionId?: unknown
} | null | undefined): boolean {
	if (isVoiceCallTerminal(signal)) return false
	const expiresAtMs = normalizeVoiceTimestampMs(signal?.expiresAt)
	return expiresAtMs > Date.now()
}

/**
 * An offer that can still be ringing: active, and created within the ring
 * timeout. `expiresAt` covers the whole call duration, so an unanswered offer
 * older than the ring window (declined on another surface, missed) must not
 * be reported to the native shell again when a chat page re-reads history.
 */
export function isVoiceCallOfferRinging(signal: {
	expiresAt?: unknown
	createdAt?: unknown
	timestamp?: unknown
	callId?: unknown
	sessionId?: unknown
} | null | undefined): boolean {
	if (!isVoiceCallOfferActive(signal)) return false
	const createdMs = normalizeVoiceTimestampMs(signal?.createdAt) || normalizeVoiceTimestampMs(signal?.timestamp)
	if (!createdMs) return true
	return Date.now() - createdMs <= INCOMING_CALL_RING_TIMEOUT_MS + 15_000
}

export function claimIncomingVoiceCallReport(callId: string, sessionId: string): boolean {
	const key = `${callId.trim()}:${sessionId.trim()}`
	if (!callId.trim() || !sessionId.trim() || reportedIncomingVoiceCallIds.has(key)) return false
	reportedIncomingVoiceCallIds.add(key)
	return true
}

export function hasReportedIncomingVoiceCall(callId: string, sessionId: string): boolean {
	return reportedIncomingVoiceCallIds.has(`${callId.trim()}:${sessionId.trim()}`)
}

/** Last identity reported to the native shell per offer (`callId:sessionId`). */
const nativeIncomingReports = new Map<string, string>()

/**
 * Report an incoming offer to the native shell once. One offer reaches several
 * page paths (gossip line, chat ingest, chat page, tag lookup), and each used
 * to call `reportIncomingSystemCall`: Android then opened one Telecom call per
 * report and only one was ever disconnected, so the others stayed RINGING and
 * blocked the next dial. A repeat with the same identity is dropped; a real
 * update (address → @tag, identity warning) still goes through. Returns true
 * when the shell has this report (sent now or earlier).
 */
export function reportNativeIncomingSystemCall(payload: Record<string, unknown>): boolean {
	const callId = String(payload.callId || '').trim()
	const sessionId = String(payload.sessionId || '').trim()
	const key = `${callId}:${sessionId}`
	const displayName = String(payload.displayName || '')
	const peer = String(payload.peerAddress || '').toLowerCase()
	const signature = JSON.stringify([
		displayName,
		peer,
		payload.claimedTag || '',
		payload.claimedAddress || '',
		payload.identityWarning || '',
	])
	const previous = nativeIncomingReports.get(key)
	if (previous !== undefined) {
		const [prevName, prevPeer] = JSON.parse(previous) as [string, string]
		// Same identity, or a fallback title after the @tag was already shown.
		const downgrade = prevName.startsWith('@') && displayName === 'Beamio' && prevPeer === peer
		if (previous === signature || downgrade) {
			publishNativePwaLog('info', '[voice] native report repeat skipped')
			return true
		}
	}
	const delivered = dispatchNativeSystemCallAction('reportIncomingSystemCall', payload)
	if (delivered && callId && sessionId) {
		nativeIncomingReports.set(key, signature)
		if (nativeIncomingReports.size > 50) {
			const oldest = nativeIncomingReports.keys().next().value
			if (oldest !== undefined) nativeIncomingReports.delete(oldest)
		}
	}
	return delivered
}

/**
 * The shell answers or declines to the caller's mailbox: the payload carries
 * the caller's user-PGP and mailbox route keys from the signed v3 offer.
 */
export function nativeIncomingSystemCallPayload(args: {
	callId: string
	sessionId: string
	peerAddress: string
	displayName: string
	claimedTag?: string
	claimedAddress?: string
	identityWarning?: string
	signal?: Pick<VoiceCallSignal, 'to' | 'callerPgp' | 'callerRoute'> | null
}): Record<string, unknown> {
	const to = String(args.signal?.to || '').trim()
	return {
		callId: args.callId,
		sessionId: args.sessionId,
		peerAddress: args.peerAddress,
		displayName: args.displayName,
		claimedTag: args.claimedTag || '',
		claimedAddress: args.claimedAddress || '',
		identityWarning: args.identityWarning || '',
		...(to ? { to } : {}),
		proto: 3,
		callerPgp: String(args.signal?.callerPgp || ''),
		callerRoute: String(args.signal?.callerRoute || ''),
	}
}

/**
 * Update the native incoming-call UI as soon as a decrypted offer line exists.
 * This does not claim the in-app report, so the Chat ingest path can still
 * record the call and replace the address with a looked-up BeamioTag.
 */
/**
 * Calls whose end (hangup, decline, timeout) the page has seen on the inbound
 * line path in this page session. In memory only; markVoiceCallTerminal keeps
 * the durable copy once the batch is processed.
 */
const endedVoiceCallHandles = new Set<string>()

export function noteVoiceCallsEnded(handles: Iterable<string>): void {
	for (const handle of handles) {
		const id = String(handle || '').trim()
		if (id) endedVoiceCallHandles.add(id)
	}
	while (endedVoiceCallHandles.size > 400) {
		const oldest = endedVoiceCallHandles.values().next().value
		if (oldest === undefined) break
		endedVoiceCallHandles.delete(oldest)
	}
}

const voiceCallEndSeen = (signal: { callId?: unknown; sessionId?: unknown }): boolean =>
	endedVoiceCallHandles.has(String(signal.callId || '').trim())
	|| endedVoiceCallHandles.has(String(signal.sessionId || '').trim())

/**
 * An offer older than this is a replay (cold start hands over the native inbox,
 * a reconnect drains the mailbox), not a live ring. Its end can be a few lines
 * behind it, so its report waits briefly.
 */
const VOICE_OFFER_REPLAY_AGE_MS = 15_000
const VOICE_OFFER_REPLAY_HOLD_MS = 1_000
const replayedVoiceOfferTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function applyNativeIncomingVoiceOfferFromLine(raw: string): boolean {
	const signal = parseVoiceCallSignal(raw)
	if (!signal) {
		publishNativePwaLog(
			'info',
			`[voice] incoming line ignored chars=${raw.length} voiceOffer=${raw.includes('voice_call_offer_v1')}`,
		)
		return false
	}
	if (signal.type !== 'voice_call_offer_v1') {
		console.info(`[voice] incoming signal ignored: type=${signal.type}`)
		return false
	}
	if (typeof signal.callId !== 'string' || !signal.callId.trim() ||
		typeof signal.sessionId !== 'string' || !signal.sessionId.trim()) {
		console.warn(
			`[voice] incoming offer ignored: missing handle callId=${typeof signal.callId === 'string'} ` +
			`sessionId=${typeof signal.sessionId === 'string'}`,
		)
		return false
	}
	const expiresAtMs = normalizeVoiceTimestampMs(signal.expiresAt)
	if (expiresAtMs <= Date.now()) {
		console.warn(
			`[voice] incoming offer ignored: expired expiresAtPresent=${Boolean(signal.expiresAt)} ` +
			`normalizedMs=${expiresAtMs > 0}`,
		)
		return false
	}
	// Already ended (stored terminal mark, or its end was seen on the line path),
	// or older than the ring window: never ring the shell for it again.
	if (!isVoiceCallOfferRinging(signal) || voiceCallEndSeen(signal)) {
		publishNativePwaLog('info', '[voice] incoming offer not reported: call already ended or past the ring window')
		return false
	}
	const callKey = `${signal.callId.trim()}:${signal.sessionId.trim()}`
	const createdMs = normalizeVoiceTimestampMs(signal.createdAt) || normalizeVoiceTimestampMs(signal.timestamp)
	if (createdMs && Date.now() - createdMs > VOICE_OFFER_REPLAY_AGE_MS) {
		if (!replayedVoiceOfferTimers.has(callKey)) {
			replayedVoiceOfferTimers.set(callKey, setTimeout(() => {
				replayedVoiceOfferTimers.delete(callKey)
				if (!isVoiceCallOfferRinging(signal) || voiceCallEndSeen(signal)) {
					publishNativePwaLog('info', '[voice] replayed offer not reported: its end followed it')
					return
				}
				reportNativeIncomingVoiceOffer(signal)
			}, VOICE_OFFER_REPLAY_HOLD_MS))
		}
		return false
	}
	return reportNativeIncomingVoiceOffer(signal)
}

function reportNativeIncomingVoiceOffer(signal: VoiceCallSignal): boolean {
	const callerEoa = recoverVoiceCallOfferSigner(signal)
	const claimedTag = claimedVoiceCallerTag(signal)
	if (!callerEoa && !claimedTag) {
		console.warn('[voice] incoming offer ignored: no verified caller or claimed tag')
		return false
	}
	const mismatch = voiceCallClaimMismatchesKey(signal, callerEoa, '')
	const callKey = `${signal.callId.trim()}:${signal.sessionId.trim()}`
	// CallKit layout collapses when displayName is a short EOA capsule and a
	// later report swaps in @tag. Never send an address as CallKit title.
	const proven = callerEoa || ''
	const displayName = !mismatch && claimedTag ? claimedTag : 'Beamio'
	const payload = nativeIncomingSystemCallPayload({
		callId: signal.callId,
		sessionId: signal.sessionId,
		peerAddress: proven,
		displayName,
		claimedTag: mismatch ? claimedTag : '',
		claimedAddress: mismatch ? claimedVoiceCallerAddress(signal) : '',
		identityWarning: mismatch ? VOICE_CALL_IDENTITY_WARNING : '',
		signal,
	})
	console.info(
		`[voice] decrypted incoming offer callId=${Boolean(signal.callId)} ` +
			`sessionId=${Boolean(signal.sessionId)} verifiedPeer=${Boolean(proven)} ` +
			`displayName=${Boolean(displayName)}`,
	)
	const delivered = reportNativeIncomingSystemCall(payload)
	publishNativePwaLog(
		'info',
		`[voice] native report dispatch=${delivered ? 'accepted' : 'unavailable'} ` +
			`verifiedPeer=${Boolean(proven)} tagClaim=${Boolean(claimedTag)}`,
	)
	if (delivered) {
		const timer = nativeIncomingVoiceRetryTimers.get(callKey)
		if (timer !== undefined) clearTimeout(timer)
		nativeIncomingVoiceRetryTimers.delete(callKey)
	} else if (!nativeIncomingVoiceRetryTimers.has(callKey)) {
		// The PWA can decrypt the offer while the WebView bridge is being
		// recreated after an Android cold start. Retry a few times without
		// using an interval; the native side stores the payload in its pool.
		let attempt = 0
		const retry = () => {
			attempt += 1
			const ok = reportNativeIncomingSystemCall(payload)
			if (ok || attempt >= 8) {
				nativeIncomingVoiceRetryTimers.delete(callKey)
				return
			}
			const next = setTimeout(retry, Math.min(1500, 150 + attempt * 150))
			nativeIncomingVoiceRetryTimers.set(callKey, next)
		}
		const timer = setTimeout(retry, 150)
		nativeIncomingVoiceRetryTimers.set(callKey, timer)
	}
	// Glass Incoming title must be the wallet's @beamioTag. When the first
	// report only has the EOA, look up and re-report so native can refresh.
	if (proven && (!displayName || displayName === 'Beamio')) {
		void enrichNativeIncomingDisplayTag({
			callId: signal.callId,
			sessionId: signal.sessionId,
			peerAddress: proven,
			signal,
		})
	}
	console.info(
		delivered
			? `[voice] incoming offer delivered to native shell (${displayName || 'address'})`
			: `[voice] incoming offer queued for native bridge (${displayName || 'address'})`,
	)
	return delivered
}

async function enrichNativeIncomingDisplayTag(args: {
	callId: string
	sessionId: string
	peerAddress: string
	signal: VoiceCallSignal
}): Promise<void> {
	const peer = args.peerAddress.toLowerCase()
	try {
		await ensureBeamioTagProfiles([peer], { maxPerTick: 4 })
		const local = await lookupBeamioTagProfile(peer)
		let username = local?.accountName || local?.username || ''
		if (!username) {
			const res = await searchBeamioTagRemote(peer)
			const results = res?.results
			const rows = Array.isArray(results) ? results : []
			const hit = rows.find((row: { address?: string }) =>
				String(row.address || '').toLowerCase() === peer,
			) as { username?: string; accountName?: string } | undefined
			username = hit?.username || hit?.accountName || ''
		}
		const tag = formatLookedUpBeamioTag(username)
		if (!tag) return
		const nextMismatch = voiceCallClaimMismatchesKey(args.signal, peer, tag, true)
		reportNativeIncomingSystemCall(
			nativeIncomingSystemCallPayload({
				callId: args.callId,
				sessionId: args.sessionId,
				peerAddress: peer,
				displayName: tag,
				claimedTag: nextMismatch ? claimedVoiceCallerTag(args.signal) : '',
				claimedAddress: nextMismatch ? claimedVoiceCallerAddress(args.signal) : '',
				identityWarning: nextMismatch ? VOICE_CALL_IDENTITY_WARNING : '',
				signal: args.signal,
			}),
		)
		publishNativePwaLog('info', `[voice] native report tag upgrade tag=${tag}`)
	} catch {
		// Keep last native UI; native shell may still enrich via search-users.
	}
}

export const VOICE_MAX_FRAME_B64 = 12_000
export const VOICE_FRAME_TIMESTAMP_SKEW_SEC = 30
export const VOICE_CALL_MAX_DURATION_MS = 15 * 60 * 1000

export const randomVoiceId = (prefix: string): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return `${prefix}-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`
}

/** Mailbox `voice_listen` only accepts `[0-9a-fA-F-]{16,64}`. A `voice-` prefix is dropped and the ring push never fires. */
export const randomMailboxVoiceSessionId = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export const createVoiceSessionKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32))

/** Chunked — avoid `String.fromCharCode(...largeUint8Array)` stack overflows in WebView. */
const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
	const raw = atob(value)
	const out = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
	return out
}

export const voiceSessionKeyToBase64 = (key: Uint8Array): string => bytesToBase64(key)

export const voiceSessionKeyFromBase64 = (value: string): Uint8Array => {
	const key = base64ToBytes(value)
	if (key.length !== 32) throw new Error('voice_session_key_invalid')
	return key
}

const PHONE_CALL_STATUS_RANK: Record<PhoneCallRecord['status'], number> = {
	ringing: 0,
	answered: 2,
	cancelled: 3,
	declined: 3,
	failed: 3,
	missed: 3,
	timed_out: 3,
	ended: 3,
	// No ringing receipt after five rings. The cancel and the shell's call end
	// that follow are read as "cancelled" and must not hide it.
	unreachable: 4,
}

const PHONE_CALL_TERMINAL_STATUSES: ReadonlySet<PhoneCallRecord['status']> = new Set([
	'cancelled',
	'declined',
	'failed',
	'missed',
	'timed_out',
	'ended',
	'unreachable',
])

export const isPhoneCallTerminalStatus = (status: PhoneCallRecord['status'] | undefined): boolean =>
	Boolean(status && PHONE_CALL_TERMINAL_STATUSES.has(status))

/** Outcomes that mean "never connected". A call that was answered cannot end in one of them. */
const PHONE_CALL_UNANSWERED_STATUSES: ReadonlySet<PhoneCallRecord['status']> = new Set([
	'cancelled',
	'declined',
	'missed',
	'timed_out',
	'unreachable',
])

/**
 * Calls the native shell answered (CallKit / Telecom), by callId and sessionId.
 * The shell can answer before the PWA has the offer (FCM / VoIP wake), so the
 * page never runs its own accept and the record stays "ringing". Kept in memory
 * for the life of the page.
 */
const nativeAnsweredAt = new Map<string, number>()

export const noteNativeCallAnswered = (callId: string, sessionId: string, at = Date.now()): void => {
	for (const id of [nonBlank(callId), nonBlank(sessionId)]) {
		if (id && !nativeAnsweredAt.has(id)) nativeAnsweredAt.set(id, at)
	}
	while (nativeAnsweredAt.size > 100) {
		const oldest = nativeAnsweredAt.keys().next().value
		if (oldest === undefined) break
		nativeAnsweredAt.delete(oldest)
	}
	publishNativePwaLog('info', `[voice] call record answered by shell callId=${Boolean(nonBlank(callId))} sessionId=${Boolean(nonBlank(sessionId))}`)
}

const nativeAnsweredAtFor = (record: { callId?: string; sessionId?: string } | null | undefined): number =>
	nativeAnsweredAt.get(nonBlank(record?.callId)) || nativeAnsweredAt.get(nonBlank(record?.sessionId)) || 0

export const phoneCallWasAnswered = (record: PhoneCallRecord | null | undefined): boolean =>
	Boolean(record && (record.status === 'answered' || Number(record.answeredAt || 0) > 0 || nativeAnsweredAtFor(record) > 0))

/**
 * Status for a `voice_end_v1` from the peer: the peer hung up a connected call
 * ("ended"), or the caller gave up before anyone answered ("cancelled").
 */
export const phoneCallStatusForPeerHangup = (
	existing: PhoneCallRecord | null | undefined,
): PhoneCallRecord['status'] =>
	phoneCallWasAnswered(existing) || existing?.status === 'ended' ? 'ended' : 'cancelled'

/**
 * Keep the further-along status when two snapshots of the same call arrive out
 * of order. A later `ringing` history row must not paint the bubble back to
 * "Calling…" after the ring already timed out. Equal ranks prefer the newer
 * (incoming) snapshot so decline after a bogus callEnded still shows declined.
 */
/** Chat stores some call timestamps in seconds. Compare them as milliseconds. */
export const phoneCallStampMs = (raw: unknown): number => {
	const n = Number(raw || 0)
	if (!Number.isFinite(n) || n <= 0) return 0
	return n < 1e12 ? n * 1000 : n
}

const nonBlank = (value: unknown): string => {
	const s = String(value || '').trim()
	return s
}

/** Match two call snapshots when either non-blank id overlaps. */
export const phoneCallIdsOverlap = (
	a: { callId?: string; sessionId?: string } | null | undefined,
	b: { callId?: string; sessionId?: string } | null | undefined,
): boolean => {
	const aCall = nonBlank(a?.callId)
	const aSession = nonBlank(a?.sessionId)
	const bCall = nonBlank(b?.callId)
	const bSession = nonBlank(b?.sessionId)
	if (aCall && bCall && aCall === bCall) return true
	if (aSession && bSession && aSession === bSession) return true
	return false
}

export const findPhoneCallByIds = (
	rows: readonly PhoneCallRecord[] | null | undefined,
	ids: { callId?: string; sessionId?: string },
): PhoneCallRecord | undefined => {
	const callId = nonBlank(ids.callId)
	const sessionId = nonBlank(ids.sessionId)
	if (!callId && !sessionId) return undefined
	const matches = (rows || []).filter(item =>
		(callId && nonBlank(item.callId) === callId) ||
		(sessionId && nonBlank(item.sessionId) === sessionId))
	if (!matches.length) return undefined
	// Prefer terminal / further-along status when a buggy filter left ringing+declined duplicates.
	return matches.slice().sort((a, b) =>
		(PHONE_CALL_STATUS_RANK[b.status] ?? 0) - (PHONE_CALL_STATUS_RANK[a.status] ?? 0)
		|| Number(b.endedAt || 0) - Number(a.endedAt || 0)
		|| Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
}

/**
 * Replace any prior row that shares a non-blank callId or sessionId.
 * Never use `!== a && !== b` — that drops the wrong row when callId ≠ sessionId.
 */
export const replacePhoneCallInRows = (
	rows: readonly PhoneCallRecord[],
	merged: PhoneCallRecord,
): PhoneCallRecord[] => [
	...rows.filter(item => !phoneCallIdsOverlap(item, merged)),
	merged,
]

export const mergePhoneCallRecord = (
	current: PhoneCallRecord | null | undefined,
	incoming: PhoneCallRecord | null | undefined,
): PhoneCallRecord | null => {
	if (!incoming?.callId && !incoming?.sessionId) return current ?? null
	if (!current) return incoming ?? null
	const sameCall = phoneCallIdsOverlap(current, incoming)
	if (!sameCall) return incoming
	const keepCurrent = (PHONE_CALL_STATUS_RANK[current.status] ?? 0) > (PHONE_CALL_STATUS_RANK[incoming.status] ?? 0)
	let status = keepCurrent ? current.status : incoming.status
	const answered = phoneCallWasAnswered(current) || phoneCallWasAnswered(incoming)
	// Once either side saw the call answered, a later "unanswered" outcome (the
	// peer's hangup read as cancel, a stale ring timeout) means the call ended.
	if (answered && PHONE_CALL_UNANSWERED_STATUSES.has(status)) status = 'ended'
	if (answered && status === 'ringing') status = 'answered'
	const answeredAt = current.answeredAt ?? incoming.answeredAt
		?? (nativeAnsweredAtFor(current) || nativeAnsweredAtFor(incoming) || undefined)
	const endedAt = status === 'ringing'
		? undefined
		: (keepCurrent ? current.endedAt ?? incoming.endedAt : incoming.endedAt ?? current.endedAt)
	const knownDuration = keepCurrent ? current.durationMs ?? incoming.durationMs : incoming.durationMs ?? current.durationMs
	const durationMs = knownDuration ?? (status === 'ended' && answeredAt && endedAt
		? Math.max(0, phoneCallStampMs(endedAt) - phoneCallStampMs(answeredAt)) || undefined
		: undefined)
	return {
		...current,
		...incoming,
		// Never blank-overwrite stable IDs — empty bridge fields orphan history rows.
		callId: nonBlank(incoming.callId) || nonBlank(current.callId),
		sessionId: nonBlank(incoming.sessionId) || nonBlank(current.sessionId),
		status,
		direction: current.direction || incoming.direction,
		peerAddress: nonBlank(current.peerAddress) || nonBlank(incoming.peerAddress),
		createdAt: current.createdAt || incoming.createdAt,
		answeredAt,
		endedAt,
		durationMs,
	}
}

/**
 * Incoming calls the native shell closed before anyone answered them, by callId
 * and sessionId. The shell's own callEnded can reach the page before the page
 * has the call's row (cold start: it arrives first, then the native inbox
 * replays the offer), or not at all (it ended in a process that was killed).
 * The page applies these outcomes whenever it stores call rows, so a replayed
 * offer cannot leave the row "Incoming call". In memory for the page's life.
 */
const settledIncomingOutcomes = new Map<string, { status: PhoneCallRecord['status']; endedAt: number }>()

/** Record status for a shell action that ends an unanswered incoming call. */
export const incomingSettledStatusForAction = (action: unknown): PhoneCallRecord['status'] | null => {
	switch (String(action || '').trim()) {
		case 'callEnded':
			return 'cancelled'
		case 'callTimedOut':
			return 'timed_out'
		case 'callRejected':
			return 'declined'
		default:
			return null
	}
}

export const noteIncomingCallSettled = (
	callId: string,
	sessionId: string,
	status: PhoneCallRecord['status'],
	endedAt = Date.now(),
): void => {
	if (!PHONE_CALL_UNANSWERED_STATUSES.has(status)) return
	for (const id of [nonBlank(callId), nonBlank(sessionId)]) {
		if (id && !settledIncomingOutcomes.has(id)) settledIncomingOutcomes.set(id, { status, endedAt })
	}
	while (settledIncomingOutcomes.size > 400) {
		const oldest = settledIncomingOutcomes.keys().next().value
		if (oldest === undefined) break
		settledIncomingOutcomes.delete(oldest)
	}
}

/** The row with its shell outcome applied, or the same row when there is none to apply. */
export const withSettledIncomingOutcome = (record: PhoneCallRecord): PhoneCallRecord => {
	if (record.direction !== 'incoming') return record
	const outcome = settledIncomingOutcomes.get(nonBlank(record.callId))
		|| settledIncomingOutcomes.get(nonBlank(record.sessionId))
	if (!outcome) return record
	const applies = record.status === 'ringing'
	if (!applies) return record
	return mergePhoneCallRecord(record, { ...record, status: outcome.status, endedAt: outcome.endedAt }) || record
}

/** Rows with every known shell outcome applied; null when nothing changed. */
export const closeSettledIncomingCalls = (
	rows: readonly PhoneCallRecord[] | null | undefined,
): PhoneCallRecord[] | null => {
	if (!rows?.length || !settledIncomingOutcomes.size) return null
	let changed = false
	const next = rows.map((row) => {
		const closed = withSettledIncomingOutcome(row)
		if (closed !== row) changed = true
		return closed
	})
	return changed ? next : null
}

export const makeVoiceCallSignal = (
	signal: Omit<VoiceCallSignal, 'createdAt' | 'expiresAt' | 'timestamp'> & { expiresAt?: number },
): VoiceCallSignal => ({
	...signal,
	createdAt: Date.now(),
	expiresAt: signal.expiresAt ?? Date.now() + VOICE_CALL_MAX_DURATION_MS,
	timestamp: Date.now(),
})

export const encryptVoiceFrame = async (key: Uint8Array, plain: Uint8Array): Promise<string> => {
	if (!(key instanceof Uint8Array) || key.length !== 32) throw new Error('voice_session_key_invalid')
	const nonce = crypto.getRandomValues(new Uint8Array(12))
	const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
	const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, plain)
	const packed = new Uint8Array(nonce.length + cipher.byteLength)
	packed.set(nonce)
	packed.set(new Uint8Array(cipher), nonce.length)
	return bytesToBase64(packed)
}

export const decryptVoiceFrame = async (key: Uint8Array, payload: string): Promise<Uint8Array> => {
	if (!(key instanceof Uint8Array) || key.length !== 32) throw new Error('voice_session_key_invalid')
	const packed = base64ToBytes(payload)
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
