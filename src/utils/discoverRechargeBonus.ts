import { fiatPrefix } from '@/services/currency'

type FiatCurrencyCode = Parameters<typeof fiatPrefix>[0]

/** Card issuance `shareTokenMetadata.bonusRules[]` — aligned with biz Programs / iOS `BeamioRechargeBonusRule`. */
export type DiscoverRechargeBonusRule = {
	paymentAmount: number
	bonusValue: number
	bonusProportional: boolean
}

function parsePositiveMoneyField(v: unknown): number | null {
	const x =
		typeof v === 'number'
			? v
			: typeof v === 'string'
				? Number(v.replace(/,/g, '').trim())
				: null
	if (x == null || !Number.isFinite(x) || x <= 0) return null
	return Math.round(x * 100) / 100
}

function parseNonNegativeMoneyField(v: unknown): number | null {
	const x =
		typeof v === 'number'
			? v
			: typeof v === 'string'
				? Number(v.replace(/,/g, '').trim())
				: null
	if (x == null || !Number.isFinite(x) || x < 0) return null
	return Math.round(x * 100) / 100
}

function parseBonusProportionalFlag(d: Record<string, unknown>): boolean {
	for (const k of ['bonusProportional', 'bonusIsProportional', 'percentBased', 'proportionalBonus', 'percentage']) {
		const v = d[k]
		if (v === true) return true
		if (typeof v === 'number' && v !== 0) return true
		if (typeof v === 'string' && (v.trim().toLowerCase() === 'true' || v.trim() === '1')) return true
	}
	return false
}

function parseOneRechargeBonusRule(any: unknown): DiscoverRechargeBonusRule | null {
	if (any == null || typeof any !== 'object') return null
	const d = any as Record<string, unknown>
	const paymentAmount = parsePositiveMoneyField(d.paymentAmount)
	const bonusValue = parseNonNegativeMoneyField(d.bonusValue)
	if (paymentAmount == null || bonusValue == null || bonusValue <= 0) return null
	return {
		paymentAmount,
		bonusValue,
		bonusProportional: parseBonusProportionalFlag(d),
	}
}

function parseRechargeBonusRulesDirect(meta: Record<string, unknown>): DiscoverRechargeBonusRule[] {
	const out: DiscoverRechargeBonusRule[] = []
	const arr = meta.bonusRules
	if (Array.isArray(arr)) {
		for (const x of arr) {
			const r = parseOneRechargeBonusRule(x)
			if (r) out.push(r)
		}
	}
	if (out.length === 0 && meta.bonusRule != null) {
		const r = parseOneRechargeBonusRule(meta.bonusRule)
		if (r) out.push(r)
	}
	return out
}

/** Parse recharge bonus rules from card metadata root or nested `shareTokenMetadata`. */
export function parseDiscoverRechargeBonusRules(meta: Record<string, unknown> | null): DiscoverRechargeBonusRule[] {
	if (!meta) return []
	const direct = parseRechargeBonusRulesDirect(meta)
	if (direct.length > 0) return direct
	const share = meta.shareTokenMetadata
	if (share != null && typeof share === 'object') {
		return parseRechargeBonusRulesDirect(share as Record<string, unknown>)
	}
	if (typeof share === 'string' && share.trim()) {
		try {
			const obj = JSON.parse(share) as Record<string, unknown>
			return parseRechargeBonusRulesDirect(obj)
		} catch {
			return []
		}
	}
	return []
}

export function pickPrimaryDiscoverRechargeBonusRule(
	rules: DiscoverRechargeBonusRule[]
): DiscoverRechargeBonusRule | null {
	return rules[0] ?? null
}

function formatBonusRuleAmount(value: number): string {
	if (!Number.isFinite(value)) return '0'
	return Number.isInteger(value)
		? value.toLocaleString('en-US')
		: value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** biz `formatBonusRuleMoneyPrefixGlue` — tight when prefix ends with $ ¥ €. */
function formatBonusRuleMoneyPrefixGlue(currencyPrefix: string): string {
	const t = currencyPrefix.trim()
	if (!t) return ' '
	if (/[$€¥]$/.test(t)) return ''
	return ' '
}

function moneyPrefixForCurrency(currencyCode: string): string {
	const ccy = (currencyCode || 'CAD').toUpperCase() as FiatCurrencyCode
	return ccy === 'USDC' ? '$' : fiatPrefix(ccy)
}

/** biz `formatBonusRuleDisplayString` — Pay C$100 → Get C$110 / Start C$100 → Get 10% */
export function formatDiscoverRechargeBonusDisplayString(
	rule: DiscoverRechargeBonusRule,
	currencyCode: string
): string {
	const currencyPrefix = moneyPrefixForCurrency(currencyCode)
	const g = formatBonusRuleMoneyPrefixGlue(currencyPrefix)
	if (rule.bonusProportional) {
		const rate = (rule.bonusValue / rule.paymentAmount) * 100
		return `Start ${currencyPrefix}${g}${formatBonusRuleAmount(rule.paymentAmount)} → Get ${formatBonusRuleAmount(rate)}%`
	}
	const totalReceive = Number((rule.paymentAmount + rule.bonusValue).toFixed(2))
	return `Pay ${currencyPrefix}${g}${formatBonusRuleAmount(rule.paymentAmount)} → Get ${currencyPrefix}${g}${formatBonusRuleAmount(totalReceive)}`
}

/** biz `cardIssuanceBonusRuleSidePillText` — hero image bottom-right chip. */
export function formatDiscoverRechargeBonusSidePillText(
	rule: DiscoverRechargeBonusRule,
	currencyCode: string
): string {
	const moneyPrefix = moneyPrefixForCurrency(currencyCode)
	if (!rule.bonusProportional) {
		const g = formatBonusRuleMoneyPrefixGlue(moneyPrefix)
		return `+${moneyPrefix}${g}${formatBonusRuleAmount(rule.bonusValue)} Bonus`
	}
	const pct = (rule.bonusValue / rule.paymentAmount) * 100
	return `${formatBonusRuleAmount(pct)}% of top-up`
}
