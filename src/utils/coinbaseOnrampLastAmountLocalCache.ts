/** Last Coinbase onramp keypad amount — UI preference only (not a wallet secret). */

export const COINBASE_ONRAMP_DEFAULT_AMOUNT = '2'

export type CoinbaseOnrampPayMethod = 'usdc' | 'card'

/** Fund Coinbase checkout drawer status (hosted Onramp opens externally). */
export type CoinbaseOnrampStatus =
	| 'idle'
	| 'opening'
	| 'waiting'
	| 'success'
	| 'error'
	| 'canceled'

export const COINBASE_ONRAMP_DEFAULT_PAY_METHOD: CoinbaseOnrampPayMethod = 'usdc'

function storageKey(eoa: string): string {
	return `beamio:silentpass:eoa:${eoa.toLowerCase()}:coinbase-onramp-last-amount:v1`
}

function payMethodStorageKey(eoa: string): string {
	return `beamio:silentpass:eoa:${eoa.toLowerCase()}:coinbase-onramp-last-pay-method:v1`
}

export function normalizeCoinbaseOnrampPayMethod(raw: unknown): CoinbaseOnrampPayMethod {
	return raw === 'card' ? 'card' : COINBASE_ONRAMP_DEFAULT_PAY_METHOD
}

export function loadCoinbaseOnrampLastPayMethod(eoa: string): CoinbaseOnrampPayMethod {
	if (!eoa) return COINBASE_ONRAMP_DEFAULT_PAY_METHOD
	try {
		return normalizeCoinbaseOnrampPayMethod(window.localStorage.getItem(payMethodStorageKey(eoa)))
	} catch {
		return COINBASE_ONRAMP_DEFAULT_PAY_METHOD
	}
}

export function saveCoinbaseOnrampLastPayMethod(eoa: string, method: CoinbaseOnrampPayMethod): void {
	if (!eoa) return
	try {
		window.localStorage.setItem(payMethodStorageKey(eoa), normalizeCoinbaseOnrampPayMethod(method))
	} catch {
		/* quota / private mode — keep in-memory last method */
	}
}

export function normalizeCoinbaseOnrampAmount(raw: string): string | null {
	const trimmed = raw.trim().replace(/\.$/, '')
	if (!trimmed) return null
	const n = Number.parseFloat(trimmed)
	if (!Number.isFinite(n) || n <= 0) return null
	const [intPart, frac] = trimmed.split('.')
	if (!/^\d+$/.test(intPart) || intPart.length > 9) return null
	if (frac !== undefined && !/^\d{1,2}$/.test(frac)) return null
	const intNorm = String(Number.parseInt(intPart, 10))
	if (frac === undefined) return intNorm === '0' ? null : intNorm
	const fracNorm = frac.replace(/0+$/, '')
	const human = fracNorm ? `${intNorm}.${fracNorm}` : intNorm
	return human === '0' ? null : human
}

export function formatCoinbaseOnrampPresetLabel(amount: string): string {
	return `$${normalizeCoinbaseOnrampAmount(amount) ?? COINBASE_ONRAMP_DEFAULT_AMOUNT}`
}

export function loadCoinbaseOnrampLastAmount(eoa: string): string {
	if (!eoa) return COINBASE_ONRAMP_DEFAULT_AMOUNT
	try {
		const raw = window.localStorage.getItem(storageKey(eoa))
		return normalizeCoinbaseOnrampAmount(raw ?? '') ?? COINBASE_ONRAMP_DEFAULT_AMOUNT
	} catch {
		return COINBASE_ONRAMP_DEFAULT_AMOUNT
	}
}

export function saveCoinbaseOnrampLastAmount(eoa: string, amount: string): void {
	if (!eoa) return
	const normalized = normalizeCoinbaseOnrampAmount(amount)
	if (!normalized) return
	try {
		window.localStorage.setItem(storageKey(eoa), normalized)
	} catch {
		/* quota / private mode — keep in-memory last amount */
	}
}
