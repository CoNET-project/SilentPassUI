/**
 * Merchant OS — fund the program-card #13 redeem pool (USDC Reserve).
 *
 * `fundSocialExchangeUsdcEscrow` pulls CONET-USDC from the **owner EOA**.
 * When allowance is insufficient, the client signs EIP-2612 `permit`
 * (`bytes signature`); Master Settle_Conet sponsors CNET gas for permit + fund.
 * Merchant EOA does **not** need CNET.
 *
 * - CONET-USDC (CoNET L1): optional permit + fund escrow (gas sponsored)
 * - Base USDC: EIP-3009 + x402 `workflow=walletDeposit` → LockMint CONET-USDC
 *   to the **EOA** (Settle_BasePool sponsors Base gas); then permit + fund
 *
 * Signing material: session memory only (`getSessionPrivateKeyArmor`).
 */
import { ethers } from 'ethers'
import { CONET_USDC, GENESIS_NODE_BRIDGE_INITIATOR, USDC_BASE } from '@/config/chainAddresses'
import { AuthorizationSign } from '@/services/beamio'
import {
	postCardFundSocialExchangeUsdcEscrow,
	type ConetUsdcPermitPayload,
} from '@/services/BeamioCard'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { CONET_MAINNET_CHAIN_ID } from '@/utils/beamioUserCardChain'
import { conetDepinProvider } from '@/utils/constants'
import { withBaseRpc } from '@/utils/baseRpc'
import { WALLET_USDC_DEPOSIT_WORKFLOW } from '@/utils/fuelPackUsdcTopupUrl'

const BEAMIO_API = 'https://beamio.app'

const ERC20_ABI = [
	'function balanceOf(address account) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
] as const

/** TreasuryCanonicalERC20V3 — read name/nonces for EIP-2612; permit uses `bytes signature`. */
const CONET_USDC_PERMIT_READ_ABI = [
	'function name() view returns (string)',
	'function nonces(address owner) view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
] as const

const CONET_USDC_PERMIT_TYPES: Record<string, ethers.TypedDataField[]> = {
	Permit: [
		{ name: 'owner', type: 'address' },
		{ name: 'spender', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

/** Strip raw RPC / JSON blobs from user-facing deposit errors. */
export function sanitizeUsdcReserveDepositError(raw: unknown): string {
	const msg = (raw instanceof Error ? raw.message : String(raw ?? '')).trim()
	if (!msg) return 'Could not fund the #13 redeem pool. Please try again.'
	if (/insufficient funds for intrinsic/i.test(msg)) {
		return 'Could not complete the deposit. Please try again.'
	}
	if (/user rejected|denied|ACTION_REJECTED/i.test(msg)) {
		return 'Signature cancelled. Try again when ready.'
	}
	if (/\{[\s\S]*"code"\s*:/.test(msg) || /eth_sendTransaction|eth_call|RPC Error/i.test(msg)) {
		return 'Could not fund the #13 redeem pool. Please try again.'
	}
	return msg
}

export function parseUsdcHumanToAmount6(raw: string): bigint | null {
	const t = raw.trim().replace(/,/g, '')
	if (!t) return null
	try {
		const v = ethers.parseUnits(t, 6)
		return v > 0n ? v : null
	} catch {
		return null
	}
}

/**
 * @deprecated Bridge fee is paid by the initiator under x402 walletDeposit.
 * Kept for Max helpers that still want a conservative cap; prefer full balance.
 */
export function maxLockMintAmount6FromBalance(balance6: bigint, feeBps: bigint): bigint {
	if (balance6 <= 0n) return 0n
	if (feeBps <= 0n) return balance6
	return (balance6 * 10_000n) / (10_000n + feeBps)
}

/** @deprecated No longer used for EOA Base deposit (x402 path). */
export async function readBaseUsdcLockMintFeeBps(): Promise<bigint> {
	return 0n
}

function requireSessionPrivateKey(override?: string | null): string {
	const pk = (override?.trim() || getSessionPrivateKeyArmor()?.trim() || '')
	if (!pk) {
		throw new Error('Wallet is locked. Unlock Merchant OS with your Access Password, then try again.')
	}
	return pk
}

function requireSessionWallet(provider: ethers.Provider, override?: string | null): ethers.Wallet {
	return new ethers.Wallet(requireSessionPrivateKey(override), provider)
}

export type EoaConetUsdcDepositResult = {
	txHash: string
	amount6: bigint
	from: string
	to: string
}

/**
 * Sign EIP-2612 permit for CONET-USDC when allowance is insufficient.
 * Domain `name` and `nonces(owner)` are read on-chain (never hardcoded).
 */
async function maybeSignConetUsdcPermit(params: {
	wallet: ethers.Wallet
	owner: string
	spender: string
	amount6: bigint
}): Promise<ConetUsdcPermitPayload | undefined> {
	const usdc = new ethers.Contract(CONET_USDC, CONET_USDC_PERMIT_READ_ABI, conetDepinProvider)
	const allowance = (await usdc.allowance(params.owner, params.spender)) as bigint
	if (allowance >= params.amount6) return undefined

	const [tokenName, nonce] = await Promise.all([
		usdc.name() as Promise<string>,
		usdc.nonces(params.owner) as Promise<bigint>,
	])
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60)
	const domain = {
		name: String(tokenName),
		version: '1',
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: CONET_USDC,
	}
	const message = {
		owner: params.owner,
		spender: params.spender,
		value: params.amount6,
		nonce,
		deadline,
	}
	const signature = await params.wallet.signTypedData(domain, CONET_USDC_PERMIT_TYPES, message)
	return {
		owner: params.owner,
		spender: params.spender,
		value: params.amount6.toString(),
		deadline: deadline.toString(),
		nonce: nonce.toString(),
		signature,
	}
}

/**
 * Optional EIP-2612 permit + `fundSocialExchangeUsdcEscrow` (Master sponsors CNET gas).
 * Only the card owner EOA can fund; session wallet must be that owner.
 */
export async function fundProgramCardUsdcEscrowFromEoa(params: {
	cardAddress: string
	amountHuman: string
	/** Optional when caller already holds session-equivalent key in memory (e.g. profiles[0]). */
	privateKeyArmor?: string | null
}): Promise<EoaConetUsdcDepositResult> {
	const card = String(params.cardAddress ?? '').trim()
	if (!card || !ethers.isAddress(card)) {
		throw new Error('Invalid program card address.')
	}
	const amount6 = parseUsdcHumanToAmount6(params.amountHuman)
	if (amount6 == null) {
		throw new Error('Enter a valid USDC amount greater than zero.')
	}

	const wallet = requireSessionWallet(conetDepinProvider, params.privateKeyArmor)
	const from = ethers.getAddress(wallet.address)
	const to = ethers.getAddress(card)
	const usdc = new ethers.Contract(CONET_USDC, CONET_USDC_PERMIT_READ_ABI, conetDepinProvider)

	const bal = (await usdc.balanceOf(from)) as bigint
	if (bal < amount6) {
		throw new Error(
			`Insufficient CONET-USDC in your EOA wallet (have ${ethers.formatUnits(bal, 6)}, need ${ethers.formatUnits(amount6, 6)}).`,
		)
	}

	let permit: ConetUsdcPermitPayload | undefined
	try {
		permit = await maybeSignConetUsdcPermit({ wallet, owner: from, spender: to, amount6 })
	} catch (e) {
		throw new Error(sanitizeUsdcReserveDepositError(e))
	}

	const fundRes = await postCardFundSocialExchangeUsdcEscrow({
		cardAddress: to,
		payerEOA: from,
		amount6: amount6.toString(),
		...(permit ? { permit } : {}),
	})
	if (!fundRes.success) {
		throw new Error(
			sanitizeUsdcReserveDepositError(
				fundRes.error ?? 'Could not fund the #13 redeem pool. Please try again.',
			),
		)
	}

	return {
		txHash: String(fundRes.hash ?? ''),
		amount6,
		from,
		to,
	}
}

/**
 * @deprecated Raw transfer to the card does not raise Reserve. Use
 * {@link fundProgramCardUsdcEscrowFromEoa}.
 */
export async function depositConetUsdcFromEoaToCard(params: {
	cardAddress: string
	amountHuman: string
}): Promise<EoaConetUsdcDepositResult> {
	return fundProgramCardUsdcEscrowFromEoa(params)
}

export type EoaBaseUsdcLockMintResult = {
	txHash: string
	amount6: bigint
	/** Always 0 for x402 path — bridge fee paid by initiator, not the merchant EOA. */
	feeAmount6: bigint
	from: string
	cardAddress: string
	fulfillPending?: boolean
}

/**
 * Deposit Base USDC from merchant EOA via Beamio x402
 * (`POST /api/nfcUsdcTopup`, workflow=walletDeposit).
 *
 * User signs EIP-3009 TransferWithAuthorization only — no Base ETH gas on the client.
 * Cluster settles USDC to {@link GENESIS_NODE_BRIDGE_INITIATOR}; Master LockMints CONET-USDC
 * to the **EOA** (not the card). The sheet then permit + funds escrow.
 */
export async function depositBaseUsdcFromEoaViaLockMintToCard(params: {
	cardAddress: string
	amountHuman: string
}): Promise<EoaBaseUsdcLockMintResult> {
	const card = String(params.cardAddress ?? '').trim()
	if (!card || !ethers.isAddress(card)) {
		throw new Error('Invalid program card address.')
	}
	const amountHuman = String(params.amountHuman ?? '').trim()
	const amount6 = parseUsdcHumanToAmount6(amountHuman)
	if (amount6 == null) {
		throw new Error('Enter a valid USDC amount greater than zero.')
	}

	const pk = requireSessionPrivateKey()
	const fromWallet = new ethers.Wallet(pk)
	const from = ethers.getAddress(fromWallet.address)
	const cardAddr = ethers.getAddress(card)
	const settlePayTo = ethers.getAddress(GENESIS_NODE_BRIDGE_INITIATOR)

	await withBaseRpc(async (provider) => {
		const usdc = new ethers.Contract(USDC_BASE, ERC20_ABI, provider)
		const bal = (await usdc.balanceOf(from)) as bigint
		if (bal < amount6) {
			throw new Error(
				`Insufficient Base USDC in your EOA wallet (have ${ethers.formatUnits(bal, 6)}, need ${ethers.formatUnits(amount6, 6)}).`,
			)
		}
	})

	const bodyObj: Record<string, string> = {
		beneficiary: from,
		amount: amountHuman,
		currency: 'USDC',
		paymentToken: 'USDC',
		workflow: WALLET_USDC_DEPOSIT_WORKFLOW,
	}
	const body = JSON.stringify(bodyObj)
	const topupUrl = `${BEAMIO_API}/api/nfcUsdcTopup`

	const firstRes = await fetch(topupUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
	})

	if (firstRes.status !== 402) {
		const json = (await firstRes.json().catch(() => ({}))) as {
			success?: boolean
			error?: string
			USDC_tx?: string
			fulfillPending?: boolean
		}
		if (firstRes.ok && json.success !== false && json.USDC_tx) {
			return {
				txHash: String(json.USDC_tx),
				amount6,
				feeAmount6: 0n,
				from,
				cardAddress: cardAddr,
				fulfillPending: json.fulfillPending === true,
			}
		}
		throw new Error(json.error ?? `Payment challenge failed (HTTP ${firstRes.status})`)
	}

	const challenge = (await firstRes.json().catch(() => ({}))) as {
		accepts?: Array<{
			maxAmountRequired?: string | number
			payTo?: string
		}>
	}
	const message = Array.isArray(challenge.accepts) ? challenge.accepts[0] : null
	if (!message?.payTo || message.maxAmountRequired == null) {
		throw new Error('Invalid payment challenge from Beamio.')
	}

	let payTo: string
	try {
		payTo = ethers.getAddress(String(message.payTo))
	} catch {
		throw new Error('Invalid payment recipient in challenge.')
	}
	if (payTo.toLowerCase() !== settlePayTo.toLowerCase()) {
		throw new Error('Unexpected payment recipient. Please retry.')
	}

	let payAmount: bigint
	try {
		payAmount = BigInt(String(message.maxAmountRequired).split('.')[0])
	} catch {
		throw new Error('Invalid payment amount in challenge.')
	}
	if (payAmount !== amount6) {
		throw new Error(
			`Payment amount mismatch: challenge ${ethers.formatUnits(payAmount, 6)} USDC ≠ ${ethers.formatUnits(amount6, 6)} USDC.`,
		)
	}

	const paymentHeader = await AuthorizationSign(payAmount, payTo, pk)
	if (!paymentHeader) {
		throw new Error('Could not sign the USDC authorization. Unlock your wallet and try again.')
	}

	const secondRes = await fetch(topupUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-PAYMENT': paymentHeader,
			'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
		},
		body,
	})
	const json = (await secondRes.json().catch(() => ({}))) as {
		success?: boolean
		error?: string
		USDC_tx?: string
		fulfillPending?: boolean
	}
	if (!secondRes.ok || json.success === false) {
		throw new Error(json.error ?? `Payment failed (HTTP ${secondRes.status})`)
	}
	if (!json.USDC_tx) {
		throw new Error('Payment settled but no USDC transaction hash was returned.')
	}

	return {
		txHash: String(json.USDC_tx),
		amount6,
		feeAmount6: 0n,
		from,
		cardAddress: cardAddr,
		fulfillPending: json.fulfillPending === true,
	}
}
