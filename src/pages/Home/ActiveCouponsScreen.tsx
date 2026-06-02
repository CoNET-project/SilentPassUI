import { IpfsImg } from '@/components/IpfsImg';
import { useObjectImgSrc } from '@/components/card/useObjectImgSrc'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Calendar, Copy, Gift, Loader2, RefreshCw } from 'lucide-react'
import { ethers } from 'ethers'
import BeamioBaseScanNftCapsule from '@/components/BeamioBaseScanNftCapsule'
import CouponOpenClaimShareButton from '@/components/CouponOpenClaimShareButton'
import { beamioBaseScanNftUrl } from '@/utils/beamioBaseScanNft'
import { Toast } from 'antd-mobile'
import {
	type CardActiveIssuedCouponSeriesItem,
	fetchCardActiveIssuedCouponSeriesTrusted,
	fetchRedeemBundleTokenIdsFromChain,
	readCouponRequiresRedeemCode,
	fetchOngoingClaimableCouponSeries,
	postCardCouponOpenClaimWithCurrentWallet,
} from '@/services/BeamioCard'

/** Align `cardCouponOpenClaimPreCheck` / issued NFT series tokenId floor. */
const ISSUED_NFT_START_ID_MEMBER = 100_000_000_000n

export type ActiveCouponListItem = {
	id: string
	cardAddress: string
	tokenId: string
	couponId: string
	title: string
	subtitle: string
	iconUrl: string
	backgroundImage: string
	backgroundColorHex: string
	validBeforeSec: number | null
}

type ActiveCouponsScreenProps = {
	onBack: () => void
	onManualEntry: () => void
	getPrivateKeyArmor: () => string | undefined
	onClaimSuccess?: () => void
}

type FetchState = 'loading' | 'idle' | 'error'
type ClaimButtonStatus = 'idle' | 'loading' | 'success' | 'error'

/** POS `ReadBalanceCouponsSection` `ClaimCouponButton` — orange→red gradient + white gift icon. */
const POS_CLAIM_GRADIENT =
	'linear-gradient(to bottom right, rgb(255,132,36), rgb(255,71,87))'

const asRecord = (v: unknown): Record<string, unknown> | null =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : null

const readString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const readMetadataCouponId = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const root = readString(meta.couponId)
	if (root) return root
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return readString(beamioCoupon?.couponId)
}

const readMetadataTitle = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readString(meta.title) ||
		readString(meta.name) ||
		readString(beamioCoupon?.title) ||
		readString(beamioCoupon?.name)
	)
}

const readMetadataSubtitle = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readString(meta.subtitle) ||
		readString(meta.description) ||
		readString(beamioCoupon?.subtitle) ||
		readString(beamioCoupon?.description)
	)
}

const readMetadataIconUrl = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	const shareTokenMetadata = asRecord(props?.shareTokenMetadata)
	const imageObj = asRecord(meta.image)
	return (
		readString(meta.iconUrl) ||
		readString(meta.icon) ||
		readString(meta.logoUrl) ||
		readString(meta.logo) ||
		readString(beamioCoupon?.iconUrl) ||
		readString(beamioCoupon?.icon) ||
		readString(beamioCoupon?.logoUrl) ||
		readString(beamioCoupon?.logo) ||
		readString(shareTokenMetadata?.logoUrl) ||
		readString(shareTokenMetadata?.logo) ||
		readString(imageObj?.url) ||
		readString(meta.image)
	)
}

/** Wide ticket banner — biz publishes `couponImage` (see biz `cardIssuanceCouponEditorLivePreview.banner`). */
const COUPON_BACKGROUND_IMAGE_KEYS = [
	'couponImage',
	'background',
	'backgroundImage',
	'backgroundImageUrl',
	'cover',
	'coverImage',
] as const

const readMetadataStringFromKeys = (src: Record<string, unknown> | null, keys: readonly string[]): string => {
	if (!src) return ''
	for (const key of keys) {
		const v = readString(src[key])
		if (v) return v
	}
	return ''
}

const readMetadataBackgroundImage = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readMetadataStringFromKeys(meta, COUPON_BACKGROUND_IMAGE_KEYS) ||
		readMetadataStringFromKeys(beamioCoupon, COUPON_BACKGROUND_IMAGE_KEYS)
	)
}

const COUPON_BACKGROUND_COLOR_KEYS = [
	'backgroundColor',
	'bgColor',
	'color',
	'backgroundColorHex',
	'background_color',
] as const

const readMetadataBackgroundColor = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	const c =
		readMetadataStringFromKeys(meta, COUPON_BACKGROUND_COLOR_KEYS) ||
		readMetadataStringFromKeys(beamioCoupon, COUPON_BACKGROUND_COLOR_KEYS)
	if (!c) return ''
	return c.startsWith('#') ? c : `#${c}`
}

const formatAddressCapsuleShort = (address: string): string => {
	const trimmed = address.trim()
	if (trimmed.length < 10) return trimmed
	return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function CouponCardAddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const fullAddress = address.trim()
	const short = formatAddressCapsuleShort(fullAddress)

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!fullAddress || fullAddress.length < 10) return
			try {
				await navigator.clipboard.writeText(fullAddress)
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			} catch {
				// ignore
			}
		},
		[fullAddress]
	)

	if (!fullAddress || !ethers.isAddress(fullAddress)) return null

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-1 pl-2.5 pr-2 font-mono text-[10px] font-semibold text-white/80 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
			title="Copy address"
			aria-label={`Copy card address ${short}`}
		>
			<span className="truncate">{short}</span>
			{copied ? (
				<Check className="h-3 w-3 shrink-0 text-emerald-400" strokeWidth={2.4} aria-hidden />
			) : (
				<Copy className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2.2} aria-hidden />
			)}
		</button>
	)
}

export const formatCouponExpiryPill = (validBeforeSec: number | null): string => {
	if (!Number.isFinite(validBeforeSec ?? NaN) || (validBeforeSec ?? 0) <= 0) return 'VALID NOW'
	const now = Math.floor(Date.now() / 1000)
	if ((validBeforeSec ?? 0) <= now) return 'EXPIRED'
	const delta = (validBeforeSec ?? now) - now
	if (delta >= 86_400) return `EXPIRES IN ${Math.ceil(delta / 86_400)}D`
	if (delta >= 3_600) return `EXPIRES IN ${Math.ceil(delta / 3_600)}H`
	return `EXPIRES IN ${Math.max(1, Math.ceil(delta / 60))}M`
}

/** Hide non-actionable open-ended status pills on coupon ticket UI. */
export const shouldShowCouponExpiryPill = (expiresLabel: string): boolean => {
	const normalized = expiresLabel.trim().toUpperCase()
	if (!normalized) return false
	return normalized !== 'VALID NOW' && normalized !== 'NO EXPIRY'
}

/** Same urgency rule as biz `cardIssuanceCouponEditorLivePreview` (hours / expired → red Clock + solid bg). */
export const couponExpiryUsesUrgentVariant = (expiresLabel: string): boolean =>
	expiresLabel === 'EXPIRED' || /\bEXPIRES IN \d+H\b|\bEXPIRES IN \d+M\b/.test(expiresLabel)

export function mapActiveCouponRow(cardAddress: string, row: CardActiveIssuedCouponSeriesItem): ActiveCouponListItem | null {
	const meta = asRecord(row.metadata)
	const couponId = readMetadataCouponId(meta)
	if (!couponId) return null
	const validBeforeNum = Number(row.issuedNftValidBefore ?? 0)
	return {
		id: `${cardAddress.toLowerCase()}:${row.tokenId}`,
		cardAddress,
		tokenId: String(row.tokenId),
		couponId,
		title: readMetadataTitle(meta) || 'Coupon',
		subtitle: readMetadataSubtitle(meta) || 'Gift voucher',
		iconUrl: readMetadataIconUrl(meta),
		backgroundImage: readMetadataBackgroundImage(meta),
		backgroundColorHex: readMetadataBackgroundColor(meta),
		validBeforeSec: Number.isFinite(validBeforeNum) && validBeforeNum > 0 ? validBeforeNum : null,
	}
}

/** Trusted coupon row for deep-link claim preview. `undefined` = fetch untrusted; `null` = not found. */
export async function resolveActiveCouponListItemByCouponId(
	cardAddress: string,
	couponId: string,
): Promise<ActiveCouponListItem | null | undefined> {
	const cardNorm = cardAddress?.trim() ?? ''
	const wanted = couponId?.trim() ?? ''
	if (!cardNorm || !wanted || !ethers.isAddress(cardNorm)) return null
	const rows = await fetchCardActiveIssuedCouponSeriesTrusted(ethers.getAddress(cardNorm), 50)
	if (rows === null) return undefined
	for (const row of rows) {
		const mapped = mapActiveCouponRow(ethers.getAddress(cardNorm), row)
		if (mapped && mapped.couponId === wanted) return mapped
	}
	return null
}

export function buildFallbackActiveCouponListItem(cardAddress: string, couponId: string): ActiveCouponListItem {
	const cardNorm = ethers.isAddress(cardAddress) ? ethers.getAddress(cardAddress) : cardAddress
	return {
		id: `${cardNorm.toLowerCase()}:${couponId}`,
		cardAddress: cardNorm,
		tokenId: '',
		couponId,
		title: 'Coupon',
		subtitle: 'Gift voucher',
		iconUrl: '',
		backgroundImage: '',
		backgroundColorHex: '',
		validBeforeSec: null,
	}
}

/** Trusted coupon row for redeem-code deep links. `undefined` = fetch untrusted; `null` = not found. */
export async function resolveActiveCouponListItemByRedeemCode(
	cardAddress: string,
	redeemCode: string,
): Promise<ActiveCouponListItem | null | undefined> {
	const cardNorm = cardAddress?.trim() ?? ''
	const code = redeemCode?.trim() ?? ''
	if (!cardNorm || !code || !ethers.isAddress(cardNorm)) return null
	const checksum = ethers.getAddress(cardNorm)
	const rows = await fetchCardActiveIssuedCouponSeriesTrusted(checksum, 50)
	if (rows === null) return undefined

	const bundleTokenIds = await fetchRedeemBundleTokenIdsFromChain(checksum, code)
	if (bundleTokenIds === null) return undefined

	for (const rawId of bundleTokenIds) {
		let tid: bigint
		try {
			tid = BigInt(rawId)
		} catch {
			continue
		}
		if (tid < ISSUED_NFT_START_ID_MEMBER) continue
		for (const row of rows) {
			if (String(row.tokenId) !== String(rawId)) continue
			return mapActiveCouponRow(checksum, row)
		}
	}

	const redeemRequiredRows = rows.filter((row) => readCouponRequiresRedeemCode(row.metadata ?? null))
	if (redeemRequiredRows.length === 1) {
		return mapActiveCouponRow(checksum, redeemRequiredRows[0]!)
	}

	return null
}

export function buildFallbackActiveCouponListItemForRedeem(
	cardAddress: string,
	redeemCode: string,
): ActiveCouponListItem {
	const cardNorm = ethers.isAddress(cardAddress) ? ethers.getAddress(cardAddress) : cardAddress
	return {
		id: `${cardNorm.toLowerCase()}:redeem:${redeemCode.trim()}`,
		cardAddress: cardNorm,
		tokenId: '',
		couponId: '',
		title: 'Program reward',
		subtitle: 'Redeem code',
		iconUrl: '',
		backgroundImage: '',
		backgroundColorHex: '',
		validBeforeSec: null,
	}
}

function CouponBannerImage({ src }: { src: string }) {
	const displaySrc = useObjectImgSrc(src)
	if (!displaySrc) return null

	return (
		<div className="absolute inset-0 overflow-hidden">
			<div
				className="absolute inset-y-0 left-0 w-1/2 scale-110 bg-cover bg-left bg-no-repeat blur-xl"
				style={{ backgroundImage: `url("${displaySrc}")` }}
				aria-hidden
			/>
			<div
				className="absolute inset-y-0 right-0 w-1/2 scale-110 bg-cover bg-right bg-no-repeat blur-xl"
				style={{ backgroundImage: `url("${displaySrc}")` }}
				aria-hidden
			/>
			<img
				src={displaySrc}
				alt=""
				className="absolute left-1/2 top-0 z-[1] h-full w-auto max-w-none -translate-x-1/2 object-contain"
				draggable={false}
			/>
		</div>
	)
}

export function ActiveCouponTicketItem({
	row,
	actionStatus = 'idle',
	actionError,
	onAction,
	actionLabel = 'Claim',
	disabled = false,
	ariaLabel,
	punchBgClassName = 'bg-[#f9f9fe]',
	showCardAddress = false,
	showActionButton = true,
	/** My Brands owned coupon — show Open Claim Distribution share icon beside NFT capsule. */
	showOpenClaimShareButton = false,
	/** biz Coupon preview parity: banner ticket shows icon only; title/subtitle/expiry below. */
	metadataBelowBackgroundImage = false,
}: {
	row: ActiveCouponListItem
	actionStatus?: ClaimButtonStatus
	actionError?: string
	onAction?: () => void
	actionLabel?: string
	disabled?: boolean
	ariaLabel?: string
	punchBgClassName?: string
	showCardAddress?: boolean
	showActionButton?: boolean
	showOpenClaimShareButton?: boolean
	metadataBelowBackgroundImage?: boolean
}) {
	const expires = formatCouponExpiryPill(row.validBeforeSec)
	const showExpiryPill = shouldShowCouponExpiryPill(expires)
	const expiryUrgent = couponExpiryUsesUrgentVariant(expires)
	const isLoading = actionStatus === 'loading'
	const actionDisabled = disabled || actionStatus !== 'idle' || !onAction
	const innerExpiryBgStyle = expiryUrgent
		? 'bg-red-600 text-white shadow-sm shadow-red-900/25'
		: 'border border-white/25 bg-slate-950/65 text-white shadow-sm shadow-black/20 backdrop-blur-md'
	const externalExpiryBgStyle = expiryUrgent
		? 'bg-red-600 text-white shadow-sm shadow-red-900/25'
		: 'border border-[#abadaf]/35 bg-[#eef1f3] text-[#595c5e] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
	const ExpiryIcon = expiryUrgent ? Clock : Calendar
	const interactive = Boolean(onAction)
	const hasBanner = Boolean(row.backgroundImage?.trim())
	const copyBelowBanner = metadataBelowBackgroundImage && hasBanner
	const title = row.title.trim()
	const subtitle = row.subtitle.trim()
	const iconUrl = hasBanner ? '' : row.iconUrl.trim()
	const showBaseScanNftLink = beamioBaseScanNftUrl(row.cardAddress, row.tokenId) != null

	const renderSubtitleWithBaseScan = (subtitleClassName: string, marginTopClass = 'mt-0.5') => {
		if (!subtitle && !showBaseScanNftLink && !showOpenClaimShareButton) return null
		return (
			<div
				className={`inline-flex max-w-full flex-wrap items-center gap-2 ${marginTopClass}`.trim()}
			>
				{subtitle ? (
					<p className={`min-w-0 truncate font-manrope font-semibold ${subtitleClassName}`}>
						{subtitle}
					</p>
				) : null}
				{showBaseScanNftLink ? (
					<BeamioBaseScanNftCapsule
						cardAddress={row.cardAddress}
						tokenId={row.tokenId}
						className="shrink-0"
					/>
				) : null}
				{showOpenClaimShareButton && row.couponId ? (
					<CouponOpenClaimShareButton
						cardAddress={row.cardAddress}
						couponId={row.couponId}
						couponTitle={row.title}
						className="shrink-0"
					/>
				) : null}
			</div>
		)
	}

	const renderExpiryPill = (placement: 'inner' | 'external') => {
		const style = placement === 'external' ? externalExpiryBgStyle : innerExpiryBgStyle
		return (
			<div
				className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${style}`}
			>
				{isLoading ? (
					<Loader2 className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2.5} aria-hidden />
				) : (
					<ExpiryIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
				)}
				<span className="truncate">{isLoading ? 'CLAIMING…' : expires}</span>
			</div>
		)
	}

	const usesPosClaimGiftButton = actionLabel === 'Claim'
	const usesOwnedStatusCapsule = actionLabel === 'Owned'
	const claimActionAriaLabel =
		ariaLabel ??
		(actionStatus === 'success'
			? 'Coupon claimed'
			: actionStatus === 'error'
				? actionError ?? 'Coupon action failed'
				: actionLabel)

	const claimButton = showActionButton ? (
		<div className="pointer-events-auto absolute right-6 top-1/2 z-[2] -translate-y-1/2 sm:right-8">
			{usesOwnedStatusCapsule ? (
				<span
					className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-transparent shadow-sm ring-1 ring-emerald-500/15 backdrop-blur-sm dark:border-emerald-400/45 dark:ring-emerald-400/20"
					aria-label={claimActionAriaLabel}
				>
					<Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" strokeWidth={2.4} aria-hidden />
				</span>
			) : usesPosClaimGiftButton && actionStatus === 'success' ? (
				<span
					className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-2.5 py-1.5"
					aria-label={claimActionAriaLabel}
				>
					<Check className="h-4 w-4 text-white" strokeWidth={2.4} aria-hidden />
				</span>
			) : (
				<button
					type="button"
					disabled={actionDisabled}
					onClick={(e) => {
						e.stopPropagation()
						onAction?.()
					}}
					className={
						usesPosClaimGiftButton
							? 'inline-flex items-center justify-center rounded-full px-2.5 py-1.5 transition-opacity active:scale-95 disabled:cursor-not-allowed disabled:opacity-55'
							: 'font-manrope flex h-8 min-w-[4.25rem] max-w-[5.75rem] shrink-0 items-center justify-center gap-1 rounded-full bg-white px-2.5 text-[11px] font-semibold leading-tight text-[#1562f0] shadow-sm transition-all duration-200 hover:bg-[#f2f2f7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:max-w-none sm:px-3 sm:text-[13px]'
					}
					style={usesPosClaimGiftButton ? { background: POS_CLAIM_GRADIENT } : undefined}
					title={actionStatus === 'error' ? actionError : undefined}
					aria-label={claimActionAriaLabel}
				>
					{usesPosClaimGiftButton ? (
						actionStatus === 'loading' ? (
							<Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
						) : actionStatus === 'error' ? (
							<AlertTriangle className="h-4 w-4 text-white" strokeWidth={2.4} aria-hidden />
						) : (
							<Gift className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
						)
					) : actionStatus === 'loading' ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
					) : actionStatus === 'success' ? (
						<Check className="h-4 w-4 text-emerald-500" strokeWidth={2.4} aria-hidden />
					) : actionStatus === 'error' ? (
						<AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={2.4} aria-hidden />
					) : (
						actionLabel
					)}
				</button>
			)}
		</div>
	) : null

	const ticketShell = (
		<div
			role={interactive ? 'button' : undefined}
			tabIndex={interactive ? 0 : undefined}
			onClick={interactive ? onAction : undefined}
			onKeyDown={
				interactive
					? (e) => {
						if (actionDisabled) return
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault()
							onAction?.()
						}
					}
					: undefined
			}
			className="relative w-full rounded-[1.75rem] outline-none transition-opacity active:opacity-[0.98] focus-visible:ring-2 focus-visible:ring-[#1562f0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f9fe]"
			aria-label={ariaLabel}
		>
			<div
				className={`pointer-events-none absolute left-0 top-1/2 z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-none ring-0 outline-none ${punchBgClassName}`}
				aria-hidden
			/>
			<div
				className={`pointer-events-none absolute right-0 top-1/2 z-20 h-9 w-9 translate-x-1/2 -translate-y-1/2 rounded-full shadow-none ring-0 outline-none ${punchBgClassName}`}
				aria-hidden
			/>
			<div className="relative min-h-[7.5rem] overflow-hidden rounded-[1.75rem] shadow-none ring-1 ring-black/[0.08]">
				{hasBanner ? (
					<CouponBannerImage src={row.backgroundImage} />
				) : (
					<>
						<div
							className="absolute inset-0"
							style={{ backgroundColor: row.backgroundColorHex || '#2B2E3A' }}
						/>
						<div
							className="pointer-events-none absolute inset-0 opacity-[0.12]"
							style={{
								backgroundImage:
									'repeating-linear-gradient(-26deg, #fff 0, #fff 1px, transparent 1px, transparent 8px)',
							}}
							aria-hidden
						/>
						<div
							className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30"
							aria-hidden
						/>
					</>
				)}

				<div
					className={[
						'relative z-[1] flex min-h-[7.5rem] items-center gap-3 px-7 py-4 sm:gap-4 sm:px-8 sm:py-5',
						showActionButton ? 'pr-[6.25rem] sm:pr-[6.75rem]' : 'pr-7 sm:pr-8',
					].join(' ')}
				>
					{iconUrl ? (
						<div className="relative flex h-[3.35rem] w-[3.35rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/95 shadow-md ring-2 ring-black/10 sm:h-14 sm:w-14">
							<IpfsImg src={iconUrl} alt="" className="h-full w-full object-cover" draggable={false} />
						</div>
					) : null}

					{!copyBelowBanner ? (
						<div className="font-manrope min-w-0 flex-1 text-white">
							<p className="truncate text-[1.05rem] font-extrabold leading-tight tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-lg">
								{row.title}
							</p>
							{renderSubtitleWithBaseScan(
								'text-sm text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
							)}
							{showCardAddress && row.cardAddress ? (
								<CouponCardAddressCapsule address={row.cardAddress} />
							) : null}
							{showExpiryPill ? <div className="mt-2">{renderExpiryPill('inner')}</div> : null}
						</div>
					) : null}

					{claimButton}
				</div>
			</div>
		</div>
	)

	if (!copyBelowBanner) {
		return ticketShell
	}

	return (
		<div className="relative w-full">
			{ticketShell}
			<div className="mt-3 w-full">
				{title ? (
					<p className="truncate font-manrope text-[1.05rem] font-extrabold leading-tight tracking-tight text-[#2c2f31] dark:text-slate-100 sm:text-lg">
						{title}
					</p>
				) : null}
				{renderSubtitleWithBaseScan(
					'text-sm text-[#595c5e] dark:text-slate-400',
					title ? 'mt-0.5' : ''
				)}
				{showExpiryPill ? (
					<div className={title || subtitle || showBaseScanNftLink || showOpenClaimShareButton ? 'mt-2' : ''}>
						{renderExpiryPill('external')}
					</div>
				) : null}
			</div>
		</div>
	)
}

export default function ActiveCouponsScreen({
	onBack,
	onManualEntry,
	getPrivateKeyArmor,
	onClaimSuccess,
}: ActiveCouponsScreenProps) {
	const [coupons, setCoupons] = useState<ActiveCouponListItem[]>([])
	const [fetchState, setFetchState] = useState<FetchState>('loading')
	const [claimStatusById, setClaimStatusById] = useState<Record<string, ClaimButtonStatus>>({})
	const [claimErrorById, setClaimErrorById] = useState<Record<string, string>>({})
	const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const claimStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
	const couponsRef = useRef<ActiveCouponListItem[]>([])
	couponsRef.current = coupons

	const resolveUserEoa = useCallback((): string | null => {
		const privateKeyArmor = getPrivateKeyArmor()?.trim() ?? ''
		if (!privateKeyArmor) return null
		try {
			return ethers.getAddress(new ethers.Wallet(privateKeyArmor).address)
		} catch {
			return null
		}
	}, [getPrivateKeyArmor])

	const scheduleClaimStatusReset = useCallback((rowId: string) => {
		const prev = claimStatusTimersRef.current.get(rowId)
		if (prev) clearTimeout(prev)
		const timer = setTimeout(() => {
			setClaimStatusById((s) => {
				if (s[rowId] === 'idle') return s
				const next = { ...s }
				delete next[rowId]
				return next
			})
			setClaimErrorById((s) => {
				if (!s[rowId]) return s
				const next = { ...s }
				delete next[rowId]
				return next
			})
			claimStatusTimersRef.current.delete(rowId)
		}, 3000)
		claimStatusTimersRef.current.set(rowId, timer)
	}, [])

	const loadCoupons = useCallback(async (opts?: { isRefresh?: boolean }) => {
		if (opts?.isRefresh) setRefreshStatus('loading')
		else setFetchState('loading')

		const userEOA = resolveUserEoa()
		const rows = await fetchOngoingClaimableCouponSeries(50, userEOA)
		if (rows === null) {
			if (opts?.isRefresh) {
				setRefreshStatus('error')
				if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
				refreshTimerRef.current = setTimeout(() => setRefreshStatus('idle'), 3000)
			} else {
				setFetchState(couponsRef.current.length > 0 ? 'idle' : 'error')
			}
			return
		}

		const merged = new Map<string, ActiveCouponListItem>()
		for (const row of rows) {
			const mapped = mapActiveCouponRow(row.cardAddress, row)
			if (mapped) merged.set(mapped.id, mapped)
		}

		const next = [...merged.values()].sort((a, b) => {
			const av = a.validBeforeSec ?? Number.MAX_SAFE_INTEGER
			const bv = b.validBeforeSec ?? Number.MAX_SAFE_INTEGER
			if (av !== bv) return av - bv
			return a.title.localeCompare(b.title, 'en')
		})

		setCoupons(next)
		setFetchState('idle')
		if (opts?.isRefresh) {
			setRefreshStatus('success')
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
			refreshTimerRef.current = setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [resolveUserEoa])

	useEffect(() => {
		void loadCoupons()
		return () => {
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
			for (const t of claimStatusTimersRef.current.values()) clearTimeout(t)
			claimStatusTimersRef.current.clear()
		}
	}, [loadCoupons])

	const handleRefresh = () => {
		if (refreshStatus !== 'idle') return
		void loadCoupons({ isRefresh: true })
	}

	const handleClaim = async (row: ActiveCouponListItem) => {
		const currentStatus = claimStatusById[row.id] ?? 'idle'
		if (currentStatus !== 'idle') return
		const privateKeyArmor = getPrivateKeyArmor()?.trim() ?? ''
		if (!privateKeyArmor) {
			Toast.show({ content: 'Wallet is not ready yet', position: 'top' })
			return
		}
		const cardAddress = row.cardAddress?.trim() ?? ''
		const couponId = row.couponId?.trim() ?? ''
		const tokenId = row.tokenId?.trim() ?? ''
		if (!cardAddress || !couponId || !tokenId || !ethers.isAddress(cardAddress)) {
			Toast.show({ content: 'Coupon claim parameters are invalid', position: 'top' })
			return
		}
		setClaimStatusById((s) => ({ ...s, [row.id]: 'loading' }))
		setClaimErrorById((s) => {
			if (!s[row.id]) return s
			const next = { ...s }
			delete next[row.id]
			return next
		})
		try {
			const ret = await postCardCouponOpenClaimWithCurrentWallet({
				cardAddress: ethers.getAddress(cardAddress),
				couponId,
				tokenId,
				privateKeyArmor,
			})
			if (ret.success) {
				setClaimStatusById((s) => ({ ...s, [row.id]: 'success' }))
				scheduleClaimStatusReset(row.id)
				setCoupons((prev) => prev.filter((c) => c.id !== row.id))
				onClaimSuccess?.()
			} else {
				setClaimStatusById((s) => ({ ...s, [row.id]: 'error' }))
				setClaimErrorById((s) => ({ ...s, [row.id]: ret.error ?? 'Coupon claim failed' }))
				scheduleClaimStatusReset(row.id)
			}
		} catch {
			setClaimStatusById((s) => ({ ...s, [row.id]: 'error' }))
			setClaimErrorById((s) => ({ ...s, [row.id]: 'Coupon claim failed' }))
			scheduleClaimStatusReset(row.id)
		}
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f9f9fe] font-[Inter,system-ui,sans-serif] text-[#1a1c1f] selection:bg-[#004bc3]/20">
			<header className="fixed left-0 right-0 top-0 z-50 bg-[#f9f9fe]/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-[20px]">
				<div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
					<button
						type="button"
						onClick={onBack}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-transform hover:bg-[#f3f3f8] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/35"
						aria-label="Back"
					>
						<ArrowLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden />
					</button>
					<h1 className="text-lg font-bold tracking-[-0.02em] text-[#1a1c1f]">Active Coupons</h1>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={refreshStatus !== 'idle'}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-transform hover:bg-[#f3f3f8] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/35"
						aria-label="Refresh coupons"
					>
						{refreshStatus === 'loading' ? (
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
						) : refreshStatus === 'success' ? (
							<Check className="h-5 w-5 text-emerald-500" strokeWidth={2.2} aria-hidden />
						) : refreshStatus === 'error' ? (
							<AlertTriangle className="h-5 w-5 text-amber-500" strokeWidth={2.2} aria-hidden />
						) : (
							<RefreshCw className="h-5 w-5" strokeWidth={2.2} aria-hidden />
						)}
					</button>
				</div>
			</header>

			<main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-6 pb-32 pt-24 [@media(max-height:760px)]:gap-5 [@media(max-height:760px)]:pb-28">
				<section className="space-y-2">
					<div className="flex items-center gap-2">
						<Gift className="h-5 w-5 text-[#1562f0]" strokeWidth={2.2} aria-hidden />
						<h2 className="text-2xl font-black tracking-[-0.03em] text-[#1a1c1f]">Ongoing Coupons</h2>
					</div>
					<p className="leading-relaxed text-[#424655]">
						Choose an active coupon below to claim it to your wallet, or enter a gift link manually.
					</p>
				</section>

				<section className="space-y-3">
					<div className="flex items-center justify-between px-1">
						<span className="text-[10px] font-bold uppercase tracking-widest text-[#737687]">Available now</span>
						<span className="rounded-full bg-[#e8e8ed] px-2 py-0.5 text-[10px] font-bold text-[#424655]">
							{coupons.length} COUPON{coupons.length !== 1 ? 'S' : ''}
						</span>
					</div>

					{fetchState === 'loading' && coupons.length === 0 ? (
						<div className="space-y-4">
							<div className="h-[7.5rem] animate-pulse rounded-[1.75rem] bg-[#eef1f3]" />
							<div className="h-[7.5rem] animate-pulse rounded-[1.75rem] bg-[#eef1f3]" />
						</div>
					) : fetchState === 'error' && coupons.length === 0 ? (
						<div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-900">
							Unable to load coupons right now. Pull refresh or try again shortly.
						</div>
					) : coupons.length === 0 ? (
						<div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 text-center text-sm text-[#424655] shadow-sm">
							No active coupons at the moment.
						</div>
					) : (
						<div className="space-y-4">
							{coupons.map((row) => {
								const claimStatus: ClaimButtonStatus = claimStatusById[row.id] ?? 'idle'
								const claimButtonDisabled = claimStatus !== 'idle'

								return (
									<ActiveCouponTicketItem
										key={row.id}
										row={row}
										showCardAddress
										actionStatus={claimStatus}
										actionError={claimErrorById[row.id]}
										disabled={claimButtonDisabled}
										onAction={() => void handleClaim(row)}
										actionLabel="Claim"
										aria-label={`Claim coupon ${row.title}`}
									/>
								)
							})}
						</div>
					)}
				</section>

				<section className="rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-sm">
					<p className="text-sm font-semibold text-[#1a1c1f]">Have a redeem link or QR code?</p>
					<p className="mt-1 text-[13px] leading-relaxed text-[#424655]">
						Gift vouchers with a redeem code can be entered or scanned manually.
					</p>
					<button
						type="button"
						onClick={onManualEntry}
						className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#1562f0]/25 bg-[#1562f0]/8 text-sm font-bold text-[#1562f0] transition-colors hover:bg-[#1562f0]/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/35"
					>
						Enter code or scan QR
						<ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden />
					</button>
				</section>
			</main>
		</div>
	)
}
