import { syncImgSrcFor } from './legacyAwareImgSrc'

const HASH = '0x' + 'ab'.repeat(32)

describe('syncImgSrcFor: image sources never load from the legacy host', () => {
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
		[undefined, ''],
		['', ''],
		['   ', ''],
		['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
		['blob:https://beamio.ca/1234', 'blob:https://beamio.ca/1234'],
		['https://example.com/a.png', 'https://example.com/a.png'],
		['https://beamio.ca/uploads/a.png', 'https://beamio.ca/uploads/a.png'],
	])('%j is returned as %j', (input, expected) => {
		expect(syncImgSrcFor(input)).toBe(expected)
	})

	test.each([
		['https://beamio.app/uploads/a.png', 'https://beamio.ca/uploads/a.png'],
		['http://www.beamio.app/uploads/a.png', 'https://beamio.ca/uploads/a.png'],
		['https://biz.beamio.app/biz/a.png', 'https://biz.beamio.ca/biz/a.png'],
		['https://beamio.app/biz/a.png', 'https://biz.beamio.ca/biz/a.png'],
		['beamio.app/uploads/a.png', 'https://beamio.ca/uploads/a.png'],
	])('legacy non-fragment %s is mapped to %s before loading', (input, expected) => {
		expect(syncImgSrcFor(input)).toBe(expected)
		expect(fetchSpy).not.toHaveBeenCalled()
		expect(xhrOpenSpy).not.toHaveBeenCalled()
	})

	test('legacy fragment URLs go to the IPFS library path, not to the image src', () => {
		expect(syncImgSrcFor(`https://beamio.app/api/fragment?hash=${HASH}`)).toBeNull()
		expect(syncImgSrcFor(`https://ipfs.conet.network/api/getFragment?hash=${HASH}`)).toBeNull()
	})
})
