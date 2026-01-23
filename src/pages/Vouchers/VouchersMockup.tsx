import React, { useState } from "react"
import {
  ArrowUpRight,
  Megaphone,
  Info,
  PlayCircle,
  Store,
  MapPin,
  Dices,
  Gift,
  Check
} from "lucide-react"

type Merchant = {
  id: number
  type: "cashback" | "loyalty" | "luck"
  chatId: string
  name: string
  handle: string
  category: string
  promo: string
  bgImage: string
  coverImage: string
  logo: string
  distance: string
  stamps?: number
  followers: string
  desc: string
}

const FEATURED_MERCHANTS: Merchant[] = [
  {
    id: 1,
    type: "cashback",
    chatId: "daily_grind",
    name: "Daily Grind Cafe",
    handle: "@dailygrind",
    category: "Food & Drink",
    promo: "20% Cashback",
    bgImage: "bg-orange-100",
    coverImage: "bg-gradient-to-r from-orange-400 to-red-500",
    logo: "☕️",
    distance: "0.8 km",
    followers: "1.2k",
    desc: "Best coffee in town. Serving since 2018."
  },
  {
    id: 2,
    type: "loyalty",
    chatId: "burger_king",
    name: "Burger King",
    handle: "@burgerking_dt",
    category: "Fast Food",
    promo: "Buy 5 Get $5",
    bgImage: "bg-red-100",
    coverImage: "bg-gradient-to-r from-red-600 to-orange-600",
    logo: "🍔",
    distance: "1.2 km",
    stamps: 3,
    followers: "5.8k",
    desc: "Flame grilled burgers."
  },
  {
    id: 3,
    type: "luck",
    chatId: "neon_bar",
    name: "Neon Bar",
    handle: "@neonbar_night",
    category: "Nightlife",
    promo: "Win Free Drinks",
    bgImage: "bg-purple-100",
    coverImage: "bg-gradient-to-r from-purple-600 to-blue-900",
    logo: "🍸",
    distance: "0.5 km",
    followers: "890",
    desc: "Live music every Friday."
  }
]

const CCSA_CARDS = [
  { id: 1, name: "Beamio Black", balance: "Coming Soon", color: "bg-gray-900", textColor: "text-white" },
  { id: 2, name: "Coffee Club", balance: "Waitlist", color: "bg-orange-500", textColor: "text-white" }
]

function MerchantItem({
  merchant,
  onPayClick
}: {
  merchant: Merchant
  onPayClick: (m: Merchant) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-gray-100 ${merchant.bgImage}`}
        >
          {merchant.logo}
        </div>

        <div>
          <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{merchant.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
              {merchant.category}
            </span>
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <MapPin size={10} /> {merchant.distance}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {merchant.type === "cashback" && (
          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
            {merchant.promo}
          </span>
        )}

        {merchant.type === "loyalty" && (
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < (merchant.stamps ?? 0) ? "bg-red-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
        )}

        {merchant.type === "luck" && (
          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 flex items-center gap-1">
            <Dices size={10} /> {merchant.promo}
          </span>
        )}

        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onPayClick(merchant)
          }}
          className="mt-1 text-[11px] font-bold text-[#0052FF] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 active:scale-95"
        >
          Pay <ArrowUpRight size={12} />
        </button>
      </div>
    </div>
  )
}

function CCSACard({
  card
}: {
  card: { id: number; name: string; balance: string; color: string; textColor: string }
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] p-4 min-w-[140px] h-[90px] ${card.color} ${card.textColor} shadow-md flex flex-col justify-between`}
    >
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
      <div className="flex justify-between items-start z-10">
        <Store size={16} className="opacity-80" />
        <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded">
          {card.balance}
        </span>
      </div>
      <div className="z-10">
        <p className="text-xs font-bold leading-tight">{card.name}</p>
        <p className="text-[9px] opacity-70 mt-0.5">Stored Value</p>
      </div>
    </div>
  )
}

export function VouchersMockup() {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1600)
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA]">
      <div className="max-w-md mx-auto min-h-[100dvh] bg-[#F5F7FA] relative border-x border-gray-200">
        {/* Top spacing like iOS */}
        <div className="h-3" />

        {/* Demo Disclaimer Banner */}
        <div className="px-5 mt-4 mb-2">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10">
              <Megaphone size={60} className="text-indigo-900" />
            </div>

            <div className="relative z-10 flex gap-3">
              <div className="bg-indigo-100 p-2 rounded-full h-min text-indigo-600 shrink-0">
                <Info size={20} strokeWidth={2.5} />
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-indigo-900">Demo Showcase</h3>
                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                  This page demonstrates marketing tools for merchants.{" "}
                  <span className="font-semibold">Offers shown are examples only.</span>
                </p>

                <button
                  type="button"
                  onClick={() => showToast("Merchants: open customize flow")}
                  className="mt-3 text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1"
                >
                  Merchants: Customize Yours <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Spotlight Card */}
        <div className="px-5 mt-4 mb-6">
          <div
            className="relative overflow-hidden rounded-[24px] bg-[#0A2540] p-6 shadow-lg shadow-blue-900/10 cursor-pointer active:scale-95 transition-all"
            onClick={() => showToast("Open Spotlight voucher")}
            role="button"
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl" />
            <div className="absolute left-0 bottom-0 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col items-start">
              <span className="bg-white/10 text-white/90 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md border border-white/10 mb-2">
                Partner Spotlight
              </span>

              <h2 className="text-[28px] font-extrabold text-white leading-[1.05] mb-2 tracking-tight">
                20% Cashback at <br />
                Daily Grind Cafe
              </h2>

              <p className="text-white/60 text-xs mb-5">Instant reward when you pay with USDC</p>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  showToast("Get Voucher")
                }}
                className="bg-white text-[#0A2540] text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
              >
                Get Voucher
              </button>
            </div>

            <div className="absolute right-5 bottom-5 text-6xl opacity-15">☕️</div>
          </div>
        </div>

        {/* Merchant Solutions (Demo) */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Megaphone size={14} className="text-indigo-600" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">
              Merchant Solutions (Demo)
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => showToast("Try Demo: Instant Cashback")}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl">
                  ⚡️
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Instant Cashback</h3>
                  <p className="text-xs text-gray-500">Drive traffic with auto-rewards</p>
                </div>
              </div>

              <div className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <PlayCircle size={12} /> Try Demo
              </div>
            </button>

            <button
              type="button"
              onClick={() => showToast("Try Demo: Digital Loyalty")}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">
                  🍔
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Digital Loyalty</h3>
                  <p className="text-xs text-gray-500">Buy 5 Get $5 (No stamps needed)</p>
                </div>
              </div>

              <div className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <PlayCircle size={12} /> Try Demo
              </div>
            </button>

            <button
              type="button"
              onClick={() => showToast("Try Demo: Gamified Rewards")}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl">
                  🎲
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Gamified Rewards</h3>
                  <p className="text-xs text-gray-500">Lucky Pay (Random free bills)</p>
                </div>
              </div>

              <div className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <PlayCircle size={12} /> Try Demo
              </div>
            </button>
          </div>
        </div>

        {/* Accepting Beamio */}
        <div className="px-5 mb-7">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Store size={14} className="text-[#0052FF]" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">Accepting Beamio</h2>
          </div>

          <div className="bg-white rounded-[24px] overflow-hidden border border-gray-200/60 shadow-sm">
            {FEATURED_MERCHANTS.map((merchant, i) => (
              <React.Fragment key={merchant.id}>
                <MerchantItem merchant={merchant} onPayClick={m => showToast(`Pay: ${m.name}`)} />
                {i !== FEATURED_MERCHANTS.length - 1 && <div className="ml-[72px] h-[1px] bg-gray-100" />}
              </React.Fragment>
            ))}

            <div className="p-3 text-center border-t border-gray-50">
              <button
                type="button"
                onClick={() => showToast("View all merchants nearby")}
                className="text-[11px] font-semibold text-gray-400 hover:text-[#0052FF] transition-colors"
              >
                View all merchants nearby
              </button>
            </div>
          </div>
        </div>

        {/* Stored Value Cards */}
        <div className="px-5 pb-28">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Gift size={14} className="text-purple-500" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">
              Stored Value Cards{" "}
              <span className="text-purple-500 text-[10px] ml-1 bg-purple-50 px-1.5 py-0.5 rounded">
                Beta
              </span>
            </h2>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-5 px-5">
            {CCSA_CARDS.map(card => (
              <CCSACard key={card.id} card={card} />
            ))}

            <button
              type="button"
              onClick={() => showToast("Add Code")}
              className="min-w-[140px] h-[90px] rounded-[20px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1 bg-gray-50/50 active:scale-95 transition"
            >
              <span className="text-xl">+</span>
              <span className="text-[10px] font-medium">Add Code</span>
            </button>
          </div>
        </div>

        {/* tiny toast */}
        {toast && (
          <div className="fixed left-0 right-0 bottom-6 flex justify-center z-50 pointer-events-none">
            <div className="bg-black/80 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/15">
                <Check size={12} />
              </span>
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* Optional: for the horizontal scrollbars */
export function GlobalStyles() {
  return (
    <style>{`
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  )
}
