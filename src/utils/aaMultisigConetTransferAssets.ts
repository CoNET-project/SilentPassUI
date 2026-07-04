import { ethers } from 'ethers'
import { CONET_BUINT, CONET_GB_ERC20, CONET_USDC } from '@/config/chainAddresses'
import { aaMultisigProvider } from '@/utils/aaMultisigUserOp'
import { baseEndpoint, beamioApi } from '@/utils/constants'
import type { AaMultisigTransferAssetId } from '@/utils/aaMultisigProtocol'

export type AaMultisigTransferChain = 'conet' | 'base'

/** Base 8453 — Smart Wallet UserOp（与 AAtoEOA relay 同链）。 */
export const baseMultisigProvider = baseEndpoint

export type AaMultisigTransferAssetOption = {
	id: AaMultisigTransferAssetId
	chain: AaMultisigTransferChain
	label: string
	balanceDisplay: string
	balanceRaw: bigint
	decimals: number
	contractAddress?: string
}

const BALANCE_OF_ALL_ABI = [
	'function balanceOfAll(address account) view returns (uint256 total, uint256 free, uint256 paid)',
] as const
const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const

const CONET_ASSET_ORDER: AaMultisigTransferAssetId[] = ['cnet', 'usdc', 'gb_paid', 'buint_paid']
const BASE_ASSET_ORDER: AaMultisigTransferAssetId[] = ['base_eth', 'base_usdc']

function formatBalanceDisplay(raw: bigint, decimals: number, maxFrac = 4): string {
	const s = ethers.formatUnits(raw, decimals)
	const n = Number(s)
	if (!Number.isFinite(n)) return s
	if (n === 0) return '0'
	if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac })
	return n.toLocaleString(undefined, { maximumFractionDigits: Math.min(8, maxFrac + 2) })
}

async function fetchConetAaMultisigTransferAssetOptions(
	holderAddress: string
): Promise<AaMultisigTransferAssetOption[]> {
	if (!holderAddress || !ethers.isAddress(holderAddress)) return []
	const holder = ethers.getAddress(holderAddress)

	const usdcToken = new ethers.Contract(CONET_USDC, ERC20_BALANCE_ABI, aaMultisigProvider)
	const gbToken = new ethers.Contract(CONET_GB_ERC20, BALANCE_OF_ALL_ABI, aaMultisigProvider)
	const buintToken = new ethers.Contract(CONET_BUINT, BALANCE_OF_ALL_ABI, aaMultisigProvider)

	const [cnetRaw, usdcRaw, gbAll, buintAll] = await Promise.all([
		aaMultisigProvider.getBalance(holder),
		usdcToken.balanceOf!(holder) as Promise<bigint>,
		gbToken.balanceOfAll!(holder) as Promise<[bigint, bigint, bigint]>,
		buintToken.balanceOfAll!(holder) as Promise<[bigint, bigint, bigint]>,
	])

	const gbPaid = gbAll[2]
	const buintPaid = buintAll[2]

	const candidates: AaMultisigTransferAssetOption[] = []
	if (cnetRaw > 0n) {
		candidates.push({
			id: 'cnet',
			chain: 'conet',
			label: 'CNET',
			balanceRaw: cnetRaw,
			decimals: 18,
			balanceDisplay: formatBalanceDisplay(cnetRaw, 18),
		})
	}
	if (usdcRaw > 0n) {
		candidates.push({
			id: 'usdc',
			chain: 'conet',
			label: 'CoNET-USDC',
			balanceRaw: usdcRaw,
			decimals: 6,
			balanceDisplay: formatBalanceDisplay(usdcRaw, 6, 2),
		})
	}
	if (gbPaid > 0n) {
		candidates.push({
			id: 'gb_paid',
			chain: 'conet',
			label: 'Payment GB',
			balanceRaw: gbPaid,
			decimals: 9,
			balanceDisplay: formatBalanceDisplay(gbPaid, 9),
		})
	}
	if (buintPaid > 0n) {
		candidates.push({
			id: 'buint_paid',
			chain: 'conet',
			label: 'Payment B-Unit',
			balanceRaw: buintPaid,
			decimals: 6,
			balanceDisplay: formatBalanceDisplay(buintPaid, 6, 2),
		})
	}

	return CONET_ASSET_ORDER.map((id) => candidates.find((c) => c.id === id)).filter(
		(c): c is AaMultisigTransferAssetOption => c != null
	)
}

type BaseAaBalancesApiResponse =
	| {
			ok: true
			aaDeployed: boolean
			aaAddress: string
			items: Array<{
				id: 'base_eth' | 'base_usdc'
				label: string
				symbol: string
				amountRaw: string
				decimals: number
				contractAddress: string
			}>
	  }
	| { ok: false; error?: string }

async function fetchBaseAaMultisigTransferAssetOptions(
	aaAddress: string
): Promise<AaMultisigTransferAssetOption[] | null> {
	if (!aaAddress || !ethers.isAddress(aaAddress)) return []
	const checksum = ethers.getAddress(aaAddress)
	const url = `${beamioApi}/api/baseAaSmartWalletBalances?address=${encodeURIComponent(checksum)}`
	const res = await fetch(url).catch(() => null)
	if (!res?.ok) return null
	const json = (await res.json().catch(() => null)) as BaseAaBalancesApiResponse | null
	if (!json || json.ok !== true) return null
	if (!json.aaDeployed || !Array.isArray(json.items)) return []

	const candidates: AaMultisigTransferAssetOption[] = []
	for (const item of json.items) {
		let raw: bigint
		try {
			raw = BigInt(item.amountRaw)
		} catch {
			continue
		}
		if (raw <= 0n) continue
		candidates.push({
			id: item.id,
			chain: 'base',
			label: item.label,
			balanceRaw: raw,
			decimals: item.decimals,
			balanceDisplay: formatBalanceDisplay(raw, item.decimals, item.id === 'base_usdc' ? 2 : 4),
			contractAddress: item.contractAddress,
		})
	}

	return BASE_ASSET_ORDER.map((id) => candidates.find((c) => c.id === id)).filter(
		(c): c is AaMultisigTransferAssetOption => c != null
	)
}

/** CoNET RPC + Base CDP（Base AA 已部署时）Smart Wallet 可转资产。 */
export async function fetchAaMultisigTransferAssetOptions(
	aaAddress: string,
	opts?: { previousBase?: AaMultisigTransferAssetOption[] }
): Promise<AaMultisigTransferAssetOption[]> {
	const [conetOptions, baseResult] = await Promise.all([
		fetchConetAaMultisigTransferAssetOptions(aaAddress),
		fetchBaseAaMultisigTransferAssetOptions(aaAddress),
	])
	const baseOptions = baseResult ?? opts?.previousBase?.filter((o) => o.chain === 'base') ?? []
	return [...conetOptions, ...baseOptions]
}

export function parseTransferAmountToRaw(amountText: string, decimals: number): bigint | null {
	const trimmed = amountText.trim()
	if (!trimmed) return null
	const n = Number(trimmed)
	if (!Number.isFinite(n) || n <= 0) return null
	try {
		return ethers.parseUnits(trimmed, decimals)
	} catch {
		return null
	}
}

export function buildTransferTaskTitle(asset: AaMultisigTransferAssetId, amountRaw: bigint): string {
	switch (asset) {
		case 'cnet':
			return `Transfer ${formatBalanceDisplay(amountRaw, 18)} CNET`
		case 'usdc':
			return `Transfer $${formatBalanceDisplay(amountRaw, 6, 2)} CoNET-USDC`
		case 'gb_paid':
			return `Transfer ${formatBalanceDisplay(amountRaw, 9)} Payment GB`
		case 'buint_paid':
			return `Transfer ${formatBalanceDisplay(amountRaw, 6, 2)} Payment B-Unit`
		case 'base_eth':
			return `Transfer ${formatBalanceDisplay(amountRaw, 18)} Base ETH`
		case 'base_usdc':
			return `Transfer $${formatBalanceDisplay(amountRaw, 6, 2)} Base USDC`
		default:
			return 'Transfer'
	}
}

export function formatTransferTaskSummary(task: {
	transferAsset?: AaMultisigTransferAssetId
	amountRaw?: string
	amountUsdc6?: string
	toEoa?: string
}): string {
	const asset = task.transferAsset ?? (task.amountUsdc6 ? 'usdc' : undefined)
	const rawStr = task.amountRaw ?? task.amountUsdc6
	const to = task.toEoa
	if (!rawStr || !to) return 'Transfer'
	const raw = BigInt(rawStr)
	const shortTo = to.length >= 12 ? `${to.slice(0, 6)}…${to.slice(-4)}` : to
	switch (asset) {
		case 'cnet':
			return `${formatBalanceDisplay(raw, 18)} CNET → ${shortTo}`
		case 'usdc':
			return `$${formatBalanceDisplay(raw, 6, 2)} CoNET-USDC → ${shortTo}`
		case 'gb_paid':
			return `${formatBalanceDisplay(raw, 9)} Payment GB → ${shortTo}`
		case 'buint_paid':
			return `${formatBalanceDisplay(raw, 6, 2)} Payment B-Unit → ${shortTo}`
		case 'base_eth':
			return `${formatBalanceDisplay(raw, 18)} Base ETH → ${shortTo}`
		case 'base_usdc':
			return `$${formatBalanceDisplay(raw, 6, 2)} Base USDC → ${shortTo}`
		default:
			return `$${formatBalanceDisplay(raw, 6, 2)} → ${shortTo}`
	}
}

export function relayAmountUsdc6ForTransferAsset(
	asset: AaMultisigTransferAssetId,
	amountRaw: bigint
): string {
	if (asset === 'usdc' || asset === 'base_usdc') return amountRaw.toString()
	return '1'
}

export function userOpProviderForTransferAsset(asset: AaMultisigTransferAssetId): ethers.Provider {
	return asset === 'base_eth' || asset === 'base_usdc' ? baseMultisigProvider : aaMultisigProvider
}
