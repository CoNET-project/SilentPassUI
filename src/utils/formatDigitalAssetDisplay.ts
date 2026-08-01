/**
 * Beamio digital asset display — global protocol (see beamio-digital-asset-display-protocol.mdc).
 *
 * - Significant digits ≤ 9 (digits + decimal point; commas excluded from count)
 * - Prefer 4 fractional digits
 * - Integer part uses en-US thousand separators (1,234.5678)
 * - abs ≥ 100,000 (10万) → K suffix (value ÷ 1,000)
 * - abs ≥ 10,000,000 (1千万) → M suffix (value ÷ 1,000,000)
 */

export const DIGITAL_ASSET_DISPLAY_MAX_CHARS = 9
export const DIGITAL_ASSET_DISPLAY_DECIMALS = 4
/** 10万 */
export const DIGITAL_ASSET_K_THRESHOLD = 100_000
/** 1千万 */
export const DIGITAL_ASSET_M_THRESHOLD = 10_000_000

export type FormatDigitalAssetDisplayOptions = {
	/** Max significant chars (digits + decimal point; commas excluded). Default 9. */
	maxChars?: number
	/** Prefer this many fractional digits when space allows. Default 4. */
	fractionDigits?: number
	/** Optional leading prefix (e.g. "+" or "≈ ") — not counted in maxChars. */
	prefix?: string
}

function parseFiniteNumber(value: string | number): number | null {
	const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
	return Number.isFinite(n) ? n : null
}

/** Digits + decimal point only — thousand commas do not count toward the 9-char budget. */
export function digitalAssetSignificantLength(formatted: string): number {
	return formatted.replace(/,/g, '').length
}

function formatGroupedInteger(intPart: number): string {
	return Math.floor(Math.abs(intPart)).toLocaleString('en-US')
}

function buildGroupedAmount(intPart: number, fracDigits: number, absOriginal: number): string {
	const intStr = formatGroupedInteger(intPart)
	if (fracDigits <= 0) return intStr
	const factor = 10 ** fracDigits
	const scaled = Math.floor(absOriginal * factor + 1e-9)
	const fracNum = scaled % factor
	const fracStr = fracNum.toString().padStart(fracDigits, '0')
	return `${intStr}.${fracStr}`
}

function formatGroupedAmountBody(
	abs: number,
	maxSig: number,
	fractionDigits: number,
): string {
	for (let d = fractionDigits; d >= 0; d--) {
		const factor = d > 0 ? 10 ** d : 1
		const scaled = Math.floor(abs * factor + 1e-9)
		const intPart = Math.floor(scaled / (d > 0 ? factor : 1))
		const body = buildGroupedAmount(intPart, d, abs)
		if (digitalAssetSignificantLength(body) <= maxSig) {
			return body
		}
	}

	const intStr = formatGroupedInteger(Math.floor(abs + 1e-9))
	if (digitalAssetSignificantLength(intStr) <= maxSig) return intStr
	return intStr.replace(/,/g, '').slice(0, maxSig)
}

function formatGroupedScaledBody(
	scaled: number,
	suffix: 'K' | 'M',
	maxSig: number,
	fractionDigits: number,
): string {
	const numBudget = maxSig - 1
	if (numBudget <= 0) return suffix

	for (let d = fractionDigits; d >= 0; d--) {
		const factor = d > 0 ? 10 ** d : 1
		const floored = Math.floor(scaled * factor + 1e-9)
		const intPart = Math.floor(floored / (d > 0 ? factor : 1))
		const body = buildGroupedAmount(intPart, d, scaled)
		const candidate = body + suffix
		if (digitalAssetSignificantLength(candidate) <= maxSig) {
			return candidate
		}
	}

	const intStr = formatGroupedInteger(Math.floor(scaled + 1e-9))
	let body = intStr + suffix
	if (digitalAssetSignificantLength(body) <= maxSig) return body
	body = String(Math.floor(scaled + 1e-9)) + suffix
	return body.slice(0, maxSig)
}

/**
 * Format a human-readable digital asset amount (already divided by token decimals).
 */
export function formatDigitalAssetDisplay(
	value: string | number,
	options?: FormatDigitalAssetDisplayOptions,
): string {
	const n = parseFiniteNumber(value)
	const maxSig = options?.maxChars ?? DIGITAL_ASSET_DISPLAY_MAX_CHARS
	const fractionDigits = options?.fractionDigits ?? DIGITAL_ASSET_DISPLAY_DECIMALS
	const prefix = options?.prefix ?? ''

	if (n === null) {
		const t = String(value ?? '').trim()
		return prefix + (digitalAssetSignificantLength(t) <= maxSig ? t : t.replace(/,/g, '').slice(0, maxSig))
	}

	if (n === 0) {
		return prefix + buildGroupedAmount(0, fractionDigits, 0)
	}

	const sign = n < 0 ? '-' : ''
	const abs = Math.abs(n)

	let body: string
	if (abs >= DIGITAL_ASSET_M_THRESHOLD) {
		body = formatGroupedScaledBody(abs / 1_000_000, 'M', maxSig, fractionDigits)
	} else if (abs >= DIGITAL_ASSET_K_THRESHOLD) {
		body = formatGroupedScaledBody(abs / 1_000, 'K', maxSig, fractionDigits)
	} else {
		body = formatGroupedAmountBody(abs, maxSig, fractionDigits)
	}

	return prefix + sign + body
}
