// Pure helper; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))

import { voiceCallHandlesEndedInBatch } from './voiceCallSession'

const line = (signal: Record<string, unknown>, signMessage = 'sig') =>
	JSON.stringify({ text: JSON.stringify(signal), signMessage })
const signed = () => '0x0000000000000000000000000000000000000001'
const unsigned = () => null

test('an end in the batch marks both ids of that call', () => {
	const ended = voiceCallHandlesEndedInBatch([
		line({ type: 'voice_call_offer_v1', callId: 'c1', sessionId: 's1' }),
		line({ type: 'voice_end_v1', callId: 'c1', sessionId: 's1' }),
		line({ type: 'voice_call_offer_v1', callId: 'c2', sessionId: 's2' }),
	], signed)
	expect([...ended].sort()).toEqual(['c1', 's1'])
})

test('decline and timeout count as ended', () => {
	const ended = voiceCallHandlesEndedInBatch([
		line({ type: 'voice_call_reject_v1', callId: 'c3', sessionId: 's3' }),
		line({ type: 'voice_call_timeout_v1', callId: 'c4', sessionId: 's4' }),
	], signed)
	expect(ended.has('c3') && ended.has('s4')).toBe(true)
})

test('an end without a valid signature is ignored', () => {
	expect(voiceCallHandlesEndedInBatch([
		line({ type: 'voice_end_v1', callId: 'c1', sessionId: 's1' }),
	], unsigned).size).toBe(0)
})

test('a nested end signed over the inner text counts', () => {
	const inner = JSON.stringify({ type: 'voice_end_v1', callId: 'c5', sessionId: 's5' })
	const raw = JSON.stringify({ text: JSON.stringify({ text: inner }), signMessage: 'sig' })
	const innerOnly = (text: string) => (text === inner ? signed() : null)
	expect(voiceCallHandlesEndedInBatch([raw], innerOnly).has('s5')).toBe(true)
})

test('plain chat lines and junk are skipped', () => {
	expect(voiceCallHandlesEndedInBatch([
		JSON.stringify({ text: 'hello', signMessage: 'sig' }),
		'not json',
	], signed).size).toBe(0)
})
