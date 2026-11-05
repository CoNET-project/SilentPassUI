/**
 * Entries for one call's media frames (same rules as the iOS / Android shells'
 * `BeamioEntryLatencyBand`).
 *
 * Every frame still goes through a random entry, but only among a few entries
 * picked at random for this call whose post times are close to the fastest.
 * Mixing a 300 ms entry with a 700 ms one put a third of the frames out of
 * order at the peer (2026-11-05: post time spread ~150 ms with random entries,
 * ~20 ms within a band). A new call picks a new set.
 *
 * Privacy: the candidate set is narrowed per call to the measured fast entries
 * (random candidates, at most 12 tried per call, frames on entries within 50 ms
 * of the fastest); the entry still changes frame to frame (never twice in a
 * row) and the set is thrown away when the call ends.
 */

/** Post-time samples an entry needs before it is judged. */
export const ENTRY_BAND_MIN_SAMPLES = 3
/**
 * Kept: average ≤ fastest × ratio + slack. Narrower than one 80 ms frame, so
 * frames on different band entries rarely overtake each other.
 */
export const ENTRY_BAND_RATIO = 1.0
export const ENTRY_BAND_SLACK_MS = 50
/** Never fewer than this many entries in the band. */
export const ENTRY_BAND_MIN_KEEP = 2
/** Look for more candidates until this many are close to the fastest. */
export const ENTRY_BAND_WANT = 3
/** One pick in this many measures a not-yet-measured candidate. */
export const ENTRY_BAND_PROBE_EVERY = 8
/** Entries tried at the start of a call (and refilled to). */
export const ENTRY_POOL_TARGET = 6
/** Candidates tried per call at most while looking for close entries. */
export const ENTRY_POOL_MAX_TRIED = 12
const ENTRY_POOL_MIN = 3
const EWMA_KEEP = 0.7

/**
 * Entries allowed to carry the next frame. `pickIndex` counts picks in this call.
 * Warm-up (first target × min-samples picks, or fewer than two measured): all.
 */
export function entryLatencyBand(
	entries: string[],
	ewma: ReadonlyMap<string, number>,
	samples: ReadonlyMap<string, number>,
	pickIndex: number,
	poolTarget = ENTRY_POOL_TARGET,
): string[] {
	if (entries.length <= ENTRY_BAND_MIN_KEEP) return entries
	const measured = entries.filter((e) => (samples.get(e) ?? 0) >= ENTRY_BAND_MIN_SAMPLES)
	if (pickIndex < poolTarget * ENTRY_BAND_MIN_SAMPLES || measured.length < ENTRY_BAND_MIN_KEEP) return entries
	const sorted = measured.slice().sort((a, b) => (ewma.get(a) ?? Infinity) - (ewma.get(b) ?? Infinity))
	const limit = (ewma.get(sorted[0]) ?? 0) * ENTRY_BAND_RATIO + ENTRY_BAND_SLACK_MS
	let keep = sorted.filter((e) => (ewma.get(e) ?? Infinity) <= limit)
	if (keep.length < ENTRY_BAND_MIN_KEEP) keep = sorted.slice(0, ENTRY_BAND_MIN_KEEP)
	const unmeasured = entries.filter((e) => (samples.get(e) ?? 0) < ENTRY_BAND_MIN_SAMPLES)
	if (unmeasured.length && pickIndex % ENTRY_BAND_PROBE_EVERY === ENTRY_BAND_PROBE_EVERY - 1) {
		return [unmeasured[Math.floor(pickIndex / ENTRY_BAND_PROBE_EVERY) % unmeasured.length]]
	}
	return keep
}

/** Measured entries within the band limit (before the minimum-two rule). */
export function entriesCloseToFastest(
	entries: string[],
	ewma: ReadonlyMap<string, number>,
	samples: ReadonlyMap<string, number>,
): string[] {
	const measured = entries.filter((e) => (samples.get(e) ?? 0) >= ENTRY_BAND_MIN_SAMPLES)
	if (!measured.length) return []
	const best = Math.min(...measured.map((e) => ewma.get(e) ?? Infinity))
	return measured.filter((e) => (ewma.get(e) ?? Infinity) <= best * ENTRY_BAND_RATIO + ENTRY_BAND_SLACK_MS)
}

/** Random member of `band`, not `last` when there is a choice. */
export function pickFromBand(band: string[], last: string | null, random: () => number = Math.random): string | null {
	if (!band.length) return null
	const choices = band.length > 1 && last !== null ? band.filter((e) => e !== last) : band
	const list = choices.length ? choices : band
	return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}

/** Per-call entry pool for media frames. Holds no state beyond the call. */
export class VoiceEntryPool<N extends { domain: string }> {
	private nodes: N[] = []
	private readonly ewma = new Map<string, number>()
	private readonly samples = new Map<string, number>()
	private readonly dropped = new Set<string>()
	private last: string | null = null
	private pickIndex = 0
	private tried = 0
	private refilling: Promise<void> | null = null

	constructor(
		/** Random candidates, none in `exclude` (the SDK's healthy-entry picker). */
		private readonly pickCandidates: (count: number, exclude: Set<string>) => Promise<N[]>,
		private readonly random: () => number = Math.random,
	) {}

	get size(): number {
		return this.nodes.length
	}

	/** Entry for the next frame; never one in `exclude` (relay, mailboxes, already tried). */
	async next(exclude: Set<string>): Promise<N | null> {
		if (this.nodes.filter((n) => !exclude.has(n.domain)).length < ENTRY_POOL_MIN) {
			await this.refill(exclude, ENTRY_POOL_TARGET)
		} else if (this.needsCloserEntries(exclude)) {
			await this.refill(exclude, this.nodes.length + 2)
		}
		const avail = this.nodes.filter((n) => !exclude.has(n.domain))
		if (!avail.length) return null
		const band = entryLatencyBand(avail.map((n) => n.domain), this.ewma, this.samples, this.pickIndex)
		this.pickIndex += 1
		const domain = pickFromBand(band, this.last, this.random)
		this.last = domain
		return avail.find((n) => n.domain === domain) ?? null
	}

	/** One post through `domain`: its time, or a failure (the entry leaves this call's pool). */
	record(domain: string, ms: number, ok: boolean): void {
		if (!ok) {
			this.nodes = this.nodes.filter((n) => n.domain !== domain)
			this.ewma.delete(domain)
			this.samples.delete(domain)
			this.dropped.add(domain)
			return
		}
		if (!this.nodes.some((n) => n.domain === domain)) return
		const prev = this.ewma.get(domain)
		this.ewma.set(domain, prev === undefined ? ms : prev * EWMA_KEEP + ms * (1 - EWMA_KEEP))
		this.samples.set(domain, (this.samples.get(domain) ?? 0) + 1)
	}

	/** Diagnostics: entries in the pool with their average post time. */
	snapshot(): Array<{ domain: string; ms: number | null; samples: number }> {
		return this.nodes.map((n) => ({
			domain: n.domain,
			ms: this.ewma.has(n.domain) ? Math.round(this.ewma.get(n.domain) as number) : null,
			samples: this.samples.get(n.domain) ?? 0,
		}))
	}

	/**
	 * Fewer than three measured entries close to the fastest, every candidate
	 * measured, and the per-call budget not used up: try two more. Entries far
	 * outside the band then leave the pool so it stays small.
	 */
	private needsCloserEntries(exclude: Set<string>): boolean {
		if (this.tried >= ENTRY_POOL_MAX_TRIED) return false
		const avail = this.nodes.filter((n) => !exclude.has(n.domain)).map((n) => n.domain)
		if (avail.some((e) => (this.samples.get(e) ?? 0) < ENTRY_BAND_MIN_SAMPLES)) return false
		if (this.pickIndex < ENTRY_POOL_TARGET * ENTRY_BAND_MIN_SAMPLES) return false
		return entriesCloseToFastest(avail, this.ewma, this.samples).length < ENTRY_BAND_WANT
	}

	private async refill(exclude: Set<string>, target: number): Promise<void> {
		if (this.refilling) return this.refilling
		this.refilling = (async () => {
			if (this.nodes.length >= ENTRY_POOL_TARGET) {
				// Make room: drop measured entries outside the band (slowest first).
				const close = new Set(entriesCloseToFastest(this.nodes.map((n) => n.domain), this.ewma, this.samples))
				const far = this.nodes
					.filter((n) => !close.has(n.domain) && (this.samples.get(n.domain) ?? 0) >= ENTRY_BAND_MIN_SAMPLES)
					.sort((a, b) => (this.ewma.get(b.domain) ?? 0) - (this.ewma.get(a.domain) ?? 0))
				// Keep the pool at most target + 2 after adding two.
				for (const n of far.slice(0, Math.max(0, this.nodes.length - ENTRY_POOL_TARGET))) {
					this.nodes = this.nodes.filter((x) => x !== n)
					this.dropped.add(n.domain)
				}
			}
			const known = new Set<string>([...exclude, ...this.dropped, ...this.nodes.map((n) => n.domain)])
			const want = Math.min(target - this.nodes.filter((n) => !exclude.has(n.domain)).length, ENTRY_POOL_MAX_TRIED - this.tried)
			if (want <= 0) return
			try {
				const fresh = await this.pickCandidates(want, known)
				for (const n of fresh) {
					if (known.has(n.domain)) continue
					this.nodes.push(n)
					this.tried += 1
				}
			} catch {
				/* keep what we have */
			}
		})()
		try {
			await this.refilling
		} finally {
			this.refilling = null
		}
	}
}
