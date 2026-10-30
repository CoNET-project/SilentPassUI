import assert from 'node:assert/strict'
import {
	DEFAULT_VOICE_REORDER_DELAY_MS,
	DEFAULT_VIDEO_REORDER_DELAY_MS,
	VoiceFrameReorderBuffer,
	type VoiceReorderEvent,
} from '../src/voice-reorder.ts'

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
	assert.equal(DEFAULT_VOICE_REORDER_DELAY_MS, 120)
	assert.equal(DEFAULT_VIDEO_REORDER_DELAY_MS, 200)
	assert.ok(DEFAULT_VOICE_REORDER_DELAY_MS >= 60 && DEFAULT_VOICE_REORDER_DELAY_MS <= 200)
}

console.log('voice reorder ok')
