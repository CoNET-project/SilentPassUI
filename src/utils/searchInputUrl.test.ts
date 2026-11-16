import { isBillPaymentUrlText, searchInputToUrl } from './searchInputUrl'

const BILL = 'Amount=12.5&currency=USDC&acceptTokens=USDC&to=0xabc'

describe('searchInputToUrl: legacy search-bar input never yields an old-host URL', () => {
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
		// absolute and scheme-less forms
		[`https://beamio.app/Vouchers?${BILL}`, `https://beamio.ca/Vouchers?${BILL}`],
		[`beamio.app/Vouchers?${BILL}`, `https://beamio.ca/Vouchers?${BILL}`],
		// the bypass forms: the scheme-less bill branch used to build new URL('https://' + raw) without mapping
		[`beamio.app\\Vouchers?${BILL}`, `https://beamio.ca/Vouchers?${BILL}`],
		[`https:/beamio.app/Vouchers?${BILL}`, `https://beamio.ca/Vouchers?${BILL}`],
		// the redeem branch used to resolve protocol-relative input against beamio.ca and keep beamio.app
		['//beamio.app/app/?redeemcode=ABC&beamiocard=0x1', 'https://beamio.ca/app/?redeemcode=ABC&beamiocard=0x1'],
		['/\\beamio.app/app/?redeemcode=ABC', 'https://beamio.ca/app/?redeemcode=ABC'],
		// biz host and subdomains
		['https://biz.beamio.app/biz/?redeemcode=ABC', 'https://biz.beamio.ca/biz/?redeemcode=ABC'],
		['https://cashtrees.beamio.app/app/?redeemcode=ABC', 'https://beamio.ca/app/?redeemcode=ABC'],
		// relative bill
		[`/Vouchers?${BILL}`, `https://beamio.ca/Vouchers?${BILL}`],
		// redeem fragment without scheme
		['beamiocard=0x1&redeemcode=ABC', 'https://beamio.ca/app/?beamiocard=0x1&redeemcode=ABC'],
	])('%s', (input, expected) => {
		const url = searchInputToUrl(input)
		expect(url).not.toBeNull()
		const href = (url as URL).href
		// the href is what flows into requestUrl and setScanData(url.href)
		expect(href).toBe(expected)
		expect(href.toLowerCase()).not.toContain('beamio.app')
		expect(['beamio.ca', 'biz.beamio.ca']).toContain((url as URL).hostname)
		expect(fetchSpy).not.toHaveBeenCalled()
		expect(xhrOpenSpy).not.toHaveBeenCalled()
	})

	test.each([
		'alice',
		'beamio',
		'beamio.app',
		'beamio.app Amount=1 Vouchers',
		'javascript:alert(1)',
		`beamio.app\tVouchers?${BILL}`,
	])('non-URL or non-web input %j is not routed to a legacy host', (input) => {
		const url = searchInputToUrl(input)
		if (url !== null) {
			expect(url.hostname.endsWith('beamio.app')).toBe(false)
			expect(url.href.toLowerCase()).not.toContain('beamio.app')
		}
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('a bill that only exists under the legacy host is still recognized as a bill', () => {
		expect(isBillPaymentUrlText(`beamio.app/Vouchers?${BILL}`)).toBe(true)
		expect(isBillPaymentUrlText(`https://beamio.app\\Vouchers?${BILL}`)).toBe(true)
		expect(isBillPaymentUrlText('https://beamio.app/Vouchers?Amount=1')).toBe(false)
	})
})
