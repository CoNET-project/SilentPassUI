import { Globe, QrCode } from "lucide-react"
import ccsabackphoto from "./assets/ccsacard.avif"
import { motion } from "framer-motion"
import React, { useMemo, useState, useEffect,useRef } from "react"
import { Plus } from "lucide-react"


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
	  <div className="flex items-center gap-3">
		<div
		  className="h-12 w-12 rounded-full grid place-items-center"
		  style={{
			background: "linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)",
			boxShadow:
			  "0 14px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.38)",
		  }}
		>
		  <Globe className="h-6 w-6 text-white drop-shadow" />
		</div>
  
		<div className="leading-tight">
		  <div className="text-[24px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">
			CCSA
		  </div>
		  <div className="text-[24px] font-black tracking-wide text-[#fff2c6] -mt-1 drop-shadow-sm font-serif">
			CARD
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
	  <div ref={rowRef} className="mt-3 flex items-baseline gap-4 min-w-0 overflow-hidden">
		{/* 左侧固定前缀 */}
		<div
		  className="shrink-0 text-white font-black leading-none font-mono tabular-nums"
		  style={{
			fontSize: "clamp(20px, 4.6vw, 20px)",
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
			  // scaleX 会让看起来“变细”，稍微加粗一点抵消（可选）
			  filter: fit.scaleX < 0.92 ? "contrast(1.02)" : undefined,
			}}
		  >
			<span
			  ref={numberTextRef}
			  className="block whitespace-nowrap text-white font-black leading-none font-mono tabular-nums"
			  style={{
				fontSize: "clamp(28px, 11.8vw, 40px)",
				letterSpacing: "0.02em",
			  }}
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
  showBuy?: boolean
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

      <div className="relative z-10 h-full px-7 pt-6 pb-6 flex flex-col">
        {/* top row */}
        <div className="flex items-start justify-between">
          <CCSAHeaderBadge />

          <div className="flex items-center gap-3">
		  {!hasPass && showBuy ? (
			<CCSABuySquareButton onClick={onBuy} />
		) : null}
            {hasPass ? (
              <CCSAActionPill onClick={onTopUp} icon={<Plus className="h-4 w-4 text-white/92" />}>
                TOP UP
              </CCSAActionPill>
            ) : null}

            <CCSAQRButton onClick={onQR} />
          </div>
        </div>

        {/* balance block */}
        <div className="mt-auto pb-1">
          <div className="text-[#dffcf7]/70 text-[13px] font-black tracking-[0.26em] uppercase">
            BALANCE
          </div>

          <CCSABalanceRow balance={balance} prefix="$CCSA" />

          {/* bottom row */}
          <div className="mt-6 flex items-end justify-between">
            <div className="text-[#dffcf7]/55 text-[12px] font-mono tracking-[0.24em] uppercase">
              MEMBER NO. {memberNo}
            </div>

            <div className="text-white/50 text-[14px] font-mono tracking-[0.28em]">
              {year}
            </div>
          </div>

          {/* {showBuy && !hasPass ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBuy?.()
                }}
                className={cls(
                  "h-11 w-full rounded-[18px]",
                  "bg-white/16 backdrop-blur-xl border border-white/14",
                  "text-white font-extrabold tracking-wide",
                  "shadow-[0_16px_28px_rgba(0,0,0,0.22)]",
                  "active:scale-[0.99] transition"
                )}
              >
                Buy Now
              </button>
            </div>
          ) : null} */}
        </div>
      </div>
    </motion.div>
  )
}
