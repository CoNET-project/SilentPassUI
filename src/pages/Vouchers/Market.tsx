import React, { useState, useMemo, useEffect } from "react"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import {
  Search,
  Store,
  Crown,
  CreditCard as CardIcon,
  Coffee,
  Music,
  ShoppingCart,
  Utensils,
  Ticket,
  Gamepad2,
  Car,
  ChevronRight,
  Server,
  Trophy,
  Sparkles,
  Activity,
  Zap,
  ShieldCheck,
  Check,
  CheckCircle2,
  Info,
  X,
  ArrowRight,
  Lock,
  Cpu,
  Wallet,
  Share,
  Truck,
  MapPin,
  Database,
  Flame,
  Banknote,
  PackageOpen,
  ArrowLeft,
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getMyAssetsAggregated } from "@/services/BeamioCard"
import CardItem from "./CardItem"
import CardDetail from "./CardDetail"
import USDCUserCardTopupControl from "./USDCUserCardTopupControl"
import ShowPayQR from "./showPayQR"
import cashTreesLog from "./assets/cashtreesLog.png"
import phoIcon from "./assets/phoIcon.svg"

const THEME = { bg: "#F2F2F7" }
const TOP_SAFE_FILL_STYLE = { height: "max(env(safe-area-inset-top, 0px), 16px)" }
const INFRASTRUCTURE_CARD_ADDRESS = "0xf0Ce0ae91F74F67893E00307CabEa8C058939f03"

const CATEGORIES = [
  { id: "membership", name: "Memberships", icon: <Store size={20} />, color: "bg-purple-100 text-purple-600" },
  { id: "events", name: "Events", icon: <Trophy size={20} />, color: "bg-pink-100 text-pink-600" },
  { id: "dining", name: "Dining", icon: <Utensils size={20} />, color: "bg-orange-100 text-orange-600" },
  { id: "retail", name: "Retail", icon: <ShoppingCart size={20} />, color: "bg-blue-100 text-blue-600" },
  { id: "services", name: "Services", icon: <Sparkles size={20} />, color: "bg-emerald-100 text-emerald-600" },
]

const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="flex justify-between items-end px-5 mb-3 mt-8">
    <h3 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">{title}</h3>
    {action && (
      <button onClick={onAction} className="text-[#1562f0] text-[15px] font-medium active:opacity-60">
        {action}
      </button>
    )}
  </div>
)

const GetButton = ({ price, count = 0, onClick }: { price: number; count?: number; onClick: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="relative pl-5 pr-5 py-1.5 rounded-full font-bold text-[13px] transition-all duration-200 shadow-sm min-w-[75px] active:scale-95 bg-[#F2F2F7] text-[#1562f0] hover:bg-[#1562f0] hover:text-white flex items-center justify-center gap-1.5"
  >
    {price > 0 ? `CA$${price}` : "View"}
    {count > 0 && (
      <span className="flex items-center justify-center bg-blue-100 text-blue-600 text-[9px] h-4 min-w-[16px] px-1 rounded-full -mr-2 border border-blue-200 shadow-sm">
        x{count}
      </span>
    )}
  </button>
)

type GenesisFeature = { title: string; desc: string; icon: React.ReactNode }
type GenesisNodeData = {
  id: number
  tagline: string
  title: string
  subtitle: string
  description: string
  currentMint: number
  totalMint: number
  price: number
  type: string
  image: string
  stat1Label: string
  stat1Value: string
  stat2Label: string
  stat2Value: string
  features: GenesisFeature[]
  legalNote: string
  featureTitle?: string
  themeColor?: 'blue' | 'orange'
  partners?: { name: string; icon: string; bg: string }[]
}
type HeroItem = {
  id: number
  tagline: string
  title: string
  subtitle: string
  description: string
  features?: string[]
  image: string
  merchant: string
  location: string
  price: number
  type: string
  color?: string
  overlay?: string
  partners?: { name: string; icon: string; bg: string }[]
}
type CashTreesItem = HeroItem & {
  merchantLogo?: string
  isVariablePrice?: boolean
  minPrice?: number
  maxPrice?: number
  customGradient?: string
  theme?: "black" | "green"
  partners?: { name: string; address?: string; icon: string; bg: string }[]
}

const GENESIS_NODE_DATA: GenesisNodeData = {
  id: 999,
  tagline: "Hardware + License",
  title: "Genesis Node Pack",
  subtitle: "The Infrastructure Backbone",
  description: "Own the physical edge and the invisible engine of the Beamio network.",
  currentMint: 247,
  totalMint: 300,
  price: 999,
  type: "Package B",
  image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop",
  stat1Label: "Compute",
  stat1Value: "EAL6+ Edge",
  stat2Label: "Yield",
  stat2Value: "5% Network",
  features: [
    { title: "Dynamic E-ink Terminal", desc: "0.84mm flexible PCB. Off-grid identity credential auto-refreshing every 60s.", icon: <Zap size={20} className="text-blue-400" /> },
    { title: "Global Validator License", desc: "Delegated Staking (NaaS). 1-click cloud delegation for seamless routing.", icon: <ShieldCheck size={20} className="text-blue-400" /> },
    { title: "5% Validator Yield", desc: "Perpetual computational rewards from all global B-Units routing fuel consumed.", icon: <CheckCircle2 size={20} className="text-blue-400" /> },
  ],
  legalNote: "Forward-looking projection based on network modeling. Yields are utility-derived computational rewards, not guaranteed financial returns.",
  featureTitle: "The Tangible Edge",
  themeColor: "blue",
}

const LIMITED_FUEL_PACK_DATA: GenesisNodeData = {
  id: 998,
  tagline: "Merchant Prepaid",
  title: "Limited Fuel Pack",
  subtitle: "The Store Clearing Fuel",
  description: "Instant clearing fuel to process your daily retail volume. System value of $1,000 USDC.",
  currentMint: 842,
  totalMint: 1000,
  price: 499,
  type: "Package A",
  image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop",
  stat1Label: "Volume",
  stat1Value: "100k B-Units",
  stat2Label: "Discount",
  stat2Value: "50% Tech Off",
  features: [
    { title: "100,000 B-Units Pre-load", desc: "System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume.", icon: <Database size={20} className="text-orange-400" /> },
    { title: "50% Effective Rate Cut", desc: "Effectively slashes the standard 0.8% Beamio transaction fee in half. Keep more of your hard-earned revenue.", icon: <Banknote size={20} className="text-orange-400" /> },
    { title: "Automated Fee Deduction", desc: "Zero crypto friction. The system automatically burns your pre-paid fuel as consumers pay at your counter.", icon: <Server size={20} className="text-orange-400" /> },
  ],
  legalNote: "B-Units are internal utility protocol fuel pegged for internal system accounting. They cannot be withdrawn as fiat or traded on secondary markets.",
  featureTitle: "The Merchant Arsenal",
  themeColor: "orange",
}

const HERO_COLLECTION: HeroItem[] = [
  { id: 101, tagline: "HAPPENING NOW", title: "CCSA Member Card", subtitle: "Unlock Exclusive Dining. First Partner: Osmanthus.", description: "Your gateway to a curated network of premier restaurants. Start your journey at Osmanthus, our inaugural partner, with exclusive perks and stored value acceptance.", features: ["Accepted at Osmanthus & Future Partners", "Priority Booking at Osmanthus", "Member-Only Tasting Menus", "Future Network Expansion"], image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800", merchant: "CCSA Alliance", location: "Aberdeen Centre, Richmond, BC", price: 150, type: "Membership", color: "text-white", overlay: "from-black/60 via-black/10 to-transparent", partners: [{ name: "Osmanthus", icon: "🌸", bg: "bg-yellow-100" }, { name: "Sen Pho", icon: "🍜", bg: "bg-orange-100" }, { name: "Longdhang", icon: "🥟", bg: "bg-red-100" }, { name: "More", icon: "+18", bg: "bg-gray-100 text-xs font-bold" }] },
  {
    id: 102,
    tagline: "LOCAL FAVORITE",
    title: "Sen Pho + Cafe Card",
    subtitle: "Redefining Vietnamese Cuisine",
    description: "Experience authentic Vietnamese cuisine at its finest. This membership is valid at both Champlain Heights and Kerrisdale locations, offering exclusive perks for loyal patrons.",
    features: ["10% Off All Orders", "Valid at Champlain Heights & Kerrisdale", "Priority Reservations", "Birthday Dessert"],
    image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
    merchant: "",
    location: "Vancouver, BC",
    price: 99,
    type: "Membership",
    color: "text-white",
    overlay: "from-black/80 via-black/40 to-transparent",
  },
]

const CASH_TREES_COLLECTION: CashTreesItem[] = [
  {
    id: 201,
    title: "CashTrees Black VIP",
    tagline: "",
    subtitle: "Load $100+ to unlock maximum merchant discounts.",
    description: "Experience premium dining with exclusive rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
    features: ["Merchant-Defined VIP Discounts", "Sen Pho + Cafe: 10% Off", "Priority Reservations", "Valid at Kerrisdale & Champlain Heights"],
    image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
    merchant: "",
    location: "Vancouver, BC",
    merchantLogo: phoIcon,
    partners: [
      { name: "Kerrisdale", address: "6290 East Blvd, Vancouver, BC", icon: "📍", bg: "bg-gray-800 text-white" },
      { name: "Champlain Heights", address: "7056 Kerr St, Vancouver, BC", icon: "📍", bg: "bg-black text-white" },
    ],
    price: 100,
    isVariablePrice: true,
    minPrice: 100,
    type: "CashTrees VIP",
    color: "text-white",
    customGradient: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 100%)",
    theme: "black",
  },
  {
    id: 202,
    title: "CashTrees Green Card",
    tagline: "",
    subtitle: "Load $50 - $99 to unlock standard discounts.",
    description: "Start enjoying authentic dining with CashTrees rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
    features: ["Merchant-Defined Standard Discounts", "Sen Pho + Cafe: 5% Off", "Instant Digital Setup", "Valid at Kerrisdale & Champlain Heights"],
    image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
    merchant: "",
    location: "Vancouver, BC",
    merchantLogo: phoIcon,
    partners: [
      { name: "Kerrisdale", address: "6290 East Blvd, Vancouver, BC", icon: "📍", bg: "bg-white text-green-700" },
      { name: "Champlain Heights", address: "7056 Kerr St, Vancouver, BC", icon: "📍", bg: "bg-green-100 text-green-800" },
    ],
    price: 50,
    isVariablePrice: true,
    minPrice: 50,
    maxPrice: 99.99,
    type: "CashTrees Member",
    color: "text-[#0e2a05]",
    customGradient: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.6) 100%)",
    theme: "green",
  },
]

const CashTreesGetButton = ({ price, count = 0, onClick, isVariable = false }: { price: number; count?: number; onClick: () => void; isVariable?: boolean }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="relative rounded-full font-bold text-[13px] transition-all duration-200 shadow-sm active:scale-95 bg-black text-white hover:bg-gray-800 border border-white/90 flex items-center justify-center gap-1.5 px-5 py-1.5 min-w-[75px]"
  >
    {isVariable ? `Load $${price}+` : `$${price}`}
    {count > 0 && (
      <span className="flex items-center justify-center bg-white text-black text-[9px] h-4 min-w-[16px] px-1 rounded-full -mr-2 shadow-sm font-extrabold">
        x{count}
      </span>
    )}
  </button>
)

const StoryCard = ({ item, count, onClick, onBuy }: { item: CashTreesItem; count: number; onClick: (i: CashTreesItem) => void; onBuy: (i: CashTreesItem) => void }) => {
  const isBlackCard = item.theme === "black"
  const isDarkBg = item.theme === "black" || item.theme === "green"
  return (
    <div
      onClick={() => onClick(item)}
      className="snap-center relative min-w-[340px] h-[460px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] cursor-pointer group active:scale-[0.98] transition-transform duration-300 shrink-0"
    >
      <img src={item.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.title} />
      <div className="absolute inset-0" style={{ background: item.customGradient }} />
      <img src={cashTreesLog} alt="CashTrees" className="absolute top-5 left-5 w-16 h-10 object-contain z-10 opacity-90 drop-shadow-md" />
      <div className="absolute inset-0 flex flex-col justify-between p-7">
        <div className="mt-8">
          <h2 className={`${item.id === 202 ? "text-[#9ecc3c]" : isDarkBg ? "text-white" : "text-[#0e2a05]"} text-4xl font-extrabold leading-[1.1] tracking-tight drop-shadow-lg w-4/5 mb-3`}>
            {item.title}
          </h2>
          <p className={`${isDarkBg ? "text-gray-200" : "text-[#1a4a0a]"} text-[15px] font-medium leading-snug line-clamp-2 drop-shadow-md w-11/12`}>
            {item.subtitle}
          </p>
        </div>
        <div className={`${item.id === 202 ? "bg-[#9ecc3c] border-[#9ecc3c]/50" : isBlackCard ? "bg-black/80 border-gray-700" : "bg-black/70 border-gray-600"} backdrop-blur-xl border rounded-[24px] p-4 flex items-center justify-between shadow-lg`}>
          <div className="flex items-center gap-3.5">
            <div className="w-[60px] h-[60px] flex items-center justify-center text-2xl shrink-0">
              {item.merchantLogo ? (
                typeof item.merchantLogo === "string" && (item.merchantLogo.startsWith("/") || item.merchantLogo.startsWith("http") || item.merchantLogo.includes(".svg")) ? (
                  <img src={item.merchantLogo} alt={item.merchant} className="w-full h-full object-contain" />
                ) : (
                  item.merchantLogo
                )
              ) : (
                "🍜"
              )}
            </div>
            <div className="flex flex-col">
              <span className={`${isDarkBg ? "text-white" : "text-[#0e2a05]"} font-bold text-[15px] leading-tight`}>
                {item.merchant}
              </span>
              {/* <div className="flex items-center gap-1.5 mt-0.5">
                <CardIcon size={12} className={isDarkBg ? "text-gray-400" : "text-[#1a4a0a]"} />
                <span className={`${isDarkBg ? "text-gray-300" : "text-[#1a4a0a]"} text-[11px] font-bold uppercase tracking-wide`}>CashTrees</span>
              </div> */}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <CashTreesGetButton
              price={item.price}
              count={count}
              onClick={() => onBuy(item)}
              isVariable={item.isVariablePrice}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const GenesisCard = ({ data, onClick }: { data: GenesisNodeData; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="snap-center relative min-w-[320px] h-[420px] rounded-[32px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform duration-300 bg-gradient-to-br from-gray-900 to-black border border-gray-800 shadow-[0_0_30px_rgba(0,112,243,0.15)] shrink-0"
  >
    <img
      src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop"
      alt="Carbon texture"
      className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-[#0a0a0c]" />
    <div className="absolute -left-10 top-20 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-40 animate-pulse" />
    <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
          {data.type}
        </span>
        <span className="text-gray-400 text-xs font-bold font-mono">
          {data.currentMint}/{data.totalMint}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center py-2">
        <div className="relative w-48 h-32 bg-gradient-to-tr from-[#1a1a1c] to-[#2a2a2c] rounded-xl border border-gray-600 shadow-2xl rotate-12 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
          <div className="w-12 h-8 bg-black rounded flex items-center justify-center border border-gray-700">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-1 w-full animate-[scan_2s_ease-in-out_infinite]" />
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-white text-3xl font-extrabold leading-tight tracking-tight">{data.title}</h2>
        <p className="text-blue-400/80 text-xs mt-1 font-semibold uppercase tracking-wider">{data.subtitle}</p>
      </div>
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center border border-white/10">
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Pricing</p>
          <p className="text-white text-xl font-bold font-mono">${data.price} <span className="text-[10px] text-gray-500">USDC</span></p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]">
          View
        </button>
      </div>
    </div>
  </div>
)

const FuelPackCard = ({ data, onClick }: { data: GenesisNodeData; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="snap-center relative min-w-[320px] h-[420px] rounded-[32px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform duration-300 bg-gradient-to-br from-gray-900 to-[#1a1005] border border-gray-800 shadow-[0_0_30px_rgba(249,115,22,0.15)] shrink-0"
  >
    <img
      src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop"
      alt="Server texture"
      className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/80 to-[#0a0a0c]" />
    <div className="absolute -left-10 top-20 w-32 h-32 bg-orange-600 rounded-full blur-[60px] opacity-30 animate-pulse" />
    <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
          {data.type}
        </span>
        <span className="text-gray-400 text-xs font-bold font-mono">
          {data.currentMint}/{data.totalMint}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center py-2">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 bg-[#110a05] rounded-xl border border-orange-900/50 shadow-2xl flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-500">
          <Database className="w-12 h-12 text-orange-500 mb-2 opacity-80" />
          <p className="text-orange-400 font-mono font-bold text-lg leading-none">100k</p>
          <p className="text-orange-600 text-[8px] uppercase font-bold tracking-widest mt-1">B-Units</p>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-orange-600 rounded-b-xl shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-white text-3xl font-extrabold leading-tight tracking-tight">{data.title}</h2>
        <p className="text-orange-400/80 text-xs mt-1 font-semibold uppercase tracking-wider">{data.subtitle}</p>
      </div>
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center border border-white/10">
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Pricing</p>
          <p className="text-white text-xl font-bold font-mono">${data.price} <span className="text-[10px] text-gray-500">USDC</span></p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="bg-orange-600 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-[0_0_15px_rgba(234,88,12,0.5)]">
          View
        </button>
      </div>
    </div>
  </div>
)

type InventoryInstance = { id: string; date: string; balance: string }
type ViewingItem = (GenesisNodeData | HeroItem) & { icon?: React.ReactNode; bg?: string; shadow?: string }

const GenesisDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet }: { item: ViewingItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (item: ViewingItem) => void; onOpenWallet: () => void }) => {
  if (!item) return null
  const count = inventory.length
  const genesisItem = item as GenesisNodeData
  return (
    <div className="fixed inset-0 z-[80] bg-[#0a0a0c] overflow-y-auto flex flex-col text-white" style={{ animation: "slide-up 0.3s ease-out" }}>
      <div className="absolute top-0 inset-x-0 bg-black pointer-events-none" style={TOP_SAFE_FILL_STYLE} />
      <div className="absolute inset-0 overflow-y-auto pb-48">
        {/* Hero Image Area */}
        <div className="relative h-[380px] w-full bg-gradient-to-b from-gray-900 to-[#0a0a0c]">
          <img
            src={genesisItem.image}
            alt="Detail background"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]" />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-48 h-20 rounded-[100%] blur-[80px] opacity-30 bg-blue-600" />
          <div
            className="absolute inset-x-4 flex justify-between items-center z-10"
            style={{ top: 'max(1rem, calc(env(safe-area-inset-top, 0px) - 0.25rem))' }}
          >
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition border border-white/30"><X className="w-5 h-5" /></button>
            <button className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition border border-white/30"><Share className="w-5 h-5" /></button>
          </div>
          <div className="absolute bottom-6 inset-x-6">
            <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-3 inline-block">
              {genesisItem.tagline}
            </span>
            <h1 className="text-white text-4xl font-extrabold leading-tight mb-2 tracking-tight">{genesisItem.title}</h1>
            <p className="text-gray-400 font-medium text-sm">{genesisItem.subtitle}</p>
          </div>
        </div>
        {count > 0 && (
          <div onClick={onOpenWallet} className="mx-6 mt-6 bg-blue-900/30 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(21,98,240,0.2)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-sm"><Wallet size={20} /></div>
              <div><h4 className="text-sm font-bold text-white">You own {count} Nodes</h4><p className="text-xs text-blue-300">Tap to Gift or Manage</p></div>
            </div>
            <ChevronRight size={18} className="text-blue-400" />
          </div>
        )}
        {/* Specs Row */}
        <div className="flex border-b border-gray-800 py-6 px-6 bg-[#0a0a0c]">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg text-blue-500">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{genesisItem.stat1Label}</p>
              <p className="text-base font-bold text-white leading-none">{genesisItem.stat1Value}</p>
            </div>
          </div>
          <div className="w-px bg-gray-800 mx-2 h-10 self-center" />
          <div className="flex items-center gap-4 flex-1 pl-4">
            <div className="w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg text-green-500">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{genesisItem.stat2Label}</p>
              <p className="text-base font-bold text-white leading-none">{genesisItem.stat2Value}</p>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="px-6 py-6 bg-[#0a0a0c]">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-gray-400">Global Allocation Progress</span>
            <span className="text-blue-400 font-mono">{genesisItem.currentMint ?? 0} / {genesisItem.totalMint ?? 0}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)] rounded-full"
              style={{ width: `${((genesisItem.currentMint ?? 0) / (genesisItem.totalMint || 1)) * 100}%` }}
            />
          </div>
        </div>
        {/* Features Card */}
        <div className="px-6 mb-4">
          <div className="bg-[#151518] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              The Tangible Edge
            </h3>
            <div className="space-y-6">
              {(genesisItem.features ?? []).map((feature: GenesisFeature, idx: number) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">{feature.icon}</div>
                  <div>
                    <span className="text-sm font-bold text-gray-200 block">{feature.title}</span>
                    <span className="text-xs text-gray-500 font-medium mt-1 block leading-relaxed opacity-80">{feature.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Compliance / Legal Note */}
        <div className="px-6 mb-8">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
              <strong className="text-gray-400 block mb-1">LEGAL NOTE:</strong>
              {genesisItem.legalNote}
            </p>
          </div>
        </div>
      </div>
      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-gray-800 p-6 flex justify-between items-center rounded-b-[32px] z-50">
        {count > 0 ? (
          <><button onClick={onOpenWallet} className="flex-1 bg-white/5 border border-white/10 text-white px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-white/10"><Wallet size={18} /> My Nodes <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">x{count}</span></button><button onClick={() => onBuy(item)} className="flex-[1.5] bg-blue-600 hover:bg-blue-500 text-white px-4 py-3.5 rounded-xl font-bold text-[15px] shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2">Secure Another <ArrowRight size={18} /></button></>
        ) : (
          <><div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Due</p><p className="text-3xl font-extrabold text-white font-mono tracking-tight">{genesisItem.price} <span className="text-sm text-gray-500">USDC</span></p></div><button onClick={() => onBuy(item)} className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-bold py-3.5 px-6 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]">Secure Node <ArrowRight className="w-4 h-4" /></button></>
        )}
      </div>
    </div>
  )
}

const FuelPackDetailModal = ({ item, onClose, onBuy }: { item: ViewingItem; onClose: () => void; onBuy: (item: ViewingItem) => void }) => {
  if (!item) return null
  const fuelItem = item as GenesisNodeData
  return (
    <div className="fixed inset-0 z-[80] bg-[#0a0a0c] overflow-y-auto flex flex-col text-white" style={{ animation: "slide-up 0.3s ease-out" }}>
      <div className="absolute top-0 inset-x-0 bg-black pointer-events-none" style={TOP_SAFE_FILL_STYLE} />
      <div className="absolute inset-0 overflow-y-auto pb-48">
        {/* Hero Image Area */}
        <div className="relative h-[380px] w-full bg-gradient-to-b from-gray-900 to-[#0a0a0c]">
          <img
            src={fuelItem.image}
            alt="Detail background"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]" />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-48 h-20 rounded-[100%] blur-[80px] opacity-30 bg-orange-600" />
          <div
            className="absolute inset-x-4 flex justify-between items-center z-10"
            style={{ top: 'max(1rem, calc(env(safe-area-inset-top, 0px) - 0.25rem))' }}
          >
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition border border-white/30"><X className="w-5 h-5" /></button>
            <button className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition border border-white/30"><Share className="w-5 h-5" /></button>
          </div>
          <div className="absolute bottom-6 inset-x-6">
            <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-3 inline-block">
              {fuelItem.tagline}
            </span>
            <h1 className="text-white text-4xl font-extrabold leading-tight mb-2 tracking-tight">{fuelItem.title}</h1>
            <p className="text-gray-400 font-medium text-sm">{fuelItem.subtitle}</p>
          </div>
        </div>
        {/* Specs Row */}
        <div className="flex border-b border-gray-800 py-6 px-6 bg-[#0a0a0c]">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg text-orange-500">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{fuelItem.stat1Label}</p>
              <p className="text-base font-bold text-white leading-none">{fuelItem.stat1Value}</p>
            </div>
          </div>
          <div className="w-px bg-gray-800 mx-2 h-10 self-center" />
          <div className="flex items-center gap-4 flex-1 pl-4">
            <div className="w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg text-orange-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{fuelItem.stat2Label}</p>
              <p className="text-base font-bold text-white leading-none">{fuelItem.stat2Value}</p>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="px-6 py-6 bg-[#0a0a0c]">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-gray-400">Global Allocation Progress</span>
            <span className="text-orange-400 font-mono">{fuelItem.currentMint ?? 0} / {fuelItem.totalMint ?? 0}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.8)] rounded-full"
              style={{ width: `${((fuelItem.currentMint ?? 0) / (fuelItem.totalMint || 1)) * 100}%` }}
            />
          </div>
        </div>
        {/* Features Card */}
        <div className="px-6 mb-4">
          <div className="bg-[#151518] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
              <PackageOpen className="w-4 h-4" />
              {fuelItem.featureTitle ?? "The Merchant Arsenal"}
            </h3>
            <div className="space-y-6">
              {(fuelItem.features ?? []).map((feature: GenesisFeature, idx: number) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">{feature.icon}</div>
                  <div>
                    <span className="text-sm font-bold text-gray-200 block">{feature.title}</span>
                    <span className="text-xs text-gray-500 font-medium mt-1 block leading-relaxed opacity-80">{feature.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Compliance / Legal Note */}
        <div className="px-6 mb-8">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
              <strong className="text-gray-400 block mb-1">LEGAL NOTE:</strong>
              {fuelItem.legalNote}
            </p>
          </div>
        </div>
      </div>
      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-gray-800 p-6 flex justify-between items-center rounded-b-[32px] z-50">
        <div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Due</p><p className="text-3xl font-extrabold text-white font-mono tracking-tight">{fuelItem.price} <span className="text-sm text-gray-500">USDC</span></p></div>
        <button onClick={() => onBuy(item)} className="bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all text-white font-bold py-3.5 px-6 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(234,88,12,0.4)]">Secure Fuel <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

const GenesisPurchaseModal = ({ item, onClose, onConfirm }: { item: ViewingItem; onClose: () => void; onConfirm: () => void }) => {
  const [step, setStep] = useState("check")
  useEffect(() => {
    if (step === "check") setTimeout(() => setStep("shipping"), 2000)
    if (step === "paying") setTimeout(() => setStep("minting"), 2000)
    if (step === "minting") setTimeout(() => setStep("success"), 3000)
  }, [step])
  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] text-white flex flex-col">
      <div
        className="absolute right-0 p-6 z-50"
        style={{ top: 'max(0.5rem, calc(env(safe-area-inset-top, 0px) - 1rem))' }}
      >
        <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={20} /></button>
      </div>
      {step === "check" && <div className="flex-1 flex flex-col items-center justify-center p-8 text-center"><div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-6" /><h2 className="text-2xl font-bold mb-2">Verifying Eligibility</h2><p className="text-gray-400">Checking whitelist status and wallet age...</p></div>}
      {step === "shipping" && <div className="flex-1 flex flex-col p-6"><h2 className="text-3xl font-bold mb-2 pt-12">Where should we send your Node?</h2><p className="text-gray-400 mb-8">This pack includes physical hardware.</p><div className="space-y-4"><div className="bg-white/5 border border-white/10 p-4 rounded-xl"><label className="text-xs uppercase text-gray-500 font-bold block mb-2">Full Name</label><input type="text" defaultValue="Felix Chen" className="w-full bg-transparent text-white font-bold text-lg outline-none" /></div><div className="bg-white/5 border border-white/10 p-4 rounded-xl"><label className="text-xs uppercase text-gray-500 font-bold block mb-2">Shipping Address</label><input type="text" defaultValue="1288 Alberni St, Vancouver, BC" className="w-full bg-transparent text-white font-bold text-lg outline-none" /></div></div><div className="mt-auto"><div className="flex justify-between items-center mb-6 text-sm"><span className="text-gray-400">Hardware Delivery</span><span className="text-green-400 flex items-center gap-1"><Truck size={14} /> Est. 2 Weeks</span></div><button onClick={() => setStep("paying")} className="w-full bg-[#1562f0] py-4 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(21,98,240,0.4)]">Confirm & Pay $999</button></div></div>}
      {(step === "paying" || step === "minting") && <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden"><div className="absolute inset-0 opacity-20 bg-gradient-to-br from-blue-900/40 via-transparent to-purple-900/40 mix-blend-screen" /><div className="relative z-10 bg-black/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"><div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 mx-auto"><Cpu size={40} className="text-blue-400 animate-pulse" /></div><h2 className="text-3xl font-bold mb-2">{step === "paying" ? "Processing Payment" : "Minting Genesis NFT"}</h2><p className="text-gray-400 font-mono text-sm">{step === "paying" ? "Securing funds on Base L2..." : "Deploying contract 0x71...9a2"}</p></div></div>}
      {step === "success" && <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-blue-900/20 to-[#020617]"><div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.6)] flex items-center justify-center mb-8 rotate-12"><Server size={64} className="text-white" /></div><h1 className="text-4xl font-bold mb-2">Welcome, Node #248</h1><p className="text-gray-400 mb-8 max-w-xs">You are now a verified infrastructure partner of the Beamio Network.</p><div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-4 mb-8"><div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-500">Transaction</span><span className="font-mono text-blue-400">0x8a...2b9</span></div><div className="flex justify-between py-2"><span className="text-gray-500">Revenue Share</span><span className="text-green-400">Active</span></div></div><button onClick={onConfirm} className="w-full max-w-sm bg-white text-black py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors">Enter Dashboard</button></div>}
    </div>
  )
}

const ProductDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet }: { item: ViewingItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (item: ViewingItem) => void; onOpenWallet: () => void }) => {
  if (!item) return null
  const count = inventory.length
  const heroItem = item as HeroItem & { customGradient?: string }
  const isCashTrees = item.id === 201 || item.id === 202
  return (
    <div className="fixed inset-0 z-[80] bg-white overflow-y-auto flex flex-col">
      <div className="absolute top-0 inset-x-0 bg-black pointer-events-none" style={TOP_SAFE_FILL_STYLE} />
      <div
        className="absolute w-full p-4 flex justify-between items-center z-50"
        style={{ top: 'max(0.5rem, calc(env(safe-area-inset-top, 0px) - 1rem))' }}
      >
        <button onClick={onClose} className="w-9 h-9 bg-transparent rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/10 transition-colors border border-white/30"><X size={20} /></button>
        <button className="w-9 h-9 bg-transparent rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/10 transition-colors border border-white/30"><Share size={18} /></button>
      </div>
      <div className="relative w-full h-[45vh] shrink-0 bg-gray-900">
        {heroItem.image && <img src={heroItem.image} className="w-full h-full object-cover" alt={heroItem.title} />}
        {heroItem.customGradient ? (
          <div className="absolute inset-0" style={{ background: heroItem.customGradient }} />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-t ${heroItem.overlay || "from-black/80 via-transparent to-black/30"}`} />
        )}
        {isCashTrees && <img src={cashTreesLog} alt="CashTrees" className="absolute top-[2.25rem] left-[3.25rem] w-32 h-20 object-contain z-10 opacity-90 drop-shadow-md" />}
        <div className="absolute bottom-0 left-0 w-full p-6 text-white"><span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-3 inline-block bg-[#1562f0]">{heroItem.type || "Voucher"}</span><h1 className="text-4xl font-bold leading-tight mb-2 shadow-sm">{heroItem.title}</h1><p className="text-lg text-white/90 font-medium">{heroItem.merchant}</p></div>
      </div>
      <div className="flex-1 px-6 py-8 pb-32">
        {count > 0 && <div onClick={onOpenWallet} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1562f0] shadow-sm"><Wallet size={20} /></div><div><h4 className="text-sm font-bold text-gray-900">You have {count} cards</h4><p className="text-xs text-gray-500">Tap to Use, Gift or Trade</p></div></div><ChevronRight size={18} className="text-blue-400" /></div>}
        <div className="flex gap-6 mb-8 border-b border-gray-100 pb-8"><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500"><MapPin size={20} /></div><div><div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">Location</div><div className="text-sm font-semibold text-gray-900">{heroItem.location || "Online"}</div></div></div><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500"><ShieldCheck size={20} /></div><div><div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">Security</div><div className="text-sm font-semibold text-gray-900">Guaranteed</div></div></div></div>
        <h3 className="text-xl font-bold mb-3 text-gray-900">About</h3>
        <p className="leading-relaxed text-[17px] mb-8 text-gray-600">{heroItem.description}</p>
        {heroItem.features && <div className="rounded-2xl p-5 mb-8 bg-[#F2F2F7]"><h4 className="text-sm font-bold uppercase tracking-wide mb-4 text-gray-900">What&apos;s Included</h4><div className="space-y-3">{(heroItem.features ?? []).map((f: string, idx: number) => <div key={idx} className="flex items-center gap-3"><div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 bg-green-500"><Check size={12} strokeWidth={4} /></div><span className="font-medium text-gray-700">{f}</span></div>)}</div></div>}
      </div>
      <div className="fixed bottom-0 w-full max-w-md backdrop-blur-xl border-t bg-white/90 border-gray-200 p-5 pb-8 z-50 flex gap-3">
        {count > 0 ? <><button onClick={onOpenWallet} className="flex-1 border-2 px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2 bg-white border-gray-200 text-gray-900"><Wallet size={18} /> My Wallet <span className="text-xs px-1.5 py-0.5 rounded-md ml-1 bg-gray-200 text-gray-900">x{count}</span></button><button onClick={() => onBuy(item)} className="flex-[1.5] bg-[#1562f0] hover:bg-blue-600 text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">Buy Another <span className="opacity-80 font-medium text-xs ml-1">${item.price}</span></button></> : <div className="flex-1 flex gap-4 items-center"><div className="flex-1"><div className="text-xs uppercase font-bold text-gray-500">Total Price</div><div className="text-3xl font-bold tracking-tight text-gray-900">${item.price}</div></div><button onClick={() => onBuy(item)} className="bg-[#1562f0] text-white px-8 py-3.5 rounded-full font-bold text-[17px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">Purchase <ArrowRight size={20} /></button></div>}
      </div>
    </div>
  )
}

type MarketItem = {
  id: string
  category: string
  name: string
  fiatPrice: number
  fiatCurrency: string
  imageColor: string
  icon: React.ReactNode
  desc?: string
  type: string
  topUpOptions?: number[] | null
}

const MARKET_ITEMS: MarketItem[] = [
  {
    id: "m1",
    category: "membership",
    name: "CCSA Member Card",
    fiatPrice: 150,
    fiatCurrency: "CA$",
    imageColor: "bg-gradient-to-br from-purple-600 to-indigo-600",
    icon: <Store size={24} className="text-white" />,
    desc: "Unlock Exclusive Dining. First Partner: Osmanthus.",
    type: "Membership",
    topUpOptions: [50, 100, 200],
  },
  {
    id: "m3",
    category: "membership",
    name: "Elite Golf Pass",
    fiatPrice: 500,
    fiatCurrency: "CA$",
    imageColor: "bg-gradient-to-br from-emerald-600 to-teal-800",
    icon: <Store size={24} className="text-white" />,
    desc: "Access to 50+ Golf Courses",
    type: "Membership",
    topUpOptions: [100, 500],
  },
  {
    id: "m6",
    category: "membership",
    name: "Gamer Pro",
    fiatPrice: 60,
    fiatCurrency: "CA$",
    imageColor: "bg-gradient-to-br from-red-500 to-orange-600",
    icon: <Gamepad2 size={24} className="text-white" />,
    desc: "Monthly Game Credits",
    type: "Membership",
    topUpOptions: [60],
  },
  {
    id: "m2",
    category: "dining",
    name: "Starbucks",
    fiatPrice: 20,
    fiatCurrency: "CA$",
    imageColor: "bg-green-700",
    icon: <Coffee size={24} className="text-white" />,
    desc: "Coffee & Snacks",
    type: "Voucher",
    topUpOptions: [10, 20, 50],
  },
  {
    id: "m7",
    category: "dining",
    name: "Tim Hortons",
    fiatPrice: 15,
    fiatCurrency: "CA$",
    imageColor: "bg-red-700",
    icon: <Coffee size={24} className="text-white" />,
    desc: "Coffee & Donuts",
    type: "Voucher",
    topUpOptions: [15, 30],
  },
  {
    id: "m8",
    category: "dining",
    name: "Uber Eats",
    fiatPrice: 25,
    fiatCurrency: "CA$",
    imageColor: "bg-green-900",
    icon: <Utensils size={24} className="text-white" />,
    desc: "Food Delivery",
    type: "Voucher",
    topUpOptions: [25, 50, 100],
  },
  {
    id: "m4",
    category: "retail",
    name: "Whole Foods",
    fiatPrice: 50,
    fiatCurrency: "CA$",
    imageColor: "bg-blue-800",
    icon: <ShoppingCart size={24} className="text-white" />,
    desc: "Organic Groceries",
    type: "Voucher",
    topUpOptions: [50, 100],
  },
  {
    id: "m5",
    category: "services",
    name: "Uber Ride",
    fiatPrice: 25,
    fiatCurrency: "CA$",
    imageColor: "bg-slate-900",
    icon: <Car size={24} className="text-white" />,
    desc: "Ride Credits",
    type: "Voucher",
    topUpOptions: [25, 50, 100],
  },
  {
    id: "m9",
    category: "services",
    name: "Spotify",
    fiatPrice: 10,
    fiatCurrency: "CA$",
    imageColor: "bg-green-500",
    icon: <Music size={24} className="text-white" />,
    desc: "Premium Sub",
    type: "Voucher",
    topUpOptions: [10, 30, 60],
  },
  {
    id: "t1",
    category: "events",
    name: "Neon City Festival",
    fiatPrice: 150,
    fiatCurrency: "CA$",
    imageColor: "bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500",
    icon: <Music size={24} className="text-white" />,
    desc: "Weekend Pass • Sep 24-26",
    type: "Ticket",
    topUpOptions: null,
  },
]

export default function Market() {
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles, myAddress, setShowFooter, beamio } = useDaemonContext()
	const [myAssets, setMyAssets] = useState<Awaited<ReturnType<typeof getMyAssetsAggregated>> | null>(null)
	const [activeFilter, setActiveFilter] = useState<string | null>(null)
	const [showCardDetail, setShowCardDetail] = useState(false)
	const [overlayMode, setOverlayMode] = useState<"cardItem" | "cardDetail">("cardItem")
	const [settingsOpen, setSettingsOpen] = useState<"" | "USDCTopup" | "showPayQR">("")
	const [topupCardAddress, setTopupCardAddress] = useState<string>(INFRASTRUCTURE_CARD_ADDRESS)
	const [viewingItem, setViewingItem] = useState<ViewingItem | null>(null)
	const [inventory, setInventory] = useState<Record<number, InventoryInstance[]>>({})
	const [purchasingGenesis, setPurchasingGenesis] = useState(false)
	const [qrPayload, setQrPayload] = useState<string>("")
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)

	useEffect(() => {
		const state = location.state as { openCardDetail?: boolean } | null
		if (state?.openCardDetail) {
		setShowFooter(false)
		setOverlayMode("cardItem")
		setShowCardDetail(true)
		}
	}, [location.state, setShowFooter])

	useEffect(() => {
		if (settingsOpen !== "showPayQR") setQrPayload("")
	}, [settingsOpen])

	const flash = async () => {
		if (profiles?.length) {
		await new Promise((r) => setTimeout(r, 500))
		getMyAssetsAggregated(profiles[0])
			.then(setMyAssets)
			.catch((e) => console.warn(e))
		}
	}
	useEffect(() => {
		flash()
	}, [myAddress, profiles?.length])

	const numOfNfts = useMemo(() => {
		if (!myAssets?.nfts?.[0]) return 0
		return myAssets.nfts[0].tokenId ?? 0
	}, [myAssets])
	const isMember = useMemo(
		() => !!(myAssets?.nfts && myAssets.nfts.length > 0),
		[myAssets]
	)

	const membershipItems = useMemo(() => MARKET_ITEMS.filter((i) => i.category === "membership"), [])
	const eventsItems = useMemo(() => MARKET_ITEMS.filter((i) => i.category === "events"), [])
	const diningItems = useMemo(() => MARKET_ITEMS.filter((i) => i.category === "dining"), [])
	const retailItems = useMemo(() => MARKET_ITEMS.filter((i) => i.category === "retail"), [])
	const servicesItems = useMemo(() => MARKET_ITEMS.filter((i) => i.category === "services"), [])


	const closeCardDetail = () => {
		setShowCardDetail(false)
		setShowFooter(true)
		navigate(".", { replace: true, state: {} })
		flash()
	}

	const getOwnedInstances = (id: number): InventoryInstance[] => inventory[id] ?? []
	const openDetail = (item: ViewingItem) => setViewingItem(item)
	const initiatePurchase = (item: ViewingItem) => {
		if (item.id === 999) {
			setViewingItem(null)
			setPurchasingGenesis(true)
			return
		}
		if (getOwnedInstances(item.id).length > 0) {
			openDetail(item)
			return
		}
		if ((item as HeroItem).id === 101) {
			setViewingItem(null)
			setShowFooter(false)
			setOverlayMode("cardDetail")
			setShowCardDetail(true)
			return
		}
		// CashTrees cards: open detail modal to view/purchase
		if (item.id === 201 || item.id === 202) {
			openDetail(item)
			return
		}
		setViewingItem(null)
	}
	const finalizeGenesis = () => {
		setPurchasingGenesis(false)
		const newId = "#GN-" + (248 + getOwnedInstances(999).length)
		setInventory((prev) => ({ ...prev, 999: [...(prev[999] ?? []), { id: newId, date: "Just now", balance: "ACTIVE" }] }))
		setViewingItem(GENESIS_NODE_DATA)
	}

	const filteredItems = useMemo(() => {
		if (!activeFilter) return MARKET_ITEMS
		return MARKET_ITEMS.filter((i) => i.category === activeFilter)
	}, [activeFilter])

	return (
		<>
		<div className="w-full h-full min-h-0 h-screen bg-[#F2F2F7] overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] selection:bg-blue-100">
		{/* 固定独立胶囊：Title，与 /history 一致，随滚动渐隐 */}
		<div
			className="fixed left-0 right-0 z-30 flex items-center justify-between px-5 transition-opacity duration-300"
			style={{ top: 'max(1rem, env(safe-area-inset-top))', opacity: capsuleOpacity, pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
		>
			<div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
				<h1 className="text-lg font-bold text-black dark:text-slate-100 tracking-tight">Market</h1>
			</div>
		</div>

		{/* 滚动容器：与 Home 一致，flex-1 直接子元素 */}
		<div ref={setScrollRef} onScroll={onCapsuleScroll} className="flex-1 min-h-0 overflow-y-auto pb-24">
		{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离 */}
		<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 5rem)' }} />
		{/* HERO CARDS: CashTrees (ExampleCardNew StoryCard design) */}
		<div className="flex gap-4 overflow-x-auto px-5 pb-8 scrollbar-hide snap-x snap-mandatory">
			{CASH_TREES_COLLECTION.map((item) => (
				<StoryCard
					key={item.id}
					item={item}
					count={getOwnedInstances(item.id).length}
					onClick={openDetail}
					onBuy={(it) => initiatePurchase(it)}
				/>
			))}
		</div>

		<div className="h-px bg-gray-200 mx-5 mb-2" />

		{/* Browse by Category (ExampleCard style) */}
		<SectionHeader title="Browse by Category" />
		<div className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-hide">
			{CATEGORIES.map((cat) => (
				<button
					key={cat.id}
					type="button"
					onClick={() => {
						switch (cat.id) {
							case 'dining':
								navigate("/example-card-new")
								break
							case 'services':
								navigate("/transfertion")
								break
							case 'retail':
								navigate("/render-action")
								break
						}
					}}
					className={`flex flex-col items-center gap-2 min-w-[72px] active:opacity-60 transition-opacity shrink-0 ${
						activeFilter === cat.id ? "opacity-100" : ""
					}`}
				>
					<div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm ${
						activeFilter === cat.id ? "ring-2 ring-[#1562f0] ring-offset-2 " : ""
					}${cat.color}`}>
						{cat.icon}
					</div>
					<span className="text-[11px] font-semibold text-gray-500">{cat.name}</span>
				</button>
			))}
		</div>

		{/* Top Vouchers / Filtered List (ExampleCard list style) */}
		<SectionHeader
			title={activeFilter ? `${CATEGORIES.find((c) => c.id === activeFilter)?.name ?? "Items"}` : "Top Vouchers"}
		/>
		<div className="px-5 grid grid-cols-1 gap-y-0 bg-white rounded-[24px] shadow-sm divide-y divide-gray-100/80 mx-5 overflow-hidden">
			{(activeFilter ? filteredItems : []).slice(0, 8).map((item, index) => (
				<div
					key={item.id}
					className="flex items-center gap-4 p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group"
					onClick={() => {
						navigate("/example-card")
					}}
				>
					<div className="font-bold text-lg text-gray-300 w-4">{index + 1}</div>
					<div className={`w-14 h-14 rounded-[14px] ${item.imageColor} flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>
						{item.icon}
					</div>
					<div className="flex-1 min-w-0 pr-2">
						<div className="font-semibold text-gray-900 truncate text-[16px]">{item.name}</div>
						<div className="text-[13px] text-gray-500 mt-0.5">{item.type} • {item.fiatCurrency}{item.fiatPrice}</div>
					</div>
					<div className="flex flex-col items-end gap-1">
						<GetButton price={item.fiatPrice} onClick={() => {
							navigate("/example-card")
						}} />
					</div>
				</div>
			))}
		</div>

		<div className="px-8 pb-10 text-center mt-8">
			<p className="text-[10px] text-gray-400 leading-relaxed">
				Prices may vary by location. All assets are secured on Base Mainnet.<br />
				Beamio Inc. © 2026
			</p>
		</div>
		</div>
		</div>

		{showCardDetail && (
		<AnimatePresence>
			<motion.div
			key="card-detail-overlay"
			className="fixed inset-0 z-[99] bg-white dark:bg-slate-900 flex flex-col"
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			exit={{ x: "100%" }}
			transition={{ duration: 0.28, ease: "easeOut" }}
			onTouchMove={(e) => e.stopPropagation()}
			>
			<div
				className="absolute left-0 right-0 z-50 flex items-center justify-between px-5"
				style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
			>
				<button
					type="button"
					onClick={closeCardDetail}
					className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/70 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center text-slate-600 dark:text-slate-200 active:scale-95 transition-transform"
					aria-label="Back"
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<div className="w-12 h-12" aria-hidden />
			</div>
			<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
				{overlayMode === "cardItem" && isMember && myAssets != null ? (
				<CardItem cardItem={myAssets} />
				) : null}
				{overlayMode === "cardDetail" && (
					<CardDetail
						isMember={isMember}
						beamio={myAssets?.cardOwner ?? null}
						onPurchase={() => {
							setShowFooter(false)
							setTopupCardAddress(INFRASTRUCTURE_CARD_ADDRESS)
							setSettingsOpen("USDCTopup")
						}}
						onOpenWallet={isMember ? () => setOverlayMode("cardItem") : undefined}
					/>
				)}
			</div>
			</motion.div>
		</AnimatePresence>
		)}

			{/* Bottom Sheet：从底部向上，参考 Vouchers - PurchaseAccount / TopUpAccount */}
			<div
				className={[
					"fixed inset-0 z-[120]",
					settingsOpen ? "pointer-events-auto" : "pointer-events-none",
				].join(" ")}
			>
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						settingsOpen ? "opacity-100" : "opacity-0",
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen("")
						setQrPayload("")
					}}
					aria-hidden
				/>
				<div
					className={[
						"absolute inset-x-0 bottom-0 z-[121]",
						"transition-transform duration-300 ease-out",
						settingsOpen ? "translate-y-0" : "translate-y-full",
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					<div
						className={[
							"w-full",
							"bg-white dark:bg-slate-900",
							"rounded-t-[22px]",
							"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
							"h-auto",
							"pb-[env(safe-area-inset-bottom)]",
						].join(" ")}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto">
							{settingsOpen === "USDCTopup" && (
								topupCardAddress ? (
									<USDCUserCardTopupControl
										cardAddress={topupCardAddress}
										onClose={(val) => {
											if (val != null) {
												setMyAssets((prev) => (prev ? { ...prev, ...val } : val))
											}
											setSettingsOpen("")
											setShowFooter(true)
											closeCardDetail()
											flash()
										}}
									/>
								) : (
									<div className="p-6 text-sm text-rose-600">Card address is unavailable.</div>
								)
							)}
							{settingsOpen === "showPayQR" && (
								<ShowPayQR
									successUrl={"https://beamio.app?beamio=" + (beamio?.accountName || "")}
									beamio={beamio}
									qrValue={qrPayload || undefined}
								/>
							)}
						</div>
					</div>
				</div>
			</div>
		{/* Genesis + Hero detail modals (ExampleCard style) */}
		{viewingItem && viewingItem.id === 999 && (
			<GenesisDetailModal
				item={viewingItem}
				inventory={getOwnedInstances(999)}
				onClose={() => setViewingItem(null)}
				onBuy={() => { setViewingItem(null); navigate("/settings"); }}
				onOpenWallet={() => {}}
			/>
		)}
		{viewingItem && viewingItem.id === 998 && (
			<FuelPackDetailModal
				item={viewingItem}
				onClose={() => setViewingItem(null)}
				onBuy={() => setViewingItem(null)}
			/>
		)}
		{viewingItem && viewingItem.id !== 999 && viewingItem.id !== 998 && (
			<ProductDetailModal
				item={viewingItem}
				inventory={viewingItem.id === 101 ? (isMember ? [{ id: "#CCSA", date: "Active", balance: "Full" }] : []) : getOwnedInstances(viewingItem.id)}
				onClose={() => setViewingItem(null)}
				onBuy={(it) => {
					setViewingItem(null)
					setShowFooter(false)
					setTopupCardAddress(INFRASTRUCTURE_CARD_ADDRESS)
					setSettingsOpen("USDCTopup")
				}}
				onOpenWallet={viewingItem.id === 101 && isMember ? () => { setViewingItem(null); setOverlayMode("cardItem"); setShowCardDetail(true); setShowFooter(false); } : () => setViewingItem(null)}
			/>
		)}
		{purchasingGenesis && (
			<GenesisPurchaseModal
				item={GENESIS_NODE_DATA}
				onClose={() => setPurchasingGenesis(false)}
				onConfirm={finalizeGenesis}
			/>
		)}

		<style>{`
			.scrollbar-hide::-webkit-scrollbar { display: none; }
			.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
			@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
			@keyframes scan {
				0% { top: 0%; opacity: 0; }
				50% { opacity: 1; }
				100% { top: 100%; opacity: 0; }
			}
		`}</style>
		</>
	)
}
