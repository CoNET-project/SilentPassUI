import type { ShareTokenMetadataBonusRule, ShareTokenMetadataTopupPromotion } from '@/services/BeamioCard'

export type TopupPromotionRewardType = 'percent' | 'fixed'

export type TopupPromotionDraft = {
	enabled: boolean
	/** When false, validFrom/validTo are ignored and hidden in the editor. */
	validityPeriodEnabled: boolean
	validFrom: string
	validTo: string
	minimumTopupAmount: string
	rewardType: TopupPromotionRewardType
	rewardValue: string
}

/** Default to fixed currency bonus — matches POS mint semantics merchants expect for “+10”. */
export const EMPTY_TOPUP_PROMOTION_DRAFT: TopupPromotionDraft = {
	enabled: false,
	validityPeriodEnabled: false,
	validFrom: '',
	validTo: '',
	minimumTopupAmount: '',
	rewardType: 'fixed',
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

function approxEq(a: number, b: number): boolean {
	return Math.abs(a - b) < 0.005
}

/**
 * Legacy buggy encode wrote `rewardType: percent` + `bonusValue: rewardValue` (unscaled).
 * Correct percent encode uses `bonusValue = paymentAmount * rewardValue / 100`.
 * Heal unscaled rows to **fixed** so UI matches on-chain +CA$N bonus.
 */
export function healTopupPromotionRewardType(
	promo: ShareTokenMetadataTopupPromotion,
	legacyBonus?: ShareTokenMetadataBonusRule | null,
): ShareTokenMetadataTopupPromotion {
	if (promo.rewardType !== 'percent') return promo
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return promo
	const scaled = Math.round(min * reward) / 100
	if (!legacyBonus) return promo
	const bv = parseAmount(legacyBonus.bonusValue)
	if (bv == null) return promo
	// Legacy confirms correct percent encode — keep merchant percent setting.
	if (legacyBonus.bonusProportional && approxEq(bv, scaled)) {
		return promo.rewardType === 'percent' ? promo : { ...promo, rewardType: 'percent' }
	}
	// Legacy flat bonus with mismatched percent label → fixed.
	if (!legacyBonus.bonusProportional && approxEq(bv, reward)) {
		return { ...promo, rewardType: 'fixed' }
	}
	// Buggy percent encode: bonusValue left unscaled (== rewardValue) instead of min*% .
	if (legacyBonus.bonusProportional && approxEq(bv, reward) && !approxEq(bv, scaled)) {
		return { ...promo, rewardType: 'fixed' }
	}
	return promo
}

function inferTopupPromotionRewardType(
	rewardTypeRaw: string,
	min: number,
	reward: number,
	legacy?: ShareTokenMetadataBonusRule | null,
): TopupPromotionRewardType {
	if (rewardTypeRaw === 'percent') return 'percent'
	if (rewardTypeRaw === 'fixed') return 'fixed'
	if (legacy?.bonusProportional) {
		const legacyMin = parseAmount(legacy.paymentAmount)
		const bv = parseAmount(legacy.bonusValue)
		if (legacyMin != null && bv != null && legacyMin > 0) {
			const scaled = Math.round(legacyMin * reward) / 100
			if (approxEq(bv, scaled)) return 'percent'
			if (approxEq(bv, reward) && !approxEq(bv, scaled)) return 'fixed'
		}
	}
	if (legacy && !legacy.bonusProportional) {
		const bv = parseAmount(legacy.bonusValue)
		if (bv != null && approxEq(bv, reward)) return 'fixed'
	}
	return 'fixed'
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

/**
 * Canonical → legacy bonusRule.
 * - fixed: bonus = rewardValue, not proportional
 * - percent: bonusValue = paymentAmount * (rewardValue/100), proportional
 *   so POS `principal * bonusValue / paymentAmount` == `principal * rewardValue / 100`
 */
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
	if (promo.rewardType === 'percent') {
		const bonusValue = Math.round(min * reward) / 100
		if (bonusValue <= 0) return null
		return {
			paymentAmount: min,
			bonusValue,
			bonusProportional: true,
		}
	}
	return {
		paymentAmount: min,
		bonusValue: reward,
		bonusProportional: false,
	}
}

export function legacyBonusRuleToTopupPromotion(
	rule: ShareTokenMetadataBonusRule | null | undefined,
): ShareTokenMetadataTopupPromotion | null {
	if (!rule) return null
	const min = parseAmount(rule.paymentAmount)
	const bonus = parseAmount(rule.bonusValue)
	if (min == null || bonus == null) return null
	if (rule.bonusProportional) {
		const pct = Math.round((bonus / min) * 10000) / 100
		if (pct <= 0) return null
		return {
			enabled: true,
			minimumTopupAmount: min,
			rewardType: 'percent',
			rewardValue: pct,
		}
	}
	return {
		enabled: true,
		minimumTopupAmount: min,
		rewardType: 'fixed',
		rewardValue: bonus,
	}
}

function firstLegacyBonusRule(meta: Record<string, unknown>): ShareTokenMetadataBonusRule | null {
	const rules = meta.bonusRules ?? meta.bonusRule
	const first = Array.isArray(rules) ? rules[0] : rules
	if (first && typeof first === 'object') return first as ShareTokenMetadataBonusRule
	return null
}

export function parseTopupPromotionFromMetadata(meta: Record<string, unknown> | null | undefined): ShareTokenMetadataTopupPromotion | null {
	if (!meta) return null
	const legacyRoot = firstLegacyBonusRule(meta)
	const stm = meta.shareTokenMetadata
	const legacyStm =
		stm && typeof stm === 'object' ? firstLegacyBonusRule(stm as Record<string, unknown>) : null
	const legacy = legacyRoot ?? legacyStm

	const direct = meta.topupPromotion
	if (direct && typeof direct === 'object') {
		const normalized = normalizeTopupPromotionPayload(direct as Record<string, unknown>, legacy)
		return normalized ? healTopupPromotionRewardType(normalized, legacy) : null
	}
	if (stm && typeof stm === 'object') {
		const nested = (stm as Record<string, unknown>).topupPromotion
		if (nested && typeof nested === 'object') {
			const normalized = normalizeTopupPromotionPayload(nested as Record<string, unknown>, legacy)
			return normalized ? healTopupPromotionRewardType(normalized, legacy) : null
		}
	}
	if (legacy) return legacyBonusRuleToTopupPromotion(legacy)
	return null
}

export function normalizeTopupPromotionPayload(
	raw: Record<string, unknown>,
	legacyBonus?: ShareTokenMetadataBonusRule | null,
): ShareTokenMetadataTopupPromotion | null {
	const min = parseAmount(raw.minimumTopupAmount ?? raw.minimum_topup_amount)
	const reward = parseAmount(raw.rewardValue ?? raw.reward_value)
	if (min == null || reward == null) return null
	const rewardTypeRaw = String(raw.rewardType ?? raw.reward_type ?? '').trim().toLowerCase()
	const rewardType = inferTopupPromotionRewardType(rewardTypeRaw, min, reward, legacyBonus)
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
	const validFrom = promo.validFrom ?? ''
	const validTo = promo.validTo ?? ''
	return {
		enabled: promo.enabled !== false,
		validityPeriodEnabled: Boolean(validFrom.trim() || validTo.trim()),
		validFrom,
		validTo,
		minimumTopupAmount:
			promo.minimumTopupAmount != null && Number.isFinite(Number(promo.minimumTopupAmount))
				? String(promo.minimumTopupAmount)
				: '',
		rewardType: promo.rewardType === 'percent' ? 'percent' : 'fixed',
		rewardValue:
			promo.rewardValue != null && Number.isFinite(Number(promo.rewardValue)) ? String(promo.rewardValue) : '',
	}
}

/** Normalize draft fields for open-vs-current dirty comparison in the promotion editor. */
export function normalizeTopupPromotionDraftForCompare(draft: TopupPromotionDraft): TopupPromotionDraft {
	const validityPeriodEnabled = draft.validityPeriodEnabled
	return {
		enabled: draft.enabled,
		validityPeriodEnabled,
		validFrom: validityPeriodEnabled ? draft.validFrom.trim() : '',
		validTo: validityPeriodEnabled ? draft.validTo.trim() : '',
		minimumTopupAmount: draft.minimumTopupAmount.replace(/,/g, '').trim(),
		rewardType: draft.rewardType,
		rewardValue: draft.rewardValue.replace(/,/g, '').trim(),
	}
}

export function topupPromotionDraftsEqual(a: TopupPromotionDraft, b: TopupPromotionDraft): boolean {
	const na = normalizeTopupPromotionDraftForCompare(a)
	const nb = normalizeTopupPromotionDraftForCompare(b)
	return (
		na.enabled === nb.enabled &&
		na.validityPeriodEnabled === nb.validityPeriodEnabled &&
		na.validFrom === nb.validFrom &&
		na.validTo === nb.validTo &&
		na.minimumTopupAmount === nb.minimumTopupAmount &&
		na.rewardType === nb.rewardType &&
		na.rewardValue === nb.rewardValue
	)
}

export function validateTopupPromotionDraft(draft: TopupPromotionDraft): string {
	if (!draft.enabled) return ''
	const min = parseAmount(draft.minimumTopupAmount)
	const reward = parseAmount(draft.rewardValue)
	if (min == null) return 'Minimum top-up amount must be greater than zero.'
	if (reward == null) return 'Reward value must be greater than zero.'
	if (draft.rewardType === 'percent' && reward > 100) return 'Percentage reward cannot exceed 100%.'
	if (draft.validityPeriodEnabled) {
		const from = parseYmd(draft.validFrom)
		const to = parseYmd(draft.validTo)
		if (draft.validFrom.trim() && !from) return 'Valid from must be YYYY-MM-DD.'
		if (draft.validTo.trim() && !to) return 'Valid to must be YYYY-MM-DD.'
		if (from && to && from > to) return 'Valid from cannot be after valid to.'
	}
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
		...(draft.validityPeriodEnabled && parseYmd(draft.validFrom)
			? { validFrom: parseYmd(draft.validFrom) }
			: {}),
		...(draft.validityPeriodEnabled && parseYmd(draft.validTo) ? { validTo: parseYmd(draft.validTo) } : {}),
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
