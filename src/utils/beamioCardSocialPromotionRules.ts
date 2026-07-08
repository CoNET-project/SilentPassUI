import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import type {
	ShareTokenMetadataCouponSocialPromotion,
	ShareTokenMetadataSocialPromotion,
} from '@/services/BeamioCard'
import { signExecuteForOwner } from '@/services/BeamioCard'
import { readCardUserCumulativeStatInitialized } from '@/utils/beamioCardUserCumulativeStatBootstrap'
import { postOwnerExecuteForOwner } from '@/utils/beamioCardUserCumulativeStatBootstrap'
import {
	buildSocialPromotionRuleIntents,
	filterIntentsRequiringChainWrite,
	onChainRuleMatchesIntent,
	readCardLevelSocialPromotionRuleRows,
	readCardRewardRuleFromChain,
	verifySocialPromotionRulesOnChain,
	type SocialPromotionRuleIntent,
} from '@/utils/beamioCardSocialPromotionChain'
import {
	COUPON_SOCIAL_PROMOTION_EVENT_KEYS,
	couponSocialPromotionRuleIdForEvent,
	type CouponSocialPromotionEventKey,
	SOCIAL_PROMOTION_LIKE_RULE_ID,
} from '@/utils/programSocialPromotion'

const CARD_CONFIGURE_REWARD_GATEWAY_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRuleGateway`
const CARD_CONFIGURE_REWARD_OWNER_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRule`
const CARD_CONFIGURE_REWARD_RULES_BATCH_OWNER_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRulesBatch`
const CARD_CONFIGURE_REWARD_RULES_BATCH_GATEWAY_ENDPOINT = `${beamioApi}/api/cardConfigureEventRewardRulesBatchGateway`

const CONFIGURE_EVENT_REWARD_RULE_IFACE = new ethers.Interface([
	'function configureEventRewardRule(uint256 ruleId, bool active, uint8 eventKind, uint8 targetKind, uint256 issuedParentId, uint256 actorMint13, uint256 refMint13)',
	'function configureEventRewardRulesBatch((uint256 ruleId,bool active,uint8 eventKind,uint8 targetKind,uint256 issuedParentId,uint256 actorMint13,uint256 refMint13)[] configs)',
])
const CARD_GATEWAY_INIT_ENDPOINT = `${beamioApi}/api/cardGatewayInitializeUserCumulativeStat`

const UC_METRIC_TOPUP = 1
const UC_METRIC_USER_CLICK = 3
const UC_METRIC_USER_LIKE = 5
const UC_METRIC_USER_PURCHASE = 6
const UC_METRIC_REF_BURN = 9

const UC_TARGET_ISSUED_COUPON = 2

const RULE_CONFIGURE_MAX_ATTEMPTS = 3
const RULE_CONFIGURE_RETRY_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

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

async function postConfigureRuleGateway(params: {
	cardAddress: string
	ruleId: bigint
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch(CARD_CONFIGURE_REWARD_GATEWAY_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(params.cardAddress),
				ruleId: params.ruleId.toString(),
				active: params.active,
				eventKind: params.eventKind,
				targetKind: params.targetKind,
				issuedParentId: params.issuedParentId.toString(),
				actorMint13: params.active ? params.actorMint13.toString() : '0',
				refMint13: params.active ? params.refMint13.toString() : '0',
			}),
		})
		const data = (await res.json()) as { success?: boolean; error?: string }
		if (!res.ok || !data.success) {
			return {
				success: false,
				error: typeof data.error === 'string' ? data.error : `${CARD_CONFIGURE_REWARD_GATEWAY_ENDPOINT} failed`,
			}
		}
		return { success: true }
	} catch {
		return { success: false, error: 'Network error while configuring on-chain reward rule.' }
	}
}

function encodeConfigureEventRewardRuleCalldata(params: {
	ruleId: bigint
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}): string {
	return CONFIGURE_EVENT_REWARD_RULE_IFACE.encodeFunctionData('configureEventRewardRule', [
		params.ruleId,
		params.active,
		params.eventKind,
		params.targetKind,
		params.issuedParentId,
		params.active ? params.actorMint13 : 0n,
		params.active ? params.refMint13 : 0n,
	])
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

async function postConfigureRuleOwnerSigned(params: {
	cardAddress: string
	ownerPrivateKey: string
	ruleId: bigint
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const data = encodeConfigureEventRewardRuleCalldata({
		ruleId: params.ruleId,
		active: params.active,
		eventKind: params.eventKind,
		targetKind: params.targetKind,
		issuedParentId: params.issuedParentId,
		actorMint13: params.actorMint13,
		refMint13: params.refMint13,
	})
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	let ownerSignature: string
	try {
		ownerSignature = await signExecuteForOwner(params.ownerPrivateKey, card, data, deadline, nonce)
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? 'Failed to sign configureEventRewardRule.' }
	}
	return postOwnerExecuteForOwner(CARD_CONFIGURE_REWARD_OWNER_ENDPOINT, {
		cardAddress: card,
		data,
		deadline,
		nonce,
		ownerSignature,
		extra: {
			ruleId: params.ruleId.toString(),
			active: params.active ? 1 : 0,
			eventKind: params.eventKind,
			targetKind: params.targetKind,
			issuedParentId: params.issuedParentId.toString(),
			actorMint13: params.active ? params.actorMint13.toString() : '0',
			refMint13: params.active ? params.refMint13.toString() : '0',
		},
	})
}

async function configureRuleSlot(params: {
	cardAddress: string
	ownerPrivateKey?: string
	ruleId: bigint
	active: boolean
	eventKind: number
	targetKind: number
	issuedParentId: bigint
	actorMint13: bigint
	refMint13: bigint
}): Promise<{ success: boolean; error?: string }> {
	if (params.ownerPrivateKey?.trim()) {
		return postConfigureRuleOwnerSigned({
			cardAddress: params.cardAddress,
			ownerPrivateKey: params.ownerPrivateKey.trim(),
			ruleId: params.ruleId,
			active: params.active,
			eventKind: params.eventKind,
			targetKind: params.targetKind,
			issuedParentId: params.issuedParentId,
			actorMint13: params.actorMint13,
			refMint13: params.refMint13,
		})
	}
	return postConfigureRuleGateway(params)
}

async function ruleIntentSatisfiedOnChain(
	cardAddress: string,
	intent: SocialPromotionRuleIntent,
): Promise<boolean> {
	const row = await readCardRewardRuleFromChain(cardAddress, intent.ruleId)
	return onChainRuleMatchesIntent(row, intent)
}

async function configureRuleIntentWithRetry(params: {
	cardAddress: string
	ownerPrivateKey?: string
	intent: SocialPromotionRuleIntent
	maxAttempts?: number
}): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
	if (await ruleIntentSatisfiedOnChain(params.cardAddress, params.intent)) {
		return { success: true, skipped: true }
	}

	const maxAttempts = params.maxAttempts ?? RULE_CONFIGURE_MAX_ATTEMPTS
	let lastError: string | undefined

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await configureRuleSlot({
			cardAddress: params.cardAddress,
			ownerPrivateKey: params.ownerPrivateKey,
			ruleId: BigInt(params.intent.ruleId),
			active: params.intent.active,
			eventKind: params.intent.eventKind,
			targetKind: params.intent.targetKind,
			issuedParentId: params.intent.issuedParentId,
			actorMint13: params.intent.actorMint13,
			refMint13: params.intent.refMint13,
		})
		if (!res.success) {
			lastError = res.error ?? `configureEventRewardRule failed for ruleId=${params.intent.ruleId}`
			if (await ruleIntentSatisfiedOnChain(params.cardAddress, params.intent)) {
				return { success: true, skipped: true }
			}
		} else {
			const row = await readCardRewardRuleFromChain(params.cardAddress, params.intent.ruleId)
			if (onChainRuleMatchesIntent(row, params.intent)) return { success: true }
			lastError = `On-chain getRewardRule(${params.intent.ruleId}) did not match intended config (attempt ${attempt}/${maxAttempts})`
		}
		if (attempt < maxAttempts) await sleep(RULE_CONFIGURE_RETRY_DELAY_MS)
	}

	if (await ruleIntentSatisfiedOnChain(params.cardAddress, params.intent)) {
		return { success: true, skipped: true }
	}

	return {
		success: false,
		error: lastError ?? `Failed to configure ruleId=${params.intent.ruleId}`,
	}
}

/**
 * Sync card-level social promotion rules (slots 1 / 2 / 3 — link click, top-up, like).
 * Uses gateway relay (same path as link click reward dispatch) — no card owner/admin signature.
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
	const onChainRules = await readCardLevelSocialPromotionRuleRows(card)
	const intentsToApply = filterIntentsRequiringChainWrite(intents, onChainRules)

	if (intentsToApply.length === 0) {
		return { success: true }
	}

	const failedRuleIds: number[] = []
	const configureErrors = new Map<number, string>()

	const verifyAllIntents = async (): Promise<{ ok: boolean; failedRuleIds: number[] }> => {
		const fresh = await readCardLevelSocialPromotionRuleRows(card)
		return verifySocialPromotionRulesOnChain(card, intents, fresh)
	}

	const ownerKey = params.ownerPrivateKey?.trim()
	if (ownerKey) {
		const batchRes = await postConfigureRulesBatchOwnerSigned({
			cardAddress: card,
			ownerPrivateKey: ownerKey,
			intents: intentsToApply,
		})
		if (batchRes.success) {
			const verify = await verifyAllIntents()
			if (verify.ok) return { success: true }
		} else if (batchRes.error) {
			configureErrors.set(0, batchRes.error)
		}
	} else {
		const batchRes = await postConfigureRulesBatchGateway({ cardAddress: card, intents: intentsToApply })
		if (batchRes.success) {
			const verify = await verifyAllIntents()
			if (verify.ok) return { success: true }
		} else if (batchRes.error) {
			configureErrors.set(0, batchRes.error)
		}
	}

	for (const intent of intentsToApply) {
		const res = await configureRuleIntentWithRetry({
			cardAddress: card,
			ownerPrivateKey: params.ownerPrivateKey,
			intent,
		})
		if (!res.success) {
			failedRuleIds.push(intent.ruleId)
			if (res.error) configureErrors.set(intent.ruleId, res.error)
		}
	}

	if (failedRuleIds.length > 0) {
		for (const ruleId of [...failedRuleIds]) {
			const intent = intentsToApply.find((row) => row.ruleId === ruleId)
			if (!intent) continue
			const retry = await configureRuleIntentWithRetry({
				cardAddress: card,
				ownerPrivateKey: params.ownerPrivateKey,
				intent,
				maxAttempts: RULE_CONFIGURE_MAX_ATTEMPTS,
			})
			if (retry.success) {
				const idx = failedRuleIds.indexOf(ruleId)
				if (idx >= 0) failedRuleIds.splice(idx, 1)
				configureErrors.delete(ruleId)
			} else if (retry.error) {
				configureErrors.set(ruleId, retry.error)
			}
		}
	}

	const verify = await verifyAllIntents()
	if (verify.ok) {
		return { success: true }
	}

	const mergedFailed = [...new Set([...failedRuleIds, ...verify.failedRuleIds])]
	const likeFailed = mergedFailed.includes(SOCIAL_PROMOTION_LIKE_RULE_ID)
	const likeApiError = configureErrors.get(SOCIAL_PROMOTION_LIKE_RULE_ID)
	const primaryError =
		likeFailed && likeApiError
			? likeApiError
			: likeFailed
				? `On-chain reward rule update failed for Like (ruleId=${SOCIAL_PROMOTION_LIKE_RULE_ID}). Try saving again — metadata alone does not activate rewards.`
				: `On-chain reward rule update failed for ruleId(s): ${mergedFailed.join(', ')}. Try saving again.`

	return {
		success: false,
		failedRuleIds: mergedFailed,
		error: primaryError,
	}
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

/**
 * Sync per-coupon social promotion rules — one on-chain slot per event (parallel).
 * Gateway relay — no card owner/admin signature (aligned with link click dispatch).
 */
export async function applyCouponSocialPromotionOnChainRules(params: {
	cardAddress: string
	issuedTokenId: string
	socialPromotion: ShareTokenMetadataCouponSocialPromotion | null
}): Promise<{ success: boolean; error?: string }> {
	const card = ethers.getAddress(params.cardAddress)
	const issuedTokenId = String(params.issuedTokenId).trim()
	if (!issuedTokenId || !/^\d+$/.test(issuedTokenId)) {
		return { success: false, error: 'Issued coupon token id is required for on-chain promotion rules.' }
	}

	await ensureCardCumulativeStatReadyViaGateway(card)

	const issuedParentId = BigInt(issuedTokenId)
	const promo = params.socialPromotion

	for (const eventKey of COUPON_SOCIAL_PROMOTION_EVENT_KEYS) {
		const { actorMint13, refMint13 } = resolveCouponEventPromotion(promo, eventKey)
		const active = Boolean(promo && promo.enabled !== false && (actorMint13 > 0n || refMint13 > 0n))
		const chainParams = couponRuleParams(eventKey, issuedParentId)
		const ruleId = couponSocialPromotionRuleIdForEvent(issuedTokenId, eventKey)
		const res = await configureRuleSlot({
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
