import { ethers } from 'ethers'
import {
	fetchConetWalletBalances,
	invalidateConetUsdcBalanceCache,
} from '@/services/conetUsdcBalance'

/**
 * Poll CoNET-USDC arrival for a Main Wallet (EOA) after a Base USDC deposit.
 *
 * Base settle → TreasuryBridge lock/mint → miner vote → CoNET-USDC mint is
 * asynchronous (typically a few minutes). This util listens (RPC-direct, trusted
 * success only) for the beneficiary CoNET-USDC balance to rise above the baseline
 * captured right before the deposit started. Cancellable via AbortSignal.
 */

/** ~4s cadence keeps prompt-cache friendly + within RPC budget (single balanceOf). */
const POLL_INTERVAL_MS = 4_000
/** End-to-end bridge latency measured at ~7.6–8.0 min; give generous headroom. */
const DEFAULT_MAX_MS = 15 * 60 * 1000

export type ConetUsdcArrivalOutcome =
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

/** Fresh (cache-bypassing) CoNET-USDC balance in 1e6 min-units; null when not trusted. */
export async function readConetUsdcBalance6(eoa: string): Promise<bigint | null> {
	const res = await fetchConetWalletBalances(eoa, { bypassMemoryCache: true })
	if (!res.ok) return null
	return res.raw.usdc
}

export type WaitForConetUsdcArrivalParams = {
	/** Beneficiary Main Wallet (EOA) that receives CoNET-USDC. */
	eoa: string
	/** CoNET-USDC balance (1e6) captured immediately before the deposit began. */
	baselineRaw: bigint
	/** Minimum increase (1e6) to treat as arrived; default 1 micro-USDC. */
	minIncrease6?: bigint
	signal?: AbortSignal
	maxDurationMs?: number
	/** Elapsed-time callback for progress UI. */
	onTick?: (elapsedMs: number) => void
}

export async function waitForConetUsdcArrival(
	params: WaitForConetUsdcArrivalParams,
): Promise<ConetUsdcArrivalOutcome> {
	const { eoa, baselineRaw, signal, onTick } = params
	if (!eoa || !ethers.isAddress(eoa)) {
		return { status: 'error', message: 'Invalid wallet address' }
	}
	const minIncrease = params.minIncrease6 ?? 1n
	const maxMs = params.maxDurationMs ?? DEFAULT_MAX_MS
	const target = baselineRaw + minIncrease
	const startedAt = Date.now()

	while (!signal?.aborted) {
		const elapsed = Date.now() - startedAt
		if (elapsed >= maxMs) return { status: 'timeout' }
		onTick?.(elapsed)

		const current = await readConetUsdcBalance6(eoa)
		if (signal?.aborted) return { status: 'cancelled' }
		if (current !== null && current >= target) {
			invalidateConetUsdcBalanceCache(eoa.toLowerCase())
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
