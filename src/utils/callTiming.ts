/**
 * Outgoing call timing trail. One `[CallTiming]` console line per stage, with
 * the wall-clock time and the milliseconds since the dial tap. The native
 * shells log the same tag, so a device log lines up PWA and native stages.
 * Never logs keys, routes, addresses or message content.
 */

import { publishNativePwaLog } from './cashTreesNativePwaLog'

let tapAt = 0
let dialId = ''
/** The tap line waits for the next mark, so nothing is logged before prepareSystemCall. */
let pendingTapLine = ''

/** Start a new trail. `eventTimeStamp` is the click event's `timeStamp`. */
export function beginCallTiming(eventTimeStamp?: number): { dialId: string; tapAt: number } {
	const now = Date.now()
	let tap = now
	if (typeof eventTimeStamp === 'number' && eventTimeStamp > 0 && typeof performance !== 'undefined') {
		const origin = performance.timeOrigin || now - performance.now()
		const fromEvent = Math.round(origin + eventTimeStamp)
		// Ignore clocks that disagree by more than a minute (old engines).
		if (Math.abs(now - fromEvent) < 60_000) tap = Math.min(now, fromEvent)
	}
	tapAt = tap
	dialId = `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`
	pendingTapLine = `[CallTiming] ${dialId} tap t=${tap} handler=+${now - tap}`
	return { dialId, tapAt: tap }
}

export function markCallTiming(stage: string, extra = ''): void {
	if (!dialId) return
	const now = Date.now()
	if (pendingTapLine) {
		emit(pendingTapLine, true)
		pendingTapLine = ''
	}
	emit(`[CallTiming] ${dialId} ${stage} t=${now} +${now - tapAt}${extra ? ` ${extra}` : ''}`)
}

/**
 * Production builds strip `console`, so lines go through the native log
 * bridge inside the shells. In a browser the last trail is kept on
 * `window.__beamioCallTiming` for inspection.
 */
function emit(line: string, reset = false): void {
	publishNativePwaLog('info', line)
	try {
		const w = window as unknown as { __beamioCallTiming?: string[] }
		if (reset || !w.__beamioCallTiming) w.__beamioCallTiming = []
		w.__beamioCallTiming.push(line)
	} catch {
		// no window (worker)
	}
}

/** Time one async step: logs `<stage>` with its own duration. */
export async function timeCallStep<T>(stage: string, run: () => Promise<T>): Promise<T> {
	const start = Date.now()
	try {
		return await run()
	} finally {
		markCallTiming(stage, `took=${Date.now() - start}`)
	}
}
