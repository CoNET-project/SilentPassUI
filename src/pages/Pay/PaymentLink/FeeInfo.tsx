import React from 'react'
import { X } from 'lucide-react'

type CostInfoProps = {
  open: boolean
  onClose: () => void
  feeTitle?: string
  feeText?: string
  fxTitle?: string
  fxText?: string
}

export default function CostInfo({
  open,
  onClose,
  feeTitle = 'Beamio fee',
  feeText = 'Beamio fee: 0.8% (min 0.02 USDC; max 2.00 USDC)',
  fxTitle = 'FX note',
  fxText = 'Fiat-locked: final USDC amount, fee, and net receive are calculated when the payer pays, based on the live FX quote.',
}: CostInfoProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-[10px]"
      />

      {/* Panel */}
      <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-[760px]">
        <div
          className="
            relative
            bg-white
            rounded-t-[26px] rounded-b-[18px]
            shadow-[0_18px_60px_rgba(0,0,0,0.18)]
            border border-slate-200/70
            overflow-hidden
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5">
            <div className="text-[26px] font-semibold tracking-tight text-slate-900">
              Fees &amp; settlement
            </div>

            <button
              type="button"
              onClick={onClose}
              className="
                w-12 h-12 rounded-full
                border border-slate-200
                bg-white
                flex items-center justify-center
                hover:bg-slate-50 active:scale-95
                transition
              "
              aria-label="Close"
            >
              <X className="w-6 h-6 text-slate-700" strokeWidth={2.2} />
            </button>
          </div>

          <div className="h-px bg-slate-200/70" />

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/40 px-6 py-5">
              <div className="text-[22px] font-semibold text-slate-900">{feeTitle}</div>
              <div className="mt-3 text-[22px] leading-snug text-slate-600">{feeText}</div>
            </div>

            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50/40 px-6 py-5">
              <div className="text-[22px] font-semibold text-slate-900">{fxTitle}</div>
              <div className="mt-3 text-[22px] leading-snug text-slate-600">{fxText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
