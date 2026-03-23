import React from 'react'
import { QrCode, User } from 'lucide-react'

/** 与 LoadingPage 主色一致（样式类内使用字面量 #hex 供 Tailwind JIT 扫描） */
export const CASHTREES_PRIMARY_LIME = '#96EB3C'
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
    <div className="flex flex-col h-full px-6 pt-6 pb-6 bg-white">
      {/* 顶部标题 */}
      <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900 mb-8">
        Restore Wallet
      </h1>

      <div className="flex flex-col gap-4">
        {/* Card 1: Scan QR / Enter Code */}
        <button
          onClick={onUseRecoveryQR}
          className="
            w-full
            p-6
            bg-white
            rounded-[32px]
            border border-slate-100
            shadow-[0_10px_30px_rgba(0,0,0,0.03)]
            flex flex-col items-start gap-4
            text-left
            transition-transform active:scale-[0.98]
          "
        >
          {/* Icon Container: CashTrees primary */}
          <div className="w-14 h-14 rounded-full bg-[#96EB3C]/18 flex items-center justify-center">
            <QrCode className="w-7 h-7 text-[#96EB3C]" strokeWidth={2.5} />
          </div>

          <div>
            <div className="text-[18px] font-bold text-slate-900">
              Scan QR / Enter Code
            </div>
            <div className="mt-1.5 text-[15px] font-medium text-slate-500 leading-snug">
              Use your Recovery Image or Text Code.
            </div>
          </div>
        </button>

        {/* Card 2: Use @BeamioTag */}
        <button
          onClick={onUseUsernamePin}
          className="
            w-full
            p-6
            bg-white
            rounded-[32px]
            border border-slate-100
            shadow-[0_10px_30px_rgba(0,0,0,0.03)]
            flex flex-col items-start gap-4
            text-left
            transition-transform active:scale-[0.98]
          "
        >
          {/* Icon Container: Grey */}
          <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center">
            <User className="w-7 h-7 text-slate-600" strokeWidth={2.5} />
          </div>

          <div>
            <div className="text-[18px] font-bold text-slate-900">
              Use @BeamioTag
            </div>
            <div className="mt-1.5 text-[15px] font-medium text-slate-500 leading-snug">
              Decrypt backup with Tag + Password.
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

export default RestoreEntryScreen