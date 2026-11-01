import { newVoiceLinkState, noteVoiceLinkRx, tickVoiceLink, VOICE_LINK, voiceLinkBackoffMs } from './voiceLinkPolicy'

const T0 = 1_000_000

/** Advance second by second, feeding peer frames / uplink success as asked. */
function run(
	from: number,
	to: number,
	s: ReturnType<typeof newVoiceLinkState>,
	opts: { rx?: (t: number) => boolean; tx?: (t: number) => boolean; listenOpen?: (t: number) => boolean } = {},
) {
	const out: { t: number; kind: string; attempt?: number; unlistenFirst?: boolean }[] = []
	for (let t = from; t <= to; t += 1_000) {
		if (opts.rx?.(t)) noteVoiceLinkRx(s, t)
		if (opts.tx?.(t)) s.lastTxOkAt = t
		const d = tickVoiceLink(s, t, opts.listenOpen ? opts.listenOpen(t) : true)
		if (d.kind === 'reconnect') out.push({ t, kind: d.kind, attempt: d.attempt, unlistenFirst: d.unlistenFirst })
		else if (d.kind === 'lost') out.push({ t, kind: d.kind })
	}
	return out
}

describe('voice link policy', () => {
	it('does nothing while peer frames flow', () => {
		const s = newVoiceLinkState(T0)
		const events = run(T0, T0 + 60_000, s, { rx: () => true, tx: () => true })
		expect(events).toEqual([])
		expect(s.reconnecting).toBe(false)
	})

	it('does not judge silence during the start grace', () => {
		const s = newVoiceLinkState(T0)
		const events = run(T0, T0 + VOICE_LINK.startGraceMs - 1_000, s, { tx: () => true })
		expect(events).toEqual([])
	})

	it('reconnects at once when the SSE closes, then backs off with unlisten first', () => {
		const s = newVoiceLinkState(T0)
		// SSE closed from t0+2s, peer still sending uplink-accepted frames never arrive.
		const events = run(T0 + 2_000, T0 + 24_000, s, {
			tx: () => true,
			listenOpen: () => false,
		})
		const reconnects = events.filter((e) => e.kind === 'reconnect')
		expect(reconnects[0]).toEqual({ t: T0 + 2_000, kind: 'reconnect', attempt: 1, unlistenFirst: false })
		expect(reconnects[1].unlistenFirst).toBe(true)
		// minimum 4 s between attempts, backoff capped at 8 s
		const gaps = reconnects.slice(1).map((e, i) => e.t - reconnects[i].t)
		expect(gaps).toEqual([4_000, 4_000, 4_000, 8_000])
		expect(events.some((e) => e.kind === 'lost')).toBe(false) // uplink still accepted
	})

	it('reconnects after 8 s of silence and recovers when frames return (10 s outage)', () => {
		const s = newVoiceLinkState(T0)
		const outageStart = T0 + 20_000
		const outageEnd = outageStart + 10_000
		const inOutage = (t: number) => t >= outageStart && t < outageEnd
		const events = run(T0, T0 + 60_000, s, {
			rx: (t) => !inOutage(t),
			tx: (t) => !inOutage(t),
		})
		expect(events.filter((e) => e.kind === 'reconnect').length).toBeGreaterThan(0)
		expect(events.some((e) => e.kind === 'lost')).toBe(false)
		expect(s.reconnecting).toBe(false)
		expect(s.attempt).toBe(0)
	})

	it('ends the call when nothing arrives and nothing is accepted for the limit', () => {
		const s = newVoiceLinkState(T0)
		const outageStart = T0 + 20_000
		const events = run(T0, T0 + 90_000, s, {
			rx: (t) => t < outageStart,
			tx: (t) => t < outageStart,
		})
		const lost = events.filter((e) => e.kind === 'lost')
		expect(lost).toHaveLength(1)
		// last rx/tx at outageStart - 1 s, so lost exactly lostMs later
		expect(lost[0].t).toBe(outageStart - 1_000 + VOICE_LINK.lostMs)
		expect(s.lost).toBe(true)
	})

	it('ends the call when the peer app is killed (no frames, uplink rejected)', () => {
		const s = newVoiceLinkState(T0)
		const killedAt = T0 + 30_000
		const events = run(T0, T0 + 80_000, s, { rx: (t) => t < killedAt, tx: (t) => t < killedAt })
		expect(events.filter((e) => e.kind === 'lost').map((e) => e.t)).toEqual([killedAt - 1_000 + VOICE_LINK.lostMs])
	})

	it('keeps a call with a muted peer (no frames, uplink accepted)', () => {
		const s = newVoiceLinkState(T0)
		const events = run(T0, T0 + 120_000, s, { rx: (t) => t < T0 + 5_000, tx: () => true })
		expect(events.some((e) => e.kind === 'lost')).toBe(false)
	})

	it('backoff doubles up to 8 s', () => {
		expect([1, 2, 3, 4, 5, 6].map(voiceLinkBackoffMs)).toEqual([1_000, 2_000, 4_000, 8_000, 8_000, 8_000])
	})

	it('does not start another attempt while one is in flight', () => {
		const s = newVoiceLinkState(T0)
		const first = tickVoiceLink(s, T0 + 1_000, false)
		expect(first.kind).toBe('reconnect')
		s.inFlight = true
		const second = tickVoiceLink(s, T0 + 20_000, false)
		expect(second.kind).toBe('wait')
	})
})
