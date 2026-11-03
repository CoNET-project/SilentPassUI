// Pure helpers; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))

import {
	closeSettledIncomingCalls,
	incomingSettledStatusForAction,
	noteIncomingCallSettled,
	noteNativeCallAnswered,
	withSettledIncomingOutcome,
} from './voiceCallSession'

const ringing = (callId: string, sessionId: string, extra: Partial<PhoneCallRecord> = {}): PhoneCallRecord => ({
	callId,
	sessionId,
	peerAddress: '0x0000000000000000000000000000000000000001',
	direction: 'incoming',
	status: 'ringing',
	createdAt: 1_000,
	...extra,
})

test('shell actions map to unanswered outcomes; others map to none', () => {
	expect(incomingSettledStatusForAction('callEnded')).toBe('cancelled')
	expect(incomingSettledStatusForAction('callTimedOut')).toBe('timed_out')
	expect(incomingSettledStatusForAction('callRejected')).toBe('declined')
	expect(incomingSettledStatusForAction('callAnswered')).toBeNull()
	expect(incomingSettledStatusForAction(undefined)).toBeNull()
})

test('the shell outcome arrives first; the replayed offer row closes when stored', () => {
	// Killed process: the shell ended call A when the same caller rang again.
	// On open, its outcome can reach the page before the inbox replays offer A.
	noteIncomingCallSettled('callA', 'sessA', 'cancelled', 5_000)
	const rows = [ringing('callA', 'sessA'), ringing('callB', 'sessB', { createdAt: 2_000 })]
	const closed = closeSettledIncomingCalls(rows)
	expect(closed).not.toBeNull()
	expect(closed!.find(r => r.callId === 'callA')).toMatchObject({ status: 'cancelled', endedAt: 5_000 })
	// The new call from the same caller keeps ringing.
	expect(closed!.find(r => r.callId === 'callB')?.status).toBe('ringing')
})

test('a match on sessionId alone is enough', () => {
	noteIncomingCallSettled('', 'sessC', 'cancelled', 7_000)
	expect(withSettledIncomingOutcome(ringing('otherCallId', 'sessC')).status).toBe('cancelled')
})

test('nothing to close returns null (no store, no re-render)', () => {
	expect(closeSettledIncomingCalls([ringing('callZ', 'sessZ')])).toBeNull()
	expect(closeSettledIncomingCalls([])).toBeNull()
	expect(closeSettledIncomingCalls(undefined)).toBeNull()
})

test('only ringing incoming rows change', () => {
	noteIncomingCallSettled('callD', 'sessD', 'cancelled')
	const outgoing = ringing('callD', 'sessD', { direction: 'outgoing' })
	const declined = ringing('callD', 'sessD', { status: 'declined', endedAt: 3_000 })
	expect(withSettledIncomingOutcome(outgoing)).toBe(outgoing)
	expect(withSettledIncomingOutcome(declined)).toBe(declined)
})

test('a call the shell answered ends as "ended", never "cancelled"', () => {
	noteNativeCallAnswered('callE', 'sessE', 4_000)
	noteIncomingCallSettled('callE', 'sessE', 'cancelled', 9_000)
	expect(withSettledIncomingOutcome(ringing('callE', 'sessE')).status).toBe('ended')
})

test('timeout and decline outcomes are kept as they are', () => {
	noteIncomingCallSettled('callF', 'sessF', 'timed_out', 8_000)
	noteIncomingCallSettled('callG', 'sessG', 'declined', 8_000)
	expect(withSettledIncomingOutcome(ringing('callF', 'sessF')).status).toBe('timed_out')
	expect(withSettledIncomingOutcome(ringing('callG', 'sessG')).status).toBe('declined')
})

test('outcomes that are not "unanswered" are ignored', () => {
	noteIncomingCallSettled('callH', 'sessH', 'ended')
	noteIncomingCallSettled('callI', 'sessI', 'answered')
	expect(withSettledIncomingOutcome(ringing('callH', 'sessH')).status).toBe('ringing')
	expect(withSettledIncomingOutcome(ringing('callI', 'sessI')).status).toBe('ringing')
})

test('the first outcome for a call wins', () => {
	noteIncomingCallSettled('callJ', 'sessJ', 'cancelled', 1_500)
	noteIncomingCallSettled('callJ', 'sessJ', 'timed_out', 9_500)
	expect(withSettledIncomingOutcome(ringing('callJ', 'sessJ'))).toMatchObject({ status: 'cancelled', endedAt: 1_500 })
})
