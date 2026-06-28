import { ethers } from 'ethers'
import { CONET_GB1155, CONET_GB_TOTAL_TOKEN_ID, CONET_USDC } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const CONET_USDC_DECIMALS = 6
const CONET_NATIVE_DECIMALS = 18
const CONET_GB_DECIMALS = 18

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
const ERC1155_BALANCE_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'] as const

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
/** 内存 TTL：页面级直调兜底；全局 daemon 每 6s 传 bypassMemoryCache */
const TTL_MS = 30_000

export type FetchConetWalletBalancesOptions = {
	/** 全局 daemon 喂料时跳过内存 TTL，保证每轮 6s tick 可发起 RPC */
	bypassMemoryCache?: boolean
}

/** RPC-direct CoNET wallet balances (native CNET + GB1155 id=0 + CoNET-USDC); in-flight dedupe per EOA. */
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
			const gbToken = new ethers.Contract(CONET_GB1155, ERC1155_BALANCE_ABI, conetDepinProvider)
			const [cnetRaw, gbRaw, usdcRaw] = await Promise.all([
				conetDepinProvider.getBalance(checksum),
				gbToken.balanceOf!(checksum, BigInt(CONET_GB_TOTAL_TOKEN_ID)) as Promise<bigint>,
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

export function formatConetChainTokenBalance(raw: string): string {
	const n = Number(raw)
	if (!Number.isFinite(n)) return raw
	if (n === 0) return '0'
	if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
	return n.toLocaleString(undefined, { maximumFractionDigits: 8 })
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
