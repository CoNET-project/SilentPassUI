// Pure helpers; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))
const dispatched: Array<{ action: string; payload: Record<string, unknown> }> = []
jest.mock('./cashTreesNativeNfc', () => ({
	dispatchNativeSystemCallAction: (action: string, payload: Record<string, unknown>) => {
		dispatched.push({ action, payload })
		return true
	},
}))

import {
	askShellWhichIncomingCallsRang,
	markIncomingCallNeverRang,
	mergePhoneCallRecord,
	noteNativeCallAnswered,
	phoneCallStatusForPeerHangup,
	takeIncomingCallsToAskRang,
} from './voiceCallSession'

const now = Date.now()
const row = (id: string, extra: Partial<PhoneCallRecord> = {}): PhoneCallRecord => ({
	callId: `c-${id}`,
	sessionId: `s-${id}`,
	peerAddress: '0x0000000000000000000000000000000000000001',
	direction: 'incoming',
	status: 'cancelled',
	createdAt: now - 60_000,
	endedAt: now - 50_000,
	...extra,
})

beforeEach(() => {
	dispatched.length = 0
})

test('T11: a cancelled incoming call that never rang becomes "missed"', () => {
	const rows = [row('t11')]
	const next = markIncomingCallNeverRang(rows, { callId: 'c-t11', sessionId: 's-t11' })
	expect(next?.[0]).toMatchObject({ status: 'missed', endedAt: now - 50_000, direction: 'incoming' })
})

test("the caller's side and other outcomes are never changed", () => {
	expect(markIncomingCallNeverRang([row('o1', { direction: 'outgoing' })], { sessionId: 's-o1' })).toBeNull()
	expect(markIncomingCallNeverRang([row('o2', { status: 'declined' })], { sessionId: 's-o2' })).toBeNull()
	expect(markIncomingCallNeverRang([row('o3', { status: 'ended' })], { sessionId: 's-o3' })).toBeNull()
	expect(markIncomingCallNeverRang([row('o4')], { sessionId: 'unknown' })).toBeNull()
})

test('a call the shell answered is not marked missed', () => {
	noteNativeCallAnswered('c-ans', 's-ans', now - 55_000)
	expect(markIncomingCallNeverRang([row('ans')], { sessionId: 's-ans' })).toBeNull()
})

test('each incoming cancelled row is asked about once, with createdAt in ms', () => {
	const rows = [
		row('q1'),
		row('q2', { createdAt: Math.floor((now - 120_000) / 1000) }), // seconds
		row('q3', { direction: 'outgoing' }),
		row('q4', { status: 'ringing' }),
		row('q5', { createdAt: now - 4 * 24 * 60 * 60_000 }), // older than the shell keeps
	]
	const first = takeIncomingCallsToAskRang(rows, now)
	expect(first.map(c => c.sessionId)).toEqual(['s-q1', 's-q2'])
	expect(first[1].createdAt).toBe(Math.floor((now - 120_000) / 1000) * 1000)
	expect(takeIncomingCallsToAskRang(rows, now)).toEqual([])
})

test('the query goes to the shell as queryIncomingCallOutcome', () => {
	expect(askShellWhichIncomingCallsRang([row('d1'), row('d2')])).toBe(2)
	expect(dispatched).toHaveLength(1)
	expect(dispatched[0].action).toBe('queryIncomingCallOutcome')
	expect((dispatched[0].payload.calls as unknown[]).length).toBe(2)
	expect(askShellWhichIncomingCallsRang([row('d1')])).toBe(0)
	expect(dispatched).toHaveLength(1)
})

test('a redelivered caller end keeps "missed"; a call that rang stays "cancelled"', () => {
	// Only the shell's "never rang" answer is final; a late-offer guess is not.
	const missed = row('r1', { status: 'missed', neverRang: true })
	expect(phoneCallStatusForPeerHangup(missed)).toBe('missed')
	expect(phoneCallStatusForPeerHangup(row('r3', { status: 'missed' }))).toBe('cancelled')
	expect(mergePhoneCallRecord(missed, { ...missed, status: phoneCallStatusForPeerHangup(missed) })?.status).toBe('missed')
	expect(phoneCallStatusForPeerHangup(row('r2', { status: 'ringing' }))).toBe('cancelled')
})
