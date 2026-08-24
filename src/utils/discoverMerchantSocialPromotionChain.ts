import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

const REWARD_RULE_READ_ABI = [
	'function getRewardRule(uint256 ruleId) view returns (bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
	'function topupActorRewardRatioE6() view returns (uint256)',
	'function referrerTopupAmountRatioE6() view returns (uint256)',
]

const SOCIAL_PROMOTION_LINK_CLICK_RULE_ID = 1
const SOCIAL_PROMOTION_LIKE_RULE_ID = 3

type SocialPromotionReward = {
	enabled?: boolean
	points13: number
	/** Whole % of top-up actual payment (ratio E6); not fixed #13 mint. */
	asPercent?: boolean
}

type SocialPromotionEvent = {
	user?: SocialPromotionReward
	ref?: SocialPromotionReward
}

export type ChainCardSocialPromotion = {
	enabled?: boolean
	events?: {
		linkClick?: SocialPromotionEvent
		like?: SocialPromotionEvent
		topup?: SocialPromotionEvent
	}
}

type OnChainRewardRuleRow = {
	ruleId: number
	active: boolean
	actorMint13: bigint
	refMint13: bigint
}

const FIXED_MINT_EVENT_KEYS = ['linkClick', 'like'] as const
type FixedMintEventKey = (typeof FIXED_MINT_EVENT_KEYS)[number]

const RULE_ID_BY_EVENT: Record<FixedMintEventKey, number> = {
	linkClick: SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	like: SOCIAL_PROMOTION_LIKE_RULE_ID,
}

/** E6 ratio → nearest whole percent 0–100 (100% = 1_000_000). */
function wholePercentFromRatioE6(ratioE6: bigint): number {
	const v = Math.round(Number(ratioE6) / 10_000)
	if (!Number.isFinite(v)) return 0
	return Math.min(100, Math.max(0, v))
}

async function readCardRewardRuleFromChain(
	cardAddress: string,
	ruleId: number,
): Promise<OnChainRewardRuleRow | null> {
	try {
		const card = ethers.getAddress(cardAddress)
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, REWARD_RULE_READ_ABI, provider)
		const row = (await reader.getRewardRule(ruleId)) as [
			boolean,
			number,
			number,
			bigint,
			bigint,
			bigint,
		]
		const [active, , , , actorMint13, refMint13] = row
		return {
			ruleId,
			active: Boolean(active),
			actorMint13,
			refMint13,
		}
	} catch {
		return null
	}
}

async function readTopupRatioPercentsFromChain(
	cardAddress: string,
): Promise<{ actorPercent: number; referrerPercent: number } | null> {
	try {
		const card = ethers.getAddress(cardAddress)
		const { provider } = await providerForBeamioUserCard(card)
		const reader = new ethers.Contract(card, REWARD_RULE_READ_ABI, provider)
		const [actorRaw, refRaw] = await Promise.all([
			reader.topupActorRewardRatioE6().catch(() => null),
			reader.referrerTopupAmountRatioE6().catch(() => null),
		])
		if (actorRaw == null && refRaw == null) return null
		return {
			actorPercent: actorRaw != null ? wholePercentFromRatioE6(BigInt(actorRaw.toString())) : 0,
			referrerPercent: refRaw != null ? wholePercentFromRatioE6(BigInt(refRaw.toString())) : 0,
		}
	} catch {
		return null
	}
}

function rewardFromMint13(mint13: bigint): SocialPromotionReward | undefined {
	if (mint13 <= 0n) return { enabled: false, points13: 0 }
	return { enabled: true, points13: Number(mint13) }
}

function rewardFromPercentWhole(percent: number): SocialPromotionReward | undefined {
	if (percent <= 0) return { enabled: false, points13: 0, asPercent: true }
	return { enabled: true, points13: percent, asPercent: true }
}

function eventFromChainRule(row: OnChainRewardRuleRow | null): SocialPromotionEvent | undefined {
	if (!row?.active) return undefined
	const user = rewardFromMint13(row.actorMint13)
	const ref = rewardFromMint13(row.refMint13)
	if (!user?.enabled && !ref?.enabled) return undefined
	return { user, ref }
}

/**
 * Card social promotion: fixed-mint slots **1 + 3** + Top-up **ratio E6** (not getRewardRule(2)).
 */
export async function readCardSocialPromotionFromChain(
	cardAddress: string,
): Promise<ChainCardSocialPromotion | null> {
	const [linkRule, likeRule, ratios] = await Promise.all([
		readCardRewardRuleFromChain(cardAddress, SOCIAL_PROMOTION_LINK_CLICK_RULE_ID),
		readCardRewardRuleFromChain(cardAddress, SOCIAL_PROMOTION_LIKE_RULE_ID),
		readTopupRatioPercentsFromChain(cardAddress),
	])
	const byRuleId = new Map<number, OnChainRewardRuleRow>()
	if (linkRule) byRuleId.set(linkRule.ruleId, linkRule)
	if (likeRule) byRuleId.set(likeRule.ruleId, likeRule)

	const events: NonNullable<ChainCardSocialPromotion['events']> = {}
	let any = false
	for (const eventKey of FIXED_MINT_EVENT_KEYS) {
		const ruleId = RULE_ID_BY_EVENT[eventKey]
		const ev = eventFromChainRule(byRuleId.get(ruleId) ?? null)
		if (ev) {
			events[eventKey] = ev
			any = true
		}
	}
	if (ratios && (ratios.actorPercent > 0 || ratios.referrerPercent > 0)) {
		events.topup = {
			user: rewardFromPercentWhole(ratios.actorPercent),
			ref: rewardFromPercentWhole(ratios.referrerPercent),
		}
		any = true
	}
	if (!any) return null
	return { enabled: true, events }
}
