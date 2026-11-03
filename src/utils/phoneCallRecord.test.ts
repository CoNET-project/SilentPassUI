// The record helpers are pure; stub the worker bridge that voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))

import {
	mergePhoneCallRecord,
	NATIVE_ANSWERED_STORAGE_KEY,
	noteNativeCallAnswered,
	phoneCallStatusForPeerHangup,
	reloadNativeAnsweredForTests,
} from './voiceCallSession'

const T = 1_793_513_000_000

const base: PhoneCallRecord = {
	callId: 'c1',
	sessionId: 's1',
	peerAddress: '0x0000000000000000000000000000000000000001',
	direction: 'incoming',
	status: 'ringing',
	createdAt: T,
}

test('peer hangup after answer is ended with duration, not cancelled', () => {
	const answered = { ...base, status: 'answered' as const, answeredAt: T + 5_000 }
	expect(phoneCallStatusForPeerHangup(answered)).toBe('ended')
	const merged = mergePhoneCallRecord(answered, {
		...base,
		status: phoneCallStatusForPeerHangup(answered),
		endedAt: T + 57_000,
	})
	expect(merged?.status).toBe('ended')
	expect(merged?.durationMs).toBe(52_000)
})

test('peer hangup while ringing stays cancelled', () => {
	expect(phoneCallStatusForPeerHangup(base)).toBe('cancelled')
	expect(phoneCallStatusForPeerHangup(undefined)).toBe('cancelled')
	expect(mergePhoneCallRecord(base, { ...base, status: 'cancelled', endedAt: T + 30_000 })?.status).toBe('cancelled')
})

test('late cancelled cannot overwrite an ended call that was answered', () => {
	const ended = { ...base, status: 'ended' as const, answeredAt: T + 5_000, endedAt: T + 50_000, durationMs: 45_000 }
	const merged = mergePhoneCallRecord(ended, { ...base, status: 'cancelled', endedAt: T + 51_000 })
	expect(merged?.status).toBe('ended')
	expect(merged?.durationMs).toBe(45_000)
	// A message bubble that only saw the answer still upgrades to ended.
	const bubble = mergePhoneCallRecord({ ...base, status: 'answered', answeredAt: T + 5_000 }, merged)
	expect(bubble?.status).toBe('ended')
})

test('seconds and milliseconds stamps both give the duration', () => {
	const merged = mergePhoneCallRecord(
		{ ...base, status: 'answered', answeredAt: T },
		{ ...base, status: 'ended', endedAt: 1_793_513_060 },
	)
	expect(merged?.durationMs).toBe(60_000)
})

test('declined before answer still shows declined', () => {
	expect(mergePhoneCallRecord(base, { ...base, status: 'declined' })?.status).toBe('declined')
})

test('shell answered before the page had the offer: peer hangup is ended', () => {
	const ringing = { ...base, callId: 'c-native', sessionId: 's-native' }
	noteNativeCallAnswered('c-native', 'own-accept-session', T + 4_000)
	expect(phoneCallStatusForPeerHangup(ringing)).toBe('ended')
	const merged = mergePhoneCallRecord(ringing, { ...ringing, status: 'cancelled', endedAt: T + 34_000 })
	expect(merged?.status).toBe('ended')
	expect(merged?.durationMs).toBe(30_000)
	// The late offer row shows the call as live, not "Incoming call".
	expect(mergePhoneCallRecord(ringing, { ...ringing })?.status).toBe('answered')
})

test('answered by the shell, app killed mid-call: after relaunch the peer hangup is ended (RC3b B2)', () => {
	const ringing = { ...base, callId: 'c-killed', sessionId: 's-killed' }
	noteNativeCallAnswered('c-killed', 's-killed', Date.now() - 45_000)
	// Only ids and times are saved.
	const saved = JSON.parse(localStorage.getItem(NATIVE_ANSWERED_STORAGE_KEY) || '[]') as Array<[string, number]>
	expect(saved.map(([id]) => id)).toEqual(expect.arrayContaining(['c-killed', 's-killed']))
	// Relaunch: memory is gone, the saved mark is read back.
	reloadNativeAnsweredForTests()
	expect(phoneCallStatusForPeerHangup(ringing)).toBe('ended')
	expect(mergePhoneCallRecord(ringing, { ...ringing, status: 'cancelled', endedAt: Date.now() })?.status).toBe('ended')
})

test('saved shell answers older than 3 days or unreadable are dropped on relaunch', () => {
	localStorage.setItem(NATIVE_ANSWERED_STORAGE_KEY, JSON.stringify([['c-old', Date.now() - 4 * 24 * 60 * 60_000], ['bad'], 7]))
	reloadNativeAnsweredForTests()
	expect(phoneCallStatusForPeerHangup({ ...base, callId: 'c-old', sessionId: '' })).toBe('cancelled')
	localStorage.setItem(NATIVE_ANSWERED_STORAGE_KEY, '{not json')
	reloadNativeAnsweredForTests()
	expect(phoneCallStatusForPeerHangup({ ...base, callId: 'c-old', sessionId: '' })).toBe('cancelled')
})
