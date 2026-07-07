import { fiatPrefix } from '@/services/currency'
import {
	formatDiscoverRechargeBonusDisplayString,
	parseDiscoverRechargeBonusRules,
	pickPrimaryDiscoverRechargeBonusRule,
	type DiscoverRechargeBonusRule,
} from '@/utils/discoverRechargeBonus'
import {
	readSocialExchangeFromMetadata,
	socialExchangeSummaryLabel,
} from '@/utils/socialExchangeMetadata'

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

/** Headline + body for merchant detail top-up promotion capsule (metadata-driven). */
export function resolveDiscoverTopupPromotionCapsuleCopy(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
}): DiscoverTopupPromotionCapsuleCopy | null {
	const meta = params.metadataRoot ?? null
	const topupPromo = parseTopupPromotionFromMetadata(meta)
	if (topupPromo && isTopupPromotionActive(topupPromo)) {
		return formatTopupPromotionCapsuleCopy(topupPromo, params.currency)
	}
	const bonusRules = parseDiscoverRechargeBonusRules(meta ?? {})
	const primaryBonus = pickPrimaryDiscoverRechargeBonusRule(bonusRules)
	if (primaryBonus) {
		return formatRechargeBonusCapsuleCopy(primaryBonus, params.currency)
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
}): DiscoverMerchantPromotionRow[] {
	const rows: DiscoverMerchantPromotionRow[] = []
	const currency = params.currency || 'CAD'
	const meta = params.metadataRoot ?? null

	const topupPromo = parseTopupPromotionFromMetadata(meta)
	if (topupPromo && isTopupPromotionActive(topupPromo)) {
		rows.push({
			id: 'topup-promotion',
			kind: 'topup',
			title: 'Top-up promotion',
			description: formatTopupPromotionDisplay(topupPromo, currency),
		})
	} else {
		const bonusRules = parseDiscoverRechargeBonusRules(meta)
		const primaryBonus = pickPrimaryDiscoverRechargeBonusRule(bonusRules)
		if (primaryBonus) {
			rows.push({
				id: 'recharge-bonus',
				kind: 'rechargeBonus',
				title: 'Recharge bonus',
				description: formatDiscoverRechargeBonusDisplayString(primaryBonus, currency),
			})
		}
	}

	const cardSocial = parseSocialPromotionFromMetadata(meta)
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

/** Per-event #13 points for Social Missions metric pills (linkClick / like / topup). */
export type DiscoverSocialMissionMetrics = {
	linkClick: number | null
	like: number | null
	topup: number | null
}

export type DiscoverActivePromotionsTopupRow = {
	minLabel: string
	bonusLabel: string
	detailText: string
}

export type DiscoverActivePromotionsSocialMissions = {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
}

export type DiscoverActivePromotionsPanelModel = {
	activeCount: number
	topup: DiscoverActivePromotionsTopupRow | null
	socialMissions: DiscoverActivePromotionsSocialMissions | null
	extraRows: DiscoverMerchantPromotionRow[]
}

function buildTopupPromotionPanelRow(
	metadataRoot: Record<string, unknown> | null | undefined,
	currency: string,
): DiscoverActivePromotionsTopupRow | null {
	const meta = metadataRoot ?? null
	const capsule = resolveDiscoverTopupPromotionCapsuleCopy({ metadataRoot: meta, currency })
	const topupPromo = parseTopupPromotionFromMetadata(meta)
	if (topupPromo && isTopupPromotionActive(topupPromo)) {
		const moneyPrefix = moneyPrefixForCurrency(currency)
		const min = topupPromo.minimumTopupAmount
		const reward = topupPromo.rewardValue
		const bonusLabel =
			topupPromo.rewardType === 'percent'
				? `${formatBonusRuleAmount(reward)}% bonus`
				: `${moneyPrefix}${formatBonusRuleAmount(reward)} bonus`
		return {
			minLabel: `Min ${moneyPrefix}${formatBonusRuleAmount(min)}`,
			bonusLabel,
			detailText: capsule?.description ?? formatTopupPromotionDisplay(topupPromo, currency),
		}
	}
	const primaryBonus = pickPrimaryDiscoverRechargeBonusRule(parseDiscoverRechargeBonusRules(meta ?? {}))
	if (!primaryBonus) return null
	const moneyPrefix = moneyPrefixForCurrency(currency)
	if (primaryBonus.bonusProportional) {
		const pct = (primaryBonus.bonusValue / primaryBonus.paymentAmount) * 100
		return {
			minLabel: `Min ${moneyPrefix}${formatBonusRuleAmount(primaryBonus.paymentAmount)}`,
			bonusLabel: `${formatBonusRuleAmount(pct)}% bonus`,
			detailText: capsule?.description ?? formatDiscoverRechargeBonusDisplayString(primaryBonus, currency),
		}
	}
	return {
		minLabel: `Min ${moneyPrefix}${formatBonusRuleAmount(primaryBonus.paymentAmount)}`,
		bonusLabel: `${moneyPrefix}${formatBonusRuleAmount(primaryBonus.bonusValue)} bonus`,
		detailText: capsule?.description ?? formatDiscoverRechargeBonusDisplayString(primaryBonus, currency),
	}
}

function buildCardSocialMissionMetrics(cardSocial: ShareTokenMetadataSocialPromotion | null): {
	user: DiscoverSocialMissionMetrics | null
	referrer: DiscoverSocialMissionMetrics | null
	userDetailText: string
} {
	const user: DiscoverSocialMissionMetrics = { linkClick: null, like: null, topup: null }
	const referrer: DiscoverSocialMissionMetrics = { linkClick: null, like: null, topup: null }
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
			user[key] = userReward.points13
			userDetailLines.push(
				`${cardSocialPromotionEventLabel(key)}: earn ${userReward.points13} social reward point${userReward.points13 === 1 ? '' : 's'}.`,
			)
		}
		if (refReward) {
			referrer[key] = refReward.points13
		}
	}
	const hasUser = user.linkClick != null || user.like != null || user.topup != null
	const hasRef = referrer.linkClick != null || referrer.like != null || referrer.topup != null
	return {
		user: hasUser ? user : null,
		referrer: hasRef ? referrer : null,
		userDetailText: userDetailLines.join(' '),
	}
}

/** Structured Active promotions panel (top-up row + Social Missions metrics + coupon extras). */
export function buildDiscoverActivePromotionsPanelModel(params: {
	metadataRoot: Record<string, unknown> | null | undefined
	currency: string
	couponSeries?: Array<{ title: string; metadata: Record<string, unknown> | null | undefined }>
}): DiscoverActivePromotionsPanelModel | null {
	const allRows = collectActiveDiscoverMerchantPromotions(params)
	if (allRows.length === 0) return null

	const topup = buildTopupPromotionPanelRow(params.metadataRoot, params.currency)
	const cardSocial = parseSocialPromotionFromMetadata(params.metadataRoot ?? null)
	const { user, referrer, userDetailText } = buildCardSocialMissionMetrics(cardSocial)
	const socialMissions =
		user || referrer
			? {
					user,
					referrer,
					userDetailText,
				}
			: null

	const extraRows = allRows.filter(
		(row) => row.kind === 'couponSocial' || row.kind === 'couponExchange',
	)

	return {
		activeCount: allRows.length,
		topup,
		socialMissions,
		extraRows,
	}
}
