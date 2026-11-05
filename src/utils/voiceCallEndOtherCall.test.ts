import { endHintTargetsOtherCall } from './voiceCallSession'

// The helper is pure; stub the worker bridge that voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))

// 2026-11-05 store-shell test: while the page dialed (callId D), a replayed
// voice_end_v1 for an older incoming offer (callId A) ended the dial with no
// cancel, so the callee kept ringing. An end that names another call must
// leave the current call alone.
describe('endHintTargetsOtherCall', () => {
	const dial = ['dial-call', 'dial-session', 'own-voice', 'peer-voice']

	it('replayed cancel of an older incoming offer during a dial is another call', () => {
		expect(endHintTargetsOtherCall({ callId: 'old-call', sessionId: 'old-session' }, dial)).toBe(true)
		expect(endHintTargetsOtherCall({ sessionId: 'old-session' }, dial)).toBe(true)
	})

	it('an end for the current call matches by any of its ids', () => {
		expect(endHintTargetsOtherCall({ callId: 'dial-call' }, dial)).toBe(false)
		expect(endHintTargetsOtherCall({ sessionId: 'dial-session' }, dial)).toBe(false)
		// Peer hang-up names the peer's own session; the callId still matches.
		expect(endHintTargetsOtherCall({ callId: 'dial-call', sessionId: 'their-session' }, dial)).toBe(false)
		expect(endHintTargetsOtherCall({ sessionId: 'peer-voice' }, dial)).toBe(false)
		expect(endHintTargetsOtherCall({ callId: ' dial-call ' }, dial)).toBe(false)
	})

	it('an end with no ids means the current call', () => {
		expect(endHintTargetsOtherCall(undefined, dial)).toBe(false)
		expect(endHintTargetsOtherCall({}, dial)).toBe(false)
		expect(endHintTargetsOtherCall({ callId: '  ', sessionId: '' }, dial)).toBe(false)
	})

	it('with no current call the end goes ahead (nothing to protect)', () => {
		expect(endHintTargetsOtherCall({ callId: 'old-call' }, [])).toBe(false)
		expect(endHintTargetsOtherCall({ callId: 'old-call' }, [null, undefined, ''])).toBe(false)
	})

	it('a dial still being set up has no ids yet: any named call is another one', () => {
		expect(endHintTargetsOtherCall({ callId: 'old-call', sessionId: 'old-session' }, [], true)).toBe(true)
		// Cancel of the dial being set up carries no ids.
		expect(endHintTargetsOtherCall({}, [], true)).toBe(false)
	})
})
