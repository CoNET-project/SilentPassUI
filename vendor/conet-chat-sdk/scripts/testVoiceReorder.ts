import assert from 'node:assert/strict'
import { VoiceFrameReorderBuffer, type VoiceReorderEvent } from '../src/voice-reorder.ts'

function frame(seq: number, payload: string, extras: Record<string, unknown> = {}) {
	return {
		type: 'voice_frame_v1' as const,
		callId: 'call-1',
		sessionId: 'session-1',
		from: '0xabc',
		to: '0xdef',
		direction: 'inbound' as const,
		seq,
		timestamp: 1_700_000_000_000 + seq,
		payload,
		...extras,
	}
}

{
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 150,
		onEvent: (event) => events.push(event),
	})

	assert.deepEqual(buffer.push(frame(1, 'a')).map((item) => item.seq), [1])
	// Later seq arrives first → immediate skip-ahead (no reorderDelayMs wait).
	assert.deepEqual(buffer.push(frame(3, 'c')).map((item) => item.seq), [3])
	assert.equal(
		events.some(
			(event) =>
				event.type === 'gap' &&
				event.gap.reason === 'skip_ahead' &&
				event.gap.missingSeq.join(',') === '2',
		),
		true,
	)
	// Late fill for skipped seq is stale and must not deliver.
	assert.deepEqual(buffer.push(frame(2, 'b')).map((item) => item.seq), [])
	// Exact duplicate of already-delivered seq is ignored (behind cursor).
	assert.deepEqual(buffer.push(frame(3, 'c')).map((item) => item.seq), [])
}

{
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 150,
		onEvent: (event) => events.push(event),
	})
	assert.deepEqual(buffer.push(frame(0, 'zero')).map((item) => item.seq), [0])
	const t0 = Date.now()
	const delivered = buffer.push(frame(5, 'five'))
	const elapsed = Date.now() - t0
	assert.deepEqual(delivered.map((item) => item.seq), [5])
	assert.ok(elapsed < 50, `skip-ahead must be sync (elapsed=${elapsed}ms)`)
	const gap = events.find((event) => event.type === 'gap' && event.gap.reason === 'skip_ahead')
	assert.ok(gap && gap.type === 'gap')
	assert.deepEqual(gap.gap.missingSeq, [1, 2, 3, 4])
}

{
	// Conflict while a frame is still pending (incomplete video chunk at nextSeq).
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 150,
		onEvent: (event) => events.push(event),
	})
	assert.deepEqual(
		buffer
			.push(frame(1, 'c0', { frameId: 'f1', chunkIndex: 0, chunkCount: 2 }))
			.map((item) => item.seq),
		[],
	)
	assert.deepEqual(
		buffer
			.push(frame(1, 'conflict', { frameId: 'f1', chunkIndex: 0, chunkCount: 2 }))
			.map((item) => item.seq),
		[],
	)
	assert.equal(events.some((event) => event.type === 'conflict' && event.conflict.seq === 1), true)
}

{
	const events: VoiceReorderEvent[] = []
	const buffer = new VoiceFrameReorderBuffer({
		reorderDelayMs: 20,
		onEvent: (event) => events.push(event),
	})
	assert.deepEqual(
		buffer
			.push(frame(10, 'c0', { frameId: 'f1', chunkIndex: 0, chunkCount: 2 }))
			.map((item) => item.seq),
		[],
	)
	await new Promise((resolve) => setTimeout(resolve, 30))
	assert.deepEqual(buffer.tick().map((item) => item.seq), [])
	assert.equal(events.some((event) => event.type === 'gap' && event.gap.reason === 'timeout'), true)
}

{
	const buffer = new VoiceFrameReorderBuffer({ reorderDelayMs: 150 })
	assert.deepEqual(buffer.push(frame(1, 'start')).map((item) => item.seq), [1])
	const hangup = frame(0, JSON.stringify({ type: 'voice_end_v1', reason: 'hangup' }))
	assert.deepEqual(buffer.push(hangup).map((item) => item.seq), [0])
}

console.log('voice reorder ok')
