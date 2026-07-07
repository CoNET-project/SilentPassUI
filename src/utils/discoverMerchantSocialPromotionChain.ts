import { ethers } from 'ethers'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

const REWARD_RULE_READ_ABI = [
	'function getRewardRule(uint256 ruleId) view returns (bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
]

const SOCIAL_PROMOTION_LINK_CLICK_RULE_ID = 1
const SOCIAL_PROMOTION_TOPUP_RULE_ID = 2
const SOCIAL_PROMOTION_LIKE_RULE_ID = 3

type SocialPromotionReward = {
	enabled?: boolean
	points13: number
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

const CARD_EVENT_KEYS = ['linkClick', 'like', 'topup'] as const
type CardEventKey = (typeof CARD_EVENT_KEYS)[number]

const RULE_ID_BY_EVENT: Record<CardEventKey, number> = {
	linkClick: SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	topup: SOCIAL_PROMOTION_TOPUP_RULE_ID,
	like: SOCIAL_PROMOTION_LIKE_RULE_ID,
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

function rewardFromMint13(mint13: bigint): SocialPromotionReward | undefined {
	if (mint13 <= 0n) return { enabled: false, points13: 0 }
	return { enabled: true, points13: Number(mint13) }
}

function eventFromChainRule(row: OnChainRewardRuleRow | null): SocialPromotionEvent | undefined {
	if (!row?.active) return undefined
	const user = rewardFromMint13(row.actorMint13)
	const ref = rewardFromMint13(row.refMint13)
	if (!user?.enabled && !ref?.enabled) return undefined
	return { user, ref }
}

/** Card social promotion from on-chain getRewardRule slots 1/2/3 (source of truth). */
export async function readCardSocialPromotionFromChain(
	cardAddress: string,
): Promise<ChainCardSocialPromotion | null> {
	const rules = await Promise.all(
		[
			SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
			SOCIAL_PROMOTION_TOPUP_RULE_ID,
			SOCIAL_PROMOTION_LIKE_RULE_ID,
		].map((ruleId) => readCardRewardRuleFromChain(cardAddress, ruleId)),
	)
	const byRuleId = new Map<number, OnChainRewardRuleRow>()
	for (const row of rules) {
		if (row) byRuleId.set(row.ruleId, row)
	}

	const events: NonNullable<ChainCardSocialPromotion['events']> = {}
	let any = false
	for (const eventKey of CARD_EVENT_KEYS) {
		const ruleId = RULE_ID_BY_EVENT[eventKey]
		const ev = eventFromChainRule(byRuleId.get(ruleId) ?? null)
		if (ev) {
			events[eventKey] = ev
			any = true
		}
	}
	if (!any) return null
	return { enabled: true, events }
}
