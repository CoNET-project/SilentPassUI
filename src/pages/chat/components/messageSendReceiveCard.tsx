import React from "react"
import { MoreHorizontal } from "lucide-react"
import { fiatPrefix, formatAmount } from "@/services/currency"

type MessageSendReceiveCardProps = {
	variant: "sent" | "received"
	status?: "Completed" | "Pending" | "Failed" | string
	amount: number
	title: string
	timeLabel?: string
	onMenu?: () => void
	className?: string
	currency: ICurrency
	usdcAmount: number
	note?: string
	cashcode?: string
	
}

export function messageSendReceiveCard({
	variant,
	status = "Completed",
	amount,
	currency,
	title = "",
	timeLabel,
	note,
	cashcode = '',
	onMenu,
	className = ""
}: MessageSendReceiveCardProps) {
  const isSent = variant === "sent"
  const sign = isSent ? "-" : "+"

  return (
    <div
      className={[
        "inline-block w-[260px] max-w-full align-top",
        "relative overflow-hidden rounded-[22px]", // 更像图示的圆角
        "shadow-[0_6px_18px_rgba(2,6,23,0.12)]",
        isSent
          ? "bg-white text-slate-900 ring-1 ring-black/5"
          : "bg-[#F3F7FF] text-slate-900 ring-1 ring-[#2F63FF]/20",
        className
      ].join(" ")}
    >
      {/* 内容区 */}
      <div className="p-4">
        {/* header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div
              className={[
                "text-[11px] font-extrabold tracking-[0.18em] uppercase leading-none",
                isSent ? "text-slate-400" : "text-[#2F63FF]"
              ].join(" ")}
            >
              {title}
              {!!timeLabel && (
                <span className="ml-2 font-semibold tracking-normal text-slate-400">
                  {timeLabel}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="More"
            onClick={onMenu}
            className={[
              "h-7 w-7 rounded-full grid place-items-center",
              "transition active:scale-[0.96]",
              isSent
                ? "bg-slate-100 hover:bg-slate-200"
                : "bg-white/70 hover:bg-white/85 ring-1 ring-[#2F63FF]/15"
            ].join(" ")}
          >
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* amount (centered like the images) */}
        <div className="mt-3 flex w-full items-end gap-1">
          {/* 前缀：仅非 USDC（如果你这两个图只展示 USDC，可保持隐藏） */}
          {currency !== "USDC" && (
            <span className="pb-[2px] text-[12px] font-semibold text-slate-400">
              {fiatPrefix(currency)}
            </span>
          )}

          <span
            className={[
              "tabular-nums text-[30px] font-extrabold leading-none tracking-[-0.02em]",
              isSent ? "text-slate-900" : "text-[#2F63FF]"
            ].join(" ")}
          >
            {sign}
            {formatAmount(Number(amount), currency)}
          </span>

          <span className="pb-[2px] text-[12px] font-semibold text-slate-400 tracking-wide">
            {currency === "USDC" ? "USDC" : ""}
          </span>
        </div>

        {/* note (e.g. 20% Cashback / Transfer) */}
        {!!note && (
          <div className="mt-2 text-center text-[14px] text-slate-500">
            {note}
          </div>
        )}

        {/* status (Completed row like images) */}
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[12px] font-bold leading-none">
            ✓
          </span>
          <span className="text-[12px] font-medium text-slate-500">
            {status}
          </span>
        </div>
      </div>

      {!isSent && (
        <div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(47,99,255,0.10)]" />
      )}
    </div>
  )
}
