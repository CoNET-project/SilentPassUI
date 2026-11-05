import assert from 'node:assert/strict'
import {
	DEFAULT_VOICE_REORDER_DELAY_MS,
	DEFAULT_VOICE_REORDER_MAX_DELAY_MS,
	DEFAULT_VIDEO_REORDER_DELAY_MS,
	VoiceFrameReorderBuffer,
	type VoiceReorderEvent,
} from '../src/voice-reorder.ts'
import { VOICE_VIDEO_SEQ_BASE } from '../src/types.ts'

function frame(
	seq: number,
	payload: string,
	extra: Partial<{
		direction: 'uplink' | 'downlink'
		frameId: string
		chunkIndex: number
		chunkCount: number
		mediaKind: 'audio' | 'video'
	}> = {},
) {
	return {
		type: 'voice_frame_v1' as const,
		callId: 'c1',
		sessionId: 's1',
		from: '0xfrom',
		to: '0xto',
		seq,
		timestamp: Date.now(),
		payload,
		...extra,
	}
}

{
	// Late nextSeq within jitter window → wait, then deliver contiguous [2,3].
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 50,
		onEvent: (event) => events.push(event),
	})
	assert.deepEqual(buffer.push(frame(1, 'a')).map((item) => item.seq), [1])
	assert.deepEqual(buffer.push(frame(3, 'c')).map((item) => item.seq), [])
	assert.equal(events.some((event) => event.type === 'gap'), false)
	assert.deepEqual(buffer.push(frame(2, 'b')).map((item) => item.seq), [2, 3])
	assert.equal(events.some((event) => event.type === 'gap'), false)
}

{
	// After jitter timeout with still-missing nextSeq → one timeout skip, then continue.
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 40,
		onEvent: (event) => events.push(event),
	})
	buffer.push(frame(1, 'a'))
	assert.deepEqual(buffer.push(frame(3, 'c')).map((item) => item.seq), [])
	await new Promise((resolve) => setTimeout(resolve, 60))
	const gap = events.find((event) => event.type === 'gap')
	assert.ok(gap && gap.type === 'gap')
	assert.equal(gap.gap.reason, 'timeout')
	assert.deepEqual(gap.gap.missingSeq, [2])
	const frameEvents = events.filter((event) => event.type === 'frame')
	assert.ok(frameEvents.some((event) => event.type === 'frame' && event.frame.seq === 3))
}

{
	// tick() with reorderDelayMs:0 forces immediate timeout path (tests / diagnostics).
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 0,
		onEvent: (event) => events.push(event),
	})
	buffer.push(frame(1, 'a'))
	buffer.push(frame(3, 'c'))
	buffer.tick(Date.now() + 1)
	const gap = events.find((event) => event.type === 'gap')
	assert.ok(gap && gap.type === 'gap')
	assert.equal(gap.gap.reason, 'timeout')
}

{
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		onEvent: (event) => events.push(event),
	})
	buffer.push(frame(1, 'a'))
	buffer.push(frame(2, 'b'))
	buffer.push(frame(2, 'B-conflict'))
	assert.ok(events.some((event) => event.type === 'conflict'))
}

{
	const buffer = new VoiceFrameReorderBuffer({
		videoReorderDelayMs: 80,
	})
	assert.deepEqual(
		buffer.push(frame(1, 'part0', { frameId: 'f1', chunkIndex: 0, chunkCount: 2, mediaKind: 'video' })).map((item) => item.payload),
		[],
	)
	assert.deepEqual(
		buffer.push(frame(2, 'part1', { frameId: 'f1', chunkIndex: 1, chunkCount: 2, mediaKind: 'video' })).map((item) => item.payload),
		['part0part1'],
	)
}

{
	const buffer = new VoiceFrameReorderBuffer({ reorderDelayMs: 150 })
	assert.deepEqual(buffer.push(frame(1, 'up', { direction: 'uplink' })).map((item) => item.seq), [1])
	assert.deepEqual(buffer.push(frame(1, 'down', { direction: 'downlink' })).map((item) => item.seq), [1])
}

{
	// 2026-11-05: random-entry frames arrive up to ~0.3 s apart; 120ms dropped 6–37 %.
	assert.equal(DEFAULT_VOICE_REORDER_DELAY_MS, 400)
	assert.equal(DEFAULT_VOICE_REORDER_MAX_DELAY_MS, 1_000)
	assert.equal(DEFAULT_VIDEO_REORDER_DELAY_MS, 200)
}

{
	// Split-seq video (seq ≥ VOICE_VIDEO_SEQ_BASE) bypasses the audio stream:
	// a lost video frame never makes audio wait, and video never moves nextSeq.
	const buffer = new VoiceFrameReorderBuffer({ reorderDelayMs: 150 })
	assert.deepEqual(buffer.push(frame(1, 'a1')).map((item) => item.seq), [1])
	assert.deepEqual(buffer.push(frame(VOICE_VIDEO_SEQ_BASE + 2, 'v2')).map((item) => item.seq), [VOICE_VIDEO_SEQ_BASE + 2])
	assert.deepEqual(buffer.push(frame(2, 'a2')).map((item) => item.seq), [2])
	// Out-of-order video still passes (the UI orders by capture time).
	assert.deepEqual(buffer.push(frame(VOICE_VIDEO_SEQ_BASE + 1, 'v1')).map((item) => item.seq), [VOICE_VIDEO_SEQ_BASE + 1])
	// Duplicate video is dropped.
	assert.deepEqual(buffer.push(frame(VOICE_VIDEO_SEQ_BASE + 2, 'v2')), [])
	assert.deepEqual(buffer.push(frame(3, 'a3')).map((item) => item.seq), [3])
}

console.log('voice reorder ok')

{
	// Adaptive wait: a frame arriving after its gap was skipped adds 100ms, up to 1 s.
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({ onEvent: (event) => events.push(event) })
	assert.equal(buffer.currentWaitMs('s1'), 400)
	let t = 1_000
	let seq = 1
	buffer.push(frame(seq, `p${seq}`), t)
	for (let round = 0; round < 8; round += 1) {
		// seq+1 is missing, seq+2 waits; the wait times out, then seq+1 shows up.
		buffer.push(frame(seq + 2, `p${seq + 2}`), t)
		const waited = buffer.currentWaitMs('s1')
		assert.deepEqual(buffer.tick(t + waited - 1), [])
		assert.deepEqual(buffer.tick(t + waited).map((item) => item.seq), [seq + 2])
		assert.deepEqual(buffer.push(frame(seq + 1, `p${seq + 1}`), t + waited + 50), [])
		seq += 2
		t += 2_000
	}
	assert.equal(buffer.lateCount('s1'), 8)
	assert.equal(buffer.currentWaitMs('s1'), 1_000)
	// 10 s without a late frame takes 50ms back, once per 10 s.
	buffer.push(frame(seq + 1, `p${seq + 1}`), t + 10_000)
	assert.equal(buffer.currentWaitMs('s1'), 950)
	buffer.push(frame(seq + 2, `p${seq + 2}`), t + 15_000)
	assert.equal(buffer.currentWaitMs('s1'), 950)
	buffer.clear()
}

{
	// A frame inside the adaptive window is not dropped: with the old 120ms it was.
	const old = new VoiceFrameReorderBuffer({ reorderDelayMs: 120, maxReorderDelayMs: 120 })
	const now = new VoiceFrameReorderBuffer()
	for (const buffer of [old, now]) {
		buffer.push(frame(1, 'a'), 0)
		buffer.push(frame(3, 'c'), 0)
	}
	assert.deepEqual(old.tick(250).map((item) => item.seq), [3])
	assert.deepEqual(old.push(frame(2, 'b'), 250), [])
	assert.deepEqual(now.tick(250), [])
	assert.deepEqual(now.push(frame(2, 'b'), 250).map((item) => item.seq), [2, 3])
	old.clear()
	now.clear()
}

console.log('voice reorder adaptive ok')
