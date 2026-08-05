import { ethers } from 'ethers'
import {
	DIGITAL_ASSET_DISPLAY_DECIMALS,
	formatDigitalAssetDisplay,
} from '@/utils/formatDigitalAssetDisplay'

/** GBToken ERC20 decimals on CoNET (see beamio-gb-erc20-canonical.mdc). */
export const CONET_GB_DECIMALS = 9

/** @deprecated Use DIGITAL_ASSET_DISPLAY_DECIMALS — kept for imports. */
export const GB_DISPLAY_DECIMALS = DIGITAL_ASSET_DISPLAY_DECIMALS

/** User-visible GB amounts — beamio-digital-asset-display-protocol.mdc */
export function formatGbDisplay(value: string | number): string {
	return formatDigitalAssetDisplay(value)
}

/** Format on-chain GB wei (GBToken 9 decimals by default). */
export function formatGbDisplayFromWei(raw: bigint | string | number, decimals = CONET_GB_DECIMALS): string {
	return formatGbDisplay(ethers.formatUnits(raw.toString(), decimals))
}
