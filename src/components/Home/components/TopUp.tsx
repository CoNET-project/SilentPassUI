import React from "react"
import { ArrowUpRight } from "lucide-react"

type ExchangePartner = {
  id: number | string
  name: string
  type: string
  offer: string
  location: string
  color: string // e.g. "bg-yellow-50 border-yellow-100"
  icon: string // emoji
  textColor: string // e.g. "text-yellow-700"
}

type TopUpProps = {
  partners: ExchangePartner[]
  onPartnerClick?: (partner: ExchangePartner) => void
  className?: string
  // 跟 demo 一样默认横向滚动；你想上下两行就传 grid
  layout?: "scroll" | "grid"
}

function ExchangePartnerItem({
  partner,
  onClick
}: {
  partner: ExchangePartner
  onClick?: (partner: ExchangePartner) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(partner)}
      className={[
        "min-w-[120px] h-[100px]",
        "rounded-[20px] p-3",
        "flex flex-col justify-between",
        "border",
        "shadow-sm",
        "active:scale-95 transition-all",
        "cursor-pointer text-left",
        partner.color
      ].join(" ")}
    >
      <div className="flex justify-between items-start">
        <span className="text-xl leading-none">{partner.icon}</span>
        <ArrowUpRight size={14} className="text-gray-400 opacity-50" />
      </div>

      <div>
        <h4 className={["text-xs font-bold leading-tight", partner.textColor].join(" ")}>
          {partner.name}
        </h4>
        <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">
          {partner.offer}
        </p>
      </div>
    </button>
  )
}

export function TopUp({ partners, onPartnerClick, className, layout = "scroll" }: TopUpProps) {
  return (
    <div className={["w-full mt-8", className ?? ""].join(" ")}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-[14px] leading-none">🪙</span>
        <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
          Top Up &amp; Exchange
        </h2>
      </div>

      {layout === "scroll" ? (
        // ✅ 完全跟 demo 一样：横向滚动条隐藏 + 左右出血 -mx-5 px-5
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-5 px-5">
          {partners.map(p => (
            <ExchangePartnerItem key={p.id} partner={p} onClick={onPartnerClick} />
          ))}
        </div>
      ) : (
        // 可选：如果你需要小屏上下两行、>=sm 两列
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {partners.map(p => (
            <ExchangePartnerItem key={p.id} partner={p} onClick={onPartnerClick} />
          ))}
        </div>
      )}
    </div>
  )
}
