import { ethers } from 'ethers'
import { USDC_BASE } from '@/config/chainAddresses'
import { withBaseRpc } from '@/utils/baseRpc'

/**
 * Poll Base USDC arrival for an EOA after Coinbase Onramp (or other Base deposit).
 * Trusted success only — RPC failure does not clear baseline / does not invent 0.
 * Cancellable via AbortSignal.
 */

const POLL_INTERVAL_MS = 4_000
/** Coinbase Onramp + Base confirmations; generous headroom. */
const DEFAULT_MAX_MS = 15 * 60 * 1000

const ERC20_IFACE = new ethers.Interface([
	'function balanceOf(address account) view returns (uint256)',
])

export type BaseUsdcArrivalOutcome =
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

/** Fresh Base USDC balance in 1e6 min-units; null when not trusted. */
export async function readBaseUsdcBalance6(eoa: string): Promise<bigint | null> {
	try {
		if (!ethers.isAddress(eoa)) return null
		const addr = ethers.getAddress(eoa)
		return await withBaseRpc(async (provider) => {
			const data = ERC20_IFACE.encodeFunctionData('balanceOf', [addr])
			const raw = await provider.call({ to: USDC_BASE, data })
			if (!raw || raw === '0x') return null
			return BigInt(raw)
		})
	} catch {
		return null
	}
}

export type WaitForBaseUsdcArrivalParams = {
	eoa: string
	/** Base USDC balance (1e6) captured immediately before opening Coinbase. */
	baselineRaw: bigint
	minIncrease6?: bigint
	signal?: AbortSignal
	maxDurationMs?: number
	onTick?: (elapsedMs: number) => void
}

export async function waitForBaseUsdcArrival(
	params: WaitForBaseUsdcArrivalParams,
): Promise<BaseUsdcArrivalOutcome> {
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

		const current = await readBaseUsdcBalance6(eoa)
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
