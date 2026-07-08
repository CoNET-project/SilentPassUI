import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import type {
	ShareTokenMetadataCouponSocialPromotion,
	ShareTokenMetadataSocialPromotion,
} from '@/services/BeamioCard'
import { signExecuteForOwner } from '@/services/BeamioCard'
import { readCardUserCumulativeStatInitialized } from '@/utils/beamioCardUserCumulativeStatBootstrap'
import {
	buildSocialPromotionRuleIntents,
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

const CARD_CONFIGURE_REWARD_RULES_BATCH_OWNER_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRulesBatch`
const CARD_CONFIGURE_REWARD_RULES_BATCH_GATEWAY_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRulesBatchGateway`

const CONFIGURE_EVENT_REWARD_RULE_IFACE = new ethers.Interface([
	'function configureEventRewardRulesBatch((uint256 ruleId,bool active,uint8 eventKind,uint8 targetKind,uint256 issuedParentId,uint256 actorMint13,uint256 refMint13)[] configs)',
])
const CARD_GATEWAY_INIT_ENDPOINT = `${beamioApi}/api/cardGatewayInitializeUserCumulativeStat`

const UC_METRIC_TOPUP = 1
const UC_METRIC_USER_CLICK = 3
const UC_METRIC_USER_LIKE = 5
const UC_METRIC_USER_PURCHASE = 6
const UC_METRIC_REF_BURN = 9

const UC_TARGET_ISSUED_COUPON = 2

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

async function ensureCardCumulativeStatReadyViaGateway(cardAddress: string): Promise<void> {
	const card = ethers.getAddress(cardAddress)
	const status = await readCardUserCumulativeStatInitialized(card)
	if (status?.initialized) return
	try {
		await fetch(CARD_GATEWAY_INIT_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cardAddress: card }),
		})
	} catch {
		/* gateway init is best-effort; configure may still succeed if already initialized */
	}
}

function socialPromotionRuleIntentToApiRow(intent: SocialPromotionRuleIntent): Record<string, string | number | boolean> {
	return {
		ruleId: String(intent.ruleId),
		active: intent.active,
		eventKind: intent.eventKind,
		targetKind: intent.targetKind,
		issuedParentId: intent.issuedParentId.toString(),
		actorMint13: intent.active ? intent.actorMint13.toString() : '0',
		refMint13: intent.active ? intent.refMint13.toString() : '0',
	}
}

function encodeConfigureEventRewardRulesBatchCalldata(intents: SocialPromotionRuleIntent[]): string {
	const rows = intents.map((intent) => ({
		ruleId: BigInt(intent.ruleId),
		active: intent.active,
		eventKind: intent.eventKind,
		targetKind: intent.targetKind,
		issuedParentId: intent.issuedParentId,
		actorMint13: intent.active ? intent.actorMint13 : 0n,
		refMint13: intent.active ? intent.refMint13 : 0n,
	}))
	return CONFIGURE_EVENT_REWARD_RULE_IFACE.encodeFunctionData('configureEventRewardRulesBatch', [rows])
}

async function postConfigureRulesBatchOwnerSigned(params: {
	cardAddress: string
	ownerPrivateKey: string
	intents: SocialPromotionRuleIntent[]
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const data = encodeConfigureEventRewardRulesBatchCalldata(params.intents)
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	let ownerSignature: string
	try {
		ownerSignature = await signExecuteForOwner(params.ownerPrivateKey, card, data, deadline, nonce)
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? 'Failed to sign configureEventRewardRulesBatch.' }
	}
	try {
		const res = await fetch(CARD_CONFIGURE_REWARD_RULES_BATCH_OWNER_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: card,
				data,
				deadline,
				nonce,
				ownerSignature,
				rules: params.intents.map(socialPromotionRuleIntentToApiRow),
			}),
		})
		const body = (await res.json()) as { success?: boolean; error?: string }
		if (!res.ok || !body.success) {
			return {
				success: false,
				error: typeof body.error === 'string' ? body.error : `${CARD_CONFIGURE_REWARD_RULES_BATCH_OWNER_ENDPOINT} failed`,
			}
		}
		return { success: true }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? String(e) }
	}
}

async function postConfigureRulesBatchGateway(params: {
	cardAddress: string
	intents: SocialPromotionRuleIntent[]
}): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch(CARD_CONFIGURE_REWARD_RULES_BATCH_GATEWAY_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(params.cardAddress),
				rules: params.intents.map(socialPromotionRuleIntentToApiRow),
			}),
		})
		const data = (await res.json()) as { success?: boolean; error?: string }
		if (!res.ok || !data.success) {
			return {
				success: false,
				error: typeof data.error === 'string' ? data.error : `${CARD_CONFIGURE_REWARD_RULES_BATCH_GATEWAY_ENDPOINT} failed`,
			}
		}
		return { success: true }
	} catch {
		return { success: false, error: 'Network error while configuring on-chain reward rules (batch).' }
	}
}

/**
 * Sync **merchant card-level** social promotion (global L1 slots: linkClick / like / top-up).
 * RuleIds 1 / 2 / 3, targetKind merchant card or global — **not** per-issued-coupon.
 * Owner signs once; all three slots are written via configureEventRewardRulesBatch (no per-slot chain diff skip).
 * For per-coupon rules use {@link applyCouponSocialPromotionOnChainRules}.
 */
export async function applySocialPromotionOnChainRules(params: {
	cardAddress: string
	socialPromotion: ShareTokenMetadataSocialPromotion | null
	/** CoNET 无 gatewayInvokeCard 时须卡主 owner 签名走 executeForOwner。 */
	ownerPrivateKey?: string
}): Promise<{ success: boolean; error?: string; failedRuleIds?: number[] }> {
	const card = ethers.getAddress(params.cardAddress)

	await ensureCardCumulativeStatReadyViaGateway(card)

	const intents = buildSocialPromotionRuleIntents(params.socialPromotion)

	const ownerKey = params.ownerPrivateKey?.trim()
	if (ownerKey) {
		const batchRes = await postConfigureRulesBatchOwnerSigned({
			cardAddress: card,
			ownerPrivateKey: ownerKey,
			intents,
		})
		if (!batchRes.success) {
			return {
				success: false,
				error:
					batchRes.error ??
					'On-chain social promotion batch update failed. Try saving again.',
			}
		}
		return { success: true }
	}

	const batchRes = await postConfigureRulesBatchGateway({ cardAddress: card, intents })
	if (!batchRes.success) {
		return {
			success: false,
			error:
				batchRes.error ??
				'On-chain social promotion batch update failed. Try saving again.',
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
	const actorMint13 =
		ev.user && ev.user.enabled !== false ? parsePoints13(ev.user.points13) : 0n
	const refMint13 = ev.ref && ev.ref.enabled !== false ? parsePoints13(ev.ref.points13) : 0n
	return { actorMint13, refMint13 }
}

function buildCouponSocialPromotionRuleIntents(
	issuedTokenId: string,
	promo: ShareTokenMetadataCouponSocialPromotion | null,
): SocialPromotionRuleIntent[] {
	const issuedParentId = BigInt(issuedTokenId)
	const intents: SocialPromotionRuleIntent[] = []
	for (const eventKey of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const { actorMint13, refMint13 } = resolveCouponEventPromotion(promo, eventKey)
		const active = Boolean(promo && promo.enabled !== false && (actorMint13 > 0n || refMint13 > 0n))
		const chainParams = couponRuleParams(eventKey, issuedParentId)
		const ruleIdBig = couponSocialPromotionRuleIdForEvent(issuedTokenId, eventKey)
		const ruleId = Number(ruleIdBig)
		if (!Number.isSafeInteger(ruleId)) {
			throw new Error(`Coupon ruleId ${ruleIdBig.toString()} exceeds safe integer range.`)
		}
		// L2 issued coupon: ruleId derived from this coupon's issuedTokenId only — never card slots 1/2/3.
		intents.push({
			ruleId,
			active,
			eventKind: chainParams.eventKindU8,
			targetKind: chainParams.targetKindU8,
			issuedParentId,
			actorMint13: active ? actorMint13 : 0n,
			refMint13: active ? refMint13 : 0n,
		})
	}
	return intents
}

function assertCouponSocialPromotionIntents(
	issuedTokenId: string,
	intents: SocialPromotionRuleIntent[],
): void {
	const parent = BigInt(issuedTokenId)
	for (const intent of intents) {
		if (intent.targetKind !== UC_TARGET_ISSUED_COUPON) {
			throw new Error('Coupon social promotion must use L2 issued-coupon targetKind, not merchant card.')
		}
		if (intent.issuedParentId !== parent) {
			throw new Error('Coupon social promotion issuedParentId must match the coupon issuedTokenId.')
		}
		if (
			intent.ruleId === SOCIAL_PROMOTION_LINK_CLICK_RULE_ID ||
			intent.ruleId === SOCIAL_PROMOTION_TOPUP_RULE_ID ||
			intent.ruleId === SOCIAL_PROMOTION_LIKE_RULE_ID
		) {
			throw new Error('Coupon social promotion must not use merchant card ruleIds 1/2/3.')
		}
	}
}

/**
 * Sync **one issued coupon's** social promotion (L2 / targetKind=issued coupon).
 * Each coupon has its own ruleIds (from issuedTokenId × event slot), events (linkClick / like / claim / burn),
 * and metadata — independent of merchant card global social promotion and of other coupons.
 * Owner signs once; all four slots are written via configureEventRewardRulesBatch (no per-slot chain diff skip).
 */
export async function applyCouponSocialPromotionOnChainRules(params: {
	cardAddress: string
	issuedTokenId: string
	socialPromotion: ShareTokenMetadataCouponSocialPromotion | null
	/** CoNET 无 gatewayInvokeCard 时须卡主 owner 签名走 executeForOwner。 */
	ownerPrivateKey?: string
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const issuedTokenId = String(params.issuedTokenId).trim()
	if (!issuedTokenId || !/^\d+$/.test(issuedTokenId)) {
		return { success: false, error: 'Issued coupon token id is required for on-chain promotion rules.' }
	}

	await ensureCardCumulativeStatReadyViaGateway(card)

	const intents = buildCouponSocialPromotionRuleIntents(issuedTokenId, params.socialPromotion)
	assertCouponSocialPromotionIntents(issuedTokenId, intents)

	const ownerKey = params.ownerPrivateKey?.trim()
	if (!ownerKey) {
		return {
			success: false,
			error: 'Unlock your wallet before saving on-chain coupon social promotion rules.',
		}
	}

	const batchRes = await postConfigureRulesBatchOwnerSigned({
		cardAddress: card,
		ownerPrivateKey: ownerKey,
		intents,
	})
	if (!batchRes.success) {
		return {
			success: false,
			error:
				batchRes.error ??
				'On-chain coupon social promotion batch update failed. Try saving again.',
		}
	}

	return { success: true }
}
