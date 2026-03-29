import React from 'react'
import { QrCode, User } from 'lucide-react'

/** 与 RecoveryQRScreen / LoadingPage 主色一致（Tailwind JIT 扫描字面量 #hex） */
export const CASHTREES_PRIMARY_BRAND = '#1562f0'
/** @deprecated 使用 CASHTREES_PRIMARY_BRAND */
export const CASHTREES_PRIMARY_LIME = CASHTREES_PRIMARY_BRAND
export const CASHTREES_PRIMARY_INK = '#0F172A'

type RestoreEntryScreenProps = {
  onUseRecoveryQR: () => void
  onUseUsernamePin: () => void
}

const RestoreEntryScreen = ({
  onUseRecoveryQR,
  onUseUsernamePin,
}: RestoreEntryScreenProps) => {
  return (
    <div className="flex flex-col h-full px-6 pt-6 pb-6 bg-white dark:bg-slate-900">
      {/* 顶部标题 */}
      <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100 mb-8">
        Restore Wallet
      </h1>

      <div className="flex flex-col gap-4">
        {/* Card 1: Scan QR / Enter Code */}
        <button
          type="button"
          onClick={onUseRecoveryQR}
          className="
            w-full
            p-6
            bg-white dark:bg-slate-800
            rounded-[32px]
            border border-slate-100 dark:border-slate-700
            shadow-[0_10px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]
            flex flex-col items-start gap-4
            text-left
            transition-all active:scale-[0.98]
            hover:shadow-[0_12px_36px_rgba(21,98,240,0.12)] dark:hover:shadow-[0_12px_36px_rgba(21,98,240,0.2)]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
          "
        >
          <div className="w-14 h-14 rounded-full bg-[#1562f0]/15 dark:bg-[#1562f0]/25 flex items-center justify-center shadow-[0_8px_24px_rgba(21,98,240,0.15)]">
            <QrCode className="w-7 h-7 text-[#1562f0] dark:text-[#6ba3ff]" strokeWidth={2.5} />
          </div>

          <div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
              Scan QR / Enter Code
            </div>
            <div className="mt-1.5 text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
              Use your Recovery Image or Text Code.
            </div>
          </div>
        </button>

        {/* Card 2: Use @BeamioTag */}
        <button
          type="button"
          onClick={onUseUsernamePin}
          className="
            w-full
            p-6
            bg-white dark:bg-slate-800
            rounded-[32px]
            border border-slate-100 dark:border-slate-700
            shadow-[0_10px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]
            flex flex-col items-start gap-4
            text-left
            transition-all active:scale-[0.98]
            hover:border-[#1562f0]/25 dark:hover:border-[#1562f0]/35
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
          "
        >
          <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-700/80 flex items-center justify-center">
            <User className="w-7 h-7 text-slate-600 dark:text-slate-300" strokeWidth={2.5} />
          </div>

          <div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
              Use @BeamioTag
            </div>
            <div className="mt-1.5 text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
              Decrypt backup with Tag + Password.
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

export default RestoreEntryScreen
