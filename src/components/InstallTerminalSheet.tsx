import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Share2, PlusSquare } from "lucide-react"

const STORAGE_KEY = "beamio_install_terminal_seen"

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
}

/**
 * Install Terminal 底部滑出引导：首次进入时显示，引导用户添加到主屏幕。
 * 点击「Remind me later」后写入本地缓存，下次不再显示。
 */
export default function InstallTerminalSheet({ open, onClose }: Props) {
  const handleRemindLater = () => {
    setInstallTerminalSeen()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[200] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleRemindLater}
            aria-hidden
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[201] bg-white dark:bg-slate-900 rounded-t-[22px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
            </div>

            <div className="px-6 pb-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-[#1652f0] flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-white">B</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Install Terminal
                  </h2>
                  <p className="mt-0.5 text-[15px] text-slate-500 dark:text-slate-400">
                    For secure commerce and fast signing
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="h-8 w-8 rounded-full bg-[#1652f0] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    1
                  </span>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-[15px] text-slate-700 dark:text-slate-300">
                      Tap the
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <Share2 className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Share</span>
                    </span>
                    <span className="text-[15px] text-slate-700 dark:text-slate-300">
                      icon below.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="h-8 w-8 rounded-full bg-[#1652f0] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    2
                  </span>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-[15px] text-slate-700 dark:text-slate-300">
                      Select
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <PlusSquare className="w-4 h-4 text-slate-600 dark:text-slate-400" strokeWidth={2.5} />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Add to Home Screen</span>
                    </span>
                    <span className="text-[15px] text-slate-700 dark:text-slate-300">.</span>
                  </div>
                </div>
              </div>

              {/* Remind me later */}
              <button
                type="button"
                onClick={handleRemindLater}
                className="w-full mt-4 py-3 text-[15px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Remind me later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
