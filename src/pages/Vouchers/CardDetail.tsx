import React from "react"
import {
  Sparkles,
  Info,
  Crown,
  Coins,
  Fingerprint,
  Zap,
  FileText,
  ChevronRight,
} from "lucide-react"
import type { searchResult } from "@/pages/chat/components/ChatHeaderIOS"

const fmtAddr = (a = "") =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"

type CardDetailProps = {
  onPurchase?: () => void
  isMember?: boolean
  beamio?: searchResult | null
}

export default function CardDetail({
  onPurchase,
  isMember,
  beamio,
}: CardDetailProps) {
  return (
    <div className="w-full min-h-screen flex justify-center">
      <div
        className="w-full max-w-[640px] px-4 pb-10"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 1rem)`,
        }}
      >
        {/* Product Details - Title with Info icon */}
        <div className="flex items-center justify-start gap-2 mb-6">
          <h1 className="text-[20px] font-bold text-slate-900">
            Product Details
          </h1>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <Info className="w-4 h-4 text-slate-600" />
          </div>
        </div>

        

        {/* About - White card */}
        <section className="bg-white rounded-2xl p-5 shadow-[0_4px_14px_rgba(15,23,42,0.08)] mb-4">
          <h2 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            About
          </h2>
          <p className="mt-3 text-[14px] text-slate-600 leading-relaxed">
            Issued by the Canadian Community Service Association (CCSA). This is
            a dual-attribute Stored-Value Card (Identity + Payment). Purchasing
            this card instantly credits your account with CA$100 to spend at all
            alliance merchants.
          </p>
        </section>

        {/* Member Benefits - White card */}
        <section className="bg-white rounded-2xl p-5 shadow-[0_4px_14px_rgba(15,23,42,0.08)] mb-4">
          <h2 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Member Benefits
          </h2>
          <div className="mt-4 space-y-4">
            <BenefitItem
              icon={<Coins className="h-5 w-5 text-green-600" />}
              title="CA$100 Credit Included"
              desc="Pay CA$100, get CA$100 spending power. No card fee."
            />
            <BenefitItem
              icon={<Fingerprint className="h-5 w-5 text-blue-600" />}
              title="One Card Access"
              desc="Seamless identity verification across the ecosystem."
            />
            <BenefitItem
              icon={<Crown className="h-5 w-5 text-amber-500" />}
              title="VIP Status"
              desc="Enjoy exclusive discounts and priority services."
            />
            <BenefitItem
              icon={<Zap className="h-5 w-5 text-purple-500" />}
              title="Gas Sponsored"
              desc="Zero transaction fees within the network."
            />
          </div>
        </section>

        {/* Terms & Rules - White card */}
        <section className="bg-white rounded-2xl p-5 shadow-[0_4px_14px_rgba(15,23,42,0.08)] mb-6">
          <h2 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Terms & Rules
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] text-slate-600 leading-relaxed list-disc list-outside ml-4">
            <li>Issuer: Canadian Community Service Association</li>
            <li>Website: www.canadaccsa.com/ccsa</li>
            <li>Credits are valid at all participating partners.</li>
            <li>Closed Loop: Credits cannot be exchanged for cash.</li>
            <li>1:1 anchored to CAD value.</li>
          </ul>
        </section>

        {/* Action Button */}
        <button
          onClick={onPurchase}
          className="
            w-full
            h-[56px]
            rounded-full
            bg-blue-600
            text-white
            text-[17px]
            font-semibold
            flex
            items-center
            justify-center
            gap-2
            shadow-[0_10px_30px_rgba(37,99,235,0.35)]
            active:scale-[0.98]
            transition
          "
        >
          <Sparkles className="h-5 w-5" />
          {isMember ? "Top Up" : "Get Member Card (Deposit 100)"}
        </button>
      </div>
    </div>
  )
}

function BenefitItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[14px] font-bold text-slate-900">{title}</span>
        <span className="text-[13px] text-slate-500 mt-0.5">{desc}</span>
      </div>
    </div>
  )
}
