import { fiatPrefix } from '@/services/currency'
import {
	formatDiscoverRechargeBonusDisplayString,
	formatDiscoverRechargeBonusSidePillText,
	parseDiscoverRechargeBonusRules,
	pickPrimaryDiscoverRechargeBonusRule,
	type DiscoverRechargeBonusRule,
} from '@/utils/discoverRechargeBonus'
import {
	readSocialExchangeFromMetadata,
	socialExchangeSummaryLabel,
} from '@/utils/socialExchangeMetadata'
import type { ChainCardSocialPromotion } from '@/utils/discoverMerchantSocialPromotionChain'

type FiatCurrencyCode = Parameters<typeof fiatPrefix>[0]

export type DiscoverMerchantPromotionRow = {
	id: string
	kind: 'topup' | 'rechargeBonus' | 'social' | 'couponSocial' | 'couponExchange'
	title: string
	description: string
}

type SocialPromotionReward = {
	enabled?: boolean
	points13: number
	/** Whole % of top-up (ratio E6); Discover labels as `N% of top-up`. */
	asPercent?: boolean
}

type SocialPromotionEvent = {
	user?: SocialPromotionReward
	ref?: SocialPromotionReward
}

type ShareTokenMetadataSocialPromotion = {
	enabled?: boolean
	events?: {
		linkClick?: SocialPromotionEvent
		like?: SocialPromotionEvent
		topup?: SocialPromotionEvent
	}
}

type ShareTokenMetadataCouponSocialPromotion = {
	enabled?: boolean
	events?: {
		linkClick?: SocialPromotionEvent
		like?: SocialPromotionEvent
		claim?: SocialPromotionEvent
		burn?: SocialPromotionEvent
	}
}

type ShareTokenMetadataTopupPromotion = {
	enabled?: boolean
	validFrom?: string
	validTo?: string
	minimumTopupAmount: number
	rewardType: 'percent' | 'fixed'
	rewardValue: number
}

export type DiscoverTopupPromotionCapsuleCopy = {
	/** Fixed product headline for Discover New Customer Bonus panel. */
	title: string
	description: string
	/** Prefill Discover top-up amount field (human number, no currency prefix). */
	suggestedAmount?: string
	ctaLabel?: string
}

const CARD_SOCIAL_EVENT_KEYS = ['linkClick', 'like', 'topup'] as const
const COUPON_SOCIAL_EVENT_KEYS = ['linkClick', 'like', 'claim', 'burn'] as const

export type CouponSocialPromotionEventKey = (typeof COUPON_SOCIAL_EVENT_KEYS)[number]

/** On-chain rule slot per coupon event (linkClick keeps ruleId = issuedTokenId). */
export const COUPON_SOCIAL_PROMOTION_EVENT_RULE_SLOTS: Record<CouponSocialPromotionEventKey, number> = {
	linkClick: 0,
	like: 1,
	claim: 2,
	burn: 3,
}

export function couponSocialPromotionRuleIdForEvent(
	issuedTokenId: string,
	eventKey: CouponSocialPromotionEventKey,
): string {
	const base = BigInt(String(issuedTokenId).trim())
	const slot = COUPON_SOCIAL_PROMOTION_EVENT_RULE_SLOTS[eventKey]
	if (slot === 0) return base.toString()
	return (base * 100n + BigInt(slot)).toString()
}

function parsePositiveInt(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
	if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
	return n
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

function formatLocalYmd(d: Date = new Date()): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

function moneyPrefixForCurrency(currencyCode: string): string {
	const ccy = (currencyCode || 'CAD').toUpperCase() as FiatCurrencyCode
	return ccy === 'USDC' ? '$' : fiatPrefix(ccy)
}

function shareMetadataRoot(meta: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
	if (!meta) return null
	const share = meta.shareTokenMetadata
	if (share && typeof share === 'object') return share as Record<string, unknown>
	return meta
}

function rewardFromPayload(raw: SocialPromotionReward | undefined): SocialPromotionReward | null {
	if (!raw || raw.enabled === false) return null
	const points = parsePositiveInt(raw.points13)
	if (points == null) return null
	return { enabled: true, points13: points, asPercent: raw.asPercent === true }
}

function eventHasReward(ev: SocialPromotionEvent | undefined): boolean {
	if (!ev) return false
	return rewardFromPayload(ev.user) != null || rewardFromPayload(ev.ref) != null
}

function formatRewardLine(role: 'User' | 'Referrer', reward: SocialPromotionReward | undefined): string | null {
	const normalized = rewardFromPayload(reward)
	if (!normalized) return null
	const points = normalized.points13
	if (normalized.asPercent) {
		return `${role}: ${points}% of top-up`
	}
	return `${role}: ${points} pt${points === 1 ? '' : 's'}`
}

function cardSocialPromotionEventLabel(key: (typeof CARD_SOCIAL_EVENT_KEYS)[number]): string {
	switch (key) {
		case 'linkClick':
			return 'Link click'
		case 'like':
			return 'Like'
		case 'topup':
			return 'Top-up'
		default:
			return key
	}
}

function couponSocialPromotionEventLabel(key: (typeof COUPON_SOCIAL_EVENT_KEYS)[number]): string {
	switch (key) {
		case 'linkClick':
			return 'Link click'
		case 'like':
			return 'Like'
		case 'claim':
			return 'Claim'
		case 'burn':
			return 'Burn'
		default:
			return key
	}
}

function eventDraftFromPayload(raw: SocialPromotionEvent | undefined): SocialPromotionEvent {
	return {
		user:
			raw?.user && raw.user.enabled !== false
				? {
						enabled: true,
						points13: raw.user.points13,
						...(raw.user.asPercent === true ? { asPercent: true as const } : {}),
					}
				: undefined,
		ref:
			raw?.ref && raw.ref.enabled !== false
				? {
						enabled: true,
						points13: raw.ref.points13,
						...(raw.ref.asPercent === true ? { asPercent: true as const } : {}),
					}
				: undefined,
	}
}

function eventsPayloadFromRaw(
	eventsRaw: Record<string, unknown> | undefined,
	keys: readonly string[],
): Record<string, SocialPromotionEvent> {
	const events: Record<string, SocialPromotionEvent> = {}
	if (!eventsRaw || typeof eventsRaw !== 'object') return events
	for (const key of keys) {
		const ev = eventsRaw[key]
		if (ev && typeof ev === 'object') {
			const draft = eventDraftFromPayload(ev as SocialPromotionEvent)
			if (eventHasReward(draft)) events[key] = draft
		}
	}
	return events
}

function normalizeSocialPromotionPayload(raw: Record<string, unknown>): ShareTokenMetadataSocialPromotion | null {
	if (!raw.events || typeof raw.events !== 'object') return null
	const events = eventsPayloadFromRaw(raw.events as Record<string, unknown>, CARD_SOCIAL_EVENT_KEYS)
	if (Object.keys(events).length === 0) return null
	return {
		enabled: raw.enabled !== false,
		events,
	}
}

function normalizeCouponSocialPromotionPayload(raw: Record<string, unknown>): ShareTokenMetadataCouponSocialPromotion | null {
	if (!raw.events || typeof raw.events !== 'object') return null
	const events = eventsPayloadFromRaw(raw.events as Record<string, unknown>, COUPON_SOCIAL_EVENT_KEYS)
	if (Object.keys(events).length === 0) return null
	return {
		enabled: raw.enabled !== false,
		events,
	}
}

export function parseSocialPromotionFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataSocialPromotion | null {
	if (!meta) return null
	const direct = meta.socialPromotion
	if (direct && typeof direct === 'object') {
		return normalizeSocialPromotionPayload(direct as Record<string, unknown>)
	}
	const share = shareMetadataRoot(meta)
	if (share) {
		const nested = share.socialPromotion
		if (nested && typeof nested === 'object') {
			return normalizeSocialPromotionPayload(nested as Record<string, unknown>)
		}
	}
	return null
}

function parseCouponSocialPromotionFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataCouponSocialPromotion | null {
	if (!meta || typeof meta !== 'object') return null
	const raw = meta.socialPromotion
	if (!raw || typeof raw !== 'object') return null
	return normalizeCouponSocialPromotionPayload(raw as Record<string, unknown>)
}

function approxEq(a: number, b: number): boolean {
	return Math.abs(a - b) < 0.005
}

/**
 * Heal legacy buggy encode: `rewardType: percent` + unscaled bonusValue === rewardValue
 * (should have been paymentAmount * rewardValue / 100). Treat as **fixed**.
 */
function healTopupPromotionRewardType(
	promo: ShareTokenMetadataTopupPromotion,
	legacyBonus?: DiscoverRechargeBonusRule | null,
): ShareTokenMetadataTopupPromotion {
	if (promo.rewardType !== 'percent') return promo
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return promo
	const scaled = Math.round(min * reward) / 100
	if (!legacyBonus) return promo
	const bv = legacyBonus.bonusValue
	if (!legacyBonus.bonusProportional && approxEq(bv, reward)) {
		return { ...promo, rewardType: 'fixed' }
	}
	if (legacyBonus.bonusProportional && approxEq(bv, reward) && !approxEq(bv, scaled)) {
		return { ...promo, rewardType: 'fixed' }
	}
	return promo
}

function normalizeTopupPromotionPayload(raw: Record<string, unknown>): ShareTokenMetadataTopupPromotion | null {
	const min = parseAmount(raw.minimumTopupAmount ?? raw.minimum_topup_amount)
	const reward = parseAmount(raw.rewardValue ?? raw.reward_value)
	if (min == null || reward == null) return null
	const rewardTypeRaw = String(raw.rewardType ?? raw.reward_type ?? '').trim().toLowerCase()
	// Missing / unknown → fixed (not percent). Explicit "percent" still honored.
	const rewardType: 'percent' | 'fixed' = rewardTypeRaw === 'percent' ? 'percent' : 'fixed'
	if (raw.enabled === false) return null
	return {
		enabled: true,
		validFrom: parseYmd(raw.validFrom ?? raw.valid_from),
		validTo: parseYmd(raw.validTo ?? raw.valid_to),
		minimumTopupAmount: min,
		rewardType,
		rewardValue: reward,
	}
}

function parseTopupPromotionFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataTopupPromotion | null {
	if (!meta) return null
	const share = shareMetadataRoot(meta) ?? meta
	const legacyBonus = pickPrimaryDiscoverRechargeBonusRule(parseDiscoverRechargeBonusRules(meta ?? {}))
	const direct = share.topupPromotion
	if (direct && typeof direct === 'object') {
		const normalized = normalizeTopupPromotionPayload(direct as Record<string, unknown>)
		return normalized ? healTopupPromotionRewardType(normalized, legacyBonus) : null
	}
	return null
}

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

function formatBonusRuleAmount(value: number): string {
	if (!Number.isFinite(value)) return '0'
	return Number.isInteger(value)
		? value.toLocaleString('en-US')
		: value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NEW_CUSTOMER_BONUS_TITLE = 'New Customer Bonus'
const NEW_CUSTOMER_BONUS_CTA = 'Claim & Top Up'

/** Marketing money label — match design: `CA$ 100` (space after prefix). */
function formatPromoMoneyLabel(moneyPrefix: string, amount: number): string {
	return `${moneyPrefix} ${formatBonusRuleAmount(amount)}`
}

function formatTopupPromotionCapsuleCopy(
	promo: ShareTokenMetadataTopupPromotion,
	currencyCode: string,
): DiscoverTopupPromotionCapsuleCopy {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	const suggestedAmount = min != null ? String(min) : undefined
	if (promo.rewardType === 'percent' && reward != null) {
		const pctLabel = formatBonusRuleAmount(reward)
		const minLabel = min != null ? formatPromoMoneyLabel(moneyPrefix, min) : `${moneyPrefix} —`
		return {
			title: NEW_CUSTOMER_BONUS_TITLE,
			description: `Top up ${minLabel} or more, Get ${pctLabel}% bonus instantly!`,
			suggestedAmount,
			ctaLabel: NEW_CUSTOMER_BONUS_CTA,
		}
	}
	if (min != null && reward != null) {
		const totalReceive = Number((min + reward).toFixed(2))
		return {
			title: NEW_CUSTOMER_BONUS_TITLE,
			description: `Top up ${formatPromoMoneyLabel(moneyPrefix, min)}, Get ${formatPromoMoneyLabel(moneyPrefix, totalReceive)} instantly!`,
			suggestedAmount,
			ctaLabel: NEW_CUSTOMER_BONUS_CTA,
		}
	}
	return {
		title: NEW_CUSTOMER_BONUS_TITLE,
		description: 'Top up to unlock an instant bonus balance.',
		suggestedAmount,
		ctaLabel: NEW_CUSTOMER_BONUS_CTA,
	}
}

export type DiscoverProspectJoinPanelCopy = {
	heading: string
	body: string
	/** Green pill, e.g. `Get 50% Bonus Points`. Null when no top-up bonus to show. */
	bonusBadge: string | null
	/** Charge Reward PT footer, e.g. `Earn 40% back in points on every future purchase.` */
	chargeFooter: string | null
	hasTopupPromotion: boolean
	hasChargePromotion: boolean
	ctaLabel: string
}

function joinCircleSubject(welcomeTitle?: string, passTitle?: string): string | null {
	const welcome = welcomeTitle?.trim() ?? ''
	if (/inner\s+circle/i.test(welcome) || /inner\s+circle/i.test(passTitle ?? '')) {
		return 'the Inner Circle'
	}
	const stripped = welcome.replace(/^welcome\s+to\s+/i, '').trim()
	if (stripped) return stripped
	const pass = passTitle?.trim() ?? ''
	return pass || null
}

function readActiveTopupPromotionAmounts(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): {
	minLabel: string | null
	percent: number | null
	receiveLabel: string | null
} | null {
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return null
	const moneyPrefix = moneyPrefixForCurrency(params.currency)
	if (unified.source === 'topupPromotion' && unified.topupPromo) {
		const promo = unified.topupPromo
		const min = parseAmount(promo.minimumTopupAmount)
		const reward = parseAmount(promo.rewardValue)
		if (min == null || reward == null) return null
		const minLabel = formatPromoMoneyLabel(moneyPrefix, min)
		if (promo.rewardType === 'percent') {
			const totalReceive = Number((min * (1 + reward / 100)).toFixed(2))
			return {
				minLabel,
				percent: reward,
				receiveLabel: formatPromoMoneyLabel(moneyPrefix, totalReceive),
			}
		}
		const totalReceive = Number((min + reward).toFixed(2))
		return {
			minLabel,
			percent: null,
			receiveLabel: formatPromoMoneyLabel(moneyPrefix, totalReceive),
		}
	}
	if (unified.bonusRule) {
		const rule = unified.bonusRule
		const minLabel = formatPromoMoneyLabel(moneyPrefix, rule.paymentAmount)
		if (rule.bonusProportional) {
			const pct = (rule.bonusValue / rule.paymentAmount) * 100
			const totalReceive = Number((rule.paymentAmount + rule.bonusValue).toFixed(2))
			return {
				minLabel,
				percent: pct,
				receiveLabel: formatPromoMoneyLabel(moneyPrefix, totalReceive),
			}
		}
		const totalReceive = Number((rule.paymentAmount + rule.bonusValue).toFixed(2))
		return {
			minLabel,
			percent: null,
			receiveLabel: formatPromoMoneyLabel(moneyPrefix, totalReceive),
		}
	}
	return null
}

/**
 * Discover prospect blue panel: merchant welcome + this card's active
 * top-up / charge promotion. Never invents amounts when metadata has none.
 */
export function resolveDiscoverProspectJoinPanelCopy(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
	welcomeTitle?: string
	welcomeBody?: string
	passTitle?: string
}): DiscoverProspectJoinPanelCopy {
	const welcomeTitle = params.welcomeTitle?.trim() ?? ''
	const welcomeBody = params.welcomeBody?.trim() ?? ''
	const amounts = readActiveTopupPromotionAmounts(params)
	const actor = parseDiscoverActorRewardPercentsFromMetadata(params.metadataRoot)
	const chargePercent = actor.chargePercent
	const bonusPercent = amounts?.percent ?? actor.topupPercent
	const hasTopupPromotion = amounts != null || (actor.topupPercent != null && actor.topupPercent > 0)
	const hasChargePromotion = chargePercent != null && chargePercent > 0
	const subject = joinCircleSubject(welcomeTitle, params.passTitle)

	let heading = welcomeTitle || (params.passTitle?.trim() ? `Welcome to ${params.passTitle.trim()}` : 'Exclusive Welcome Offer')
	if (amounts?.receiveLabel) {
		heading = subject
			? `Join ${subject} & Get ${amounts.receiveLabel}!`
			: `Join & Get ${amounts.receiveLabel}!`
	} else if (hasTopupPromotion && subject && !welcomeTitle) {
		heading = `Welcome to ${subject}`
	}

	const privilegePhrase = /dining/i.test(welcomeBody)
		? 'seamless dining'
		: 'exclusive digital privileges'
	let body = welcomeBody
	if (amounts?.minLabel && bonusPercent != null && bonusPercent > 0) {
		body = `Top up ${amounts.minLabel} today to unlock ${privilegePhrase} and an instant ${formatBonusRuleAmount(bonusPercent)}% bonus points match.`
	} else if (amounts?.minLabel && amounts.receiveLabel) {
		body = `Top up ${amounts.minLabel} today to unlock ${privilegePhrase} and get ${amounts.receiveLabel} instantly.`
	} else if (!body && hasTopupPromotion) {
		body = 'Top up this merchant Pass to enjoy instant bonus rewards.'
	}

	const bonusBadge =
		bonusPercent != null && bonusPercent > 0
			? `Get ${formatBonusRuleAmount(bonusPercent)}% Bonus Points`
			: amounts?.receiveLabel
				? `Get ${amounts.receiveLabel}`
				: null

	const chargeFooter =
		hasChargePromotion && chargePercent != null
			? `Earn ${formatBonusRuleAmount(chargePercent)}% back in points on every future purchase.`
			: null

	return {
		heading,
		body,
		bonusBadge,
		chargeFooter,
		hasTopupPromotion,
		hasChargePromotion,
		ctaLabel: 'Claim Offer & Top Up',
	}
}

function formatRechargeBonusCapsuleCopy(
	rule: DiscoverRechargeBonusRule,
	currencyCode: string,
): DiscoverTopupPromotionCapsuleCopy {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	const suggestedAmount = String(rule.paymentAmount)
	if (rule.bonusProportional) {
		const pct = (rule.bonusValue / rule.paymentAmount) * 100
		const pctLabel = formatBonusRuleAmount(pct)
		return {
			title: NEW_CUSTOMER_BONUS_TITLE,
			description: `Top up ${formatPromoMoneyLabel(moneyPrefix, rule.paymentAmount)} or more, Get ${pctLabel}% bonus instantly!`,
			suggestedAmount,
			ctaLabel: NEW_CUSTOMER_BONUS_CTA,
		}
	}
	const totalReceive = Number((rule.paymentAmount + rule.bonusValue).toFixed(2))
	return {
		title: NEW_CUSTOMER_BONUS_TITLE,
		description: `Top up ${formatPromoMoneyLabel(moneyPrefix, rule.paymentAmount)}, Get ${formatPromoMoneyLabel(moneyPrefix, totalReceive)} instantly!`,
		suggestedAmount,
		ctaLabel: NEW_CUSTOMER_BONUS_CTA,
	}
}

/** Single source of truth: metadata top-up promotion (hero / capsule / Active promotions panel). */
export type DiscoverUnifiedTopupPromotion = {
	source: 'topupPromotion' | 'bonusRules'
	topupPromo?: ShareTokenMetadataTopupPromotion
	bonusRule?: DiscoverRechargeBonusRule
	active: boolean
}

function metadataHasTopupPromotionBlock(meta: Record<string, unknown> | null | undefined): boolean {
	const share = shareMetadataRoot(meta)
	const raw = share?.topupPromotion
	return raw != null && typeof raw === 'object'
}

/** Prefer `shareTokenMetadata.topupPromotion` when present; legacy `bonusRules` only when no top-up block. */
export function resolveDiscoverUnifiedTopupPromotion(params: {
	metadataRoot: Record<string, unknown> | null | undefined
}): DiscoverUnifiedTopupPromotion | null {
	const meta = params.metadataRoot ?? null
	if (metadataHasTopupPromotionBlock(meta)) {
		const topupPromo = parseTopupPromotionFromMetadata(meta)
		if (!topupPromo) return null
		return {
			source: 'topupPromotion',
			topupPromo,
			active: isTopupPromotionActive(topupPromo),
		}
	}
	const primaryBonus = pickPrimaryDiscoverRechargeBonusRule(parseDiscoverRechargeBonusRules(meta ?? {}))
	if (!primaryBonus) return null
	return {
		source: 'bonusRules',
		bonusRule: primaryBonus,
		active: true,
	}
}

function formatTopupPromotionHeroSidePill(
	promo: ShareTokenMetadataTopupPromotion,
	currencyCode: string,
): string {
	if (promo.rewardType === 'percent') {
		return `${formatBonusRuleAmount(promo.rewardValue)}% of top-up`
	}
	return formatDiscoverRechargeBonusSidePillText(
		{
			paymentAmount: promo.minimumTopupAmount,
			bonusValue: promo.rewardValue,
			bonusProportional: false,
		},
		currencyCode,
	)
}

/** Hero image bottom-right chip — same active gate as top-up capsule. */
export function resolveDiscoverTopupPromotionHeroSidePill(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): string | null {
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return null
	if (unified.source === 'topupPromotion' && unified.topupPromo) {
		return formatTopupPromotionHeroSidePill(unified.topupPromo, params.currency)
	}
	if (unified.bonusRule) {
		return formatDiscoverRechargeBonusSidePillText(unified.bonusRule, params.currency)
	}
	return null
}

/**
 * Compact green badge under Store Credits (#0) on Discover membership wallet card.
 * Example: `Get +5% bonus on CA$ 50+`
 */
export function resolveDiscoverTopupPromotionStoreCreditsBadge(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): string | null {
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return null
	const moneyPrefix = moneyPrefixForCurrency(params.currency)
	if (unified.source === 'topupPromotion' && unified.topupPromo) {
		const promo = unified.topupPromo
		const min = parseAmount(promo.minimumTopupAmount)
		const reward = parseAmount(promo.rewardValue)
		if (min == null || reward == null) return null
		const minLabel = formatPromoMoneyLabel(moneyPrefix, min)
		if (promo.rewardType === 'percent') {
			return `Get +${formatBonusRuleAmount(reward)}% bonus on ${minLabel}+`
		}
		return `Get +${formatPromoMoneyLabel(moneyPrefix, reward)} on ${minLabel}+`
	}
	if (unified.bonusRule) {
		const rule = unified.bonusRule
		const minLabel = formatPromoMoneyLabel(moneyPrefix, rule.paymentAmount)
		if (rule.bonusProportional) {
			const pct = (rule.bonusValue / rule.paymentAmount) * 100
			return `Get +${formatBonusRuleAmount(pct)}% bonus on ${minLabel}+`
		}
		return `Get +${formatPromoMoneyLabel(moneyPrefix, rule.bonusValue)} on ${minLabel}+`
	}
	return null
}

/** Long-form top-up copy (list cards / detail subcopy). */
export function resolveDiscoverTopupPromotionDisplayString(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): string | null {
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return null
	if (unified.source === 'topupPromotion' && unified.topupPromo) {
		return formatTopupPromotionDisplay(unified.topupPromo, params.currency)
	}
	if (unified.bonusRule) {
		return formatDiscoverRechargeBonusDisplayString(unified.bonusRule, params.currency)
	}
	return null
}

export type DiscoverTopupPromotionPresentation = {
	heroSidePill: string | null
	displayString: string | null
	capsuleCopy: DiscoverTopupPromotionCapsuleCopy | null
	primaryRechargeBonus: DiscoverRechargeBonusRule | null
}

/** All Discover top-up surfaces (hero chip, capsule, panel) from one metadata read. */
export function resolveDiscoverTopupPromotionPresentation(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): DiscoverTopupPromotionPresentation {
	const empty: DiscoverTopupPromotionPresentation = {
		heroSidePill: null,
		displayString: null,
		capsuleCopy: null,
		primaryRechargeBonus: null,
	}
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return empty
	const capsuleCopy = resolveDiscoverTopupPromotionCapsuleCopy(params)
	return {
		heroSidePill: resolveDiscoverTopupPromotionHeroSidePill(params),
		displayString: resolveDiscoverTopupPromotionDisplayString(params),
		capsuleCopy,
		primaryRechargeBonus: unified.bonusRule ?? null,
	}
}

/** Headline + body for merchant detail top-up promotion capsule (metadata-driven). */
export function resolveDiscoverTopupPromotionCapsuleCopy(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): DiscoverTopupPromotionCapsuleCopy | null {
	const unified = resolveDiscoverUnifiedTopupPromotion(params)
	if (!unified?.active) return null
	if (unified.source === 'topupPromotion' && unified.topupPromo) {
		return formatTopupPromotionCapsuleCopy(unified.topupPromo, params.currency)
	}
	if (unified.bonusRule) {
		return formatRechargeBonusCapsuleCopy(unified.bonusRule, params.currency)
	}
	return null
}

function formatTopupPromotionDisplay(
	promo: ShareTokenMetadataTopupPromotion,
	currencyCode: string,
): string {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	if (min == null || reward == null) return 'Incomplete top-up promotion.'
	const rewardLabel =
		promo.rewardType === 'percent' ? `${reward}% bonus` : `${moneyPrefix}${reward.toFixed(2)} bonus`
	const period =
		promo.validFrom || promo.validTo ? ` (${promo.validFrom ?? '…'} – ${promo.validTo ?? '…'})` : ''
	return `Min ${moneyPrefix}${min.toFixed(2)} → ${rewardLabel}${period}`
}

function formatCardSocialPromotionEvent(
	key: (typeof CARD_SOCIAL_EVENT_KEYS)[number],
	ev: SocialPromotionEvent,
): string {
	const parts = [formatRewardLine('User', ev.user), formatRewardLine('Referrer', ev.ref)].filter(Boolean)
	return `${cardSocialPromotionEventLabel(key)} — ${parts.join('; ')}`
}

function formatCouponSocialPromotionEvent(
	key: (typeof COUPON_SOCIAL_EVENT_KEYS)[number],
	ev: SocialPromotionEvent,
): string {
	const parts = [formatRewardLine('User', ev.user), formatRewardLine('Referrer', ev.ref)].filter(Boolean)
	return `${couponSocialPromotionEventLabel(key)} — ${parts.join('; ')}`
}

function readMetadataTitle(meta: Record<string, unknown> | null | undefined): string {
	if (!meta) return 'Coupon'
	const root = meta
	const title = root.title ?? root.name
	if (typeof title === 'string' && title.trim()) return title.trim()
	const properties = root.properties
	if (properties && typeof properties === 'object') {
		const bc = (properties as Record<string, unknown>).beamioCoupon
		if (bc && typeof bc === 'object') {
			const nested = (bc as Record<string, unknown>).title ?? (bc as Record<string, unknown>).name
			if (typeof nested === 'string' && nested.trim()) return nested.trim()
		}
	}
	return 'Coupon'
}

export function collectActiveDiscoverMerchantPromotions(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
	couponSeries?: Array<{ title?: string; metadata?: Record<string, unknown> | null }>
	/** When set (including null = loaded empty), overrides metadata for card-level social rows. */
	chainCardSocialPromotion?: ChainCardSocialPromotion | null
}): DiscoverMerchantPromotionRow[] {
	const rows: DiscoverMerchantPromotionRow[] = []
	const currency = params.currency || 'CAD'
	const meta = params.metadataRoot ?? null
	const unified = resolveDiscoverUnifiedTopupPromotion({ metadataRoot: meta })
	if (unified?.active) {
		const description =
			unified.source === 'topupPromotion' && unified.topupPromo
				? formatTopupPromotionDisplay(unified.topupPromo, currency)
				: unified.bonusRule
					? formatDiscoverRechargeBonusDisplayString(unified.bonusRule, currency)
					: ''
		rows.push({
			id: unified.source === 'topupPromotion' ? 'topup-promotion' : 'recharge-bonus',
			kind: unified.source === 'topupPromotion' ? 'topup' : 'rechargeBonus',
			title: unified.source === 'topupPromotion' ? 'Top-up promotion' : 'Recharge bonus',
			description,
		})
	}

	const chainLoaded = params.chainCardSocialPromotion !== undefined
	const cardSocial: ShareTokenMetadataSocialPromotion | null = chainLoaded
		? (params.chainCardSocialPromotion as ShareTokenMetadataSocialPromotion | null)
		: null
	if (cardSocial?.enabled !== false && cardSocial?.events) {
		for (const key of CARD_SOCIAL_EVENT_KEYS) {
			const ev = cardSocial.events[key]
			if (!ev || !eventHasReward(ev)) continue
			rows.push({
				id: `card-social-${key}`,
				kind: 'social',
				title: 'Social promotion',
				description: formatCardSocialPromotionEvent(key, ev),
			})
		}
	}

	for (const series of params.couponSeries ?? []) {
		const couponMeta = series.metadata ?? null
		const couponTitle = series.title?.trim() || readMetadataTitle(couponMeta)
		const exchange = readSocialExchangeFromMetadata(couponMeta)
		if (exchange) {
			rows.push({
				id: `coupon-exchange-${couponTitle}`,
				kind: 'couponExchange',
				title: `${couponTitle} · Exchange`,
				description: socialExchangeSummaryLabel(exchange),
			})
		}
		const couponSocial = parseCouponSocialPromotionFromMetadata(couponMeta)
		if (couponSocial?.enabled !== false && couponSocial?.events) {
			for (const key of COUPON_SOCIAL_EVENT_KEYS) {
				const ev = couponSocial.events[key]
				if (!ev || !eventHasReward(ev)) continue
				rows.push({
					id: `coupon-social-${couponTitle}-${key}`,
					kind: 'couponSocial',
					title: `${couponTitle} · Social`,
					description: formatCouponSocialPromotionEvent(key, ev),
				})
			}
		}
	}

	return rows
}

export function formatSocialPoints13Display(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '—'
	const n = Math.max(0, Math.floor(value))
	return n.toLocaleString('en-US')
}

function metadataRecord(raw: unknown): Record<string, unknown> | null {
	return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

function wholePercentFromRatioE6Raw(raw: unknown): number | null {
	if (raw == null) return null
	try {
		const e6 = BigInt(String(raw).trim())
		if (e6 <= 0n) return null
		const v = Math.round(Number(e6) / 10_000)
		if (!Number.isFinite(v) || v <= 0) return null
		return Math.min(100, v)
	} catch {
		return null
	}
}

function wholePercentFromBpsRaw(raw: unknown): number | null {
	if (raw == null) return null
	const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.min(100, Math.max(1, Math.round(n / 100)))
}

/** Local-first Charge / Top-up actor % from card0 metadata (until chain ratios succeed). */
export function parseDiscoverActorRewardPercentsFromMetadata(
	metadataRoot: Record<string, unknown> | null | undefined,
): { chargePercent: number | null; topupPercent: number | null } {
	const root = metadataRecord(metadataRoot)
	if (!root) return { chargePercent: null, topupPercent: null }
	const share = metadataRecord(root.shareTokenMetadata)
	const unified = metadataRecord(share?.unifiedRewardPoints) ?? metadataRecord(root.unifiedRewardPoints)
	const chargeBlock = metadataRecord(unified?.charge)
	const topupBlock = metadataRecord(unified?.topup)
	const ps = metadataRecord(share?.pointSystem) ?? metadataRecord(root.pointSystem)
	const chargePercent =
		wholePercentFromBpsRaw(chargeBlock?.actorPercentBps) ??
		wholePercentFromRatioE6Raw(
			ps?.chargeRewardRatioE6 ?? ps?.pointRewardRatioE6 ?? ps?.consumptionRewardRatioE6,
		)
	const topupPercent =
		wholePercentFromBpsRaw(topupBlock?.actorPercentBps) ??
		wholePercentFromRatioE6Raw(share?.topupActorRewardRatioE6 ?? root.topupActorRewardRatioE6)
	return { chargePercent, topupPercent }
}

/** null = metadata not ready; boolean = consumption point system enabled flag from shareTokenMetadata.pointSystem. */
export function consumptionPointSystemEnabledFromMetadata(
	metadataRoot: Record<string, unknown> | null | undefined,
): boolean | null {
	const root = metadataRecord(metadataRoot)
	if (!root) return null
	const share = metadataRecord(root.shareTokenMetadata)
	const ps = metadataRecord(share?.pointSystem) ?? metadataRecord(root.pointSystem)
	if (!ps) return null
	if (typeof ps.enabled === 'boolean') return ps.enabled
	const ratio = ps.chargeRewardRatioE6 ?? ps.pointRewardRatioE6 ?? ps.consumptionRewardRatioE6
	if (typeof ratio === 'string' && /^\d+$/.test(ratio)) {
		try {
			return BigInt(ratio) > 0n
		} catch {
			return null
		}
	}
	if (typeof ratio === 'number' && Number.isFinite(ratio)) return ratio > 0
	return null
}

export function parseLoyaltyPointsDisplay(raw: string | number | null | undefined): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number(raw)
	if (!Number.isFinite(n) || n < 0) return null
	return Math.floor(n)
}

/** Per-event #13 points for Social Missions metric pills (linkClick / like / topup / claim / burn). */
export type DiscoverSocialMissionMetrics = {
	linkClick: number | null
	like: number | null
	topup: number | null
	/** When true, `topup` is whole % of top-up (ratio E6), not fixed pts. */
	topupAsPercent?: boolean
	claim: number | null
	burn: number | null
}

export type DiscoverActivePromotionsSocialMissions = {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
}

export type DiscoverCouponSocialMissionBlock = {
	id: string
	title: string
	tokenId: string
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
}

export const DISCOVER_COUPON_SOCIAL_MISSIONS_INITIAL = 3
export const DISCOVER_COUPON_SOCIAL_MISSIONS_PAGE_SIZE = 10

export type DiscoverActivePromotionsPanelModel = {
	activeCount: number
	socialMissions: DiscoverActivePromotionsSocialMissions | null
	couponSocialMissions: DiscoverCouponSocialMissionBlock[]
}

function emptySocialMissionMetrics(): DiscoverSocialMissionMetrics {
	return { linkClick: null, like: null, topup: null, topupAsPercent: false, claim: null, burn: null }
}

function socialMissionMetricsHasValues(metrics: DiscoverSocialMissionMetrics): boolean {
	return (
		metrics.linkClick != null ||
		metrics.like != null ||
		metrics.topup != null ||
		metrics.claim != null ||
		metrics.burn != null
	)
}

function applySocialEventMetrics(
	metrics: DiscoverSocialMissionMetrics,
	key: (typeof CARD_SOCIAL_EVENT_KEYS)[number] | (typeof COUPON_SOCIAL_EVENT_KEYS)[number],
	points13: number,
	asPercent?: boolean,
): void {
	switch (key) {
		case 'linkClick':
			metrics.linkClick = points13
			break
		case 'like':
			metrics.like = points13
			break
		case 'topup':
			metrics.topup = points13
			if (asPercent) metrics.topupAsPercent = true
			break
		case 'claim':
			metrics.claim = points13
			break
		case 'burn':
			metrics.burn = points13
			break
		default:
			break
	}
}

function buildCardSocialMissionMetrics(cardSocial: ShareTokenMetadataSocialPromotion | null): {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
} {
	const user = emptySocialMissionMetrics()
	const referrer = emptySocialMissionMetrics()
	const userDetailLines: string[] = []
	if (!cardSocial?.events) {
		return { user: null, referrer: null, userDetailText: '' }
	}
	for (const key of CARD_SOCIAL_EVENT_KEYS) {
		const ev = cardSocial.events[key]
		if (!ev || !eventHasReward(ev)) continue
		const userReward = rewardFromPayload(ev.user)
		const refReward = rewardFromPayload(ev.ref)
		if (userReward) {
			applySocialEventMetrics(user, key, userReward.points13, userReward.asPercent)
			userDetailLines.push(
				userReward.asPercent
					? `${cardSocialPromotionEventLabel(key)}: earn ${userReward.points13}% of top-up as Reward PT.`
					: `${cardSocialPromotionEventLabel(key)}: earn ${userReward.points13} social reward point${userReward.points13 === 1 ? '' : 's'}.`,
			)
		}
		if (refReward) {
			applySocialEventMetrics(referrer, key, refReward.points13, refReward.asPercent)
		}
	}
	return {
		user: socialMissionMetricsHasValues(user) ? user : null,
		referrer: socialMissionMetricsHasValues(referrer) ? referrer : null,
		userDetailText: userDetailLines.join(' '),
	}
}

function buildCouponSocialMissionMetrics(couponSocial: ShareTokenMetadataCouponSocialPromotion | null): {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
} {
	const user = emptySocialMissionMetrics()
	const referrer = emptySocialMissionMetrics()
	const userDetailLines: string[] = []
	if (!couponSocial?.events) {
		return { user: null, referrer: null, userDetailText: '' }
	}
	for (const key of COUPON_SOCIAL_EVENT_KEYS) {
		const ev = couponSocial.events[key]
		if (!ev || !eventHasReward(ev)) continue
		const userReward = rewardFromPayload(ev.user)
		const refReward = rewardFromPayload(ev.ref)
		if (userReward) {
			applySocialEventMetrics(user, key, userReward.points13)
			userDetailLines.push(
				`${couponSocialPromotionEventLabel(key)}: earn ${userReward.points13} social reward point${userReward.points13 === 1 ? '' : 's'}.`,
			)
		}
		if (refReward) {
			applySocialEventMetrics(referrer, key, refReward.points13)
		}
	}
	return {
		user: socialMissionMetricsHasValues(user) ? user : null,
		referrer: socialMissionMetricsHasValues(referrer) ? referrer : null,
		userDetailText: userDetailLines.join(' '),
	}
}

function compareCouponSocialMissionBlocksNewestFirst(
	a: DiscoverCouponSocialMissionBlock,
	b: DiscoverCouponSocialMissionBlock,
): number {
	try {
		const diff = BigInt(b.tokenId) - BigInt(a.tokenId)
		if (diff > 0n) return 1
		if (diff < 0n) return -1
		return 0
	} catch {
		return b.tokenId.localeCompare(a.tokenId)
	}
}

function buildCouponSocialMissionBlocks(
	couponSeries: Array<{ title?: string; metadata?: Record<string, unknown> | null; tokenId?: string }> | undefined,
): DiscoverCouponSocialMissionBlock[] {
	const blocks: DiscoverCouponSocialMissionBlock[] = []
	for (const series of couponSeries ?? []) {
		const tokenId = String(series.tokenId ?? '').trim()
		if (!tokenId) continue
		const couponMeta = series.metadata ?? null
		const couponSocial = parseCouponSocialPromotionFromMetadata(couponMeta)
		if (!couponSocial || couponSocial.enabled === false) continue
		const { user, referrer, userDetailText } = buildCouponSocialMissionMetrics(couponSocial)
		if (!user && !referrer) continue
		const title = series.title?.trim() || readMetadataTitle(couponMeta)
		blocks.push({
			id: `coupon-social-${tokenId}`,
			title,
			tokenId,
			user,
			referrer,
			userDetailText,
		})
	}
	return blocks.sort(compareCouponSocialMissionBlocksNewestFirst)
}

/** Single coupon row in Discover detail Available Offers — social mission rewards if configured. */
export function resolveCouponSocialMissionBlockForSeries(
	series: { title?: string; metadata?: Record<string, unknown> | null; tokenId?: string },
): DiscoverCouponSocialMissionBlock | null {
	const blocks = buildCouponSocialMissionBlocks([series])
	return blocks[0] ?? null
}

function countActivePromotionSurfaces(model: {
	socialMissions: DiscoverActivePromotionsSocialMissions | null
}): number {
	let count = 0
	if (model.socialMissions?.user) count += 1
	if (model.socialMissions?.referrer) count += 1
	return count
}

/** Structured Active promotions panel (L1 program card Social Missions only; L2 coupon missions live on Available Offers rows). */
export function buildDiscoverActivePromotionsPanelModel(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	/** When set (including null = loaded empty), overrides metadata for card-level social missions. */
	chainCardSocialPromotion?: ShareTokenMetadataSocialPromotion | null
	/** @deprecated L2 coupon social missions are shown per Available Offers item, not in this panel. */
	couponSeries?: Array<{ title?: string; metadata?: Record<string, unknown> | null; tokenId?: string }>
}): DiscoverActivePromotionsPanelModel | null {
	const chainLoaded = params.chainCardSocialPromotion !== undefined
	const cardSocial = chainLoaded
		? params.chainCardSocialPromotion
		: null
	const { user, referrer, userDetailText } = buildCardSocialMissionMetrics(cardSocial ?? null)
	const socialMissions =
		user || referrer
			? {
					user,
					referrer,
					userDetailText,
				}
			: null

	if (!socialMissions) return null

	const model = {
		activeCount: 0,
		socialMissions,
		couponSocialMissions: [] as DiscoverCouponSocialMissionBlock[],
	}
	model.activeCount = countActivePromotionSurfaces(model)
	return model
}
