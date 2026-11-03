// Pure helpers; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))
jest.mock('./cashTreesNativeNfc', () => ({ dispatchNativeSystemCallAction: () => true }))

import {
	isPhoneCallTerminalStatus,
	mergePhoneCallRecord,
	noteVoicePeerRinging,
	VOICE_PEER_UNREACHABLE_MS,
	VOICE_PEER_WAKE_TIMEOUT_MS,
	voicePeerRingingMatches,
	voicePeerWakeAfterReceipt,
	voicePeerWakeAfterTimer,
	wasVoicePeerRinging,
} from './voiceCallSession'

describe('voice_call_ringing_v1 on the browser dialer', () => {
	it('a receipt that arrived before the dial screen subscribed still counts', () => {
		const now = 1_000_000
		noteVoicePeerRinging('call-early', 'sess-early', now)
		// The dial screen subscribes once startOutgoing() returned the offer.
		expect(wasVoicePeerRinging({ callId: 'call-early', sessionId: 'sess-early' }, now + 1_500)).toBe(true)
	})

	it('matches by callId or by sessionId, never another dial', () => {
		const offer = { callId: 'c-1', sessionId: 's-1' }
		expect(voicePeerRingingMatches({ callId: 'c-1' }, offer)).toBe(true)
		expect(voicePeerRingingMatches({ sessionId: 's-1' }, offer)).toBe(true)
		expect(voicePeerRingingMatches({ callId: 'c-2', sessionId: 's-2' }, offer)).toBe(false)
		expect(voicePeerRingingMatches({}, offer)).toBe(false)
		expect(voicePeerRingingMatches({ callId: '' }, { callId: '' })).toBe(false)
		expect(wasVoicePeerRinging({ callId: 'never-rang', sessionId: 'never-rang-s' }, 1_000_000)).toBe(false)
	})

	it('forgets receipts after 10 minutes', () => {
		const now = 5_000_000
		noteVoicePeerRinging('call-old', '', now)
		expect(wasVoicePeerRinging({ callId: 'call-old' }, now + 10 * 60_000)).toBe(true)
		expect(wasVoicePeerRinging({ callId: 'call-old' }, now + 10 * 60_000 + 1)).toBe(false)
	})
})

describe('Unreachable after five rings without a receipt', () => {
	it('five rings of 1 s on / 4 s off: 25 s, well after the 8 s notice', () => {
		expect(VOICE_PEER_UNREACHABLE_MS).toBe(5 * 5_000)
		expect(VOICE_PEER_UNREACHABLE_MS).toBeGreaterThan(VOICE_PEER_WAKE_TIMEOUT_MS)
	})

	it('no receipt: waiting, then the 8 s notice, then unreachable', () => {
		let wake = voicePeerWakeAfterTimer('waiting', 'restricted')
		expect(wake).toBe('restricted')
		wake = voicePeerWakeAfterTimer(wake, 'unreachable')
		expect(wake).toBe('unreachable')
		// Unreachable without passing through the notice (page opened late).
		expect(voicePeerWakeAfterTimer('waiting', 'unreachable')).toBe('unreachable')
	})

	it('a receipt before the five rings keeps the call ringing', () => {
		expect(voicePeerWakeAfterReceipt('waiting')).toBe('ringing')
		expect(voicePeerWakeAfterReceipt('restricted')).toBe('ringing')
		expect(voicePeerWakeAfterTimer('ringing', 'restricted')).toBe('ringing')
		expect(voicePeerWakeAfterTimer('ringing', 'unreachable')).toBe('ringing')
	})

	it('a receipt after unreachable is ignored: the call is over', () => {
		expect(voicePeerWakeAfterReceipt('unreachable')).toBe('unreachable')
	})

	it('unreachable is a final outcome a later hang-up or cancel does not replace', () => {
		expect(isPhoneCallTerminalStatus('unreachable')).toBe(true)
		const base = { callId: 'c-u', sessionId: 's-u', peerAddress: '0xabc', direction: 'outgoing' as const, createdAt: 1 }
		const unreachable = mergePhoneCallRecord({ ...base, status: 'ringing' }, { ...base, status: 'unreachable', endedAt: 26 })
		expect(unreachable?.status).toBe('unreachable')
		// The hang-up path asks for 'cancelled' / 'ended': the record keeps unreachable.
		expect(mergePhoneCallRecord(unreachable, { ...base, status: 'cancelled', endedAt: 27 })?.status).toBe('unreachable')
		// A stale ringing copy cannot reopen it.
		expect(mergePhoneCallRecord(unreachable, { ...base, status: 'ringing' })?.status).toBe('unreachable')
	})
})
