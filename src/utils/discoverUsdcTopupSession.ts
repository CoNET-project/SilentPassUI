import { ethers } from 'ethers'
import { beamioApi, baseEndpoint } from '@/utils/constants'
import { AuthorizationSign } from '@/services/beamio'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { signExecuteForAdmin } from '@/utils/signExecuteForAdmin'
import { tu } from '@/locale/beamioLocale'
import {
	eoaCanSelfFundDiscoverTopup,
	readEoaUsdcBalance6,
} from '@/utils/discoverEoaUsdcTopup'
import {
	fetchUsdcChargeSession,
	submitUsdcChargeTopupAuth,
	type UsdcChargeSessionResult,
} from '@/utils/usdcChargeSessionApi'

const POLL_INTERVAL_MS = 2500
const MAX_TICKS = 600

/** Non-admin consumer (legacy): payment page only settles USDC to beneficiary; card top-up is completed in-app. */
export const DISCOVER_USDC_CLIENT_TOPUP_WORKFLOW = 'clientTopup'

/** Discover treasuryBridge: settle USDC → initiator; Master LockMint → owner + protocol gateway mint → user. */
export const DISCOVER_USDC_TREASURY_BRIDGE_WORKFLOW = 'treasuryBridge'

/** Genesis Node Seat: settle USDC → Beamio seat wallet; Master createRedeem + claim → listener deploys validators. */
export const DISCOVER_GENESIS_NODE_SEAT_WORKFLOW = 'genesisNodeSeat'

/** Wallet USDC deposit: settle Base USDC → treasury initiator; LockMint CoNET-USDC → beneficiary (EOA or AA). */
export const WALLET_USDC_DEPOSIT_WORKFLOW = 'walletDeposit'

const BEAMIO_USDC_TOPUP_URL = 'https://beamio.app/usdc-topup'

/** Per-node list price (includes OPEX 120), USDC human units. */
export const GENESIS_NODE_SEAT_USDC_PER_NODE = 4000

/** Per-node entry in USDC atomic 6-decimals (must match x402sdk GENESIS_NODE_SEAT_USDC_PER_NODE6). */
export const GENESIS_NODE_SEAT_USDC_PER_NODE6 = 4_000_000_000n

/**
 * Hard-coded Base USDC settle recipient before LockMint (must match x402sdk GENESIS_NODE_BRIDGE_INITIATOR).
 * Local SilentPassUI wallet pays this address via EIP-3009 / x402 — not the merchant card owner.
 */
export const GENESIS_NODE_BRIDGE_INITIATOR = '0x87cAeD4e51C36a2C2ece3Aaf4ddaC9693d2405E1'
/** @deprecated alias of {@link GENESIS_NODE_BRIDGE_INITIATOR} */
export const GENESIS_NODE_SEAT_PAYTO = GENESIS_NODE_BRIDGE_INITIATOR

/** Must match x402sdk settle payTo for workflow=treasuryBridge. */
export const DISCOVER_TREASURY_BRIDGE_PAYTO = GENESIS_NODE_BRIDGE_INITIATOR

/** Must match x402sdk `GENESIS_NODE_SEAT_TEST_CODE` — settle 4.00 USDC then micro-split fulfill. */
export const GENESIS_NODE_SEAT_TEST_CODE = '332266'

/** Must match x402sdk `GENESIS_NODE_SEAT_TEST_USDC6` (4.00 USDC = 1/1000 seat). */
export const GENESIS_NODE_SEAT_TEST_USDC6 = 4_000_000n

/**
 * PWA-only buyer allowlist for Genesis seat **testMode** (4.00 USDC + vault micro-split).
 *
 * - **Third-party** `/usdc-topup?...&test=332266`: still code-gated only (no buyer list).
 * - **PWA** in-app pay / PWA-built pay URL: attach `test=332266` **only** when `beneficiary`
 *   is on this list. Add checksummed EOAs here to allow more test buyers.
 *
 * Mirror only in SilentPassUI — do not cross-import from x402sdk.
 */
export const GENESIS_NODE_SEAT_PWA_TEST_BUYER_WHITELIST: readonly string[] = [
	'0x6c2774534ec5c050C5573A7B57b63A45AE091a05',
]

/** @deprecated Prefer {@link GENESIS_NODE_SEAT_PWA_TEST_BUYER_WHITELIST}[0] */
export const GENESIS_NODE_SEAT_LOCAL_TEST_EOA = GENESIS_NODE_SEAT_PWA_TEST_BUYER_WHITELIST[0]!

const pwaTestBuyerSetLower = new Set(
	GENESIS_NODE_SEAT_PWA_TEST_BUYER_WHITELIST.map((a) => a.toLowerCase()),
)

/** True when this buyer EOA may use PWA Genesis testMode (4.00 USDC). */
export function isGenesisNodeSeatPwaTestBuyer(eoa: string | null | undefined): boolean {
	if (!eoa || !ethers.isAddress(eoa)) return false
	try {
		return pwaTestBuyerSetLower.has(ethers.getAddress(eoa).toLowerCase())
	} catch {
		return false
	}
}

/** @deprecated Prefer {@link isGenesisNodeSeatPwaTestBuyer} */
export function isGenesisNodeSeatLocalTestEoa(eoa: string | null | undefined): boolean {
	return isGenesisNodeSeatPwaTestBuyer(eoa)
}

/** Settle amount required for local/self-fund gate (PWA whitelist → 4.00 USDC @ qty 1). */
export function genesisNodeSeatLocalRequiredUsdc6(params: {
	beneficiaryEoa: string | null | undefined
	quantity: number
}): { required6: bigint; testMode: boolean; qty: number } {
	if (isGenesisNodeSeatPwaTestBuyer(params.beneficiaryEoa)) {
		return { required6: GENESIS_NODE_SEAT_TEST_USDC6, testMode: true, qty: 1 }
	}
	const qty = Math.max(1, Math.min(100, Math.floor(Number(params.quantity) || 1)))
	return { required6: BigInt(qty) * GENESIS_NODE_SEAT_USDC_PER_NODE6, testMode: false, qty }
}

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

/** @deprecated Prefer {@link buildDiscoverUsdcTreasuryBridgeQrUrl}. Legacy clientTopup → user EOA. */
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

/** Discover insufficient-balance path: third-party pays on beamio.app; settle → treasury; points → AA. */
export function buildDiscoverUsdcTreasuryBridgeQrUrl(params: {
	cardAddress: string
	cardOwner: string
	amount: string
	currency: string
	recipientAa: string
}): string {
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('card', params.cardAddress)
	url.searchParams.set('owner', params.cardOwner)
	url.searchParams.set('amount', params.amount)
	url.searchParams.set('currency', params.currency.toUpperCase())
	url.searchParams.set('aa', params.recipientAa)
	url.searchParams.set('workflow', DISCOVER_USDC_TREASURY_BRIDGE_WORKFLOW)
	url.searchParams.set('paymentToken', 'USDC')
	return url.toString()
}

/** CoNET Genesis Seat lock: open beamio.app x402 page (when local EOA USDC is insufficient). */
export function buildDiscoverGenesisNodeSeatUrl(params: {
	cardAddress: string
	cardOwner: string
	beneficiaryEoa: string
	quantity: number
	/** Evangelist / Admin / L0 EOA from Discover share (optional; legacy name referrerL0). */
	referrerL0?: string | null
	/** Alias — purchase attribution: Admin (no L0 cut), L0 (no L1 cut), or L1 (ratio split). */
	referrerL1?: string | null
	/** When set to `332266`, third-party page settles 4.00 USDC (PWA should only pass this for whitelist buyers). */
	testCode?: string
}): string {
	const testMode =
		Boolean(params.testCode?.trim()) &&
		params.testCode!.trim() === GENESIS_NODE_SEAT_TEST_CODE
	const qty = testMode ? 1 : Math.max(1, Math.floor(Number(params.quantity) || 1))
	const amount = String(qty * GENESIS_NODE_SEAT_USDC_PER_NODE)
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('card', params.cardAddress)
	url.searchParams.set('owner', params.cardOwner)
	url.searchParams.set('amount', amount)
	url.searchParams.set('currency', 'USDC')
	url.searchParams.set('beneficiary', params.beneficiaryEoa)
	url.searchParams.set('qty', String(qty))
	url.searchParams.set('workflow', DISCOVER_GENESIS_NODE_SEAT_WORKFLOW)
	url.searchParams.set('paymentToken', 'USDC')
	if (testMode) url.searchParams.set('test', GENESIS_NODE_SEAT_TEST_CODE)
	const ref = (params.referrerL1 ?? params.referrerL0)?.trim()
	if (ref && ethers.isAddress(ref)) {
		const checksum = ethers.getAddress(ref)
		url.searchParams.set('referrerL1', checksum)
		url.searchParams.set('referrerL0', checksum)
	}
	return url.toString()
}

/**
 * Reuse `/usdc-topup` for wallet CoNET-USDC deposit (no merchant card).
 * `beneficiary` may be the user EOA now, or a Smart Wallet / multisig AA later.
 */
export function buildWalletUsdcDepositUrl(params: {
	beneficiary: string
	amount?: string
}): string {
	const url = new URL(BEAMIO_USDC_TOPUP_URL)
	url.searchParams.set('workflow', WALLET_USDC_DEPOSIT_WORKFLOW)
	url.searchParams.set('beneficiary', ethers.getAddress(params.beneficiary))
	url.searchParams.set('currency', 'USDC')
	url.searchParams.set('paymentToken', 'USDC')
	const amount = params.amount?.trim()
	if (amount) url.searchParams.set('amount', amount)
	return url.toString()
}

export type PayGenesisNodeSeatLocalResult =
	| { ok: true; USDC_tx?: string; testMode?: boolean }
	| { ok: false; error: string; insufficientBalance?: boolean }

/**
 * When the local Verra EOA holds enough USDC on Base, sign EIP-3009 and POST
 * `/api/nfcUsdcTopup` with workflow=genesisNodeSeat (same settle path as homepage).
 *
 * Special: whitelisted PWA buyers ({@link isGenesisNodeSeatPwaTestBuyer}) may settle **4.00 USDC** via
 * `test=332266` when balance ≥ 4.00 USDC (qty forced to 1; vault micro-split).
 * Third-party pages still accept `test=332266` by code alone (no buyer whitelist).
 *
 * Caller should fall back to {@link buildDiscoverGenesisNodeSeatUrl} when
 * `insufficientBalance` is true.
 */
export async function payGenesisNodeSeatWithLocalWallet(params: {
	profile: profile
	privateKeyArmor: string
	cardAddress: string
	cardOwner: string
	beneficiaryEoa: string
	quantity: number
	/** Evangelist / Admin / L0 EOA (optional; legacy param name referrerL0). */
	referrerL0?: string | null
	referrerL1?: string | null
}): Promise<PayGenesisNodeSeatLocalResult> {
	const { required6, testMode, qty } = genesisNodeSeatLocalRequiredUsdc6({
		beneficiaryEoa: params.beneficiaryEoa,
		quantity: params.quantity,
	})
	let balance6: bigint
	try {
		balance6 = await readEoaUsdcBalance6(params.profile)
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Unable to read USDC balance on Base'
		return { ok: false, error: msg }
	}
	if (!eoaCanSelfFundDiscoverTopup(balance6, required6)) {
		return {
			ok: false,
			insufficientBalance: true,
			error: testMode
				? 'Insufficient USDC on Base. Need 4.00 USDC for this test purchase.'
				: `Insufficient USDC on Base. Need ${(qty * GENESIS_NODE_SEAT_USDC_PER_NODE).toLocaleString('en-US')} USDC.`,
		}
	}

	const amountHuman = testMode ? '4.00' : String(qty * GENESIS_NODE_SEAT_USDC_PER_NODE)
	const bodyObj: Record<string, string> = {
		cardAddress: ethers.getAddress(params.cardAddress),
		cardOwner: ethers.getAddress(params.cardOwner),
		amount: amountHuman,
		currency: 'USDC',
		beneficiary: ethers.getAddress(params.beneficiaryEoa),
		qty: String(qty),
		workflow: DISCOVER_GENESIS_NODE_SEAT_WORKFLOW,
	}
	if (testMode) bodyObj.test = GENESIS_NODE_SEAT_TEST_CODE
	const ref = (params.referrerL1 ?? params.referrerL0)?.trim()
	if (ref && ethers.isAddress(ref)) {
		const checksum = ethers.getAddress(ref)
		bodyObj.referrerL1 = checksum
		bodyObj.referrerL0 = checksum
	}

	const topupUrl = `${beamioApi}/api/nfcUsdcTopup`
	const body = JSON.stringify(bodyObj)

	const firstRes = await fetch(topupUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
	})

	if (firstRes.status !== 402) {
		const json = (await firstRes.json().catch(() => ({}))) as {
			success?: boolean
			error?: string
			USDC_tx?: string
		}
		if (firstRes.ok && json.success !== false && json.USDC_tx) {
			return { ok: true, USDC_tx: json.USDC_tx, testMode }
		}
		return {
			ok: false,
			error: json.error ?? `Payment challenge failed (HTTP ${firstRes.status})`,
		}
	}

	const challenge = (await firstRes.json().catch(() => ({}))) as {
		accepts?: Array<{
			maxAmountRequired?: string | number
			payTo?: string
		}>
	}
	const message = Array.isArray(challenge.accepts) ? challenge.accepts[0] : null
	if (!message?.payTo || message.maxAmountRequired == null) {
		return { ok: false, error: 'Invalid payment challenge' }
	}

	let payTo: string
	try {
		payTo = ethers.getAddress(String(message.payTo))
	} catch {
		return { ok: false, error: 'Invalid payment recipient' }
	}
	if (payTo.toLowerCase() !== GENESIS_NODE_BRIDGE_INITIATOR.toLowerCase()) {
		return { ok: false, error: 'Unexpected payment recipient' }
	}

	let payAmount: bigint
	try {
		payAmount = BigInt(String(message.maxAmountRequired).split('.')[0])
	} catch {
		return { ok: false, error: 'Invalid payment amount' }
	}
	if (payAmount !== required6) {
		return {
			ok: false,
			error: `Payment amount mismatch: ${payAmount.toString()} != ${required6.toString()}`,
		}
	}

	const paymentHeader = await AuthorizationSign(payAmount, payTo, params.privateKeyArmor)
	if (!paymentHeader) {
		return { ok: false, error: 'Wallet signature failed' }
	}

	const secondRes = await fetch(topupUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-PAYMENT': paymentHeader,
			'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
		},
		body,
	})
	const json = (await secondRes.json().catch(() => ({}))) as {
		success?: boolean
		error?: string
		USDC_tx?: string
	}
	if (!secondRes.ok || json.success === false) {
		return { ok: false, error: json.error ?? `Payment failed (HTTP ${secondRes.status})` }
	}
	return { ok: true, USDC_tx: json.USDC_tx, testMode }
}

export type PayDiscoverTreasuryBridgeLocalResult =
	| { ok: true; USDC_tx?: string }
	| { ok: false; error: string; insufficientBalance?: boolean }

/**
 * When the local Verra EOA holds enough USDC on Base, sign EIP-3009 and POST
 * `/api/nfcUsdcTopup` with `workflow=treasuryBridge`:
 * Base USDC → bridge initiator; Master LockMint CoNET-USDC → card.owner(),
 * then protocol gateway mint card #0 → user AA (no second user signature).
 *
 * Caller should fall back to CoNET-USDC self-fund or {@link buildDiscoverUsdcTreasuryBridgeQrUrl}
 * when `insufficientBalance` is true.
 */
export async function payDiscoverTreasuryBridgeWithLocalWallet(params: {
	profile: profile
	privateKeyArmor: string
	cardAddress: string
	cardOwner: string
	recipientAa: string
	amount: string
	currency: string
	/** Quoted settle amount from `/api/nfcUsdcTopupQuote` (must match challenge). */
	quotedUsdc6: bigint
}): Promise<PayDiscoverTreasuryBridgeLocalResult> {
	const required6 = params.quotedUsdc6
	if (required6 <= 0n) {
		return { ok: false, error: 'Invalid top-up amount.' }
	}

	let balance6: bigint
	try {
		balance6 = await readEoaUsdcBalance6(params.profile)
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Unable to read USDC balance on Base'
		return { ok: false, error: msg }
	}
	if (!eoaCanSelfFundDiscoverTopup(balance6, required6)) {
		return {
			ok: false,
			insufficientBalance: true,
			error: `Insufficient USDC on Base. Need ${formatQuotedUsdc6ForDisplay(required6)} USDC.`,
		}
	}

	const bodyObj: Record<string, string> = {
		cardAddress: ethers.getAddress(params.cardAddress),
		cardOwner: ethers.getAddress(params.cardOwner),
		amount: params.amount,
		currency: params.currency.toUpperCase(),
		aa: ethers.getAddress(params.recipientAa),
		workflow: DISCOVER_USDC_TREASURY_BRIDGE_WORKFLOW,
		paymentToken: 'USDC',
	}
	const topupUrl = `${beamioApi}/api/nfcUsdcTopup`
	const body = JSON.stringify(bodyObj)

	const firstRes = await fetch(topupUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
	})

	if (firstRes.status !== 402) {
		const json = (await firstRes.json().catch(() => ({}))) as {
			success?: boolean
			error?: string
			USDC_tx?: string
		}
		if (firstRes.ok && json.success !== false && json.USDC_tx) {
			return { ok: true, USDC_tx: json.USDC_tx }
		}
		return {
			ok: false,
			error: json.error ?? `Payment challenge failed (HTTP ${firstRes.status})`,
		}
	}

	const challenge = (await firstRes.json().catch(() => ({}))) as {
		accepts?: Array<{
			maxAmountRequired?: string | number
			payTo?: string
		}>
	}
	const message = Array.isArray(challenge.accepts) ? challenge.accepts[0] : null
	if (!message?.payTo || message.maxAmountRequired == null) {
		return { ok: false, error: 'Invalid payment challenge' }
	}

	let payTo: string
	try {
		payTo = ethers.getAddress(String(message.payTo))
	} catch {
		return { ok: false, error: 'Invalid payment recipient' }
	}
	if (payTo.toLowerCase() !== DISCOVER_TREASURY_BRIDGE_PAYTO.toLowerCase()) {
		return { ok: false, error: 'Unexpected payment recipient' }
	}

	let payAmount: bigint
	try {
		payAmount = BigInt(String(message.maxAmountRequired).split('.')[0])
	} catch {
		return { ok: false, error: 'Invalid payment amount' }
	}
	if (payAmount !== required6) {
		return {
			ok: false,
			error: `Payment amount mismatch: ${payAmount.toString()} != ${required6.toString()}`,
		}
	}

	const paymentHeader = await AuthorizationSign(payAmount, payTo, params.privateKeyArmor)
	if (!paymentHeader) {
		return { ok: false, error: 'Wallet signature failed' }
	}

	const secondRes = await fetch(topupUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-PAYMENT': paymentHeader,
			'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
		},
		body,
	})
	const json = (await secondRes.json().catch(() => ({}))) as {
		success?: boolean
		error?: string
		USDC_tx?: string
	}
	if (!secondRes.ok || json.success === false) {
		return { ok: false, error: json.error ?? `Payment failed (HTTP ${secondRes.status})` }
	}
	return { ok: true, USDC_tx: json.USDC_tx }
}

/** @deprecated Prefer {@link discoverTreasuryBridgePaymentHint}. */
export function discoverClientTopupPaymentHint(): string {
	return 'Ask the payer to scan this QR or open the link to pay USDC on Base. USDC is sent to your wallet; this app completes the merchant top-up after funds arrive.'
}

export function discoverTreasuryBridgePaymentHint(): string {
	return 'Scan this QR or open the link to pay USDC on Base. Funds go to the Beamio treasury; card points credit to your Smart Wallet after payment confirms. The merchant receives CoNET-USDC separately.'
}

type NfcUsdcTopupQuoteResponse = {
	success?: boolean
	error?: string
	quotedUsdc6?: string
	quotedUsdc?: string
}

/** Same quote as beamio.app/usdc-topup payment page — must match what the payer actually sends. */
export async function fetchDiscoverClientTopupQuotedUsdc6(params: {
	cardAddress: string
	cardOwner: string
	amount: string
	currency: string
}): Promise<bigint> {
	const url = new URL(`${beamioApi}/api/nfcUsdcTopupQuote`)
	url.searchParams.set('card', params.cardAddress)
	url.searchParams.set('owner', params.cardOwner)
	url.searchParams.set('amount', params.amount)
	url.searchParams.set('currency', params.currency.toUpperCase())
	url.searchParams.set('paymentToken', 'USDC')
	const res = await fetch(url.toString())
	const json = (await res.json().catch(() => ({}))) as NfcUsdcTopupQuoteResponse
	if (!res.ok || json.success === false) {
		throw new Error(json.error ?? `Quote failed (HTTP ${res.status})`)
	}
	const raw = String(json.quotedUsdc6 ?? '').trim()
	if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) {
		throw new Error('Invalid quote from server')
	}
	return BigInt(raw)
}

export function formatQuotedUsdc6ForDisplay(usdc6: bigint): string {
	const human = ethers.formatUnits(usdc6, 6)
	const n = Number(human)
	return Number.isFinite(n) ? n.toFixed(6).replace(/\.?0+$/, '') || '0' : human
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
		return { error: e instanceof Error ? e.message : tu('network_error') }
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
		return { success: false, error: e instanceof Error ? e.message : tu('network_error') }
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
