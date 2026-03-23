import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share2, PlusSquare, MoreVertical, Download, Smartphone, X, Sparkles } from "lucide-react"

const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
const STORAGE_KEY = "beamio_install_terminal_seen"

/** 与 LoadingPage / RecoveryQRScreen 主色一致（Tailwind 任意类内请写死 #hex） */
export const CASHTREES_PRIMARY_LIME = "#96EB3C"
export const CASHTREES_PRIMARY_INK = "#0F172A"

export function getInstallTerminalSeen(): boolean {
	if (typeof window === "undefined") return true
	try {
		return localStorage.getItem(STORAGE_KEY) === "1"
	} catch {
		return true
	}
}

export function setInstallTerminalSeen(): void {
	try {
		localStorage.setItem(STORAGE_KEY, "1")
	} catch {}
}

type Props = {
  open: boolean
  onClose: () => void
  onRemindLater?: () => void
  /** iOS PWA 首次启动：不显示 Install Web App，改为指导使用 Restore Wallet */
  showRestoreHint?: boolean
  /** 用户 BeamioTag，用于 Seamless Setup 展示 */
  beamioTag?: string
}

/**
 * Install Web App 底部滑出引导：非 PWA 时在 Master Key / Wallet Ready 页显示，引导用户添加到主屏幕。
 */
export default function InstallTerminalSheet({
  open,
  onClose,
  onRemindLater,
  showRestoreHint,
  beamioTag = "",
}: Props) {
  const [platform, setPlatform] = useState<"ios" | "android">(isIOS ? "ios" : "android")

  const handleRemindLater = () => {
    setInstallTerminalSeen()
    onClose()
    onRemindLater?.()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[10002] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleRemindLater}
            aria-hidden
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[10003] bg-white dark:bg-slate-900 rounded-t-[22px] pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
            </div>

            <div className="px-6 pb-6">
              {showRestoreHint ? (
                /* iOS PWA 首次启动：指导使用 Restore Wallet */
                <>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-[#96EB3C] flex items-center justify-center shrink-0 shadow-[0_10px_28px_rgba(150,235,60,0.35)]">
                      <span className="text-2xl font-bold text-[#0F172A]">C</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Restore Your Wallet
                      </h2>
                      <p className="mt-2 text-[16px] text-slate-600 dark:text-slate-400 leading-snug">
                        Use <strong>Restore Wallet</strong> with your recovery code below.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* 默认：Install Web App 引导 */
                <>
                  {/* Header: icon + title + close */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-14 w-14 rounded-2xl bg-[#96EB3C] flex items-center justify-center shrink-0 shadow-[0_10px_28px_rgba(150,235,60,0.35)]">
                      <Smartphone className="w-7 h-7 text-[#0F172A]" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Install Web App
                      </h2>
                      <p className="mt-0.5 text-[15px] text-slate-500 dark:text-slate-400">
                        Add to Home Screen to continue.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemindLater}
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Platform tabs */}
                  <div className="flex gap-0 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 mb-5">
                    <button
                      type="button"
                      onClick={() => setPlatform("ios")}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
                        platform === "ios"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      iOS (Safari)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatform("android")}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
                        platform === "android"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Android (Chrome)
                    </button>
                  </div>

                  {/* Steps */}
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-4">
                    {platform === "ios" ? (
                      <>
                        <div className="flex items-start gap-3">
                          <span className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold shrink-0">
                            1
                          </span>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">Tap</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                              <Share2 className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Share</span>
                            </span>
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">below.</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold shrink-0">
                            2
                          </span>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">Select</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                              <PlusSquare className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Add to Home Screen</span>
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <span className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold shrink-0">
                            1
                          </span>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">Tap</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                              <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Menu</span>
                            </span>
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">(top right)</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold shrink-0">
                            2
                          </span>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">Select</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                              <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Install App</span>
                            </span>
                            <span className="text-[15px] text-slate-700 dark:text-slate-300">or Add to Home screen</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Seamless Setup */}
                  {beamioTag && (
                    <div className="mt-4 p-4 rounded-xl bg-[#96EB3C]/12 dark:bg-[#96EB3C]/10 border border-[#96EB3C]/25 dark:border-[#96EB3C]/20">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-[#96EB3C] shrink-0 mt-0.5" strokeWidth={2} />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">Seamless Setup</p>
                          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400 leading-snug">
                            We&apos;ve embedded your tag <strong className="text-slate-900 dark:text-slate-100">@{beamioTag}</strong> into the install link. You won&apos;t need to type it again.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleRemindLater}
                className="w-full mt-4 py-3 text-[15px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {showRestoreHint ? "Got it" : "Remind me later"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
