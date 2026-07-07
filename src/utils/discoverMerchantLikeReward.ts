import { ethers } from 'ethers'

import { beamioApi } from '@/utils/constants'
import { providerForBeamioUserCard } from '@/utils/beamioUserCardChain'

/** bizSite programSocialPromotion — merchant card like slot */
const SOCIAL_PROMOTION_LIKE_RULE_ID = 3
/** UserCumulativeStatLib.METRIC_USER_LIKE */
const UC_USER_LIKE = 5

const SESSION_REWARD_KEY_PREFIX = 'beamio:discover-like-reward13:v1:'

const REWARD_RULE_ABI = [
	'function getRewardRule(uint256 ruleId) view returns (bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
] as const

function sessionRewardDedupeKey(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): string {
	return `${SESSION_REWARD_KEY_PREFIX}${cardAddress.toLowerCase()}:${actorEOA.toLowerCase()}:${targetKind}:${issuedParentId}`
}

function wasLikeReward13DispatchedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): boolean {
	try {
		return (
			sessionStorage.getItem(
				sessionRewardDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId),
			) === '1'
		)
	} catch {
		return false
	}
}

function markLikeReward13DispatchedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): void {
	try {
		sessionStorage.setItem(
			sessionRewardDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId),
			'1',
		)
	} catch {
		/* ignore quota / private mode */
	}
}

function resolveLikeRefWallet(actorEOA: string, referrerEoa?: string | null): string | undefined {
	const raw = referrerEoa?.trim() ?? ''
	if (!raw || !ethers.isAddress(raw)) return undefined
	try {
		const ref = ethers.getAddress(raw)
		const actor = ethers.getAddress(actorEOA)
		if (ref === actor) return undefined
		return ref
	} catch {
		return undefined
	}
}

function couponLikeRuleIdFromIssuedParent(issuedParentId: string): number | null {
	try {
		const parent = BigInt(String(issuedParentId).trim())
		if (parent <= 0n) return null
		return Number(parent * 100n + 1n)
	} catch {
		return null
	}
}

async function ruleMatchesLikeDispatch(
	reader: ethers.Contract,
	ruleId: number,
	expectedTargetKind: number,
	expectedParentId: bigint,
): Promise<boolean> {
	try {
		const row = (await reader.getRewardRule(ruleId)) as [
			boolean,
			number,
			number,
			bigint,
			bigint,
			bigint,
		]
		const [active, eventKind, targetKind, issuedParentId, actorMint13, refMint13] = row
		return (
			active &&
			Number(eventKind) === UC_USER_LIKE &&
			Number(targetKind) === expectedTargetKind &&
			BigInt(issuedParentId) === expectedParentId &&
			(actorMint13 > 0n || refMint13 > 0n)
		)
	} catch {
		return false
	}
}

async function resolveLikeRewardDispatchRuleId(
	cardAddress: string,
	opts: { targetKind: number; issuedParentId: string },
): Promise<number | null> {
	try {
		const { provider } = await providerForBeamioUserCard(cardAddress)
		const reader = new ethers.Contract(cardAddress, REWARD_RULE_ABI, provider)
		const expectedTargetKind = Number(opts.targetKind)
		const expectedParentId = BigInt(opts.issuedParentId ?? 0)

		const preferredRuleId =
			expectedTargetKind === 1
				? SOCIAL_PROMOTION_LIKE_RULE_ID
				: couponLikeRuleIdFromIssuedParent(opts.issuedParentId)

		if (preferredRuleId != null) {
			if (
				await ruleMatchesLikeDispatch(
					reader,
					preferredRuleId,
					expectedTargetKind,
					expectedParentId,
				)
			) {
				return preferredRuleId
			}
		}

		if (expectedTargetKind === 1) {
			for (let ruleId = 1; ruleId <= 12; ruleId++) {
				if (ruleId === SOCIAL_PROMOTION_LIKE_RULE_ID) continue
				if (await ruleMatchesLikeDispatch(reader, ruleId, expectedTargetKind, expectedParentId)) {
					return ruleId
				}
			}
		}
	} catch {
		/* untrusted — skip optional reward dispatch */
	}
	return null
}

/** Mint optional #13 vouchers when merchant configured an active USER_LIKE rule. */
export async function dispatchDiscoverLikeReward13IfNeeded(params: {
	cardAddress: string
	actorEOA: string
	referrerEoa?: string | null
	targetKind?: number
	issuedParentId?: string
}): Promise<boolean> {
	const targetKind = Number(params.targetKind ?? 1)
	const issuedParentId = String(params.issuedParentId ?? '0')
	if (
		wasLikeReward13DispatchedThisSession(
			params.cardAddress,
			params.actorEOA,
			targetKind,
			issuedParentId,
		)
	) {
		return false
	}

	const ruleId = await resolveLikeRewardDispatchRuleId(params.cardAddress, {
		targetKind,
		issuedParentId,
	})
	if (ruleId == null) return false

	const refWallet = resolveLikeRefWallet(params.actorEOA, params.referrerEoa)

	const rewardRes = await fetch(`${beamioApi}/api/cardDispatchEventReward13`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cardAddress: params.cardAddress,
			ruleId,
			actorWallet: params.actorEOA,
			...(refWallet ? { refWallet } : {}),
			cumulativeTargetKind: targetKind,
			cumulativeIssuedParentId: issuedParentId,
			cumulativeDelta: '0',
		}),
	})
	const rewardJson = (await rewardRes.json().catch(() => null)) as { success?: boolean } | null
	const rewardTxQueued = Boolean(rewardRes.ok && rewardJson?.success)
	if (rewardTxQueued) {
		markLikeReward13DispatchedThisSession(
			params.cardAddress,
			params.actorEOA,
			targetKind,
			issuedParentId,
		)
	}
	return rewardTxQueued
}
