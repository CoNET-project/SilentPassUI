import { IpfsImg } from '@/components/IpfsImg';
/**
 * Shared My Brands list body — used by full page route and slide-over drawer.
 */

import React, { useCallback, useMemo } from 'react'
import { useObjectImgSrc } from '@/components/card/useObjectImgSrc'
import { useNavigate } from 'react-router-dom'
import { CreditCard, ExternalLink } from 'lucide-react'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { isCardExcludedFromDisplay } from '@/services/BeamioCard'
import BeamioBaseScanNftCapsule from '@/components/BeamioBaseScanNftCapsule'
import { ActiveCouponTicketItem, type ActiveCouponListItem } from '@/pages/Home/ActiveCouponsScreen'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import baseIcon from '@/components/assets/base-logo.png'
import conetIcon from '@/components/Home/assets/conet-token.svg'
import { beamioConetMainnetTxExplorerUrl } from '@/utils/beamioUserCardChain'
import {
	resolveMyBrandSecondarySubtitle,
	resolveMyBrandsOwnedCatalogDisplays,
	resolveMyBrandsOwnedCouponDisplays,
	type MyBrandsOwnedCatalogSnapshot,
} from '@/utils/myBrandsFeedState'
import { ownedCatalogGlobalCategoryLabel } from '@/utils/myBrandsOwnedCatalog'
import { resolveMyBrandMerchantCategoryLabel } from '@/utils/discoverMerchantCategory'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { fiatPrefix } from '@/services/currency'
import type { UserCardInfo } from '@/services/BeamioCard'
import { tu } from '@/locale/beamioLocale'

export function resolveCardImageUrl(url: string | undefined): string | undefined {
	if (!url?.trim()) return undefined
	const u = url.trim()
	if (/^ipfs:\/\//i.test(u)) return `https://ipfs.io/ipfs/${u.replace(/^ipfs:\/\//i, '')}`
	return u
}

/** Merchant program icon — metadata `icon` preferred; legacy issuance uses `image`. */
export function resolveMyBrandCardIconUrl(
	meta: { icon?: string; image?: string } | null | undefined
): string | undefined {
	const icon = resolveCardImageUrl(meta?.icon)
	if (icon) return icon
	return resolveCardImageUrl(meta?.image)
}

function merchantInitialLetter(title: string): string {
	const trimmed = title.trim()
	if (!trimmed) return 'M'
	return trimmed.charAt(0).toUpperCase()
}

export function MyBrandMerchantIcon({
	title,
	iconUrl,
	className = '',
	sizeClassName = 'h-12 w-12 rounded-xl',
	letterClassName = 'text-lg font-bold text-[#1562f0] dark:text-[#6ba3ff]',
}: {
	title: string
	iconUrl?: string
	className?: string
	sizeClassName?: string
	letterClassName?: string
}) {
	const resolved = resolveCardImageUrl(iconUrl)
	const displaySrc = useObjectImgSrc(resolved)
	const letter = merchantInitialLetter(title)
	const showImage = Boolean(resolved && displaySrc)
	return (
		<div
			className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-[#c3c6d8]/25 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900 ${sizeClassName} ${className}`}
		>
			{!showImage ? (
				<span
					className={`absolute inset-0 flex items-center justify-center ${letterClassName}`}
					aria-hidden
				>
					{letter}
				</span>
			) : null}
			{resolved ? (
				<img
					src={displaySrc || undefined}
					alt={title}
					className={`relative z-[1] h-full w-full object-cover ${showImage ? 'opacity-100' : 'opacity-0'}`}
					draggable={false}
				/>
			) : null}
		</div>
	)
}

export function formatMyBrandBalanceLine(
	detail: MyBrandCardDetailLike | undefined,
	fallbackCurrency: string
): string {
	if (detail === undefined) return '…'
	const assets = detail.assets
	if (assets == null) return '—'
	const ptsRaw = assets.points
	if (ptsRaw == null || String(ptsRaw).trim() === '') return '—'
	const ptsNum = Number(ptsRaw)
	if (!Number.isFinite(ptsNum)) return '—'
	const currency = (assets.cardCurrency ?? fallbackCurrency ?? 'CAD').toUpperCase()
	const prefix = fiatPrefix(currency as ICurrency) || currency
	const amount = ptsNum.toLocaleString('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	})
	return `${prefix} ${amount}`
}

export function MyBrandCardRow({
	cardAddress,
	title,
	detail,
	currencyFallback = 'CAD',
}: {
	cardAddress: string
	title: string
	detail: MyBrandCardDetailLike | undefined
	currencyFallback?: string
}) {
	const tierPres = resolveHeldTierPresentation(detail)
	const iconUrl = resolveMyBrandCardIconUrl(detail?.meta)
	const categorySubtitle = resolveMyBrandMerchantCategoryLabel(detail, title)
	const balanceLine = formatMyBrandBalanceLine(detail, currencyFallback)
	const secondary = resolveMyBrandSecondarySubtitle(detail)

	return (
		<div
			className="flex w-full items-center gap-4 rounded-lg border-l-[3px] border-transparent p-3 text-left"
			style={tierPres.accentColor ? { borderLeftColor: tierPres.accentColor } : undefined}
		>
			<MyBrandMerchantIcon title={title} iconUrl={iconUrl} />
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<p className="min-w-0 truncate text-sm font-bold text-[#191c1d] dark:text-slate-100">{title}</p>
					{cardAddress ? (
						<BeamioBaseScanNftCapsule cardAddress={cardAddress} pointsBalance className="!py-0.5" />
					) : null}
				</div>
				<p className="mt-0.5 text-[11px] leading-tight text-[#424655] dark:text-slate-400">
					{categorySubtitle}
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
							<span className="rounded-full border border-[#1562f0]/20 bg-[#1562f0]/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1562f0] dark:border-[#6ba3ff]/30 dark:bg-[#6ba3ff]/10 dark:text-[#8db8ff]">
								{tierPres.discountLabel}
							</span>
						) : null}
					</div>
				) : null}
			</div>
			<div className="shrink-0 text-right">
				<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{balanceLine}</p>
				<p
					className={`text-[10px] font-medium ${
						secondary.tone === 'reward'
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-[#424655] dark:text-slate-500'
					}`}
				>
					{secondary.text}
				</p>
			</div>
		</div>
	)
}

/** My Brands 列表排序 — 与 `/myBrands` 页一致（按商户名）。 */
export function sortMyBrandCardsForList(cards: UserCardInfo[]): UserCardInfo[] {
	return [...cards].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en'))
}

function mapOwnedCatalogToTicketItem(item: MyBrandsOwnedCatalogSnapshot): ActiveCouponListItem {
	return {
		id: item.id,
		cardAddress: item.cardAddress,
		tokenId: item.tokenId,
		couponId: item.productionId,
		title: item.title,
		subtitle: item.subtitle,
		iconUrl: item.iconUrl,
		backgroundImage: item.backgroundImage,
		backgroundColorHex: item.backgroundColorHex,
		validBeforeSec: item.validBeforeSec,
	}
}

/** My Brands 列表项：商户卡行 → owned 优惠券 ticket → owned Global Category 目录资产 ticket。 */
export function MyBrandListEntries({
	cards,
	details,
}: {
	cards: UserCardInfo[]
	details: Record<string, MyBrandCardDetailLike | undefined>
}) {
	const punchBgClassName = 'bg-[#f3f4f5] dark:bg-slate-800'
	const { profiles } = useDaemonContext()
	const navigate = useNavigate()
	const getPrivateKeyArmor = useCallback(
		(): string | undefined => resolveSigningPrivateKeyArmor(profiles?.[0]) || undefined,
		[profiles],
	)

	const allCoupons: ActiveCouponListItem[] = []
	const seenCouponIds = new Set<string>()
	for (const uc of cards) {
		const detail = details[uc.cardAddress.toLowerCase()]
		const ownedCoupons = resolveMyBrandsOwnedCouponDisplays(
			uc.cardAddress,
			detail?.claimableCoupons
		) as ActiveCouponListItem[]
		for (const ownedCoupon of ownedCoupons) {
			const key =
				ownedCoupon.id ||
				`${ownedCoupon.cardAddress.toLowerCase()}:${ownedCoupon.tokenId || ownedCoupon.couponId}`
			if (seenCouponIds.has(key)) continue
			seenCouponIds.add(key)
			allCoupons.push(ownedCoupon)
		}
	}

	const allCatalogs: Array<{ item: ActiveCouponListItem; categoryLabel: string }> = []
	const seenCatalogIds = new Set<string>()
	for (const uc of cards) {
		const detail = details[uc.cardAddress.toLowerCase()]
		const ownedCatalogs = resolveMyBrandsOwnedCatalogDisplays(uc.cardAddress, detail?.ownedCatalogs)
		for (const ownedCatalog of ownedCatalogs) {
			const key =
				ownedCatalog.id ||
				`${ownedCatalog.cardAddress.toLowerCase()}:${ownedCatalog.tokenId || ownedCatalog.productionId}`
			if (seenCatalogIds.has(key)) continue
			seenCatalogIds.add(key)
			allCatalogs.push({
				item: mapOwnedCatalogToTicketItem(ownedCatalog),
				categoryLabel: ownedCatalogGlobalCategoryLabel(ownedCatalog.globalCategory),
			})
		}
	}

	return (
		<>
			{cards.map((uc) => {
				const addrKey = uc.cardAddress.toLowerCase()
				const detail = details[addrKey]
				const title =
					(detail?.meta?.name && detail.meta.name.trim()) || uc.name || tu('merchant_card')
				return (
					<MyBrandCardRow
						key={uc.cardAddress}
						cardAddress={uc.cardAddress}
						title={title}
						detail={detail}
						currencyFallback={uc.currency ?? 'CAD'}
					/>
				)
			})}
			{allCoupons.map((ownedCoupon) => (
				<ActiveCouponTicketItem
					key={ownedCoupon.id}
					row={ownedCoupon}
					actionLabel={tu('owned')}
					disabled
					showOpenClaimShareButton
					showUserLike
					getPrivateKeyArmor={getPrivateKeyArmor}
					onWalletUnlock={() => navigate('/settings')}
					metadataBelowBackgroundImage
					aria-label={`Owned coupon ${ownedCoupon.title}`}
					punchBgClassName={punchBgClassName}
				/>
			))}
			{allCatalogs.map(({ item, categoryLabel }) => (
				<ActiveCouponTicketItem
					key={item.id}
					row={item}
					actionLabel={categoryLabel}
					disabled
					metadataBelowBackgroundImage
					aria-label={`Owned ${categoryLabel.toLowerCase()} ${item.title}`}
					punchBgClassName={punchBgClassName}
				/>
			))}
		</>
	)
}

function shortMyBrandCardAddress(address: string): string {
	const trimmed = address.trim()
	if (trimmed.length < 12) return trimmed
	return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function shortBaseScanTxHash(txHash: string): string {
	const trimmed = txHash.trim()
	if (trimmed.length < 12) return trimmed
	return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

/** Recent Activity tx hash capsule — BaseScan or CoNET mainnet explorer. */
export function RecentActivityTxHashCapsule({
	txHash,
	className = '',
	explorerChain = 'base',
}: {
	txHash: string
	className?: string
	/** Merchant program card top-up/charge uses CoNET L1 (`mainnet.conet.network`). */
	explorerChain?: 'base' | 'conet'
}) {
	const normalized = String(txHash ?? '').trim()
	if (!normalized || !/^0x[0-9a-fA-F]{40,64}$/i.test(normalized)) return null
	const explorerLabel = explorerChain === 'conet' ? 'CoNET' : 'BaseScan'
	const openExplorer = () => {
		openExternalUrl(
			explorerChain === 'conet'
				? beamioConetMainnetTxExplorerUrl(normalized)
				: `https://basescan.org/tx/${normalized}`,
		)
	}
	return (
		<button
			type="button"
			onClick={openExplorer}
			className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[#c3c6d8]/40 bg-white/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#424655] transition hover:border-[#1562f0]/35 hover:bg-[#1562f0]/5 hover:text-[#1562f0] dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-[#6ba3ff]/40 dark:hover:bg-[#6ba3ff]/10 dark:hover:text-[#8db8ff] ${className}`}
			aria-label={`View transaction on ${explorerLabel}: ${normalized}`}
		>
			<IpfsImg
				src={explorerChain === 'conet' ? conetIcon : baseIcon}
				alt={explorerChain === 'conet' ? 'CoNET' : 'Base'}
				className="h-3.5 w-3.5 shrink-0 rounded-full object-contain"
			/>
			<span className="truncate">{shortBaseScanTxHash(normalized)}</span>
			<ExternalLink className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
		</button>
	)
}

/** BeamioUserCard 合约地址胶囊：Base 图标 + 短地址，点击打开 BaseScan。 */
export function MyBrandCardAddressCapsule({
	address,
	className = '',
}: {
	address: string
	className?: string
}) {
	const normalized = (() => {
		const raw = String(address ?? '').trim()
		try {
			return ethers.isAddress(raw) ? ethers.getAddress(raw) : raw
		} catch {
			return raw
		}
	})()
	const openBaseScan = () => {
		openExternalUrl(`https://basescan.org/address/${normalized}`)
	}
	return (
		<button
			type="button"
			onClick={openBaseScan}
			className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[#c3c6d8]/40 bg-white/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#424655] transition hover:border-[#1562f0]/35 hover:bg-[#1562f0]/5 hover:text-[#1562f0] dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-[#6ba3ff]/40 dark:hover:bg-[#6ba3ff]/10 dark:hover:text-[#8db8ff] ${className}`}
			aria-label={`View contract on BaseScan: ${normalized}`}
		>
			<IpfsImg src={baseIcon} alt="Base" className="h-3.5 w-3.5 shrink-0 rounded-full object-contain" />
			<span className="truncate">{shortMyBrandCardAddress(normalized)}</span>
			<ExternalLink className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
		</button>
	)
}

/** 与 Home / Drawer 列表一致的最小 detail 形状（所持 Pass 对应 tier 的 metadata 颜色与 discount） */
export type MyBrandTierMetaRow = {
	index?: number
	name?: string
	minUsdc6?: string
	description?: string
	backgroundColor?: string
	background_color?: string
	/** Pass face background image (TierMetadata.image) */
	image?: string
	backgroundImage?: string
	imageFit?: 'width' | 'height' | string
	logoDisplayScale?: string | number
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
		icon?: string
		image?: string
		tiers?: MyBrandTierMetaRow[]
		bonusRule?: MyBrandBonusRuleRow | null
		bonusRules?: MyBrandBonusRuleRow[] | null
		categoryId?: string | null
		programDescription?: string
	} | null
	assets?: {
		points?: string
		chargeRewardPoints?: string
		cardCurrency?: string
		nfts?: Array<{ tokenId: string; tier?: string; isExpired?: boolean }>
	} | null
		claimableCoupons?: {
			count: number
			firstTitle?: string
			firstCoupon?: ActiveCouponListItem | null
			coupons?: ActiveCouponListItem[]
		} | null
	ownedCatalogs?: {
		count: number
		firstTitle?: string
		firstCatalog?: MyBrandsOwnedCatalogSnapshot | null
		catalogs?: MyBrandsOwnedCatalogSnapshot[]
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

function resolveTierBackgroundImageUrl(row: MyBrandTierMetaRow | undefined): string | undefined {
	if (!row) return undefined
	return resolveCardImageUrl(row.image) ?? resolveCardImageUrl(row.backgroundImage)
}

function resolveTierBackgroundImageFit(row: MyBrandTierMetaRow | undefined): 'width' | 'height' {
	return row?.imageFit === 'height' ? 'height' : 'width'
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
	backgroundImageUrl: string | undefined
	backgroundImageFit: 'width' | 'height'
	logoDisplayScale: string | undefined
	minUsdc6: string | undefined
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
			backgroundImageUrl: undefined,
			backgroundImageFit: 'width',
			logoDisplayScale: undefined,
			minUsdc6: undefined,
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
	if (bestIdx != null && resolveTierRowByIndex(tiers, bestIdx)) {
		chosen = resolveTierRowByIndex(tiers, bestIdx)!
		const nm = chosen.name?.trim()
		tierName = nm || `Tier ${bestIdx + 1}`
	} else {
		chosen = tiers.find((t) => t.name?.trim()) ?? tiers[0]
		const nm = chosen?.name?.trim()
		tierName = nm || ''
	}

	const rec = tierRowAsRecord(chosen)
	/**
	 * Pass / wallet chrome must use the displayed tier's backgroundColor even without a
	 * matched membership NFT. Otherwise gradient falls back to default blue (#1562f0)
	 * while biz preview correctly shows Base tier pink/etc.
	 */
	const accentColor =
		normalizeTierCssColor(chosen?.backgroundColor) ?? normalizeTierCssColor(chosen?.background_color)
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
	const logoScaleRaw =
		chosen?.logoDisplayScale ??
		(rec?.logoDisplayScale as string | number | undefined) ??
		(rec?.properties && typeof rec.properties === 'object' && !Array.isArray(rec.properties)
			? (rec.properties as Record<string, unknown>).logoDisplayScale
			: undefined)
	return {
		tierName,
		accentColor,
		discountLabel: discountLabel ?? discountFromNft,
		bonusPill: bonusPresentation?.pill ?? null,
		backgroundImageUrl: resolveTierBackgroundImageUrl(chosen),
		backgroundImageFit: resolveTierBackgroundImageFit(chosen),
		logoDisplayScale: logoScaleRaw != null ? String(logoScaleRaw) : undefined,
		minUsdc6: chosen?.minUsdc6 != null ? String(chosen.minUsdc6).trim() : undefined,
	}
}

export function MyBrandsListSection({ onAddNewMerchantCard }: { onAddNewMerchantCard?: () => void } = {}) {
	const navigate = useNavigate()
	const { myBrandCards, myBrandCardDetails } = useDaemonContext()
	const handleAddNewMerchantCard = () => {
		if (onAddNewMerchantCard) {
			onAddNewMerchantCard()
			return
		}
		navigate('/myWallet')
	}

	const sorted = useMemo(
		() => sortMyBrandCardsForList(myBrandCards.filter((c) => !isCardExcludedFromDisplay(c.cardAddress))),
		[myBrandCards]
	)

	return (
		<>
			{sorted.length === 0 ? (
				<div className="rounded-xl border border-slate-200/80 bg-white/80 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
					<p className="text-sm font-medium text-slate-600 dark:text-slate-400">{tu('no_merchant_cards_yet')}</p>
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
					<div className="flex flex-col gap-2 rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
						<MyBrandListEntries cards={sorted} details={myBrandCardDetails} />
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
