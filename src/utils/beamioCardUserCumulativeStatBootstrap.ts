import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { getCardsOfOwnerWithDetailsForProfile, signExecuteForOwner } from '@/services/BeamioCard'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

const CARD_INIT_ENDPOINT = `${beamioApi}/api/cardInitializeUserCumulativeStat`
const LS_PREFIX = 'beamio:biz:cumulative-stat-init:v1:'
const READ_CACHE_TTL_MS = 30_000
const FAIL_RETRY_MS = 60_000

const USER_CUMULATIVE_STAT_READ_ABI = [
	'function owner() view returns (address)',
	'function cardUserCumulativeStatTokensInitialized() view returns (bool)',
] as const

const INIT_IFACE = new ethers.Interface([
	'function initializeCardUserCumulativeStatTokens()',
])

type ReadCacheEntry = { initialized: boolean; owner: string; fetchedAt: number }

const readCache = new Map<string, ReadCacheEntry>()
const inflightByCard = new Map<string, Promise<void>>()
const lastFailedAttemptMs = new Map<string, number>()

function cardKey(cardAddress: string): string {
	return ethers.getAddress(cardAddress).toLowerCase()
}

function trustedLsKey(eoaLower: string, cardLower: string): string {
	return `${LS_PREFIX}${eoaLower}:${cardLower}`
}

function markInitializedTrusted(eoa: string, cardAddress: string): void {
	const cardLower = cardKey(cardAddress)
	const eoaLower = ethers.getAddress(eoa).toLowerCase()
	try {
		localStorage.setItem(trustedLsKey(eoaLower, cardLower), '1')
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
		if (localStorage.getItem(trustedLsKey(eoaLower, cardLower)) === '1') return true
	} catch {
		/* ignore */
	}
	const cached = readCache.get(cardLower)
	return cached?.initialized === true
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

async function postCardInitializeUserCumulativeStat(payload: {
	cardAddress: string
	data: string
	deadline: number
	nonce: string
	ownerSignature: string
}): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch(CARD_INIT_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(payload.cardAddress),
				data: payload.data,
				deadline: payload.deadline,
				nonce: payload.nonce,
				ownerSignature: payload.ownerSignature,
			}),
		})
		const data = (await res.json()) as { success?: boolean; error?: string }
		if (!res.ok) {
			const err = typeof data.error === 'string' ? data.error : 'cardInitializeUserCumulativeStat failed'
			if (/already initialized/i.test(err)) return { success: true }
			return { success: false, error: err }
		}
		return { success: data.success !== false }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? String(e) }
	}
}

/**
 * 商家卡未 initializeCardUserCumulativeStatTokens 时，由卡主 EOA 静默补初始化（无 UI 提示）。
 * 失败仅内部重试；RPC 不可信时不提交链上写。
 */
export async function ensureCardUserCumulativeStatInitializedSilent(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
}): Promise<void> {
	const card = ethers.getAddress(params.cardAddress)
	const key = cardKey(card)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	if (isInitializedTrusted(ownerEoa, card)) return

	const inflight = inflightByCard.get(key)
	if (inflight) {
		await inflight
		return
	}

	const work = (async () => {
		const lastFail = lastFailedAttemptMs.get(key)
		if (lastFail != null && Date.now() - lastFail < FAIL_RETRY_MS) return

		const status = await readCardUserCumulativeStatInitialized(card)
		if (!status) return
		if (status.initialized) {
			markInitializedTrusted(ownerEoa, card)
			return
		}
		if (status.owner.toLowerCase() !== ownerEoa.toLowerCase()) return

		const data = INIT_IFACE.encodeFunctionData('initializeCardUserCumulativeStatTokens', [])
		const deadline = Math.floor(Date.now() / 1000) + 3600
		const nonce = ethers.hexlify(ethers.randomBytes(32))
		const ownerSignature = await signExecuteForOwner(
			params.ownerPrivateKey,
			card,
			data,
			deadline,
			nonce,
		)
		const result = await postCardInitializeUserCumulativeStat({
			cardAddress: card,
			data,
			deadline,
			nonce,
			ownerSignature,
		})
		if (result.success) {
			markInitializedTrusted(ownerEoa, card)
			lastFailedAttemptMs.delete(key)
			return
		}
		lastFailedAttemptMs.set(key, Date.now())
	})().finally(() => {
		inflightByCard.delete(key)
	})

	inflightByCard.set(key, work)
	await work
}

type ProfileForOwnerCards = {
	aaAccount?: string | null
	keyID?: string | null
	privateKeyArmor?: string | null
	issuedCards?: { cardAddress: string }[]
}

/**
 * 对 profile 下 factory 索引到的全部商家卡静默补 initialize（仅链上 owner 与签名 EOA 一致时提交）。
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
		await ensureCardUserCumulativeStatInitializedSilent({
			cardAddress,
			ownerEoa,
			ownerPrivateKey: params.ownerPrivateKey,
		}).catch(() => undefined)
	}
}
