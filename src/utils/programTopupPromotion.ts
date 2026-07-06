import type { ShareTokenMetadataBonusRule, ShareTokenMetadataTopupPromotion } from '@/services/BeamioCard'

export type TopupPromotionRewardType = 'percent' | 'fixed'

export type TopupPromotionDraft = {
	enabled: boolean
	validFrom: string
	validTo: string
	minimumTopupAmount: string
	rewardType: TopupPromotionRewardType
	rewardValue: string
}

export const EMPTY_TOPUP_PROMOTION_DRAFT: TopupPromotionDraft = {
	enabled: false,
	validFrom: '',
	validTo: '',
	minimumTopupAmount: '',
	rewardType: 'percent',
	rewardValue: '',
}

function parseAmount(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(/,/g, '').trim())
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.round(n * 100) / 100
}

function parseYmd(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined
	const t = raw.trim()
	if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined
	return t
}

export function formatLocalYmd(d: Date = new Date()): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

/** Inclusive calendar-date window (local timezone). */
export function isTopupPromotionActive(
	promo: ShareTokenMetadataTopupPromotion | null | undefined,
	now: Date = new Date(),
): boolean {
	if (!promo || promo.enabled === false) return false
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return false
	const today = formatLocalYmd(now)
	const from = parseYmd(promo.validFrom)
	const to = parseYmd(promo.validTo)
	if (from && today < from) return false
	if (to && today > to) return false
	return true
}

export function topupPromotionToLegacyBonusRule(
	promo: ShareTokenMetadataTopupPromotion,
): ShareTokenMetadataBonusRule | null {
	if (!isTopupPromotionActive(promo)) {
		const min = parseAmount(promo.minimumTopupAmount)
		const reward = parseAmount(promo.rewardValue)
		if (promo.enabled === false || min == null || reward == null) return null
	}
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return null
	if (promo.enabled === false) return null
	return {
		paymentAmount: min,
		bonusValue: reward,
		bonusProportional: promo.rewardType === 'percent',
	}
}

export function legacyBonusRuleToTopupPromotion(
	rule: ShareTokenMetadataBonusRule | null | undefined,
): ShareTokenMetadataTopupPromotion | null {
	if (!rule) return null
	const min = parseAmount(rule.paymentAmount)
	const reward = parseAmount(rule.bonusValue)
	if (min == null || reward == null) return null
	return {
		enabled: true,
		minimumTopupAmount: min,
		rewardType: rule.bonusProportional ? 'percent' : 'fixed',
		rewardValue: reward,
	}
}

export function parseTopupPromotionFromMetadata(meta: Record<string, unknown> | null | undefined): ShareTokenMetadataTopupPromotion | null {
	if (!meta) return null
	const direct = meta.topupPromotion
	if (direct && typeof direct === 'object') {
		return normalizeTopupPromotionPayload(direct as Record<string, unknown>)
	}
	const stm = meta.shareTokenMetadata
	if (stm && typeof stm === 'object') {
		const nested = (stm as Record<string, unknown>).topupPromotion
		if (nested && typeof nested === 'object') {
			return normalizeTopupPromotionPayload(nested as Record<string, unknown>)
		}
	}
	const rules = meta.bonusRules ?? meta.bonusRule
	const first = Array.isArray(rules) ? rules[0] : rules
	if (first && typeof first === 'object') {
		return legacyBonusRuleToTopupPromotion(first as ShareTokenMetadataBonusRule)
	}
	if (stm && typeof stm === 'object') {
		const stmRec = stm as Record<string, unknown>
		const stmRules = stmRec.bonusRules ?? stmRec.bonusRule
		const stmFirst = Array.isArray(stmRules) ? stmRules[0] : stmRules
		if (stmFirst && typeof stmFirst === 'object') {
			return legacyBonusRuleToTopupPromotion(stmFirst as ShareTokenMetadataBonusRule)
		}
	}
	return null
}

export function normalizeTopupPromotionPayload(raw: Record<string, unknown>): ShareTokenMetadataTopupPromotion | null {
	const min = parseAmount(raw.minimumTopupAmount ?? raw.minimum_topup_amount)
	const reward = parseAmount(raw.rewardValue ?? raw.reward_value)
	if (min == null || reward == null) return null
	const rewardTypeRaw = String(raw.rewardType ?? raw.reward_type ?? '').trim().toLowerCase()
	const rewardType: TopupPromotionRewardType =
		rewardTypeRaw === 'fixed' ? 'fixed' : rewardTypeRaw === 'percent' ? 'percent' : 'percent'
	const enabled = raw.enabled === false ? false : true
	return {
		enabled,
		validFrom: parseYmd(raw.validFrom ?? raw.valid_from),
		validTo: parseYmd(raw.validTo ?? raw.valid_to),
		minimumTopupAmount: min,
		rewardType,
		rewardValue: reward,
	}
}

export function topupPromotionDraftFromMetadata(
	promo: ShareTokenMetadataTopupPromotion | null | undefined,
): TopupPromotionDraft {
	if (!promo) return { ...EMPTY_TOPUP_PROMOTION_DRAFT }
	return {
		enabled: promo.enabled !== false,
		validFrom: promo.validFrom ?? '',
		validTo: promo.validTo ?? '',
		minimumTopupAmount:
			promo.minimumTopupAmount != null && Number.isFinite(Number(promo.minimumTopupAmount))
				? String(promo.minimumTopupAmount)
				: '',
		rewardType: promo.rewardType === 'fixed' ? 'fixed' : 'percent',
		rewardValue:
			promo.rewardValue != null && Number.isFinite(Number(promo.rewardValue)) ? String(promo.rewardValue) : '',
	}
}

export function validateTopupPromotionDraft(draft: TopupPromotionDraft): string {
	if (!draft.enabled) return ''
	const min = parseAmount(draft.minimumTopupAmount)
	const reward = parseAmount(draft.rewardValue)
	if (min == null) return 'Minimum top-up amount must be greater than zero.'
	if (reward == null) return 'Reward value must be greater than zero.'
	if (draft.rewardType === 'percent' && reward > 100) return 'Percentage reward cannot exceed 100%.'
	const from = parseYmd(draft.validFrom)
	const to = parseYmd(draft.validTo)
	if (draft.validFrom.trim() && !from) return 'Valid from must be YYYY-MM-DD.'
	if (draft.validTo.trim() && !to) return 'Valid to must be YYYY-MM-DD.'
	if (from && to && from > to) return 'Valid from cannot be after valid to.'
	return ''
}

export function topupPromotionDraftToPayload(draft: TopupPromotionDraft): ShareTokenMetadataTopupPromotion | null {
	if (!draft.enabled) return null
	const err = validateTopupPromotionDraft(draft)
	if (err) return null
	const min = parseAmount(draft.minimumTopupAmount)!
	const reward = parseAmount(draft.rewardValue)!
	return {
		enabled: true,
		...(parseYmd(draft.validFrom) ? { validFrom: parseYmd(draft.validFrom) } : {}),
		...(parseYmd(draft.validTo) ? { validTo: parseYmd(draft.validTo) } : {}),
		minimumTopupAmount: min,
		rewardType: draft.rewardType,
		rewardValue: reward,
	}
}

export function formatTopupPromotionDisplay(
	promo: ShareTokenMetadataTopupPromotion | null | undefined,
	moneyPrefix: string,
): string {
	if (!promo || promo.enabled === false) return 'No top-up promotion configured.'
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return 'Incomplete promotion — open editor to fix amounts.'
	const rewardLabel =
		promo.rewardType === 'percent' ? `${reward}% bonus` : `${moneyPrefix}${reward.toFixed(2)} bonus`
	const period =
		promo.validFrom || promo.validTo
			? ` (${promo.validFrom ?? '…'} – ${promo.validTo ?? '…'})`
			: ''
	return `Min ${moneyPrefix}${min.toFixed(2)} → ${rewardLabel}${period}`
}
