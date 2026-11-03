// Pure helper; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))

import {
	INCOMING_CALL_RING_TIMEOUT_MS,
	markIncomingCallNeverRang,
	markVoiceCallTerminal,
	mergePhoneCallRecord,
	missedIncomingCallRow,
	phoneCallStatusForPeerHangup,
	takeIncomingCallsToAskRang,
	type VoiceCallSignal,
} from './voiceCallSession'

const caller = '0x0000000000000000000000000000000000000001'
const offer = (callId: string, createdAgoMs: number, extra: Partial<VoiceCallSignal> = {}): VoiceCallSignal => {
	const createdAt = Date.now() - createdAgoMs
	return {
		type: 'voice_call_offer_v1',
		callId,
		sessionId: `s-${callId}`,
		from: caller,
		to: '0x0000000000000000000000000000000000000002',
		createdAt,
		timestamp: createdAt,
		expiresAt: createdAt + 15 * 60_000,
		...extra,
	} as VoiceCallSignal
}

test('an offer past its ring window becomes one missed row', () => {
	const signal = offer('m1', INCOMING_CALL_RING_TIMEOUT_MS + 60_000)
	const row = missedIncomingCallRow([], signal, caller, 0)
	expect(row).toMatchObject({ callId: 'm1', sessionId: 's-m1', direction: 'incoming', status: 'missed', peerAddress: caller })
	expect(row!.endedAt).toBe(Number(signal.createdAt) + INCOMING_CALL_RING_TIMEOUT_MS)
})

test('an expired offer (expiresAt passed) is missed too', () => {
	const signal = offer('m2', 30_000, { expiresAt: Date.now() - 1 })
	expect(missedIncomingCallRow([], signal, caller, 0)?.status).toBe('missed')
})

test('an offer still in its ring window is not missed', () => {
	expect(missedIncomingCallRow([], offer('m3', 46_000), caller, 0)).toBeNull()
})

test('a call already recorded or terminal-marked gets no new row', () => {
	const late = offer('m4', INCOMING_CALL_RING_TIMEOUT_MS + 60_000)
	const existing: PhoneCallRecord = {
		callId: 'm4', sessionId: 's-m4', peerAddress: caller, direction: 'incoming', status: 'cancelled', createdAt: 1,
	}
	expect(missedIncomingCallRow([existing], late, caller, 0)).toBeNull()
	const marked = offer('m5', INCOMING_CALL_RING_TIMEOUT_MS + 60_000)
	markVoiceCallTerminal('m5', 's-m5')
	expect(missedIncomingCallRow([], marked, caller, 0)).toBeNull()
})

test("the caller's end turns a late-offer missed row into cancelled, then the shell decides", () => {
	// RC2 (2026-11-02): a call that rang while the page was killed came back as a late
	// offer (missed row) plus the caller's end. It must not stay "Missed call" before
	// the shell is asked whether it rang.
	const row = missedIncomingCallRow([], offer('m6', INCOMING_CALL_RING_TIMEOUT_MS + 60_000), caller, 0)!
	const status = phoneCallStatusForPeerHangup(row)
	expect(status).toBe('cancelled')
	const ended = mergePhoneCallRecord(row, { ...row, status, endedAt: Date.now() })!
	expect(ended.status).toBe('cancelled')
	expect(takeIncomingCallsToAskRang([ended]).map(c => c.sessionId)).toEqual(['s-m6'])
	// The shell says it never rang: "Missed call", and a redelivered end keeps it.
	const missed = markIncomingCallNeverRang([ended], { callId: 'm6', sessionId: 's-m6' })![0]
	expect(missed).toMatchObject({ status: 'missed', neverRang: true })
	const again = phoneCallStatusForPeerHangup(missed)
	expect(again).toBe('missed')
	expect(mergePhoneCallRecord(missed, { ...missed, status: again, neverRang: undefined, endedAt: Date.now() })).toMatchObject({ status: 'missed' })
})

test('a late-offer row for a call that rang here ends as cancelled', () => {
	const row = missedIncomingCallRow([], offer('m7', INCOMING_CALL_RING_TIMEOUT_MS + 60_000), caller, 0)!
	const ended = mergePhoneCallRecord(row, { ...row, status: phoneCallStatusForPeerHangup(row), endedAt: Date.now() })!
	// The shell answered rang:true, so the page changes nothing.
	expect(ended.status).toBe('cancelled')
})
