import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { signExecuteForOwner } from '@/services/BeamioCard'
import {
	ensureCardMerchantV2SilentBootstrap,
	postOwnerExecuteForOwner,
} from '@/utils/beamioCardUserCumulativeStatBootstrap'
import {
	SOCIAL_PROMOTION_REF_CLICK_RULE_ID,
	SOCIAL_PROMOTION_REF_TOPUP_RULE_ID,
	type SocialPromotionEventKind,
} from '@/utils/programSocialPromotion'
import type { ShareTokenMetadataSocialPromotion } from '@/services/BeamioCard'

const CARD_CONFIGURE_REWARD_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRule`

/** UserCumulativeStatLib metric kinds (subset). */
const UC_METRIC_USER_CLICK = 3
const UC_METRIC_TOPUP = 1
const UC_TARGET_MERCHANT_CARD = 1
const UC_TARGET_GLOBAL_ONLY = 0

const CONFIGURE_REWARD_IFACE = new ethers.Interface([
	'function configureEventRewardRule(uint256 ruleId, bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
])

async function signOwnerConfigureRule(
	ownerPrivateKey: string,
	cardAddress: string,
	ruleId: number,
	active: boolean,
	eventKind: number,
	targetKind: number,
	refMint13: bigint,
): Promise<{ data: string; deadline: number; nonce: string; ownerSignature: string }> {
	const data = CONFIGURE_REWARD_IFACE.encodeFunctionData('configureEventRewardRule', [
		BigInt(ruleId),
		active,
		eventKind,
		targetKind,
		0n,
		0n,
		active ? refMint13 : 0n,
	])
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const ownerSignature = await signExecuteForOwner(ownerPrivateKey, cardAddress, data, deadline, nonce)
	return { data, deadline, nonce, ownerSignature }
}

async function postConfigureRule(
	cardAddress: string,
	ruleId: number,
	active: boolean,
	eventKind: number,
	targetKind: number,
	refMint13: bigint,
	signed: { data: string; deadline: number; nonce: string; ownerSignature: string },
): Promise<{ success: boolean; error?: string }> {
	return postOwnerExecuteForOwner(
		CARD_CONFIGURE_REWARD_ENDPOINT,
		{
			cardAddress,
			...signed,
			extra: {
				ruleId,
				active: active ? 1 : 0,
				eventKind,
				targetKind,
				issuedParentId: '0',
				actorMint13: '0',
				refMint13: active ? refMint13.toString() : '0',
			},
		},
		[/already/i, /unchanged/i],
	)
}

function ruleParamsForEventKind(eventKind: SocialPromotionEventKind): {
	ruleId: number
	eventKindU8: number
	targetKindU8: number
} {
	if (eventKind === 'refTopup') {
		return {
			ruleId: SOCIAL_PROMOTION_REF_TOPUP_RULE_ID,
			eventKindU8: UC_METRIC_TOPUP,
			targetKindU8: UC_TARGET_GLOBAL_ONLY,
		}
	}
	return {
		ruleId: SOCIAL_PROMOTION_REF_CLICK_RULE_ID,
		eventKindU8: UC_METRIC_USER_CLICK,
		targetKindU8: UC_TARGET_MERCHANT_CARD,
	}
}

/**
 * Sync on-chain event reward rules with metadata socialPromotion (mutually exclusive slots 1 / 2).
 * Requires card owner key; ensures cumulative-stat bootstrap first.
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

	const deactivateRuleIds = [SOCIAL_PROMOTION_REF_CLICK_RULE_ID, SOCIAL_PROMOTION_REF_TOPUP_RULE_ID]

	if (!params.socialPromotion || params.socialPromotion.enabled === false) {
		for (const ruleId of deactivateRuleIds) {
			const signed = await signOwnerConfigureRule(
				params.ownerPrivateKey,
				card,
				ruleId,
				false,
				ruleId === SOCIAL_PROMOTION_REF_TOPUP_RULE_ID ? UC_METRIC_TOPUP : UC_METRIC_USER_CLICK,
				ruleId === SOCIAL_PROMOTION_REF_TOPUP_RULE_ID ? UC_TARGET_GLOBAL_ONLY : UC_TARGET_MERCHANT_CARD,
				0n,
			)
			const res = await postConfigureRule(
				card,
				ruleId,
				false,
				ruleId === SOCIAL_PROMOTION_REF_TOPUP_RULE_ID ? UC_METRIC_TOPUP : UC_METRIC_USER_CLICK,
				ruleId === SOCIAL_PROMOTION_REF_TOPUP_RULE_ID ? UC_TARGET_GLOBAL_ONLY : UC_TARGET_MERCHANT_CARD,
				0n,
				signed,
			)
			if (!res.success) return res
		}
		return { success: true }
	}

	const points = BigInt(Math.max(1, Math.floor(Number(params.socialPromotion.refRewardPoints13) || 1)))
	const activeKind = params.socialPromotion.eventKind === 'refTopup' ? 'refTopup' : 'refClick'
	const active = ruleParamsForEventKind(activeKind)
	const inactiveRuleId =
		active.ruleId === SOCIAL_PROMOTION_REF_CLICK_RULE_ID
			? SOCIAL_PROMOTION_REF_TOPUP_RULE_ID
			: SOCIAL_PROMOTION_REF_CLICK_RULE_ID
	const inactiveParams = ruleParamsForEventKind(
		inactiveRuleId === SOCIAL_PROMOTION_REF_TOPUP_RULE_ID ? 'refTopup' : 'refClick',
	)

	const inactiveSigned = await signOwnerConfigureRule(
		params.ownerPrivateKey,
		card,
		inactiveRuleId,
		false,
		inactiveParams.eventKindU8,
		inactiveParams.targetKindU8,
		0n,
	)
	const inactiveRes = await postConfigureRule(
		card,
		inactiveRuleId,
		false,
		inactiveParams.eventKindU8,
		inactiveParams.targetKindU8,
		0n,
		inactiveSigned,
	)
	if (!inactiveRes.success) return inactiveRes

	const activeSigned = await signOwnerConfigureRule(
		params.ownerPrivateKey,
		card,
		active.ruleId,
		true,
		active.eventKindU8,
		active.targetKindU8,
		points,
	)
	const activeRes = await postConfigureRule(
		card,
		active.ruleId,
		true,
		active.eventKindU8,
		active.targetKindU8,
		points,
		activeSigned,
	)
	if (!activeRes.success) return activeRes

	return { success: true }
}
