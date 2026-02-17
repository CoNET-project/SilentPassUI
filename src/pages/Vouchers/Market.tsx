import React, { useState, useMemo, useEffect } from "react"
import {
  Search,
  Store,
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
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getMyAssets } from "@/services/BeamioCard"
import { CCSA_Card_Address } from "@/utils/constants"
import BeamioNavBack from "@/components/Setting/BeamioNavBack"
import CardItem from "./CardItem"
import CardDetail from "./CardDetail"
import PurchaseAccount from "./PurchaseAccount"
import TopUpAccount from "./TopUpAccount"
import ShowPayQR from "./showPayQR"
import { signOfflineTransferERC3009 } from "@/services/BeamioCard"

const THEME = { bg: "#F2F2F7" }

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
  features: GenesisFeature[]
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
}

const GENESIS_NODE_DATA: GenesisNodeData = {
  id: 999,
  tagline: "LIMITED EDITION",
  title: "Genesis Node Pack",
  subtitle: "Strictly limited to 300 visionary partners.",
  description: "Own the physical edge and the invisible engine of the Beamio network.",
  currentMint: 247,
  totalMint: 300,
  price: 999,
  type: "HARDWARE + NFT",
  image: "https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=800",
  features: [
    { title: "Dynamic E-ink Display", desc: "0.84mm flexible PCB. Auto-refreshes QR code every 60s.", icon: <Zap size={20} className="text-blue-400" /> },
    { title: "Military-Grade SE", desc: "EAL5+ certified chip for Account Abstraction keys.", icon: <ShieldCheck size={20} className="text-blue-400" /> },
    { title: "5% Protocol Revenue Share", desc: "Perpetual claim on 5% of all B-Units consumed across the global clearing network.", icon: <Check size={20} className="text-blue-400" /> },
  ],
}

const HERO_COLLECTION: HeroItem[] = [
  {
    id: 102,
    tagline: "LOCAL FAVORITE",
    title: "Sen Pho + Cafe Card",
    subtitle: "Redefining Vietnamese Cuisine",
    description: "Experience authentic Vietnamese cuisine at its finest. This membership is valid at both Champlain Heights and Kerrisdale locations, offering exclusive perks for loyal patrons.",
    features: ["10% Off All Orders", "Valid at Champlain Heights & Kerrisdale", "Priority Reservations", "Birthday Dessert"],
    image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
    merchant: "Sen Pho + Cafe",
    location: "Vancouver, BC",
    price: 99,
    type: "Membership",
    color: "text-white",
    overlay: "from-black/80 via-black/40 to-transparent",
  },
]

const GenesisCard = ({ data, onClick }: { data: GenesisNodeData; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="snap-center relative min-w-[320px] h-[420px] rounded-[32px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform duration-300 bg-black border border-gray-800 shadow-[0_0_40px_-10px_rgba(21,98,240,0.3)] shrink-0"
  >
    <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] to-black" />
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
    <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
      <div className="flex justify-between items-start">
        <span className="bg-[#0f172a] text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">
          {data.tagline}
        </span>
        <span className="text-white/60 font-mono text-xs font-medium tracking-wide">
          {data.currentMint} / {data.totalMint}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center py-4">
        <div className="relative w-48 h-32 bg-gradient-to-br from-gray-800 to-black rounded-xl shadow-2xl border border-gray-700 transform -rotate-12 group-hover:-rotate-6 transition-transform duration-500 flex items-center justify-center">
          <div className="absolute top-4 left-4 w-8 h-6 bg-gray-300 rounded-md opacity-80" />
          <Activity className="text-blue-500" size={32} />
          <div className="absolute bottom-4 right-4"><div className="text-[8px] text-white font-bold">B</div></div>
          <div className="absolute inset-0 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-4xl font-bold text-white leading-none tracking-tight mb-1">{data.title}</h2>
      </div>
      <div className="bg-[#1e293b]/50 backdrop-blur-md border border-gray-700 rounded-[20px] p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Mint Price</div>
          <div className="text-xl font-bold text-white flex items-baseline gap-1">
            ${data.price} <span className="text-xs text-gray-500 font-normal">USDC</span>
          </div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="bg-[#1562f0] hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors shadow-lg shadow-blue-500/20">
          View Specs
        </button>
      </div>
    </div>
  </div>
)

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
	const { profiles, myAddress, setShowFooter, usdcbalance, beamio } = useDaemonContext()
	const [myAssets, setMyAssets] = useState<Awaited<ReturnType<typeof getMyAssets>> | null>(null)
	const [activeFilter, setActiveFilter] = useState<string | null>(null)
	const [showCardDetail, setShowCardDetail] = useState(false)
	const [overlayMode, setOverlayMode] = useState<"cardItem" | "cardDetail">("cardItem")
	const [settingsOpen, setSettingsOpen] = useState<"" | "PurchaseAccount" | "TopUP" | "showPayQR">("")
	const [qrPayload, setQrPayload] = useState<string>("")

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
		getMyAssets(profiles[0], CCSA_Card_Address)
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

	const onItemClick = (item: MarketItem) => {
		if (item.id === "m8" || item.name === "Uber Eats") {
			navigate("/example-express")
			return
		}
		if (item.id === 'm9' || item.name === "Spotify") {
			navigate("/express")
			return
		}
		if (item.id === "m1" || item.name === "CCSA Member Card" || item.name === "CCSA Membership") {
			setShowFooter(false)
			if (isMember) {
				setOverlayMode('cardItem')
				setShowCardDetail(true)
				return
			}
			
			setOverlayMode("cardDetail")
			setShowCardDetail(true)
			return
		}
		if (item.id === "m5" || item.name === "Uber Ride") {
			setShowFooter(false)
			navigate("/example-card")

			return
		}
		if (item.id === "m4" || item.name === 'Whole Foods') {
			navigate("/redeem-onboarding")
			return
		}

		//navigate("/settings", { state: { openPurchase: item.id } })
	}

	const closeCardDetail = () => {
		setShowCardDetail(false)
		setShowFooter(true)
		navigate(".", { replace: true, state: {} })
		flash()
	}

	const filteredItems = useMemo(() => {
		if (!activeFilter) return MARKET_ITEMS
		return MARKET_ITEMS.filter((i) => i.category === activeFilter)
	}, [activeFilter])

	return (
		<>
		<div className="min-h-full overflow-y-auto pb-24 selection:bg-blue-100" style={{ background: THEME.bg }}>
		{/* Header - 对齐 Home：px-5 pt-14 pb-2 */}
		<div className="px-5 pt-14 pb-2 flex justify-between items-end bg-[#F2F2F7]/90 backdrop-blur-xl sticky top-0 z-40 border-b border-gray-200/50">
			<h1 className="text-[34px] font-bold text-black tracking-tight leading-none">Market</h1>
		</div>

		{/* Search Bar (ExampleCard style) */}
		<div className="px-5 mb-6">
			<div className="relative group active:scale-[0.99] transition-transform">
				<Search className="absolute left-3.5 top-3 text-gray-400" size={18} strokeWidth={2.5} />
				<input
					type="text"
					placeholder="Games, Food, Vouchers..."
					className="w-full bg-[#E3E3E8] py-2.5 pl-10 pr-4 rounded-[12px] text-[17px] focus:outline-none focus:bg-[#D1D1D6] transition-colors placeholder-gray-500 font-medium"
				/>
			</div>
		</div>

		{/* HERO CARDS: PREMIER ACCESS (ExampleCard style - horizontal snap scroll) */}
		<div className="flex gap-4 overflow-x-auto px-5 pb-8 scrollbar-hide snap-x snap-mandatory">
			{/* 1. Genesis Node Pack (ExampleCard GenesisCard design) */}
			<GenesisCard
				data={GENESIS_NODE_DATA}
				onClick={() => navigate("/example-card")}
			/>

			{/* 2. CCSA Member Card (ExampleCard Hero design) */}
			{membershipItems.filter((item) => item.id === "m1").map((item) => (
				<div
					key={item.id}
					role="button"
					tabIndex={0}
					onClick={() => onItemClick(item)}
					onKeyDown={(e) => e.key === "Enter" && onItemClick(item)}
					className="snap-center relative min-w-[320px] h-[420px] rounded-[32px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform duration-300 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] shrink-0"
				>
					<img src="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800" alt="CCSA Member Card" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
					<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
					<div className="absolute inset-0 p-6 flex flex-col justify-between">
						<div>
							<span className="text-blue-400 text-xs font-bold uppercase tracking-widest bg-black/40 backdrop-blur-md px-2 py-1 rounded-md inline-block">
								HAPPENING NOW
							</span>
							<h2 className="mt-2 text-4xl font-bold leading-[0.95] tracking-tight text-white drop-shadow-lg">
								CCSA Member Card
							</h2>
							<p className="mt-2 text-white/90 font-medium text-[15px] drop-shadow-md line-clamp-2 leading-snug">
								Unlock Exclusive Dining. First Partner: Osmanthus.
							</p>
						</div>
						<div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[20px] p-4 flex items-center justify-between">
							<div className="text-white">
								<div className="text-[11px] opacity-80 uppercase tracking-wide">Price</div>
								<div className="font-bold text-xl">{item.fiatCurrency}{item.fiatPrice}</div>
							</div>
							<div onClick={(e) => e.stopPropagation()}>
								<GetButton price={item.fiatPrice} count={isMember ? 1 : 0} onClick={() => onItemClick(item)} />
							</div>
						</div>
					</div>
				</div>
			))}

			{/* 3. Sen Pho + Cafe Card (ExampleCard Hero design) */}
			{HERO_COLLECTION.map((item) => (
				<div
					key={item.id}
					onClick={() => navigate("/example-card")}
					className="snap-center relative min-w-[320px] h-[420px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] cursor-pointer group active:scale-[0.98] transition-transform duration-300 shrink-0"
				>
					<img src={item.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.title} />
					<div className={`absolute inset-0 bg-gradient-to-t ${item.overlay}`} />
					<div className="absolute inset-0 p-6 flex flex-col justify-between">
						<div>
							<span className="text-blue-400 text-xs font-bold uppercase tracking-widest bg-black/40 backdrop-blur-md px-2 py-1 rounded-md inline-block">
								{item.tagline}
							</span>
							<h2 className={`mt-2 text-4xl font-bold leading-[0.95] tracking-tight ${item.color ?? "text-white"} drop-shadow-lg`}>
								{item.title}
							</h2>
							<p className="mt-2 text-white/90 font-medium text-[15px] drop-shadow-md line-clamp-2 leading-snug">
								{item.subtitle}
							</p>
						</div>
						<div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[20px] p-4 flex items-center justify-between">
							<div className="text-white">
								<div className="text-[11px] opacity-80 uppercase tracking-wide">Price</div>
								<div className="font-bold text-xl">CA${item.price}</div>
							</div>
							<div onClick={(e) => e.stopPropagation()}>
								<GetButton price={item.price} onClick={() => navigate("/example-card")} />
							</div>
						</div>
					</div>
				</div>
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
					onClick={() => setActiveFilter(activeFilter === cat.id ? null : cat.id)}
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
					onClick={() => onItemClick(item)}
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
						<GetButton price={item.fiatPrice} onClick={() => onItemClick(item)} />
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

		{showCardDetail && (
		<AnimatePresence>
			<motion.div
			key="card-detail-overlay"
			className="fixed inset-0 z-[99] bg-white dark:bg-slate-900 flex flex-col pt-[env(safe-area-inset-top)]"
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			exit={{ x: "100%" }}
			transition={{ duration: 0.28, ease: "easeOut" }}
			onTouchMove={(e) => e.stopPropagation()}
			>
			<BeamioNavBack
				title=""
				onClose={closeCardDetail}
				onMore={() => {}}
			/>
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
							if (isMember) {
								setSettingsOpen("TopUP")
								return
							}
							setSettingsOpen("PurchaseAccount")
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
							{settingsOpen === "PurchaseAccount" && (
								<PurchaseAccount
									flow="PURCHASE"
									beamioBalanceText={`Balance: ${usdcbalance.toFixed(2)} USDC`}
									defaultAmount={150}
									purchasePrice={0.01}
									cardOwner={myAssets?.cardOwner ?? null}
									onClose={(val) => {
										if (val != null) {
											setMyAssets((prev) => (prev ? { ...prev, ...val } : null))
										}
										setSettingsOpen("")
										setShowFooter(true)
										closeCardDetail()
										flash()
									}}
								/>
							)}
							{settingsOpen === "TopUP" && myAssets != null && (
								<TopUpAccount
									beamioBalanceText={`Balance: ${usdcbalance.toFixed(4)} USDC`}
									myAssets={myAssets}
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
		<style>{`
			.scrollbar-hide::-webkit-scrollbar { display: none; }
			.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
		`}</style>
		</>
	)
}
