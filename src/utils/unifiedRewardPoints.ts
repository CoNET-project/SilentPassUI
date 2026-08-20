/**
 * Metadata for unified #13 reward points (actor / referrer percents in bps).
 * @see beamio-merchant-card-unified-reward-points-v13.mdc
 */

export const UNIFIED_REWARD_POINTS_BPS_MAX = 10_000

export type UnifiedRewardFlow = {
	enabled?: boolean
	/** 0–10000; 10000 = 100% of top-up / charge. */
	actorPercentBps?: number
	referrerPercentBps?: number
}

export type UnifiedRewardPoints = {
	enabled?: boolean
	topup?: UnifiedRewardFlow
	charge?: UnifiedRewardFlow
	social?: UnifiedRewardFlow
}

export function clampRewardPercentBps(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw)
	if (!Number.isFinite(n)) return 0
	return Math.max(0, Math.min(UNIFIED_REWARD_POINTS_BPS_MAX, Math.round(n)))
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
		o.enabled === true || (o.enabled !== false && actorPercentBps > 0)
	return {
		enabled,
		actorPercentBps,
		...(referrerPercentBps != null ? { referrerPercentBps } : {}),
	}
}

export function parseUnifiedRewardPoints(raw: unknown): UnifiedRewardPoints | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
	const o = raw as Record<string, unknown>
	const topup = parseFlow(o.topup)
	const charge = parseFlow(o.charge)
	const social = parseFlow(o.social)
	const out: UnifiedRewardPoints = {}
	if (typeof o.enabled === 'boolean') out.enabled = o.enabled
	if (topup) out.topup = topup
	if (charge) out.charge = charge
	if (social) out.social = social
	return Object.keys(out).length > 0 ? out : undefined
}

export function parseUnifiedRewardTopupDraft(raw: unknown): {
	enabled: boolean
	percent: string
} {
	const flow = parseUnifiedRewardPoints(raw)?.topup
	const enabled = flow?.enabled === true
	const pct = actorBpsToPercentWhole(flow?.actorPercentBps ?? 0)
	return {
		enabled,
		percent: String(pct > 0 ? pct : 1),
	}
}

/** Merge current top-up actor % into existing unifiedRewardPoints (preserve charge/social). */
export function mergeUnifiedRewardPointsTopup(
	existing: unknown,
	topup: { enabled: boolean; actorPercent: number },
): UnifiedRewardPoints {
	const prev = parseUnifiedRewardPoints(existing) ?? {}
	const actorPercentBps = topup.enabled ? percentWholeToActorBps(topup.actorPercent) : 0
	return {
		...prev,
		topup: {
			...(prev.topup ?? {}),
			enabled: topup.enabled,
			actorPercentBps,
		},
	}
}
