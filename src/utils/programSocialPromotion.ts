import type {
	ShareTokenMetadataCouponSocialPromotion,
	ShareTokenMetadataSocialPromotion,
	ShareTokenMetadataSocialPromotionEvent,
	ShareTokenMetadataSocialPromotionReward,
} from '@/services/BeamioCard'

export type CardSocialPromotionEventKey = 'linkClick' | 'like' | 'topup'
export type CouponSocialPromotionEventKey = 'linkClick' | 'like' | 'claim' | 'burn'

export type SocialPromotionRewardDraft = {
	enabled: boolean
	points13: string
}

export type SocialPromotionEventDraft = {
	user: SocialPromotionRewardDraft
	ref: SocialPromotionRewardDraft
}

/** Card-level social promotion — parallel events (v4) with user + referrer rewards each. */
export type SocialPromotionDraft = {
	enabled: boolean
	events: Record<CardSocialPromotionEventKey, SocialPromotionEventDraft>
}

/** Per issued coupon — parallel social events (v2) with user + referrer rewards each. */
export type CouponSocialPromotionDraft = {
	enabled: boolean
	events: Record<CouponSocialPromotionEventKey, SocialPromotionEventDraft>
}

export const SOCIAL_PROMOTION_LINK_CLICK_RULE_ID = 1
export const SOCIAL_PROMOTION_TOPUP_RULE_ID = 2
export const SOCIAL_PROMOTION_LIKE_RULE_ID = 3

export const CARD_SOCIAL_PROMOTION_EVENT_KEYS: CardSocialPromotionEventKey[] = [
	'linkClick',
	'like',
	'topup',
]

export const COUPON_SOCIAL_PROMOTION_EVENT_KEYS: CouponSocialPromotionEventKey[] = [
	'linkClick',
	'like',
	'claim',
	'burn',
]

/** On-chain rule slot per coupon event (linkClick keeps ruleId = issuedTokenId). */
export const COUPON_SOCIAL_PROMOTION_EVENT_RULE_SLOTS: Record<CouponSocialPromotionEventKey, number> = {
	linkClick: 0,
	like: 1,
	claim: 2,
	burn: 3,
}

function emptyCardSocialPromotionEvents(): Record<CardSocialPromotionEventKey, SocialPromotionEventDraft> {
	return {
		linkClick: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
		like: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
		topup: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
	}
}

function emptyCouponSocialPromotionEvents(): Record<CouponSocialPromotionEventKey, SocialPromotionEventDraft> {
	return {
		linkClick: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
		like: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
		claim: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
		burn: { user: { ...EMPTY_REWARD }, ref: { ...EMPTY_REWARD } },
	}
}

const EMPTY_REWARD: SocialPromotionRewardDraft = { enabled: false, points13: '1' }

export const EMPTY_SOCIAL_PROMOTION_DRAFT: SocialPromotionDraft = {
	enabled: false,
	events: emptyCardSocialPromotionEvents(),
}

export const EMPTY_COUPON_SOCIAL_PROMOTION_DRAFT: CouponSocialPromotionDraft = {
	enabled: false,
	events: emptyCouponSocialPromotionEvents(),
}

function parsePositiveInt(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
	if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
	return n
}

function rewardDraftFromPayload(
	raw: ShareTokenMetadataSocialPromotionReward | undefined,
): SocialPromotionRewardDraft {
	if (!raw || raw.enabled === false) return { enabled: false, points13: '1' }
	const points = parsePositiveInt(raw.points13)
	return {
		enabled: true,
		points13: String(points ?? 1),
	}
}

function eventDraftFromPayload(
	raw: ShareTokenMetadataSocialPromotionEvent | undefined,
): SocialPromotionEventDraft {
	return {
		user: rewardDraftFromPayload(raw?.user),
		ref: rewardDraftFromPayload(raw?.ref),
	}
}

function eventHasReward(ev: SocialPromotionEventDraft | undefined): boolean {
	if (!ev) return false
	return ev.user.enabled || ev.ref.enabled
}

function eventsPayloadFromRaw(
	eventsRaw: Record<string, unknown> | undefined,
): NonNullable<ShareTokenMetadataSocialPromotion['events']> {
	const events: NonNullable<ShareTokenMetadataSocialPromotion['events']> = {}
	if (!eventsRaw || typeof eventsRaw !== 'object') return events
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = eventsRaw[key]
		if (ev && typeof ev === 'object') {
			const normalized = eventPayloadFromDraft(eventDraftFromPayload(ev as ShareTokenMetadataSocialPromotionEvent))
			if (normalized) events[key] = normalized
		}
	}
	return events
}

export function socialPromotionDraftEmpty(): SocialPromotionDraft {
	return {
		enabled: false,
		events: emptyCardSocialPromotionEvents(),
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
	const stm = meta.shareTokenMetadata
	if (stm && typeof stm === 'object') {
		const nested = (stm as Record<string, unknown>).socialPromotion
		if (nested && typeof nested === 'object') {
			return normalizeSocialPromotionPayload(nested as Record<string, unknown>)
		}
	}
	return null
}

export function parseCouponSocialPromotionFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): ShareTokenMetadataCouponSocialPromotion | null {
	if (!meta || typeof meta !== 'object') return null
	const raw = meta.socialPromotion
	if (!raw || typeof raw !== 'object') return null
	return normalizeCouponSocialPromotionPayload(raw as Record<string, unknown>)
}

function rewardPayloadFromDraft(
	draft: SocialPromotionRewardDraft,
): ShareTokenMetadataSocialPromotionReward | undefined {
	if (!draft.enabled) return undefined
	const points = parsePositiveInt(draft.points13)
	if (points == null) return undefined
	return { enabled: true, points13: points }
}

function eventPayloadFromDraft(
	draft: SocialPromotionEventDraft,
): ShareTokenMetadataSocialPromotionEvent | undefined {
	const user = rewardPayloadFromDraft(draft.user)
	const ref = rewardPayloadFromDraft(draft.ref)
	if (!user && !ref) return undefined
	return {
		...(user ? { user } : {}),
		...(ref ? { ref } : {}),
	}
}

export function socialPromotionDraftHasAnyReward(draft: SocialPromotionDraft): boolean {
	return CARD_SOCIAL_PROMOTION_EVENT_KEYS.some((key) => eventHasReward(draft.events[key]))
}

export function couponSocialPromotionDraftHasAnyReward(draft: CouponSocialPromotionDraft): boolean {
	if (!draft.enabled) return false
	return COUPON_SOCIAL_PROMOTION_EVENT_KEYS.some((key) => eventHasReward(draft.events[key]))
}

export function normalizeSocialPromotionPayload(
	raw: Record<string, unknown>,
): ShareTokenMetadataSocialPromotion | null {
	if (!raw.events || typeof raw.events !== 'object') return null
	const events = eventsPayloadFromRaw(raw.events as Record<string, unknown>)
	if (Object.keys(events).length === 0) return null
	return {
		version: 4,
		enabled: raw.enabled !== false,
		events,
	}
}

export function normalizeCouponSocialPromotionPayload(
	raw: Record<string, unknown>,
): ShareTokenMetadataCouponSocialPromotion | null {
	if (!raw.events || typeof raw.events !== 'object') return null
	const events: NonNullable<ShareTokenMetadataCouponSocialPromotion['events']> = {}
	for (const key of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = (raw.events as Record<string, unknown>)[key]
		if (ev && typeof ev === 'object') {
			const normalized = eventPayloadFromDraft(eventDraftFromPayload(ev as ShareTokenMetadataSocialPromotionEvent))
			if (normalized) events[key] = normalized
		}
	}
	if (Object.keys(events).length === 0) return null
	const ruleIdRaw = raw.ruleId ?? raw.rule_id
	const ruleId =
		ruleIdRaw != null && String(ruleIdRaw).trim() ? String(ruleIdRaw).trim() : undefined
	return {
		version: 2,
		enabled: raw.enabled !== false,
		events,
		...(ruleId ? { ruleId } : {}),
	}
}

export function socialPromotionDraftFromMetadata(
	promo: ShareTokenMetadataSocialPromotion | null | undefined,
): SocialPromotionDraft {
	const draft = socialPromotionDraftEmpty()
	if (!promo?.events) return draft
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = promo.events[key]
		if (ev) draft.events[key] = eventDraftFromPayload(ev)
	}
	draft.enabled = promo.enabled !== false && socialPromotionDraftHasAnyReward(draft)
	return draft
}

export function couponSocialPromotionDraftFromMetadata(
	promo: ShareTokenMetadataCouponSocialPromotion | null | undefined,
): CouponSocialPromotionDraft {
	const draft: CouponSocialPromotionDraft = {
		enabled: false,
		events: emptyCouponSocialPromotionEvents(),
	}
	if (!promo?.events) return draft
	for (const key of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = promo.events[key]
		if (ev) draft.events[key] = eventDraftFromPayload(ev)
	}
	draft.enabled = promo.enabled !== false && couponSocialPromotionDraftHasAnyReward({ ...draft, enabled: true })
	return draft
}

function normalizeRewardDraftForCompare(draft: SocialPromotionRewardDraft): SocialPromotionRewardDraft {
	return {
		enabled: draft.enabled,
		points13: draft.points13.replace(/,/g, '').trim() || '1',
	}
}

function normalizeEventDraftForCompare(draft: SocialPromotionEventDraft): SocialPromotionEventDraft {
	return {
		user: normalizeRewardDraftForCompare(draft.user),
		ref: normalizeRewardDraftForCompare(draft.ref),
	}
}

export function normalizeSocialPromotionDraftForCompare(draft: SocialPromotionDraft): SocialPromotionDraft {
	const events = emptyCardSocialPromotionEvents()
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		events[key] = normalizeEventDraftForCompare(draft.events[key])
	}
	return { enabled: draft.enabled, events }
}

export function cloneSocialPromotionDraft(draft: SocialPromotionDraft): SocialPromotionDraft {
	const events = emptyCardSocialPromotionEvents()
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		events[key] = {
			user: { ...draft.events[key].user },
			ref: { ...draft.events[key].ref },
		}
	}
	return { enabled: draft.enabled, events }
}

export function socialPromotionDraftsEqual(a: SocialPromotionDraft, b: SocialPromotionDraft): boolean {
	const na = normalizeSocialPromotionDraftForCompare(a)
	const nb = normalizeSocialPromotionDraftForCompare(b)
	if (na.enabled !== nb.enabled) return false
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ea = na.events[key]
		const eb = nb.events[key]
		if (
			ea.user.enabled !== eb.user.enabled ||
			ea.user.points13 !== eb.user.points13 ||
			ea.ref.enabled !== eb.ref.enabled ||
			ea.ref.points13 !== eb.ref.points13
		) {
			return false
		}
	}
	return true
}

function validateRewardDraft(draft: SocialPromotionRewardDraft, label: string): string {
	if (!draft.enabled) return ''
	const points = parsePositiveInt(draft.points13)
	if (points == null) return `${label} must be a whole number of social points (≥ 1).`
	if (points > 1_000_000) return `${label} is too large.`
	return ''
}

export function validateSocialPromotionDraft(draft: SocialPromotionDraft): string {
	if (!draft.enabled && !socialPromotionDraftHasAnyReward(draft)) return ''
	let anyEvent = false
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = draft.events[key]
		if (!eventHasReward(ev)) continue
		anyEvent = true
		const eventLabel = cardSocialPromotionEventLabel(key)
		const userErr = validateRewardDraft(ev.user, `${eventLabel} — user reward`)
		if (userErr) return userErr
		const refErr = validateRewardDraft(ev.ref, `${eventLabel} — referrer reward`)
		if (refErr) return refErr
	}
	if (!anyEvent) return 'Enable at least one user or referrer reward on at least one event.'
	return ''
}

export function validateCouponSocialPromotionDraft(draft: CouponSocialPromotionDraft): string {
	if (!draft.enabled) return ''
	let anyEvent = false
	for (const key of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = draft.events[key]
		if (!eventHasReward(ev)) continue
		anyEvent = true
		const eventLabel = couponSocialPromotionEventLabel(key)
		const userErr = validateRewardDraft(ev.user, `${eventLabel} — user reward`)
		if (userErr) return userErr
		const refErr = validateRewardDraft(ev.ref, `${eventLabel} — referrer reward`)
		if (refErr) return refErr
	}
	if (!anyEvent) return 'Enable at least one user or referrer reward on at least one event.'
	return ''
}

export function socialPromotionDraftToPayload(
	draft: SocialPromotionDraft,
): ShareTokenMetadataSocialPromotion | null {
	if (!socialPromotionDraftHasAnyReward(draft)) return null
	const err = validateSocialPromotionDraft({ ...draft, enabled: true })
	if (err) return null
	const events: NonNullable<ShareTokenMetadataSocialPromotion['events']> = {}
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const normalized = eventPayloadFromDraft(draft.events[key])
		if (normalized) events[key] = normalized
	}
	if (Object.keys(events).length === 0) return null
	return {
		version: 4,
		enabled: true,
		events,
	}
}

export function couponSocialPromotionDraftToPayload(
	draft: CouponSocialPromotionDraft,
	issuedTokenId: string,
): ShareTokenMetadataCouponSocialPromotion | null {
	if (!couponSocialPromotionDraftHasAnyReward(draft)) return null
	const err = validateCouponSocialPromotionDraft(draft)
	if (err) return null
	const events: NonNullable<ShareTokenMetadataCouponSocialPromotion['events']> = {}
	for (const key of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const normalized = eventPayloadFromDraft(draft.events[key])
		if (normalized) events[key] = normalized
	}
	if (Object.keys(events).length === 0) return null
	const tokenId = issuedTokenId.trim()
	return {
		version: 2,
		enabled: true,
		events,
		...(tokenId ? { ruleId: tokenId } : {}),
	}
}

export function cardSocialPromotionEventLabel(key: CardSocialPromotionEventKey): string {
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

export function couponSocialPromotionEventLabel(key: CouponSocialPromotionEventKey): string {
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

function formatRewardLine(role: 'User' | 'Referrer', reward: ShareTokenMetadataSocialPromotionReward | undefined): string | null {
	if (!reward || reward.enabled === false) return null
	const points = parsePositiveInt(reward.points13)
	if (points == null) return null
	return `${role}: ${points.toFixed(0)} pt${points === 1 ? '' : 's'}`
}

export function formatSocialPromotionDisplay(
	promo: ShareTokenMetadataSocialPromotion | null | undefined,
): string {
	if (!promo || promo.enabled === false || !promo.events) return 'No social promotion configured.'
	const lines: string[] = []
	for (const key of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = promo.events[key]
		if (!ev) continue
		const parts = [
			formatRewardLine('User', ev.user),
			formatRewardLine('Referrer', ev.ref),
		].filter(Boolean)
		if (parts.length > 0) {
			lines.push(`${cardSocialPromotionEventLabel(key)} — ${parts.join('; ')}`)
		}
	}
	if (lines.length === 0) return 'Incomplete promotion — open editor to fix reward amounts.'
	return lines.join(' · ')
}

export function formatCouponSocialPromotionDisplay(
	promo: ShareTokenMetadataCouponSocialPromotion | null | undefined,
): string {
	if (!promo || promo.enabled === false || !promo.events) return 'No coupon social promotion.'
	const lines: string[] = []
	for (const key of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const ev = promo.events[key]
		if (!ev) continue
		const parts = [
			formatRewardLine('User', ev.user),
			formatRewardLine('Referrer', ev.ref),
		].filter(Boolean)
		if (parts.length > 0) {
			lines.push(`${couponSocialPromotionEventLabel(key)} — ${parts.join('; ')}`)
		}
	}
	if (lines.length === 0) return 'Incomplete coupon promotion — open editor to fix.'
	return lines.join(' · ')
}

export function cardSocialPromotionRuleIdForEventKey(key: CardSocialPromotionEventKey): number {
	switch (key) {
		case 'linkClick':
			return SOCIAL_PROMOTION_LINK_CLICK_RULE_ID
		case 'topup':
			return SOCIAL_PROMOTION_TOPUP_RULE_ID
		case 'like':
			return SOCIAL_PROMOTION_LIKE_RULE_ID
		default:
			return SOCIAL_PROMOTION_LINK_CLICK_RULE_ID
	}
}

export function couponSocialPromotionRuleId(issuedTokenId: string): bigint {
	return couponSocialPromotionRuleIdForEvent(issuedTokenId, 'linkClick')
}

export function couponSocialPromotionRuleIdForEvent(
	issuedTokenId: string,
	eventKey: CouponSocialPromotionEventKey,
): bigint {
	const base = BigInt(String(issuedTokenId).trim())
	const slot = COUPON_SOCIAL_PROMOTION_EVENT_RULE_SLOTS[eventKey]
	if (slot === 0) return base
	return base * 100n + BigInt(slot)
}
