import React, { useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fiatPrefix } from "@/services/currency"

type FXDetailProps = {
  open: boolean
  onClose: () => void
  fiatCurrency: ICurrency
  usdcToFiatRate: number
  source?: string
  quotedAt?: string | number | Date
  title?: string
  subtitle?: string
  note?: string

  // ✅ 内容区最大宽度（sheet 仍然全行宽）
  contentMaxW?: number
}

function fmtRate(n: number, digits = 4) {
  if (!isFinite(n) || n <= 0) return "0"
  return n.toFixed(digits)
}

function fmtDateTime(d?: string | number | Date) {
  if (!d) return ""
  const dt = d instanceof Date ? d : new Date(d)
  if (!isFinite(dt.getTime())) return ""
  return dt
    .toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(",", "")
    .replace(" 2026", ", 2026")
    .replace(", ", " · ")
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="text-[15px] leading-[22px] text-slate-500">{label}</div>
      <div
        className={[
          "text-right text-[16px] leading-[24px] text-slate-900 tabular-nums",
          strong ? "font-semibold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  )
}

export default function FXDetail({
  open,
  onClose,
  fiatCurrency,
  usdcToFiatRate,
  source = "Coinbase 预言机",
  quotedAt = new Date(),
  title = "FX details",
  subtitle = "Exchange rate information for this payment.",
  note = "Executed rate at payment time.",
  contentMaxW = 720,
}: FXDetailProps) {
  const symbol = useMemo(() => fiatPrefix(fiatCurrency), [fiatCurrency])

  const inverse = useMemo(() => {
    if (!isFinite(usdcToFiatRate) || usdcToFiatRate <= 0) return 0
    return 1 / usdcToFiatRate
  }, [usdcToFiatRate])

  const quoted = useMemo(() => fmtDateTime(quotedAt), [quotedAt])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <motion.button
			type="button"
			aria-label="关闭"
			onClick={onClose}
			className="absolute inset-0 bg-black/60"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			/>
			{/* ✅ 防止 overshoot 露出黑底：固定贴底白色底板 */}
			<div
			aria-hidden
			className="absolute inset-x-0 bottom-0 h-[20vh] bg-white"
			/>

          {/* ✅ sheet 全行宽（与底部“溶层”一体） */}
          <motion.div
            role="dialog"
			aria-modal="true"
			className={[
				"relative w-full",
				"rounded-t-[28px] bg-white",
				"overflow-hidden",
				"shadow-[0_-18px_40px_rgba(0,0,0,0.18)]",
				"pb-5",
			].join(" ")}
			initial={{ y: "110%", opacity: 0.98 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: "110%", opacity: 0.98 }}
			transition={{
				type: "spring",
				bounce: 0.28,
				stiffness: 520,
				damping: 30,
				mass: 0.7,
			}}
			onClick={e => e.stopPropagation()}
          >
            {/* ✅ 内容容器：居中 + 最大宽度 */}
            <div className="mx-auto w-full px-5 pt-3" style={{ maxWidth: contentMaxW }}>
              {/* handle */}
              <div className="flex justify-center">
                <div className="h-1.5 w-28 rounded-full bg-slate-200" />
              </div>

              {/* title */}
              <div className="pt-3 text-center">
                <div className="text-[22px] leading-[28px] font-bold tracking-tight text-slate-900 mt-4">
                  {title}
                </div>
                <div className="mt-3 text-[15px] leading-[22px] text-slate-500">
                  {subtitle}
                </div>
              </div>

              {/* card */}
              <div className="mt-5">
                <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-2 shadow-[0_3px_10px_rgba(15,23,42,0.06)]">
                  <Row
                    label="Rate"
                    strong
                    value={
                      <>
                        1 USDC = {symbol} {fmtRate(usdcToFiatRate, 4)}
                      </>
                    }
                  />

                  <Row
                    label="Inverse"
                    value={
                      <>
                        1 {fiatCurrency} = {fmtRate(inverse, 4)} USDC
                      </>
                    }
                  />

                  <div className="my-1.5 h-px bg-slate-200" />

                  <Row label="Source" value={source} />
                  <Row label="Quoted at" value={quoted || "-"} />

                  <div className="pt-2 pb-3">
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] leading-[20px] text-slate-600">
                      {note}
                    </div>
                  </div>
                </div>
              </div>

              {/* button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="
                    w-full h-10 rounded-full
                    bg-[#1652f0] text-white
                    text-[17px] leading-[24px] font-semibold
                    shadow-[0_10px_22px_rgba(22,82,240,0.28)]
                    active:scale-[0.99] transition
                  "
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
