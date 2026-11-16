import { openCashcodeInNewTab } from './openCashcodeInNewTab'

describe('openCashcodeInNewTab: cashcode links map to beamio.ca before opening', () => {
	let fetchSpy: jest.Mock
	let xhrOpenSpy: jest.SpyInstance
	const originalFetch = (globalThis as { fetch?: unknown }).fetch

	beforeEach(() => {
		fetchSpy = jest.fn()
		;(globalThis as { fetch?: unknown }).fetch = fetchSpy
		xhrOpenSpy = jest.spyOn(XMLHttpRequest.prototype, 'open')
	})

	afterEach(() => {
		;(globalThis as { fetch?: unknown }).fetch = originalFetch
		xhrOpenSpy.mockRestore()
	})

	test.each([
		['https://beamio.app/app/?cashcode=ABC', 'https://beamio.ca/app/?cashcode=ABC'],
		['http://beamio.app/app/?cashcode=ABC', 'https://beamio.ca/app/?cashcode=ABC'],
		['https://biz.beamio.app/biz/?cashcode=ABC', 'https://biz.beamio.ca/biz/?cashcode=ABC'],
		['https:/beamio.app/app/?cashcode=ABC', 'https://beamio.ca/app/?cashcode=ABC'],
		['https://beamio.ca/app/?cashcode=ABC', 'https://beamio.ca/app/?cashcode=ABC'],
	])('opens %s as %s', (input, expected) => {
		const open = jest.fn()
		expect(openCashcodeInNewTab(input, open)).toBe(true)
		expect(open).toHaveBeenCalledTimes(1)
		expect(open).toHaveBeenCalledWith(expected)
		expect(String(open.mock.calls[0][0]).toLowerCase()).not.toContain('beamio.app')
		expect(fetchSpy).not.toHaveBeenCalled()
		expect(xhrOpenSpy).not.toHaveBeenCalled()
	})

	test.each(['not a url', 'javascript:alert(1)', ''])('does not open %j', (input) => {
		const open = jest.fn()
		expect(openCashcodeInNewTab(input, open)).toBe(false)
		expect(open).not.toHaveBeenCalled()
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('default opener calls window.open with the mapped href, noopener and noreferrer', () => {
		const winOpen = jest.spyOn(window, 'open').mockImplementation(() => null)
		try {
			expect(openCashcodeInNewTab('https://beamio.app/app/?cashcode=ABC')).toBe(true)
			expect(winOpen).toHaveBeenCalledWith('https://beamio.ca/app/?cashcode=ABC', '_blank', 'noopener,noreferrer')
		} finally {
			winOpen.mockRestore()
		}
	})
})
