import { useMemo, useState } from "react"
import { Sparkles, ChevronDown } from "lucide-react"

type NetworkFeeProps = {
  feeUsd?: number | string
  sponsored?: boolean
  defaultOpen?: boolean
  sponsorName?: string
  networkName?: string
  settlementText?: string
  executionText?: string
  className?: string
  Credits?: boolean
}

export default function NetworkFeeGas({
  feeUsd = "0.00",
  sponsored = true,
  defaultOpen = false,
  sponsorName = "Beamio",
  Credits = false,
  networkName = "Base",
  settlementText = "USDC transfer",
  executionText = "Sponsored (0 gas)",
  className = ""
}: NetworkFeeProps) {
  const [open, setOpen] = useState(defaultOpen)

  const feeText = useMemo(() => {
    const n = typeof feeUsd === "number" ? feeUsd : Number(feeUsd)
    if (isFinite(n)) return `$${n.toFixed(2)}`
    const s = String(feeUsd || "0.00")
    return s.startsWith("$") ? s : `$${s}`
  }, [feeUsd])

	const cells = [
		Credits && { label: "Credits used", value: "1 STX" },
		{ label: "Sponsor", value: sponsorName },
		{ label: "Network", value: networkName },
		{ label: "Settlement", value: settlementText },
		{ label: "Execution", value: executionText },
	].filter(Boolean) as { label: string; value: string }[]

  return (
    <div
      className={[
       
        "overflow-hidden",
        className
      ].join(" ")}
    >
      {/* Header row */}
      <button 
	  	className="w-full flex items-center gap-3 px-4 py-3"
		
		onClick={() => setOpen(v => !v)}
	  >
        <div className="text-[17px] font-semibold text-slate-900">
          Network fee
        </div>

        <div 
			className="ml-auto flex items-center justify-end gap-3"
			
		>
          <div className="text-[18px] font-semibold text-slate-900 tabular-nums">
            {feeText}
          </div>

			
			<div
				className={[
				"inline-flex items-center gap-2",
				"h-9 px-3 rounded-full",
				"bg-blue-50",
				"ring-1 ring-blue-200/70",
				"text-blue-600",
				"font-semibold text-[16px]",
				"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
				].join(" ")}
			>
				<Sparkles className="w-5 h-5" />

				{/* 文本仅在 ≥ sm 显示 */}
				<span className="hidden sm:inline">
					Sponsored
				</span>
			</div>
					
        </div>
      </button>

      {/* Divider */}
      <div className="h-px bg-slate-200/70" />

      {/* Body (collapsible) */}
      <div
        className={[
          "px-4",
          "transition-[max-height,opacity,padding] duration-300 ease-out",
          open ? "max-h-[260px] opacity-100 py-4" : "max-h-0 opacity-0 py-0",
          "overflow-hidden"
        ].join(" ")}
      >
        <div
          className={[
            "rounded-2xl",
            "bg-slate-50",
            "ring-1 ring-slate-200/70",
            "px-5 py-4"
          ].join(" ")}
        >
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
			{cells.map((cell, idx) => {
				const isLast = idx === cells.length - 1
				const isOdd = cells.length % 2 === 1
				const full = isLast && isOdd

				return (
				<InfoCell
					key={cell.label}
					label={cell.label}
					value={cell.value}
					full={full}
				/>
				)
			})}
			</div>
        </div>
      </div>
    </div>
  )
}

type InfoCellProps = {
  label: string
  value: string
  full?: boolean
}


function InfoCell({ label, value, full }: InfoCellProps) {
  return (
    <div
      className={[
        "min-w-0",
        full ? "col-span-2" : ""
      ].join(" ")}
    >
      <div className="text-[12px] text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-[14px] font-medium text-slate-700 truncate">
        {value}
      </div>
    </div>
  )
}
