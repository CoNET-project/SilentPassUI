import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { fetchMyBrandsBalanceBatch } from '@/utils/myBrandsDashboard'

/**
 * UserCumulativeStatLib — personal referral balances on a merchant program card.
 * Points = ERC-1155 #13 reward voucher; event counts = REF_* scoped tokens (L1).
 */
export const REWARD_VOUCHER_TOKEN_ID = 13n
export const MERCHANT_CARD_REF_CLICK_TOKEN_ID = 21n
export const MERCHANT_CARD_REF_CLAIM_TOKEN_ID = 22n
export const MERCHANT_CARD_REF_BURN_TOKEN_ID = 23n
export const MERCHANT_CARD_REF_PURCHASE_TOKEN_ID = 26n
export const MERCHANT_CARD_REF_INSTALL_TOKEN_ID = 30n

const CACHE_TTL_MS = 30_000

export type SocialReferralEventKey =
	| 'shareClicks'
	| 'installs'
	| 'claims'
	| 'redeems'
	| 'purchases'

export type SocialReferralEventRow = {
	key: SocialReferralEventKey
	label: string
	count: number
}

export type MerchantSocialReferralPoints = {
	cardAddress: string
	merchantName: string
	/** #13 reward voucher balance (points) for this referrer on the card. */
	points: number
	events: SocialReferralEventRow[]
	/** Sum of event counts (for empty-card filter). */
	eventTotal: number
}

type CacheEntry = { value: MerchantSocialReferralPoints[]; fetchedAt: number }
const cacheByEoa = new Map<string, CacheEntry>()
const inflightByEoa = new Map<string, Promise<MerchantSocialReferralPoints[] | null>>()
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(fn, fn)
	queue = run.catch(() => undefined)
	return run
}

function readString(v: unknown): string {
	return typeof v === 'string' ? v.trim() : ''
}

function asRecord(v: unknown): Record<string, unknown> | null {
	return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function merchantNameFromCardRow(row: Record<string, unknown>, cardAddress: string): string {
	const meta = asRecord(row.metadata)
	const share = asRecord(meta?.shareTokenMetadata)
	return (
		readString(meta?.businessName) ||
		readString(share?.businessName) ||
		readString(share?.displayName) ||
		readString(share?.name) ||
		readString(meta?.name) ||
		`${cardAddress.slice(0, 6)}…${cardAddress.slice(-4)}`
	)
}

async function fetchLatestMerchantCards(): Promise<{ cardAddress: string; merchantName: string }[]> {
	try {
		const res = await fetch(`${beamioApi}/api/latestCards?limit=100`)
		if (!res.ok) return []
		const json = (await res.json()) as { items?: unknown[] }
		const items = Array.isArray(json.items) ? json.items : []
		const out: { cardAddress: string; merchantName: string }[] = []
		const seen = new Set<string>()
		for (const raw of items) {
			const row = asRecord(raw)
			if (!row) continue
			const addrRaw = readString(row.cardAddress)
			if (!addrRaw || !ethers.isAddress(addrRaw)) continue
			const cardAddress = ethers.getAddress(addrRaw)
			const key = cardAddress.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			out.push({ cardAddress, merchantName: merchantNameFromCardRow(row, cardAddress) })
		}
		return out
	} catch {
		return []
	}
}

async function readBalances(
	cardAddress: string,
	holder: string,
	tokenIds: bigint[],
): Promise<(number | null)[]> {
	const batch = await fetchMyBrandsBalanceBatch(cardAddress, [holder], tokenIds)
	if (!batch || batch.length !== tokenIds.length) {
		return tokenIds.map(() => null)
	}
	return batch.map((raw) => {
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
	})
}

function buildEventRows(counts: {
	shareClicks: number
	installs: number
	claims: number
	redeems: number
	purchases: number
}): SocialReferralEventRow[] {
	return [
		{ key: 'shareClicks', label: 'Share link clicks', count: counts.shareClicks },
		{ key: 'installs', label: 'App installs', count: counts.installs },
		{ key: 'claims', label: 'Coupon claims', count: counts.claims },
		{ key: 'redeems', label: 'In-store redeems', count: counts.redeems },
		{ key: 'purchases', label: 'Top-ups & purchases', count: counts.purchases },
	]
}

/**
 * Trusted success → list (may be empty); RPC/API failure → null (keep previous UI).
 * Only includes cards where the user has referral points or at least one REF_* event.
 */
export async function fetchBountySocialReferralPoints(
	referrerEoa: string,
): Promise<MerchantSocialReferralPoints[] | null> {
	let holder: string
	try {
		holder = ethers.getAddress(String(referrerEoa ?? '').trim())
	} catch {
		return null
	}
	const eoaKey = holder.toLowerCase()
	const hit = cacheByEoa.get(eoaKey)
	if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.value

	const pending = inflightByEoa.get(eoaKey)
	if (pending) return pending

	const task = enqueue(async () => {
		try {
			const cards = await fetchLatestMerchantCards()
			if (cards.length === 0) {
				const empty: MerchantSocialReferralPoints[] = []
				cacheByEoa.set(eoaKey, { value: empty, fetchedAt: Date.now() })
				return empty
			}

			const tokenIds = [
				REWARD_VOUCHER_TOKEN_ID,
				MERCHANT_CARD_REF_CLICK_TOKEN_ID,
				MERCHANT_CARD_REF_INSTALL_TOKEN_ID,
				MERCHANT_CARD_REF_CLAIM_TOKEN_ID,
				MERCHANT_CARD_REF_BURN_TOKEN_ID,
				MERCHANT_CARD_REF_PURCHASE_TOKEN_ID,
			]

			const rows: MerchantSocialReferralPoints[] = []
			for (const card of cards) {
				const bals = await readBalances(card.cardAddress, holder, tokenIds)
				// Any null → treat that field as untrusted; skip card only if all failed
				if (bals.every((b) => b == null)) continue
				const points = bals[0] ?? 0
				const shareClicks = bals[1] ?? 0
				const installs = bals[2] ?? 0
				const claims = bals[3] ?? 0
				const redeems = bals[4] ?? 0
				const purchases = bals[5] ?? 0
				const events = buildEventRows({ shareClicks, installs, claims, redeems, purchases })
				const eventTotal = events.reduce((s, e) => s + e.count, 0)
				if (points <= 0 && eventTotal <= 0) continue
				rows.push({
					cardAddress: card.cardAddress,
					merchantName: card.merchantName,
					points,
					events,
					eventTotal,
				})
			}

			rows.sort((a, b) => b.points - a.points || b.eventTotal - a.eventTotal)
			cacheByEoa.set(eoaKey, { value: rows, fetchedAt: Date.now() })
			return rows
		} catch {
			return null
		} finally {
			inflightByEoa.delete(eoaKey)
		}
	})

	inflightByEoa.set(eoaKey, task)
	return task
}

export function formatSocialPoints(n: number): string {
	if (!Number.isFinite(n) || n < 0) return '0'
	return Math.trunc(n).toLocaleString('en-US')
}
