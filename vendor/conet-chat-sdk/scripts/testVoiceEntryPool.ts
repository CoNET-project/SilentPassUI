import assert from 'node:assert/strict'
import {
	ENTRY_BAND_PROBE_EVERY,
	VoiceEntryPool,
	entryLatencyBand,
	pickFromBand,
} from '../src/voice-entry-pool.ts'

const ms = (pairs: Array<[string, number]>) => new Map(pairs)
const n = (pairs: Array<[string, number]>) => new Map(pairs)

{
	// Warm-up: every entry carries frames until each can be measured.
	const entries = ['a', 'b', 'c', 'd', 'e', 'f']
	assert.deepEqual(entryLatencyBand(entries, ms([]), n([]), 0), entries)
	assert.deepEqual(entryLatencyBand(entries, ms([['a', 300]]), n([['a', 3]]), 17), entries)
}

{
	// After warm-up: only entries within 50 ms of the fastest.
	const entries = ['a', 'b', 'c', 'd', 'e', 'f']
	const ewma = ms([['a', 300], ['b', 320], ['c', 345], ['d', 395], ['e', 600], ['f', 700]])
	const samples = n(entries.map((e) => [e, 5] as [string, number]))
	assert.deepEqual(entryLatencyBand(entries, ewma, samples, 18).sort(), ['a', 'b', 'c'])
	// Only the fastest is close: still keep two.
	const lone = ms([['a', 200], ['b', 500], ['c', 520], ['d', 560], ['e', 600], ['f', 700]])
	assert.deepEqual(entryLatencyBand(entries, lone, samples, 18), ['a', 'b'])
	// Measured entries outside the band get no frames.
	assert.deepEqual(entryLatencyBand(entries, ewma, samples, 3 * ENTRY_BAND_PROBE_EVERY - 1).sort(), ['a', 'b', 'c'])
	// A new, unmeasured candidate gets one pick in eight until it is measured.
	const grown = [...entries, 'g']
	assert.deepEqual(entryLatencyBand(grown, ewma, samples, 3 * ENTRY_BAND_PROBE_EVERY - 1), ['g'])
	assert.deepEqual(entryLatencyBand(grown, ewma, samples, 3 * ENTRY_BAND_PROBE_EVERY).sort(), ['a', 'b', 'c'])
}

{
	// Within the band the entry is random and never the same twice in a row.
	let r = 0
	const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
	let last: string | null = null
	const seen = new Set<string>()
	for (let i = 0; i < 200; i += 1) {
		const pick = pickFromBand(['a', 'b', 'c'], last, rnd)
		assert.notEqual(pick, last)
		seen.add(pick as string)
		last = pick
	}
	assert.deepEqual([...seen].sort(), ['a', 'b', 'c'])
	assert.equal(pickFromBand(['a'], 'a'), 'a')
	assert.equal(pickFromBand([], null), null)
}

/** Fake network: each entry has its own post time ± jitter. */
type Node = { domain: string }
const means: Record<string, number> = {}
const universe: Node[] = []
for (let i = 0; i < 25; i += 1) {
	const domain = `e${i}`
	universe.push({ domain })
	means[domain] = 300 + ((i * 37) % 400) // 300–700 ms, like the healthy entries seen live
}
let seed = 11
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const picker = async (count: number, exclude: Set<string>) => {
	const free = universe.filter((u) => !exclude.has(u.domain))
	const out: Node[] = []
	while (out.length < count && free.length) out.push(free.splice(Math.floor(rand() * free.length), 1)[0])
	return out
}

{
	// Excluded domains (relay, mailboxes, tried) are never returned; failures leave the pool.
	const pool = new VoiceEntryPool<Node>(picker, rand)
	const exclude = new Set(['e0', 'e1', 'e2'])
	for (let i = 0; i < 50; i += 1) {
		const node = await pool.next(exclude)
		assert.ok(node && !exclude.has(node.domain))
		pool.record(node!.domain, means[node!.domain], true)
	}
	const before = pool.snapshot().map((s) => s.domain)
	pool.record(before[0], 0, false)
	assert.ok(!pool.snapshot().some((s) => s.domain === before[0]))
	for (let i = 0; i < 20; i += 1) {
		const node = await pool.next(exclude)
		assert.notEqual(node?.domain, before[0])
	}
}

/**
 * 80 ms frames for 60 s. Arrival = send + entry time ± 20 ms. Out-of-order share
 * at the peer: random entry per frame (old) vs the per-call band (new).
 */
async function outOfOrder(useBand: boolean, callSeed: number): Promise<number> {
	seed = callSeed
	const pool = new VoiceEntryPool<Node>(picker, rand)
	const arrivals: Array<{ at: number; seq: number }> = []
	for (let seq = 0; seq < 750; seq += 1) {
		let domain: string
		if (useBand) {
			const node = await pool.next(new Set())
			domain = node!.domain
		} else {
			domain = universe[Math.floor(rand() * universe.length)].domain
		}
		const post = means[domain] + (rand() * 40 - 20)
		if (useBand) pool.record(domain, post, true)
		arrivals.push({ at: seq * 80 + post, seq })
	}
	arrivals.sort((a, b) => a.at - b.at)
	let ooo = 0
	let max = -1
	for (const a of arrivals) {
		if (a.seq < max) ooo += 1
		max = Math.max(max, a.seq)
	}
	return ooo / arrivals.length
}

{
	let sumOld = 0
	let sumNew = 0
	const seeds = [3, 5, 7, 9, 11, 13]
	for (const s of seeds) {
		const oldOoo = await outOfOrder(false, s)
		const newOoo = await outOfOrder(true, s)
		assert.ok(oldOoo > 0.2, `old ooo ${oldOoo}`)
		assert.ok(newOoo < oldOoo / 2, `seed ${s}: new ooo ${newOoo} old ${oldOoo}`)
		sumOld += oldOoo
		sumNew += newOoo
	}
	// About 39 % out of order with a random entry per frame, about 5 % in the band.
	assert.ok(sumNew / seeds.length < sumOld / seeds.length / 3, `avg new ${sumNew / seeds.length} old ${sumOld / seeds.length}`)
}

{
	// Every call starts its own pool: the candidates are picked again.
	seed = 99
	const a = new VoiceEntryPool<Node>(picker, rand)
	await a.next(new Set())
	const b = new VoiceEntryPool<Node>(picker, rand)
	await b.next(new Set())
	assert.notDeepEqual(a.snapshot().map((s) => s.domain).sort(), b.snapshot().map((s) => s.domain).sort())
}

console.log('voice entry pool ok')
