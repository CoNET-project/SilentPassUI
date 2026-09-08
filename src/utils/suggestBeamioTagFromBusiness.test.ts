import { beamioTagCandidatesFromBusiness, resolveRegistrableBeamioTagFromBusiness } from './suggestBeamioTagFromBusiness'

describe('beamioTagCandidatesFromBusiness', () => {
	test('A&S Fusion Restro + Bar prefers asfusion over marketplace host', () => {
		const tags = beamioTagCandidatesFromBusiness(
			'A&amp;S Fusion Restro + Bar',
			'https://www.ubereats.com/ca/store/asfusionrestroplusbar/abc',
		)
		expect(tags[0]).toBe('asfusion')
		expect(tags.every((t) => !t.includes('-'))).toBe(true)
		expect(tags.some((t) => t.includes('ubereats'))).toBe(false)
	})

	test("Joe's Pizza keeps the brand word pizza", () => {
		expect(beamioTagCandidatesFromBusiness("Joe's Pizza")[0]).toBe('joespizza')
	})

	test('rejects names that cannot yield a 3–26 character tag', () => {
		expect(beamioTagCandidatesFromBusiness('AB')).toEqual([])
		expect(beamioTagCandidatesFromBusiness('A')).toEqual([])
	})
})

describe('resolveRegistrableBeamioTagFromBusiness', () => {
	test('returns the first available candidate', async () => {
		const taken = new Set(['asfusion'])
		const result = await resolveRegistrableBeamioTagFromBusiness({
			name: 'A&S Fusion Restro + Bar',
			isAvailable: async (tag) => !taken.has(tag),
		})
		expect(result).toEqual({ tag: 'asfusionrestrobar', availability: 'available' })
	})

	test('appends a numeric suffix when the compact name is taken', async () => {
		const taken = new Set(['asfusion', 'asfusionrestrobar', 'asfusion', 'asfusionrestro', 'asfusionbar', 'as'])
		const result = await resolveRegistrableBeamioTagFromBusiness({
			name: 'A&S Fusion Restro + Bar',
			isAvailable: async (tag) => !taken.has(tag) && tag !== 'asfusion',
		})
		expect(result.availability).toBe('available')
		expect(result.tag).toMatch(/^asfusion\d+$/)
	})

	test('does not mark a slug available when the probe throws', async () => {
		const result = await resolveRegistrableBeamioTagFromBusiness({
			name: "Joe's Pizza",
			isAvailable: async () => {
				throw new Error('UNABLE_TO_VERIFY_HANDLE_ONCHAIN')
			},
		})
		expect(result).toEqual({ tag: 'joespizza', availability: 'unverified' })
	})
})
