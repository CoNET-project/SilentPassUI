/**
 * Merchant OS — deposit USDC Reserve from the merchant EOA onto the program card.
 *
 * - CONET-USDC (CoNET L1): ERC-20 transfer → card
 * - Base USDC: approve + TreasuryBridgeV3.initiateLockMint → CONET-USDC mint to card
 *
 * Signing material: session memory only (`getSessionPrivateKeyArmor`).
 */
import { ethers } from 'ethers'
import {
	CONET_TREASURY,
	CONET_USDC,
	USDC_BASE,
} from '@/config/chainAddresses'
import { CONET_MAINNET_CHAIN_ID } from '@/utils/beamioUserCardChain'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { conetDepinProvider } from '@/utils/constants'
import { withBaseRpc } from '@/utils/baseRpc'

const ERC20_ABI = [
	'function balanceOf(address account) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transfer(address to, uint256 amount) returns (bool)',
] as const

const TREASURY_LOCK_MINT_ABI = [
	'function destinationFeeBps(uint256 destinationChainId) view returns (uint256)',
	'function initiateLockMint(uint256 destinationChainId,address sourceAsset,address destinationAsset,address[] beneficiaries,uint256[] amounts,bytes32 sourceTxHash,uint256 nonce,address callbackTarget) returns (bytes32)',
] as const

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

/** Max LockMint principal so amount + fee ≤ balance6. */
export function maxLockMintAmount6FromBalance(balance6: bigint, feeBps: bigint): bigint {
	if (balance6 <= 0n) return 0n
	if (feeBps <= 0n) return balance6
	return (balance6 * 10_000n) / (10_000n + feeBps)
}

export async function readBaseUsdcLockMintFeeBps(): Promise<bigint> {
	return withBaseRpc(async (provider) => {
		const treasury = new ethers.Contract(
			ethers.getAddress(CONET_TREASURY),
			TREASURY_LOCK_MINT_ABI,
			provider,
		)
		return (await treasury.destinationFeeBps(CONET_MAINNET_CHAIN_ID)) as bigint
	})
}

function requireSessionWallet(provider: ethers.Provider): ethers.Wallet {
	const pk = getSessionPrivateKeyArmor()?.trim()
	if (!pk) {
		throw new Error('Wallet is locked. Unlock Merchant OS with your Access Password, then try again.')
	}
	return new ethers.Wallet(pk, provider)
}

export type EoaConetUsdcDepositResult = {
	txHash: string
	amount6: bigint
	from: string
	to: string
}

/** Transfer CONET-USDC from merchant EOA → program card (CoNET L1). */
export async function depositConetUsdcFromEoaToCard(params: {
	cardAddress: string
	amountHuman: string
}): Promise<EoaConetUsdcDepositResult> {
	const card = String(params.cardAddress ?? '').trim()
	if (!card || !ethers.isAddress(card)) {
		throw new Error('Invalid program card address.')
	}
	const amount6 = parseUsdcHumanToAmount6(params.amountHuman)
	if (amount6 == null) {
		throw new Error('Enter a valid USDC amount greater than zero.')
	}

	const wallet = requireSessionWallet(conetDepinProvider)
	const from = ethers.getAddress(wallet.address)
	const to = ethers.getAddress(card)
	const usdc = new ethers.Contract(CONET_USDC, ERC20_ABI, wallet)

	const bal = (await usdc.balanceOf(from)) as bigint
	if (bal < amount6) {
		throw new Error(
			`Insufficient CONET-USDC in your EOA wallet (have ${ethers.formatUnits(bal, 6)}, need ${ethers.formatUnits(amount6, 6)}).`,
		)
	}

	const tx = await usdc.transfer(to, amount6)
	const receipt = await tx.wait()
	if (receipt?.status !== 1) {
		throw new Error('CONET-USDC transfer failed on CoNET.')
	}
	return {
		txHash: String(tx.hash),
		amount6,
		from,
		to,
	}
}

export type EoaBaseUsdcLockMintResult = {
	txHash: string
	amount6: bigint
	feeAmount6: bigint
	from: string
	cardAddress: string
}

/**
 * Lock Base USDC from merchant EOA via TreasuryBridgeV3; mint CONET-USDC to the program card.
 * Fee (if any) is extra — approve covers amount + fee.
 */
export async function depositBaseUsdcFromEoaViaLockMintToCard(params: {
	cardAddress: string
	amountHuman: string
}): Promise<EoaBaseUsdcLockMintResult> {
	const card = String(params.cardAddress ?? '').trim()
	if (!card || !ethers.isAddress(card)) {
		throw new Error('Invalid program card address.')
	}
	const amount6 = parseUsdcHumanToAmount6(params.amountHuman)
	if (amount6 == null) {
		throw new Error('Enter a valid USDC amount greater than zero.')
	}

	const pk = getSessionPrivateKeyArmor()?.trim()
	if (!pk) {
		throw new Error('Wallet is locked. Unlock Merchant OS with your Access Password, then try again.')
	}

	return withBaseRpc(async (provider) => {
		const wallet = new ethers.Wallet(pk, provider)
		const from = ethers.getAddress(wallet.address)
		const cardAddr = ethers.getAddress(card)
		const treasuryAddr = ethers.getAddress(CONET_TREASURY)
		const sourceAsset = ethers.getAddress(USDC_BASE)
		const destAsset = ethers.getAddress(CONET_USDC)

		const treasuryRead = new ethers.Contract(treasuryAddr, TREASURY_LOCK_MINT_ABI, provider)
		const feeBps = (await treasuryRead.destinationFeeBps(CONET_MAINNET_CHAIN_ID)) as bigint
		const feeAmount6 = (amount6 * feeBps) / 10_000n
		const needApprove = amount6 + feeAmount6

		const usdc = new ethers.Contract(sourceAsset, ERC20_ABI, wallet)
		const bal = (await usdc.balanceOf(from)) as bigint
		if (bal < needApprove) {
			const need = ethers.formatUnits(needApprove, 6)
			const have = ethers.formatUnits(bal, 6)
			throw new Error(
				feeAmount6 > 0n
					? `Insufficient Base USDC (need ${need} including bridge fee, have ${have}).`
					: `Insufficient Base USDC in your EOA wallet (have ${have}, need ${need}).`,
			)
		}

		const allowance = (await usdc.allowance(from, treasuryAddr)) as bigint
		if (allowance < needApprove) {
			const approveTx = await usdc.approve(treasuryAddr, needApprove)
			const approveReceipt = await approveTx.wait()
			if (approveReceipt?.status !== 1) {
				throw new Error('USDC approve for treasury failed on Base.')
			}
		}

		const sourceTxHash = ethers.hexlify(ethers.randomBytes(32))
		const nonce = BigInt(ethers.hexlify(ethers.randomBytes(16)))

		const treasuryWrite = new ethers.Contract(treasuryAddr, TREASURY_LOCK_MINT_ABI, wallet)
		const mintTx = await treasuryWrite.initiateLockMint(
			CONET_MAINNET_CHAIN_ID,
			sourceAsset,
			destAsset,
			[cardAddr],
			[amount6],
			sourceTxHash,
			nonce,
			ethers.ZeroAddress,
			{ gasLimit: 500_000 },
		)
		const mintReceipt = await mintTx.wait()
		if (mintReceipt?.status !== 1) {
			throw new Error('Treasury LockMint failed on Base.')
		}

		return {
			txHash: String(mintTx.hash),
			amount6,
			feeAmount6,
			from,
			cardAddress: cardAddr,
		}
	})
}
