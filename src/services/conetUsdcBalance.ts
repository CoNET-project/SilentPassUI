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
/** 内存 TTL：daemon 每 6s 调度，但同一地址 30s 内复用可信结果 */
const TTL_MS = 30_000

export type FetchConetWalletBalancesOptions = {
	/** 仅在明确需要强制刷新时跳过内存 TTL；普通页面/daemon 不应使用 */
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

/**
 * Narrow-column display for Bounty Board L1 Network Gas.
 * - abs ≥ 10,000,000 → nnM (÷ 1e6, up to 2 integer digits before M)
 * - abs ≥ 10,000 → nnnK (÷ 1e3, up to 3 integer digits before K)
 * - otherwise integer + '.' + fraction ≤ maxChars
 */
export function formatConetChainTokenBalanceCompact(raw: string, maxChars = 8): string {
	const n = Number(raw)
	if (!Number.isFinite(n)) {
		const t = raw.trim()
		return t.length <= maxChars ? t : t.slice(0, maxChars)
	}
	if (n === 0) return '0'

	const sign = n < 0 ? '-' : ''
	const abs = Math.abs(n)

	if (abs >= 10_000_000) {
		return formatCompactScaledAmount(abs / 1_000_000, 'M', 2, maxChars, sign)
	}
	if (abs >= 10_000) {
		const scaledK = abs / 1_000
		// nnnK below 1M equivalent; allow 4 integer digits (e.g. 9999.9K) between 1M–10M CNET.
		const maxIntDigits = scaledK >= 1_000 ? 4 : 3
		return formatCompactScaledAmount(scaledK, 'K', maxIntDigits, maxChars, sign)
	}

	return formatCompactPlainAmount(abs, maxChars, sign)
}

function truncateScaledValue(scaled: number, decimals: number): string {
	if (decimals <= 0) return String(Math.floor(scaled + 1e-9))
	const factor = 10 ** decimals
	const truncated = Math.floor(scaled * factor + 1e-9) / factor
	return truncated.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function formatCompactScaledAmount(
	scaled: number,
	suffix: 'K' | 'M',
	maxIntDigits: number,
	maxChars: number,
	sign: string,
): string {
	const suffixLen = 1
	const numBudget = maxChars - sign.length - suffixLen
	if (numBudget <= 0) return sign + suffix

	for (let decimals = Math.min(4, numBudget - 1); decimals >= 0; decimals--) {
		const body = truncateScaledValue(scaled, decimals)
		const intDigits = body.includes('.') ? body.split('.')[0]!.length : body.length
		if (body.length <= numBudget && intDigits <= maxIntDigits) {
			return sign + body + suffix
		}
	}

	const floored = Math.floor(scaled + 1e-9)
	let body = String(floored)
	if (body.length > maxIntDigits) {
		const factor = 10 ** (body.length - maxIntDigits)
		body = String(Math.floor(floored / factor) * factor)
	}
	if (body.length > numBudget) {
		body = body.slice(0, numBudget)
	}
	return sign + body + suffix
}

function formatCompactPlainAmount(abs: number, maxChars: number, sign: string): string {
	const budget = maxChars - sign.length
	const intStr = String(Math.floor(abs))

	if (intStr.length >= budget) {
		return sign + intStr.slice(0, budget)
	}

	const decimalBudget = budget - intStr.length - 1
	if (decimalBudget <= 0) {
		return sign + intStr
	}

	let fixed = abs.toFixed(decimalBudget)
	fixed = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
	const result = sign + fixed
	if (result.length <= maxChars) return result

	for (let d = decimalBudget - 1; d >= 0; d--) {
		const trimmed = abs.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
		const attempt = sign + trimmed
		if (attempt.length <= maxChars) return attempt
	}

	return sign + intStr.slice(0, budget)
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
