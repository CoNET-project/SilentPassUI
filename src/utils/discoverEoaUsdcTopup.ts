import { ethers } from 'ethers'
import {
	getEOAUSDCBalance,
	postUSDCUserCardTopup,
} from '@/services/BeamioCard'
import { BASE_MAINNET_CHAIN_ID, USDC_BASE } from '@/config/chainAddresses'

const POLL_INTERVAL_MS = 2500
const MAX_POLL_TICKS = 480

export function parseDiscoverTopupAmountInput(
	raw: string,
	currency: string,
): { ok: true; apiAmount: string } | { ok: false; error: string } {
	const trimmed = raw.trim()
	if (!trimmed) return { ok: false, error: 'Enter an amount' }
	const n = Number(trimmed)
	if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter a valid amount greater than 0' }
	const decimals = currency === 'JPY' || currency === 'TWD' ? 0 : 2
	const apiAmount = n.toFixed(decimals)
	if (Number(apiAmount) < 0.01 && decimals > 0) {
		return { ok: false, error: 'Minimum top-up is 0.01' }
	}
	return { ok: true, apiAmount }
}

/** EIP-681 USDC transfer on Base — third party sends USDC to user EOA. */
export function buildEoaUsdcTransferQrUri(params: {
	recipientEoa: string
	usdcAmount6: bigint
}): string {
	const recipient = ethers.getAddress(params.recipientEoa)
	const amount = params.usdcAmount6.toString()
	return `ethereum:${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${recipient}&uint256=${amount}`
}

export function discoverEoaUsdcReceiveHint(usdcAmountDisplay: string, recipientEoa: string): string {
	const short = `${recipientEoa.slice(0, 6)}…${recipientEoa.slice(-4)}`
	return `Ask the payer to send ${usdcAmountDisplay} USDC on Base to your wallet ${short}. This app will complete the merchant top-up after USDC arrives.`
}

export async function readEoaUsdcBalance6(profile: profile): Promise<bigint> {
	const human = await getEOAUSDCBalance(profile)
	return ethers.parseUnits(human || '0', 6)
}

/** EOA already holds enough USDC to pay for top-up — skip third-party receive QR. */
export function eoaCanSelfFundDiscoverTopup(balanceUsdc6: bigint, requiredUsdc6: bigint): boolean {
	return requiredUsdc6 > 0n && balanceUsdc6 >= requiredUsdc6
}

/** After third-party transfer, balance must increase by the quoted payment amount from baseline. */
export function eoaMeetsExternalFundingTarget(
	currentUsdc6: bigint,
	baselineUsdc6: bigint,
	requiredUsdc6: bigint,
): boolean {
	return requiredUsdc6 > 0n && currentUsdc6 >= baselineUsdc6 + requiredUsdc6
}

/** Exact USDC human amount for EIP-3009 transfer — do not round up (safeUsdc6ToAmountString would). */
export function usdc6ToExactTransferAmount(usdc6: bigint): string {
	if (usdc6 <= 0n) return '0'
	return ethers.formatUnits(usdc6, 6)
}

export type DiscoverEoaUsdcTopupPollOutcome =
	| { status: 'success'; txHash?: string }
	| { status: 'error'; message: string }
	| { status: 'timeout' }

export async function pollEoaUsdcFundingThenTopup(params: {
	profile: profile
	cardAddress: string
	baselineUsdc6: bigint
	requiredUsdc6: bigint
	onProgress?: (label: string) => void
	signal?: AbortSignal
}): Promise<DiscoverEoaUsdcTopupPollOutcome> {
	const usdcAmountStr = usdc6ToExactTransferAmount(params.requiredUsdc6)

	const isFunded = (current6: bigint) =>
		eoaCanSelfFundDiscoverTopup(current6, params.requiredUsdc6) ||
		eoaMeetsExternalFundingTarget(current6, params.baselineUsdc6, params.requiredUsdc6)

	const sleep = (ms: number) =>
		new Promise<void>((resolve, reject) => {
			const t = setTimeout(resolve, ms)
			params.signal?.addEventListener('abort', () => {
				clearTimeout(t)
				reject(new DOMException('Aborted', 'AbortError'))
			})
		})

	try {
		await sleep(POLL_INTERVAL_MS)
	} catch {
		return { status: 'error', message: 'Cancelled' }
	}

	let ticks = 0
	while (ticks < MAX_POLL_TICKS) {
		if (params.signal?.aborted) {
			return { status: 'error', message: 'Cancelled' }
		}
		ticks += 1

		let current6 = 0n
		try {
			current6 = await readEoaUsdcBalance6(params.profile)
		} catch {
			params.onProgress?.('Waiting for USDC…')
			await sleep(POLL_INTERVAL_MS)
			continue
		}

		if (!isFunded(current6)) {
			params.onProgress?.('Waiting for USDC on your wallet…')
			await sleep(POLL_INTERVAL_MS)
			continue
		}

		params.onProgress?.('USDC received — completing top-up…')
		const ret = await postUSDCUserCardTopup({
			profile: params.profile,
			cardAddress: params.cardAddress,
			usdcAmount: usdcAmountStr,
			intent: 'topup',
		})
		if (!ret.success) {
			return { status: 'error', message: ret.error ?? 'Top-up failed' }
		}
		return { status: 'success', txHash: ret.txHash }
	}

	return { status: 'timeout' }
}
