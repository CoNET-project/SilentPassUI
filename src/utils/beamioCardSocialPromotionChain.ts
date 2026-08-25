import { ethers } from 'ethers'
import type {
	ShareTokenMetadataSocialPromotion,
	ShareTokenMetadataSocialPromotionEvent,
} from '@/services/BeamioCard'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'
import {
	CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS,
	SOCIAL_PROMOTION_LIKE_RULE_ID,
	SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	SOCIAL_PROMOTION_TOPUP_RULE_ID,
	cardSocialPromotionRuleIdForEventKey,
	type CardSocialPromotionEventKey,
} from '@/utils/programSocialPromotion'

const REWARD_RULE_READ_ABI = [
	'function getRewardRule(uint256 ruleId) view returns (bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
]

const UC_METRIC_TOPUP = 1
const UC_METRIC_USER_CLICK = 3
const UC_METRIC_USER_LIKE = 5
const UC_TARGET_GLOBAL_ONLY = 0
const UC_TARGET_MERCHANT_CARD = 1

export type OnChainRewardRuleRow = {
	ruleId: number
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}

export async function readCardRewardRuleFromChain(
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
		const [active, eventKind, targetKind, issuedParentId, actorMint13, refMint13] = row
		return {
			ruleId,
			active: Boolean(active),
			eventKind: Number(eventKind),
			targetKind: Number(targetKind),
			issuedParentId,
			actorMint13,
			refMint13,
		}
	} catch {
		return null
	}
}

function rewardFromMint13(mint13: bigint): ShareTokenMetadataSocialPromotionEvent['user'] {
	if (mint13 <= 0n) return { enabled: false, points13: 0 }
	return { enabled: true, points13: Number(mint13) }
}

function eventFromChainRule(row: OnChainRewardRuleRow | null): ShareTokenMetadataSocialPromotionEvent | undefined {
	if (!row?.active) return undefined
	const user = rewardFromMint13(row.actorMint13)
	const ref = rewardFromMint13(row.refMint13)
	if (!user?.enabled && !ref?.enabled) return undefined
	return { user, ref }
}

function expectedChainParamsForEventKey(eventKey: CardSocialPromotionEventKey): {
	eventKind: number
	targetKind: number
} {
	switch (eventKey) {
		case 'topup':
			return { eventKind: UC_METRIC_TOPUP, targetKind: UC_TARGET_GLOBAL_ONLY }
		case 'like':
			return { eventKind: UC_METRIC_USER_LIKE, targetKind: UC_TARGET_MERCHANT_CARD }
		case 'linkClick':
		default:
			return { eventKind: UC_METRIC_USER_CLICK, targetKind: UC_TARGET_MERCHANT_CARD }
	}
}

/**
 * Card Social Promotion display from on-chain fixed-mint slots **1 + 3** only.
 * Top-up Reward PT / Referrer % live on ratio storage — not `getRewardRule(2)`.
 */
export async function readCardSocialPromotionFromChain(
	cardAddress: string,
): Promise<ShareTokenMetadataSocialPromotion | null> {
	const rules = await Promise.all(
		[SOCIAL_PROMOTION_LINK_CLICK_RULE_ID, SOCIAL_PROMOTION_LIKE_RULE_ID].map((ruleId) =>
			readCardRewardRuleFromChain(cardAddress, ruleId),
		),
	)
	const byRuleId = new Map<number, OnChainRewardRuleRow>()
	for (const row of rules) {
		if (row) byRuleId.set(row.ruleId, row)
	}

	const events: NonNullable<ShareTokenMetadataSocialPromotion['events']> = {}
	let any = false
	for (const eventKey of CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS) {
		const ruleId = cardSocialPromotionRuleIdForEventKey(eventKey)
		const ev = eventFromChainRule(byRuleId.get(ruleId) ?? null)
		if (ev) {
			events[eventKey] = ev
			any = true
		}
	}
	if (!any) return null
	return { version: 4, enabled: true, events }
}

export type SocialPromotionRuleIntent = {
	ruleId: number
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}

/**
 * @deprecated Top-up Reward PT / Referrer use **ratio E6** setters — never fixed `ruleId=2` mint.
 * Always returns an **inactive** slot-2 config (deactivate legacy). Ignores percent args.
 */
export function buildTopupRewardPtRuleIntent(_params?: {
	actorEnabled?: boolean
	actorPercentWhole?: number
	referrerEnabled?: boolean
	referrerPercentWhole?: number
}): SocialPromotionRuleIntent {
	return {
		ruleId: SOCIAL_PROMOTION_TOPUP_RULE_ID,
		active: false,
		eventKind: UC_METRIC_TOPUP,
		targetKind: UC_TARGET_GLOBAL_ONLY,
		issuedParentId: 0n,
		actorMint13: 0n,
		refMint13: 0n,
	}
}

export function buildSocialPromotionRuleIntents(
	promo: ShareTokenMetadataSocialPromotion | null,
): SocialPromotionRuleIntent[] {
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

	function mintFromReward(
		reward: ShareTokenMetadataSocialPromotionEvent['user'] | undefined,
	): bigint {
		if (!reward || reward.enabled === false) return 0n
		return parsePoints13(reward.points13)
	}

	if (!promo) {
		return [
			SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
			SOCIAL_PROMOTION_TOPUP_RULE_ID,
			SOCIAL_PROMOTION_LIKE_RULE_ID,
		].map((ruleId) => {
			const isTopup = ruleId === SOCIAL_PROMOTION_TOPUP_RULE_ID
			const isLike = ruleId === SOCIAL_PROMOTION_LIKE_RULE_ID
			return {
				ruleId,
				active: false,
				eventKind: isTopup
					? UC_METRIC_TOPUP
					: isLike
						? UC_METRIC_USER_LIKE
						: UC_METRIC_USER_CLICK,
				targetKind: isTopup ? UC_TARGET_GLOBAL_ONLY : UC_TARGET_MERCHANT_CARD,
				issuedParentId: 0n,
				actorMint13: 0n,
				refMint13: 0n,
			}
		})
	}

	const intents: SocialPromotionRuleIntent[] = []
	for (const eventKey of CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS) {
		const ev = promo.events?.[eventKey]
		const actorMint13 = mintFromReward(ev?.user)
		const refMint13 = mintFromReward(ev?.ref)
		const chainParams = expectedChainParamsForEventKey(eventKey)
		const active = promo.enabled !== false && (actorMint13 > 0n || refMint13 > 0n)
		intents.push({
			ruleId: cardSocialPromotionRuleIdForEventKey(eventKey),
			active,
			eventKind: chainParams.eventKind,
			targetKind: chainParams.targetKind,
			issuedParentId: 0n,
			actorMint13: active ? actorMint13 : 0n,
			refMint13: active ? refMint13 : 0n,
		})
	}
	// Always clear legacy fixed-mint topup slot; Reward PT uses ratio E6 storage.
	intents.push({
		ruleId: SOCIAL_PROMOTION_TOPUP_RULE_ID,
		active: false,
		eventKind: UC_METRIC_TOPUP,
		targetKind: UC_TARGET_GLOBAL_ONLY,
		issuedParentId: 0n,
		actorMint13: 0n,
		refMint13: 0n,
	})
	return intents
}

export function onChainRuleMatchesIntent(
	row: OnChainRewardRuleRow | null,
	intent: SocialPromotionRuleIntent,
): boolean {
	if (!row) return !intent.active
	if (Boolean(row.active) !== intent.active) return false
	if (!intent.active) return true
	return (
		row.eventKind === intent.eventKind &&
		row.targetKind === intent.targetKind &&
		row.issuedParentId === intent.issuedParentId &&
		row.actorMint13 === intent.actorMint13 &&
		row.refMint13 === intent.refMint13
	)
}

const CARD_LEVEL_SOCIAL_PROMOTION_RULE_IDS = [
	SOCIAL_PROMOTION_LINK_CLICK_RULE_ID,
	SOCIAL_PROMOTION_TOPUP_RULE_ID,
	SOCIAL_PROMOTION_LIKE_RULE_ID,
] as const

/** 并行读取卡级 Social Promotion 三个 rule slot（1/2/3）。 */
export async function readCardLevelSocialPromotionRuleRows(
	cardAddress: string,
): Promise<Map<number, OnChainRewardRuleRow | null>> {
	const rows = await Promise.all(
		CARD_LEVEL_SOCIAL_PROMOTION_RULE_IDS.map((ruleId) => readCardRewardRuleFromChain(cardAddress, ruleId)),
	)
	const byRuleId = new Map<number, OnChainRewardRuleRow | null>()
	for (let i = 0; i < CARD_LEVEL_SOCIAL_PROMOTION_RULE_IDS.length; i++) {
		byRuleId.set(CARD_LEVEL_SOCIAL_PROMOTION_RULE_IDS[i]!, rows[i] ?? null)
	}
	return byRuleId
}

/** 仅保留链上状态与目标 intent 不一致、需要发交易的 rule。 */
export function filterIntentsRequiringChainWrite(
	intents: SocialPromotionRuleIntent[],
	onChainByRuleId: Map<number, OnChainRewardRuleRow | null>,
): SocialPromotionRuleIntent[] {
	return intents.filter((intent) => {
		const row = onChainByRuleId.get(intent.ruleId) ?? null
		return !onChainRuleMatchesIntent(row, intent)
	})
}

export async function verifySocialPromotionRulesOnChain(
	cardAddress: string,
	intents: SocialPromotionRuleIntent[],
	onChainByRuleId?: Map<number, OnChainRewardRuleRow | null>,
): Promise<{ ok: boolean; failedRuleIds: number[] }> {
	const failedRuleIds: number[] = []
	for (const intent of intents) {
		const row =
			onChainByRuleId?.get(intent.ruleId) ??
			(await readCardRewardRuleFromChain(cardAddress, intent.ruleId))
		if (!onChainRuleMatchesIntent(row, intent)) failedRuleIds.push(intent.ruleId)
	}
	return { ok: failedRuleIds.length === 0, failedRuleIds }
}
