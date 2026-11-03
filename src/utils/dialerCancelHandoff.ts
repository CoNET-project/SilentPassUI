/**
 * The dialer cancel is native in both shells.
 *
 * While an outgoing call rings, the shell builds the caller-cancel Chat
 * message itself (`voice_end_v1`, signed with the wallet key the chat SDK
 * keeps, encrypted to the callee) and holds it in memory. A hang-up before the
 * callee answers posts it from the CallKit / Telecom end through the SDK's warm
 * entry pool. The shell tells the page `dialerCancelPosting` (before `callEnded`),
 * then `dialerCancelSent` or `dialerCancelFailed`.
 *
 * The page only records the result. It sends its own cancel only when no shell
 * took it (older shells, browser), so the callee never gets two.
 */

type Outcome = 'posting' | 'sent' | 'failed'

const outcomes = new Map<string, Outcome>()
let installed = false

const install = () => {
	if (installed || typeof window === 'undefined') return
	installed = true
	const onShellEvent = (event: Event) => {
		const detail = (event as CustomEvent).detail as { action?: string; callId?: string } | null
		const callId = String(detail?.callId || '').trim()
		if (!callId) return
		if (detail?.action === 'dialerCancelPosting') outcomes.set(callId, 'posting')
		else if (detail?.action === 'dialerCancelSent') outcomes.set(callId, 'sent')
		else if (detail?.action === 'dialerCancelFailed') outcomes.set(callId, 'failed')
		else return
		// Keep the map small: only the last few calls matter.
		if (outcomes.size > 20) {
			const first = outcomes.keys().next().value
			if (first) outcomes.delete(first)
		}
	}
	window.addEventListener('cashtreesios', onShellEvent)
	window.addEventListener('cashtreesandroid', onShellEvent)
}

install()

/** The shell's cancel state for this call, or `'none'` when no shell took it. */
export function nativeDialerCancelOutcome(callId: string): Outcome | 'none' {
	return outcomes.get(String(callId || '').trim()) ?? 'none'
}
