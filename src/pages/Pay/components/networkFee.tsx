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
  settlementText = "USDC",
  executionText = "Sponsored Network Fee",
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
      <button 
		className="w-full flex items-center gap-3 px-4 py-3"
		onClick={() => setOpen(v => !v)}
		>
		{/* 左侧：永不消失 */}
		<div className="text-[14px] font-semibold text-slate-900 flex-shrink-0">
			Network fee
		</div>

		{/* 右侧：可收缩 */}
		<div className="ml-auto flex items-center justify-end gap-3 min-w-0">
			<div className="text-[12px] font-semibold text-slate-900 tabular-nums truncate max-w-[120px] text-right">
			{/* fee */}
			</div>

			<div
				className={[
					"inline-flex items-center gap-2",
					"h-9 px-3 rounded-full",
					"bg-blue-50",
					"ring-1 ring-blue-200/70",
					"text-blue-600",
					"font-semibold text-[14px]",
					"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
					"flex-shrink-0",
					"min-w-0"
				].join(" ")}
				>
				<Sparkles className="w-5 h-5 shrink-0" />
				<span className="inline max-w-[110px] truncate">
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
				"px-4 py-3"
			].join(" ")}
			>
			<div className="grid grid-cols-2 gap-x-0 gap-y-2">
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
		{/* iOS-style footnote */}
		<div className="mt-1 text-[11px] leading-snug text-slate-400">
			You authorize this transfer with your signature.<br/>Beamio does not custody funds.
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
      <div className="text-[12px] text-slate-400 mb-0.5 leading-tight">
        {label}
      </div>

      <div className="text-[10px] font-medium text-slate-700 truncate leading-tight">
        {value}
      </div>
    </div>
  )
}
