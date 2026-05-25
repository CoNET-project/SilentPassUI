import React from 'react'
import { Store, Info, QrCode, ShoppingBasket, type LucideIcon } from 'lucide-react'
import type { UserCardInfo } from '@/services/BeamioCard'
import type { WalletMerchantPassStackDisplay } from '@/pages/Wallet/walletMerchantPassDisplay'
import { STACK_CARD_H, STACK_STEP_PX } from '@/pages/Wallet/walletMerchantPassStackLayout'

const FOOTER_ICONS = [Info, QrCode, ShoppingBasket] as const

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
}

function PassCardFace({
	display,
	stackIdx,
}: {
	display: WalletMerchantPassStackDisplay
	stackIdx: number
}) {
	const FooterIcon: LucideIcon = FOOTER_ICONS[stackIdx % FOOTER_ICONS.length]!
	const { tierTheme, tierGradient, title, tierLbl, balanceLine, balanceSubtitle, imgUrl } = display

	return (
		<>
			<div
				className="absolute inset-0 rounded-[1.5rem]"
				style={{ background: tierGradient }}
				aria-hidden
			/>
			<div className="relative z-10 flex w-full flex-1 flex-col">
				<div className="flex w-full items-start justify-between gap-2">
					<div className="flex min-w-0 items-center gap-3">
						<div
							className="h-9 w-9 shrink-0 overflow-hidden rounded-full border p-1 shadow-sm"
							style={{
								backgroundColor: tierTheme.iconOrbitBg,
								borderColor: tierTheme.iconOrbitBorder,
							}}
						>
							{imgUrl ? (
								<img
									src={imgUrl}
									alt=""
									className="h-full w-full object-contain"
									draggable={false}
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center">
									<Store
										className="h-4 w-4"
										style={{ color: tierTheme.defaultBadgeFg }}
										aria-hidden
									/>
								</div>
							)}
						</div>
						<div className="min-w-0">
							<p className="text-sm font-bold tracking-tight truncate" style={{ color: tierTheme.primary }}>
								{title}
							</p>
							<p className="truncate text-[10px] font-medium" style={{ color: tierTheme.secondary }}>
								{tierLbl}
							</p>
						</div>
					</div>
					<div className="shrink-0 text-right">
						<p className="text-[10px] font-bold tracking-widest" style={{ color: tierTheme.tertiary }}>
							BALANCE
						</p>
						<p
							className="text-lg font-bold tabular-nums"
							style={{ color: tierTheme.primary, minWidth: '4.5rem' }}
						>
							{balanceLine}
						</p>
						{balanceSubtitle ? (
							<p className="text-[11px] font-semibold tabular-nums" style={{ color: tierTheme.secondary }}>
								{balanceSubtitle}
							</p>
						) : null}
					</div>
				</div>
				<div className="mt-auto flex items-end justify-between" style={{ color: tierTheme.accent }}>
					<p className="text-[10px] font-bold uppercase">Pass</p>
					<FooterIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
				</div>
			</div>
		</>
	)
}

function WalletMerchantPassStackCardInner({
	display,
	stackIdx,
	topPx,
	expandOffsetY,
	isExpanded,
	isStackExpanded,
	stackCount,
	onToggleExpand,
}: Props) {
	const { tierTheme, title } = display
	const zIndex = isExpanded ? 100 + stackCount : stackIdx + 1
	const top = topPx + expandOffsetY
	const isFrontmost = stackIdx === stackCount - 1
	const canExpandPeek = !isStackExpanded && !isFrontmost
	const canCollapse = isStackExpanded && isExpanded
	const peekHitHeight = STACK_STEP_PX

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
				className="stack-card pointer-events-none absolute left-0 right-0 flex flex-col overflow-hidden rounded-[1.5rem] border border-white/10 p-5 text-left text-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
				style={cardShellStyle}
				aria-hidden
			>
				<PassCardFace display={display} stackIdx={stackIdx} />
			</div>

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
		prev.display.sig === next.display.sig
)
