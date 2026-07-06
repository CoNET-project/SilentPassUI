import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { signExecuteForOwner } from '@/services/BeamioCard'
import type {
	ShareTokenMetadataCouponSocialPromotion,
	ShareTokenMetadataSocialPromotion,
} from '@/services/BeamioCard'
import {
	ensureCardMerchantV2SilentBootstrap,
	postOwnerExecuteForOwner,
} from '@/utils/beamioCardUserCumulativeStatBootstrap'
import {
	CARD_SOCIAL_PROMOTION_EVENT_KEYS,
	COUPON_SOCIAL_PROMOTION_EVENT_KEYS,
	cardSocialPromotionRuleIdForEventKey,
	couponSocialPromotionRuleIdForEvent,
	type CardSocialPromotionEventKey,
	type CouponSocialPromotionEventKey,
	SOCIAL_PROMOTION_LIKE_RULE_ID,
	SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	SOCIAL_PROMOTION_TOPUP_RULE_ID,
} from '@/utils/programSocialPromotion'

const CARD_CONFIGURE_REWARD_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRule`

const UC_METRIC_TOPUP = 1
const UC_METRIC_USER_CLICK = 3
const UC_METRIC_USER_LIKE = 5
const UC_METRIC_USER_PURCHASE = 6
const UC_METRIC_REF_BURN = 9

const UC_TARGET_GLOBAL_ONLY = 0
const UC_TARGET_MERCHANT_CARD = 1
const UC_TARGET_ISSUED_COUPON = 2

const CONFIGURE_REWARD_IFACE = new ethers.Interface([
	'function configureEventRewardRule(uint256 ruleId, bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
])

const CARD_RULE_IDS = [
	SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	SOCIAL_PROMOTION_TOPUP_RULE_ID,
	SOCIAL_PROMOTION_LIKE_RULE_ID,
]

function parsePoints13(raw: number | undefined): bigint {
	if (raw == null || !Number.isFinite(raw)) return 0n
	const n = Math.max(0, Math.floor(Number(raw)))
	return BigInt(n)
}

function cardRuleParams(eventKey: CardSocialPromotionEventKey): {
	eventKindU8: number
	targetKindU8: number
	issuedParentId: bigint
} {
	switch (eventKey) {
		case 'topup':
			return {
				eventKindU8: UC_METRIC_TOPUP,
				targetKindU8: UC_TARGET_GLOBAL_ONLY,
				issuedParentId: 0n,
			}
		case 'like':
			return {
				eventKindU8: UC_METRIC_USER_LIKE,
				targetKindU8: UC_TARGET_MERCHANT_CARD,
				issuedParentId: 0n,
			}
		case 'linkClick':
		default:
			return {
				eventKindU8: UC_METRIC_USER_CLICK,
				targetKindU8: UC_TARGET_MERCHANT_CARD,
				issuedParentId: 0n,
			}
	}
}

function couponRuleParams(
	eventKind: CouponSocialPromotionEventKey,
	issuedParentId: bigint,
): {
	eventKindU8: number
	targetKindU8: number
} {
	switch (eventKind) {
		case 'like':
			return { eventKindU8: UC_METRIC_USER_LIKE, targetKindU8: UC_TARGET_ISSUED_COUPON }
		case 'claim':
			return { eventKindU8: UC_METRIC_USER_PURCHASE, targetKindU8: UC_TARGET_ISSUED_COUPON }
		case 'burn':
			return { eventKindU8: UC_METRIC_REF_BURN, targetKindU8: UC_TARGET_ISSUED_COUPON }
		case 'linkClick':
		default:
			return { eventKindU8: UC_METRIC_USER_CLICK, targetKindU8: UC_TARGET_ISSUED_COUPON }
	}
}

async function signOwnerConfigureRule(
	ownerPrivateKey: string,
	cardAddress: string,
	ruleId: bigint,
	active: boolean,
	eventKind: number,
	targetKind: number,
	issuedParentId: bigint,
	actorMint13: bigint,
	refMint13: bigint,
): Promise<{ data: string; deadline: number; nonce: string; ownerSignature: string }> {
	const data = CONFIGURE_REWARD_IFACE.encodeFunctionData('configureEventRewardRule', [
		ruleId,
		active,
		eventKind,
		targetKind,
		issuedParentId,
		active ? actorMint13 : 0n,
		active ? refMint13 : 0n,
	])
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const ownerSignature = await signExecuteForOwner(ownerPrivateKey, cardAddress, data, deadline, nonce)
	return { data, deadline, nonce, ownerSignature }
}

async function postConfigureRule(
	cardAddress: string,
	ruleId: bigint,
	active: boolean,
	eventKind: number,
	targetKind: number,
	issuedParentId: bigint,
	actorMint13: bigint,
	refMint13: bigint,
	signed: { data: string; deadline: number; nonce: string; ownerSignature: string },
): Promise<{ success: boolean; error?: string }> {
	return postOwnerExecuteForOwner(
		CARD_CONFIGURE_REWARD_ENDPOINT,
		{
			cardAddress,
			...signed,
			extra: {
				ruleId: ruleId.toString(),
				active: active ? 1 : 0,
				eventKind,
				targetKind,
				issuedParentId: issuedParentId.toString(),
				actorMint13: active ? actorMint13.toString() : '0',
				refMint13: active ? refMint13.toString() : '0',
			},
		},
		[/already/i, /unchanged/i],
	)
}

async function configureRuleSlot(params: {
	ownerPrivateKey: string
	cardAddress: string
	ruleId: bigint
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}): Promise<{ success: boolean; error?: string }> {
	const signed = await signOwnerConfigureRule(
		params.ownerPrivateKey,
		params.cardAddress,
		params.ruleId,
		params.active,
		params.eventKind,
		params.targetKind,
		params.issuedParentId,
		params.actorMint13,
		params.refMint13,
	)
	return postConfigureRule(
		params.cardAddress,
		params.ruleId,
		params.active,
		params.eventKind,
		params.targetKind,
		params.issuedParentId,
		params.actorMint13,
		params.refMint13,
		signed,
	)
}

function resolveCardEventPromotion(
	promo: ShareTokenMetadataSocialPromotion | null | undefined,
	eventKey: CardSocialPromotionEventKey,
): { actorMint13: bigint; refMint13: bigint } {
	if (!promo || promo.enabled === false) return { actorMint13: 0n, refMint13: 0n }
	const ev = promo.events?.[eventKey]
	if (!ev) return { actorMint13: 0n, refMint13: 0n }
	const actorMint13 = ev.user?.enabled !== false ? parsePoints13(ev.user?.points13) : 0n
	const refMint13 = ev.ref?.enabled !== false ? parsePoints13(ev.ref?.points13) : 0n
	return { actorMint13, refMint13 }
}

/**
 * Sync card-level social promotion rules (slots 1 / 2 / 3 — link click, top-up, like).
 * Each event may be active independently (parallel).
 */
export async function applySocialPromotionOnChainRules(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
	socialPromotion: ShareTokenMetadataSocialPromotion | null
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	await ensureCardMerchantV2SilentBootstrap({
		cardAddress: card,
		ownerEoa,
		ownerPrivateKey: params.ownerPrivateKey,
	}).catch(() => undefined)

	const promo = params.socialPromotion

	for (const eventKey of CARD_SOCIAL_PROMOTION_EVENT_KEYS) {
		const { actorMint13, refMint13 } = resolveCardEventPromotion(promo, eventKey)
		const ruleId = BigInt(cardSocialPromotionRuleIdForEventKey(eventKey))
		const chainParams = cardRuleParams(eventKey)
		const active = Boolean(promo && promo.enabled !== false && (actorMint13 > 0n || refMint13 > 0n))
		const res = await configureRuleSlot({
			ownerPrivateKey: params.ownerPrivateKey,
			cardAddress: card,
			ruleId,
			active,
			eventKind: chainParams.eventKindU8,
			targetKind: chainParams.targetKindU8,
			issuedParentId: chainParams.issuedParentId,
			actorMint13: active ? actorMint13 : 0n,
			refMint13: active ? refMint13 : 0n,
		})
		if (!res.success) return res
	}

	if (!promo) {
		for (const ruleId of CARD_RULE_IDS) {
			const isTopup = ruleId === SOCIAL_PROMOTION_TOPUP_RULE_ID
			const isLike = ruleId === SOCIAL_PROMOTION_LIKE_RULE_ID
			const res = await configureRuleSlot({
				ownerPrivateKey: params.ownerPrivateKey,
				cardAddress: card,
				ruleId: BigInt(ruleId),
				active: false,
				eventKind: isTopup ? UC_METRIC_TOPUP : isLike ? UC_METRIC_USER_LIKE : UC_METRIC_USER_CLICK,
				targetKind: isTopup ? UC_TARGET_GLOBAL_ONLY : UC_TARGET_MERCHANT_CARD,
				issuedParentId: 0n,
				actorMint13: 0n,
				refMint13: 0n,
			})
			if (!res.success) return res
		}
	}

	return { success: true }
}

function resolveCouponEventPromotion(
	promo: ShareTokenMetadataCouponSocialPromotion | null | undefined,
	eventKey: CouponSocialPromotionEventKey,
): { actorMint13: bigint; refMint13: bigint } {
	if (!promo || promo.enabled === false) return { actorMint13: 0n, refMint13: 0n }
	const ev = promo.events?.[eventKey]
	if (!ev) return { actorMint13: 0n, refMint13: 0n }
	const actorMint13 = ev.user?.enabled !== false ? parsePoints13(ev.user?.points13) : 0n
	const refMint13 = ev.ref?.enabled !== false ? parsePoints13(ev.ref?.points13) : 0n
	return { actorMint13, refMint13 }
}

/**
 * Sync per-coupon social promotion rules — one on-chain slot per event (parallel).
 */
export async function applyCouponSocialPromotionOnChainRules(params: {
	cardAddress: string
	ownerEoa: string
	ownerPrivateKey: string
	issuedTokenId: string
	socialPromotion: ShareTokenMetadataCouponSocialPromotion | null
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const ownerEoa = ethers.getAddress(params.ownerEoa)
	const issuedTokenId = String(params.issuedTokenId).trim()
	if (!issuedTokenId || !/^\d+$/.test(issuedTokenId)) {
		return { success: false, error: 'Issued coupon token id is required for on-chain promotion rules.' }
	}

	await ensureCardMerchantV2SilentBootstrap({
		cardAddress: card,
		ownerEoa,
		ownerPrivateKey: params.ownerPrivateKey,
	}).catch(() => undefined)

	const issuedParentId = BigInt(issuedTokenId)
	const promo = params.socialPromotion

	for (const eventKey of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const { actorMint13, refMint13 } = resolveCouponEventPromotion(promo, eventKey)
		const active = Boolean(promo && promo.enabled !== false && (actorMint13 > 0n || refMint13 > 0n))
		const chainParams = couponRuleParams(eventKey, issuedParentId)
		const ruleId = couponSocialPromotionRuleIdForEvent(issuedTokenId, eventKey)
		const res = await configureRuleSlot({
			ownerPrivateKey: params.ownerPrivateKey,
			cardAddress: card,
			ruleId,
			active,
			eventKind: chainParams.eventKindU8,
			targetKind: chainParams.targetKindU8,
			issuedParentId,
			actorMint13: active ? actorMint13 : 0n,
			refMint13: active ? refMint13 : 0n,
		})
		if (!res.success) return res
	}

	return { success: true }
}
