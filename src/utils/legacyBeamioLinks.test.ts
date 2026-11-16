import { mapLegacyBeamioLink, resolveBeamioHttpHref, resolveBeamioUrl, resolveOutboundHref, outboundSrc } from './legacyBeamioLinks'

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

describe('B-10: only apex, www and biz are mapped; other subdomains are not recognized', () => {
	test.each([
		['https://cashtrees.beamio.app/x', 'https://beamio.ca/x'],
		['https://api.beamio.app/api/x', 'https://beamio.ca/api/x'],
		['https://x.biz.beamio.app/', 'https://beamio.ca/'],
	])('%s is not mapped (refused)', (input) => {
		expect(mapLegacyBeamioLink(input)).toBeNull()
		expect(() => resolveBeamioUrl(input)).toThrow()
		expect(resolveBeamioHttpHref(input)).toBeNull()
		expect(resolveOutboundHref(input)).toBeNull()
	})

	test('biz and www keep their mapping', () => {
		expect(mapLegacyBeamioLink('https://biz.beamio.app/biz/?a=1')).toBe('https://biz.beamio.ca/biz/?a=1')
		expect(mapLegacyBeamioLink('https://www.beamio.app/help')).toBe('https://beamio.ca/help')
	})

	test.each([
		'cashtrees.beamio.app/x',
		'api.beamio.app/api/x',
	])('scheme-less %s is not recognized', (input) => {
		expect(mapLegacyBeamioLink(input)).toBeNull()
	})

	test('a refused subdomain link does not reach the network through the outbound helper', () => {
		const fetchSpy = jest.fn()
		const original = (globalThis as { fetch?: unknown }).fetch
		;(globalThis as { fetch?: unknown }).fetch = fetchSpy
		try {
			expect(resolveOutboundHref('https://cashtrees.beamio.app/x')).toBeNull()
			expect(fetchSpy).not.toHaveBeenCalled()
		} finally {
			;(globalThis as { fetch?: unknown }).fetch = original
		}
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
			resolveBeamioUrl('https://biz.beamio.app/biz/')
			expect(fetchSpy).not.toHaveBeenCalled()
		} finally {
			;(globalThis as { fetch?: unknown }).fetch = original
		}
	})
})

describe('resolveBeamioUrl: no parsed URL keeps the old host', () => {
	test.each([
		['//beamio.app/x', 'https://beamio.ca/x', 'https://beamio.ca'],
		['https:/beamio.app/x', 'https://beamio.ca/x', undefined],
		['https://beamio.app\\Vouchers?x=1', 'https://beamio.ca/Vouchers?x=1', undefined],
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


describe('resolveOutboundHref: outbound addresses', () => {
	test.each([
		['https://beamio.app/Vouchers?Amount=1', 'https://beamio.ca/Vouchers?Amount=1'],
		['https:/beamio.app/x', 'https://beamio.ca/x'],
		['//beamio.app/x', 'https://beamio.ca/x'],
		['https://biz.beamio.app/biz/?a=1', 'https://biz.beamio.ca/biz/?a=1'],
		['beamio.app/Vouchers?Amount=1', 'https://beamio.ca/Vouchers?Amount=1'],
	])('maps legacy %s to %s', (input, expected) => {
		expect(resolveOutboundHref(input)).toBe(expected)
	})

	test.each([
		'https://example.com/a?b=beamio.app',
		'https://beamio.ca/app/?beamiocard=0x1',
		'mailto:support@beamio.app?subject=Beamio%20help',
		'tel:+1234',
		'/Vouchers?Amount=1',
		'https://evilbeamio.app/x',
	])('passes non-legacy %s through unchanged', (input) => {
		expect(resolveOutboundHref(input)).toBe(input)
	})
})

describe('apex /biz paths map to the biz host (B3: beamio.ca/biz returns 500, biz.beamio.ca/biz/ returns 200)', () => {
	test.each([
		['https://beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['https://beamio.app/biz/?tab=members#top', 'https://biz.beamio.ca/biz/?tab=members#top'],
		['https://beamio.app/biz', 'https://biz.beamio.ca/biz/'],
		['https://beamio.app/biz/merchant/42?x=1', 'https://biz.beamio.ca/biz/merchant/42?x=1'],
		['http://beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['beamio.app/biz?x=1', 'https://biz.beamio.ca/biz/?x=1'],
	])('%s maps to %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
		expect(resolveBeamioHttpHref(input)).toBe(expected)
	})

	test.each([
		'https://beamio.app/bizarre',
		'https://beamio.app/business/',
		'https://beamio.app/Biz/',
	])('%s is not a biz path and maps to beamio.ca', (input) => {
		expect(new URL(mapLegacyBeamioLink(input) as string).hostname).toBe('beamio.ca')
	})

	test('protocol-relative and single-slash apex /biz forms map to the biz host', () => {
		expect(resolveBeamioUrl('//beamio.app/biz/x', 'https://beamio.ca').href).toBe('https://biz.beamio.ca/biz/x')
		expect(resolveBeamioUrl('https:/beamio.app/biz/x').href).toBe('https://biz.beamio.ca/biz/x')
	})

})

describe('M1: www.beamio.app /biz paths map to the biz host, same as apex', () => {
	test.each([
		['https://www.beamio.app/biz', 'https://biz.beamio.ca/biz/'],
		['https://www.beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['https://www.beamio.app/biz/xxx?q#f', 'https://biz.beamio.ca/biz/xxx?q#f'],
		['http://www.beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
		['www.beamio.app/biz/', 'https://biz.beamio.ca/biz/'],
	])('%s maps to %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
		expect(resolveBeamioHttpHref(input)).toBe(expected)
		expect(resolveOutboundHref(input)).toBe(expected)
	})

	test.each([
		['https://www.beamio.app/help', 'https://beamio.ca/help'],
		['https://www.beamio.app/Vouchers?Amount=1#x', 'https://beamio.ca/Vouchers?Amount=1#x'],
		['https://www.beamio.app/', 'https://beamio.ca/'],
		['https://www.beamio.app/bizarre', 'https://beamio.ca/bizarre'],
	])('negative: non-/biz www path %s still maps to beamio.ca as %s', (input, expected) => {
		expect(mapLegacyBeamioLink(input)).toBe(expected)
	})
})

describe('F7: legacy links with credentials or a non-default port are refused, never mapped or requested', () => {
	test.each([
		'https://user:pw@beamio.app/x',
		'https://beamio.app@evil.com/x',
		'https://beamio.app:8443/x',
		'http://beamio.app:443/x',
		'https://beamio.app:80/x',
		'https://biz.beamio.app:8443/biz/',
		'https://beamio.app:8443/biz/',
		'https://www.beamio.app:8080/help',
		'ftp://beamio.app/x',
	])('mapLegacyBeamioLink returns null for %s', (input) => {
		expect(mapLegacyBeamioLink(input)).toBeNull()
	})

	test.each([
		'https://user:pw@beamio.app/x',
		'https://beamio.app:8443/x',
		'http://beamio.app:443/x',
		'ftp://beamio.app/x',
		'//beamio.app:8443/x',
	])('resolveBeamioUrl throws for %s, with or without a base', (input) => {
		expect(() => resolveBeamioUrl(input)).toThrow()
		expect(() => resolveBeamioUrl(input, 'https://beamio.ca')).toThrow()
	})

	test.each([
		'https://user:pw@beamio.app/x',
		'https://beamio.app:8443/x',
	])('resolveBeamioHttpHref returns null for %s', (input) => {
		expect(resolveBeamioHttpHref(input)).toBeNull()
		expect(resolveBeamioHttpHref(input, 'https://beamio.ca')).toBeNull()
	})

	test('default ports are not a refusal: https:443 and http:80 map normally', () => {
		expect(mapLegacyBeamioLink('https://beamio.app:443/x')).toBe('https://beamio.ca/x')
		expect(mapLegacyBeamioLink('http://beamio.app:80/x')).toBe('https://beamio.ca/x')
		expect(resolveBeamioUrl('https://beamio.app:443/x').href).toBe('https://beamio.ca/x')
	})

	test('the outbound helper returns null for refused legacy links', () => {
		expect(resolveOutboundHref('https://beamio.app:8443/x')).toBeNull()
		expect(resolveOutboundHref('https://user:pw@beamio.app/x')).toBeNull()
	})
})

describe('outboundSrc: raw img, video, iframe and anchor sources', () => {
	test.each([
		[undefined, undefined],
		[null, undefined],
		['', ''],
		['https://beamio.app/uploads/a.png', 'https://beamio.ca/uploads/a.png'],
		[`https://beamio.app/api/fragment?hash=0x${'ab'.repeat(32)}`, `https://beamio.ca/api/fragment?hash=0x${'ab'.repeat(32)}`],
		['https://beamio.app/media/v.mp4', 'https://beamio.ca/media/v.mp4'],
		['https://cashtrees.beamio.app/v.mp4', undefined],
		['https://beamio.app:8443/v.mp4', undefined],
		['https://basescan.org/tx/0xabc', 'https://basescan.org/tx/0xabc'],
		['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
		['blob:https://beamio.ca/1234', 'blob:https://beamio.ca/1234'],
		['https://www.youtube.com/embed/abc?rel=0', 'https://www.youtube.com/embed/abc?rel=0'],
	])('%j -> %j', (input, expected) => {
		expect(outboundSrc(input as string | null | undefined)).toBe(expected)
	})
})
