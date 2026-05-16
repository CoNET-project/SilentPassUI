import React, { useState, useMemo, useEffect } from "react"
import {
  ChevronRight,
  Server,
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
	ShoppingBag,
	UtensilsCrossed,
	ShoppingCart,
	GraduationCap,
	HeartPulse,
	Dumbbell,
	Clapperboard,
	Building2,
	Gift,
	Star,
	Search,
	Mic,
	Coffee,
	Heart,
	Medal,
	Sparkles,
	PlusCircle,
	Radio,
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ethers } from "ethers"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { beamioApi } from "@/utils/constants"
import { currencyAmountToSafeUsdc6, getMyAssetsAggregated, getMyAssets, getCardTiersFromContract, getCardUpgradeTypeFromContract, getCardMetadataFromApi, getCardMetadataFromUri, quoteUSDCToCAD, postUSDCUserCardTopup, safeUsdc6ToAmountString } from "@/services/BeamioCard"
import { fiatPrefix } from "@/services/currency"
import { BEAMIO_USER_CARD_ASSET_ADDRESS } from "@/config/chainAddresses"
import CardItem from "./CardItem"
import CardDetail from "./CardDetail"
import USDCUserCardTopupControl from "./USDCUserCardTopupControl"
import ShowPayQR from "./showPayQR"
import greenCard from "./assets/greenCard.png"
import blackCard from "./assets/BlackCard.png"

const TOP_SAFE_FILL_STYLE = { height: "max(env(safe-area-inset-top, 0px), 16px)" }
/** Card address for USDC Top Up panel (CashTrees card, from chainAddresses). */
const USDC_TOPUP_CARD_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS

const DISCOVER_LATEST_CARDS_LIMIT = 20
/** 进入 Market 页面立即展示已 cache 的 Trending Now，避免 API 504 / 超时时永远 loading */
const TRENDING_CACHE_VERSION = 3
const TRENDING_CACHE_KEY = `beamio:trending:latestCards:v${TRENDING_CACHE_VERSION}:limit${DISCOVER_LATEST_CARDS_LIMIT}`
/** /api/latestCards 实测可能 504 / 60s+ 挂起，给出明确超时；超时按 untrusted 处理，不清空已显示的 trusted rows */
const TRENDING_FETCH_TIMEOUT_MS = 12_000

/**
 * Discover merchant visibility:
 * - Cards with DB `created_at` **before** this instant (legacy): only show if `card_owner` is `DISCOVER_LEGACY_ALLOWED_CARD_OWNER`.
 * - Cards with `created_at` **at or after** this instant: show (new registrations not subject to legacy mask).
 * **Keep in sync with** `src/x402sdk/src/endpoint/latestCardsShared.ts` (`DISCOVER_NEW_MERCHANTS_UNFILTERED_SINCE_MS` + same EOA).
 */
const DISCOVER_NEW_MERCHANTS_UNFILTERED_SINCE_MS = Date.parse("2026-05-14T00:00:00.000Z")
const DISCOVER_LEGACY_ALLOWED_CARD_OWNER_LOWER = ethers.getAddress(
	"0xda2c9e028d7df4338763e1e14b081ae7316b803a"
).toLowerCase()

/** When `merchantImage` is absent in metadata, Discover row hero uses alternating stock photos. */
const DISCOVER_FEATURE_FALLBACK_IMAGES = [
	"https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
] as const

type DiscoverLatestCardRow = {
	cardAddress: string
	/** `beamio_cards.card_owner` from `/api/latestCards` (EOA). */
	cardOwner: string | null
	/** `beamio_cards.created_at` ISO from API — legacy vs new-merchant cutover. */
	createdAt: string | null
	name: string
	/** Owner business metadata (e.g. `storeName`) for Discover title display. */
	businessName: string | null
	/** Share / brand image — shown as logo (top-left on card face). */
	logoUrl: string | null
	/** Highest tier (`minUsdc6` max) CSS background from metadata.tiers. */
	tierTopBackground: string | null
	programDescription: string
	currency: string
	holderCount: number
	/** Highest tier by max `minUsdc6` from metadata.tiers */
	topTierName: string | null
	/** Listing currency prefix + formatted threshold from max `minUsdc6` */
	topTierMinDisplay: string | null
	/** First id from `shareTokenMetadata.categories` (biz `CARD_ISSUANCE_CATEGORY_OPTIONS` ids). */
	categoryId: string | null
	/** Points / program ticker: `shareTokenMetadata.Symbol`|`symbol`, else metadata top-level (biz `parseFixedUserCardMetadata`). */
	symbol: string | null
	/** bizSite Define your brand — `merchantImage` (wide hero), not square program logo. */
	merchantImage: string | null
}

type DiscoverCategoryTab =
	| "food-beverage"
	| "grocery-convenience"
	| "retail-shopping"
	| "education-training"
	| "health-beauty"
	| "fitness-wellness"
	| "entertainment-leisure"
	| "local-services"

type DiscoverCategoryOption = { id: DiscoverCategoryTab; label: string; Icon: typeof Building2 }

const DISCOVER_CATEGORY_OPTIONS: DiscoverCategoryOption[] = [
	{ id: "food-beverage", label: "Food & Beverage", Icon: UtensilsCrossed },
	{ id: "grocery-convenience", label: "Grocery & Convenience", Icon: ShoppingCart },
	{ id: "retail-shopping", label: "Retail & Shopping", Icon: ShoppingBag },
	{ id: "education-training", label: "Education & Training", Icon: GraduationCap },
	{ id: "health-beauty", label: "Health & Beauty", Icon: HeartPulse },
	{ id: "fitness-wellness", label: "Fitness & Wellness", Icon: Dumbbell },
	{ id: "entertainment-leisure", label: "Entertainment & Leisure", Icon: Clapperboard },
	{ id: "local-services", label: "Local Services", Icon: Building2 },
]

type DiscoverFeaturedCard = {
	id: string
	cardAddress: string | null
	category: DiscoverCategoryTab
	title: string
	subtitle: string
	assetLabel: string
	rating: string
	image: string
	logo: string | null
	/** Card program currency (from latestCards row). */
	currency: string
}

function classifyDiscoverCardCategory(card: DiscoverLatestCardRow): DiscoverCategoryTab {
	const name = card.name.toLowerCase()
	const description = card.programDescription.toLowerCase()
	const category = (card.categoryId ?? "").toLowerCase()
	if (category === "food-beverage") return "food-beverage"
	if (category === "grocery-convenience") return "grocery-convenience"
	if (category === "retail-shopping" || category === "shopping") return "retail-shopping"
	if (category === "education-training") return "education-training"
	if (category === "health-beauty") return "health-beauty"
	if (category === "fitness-wellness") return "fitness-wellness"
	if (category === "entertainment-leisure" || category === "movies") return "entertainment-leisure"
	if (category === "local-services") return "local-services"
	if (/grocery|supermarket|mart|convenience|store/.test(name) || /grocery|supermarket|mart|convenience|store/.test(description)) {
		return "grocery-convenience"
	}
	if (/retail|shopping|fashion|boutique|mall/.test(name) || /retail|shopping|fashion|boutique|mall/.test(description)) {
		return "retail-shopping"
	}
	if (/education|school|academy|training|course|lesson/.test(name) || /education|school|academy|training|course|lesson/.test(description)) {
		return "education-training"
	}
	if (/beauty|spa|salon|health|clinic|wellness/.test(name) || /beauty|spa|salon|health|clinic|wellness/.test(description)) {
		return "health-beauty"
	}
	if (/gym|fitness|yoga|pilates|workout/.test(name) || /gym|fitness|yoga|pilates|workout/.test(description)) {
		return "fitness-wellness"
	}
	if (/movie|cinema|game|gaming|theater|entertainment|leisure/.test(name) || /movie|cinema|game|gaming|theater|entertainment|leisure/.test(description)) {
		return "entertainment-leisure"
	}
	if (
		category === "food" ||
		/dining|restaurant|kitchen|bistro|steak|bar|wine|noodle|pho/.test(name) ||
		/dining|restaurant|kitchen|bistro|steak|bar|wine|noodle|pho/.test(description)
	) {
		return "food-beverage"
	}
	if (
		/cof|cafe|roast|espresso|latte/.test(name) ||
		/cof|cafe|roast|espresso|latte/.test(description)
	) {
		return "food-beverage"
	}
	return "local-services"
}

/** Only allow safe inline style colors (hex / rgb / rgba). */
function discoverSafeCssColor(raw: string | null | undefined): string | null {
	if (raw == null || typeof raw !== "string") return null
	const t = raw.trim()
	if (!t) return null
	if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t)) return t
	if (/^rgba?\(/i.test(t)) return t
	return null
}


/** Parse metadata.tiers: highest tier = max `minUsdc6` (aligned with on-chain `_findBestValidMembership`). */
function parseDiscoverTiersFromMeta(meta: Record<string, unknown> | null): {
	tierTopBackground: string | null
	topTierName: string | null
	topTierMinUsdc6: bigint | null
} {
	const empty = { tierTopBackground: null, topTierName: null, topTierMinUsdc6: null }
	if (meta == null) return empty
	const raw = meta.tiers
	if (!Array.isArray(raw) || raw.length === 0) return empty
	type Row = { minUsdc6: bigint; background: string | null; name: string | null }
	const rows: Row[] = []
	for (const item of raw) {
		if (item == null || typeof item !== "object") continue
		const o = item as Record<string, unknown>
		const minRaw = o.minUsdc6 ?? o.min_usdc6
		let minUsdc6 = 0n
		try {
			if (typeof minRaw === "bigint") minUsdc6 = minRaw
			else if (typeof minRaw === "number" && Number.isFinite(minRaw)) minUsdc6 = BigInt(Math.trunc(minRaw))
			else if (typeof minRaw === "string" && minRaw.trim()) minUsdc6 = BigInt(minRaw.trim())
		} catch {
			minUsdc6 = 0n
		}
		const nested =
			o.properties != null && typeof o.properties === "object"
				? (o.properties as Record<string, unknown>)
				: null
		const nameRaw = o.name ?? nested?.name
		const tierName =
			typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null
		const bgRaw =
			o.backgroundColor ??
			o.background_color ??
			nested?.background_color ??
			nested?.backgroundColor
		const background =
			typeof bgRaw === "string" && bgRaw.trim()
				? discoverSafeCssColor(bgRaw)
				: null
		rows.push({ minUsdc6, background, name: tierName })
	}
	if (rows.length === 0) return empty
	let bestMin = -1n
	for (const row of rows) {
		if (row.minUsdc6 > bestMin) bestMin = row.minUsdc6
	}
	const top = rows.filter((row) => row.minUsdc6 === bestMin)
	let tierTopBackground: string | null = null
	for (let i = top.length - 1; i >= 0; i--) {
		if (top[i].background) {
			tierTopBackground = top[i].background
			break
		}
	}
	let topTierName: string | null = null
	for (const row of top) {
		if (row.name) {
			topTierName = row.name
			break
		}
	}
	return {
		tierTopBackground,
		topTierName,
		topTierMinUsdc6: bestMin >= 0n ? bestMin : null,
	}
}

/** Align x402sdk `shareTokenMetadata.categories` + biz `CARD_ISSUANCE_CATEGORY_OPTIONS` ids. */
function parseDiscoverPrimaryCategoryId(meta: Record<string, unknown> | null): string | null {
	if (meta == null) return null
	const share =
		meta.shareTokenMetadata != null && typeof meta.shareTokenMetadata === "object"
			? (meta.shareTokenMetadata as Record<string, unknown>)
			: null
	const raw = share?.categories
	if (!Array.isArray(raw) || raw.length === 0) return null
	for (const c of raw) {
		if (typeof c === "string" && c.trim()) return c.trim().toLowerCase()
	}
	return null
}

/** Align biz `parseFixedUserCardMetadata` currencySymbol sources. */
function parseDiscoverCardSymbol(meta: Record<string, unknown> | null): string | null {
	if (meta == null) return null
	const share =
		meta.shareTokenMetadata != null && typeof meta.shareTokenMetadata === "object"
			? (meta.shareTokenMetadata as Record<string, unknown>)
			: null
	const order: unknown[] = [
		share?.Symbol,
		share?.symbol,
		meta.Symbol,
		meta.symbol,
	]
	for (const v of order) {
		if (typeof v === "string" && v.trim()) return v.trim()
	}
	return null
}

function readDiscoverNestedObject(
	base: Record<string, unknown> | null,
	key: string
): Record<string, unknown> | null {
	if (!base) return null
	const v = base[key]
	return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function readDiscoverStringField(
	base: Record<string, unknown> | null,
	keys: string[]
): string | null {
	if (!base) return null
	for (const k of keys) {
		const v = base[k]
		if (typeof v === "string" && v.trim()) return v.trim()
	}
	return null
}

/** Prefer owner business metadata store name (biz `Business Name`), then common brand/title aliases. */
function parseDiscoverBusinessName(meta: Record<string, unknown> | null): string | null {
	if (!meta) return null
	const share = readDiscoverNestedObject(meta, "shareTokenMetadata")
	const businessMetadata = readDiscoverNestedObject(meta, "businessMetadata")
	const businessProfile = readDiscoverNestedObject(meta, "businessProfile")
	const ownerBusinessMetadata = readDiscoverNestedObject(meta, "ownerBusinessMetadata")
	const cardBusiness = readDiscoverNestedObject(meta, "businessCard")
	return (
		readDiscoverStringField(ownerBusinessMetadata, ["storeName", "businessName"]) ??
		readDiscoverStringField(businessMetadata, ["storeName", "businessName"]) ??
		readDiscoverStringField(businessProfile, ["storeName", "businessName"]) ??
		readDiscoverStringField(cardBusiness, ["storeName", "businessName", "merchantName", "brandName"]) ??
		readDiscoverStringField(share, ["storeName", "businessName", "merchantName", "brandName", "displayName"]) ??
		readDiscoverStringField(meta, ["storeName", "businessName", "merchantName", "brandName", "displayName"])
	)
}

/**
 * bizSite **Define your brand** → Merchant image, stored on program metadata as `merchantImage`
 * (wide scene / storefront — not the square program `image` used for logoUrl).
 */
function parseDiscoverMerchantImage(meta: Record<string, unknown> | null): string | null {
	if (!meta) return null
	const share = readDiscoverNestedObject(meta, "shareTokenMetadata")
	const ownerBusinessMetadata = readDiscoverNestedObject(meta, "ownerBusinessMetadata")
	const businessMetadata = readDiscoverNestedObject(meta, "businessMetadata")
	const businessProfile = readDiscoverNestedObject(meta, "businessProfile")
	return (
		readDiscoverStringField(meta, ["merchantImage", "merchant_image"]) ??
		readDiscoverStringField(share, ["merchantImage", "merchant_image"]) ??
		readDiscoverStringField(ownerBusinessMetadata, ["merchantImage", "merchant_image"]) ??
		readDiscoverStringField(businessMetadata, ["merchantImage", "merchant_image"]) ??
		readDiscoverStringField(businessProfile, ["merchantImage", "merchant_image"])
	)
}

/** latestCards `holderCount`：链上 totalActiveMemberships 与 getGlobalStatsFull 回退，非 ERC-1155 #0 唯一地址枚举 */
function formatDiscoverHoldersCount(n: number): string {
	if (!Number.isFinite(n) || n < 0) return "0"
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.trunc(n))
}

function discoverCreatedAtMs(iso: string | null | undefined): number | null {
	if (iso == null || typeof iso !== "string") return null
	const t = Date.parse(iso.trim())
	return Number.isFinite(t) ? t : null
}

/** Legacy rows (created before cutover) only if owned by the allowed EOA; newer rows always pass. */
function passDiscoverMerchantOwnerPolicy(row: DiscoverLatestCardRow): boolean {
	const createdMs = discoverCreatedAtMs(row.createdAt)
	if (createdMs != null && createdMs >= DISCOVER_NEW_MERCHANTS_UNFILTERED_SINCE_MS) return true
	if (!row.cardOwner) return false
	return row.cardOwner.toLowerCase() === DISCOVER_LEGACY_ALLOWED_CARD_OWNER_LOWER
}

function applyDiscoverMerchantOwnerFilter(rows: DiscoverLatestCardRow[]): DiscoverLatestCardRow[] {
	return rows.filter(passDiscoverMerchantOwnerPolicy)
}

function parseDiscoverLatestCardItem(raw: unknown): DiscoverLatestCardRow | null {
	if (raw == null || typeof raw !== "object") return null
	const r = raw as Record<string, unknown>
	const addr = String(r.cardAddress ?? "").trim()
	if (!addr || !ethers.isAddress(addr)) return null
	const meta = r.metadata != null && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : null
	const share =
		meta?.shareTokenMetadata != null && typeof meta.shareTokenMetadata === "object"
			? (meta.shareTokenMetadata as Record<string, unknown>)
			: null
	const name = String(share?.name ?? meta?.name ?? "User Card").trim() || "User Card"
	const imageRaw = share?.image ?? meta?.image
	const logoUrl = typeof imageRaw === "string" && imageRaw.trim() ? imageRaw.trim() : null
	const currency = String(r.currency ?? "USD").toUpperCase()
	const { tierTopBackground, topTierName, topTierMinUsdc6 } = parseDiscoverTiersFromMeta(meta)
	const topTierMinDisplay =
		topTierMinUsdc6 != null
			? `${fiatPrefix(currency as Parameters<typeof fiatPrefix>[0])}${Number(ethers.formatUnits(topTierMinUsdc6, 6)).toFixed(2)}`
			: null
	const descRaw = share?.description ?? meta?.description
	const programDescription =
		typeof descRaw === "string" ? descRaw.trim() : ""
	const holderRaw = r.holderCount ?? r.holder_count
	const holderN =
		typeof holderRaw === "string"
			? Number(holderRaw.trim())
			: typeof holderRaw === "number"
				? holderRaw
				: Number(holderRaw ?? 0)
	const categoryId = parseDiscoverPrimaryCategoryId(meta)
	const symbol = parseDiscoverCardSymbol(meta)
	const businessName = parseDiscoverBusinessName(meta)
	const merchantImage = parseDiscoverMerchantImage(meta)
	const ownerRaw = r.cardOwner ?? r.card_owner
	let cardOwner: string | null = null
	if (typeof ownerRaw === "string" && ownerRaw.trim() && ethers.isAddress(ownerRaw.trim())) {
		try {
			cardOwner = ethers.getAddress(ownerRaw.trim())
		} catch {
			cardOwner = null
		}
	}
	const createdRaw = r.createdAt ?? r.created_at
	const createdAt =
		typeof createdRaw === "string" && createdRaw.trim()
			? createdRaw.trim()
			: createdRaw instanceof Date
				? createdRaw.toISOString()
				: null
	return {
		cardAddress: ethers.getAddress(addr),
		cardOwner,
		createdAt,
		name,
		businessName,
		logoUrl,
		tierTopBackground,
		programDescription,
		currency,
		holderCount: Number.isFinite(holderN) ? Math.max(0, Math.trunc(holderN)) : 0,
		topTierName,
		topTierMinDisplay,
		categoryId,
		symbol,
		merchantImage,
	}
}

/**
 * 本地 trusted cache for Trending Now。
 * 仅在「请求 trusted 成功 + items 非空」才写；untrusted（超时 / abort / 非 2xx / 解析失败）一律不写、不清。
 * 读时做 schema 兜底校验，避免 cache 文件被外部破坏导致渲染崩。
 */
function loadCachedTrendingRows(): DiscoverLatestCardRow[] | null {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem(TRENDING_CACHE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { rows?: unknown }
		if (!Array.isArray(parsed?.rows)) return null
		const safe = (parsed.rows as unknown[]).filter((r): r is DiscoverLatestCardRow => {
			if (r == null || typeof r !== "object") return false
			const o = r as Record<string, unknown>
			return (
				typeof o.cardAddress === "string" &&
				ethers.isAddress(o.cardAddress) &&
				typeof o.name === "string"
			)
		})
		const gated = applyDiscoverMerchantOwnerFilter(safe)
		return gated.length > 0 ? gated : null
	} catch {
		return null
	}
}

function saveCachedTrendingRows(rows: DiscoverLatestCardRow[]): void {
	if (typeof window === "undefined") return
	if (!rows || rows.length === 0) return
	try {
		window.localStorage.setItem(
			TRENDING_CACHE_KEY,
			JSON.stringify({ rows, savedAt: Date.now() })
		)
	} catch {
		/* localStorage 满 / 隐私模式：忽略，下一次请求成功还会再写 */
	}
}

/** Browse / Top Vouchers removed — empty list so stale HMR chunks never throw ReferenceError on `MARKET_ITEMS`. */
const MARKET_ITEMS: unknown[] = []

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
  currency?: "CAD" | "USD" | "EUR" | "JPY" | "CNY" | "HKD" | "SGD" | "TWD"
  partners?: { name: string; icon: string; bg: string }[]
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
  { id: 101, tagline: "HAPPENING NOW", title: "CCSA Member Card", subtitle: "Unlock Exclusive Dining. First Partner: Osmanthus.", description: "Your gateway to a curated network of premier restaurants. Start your journey at Osmanthus, our inaugural partner, with exclusive perks and stored value acceptance.", features: ["Accepted at Osmanthus & Future Partners", "Priority Booking at Osmanthus", "Member-Only Tasting Menus", "Future Network Expansion"], image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800", merchant: "CCSA Alliance", location: "Aberdeen Centre, Richmond, BC", price: 150, type: "Membership", color: "text-white", overlay: "from-black/60 via-black/10 to-transparent", currency: "CAD", partners: [{ name: "Osmanthus", icon: "🌸", bg: "bg-yellow-100" }, { name: "Sen Pho", icon: "🍜", bg: "bg-orange-100" }, { name: "Longdhang", icon: "🥟", bg: "bg-red-100" }, { name: "More", icon: "+18", bg: "bg-gray-100 text-xs font-bold" }] },
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
    currency: "CAD",
  },
]

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
type PurchaseModalItem = ViewingItem & { minPrice?: number; maxPrice?: number; isVariablePrice?: boolean }

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

const ProductDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet, canUpgrade = true }: { item: ViewingItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (item: ViewingItem) => void; onOpenWallet: () => void; canUpgrade?: boolean }) => {
  if (!item) return null
  const count = inventory.length
  const heroItem = item as HeroItem & { customGradient?: string }
  const isCashTrees = item.id === 201 || item.id === 202
  const ownsCardNoUpgrade = isCashTrees && count > 0 && !canUpgrade
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
        {isCashTrees ? (
          <>
            <div className="absolute inset-0 bg-[#ECECF1] flex items-center justify-center px-6">
              <img
                src={heroItem.id === 202 ? greenCard : blackCard}
                alt={heroItem.title}
                className="w-full max-w-[420px] object-contain rounded-[22px] shadow-[0_28px_55px_rgba(2,6,23,0.38),0_10px_22px_rgba(2,6,23,0.22)]"
                draggable={false}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          </>
        ) : (
          <>
            {heroItem.image && <img src={heroItem.image} className="w-full h-full object-cover" alt={heroItem.title} />}
            {heroItem.customGradient ? (
              <div className="absolute inset-0" style={{ background: heroItem.customGradient }} />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-t ${heroItem.overlay || "from-black/80 via-transparent to-black/30"}`} />
            )}
          </>
        )}
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
        {ownsCardNoUpgrade ? (
          <button onClick={() => onBuy(item)} className="flex-1 bg-[#1562f0] hover:bg-blue-600 text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">Topup</button>
        ) : count > 0 ? (
          <button onClick={() => onBuy(item)} className="flex-1 bg-[#1562f0] hover:bg-blue-600 text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">Reload</button>
        ) : (
          <div className="flex-1 flex gap-4 items-center"><div className="flex-1"><div className="text-xs uppercase font-bold text-gray-500">Min. Load</div><div className="text-3xl font-bold tracking-tight text-gray-900">${item.price}</div></div><button onClick={() => onBuy(item)} className="bg-[#1562f0] text-white px-8 py-3.5 rounded-full font-bold text-[17px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">Purchase <ArrowRight size={20} /></button></div>
        )}
      </div>
    </div>
  )
}

type ProfileForTopup = { keyID?: string | null; aaAccount?: string | null; privateKeyArmor?: string | null }

const PurchaseCreditsSheet = ({
  open,
  item,
  ownsCard,
  cardAddress,
  profile,
  onClose,
  onSuccess,
}: {
  open: boolean
  item: PurchaseModalItem | null
  ownsCard: boolean
  cardAddress: string
  profile: ProfileForTopup | null | undefined
  onClose: () => void
  onSuccess?: (assets?: unknown) => void
}) => {
  const [amountText, setAmountText] = useState("")
  const [upgradeCapsule, setUpgradeCapsule] = useState<{ amountNeededCad: number; nextTierName: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const { minAmount, maxAmount, quickOptions } = useMemo(() => {
    const max = item?.maxPrice != null ? Number(item.maxPrice) : undefined
    const quickOptions = [50, 100, 200]
    const min = ownsCard ? 0.01 : 50
    return { minAmount: min, maxAmount: max, quickOptions }
  }, [item, ownsCard])

  useEffect(() => {
    if (!open) return
    if (!item) {
      setAmountText("")
      return
    }
    setAmountText(String(item.price ?? 50))
    setSubmitError("")
  }, [open, item, minAmount])

  useEffect(() => {
    if (!open || !ownsCard || !cardAddress || !profile?.keyID || !item) {
      setUpgradeCapsule(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const [contractTiers, meta, assets, upgradeType] = await Promise.all([
          getCardTiersFromContract(cardAddress),
          getCardMetadataFromApi(cardAddress).then((m) => m ?? getCardMetadataFromUri(cardAddress)),
          getMyAssets(profile as Parameters<typeof getMyAssets>[0], cardAddress),
          getCardUpgradeTypeFromContract(cardAddress),
        ])
        if (cancelled) return
        if (contractTiers.length === 0 || !assets) {
          setUpgradeCapsule(null)
          return
        }
        if (upgradeType === 2) {
          setUpgradeCapsule(null)
          return
        }
        const nfts = (assets.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
        const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
        const rawTier = bestNft?.tier
        const currentTierIdx = rawTier != null && rawTier !== "Default/Max" ? Number(rawTier) : -1
        const currentPoints = Number(assets.points ?? 0)

        const sortedTiers = [...contractTiers].sort((a, b) => Number(BigInt(a.minUsdc6) - BigInt(b.minUsdc6)))
        const nextTierIdx = sortedTiers.findIndex((t, i) => {
          const min = Number(BigInt(t.minUsdc6) / 1_000_000n)
          const currentMin = currentTierIdx >= 0 && currentTierIdx < contractTiers.length
            ? Number(BigInt(contractTiers[currentTierIdx].minUsdc6) / 1_000_000n)
            : -1
          return min > currentMin
        })
        if (nextTierIdx < 0) {
          setUpgradeCapsule(null)
          return
        }
        const nextTier = sortedTiers[nextTierIdx]
        const nextMinUsdc = Number(BigInt(nextTier.minUsdc6) / 1_000_000n)
        const amountNeededUsdc =
          upgradeType === 1 ? Math.max(0, nextMinUsdc - currentPoints) : nextMinUsdc
        if (amountNeededUsdc <= 0) {
          setUpgradeCapsule(null)
          return
        }
        const amountNeededCad = Number(await quoteUSDCToCAD(cardAddress, amountNeededUsdc.toFixed(2)))
        const nextTierContractIdx = contractTiers.findIndex((t) => t.minUsdc6 === nextTier.minUsdc6)
        const tierMeta = meta?.tiers?.find((t) => t.index === nextTierContractIdx) ?? meta?.tiers?.[nextTierContractIdx]
        const nextTierName = tierMeta?.name ?? `Tier ${nextTierContractIdx + 1}`
        if (cancelled) return
        setUpgradeCapsule({ amountNeededCad, nextTierName })
      } catch {
        if (!cancelled) setUpgradeCapsule(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, ownsCard, cardAddress, profile?.keyID, item])

  const handleConfirm = async () => {
    if (!profile?.privateKeyArmor || !cardAddress || !item) return
    const amt = Number(amountText)
    if (!Number.isFinite(amt) || amt <= 0) return
    setSubmitError("")
    setSubmitting(true)
    try {
      const currency = (item as { currency?: string })?.currency ?? "CAD"
      const amount6 = await currencyAmountToSafeUsdc6(cardAddress, currency, amountText)
      if (amount6 <= 0n) {
        setSubmitError("Failed to convert amount.")
        return
      }
      const usdcAmount = safeUsdc6ToAmountString(amount6)
      const intent = ownsCard ? "topup" as const : "first_purchase" as const
      const ret = await postUSDCUserCardTopup({
        profile: profile as Parameters<typeof postUSDCUserCardTopup>[0]["profile"],
        cardAddress,
        usdcAmount,
        intent,
      })
      if (ret.success) {
        onSuccess?.(ret.assets)
      } else {
        setSubmitError(ret.error ?? "Top-up failed.")
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Top-up failed.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!item) return null

  const amount = Number(amountText)
  const isAmountValid =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount >= minAmount &&
    (maxAmount == null || amount <= maxAmount)

  const currency = (item as { currency?: string })?.currency ?? "CAD"
  const prefix = fiatPrefix(currency as Parameters<typeof fiatPrefix>[0])
  const formatDollar = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2))

  return (
    <div className={["fixed inset-0 z-[130]", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      <div
        className={["absolute inset-0 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0"].join(" ")}
        onClick={onClose}
      />
      <div
        className={[
          "absolute inset-x-0 bottom-0 bg-white rounded-t-[36px] shadow-2xl",
          "pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="pt-3 pb-1 flex justify-center">
          <div className="h-1.5 w-16 rounded-full bg-slate-200" />
        </div>
        <div className="px-6 py-5">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Close purchase panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-slate-900 text-center mb-6">
            Add credits to CashTrees Card
          </h3>

          <div className="flex items-baseline justify-center gap-2 mb-6">
            <span className="text-2xl font-semibold text-slate-400 shrink-0">{prefix}</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={amountText}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.]/g, "")
                const firstDot = next.indexOf(".")
                if (firstDot >= 0) {
                  const normalized = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, "")
                  setAmountText(normalized)
                  return
                }
                setAmountText(next)
              }}
              className="w-32 bg-transparent text-5xl leading-none font-bold text-slate-900 outline-none border-b-2 border-slate-300 pt-4 pb-0 focus:border-[#1562f0] text-center"
              aria-label="Credit amount"
            />
          </div>

          {quickOptions.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              {quickOptions.map((opt) => {
                const active = Number(amountText) === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAmountText(String(opt))}
                    className={[
                      "min-w-[72px] px-4 py-2.5 rounded-full text-[15px] font-bold transition-colors",
                      active
                        ? "bg-[#0A1540] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                  >
                    {prefix}{formatDollar(opt)}
                  </button>
                )
              })}
            </div>
          )}

          {ownsCard && upgradeCapsule && amount > 0 && amount < upgradeCapsule.amountNeededCad && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                <Info className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={2.5} />
                <span>Load {prefix}{formatDollar(upgradeCapsule.amountNeededCad - amount)} more for {upgradeCapsule.nextTierName}</span>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-xs text-rose-600 text-center mb-3">{submitError}</p>
          )}
          {!isAmountValid && !submitError && (
            <p className="text-xs text-rose-600 text-center mb-3">
              {ownsCard
                ? "Please enter a valid amount."
                : `Amount must be at least ${prefix}50 for first purchase.${maxAmount != null ? ` Maximum ${prefix}${formatDollar(maxAmount)}.` : ""}`}
            </p>
          )}

          <button
            type="button"
            disabled={!isAmountValid || submitting}
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-[#1562f0] text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {submitting ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Full-screen merchant detail from Discover list (slide in from right). */
function DiscoverMerchantDetailFullScreen({
	item,
	onClose,
	onJoinTopup,
}: {
	item: DiscoverFeaturedCard
	onClose: () => void
	onJoinTopup: () => void
}) {
	const [favorited, setFavorited] = useState(false)
	const ccy = (item.currency || "CAD").toUpperCase()
	const balanceLabel = `${item.title.replace(/\s+/g, " ").trim().toUpperCase()} CARD BALANCE`
	const tierLine = item.assetLabel || "Member benefits"
	const progressPct = Math.min(100, Math.max(8, Math.round(Number(item.rating) * 18)))

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#f5f7f9] dark:bg-slate-950 text-[#1f2328] dark:text-slate-100">
			<div className="relative shrink-0">
				<div className="relative h-[min(42vh,320px)] w-full overflow-hidden rounded-b-[28px]">
					<img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
					<div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30" />
					<div
						className="absolute left-0 right-0 z-20 flex items-start justify-between px-4"
						style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-lg ring-1 ring-black/5 active:scale-95 dark:bg-white/90"
							aria-label="Back"
						>
							<ArrowLeft className="h-5 w-5" strokeWidth={2} />
						</button>
						<button
							type="button"
							onClick={() => setFavorited((v) => !v)}
							className={[
								"flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 active:scale-95",
								favorited
									? "bg-rose-500 text-white ring-rose-600/30"
									: "bg-slate-800/85 text-white ring-white/10",
							].join(" ")}
							aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
							aria-pressed={favorited}
						>
							<Heart className="h-5 w-5" strokeWidth={2} fill={favorited ? "currentColor" : "none"} />
						</button>
					</div>
					<div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-16 pt-8">
						<div className="mb-1 flex items-center gap-2">
							<span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
								<Coffee className="h-5 w-5" strokeWidth={2} />
							</span>
						</div>
						<h1 className="text-2xl font-bold leading-tight text-white drop-shadow-sm">{item.title}</h1>
						<p className="mt-1 text-[15px] font-medium text-white/90 line-clamp-2">{item.subtitle}</p>
					</div>
				</div>
				<div className="relative z-30 -mt-10 px-5">
					<button
						type="button"
						disabled={!item.cardAddress}
						onClick={() => {
							if (item.cardAddress) onJoinTopup()
						}}
						className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1562f0] py-3.5 text-[17px] font-bold text-white shadow-[0_12px_28px_rgba(21,98,240,0.45)] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98] transition-transform"
					>
						<PlusCircle className="h-5 w-5 shrink-0" strokeWidth={2} />
						Join & Top-up Balance
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4">
				<div className="mx-auto max-w-lg space-y-4">
					<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
						<div className="mb-3 flex items-start justify-between">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1562f0] dark:bg-blue-950/50">
								<Wallet className="h-5 w-5" strokeWidth={2} />
							</span>
							<Radio className="h-5 w-5 text-slate-400" strokeWidth={2} aria-hidden />
						</div>
						<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{balanceLabel}</p>
						<p className="mt-1 text-2xl font-bold tracking-tight text-[#1f2328] dark:text-slate-100">
							— <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">{ccy}</span>
						</p>
						<p className="mt-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
							Balance appears when your wallet holds this program card. Use Join to add funds.
						</p>
					</div>

					<div className="rounded-[22px] bg-[#eef1f4] p-4 dark:bg-slate-800/80">
						<div className="mb-3 flex items-center gap-2">
							<Medal className="h-5 w-5 text-amber-600" strokeWidth={2} />
							<span className="text-[16px] font-bold text-[#1f2328] dark:text-slate-100">Program tier</span>
						</div>
						<p className="text-[14px] font-medium text-slate-700 dark:text-slate-300">{tierLine}</p>
						<div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/60">
							<div
								className="h-full rounded-full bg-amber-500"
								style={{ width: `${progressPct}%` }}
							/>
						</div>
						<p className="mt-2 text-[12px] text-slate-600 dark:text-slate-400">Illustrative progress from public rating — not a live points balance.</p>
						<button
							type="button"
							className="mt-4 w-full rounded-2xl bg-white py-3 text-[15px] font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/80 active:scale-[0.99] dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
						>
							View Rewards
						</button>
					</div>

					<div>
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-lg font-bold text-[#1f2328] dark:text-slate-100">Available Offers</h2>
							<button type="button" className="text-[14px] font-semibold text-[#1562f0]">
								See all
								<ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" strokeWidth={2} />
							</button>
						</div>
						<div className="space-y-3">
							<div className="rounded-[20px] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
								<div className="flex gap-3">
									<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
										15%
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-bold text-[#1f2328] dark:text-slate-100">Pastry pairings</p>
										<p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-400">
											Stacked savings on select pastries when you pay with this program.
										</p>
										<p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sample offer</p>
									</div>
								</div>
							</div>
							<div className="rounded-[20px] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
								<div className="flex gap-3">
									<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#1562f0] dark:bg-blue-950/60">
										<Gift className="h-6 w-6" strokeWidth={2} />
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-bold text-[#1f2328] dark:text-slate-100">Free upgrade</p>
										<p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-400">
											Complimentary add-ons where the merchant enables them in metadata.
										</p>
										<p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sample offer</p>
									</div>
								</div>
							</div>
							<div className="flex items-center justify-center gap-2 rounded-[20px] border border-dashed border-slate-300 py-8 text-slate-500 dark:border-slate-600 dark:text-slate-400">
								<Sparkles className="h-5 w-5 shrink-0" strokeWidth={2} />
								<span className="text-[14px] font-medium">More offers unlocking soon</span>
							</div>
						</div>
					</div>

					<div className="pb-6">
						<h2 className="mb-3 text-lg font-bold text-[#1f2328] dark:text-slate-100">
							Recent activity at {item.title}
						</h2>
						<div className="space-y-0 overflow-hidden rounded-[20px] bg-white ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
							<div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
									<Coffee className="h-5 w-5" strokeWidth={2} />
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-[#1f2328] dark:text-slate-100">In-store purchase</p>
									<p className="text-[12px] text-slate-500 dark:text-slate-400">Shown when your card is linked</p>
								</div>
								<span className="shrink-0 text-[14px] font-semibold text-slate-400">—</span>
							</div>
							<div className="flex items-center gap-3 px-4 py-3.5">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1562f0] dark:bg-blue-950/50">
									<PlusCircle className="h-5 w-5" strokeWidth={2} />
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-[#1f2328] dark:text-slate-100">Balance top-up</p>
									<p className="text-[12px] text-slate-500 dark:text-slate-400">After you join and top up</p>
								</div>
								<span className="shrink-0 text-[14px] font-semibold text-[#1562f0]">—</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default function Market() {
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles, myAddress, setShowFooter, chatSearchOpen, setChatSearchOpen, beamio } = useDaemonContext()
	const [myAssets, setMyAssets] = useState<Awaited<ReturnType<typeof getMyAssetsAggregated>> | null>(null)
	const [showCardDetail, setShowCardDetail] = useState(false)
	const [overlayMode, setOverlayMode] = useState<"cardItem" | "cardDetail">("cardItem")
	const [settingsOpen, setSettingsOpen] = useState<"" | "USDCTopup" | "showPayQR">("")
	const [topupContentReady, setTopupContentReady] = useState(false)
	const [topupCardAddress, setTopupCardAddress] = useState<string>(USDC_TOPUP_CARD_ADDRESS)
	/** Item id when opening topup from ProductDetailModal (201/202) - used for quick amount buttons */
	const [topupItemId, setTopupItemId] = useState<number | null>(null)
	const [topupPresetAmountEmpty, setTopupPresetAmountEmpty] = useState(false)
	const [purchaseSheetOpen, setPurchaseSheetOpen] = useState(false)
	const [purchaseItem, setPurchaseItem] = useState<PurchaseModalItem | null>(null)
	const [purchaseOwnsCard, setPurchaseOwnsCard] = useState(false)
	const [viewingItem, setViewingItem] = useState<ViewingItem | null>(null)
	const [inventory, setInventory] = useState<Record<number, InventoryInstance[]>>({})
	const [purchasingGenesis, setPurchasingGenesis] = useState(false)
	const [qrPayload, setQrPayload] = useState<string>("")
	const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategoryTab>("food-beverage")
	const [discoverMerchantDetail, setDiscoverMerchantDetail] = useState<DiscoverFeaturedCard | null>(null)
	const discoverCategoryOptionsOrdered = useMemo<DiscoverCategoryOption[]>(() => {
		const selected = DISCOVER_CATEGORY_OPTIONS.find((o) => o.id === discoverCategory)
		if (!selected) return DISCOVER_CATEGORY_OPTIONS
		return [selected, ...DISCOVER_CATEGORY_OPTIONS.filter((o) => o.id !== discoverCategory)]
	}, [discoverCategory])
	/**
	 * Trending Now：local-first
	 *  - 进入页面立即从 localStorage 读取上一次 trusted rows 显示，loading 立即结束（stale-while-revalidate）。
	 *  - 后台向 /api/latestCards 拉新；trusted 成功 + items 非空才更新 state + cache。
	 *  - 超时 / 网络 / 非 2xx / 解析失败 → untrusted，按 `beamio-trusted-vs-untrusted-fetch.mdc`：
	 *      不清空 rows、不删除 cache、不当作「无数据」。
	 *  - 可信成功但 items 为空 → 按 `beamio-untrusted-empty-result-discard.mdc` 的 windowed-scan 例外，
	 *      也不覆盖已显示的 trusted rows，仅在彻底无 cache + 无新数据时显示 empty。
	 */
	const [latestCardsRows, setLatestCardsRows] = useState<DiscoverLatestCardRow[]>(
		() => loadCachedTrendingRows() ?? []
	)
	const [latestCardsLoading, setLatestCardsLoading] = useState<boolean>(
		() => loadCachedTrendingRows() == null
	)
	const [latestCardsError, setLatestCardsError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		const controller = new AbortController()
		const timeoutId = setTimeout(() => {
			try { controller.abort("timeout") } catch { /* noop */ }
		}, TRENDING_FETCH_TIMEOUT_MS)
		setLatestCardsError(null)

		fetch(`${beamioApi}/api/latestCards?limit=${DISCOVER_LATEST_CARDS_LIMIT}`, {
			signal: controller.signal,
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				return (await res.json()) as { items?: unknown[] }
			})
			.then((data) => {
				if (cancelled) return
				const items = Array.isArray(data?.items) ? data.items : []
				const rows = items
					.map(parseDiscoverLatestCardItem)
					.filter((x): x is DiscoverLatestCardRow => x != null)
				const visible = applyDiscoverMerchantOwnerFilter(rows)
				// Trusted success + 非空 raw：写入过滤后列表；若过滤后为空仍更新 UI 为 empty（不写入 cache）
				if (rows.length > 0) {
					setLatestCardsRows(visible)
					if (visible.length > 0) saveCachedTrendingRows(visible)
				}
				// Trusted success + 空：windowed-scan 不可作为负向删除依据 → 保留旧 trusted rows
			})
			.catch((e: unknown) => {
				if (cancelled) return
				// Untrusted（abort / timeout / 网络 / 5xx / 4xx / 解析失败）：不得清空 rows、不得清 cache
				const name = (e as { name?: string })?.name
				const msg =
					name === "AbortError"
						? "Request timed out — showing cached results"
						: e instanceof Error
							? e.message
							: "Failed to load cards"
				setLatestCardsError(msg)
			})
			.finally(() => {
				clearTimeout(timeoutId)
				if (!cancelled) setLatestCardsLoading(false)
			})

		return () => {
			cancelled = true
			clearTimeout(timeoutId)
			try { controller.abort("unmount") } catch { /* noop */ }
		}
	}, [])

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

	// Defer USDCUserCardTopupControl mount until after sheet slide completes (300ms) to avoid mid-animation pause
	useEffect(() => {
		if (settingsOpen !== "USDCTopup") {
			setTopupContentReady(false)
			return
		}
		const t = setTimeout(() => setTopupContentReady(true), 320)
		return () => clearTimeout(t)
	}, [settingsOpen])

	const flash = async () => {
		if (profiles?.length) {
		await new Promise((r) => setTimeout(r, 500))
		getMyAssetsAggregated(profiles[0])
			.then((agg) => setMyAssets(agg ?? null))
			.catch((e) => console.warn(e))
		}
	}
	useEffect(() => {
		flash()
	}, [myAddress, profiles?.length])

	const isMember = useMemo(
		() => !!(myAssets?.nfts && myAssets.nfts.length > 0),
		[myAssets]
	)

	const closeCardDetail = () => {
		setShowCardDetail(false)
		setShowFooter(true)
		navigate(".", { replace: true, state: {} })
		flash()
	}

	/** Discover top bar: open same global search as footer (portal masks page + bottom SearchInputWithDropdown). */
	const openDiscoverGlobalSearch = () => {
		if (chatSearchOpen) return
		setShowFooter(false)
		setChatSearchOpen(true)
	}

	/** Discover — API card opens top-up for that card address. */
	const openDiscoverCardTopup = (cardAddress: string) => {
		setShowFooter(false)
		setTopupCardAddress(cardAddress)
		setTopupItemId(null)
		setTopupPresetAmountEmpty(false)
		setSettingsOpen("USDCTopup")
	}

	const openDiscoverMerchantDetail = (card: DiscoverFeaturedCard) => {
		setDiscoverMerchantDetail(card)
		setShowFooter(false)
	}

	const closeDiscoverMerchantDetail = () => {
		setDiscoverMerchantDetail(null)
		setShowFooter(true)
	}

	const discoverFeaturedCards = useMemo<DiscoverFeaturedCard[]>(() => {
		const rows: DiscoverFeaturedCard[] = latestCardsRows.map((card, idx) => {
			const category = classifyDiscoverCardCategory(card)
			const isFood = category === "food-beverage"
			const hero = card.merchantImage?.trim()
			const fallback =
				DISCOVER_FEATURE_FALLBACK_IMAGES[idx % DISCOVER_FEATURE_FALLBACK_IMAGES.length]
			return {
				id: card.cardAddress,
				cardAddress: card.cardAddress,
				category,
				title: card.businessName ?? card.name,
				subtitle: card.programDescription || (isFood ? "Modern cuisine" : "Artisan coffee & pastries"),
				assetLabel:
					card.topTierName && card.topTierMinDisplay
						? `${card.topTierName} · ${card.topTierMinDisplay}`
						: card.topTierName ?? card.topTierMinDisplay ?? "Member Benefits",
				rating: Math.max(4.6, Math.min(5, 4.7 + (card.holderCount % 4) * 0.1)).toFixed(1),
				image: hero || fallback,
				logo: card.logoUrl,
				currency: card.currency,
			}
		})
		if (rows.length > 0) return [...rows].reverse()
		// No placeholder brands when API list is empty (Discover is driven by real `latestCards` only).
		return []
	}, [latestCardsRows])

	const filteredFeaturedCards = useMemo(
		() => discoverFeaturedCards.filter((item: DiscoverFeaturedCard) => item.category === discoverCategory),
		[discoverCategory, discoverFeaturedCards]
	)

	const showDiscoverEmpty = !latestCardsLoading && filteredFeaturedCards.length === 0

	const getOwnedInstances = (id: number): InventoryInstance[] => inventory[id] ?? []

	const finalizeGenesis = () => {
		setPurchasingGenesis(false)
		const newId = "#GN-" + (248 + getOwnedInstances(999).length)
		setInventory((prev) => ({ ...prev, 999: [...(prev[999] ?? []), { id: newId, date: "Just now", balance: "ACTIVE" }] }))
		setViewingItem(GENESIS_NODE_DATA)
	}

	return (
		<>
		<div className="w-full h-full min-h-0 h-screen bg-[#f5f7f9] dark:bg-slate-950 overflow-x-hidden overflow-y-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] selection:bg-blue-100 text-[#2c2f31] dark:text-slate-100 antialiased">

		{/* 滚动容器：Discover 布局对齐 example/market.html */}
		<div
			className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2 pb-24 [scrollbar-width:thin]"
			style={{ WebkitOverflowScrolling: "touch", flex: "1 1 0%", minHeight: 0 }}
		>
			<div
				className="shrink-0"
				style={{ minHeight: "calc(max(1rem, env(safe-area-inset-top, 0px)) + 1rem)" }}
			/>

		<div className="animate-in fade-in duration-300 pb-8 max-w-lg mx-auto w-full px-3 sm:px-5">
			<section className="pt-3 pb-3">
				<button
					type="button"
					onClick={openDiscoverGlobalSearch}
					onFocus={openDiscoverGlobalSearch}
					className="flex w-full items-center gap-3 rounded-full border border-[#e8ecf0] bg-white py-3 pl-4 pr-3 text-left shadow-[0_4px_14px_rgba(15,23,42,0.06)] outline-none ring-[#1562f0]/30 transition-shadow focus-visible:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
					aria-label="Search businesses, NGOs, or friends"
				>
					<Search className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
					<span className="min-w-0 flex-1 truncate text-[15px] text-slate-400">
						Search businesses, NGOs, or friends…
					</span>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#1562f0] dark:bg-blue-950/50 dark:text-blue-400" aria-hidden>
						<Mic className="h-5 w-5" strokeWidth={2} />
					</span>
				</button>
			</section>
			{/* Generous inset: box-shadow (~22px blur) must stay inside scrollport; avoid clipping vs overflow-x */}
			<section className="pt-1 pb-8">
				<div className="flex min-h-0 items-center gap-2 overflow-x-auto py-6 px-4 sm:py-7 sm:px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
					{discoverCategoryOptionsOrdered.map((tab) => {
						const Icon = tab.Icon
						const active = discoverCategory === tab.id
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setDiscoverCategory(tab.id)}
								className={[
									"flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-[13px] sm:text-[14px] font-semibold tracking-tight transition-all whitespace-nowrap",
									active
										? "bg-[#1562f0] text-white shadow-[0_8px_22px_rgba(21,98,240,0.42)]"
										: "bg-white text-[#1f2328] shadow-[0_2px_10px_rgba(15,23,42,0.08)] border border-[#e8ecf0] dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)]",
								].join(" ")}
							>
								<Icon className="h-[17px] w-[17px] shrink-0 sm:h-[18px] sm:w-[18px]" strokeWidth={active ? 2.25 : 2} aria-hidden />
								{tab.label}
							</button>
						)
					})}
				</div>
			</section>

			<section className="py-4">
				<div className="flex items-center gap-2 mb-4 flex-wrap">
					<h3 className="font-bold text-[21px] leading-none tracking-tight text-[#202227] dark:text-slate-100">Featured Brands</h3>
				</div>

				{/* untrusted 错误：仅在彻底无 cache rows 时提示，避免 cache 命中时干扰阅读 */}
				{latestCardsError && latestCardsRows.length === 0 ? (
					<p className="text-[6px] text-amber-600 dark:text-amber-400 mb-3">{latestCardsError}</p>
				) : null}
				{/* loading 文案：仅在没有任何 trusted rows 可显示时出现；有 cache 立即跳过 */}
				{latestCardsLoading && latestCardsRows.length === 0 ? (
					<p className="text-[7px] text-slate-500 dark:text-slate-400 mb-4">Loading new cards…</p>
				) : null}

				<div className="grid grid-cols-1 gap-5">
				{filteredFeaturedCards.map((item) => {
					return (
					<button
						key={item.id}
						type="button"
						onClick={() => openDiscoverMerchantDetail(item)}
						className="w-full min-w-0 text-left bg-white dark:bg-slate-900 rounded-[30px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] border border-[#e8ecf0] dark:border-slate-800 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f7f9] dark:focus-visible:ring-offset-slate-950 active:scale-[0.99] transition-transform"
					>
						<div className="relative">
							<img
								src={item.image}
								alt={item.title}
								className="w-full aspect-[16/9] object-cover"
								draggable={false}
							/>
							<div className="absolute top-3 right-3 bg-white/90 text-[#2c2f31] rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 shadow-sm">
								<Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
								<span className="text-[12px] font-bold leading-none">{item.rating}</span>
							</div>
							<div className="absolute -bottom-8 left-6">
								<div className="w-16 h-16 rounded-2xl bg-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] flex items-center justify-center border border-slate-100">
									{item.logo ? (
										<img
											src={item.logo}
											alt=""
											className="w-11 h-11 rounded-xl object-cover"
											onError={(e) => {
												e.currentTarget.style.display = "none"
											}}
										/>
									) : (
										<span className="text-[20px] font-semibold text-[#94afff] leading-none">
											{item.title.charAt(0).toUpperCase()}
										</span>
									)}
								</div>
							</div>
						</div>
						<div className="px-6 pb-6 pt-11">
							<div className="flex items-start justify-between gap-3 mb-1">
								<h4 className="font-bold text-[19px] leading-none tracking-tight text-[#1f2328] dark:text-slate-100 line-clamp-1">
									{item.title}
								</h4>
								<p className="text-[#2f5fcf] text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap pt-1">
									Your Assets
								</p>
							</div>
							<p className="text-[#4b5361] dark:text-slate-300 text-[15px] leading-tight mb-4 line-clamp-2">
								{item.subtitle}
							</p>
							<div className="rounded-2xl bg-[#f0f2f4] dark:bg-slate-800 px-4 py-3 inline-flex items-center gap-2">
								<Gift className="w-5 h-5 text-[#2f5fcf]" />
								<span className="text-[14px] leading-tight font-semibold text-[#232a34] dark:text-slate-100">
									{item.assetLabel}
								</span>
							</div>
						</div>
					</button>
					)
				})}

				{showDiscoverEmpty ? (
					<p className="col-span-full text-center text-[7px] text-slate-500 dark:text-slate-400 py-10 px-4">
						No cards match your search.
					</p>
				) : null}
			</div>
			</section>
		</div>

		</div>
		</div>

		<AnimatePresence>
			{discoverMerchantDetail ? (
				<motion.div
					key={`discover-merchant-${discoverMerchantDetail.id}`}
					className="fixed inset-0 z-[100] flex flex-col bg-[#f5f7f9] dark:bg-slate-950"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "100%" }}
					transition={{ duration: 0.28, ease: "easeOut" }}
					onTouchMove={(e) => e.stopPropagation()}
				>
					<DiscoverMerchantDetailFullScreen
						item={discoverMerchantDetail}
						onClose={closeDiscoverMerchantDetail}
						onJoinTopup={() => {
							if (discoverMerchantDetail.cardAddress) {
								openDiscoverCardTopup(discoverMerchantDetail.cardAddress)
							}
						}}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>

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
							setTopupCardAddress(USDC_TOPUP_CARD_ADDRESS)
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
						setTopupItemId(null)
						setTopupPresetAmountEmpty(false)
						setQrPayload("")
					}}
					aria-hidden
				/>
				<div
					className={[
						"absolute inset-x-0 bottom-0 z-[121]",
						"transition-transform duration-300 ease-out",
						"will-change-transform",
						settingsOpen ? "translate-y-0" : "translate-y-full",
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					<div
						className={[
							"w-full",
							"bg-white dark:bg-slate-900",
							"rounded-t-[22px]",
							"min-h-[55vh]",
							"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
							"pb-[env(safe-area-inset-bottom)]",
						].join(" ")}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto">
							{settingsOpen === "USDCTopup" && (
								topupContentReady && topupCardAddress ? (
									<USDCUserCardTopupControl
										cardAddress={topupCardAddress}
										quickOptions={ undefined}
										itemId={topupItemId ?? undefined}
										initialTierPreference={topupItemId === 201 ? "max" : topupItemId === 202 ? "min" : undefined}
										presetAmountEmpty={topupPresetAmountEmpty}
										onClose={(val) => {
											if (val != null) {
												setMyAssets((prev) => (prev ? { ...prev, ...val } : val))
											}
											setSettingsOpen("")
											setTopupItemId(null)
											setTopupPresetAmountEmpty(false)
											setShowFooter(true)
											closeCardDetail()
											flash()
										}}
									/>
								) : topupContentReady && !topupCardAddress ? (
									<div className="p-6 text-sm text-rose-600">Card address is unavailable.</div>
								) : null
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
					setShowFooter(false)
					setTopupCardAddress(USDC_TOPUP_CARD_ADDRESS)
					setTopupItemId(it?.id ?? null)
					setTopupPresetAmountEmpty(false)
					setSettingsOpen("USDCTopup")
				}}
				onOpenWallet={viewingItem.id === 101 && isMember ? () => { setViewingItem(null); setOverlayMode("cardItem"); setShowCardDetail(true); setShowFooter(false); } : () => setViewingItem(null)}
				canUpgrade
			/>
		)}
		{purchasingGenesis && (
			<GenesisPurchaseModal
				item={GENESIS_NODE_DATA}
				onClose={() => setPurchasingGenesis(false)}
				onConfirm={finalizeGenesis}
			/>
		)}

		<PurchaseCreditsSheet
			open={purchaseSheetOpen}
			item={purchaseItem}
			ownsCard={purchaseOwnsCard}
			cardAddress={USDC_TOPUP_CARD_ADDRESS}
			profile={profiles?.[0]}
			onClose={() => {
				setPurchaseSheetOpen(false)
				setPurchaseItem(null)
			}}
			onSuccess={() => {
				setPurchaseSheetOpen(false)
				setPurchaseItem(null)
				setViewingItem(null)
				setShowFooter(true)
				flash()
			}}
		/>

		<style>{`
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
