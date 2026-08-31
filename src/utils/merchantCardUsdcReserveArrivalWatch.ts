import { ethers } from 'ethers'
import { CONET_USDC } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

/** ~4s cadence; bridge end-to-end can take several minutes. */
const POLL_INTERVAL_MS = 4_000
const DEFAULT_MAX_MS = 15 * 60 * 1000

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
const CARD_ESCROW_ABI = ['function rewardEscrowUsdc6() view returns (uint256)'] as const

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

async function waitForUintRise(params: {
	read: () => Promise<bigint | null>
	baselineRaw: bigint
	minIncrease6?: bigint
	signal?: AbortSignal
	maxDurationMs?: number
	onTick?: (elapsedMs: number) => void
}): Promise<MerchantCardUsdcArrivalOutcome> {
	const minIncrease = params.minIncrease6 ?? 1n
	const maxMs = params.maxDurationMs ?? DEFAULT_MAX_MS
	const target = params.baselineRaw + minIncrease
	const startedAt = Date.now()

	while (!params.signal?.aborted) {
		const elapsed = Date.now() - startedAt
		if (elapsed >= maxMs) return { status: 'timeout' }
		params.onTick?.(elapsed)

		const current = await params.read()
		if (params.signal?.aborted) return { status: 'cancelled' }
		if (current !== null && current >= target) {
			return {
				status: 'arrived',
				balanceRaw: current,
				balanceDisplay: ethers.formatUnits(current, 6),
			}
		}

		await sleep(POLL_INTERVAL_MS, params.signal)
	}
	return { status: 'cancelled' }
}

function parseBaselineRaw(params: {
	baselineRaw?: bigint
	baselineBalance?: string
	missingMessage: string
	invalidMessage: string
}): { ok: true; value: bigint } | { ok: false; message: string } {
	if (params.baselineRaw != null) return { ok: true, value: params.baselineRaw }
	if (params.baselineBalance != null) {
		try {
			return {
				ok: true,
				value: ethers.parseUnits(String(params.baselineBalance).replace(/,/g, '').trim() || '0', 6),
			}
		} catch {
			return { ok: false, message: params.invalidMessage }
		}
	}
	return { ok: false, message: params.missingMessage }
}

/** Trusted CONET-USDC `balanceOf(account)` in 1e6 min-units; null when RPC fails. */
export async function readConetUsdcBalance6(account: string): Promise<bigint | null> {
	if (!account || !ethers.isAddress(account)) return null
	try {
		const usdc = new ethers.Contract(CONET_USDC, ERC20_BALANCE_ABI, conetDepinProvider)
		return (await usdc.balanceOf(ethers.getAddress(account))) as bigint
	} catch {
		return null
	}
}

/** Trusted CONET-USDC `balanceOf(card)` in 1e6 min-units; null when RPC fails. */
export async function readMerchantCardConetUsdcBalance6(cardAddress: string): Promise<bigint | null> {
	return readConetUsdcBalance6(cardAddress)
}

/** Human CONET-USDC balance string; throws when RPC fails. */
export async function readMerchantCardConetUsdcBalance(cardAddress: string): Promise<string> {
	const raw = await readMerchantCardConetUsdcBalance6(cardAddress)
	if (raw == null) {
		throw new Error('Could not read CONET-USDC balance on the program card.')
	}
	return ethers.formatUnits(raw, 6)
}

/** Trusted `rewardEscrowUsdc6()` in 1e6 min-units; null when RPC fails. */
export async function readMerchantCardRewardEscrowUsdc6(cardAddress: string): Promise<bigint | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	try {
		const card = new ethers.Contract(ethers.getAddress(cardAddress), CARD_ESCROW_ABI, conetDepinProvider)
		return (await card.rewardEscrowUsdc6()) as bigint
	} catch {
		return null
	}
}

/** Human escrow string; throws when RPC fails. */
export async function readMerchantCardRewardEscrowUsdc(cardAddress: string): Promise<string> {
	const raw = await readMerchantCardRewardEscrowUsdc6(cardAddress)
	if (raw == null) {
		throw new Error('Could not read the #13 redeem pool on the program card.')
	}
	return ethers.formatUnits(raw, 6)
}

/**
 * Poll until CONET-USDC on `account` (EOA or card) rises above baseline.
 */
export async function waitForConetUsdcArrival(params: {
	account: string
	baselineRaw?: bigint
	baselineBalance?: string
	minIncrease6?: bigint
	signal?: AbortSignal
	maxDurationMs?: number
	onTick?: (elapsedMs: number) => void
}): Promise<MerchantCardUsdcArrivalOutcome> {
	const { account, signal, onTick } = params
	if (!account || !ethers.isAddress(account)) {
		return { status: 'error', message: 'Invalid wallet address' }
	}
	const baseline = parseBaselineRaw({
		baselineRaw: params.baselineRaw,
		baselineBalance: params.baselineBalance,
		missingMessage: 'Missing baseline CONET-USDC balance.',
		invalidMessage: 'Invalid baseline CONET-USDC balance.',
	})
	if (!baseline.ok) return { status: 'error', message: baseline.message }

	return waitForUintRise({
		read: () => readConetUsdcBalance6(account),
		baselineRaw: baseline.value,
		minIncrease6: params.minIncrease6,
		signal,
		maxDurationMs: params.maxDurationMs,
		onTick,
	})
}

/**
 * Poll until CONET-USDC on the merchant program card rises above baseline.
 * @deprecated Reserve deposit success is escrow, not a raw card `balanceOf`.
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
	return waitForConetUsdcArrival({
		account: cardAddress,
		baselineRaw: params.baselineRaw,
		baselineBalance: params.baselineBalance,
		minIncrease6: params.minIncrease6,
		signal,
		maxDurationMs: params.maxDurationMs,
		onTick,
	})
}

/**
 * Poll until `rewardEscrowUsdc6()` rises above baseline
 * (captured before `fundSocialExchangeUsdcEscrow`).
 */
export async function waitForMerchantCardEscrowUsdcArrival(params: {
	cardAddress: string
	baselineRaw?: bigint
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
	const baseline = parseBaselineRaw({
		baselineRaw: params.baselineRaw,
		baselineBalance: params.baselineBalance,
		missingMessage: 'Missing baseline #13 redeem pool.',
		invalidMessage: 'Invalid baseline #13 redeem pool.',
	})
	if (!baseline.ok) return { status: 'error', message: baseline.message }

	return waitForUintRise({
		read: () => readMerchantCardRewardEscrowUsdc6(cardAddress),
		baselineRaw: baseline.value,
		minIncrease6: params.minIncrease6,
		signal,
		maxDurationMs: params.maxDurationMs,
		onTick,
	})
}
