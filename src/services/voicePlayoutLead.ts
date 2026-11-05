/**
 * How far ahead the page keeps call audio queued before it plays.
 *
 * Frames reach us through a different random entry each and leave the SDK
 * reorder buffer in bursts (it holds later frames while it waits for a missing
 * one, adaptively 0.4–1 s). A fixed 50 ms lead ran dry after every burst and
 * restarted with a gap. Like the native shells' playout buffer, the lead grows
 * when the player runs dry and shrinks slowly while it does not.
 */
export type VoicePlayoutLeadOptions = {
	minSec?: number
	maxSec?: number
	stepUpSec?: number
	stepDownSec?: number
	decayIntervalMs?: number
}

export class VoicePlayoutLead {
	private readonly minSec: number
	private readonly maxSec: number
	private readonly stepUpSec: number
	private readonly stepDownSec: number
	private readonly decayIntervalMs: number
	private current: number
	private lastGrowAt = Number.NEGATIVE_INFINITY
	private lastDecayAt = Number.NEGATIVE_INFINITY
	underruns = 0

	constructor(options: VoicePlayoutLeadOptions = {}) {
		this.minSec = options.minSec ?? 0.12
		this.maxSec = Math.max(this.minSec, options.maxSec ?? 0.6)
		this.stepUpSec = options.stepUpSec ?? 0.08
		this.stepDownSec = options.stepDownSec ?? 0.02
		this.decayIntervalMs = options.decayIntervalMs ?? 10_000
		this.current = this.minSec
	}

	/** Seconds of audio to queue before (re)starting playback. */
	get sec(): number {
		return this.current
	}

	/** The player ran dry while the call was live: start deeper next time. */
	noteUnderrun(nowMs: number): void {
		this.underruns += 1
		this.current = Math.min(this.maxSec, this.current + this.stepUpSec)
		this.lastGrowAt = nowMs
		this.lastDecayAt = nowMs
	}

	/** Take a step back after a quiet interval without running dry. */
	maybeDecay(nowMs: number): void {
		if (this.current <= this.minSec) return
		if (nowMs - this.lastGrowAt < this.decayIntervalMs || nowMs - this.lastDecayAt < this.decayIntervalMs) return
		this.lastDecayAt = nowMs
		this.current = Math.max(this.minSec, this.current - this.stepDownSec)
	}

	reset(): void {
		this.current = this.minSec
		this.lastGrowAt = Number.NEGATIVE_INFINITY
		this.lastDecayAt = Number.NEGATIVE_INFINITY
		this.underruns = 0
	}
}
