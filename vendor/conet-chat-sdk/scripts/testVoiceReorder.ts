import { strict as assert } from 'node:assert'
import { VoiceFrameReorderBuffer } from '../src/voice-reorder.js'

const frame = (seq: number, payload: string, extra: Record<string, unknown> = {}) => ({
	type: 'voice_frame_v1' as const,
	callId: 'call',
	sessionId: 'session',
	from: '0x1',
	to: '0x2',
	seq,
	timestamp: seq,
	payload,
	...extra,
})

const buffer = new VoiceFrameReorderBuffer({ reorderDelayMs: 10 })
assert.deepEqual(buffer.push(frame(1, 'a')).map((item) => item.seq), [1])
assert.deepEqual(buffer.push(frame(3, 'c')).map((item) => item.seq), [])
assert.deepEqual(buffer.push(frame(2, 'b')).map((item) => item.seq), [2, 3])

const events: Array<{ type: string }> = []
const conflicts = new VoiceFrameReorderBuffer({ onEvent: (event) => events.push(event as { type: string }) })
conflicts.push(frame(1, 'a'))
conflicts.push(frame(3, 'pending'))
conflicts.push(frame(3, 'different'))
assert.equal(events.find((event) => event.type === 'conflict')?.type, 'conflict')

const chunks = new VoiceFrameReorderBuffer()
chunks.push(frame(1, 'A', { frameId: 'f', chunkIndex: 0, chunkCount: 2 }))
assert.deepEqual(chunks.push(frame(2, 'B', { frameId: 'f', chunkIndex: 1, chunkCount: 2 })).map((item) => item.payload), ['AB'])

assert.deepEqual(buffer.push({ ...frame(4, 'invalid'), seq: -1 }), [])
const limited = new VoiceFrameReorderBuffer({ maxPendingChunks: 1 })
limited.push(frame(1, 'a'))
limited.push(frame(3, 'c'))
// Overflow must skip the gap and keep delivering live audio (not stall forever).
assert.deepEqual(limited.push(frame(4, 'd')).map((item) => item.seq), [3, 4])

// After Accept (seq=0) advances the ring stream, Hang Up also uses seq=0 and
// must still be delivered as a control frame (not treated as stale media).
const hangup = new VoiceFrameReorderBuffer()
assert.deepEqual(hangup.push(frame(0, 'accept')).map((item) => item.seq), [0])
assert.deepEqual(hangup.push(frame(1, 'media')).map((item) => item.seq), [1])
assert.deepEqual(hangup.push(frame(0, 'hangup')).map((item) => item.payload), ['hangup'])
assert.deepEqual(hangup.push(frame(2, 'media2')).map((item) => item.seq), [2])

console.log('voice reorder tests passed')
