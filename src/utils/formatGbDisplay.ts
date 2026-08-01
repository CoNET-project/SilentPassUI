import { ethers } from 'ethers'
import { CONET_GB_DECIMALS } from '@/config/chainAddresses'
import {
	DIGITAL_ASSET_DISPLAY_DECIMALS,
	formatDigitalAssetDisplay,
} from '@/utils/formatDigitalAssetDisplay'

/** @deprecated Use DIGITAL_ASSET_DISPLAY_DECIMALS — kept for imports. */
export const GB_DISPLAY_DECIMALS = DIGITAL_ASSET_DISPLAY_DECIMALS

/** User-visible GB amounts — beamio-digital-asset-display-protocol.mdc */
export function formatGbDisplay(value: string | number): string {
	return formatDigitalAssetDisplay(value)
}

/** Format on-chain GB wei (GBToken 9 decimals by default). */
export function formatGbDisplayFromWei(raw: bigint, decimals = CONET_GB_DECIMALS): string {
	return formatGbDisplay(ethers.formatUnits(raw, decimals))
}

/** Compact GB alias — same protocol as formatGbDisplay (K/M thresholds built-in). */
export function formatGbDisplayCompact(value: number): string {
	return formatDigitalAssetDisplay(value)
}
