import { ethers } from 'ethers'

/** `ref` / `referrer` query param — sharer EOA for social promotion rewards. */
export function parseDiscoverReferrerFromParams(sp: URLSearchParams): string | null {
	const raw = (sp.get('ref') ?? sp.get('referrer') ?? '').trim()
	if (!raw || !ethers.isAddress(raw)) return null
	return ethers.getAddress(raw)
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

/** Merge query from URL search + hash (#/?...) for HashRouter deep links. */
export function collectDeepLinkSearchParams(raw: string): URLSearchParams {
	const merged = new URLSearchParams()
	const input = raw?.trim() ?? ''
	if (!input) return merged

	const appendParams = (sp: URLSearchParams) => {
		sp.forEach((value, key) => {
			if (!merged.has(key)) merged.set(key, value)
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
		appendWrappedTargetParams(u.searchParams)
		const hash = u.hash || ''
		if (hash.includes('?')) {
			const hashQuery = hash.slice(hash.indexOf('?') + 1)
			if (hashQuery) {
				const hashParams = new URLSearchParams(hashQuery)
				appendParams(hashParams)
				appendWrappedTargetParams(hashParams)
			}
		}
		return merged
	} catch {
		// Fallback: raw query string
		const q = input.startsWith('?') ? input.slice(1) : input
		const params = new URLSearchParams(q)
		appendParams(params)
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
): { cardAddress?: string; redeemCode: string } | null {
	const redeemcode = (sp.get('redeemcode') ?? sp.get('Redeemcode') ?? '').trim()
	if (!redeemcode) return null
	const beamiocard = (sp.get('beamiocard') ?? sp.get('Beamiocard') ?? '').trim()
	const cardAddress =
		beamiocard && ethers.isAddress(beamiocard) ? ethers.getAddress(beamiocard) : undefined
	return {
		cardAddress,
		redeemCode: decodeURIComponent(redeemcode),
	}
}

export function isRedeemDeepLink(raw: string): boolean {
	return !!parseRedeemClaimFromParams(collectDeepLinkSearchParams(raw))
}

export function isCouponOpenClaimDeepLink(raw: string): boolean {
	return !!parseCouponOpenClaimFromParams(collectDeepLinkSearchParams(raw))
}
