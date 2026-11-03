import {
	browserVoiceCallBusyFor,
	BUSY_HOLD_MS,
	callWindowHoldMs,
	mergePhoneCallRecord,
	pageEndsSystemCall,
	registerBrowserVoiceCallProbe,
} from './voiceCallSession'
import { closeSettledIncomingCalls, incomingSettledStatusForAction, noteIncomingCallSettled } from './voiceCallSession'

// The record helpers are pure; stub the worker bridge that voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))


const row = (status: PhoneCallRecord['status'], extra: Partial<PhoneCallRecord> = {}): PhoneCallRecord => ({
	callId: 'c1',
	sessionId: 's1',
	peerAddress: '0xpeer',
	direction: 'outgoing',
	status,
	createdAt: 1_000,
	...extra,
})

describe('busy call records', () => {
	it('a later plain decline does not hide busy', () => {
		expect(mergePhoneCallRecord(row('busy'), row('declined'))?.status).toBe('busy')
		expect(mergePhoneCallRecord(row('declined'), row('busy'))?.status).toBe('busy')
	})
	it('an answered call never ends as busy', () => {
		expect(mergePhoneCallRecord(row('answered', { answeredAt: 2_000 }), row('busy'))?.status).toBe('ended')
	})
})

describe('browser busy probe', () => {
	afterEach(() => registerBrowserVoiceCallProbe(null))
	it('no probe or no live call: not busy', () => {
		expect(browserVoiceCallBusyFor({ callId: 'x', sessionId: 'y' })).toBe(false)
		registerBrowserVoiceCallProbe(() => ({ live: false }))
		expect(browserVoiceCallBusyFor({ callId: 'x', sessionId: 'y' })).toBe(false)
	})
	it('another call while live: busy; the same call: not busy', () => {
		registerBrowserVoiceCallProbe(() => ({ live: true, callId: 'c1', sessionId: 's1' }))
		expect(browserVoiceCallBusyFor({ callId: 'c2', sessionId: 's2' })).toBe(true)
		expect(browserVoiceCallBusyFor({ callId: 'c1', sessionId: 's9' })).toBe(false)
		expect(browserVoiceCallBusyFor({ callId: 'c9', sessionId: 's1' })).toBe(false)
	})
	it('dialing before the offer exists: any offer is busy', () => {
		registerBrowserVoiceCallProbe(() => ({ live: true }))
		expect(browserVoiceCallBusyFor({ callId: 'c2', sessionId: 's2' })).toBe(true)
	})
})


describe('busy rejects on the callee (Missed call · While on another call)', () => {
	const incoming = (status: PhoneCallRecord['status'], id: string, extra: Partial<PhoneCallRecord> = {}): PhoneCallRecord => ({
		callId: `c-${id}`,
		sessionId: `s-${id}`,
		peerAddress: '0xcaller',
		direction: 'incoming',
		status,
		createdAt: 1_000,
		...extra,
	})
	it('the shell action maps to busy', () => {
		expect(incomingSettledStatusForAction('callBusyRejected')).toBe('busy')
		expect(incomingSettledStatusForAction('callRejected')).toBe('declined')
	})
	it('a ringing row the shell rejected as busy becomes busy', () => {
		noteIncomingCallSettled('c-b1', 's-b1', 'busy', 2_000)
		const next = closeSettledIncomingCalls([incoming('ringing', 'b1')])
		expect(next?.[0].status).toBe('busy')
		expect(next?.[0].endedAt).toBe(2_000)
	})
	it('a later "missed" or "declined" row for the same call becomes busy', () => {
		noteIncomingCallSettled('c-b2', 's-b2', 'busy', 3_000)
		expect(closeSettledIncomingCalls([incoming('missed', 'b2')])?.[0].status).toBe('busy')
		noteIncomingCallSettled('c-b3', 's-b3', 'busy', 3_000)
		expect(closeSettledIncomingCalls([incoming('declined', 'b3')])?.[0].status).toBe('busy')
	})
	it('later end / cancel / decline messages do not overwrite busy', () => {
		for (const later of ['cancelled', 'ended', 'declined', 'timed_out', 'missed'] as const) {
			expect(mergePhoneCallRecord(incoming('busy', 'b4'), incoming(later, 'b4'))?.status).toBe('busy')
		}
	})
	it('an answered incoming call is not turned into busy', () => {
		noteIncomingCallSettled('c-b5', 's-b5', 'busy', 4_000)
		expect(closeSettledIncomingCalls([incoming('answered', 'b5', { answeredAt: 1_500 })])).toBeNull()
	})
	it('a busy outgoing record keeps busy against a later end', () => {
		const out = { ...incoming('busy', 'b6'), direction: 'outgoing' as const }
		expect(mergePhoneCallRecord(out, { ...out, status: 'ended' })?.status).toBe('busy')
	})
})

describe('busy hold on the caller (RC3b I4 follow-up)', () => {
	it('inside a native shell the page leaves ending the system call to the dialer on busy', () => {
		expect(pageEndsSystemCall('busy', true)).toBe(false)
		expect(pageEndsSystemCall('declined', true)).toBe(true)
		expect(pageEndsSystemCall('cancelled', true)).toBe(true)
		expect(pageEndsSystemCall(undefined, true)).toBe(true)
		expect(pageEndsSystemCall('busy', false)).toBe(true)
	})

	it('the browser keeps the call window up for the busy tone only', () => {
		expect(callWindowHoldMs('busy', false)).toBe(BUSY_HOLD_MS)
		expect(BUSY_HOLD_MS).toBe(3_000)
		expect(callWindowHoldMs('declined', false)).toBe(0)
		expect(callWindowHoldMs('busy', true)).toBe(0)
	})
})
