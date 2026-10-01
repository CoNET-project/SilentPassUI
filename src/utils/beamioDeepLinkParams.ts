import { ethers } from 'ethers'

/** `ref` / `referrer` query param — sharer EOA for social promotion rewards. */
export function parseDiscoverReferrerFromParams(sp: URLSearchParams): string | null {
	const raw = (sp.get('ref') ?? sp.get('referrer') ?? '').trim()
	if (!raw || !ethers.isAddress(raw)) return null
	return ethers.getAddress(raw)
}

export function parseDiscoverMerchantFromParams(
	sp: URLSearchParams,
): { cardAddress: string; referrerEoa: string | null } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (redeemcode) return null
	const couponId = decodeURIComponent((sp.get('couponId') ?? sp.get('couponid') ?? '').trim())
	if (couponId) return null
	const cardAddress = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const discover = (sp.get('discover') ?? '').trim().toLowerCase()
	if (!cardAddress || !ethers.isAddress(cardAddress)) return null
	if (discover !== 'open' && discover !== '1' && discover !== 'true') return null
	return {
		cardAddress: ethers.getAddress(cardAddress),
		referrerEoa: parseDiscoverReferrerFromParams(sp),
	}
}

/** Resolve referrer from current href and optional router state (Discover / coupon open-claim). */
export function resolveDiscoverShareReferrerEoa(opts?: {
	href?: string
	stateReferrer?: string | null
}): string | null {
	const stateRaw = opts?.stateReferrer?.trim() ?? ''
	if (stateRaw && ethers.isAddress(stateRaw)) {
		try {
			return ethers.getAddress(stateRaw)
		} catch {
			/* fall through to URL */
		}
	}
	const href =
		opts?.href?.trim() ??
		(typeof window !== 'undefined' ? window.location.href : '')
	if (!href) return null
	return parseDiscoverReferrerFromParams(collectDeepLinkSearchParams(href))
}

/**
 * Chat / SMS soft line-breaks and zero-width chars often break `new URL`.
 * Strip whitespace only when the paste looks like a Beamio deep link.
 */
export function normalizeDeepLinkInput(raw: string): string {
	const input = raw?.trim() ?? ''
	if (!input) return ''
	const looksLikeLink =
		/https?:\/\//i.test(input) ||
		/beamio\.app/i.test(input) ||
		/app-download/i.test(input) ||
		/redeemcode=/i.test(input) ||
		/beamiocard=/i.test(input) ||
		/couponid=/i.test(input) ||
		/nftRedeemcode=/i.test(input)
	if (!looksLikeLink) return input
	return input.replace(/[\s\u200b\u200c\u200d\ufeff]+/g, '')
}

/** Merge query from URL search + hash (#/?...) for HashRouter deep links. */
export function collectDeepLinkSearchParams(raw: string): URLSearchParams {
	const merged = new URLSearchParams()
	const input = normalizeDeepLinkInput(raw)
	if (!input) return merged

	const appendParams = (sp: URLSearchParams) => {
		sp.forEach((value, key) => {
			if (!merged.has(key)) merged.set(key, value)
		})
	}

	// Some share handlers encode the complete query as one query key:
	// `?beamiocard%3D0x...%26discover%3Dopen&v=...`.
	// Decode query keys/values that contain a nested query before returning.
	const appendNestedEncodedParams = (sp: URLSearchParams) => {
		sp.forEach((value, key) => {
			for (const raw of [key, value]) {
				let decoded = raw
				for (let i = 0; i < 2; i += 1) {
					try {
						const next = decodeURIComponent(decoded)
						if (next === decoded) break
						decoded = next
					} catch {
						break
					}
				}
				if (!/[=&]/.test(decoded)) continue
				try {
					appendParams(new URLSearchParams(decoded.replace(/^[?]/, '')))
				} catch {
					// Ignore malformed nested query fragments.
				}
			}
		})
	}

	const appendWrappedTargetParams = (sp: URLSearchParams) => {
		const target = sp.get('target')?.trim() ?? ''
		if (!target) return
		try {
			const targetUrl = new URL(target)
			if (targetUrl.origin !== 'https://beamio.app') return
			if (targetUrl.pathname !== '/app/' && targetUrl.pathname !== '/app' && !targetUrl.pathname.startsWith('/app/')) return
			appendParams(targetUrl.searchParams)
			const hash = targetUrl.hash || ''
			if (hash.includes('?')) {
				const hashQuery = hash.slice(hash.indexOf('?') + 1)
				if (hashQuery) appendParams(new URLSearchParams(hashQuery))
			}
		} catch {
			// Ignore invalid or non-Beamio target wrappers.
		}
	}

	try {
		const u = input.startsWith('http') ? new URL(input) : new URL(input, 'https://beamio.app')
		appendParams(u.searchParams)
		appendNestedEncodedParams(u.searchParams)
		appendWrappedTargetParams(u.searchParams)
		const hash = u.hash || ''
		if (hash.includes('?')) {
			const hashQuery = hash.slice(hash.indexOf('?') + 1)
			if (hashQuery) {
				const hashParams = new URLSearchParams(hashQuery)
				appendParams(hashParams)
				appendNestedEncodedParams(hashParams)
				appendWrappedTargetParams(hashParams)
			}
		}
		return merged
	} catch {
		// Fallback: raw query string
		const q = input.startsWith('?') ? input.slice(1) : input
		const params = new URLSearchParams(q)
		appendParams(params)
		appendNestedEncodedParams(params)
		appendWrappedTargetParams(params)
		return merged
	}
}

export function parseCouponOpenClaimFromParams(
	sp: URLSearchParams
): { cardAddress: string; couponId: string; referrerEoa: string | null } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (redeemcode) return null
	const cardAddress = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const couponId = decodeURIComponent((sp.get('couponId') ?? sp.get('couponid') ?? '').trim())
	const claim = (sp.get('claim') ?? '').trim().toLowerCase()
	if (!cardAddress || !couponId) return null
	if (claim && claim !== 'open' && claim !== '1' && claim !== 'true') return null
	if (!ethers.isAddress(cardAddress)) return null
	return {
		cardAddress: ethers.getAddress(cardAddress),
		couponId,
		referrerEoa: parseDiscoverReferrerFromParams(sp),
	}
}

export function parseRedeemClaimFromParams(
	sp: URLSearchParams
): { cardAddress?: string; redeemCode: string; giftImageUrl?: string } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (!redeemcode) return null
	const beamiocard = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const cardAddress =
		beamiocard && ethers.isAddress(beamiocard) ? ethers.getAddress(beamiocard) : undefined
	return {
		cardAddress,
		redeemCode: decodeURIComponent(redeemcode),
		giftImageUrl: sp.get('giftimage')?.trim() || undefined,
	}
}

export function isRedeemDeepLink(raw: string): boolean {
	return !!parseRedeemClaimFromParams(collectDeepLinkSearchParams(raw))
}

export function isCouponOpenClaimDeepLink(raw: string): boolean {
	return !!parseCouponOpenClaimFromParams(collectDeepLinkSearchParams(raw))
}
