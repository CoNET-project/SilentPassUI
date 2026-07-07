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
	buildSocialPromotionRuleIntents,
	onChainRuleMatchesIntent,
	readCardRewardRuleFromChain,
	verifySocialPromotionRulesOnChain,
	type SocialPromotionRuleIntent,
} from '@/utils/beamioCardSocialPromotionChain'
import {
	COUPON_SOCIAL_PROMOTION_EVENT_KEYS,
	couponSocialPromotionRuleIdForEvent,
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

function parsePoints13(raw: unknown): bigint {
	if (raw == null) return 0n
	if (typeof raw === 'string') {
		const trimmed = raw.replace(/,/g, '').trim()
		if (!trimmed) return 0n
		const n = Number(trimmed)
		if (!Number.isFinite(n)) return 0n
		return BigInt(Math.max(0, Math.floor(n)))
	}
	if (typeof raw === 'number') {
		if (!Number.isFinite(raw)) return 0n
		return BigInt(Math.max(0, Math.floor(raw)))
	}
	return 0n
}

const RULE_CONFIGURE_MAX_ATTEMPTS = 3
const RULE_CONFIGURE_RETRY_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
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

function intentToConfigureParams(
	intent: SocialPromotionRuleIntent,
	ownerPrivateKey: string,
	cardAddress: string,
) {
	return {
		ownerPrivateKey,
		cardAddress,
		ruleId: BigInt(intent.ruleId),
		active: intent.active,
		eventKind: intent.eventKind,
		targetKind: intent.targetKind,
		issuedParentId: intent.issuedParentId,
		actorMint13: intent.actorMint13,
		refMint13: intent.refMint13,
	}
}

async function configureRuleIntentWithRetry(params: {
	ownerPrivateKey: string
	cardAddress: string
	intent: SocialPromotionRuleIntent
	maxAttempts?: number
}): Promise<{ success: boolean; error?: string }> {
	const maxAttempts = params.maxAttempts ?? RULE_CONFIGURE_MAX_ATTEMPTS
	let lastError: string | undefined
	const configureParams = intentToConfigureParams(params.intent, params.ownerPrivateKey, params.cardAddress)

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await configureRuleSlot(configureParams)
		if (!res.success) {
			lastError = res.error ?? `configureEventRewardRule failed for ruleId=${params.intent.ruleId}`
		} else {
			const row = await readCardRewardRuleFromChain(params.cardAddress, params.intent.ruleId)
			if (onChainRuleMatchesIntent(row, params.intent)) return { success: true }
			lastError = `On-chain getRewardRule(${params.intent.ruleId}) did not match intended config (attempt ${attempt}/${maxAttempts})`
		}
		if (attempt < maxAttempts) await sleep(RULE_CONFIGURE_RETRY_DELAY_MS)
	}

	return {
		success: false,
		error: lastError ?? `Failed to configure ruleId=${params.intent.ruleId}`,
	}
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
}): Promise<{ success: boolean; error?: string; failedRuleIds?: number[] }> {
	const card = ethers.getAddress(params.cardAddress)
	const ownerEoa = ethers.getAddress(params.ownerEoa)

	await ensureCardMerchantV2SilentBootstrap({
		cardAddress: card,
		ownerEoa,
		ownerPrivateKey: params.ownerPrivateKey,
	}).catch(() => undefined)

	const intents = buildSocialPromotionRuleIntents(params.socialPromotion)
	const failedRuleIds: number[] = []

	for (const intent of intents) {
		const res = await configureRuleIntentWithRetry({
			ownerPrivateKey: params.ownerPrivateKey,
			cardAddress: card,
			intent,
		})
		if (!res.success) failedRuleIds.push(intent.ruleId)
	}

	if (failedRuleIds.length > 0) {
		for (const ruleId of [...failedRuleIds]) {
			const intent = intents.find((row) => row.ruleId === ruleId)
			if (!intent) continue
			const retry = await configureRuleIntentWithRetry({
				ownerPrivateKey: params.ownerPrivateKey,
				cardAddress: card,
				intent,
				maxAttempts: RULE_CONFIGURE_MAX_ATTEMPTS,
			})
			if (retry.success) {
				const idx = failedRuleIds.indexOf(ruleId)
				if (idx >= 0) failedRuleIds.splice(idx, 1)
			}
		}
	}

	const verify = await verifySocialPromotionRulesOnChain(card, intents)
	const mergedFailed = [...new Set([...failedRuleIds, ...verify.failedRuleIds])]

	if (mergedFailed.length > 0) {
		const likeFailed = mergedFailed.includes(SOCIAL_PROMOTION_LIKE_RULE_ID)
		return {
			success: false,
			failedRuleIds: mergedFailed,
			error: likeFailed
				? `On-chain reward rule update failed for Like (ruleId=${SOCIAL_PROMOTION_LIKE_RULE_ID}). Unlock wallet and save again — metadata alone does not activate rewards.`
				: `On-chain reward rule update failed for ruleId(s): ${mergedFailed.join(', ')}. Try saving again.`,
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
