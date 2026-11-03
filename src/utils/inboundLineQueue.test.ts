import { dropTakenInboundLines } from './inboundLineQueue'

describe('dropTakenInboundLines', () => {
	it('keeps a line that arrived after the render the queue effect saw', () => {
		// Two mailbox lines 12 ms apart: the effect saw [a], b was appended before it cleared.
		expect(dropTakenInboundLines(['a', 'b'], ['a'])).toEqual(['b'])
	})

	it('empties the list when everything was taken', () => {
		expect(dropTakenInboundLines(['a', 'b'], ['a', 'b'])).toEqual([])
	})

	it('removes a taken line once when it is no longer the prefix', () => {
		expect(dropTakenInboundLines(['b', 'a', 'c'], ['a'])).toEqual(['b', 'c'])
		// The same effect running twice for one render must not drop the newer line.
		expect(dropTakenInboundLines(['b'], ['a'])).toEqual(['b'])
	})

	it('keeps a duplicate copy that arrived later', () => {
		expect(dropTakenInboundLines(['a', 'a'], ['a'])).toEqual(['a'])
	})

	it('nothing taken leaves the list as is', () => {
		expect(dropTakenInboundLines(['a'], [])).toEqual(['a'])
	})
})
