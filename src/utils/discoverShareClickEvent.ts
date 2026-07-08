import { ethers } from 'ethers'

import { beamioApi } from '@/utils/constants'
import {
	eip712ChainIdForBeamioUserCard,
	getCardFactoryGatewayForEip712,
	providerForBeamioUserCard,
} from '@/utils/beamioUserCardChain'
import { getCardActiveIssuedCouponSeries, readCouponIdFromMetadata } from '@/services/BeamioCard'

const UC_USER_CLICK = 3
const UC_TARGET_MERCHANT_CARD = 1
const UC_TARGET_ISSUED_COUPON = 2
const SESSION_CLICK_KEY_PREFIX = 'beamio:discover-share-click:v1:'
const SESSION_REWARD_KEY_PREFIX = 'beamio:discover-share-reward13:v1:'

const REWARD_RULE_ABI = [
	'function getRewardRule(uint256 ruleId) view returns (bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
] as const

function sessionClickDedupeKey(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): string {
	return `${SESSION_CLICK_KEY_PREFIX}${cardAddress.toLowerCase()}:${actorEOA.toLowerCase()}:${targetKind}:${issuedParentId}`
}

function sessionRewardDedupeKey(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): string {
	return `${SESSION_REWARD_KEY_PREFIX}${cardAddress.toLowerCase()}:${actorEOA.toLowerCase()}:${targetKind}:${issuedParentId}`
}

function wasShareClickRecordedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): boolean {
	try {
		return sessionStorage.getItem(sessionClickDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId)) === '1'
	} catch {
		return false
	}
}

function markShareClickRecordedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): void {
	try {
		sessionStorage.setItem(sessionClickDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId), '1')
	} catch {
		/* ignore quota / private mode */
	}
}

function wasReward13DispatchedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): boolean {
	try {
		return sessionStorage.getItem(sessionRewardDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId)) === '1'
	} catch {
		return false
	}
}

function markReward13DispatchedThisSession(
	cardAddress: string,
	actorEOA: string,
	targetKind: number,
	issuedParentId: string,
): void {
	try {
		sessionStorage.setItem(sessionRewardDedupeKey(cardAddress, actorEOA, targetKind, issuedParentId), '1')
	} catch {
		/* ignore quota / private mode */
	}
}

function resolveShareClickRefWallet(actorEOA: string, referrerEoa?: string | null): string | undefined {
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

async function resolveIssuedTokenIdByCouponId(cardAddress: string, couponId: string): Promise<string | null> {
	const wanted = couponId.trim()
	if (!wanted) return null
	try {
		const rows = await getCardActiveIssuedCouponSeries(cardAddress, 80)
		for (const row of rows) {
			const tokenId = String(row.tokenId ?? '').trim()
			const seriesCouponId = readCouponIdFromMetadata(row.metadata ?? null) || tokenId
			if (seriesCouponId === wanted || tokenId === wanted) return tokenId || null
		}
	} catch {
		/* untrusted */
	}
	return null
}

function couponLinkClickRuleIdFromIssuedParent(issuedParentId: string): bigint | null {
	try {
		const parent = BigInt(String(issuedParentId).trim())
		if (parent <= 0n) return null
		return parent
	} catch {
		return null
	}
}

async function ruleMatchesShareClickDispatch(
	reader: ethers.Contract,
	ruleId: bigint,
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
			Number(eventKind) === UC_USER_CLICK &&
			Number(targetKind) === expectedTargetKind &&
			BigInt(issuedParentId) === expectedParentId &&
			(actorMint13 > 0n || refMint13 > 0n)
		)
	} catch {
		return false
	}
}

async function resolveShareClickRewardDispatchRuleId(
	cardAddress: string,
	opts: { targetKind: number; issuedParentId: string },
): Promise<number | null> {
	try {
		const { provider } = await providerForBeamioUserCard(cardAddress)
		const reader = new ethers.Contract(cardAddress, REWARD_RULE_ABI, provider)
		const expectedTargetKind = Number(opts.targetKind)
		const expectedParentId = BigInt(opts.issuedParentId ?? 0)

		if (expectedTargetKind === UC_TARGET_ISSUED_COUPON) {
			const preferred = couponLinkClickRuleIdFromIssuedParent(opts.issuedParentId)
			if (preferred != null) {
				if (await ruleMatchesShareClickDispatch(reader, preferred, expectedTargetKind, expectedParentId)) {
					const n = Number(preferred)
					return Number.isSafeInteger(n) ? n : null
				}
			}
			return null
		}

		for (let ruleId = 1; ruleId <= 12; ruleId++) {
			if (await ruleMatchesShareClickDispatch(reader, BigInt(ruleId), UC_TARGET_MERCHANT_CARD, 0n)) {
				return ruleId
			}
		}
	} catch {
		/* untrusted — skip optional reward dispatch */
	}
	return null
}

async function dispatchDiscoverShareReward13IfNeeded(params: {
	cardAddress: string
	actorEOA: string
	refWallet?: string
	targetKind: number
	issuedParentId: string
}): Promise<boolean> {
	if (
		wasReward13DispatchedThisSession(
			params.cardAddress,
			params.actorEOA,
			params.targetKind,
			params.issuedParentId,
		)
	) {
		return false
	}
	const ruleId = await resolveShareClickRewardDispatchRuleId(params.cardAddress, {
		targetKind: params.targetKind,
		issuedParentId: params.issuedParentId,
	})
	if (ruleId == null) return false
	const rewardRes = await fetch(`${beamioApi}/api/cardDispatchEventReward13`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cardAddress: params.cardAddress,
			ruleId,
			actorWallet: params.actorEOA,
			...(params.refWallet ? { refWallet: params.refWallet } : {}),
			cumulativeTargetKind: params.targetKind,
			cumulativeIssuedParentId: params.issuedParentId,
			cumulativeDelta: '0',
		}),
	})
	const rewardJson = (await rewardRes.json().catch(() => null)) as { success?: boolean } | null
	const rewardTxQueued = Boolean(rewardRes.ok && rewardJson?.success)
	if (rewardTxQueued) {
		markReward13DispatchedThisSession(
			params.cardAddress,
			params.actorEOA,
			params.targetKind,
			params.issuedParentId,
		)
	}
	return rewardTxQueued
}

async function signDiscoverShareClickEip712(
	wallet: ethers.Wallet,
	cardAddress: string,
	refWallet: string | undefined,
	targetKind: number,
	issuedParentId: bigint,
): Promise<{ deadline: number; nonce: string; userSignature: string }> {
	const cardNorm = ethers.getAddress(cardAddress)
	const actorEOA = ethers.getAddress(wallet.address)
	const verifyingContract = await getCardFactoryGatewayForEip712(cardNorm)
	const chainId = await eip712ChainIdForBeamioUserCard(cardNorm)
	const deadline = Math.floor(Date.now() / 1000) + 15 * 60
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const refAddr =
		refWallet && ethers.isAddress(refWallet) ? ethers.getAddress(refWallet) : ethers.ZeroAddress
	const userSignature = await wallet.signTypedData(
		{
			name: 'BeamioUserCardFactory',
			version: '1',
			chainId,
			verifyingContract,
		},
		{
			RecordDiscoverShareClick: [
				{ name: 'cardAddress', type: 'address' },
				{ name: 'actorEOA', type: 'address' },
				{ name: 'refWallet', type: 'address' },
				{ name: 'targetKind', type: 'uint8' },
				{ name: 'issuedParentId', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
				{ name: 'nonce', type: 'bytes32' },
			],
		},
		{
			cardAddress: cardNorm,
			actorEOA,
			refWallet: refAddr,
			targetKind,
			issuedParentId,
			deadline: BigInt(deadline),
			nonce,
		},
	)
	return { deadline, nonce, userSignature }
}

export type DiscoverShareClickResult =
	| {
			ok: true
			actorEOA: string
			txQueued: boolean
			skipped?: 'session'
			rewardTxQueued?: boolean
			targetKind?: number
			issuedParentId?: string
	  }
	| { ok: false; reason: string }

/** Record share-link open (merchant L1 or coupon L2 USER_CLICK + optional #13). */
export async function recordDiscoverShareClickIfNeeded(params: {
	cardAddress: string
	privateKeyArmor: string
	referrerEoa?: string | null
	couponId?: string | null
	issuedParentId?: string | null
	targetKind?: number
}): Promise<DiscoverShareClickResult> {
	let card: string
	try {
		card = ethers.getAddress(String(params.cardAddress ?? '').trim())
	} catch {
		return { ok: false, reason: 'invalid_card' }
	}

	const privateKeyArmor = params.privateKeyArmor?.trim() ?? ''
	if (!privateKeyArmor) return { ok: false, reason: 'wallet_unavailable' }

	let wallet: ethers.Wallet
	try {
		wallet = new ethers.Wallet(privateKeyArmor)
	} catch {
		return { ok: false, reason: 'wallet_unavailable' }
	}

	let targetKind = Number(params.targetKind ?? UC_TARGET_MERCHANT_CARD)
	let issuedParentId = String(params.issuedParentId ?? '0')
	const couponId = params.couponId?.trim() ?? ''
	if (couponId || (targetKind === UC_TARGET_ISSUED_COUPON && issuedParentId !== '0')) {
		targetKind = UC_TARGET_ISSUED_COUPON
		const tokenId =
			params.issuedParentId?.trim() ||
			(couponId ? await resolveIssuedTokenIdByCouponId(card, couponId) : null)
		if (!tokenId) return { ok: false, reason: 'coupon_not_found' }
		issuedParentId = tokenId
	}

	const actorEOA = ethers.getAddress(wallet.address)
	const refWallet = resolveShareClickRefWallet(actorEOA, params.referrerEoa)

	if (wasShareClickRecordedThisSession(card, actorEOA, targetKind, issuedParentId)) {
		try {
			const rewardTxQueued = await dispatchDiscoverShareReward13IfNeeded({
				cardAddress: card,
				actorEOA,
				refWallet,
				targetKind,
				issuedParentId,
			})
			return {
				ok: true,
				actorEOA,
				txQueued: false,
				skipped: 'session',
				rewardTxQueued,
				targetKind,
				issuedParentId,
			}
		} catch {
			return { ok: false, reason: 'network' }
		}
	}

	const { deadline, nonce, userSignature } = await signDiscoverShareClickEip712(
		wallet,
		card,
		refWallet,
		targetKind,
		BigInt(issuedParentId),
	)

	try {
		const res = await fetch(`${beamioApi}/api/cardRecordDiscoverShareClick`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: card,
				actorWallet: actorEOA,
				...(refWallet ? { refWallet } : {}),
				cumulativeTargetKind: targetKind,
				cumulativeIssuedParentId: issuedParentId,
				deadline,
				nonce,
				userSignature,
			}),
		})
		const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
		if (!res.ok || !json?.success) {
			return { ok: false, reason: json?.error ?? `http_${res.status}` }
		}

		markShareClickRecordedThisSession(card, actorEOA, targetKind, issuedParentId)
		const rewardTxQueued = await dispatchDiscoverShareReward13IfNeeded({
			cardAddress: card,
			actorEOA,
			refWallet,
			targetKind,
			issuedParentId,
		})
		return {
			ok: true,
			actorEOA,
			txQueued: true,
			rewardTxQueued,
			targetKind,
			issuedParentId,
		}
	} catch {
		return { ok: false, reason: 'network' }
	}
}
