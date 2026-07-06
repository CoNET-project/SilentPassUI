import { fiatPrefix } from '@/services/currency'
import {
	formatDiscoverRechargeBonusDisplayString,
	parseDiscoverRechargeBonusRules,
	pickPrimaryDiscoverRechargeBonusRule,
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
