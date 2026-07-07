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
	title: string
	description: string
}

const CARD_SOCIAL_EVENT_KEYS = ['linkClick', 'like', 'topup'] as const
const COUPON_SOCIAL_EVENT_KEYS = ['linkClick', 'like', 'claim', 'burn'] as const

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
	return { enabled: true, points13: points }
}

function eventHasReward(ev: SocialPromotionEvent | undefined): boolean {
	if (!ev) return false
	return rewardFromPayload(ev.user) != null || rewardFromPayload(ev.ref) != null
}

function formatRewardLine(role: 'User' | 'Referrer', reward: SocialPromotionReward | undefined): string | null {
	const normalized = rewardFromPayload(reward)
	if (!normalized) return null
	const points = normalized.points13
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
		user: raw?.user && raw.user.enabled !== false ? { enabled: true, points13: raw.user.points13 } : undefined,
		ref: raw?.ref && raw.ref.enabled !== false ? { enabled: true, points13: raw.ref.points13 } : undefined,
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

function normalizeTopupPromotionPayload(raw: Record<string, unknown>): ShareTokenMetadataTopupPromotion | null {
	const min = parseAmount(raw.minimumTopupAmount ?? raw.minimum_topup_amount)
	const reward = parseAmount(raw.rewardValue ?? raw.reward_value)
	if (min == null || reward == null) return null
	const rewardTypeRaw = String(raw.rewardType ?? raw.reward_type ?? '').trim().toLowerCase()
	const rewardType: 'percent' | 'fixed' =
		rewardTypeRaw === 'fixed' ? 'fixed' : rewardTypeRaw === 'percent' ? 'percent' : 'percent'
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
	const direct = share.topupPromotion
	if (direct && typeof direct === 'object') {
		return normalizeTopupPromotionPayload(direct as Record<string, unknown>)
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

function formatTopupPromotionCapsuleCopy(
	promo: ShareTokenMetadataTopupPromotion,
	currencyCode: string,
): DiscoverTopupPromotionCapsuleCopy {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	const ccy = (currencyCode || 'CAD').toUpperCase()
	const min = parseAmount(promo.minimumTopupAmount)
	const reward = parseAmount(promo.rewardValue)
	const minLabel =
		min != null
			? `${moneyPrefix}${formatBonusRuleAmount(min)} ${ccy}`
			: `${moneyPrefix}— ${ccy}`
	if (promo.rewardType === 'percent' && reward != null) {
		const pctLabel = formatBonusRuleAmount(reward)
		return {
			title: `${pctLabel}% Bonus on every Top-Up!`,
			description: `Top up ${minLabel} or more to instantly unlock a ${pctLabel}% bonus balance. Value that never expires.`,
		}
	}
	const rewardLabel =
		reward != null ? `${moneyPrefix}${formatBonusRuleAmount(reward)}` : `${moneyPrefix}—`
	return {
		title: `${rewardLabel} Bonus on every Top-Up!`,
		description: `Top up ${minLabel} or more to instantly unlock a ${rewardLabel} bonus balance. Value that never expires.`,
	}
}

function formatRechargeBonusCapsuleCopy(
	rule: DiscoverRechargeBonusRule,
	currencyCode: string,
): DiscoverTopupPromotionCapsuleCopy {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	const ccy = (currencyCode || 'CAD').toUpperCase()
	const minLabel = `${moneyPrefix}${formatBonusRuleAmount(rule.paymentAmount)} ${ccy}`
	if (rule.bonusProportional) {
		const pct = (rule.bonusValue / rule.paymentAmount) * 100
		const pctLabel = formatBonusRuleAmount(pct)
		return {
			title: `${pctLabel}% Bonus on every Top-Up!`,
			description: `Top up ${minLabel} or more to instantly unlock a ${pctLabel}% bonus balance. Value that never expires.`,
		}
	}
	const bonusLabel = `${moneyPrefix}${formatBonusRuleAmount(rule.bonusValue)}`
	return {
		title: `${bonusLabel} Bonus on every Top-Up!`,
		description: `Top up ${minLabel} or more to instantly unlock a ${bonusLabel} bonus balance. Value that never expires.`,
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

/** Per-event #13 points for Social Missions metric pills (linkClick / like / topup / claim / burn). */
export type DiscoverSocialMissionMetrics = {
	linkClick: number | null
	like: number | null
	topup: number | null
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
	return { linkClick: null, like: null, topup: null, claim: null, burn: null }
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
			applySocialEventMetrics(user, key, userReward.points13)
			userDetailLines.push(
				`${cardSocialPromotionEventLabel(key)}: earn ${userReward.points13} social reward point${userReward.points13 === 1 ? '' : 's'}.`,
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

function countActivePromotionSurfaces(model: {
	socialMissions: DiscoverActivePromotionsSocialMissions | null
	couponSocialMissions: DiscoverCouponSocialMissionBlock[]
}): number {
	let count = 0
	if (model.socialMissions?.user) count += 1
	if (model.socialMissions?.referrer) count += 1
	for (const block of model.couponSocialMissions) {
		if (block.user) count += 1
		if (block.referrer) count += 1
	}
	return count
}

/** Structured Active promotions panel (Social Missions + paginated coupon missions). */
export function buildDiscoverActivePromotionsPanelModel(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	/** When set (including null = loaded empty), overrides metadata for card-level social missions. */
	chainCardSocialPromotion?: ShareTokenMetadataSocialPromotion | null
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
	const couponSocialMissions = buildCouponSocialMissionBlocks(params.couponSeries)

	if (!socialMissions && couponSocialMissions.length === 0) return null

	const model = {
		activeCount: 0,
		socialMissions,
		couponSocialMissions,
	}
	model.activeCount = countActivePromotionSurfaces(model)
	return model
}
