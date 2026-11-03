/**
 * Native dialer answer (iOS shell with `CashTreesIOS.dialerAck`).
 *
 * After `startSystemCall` the shell answers `callDialerStarted` once its native
 * dialer runs, or `callDialerFailed` when it cannot. The offer is already in
 * the callee's mailbox, so with no native dialer the callee would ring for the
 * whole minute: the page then cancels the offer itself.
 *
 * A hidden page is suspended and cannot judge the wait (the shell's answer is
 * queued until it resumes), so the wait only counts while the page is visible.
 */

/** How long the page waits for the shell's answer while visible. */
export const NATIVE_DIALER_ACK_MS = 8_000

/** While hidden, look again this often. */
const HIDDEN_RECHECK_MS = 1_000

export function nativeDialerAckOverdue(input: {
	/** When the page sent `startSystemCall` (ms). */
	dispatchedAt: number
	/** When the page last became visible (ms; 0 = never hidden). */
	visibleSince: number
	now: number
	hidden: boolean
	ackMs?: number
}): { overdue: boolean; waitMs: number } {
	const ackMs = input.ackMs ?? NATIVE_DIALER_ACK_MS
	if (input.hidden) return { overdue: false, waitMs: HIDDEN_RECHECK_MS }
	const since = Math.max(input.dispatchedAt, input.visibleSince)
	const left = since + ackMs - input.now
	if (left <= 0) return { overdue: true, waitMs: 0 }
	return { overdue: false, waitMs: Math.min(left, ackMs) }
}
