import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import {
	getCardsOfOwnerWithDetailsForProfile,
	signExecuteForOwner,
	type UserCardInfo,
} from '@/services/BeamioCard'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

const CARD_INIT_ENDPOINT = `${beamioApi}/api/cardInitializeUserCumulativeStat`
const CARD_BOOTSTRAP_ISSUED_ENDPOINT = `${beamioApi}/api/cardBootstrapIssuedNftV2Stat`

const LS_INIT_PREFIX = 'beamio:biz:cumulative-stat-init:v1:'
const LS_ISSUED_BOOTSTRAP_PREFIX = 'beamio:biz:v2-issued-stat-bootstrap:v1:'

const READ_CACHE_TTL_MS = 30_000
const FAIL_RETRY_MS = 60_000
const ISSUED_NFT_START_ID = 100_000_000_000n

const USER_CUMULATIVE_STAT_READ_ABI = [
	'function owner() view returns (address)',
	'function cardUserCumulativeStatTokensInitialized() view returns (bool)',
] as const

const INIT_IFACE = new ethers.Interface([
	'function initializeCardUserCumulativeStatTokens()',
])

const BOOTSTRAP_ISSUED_IFACE = new ethers.Interface([
	'function bootstrapIssuedNftV2StatTokens(uint256 parentTokenId)',
])

type ReadCacheEntry = { initialized: boolean; owner: string; fetchedAt: number }

const readCache = new Map<string, ReadCacheEntry>()
const inflightByCard = new Map<string, Promise<void>>()
const lastFailedAttemptMs = new Map<string, number>()

function cardKey(cardAddress: string): string {
	return ethers.getAddress(cardAddress).toLowerCase()
}

function trustedInitLsKey(eoaLower: string, cardLower: string): string {
	return `${LS_INIT_PREFIX}${eoaLower}:${cardLower}`
}

function trustedIssuedBootstrapLsKey(eoaLower: string, cardLower: string, parentId: string): string {
	return `${LS_ISSUED_BOOTSTRAP_PREFIX}${eoaLower}:${cardLower}:${parentId}`
}

function markInitializedTrusted(eoa: string, cardAddress: string): void {
	const cardLower = cardKey(cardAddress)
	const eoaLower = ethers.getAddress(eoa).toLowerCase()
	try {
		localStorage.setItem(trustedInitLsKey(eoaLower, cardLower), '1')
	} catch {
		/* ignore quota */
	}
	readCache.set(cardLower, {
		initialized: true,
		owner: eoaLower,
		fetchedAt: Date.now(),
	})
}

function isInitializedTrusted(eoa: string, cardAddress: string): boolean {
	const cardLower = cardKey(cardAddress)
	const eoaLower = ethers.getAddress(eoa).toLowerCase()
	try {
		if (localStorage.getItem(trustedInitLsKey(eoaLower, cardLower)) === '1') return true
	} catch {
		/* ignore */
	}
	const cached = readCache.get(cardLower)
	return cached?.initialized === true
}

function markIssuedBootstrapTrusted(eoa: string, cardAddress: string, parentTokenId: bigint): void {
	const cardLower = cardKey(cardAddress)
	const eoaLower = ethers.getAddress(eoa).toLowerCase()
	try {
		localStorage.setItem(trustedIssuedBootstrapLsKey(eoaLower, cardLower, parentTokenId.toString()), '1')
	} catch {
		/* ignore */
	}
}

function isIssuedBootstrapTrusted(eoa: string, cardAddress: string, parentTokenId: bigint): boolean {
	const cardLower = cardKey(cardAddress)
	const eoaLower = ethers.getAddress(eoa).toLowerCase()
	try {
		return localStorage.getItem(trustedIssuedBootstrapLsKey(eoaLower, cardLower, parentTokenId.toString())) === '1'
	} catch {
		return false
	}
}

/** RPC read; `null` = untrusted failure (do not treat as uninitialized). */
export async function readCardUserCumulativeStatInitialized(
	cardAddress: string,
): Promise<{ initialized: boolean; owner: string } | null> {
	const card = ethers.getAddress(cardAddress)
	const key = cardKey(card)
	const cached = readCache.get(key)
	if (cached && Date.now() - cached.fetchedAt < READ_CACHE_TTL_MS) {
		return { initialized: cached.initialized, owner: cached.owner }
	}
	try {
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, USER_CUMULATIVE_STAT_READ_ABI, provider)
		const [ownerRaw, initialized] = await Promise.all([
			reader.owner() as Promise<string>,
			reader.cardUserCumulativeStatTokensInitialized() as Promise<boolean>,
		])
		const owner = ethers.getAddress(ownerRaw)
		readCache.set(key, { initialized: !!initialized, owner, fetchedAt: Date.now() })
		return { initialized: !!initialized, owner }
	} catch {
		return null
	}
}

export async function postOwnerExecuteForOwner(
	endpoint: string,
	payload: {
		cardAddress: string
		data: string
		deadline: number
		nonce: string
		ownerSignature: string
		extra?: Record<string, string | number>
	},
	idempotentPatterns: RegExp[] = [],
): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(payload.cardAddress),
				data: payload.data,
				deadline: payload.deadline,
				nonce: payload.nonce,
				ownerSignature: payload.ownerSignature,
				...payload.extra,
			}),
		})
		const data = (await res.json()) as { success?: boolean; error?: string }
		if (!res.ok) {
			const err = typeof data.error === 'string' ? data.error : `${endpoint} failed`
			if (idempotentPatterns.some((re) => re.test(err))) return { success: true }
			return { success: false, error: err }
		}
		return { success: data.success !== false }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? String(e) }
	}
}

async function signOwnerExecuteForOwner(
	ownerPrivateKey: string,
	cardAddress: string,
	data: string,
): Promise<{ data: string; deadline: number; nonce: string; ownerSignature: string }> {
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const ownerSignature = await signExecuteForOwner(ownerPrivateKey, cardAddress, data, deadline, nonce)
	return { data, deadline, nonce, ownerSignature }
}

type IssuedSeriesRow = { tokenId?: string }

async function fetchIssuedSeriesParentIds(cardAddress: string): Promise<{ parentIds: bigint[]; trusted: boolean }> {
	const card = ethers.getAddress(cardAddress)
	const urls = [
		`${beamioApi}/api/cardActiveIssuedCouponSeries?card=${encodeURIComponent(card)}&limit=50`,
		`${beamioApi}/api/cardActiveIssuedProductionSeries?card=${encodeURIComponent(card)}&limit=50`,
	]
	const parentIds = new Set<string>()
	let anyOk = false
	await Promise.all(
		urls.map(async (url) => {
			try {
				const res = await fetch(url)
				if (!res.ok) return
				anyOk = true
				const json = (await res.json()) as { items?: IssuedSeriesRow[] }
				if (!Array.isArray(json.items)) return
				for (const row of json.items) {
					const raw = String(row?.tokenId ?? '').trim()
					if (!raw || !/^\d+$/.test(raw)) continue
					try {
						const id = BigInt(raw)
						if (id >= ISSUED_NFT_START_ID) parentIds.add(id.toString())
					} catch {
						/* skip */
					}
				}
			} catch {
				/* untrusted */
			}
		}),
	)
	if (!anyOk) return { parentIds: [], trusted: false }
	return { parentIds: [...parentIds].map((s) => BigInt(s)), trusted: true }
}

async function ensureCardUserCumulativeStatInitializedSilentInner(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
}): Promise<boolean> {
	const card = ethers.getAddress(params.cardAddress)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	if (isInitializedTrusted(ownerEoa, card)) return true

	const status = await readCardUserCumulativeStatInitialized(card)
	if (!status) return false
	if (status.initialized) {
		markInitializedTrusted(ownerEoa, card)
		return true
	}
	if (status.owner.toLowerCase() !== ownerEoa.toLowerCase()) return false

	const data = INIT_IFACE.encodeFunctionData('initializeCardUserCumulativeStatTokens', [])
	const signed = await signOwnerExecuteForOwner(params.ownerPrivateKey, card, data)
	const result = await postCardInitializeUserCumulativeStat({
		cardAddress: card,
		...signed,
	})
	if (result.success) {
		markInitializedTrusted(ownerEoa, card)
		return true
	}
	return false
}

async function postCardInitializeUserCumulativeStat(payload: {
	cardAddress: string
	data: string
	deadline: number
	nonce: string
	ownerSignature: string
}): Promise<{ success: boolean; error?: string }> {
	return postOwnerExecuteForOwner(CARD_INIT_ENDPOINT, payload, [/already initialized/i])
}

async function ensureIssuedSeriesV2StatBootstrappedSilentInner(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
}): Promise<void> {
	const card = ethers.getAddress(params.cardAddress)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	const { parentIds, trusted } = await fetchIssuedSeriesParentIds(card)
	if (!trusted) return

	for (const parentTokenId of parentIds) {
		if (isIssuedBootstrapTrusted(ownerEoa, card, parentTokenId)) continue

		const data = BOOTSTRAP_ISSUED_IFACE.encodeFunctionData('bootstrapIssuedNftV2StatTokens', [parentTokenId])
		const signed = await signOwnerExecuteForOwner(params.ownerPrivateKey, card, data)
		const result = await postOwnerExecuteForOwner(
			CARD_BOOTSTRAP_ISSUED_ENDPOINT,
			{
				cardAddress: card,
				...signed,
				extra: { parentTokenId: parentTokenId.toString() },
			},
			[/already/i, /initialized/i],
		)
		if (result.success) {
			markIssuedBootstrapTrusted(ownerEoa, card, parentTokenId)
		}
	}
}

/**
 * Full CoNET merchant-card V2 silent bootstrap for an already-issued card (additive only):
 * 1) initializeCardUserCumulativeStatTokens
 * 2) bootstrapIssuedNftV2StatTokens for each active issued coupon/catalog parent
 *
 * Does not configure social promotion reward rules — merchants opt in via Programs → Social Promotion.
 */
export async function ensureCardMerchantV2SilentBootstrap(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
}): Promise<void> {
	const card = ethers.getAddress(params.cardAddress)
	const key = cardKey(card)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	const inflight = inflightByCard.get(key)
	if (inflight) {
		await inflight
		return
	}

	const work = (async () => {
		const lastFail = lastFailedAttemptMs.get(key)
		if (lastFail != null && Date.now() - lastFail < FAIL_RETRY_MS) return

		const initOk = await ensureCardUserCumulativeStatInitializedSilentInner(params)
		if (!initOk) {
			lastFailedAttemptMs.set(key, Date.now())
			return
		}

		await ensureIssuedSeriesV2StatBootstrappedSilentInner(params)

		lastFailedAttemptMs.delete(key)
	})().finally(() => {
		inflightByCard.delete(key)
	})

	inflightByCard.set(key, work)
	await work
}

/**
 * Step 1 only (legacy export). Prefer ensureCardMerchantV2SilentBootstrap for full V2.
 */
export async function ensureCardUserCumulativeStatInitializedSilent(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
}): Promise<void> {
	await ensureCardMerchantV2SilentBootstrap(params)
}

type ProfileForOwnerCards = {
	aaAccount?: string | null
	keyID?: string | null
	privateKeyArmor?: string | null
	issuedCards?: UserCardInfo[]
}

/**
 * Silent V2 bootstrap for every owner merchant card on CoNET (login / feeder).
 */
export async function ensureProfileOwnerCardsUserCumulativeStatInitializedSilent(params: {
	profile: ProfileForOwnerCards
	ownerPrivateKey: string
}): Promise<void> {
	let ownerEoa: string
	try {
		ownerEoa = new ethers.Wallet(params.ownerPrivateKey).address
	} catch {
		return
	}

	const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(params.profile)
	const addresses = new Set<string>()
	for (const c of cards) {
		if (c?.cardAddress && ethers.isAddress(c.cardAddress)) {
			addresses.add(ethers.getAddress(c.cardAddress))
		}
	}
	if (addresses.size === 0 && !trusted) return

	for (const cardAddress of addresses) {
		await ensureCardMerchantV2SilentBootstrap({
			cardAddress,
			ownerEoa,
			ownerPrivateKey: params.ownerPrivateKey,
		}).catch(() => undefined)
	}
}

/** Alias for explicit full-V2 naming in new call sites. */
export const ensureProfileOwnerCardsMerchantV2SilentBootstrap =
	ensureProfileOwnerCardsUserCumulativeStatInitializedSilent
