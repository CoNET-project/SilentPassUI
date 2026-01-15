import { useState } from "react"
import { ChevronDown } from "lucide-react"

const rate = 0.008
const minFee = 0.02
const maxFee = 2

type BeamioFeeProps = {
  grossUSDC: number
  feeUSDC: number
  netUSDC: number
}

export default function BeamioFee({
  grossUSDC,
  feeUSDC,
  netUSDC,
}: BeamioFeeProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="overflow-hidden">
      {/* Header — 对齐 Time / Network fee */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
       <span className="text-[14px] text-slate-500">
          Beamio fee
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-rose-400">
            - {feeUSDC.toFixed(2)} USDC
          </span>
          <ChevronDown
            className={[
              "w-4 h-4 text-slate-300 transition-transform",
              open ? "rotate-180" : ""
            ].join(" ")}
          />
        </div>
      </button>

      {/* Divider */}
      {open && <div className="h-px bg-slate-100 mx-5" />}

      {/* Content */}
      {open && (
        <div className="px-5 py-4 grid grid-cols-2 gap-y-5 gap-x-6">
          {/* Rate */}
          <div>
            <div className="text-[13px] text-slate-400 mb-1">
              Rate
            </div>
            <div className="text-[14px] font-semibold text-slate-900">
              {(rate * 100).toFixed(1)}%
            </div>
          </div>

          {/* Rule */}
          <div>
            <div className="text-[13px] text-slate-400 mb-1">
              Rule
            </div>
            <div className="text-[14px] font-semibold text-slate-900">
              min {minFee} · max {maxFee} USDC
            </div>
          </div>

          {/* Gross */}
          <div>
            <div className="text-[13px] text-slate-400 mb-1">
              Gross
            </div>
            <div className="text-[14px] font-semibold text-slate-900">
              {grossUSDC.toFixed(2)} USDC
            </div>
          </div>

          {/* Net */}
          <div>
            <div className="text-[13px] text-slate-400 mb-1">
              Net to merchant
            </div>
            <div className="text-[14px] font-semibold text-slate-900">
              {netUSDC.toFixed(2)} USDC
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
