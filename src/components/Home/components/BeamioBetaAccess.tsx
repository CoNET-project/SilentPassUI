import React from "react"
import { X, Zap, Sparkles, Users } from "lucide-react"

export function BeamioBetaAccess({
  onClose
}: {
  onClose: () => void
}) {
  return (
    <div className="pt-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h2 className="text-[22px] leading-[28px] font-extrabold text-[#0A2540]">
          Beamio Beta Access
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="
            -mt-1
            h-10 w-10
            rounded-full
            bg-slate-100
            hover:bg-slate-200
            active:scale-95
            transition
            flex items-center justify-center
          "
          aria-label="关闭"
        >
          <X className="h-5 w-5 text-slate-600" strokeWidth={2.5} />
        </button>
      </div>

      {/* Cards */}
      <div className="mt-4 space-y-4">
        {/* Zero Gas Fees */}
        <div className="rounded-[22px] bg-blue-50 border border-blue-100 px-4 py-4 flex gap-3">
          <div className="shrink-0">
            <div className="w-11 h-11 rounded-full bg-[#2E6BFF] text-white flex items-center justify-center shadow-[0_10px_22px_rgba(46,107,255,0.25)]">
              <Zap className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-[18px] leading-[22px] font-extrabold text-blue-900">
              Zero Gas Fees
            </div>
            <div className="mt-1 text-[14px] leading-[18px] font-medium text-blue-700">
              We cover the network costs. You pay exactly what you see.
            </div>
          </div>
        </div>

        {/* Partner Perks */}
        <div className="rounded-[22px] bg-orange-50 border border-orange-100 px-4 py-4 flex gap-3">
          <div className="shrink-0">
            <div className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-[0_10px_22px_rgba(249,115,22,0.25)]">
              <Sparkles className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-[18px] leading-[22px] font-extrabold text-orange-900">
              Partner Perks
            </div>
            <div className="mt-1 text-[14px] leading-[18px] font-medium text-orange-700">
              Unlock special offers and experiences at select merchants.
            </div>
          </div>
        </div>

        {/* Community Access */}
        <div className="rounded-[22px] bg-purple-50 border border-purple-100 px-4 py-4 flex gap-3">
          <div className="shrink-0">
            <div className="w-11 h-11 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-[0_10px_22px_rgba(168,85,247,0.25)]">
              <Users className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-[18px] leading-[22px] font-extrabold text-purple-900">
              Community Access
            </div>
            <div className="mt-1 text-[14px] leading-[18px] font-medium text-purple-700">
              Be among the first to invite friends to the beta.
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onClose}
        className="
          mt-6
          w-full
          rounded-[18px]
          bg-[#0052FF]
          hover:bg-blue-600
          active:scale-[0.99]
          transition
          py-4
          text-[18px]
          font-extrabold
          text-white
          shadow-[0_16px_32px_rgba(0,82,255,0.25)]
        "
      >
        Start Exploring
      </button>
    </div>
  )
}
