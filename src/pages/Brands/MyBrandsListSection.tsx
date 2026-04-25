/**
 * Shared My Brands list body — used by full page route and slide-over drawer.
 */

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Store } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'

export function resolveCardImageUrl(url: string | undefined): string | undefined {
	if (!url?.trim()) return undefined
	const u = url.trim()
	if (/^ipfs:\/\//i.test(u)) return `https://ipfs.io/ipfs/${u.replace(/^ipfs:\/\//i, '')}`
	return u
}

/** 与 Home / Drawer 列表一致的最小 detail 形状（所持 Pass 对应 tier 的 metadata 颜色与 discount） */
export type MyBrandTierMetaRow = {
	index?: number
	name?: string
	minUsdc6?: string
	description?: string
	backgroundColor?: string
	background_color?: string
	discount?: string | number
	discountPercent?: string | number
	discount_pct?: string | number
	discountBps?: string | number
	discount_bps?: string | number
	memberDiscount?: string | number
	tierDescription?: string
	tier_description?: string
}

export type MyBrandCardDetailLike = {
	meta?: {
		name?: string
		image?: string
		tiers?: MyBrandTierMetaRow[]
		bonusRule?: MyBrandBonusRuleRow | null
		bonusRules?: MyBrandBonusRuleRow[] | null
	} | null
	assets?: {
		points?: string
		cardCurrency?: string
		nfts?: Array<{ tokenId: string; tier?: string; isExpired?: boolean }>
	} | null
}

export type MyBrandBonusRuleRow = {
	paymentAmount?: string | number
	bonusValue?: string | number
	bonusProportional?: boolean
}

function normalizeTierCssColor(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined
	const s = raw.trim()
	if (!s) return undefined
	if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s
	if (/^(rgb|hsl)a?\(/i.test(s)) return s
	if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`
	if (/^[0-9a-fA-F]{3}$/.test(s)) return `#${s}`
	return undefined
}

function tierRowAsRecord(row: MyBrandTierMetaRow | undefined): Record<string, unknown> | undefined {
	return row as Record<string, unknown> | undefined
}

function formatPctOffLabel(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return ''
	return `${n % 1 === 0 ? String(n) : n.toFixed(2)}% off`
}

function parsePercentStringToNumber(s: string): number | null {
	const t = s.trim()
	if (!t) return null
	const noPct = t.replace(/\s*%+\s*$/i, '').trim()
	if (/^\d+(\.\d+)?$/.test(noPct)) return Number(noPct)
	const m = t.match(/^(\d+(?:\.\d+)?)\s*%/)
	if (m) return Number(m[1])
	return null
}

/** 从单层 metadata / properties 对象解析折扣（对齐 bizSite TierFormRow：discountPercent 等） */
function discountFromScalarRecord(row: Record<string, unknown>): string | null {
	const bps = row.discountBps ?? row.discount_bps
	if (typeof bps === 'number' && Number.isFinite(bps) && bps > 0) {
		return formatPctOffLabel(bps / 100)
	}
	if (typeof bps === 'string' && /^\d+$/.test(bps.trim())) {
		const n = Number(bps)
		if (n > 0) return formatPctOffLabel(n / 100)
	}
	const pctKeys = [
		'discountPercent',
		'discount_pct',
		'discount',
		'memberDiscount',
		'member_discount',
		'discountRate',
		'discount_rate',
		'storeDiscount',
		'store_discount',
		'autoDiscount',
		'auto_discount',
		'tierDiscount',
		'tier_discount',
	]
	let pctRaw: unknown
	for (const k of pctKeys) {
		const v = row[k]
		if (v !== undefined && v !== null && v !== '') {
			pctRaw = v
			break
		}
	}
	if (typeof pctRaw === 'number' && Number.isFinite(pctRaw) && pctRaw > 0) {
		return formatPctOffLabel(pctRaw)
	}
	if (typeof pctRaw === 'string') {
		const t = pctRaw.trim()
		if (!t) return null
		const n = parsePercentStringToNumber(t)
		if (n != null && n > 0) return formatPctOffLabel(n)
		return t
	}
	return null
}

/**
 * bizSite `buildCardIssuanceTiersPayload` 常把折扣只放进 description（如 "5% discount"），不单独写 discountPercent。
 */
function discountFromDescription(desc: unknown): string | null {
	if (typeof desc !== 'string') return null
	const t = desc.trim()
	if (!t) return null
	const m1 = t.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:discount|off)\b/i)
	if (m1) {
		const n = Number(m1[1])
		if (Number.isFinite(n) && n > 0) return formatPctOffLabel(n)
	}
	const m2 = t.match(/\b(?:save|extra)\s+(\d+(?:\.\d+)?)\s*%/i)
	if (m2) {
		const n = Number(m2[1])
		if (Number.isFinite(n) && n > 0) return formatPctOffLabel(n)
	}
	return null
}

function discountLabelFromTierRow(row: Record<string, unknown> | undefined): string | null {
	if (!row) return null
	const props = row.properties
	if (props && typeof props === 'object' && !Array.isArray(props)) {
		const p = props as Record<string, unknown>
		const fromProps = discountFromScalarRecord(p)
		if (fromProps) return fromProps
		const fromDescP = discountFromDescription(p.description ?? p.tier_description ?? p.tierDescription)
		if (fromDescP) return fromDescP
	}
	const flat = discountFromScalarRecord(row)
	if (flat) return flat
	const descFlat =
		row.description ?? row.tierDescription ?? row.tier_description
	return discountFromDescription(descFlat)
}

function nftContractTierIndex(nft: { tier?: string }): number | null {
	const raw = nft.tier
	if (raw == null || raw === 'Default/Max') return null
	const n = Number(raw)
	return Number.isInteger(n) ? n : null
}

function resolveTierRowByIndex(tiers: MyBrandTierMetaRow[], idx: number): MyBrandTierMetaRow | undefined {
	const byId = tiers.find((t) => t.index !== undefined && Number(t.index) === idx)
	if (byId) return byId
	if (idx >= 0 && idx < tiers.length) return tiers[idx]
	return undefined
}

function parsePositiveBonusRuleAmount(raw: unknown): number | null {
	if (typeof raw === 'number') {
		return Number.isFinite(raw) && raw > 0 ? raw : null
	}
	if (typeof raw === 'string') {
		const n = Number(raw.trim())
		return Number.isFinite(n) && n > 0 ? n : null
	}
	return null
}

function normalizeBonusRule(
	raw: MyBrandBonusRuleRow | null | undefined
): { paymentAmount: number; bonusValue: number; bonusProportional?: boolean } | null {
	if (!raw) return null
	const paymentAmount = parsePositiveBonusRuleAmount(raw.paymentAmount)
	const bonusValue = parsePositiveBonusRuleAmount(raw.bonusValue)
	if (paymentAmount == null || bonusValue == null) return null
	return {
		paymentAmount,
		bonusValue,
		...(typeof raw.bonusProportional === 'boolean' ? { bonusProportional: raw.bonusProportional } : {}),
	}
}

function formatBonusRuleAmount(value: number): string {
	if (!Number.isFinite(value)) return '0'
	return Number.isInteger(value)
		? value.toLocaleString()
		: value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatBonusRuleMoneyPrefixGlue(currencyPrefix: string): string {
	const t = currencyPrefix.trim()
	if (!t) return ' '
	if (/[$€¥]$/.test(t)) return ''
	return ' '
}

function currencyPrefixForCard(currencyRaw: string | undefined): string {
	switch ((currencyRaw ?? '').trim().toUpperCase()) {
		case 'CAD':
			return 'C$'
		case 'USD':
			return '$'
		case 'USDC':
			return 'USDC'
		case 'EUR':
			return '€'
		case 'JPY':
			return '¥'
		case 'CNY':
			return 'CN¥'
		case 'HKD':
			return 'HK$'
		case 'SGD':
			return 'S$'
		case 'TWD':
			return 'NT$'
		default:
			return (currencyRaw ?? 'C$').trim() || 'C$'
	}
}

function formatBonusRuleStartAmount(
	rule: { paymentAmount: number; bonusValue: number; bonusProportional?: boolean },
	currencyPrefix = 'C$'
): string {
	const g = formatBonusRuleMoneyPrefixGlue(currencyPrefix)
	return `Start ${currencyPrefix}${g}${formatBonusRuleAmount(rule.paymentAmount)}`
}

function bonusRuleSidePillText(
	rule: { paymentAmount: number; bonusValue: number; bonusProportional?: boolean },
	moneyPrefix: string
): string {
	const start = formatBonusRuleStartAmount(rule, moneyPrefix)
	if (!rule.bonusProportional) {
		const g = formatBonusRuleMoneyPrefixGlue(moneyPrefix)
		return `${start} · +${moneyPrefix}${g}${formatBonusRuleAmount(rule.bonusValue)} Bonus`
	}
	const pct = (rule.bonusValue / rule.paymentAmount) * 100
	return `${start} · ${formatBonusRuleAmount(pct)}% Bonus`
}

function resolvePrimaryBonusRule(
	meta: MyBrandCardDetailLike['meta'],
	cardCurrency: string | undefined
): { pill: string } | null {
	if (!meta) return null
	const primary =
		normalizeBonusRule(meta.bonusRules?.[0] ?? null) ?? normalizeBonusRule(meta.bonusRule ?? null)
	if (!primary) return null
	const moneyPrefix = currencyPrefixForCard(cardCurrency)
	return {
		pill: bonusRuleSidePillText(primary, moneyPrefix),
	}
}

/**
 * 根据当前持有的未过期 Pass，选取链上语义一致的 tier（minUsdc6 最大可解析档），取该档 metadata 的 backgroundColor 与 discount 类字段。
 * 无 Pass 或无 tiers 时回退到首个命名 tier / 首档，便于展示卡默认档位样式。
 */
export function resolveHeldTierPresentation(detail: unknown): {
	tierName: string
	accentColor: string | undefined
	discountLabel: string | null
	bonusPill: string | null
} {
	const meta = (detail as MyBrandCardDetailLike | null | undefined)?.meta
	const assets = (detail as MyBrandCardDetailLike | null | undefined)?.assets
	const tiers = (meta?.tiers ?? []) as MyBrandTierMetaRow[]
	const bonusPresentation = resolvePrimaryBonusRule(meta, assets?.cardCurrency)
	if (!tiers.length) {
		return {
			tierName: '',
			accentColor: undefined,
			discountLabel: null,
			bonusPill: bonusPresentation?.pill ?? null,
		}
	}

	const passes = assets?.nfts?.filter((n) => Number(n.tokenId) > 0 && !n.isExpired) ?? []
	let bestMin = -1n
	let bestIdx: number | null = null
	for (const n of passes) {
		const idx = nftContractTierIndex(n)
		if (idx == null) continue
		const row = resolveTierRowByIndex(tiers, idx)
		if (!row) continue
		const minS = row.minUsdc6 != null ? String(row.minUsdc6).trim() : '0'
		let minBi = 0n
		try {
			const head = minS.split(/[.\s]/)[0] ?? '0'
			minBi = BigInt(head || '0')
		} catch {
			minBi = 0n
		}
		if (minBi > bestMin) {
			bestMin = minBi
			bestIdx = idx
		}
	}

	let chosen: MyBrandTierMetaRow | undefined
	let tierName: string
	let heldMatched = false
	if (bestIdx != null && resolveTierRowByIndex(tiers, bestIdx)) {
		chosen = resolveTierRowByIndex(tiers, bestIdx)!
		heldMatched = true
		const nm = chosen.name?.trim()
		tierName = nm || `Tier ${bestIdx + 1}`
	} else {
		chosen = tiers.find((t) => t.name?.trim()) ?? tiers[0]
		const nm = chosen?.name?.trim()
		tierName = nm || ''
	}

	const rec = tierRowAsRecord(chosen)
	const accentColor = heldMatched
		? normalizeTierCssColor(chosen?.backgroundColor) ?? normalizeTierCssColor(chosen?.background_color)
		: undefined
	/** 折扣与副标题 tier 同源：取自当前选中的 `chosen` 档 metadata（含仅有卡级 tiers、无 Pass 时的首档展示） */
	const discountLabel = discountLabelFromTierRow(rec)
	const detailExtras = detail as MyBrandCardDetailLike & {
		nftMetadata?: Record<string, unknown>
		primaryMemberTier?: Record<string, unknown>
	}
	const discountFromNft =
		!discountLabel && detailExtras?.nftMetadata
			? discountLabelFromTierRow(detailExtras.nftMetadata)
			: null
	return {
		tierName,
		accentColor,
		discountLabel: discountLabel ?? discountFromNft,
		bonusPill: bonusPresentation?.pill ?? null,
	}
}

export function MyBrandsListSection({ onAddNewMerchantCard }: { onAddNewMerchantCard?: () => void } = {}) {
	const navigate = useNavigate()
	const { myBrandCards, myBrandCardDetails, myBrandsFeedLoading } = useDaemonContext()
	const handleAddNewMerchantCard = () => {
		if (onAddNewMerchantCard) {
			onAddNewMerchantCard()
			return
		}
		navigate('/myWallet')
	}

	const sorted = useMemo(
		() => [...myBrandCards].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en')),
		[myBrandCards]
	)

	return (
		<>
			{myBrandsFeedLoading && sorted.length === 0 ? (
				<div className="flex flex-col rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
					<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
						<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
						<div className="flex-1 space-y-2">
							<div className="h-3.5 w-28 rounded bg-white/80 dark:bg-slate-700" />
							<div className="h-3 w-36 rounded bg-white/60 dark:bg-slate-600" />
						</div>
						<div className="h-10 w-20 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
					</div>
					<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
						<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
						<div className="flex-1 space-y-2">
							<div className="h-3.5 w-32 rounded bg-white/80 dark:bg-slate-700" />
							<div className="h-3 w-28 rounded bg-white/60 dark:bg-slate-600" />
						</div>
						<div className="h-10 w-20 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
					</div>
				</div>
			) : sorted.length === 0 ? (
				<div className="rounded-xl border border-slate-200/80 bg-white/80 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
					<p className="text-sm font-medium text-slate-600 dark:text-slate-400">No merchant cards yet.</p>
					<button
						type="button"
						onClick={handleAddNewMerchantCard}
						className="mt-4 text-sm font-semibold text-[#004bc3] dark:text-[#6ba3ff]"
					>
						Add a card in Wallet
					</button>
				</div>
			) : (
				<>
					<div className="flex flex-col rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
						{sorted.map((uc) => {
							const addrKey = uc.cardAddress.toLowerCase()
							const detail = myBrandCardDetails[addrKey]
							const title =
								(detail?.meta?.name && detail.meta.name.trim()) || uc.name || 'Merchant card'
							const tierPres = resolveHeldTierPresentation(detail)
							const subtitleFallback = `${uc.currency} merchant card`
							const subtitle = tierPres.tierName.trim() || subtitleFallback
							const imgUrl = resolveCardImageUrl(detail?.meta?.image)
							const assets = detail?.assets ?? null
							const ptsRaw = assets?.points
							const ptsNum =
								ptsRaw != null && String(ptsRaw).trim() !== ''
									? Number(ptsRaw)
									: NaN
							const cardGlobalCurrency = (
								assets?.cardCurrency ?? uc.currency ?? 'CAD'
							).toUpperCase()
							const pointsLine =
								detail === undefined
									? '…'
									: assets == null
										? '—'
										: Number.isFinite(ptsNum)
											? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
											: '—'
							const activePasses =
								assets?.nfts?.filter((n) => Number(n.tokenId) > 0 && !n.isExpired).length ?? 0
							const passLine =
								detail === undefined
									? '…'
									: activePasses > 0
										? `${activePasses} active Pass${activePasses !== 1 ? 'es' : ''}`
										: 'No active Passes'
							return (
								<div
									key={uc.cardAddress}
									className="flex w-full items-center gap-4 rounded-lg border-l-[3px] border-transparent p-3 text-left"
									style={
										tierPres.accentColor
											? { borderLeftColor: tierPres.accentColor }
											: undefined
									}
								>
									<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#c3c6d8]/25 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
										{imgUrl ? (
											<img
												src={imgUrl}
												alt={title}
												className="h-full w-full object-cover"
												draggable={false}
											/>
										) : (
											<Store size={22} className="text-[#1562f0] dark:text-[#6ba3ff]" aria-hidden />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{title}</p>
										<p
											className="text-[11px] leading-tight text-[#424655] dark:text-slate-400"
											style={
												tierPres.accentColor
													? { color: tierPres.accentColor }
													: undefined
											}
										>
											{subtitle}
										</p>
										{tierPres.bonusPill || tierPres.discountLabel ? (
											<div className="mt-1 flex flex-wrap items-center gap-1.5">
												{tierPres.bonusPill ? (
													<span
														className="rounded-full border border-[#1562f0]/20 bg-[#1562f0]/5 px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#1562f0] dark:border-[#6ba3ff]/30 dark:bg-[#6ba3ff]/10 dark:text-[#8db8ff]"
														style={
															tierPres.accentColor
																? { color: tierPres.accentColor, borderColor: tierPres.accentColor }
																: undefined
														}
													>
														{tierPres.bonusPill}
													</span>
												) : null}
												{tierPres.discountLabel ? (
													<span
														className="rounded-full border border-[#1562f0]/20 bg-[#1562f0]/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1562f0] dark:border-[#6ba3ff]/30 dark:bg-[#6ba3ff]/10 dark:text-[#8db8ff]"
													>
														{tierPres.discountLabel}
													</span>
												) : null}
											</div>
										) : null}
									</div>
									<div className="shrink-0 text-right">
										<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{pointsLine}</p>
										<p
											className={
												activePasses > 0
													? 'text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
													: 'text-[10px] font-medium text-[#424655] dark:text-slate-500'
											}
										>
											{passLine}
										</p>
									</div>
								</div>
							)
						})}
					</div>
					<button
						type="button"
						onClick={handleAddNewMerchantCard}
						className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 py-6 text-slate-500 transition-all hover:border-[#1562f0] hover:bg-white/60 hover:text-[#1562f0] dark:border-slate-600 dark:text-slate-400 dark:hover:border-[#6ba3ff] dark:hover:bg-slate-900/60 dark:hover:text-[#6ba3ff]"
					>
						<CreditCard className="h-5 w-5" />
						<span className="font-bold">+ Add New Merchant Card</span>
					</button>
				</>
			)}
		</>
	)
}
