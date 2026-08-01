import { ethers } from 'ethers'
import { CONET_GB_DECIMALS } from '@/config/chainAddresses'

/** User-visible GB amounts in SilentPassUI — fixed 4 fractional digits. */
export const GB_DISPLAY_DECIMALS = 4

/** Format human-readable GB (already divided by token decimals). */
export function formatGbDisplay(value: string | number): string {
	const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
	if (!Number.isFinite(n)) return (0).toLocaleString(undefined, gbDisplayLocaleOptions())
	return n.toLocaleString(undefined, gbDisplayLocaleOptions())
}

/** Format on-chain GB wei (GBToken 9 decimals by default). */
export function formatGbDisplayFromWei(raw: bigint, decimals = CONET_GB_DECIMALS): string {
	return formatGbDisplay(ethers.formatUnits(raw, decimals))
}

/** Compact GB for large network totals (still 4 fractional digits on the scaled unit). */
export function formatGbDisplayCompact(value: number): string {
	const abs = Math.abs(value)
	const opts = gbDisplayLocaleOptions()
	if (abs >= 1e9) return `${(value / 1e9).toLocaleString('en-US', opts)}B`
	if (abs >= 1e6) return `${(value / 1e6).toLocaleString('en-US', opts)}M`
	if (abs >= 1e3) return `${(value / 1e3).toLocaleString('en-US', opts)}K`
	return value.toLocaleString('en-US', opts)
}

function gbDisplayLocaleOptions(): Intl.NumberFormatOptions {
	return {
		minimumFractionDigits: GB_DISPLAY_DECIMALS,
		maximumFractionDigits: GB_DISPLAY_DECIMALS,
	}
}
