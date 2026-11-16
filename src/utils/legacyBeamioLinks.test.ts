import { mapLegacyBeamioLink, resolveBeamioHttpHref, resolveBeamioLinkInput, resolveBeamioUrl } from './legacyBeamioLinks'

describe('mapLegacyBeamioLink: legacy beamio.app links map to beamio.ca', () => {
	test.each([
		['https://beamio.app/Vouchers?Amount=12.5&currency=USDC&acceptTokens=USDC&to=0xabc#x', 'https://beamio.ca/Vouchers?Amount=12.5&currency=USDC&acceptTokens=USDC&to=0xabc#x'],
		['http://beamio.app/Vouchers?Amount=1', 'https://beamio.ca/Vouchers?Amount=1'],
		['https://BEAMIO.APP/app/?beamiocard=0xA&redeemcode=AbC', 'https://beamio.ca/app/?beamiocard=0xA&redeemcode=AbC'],
		['https://www.beamio.app/help', 'https://beamio.ca/help'],
		['https://beamio.app', 'https://beamio.ca/'],
		['https://beamio.app.', 'https://beamio.ca/'],
		['https://beamio.app/app-download?target=https%3A%2F%2Fbeamio.app%2Fapp%2F', 'https://beamio.ca/app-download?target=https%3A%2F%2Fbeamio.app%2Fapp%2F'],
		['https://beamio.app?beamio=alice', 'https://beamio.ca/?beamio=alice'],
	])('absolute %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
	})

	test.each([
		['https://biz.beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['https://biz.beamio.app/biz/?tab=members#top', 'https://biz.beamio.ca/biz/?tab=members#top'],
		['http://biz.beamio.app/', 'https://biz.beamio.ca/'],
	])('biz host %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
	})

	test.each([
		['beamio.app/Vouchers?Amount=1', 'https://beamio.ca/Vouchers?Amount=1'],
		['www.beamio.app/help', 'https://beamio.ca/help'],
		['biz.beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['beamio.app?beamiocard=0x1&redeemcode=abc', 'https://beamio.ca/?beamiocard=0x1&redeemcode=abc'],
		['cashtrees.beamio.app/x', 'https://beamio.ca/x'],
	])('scheme-less %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
	})

	test('mapped output never names the old host', () => {
		const inputs = [
			'https://beamio.app/x', 'http://beamio.app/x', 'https://www.beamio.app/x', 'https://biz.beamio.app/x',
			'beamio.app/x', 'www.beamio.app?y=1',
		]
		for (const input of inputs) {
			const out = mapLegacyBeamioLink(input)
			expect(out).not.toBeNull()
			const host = new URL(out as string).hostname
			expect(['beamio.ca', 'biz.beamio.ca']).toContain(host)
			expect(out).not.toMatch(/beamio\.app/i)
		}
	})
})

describe('mapLegacyBeamioLink: every beamio.app subdomain is in scope (same as a5cf3613)', () => {
	test.each([
		['https://cashtrees.beamio.app/x', 'https://beamio.ca/x'],
		['https://api.beamio.app/api/x', 'https://beamio.ca/api/x'],
		['https://x.biz.beamio.app/', 'https://beamio.ca/'],
		['https://biz.beamio.app/biz/?a=1', 'https://biz.beamio.ca/biz/?a=1'],
	])('%s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
	})
})

describe('mapLegacyBeamioLink: refuses anything that is not a legacy beamio.app link', () => {
	test.each([
		'https://beamio.app.evil.com/Vouchers?Amount=1',
		'https://evilbeamio.app/Vouchers?Amount=1',
		'https://notbeamio.app/',
		'https://beamio.appx/',
		'https://beamio.app-evil.com/',
		'https://x.beamio.app.evil.com/',
		'https://evil.com/beamio.app/x',
		'https://beamio.app@evil.com/Vouchers?Amount=1',
		'https://evil.com@beamio.app/x',
		'https://beamio.app:8443/x',
		'https://example.com/?u=https://beamio.app/x',
		'beamio.app.evil.com/Vouchers',
		'javascript:alert("beamio.app")',
		'data:text/html,beamio.app',
		'ftp://beamio.app/x',
		'beamio.app',
		'https://beamio.ca/Vouchers?Amount=1',
		'beamio.ca/Vouchers?x=1',
		'/Vouchers?Amount=1',
		'?beamiocard=0x1&redeemcode=abc',
		'not a url',
		'',
		'   ',
	])('returns null for %j', (input) => {
		expect(mapLegacyBeamioLink(input)).toBeNull()
	})

	test('returns null for non-string input', () => {
		expect(mapLegacyBeamioLink(undefined as unknown as string)).toBeNull()
		expect(mapLegacyBeamioLink(null as unknown as string)).toBeNull()
	})

	test('does not call the network', () => {
		const fetchSpy = jest.fn()
		const original = (globalThis as { fetch?: unknown }).fetch
		;(globalThis as { fetch?: unknown }).fetch = fetchSpy
		try {
			mapLegacyBeamioLink('https://beamio.app/Vouchers?Amount=1')
			resolveBeamioLinkInput('https://biz.beamio.app/biz/')
			expect(fetchSpy).not.toHaveBeenCalled()
		} finally {
			;(globalThis as { fetch?: unknown }).fetch = original
		}
	})
})

describe('resolveBeamioLinkInput', () => {
	test('maps a legacy link', () => {
		expect(resolveBeamioLinkInput('https://beamio.app/Vouchers?Amount=1')).toBe('https://beamio.ca/Vouchers?Amount=1')
	})

	test('returns other input unchanged', () => {
		expect(resolveBeamioLinkInput('/Vouchers?Amount=1')).toBe('/Vouchers?Amount=1')
		expect(resolveBeamioLinkInput('https://beamio.ca/app/?beamiocard=0x1')).toBe('https://beamio.ca/app/?beamiocard=0x1')
		expect(resolveBeamioLinkInput('ipfs-search text')).toBe('ipfs-search text')
	})
})

describe('resolveBeamioUrl: no parsed URL keeps the old host', () => {
	test.each([
		['//beamio.app/x', 'https://beamio.ca/x', 'https://beamio.ca'],
		['https:/beamio.app/x', 'https://beamio.ca/x', undefined],
		['https://beamio.app\\Vouchers?x=1', 'https://beamio.ca/Vouchers?x=1', undefined],
		['https://user:pw@beamio.app/x', 'https://beamio.ca/x', undefined],
		['https://beamio.app:8443/x', 'https://beamio.ca/x', undefined],
		['/Vouchers?Amount=1', 'https://beamio.ca/Vouchers?Amount=1', 'https://beamio.ca'],
		['https://example.com/a', 'https://example.com/a', undefined],
	])('%s', (input, expected, base) => {
		expect(resolveBeamioUrl(input, base).href).toBe(expected)
	})

	test('throws for text that is not a URL, like new URL', () => {
		expect(() => resolveBeamioUrl('plain text')).toThrow()
	})
})

describe('resolveBeamioHttpHref', () => {
	test('maps legacy hosts and returns http(s) hrefs only', () => {
		expect(resolveBeamioHttpHref('https:/beamio.app/x')).toBe('https://beamio.ca/x')
		expect(resolveBeamioHttpHref('javascript:alert(1)')).toBeNull()
		expect(resolveBeamioHttpHref('plain text')).toBeNull()
	})
})

