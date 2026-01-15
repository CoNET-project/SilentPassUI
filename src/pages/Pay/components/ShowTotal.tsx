import React,{useState} from "react"
import { Globe, Info, Percent } from 'lucide-react'

type Props = {
  // 父容器已经格式化好的字符串，例如 "$ 12.34" / "CA$ 9.99"
  subtotal: string
  usdcSubtotals: string // 例如 "1.2345"
  fiatTax?: string // 例如 "$ 0.12"；空字符串或 undefined 则不显示
  fiatTip?: string // 例如 "$ 1.00"；空字符串或 undefined 则不显示

  // Total
  fiatAmount: string // 例如 "$ 13.46"
  usdcAmount: string // 例如 "1.3456"

  // 左侧标题，可选：默认 "Total"
  subtitle?: string
  taxRate: number 
}

export default function ShowTotal({
  subtotal,
  usdcSubtotals,
  fiatTax = "",
  fiatTip = "",
  fiatAmount,
  usdcAmount,
  subtitle = "Total",
  taxRate
}: Props) {
  const showTax = !!fiatTax?.trim()
  const showTip = !!fiatTip?.trim()
	const [showInfo, setShowInfo] = useState(false)
  return (
    <div
      className={[
        "w-full",
        "rounded-[18px]",
        "bg-white/95",
        "backdrop-blur-md",
        "ring-1 ring-black/10 mt-6 mb-6",
        "shadow-[0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(15,23,42,0.06)]",
        "px-5 py-4",
        "grid grid-cols-[1fr_auto]",
        "gap-y-[6px]",
      ].join(" ")}
    >
      {/* ───── Subtotal ───── */}
      <div className="text-[16px] leading-tight font-extrabold text-slate-900">
        Subtotal
      </div>

      <div className="text-right text-[16px] leading-tight font-extrabold text-slate-900 tabular-nums">
        {subtotal}
      </div>

      {/* <div aria-hidden />
      <div className="text-right -mt-[2px] text-[14px] leading-tight text-slate-400 tabular-nums">
        ≈ {usdcSubtotals} USDC
      </div> */}

      {/* ───── Tax (optional) ───── */}
			{taxRate > 0 && (
				<>
					{/* 左列：Tax 文案 + info 按钮（同一格里用 flex） */}
					<div className="flex items-center gap-1 text-[14px] leading-tight text-slate-500">
					<span>Tax {taxRate}%</span>

					<button
						type="button"
						onClick={() => setShowInfo(v => !v)}
						className={[
						"h-7 w-7 rounded-full flex items-center justify-center transition",
						showInfo
							? "text-amber-700 bg-amber-500/15"
							: "text-amber-600 hover:bg-amber-500/10 active:bg-amber-500/20",
						].join(" ")}
						aria-label="Rate info"
						title="Rate info"
					>
						<Info className="h-4 w-4" />
					</button>
					</div>

					{/* 右列：税额右对齐 */}
					<div className="text-right text-[15px] leading-tight text-slate-400 tabular-nums">
					{fiatTax}
					</div>
				</>
		)}

      {/* ───── Tip (optional) ───── */}
      {showTip && (
        <>
          <div className="text-[14px] leading-tight text-slate-500">Tip</div>
          <div className="text-right text-[15px] leading-tight text-slate-400 tabular-nums">
            {fiatTip}
          </div>
        </>
      )}

	  {/* ───── Divider before Total ───── */}
		<div
		className="
			col-span-2
			my-2
			h-px
			bg-gradient-to-r
			from-transparent
			via-slate-300/60
			to-transparent
		"
		aria-hidden
		/>

      <div className="text-[18px] leading-tight font-extrabold text-slate-900">
		{subtitle}
		</div>

		<div
		className="
			text-right
			text-[20px]
			leading-tight
			font-extrabold
			tabular-nums
			text-[#1652f0]   /* ✅ Beamio 品牌色 */
		"
		>
		{fiatAmount}
		</div>

		<div aria-hidden />
		<div className="text-right -mt-[2px] text-[14px] leading-tight text-slate-400 tabular-nums">
		≈ {usdcAmount} USDC
		</div>
		 {showInfo && (
			<div className="mt-2 text-[12px] leading-snug text-amber-700">
			<div>Current preset: {taxRate}%. Auto‑applied by merchant.</div>
			
			</div>
		)}
    </div>
  )
}
