import { NATIVE_DIALER_ACK_MS, nativeDialerAckOverdue } from './nativeDialerAck'

describe('nativeDialerAckOverdue', () => {
	const t0 = 1_000_000

	it('waits the full window after the dispatch', () => {
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: 0, now: t0, hidden: false }))
			.toEqual({ overdue: false, waitMs: NATIVE_DIALER_ACK_MS })
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: 0, now: t0 + 3_000, hidden: false }))
			.toEqual({ overdue: false, waitMs: NATIVE_DIALER_ACK_MS - 3_000 })
	})

	it('is overdue once the window passed while visible', () => {
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: 0, now: t0 + NATIVE_DIALER_ACK_MS, hidden: false }).overdue)
			.toBe(true)
	})

	it('never decides while hidden', () => {
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: 0, now: t0 + 60_000, hidden: true }))
			.toEqual({ overdue: false, waitMs: 1_000 })
	})

	it('restarts the window when the page comes back', () => {
		// Locked right after the dispatch, unlocked 30 s later: the queued answer gets a full window.
		const back = t0 + 30_000
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: back, now: back + 1_000, hidden: false }))
			.toEqual({ overdue: false, waitMs: NATIVE_DIALER_ACK_MS - 1_000 })
		expect(nativeDialerAckOverdue({ dispatchedAt: t0, visibleSince: back, now: back + NATIVE_DIALER_ACK_MS, hidden: false }).overdue)
			.toBe(true)
	})
})
