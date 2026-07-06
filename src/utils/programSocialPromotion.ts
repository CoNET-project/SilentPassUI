import type { ShareTokenMetadataSocialPromotion } from '@/services/BeamioCard'

/** One active social referral reward at a time (metadata + on-chain rule slots). */
export type SocialPromotionEventKind = 'refClick' | 'refTopup'

export type SocialPromotionDraft = {
	enabled: boolean
	eventKind: SocialPromotionEventKind
	/** #13 reward voucher count minted to referrer per qualifying event. */
	refRewardPoints13: string
}

export const EMPTY_SOCIAL_PROMOTION_DRAFT: SocialPromotionDraft = {
	enabled: false,
	eventKind: 'refClick',
	refRewardPoints13: '1',
}

export const SOCIAL_PROMOTION_REF_CLICK_RULE_ID = 1
export const SOCIAL_PROMOTION_REF_TOPUP_RULE_ID = 2

function parsePositiveInt(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
	if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
	return n
}

export function parseSocialPromotionFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataSocialPromotion | null {
	if (!meta) return null
	const direct = meta.socialPromotion
	if (direct && typeof direct === 'object') {
		return normalizeSocialPromotionPayload(direct as Record<string, unknown>)
	}
	const stm = meta.shareTokenMetadata
	if (stm && typeof stm === 'object') {
		const nested = (stm as Record<string, unknown>).socialPromotion
		if (nested && typeof nested === 'object') {
			return normalizeSocialPromotionPayload(nested as Record<string, unknown>)
		}
	}
	return null
}

export function normalizeSocialPromotionPayload(
	raw: Record<string, unknown>,
): ShareTokenMetadataSocialPromotion | null {
	const points = parsePositiveInt(raw.refRewardPoints13 ?? raw.ref_reward_points13 ?? raw.points13)
	if (points == null) return null
	const kindRaw = String(raw.eventKind ?? raw.event_kind ?? 'refClick').trim()
	const eventKind: SocialPromotionEventKind = kindRaw === 'refTopup' ? 'refTopup' : 'refClick'
	const enabled = raw.enabled === false ? false : true
	return {
		enabled,
		eventKind,
		refRewardPoints13: points,
		...(raw.ruleId != null ? { ruleId: parsePositiveInt(raw.ruleId) ?? undefined } : {}),
	}
}

export function socialPromotionDraftFromMetadata(
	promo: ShareTokenMetadataSocialPromotion | null | undefined,
): SocialPromotionDraft {
	if (!promo) return { ...EMPTY_SOCIAL_PROMOTION_DRAFT }
	return {
		enabled: promo.enabled !== false,
		eventKind: promo.eventKind === 'refTopup' ? 'refTopup' : 'refClick',
		refRewardPoints13: String(promo.refRewardPoints13 ?? 1),
	}
}

export function validateSocialPromotionDraft(draft: SocialPromotionDraft): string {
	if (!draft.enabled) return ''
	const points = parsePositiveInt(draft.refRewardPoints13)
	if (points == null) return 'Referrer reward must be a whole number of social points (≥ 1).'
	if (points > 1_000_000) return 'Referrer reward is too large.'
	if (draft.eventKind !== 'refClick' && draft.eventKind !== 'refTopup') {
		return 'Choose a social event for this promotion.'
	}
	return ''
}

export function socialPromotionDraftToPayload(
	draft: SocialPromotionDraft,
): ShareTokenMetadataSocialPromotion | null {
	if (!draft.enabled) return null
	const err = validateSocialPromotionDraft(draft)
	if (err) return null
	const points = parsePositiveInt(draft.refRewardPoints13)!
	const ruleId =
		draft.eventKind === 'refTopup' ? SOCIAL_PROMOTION_REF_TOPUP_RULE_ID : SOCIAL_PROMOTION_REF_CLICK_RULE_ID
	return {
		enabled: true,
		eventKind: draft.eventKind,
		refRewardPoints13: points,
		ruleId,
	}
}

export function formatSocialPromotionDisplay(
	promo: ShareTokenMetadataSocialPromotion | null | undefined,
): string {
	if (!promo || promo.enabled === false) return 'No social promotion configured.'
	const points = parsePositiveInt(promo.refRewardPoints13)
	if (points == null) return 'Incomplete promotion — open editor to fix reward amount.'
	const eventLabel =
		promo.eventKind === 'refTopup'
			? 'when a referred customer tops up'
			: 'when a shared link is clicked'
	return `${points.toFixed(0)} social point${points === 1 ? '' : 's'} (#13) to referrer ${eventLabel}.`
}

export function socialPromotionRuleIdForEventKind(eventKind: SocialPromotionEventKind): number {
	return eventKind === 'refTopup' ? SOCIAL_PROMOTION_REF_TOPUP_RULE_ID : SOCIAL_PROMOTION_REF_CLICK_RULE_ID
}
