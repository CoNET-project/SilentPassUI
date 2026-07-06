/** Social points (#13) exchange on issued coupon metadata — mirror x402sdk/socialExchangeMetadata.ts */

export type SocialExchangeKind = 'coupon' | 'usdc'

export type SocialExchangeConfig = {
	enabled: boolean
	kind: SocialExchangeKind
	pointsCost: number
	usdcReward6: bigint
}

export const REWARD_VOUCHER_TOKEN_ID = 13n

function parsePositiveInt(raw: unknown): number | null {
	if (raw == null || raw === '') return null
	const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
	if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
	return n
}

function normalizeSocialExchangePayload(raw: Record<string, unknown>): SocialExchangeConfig | null {
	const points = parsePositiveInt(raw.pointsCost ?? raw.points_cost ?? raw.points13)
	if (points == null) return null
	const kindRaw = String(raw.kind ?? raw.exchangeKind ?? 'coupon').trim().toLowerCase()
	const kind: SocialExchangeKind = kindRaw === 'usdc' ? 'usdc' : 'coupon'
	let usdcReward6 = 0n
	if (kind === 'usdc') {
		const raw6 = raw.usdcReward6 ?? raw.usdc_reward6 ?? raw.usdcAmount6
		try {
			usdcReward6 = BigInt(String(raw6 ?? '').trim())
			if (usdcReward6 <= 0n) return null
		} catch {
			return null
		}
	}
	if (raw.enabled === false) return null
	return { enabled: true, kind, pointsCost: points, usdcReward6 }
}

export function readSocialExchangeFromMetadata(
	meta: Record<string, unknown> | null | undefined,
): SocialExchangeConfig | null {
	if (!meta) return null
	const direct = meta.socialExchange
	if (direct && typeof direct === 'object') {
		return normalizeSocialExchangePayload(direct as Record<string, unknown>)
	}
	const beamioCoupon = meta.beamioCoupon
	if (beamioCoupon && typeof beamioCoupon === 'object') {
		const nested = (beamioCoupon as Record<string, unknown>).socialExchange
		if (nested && typeof nested === 'object') {
			return normalizeSocialExchangePayload(nested as Record<string, unknown>)
		}
	}
	const props = meta.properties
	if (props && typeof props === 'object') {
		const bc = (props as Record<string, unknown>).beamioCoupon
		if (bc && typeof bc === 'object') {
			const nested = (bc as Record<string, unknown>).socialExchange
			if (nested && typeof nested === 'object') {
				return normalizeSocialExchangePayload(nested as Record<string, unknown>)
			}
		}
	}
	return null
}

export function socialExchangeSummaryLabel(exchange: SocialExchangeConfig): string {
	const pts = exchange.pointsCost
	if (exchange.kind === 'usdc' && exchange.usdcReward6 > 0n) {
		const usdc = (Number(exchange.usdcReward6) / 1_000_000).toFixed(2)
		return `Burn ${pts} social points → $${usdc} CONET-USDC`
	}
	return `Burn ${pts} social points → 1 activity coupon`
}
