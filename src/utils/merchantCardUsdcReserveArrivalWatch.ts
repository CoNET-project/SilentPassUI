import { ethers } from 'ethers'
import { CONET_USDC } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

/** ~4s cadence; bridge end-to-end can take several minutes. */
const POLL_INTERVAL_MS = 4_000
const DEFAULT_MAX_MS = 15 * 60 * 1000

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const

export type MerchantCardUsdcArrivalOutcome =
	| { status: 'arrived'; balanceRaw: bigint; balanceDisplay: string }
	| { status: 'cancelled' }
	| { status: 'timeout' }
	| { status: 'error'; message: string }

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		if (signal?.aborted) return resolve()
		const timer = setTimeout(() => {
			cleanup()
			resolve()
		}, ms)
		const onAbort = () => {
			cleanup()
			resolve()
		}
		const cleanup = () => {
			clearTimeout(timer)
			signal?.removeEventListener('abort', onAbort)
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})

export function formatMerchantCardConetUsdcBalanceDisplay(raw: string | number): string {
	const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
	if (!Number.isFinite(n)) return String(raw)
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/** Trusted CONET-USDC `balanceOf(card)` in 1e6 min-units; null when RPC fails. */
export async function readMerchantCardConetUsdcBalance6(cardAddress: string): Promise<bigint | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	try {
		const usdc = new ethers.Contract(CONET_USDC, ERC20_BALANCE_ABI, conetDepinProvider)
		const raw = (await usdc.balanceOf(ethers.getAddress(cardAddress))) as bigint
		return raw
	} catch {
		return null
	}
}

/** Human CONET-USDC balance string; throws when RPC fails. */
export async function readMerchantCardConetUsdcBalance(cardAddress: string): Promise<string> {
	const raw = await readMerchantCardConetUsdcBalance6(cardAddress)
	if (raw == null) {
		throw new Error('Could not read CONET-USDC balance on the program card.')
	}
	return ethers.formatUnits(raw, 6)
}

/**
 * Poll until CONET-USDC on the merchant program card rises above baseline
 * (captured before deposit / LockMint / third-party walletDeposit).
 */
export async function waitForMerchantCardConetUsdcArrival(params: {
	cardAddress: string
	/** Preferred: raw 1e6 units before deposit. */
	baselineRaw?: bigint
	/** Human string from `readMerchantCardConetUsdcBalance`. */
	baselineBalance?: string
	minIncrease6?: bigint
	signal?: AbortSignal
	maxDurationMs?: number
	onTick?: (elapsedMs: number) => void
}): Promise<MerchantCardUsdcArrivalOutcome> {
	const { cardAddress, signal, onTick } = params
	if (!cardAddress || !ethers.isAddress(cardAddress)) {
		return { status: 'error', message: 'Invalid program card address' }
	}

	let baselineRaw = params.baselineRaw
	if (baselineRaw == null && params.baselineBalance != null) {
		try {
			baselineRaw = ethers.parseUnits(String(params.baselineBalance).replace(/,/g, '').trim() || '0', 6)
		} catch {
			return { status: 'error', message: 'Invalid baseline CONET-USDC balance.' }
		}
	}
	if (baselineRaw == null) {
		return { status: 'error', message: 'Missing baseline CONET-USDC balance.' }
	}

	const minIncrease = params.minIncrease6 ?? 1n
	const maxMs = params.maxDurationMs ?? DEFAULT_MAX_MS
	const target = baselineRaw + minIncrease
	const startedAt = Date.now()

	while (!signal?.aborted) {
		const elapsed = Date.now() - startedAt
		if (elapsed >= maxMs) return { status: 'timeout' }
		onTick?.(elapsed)

		const current = await readMerchantCardConetUsdcBalance6(cardAddress)
		if (signal?.aborted) return { status: 'cancelled' }
		if (current !== null && current >= target) {
			return {
				status: 'arrived',
				balanceRaw: current,
				balanceDisplay: ethers.formatUnits(current, 6),
			}
		}

		await sleep(POLL_INTERVAL_MS, signal)
	}
	return { status: 'cancelled' }
}
