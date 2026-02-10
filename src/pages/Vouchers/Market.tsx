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
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getMyAssets } from "@/services/BeamioCard"
import { CCSA_Card_Address } from "@/utils/constants"
import CCSACardVisual from "./CardVisual"
import BeamioNavBack from "@/components/Setting/BeamioNavBack"
import CardItem from "./CardItem"
import CardDetail from "./CardDetail"
import ccsabackphoto from "./assets/ccsacard.avif"
import PurchaseAccount from "./PurchaseAccount"
import TopUpAccount from "./TopUpAccount"
import ShowPayQR from "./showPayQR"
import { signOfflineTransferERC3009 } from "@/services/BeamioCard"

const THEME = {
  bg: "#F2F2F7",
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
    name: "CCSA Membership",
    fiatPrice: 100,
    fiatCurrency: "CA$",
    imageColor: "bg-gradient-to-br from-purple-600 to-indigo-600",
    icon: <Store size={24} className="text-white" />,
    desc: "Get CA$100 Credits + VIP Access",
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

const FILTER_TABS = [
  { label: "All", id: null as string | null },
  { label: "Memberships", id: "membership" },
  { label: "Events", id: "events" },
  { label: "Dining", id: "dining" },
  { label: "Retail", id: "retail" },
  { label: "Services", id: "services" },
]

export default function Market() {
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles, myAddress, setShowFooter, usdcbalance, beamio } = useDaemonContext()
	const [myAssets, setMyAssets] = useState<Awaited<ReturnType<typeof getMyAssets>> | null>(null)
	const [activeFilter, setActiveFilter] = useState<string | null>(null)
	const [, setViewAllCategory] = useState<{ id: string; title: string } | null>(null)
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

	const membershipItems = useMemo(
		() => MARKET_ITEMS.filter((i) => i.category === "membership"),
		[]
	)
	const eventsItems = useMemo(
		() => MARKET_ITEMS.filter((i) => i.category === "events"),
		[]
	)
	const diningItems = useMemo(
		() => MARKET_ITEMS.filter((i) => i.category === "dining"),
		[]
	)
	const retailItems = useMemo(
		() => MARKET_ITEMS.filter((i) => i.category === "retail"),
		[]
	)
	const servicesItems = useMemo(
		() => MARKET_ITEMS.filter((i) => i.category === "services"),
		[]
	)

	const onItemClick = (item: MarketItem) => {
		if (item.id === "m8" || item.name === "Uber Eats") {
			navigate("/vouchers-example")
			return
		}
		if (item.id === 'm9' || item.name === "Spotify") {
			navigate("/express")
			return
		}
		if (item.id === "m1" || item.name === "CCSA Membership") {
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
			navigate("/example-card")
			return
		}

		navigate("/settings", { state: { openPurchase: item.id } })
	}

	const MarketSection = ({
		title,
		items,
		limit = 5,
		showViewAll = false,
		onViewAll,
	}: {
		title: string
		items: MarketItem[]
		limit?: number
		showViewAll?: boolean
		onViewAll?: () => void
	}) => {
		const displayed = items.slice(0, limit)
		const hasMore = items.length > limit

		return (
		<div className="mb-8">
			<div className="px-4 sm:px-6 mb-3 flex justify-between items-center">
			<h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
				{title}
			</h3>
			{(showViewAll && onViewAll) || (hasMore && onViewAll) ? (
				<button
				type="button"
				onClick={onViewAll}
				className="text-[12px] font-bold text-blue-600 hover:underline"
				>
				View All
				</button>
			) : null}
			</div>
			<div className="flex overflow-x-auto gap-3 px-4 sm:px-6 pb-4 overflow-y-hidden">
			{displayed.map((item) => (
				<button
				key={item.id}
				type="button"
				onClick={() => onItemClick(item)}
				className="min-w-[160px] bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 text-left active:scale-[0.98] transition-transform"
				>
				<div
					className={`w-12 h-12 rounded-xl ${item.imageColor} flex items-center justify-center shadow-md`}
				>
					{item.icon}
				</div>
				<div className="min-w-0">
					<h4 className="font-bold text-slate-900 text-sm truncate">
					{item.name}
					</h4>
					<span className="text-xs font-bold text-slate-500">
					{item.fiatCurrency} {item.fiatPrice}
					</span>
				</div>
				</button>
			))}
			</div>
		</div>
		)
	}

	const closeCardDetail = () => {
		setShowCardDetail(false)
		setShowFooter(true)
		navigate(".", { replace: true, state: {} })
		flash()
	}

	return (
		<>
		<div
		className="min-h-full overflow-y-auto pb-24 pt-6"
		style={{ background: THEME.bg }}
		>
		{/* Header */}
		<div className="px-4 sm:px-6 pb-4 flex justify-between items-center">
			<h1 className="text-[28px] sm:text-3xl font-bold text-slate-900">
			Market
			</h1>
			<button
			type="button"
			aria-label="Search"
			className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600"
			>
			<Search size={20} />
			</button>
		</div>

		{/* Filter Tabs */}
		<div className="px-4 sm:px-6 mb-6 overflow-x-auto flex gap-2 pb-1 overflow-y-hidden">
			{FILTER_TABS.map((tab) => (
			<button
				key={tab.label}
				type="button"
				onClick={() => setActiveFilter(tab.id)}
				className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
				activeFilter === tab.id
					? "bg-slate-800 text-white"
					: "bg-white text-slate-500 shadow-sm"
				}`}
			>
				{tab.label}
			</button>
			))}
		</div>

		{/* MY CARDS */}
		<div className="mb-8">
			<div className="px-4 sm:px-6 mb-3 flex justify-between items-center">
			<h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
				MY CARDS
			</h3>
			<button
				type="button"
				className="text-[12px] font-bold text-blue-600 hover:underline"
				onClick={() => navigate("/settings")}
			>
				Manage
			</button>
			</div>
			{isMember ? (
			<div className="px-4 sm:px-6 flex justify-center overflow-x-auto gap-4 pb-4 overflow-y-hidden">
				<div className="min-w-[min(100%,320px)] max-w-[320px] shrink-0">
				<CCSACardVisual
					balance={Number(myAssets?.points ?? 0)}
					memberNo={numOfNfts.toString()}
					hasPass={false}
					showBuy={isMember ? "Member" : "join"}
					onCardClick={() => {
					setShowFooter(false)
					navigate("/settings", { state: { openCardDetail: true } })
					}}
					onQR={async () => {
						setShowFooter(false)
						if (!profiles?.[0]?.privateKeyArmor || !myAssets?.cardAddress) return
						try {
							const pointsHuman = (myAssets?.points ?? 0).toString()
							const data = await signOfflineTransferERC3009(
								profiles[0].privateKeyArmor,
								pointsHuman,
								myAssets.cardAddress
							)
							setQrPayload(JSON.stringify(data))
							setSettingsOpen("showPayQR")
						} catch (e) {
							console.error("signOfflineTransferERC3009 failed", e)
						}
					}}
					onBuy={() => {
					setShowFooter(false)
					navigate("/settings", { state: { openPurchase: "m1" } })
					}}
				/>
				</div>
			</div>
			) : (
			<div className="mx-4 sm:mx-6 p-6 bg-white rounded-2xl border-2 border-dashed border-slate-300 text-center">
				<div className="w-14 h-14 mx-auto rounded-2xl bg-slate-200 flex items-center justify-center text-slate-400 mb-3">
				<Ticket size={28} className="text-slate-400" />
				</div>
				<p className="text-slate-400 text-sm font-medium">
				Your card wallet is empty.
				</p>
			</div>
			)}
		</div>

		{/* PREMIER ACCESS */}
		<div className="mb-2">
			<h3 className="px-4 sm:px-6 text-[12px] font-bold text-slate-400 uppercase tracking-widest">
			PREMIER ACCESS
			</h3>
		</div>
		<div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-8 overflow-y-hidden">
			{membershipItems.map((item) => (
			<button
				key={item.id}
				type="button"
				onClick={() => onItemClick(item)}
				className={`min-w-[280px] h-[160px] rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between relative overflow-hidden text-left active:scale-[0.98] transition-transform bg-cover bg-center ${
				item.id === "m1" ? "" : item.imageColor
				}`}
				style={
				item.id === "m1"
					? { backgroundImage: `url(${ccsabackphoto})` }
					: undefined
				}
			>
				{item.id === "m1" && (
				<div className="absolute inset-0 bg-black/30 rounded-2xl z-0" aria-hidden />
				)}
				<div className="flex justify-between items-start z-10">
				<span className="font-bold text-lg opacity-90">{item.name}</span>
				{item.icon}
				</div>
				<div className="z-10">
				<div className="text-white/80 text-xs uppercase tracking-wide">
					Price
				</div>
				<div className="text-2xl font-bold">
					{item.fiatCurrency} {item.fiatPrice}
				</div>
				</div>
				<div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
			</button>
			))}
		</div>

		{/* EVENTS & TICKETS */}
		<MarketSection title="EVENTS & TICKETS" items={eventsItems} limit={6} />

		{/* DINING REWARDS */}
		<MarketSection
			title="DINING REWARDS"
			items={diningItems}
			limit={6}
			showViewAll
			onViewAll={() => setViewAllCategory({ id: "dining", title: "Dining Rewards" })}
		/>

		{/* RETAIL */}
		<MarketSection title="RETAIL" items={retailItems} limit={6} />

		{/* SERVICES */}
		<MarketSection title="SERVICES" items={servicesItems} limit={6} />
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
					<div className="pb-24 mt-12">
						<div className="px-4 pb-10 max-w-[420px] mx-auto">
						<CCSACardVisual
							balance={Number(myAssets?.points || 0)}
							memberNo={numOfNfts.toString()}
							hasPass={false}
							showBuy={isMember ? 'Member':'join'}
							
							onCardClick={() => {
								console.log("onCardClick")
							}}
							
						/>
						</div>
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
						/>
				</div>
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
							"shadow-[0_-12px_40px_rgba(0,0,0,0.18)]",
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
									defaultAmount={100}
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
		</>
	)
}
