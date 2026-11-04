/**
 * Android shells used to need the WebView microphone opened while a call
 * still rang (answering flips MODE_IN_COMMUNICATION and WebView getUserMedia
 * then fails). Shells with the native voice channel record calls with their
 * own AudioRecord and answer / decline / end natively, so a prewarmed stream
 * was never taken or stopped and held the microphone after the call
 * (Samsung, 2026-11-03: the camera could not record).
 */

/** Longest a prewarmed stream may live: the ring window plus slack. */
export function androidMicPrewarmMaxMs(ringTimeoutMs: number): number {
	return Math.max(0, ringTimeoutMs) + 15_000
}

export function shouldPrewarmAndroidMic(input: {
	host: 'android' | 'ios' | null
	/** The shell has the native voice channel (it owns call audio). */
	shellOwnsCallAudio: boolean
	sessionId: string
	hasGetUserMedia: boolean
}): boolean {
	if (input.host !== 'android') return false
	if (input.shellOwnsCallAudio) return false
	return Boolean(input.sessionId) && input.hasGetUserMedia
}

/** Release a prewarmed stream that nothing is about to use. */
export function shouldReleaseAndroidMicPrewarm(input: {
	pageHidden: boolean
	hasIncomingOffer: boolean
	callIdle: boolean
}): boolean {
	return input.pageHidden && !input.hasIncomingOffer && input.callIdle
}
