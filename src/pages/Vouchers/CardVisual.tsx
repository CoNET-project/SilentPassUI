import { Globe, QrCode } from "lucide-react"
import ccsabackphoto from "./assets/ccsacard.avif"
import { motion } from "framer-motion"
import React, { useMemo, useState, useEffect,useRef } from "react"
import { Plus } from "lucide-react"
import { JoinNowPill } from "./assets/JoinNowPill"
import { fiatPrefix } from "@/services/currency"

const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ")

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
			// ✅ 真·1px 细线（不会被 blur 放大）
			"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_16px_28px_rgba(0,0,0,0.22)]",
			"active:scale-[0.99] transition"
		)}
	  >
		BUY
	  </button>
	)
  }
/**
 * ✅ CCSAWaveBg
 * 文字背后的卡片图案：使用你提示的 coding（ccsabackphoto）
 */
function CCSAWaveBg() {
	return (
	  <>
		<img
		  src={ccsabackphoto}
		  alt="CCSA Card Pattern"
		  className="absolute inset-0 h-full w-full object-cover"
		  draggable={false}
		/>
  
		{/* Readability overlay: 更贴近截图（上部更干净，中部亮，底部略压暗） */}
		<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
  
		{/* inner depth + subtle highlight */}
		<div
		  className="absolute inset-0 pointer-events-none"
		  style={{
			boxShadow:
			  "inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -30px 70px rgba(0,0,0,0.42)",
		  }}
		/>
	  </>
	)
  }
  
function CCSAHeaderBadge() {
	return (
	  <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
		<div
		  className="h-9 w-9 sm:h-12 sm:w-12 rounded-full grid place-items-center shrink-0"
		  style={{
			background: "linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)",
			boxShadow:
			  "0 14px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.38)",
		  }}
		>
		  <Globe className="h-4 w-4 sm:h-6 sm:w-6 text-white drop-shadow" />
		</div>
  
		<div className="leading-tight min-w-0">
		  <div className="text-[18px] sm:text-[24px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif truncate">
			CCSA
		  </div>
		  <div className="text-[18px] sm:text-[24px] font-black tracking-wide text-[#fff2c6] -mt-0.5 sm:-mt-1 drop-shadow-sm font-serif truncate">
			CARD
		  </div>
		</div>
	  </div>
	)
  }

  function CCSAPriceBlock({
	price,
	currencyPrefix = "CA$",
  }: {
	price: number
	currencyPrefix?: string
  }) {
	const numberBoxRef = useRef<HTMLDivElement | null>(null)
	const numberTextRef = useRef<HTMLSpanElement | null>(null)
	const fit = useFitScaleX(numberBoxRef, numberTextRef)
  
	const numberStr = useMemo(() => price.toFixed(2), [price])
  
	// ✅ base 缩小到 80%，并且 clamp 仍会随视口继续缩小
	const BASE_SCALE = 0.8
  
	return (
	  <div className="mt-auto pb-1 origin-left" style={{ transform: `scale(${BASE_SCALE})` }}>
		<div className="text-white/40 text-[14px] tracking-[0.22em] uppercase">
		  PRICE
		</div>
  
		{/* PRICE ROW */}
		<div className="mt-1 flex items-baseline gap-3 min-w-0 overflow-hidden">
		  <div ref={numberBoxRef} className="min-w-0 flex-1 overflow-hidden">
			<div
			  className="origin-left"
			  style={{
				// ✅ 你的 fit.scaleX 继续生效，但乘上 0.8
				transform: `scaleX(${fit.scaleX * BASE_SCALE})`,
				filter: fit.scaleX < 0.92 ? "contrast(1.02)" : undefined,
			  }}
			>
			  <span
				ref={numberTextRef}
				className="block whitespace-nowrap text-white text-4xl sm:text-5xl md:text-6xl font-bold leading-none tabular-nums"
			  >
				{currencyPrefix} {numberStr}
			  </span>
			</div>
		  </div>
		</div>
	  </div>
	)
  }
  
  

// 让内容在容器内永不溢出：只压 X 方向（数字会“变窄”，高度不变）
function useFitScaleX(containerRef: React.RefObject<HTMLElement>, contentRef: React.RefObject<HTMLElement>) {
	const [fit, setFit] = useState<FitResult>({ scaleX: 1, ready: false })
  
	useEffect(() => {
	  const container = containerRef.current
	  const content = contentRef.current
	  if (!container || !content) return
  
	  const compute = () => {
		// 容器可用宽度
		const cw = Math.max(0, container.clientWidth)
  
		// 内容“自然宽度”（不受 transform 影响）
		// scrollWidth 对 inline-block / block 都好用
		const sw = Math.max(1, content.scrollWidth)
  
		// 预留极小的安全边（避免小数点/抗锯齿溢出）
		const padding = 2
		const available = Math.max(0, cw - padding)
  
		// scaleX 只缩小不放大
		const next = available > 0 ? Math.min(1, available / sw) : 1
  
		// 防抖微抖：避免频繁 setState（尤其字体加载/小数点）
		setFit(prev => {
		  const stable = Math.abs(prev.scaleX - next) < 0.01
		  if (stable && prev.ready) return prev
		  return { scaleX: next, ready: true }
		})
	  }
  
	  // 初次 + 字体加载后再算一次
	  compute()
	  const raf = requestAnimationFrame(compute)
  
	  // 监听容器/内容尺寸变化
	  const ro = new ResizeObserver(() => compute())
	  ro.observe(container)
	  ro.observe(content)
  
	  // 字体加载（可选，但很建议）
	  // @ts-ignore
	  if (document?.fonts?.ready) {
		// @ts-ignore
		document.fonts.ready.then(() => compute()).catch(() => {})
	  }
  
	  return () => {
		cancelAnimationFrame(raf)
		ro.disconnect()
	  }
	}, [containerRef, contentRef])
  
	return fit
  }

  function CCSABalanceRow({
	balance,
	prefix = "$CCSA",
  }: {
	balance: number
	prefix?: string
  }) {
	// 外层：这一整行的可用宽度（包含 $CCSA + 数字）
	const rowRef = useRef<HTMLDivElement | null>(null)
  
	// 只压缩“数字”部分（更像你截图：$CCSA 不变，100.00 变窄）
	const numberBoxRef = useRef<HTMLDivElement | null>(null)
	const numberTextRef = useRef<HTMLSpanElement | null>(null)
  
	// 数字盒子的宽度可能受 row 影响，所以这里监听 numberBox（容器）+ numberText（内容）
	const fit = useFitScaleX(numberBoxRef, numberTextRef)
  
	const numberStr = useMemo(() => balance.toFixed(2), [balance])
  
	return (
	  <div ref={rowRef} className="mt-2 sm:mt-3 flex items-baseline gap-2 sm:gap-4 min-w-0 overflow-hidden">
		{/* 左侧固定前缀 */}
		<div
		  className="shrink-0 text-white font-black leading-none font-mono tabular-nums"
		  style={{
			fontSize: "clamp(14px, 3.5vw, 20px)",
			letterSpacing: "-0.01em",
		  }}
		>
		  {prefix}
		</div>
  
		{/* 右侧数字容器：min-w-0 + overflow-hidden */}
		<div ref={numberBoxRef} className="min-w-0 flex-1 overflow-hidden">
		  {/* transform 压缩层：只压 X */}
		  <div
			className="origin-left"
			style={{
			  transform: `scaleX(${fit.scaleX})`,
			  filter: fit.scaleX < 0.92 ? "contrast(1.02)" : undefined,
			}}
		  >
			<span
			  ref={numberTextRef}
			  className="block whitespace-nowrap text-white text-4xl sm:text-5xl md:text-6xl font-bold leading-none tabular-nums"
			>
			  {numberStr}
			</span>
		  </div>
		</div>
	  </div>
	)
  }


  function CCSAQRButton({ onClick }: { onClick?: () => void }) {
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
			// ✅ 真·1px 细线（不会被 blur 放大）
			"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_16px_28px_rgba(0,0,0,0.22)]",
			"active:scale-[0.99] transition"
		)}
	  >
		<QrCode className="h-6 w-6 text-white/90" />
	  </button>
	)
  }


type FitResult = {
	scaleX: number
	ready: boolean
  }

  
/**
 * ✅ 比例微调：更像截图
 * - TOP UP pill：更扁、更宽、字距更大
 * - QR：圆角更大
 * - 顶部 padding / 底部 padding：更像信用卡布局
 * - Balance / $CCSA / number：字号与基线更贴图
 */
function CCSAActionPill({
  onClick,
  children,
  icon,
}: {
  onClick?: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
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
			// ✅ 真·1px 细线（不会被 blur 放大）
			"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_16px_28px_rgba(0,0,0,0.22)]",
			"active:scale-[0.99] transition"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
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
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      onClick={onCardClick}
      className={cls(
        "relative w-full overflow-hidden rounded-[30px]",
        "shadow-[0_28px_70px_rgba(0,0,0,0.18)]",
        "border border-black/[0.06]",
        "cursor-pointer select-none"
      )}
      style={{
        aspectRatio: "1.58 / 1", // ✅ 更像截图的信用卡比例
      }}
    >
      <CCSAWaveBg />

      <div className="relative z-10 h-full px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 md:px-7 md:pt-6 md:pb-6 flex flex-col min-h-0">
        {/* top row */}
		{
			showBuy === 'buy' ? (
				<>
				<div className="flex items-start justify-between gap-2">
					<CCSAHeaderBadge />
					<div className="flex items-center shrink-0">
						<JoinNowPill onClick={onBuy} label="JOIN" />
					</div>
				</div>
				</>
			) : showBuy === 'Member' ? (
				<>
				<div className="flex items-start justify-between gap-2">
					<CCSAHeaderBadge />
					<div className="flex items-center shrink-0">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								onQR?.()
							}}
							className={cls(
								"h-9 w-9 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[18px]",
								"bg-black/20 backdrop-blur-xl border border-white/20",
								"text-white grid place-items-center shrink-0",
								"shadow-[0_16px_28px_rgba(0,0,0,0.12)]",
								"active:scale-[0.99] transition"
							)}
							aria-label="Show QR"
						>
							<QrCode className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
						</button>
					</div>
				</div>
				</>
			) : (
			<div className="flex items-start justify-between gap-2">
				<CCSAHeaderBadge />
				{
					hasPass && (
						<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
					<button
					  type="button"
					  onClick={(e) => {
						e.stopPropagation()
						onBuy?.()
					  }}
					  className={cls(
						"h-9 rounded-[14px] px-3 sm:h-11 sm:rounded-[18px] sm:px-6",
						"bg-black/20 backdrop-blur-xl border border-white/20",
						"text-white font-extrabold tracking-wide text-[13px] sm:text-[15px] whitespace-nowrap",
						"shadow-[0_16px_28px_rgba(0,0,0,0.12)]",
						"active:scale-[0.99] transition"
					  )}
					>
					  +Top Up
					</button>
					<button
					  type="button"
					  onClick={(e) => {
						e.stopPropagation()
						onQR?.()
					  }}
					  className={cls(
						"h-9 w-9 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[18px]",
						"bg-black/20 backdrop-blur-xl border border-white/20",
						"text-white grid place-items-center shrink-0",
						"shadow-[0_16px_28px_rgba(0,0,0,0.12)]",
						"active:scale-[0.99] transition"
					  )}
					  aria-label="Show QR"
					>
					  <QrCode className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
					</button>
				</div>
					)
				}
				
			  </div>
					
			)
		}
        

        {/* balance block */}
		<div className="mt-auto pb-0.5 sm:pb-1 min-h-0">
		{
			(balance > 0  && memberNo ) ? (
				<>
					<div className="text-[#dffcf7]/70 text-[11px] sm:text-[13px] font-black tracking-[0.2em] sm:tracking-[0.26em] uppercase">
						BALANCE
					</div>

					{  <CCSABalanceRow balance={balance} prefix={'CAD'} />}

					{/* bottom row */}
					<div className="mt-3 sm:mt-6 flex items-end justify-between gap-2 min-w-0">
						{/* MEMBER NO */}
						<div className="relative font-mono text-[10px] sm:text-[13px] tracking-[0.2em] sm:tracking-[0.36em] uppercase font-semibold min-w-0 truncate">
							<span className="absolute inset-0 text-black/45 translate-y-[1px] sm:translate-y-[1.5px]">
								MEMBER&nbsp;NO.&nbsp;{memberNo}
							</span>
							<span className="relative text-[#f5fffd] block truncate">
								MEMBER&nbsp;NO.&nbsp;{memberNo}
							</span>
						</div>

						{/* YEAR */}
						<div className="relative font-mono text-[13px] sm:text-[16px] tracking-[0.3em] sm:tracking-[0.45em] font-bold shrink-0">
							<span className="absolute inset-0 text-black/45 translate-y-[1px] sm:translate-y-[1.5px]">
							{year}
							</span>
							<span className="relative text-[#f5fffd]">
							{year}
							</span>
						</div>
					</div>
				</>
			) : (
				<>
				{
					<CCSAPriceBlock price={100}  />
				}
				
				</>
			)
		}
		</div>
        
      </div>
    </motion.div>
  )
}
