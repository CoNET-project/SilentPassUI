import { IpfsImg } from '@/components/IpfsImg'
import React from 'react'
import { Store, Info } from 'lucide-react'
import { ethers } from 'ethers'
import type { UserCardInfo } from '@/services/BeamioCard'
import type { WalletMerchantPassStackDisplay } from '@/pages/Wallet/walletMerchantPassDisplay'
import { STACK_CARD_H, STACK_STEP_PX } from '@/pages/Wallet/walletMerchantPassStackLayout'
import { CardPassBackgroundImage } from '@/components/card/CardPassBackgroundImage'
import {
	tierLogoIconClassForScale,
	tierLogoImgClassForScale,
} from '@/utils/tierLogoDisplayScale'

type Props = {
	uc: UserCardInfo
	display: WalletMerchantPassStackDisplay
	stackIdx: number
	/** 绝对定位 top（px），避免 Edge 对负 margin 叠卡触发布局重排 */
	topPx: number
	expandOffsetY: number
	isExpanded: boolean
	isStackExpanded: boolean
	stackCount: number
	onToggleExpand: () => void
	onOpenMerchantDetail?: (cardAddress: string) => void
}

/** Pass face chrome aligned with bizSite Programs card preview. */
function PassCardFace({ display }: { display: WalletMerchantPassStackDisplay }) {
	const {
		tierTheme,
		tierGradient,
		title,
		tierLbl,
		balanceLine,
		balanceSubtitle,
		logoUrl,
		backgroundImageUrl,
		backgroundImageFit,
		logoDisplayScale,
		discountHeadline,
		startingFromLine,
	} = display
	const logoImgClass = tierLogoImgClassForScale(logoDisplayScale)
	const logoIconClass = tierLogoIconClassForScale(logoDisplayScale)
	const hasBgImage = Boolean(backgroundImageUrl.trim())

	return (
		<>
			{hasBgImage ? (
				<CardPassBackgroundImage src={backgroundImageUrl} fit={backgroundImageFit} />
			) : null}
			<div
				className="pointer-events-none absolute inset-0 rounded-[1.5rem]"
				style={{
					background: hasBgImage
						? 'linear-gradient(165deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.2) 100%)'
						: tierGradient,
				}}
				aria-hidden
			/>
			{/* Tint only — no backdrop-blur: filter + stacked blur-xl bg causes text subpixel jitter on scroll/repaint */}
			<div className="pointer-events-none absolute inset-0 rounded-[1.5rem] bg-white/5" aria-hidden />
			<div
				className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40"
				style={{
					backgroundColor: tierTheme.isDarkStart ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
				}}
				aria-hidden
			/>
			{/* Own compositor layer so text is not re-rasterized with background blur fills */}
			<div className="relative z-[1] flex h-full w-full flex-col justify-between [transform:translateZ(0)] [-webkit-font-smoothing:antialiased]">
				<div className="flex w-full items-start justify-between gap-3">
					<div className="shrink-0">
						{logoImgClass ? (
							logoUrl ? (
								<IpfsImg
									key={logoUrl}
									src={logoUrl}
									alt=""
									className={`object-contain ${logoImgClass}`}
									draggable={false}
								/>
							) : (
								<Store
									className={logoIconClass ?? undefined}
									strokeWidth={2}
									aria-hidden
									style={{ color: tierTheme.primary }}
								/>
							)
						) : null}
					</div>
					{discountHeadline ? (
						<div className="min-w-0 text-right">
							<p
								className="text-lg font-black leading-tight tracking-tight"
								style={{ color: tierTheme.primary }}
							>
								{discountHeadline}
							</p>
						</div>
					) : (
						<div className="min-w-0" aria-hidden />
					)}
				</div>
				<div className="flex w-full items-end justify-between gap-3">
					<div className="min-w-0">
						<p
							className="max-w-full truncate whitespace-nowrap font-extrabold leading-tight tracking-tight"
							style={{ color: tierTheme.primary, fontSize: '1.125rem' }}
						>
							{title}
						</p>
						{tierLbl ? (
							<p
								className="mt-1 text-[10px] font-bold uppercase tracking-wider"
								style={{ color: tierTheme.primary }}
							>
								{tierLbl}
							</p>
						) : null}
					</div>
					<div className="flex min-h-[4.25rem] shrink-0 flex-col justify-end text-right">
						{startingFromLine ? (
							<p
								className="text-[10px] font-bold uppercase tracking-wider opacity-80"
								style={{ color: tierTheme.tertiary }}
							>
								{startingFromLine}
							</p>
						) : null}
						<p
							className={`text-[10px] font-bold tracking-widest ${startingFromLine ? 'mt-1' : ''}`}
							style={{ color: tierTheme.tertiary }}
						>
							BALANCE
						</p>
						<p
							className="text-base font-bold tabular-nums leading-tight"
							style={{ color: tierTheme.primary, minWidth: '4.5rem' }}
						>
							{balanceLine}
						</p>
						{balanceSubtitle ? (
							<p
								className="text-[11px] font-semibold tabular-nums"
								style={{ color: tierTheme.secondary }}
							>
								{balanceSubtitle}
							</p>
						) : (
							<p className="h-[1.125rem]" aria-hidden />
						)}
					</div>
				</div>
			</div>
		</>
	)
}

function WalletMerchantPassStackCardInner({
	uc,
	display,
	stackIdx,
	topPx,
	expandOffsetY,
	isExpanded,
	isStackExpanded,
	stackCount,
	onToggleExpand,
	onOpenMerchantDetail,
}: Props) {
	const { tierTheme, title } = display
	const zIndex = isExpanded ? 100 + stackCount : stackIdx + 1
	const top = topPx + expandOffsetY
	const isFrontmost = stackIdx === stackCount - 1
	const canExpandPeek = !isStackExpanded && !isFrontmost
	const canCollapse = isStackExpanded && isExpanded
	const peekHitHeight = STACK_STEP_PX
	const cardAddress = uc.cardAddress?.trim() ?? ''
	const canOpenMerchantDetail =
		Boolean(onOpenMerchantDetail) && cardAddress.length > 0 && ethers.isAddress(cardAddress)
	const showMerchantDetailControl =
		canOpenMerchantDetail && (isExpanded || (isFrontmost && !isStackExpanded))

	const cardShellStyle: React.CSSProperties = {
		top,
		zIndex,
		height: STACK_CARD_H,
		borderColor: tierTheme.cardBorder,
		color: tierTheme.primary,
		transition: 'top 300ms ease-out, box-shadow 300ms ease-out',
		boxShadow: isExpanded
			? '0 12px 40px rgba(0,0,0,0.22)'
			: isStackExpanded
				? '0 -4px 16px rgba(0,0,0,0.08)'
				: '0 -8px 24px rgba(0,0,0,0.12)',
	}

	return (
		<>
			<div
				className="stack-card pointer-events-none absolute left-0 right-0 flex flex-col overflow-hidden rounded-[1.5rem] border border-white/10 p-4 text-left text-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)] sm:p-5"
				style={cardShellStyle}
				aria-hidden
			>
				<PassCardFace display={display} />
			</div>

			{showMerchantDetailControl ? (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						onOpenMerchantDetail?.(ethers.getAddress(cardAddress))
					}}
					className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white/90 backdrop-blur-sm transition active:scale-[0.96] hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
					style={{
						top: top + 12,
						right: 12,
						zIndex: zIndex + 2,
						transition: 'top 300ms ease-out',
					}}
					aria-label={`View ${title} merchant details`}
				>
					<Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
				</button>
			) : null}

			{canExpandPeek ? (
				<button
					type="button"
					onClick={onToggleExpand}
					aria-expanded={false}
					aria-label={`Expand ${title} pass`}
					className="absolute left-0 right-0 cursor-pointer rounded-t-[1.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1562f0]"
					style={{
						top,
						zIndex: zIndex + 1,
						height: peekHitHeight,
						transition: 'top 300ms ease-out',
					}}
				/>
			) : null}

			{canCollapse ? (
				<button
					type="button"
					onClick={onToggleExpand}
					aria-expanded
					aria-label={`Collapse ${title} pass`}
					className="absolute left-0 right-0 cursor-pointer rounded-[1.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1562f0]"
					style={{
						top,
						zIndex: zIndex + 1,
						height: STACK_CARD_H,
						transition: 'top 300ms ease-out',
					}}
				/>
			) : null}

			{!isStackExpanded && isFrontmost ? (
				<div
					className="absolute left-0 right-0"
					style={{
						top,
						zIndex: zIndex + 1,
						height: STACK_CARD_H,
						pointerEvents: 'auto',
						transition: 'top 300ms ease-out',
					}}
					aria-hidden
				/>
			) : null}
		</>
	)
}

export const WalletMerchantPassStackCard = React.memo(
	WalletMerchantPassStackCardInner,
	(prev, next) =>
		prev.uc.cardAddress === next.uc.cardAddress &&
		prev.stackIdx === next.stackIdx &&
		prev.topPx === next.topPx &&
		prev.expandOffsetY === next.expandOffsetY &&
		prev.isExpanded === next.isExpanded &&
		prev.isStackExpanded === next.isStackExpanded &&
		prev.stackCount === next.stackCount &&
		prev.onOpenMerchantDetail === next.onOpenMerchantDetail &&
		prev.display.sig === next.display.sig
)
