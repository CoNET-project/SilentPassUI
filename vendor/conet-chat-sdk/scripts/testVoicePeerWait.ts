// The caller now sends voice_channel_ready_v3 before its own listen is up. These
// check that the callee's first chunks are not lost while the caller's channel
// opens: the relay keeps nothing, so the callee posts them again.
import assert from 'node:assert/strict'
import {
	VOICE_PEER_CHANNEL_NOT_FOUND,
	VOICE_PEER_CHANNEL_RETRY_GAP_MS,
	VOICE_PEER_CHANNEL_WAIT_MS,
	postUntilPeerChannel,
} from '../src/voice-peer-wait.ts'

const notFound = { ok: false, error: VOICE_PEER_CHANNEL_NOT_FOUND }
const accepted = { ok: true }

function clock(start = 0) {
	const c = { t: start }
	return {
		c,
		sleep: async (ms: number) => { c.t += ms },
		now: () => c.t,
	}
}

// Retried until the channel exists.
{
	const k = clock()
	let calls = 0
	const r = await postUntilPeerChannel({ seenBefore: false, post: async () => (++calls < 6 ? notFound : accepted), ...k })
	assert.equal(r.ok, true)
	assert.equal(r.tries, 6)
	assert.equal(k.c.t, 5 * VOICE_PEER_CHANNEL_RETRY_GAP_MS)
}

// No retry once a chunk was accepted (a later miss is a reconnect: drop it).
{
	let calls = 0
	const r = await postUntilPeerChannel({
		seenBefore: true,
		post: async () => { calls++; return notFound },
		sleep: async () => { throw new Error('must not wait') },
		now: () => 0,
	})
	assert.equal(r.ok, false)
	assert.equal(calls, 1)
}

// Other errors are not retried.
{
	let calls = 0
	const r = await postUntilPeerChannel({
		seenBefore: false,
		post: async () => { calls++; return { ok: false, error: 'voice_chunk_auth' } },
		sleep: async () => { throw new Error('must not wait') },
		now: () => 0,
	})
	assert.equal(r.ok, false)
	assert.equal(calls, 1)
}

// Gives up after the window, and when the call ends.
{
	const k = clock()
	const r = await postUntilPeerChannel({ seenBefore: false, post: async () => notFound, ...k })
	assert.equal(r.ok, false)
	assert.ok(k.c.t >= VOICE_PEER_CHANNEL_WAIT_MS && k.c.t <= VOICE_PEER_CHANNEL_WAIT_MS + VOICE_PEER_CHANNEL_RETRY_GAP_MS)
	const k2 = clock()
	const r2 = await postUntilPeerChannel({ seenBefore: false, post: async () => notFound, alive: () => k2.c.t < 450, ...k2 })
	assert.equal(r2.ok, false)
	assert.equal(k2.c.t, 450)
}

// Chunks every 160 ms from t = 0, the caller's listen opens at `open`: every chunk
// arrives, the first within one retry gap of the channel opening.
for (const open of [0, 500, 1000, 1400]) {
	const finishes: number[] = []
	for (let i = 0; i < 30; i++) {
		const k = clock(i * 160)
		const r = await postUntilPeerChannel({ seenBefore: false, post: async () => (k.c.t >= open ? accepted : notFound), ...k })
		assert.equal(r.ok, true, `chunk ${i} open=${open}`)
		finishes.push(k.c.t)
	}
	assert.ok(finishes[0] <= open + VOICE_PEER_CHANNEL_RETRY_GAP_MS, `first chunk open=${open}`)
}

console.log('voice peer wait: ok')
