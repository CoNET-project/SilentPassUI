import { openExternalUrl } from './openExternalUrl'

describe('openExternalUrl: legacy links reach window.open and the native bridge only as beamio.ca', () => {
	let winOpen: jest.SpyInstance
	let fetchSpy: jest.Mock
	const originalFetch = (globalThis as { fetch?: unknown }).fetch

	beforeEach(() => {
		winOpen = jest.spyOn(window, 'open').mockImplementation(() => null)
		fetchSpy = jest.fn()
		;(globalThis as { fetch?: unknown }).fetch = fetchSpy
	})

	afterEach(() => {
		winOpen.mockRestore()
		;(globalThis as { fetch?: unknown }).fetch = originalFetch
		delete (window as { CashTreesIOS?: unknown }).CashTreesIOS
	})

	test('maps a legacy apex link before window.open', () => {
		openExternalUrl('  https://beamio.app/Vouchers?Amount=1  ')
		expect(winOpen).toHaveBeenCalledWith('https://beamio.ca/Vouchers?Amount=1', '_blank', 'noopener,noreferrer')
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('maps a legacy biz link before window.open', () => {
		openExternalUrl('https://biz.beamio.app/biz/')
		expect(winOpen).toHaveBeenCalledWith('https://biz.beamio.ca/biz/', '_blank', 'noopener,noreferrer')
	})

	test('passes non-legacy and mailto values through unchanged', () => {
		openExternalUrl('https://basescan.org/tx/0xabc')
		expect(winOpen).toHaveBeenLastCalledWith('https://basescan.org/tx/0xabc', '_blank', 'noopener,noreferrer')
		openExternalUrl('mailto:support@beamio.app?subject=help')
		expect(winOpen).toHaveBeenLastCalledWith('mailto:support@beamio.app?subject=help', '_blank', 'noopener,noreferrer')
	})

	test('the native iOS bridge receives the mapped URL', () => {
		const openURL = jest.fn()
		;(window as { CashTreesIOS?: unknown }).CashTreesIOS = { openURL }
		expect(openExternalUrl('https://beamio.app/app/?beamiocard=0x1')).toBe(true)
		expect(openURL).toHaveBeenCalledWith({ url: 'https://beamio.ca/app/?beamiocard=0x1' })
		expect(winOpen).not.toHaveBeenCalled()
	})

	test('empty input opens nothing', () => {
		expect(openExternalUrl('')).toBe(false)
		expect(winOpen).not.toHaveBeenCalled()
	})
})
