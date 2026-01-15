import React from "react"
import { } from '@/services/currency'
type Props = {
  // e.g. "CAD"
  fiatCurrency: string
  // e.g. 0 or "0.00"
  fiatAmount: number | string
  // e.g. 0 or "0.0000"
  usdcAmount: number | string
  // optional: show "≈"
  showApprox?: boolean
  // optional subtitle left
  subtitle?: string
}

const formatFiat2 = (v: number | string) => {
  const n = typeof v === "string" ? Number(v) : v
  if (!isFinite(n)) return "0.00"
  return n.toFixed(2)
}

const formatUsdc4 = (v: number | string) => {
  const n = typeof v === "string" ? Number(v) : v
  if (!isFinite(n)) return "0.0000"
  return n.toFixed(4)
}

export default function ShowTotal({
  fiatCurrency,
  fiatAmount,
  usdcAmount,
  showApprox = true,
  subtitle = "Amount",
}: Props) {
  return (
    <div
      className={[
        "w-full",
        "rounded-[18px]",
        "bg-white/95",
        "backdrop-blur-md",
        "ring-1 ring-black/10",
        "shadow-[0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(15,23,42,0.06)]",
        "px-5 py-4 mt-6",
        "flex items-center justify-between",
      ].join(" ")}
    >
      {/* Left */}
      <div className="min-w-0">
        <div className="text-[20px] leading-tight font-extrabold text-slate-900">
          Total
        </div>
        <div className="mt-1 text-[14px] leading-tight text-slate-500">
          {subtitle}
        </div>
      </div>

      {/* Right */}
      <div className="text-right shrink-0">
        <div className="text-[22px] leading-tight font-extrabold text-slate-900 tabular-nums">
			{formatUsdc4(usdcAmount)} USDC
         
        </div>
        <div className="mt-1 text-[15px] leading-tight text-slate-400 tabular-nums">
          {showApprox ? "≈ " : ""}
		   {fiatCurrency} {fiatAmount}
        </div>
      </div>
    </div>
  )
}
