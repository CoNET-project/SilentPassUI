import { buildNativePgpPostPayload } from './cashTreesNativeNfc'

// Hoisted above the import by Jest.
jest.mock('@/services/beamioTagWorkerBridge', () => ({}), { virtual: true })

test('a dial offer post tells the shell it is the offer', () => {
	expect(buildNativePgpPostPayload('r1', 'armor', [' 1.2.3.4 ', ''], 'voice-offer')).toEqual({
		requestId: 'r1',
		data: 'armor',
		excludeIps: ['1.2.3.4'],
		purpose: 'voice-offer',
	})
})

test('other posts carry no purpose', () => {
	expect(buildNativePgpPostPayload('r2', 'armor')).toEqual({ requestId: 'r2', data: 'armor', excludeIps: [] })
	expect('purpose' in buildNativePgpPostPayload('r3', 'armor', [])).toBe(false)
})
