import { ethers } from 'ethers'

/** Homepage third-party wallet page — `workflow=fuelPack` (no merchant card). */
export const BEAMIO_USDC_TOPUP_URL = 'https://beamio.app/usdc-topup'

export const FUEL_PACK_USDC_TOPUP_WORKFLOW = 'fuelPack'

/**
 * Pay pack USDC from a third-party wallet. Credits B-Units (and Genesis Ket #0) to `beneficiary`.
 */
export function buildFuelPackUsdcTopupUrl(params: {
	beneficiary: string
	amount: string
	packId?: string
}): string {
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('workflow', FUEL_PACK_USDC_TOPUP_WORKFLOW)
	url.searchParams.set('beneficiary', ethers.getAddress(params.beneficiary))
	url.searchParams.set('currency', 'USDC')
	url.searchParams.set('paymentToken', 'USDC')
	url.searchParams.set('amount', params.amount.trim())
	const packId = params.packId?.trim()
	if (packId) url.searchParams.set('pack', packId)
	return url.toString()
}
