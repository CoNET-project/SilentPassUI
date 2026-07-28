/**
 * Open-claim coupon status — EOA-scoped semi-permanent local store + daemon map source.
 * Once a wallet has claimed / redeemed a series token on-chain (or queued claim succeeded),
 * UI must keep showing claimed/redeemed across remounts even if RPC lags.
 *
 * Key: eoa + card + issued series tokenId.
 * Never clear claimed/redeemed because of an untrusted empty/claimable read.
 * UI must read via DaemonProvider (memory map hydrated from this store); pages must not
 * reinvent per-page localStorage keys.
 */

import { ethers } from 'ethers'

export type CouponOpenClaimLocalStatus = 'claimed' | 'redeemed'

export type CouponOpenClaimLocalEntry = {
	status: CouponOpenClaimLocalStatus
	cardAddress: string
	tokenId: string
	couponId?: string
	savedAt: number
	/** optimistic = queued API success; chain = trusted on-chain read */
	source: 'optimistic' | 'chain'
}

export type CouponOpenClaimStatusMap = Record<string, CouponOpenClaimLocalEntry>

export type CouponOpenClaimFeedTarget = {
	cardAddress: string
	tokenId: string
	couponId?: string
}

type StoredPayload = {
	v: 1
	eoa: string
	savedAt: number
	byKey: Record<string, CouponOpenClaimLocalEntry>
}

const PREFIX = 'beamio:couponOpenClaimStatus:v1:'
const MAX_STORE_CHARS = 1_200_000
const MAX_ENTRIES_PER_EOA = 2_500

/** Daemon / UI map key: `{cardLower}:{tokenId}` */
export function buildCouponOpenClaimStatusKey(
	cardAddress: string | null | undefined,
	tokenId: string | number | bigint | null | undefined,
): string | null {
	const card = normalizeCard(cardAddress)
	const tid = normalizeTokenId(tokenId)
	if (!card || !tid) return null
	return entryKey(card, tid)
}

function eoaKey(eoaLower: string): string {
	return `${PREFIX}${eoaLower}`
}

function entryKey(cardLower: string, tokenId: string): string {
	return `${cardLower}:${tokenId}`
}

function normalizeEoa(raw: string | null | undefined): string | null {
	const t = String(raw ?? '').trim()
	if (!t || !ethers.isAddress(t)) return null
	try {
		return ethers.getAddress(t).toLowerCase()
	} catch {
		return null
	}
}

function normalizeCard(raw: string | null | undefined): string | null {
	const t = String(raw ?? '').trim()
	if (!t || !ethers.isAddress(t)) return null
	try {
		return ethers.getAddress(t).toLowerCase()
	} catch {
		return null
	}
}

function normalizeTokenId(raw: string | number | bigint | null | undefined): string | null {
	try {
		const s = String(raw ?? '').trim()
		if (!s) return null
		return BigInt(s).toString()
	} catch {
		return null
	}
}

function loadMap(eoaLower: string): CouponOpenClaimStatusMap {
	if (typeof window === 'undefined' || !eoaLower) return {}
	try {
		const raw = localStorage.getItem(eoaKey(eoaLower))
		if (!raw || raw.length > MAX_STORE_CHARS) return {}
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1 || typeof p.eoa !== 'string' || p.eoa.toLowerCase() !== eoaLower) return {}
		if (!p.byKey || typeof p.byKey !== 'object') return {}
		return p.byKey
	} catch {
		return {}
	}
}

function persistMap(eoaLower: string, byKey: CouponOpenClaimStatusMap): void {
	if (typeof window === 'undefined' || !eoaLower) return
	try {
		let next = byKey
		const keys = Object.keys(next)
		if (keys.length > MAX_ENTRIES_PER_EOA) {
			const sorted = keys
				.map((k) => ({ k, t: next[k]?.savedAt ?? 0 }))
				.sort((a, b) => b.t - a.t)
				.slice(0, MAX_ENTRIES_PER_EOA)
			next = {}
			for (const { k } of sorted) {
				const e = byKey[k]
				if (e) next[k] = e
			}
		}
		const payload: StoredPayload = { v: 1, eoa: eoaLower, savedAt: Date.now(), byKey: next }
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(eoaKey(eoaLower), raw)
	} catch {
		/* quota / private mode */
	}
}

/** Rank for merge: redeemed > claimed; chain > optimistic when same rank. */
function statusRank(status: CouponOpenClaimLocalStatus): number {
	return status === 'redeemed' ? 2 : 1
}

/** Full map for current EOA (daemon hydrate). */
export function loadCouponOpenClaimStatusMapForEoa(
	eoaAddress: string | null | undefined,
): CouponOpenClaimStatusMap {
	const eoa = normalizeEoa(eoaAddress)
	if (!eoa) return {}
	return loadMap(eoa)
}

/**
 * Lookup local claim/redeem status for UI (sync, local-first).
 * Prefer DaemonProvider.couponOpenClaimStatusByKey when inside React tree.
 */
export function lookupCouponOpenClaimLocalStatus(
	eoaAddress: string | null | undefined,
	cardAddress: string | null | undefined,
	tokenId: string | number | bigint | null | undefined,
): CouponOpenClaimLocalEntry | null {
	const eoa = normalizeEoa(eoaAddress)
	const card = normalizeCard(cardAddress)
	const tid = normalizeTokenId(tokenId)
	if (!eoa || !card || !tid) return null
	const entry = loadMap(eoa)[entryKey(card, tid)]
	if (!entry || (entry.status !== 'claimed' && entry.status !== 'redeemed')) return null
	return entry
}

export function pickCouponOpenClaimStatusFromMap(
	map: CouponOpenClaimStatusMap,
	cardAddress: string | null | undefined,
	tokenId: string | number | bigint | null | undefined,
): CouponOpenClaimLocalEntry | null {
	const k = buildCouponOpenClaimStatusKey(cardAddress, tokenId)
	if (!k) return null
	const entry = map[k]
	if (!entry || (entry.status !== 'claimed' && entry.status !== 'redeemed')) return null
	return entry
}

/**
 * Persist claimed/redeemed. Never downgrade redeemed→claimed or chain→optimistic wipe.
 * Returns the entry written (or previous if no-op upgrade blocked), null if invalid args.
 */
export function saveCouponOpenClaimLocalStatus(params: {
	eoaAddress: string
	cardAddress: string
	tokenId: string | number | bigint
	couponId?: string | null
	status: CouponOpenClaimLocalStatus
	source: 'optimistic' | 'chain'
}): CouponOpenClaimLocalEntry | null {
	const eoa = normalizeEoa(params.eoaAddress)
	const card = normalizeCard(params.cardAddress)
	const tid = normalizeTokenId(params.tokenId)
	if (!eoa || !card || !tid) return null
	const map = { ...loadMap(eoa) }
	const k = entryKey(card, tid)
	const prev = map[k]
	if (prev) {
		if (statusRank(prev.status) > statusRank(params.status)) return prev
		if (
			prev.status === params.status &&
			prev.source === 'chain' &&
			params.source === 'optimistic'
		) {
			return prev
		}
	}
	const couponId = params.couponId?.trim() || prev?.couponId
	const next: CouponOpenClaimLocalEntry = {
		status: params.status,
		cardAddress: card,
		tokenId: tid,
		...(couponId ? { couponId } : {}),
		savedAt: Date.now(),
		source: params.source,
	}
	map[k] = next
	persistMap(eoa, map)
	return next
}

/** Map local status → CouponOpenClaimEligibility terminal values. */
export function couponOpenClaimEligibilityFromLocal(
	entry: CouponOpenClaimLocalEntry | null | undefined,
): 'already_claimed' | 'already_redeemed' | null {
	if (!entry) return null
	if (entry.status === 'redeemed') return 'already_redeemed'
	if (entry.status === 'claimed') return 'already_claimed'
	return null
}
