import { ethers } from 'ethers'

/** Homepage third-party wallet page — `workflow=fuelPack` / `walletDeposit`. */
export const BEAMIO_USDC_TOPUP_URL = 'https://beamio.app/usdc-topup'

export const FUEL_PACK_USDC_TOPUP_WORKFLOW = 'fuelPack'

/** Base USDC → CoNET treasury LockMint → CONET-USDC to `beneficiary` (EOA, AA, or merchant card). */
export const WALLET_USDC_DEPOSIT_WORKFLOW = 'walletDeposit'

/** UI language hint for `/usdc-topup` (optional query `lang`). */
export type FuelPackUsdcTopupUiLocale = 'en' | 'zh-CN'

function tryChecksumAddress(raw: string): string | null {
	try {
		return ethers.getAddress(raw.trim())
	} catch {
		return null
	}
}

/**
 * Pay pack USDC from a third-party wallet. Credits B-Units (and Genesis Ket #0) to `beneficiary`.
 */
export function buildFuelPackUsdcTopupUrl(params: {
	beneficiary: string
	amount: string
	packId?: string
	uiLocale?: FuelPackUsdcTopupUiLocale
}): string | null {
	const beneficiary = tryChecksumAddress(params.beneficiary)
	if (!beneficiary) return null
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('workflow', FUEL_PACK_USDC_TOPUP_WORKFLOW)
	url.searchParams.set('beneficiary', beneficiary)
	url.searchParams.set('currency', 'USDC')
	url.searchParams.set('paymentToken', 'USDC')
	url.searchParams.set('amount', params.amount.trim())
	const packId = params.packId?.trim()
	if (packId) url.searchParams.set('pack', packId)
	if (params.uiLocale) url.searchParams.set('lang', params.uiLocale)
	return url.toString()
}

/**
 * Top up CONET-USDC on a beneficiary via third-party Base USDC payment
 * (`workflow=walletDeposit`). Merchant OS USDC Reserve uses the **owner EOA**
 * as beneficiary, then approve + `fundSocialExchangeUsdcEscrow` (a card
 * beneficiary does not raise the #13 redeem pool).
 */
export function buildWalletUsdcDepositUrl(params: {
	beneficiary: string
	/** Preferred alias used by Merchant OS deposit sheet. */
	amountUsdc?: string
	amount?: string
	uiLocale?: FuelPackUsdcTopupUiLocale
}): string | null {
	const beneficiary = tryChecksumAddress(params.beneficiary)
	if (!beneficiary) return null
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('workflow', WALLET_USDC_DEPOSIT_WORKFLOW)
	url.searchParams.set('beneficiary', beneficiary)
	url.searchParams.set('currency', 'USDC')
	url.searchParams.set('paymentToken', 'USDC')
	const amount = (params.amountUsdc ?? params.amount)?.trim()
	if (amount) url.searchParams.set('amount', amount)
	if (params.uiLocale) url.searchParams.set('lang', params.uiLocale)
	return url.toString()
}
