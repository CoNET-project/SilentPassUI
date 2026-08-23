export type DiscoverMembershipFeeTier = {
	tierIndex: number
	name: string
	feeE6: string
	minUsdc6: string
	durationKind?: number
}

export type DiscoverMembershipUiMode = 'need_member' | 'can_upgrade' | 'member_topup_only' | 'no_fee'

export type DiscoverMembershipNftLike = {
	tokenId?: string | number
	isExpired?: boolean
	tier?: string | number
}

export type DiscoverMembershipUiState = {
	mode: DiscoverMembershipUiMode
	feeTiers: DiscoverMembershipFeeTier[]
	joinTier: DiscoverMembershipFeeTier | null
	upgradeTier: DiscoverMembershipFeeTier | null
	currentFeeE6: bigint | null
}

/**
 * User-facing membership amounts use two decimal places (CA$0.50, not 0.500001).
 * Extra E6 dust is truncated toward zero — join pays the locked fee only.
 */
export function membershipFeeE6ToHuman(e6: string | number | undefined | null): string {
	if (e6 == null || e6 === '') return ''
	try {
		const bi = BigInt(String(e6).replace(/,/g, '').trim() || '0')
		if (bi <= 0n) return ''
		const whole = bi / 1_000_000n
		const cents = (bi % 1_000_000n) / 10_000n
		return `${whole}.${cents.toString().padStart(2, '0')}`
	} catch {
		return ''
	}
}

/** Charge / API amount = locked membership fee only (two decimals). `minUsdc6` is unused. */
export function membershipPurchaseApiAmountHuman(
	feeFiat6: string,
	_minUsdc6?: string | number | bigint | null,
): string {
	try {
		const fee = BigInt(String(feeFiat6).replace(/,/g, '').trim() || '0')
		if (fee <= 0n) return '0'
		return membershipFeeE6ToHuman(fee.toString()) || '0'
	} catch {
		return '0'
	}
}

/** Membership NFTs live in [100, 1e11). Exclude #0 points, #1–#30 stats, and issued coupons. */
export const DISCOVER_MEMBERSHIP_NFT_MIN_ID = 100n
export const DISCOVER_ISSUED_NFT_START_ID = 100_000_000_000n

export function parseDiscoverNftTokenId(raw: unknown): bigint | null {
	try {
		const s = String(raw ?? '').replace(/,/g, '').trim()
		if (!s || s === 'Default/Max') return null
		return BigInt(s)
	} catch {
		return null
	}
}

export function isDiscoverMembershipNftTokenId(raw: unknown): boolean {
	const id = parseDiscoverNftTokenId(raw)
	if (id == null) return false
	return id >= DISCOVER_MEMBERSHIP_NFT_MIN_ID && id < DISCOVER_ISSUED_NFT_START_ID
}

export function pickActiveDiscoverMembershipNft<T extends DiscoverMembershipNftLike>(
	nfts?: T[] | null,
): T | undefined {
	return (nfts ?? []).find((n) => !n.isExpired && isDiscoverMembershipNftTokenId(n.tokenId))
}

export function customerHasValidMembershipFromAssets(params: {
	primaryMemberTokenId?: string | number | null
	nfts?: DiscoverMembershipNftLike[] | null
}): boolean {
	const primary = String(params.primaryMemberTokenId ?? '').trim()
	if (primary && primary !== '0' && isDiscoverMembershipNftTokenId(primary)) return true
	return pickActiveDiscoverMembershipNft(params.nfts) != null
}

export function pickLowestMembershipFeeTier(
	tiers: DiscoverMembershipFeeTier[],
): DiscoverMembershipFeeTier | null {
	let best: DiscoverMembershipFeeTier | null = null
	for (const t of tiers) {
		let fee: bigint
		try {
			fee = BigInt(t.feeE6)
		} catch {
			continue
		}
		if (fee <= 0n) continue
		if (!best) {
			best = t
			continue
		}
		try {
			if (fee < BigInt(best.feeE6)) best = t
		} catch {
			/* keep best */
		}
	}
	return best
}

/** Higher membership = strictly greater membershipFeeE6 (not tier index). */
export function pickNextUpgradeTier(
	tiers: DiscoverMembershipFeeTier[],
	currentFeeE6: bigint,
): DiscoverMembershipFeeTier | null {
	let best: DiscoverMembershipFeeTier | null = null
	for (const t of tiers) {
		let fee: bigint
		try {
			fee = BigInt(t.feeE6)
		} catch {
			continue
		}
		if (fee <= currentFeeE6) continue
		if (!best) {
			best = t
			continue
		}
		try {
			if (fee < BigInt(best.feeE6)) best = t
		} catch {
			/* keep best */
		}
	}
	return best
}

export function resolveCurrentMembershipFeeE6(
	tiers: DiscoverMembershipFeeTier[],
	nfts?: DiscoverMembershipNftLike[] | null,
): bigint | null {
	const active = pickActiveDiscoverMembershipNft(nfts)
	if (!active) return null
	const idx = Number(active.tier)
	if (Number.isFinite(idx) && idx >= 0) {
		const matched = tiers.find((t) => t.tierIndex === idx)
		if (matched) {
			try {
				const fee = BigInt(matched.feeE6)
				if (fee > 0n) return fee
			} catch {
				/* fall through */
			}
		}
	}
	const lowest = pickLowestMembershipFeeTier(tiers)
	if (!lowest) return null
	try {
		return BigInt(lowest.feeE6)
	} catch {
		return null
	}
}

export function resolveDiscoverMembershipUiState(params: {
	feeTiers: DiscoverMembershipFeeTier[]
	hasValidMembership: boolean
	nfts?: DiscoverMembershipNftLike[] | null
}): DiscoverMembershipUiState {
	const feeTiers = params.feeTiers.filter((t) => {
		try {
			return BigInt(t.feeE6) > 0n
		} catch {
			return false
		}
	})
	if (feeTiers.length === 0) {
		return {
			mode: 'no_fee',
			feeTiers: [],
			joinTier: null,
			upgradeTier: null,
			currentFeeE6: null,
		}
	}
	const joinTier = pickLowestMembershipFeeTier(feeTiers)
	if (!params.hasValidMembership) {
		return {
			mode: 'need_member',
			feeTiers,
			joinTier,
			upgradeTier: null,
			currentFeeE6: null,
		}
	}
	const currentFeeE6 = resolveCurrentMembershipFeeE6(feeTiers, params.nfts)
	const upgradeTier =
		currentFeeE6 != null ? pickNextUpgradeTier(feeTiers, currentFeeE6) : null
	if (upgradeTier) {
		return {
			mode: 'can_upgrade',
			feeTiers,
			joinTier,
			upgradeTier,
			currentFeeE6,
		}
	}
	return {
		mode: 'member_topup_only',
		feeTiers,
		joinTier,
		upgradeTier: null,
		currentFeeE6,
	}
}
