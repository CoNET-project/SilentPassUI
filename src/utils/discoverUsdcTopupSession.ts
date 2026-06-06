import { ethers } from 'ethers'
import { beamioApi, baseEndpoint } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { signExecuteForAdmin } from '@/utils/signExecuteForAdmin'
import {
	fetchUsdcChargeSession,
	submitUsdcChargeTopupAuth,
	type UsdcChargeSessionResult,
} from '@/utils/usdcChargeSessionApi'

const POLL_INTERVAL_MS = 2500
const MAX_TICKS = 600

/** Non-admin consumer: payment page only settles USDC to beneficiary; card top-up is completed in-app. */
export const DISCOVER_USDC_CLIENT_TOPUP_WORKFLOW = 'clientTopup'

const BEAMIO_USDC_TOPUP_URL = 'https://beamio.app/usdc-topup'

/** POS admin session QR (sid+pos) — do not use for Discover consumers who are not card admin. */
export function buildDiscoverUsdcTopupQrUrl(params: {
	cardAddress: string
	cardOwner: string
	amount: string
	currency: string
	sid: string
	pos: string
}): string {
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('card', params.cardAddress)
	url.searchParams.set('owner', params.cardOwner)
	url.searchParams.set('amount', params.amount)
	url.searchParams.set('currency', params.currency.toUpperCase())
	url.searchParams.set('sid', params.sid)
	url.searchParams.set('pos', params.pos)
	url.searchParams.set('paymentToken', 'USDC')
	return url.toString()
}

/** Discover consumer top-up: beamio.app payment page, transfer-only (no sid/pos session / no server mint). */
export function buildDiscoverUsdcClientTopupQrUrl(params: {
	cardAddress: string
	cardOwner: string
	amount: string
	currency: string
	beneficiaryEoa: string
}): string {
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('card', params.cardAddress)
	url.searchParams.set('owner', params.cardOwner)
	url.searchParams.set('amount', params.amount)
	url.searchParams.set('currency', params.currency.toUpperCase())
	url.searchParams.set('beneficiary', params.beneficiaryEoa)
	url.searchParams.set('workflow', DISCOVER_USDC_CLIENT_TOPUP_WORKFLOW)
	url.searchParams.set('paymentToken', 'USDC')
	return url.toString()
}

export function discoverClientTopupPaymentHint(): string {
	return 'Ask the payer to scan this QR or open the link to pay USDC on Base. USDC is sent to your wallet; this app completes the merchant top-up after funds arrive.'
}

export function newDiscoverUsdcTopupSessionId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID().toLowerCase()
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

export function discoverUsdcTopupPaymentHint(): string {
	return 'Scan this QR or open the payment link to pay with USDC on Base. Your balance updates after payment is confirmed.'
}

function progressLabelForState(state: string): string {
	switch (state) {
		case 'verifying':
			return 'Verifying payment…'
		case 'settling':
			return 'Settling USDC…'
		case 'awaiting_topup_auth':
			return 'Authorizing top-up…'
		case 'awaiting_beneficiary':
			return 'USDC received — completing top-up…'
		case 'topup_pending':
			return 'Crediting card…'
		case 'topup_confirmed':
		case 'charge_pending':
			return 'Finalizing…'
		default:
			return ''
	}
}

export type DiscoverUsdcTopupPollOutcome =
	| { status: 'success'; txHash?: string }
	| { status: 'awaiting_beneficiary' }
	| { status: 'error'; message: string }
	| { status: 'timeout' }

async function handleAwaitingTopupAuth(
	result: UsdcChargeSessionResult,
	sid: string,
	submittedAuth: Set<string>,
	profile: profile | undefined,
): Promise<void> {
	if (result.state !== 'awaiting_topup_auth') return
	if (submittedAuth.has(sid)) return
	if (
		!result.pendingTopupCardAddr ||
		!result.pendingTopupData ||
		!result.pendingTopupDeadline ||
		!result.pendingTopupNonce
	) {
		return
	}
	const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
	if (!privateKeyArmor) return
	let signature: string
	try {
		signature = await signExecuteForAdmin({
			privateKeyHex: privateKeyArmor,
			cardAddress: result.pendingTopupCardAddr,
			dataHex: result.pendingTopupData,
			deadline: result.pendingTopupDeadline,
			nonceHex: result.pendingTopupNonce,
			factoryGateway: result.pendingTopupVerifyingContract,
		})
	} catch {
		return
	}
	const submit = await submitUsdcChargeTopupAuth(sid, signature)
	if (submit?.ok) {
		submittedAuth.add(sid)
	}
}

export async function pollDiscoverUsdcTopupSession(params: {
	sid: string
	profile?: profile
	onProgress?: (label: string) => void
	signal?: AbortSignal
}): Promise<DiscoverUsdcTopupPollOutcome> {
	const submittedAuth = new Set<string>()
	let ticks = 0

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

	while (ticks < MAX_TICKS) {
		if (params.signal?.aborted) {
			return { status: 'error', message: 'Cancelled' }
		}
		ticks += 1
		const result = await fetchUsdcChargeSession(params.sid)
		if (!result) {
			await sleep(POLL_INTERVAL_MS)
			continue
		}
		await handleAwaitingTopupAuth(result, params.sid, submittedAuth, params.profile)
		const label = progressLabelForState(result.state)
		if (label) params.onProgress?.(label)

		if (result.state === 'success') {
			return { status: 'success', txHash: result.topupTxHash }
		}
		if (result.state === 'error') {
			return { status: 'error', message: result.error ?? 'USDC top-up failed' }
		}
		if (result.state === 'awaiting_beneficiary') {
			return { status: 'awaiting_beneficiary' }
		}
		await sleep(POLL_INTERVAL_MS)
	}
	return { status: 'timeout' }
}

export interface NfcTopupPrepareResult {
	cardAddr?: string
	data?: string
	deadline?: number
	nonce?: string
	wallet?: string
	factoryGateway?: string
	error?: string
}

export async function nfcTopupPrepareForWallet(body: {
	wallet: string
	amount: string
	currency: string
	cardAddress: string
}): Promise<NfcTopupPrepareResult | null> {
	try {
		const res = await fetch(`${beamioApi}/api/nfcTopupPrepare`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				amount: body.amount,
				currency: body.currency,
				cardAddress: body.cardAddress,
				wallet: body.wallet,
				workflow: 'adminTopup',
				topupMode: 'admin',
			}),
		})
		const json = (await res.json()) as Record<string, unknown>
		if (!res.ok) {
			return { error: String(json.error ?? `HTTP ${res.status}`) }
		}
		if (json.error) {
			return { error: String(json.error) }
		}
		const deadlineRaw = json.deadline
		const deadline =
			typeof deadlineRaw === 'number'
				? deadlineRaw
				: Number(String(deadlineRaw ?? '')) || undefined
		return {
			cardAddr: String(json.cardAddr ?? '').trim() || undefined,
			data: String(json.data ?? '').trim() || undefined,
			deadline: deadline && deadline > 0 ? deadline : undefined,
			nonce: String(json.nonce ?? '').trim() || undefined,
			wallet: String(json.wallet ?? '').trim() || undefined,
			factoryGateway: String(json.factoryGateway ?? '').trim() || undefined,
		}
	} catch (e) {
		return { error: e instanceof Error ? e.message : 'Network error' }
	}
}

export async function nfcTopupSubmitForWallet(body: {
	wallet: string
	cardAddr: string
	data: string
	deadline: number
	nonce: string
	adminSignature: string
	usdcTopupSessionId: string
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
	try {
		const res = await fetch(`${beamioApi}/api/nfcTopup`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				wallet: body.wallet,
				cardAddr: body.cardAddr,
				data: body.data,
				deadline: body.deadline,
				nonce: body.nonce,
				adminSignature: body.adminSignature,
				usdcTopupSessionId: body.usdcTopupSessionId,
			}),
		})
		const json = (await res.json()) as Record<string, unknown>
		if (!res.ok || json.success === false) {
			return { success: false, error: String(json.error ?? `HTTP ${res.status}`) }
		}
		return {
			success: true,
			txHash: json.txHash ? String(json.txHash) : undefined,
		}
	} catch (e) {
		return { success: false, error: e instanceof Error ? e.message : 'Network error' }
	}
}

/** Phase 2 after USDC settle: credit beneficiary wallet on the merchant card (POS QR top-up parity). */
export async function completeDiscoverUsdcTopupBeneficiary(params: {
	cardAddress: string
	amount: string
	currency: string
	wallet: string
	usdcTopupSessionId: string
	profile: profile
}): Promise<{ success: boolean; error?: string; txHash?: string }> {
	const privateKeyArmor = resolveSigningPrivateKeyArmor(params.profile)
	if (!privateKeyArmor) {
		return { success: false, error: 'Unlock your wallet to complete top-up.' }
	}
	const prep = await nfcTopupPrepareForWallet({
		wallet: params.wallet,
		amount: params.amount,
		currency: params.currency,
		cardAddress: params.cardAddress,
	})
	if (!prep?.cardAddr || !prep.data || !prep.deadline || !prep.nonce || !prep.factoryGateway) {
		return { success: false, error: prep?.error ?? 'Top-up prepare failed' }
	}
	let adminSignature: string
	try {
		adminSignature = await signExecuteForAdmin({
			privateKeyHex: privateKeyArmor,
			cardAddress: prep.cardAddr,
			dataHex: prep.data,
			deadline: prep.deadline,
			nonceHex: prep.nonce,
			factoryGateway: prep.factoryGateway,
		})
	} catch (e) {
		return { success: false, error: e instanceof Error ? e.message : 'Signature failed' }
	}
	const pay = await nfcTopupSubmitForWallet({
		wallet: params.wallet,
		cardAddr: prep.cardAddr,
		data: prep.data,
		deadline: prep.deadline,
		nonce: prep.nonce,
		adminSignature,
		usdcTopupSessionId: params.usdcTopupSessionId,
	})
	if (!pay.success) {
		return { success: false, error: pay.error ?? 'Top-up failed' }
	}
	return { success: true, txHash: pay.txHash }
}

export async function checkIsCardAdmin(cardAddress: string, wallet: string): Promise<boolean> {
	try {
		const card = new ethers.Contract(
			cardAddress,
			['function isAdmin(address) view returns (bool)'],
			baseEndpoint,
		)
		return Boolean(await card.isAdmin(wallet))
	} catch {
		return false
	}
}

export function parseDiscoverTopupAmountInput(raw: string, currency: string): { ok: true; apiAmount: string } | { ok: false; error: string } {
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
