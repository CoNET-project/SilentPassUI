import React from "react"
import { MoreHorizontal } from "lucide-react"

type MessageSendReceiveCardProps = {
  variant: "sent" | "received"
  status?: "Completed" | "Pending" | "Failed" | string
  amount: string | number
  token?: string
  approx?: string
  title?: string
  timeLabel?: string
  onMenu?: () => void
  className?: string
}

const fmtAmount = (v: string | number) => {
  const n = typeof v === "string" ? Number(v) : v
  if (!isFinite(n)) return String(v)
  return n.toFixed(2)
}

export function messageSendReceiveCard({
  variant,
  status = "Completed",
  amount,
  token = "USDC",
  approx = "",
  title = "",
  timeLabel = "",
  onMenu,
  className = ""
}: MessageSendReceiveCardProps) {
  const isSent = variant === "sent"

  return (
    <div
      className={[
        "inline-block w-[260px] max-w-full align-top",
        "relative overflow-hidden rounded-[26px]",
        "shadow-[0_6px_18px_rgba(2,6,23,0.12)]",
        isSent
          ? "bg-gradient-to-b from-[#2F63FF] to-[#0E43D8] text-white"
          : "bg-white text-slate-900 ring-1 ring-black/5",
        className
      ].join(" ")}
    >
      {isSent && (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-15">
            <div className="absolute -top-24 -right-24 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
          </div>
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        </>
      )}

      {/* 🔒 极致紧凑 padding */}
      <div className="p-3.5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={[
                "text-[11px] font-extrabold tracking-[0.18em] uppercase leading-none",
                isSent ? "text-white/90" : "text-slate-500"
              ].join(" ")}
            >
              {isSent ? "SENT" : "RECEIVED"}
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={[
                  "inline-block h-1.5 w-1.5 rounded-full",
                  isSent ? "bg-white/35" : "bg-emerald-500"
                ].join(" ")}
              />
              <div
                className={[
                  "text-[11px] font-semibold leading-none",
                  isSent ? "text-white/75" : "text-slate-500"
                ].join(" ")}
              >
                {status}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="More"
            onClick={onMenu}
            className={[
              "h-7 w-7 rounded-full grid place-items-center",
              "transition active:scale-[0.96]",
              isSent ? "bg-white/12 hover:bg-white/16" : "bg-slate-100 hover:bg-slate-200"
            ].join(" ")}
          >
            <MoreHorizontal
              className={[
                "h-4 w-4",
                isSent ? "text-white/85" : "text-slate-600"
              ].join(" ")}
            />
          </button>
        </div>

        {/* amount */}
        <div className="mt-3 flex items-end gap-1.5">
          <div
            className={[
              "text-[38px] font-extrabold tracking-[-0.02em] leading-[0.9]",
              isSent ? "text-white" : "text-slate-900"
            ].join(" ")}
          >
            {fmtAmount(amount)}
          </div>

          <div
            className={[
              "pb-0.5 text-[14px] font-extrabold tracking-[0.12em] leading-none",
              isSent ? "text-white/90" : "text-slate-600"
            ].join(" ")}
          >
            {token}
          </div>
        </div>

        {!!approx && (
          <div
            className={[
              "mt-1.5 text-[13px] font-medium leading-none",
              isSent ? "text-white/60" : "text-slate-500"
            ].join(" ")}
          >
            ≈ {approx}
          </div>
        )}

        {!!title && (
          <div
            className={[
              "mt-3 text-[16px] leading-tight",
              isSent ? "text-white/90" : "text-slate-800"
            ].join(" ")}
          >
            {title}
          </div>
        )}

        {!!timeLabel && (
          <div
            className={[
              "mt-3 text-[12px] font-medium leading-none",
              isSent ? "text-white/55" : "text-slate-400"
            ].join(" ")}
          >
            {timeLabel}
          </div>
        )}
      </div>

      {!isSent && (
        <div className="pointer-events-none absolute inset-0 rounded-[26px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]" />
      )}
    </div>
  )
}
