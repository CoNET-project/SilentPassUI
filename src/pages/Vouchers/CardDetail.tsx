import React from "react"
import {
  Check,
  FileText,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Wallet,
  ChevronRight,
} from "lucide-react"
import type { searchResult } from "@/pages/chat/components/ChatHeaderIOS"

const CCSA_IMAGE = "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800"
const CCSA_OVERLAY = "from-black/60 via-black/10 to-transparent"
const CCSA_FEATURES = [
  "Accepted at Osmanthus & Future Partners",
  "Priority Booking at Osmanthus",
  "Member-Only Tasting Menus",
  "Future Network Expansion",
]

type CardDetailProps = {
  onPurchase?: () => void
  isMember?: boolean
  beamio?: searchResult | null
  onOpenWallet?: () => void
}

export default function CardDetail({
  onPurchase,
  isMember,
  beamio,
  onOpenWallet,
}: CardDetailProps) {
  const count = isMember ? 1 : 0

  return (
    <div className="w-full min-h-screen flex flex-col bg-white">
      {/* Hero Section (ProductDetailModal style - 45vh) */}
      <div className="relative w-full h-[45vh] shrink-0 bg-gray-900">
        <img
          src={CCSA_IMAGE}
          className="w-full h-full object-cover"
          alt="CCSA Member Card"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${CCSA_OVERLAY}`} />
        <div className="absolute bottom-0 left-0 w-full p-6 text-white">
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-3 inline-block bg-[#1562f0]">
            Membership
          </span>
          <h1 className="text-4xl font-bold leading-tight mb-2 shadow-sm">
            CCSA Member Card
          </h1>
          <p className="text-lg text-white/90 font-medium">CCSA Alliance</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 px-6 py-8 pb-32">
        {/* Inventory Status Banner (ProductDetailModal style) */}
        {count > 0 && (
          <div
            onClick={onOpenWallet}
            role={onOpenWallet ? "button" : undefined}
            tabIndex={onOpenWallet ? 0 : undefined}
            onKeyDown={onOpenWallet ? (e) => e.key === "Enter" && onOpenWallet() : undefined}
            className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-center justify-between active:scale-[0.98] transition-transform shadow-sm ${onOpenWallet ? "cursor-pointer" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1562f0] shadow-sm">
                <Wallet size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">
                  You have {count} card{count > 1 ? "s" : ""}
                </h4>
                <p className="text-xs text-gray-500">Tap to Use, Gift or Trade</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-blue-400" />
          </div>
        )}

        {/* Stats Row (ProductDetailModal style) */}
        <div className="flex gap-6 mb-8 border-b border-gray-100 pb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">
                Location
              </div>
              <div className="text-sm font-semibold text-gray-900">
                Aberdeen Centre, Richmond, BC
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">
                Security
              </div>
              <div className="text-sm font-semibold text-gray-900">Guaranteed</div>
            </div>
          </div>
        </div>

        {/* About */}
        <h3 className="text-xl font-bold mb-3 text-gray-900">About</h3>
        <p className="leading-relaxed text-[17px] mb-8 text-gray-600">
          Your gateway to a curated network of premier restaurants. Start your
          journey at Osmanthus, our inaugural partner, with exclusive perks and
          stored value acceptance. Delicacy Originated From Song Dynasty.
        </p>

        {/* What's Included (ProductDetailModal style) */}
        <div className="rounded-2xl p-5 mb-8 bg-[#F2F2F7]">
          <h4 className="text-sm font-bold uppercase tracking-wide mb-4 text-gray-900">
            What&apos;s Included
          </h4>
          <div className="space-y-3">
            {CCSA_FEATURES.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 bg-green-500">
                  <Check size={12} strokeWidth={4} />
                </div>
                <span className="font-medium text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terms & Rules */}
        <section className="bg-white rounded-2xl p-5 shadow-[0_4px_14px_rgba(15,23,42,0.08)] mb-6 border border-gray-100">
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
      </div>

      {/* Split Bottom Bar (ProductDetailModal style) */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto w-full backdrop-blur-xl border-t border-gray-200 bg-white/90 p-5 pb-8 z-50 flex gap-3">
        {count > 0 ? (
          <>
            <button
              onClick={onOpenWallet ?? undefined}
              type="button"
              className="flex-1 border-2 border-gray-200 bg-white text-gray-900 px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Wallet size={18} /> My Wallet{" "}
              <span className="text-xs px-1.5 py-0.5 rounded-md ml-1 bg-gray-200 text-gray-900">
                x{count}
              </span>
            </button>
            <button
              onClick={onPurchase}
              type="button"
              className="flex-[1.5] bg-[#1562f0] hover:bg-blue-600 text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              Top Up{" "}
              <span className="opacity-80 font-medium text-xs ml-1">CA$150</span>
            </button>
          </>
        ) : (
          <div className="flex-1 flex gap-4 items-center">
            <div className="flex-1">
              <div className="text-xs uppercase font-bold text-gray-500">
                Total Price
              </div>
              <div className="text-3xl font-bold tracking-tight text-gray-900">
                CA$150
              </div>
            </div>
            <button
              onClick={onPurchase}
              type="button"
              className="bg-[#1562f0] text-white px-8 py-3.5 rounded-full font-bold text-[17px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center gap-2"
            >
              Purchase <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
