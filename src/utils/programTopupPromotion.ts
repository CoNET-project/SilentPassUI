/**
 * Programs → Top-up Promotion (canonical metadata: shareTokenMetadata.topupPromotion).
 * POS still consumes legacy bonusRules[]; fixed/tiered mode expands to multiple rules.
 *
 * Types live here (not BeamioCard) to avoid a webpack circular graph:
 * BeamioCard → this module → BeamioCard, which drops named exports at build time.
 */

/** ERC-1155 shareTokenMetadata bonus rule (legacy POS shape). */
export type ShareTokenMetadataBonusRule = {
	paymentAmount?: number
	bonusValue?: number
	/**
	 * When true, bonus scales with actual top-up: `bonusPaid = topupAmount * (bonusValue / paymentAmount)`.
	 * When false/omitted, `bonusPaid` is the fixed `bonusValue` when the rule applies (POS reads from metadata).
	 */
	bonusProportional?: boolean
}

/** Draft / hydrate form — amounts may be strings (card-configurator localStorage). */
export type ShareTokenMetadataBonusRuleLoose = {
	paymentAmount?: number | string
	bonusValue?: number | string
	bonusProportional?: boolean
	id?: string
}

/** One fixed / tiered top-up → bonus store-credit row. */
export type ShareTokenMetadataTopupPromotionFixedTier = {
	/** Minimum top-up (card currency) to unlock this bonus. */
	topupAmount: number
	/** Fixed bonus store credits (card currency). */
	bonusAmount: number
}

/** Global top-up promotion; POS still expands to legacy bonusRules[]. */
export type ShareTokenMetadataTopupPromotion = {
	enabled?: boolean
	/** Inclusive start date YYYY-MM-DD (local calendar). */
	validFrom?: string
	/** Inclusive end date YYYY-MM-DD (local calendar). */
	validTo?: string
	/** Percent floor, or first fixed tier (compat). */
	minimumTopupAmount: number
	rewardType: 'percent' | 'fixed'
	/** Percent of top-up, or first fixed tier bonus (compat). */
	rewardValue: number
	/** Fixed / Tiered Fixed rows (TOP-UP → GET BONUS). Prefer over single rewardValue when length > 0. */
	fixedTiers?: ShareTokenMetadataTopupPromotionFixedTier[]
}

/**
 * Loose hydrate input — metadata uses numbers; card-configurator local draft may use strings.
 * {@link parseTopupPromotionFromMetadata} normalizes via parseAmount.
 */
export type TopupPromotionMetadataLoose = {
	enabled?: boolean
	validFrom?: string
	validTo?: string
	minimumTopupAmount?: number | string
	rewardType?: string
	rewardValue?: number | string
	fixedTiers?: Array<{
		topupAmount?: number | string
		bonusAmount?: number | string
		id?: string
	}>
}

/** Narrow metadata slice used to hydrate the Top-up Promotion draft. */
export type TopupPromotionMetadataSource = {
	topupPromotion?: ShareTokenMetadataTopupPromotion | TopupPromotionMetadataLoose | null
	bonusRule?: ShareTokenMetadataBonusRule | ShareTokenMetadataBonusRuleLoose | null
	bonusRules?: Array<ShareTokenMetadataBonusRule | ShareTokenMetadataBonusRuleLoose> | null
}

export type TopupPromotionRewardType = 'percent' | 'fixed'

export type TopupPromotionFixedTierDraft = {
	id: string
	topupAmount: string
	bonusAmount: string
}

export type TopupPromotionDraft = {
	enabled: boolean
	validityPeriodEnabled: boolean
	validFrom: string
	validTo: string
	/** Percent mode floor; also used as legacy single-tier compat. */
	minimumTopupAmount: string
	rewardType: TopupPromotionRewardType
	/** Percent mode: % of top-up. Fixed single-tier legacy: bonus amount. */
	rewardValue: string
	/** Fixed / Tiered Fixed rows (TOP-UP → GET BONUS). */
	fixedTiers: TopupPromotionFixedTierDraft[]
}

export const TOPUP_PROMOTION_FIXED_TIERS_MAX = 32

export function newTopupPromotionFixedTierId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Default Tiered Fixed rows (100→10, 200→50). Named FixedTiers (plural) — must match biz.tsx imports. */
function defaultFixedTiersDraftRows(): TopupPromotionFixedTierDraft[] {
	return [
		{ id: newTopupPromotionFixedTierId(), topupAmount: '100', bonusAmount: '10' },
		{ id: newTopupPromotionFixedTierId(), topupAmount: '200', bonusAmount: '50' },
	]
}

export function createDefaultFixedTiersDraft(): TopupPromotionFixedTierDraft[] {
	return defaultFixedTiersDraftRows()
}

export const EMPTY_TOPUP_PROMOTION_DRAFT: TopupPromotionDraft = {
	enabled: false,
	validityPeriodEnabled: false,
	validFrom: '',
	validTo: '',
	minimumTopupAmount: '10',
	rewardType: 'fixed',
	rewardValue: '10',
	fixedTiers: defaultFixedTiersDraftRows(),
}

function parseAmount(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(/,/g, '').trim())
	if (!Number.isFinite(n) || n < 0) return null
	return Math.round(n * 100) / 100
}

function parseYmd(raw: unknown): string {
	if (typeof raw !== 'string') return ''
	const t = raw.trim()
	return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}

function approxEq(a: number, b: number): boolean {
	return Math.abs(a - b) < 0.005
}

function normalizeFixedTiersFromRaw(raw: unknown): ShareTokenMetadataTopupPromotionFixedTier[] {
	if (!Array.isArray(raw)) return []
	const out: ShareTokenMetadataTopupPromotionFixedTier[] = []
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue
		const o = row as Record<string, unknown>
		const topup = parseAmount(o.topupAmount ?? o.topup_amount ?? o.paymentAmount ?? o.payment_amount)
		const bonus = parseAmount(o.bonusAmount ?? o.bonus_amount ?? o.bonusValue ?? o.bonus_value)
		if (topup == null || bonus == null || topup <= 0 || bonus <= 0) continue
		out.push({ topupAmount: topup, bonusAmount: bonus })
	}
	out.sort((a, b) => a.topupAmount - b.topupAmount)
	return out.slice(0, TOPUP_PROMOTION_FIXED_TIERS_MAX)
}

function fixedTiersDraftFromNormalized(
	tiers: ShareTokenMetadataTopupPromotionFixedTier[],
): TopupPromotionFixedTierDraft[] {
	if (tiers.length === 0) return createDefaultFixedTierDraft()
	return tiers.map((t) => ({
		id: newTopupPromotionFixedTierId(),
		topupAmount: String(t.topupAmount),
		bonusAmount: String(t.bonusAmount),
	}))
}

function parseValidFixedTiersDraft(
	tiers: TopupPromotionFixedTierDraft[],
): ShareTokenMetadataTopupPromotionFixedTier[] | null {
	const out: ShareTokenMetadataTopupPromotionFixedTier[] = []
	const seen = new Set<number>()
	for (const row of tiers) {
		const topup = parseAmount(row.topupAmount)
		const bonus = parseAmount(row.bonusAmount)
		if (topup == null || bonus == null || topup <= 0 || bonus <= 0) return null
		const key = Math.round(topup * 100)
		if (seen.has(key)) return null
		seen.add(key)
		out.push({ topupAmount: topup, bonusAmount: bonus })
	}
	if (out.length === 0) return null
	out.sort((a, b) => a.topupAmount - b.topupAmount)
	return out
}

/**
 * Heal legacy buggy encode: `rewardType: percent` + unscaled `bonusValue === rewardValue`.
 */
export function healTopupPromotionRewardType(
	promo: ShareTokenMetadataTopupPromotion | TopupPromotionMetadataLoose,
	legacyBonus?: ShareTokenMetadataBonusRule | ShareTokenMetadataBonusRuleLoose | null,
): ShareTokenMetadataTopupPromotion | TopupPromotionMetadataLoose {
	if (promo.rewardType !== 'percent') return promo
	const min = Number(promo.minimumTopupAmount)
	const reward = Number(promo.rewardValue)
	if (!(min > 0) || !(reward > 0)) return promo
	const scaled = Math.round(min * reward) / 100
	if (!legacyBonus) return promo
	const bv = Number(legacyBonus.bonusValue)
	if (!Number.isFinite(bv)) return promo
	if (!legacyBonus.bonusProportional && approxEq(bv, reward)) {
		return { ...promo, rewardType: 'fixed' }
	}
	if (legacyBonus.bonusProportional && approxEq(bv, reward) && !approxEq(bv, scaled)) {
		return { ...promo, rewardType: 'fixed' }
	}
	return promo
}

export function cloneTopupPromotionDraft(d: TopupPromotionDraft): TopupPromotionDraft {
	return {
		...d,
		fixedTiers: d.fixedTiers.map((t) => ({ ...t })),
	}
}

export function topupPromotionDraftsEqual(a: TopupPromotionDraft, b: TopupPromotionDraft): boolean {
	if (
		a.enabled !== b.enabled ||
		a.validityPeriodEnabled !== b.validityPeriodEnabled ||
		a.validFrom !== b.validFrom ||
		a.validTo !== b.validTo ||
		a.minimumTopupAmount !== b.minimumTopupAmount ||
		a.rewardType !== b.rewardType ||
		a.rewardValue !== b.rewardValue ||
		a.fixedTiers.length !== b.fixedTiers.length
	) {
		return false
	}
	for (let i = 0; i < a.fixedTiers.length; i++) {
		const x = a.fixedTiers[i]
		const y = b.fixedTiers[i]
		if (x.topupAmount !== y.topupAmount || x.bonusAmount !== y.bonusAmount) return false
	}
	return true
}

export function validateTopupPromotionDraft(d: TopupPromotionDraft): string {
	if (!d.enabled) return ''
	if (d.validityPeriodEnabled) {
		const from = parseYmd(d.validFrom)
		const to = parseYmd(d.validTo)
		if (!from || !to) return 'Enter a valid date range (YYYY-MM-DD), or turn off Validity Period.'
		if (from > to) return 'Validity start date cannot be after the end date.'
	}
	if (d.rewardType === 'percent') {
		const min = parseAmount(d.minimumTopupAmount)
		const reward = parseAmount(d.rewardValue)
		if (min == null || min <= 0) return 'Minimum top-up must be greater than 0.'
		if (reward == null || reward <= 0) return 'Bonus percent must be greater than 0.'
		if (reward > 100) return 'Bonus percent cannot exceed 100.'
		return ''
	}
	const tiers = parseValidFixedTiersDraft(d.fixedTiers)
	if (!tiers) {
		return 'Each tier needs a unique top-up amount and bonus greater than 0.'
	}
	if (tiers.length > TOPUP_PROMOTION_FIXED_TIERS_MAX) {
		return `At most ${TOPUP_PROMOTION_FIXED_TIERS_MAX} bonus tiers.`
	}
	return ''
}

export function isTopupPromotionActive(d: TopupPromotionDraft): boolean {
	if (!d.enabled) return false
	if (d.rewardType === 'percent') {
		const min = parseAmount(d.minimumTopupAmount)
		const reward = parseAmount(d.rewardValue)
		return min != null && min > 0 && reward != null && reward > 0 && reward <= 100
	}
	return parseValidFixedTiersDraft(d.fixedTiers) != null
}

export function topupPromotionDraftToPayload(
	d: TopupPromotionDraft,
): ShareTokenMetadataTopupPromotion | null {
	if (!d.enabled) return null
	if (validateTopupPromotionDraft(d)) return null

	const base: ShareTokenMetadataTopupPromotion = {
		enabled: true,
		rewardType: d.rewardType,
	}
	if (d.validityPeriodEnabled) {
		const from = parseYmd(d.validFrom)
		const to = parseYmd(d.validTo)
		if (from) base.validFrom = from
		if (to) base.validTo = to
	}

	if (d.rewardType === 'percent') {
		const min = parseAmount(d.minimumTopupAmount)!
		const reward = parseAmount(d.rewardValue)!
		return {
			...base,
			minimumTopupAmount: min,
			rewardValue: reward,
		}
	}

	const tiers = parseValidFixedTiersDraft(d.fixedTiers)!
	const first = tiers[0]
	return {
		...base,
		minimumTopupAmount: first.topupAmount,
		rewardValue: first.bonusAmount,
		fixedTiers: tiers,
	}
}

export function topupPromotionToLegacyBonusRules(
	promo: ShareTokenMetadataTopupPromotion,
): ShareTokenMetadataBonusRule[] {
	if (promo.enabled === false) return []
	if (promo.rewardType === 'percent') {
		const min = Number(promo.minimumTopupAmount)
		const reward = Number(promo.rewardValue)
		if (!(min > 0) || !(reward > 0)) return []
		const bonusValue = Math.round(min * reward) / 100
		if (bonusValue <= 0) return []
		return [
			{
				paymentAmount: min,
				bonusValue,
				bonusProportional: true,
			},
		]
	}
	const fromTiers = normalizeFixedTiersFromRaw(promo.fixedTiers)
	if (fromTiers.length > 0) {
		return fromTiers.map((t) => ({
			paymentAmount: t.topupAmount,
			bonusValue: t.bonusAmount,
			bonusProportional: false,
		}))
	}
	const min = Number(promo.minimumTopupAmount)
	const reward = Number(promo.rewardValue)
	if (!(min > 0) || !(reward > 0)) return []
	return [
		{
			paymentAmount: min,
			bonusValue: reward,
			bonusProportional: false,
		},
	]
}

/** @deprecated Prefer {@link topupPromotionToLegacyBonusRules}; returns first rule only. */
export function topupPromotionToLegacyBonusRule(
	promo: ShareTokenMetadataTopupPromotion,
): ShareTokenMetadataBonusRule | null {
	return topupPromotionToLegacyBonusRules(promo)[0] ?? null
}

export function legacyBonusRuleToTopupPromotion(
	rule: ShareTokenMetadataBonusRule | ShareTokenMetadataBonusRuleLoose,
): ShareTokenMetadataTopupPromotion {
	const payment = Number(rule.paymentAmount)
	const bonus = Number(rule.bonusValue)
	const pay = Number.isFinite(payment) && payment > 0 ? payment : 0
	const bon = Number.isFinite(bonus) && bonus > 0 ? bonus : 0
	if (rule.bonusProportional && pay > 0 && bon > 0) {
		const pct = Math.round((bon / pay) * 10000) / 100
		return {
			enabled: true,
			minimumTopupAmount: pay,
			rewardType: 'percent',
			rewardValue: pct,
		}
	}
	return {
		enabled: true,
		minimumTopupAmount: pay,
		rewardType: 'fixed',
		rewardValue: bon,
		fixedTiers: pay > 0 && bon > 0 ? [{ topupAmount: pay, bonusAmount: bon }] : undefined,
	}
}

export function legacyBonusRulesToTopupPromotion(
	rules: Array<ShareTokenMetadataBonusRule | ShareTokenMetadataBonusRuleLoose>,
): ShareTokenMetadataTopupPromotion | null {
	const list = rules.filter((r) => {
		const p = Number(r.paymentAmount)
		const b = Number(r.bonusValue)
		return Number.isFinite(p) && p > 0 && Number.isFinite(b) && b > 0
	})
	if (list.length === 0) return null
	if (list.length === 1) return legacyBonusRuleToTopupPromotion(list[0])
	const allFixed = list.every((r) => !r.bonusProportional)
	if (!allFixed) return legacyBonusRuleToTopupPromotion(list[0])
	const tiers = list
		.map((r) => ({
			topupAmount: Number(r.paymentAmount),
			bonusAmount: Number(r.bonusValue),
		}))
		.sort((a, b) => a.topupAmount - b.topupAmount)
	return {
		enabled: true,
		rewardType: 'fixed',
		minimumTopupAmount: tiers[0].topupAmount,
		rewardValue: tiers[0].bonusAmount,
		fixedTiers: tiers,
	}
}

/** Alias for hydrate / draft local — same as {@link parseTopupPromotionFromMetadata}. */
export function topupPromotionDraftFromMetadata(
	meta: TopupPromotionMetadataSource | null | undefined,
): TopupPromotionDraft {
	return parseTopupPromotionFromMetadata(meta)
}

export function parseTopupPromotionFromMetadata(
	meta: TopupPromotionMetadataSource | null | undefined,
): TopupPromotionDraft {
	if (!meta) return cloneTopupPromotionDraft(EMPTY_TOPUP_PROMOTION_DRAFT)
	let promo = meta.topupPromotion
	if (promo) {
		const rules = meta.bonusRules?.length
			? meta.bonusRules
			: meta.bonusRule
				? [meta.bonusRule]
				: []
		if (rules[0]) promo = healTopupPromotionRewardType(promo, rules[0])
	} else {
		const rules = meta.bonusRules?.length
			? meta.bonusRules
			: meta.bonusRule
				? [meta.bonusRule]
				: []
		promo = legacyBonusRulesToTopupPromotion(rules) ?? undefined
	}
	if (!promo) return cloneTopupPromotionDraft(EMPTY_TOPUP_PROMOTION_DRAFT)

	const from = parseYmd(promo.validFrom)
	const to = parseYmd(promo.validTo)
	const rewardType: TopupPromotionRewardType = promo.rewardType === 'percent' ? 'percent' : 'fixed'
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	let fixedTiers = normalizeFixedTiersFromRaw(promo.fixedTiers)
	if (rewardType === 'fixed' && fixedTiers.length === 0 && min != null && reward != null && min > 0 && reward > 0) {
		fixedTiers = [{ topupAmount: min, bonusAmount: reward }]
	}
	if (
		rewardType === 'fixed' &&
		fixedTiers.length <= 1 &&
		Array.isArray(meta.bonusRules) &&
		meta.bonusRules.length > 1
	) {
		const fromRules = legacyBonusRulesToTopupPromotion(meta.bonusRules)
		if (fromRules?.fixedTiers?.length) {
			fixedTiers = normalizeFixedTiersFromRaw(fromRules.fixedTiers)
		}
	}

	return {
		enabled: promo.enabled !== false,
		validityPeriodEnabled: Boolean(from || to),
		validFrom: from,
		validTo: to,
		minimumTopupAmount: min != null && min > 0 ? String(min) : '10',
		rewardType,
		rewardValue: reward != null && reward > 0 ? String(reward) : rewardType === 'percent' ? '10' : '10',
		fixedTiers: fixedTiersDraftFromNormalized(fixedTiers),
	}
}

export function formatTopupPromotionDisplay(
	promo: ShareTokenMetadataTopupPromotion,
	moneyPrefix: string,
): string {
	if (promo.enabled === false) return ''
	const range =
		promo.validFrom && promo.validTo ? ` · ${promo.validFrom} → ${promo.validTo}` : ''
	if (promo.rewardType === 'percent') {
		const min = Number(promo.minimumTopupAmount)
		const pct = Number(promo.rewardValue)
		if (!(min > 0) || !(pct > 0)) return ''
		return `${pct}% bonus on top-ups from ${moneyPrefix}${min}${range}`
	}
	const tiers = normalizeFixedTiersFromRaw(promo.fixedTiers)
	if (tiers.length > 1) {
		const summary = tiers
			.slice(0, 3)
			.map((t) => `${moneyPrefix}${t.topupAmount}→+${moneyPrefix}${t.bonusAmount}`)
			.join(', ')
		const more = tiers.length > 3 ? ` +${tiers.length - 3}` : ''
		return `Tiered bonus: ${summary}${more}${range}`
	}
	const min = Number(promo.minimumTopupAmount)
	const bonus = Number(promo.rewardValue)
	if (tiers.length === 1) {
		return `+${moneyPrefix}${tiers[0].bonusAmount} on top-ups from ${moneyPrefix}${tiers[0].topupAmount}${range}`
	}
	if (!(min > 0) || !(bonus > 0)) return ''
	return `+${moneyPrefix}${bonus} on top-ups from ${moneyPrefix}${min}${range}`
}

/** Live simulate: highest qualifying fixed tier, or percent of principal. */
export function simulateTopupPromotionBonus(
	promo: ShareTokenMetadataTopupPromotion | null | undefined,
	principal: number,
): { storeCreditBonus: number; kind: 'percent' | 'fixed' | 'none' } {
	if (!promo || promo.enabled === false || !(principal > 0)) {
		return { storeCreditBonus: 0, kind: 'none' }
	}
	if (promo.rewardType === 'percent') {
		const min = Number(promo.minimumTopupAmount)
		const pct = Number(promo.rewardValue)
		if (!(min > 0) || !(pct > 0) || principal < min) {
			return { storeCreditBonus: 0, kind: 'none' }
		}
		return {
			storeCreditBonus: Math.round(principal * pct) / 100,
			kind: 'percent',
		}
	}
	const tiers = normalizeFixedTiersFromRaw(promo.fixedTiers)
	const candidates =
		tiers.length > 0
			? tiers
			: (() => {
					const min = Number(promo.minimumTopupAmount)
					const bonus = Number(promo.rewardValue)
					return min > 0 && bonus > 0 ? [{ topupAmount: min, bonusAmount: bonus }] : []
				})()
	let best = 0
	for (const t of candidates) {
		if (principal >= t.topupAmount && t.bonusAmount > best) best = t.bonusAmount
	}
	return best > 0 ? { storeCreditBonus: best, kind: 'fixed' } : { storeCreditBonus: 0, kind: 'none' }
}
