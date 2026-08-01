import { ethers } from 'ethers'
import { CONET_GB, CONET_GB_DECIMALS, CONET_USDC } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { formatDigitalAssetDisplay } from '@/utils/formatDigitalAssetDisplay'

const CONET_USDC_DECIMALS = 6
const CONET_NATIVE_DECIMALS = 18

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const

export type ConetWalletBalances = {
	usdc: string
	cnet: string
	gb: string
}

export type ConetWalletBalancesResult =
	| { ok: true; balances: ConetWalletBalances; raw: { usdc: bigint; cnet: bigint; gb: bigint } }
	| { ok: false; error?: string }

export type ConetUsdcBalanceResult =
	| { ok: true; balanceRaw: bigint; balance: string }
	| { ok: false; error?: string }

const walletCache = new Map<string, { value: ConetWalletBalancesResult; fetchedAt: number }>()
const inFlight = new Map<string, Promise<ConetWalletBalancesResult>>()
/** 内存 TTL：daemon 每 6s 调度，但同一地址 30s 内复用可信结果 */
const TTL_MS = 30_000

export type FetchConetWalletBalancesOptions = {
	/** 仅在明确需要强制刷新时跳过内存 TTL；普通页面/daemon 不应使用 */
	bypassMemoryCache?: boolean
}

/** RPC-direct CoNET wallet balances (native CNET + GBToken ERC20 + CoNET-USDC); in-flight dedupe per EOA. */
export async function fetchConetWalletBalances(
	ownerAddress: string,
	options?: FetchConetWalletBalancesOptions
): Promise<ConetWalletBalancesResult> {
	const raw = String(ownerAddress ?? '').trim()
	if (!raw || !ethers.isAddress(raw)) {
		return { ok: false, error: 'Invalid address' }
	}
	const checksum = ethers.getAddress(raw)
	const eoa = checksum.toLowerCase()
	const now = Date.now()
	if (!options?.bypassMemoryCache) {
		const cached = walletCache.get(eoa)
		if (cached && cached.value.ok && now - cached.fetchedAt < TTL_MS) {
			return cached.value
		}
	}

	const pending = inFlight.get(eoa)
	if (pending) return pending

	const task = (async (): Promise<ConetWalletBalancesResult> => {
		try {
			const usdcToken = new ethers.Contract(CONET_USDC, ERC20_BALANCE_ABI, conetDepinProvider)
			const gbToken = new ethers.Contract(CONET_GB, ERC20_BALANCE_ABI, conetDepinProvider)
			const [cnetRaw, gbRaw, usdcRaw] = await Promise.all([
				conetDepinProvider.getBalance(checksum),
				gbToken.balanceOf!(checksum) as Promise<bigint>,
				usdcToken.balanceOf!(checksum) as Promise<bigint>,
			])
			const balances: ConetWalletBalances = {
				cnet: ethers.formatUnits(cnetRaw, CONET_NATIVE_DECIMALS),
				gb: ethers.formatUnits(gbRaw, CONET_GB_DECIMALS),
				usdc: ethers.formatUnits(usdcRaw, CONET_USDC_DECIMALS),
			}
			const result: ConetWalletBalancesResult = {
				ok: true,
				balances,
				raw: { cnet: cnetRaw, gb: gbRaw, usdc: usdcRaw },
			}
			walletCache.set(eoa, { value: result, fetchedAt: Date.now() })
			return result
		} catch (e: unknown) {
			const err = e as { shortMessage?: string; message?: string }
			return { ok: false, error: err?.shortMessage ?? err?.message ?? 'CoNET wallet balance fetch failed' }
		} finally {
			inFlight.delete(eoa)
		}
	})()

	inFlight.set(eoa, task)
	return task
}

/** @deprecated Prefer fetchConetWalletBalances — kept for BountyBoard / single-token callers. */
export async function fetchConetUsdcBalance(ownerAddress: string): Promise<ConetUsdcBalanceResult> {
	const res = await fetchConetWalletBalances(ownerAddress)
	if (!res.ok) return res
	return { ok: true, balanceRaw: res.raw.usdc, balance: res.balances.usdc }
}

/** CNET / CoNET chain token balance — beamio-digital-asset-display-protocol.mdc */
export function formatConetChainTokenBalance(raw: string): string {
	return formatDigitalAssetDisplay(raw)
}

/** Narrow-column alias (Bounty Board L1 Network Gas) — same global protocol. */
export function formatConetChainTokenBalanceCompact(raw: string, maxChars?: number): string {
	return formatDigitalAssetDisplay(raw, maxChars !== undefined ? { maxChars } : undefined)
}

export function invalidateConetUsdcBalanceCache(eoaLower?: string): void {
	if (eoaLower) {
		walletCache.delete(eoaLower.toLowerCase())
		return
	}
	walletCache.clear()
}

export function invalidateConetWalletBalancesCache(eoaLower?: string): void {
	invalidateConetUsdcBalanceCache(eoaLower)
}
