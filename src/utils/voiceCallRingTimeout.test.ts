// Pure helpers; stub the modules voiceCallSession imports.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })
jest.mock('./cashTreesNativePwaLog', () => ({ publishNativePwaLog: () => {} }))
jest.mock('./cashTreesNativeNfc', () => ({ dispatchNativeSystemCallAction: () => true }))

import { noteNativeCallAnswered, voiceRingTimeoutApplies } from './voiceCallSession'

// The page's ring-window fallback must never end a connected call (0.52.926:
// every call was cut 70 s after the dial in the shells, 60 s in a browser).
const now = Date.now()
const record = (id: string, extra: Partial<PhoneCallRecord> = {}): PhoneCallRecord => ({
	callId: `c-${id}`,
	sessionId: `s-${id}`,
	peerAddress: '0x0000000000000000000000000000000000000001',
	direction: 'outgoing',
	status: 'ringing',
	createdAt: now - 70_000,
	...extra,
})
const ids = (id: string) => ({ callId: `c-${id}`, sessionId: `s-${id}` })

describe('voiceRingTimeoutApplies', () => {
	test('unanswered dial: the ring window still ends it', () => {
		expect(voiceRingTimeoutApplies({ answered: false, ...ids('none'), record: record('none') })).toBe(true)
		expect(voiceRingTimeoutApplies({ answered: false, ...ids('none2') })).toBe(true)
	})

	test('caller, browser: the page took the accept', () => {
		expect(voiceRingTimeoutApplies({ answered: true, ...ids('cb'), record: record('cb') })).toBe(false)
	})

	test('caller, shell: the shell took the accept, the page row still says ringing', () => {
		noteNativeCallAnswered('c-cs', 's-cs')
		expect(voiceRingTimeoutApplies({ answered: false, ...ids('cs'), record: record('cs') })).toBe(false)
	})

	test('caller, shell: the shell mark matches by session id alone', () => {
		noteNativeCallAnswered('', 's-cs2')
		expect(voiceRingTimeoutApplies({ answered: false, ...ids('cs2') })).toBe(false)
	})

	test('callee, browser: answered in the chat page', () => {
		expect(voiceRingTimeoutApplies({
			answered: true,
			...ids('eb'),
			record: record('eb', { direction: 'incoming', status: 'answered', answeredAt: now - 50_000 }),
		})).toBe(false)
	})

	test('callee, shell: the record says answered before the page state does', () => {
		expect(voiceRingTimeoutApplies({
			answered: false,
			...ids('es'),
			record: record('es', { direction: 'incoming', status: 'answered' }),
		})).toBe(false)
		expect(voiceRingTimeoutApplies({
			answered: false,
			...ids('es2'),
			record: record('es2', { direction: 'incoming', answeredAt: now - 40_000 }),
		})).toBe(false)
	})

	test('another call answered by the shell does not stop this one timing out', () => {
		noteNativeCallAnswered('c-other', 's-other')
		expect(voiceRingTimeoutApplies({ answered: false, ...ids('mine'), record: record('mine') })).toBe(true)
	})
})
