/**
 * Metadata for unified #13 reward points (actor / referrer percents in bps).
 * @see beamio-merchant-card-unified-reward-points-v13.mdc
 */

export const UNIFIED_REWARD_POINTS_BPS_MAX = 10_000

/** Merchant oracle FX spread max (500 bps = 5%). Step: {@link MERCHANT_ORACLE_SPREAD_BPS_STEP}. */
export const MERCHANT_ORACLE_SPREAD_BPS_MAX = 500

/** 0.25% per step (25 bps). */
export const MERCHANT_ORACLE_SPREAD_BPS_STEP = 25

/** On-chain enable flag for #13 convert (ratio > 0). */
export const CONVERT_REWARD13_RATIO_ENABLED_E6 = 1_000_000

export type UnifiedRewardFlow = {
	enabled?: boolean
	/** 0–10000; 10000 = 100% of top-up / charge. */
	actorPercentBps?: number
	referrerPercentBps?: number
}

/** Toggle for atomic #13 → #0 or #13 → Conet-USDC (AA). ratioE6 > 0 enables. */
export type UnifiedReward13ConvertFlow = {
	enabled?: boolean
	/** E6 enable latch (typically 1_000_000 when ON, 0 when OFF). */
	ratioE6?: number
}

export type UnifiedRewardPoints = {
	enabled?: boolean
	topup?: UnifiedRewardFlow
	charge?: UnifiedRewardFlow
	social?: UnifiedRewardFlow
	/** Programs: allow customers to burn #13 for #0 program points. */
	reward13ToPoints?: UnifiedReward13ConvertFlow
	/** Programs: allow customers to burn #13 for Conet-USDC to their AA. */
	reward13ToUsdc?: UnifiedReward13ConvertFlow
	/** 0–500 bps merchant oracle spread (deposit up / withdraw down); 25 bps steps. */
	merchantOracleSpreadBps?: number
}

export function clampRewardPercentBps(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw)
	if (!Number.isFinite(n)) return 0
	return Math.max(0, Math.min(UNIFIED_REWARD_POINTS_BPS_MAX, Math.round(n)))
}

/** Snap to nearest 0.25% (25 bps), then clamp to 0–500. */
export function clampMerchantOracleSpreadBps(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw)
	if (!Number.isFinite(n)) return 0
	const stepped =
		Math.round(Math.max(0, n) / MERCHANT_ORACLE_SPREAD_BPS_STEP) * MERCHANT_ORACLE_SPREAD_BPS_STEP
	return Math.max(0, Math.min(MERCHANT_ORACLE_SPREAD_BPS_MAX, stepped))
}

/** Human percent 0.00–5.00 (0.25 steps) ↔ bps. */
export function merchantOracleSpreadBpsToPercent(bps: number): number {
	return clampMerchantOracleSpreadBps(bps) / 100
}

export function percentToMerchantOracleSpreadBps(percent: number): number {
	const n = typeof percent === 'number' ? percent : Number(percent)
	if (!Number.isFinite(n)) return 0
	return clampMerchantOracleSpreadBps(n * 100)
}

export function percentWholeToActorBps(percent: number): number {
	const whole = Math.max(0, Math.min(100, Math.round(percent)))
	return whole * 100
}

export function actorBpsToPercentWhole(bps: number): number {
	return Math.max(0, Math.min(100, Math.round(clampRewardPercentBps(bps) / 100)))
}

function parseFlow(raw: unknown): UnifiedRewardFlow | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
	const o = raw as Record<string, unknown>
	const actorPercentBps = clampRewardPercentBps(o.actorPercentBps)
	const referrerPercentBps =
		o.referrerPercentBps != null ? clampRewardPercentBps(o.referrerPercentBps) : undefined
	const enabled =
		o.enabled === true ||
		(o.enabled !== false && (actorPercentBps > 0 || (referrerPercentBps != null && referrerPercentBps > 0)))
	return {
		enabled,
		actorPercentBps,
		...(referrerPercentBps != null ? { referrerPercentBps } : {}),
	}
}

function parseConvertFlow(raw: unknown): UnifiedReward13ConvertFlow | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
	const o = raw as Record<string, unknown>
	const ratioRaw = o.ratioE6 != null ? Number(o.ratioE6) : NaN
	const ratioE6 =
		Number.isFinite(ratioRaw) && ratioRaw > 0
			? Math.max(1, Math.min(CONVERT_REWARD13_RATIO_ENABLED_E6, Math.round(ratioRaw)))
			: 0
	const enabled = o.enabled === true || (o.enabled !== false && ratioE6 > 0)
	return { enabled, ratioE6: enabled ? ratioE6 || CONVERT_REWARD13_RATIO_ENABLED_E6 : 0 }
}

export function parseUnifiedRewardPoints(raw: unknown): UnifiedRewardPoints | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
	const o = raw as Record<string, unknown>
	const topup = parseFlow(o.topup)
	const charge = parseFlow(o.charge)
	const social = parseFlow(o.social)
	const reward13ToPoints = parseConvertFlow(o.reward13ToPoints)
	const reward13ToUsdc = parseConvertFlow(o.reward13ToUsdc)
	const spread =
		o.merchantOracleSpreadBps != null ? clampMerchantOracleSpreadBps(o.merchantOracleSpreadBps) : undefined
	const out: UnifiedRewardPoints = {}
	if (typeof o.enabled === 'boolean') out.enabled = o.enabled
	if (topup) out.topup = topup
	if (charge) out.charge = charge
	if (social) out.social = social
	if (reward13ToPoints) out.reward13ToPoints = reward13ToPoints
	if (reward13ToUsdc) out.reward13ToUsdc = reward13ToUsdc
	if (spread != null) out.merchantOracleSpreadBps = spread
	return Object.keys(out).length > 0 ? out : undefined
}

function parseUnifiedRewardFlowDraft(flow: UnifiedRewardFlow | undefined): {
	enabled: boolean
	percent: string
	referrerEnabled: boolean
	referrerPercent: string
} {
	const enabled = flow?.enabled === true && (flow.actorPercentBps ?? 0) > 0
	const pct = actorBpsToPercentWhole(flow?.actorPercentBps ?? 0)
	const refBps = flow?.referrerPercentBps ?? 0
	const referrerEnabled = refBps > 0
	const refPct = actorBpsToPercentWhole(refBps)
	return {
		enabled,
		percent: String(pct > 0 ? pct : 1),
		referrerEnabled,
		referrerPercent: String(refPct > 0 ? refPct : 1),
	}
}

export function parseUnifiedRewardTopupDraft(raw: unknown): {
	enabled: boolean
	percent: string
	referrerEnabled: boolean
	referrerPercent: string
} {
	return parseUnifiedRewardFlowDraft(parseUnifiedRewardPoints(raw)?.topup)
}

export function parseUnifiedRewardChargeDraft(raw: unknown): {
	enabled: boolean
	percent: string
	referrerEnabled: boolean
	referrerPercent: string
} {
	return parseUnifiedRewardFlowDraft(parseUnifiedRewardPoints(raw)?.charge)
}

export function parseReward13ConvertDraft(raw: unknown): {
	toPointsEnabled: boolean
	toUsdcEnabled: boolean
	oracleSpreadBps: number
} {
	const u = parseUnifiedRewardPoints(raw)
	return {
		toPointsEnabled: u?.reward13ToPoints?.enabled === true && (u.reward13ToPoints.ratioE6 ?? 0) > 0,
		toUsdcEnabled: u?.reward13ToUsdc?.enabled === true && (u.reward13ToUsdc.ratioE6 ?? 0) > 0,
		oracleSpreadBps: clampMerchantOracleSpreadBps(u?.merchantOracleSpreadBps ?? 0),
	}
}

/** Merge top-up actor + referrer % into existing unifiedRewardPoints (preserve charge/social). */
export function mergeUnifiedRewardPointsTopup(
	existing: unknown,
	topup: {
		enabled: boolean
		actorPercent: number
		referrerEnabled?: boolean
		referrerPercent?: number
	},
): UnifiedRewardPoints {
	const prev = parseUnifiedRewardPoints(existing) ?? {}
	const actorPercentBps = topup.enabled ? percentWholeToActorBps(topup.actorPercent) : 0
	const referrerEnabled = topup.referrerEnabled === true
	const referrerPercentBps = referrerEnabled
		? percentWholeToActorBps(topup.referrerPercent ?? 0)
		: 0
	return {
		...prev,
		topup: {
			...(prev.topup ?? {}),
			enabled: topup.enabled || referrerEnabled,
			actorPercentBps,
			referrerPercentBps,
		},
	}
}

/** Merge charge actor + referrer % into existing unifiedRewardPoints (preserve topup/social). */
export function mergeUnifiedRewardPointsCharge(
	existing: unknown,
	charge: {
		enabled: boolean
		actorPercent: number
		referrerEnabled?: boolean
		referrerPercent?: number
	},
): UnifiedRewardPoints {
	const prev = parseUnifiedRewardPoints(existing) ?? {}
	const actorPercentBps = charge.enabled ? percentWholeToActorBps(charge.actorPercent) : 0
	const referrerEnabled = charge.referrerEnabled === true
	const referrerPercentBps = referrerEnabled
		? percentWholeToActorBps(charge.referrerPercent ?? 0)
		: 0
	return {
		...prev,
		charge: {
			...(prev.charge ?? {}),
			enabled: charge.enabled || referrerEnabled,
			actorPercentBps,
			referrerPercentBps,
		},
	}
}

/**
 * Merge #13 convert toggles into unifiedRewardPoints.
 * Preserves existing `merchantOracleSpreadBps` unless `oracleSpreadBps` is passed
 * (legacy callers may still pass it; Prefer {@link mergeUnifiedRewardPointsOracleSpread}).
 */
export function mergeUnifiedRewardPointsConvert(
	existing: unknown,
	opts: {
		toPointsEnabled: boolean
		toUsdcEnabled: boolean
		/** @deprecated Prefer mergeUnifiedRewardPointsOracleSpread; when omitted, spread is preserved. */
		oracleSpreadBps?: number
	},
): UnifiedRewardPoints {
	const prev = parseUnifiedRewardPoints(existing) ?? {}
	const next: UnifiedRewardPoints = {
		...prev,
		reward13ToPoints: {
			enabled: opts.toPointsEnabled,
			ratioE6: opts.toPointsEnabled ? CONVERT_REWARD13_RATIO_ENABLED_E6 : 0,
		},
		reward13ToUsdc: {
			enabled: opts.toUsdcEnabled,
			ratioE6: opts.toUsdcEnabled ? CONVERT_REWARD13_RATIO_ENABLED_E6 : 0,
		},
	}
	if (opts.oracleSpreadBps != null) {
		next.merchantOracleSpreadBps = clampMerchantOracleSpreadBps(opts.oracleSpreadBps)
	}
	return next
}

/** Merge merchant-favorable oracle FX spread only (0–500 bps); preserve convert toggles. */
export function mergeUnifiedRewardPointsOracleSpread(
	existing: unknown,
	oracleSpreadBps: number,
): UnifiedRewardPoints {
	const prev = parseUnifiedRewardPoints(existing) ?? {}
	return {
		...prev,
		merchantOracleSpreadBps: clampMerchantOracleSpreadBps(oracleSpreadBps),
	}
}

export function formatReward13ConvertOverviewSummary(draft: {
	toPointsEnabled: boolean
	toUsdcEnabled: boolean
}): string {
	const parts: string[] = []
	if (draft.toPointsEnabled) parts.push('Reward PT → Points ON')
	if (draft.toUsdcEnabled) parts.push('Reward PT → USDC ON')
	return parts.join(' · ')
}

/** Program Basic overview line for merchant oracle FX adjustment. */
export function formatMerchantOracleSpreadOverview(oracleSpreadBps: number): string {
	const bps = clampMerchantOracleSpreadBps(oracleSpreadBps)
	if (bps <= 0) return ''
	const pct = merchantOracleSpreadBpsToPercent(bps).toFixed(2)
	return `FX +${pct}% deposit / −${pct}% withdraw`
}
