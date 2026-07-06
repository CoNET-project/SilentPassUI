import type { ShareTokenMetadataSocialExchange } from '@/services/BeamioCard'

export type SocialExchangeKind = 'coupon' | 'usdc'

export type SocialExchangeDraft = {
	enabled: boolean
	kind: SocialExchangeKind
	/** #13 social points burned per claim. */
	pointsCost: string
	/** Human USDC amount (e.g. "1.00") when kind=usdc. */
	usdcReward: string
}

export const EMPTY_SOCIAL_EXCHANGE_DRAFT: SocialExchangeDraft = {
	enabled: true,
	kind: 'coupon',
	pointsCost: '10',
	usdcReward: '1.00',
}

function parsePositiveInt(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
	if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
	return n
}

export function parseSocialExchangeFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataSocialExchange | null {
	if (!meta) return null
	const direct = meta.socialExchange
	if (direct && typeof direct === 'object') {
		return normalizeSocialExchangePayload(direct as Record<string, unknown>)
	}
	const beamioCoupon = meta.beamioCoupon
	if (beamioCoupon && typeof beamioCoupon === 'object') {
		const nested = (beamioCoupon as Record<string, unknown>).socialExchange
		if (nested && typeof nested === 'object') {
			return normalizeSocialExchangePayload(nested as Record<string, unknown>)
		}
	}
	return null
}

export function normalizeSocialExchangePayload(
	raw: Record<string, unknown>,
): ShareTokenMetadataSocialExchange | null {
	const points = parsePositiveInt(raw.pointsCost ?? raw.points_cost ?? raw.points13)
	if (points == null) return null
	const kindRaw = String(raw.kind ?? raw.exchangeKind ?? 'coupon').trim().toLowerCase()
	const kind: SocialExchangeKind = kindRaw === 'usdc' ? 'usdc' : 'coupon'
	let usdcReward6: number | undefined
	if (kind === 'usdc') {
		const raw6 = raw.usdcReward6 ?? raw.usdc_reward6 ?? raw.usdcAmount6
		try {
			const v = BigInt(String(raw6 ?? '').trim())
			if (v <= 0n) return null
			usdcReward6 = Number(v)
		} catch {
			return null
		}
	}
	if (raw.enabled === false) return null
	return {
		enabled: true,
		kind,
		pointsCost: points,
		...(usdcReward6 != null ? { usdcReward6 } : {}),
	}
}

export function socialExchangeDraftFromMetadata(
	exchange: ShareTokenMetadataSocialExchange | null | undefined,
): SocialExchangeDraft {
	if (!exchange) return { ...EMPTY_SOCIAL_EXCHANGE_DRAFT }
	const usdc6 = exchange.usdcReward6 ?? 0
	const usdcHuman = usdc6 > 0 ? (usdc6 / 1_000_000).toFixed(2) : '1.00'
	return {
		enabled: exchange.enabled !== false,
		kind: exchange.kind === 'usdc' ? 'usdc' : 'coupon',
		pointsCost: String(exchange.pointsCost ?? 10),
		usdcReward: usdcHuman,
	}
}

export function validateSocialExchangeDraft(draft: SocialExchangeDraft): string {
	if (!draft.enabled) return 'Social exchange activity must be enabled.'
	const points = parsePositiveInt(draft.pointsCost)
	if (points == null) return 'Points cost must be a whole number ≥ 1.'
	if (points > 1_000_000) return 'Points cost is too large.'
	if (draft.kind !== 'coupon' && draft.kind !== 'usdc') return 'Choose coupon or USDC reward type.'
	if (draft.kind === 'usdc') {
		const usdc = Number.parseFloat(String(draft.usdcReward).replace(/,/g, '').trim())
		if (!Number.isFinite(usdc) || usdc <= 0) return 'USDC reward must be greater than 0.'
		if (usdc > 1_000_000) return 'USDC reward is too large.'
	}
	return ''
}

export function usdcHumanToReward6(raw: string): bigint | null {
	const n = Number.parseFloat(String(raw).replace(/,/g, '').trim())
	if (!Number.isFinite(n) || n <= 0) return null
	return BigInt(Math.round(n * 1_000_000))
}

export function socialExchangeDraftToPayload(
	draft: SocialExchangeDraft,
): ShareTokenMetadataSocialExchange | null {
	if (!draft.enabled) return null
	const err = validateSocialExchangeDraft(draft)
	if (err) return null
	const points = parsePositiveInt(draft.pointsCost)!
	if (draft.kind === 'usdc') {
		const usdcReward6 = usdcHumanToReward6(draft.usdcReward)
		if (usdcReward6 == null || usdcReward6 <= 0n) return null
		return {
			enabled: true,
			kind: 'usdc',
			pointsCost: points,
			usdcReward6: Number(usdcReward6),
		}
	}
	return {
		enabled: true,
		kind: 'coupon',
		pointsCost: points,
	}
}

export function socialExchangeSummaryLabel(exchange: ShareTokenMetadataSocialExchange): string {
	const pts = exchange.pointsCost
	if (exchange.kind === 'usdc' && exchange.usdcReward6 != null && exchange.usdcReward6 > 0) {
		const usdc = (exchange.usdcReward6 / 1_000_000).toFixed(2)
		return `Burn ${pts} social points → $${usdc} CONET-USDC`
	}
	return `Burn ${pts} social points → 1 activity coupon`
}
