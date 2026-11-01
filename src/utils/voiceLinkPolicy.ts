/**
 * In-call media link policy, shared by the browser call window. The iOS and
 * Android shells implement the same rule with the same constants
 * (BeamioNativeVoiceChannel.swift / .kt).
 *
 * - Media running and the media SSE closed, or no peer frame for
 *   `rxStaleMs` (after `startGraceMs`): reopen voice_listen for the same session,
 *   backoff 1/2/4/8 s, at least `minRejudgeMs` between attempts; from the second
 *   attempt send voice_unlisten first.
 * - No peer frame AND no accepted uplink for `lostMs`: the connection is lost.
 *   Uplink success counts so a muted peer (no frames) is not treated as gone.
 */
export const VOICE_LINK = {
	rxStaleMs: 8_000,
	startGraceMs: 12_000,
	lostMs: 25_000,
	minRejudgeMs: 4_000,
	maxBackoffMs: 8_000,
} as const

export type VoiceLinkState = {
	mediaStartedAt: number
	lastRxAt: number
	lastTxOkAt: number
	reconnecting: boolean
	attempt: number
	nextAt: number
	inFlight: boolean
	lost: boolean
}

export type VoiceLinkDecision =
	| { kind: 'none' }
	| { kind: 'lost' }
	| { kind: 'wait'; startedReconnecting: boolean }
	| { kind: 'reconnect'; attempt: number; unlistenFirst: boolean; startedReconnecting: boolean }

export function newVoiceLinkState(now: number): VoiceLinkState {
	return {
		mediaStartedAt: now,
		lastRxAt: now,
		lastTxOkAt: now,
		reconnecting: false,
		attempt: 0,
		nextAt: 0,
		inFlight: false,
		lost: false,
	}
}

export function voiceLinkBackoffMs(attempt: number): number {
	return Math.min(VOICE_LINK.maxBackoffMs, 1_000 * 2 ** Math.max(0, attempt - 1))
}

/**
 * One watchdog tick. Mutates `s` (reconnecting / attempt / nextAt / lost) and
 * says what to do. `listenOpen` is false when the SSE is known to be closed;
 * pass true when the caller cannot observe the socket (browser worker).
 */
export function tickVoiceLink(s: VoiceLinkState, now: number, listenOpen = true): VoiceLinkDecision {
	if (s.lost) return { kind: 'none' }
	const rxIdle = now - s.lastRxAt
	const txIdle = now - s.lastTxOkAt
	if (rxIdle >= VOICE_LINK.lostMs && txIdle >= VOICE_LINK.lostMs) {
		s.lost = true
		s.reconnecting = false
		return { kind: 'lost' }
	}
	const silent = now - s.mediaStartedAt >= VOICE_LINK.startGraceMs && rxIdle >= VOICE_LINK.rxStaleMs
	if (listenOpen && !silent) return { kind: 'none' }
	let startedReconnecting = false
	if (!s.reconnecting) {
		s.reconnecting = true
		s.attempt = 0
		s.nextAt = now
		startedReconnecting = true
	}
	if (s.inFlight || now < s.nextAt) return { kind: 'wait', startedReconnecting }
	s.attempt += 1
	s.nextAt = now + Math.max(voiceLinkBackoffMs(s.attempt), VOICE_LINK.minRejudgeMs)
	return { kind: 'reconnect', attempt: s.attempt, unlistenFirst: s.attempt > 1, startedReconnecting }
}

/** A peer frame arrived. Returns true when this ended a reconnecting phase. */
export function noteVoiceLinkRx(s: VoiceLinkState, now: number): boolean {
	s.lastRxAt = now
	if (!s.reconnecting) return false
	s.reconnecting = false
	s.attempt = 0
	return true
}
