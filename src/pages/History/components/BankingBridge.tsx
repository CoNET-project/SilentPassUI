import React from "react"
import { ChevronRight, CreditCard, Building2 } from "lucide-react"

type BankingBridgeProps = {
  onAddCash: () => void
  onCashOut: () => void
  className?: string
}

function RowCard({
  title,
  subtitle,
  icon,
  iconBgClass,
  onClick
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  iconBgClass: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full
        rounded-[20px]
        bg-white
        ring-1 ring-black/5
        shadow-[0_6px_18px_rgba(15,23,42,0.04)]
        px-4 py-3
        flex items-center gap-3
        active:scale-[0.995]
        transition
      "
    >
      {/* Left icon bubble */}
      <div
        className={[
          "w-[44px] h-[44px] rounded-full grid place-items-center shrink-0",
          iconBgClass
        ].join(" ")}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-[16px] leading-[18px] font-semibold text-slate-900">
          {title}
        </div>
        <div className="mt-[2px] text-[12px] leading-[14px] font-medium text-slate-500 truncate">
          {subtitle}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2.6} />
    </button>
  )
}

export default function BankingBridge({
  onAddCash,
  onCashOut,
  className = ""
}: BankingBridgeProps) {
  return (
    <div className={["w-full px-5 pt-4 pb-6", className].join(" ")}>
      {/* Header */}
      <div className="text-[22px] leading-[26px] font-extrabold tracking-tight text-slate-900">
        Banking &amp; Bridge
      </div>

      {/* Cards */}
      <div className="mt-4 space-y-3">
        <RowCard
          title="Top-up"
          subtitle="通过 Coinbase 购买 USDC"
          icon={<CreditCard className="w-6 h-6 text-[#2F6BFF]" strokeWidth={2.2} />}
          iconBgClass="bg-[#DCEBFF]"
          onClick={onAddCash}
        />

        <RowCard
          title="提现"
          subtitle="转至银行账户"
          icon={<Building2 className="w-6 h-6 text-slate-500" strokeWidth={2.2} />}
          iconBgClass="bg-slate-200/70"
          onClick={onCashOut}
        />
      </div>

      {/* Footer */}
      <div className="mt-7 flex items-center justify-center gap-3">
        <div className="text-[10px] tracking-[0.22em] font-bold text-slate-300">
          POWERED BY
        </div>
        <div className="text-[12px] tracking-[0.22em] font-black text-[#2F6BFF]">
          COINBASE
        </div>
        <div className="text-[12px] tracking-[0.22em] font-bold text-slate-300">
          PAY
        </div>
      </div>
    </div>
  )
}
