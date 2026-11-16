import { parseFragmentHashFromUrl } from './ipfsImageLibrary'
import { mapLegacyBeamioLink } from './legacyBeamioLinks'

const HASH = '0x' + 'ab'.repeat(32)

describe('legacy fragment links are recognized locally and never requested from the old host', () => {
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
		`https://beamio.app/api/fragment?hash=${HASH}`,
		`http://www.beamio.app/api/fragment?hash=${HASH}`,
		`https://biz.beamio.app/api/fragment?hash=${HASH}`,
	])('recognizes %s', (url) => {
		expect(parseFragmentHashFromUrl(url)).toBe(HASH)
		expect(fetchSpy).not.toHaveBeenCalled()
		expect(xhrOpenSpy).not.toHaveBeenCalled()
	})

	test('still recognizes the current ipfs getFragment form', () => {
		expect(parseFragmentHashFromUrl(`https://ipfs.conet.network/api/getFragment?hash=${HASH}`)).toBe(HASH)
	})

	test.each([
		`https://cashtrees.beamio.app/api/fragment?hash=${HASH}`,
		`https://beamio.app:8443/api/fragment?hash=${HASH}`,
		`https://user:pw@beamio.app/api/fragment?hash=${HASH}`,
		`https://beamio.app/api/other?hash=${HASH}`,
		`https://beamio.app.evil.com/api/fragment?hash=${HASH}`,
		`https://evilbeamio.app/api/fragment?hash=${HASH}`,
	])('rejects %s', (url) => {
		expect(parseFragmentHashFromUrl(url)).toBeNull()
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('a mapped legacy link never points at the old host', () => {
		const mapped = mapLegacyBeamioLink(`https://beamio.app/api/fragment?hash=${HASH}`)
		expect(mapped).toBe(`https://beamio.ca/api/fragment?hash=${HASH}`)
		expect(new URL(mapped as string).hostname.endsWith('beamio.app')).toBe(false)
	})
})
