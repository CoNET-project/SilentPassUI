import { ethers } from 'ethers'
import {
	getEOAUSDCBalance,
	postUSDCUserCardTopup,
	postUSDCUserCardTopupPreview,
	type USDCUserCardTopupIntent,
	type USDCUserCardTopupPreviewPayload,
} from '@/services/BeamioCard'
import { fetchConetUsdcBalance } from '@/services/conetUsdcBalance'
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

/** Discover merchant NFT #0 top-up: wallet CoNET-USDC (not Base USDC). Genesis seat still uses Base USDC. */
export async function readEoaConetUsdcBalance6(profile: profile): Promise<bigint> {
	const eoa =
		(typeof profile?.keyID === 'string' && ethers.isAddress(profile.keyID) ? profile.keyID : '') ||
		(typeof (profile as { privateKeyArmor?: string })?.privateKeyArmor === 'string'
			? (() => {
				try {
					return new ethers.Wallet((profile as { privateKeyArmor: string }).privateKeyArmor).address
				} catch {
					return ''
				}
			})()
			: '')
	if (!eoa || !ethers.isAddress(eoa)) return 0n
	const res = await fetchConetUsdcBalance(eoa, { bypassMemoryCache: true })
	if (!res.ok) throw new Error(res.error ?? 'Unable to read CoNET-USDC balance')
	return res.balanceRaw
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

export function formatDiscoverUsdcTopupMinUsdcDisplay(requiredMinUsdc6: string): string {
	try {
		return Number(ethers.formatUnits(BigInt(requiredMinUsdc6), 6)).toFixed(2)
	} catch {
		return requiredMinUsdc6
	}
}

export function discoverUsdcTopupRulesHintText(preview: USDCUserCardTopupPreviewPayload): string {
	const min = formatDiscoverUsdcTopupMinUsdcDisplay(preview.requiredMinUsdc6)
	if (preview.intent === 'first_purchase') {
		return `First purchase requires at least ${min} CoNET-USDC for this merchant card.`
	}
	return ''
}

export function discoverUsdcTopupAmountTooSmallError(
	preview: USDCUserCardTopupPreviewPayload,
	providedUsdc6: bigint,
): string {
	const need = formatDiscoverUsdcTopupMinUsdcDisplay(preview.requiredMinUsdc6)
	const got = usdc6ToExactTransferAmount(providedUsdc6)
	const intentLabel = preview.intent === 'first_purchase' ? 'first purchase' : preview.intent
	return `Amount too small for ${intentLabel}. Minimum required is ${need} CoNET-USDC (this top-up quotes ~${got} CoNET-USDC).`
}

export type DiscoverUsdcTopupPrecheckResult =
	| { ok: true; intent: USDCUserCardTopupIntent; preview: USDCUserCardTopupPreviewPayload }
	| { ok: false; error: string }

/** Load tier / first-purchase rules before the user signs or pays (read-only preview). */
export async function fetchDiscoverUsdcTopupRules(params: {
	cardAddress: string
	fromEoa: string
}): Promise<DiscoverUsdcTopupPrecheckResult> {
	const res = await postUSDCUserCardTopupPreview({
		cardAddress: params.cardAddress,
		from: params.fromEoa,
		intent: 'auto',
	})
	if (!res.success || !res.preview) {
		return { ok: false, error: res.error ?? 'Unable to load top-up requirements' }
	}
	return { ok: true, intent: res.preview.intent, preview: res.preview }
}

/** Cluster-aligned amount check — `usdc6` must be atomic 6-decimal string units (same as `/api/usdcTopup`). */
export async function precheckDiscoverUsdcTopupUsdc6(params: {
	cardAddress: string
	fromEoa: string
	usdc6: bigint
}): Promise<DiscoverUsdcTopupPrecheckResult> {
	if (params.usdc6 <= 0n) {
		return { ok: false, error: 'Enter a valid amount greater than 0' }
	}
	const res = await postUSDCUserCardTopupPreview({
		cardAddress: params.cardAddress,
		from: params.fromEoa,
		intent: 'auto',
		usdcAmount: params.usdc6.toString(),
	})
	if (!res.success || !res.preview) {
		return { ok: false, error: res.error ?? 'Unable to validate top-up amount' }
	}
	if (res.amountCheck && !res.amountCheck.ok) {
		return { ok: false, error: discoverUsdcTopupAmountTooSmallError(res.preview, params.usdc6) }
	}
	const required = BigInt(res.preview.requiredMinUsdc6)
	if (params.usdc6 < required) {
		return { ok: false, error: discoverUsdcTopupAmountTooSmallError(res.preview, params.usdc6) }
	}
	return { ok: true, intent: res.preview.intent, preview: res.preview }
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
	intent: USDCUserCardTopupIntent
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
			current6 = await readEoaConetUsdcBalance6(params.profile)
		} catch {
			params.onProgress?.('Waiting for CoNET-USDC…')
			await sleep(POLL_INTERVAL_MS)
			continue
		}

		if (!isFunded(current6)) {
			params.onProgress?.('Waiting for CoNET-USDC on your wallet…')
			await sleep(POLL_INTERVAL_MS)
			continue
		}

		params.onProgress?.('CoNET-USDC received — completing top-up…')
		const ret = await postUSDCUserCardTopup({
			profile: params.profile,
			cardAddress: params.cardAddress,
			usdcAmount: usdcAmountStr,
			intent: params.intent,
		})
		if (!ret.success) {
			return { status: 'error', message: ret.error ?? 'Top-up failed' }
		}
		return { status: 'success', txHash: ret.txHash }
	}

	return { status: 'timeout' }
}
