import {
	androidMicPrewarmMaxMs,
	shouldPrewarmAndroidMic,
	shouldReleaseAndroidMicPrewarm,
} from './androidMicPrewarm'

describe('shouldPrewarmAndroidMic', () => {
	const base = { host: 'android' as const, shellOwnsCallAudio: false, sessionId: 's1', hasGetUserMedia: true }

	it('older Android shells (page owns call audio) still prewarm while ringing', () => {
		expect(shouldPrewarmAndroidMic(base)).toBe(true)
	})

	it('a shell with the native voice channel never prewarms', () => {
		expect(shouldPrewarmAndroidMic({ ...base, shellOwnsCallAudio: true })).toBe(false)
	})

	it('only Android, only with a ringing session and getUserMedia', () => {
		expect(shouldPrewarmAndroidMic({ ...base, host: 'ios' })).toBe(false)
		expect(shouldPrewarmAndroidMic({ ...base, host: null })).toBe(false)
		expect(shouldPrewarmAndroidMic({ ...base, sessionId: '' })).toBe(false)
		expect(shouldPrewarmAndroidMic({ ...base, hasGetUserMedia: false })).toBe(false)
	})
})

describe('shouldReleaseAndroidMicPrewarm', () => {
	it('hidden page with no ringing offer and no call releases it', () => {
		expect(shouldReleaseAndroidMicPrewarm({ pageHidden: true, hasIncomingOffer: false, callIdle: true })).toBe(true)
	})

	it('keeps it while a call rings or is in progress, or while the page is visible', () => {
		// Ringing in the background is when the prewarm is needed.
		expect(shouldReleaseAndroidMicPrewarm({ pageHidden: true, hasIncomingOffer: true, callIdle: true })).toBe(false)
		expect(shouldReleaseAndroidMicPrewarm({ pageHidden: true, hasIncomingOffer: false, callIdle: false })).toBe(false)
		expect(shouldReleaseAndroidMicPrewarm({ pageHidden: false, hasIncomingOffer: false, callIdle: true })).toBe(false)
	})
})

describe('androidMicPrewarmMaxMs', () => {
	it('outlives the ring window, but not by much', () => {
		const ring = 60_000
		expect(androidMicPrewarmMaxMs(ring)).toBeGreaterThan(ring)
		expect(androidMicPrewarmMaxMs(ring)).toBeLessThanOrEqual(ring + 30_000)
	})
})
