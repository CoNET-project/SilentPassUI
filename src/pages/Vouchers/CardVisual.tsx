import { Activity, QrCode } from "lucide-react"
import { motion } from "framer-motion"
import React, { useMemo, useState, useEffect, useRef } from "react"
import { JoinNowPill } from "./assets/JoinNowPill"

const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ")

// 统一会员卡配色（图示 CashTrees 风格）
const CARD_BG = "#2C5535"
const ICON_BG = "#3C6A43"
const ACCENT_GREEN = "#6ED088"
const BADGE_BG = "#224229"
const LABEL_GREY = "#BBBBBB"

function CCSABuySquareButton({ onClick }: { onClick?: () => void }) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation()
				onClick?.()
			}}
			className={cls(
				"h-12 w-12 rounded-[14px]",
				"bg-white/16 backdrop-blur-xl text-[#ffffff]",
				"grid place-items-center",
				"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_16px_28px_rgba(0,0,0,0.22)]",
				"active:scale-[0.99] transition"
			)}
		>
			BUY
		</button>
	)
}

function CCSAHeaderBadge({ merchantName = "CCSA", merchantSubtitle = "CARD", discountBadge }: { merchantName?: string; merchantSubtitle?: string; discountBadge?: string }) {
	return (
		<div className="flex items-start justify-between gap-2 w-full min-w-0">
			<div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
				<div
					className="h-9 w-9 sm:h-11 sm:w-11 rounded-full grid place-items-center shrink-0"
					style={{ backgroundColor: ICON_BG }}
				>
					<Activity className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: ACCENT_GREEN }} strokeWidth={2.5} />
				</div>
				<div className="leading-tight min-w-0">
					<div className="text-[16px] sm:text-[20px] font-bold text-white truncate">{merchantName}</div>
					<div className="text-[12px] sm:text-[14px] font-medium truncate" style={{ color: LABEL_GREY }}>{merchantSubtitle}</div>
				</div>
			</div>
			{discountBadge && (
				<div
					className="shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-[12px] font-bold text-white"
					style={{ backgroundColor: BADGE_BG }}
				>
					{discountBadge}
				</div>
			)}
		</div>
	)
}

function CCSAPriceBlock({ price, currencyPrefix = "CA$" }: { price: number; currencyPrefix?: string }) {
	const numberBoxRef = useRef<HTMLDivElement | null>(null)
	const numberTextRef = useRef<HTMLSpanElement | null>(null)
	const fit = useFitScaleX(numberBoxRef, numberTextRef)
	const numberStr = useMemo(() => price.toFixed(2), [price])
	const BASE_SCALE = 0.8

	return (
		<div className="mt-auto pb-1 origin-left" style={{ transform: `scale(${BASE_SCALE})` }}>
			<div className="text-white/60 text-[14px] tracking-[0.22em] uppercase">PRICE</div>
			<div className="mt-1 flex items-baseline gap-3 min-w-0 overflow-hidden">
				<div ref={numberBoxRef} className="min-w-0 flex-1 overflow-hidden">
					<div className="origin-left" style={{ transform: `scaleX(${fit.scaleX * BASE_SCALE})`, filter: fit.scaleX < 0.92 ? "contrast(1.02)" : undefined }}>
						<span ref={numberTextRef} className="block whitespace-nowrap text-white text-4xl sm:text-5xl md:text-6xl font-bold leading-none tabular-nums">
							{currencyPrefix} {numberStr}
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}

function useFitScaleX(containerRef: React.RefObject<HTMLElement>, contentRef: React.RefObject<HTMLElement>) {
	const [fit, setFit] = useState<{ scaleX: number; ready: boolean }>({ scaleX: 1, ready: false })
	useEffect(() => {
		const container = containerRef.current
		const content = contentRef.current
		if (!container || !content) return
		const compute = () => {
			const cw = Math.max(0, container.clientWidth)
			const sw = Math.max(1, content.scrollWidth)
			const available = Math.max(0, cw - 2)
			const next = available > 0 ? Math.min(1, available / sw) : 1
			setFit(prev => (Math.abs(prev.scaleX - next) < 0.01 && prev.ready ? prev : { scaleX: next, ready: true }))
		}
		compute()
		const ro = new ResizeObserver(() => compute())
		ro.observe(container)
		ro.observe(content)
		if (document?.fonts?.ready) document.fonts.ready.then(() => compute()).catch(() => {})
		return () => ro.disconnect()
	}, [containerRef, contentRef])
	return fit
}

function CCSABalanceRow({ balance, prefix = "$" }: { balance: number; prefix?: string }) {
	const numberBoxRef = useRef<HTMLDivElement | null>(null)
	const numberTextRef = useRef<HTMLSpanElement | null>(null)
	const fit = useFitScaleX(numberBoxRef, numberTextRef)
	const numberStr = useMemo(() => balance.toFixed(2), [balance])

	return (
		<div className="mt-2 sm:mt-3 flex items-baseline gap-2 sm:gap-4 min-w-0 overflow-hidden">
			<div className="shrink-0 font-mono tabular-nums" style={{ fontSize: "clamp(14px, 3.5vw, 20px)", color: LABEL_GREY }}>{prefix}</div>
			<div ref={numberBoxRef} className="min-w-0 flex-1 overflow-hidden">
				<div className="origin-left" style={{ transform: `scaleX(${fit.scaleX})`, filter: fit.scaleX < 0.92 ? "contrast(1.02)" : undefined }}>
					<span ref={numberTextRef} className="block whitespace-nowrap text-4xl sm:text-5xl md:text-6xl font-bold leading-none tabular-nums" style={{ color: ACCENT_GREEN }}>
						{numberStr}
					</span>
				</div>
			</div>
		</div>
	)
}

export default function CCSACardVisual({
	balance,
	hasPass,
	onTopUp,
	onQR,
	onCardClick,
	showBuy,
	onBuy,
	memberNo = "M-000128",
	year = "2026",
	merchantName = "CCSA",
	merchantSubtitle = "CARD",
	discountBadge,
}: {
	balance: number
	hasPass: boolean
	onTopUp?: () => void
	onQR?: () => void
	onCardClick?: () => void
	showBuy: 'join' | 'buy' | 'Member' | ''
	onBuy?: () => void
	memberNo?: string
	year?: string
	merchantName?: string
	merchantSubtitle?: string
	discountBadge?: string
}) {
	return (
		<motion.div
			whileTap={{ scale: 0.985 }}
			onClick={onCardClick}
			className={cls(
				"relative w-full overflow-hidden rounded-[24px] sm:rounded-[28px]",
				"shadow-[0_12px_40px_rgba(0,0,0,0.25)]",
				"cursor-pointer select-none"
			)}
			style={{
				aspectRatio: "1.58 / 1",
				backgroundColor: CARD_BG,
			}}
		>
			<div className="relative z-10 h-full px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 md:px-7 md:pt-6 md:pb-6 flex flex-col min-h-0">
				{/* top row: icon + merchant + badge */}
				{showBuy === 'buy' ? (
					<div className="flex items-start justify-between gap-2">
						<CCSAHeaderBadge merchantName={merchantName} merchantSubtitle={merchantSubtitle} discountBadge={discountBadge} />
						<div className="flex items-center shrink-0">
							<JoinNowPill onClick={onBuy} label="JOIN" />
						</div>
					</div>
				) : showBuy === 'Member' ? (
					<div className="flex items-start justify-between gap-2">
						<CCSAHeaderBadge merchantName={merchantName} merchantSubtitle={merchantSubtitle} discountBadge={discountBadge} />
						<button
							type="button"
							onClick={(e) => { e.stopPropagation(); onQR?.() }}
							className={cls(
								"h-9 w-9 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[18px]",
								"grid place-items-center shrink-0",
								"active:scale-[0.99] transition"
							)}
							style={{ backgroundColor: ICON_BG }}
							aria-label="Show QR"
						>
							<QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-white" strokeWidth={2.2} />
						</button>
					</div>
				) : (
					<div className="flex items-start justify-between gap-2">
						<CCSAHeaderBadge merchantName={merchantName} merchantSubtitle={merchantSubtitle} discountBadge={discountBadge} />
						{hasPass && (
							<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); onBuy?.() }}
									className={cls(
										"h-9 rounded-[14px] px-3 sm:h-11 sm:rounded-[18px] sm:px-6",
										"font-extrabold tracking-wide text-[13px] sm:text-[15px] whitespace-nowrap",
										"active:scale-[0.99] transition"
									)}
									style={{ backgroundColor: ICON_BG, color: "white" }}
								>
									+Top Up
								</button>
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); onQR?.() }}
									className={cls(
										"h-9 w-9 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[18px]",
										"grid place-items-center shrink-0",
										"active:scale-[0.99] transition"
									)}
									style={{ backgroundColor: ICON_BG }}
									aria-label="Show QR"
								>
									<QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-white" strokeWidth={2.2} />
								</button>
							</div>
						)}
					</div>
				)}

				{/* bottom: balance + member no */}
				<div className="mt-auto pb-0.5 sm:pb-1 min-h-0">
					{(balance > 0 && memberNo) ? (
						<>
							<div className="text-[11px] sm:text-[13px] font-semibold tracking-[0.15em] uppercase" style={{ color: LABEL_GREY }}>Balance</div>
							<CCSABalanceRow balance={balance} prefix="$" />
							<div className="mt-3 sm:mt-5 flex items-end justify-between gap-2 min-w-0">
								<div>
									<div className="text-[10px] sm:text-[12px] font-medium uppercase" style={{ color: LABEL_GREY }}>Member No.</div>
									<div className="text-[14px] sm:text-[16px] font-bold text-white font-mono mt-0.5">M-{String(memberNo).replace(/^M-?/, '')}</div>
								</div>
								<div className="text-right font-mono text-[13px] sm:text-[16px] font-bold shrink-0" style={{ color: LABEL_GREY }}>{year}</div>
							</div>
						</>
					) : (
						<CCSAPriceBlock price={100} />
					)}
				</div>
			</div>
		</motion.div>
	)
}
