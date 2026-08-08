import { IpfsImg } from '@/components/IpfsImg';
import { useObjectImgSrc } from '@/components/card/useObjectImgSrc';
import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
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
	Share2,
	Truck,
	MapPin,
	Database,
	Flame,
	Banknote,
	PackageOpen,
	ShoppingBag,
	UtensilsCrossed,
	ShoppingCart,
	GraduationCap,
	HeartPulse,
	Dumbbell,
	Clapperboard,
	Building2,
	Search,
	Mic,
	Heart,
	Radio,
	Clock,
	Phone,
	LayoutGrid,
	Loader2,
	Medal,
  ExternalLink,
  Gift,
  Copy,
  Star,
  Minus,
  Plus,
  ImageIcon,
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Toast } from "antd-mobile"
import { ethers } from "ethers"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	fetchCardProgramReferrerDashboard,
	formatReferrerCountDisplay,
	formatReferrerRewardPercent,
	formatReferrerRewardPointsDisplay,
	type CardProgramReferrerDashboardSnapshot,
} from "@/utils/cardProgramReferrerDashboard"
import { beamioApi } from "@/utils/constants"
import { openExternalUrl } from "@/utils/cashTreesNativeNfc"
import { resolveSigningPrivateKeyArmor } from "@/utils/resolveSigningPrivateKeyArmor"
import { checkStorage, searchUsername } from "@/services/beamio"
import BeamioContactProfilePreview from "@/components/Home/BeamioContactProfilePreview"
import { DiscoverReferrerDownlinePage } from "@/pages/Vouchers/DiscoverReferrerDownlinePage"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { getMyAssetsAggregated, getMyAssets, getCardTiersFromContract, getCardUpgradeTypeFromContract, quoteUSDCToCAD, postUSDCUserCardTopup, safeUsdc6ToAmountString, currencyAmountToSafeUsdc6, fetchCardActiveIssuedCouponSeriesTrusted, postCardCouponOpenClaimWithCurrentWallet, postCardRecordUserLikeWithCurrentWallet, resolveCouponOpenClaimEligibility, merchantBackgroundImageFromMetadataRoot, merchantIconUrlFromMetadataRoot, getCardOwner, readUserSocialPoints13BalanceOnCard, type CardActiveIssuedCouponSeriesItem, type CardMetadataFromUri, type CouponOpenClaimEligibility, type USDCUserCardTopupIntent } from "@/services/BeamioCard"
import {
	couponOpenClaimEligibilityFromLocal,
	pickCouponOpenClaimStatusFromMap,
} from "@/utils/couponOpenClaimStatusLocalCache"
import {
	discoverUsdcTopupRulesHintText,
	eoaCanSelfFundDiscoverTopup,
	eoaMeetsExternalFundingTarget,
	fetchDiscoverUsdcTopupRules,
	parseDiscoverTopupAmountInput,
	pollEoaUsdcFundingThenTopup,
	precheckDiscoverUsdcTopupUsdc6,
	readEoaConetUsdcBalance6,
	readEoaUsdcBalance6,
	usdc6ToExactTransferAmount,
} from "@/utils/discoverEoaUsdcTopup"
import {
	buildDiscoverGenesisNodeSeatUrl,
	buildDiscoverUsdcTreasuryBridgeQrUrl,
	discoverTreasuryBridgePaymentHint,
	fetchDiscoverClientTopupQuotedUsdc6,
	formatQuotedUsdc6ForDisplay,
	GENESIS_NODE_SEAT_TEST_CODE,
	genesisNodeSeatLocalRequiredUsdc6,
	isGenesisNodeSeatPwaTestBuyer,
	payDiscoverTreasuryBridgeWithLocalWallet,
	payGenesisNodeSeatWithLocalWallet,
} from "@/utils/discoverUsdcTopupSession"
import {
	resolveGenesisReferrerRole,
	type GenesisReferrerRole,
} from "@/services/genesisNodeReferral"
import { plainBeamioTagSeed } from "@/utils/beamioTagDatabase"
import { useMerchantCardDatabase } from "@/providers/MerchantCardDatabaseProvider"
import { merchantCardRecordFromLatestCardsRaw } from "@/utils/merchantCardDatabase"
import { formatDiscoverLikeCount, invalidateDiscoverMerchantStatCache } from "@/utils/discoverMerchantLikeCount"
import {
	DISCOVER_USER_LIKE_TARGET,
	invalidateDiscoverUserLikeBalanceCache,
	readDiscoverUserLikedLocalSeed,
	resolveDiscoverUserHasLiked,
} from "@/utils/discoverUserLike"
import { saveDiscoverUserLikeLocalCache } from "@/utils/discoverUserLikeLocalCache"
import {
	pickDiscoverMerchantLikeCount,
	pickDiscoverMerchantRefClickCount,
} from "@/utils/discoverMerchantStatsLocalCache"
import {
	formatDiscoverRechargeBonusDisplayString,
	formatDiscoverRechargeBonusSidePillText,
	parseDiscoverRechargeBonusRules,
	pickPrimaryDiscoverRechargeBonusRule,
	type DiscoverRechargeBonusRule,
} from "@/utils/discoverRechargeBonus"
import {
	classifyDiscoverMerchantCategory,
	discoverCategoryLabel,
	parseDiscoverPrimaryCategoryId,
	type DiscoverCategoryTab,
} from "@/utils/discoverMerchantCategory"
import {
	BeamioCircularBackButton,
	BEAMIO_HERO_FLOATING_BACK_ROW_CLASS,
	beamioHeroFloatingBackTopStyle,
} from "@/components/BeamioCircularBackButton"
import {
	BASE_MAINNET_CHAIN_ID,
} from "@/config/chainAddresses"
import {
	beamioUserCardAddressExplorerUrl,
	beamioConetMainnetTxExplorerUrl,
	CONET_MAINNET_CHAIN_ID,
	eip712ChainIdForBeamioUserCard,
	resolveBeamioUserCardAddressExplorerUrl,
} from "@/utils/beamioUserCardChain"
import {
	readGenesisSeatBeneficiaryBaseline,
	waitForGenesisSeatNodesAssigned,
} from "@/utils/genesisSeatDeployWait"
import { mapActiveCouponRow, ActiveCouponTicketItem, type ActiveCouponListItem } from "@/pages/Home/ActiveCouponsScreen"
import { BEAMIO_USER_CARD_ASSET_ADDRESS } from "@/config/chainAddresses"
import CardItem from "./CardItem"
import CardDetail from "./CardDetail"
import USDCUserCardTopupControl from "./USDCUserCardTopupControl"
import ShowPayQR from "./showPayQR"
import greenCard from "./assets/greenCard.png"
import blackCard from "./assets/BlackCard.png"
import longdhangStoreCardBg from "@/components/assets/longdhangStoreCardBg.png"
import longdhangRewardTierPromo from "@/components/assets/longdhangRewardTierPromo.png"
import { isIpfsFragmentImageUrl } from "@/utils/ipfsImageLibrary"
import DiscoverMerchantShareButton from '@/components/DiscoverMerchantShareButton'
import { DiscoverMerchantActivePromotionsPanel } from '@/components/discover/DiscoverMerchantActivePromotionsPanel'
import { DiscoverCouponSharePromotionCard } from '@/components/discover/DiscoverCouponSharePromotionCard'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { formatBeamioTagDisplayLine } from '@/utils/aaMultisigTaskUi'
import { DiscoverTopupPromotionCapsule } from '@/components/discover/DiscoverTopupPromotionCapsule'
import { tu } from '@/locale/beamioLocale'
import { mapServerError } from '@/locale/mapServerError'
import { parseDiscoverMerchantFromParams, buildDiscoverMerchantShareUrl, shareDiscoverMerchantUrl, stripDiscoverMerchantDeepLinkParams } from '@/utils/discoverMerchantShare'
import { recordDiscoverShareClickIfNeeded } from '@/utils/discoverShareClickEvent'
import { readDiscoverShareReferrer, stashDiscoverShareReferrer } from '@/utils/discoverShareReferrerStash'
import { collectDeepLinkSearchParams } from '@/utils/beamioDeepLinkParams'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'
import {
	buildDiscoverActivePromotionsPanelModel,
	formatSocialPoints13Display,
	consumptionPointSystemEnabledFromMetadata,
	parseLoyaltyPointsDisplay,
	resolveCouponSocialMissionBlockForSeries,
	resolveDiscoverTopupPromotionPresentation,
	type DiscoverTopupPromotionPresentation,
} from '@/utils/discoverMerchantPromotions'
import { readCardSocialPromotionFromChain } from '@/utils/discoverMerchantSocialPromotionChain'
import { normalizeCardAddressKey } from '@/utils/merchantCardDatabase'

const TOP_SAFE_FILL_STYLE = { height: "max(env(safe-area-inset-top, 0px), 16px)" }
/** Card address for USDC Top Up panel (CashTrees card, from chainAddresses). */
const USDC_TOPUP_CARD_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS

const DISCOVER_LATEST_CARDS_LIMIT = 20
/** 进入 Market 页面立即展示已 cache 的 Trending Now，避免 API 504 / 超时时永远 loading */
const TRENDING_CACHE_VERSION = 10
const TRENDING_CACHE_KEY = `beamio:trending:latestCards:v${TRENDING_CACHE_VERSION}:limit${DISCOVER_LATEST_CARDS_LIMIT}`
/** /api/latestCards 实测可能 504 / 60s+ 挂起，给出明确超时；超时按 untrusted 处理，不清空已显示的 trusted rows */
const TRENDING_FETCH_TIMEOUT_MS = 12_000

/**
 * CoNET Genesis Node merchant card — Discover detail renders a bespoke
 * infrastructure-sale layout (Genesis Node Offers with Referral @BeamioTag /
 * About CoNET) instead of the standard coupons + reward tiers body.
 */
const CONET_GENESIS_DISCOVER_CARD_ADDRESS = '0xafE482D2612327a0D723544B9fB713C514a793a2'
const CONET_EXPLORE_NETWORK_URL = 'https://mainnet.conet.network/'
const CONET_GENESIS_NODE_PRICE_USDC = 1250
const CONET_GENESIS_CLOUD_OPEX_USDC = 120
const CONET_GENESIS_GLOBAL_CAP = 12000

function isConetGenesisDiscoverCard(cardAddress: string | null | undefined): boolean {
	if (!cardAddress) return false
	return cardAddress.trim().toLowerCase() === CONET_GENESIS_DISCOVER_CARD_ADDRESS.toLowerCase()
}

/** LongDhang CoNET program card (post Base→CoNET migration). Discover detail panels keyed here. */
const LONGDHANG_DISCOVER_CARD_ADDRESS = '0xc06055AEEd896F832e602a5876D2Dbe1CB365A8A'
/** Blacklisted Base legacy card — panel / hero lookups alias to {@link LONGDHANG_DISCOVER_CARD_ADDRESS}. */
const LONGDHANG_LEGACY_BASE_CARD_ADDRESS = '0x30d80cD71Fd1FFD346737b387dA11C7412363EFF'

function resolveDiscoverCardPanelKey(cardAddress: string): string {
	const lc = cardAddress.trim().toLowerCase()
	if (lc === LONGDHANG_LEGACY_BASE_CARD_ADDRESS.toLowerCase()) {
		return LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()
	}
	return lc
}

/** When `merchantImage` is absent in metadata, Discover row hero uses alternating stock photos. */
const DISCOVER_FEATURE_FALLBACK_IMAGES = [
	"https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
	"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
] as const

/**
 * Curated Featured Brands hero (large card image). Key: card address lowercased.
 * Takes precedence over on-chain `merchantImage` / metadata background to avoid load-time flicker.
 */
const DISCOVER_CARD_HERO_OVERRIDES: Record<string, string> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: longdhangStoreCardBg,
}

function resolveDiscoverFeaturedHeroImage(
	cardAddress: string,
	opts: {
		programBackgroundImage?: string | null
		merchantImage?: string | null
		dbImage?: string | null
		fallbackIndex: number
	},
): string {
	const override = DISCOVER_CARD_HERO_OVERRIDES[resolveDiscoverCardPanelKey(cardAddress)]?.trim()
	if (override) return override
	return (
		opts.programBackgroundImage?.trim() ||
		opts.merchantImage?.trim() ||
		opts.dbImage?.trim() ||
		DISCOVER_FEATURE_FALLBACK_IMAGES[opts.fallbackIndex % DISCOVER_FEATURE_FALLBACK_IMAGES.length]
	)
}

/** Featured Brands list hero — bundled assets render synchronously (no IPFS hook flash). */
function DiscoverFeaturedBrandHeroImage({
	src,
	alt,
	className,
}: {
	src: string
	alt: string
	className?: string
}) {
	const trimmed = src.trim()
	if (!trimmed) {
		return <div className={className} aria-hidden />
	}
	if (!isIpfsFragmentImageUrl(trimmed)) {
		return <img src={trimmed} alt={alt} className={className} draggable={false} />
	}
	return <IpfsImg src={trimmed} alt={alt} className={className} draggable={false} />
}

/** Featured Brands list logo — bundled assets sync; IPFS shows letter until blob ready or on failure. */
function DiscoverFeaturedBrandLogoImage({
	src,
	fallbackLetter,
	className,
}: {
	src: string
	fallbackLetter: string
	className?: string
}) {
	const trimmed = src.trim()
	const displaySrc = useObjectImgSrc(trimmed)
	const [broken, setBroken] = useState(false)

	const letter = (
		<span className="text-[20px] font-semibold text-[#94afff] leading-none">
			{fallbackLetter.charAt(0).toUpperCase()}
		</span>
	)

	if (!trimmed || broken) return letter

	const effective = isIpfsFragmentImageUrl(trimmed) ? displaySrc : trimmed
	if (!effective) return letter

	return (
		<img
			src={effective}
			alt=""
			className={className}
			draggable={false}
			onError={() => setBroken(true)}
		/>
	)
}

/** All-filter list: pinned to top first (in array order). */
const DISCOVER_ALL_TOP_CARD_ADDRESSES = [
	LONGDHANG_DISCOVER_CARD_ADDRESS,
	"0xe8e146e7752906db36c2aaa5bf699284ee3582b4",
] as const

/** Fallback recharge bonus when metadata has not synced yet (address lowercased). */
const DISCOVER_RECHARGE_BONUS_FALLBACKS: Record<string, DiscoverRechargeBonusRule> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: {
		paymentAmount: 100,
		bonusValue: 10,
		bonusProportional: true,
	},
}

function resolveDiscoverPrimaryRechargeBonus(
	cardAddress: string,
	meta: Record<string, unknown> | null,
): DiscoverRechargeBonusRule | null {
	const fromMeta = pickPrimaryDiscoverRechargeBonusRule(parseDiscoverRechargeBonusRules(meta))
	if (fromMeta) return fromMeta
	return DISCOVER_RECHARGE_BONUS_FALLBACKS[resolveDiscoverCardPanelKey(cardAddress)] ?? null
}

/** Featured list + detail: one resolver for hero chip / capsule / Active promotions. */
function resolveDiscoverFeaturedTopupPresentation(
	cardAddress: string,
	meta: Record<string, unknown> | null | undefined,
	currency: string,
): DiscoverTopupPromotionPresentation {
	const fromMeta = resolveDiscoverTopupPromotionPresentation({ metadataRoot: meta, currency })
	if (fromMeta.heroSidePill || fromMeta.capsuleCopy) return fromMeta
	const fallback = DISCOVER_RECHARGE_BONUS_FALLBACKS[resolveDiscoverCardPanelKey(cardAddress)]
	if (!fallback) return fromMeta
	return {
		heroSidePill: formatDiscoverRechargeBonusSidePillText(fallback, currency),
		displayString: formatDiscoverRechargeBonusDisplayString(fallback, currency),
		capsuleCopy: null,
		primaryRechargeBonus: fallback,
	}
}

const DISCOVER_RECHARGE_BONUS_HERO_CHIP_CLASS =
	"max-w-[min(72%,220px)] rounded-full bg-[#f797ef]/90 px-2.5 py-1 text-center text-[10px] font-bold leading-tight text-[#610e62] shadow-[0_4px_12px_rgba(247,151,239,0.35)] backdrop-blur-sm"

function DiscoverRechargeBonusHeroChip({
	label,
	className = "",
}: {
	label: string
	className?: string
}) {
	return <span className={`${DISCOVER_RECHARGE_BONUS_HERO_CHIP_CLASS} ${className}`.trim()}>{label}</span>
}

/** Featured Brands subtitle override by card address (lowercased). */
const DISCOVER_CARD_SUBTITLE_OVERRIDES: Record<string, string> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: "Shanghai Cuisine",
	"0xe8e146e7752906db36c2aaa5bf699284ee3582b4": "Health and Beauty",
}

function orderDiscoverAllWithPinnedTop(cards: DiscoverFeaturedCard[]): DiscoverFeaturedCard[] {
	const pinnedSet = new Set(DISCOVER_ALL_TOP_CARD_ADDRESSES.map((a) => a.toLowerCase()))
	const pinned: DiscoverFeaturedCard[] = []
	const rest: DiscoverFeaturedCard[] = []
	for (const item of cards) {
		const addr = item.cardAddress?.toLowerCase()
		if (addr && pinnedSet.has(addr)) pinned.push(item)
		else rest.push(item)
	}
	const pinnedOrdered = DISCOVER_ALL_TOP_CARD_ADDRESSES.flatMap((addr) => {
		const hit = pinned.find((p) => p.cardAddress?.toLowerCase() === addr.toLowerCase())
		return hit ? [hit] : []
	})
	return [...pinnedOrdered, ...rest]
}

type DiscoverMerchantInfoPanel = {
	welcomeTitle: string
	welcomeText: string
	aboutTitle?: string
	aboutText?: string
	openingHours?: string
	contact?: string
	location?: string
}

type ShareTokenMetadataDiscoverAbout = {
	detail?: string
	openingHours?: string
	contact?: string
	location?: string
	aboutTitle?: string
}

function trimDiscoverAboutMultilineField(raw: string): string {
	return raw.replace(/\r\n/g, "\n").replace(/^\s+|\s+$/g, "")
}

/** About detail for UI — keep newlines; legacy ".  " breaks become paragraphs. */
function discoverAboutDetailForDisplay(raw: string): string {
	const normalized = trimDiscoverAboutMultilineField(raw)
	if (!normalized) return ""
	if (normalized.includes("\n")) return normalized
	return normalized.replace(/([.!?])\s{2,}/g, "$1\n\n")
}

function parseDiscoverAboutFromShare(
	share: Record<string, unknown> | null | undefined
): ShareTokenMetadataDiscoverAbout | null {
	if (!share) return null
	const raw = share.discoverAbout
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
	const o = raw as Record<string, unknown>
	const field = (key: string): string | undefined => {
		const v = o[key]
		if (typeof v !== "string") return undefined
		const t = trimDiscoverAboutMultilineField(v)
		return t || undefined
	}
	const detail = field("detail")
	const openingHours = field("openingHours")
	const contact = field("contact")
	const location = field("location")
	const aboutTitle = field("aboutTitle")
	if (!detail && !openingHours && !contact && !location && !aboutTitle) return null
	return { detail, openingHours, contact, location, aboutTitle }
}

function resolveDiscoverMerchantInfoPanel(
	cardAddress: string,
	discoverAbout: ShareTokenMetadataDiscoverAbout | null | undefined,
	merchantDisplayName: string
): DiscoverMerchantInfoPanel | undefined {
	const legacy = DISCOVER_MERCHANT_INFO_PANELS[resolveDiscoverCardPanelKey(cardAddress)]
	if (discoverAbout) {
		const aboutText = discoverAbout.detail?.trim()
		const openingHours = discoverAbout.openingHours?.trim()
		const contact = discoverAbout.contact?.trim()
		const location = discoverAbout.location?.trim()
		if (aboutText || openingHours || contact || location) {
			return {
				welcomeTitle: legacy?.welcomeTitle ?? `Welcome to ${merchantDisplayName}`,
				welcomeText: legacy?.welcomeText ?? "",
				aboutTitle:
					discoverAbout.aboutTitle?.trim() || legacy?.aboutTitle || `About ${merchantDisplayName}`,
				aboutText: aboutText || legacy?.aboutText,
				openingHours: openingHours || legacy?.openingHours,
				contact: contact || legacy?.contact,
				location: location || legacy?.location,
			}
		}
	}
	return legacy
}

function hasDiscoverMerchantAboutPanel(panel: DiscoverMerchantInfoPanel): boolean {
	return Boolean(
		panel.aboutText?.trim() ||
			panel.openingHours?.trim() ||
			panel.contact?.trim() ||
			panel.location?.trim()
	)
}

const DISCOVER_GENERIC_PROGRAM_SUBTITLE = "Member benefits and offers"

/**
 * Welcome panel body = short card detail (programDescription / subtitle, ≤200 chars).
 * Do not use discoverAbout.detail here — that belongs on the About panel (≤2000 chars).
 */
function resolveDiscoverWelcomePanelCopy(params: {
	passTitle: string
	subtitle: string
	merchantInfoPanel: DiscoverMerchantInfoPanel | undefined
}): { title: string; body: string } | null {
	const { passTitle, subtitle, merchantInfoPanel } = params
	const title = merchantInfoPanel?.welcomeTitle?.trim() || `Welcome to ${passTitle}`
	const subtitleTrim = subtitle.trim()
	const body =
		merchantInfoPanel?.welcomeText?.trim() ||
		(subtitleTrim && subtitleTrim !== DISCOVER_GENERIC_PROGRAM_SUBTITLE ? subtitleTrim : "") ||
		""
	if (!body) return null
	return { title, body }
}

/** About panel keeps discoverAbout.detail (long-form); omit only if identical to welcome short detail. */
function discoverMerchantAboutPanelForDisplay(
	panel: DiscoverMerchantInfoPanel,
	welcomeBody: string,
): DiscoverMerchantInfoPanel | null {
	const welcomeNorm = welcomeBody.trim()
	const aboutText = panel.aboutText?.trim()
	const dedupedAbout = aboutText && aboutText !== welcomeNorm ? aboutText : undefined
	const next: DiscoverMerchantInfoPanel = {
		...panel,
		welcomeTitle: panel.welcomeTitle,
		welcomeText: panel.welcomeText,
		aboutText: dedupedAbout,
	}
	return hasDiscoverMerchantAboutPanel(next) ? next : null
}

function DiscoverMerchantWelcomePanel({ title, body }: { title: string; body: string }) {
	return (
		<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
			<h2 className="text-[18px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">{title}</h2>
			<DiscoverAboutDetailBody text={body} className=" mt-2" />
		</div>
	)
}

/** Per-card About / hours / contact / location for Discover detail (when metadata lacks these fields). */
const DISCOVER_MERCHANT_INFO_PANELS: Record<string, DiscoverMerchantInfoPanel> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: {
		welcomeTitle: "Welcome to LongDhang Inner Circle",
		welcomeText:
			"Unlock seamless dining and exclusive digital privileges. Top up your LongDhang Pass to enjoy instant bonus rewards.",
		aboutTitle: "About LongDhang",
		aboutText:
			"Longdhang Shanghai Cuisine serves authentic, family-style dishes that capture the true taste of Old Shanghai. We specialize in traditional favorites, featuring our famous handmade Xiao Long Bao and deep-fried pork chops. Join us for a warm, welcoming dining experience that celebrates classic Shanghainese heritage.",
		openingHours: "Mon-Fri: 11 am - 1 pm; 5 - 9:30 pm\nSaturday, Sunday: 11 am - 10 pm",
		contact: "+1 (604) 285-1818",
		location: "8053 Alexandra Rd,\nRichmond, BC V6X 3A6",
	},
	"0xe8e146e7752906db36c2aaa5bf699284ee3582b4": {
		welcomeTitle: "Welcome to STT Inner Circle",
		welcomeText:
			"Unlock your journey to holistic wellness and natural beauty. Join our exclusive digital membership to access premium treatments, tailored rewards, and seamless payment experiences.",
		aboutTitle: "About STT Oriental Medical",
		aboutText:
			"STT Oriental Medical Centre Ltd. is a premier clinic specializing in customized health and beauty solutions through Traditional Chinese Medicine and natural medical aesthetics. Our experienced, multi-disciplinary team provides a comprehensive range of one-stop services, including acupuncture, osteopathic massage, preventive medicine therapies, and advanced anti-aging treatments. By combining traditional healing wisdom with modern therapeutic techniques, we are dedicated to helping you achieve optimal wellness and radiant beauty from the inside out.",
		openingHours: "Mon-Sat: 9 am - 6 pm",
		contact: "+1 (604) 270-1449",
		location: "#1-7100 River Road,\nRichmond, BC",
	},
}

type DiscoverMerchantPromoRewardTier = {
	badge: string
	title: string
	description: string
	/** Optional hero override; falls back to Discover merchant image. */
	backgroundImage?: string
}

/** Curated VIP reward tier promo cards (Discover detail). Key: card address lowercased. */
const DISCOVER_MERCHANT_PROMO_REWARD_TIERS: Record<string, DiscoverMerchantPromoRewardTier> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: {
		badge: "VIP Privilege",
		title: "10% Bonus on Every Top-Up!",
		description:
			"Top up $100 CAD or more to instantly unlock a 10% bonus balance. (e.g., Add $100, receive $110). Treat yourself to authentic Shanghai cuisine anytime, with balance that never expires.",
		backgroundImage: longdhangRewardTierPromo,
	},
}

type DiscoverMerchantWellnessPointsPanel = {
	title: string
	memberSinceLabel: string
	currentTierLabel: string
	nextTierLabel: string
	nextTierThresholdPts: number
	benefitLabel: string
}

/** Wellness points loyalty summary (Discover detail Available Offers footer). */
const DISCOVER_MERCHANT_WELLNESS_POINTS_PANELS: Record<string, DiscoverMerchantWellnessPointsPanel> = {
	"0xe8e146e7752906db36c2aaa5bf699284ee3582b4": {
		title: "Wellness Points",
		memberSinceLabel: "Member since 2024",
		currentTierLabel: "BASE WELLNESS TIER",
		nextTierLabel: "Silver Wellness Tier",
		nextTierThresholdPts: 1500,
		benefitLabel: "New Member Benefit: 10% off clinical assessments",
	},
}

type DiscoverCuratedCollectOffer = {
	id: string
	title: string
	subtitle: string
	accent: "blue" | "orange"
}

type DiscoverCuratedSocialMission = {
	id: string
	title: string
	description: string
	icon: "share" | "gift"
	iconAccent: "blue" | "orange"
	shareTitle?: string
}

type DiscoverCuratedFeaturedMenuItem = {
	id: string
	title: string
	priceLabel: string
	imageUrl?: string | null
}

type DiscoverMerchantCuratedOffersPanel = {
	topUpBonus: {
		title: string
		description: string
	}
	beamioPoints: {
		title: string
		earnRateLabel: string
		spendUnitLabel: string
		pointsMallLabel: string
		redeemFootnote: string
	}
	collectOffers: DiscoverCuratedCollectOffer[]
	socialMissions?: {
		title: string
		missions: DiscoverCuratedSocialMission[]
	}
	featuredMenu?: {
		title: string
		viewAllLabel: string
		orderPhone?: string
		items: DiscoverCuratedFeaturedMenuItem[]
	}
}

/** Curated offer stack on Discover merchant detail (design comps). Key: card address lowercased. */
const DISCOVER_MERCHANT_CURATED_OFFERS: Record<string, DiscoverMerchantCuratedOffersPanel> = {
	[LONGDHANG_DISCOVER_CARD_ADDRESS.toLowerCase()]: {
		topUpBonus: {
			title: "10% Bonus on every Top-Up!",
			description:
				"Top up $100 CAD or more to instantly unlock a 10% bonus balance. Value that never expires.",
		},
		beamioPoints: {
			title: "Beamio Points",
			earnRateLabel: "1 Point",
			spendUnitLabel: "CA$ 1",
			pointsMallLabel: "Points Mall",
			redeemFootnote: "Redeemable for Store Credit or USDC",
		},
		collectOffers: [],
		socialMissions: {
			title: "Social Missions",
			missions: [
				{
					id: "invite-friend",
					title: "Invite a Friend",
					description: "Earn $0.50 on claim + $2.00 on redeem.",
					icon: "share",
					iconAccent: "blue",
					shareTitle: "Join me at LongDhang on Beamio",
				},
				{
					id: "share-xiao-long-bao",
					title: "Share Xiao Long Bao",
					description: "Share our signature dish to unlock a mystery reward.",
					icon: "gift",
					iconAccent: "orange",
					shareTitle: "Try LongDhang Signature Xiao Long Bao on Beamio",
				},
			],
		},
		featuredMenu: {
			title: "Featured Menu",
			viewAllLabel: "View All",
			orderPhone: "+16042851818",
			items: [
				{
					id: "signature-xiao-long-bao",
					title: "Signature Xiao Long Bao",
					priceLabel: "CA$12.99",
				},
				{
					id: "fried-pork-chops",
					title: "Fried Pork Chops",
					priceLabel: "CA$15.99",
				},
			],
		},
	},
}

function DiscoverCuratedBeamioPointsCard({
	config,
	onPointsMallClick,
}: {
	config: DiscoverMerchantCuratedOffersPanel["beamioPoints"]
	onPointsMallClick?: () => void
}) {
	return (
		<div className="overflow-hidden rounded-[20px] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
			<div className="p-4 sm:p-5">
				<div className="flex items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-[15px] font-bold text-white">
						$
					</span>
					<div className="min-w-0 flex-1">
						<h3 className="text-[17px] font-bold leading-snug text-[#1562f0]">{config.title}</h3>
						<p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
							Earn <span className="font-bold text-[#1f2328] dark:text-slate-100">{config.earnRateLabel}</span> for
							every <span className="font-bold text-[#1f2328] dark:text-slate-100">{config.spendUnitLabel}</span>{" "}
							spent. Use them in our{" "}
							<button
								type="button"
								onClick={onPointsMallClick}
								className="font-semibold text-[#1562f0] underline decoration-[#1562f0]/35 underline-offset-2 transition hover:text-blue-700"
							>
								{config.pointsMallLabel}
							</button>{" "}
							for exclusive products and coupons.
						</p>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2 border-t border-[#eadcf7] bg-[#f5ecff] px-4 py-3 dark:border-[#8d3a8b]/20 dark:bg-[#8d3a8b]/10 sm:px-5">
				<Info className="h-4 w-4 shrink-0 text-[#8d3a8b]" strokeWidth={2.25} aria-hidden />
				<p className="text-[13px] font-medium text-[#8d3a8b]">{config.redeemFootnote}</p>
			</div>
		</div>
	)
}

function DiscoverCuratedCollectOfferRow({
	offer,
	onCollect,
}: {
	offer: DiscoverCuratedCollectOffer
	onCollect?: () => void
}) {
	const accentBorder = offer.accent === "blue" ? "border-[#1562f0]" : "border-orange-500"
	const accentTitle = offer.accent === "blue" ? "text-[#1562f0]" : "text-orange-600"
	return (
		<div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#e8ecf0] bg-white py-4 pl-4 pr-3 shadow-[0_4px_16px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:pl-5 sm:pr-4">
			<div className={["min-w-0 flex-1 border-l-[3px] pl-3.5", accentBorder].join(" ")}>
				<h4 className={["truncate text-[16px] font-bold leading-tight", accentTitle].join(" ")}>
					{offer.title}
				</h4>
				<p className="mt-0.5 truncate text-[13px] font-medium text-slate-500 dark:text-slate-400">{offer.subtitle}</p>
			</div>
			<button
				type="button"
				onClick={onCollect}
				className="shrink-0 rounded-full bg-[#f5ecff] px-4 py-2 text-[13px] font-bold text-[#8d3a8b] transition active:scale-[0.98] hover:bg-[#eadcf7] dark:bg-[#8d3a8b]/15 dark:text-[#c98fd0] dark:hover:bg-[#8d3a8b]/25"
			>
				Collect
			</button>
		</div>
	)
}

function DiscoverMerchantCuratedOffersStack({
	config,
	onCollectOffer,
	onPointsMallClick,
	showTopUpBonus = true,
}: {
	config: DiscoverMerchantCuratedOffersPanel
	onCollectOffer?: (offerId: string) => void
	onPointsMallClick?: () => void
	showTopUpBonus?: boolean
}) {
	return (
		<div className="space-y-3">
			{showTopUpBonus ? (
				<DiscoverTopupPromotionCapsule
					title={config.topUpBonus.title}
					description={config.topUpBonus.description}
				/>
			) : null}
			<DiscoverCuratedBeamioPointsCard config={config.beamioPoints} onPointsMallClick={onPointsMallClick} />
			{config.collectOffers.map((offer) => (
				<DiscoverCuratedCollectOfferRow
					key={offer.id}
					offer={offer}
					onCollect={() => onCollectOffer?.(offer.id)}
				/>
			))}
		</div>
	)
}

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
	/** Program icon from metadata `icon` (preferred over `logoUrl` / share `image`). */
	programIconUrl: string | null
	/** Wide hero from metadata `background` / `backgroundImage` (preferred over `merchantImage`). */
	programBackgroundImage: string | null
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
	primaryRechargeBonus: DiscoverRechargeBonusRule | null
	/** From shareTokenMetadata.discoverAbout — Discover detail About block */
	discoverAbout: ShareTokenMetadataDiscoverAbout | null
}

/** Discover filter chip: category tab or show all merchants. */
type DiscoverFilterTab = DiscoverCategoryTab | "all"

type DiscoverCategoryOption = { id: DiscoverFilterTab; label: string; Icon: typeof Building2 }

const DISCOVER_ALL_OPTION: DiscoverCategoryOption = {
	id: "all",
	label: "All",
	Icon: LayoutGrid,
}

const DISCOVER_CATEGORY_OPTIONS: DiscoverCategoryOption[] = [
	{ id: "food-beverage", label: discoverCategoryLabel("food-beverage"), Icon: UtensilsCrossed },
	{ id: "grocery-convenience", label: discoverCategoryLabel("grocery-convenience"), Icon: ShoppingCart },
	{ id: "retail-shopping", label: discoverCategoryLabel("retail-shopping"), Icon: ShoppingBag },
	{ id: "education-training", label: discoverCategoryLabel("education-training"), Icon: GraduationCap },
	{ id: "health-beauty", label: discoverCategoryLabel("health-beauty"), Icon: HeartPulse },
	{ id: "fitness-wellness", label: discoverCategoryLabel("fitness-wellness"), Icon: Dumbbell },
	{ id: "entertainment-leisure", label: discoverCategoryLabel("entertainment-leisure"), Icon: Clapperboard },
	{ id: "local-services", label: discoverCategoryLabel("local-services"), Icon: Building2 },
]

function discoverCategoryIconForTab(category: DiscoverCategoryTab): typeof Building2 {
	return DISCOVER_CATEGORY_OPTIONS.find((o) => o.id === category)?.Icon ?? Building2
}

function shortDiscoverContractAddress(address: string): string {
	const trimmed = address.trim()
	if (trimmed.length < 12) return trimmed
	return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function shortDiscoverTxHash(txHash: string): string {
	const trimmed = txHash.trim()
	if (trimmed.length < 14) return trimmed
	return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`
}

type GenesisSeatPurchasePhase =
	| { kind: 'idle' }
	| { kind: 'paying' }
	| { kind: 'deploying'; usdcTx: string | null; qty: number }
	| {
			kind: 'success'
			usdcTx: string | null
			claimTx: string | null
			nodes: string[]
			qty: number
	  }
	| { kind: 'error'; message: string }

/** Tx hash capsule: shortened display + copy full hash (address-capsule protocol). */
function GenesisSeatTxHashCapsule({
	txHash,
	explorerUrl,
	label = 'Tx',
}: {
	txHash: string
	explorerUrl: string
	label?: string
}) {
	const [copied, setCopied] = useState(false)
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
		}
	}, [])

	const onCopy = useCallback(async () => {
		const full = txHash.trim()
		if (!full) return
		try {
			await navigator.clipboard.writeText(full)
			setCopied(true)
			if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
			copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
		} catch {
			/* ignore */
		}
	}, [txHash])

	return (
		<div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-[12px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
			<span className="shrink-0 text-slate-400 dark:text-slate-500">{label}</span>
			<button
				type="button"
				onClick={() => openExternalUrl(explorerUrl)}
				className="min-w-0 truncate tabular-nums hover:text-[#1562f0]"
				aria-label={`View transaction ${txHash}`}
			>
				{shortDiscoverTxHash(txHash)}
			</button>
			<button
				type="button"
				onClick={() => void onCopy()}
				className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/80 dark:hover:bg-slate-700"
				aria-label="Copy transaction hash"
			>
				{copied ? (
					<Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} aria-hidden />
				) : (
					<Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
				)}
			</button>
		</div>
	)
}

function DiscoverMerchantCardAddressCapsule({ address }: { address: string }) {
	const [explorerUrl, setExplorerUrl] = useState<string | null>(null)
	const [explorerLabel, setExplorerLabel] = useState<"BaseScan" | "CoNET Scan">("BaseScan")

	useEffect(() => {
		let cancelled = false
		void (async () => {
			try {
				const chainId = await eip712ChainIdForBeamioUserCard(address)
				if (cancelled) return
				setExplorerUrl(beamioUserCardAddressExplorerUrl(address, chainId))
				setExplorerLabel(chainId === CONET_MAINNET_CHAIN_ID ? "CoNET Scan" : "BaseScan")
			} catch {
				if (cancelled) return
				setExplorerUrl(beamioUserCardAddressExplorerUrl(address, BASE_MAINNET_CHAIN_ID))
				setExplorerLabel("BaseScan")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [address])

	const openBlockExplorer = useCallback(async () => {
		if (explorerUrl) {
			openExternalUrl(explorerUrl)
			return
		}
		try {
			const url = await resolveBeamioUserCardAddressExplorerUrl(address)
			openExternalUrl(url)
		} catch {
			openExternalUrl(beamioUserCardAddressExplorerUrl(address, BASE_MAINNET_CHAIN_ID))
		}
	}, [address, explorerUrl])

	return (
		<button
			type="button"
			onClick={() => void openBlockExplorer()}
			className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white/90 backdrop-blur-sm transition hover:bg-white/25"
			aria-label={`View contract on ${explorerLabel}: ${address}`}
		>
			<span className="truncate">{shortDiscoverContractAddress(address)}</span>
			<ExternalLink className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
		</button>
	)
}

/** Issuer @beamioTag on Discover merchant detail hero (glass pill on dark gradient). */
function DiscoverMerchantOwnerBeamioTagCapsule({
	ownerEoa,
	onOpenProfile,
	profileOpening,
}: {
	ownerEoa: string
	onOpenProfile?: () => void
	profileOpening?: boolean
}) {
	const { lookupByAddress, resolveTag, avatarImgUrl, ensureProfilesForAddresses } = useBeamioTagDatabase()

	useEffect(() => {
		if (!ownerEoa || !ethers.isAddress(ownerEoa)) return
		void ensureProfilesForAddresses([ownerEoa])
	}, [ownerEoa, ensureProfilesForAddresses])

	if (!ownerEoa || !ethers.isAddress(ownerEoa)) return null

	const record = lookupByAddress(ownerEoa)
	const tagRaw = resolveTag(ownerEoa)
	const tagLine = formatBeamioTagDisplayLine(tagRaw)
	const avatarSrc = avatarImgUrl(record?.accountName ?? tagRaw, ownerEoa)
	const interactive = Boolean(onOpenProfile)

	const shellClass = [
		"inline-flex max-w-[min(100%,14rem)] min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 py-1 pl-1 pr-2.5 text-white shadow-sm backdrop-blur-sm",
		interactive ? "cursor-pointer transition hover:bg-white/20 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80" : "",
	].join(" ")

	const inner = (
		<>
			<div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/30">
				{profileOpening ? (
					<Loader2 className="h-4 w-4 animate-spin text-white/90" strokeWidth={2} aria-hidden />
				) : (
					<IpfsImg src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
				)}
			</div>
			<span className="truncate text-[13px] font-bold leading-none">{tagLine}</span>
		</>
	)

	if (interactive) {
		return (
			<button
				type="button"
				className={shellClass}
				aria-label={`View merchant issuer profile ${tagLine}`}
				disabled={profileOpening}
				onClick={onOpenProfile}
			>
				{inner}
			</button>
		)
	}

	return (
		<div className={shellClass} aria-label={`Merchant issuer ${tagLine}`}>
			{inner}
		</div>
	)
}

type DiscoverFeaturedCard = {
	id: string
	cardAddress: string | null
	/** Card issuer EOA from `/api/latestCards` or cardMetadata (for @beamioTag capsule). */
	cardOwner: string | null
	category: DiscoverCategoryTab
	title: string
	/** Program name from card metadata (`shareTokenMetadata.name`). */
	programName: string
	subtitle: string
	assetLabel: string
	rating: string
	image: string
	logo: string | null
	/** Card program currency (from latestCards row). */
	currency: string
	primaryRechargeBonus: DiscoverRechargeBonusRule | null
	rechargeBonusSidePill: string | null
	rechargeBonusDisplay: string | null
	discoverAbout: ShareTokenMetadataDiscoverAbout | null
}

/** Wallet / deep-link: held merchant card may be absent from `/api/latestCards`. */
function buildDiscoverFeaturedCardFromMerchantDb(
	cardAddress: string,
	meta: CardMetadataFromUri | null,
	resolveDisplayName: (cardAddress: string | undefined) => string,
	resolveImage: (cardAddress: string | undefined) => string,
	metadataRoot?: Record<string, unknown> | null,
): DiscoverFeaturedCard {
	const dbImage = resolveImage(cardAddress)?.trim() || ''
	const programName = meta?.name?.trim() || resolveDisplayName(cardAddress) || 'Merchant'
	const category = classifyDiscoverMerchantCategory({
		name: programName,
		programDescription: meta?.programDescription ?? '',
		categoryId: meta?.categoryId ?? null,
	})
	const subtitleOverride =
		DISCOVER_CARD_SUBTITLE_OVERRIDES[resolveDiscoverCardPanelKey(cardAddress)]
	const hero = resolveDiscoverFeaturedHeroImage(cardAddress, {
		programBackgroundImage: merchantBackgroundImageFromMetadataRoot(meta as Record<string, unknown> | null),
		merchantImage: merchantBackgroundImageFromMetadataRoot(meta as Record<string, unknown> | null),
		dbImage: dbImage || meta?.image || meta?.icon || null,
		fallbackIndex: 0,
	})
	const metaRecord = meta as Record<string, unknown> | null
	const currency = 'CAD'
	const topupPresentation = resolveDiscoverFeaturedTopupPresentation(cardAddress, metaRecord, currency)
	return {
		id: cardAddress,
		cardAddress,
		cardOwner: null,
		category,
		title: programName,
		programName,
		subtitle: subtitleOverride || meta?.programDescription?.trim() || 'Member benefits and offers',
		assetLabel: tu('member_benefits'),
		rating: '4.8',
		image: hero,
		logo:
			merchantIconUrlFromMetadataRoot(metaRecord) ??
			meta?.icon?.trim() ??
			meta?.image?.trim() ??
			(dbImage || null),
		currency,
		primaryRechargeBonus: topupPresentation.primaryRechargeBonus,
		rechargeBonusSidePill: topupPresentation.heroSidePill,
		rechargeBonusDisplay: topupPresentation.displayString,
		discoverAbout: parseDiscoverAboutFromShare(
			readDiscoverNestedObject(metadataRoot ?? null, "shareTokenMetadata") ??
				readDiscoverNestedObject(metaRecord, "shareTokenMetadata"),
		),
	}
}

function resolveDiscoverMerchantDeepLinkTarget(
	location: ReturnType<typeof useLocation>,
): string | null {
	const state = location.state as { openDiscoverMerchantCard?: string } | null
	const fromState = state?.openDiscoverMerchantCard?.trim() ?? ''
	const fromUrl = parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(window.location.href))
	const targetAddr = (fromState || fromUrl?.cardAddress || '').trim()
	if (!targetAddr || !ethers.isAddress(targetAddr)) return null
	return ethers.getAddress(targetAddr)
}

function DiscoverFeaturedLikeCountBadge({ count }: { count: number | null }) {
	if (count == null) return null
	return (
		<span
			className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e8ecf0] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
			aria-label={`${formatDiscoverLikeCount(count)} likes`}
		>
			<Heart className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.25} fill="currentColor" aria-hidden />
			{formatDiscoverLikeCount(count)}
		</span>
	)
}

function DiscoverFeaturedShareClickCountBadge({ count }: { count: number | null }) {
	if (count == null) return null
	return (
		<span
			className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e8ecf0] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
			aria-label={`${formatDiscoverLikeCount(count)} share clicks`}
		>
			<Share2 className="h-3.5 w-3.5 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
			{formatDiscoverLikeCount(count)}
		</span>
	)
}

function DiscoverHeroStatCapsules({
	likeCount,
	shareClickCount,
}: {
	likeCount: number | null
	shareClickCount: number | null
}) {
	if (likeCount == null && shareClickCount == null) return null
	return (
		<div className="mt-3 flex w-full flex-wrap items-center gap-2">
			{likeCount != null ? (
				<span
					className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm"
					aria-label={`${formatDiscoverLikeCount(likeCount)} likes`}
				>
					<Heart className="h-3.5 w-3.5 text-rose-300" strokeWidth={2.25} fill="currentColor" aria-hidden />
					{formatDiscoverLikeCount(likeCount)}
				</span>
			) : null}
			{shareClickCount != null ? (
				<span
					className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm"
					aria-label={`${formatDiscoverLikeCount(shareClickCount)} share clicks`}
				>
					<Share2 className="h-3.5 w-3.5 text-sky-200" strokeWidth={2.25} aria-hidden />
					{formatDiscoverLikeCount(shareClickCount)}
				</span>
			) : null}
		</div>
	)
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

type DiscoverOfferTierRow = {
	name: string
	minUsdc6: bigint
	discountPct: number
	backgroundColor: string | null
}

const DISCOVER_TIER_MEDALS = ["🥉", "🥈", "🥇"] as const

function parseTierDiscountPct(description: string | null | undefined): number {
	if (!description?.trim()) return 0
	const m = description.trim().match(/(\d+(?:\.\d+)?)\s*%\s*discount/i)
	return m ? Number.parseFloat(m[1]) : 0
}

/** Reward tiers only — excludes base tier (lowest `minUsdc6`, biz `CARD_ISSUANCE_SINGLE_TIER_ID` / tier-base). */
function parseDiscoverRewardTiersFromMeta(
	meta: Record<string, unknown> | null,
	_currency: string
): DiscoverOfferTierRow[] {
	if (meta == null) return []
	const raw = meta.tiers
	if (!Array.isArray(raw) || raw.length === 0) return []
	const rows: DiscoverOfferTierRow[] = []
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
			typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "Tier"
		const descRaw = o.description ?? nested?.description
		const description = typeof descRaw === "string" ? descRaw : ""
		const bgRaw =
			o.backgroundColor ??
			o.background_color ??
			nested?.background_color ??
			nested?.backgroundColor
		const backgroundColor =
			typeof bgRaw === "string" && bgRaw.trim() ? discoverSafeCssColor(bgRaw) : null
		rows.push({
			name: tierName,
			minUsdc6,
			discountPct: parseTierDiscountPct(description),
			backgroundColor,
		})
	}
	rows.sort((a, b) => (a.minUsdc6 < b.minUsdc6 ? -1 : a.minUsdc6 > b.minUsdc6 ? 1 : 0))
	if (rows.length <= 1) return []
	const baseMinUsdc6 = rows[0].minUsdc6
	return rows.filter((row) => row.minUsdc6 > baseMinUsdc6)
}

type DiscoverMerchantCouponOffer = {
	coupon: ActiveCouponListItem
	seriesRow: DiscoverCouponSeriesRow
	supplySummary: string | null
}

type DiscoverCouponClaimButtonStatus = 'idle' | 'loading' | 'success' | 'error'

type DiscoverCouponSeriesRow = CardActiveIssuedCouponSeriesItem & {
	issuedNftMaxSupply?: string
	issuedNftRemainingSupply?: string
}

function formatDiscoverCouponSupplySummary(row: DiscoverCouponSeriesRow): string | null {
	const total = row.issuedNftMaxSupply?.replace(/,/g, "").trim()
	const remaining = row.issuedNftRemainingSupply?.replace(/,/g, "").trim()
	if (total && remaining) return `TOTAL ${total} · LEFT ${remaining}`
	if (total) return `TOTAL ${total} · LEFT --`
	if (remaining) return `LEFT ${remaining}`
	return null
}

function normalizeDiscoverCouponSubtitle(subtitle: string): string {
	const raw = subtitle.trim()
	if (!raw || raw === "Gift voucher") return "Add coupon details for members"
	return raw
}

/** POS / iOS `POSBizCouponPreviewTicket` parity — ticket notches + expiry pill. */
function DiscoverMerchantCouponOfferRow({
	row,
	claimEligibility,
	claimStatus = 'idle',
	claimError,
	onClaim,
	referrerEoa = null,
	getPrivateKeyArmor,
	onWalletUnlock,
}: {
	row: DiscoverMerchantCouponOffer
	claimEligibility: CouponOpenClaimEligibility | undefined
	claimStatus?: DiscoverCouponClaimButtonStatus
	claimError?: string
	onClaim?: () => void
	referrerEoa?: string | null
	getPrivateKeyArmor?: () => string | undefined
	onWalletUnlock?: () => void
}) {
	const { formatCouponSupplySummary } = useDaemonContext()
	const supplyLine =
		formatCouponSupplySummary(row.coupon.cardAddress, row.coupon.tokenId) ?? row.supplySummary
	const isAlreadyClaimed = claimEligibility === 'already_claimed'
	const isAlreadyRedeemed = claimEligibility === 'already_redeemed'
	const insufficientSocialPoints = claimEligibility === 'insufficient_social_points'
	// Claim CTA, or claimed / redeemed status capsule (not clickable).
	const showClaimButton =
		claimEligibility === 'claimable' ||
		claimEligibility === 'unknown' ||
		claimEligibility === 'already_claimed' ||
		claimEligibility === 'already_redeemed' ||
		claimEligibility === 'insufficient_social_points'
	const canClaim = claimEligibility === 'claimable' || claimEligibility === 'unknown'
	const claimDisabled =
		!canClaim ||
		isAlreadyClaimed ||
		isAlreadyRedeemed ||
		insufficientSocialPoints ||
		claimStatus !== 'idle'
	const ticketActionStatus: DiscoverCouponClaimButtonStatus =
		claimStatus !== 'idle'
			? claimStatus
			: isAlreadyClaimed || isAlreadyRedeemed
				? 'success'
				: 'idle'
	const ticketActionLabel = isAlreadyRedeemed
		? tu('redeemed')
		: isAlreadyClaimed
			? tu('claimed')
			: tu('claim')
	const socialMissionBlock = useMemo(
		() =>
			resolveCouponSocialMissionBlockForSeries({
				title: row.coupon.title,
				metadata: row.seriesRow.metadata ?? null,
				tokenId: row.seriesRow.tokenId,
			}),
		[row.coupon.title, row.seriesRow.metadata, row.seriesRow.tokenId],
	)
	const showCouponSharePromotion = Boolean(
		socialMissionBlock && (socialMissionBlock.user || socialMissionBlock.referrer),
	)
	return (
		<div className="space-y-3">
			<div className="space-y-1.5">
				<ActiveCouponTicketItem
					row={row.coupon}
					punchBgClassName="bg-white dark:bg-slate-900"
					metadataBelowBackgroundImage
					showOpenClaimShareButton
					showUserLike
					supplySummary={supplyLine}
					socialMissionUser={showCouponSharePromotion ? null : socialMissionBlock?.user ?? null}
					socialMissionReferrer={
						showCouponSharePromotion ? null : socialMissionBlock?.referrer ?? null
					}
					referrerEoa={referrerEoa}
					getPrivateKeyArmor={getPrivateKeyArmor}
					onWalletUnlock={onWalletUnlock}
					showActionButton={showClaimButton}
					actionLabel={ticketActionLabel}
					actionStatus={ticketActionStatus}
					actionError={claimError}
					disabled={claimDisabled}
					onAction={canClaim ? onClaim : undefined}
					aria-label={
						isAlreadyRedeemed
							? `Coupon ${row.coupon.title} already redeemed`
							: isAlreadyClaimed
								? `Coupon ${row.coupon.title} already claimed`
								: insufficientSocialPoints
									? `Coupon ${row.coupon.title} requires more social points`
									: `Claim coupon ${row.coupon.title}`
					}
				/>
				{insufficientSocialPoints ? (
					<p className="px-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
						Not enough social points for this exchange.
					</p>
				) : null}
			</div>
			{showCouponSharePromotion && row.coupon.couponId ? (
				<DiscoverCouponSharePromotionCard
					cardAddress={row.coupon.cardAddress}
					couponId={row.coupon.couponId}
					couponTitle={row.coupon.title}
					couponSubtitle={row.coupon.subtitle}
					metadata={(row.seriesRow.metadata as Record<string, unknown> | null) ?? null}
					sharerMetrics={socialMissionBlock?.referrer ?? null}
					fallbackYouMetrics={socialMissionBlock?.user ?? null}
					getPrivateKeyArmor={getPrivateKeyArmor}
				/>
			) : null}
		</div>
	)
}

function DiscoverMerchantTierOfferRow({
	tier,
	index,
	total,
	currency,
}: {
	tier: DiscoverOfferTierRow
	index: number
	total: number
	currency: string
}) {
	const ccy = currency.toUpperCase() as Parameters<typeof fiatPrefix>[0]
	const prefix = fiatPrefix(ccy)
	const threshold =
		tier.minUsdc6 > 0n
			? `${prefix} ${formatAmount(Number(ethers.formatUnits(tier.minUsdc6, 6)), ccy)}`
			: "—"
	const medal = DISCOVER_TIER_MEDALS[Math.min(index, DISCOVER_TIER_MEDALS.length - 1)]
	const isTop = index === total - 1
	return (
		<div
			className={[
				"flex items-center justify-between gap-3 rounded-xl border border-transparent bg-white p-3.5 dark:bg-slate-800/90",
				isTop ? "ring-1 ring-[#1562f0]/10" : "",
			].join(" ")}
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className="text-2xl" aria-hidden>
					{medal}
				</div>
				<div className="min-w-0">
					<h4 className="truncate text-[15px] font-bold text-[#1f2328] dark:text-slate-100">{tier.name}</h4>
					<p className="text-[14px] font-bold tracking-tight text-[#1f2328] dark:text-slate-200">{threshold}</p>
				</div>
			</div>
			<p
				className={[
					"shrink-0 text-right text-[14px] font-bold",
					tier.discountPct > 0
						? isTop
							? "text-[#1562f0]"
							: "text-[#1f2328] dark:text-slate-100"
						: "text-slate-400",
				].join(" ")}
			>
				{tier.discountPct > 0 ? `${Math.round(tier.discountPct)}% DISCOUNT` : "Member pricing"}
			</p>
		</div>
	)
}

function DiscoverMerchantPromoRewardTierCard({
	config,
	fallbackImage,
}: {
	config: DiscoverMerchantPromoRewardTier
	fallbackImage: string
}) {
	const hero = config.backgroundImage?.trim() || fallbackImage
	return (
		<div className="relative overflow-hidden rounded-[28px] shadow-[0_10px_28px_rgba(15,23,42,0.18)] ring-1 ring-black/10">
			<IpfsImg src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
			<div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/58 to-black/32" aria-hidden />
			<div className="relative z-[1] flex flex-col p-5 pb-5 pt-4 sm:p-6">
				<span className="inline-flex w-fit rounded-full bg-[#1562f0] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
					{config.badge}
				</span>
				<h4 className="mt-4 text-[22px] font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.72)] sm:text-[24px]">
					{config.title}
				</h4>
				<p className="mt-3 text-[14px] font-medium leading-relaxed text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.68)] sm:text-[15px]">
					{config.description}
				</p>
			</div>
		</div>
	)
}

function DiscoverMerchantLoyaltyPointsCard({
	consumptionEnabled,
	consumptionPoints,
	socialPoints,
	consumptionLoading,
	socialLoading,
}: {
	consumptionEnabled: boolean
	consumptionPoints: number | null
	socialPoints: number | null
	consumptionLoading: boolean
	socialLoading: boolean
}) {
	const consumptionDisplay = consumptionLoading ? null : consumptionPoints
	const socialDisplay = socialLoading ? null : socialPoints
	const consumptionVal = consumptionEnabled ? (consumptionDisplay ?? 0) : 0
	const socialVal = socialDisplay ?? 0
	const totalVal = consumptionEnabled ? consumptionVal + socialVal : socialVal
	const totalLoading = consumptionEnabled ? consumptionLoading || socialLoading : socialLoading
	const totalText = totalLoading ? '—' : formatSocialPoints13Display(totalVal)
	const consumptionText = consumptionLoading ? '—' : formatSocialPoints13Display(consumptionDisplay)
	const socialText = socialLoading ? '—' : formatSocialPoints13Display(socialDisplay)

	return (
		<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800 sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
						Total Points
					</p>
					<p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight text-[#1f2328] dark:text-slate-100 sm:text-[34px]">
						{totalText}
						<span className="ml-1.5 text-[16px] font-bold text-slate-400 dark:text-slate-500">Pts</span>
					</p>
				</div>
				<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1562f0] text-white shadow-sm">
					<Star className="h-6 w-6" strokeWidth={2} aria-hidden />
				</span>
			</div>
			<div
				className={`mt-4 grid gap-3 ${consumptionEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}
			>
				{consumptionEnabled ? (
					<div className="rounded-2xl bg-[#f4f6f8] px-4 py-3 dark:bg-slate-800/60">
						<p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Consumption</p>
						<p className="mt-1 text-[20px] font-bold leading-none tracking-tight text-[#1f2328] dark:text-slate-100">
							{consumptionText}
						</p>
					</div>
				) : null}
				<div className="rounded-2xl bg-[#f4f6f8] px-4 py-3 dark:bg-slate-800/60">
					<p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Social</p>
					<p className="mt-1 text-[20px] font-bold leading-none tracking-tight text-[#1f2328] dark:text-slate-100">
						{socialText}
					</p>
				</div>
			</div>
		</div>
	)
}

/**
 * Card program REFERRER dashboard (biz Referrer Reward / registry).
 * All Discover merchant details — not Genesis-only.
 */
function DiscoverMerchantReferrerDashboardCard({
	snapshot,
	loading,
	onOpenMyReferees,
}: {
	snapshot: CardProgramReferrerDashboardSnapshot | null
	loading: boolean
	onOpenMyReferees?: () => void
}) {
	const openMyRefereesTap = useReliableTapHandler(() => {
		onOpenMyReferees?.()
	})
	const rewardText = loading && !snapshot
		? '—'
		: formatReferrerRewardPointsDisplay(snapshot?.rewardBalanceRaw)
	const myRefereesText = loading && !snapshot
		? '—'
		: formatReferrerCountDisplay(snapshot?.myRefereeCount)
	const referrersText = loading && !snapshot
		? '—'
		: formatReferrerCountDisplay(snapshot?.referrerTotalCount)
	const registeredText = loading && !snapshot
		? '—'
		: formatReferrerCountDisplay(snapshot?.registeredRefereeTotalCount)
	const chargeText = loading && !snapshot
		? '—'
		: formatReferrerRewardPercent(snapshot?.chargeRatioE6)
	const topupText = loading && !snapshot
		? '—'
		: formatReferrerRewardPercent(snapshot?.topupRatioE6)

	const canOpenDownline = Boolean(onOpenMyReferees)
	const cellClass = 'rounded-2xl bg-[#f4f6f8] px-4 py-3 dark:bg-slate-800/60'
	const cellTitleClass = 'text-[13px] font-medium text-slate-500 dark:text-slate-400'
	const cellValueClass =
		'mt-1 text-[20px] font-bold leading-none tracking-tight text-[#1f2328] dark:text-slate-100'
	const cellCaptionClass = 'mt-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500'

	return (
		<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800 sm:p-5">
			<div className="min-w-0">
				<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
					Referrer
				</p>
				<p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight text-[#1f2328] dark:text-slate-100 sm:text-[34px]">
					{rewardText}
					<span className="ml-1.5 text-[16px] font-bold text-slate-400 dark:text-slate-500">Pts</span>
				</p>
				<p className="mt-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">
					Your referrer reward balance (token #1)
				</p>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					disabled={!canOpenDownline}
					{...(canOpenDownline ? openMyRefereesTap : {})}
					data-touch-priority="1"
					className={[
						cellClass,
						RELIABLE_TAP_BUTTON_CLASS,
						'text-left',
						canOpenDownline
							? 'transition hover:bg-[#e8ecf0] active:scale-[0.99] dark:hover:bg-slate-800'
							: 'cursor-not-allowed opacity-80',
					].join(' ')}
					aria-label="View my referees"
				>
					<p className={cellTitleClass}>My referees</p>
					<p className={cellValueClass}>{myRefereesText}</p>
					{/* Match Referrers cell height (caption line). */}
					<p className={`${cellCaptionClass} invisible`} aria-hidden>
						On this card
					</p>
				</button>
				<div className={cellClass}>
					<p className={cellTitleClass}>Referrers</p>
					<p className={cellValueClass}>{referrersText}</p>
					<p className={cellCaptionClass}>
						On this card · Registered {registeredText}
					</p>
				</div>
				<div className={cellClass}>
					<p className={cellTitleClass}>Charge reward</p>
					<p className={cellValueClass}>{chargeText}</p>
				</div>
				<div className={cellClass}>
					<p className={cellTitleClass}>Top-up reward</p>
					<p className={cellValueClass}>{topupText}</p>
				</div>
			</div>
		</div>
	)
}

function DiscoverMerchantWellnessPointsCard({
	config,
	points,
}: {
	config: DiscoverMerchantWellnessPointsPanel
	points: number | null
}) {
	const pts = points != null && Number.isFinite(points) ? Math.max(0, Math.floor(points)) : null
	const threshold = Math.max(1, config.nextTierThresholdPts)
	const progressPct =
		pts != null ? Math.min(100, Math.round((pts / threshold) * 100)) : null
	const ptsDisplay = pts != null ? pts.toLocaleString() : "—"
	const progressDisplay = progressPct != null ? `${progressPct}%` : "—"
	const remainingPts =
		pts != null ? Math.max(0, threshold - pts).toLocaleString() : config.nextTierThresholdPts.toLocaleString()

	return (
		<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800 sm:p-5">
			<div className="flex items-start gap-3">
				<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1f3] text-[#595c5e] dark:bg-slate-800 dark:text-slate-300">
					<Medal className="h-6 w-6" strokeWidth={2} aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="text-[17px] font-bold leading-tight text-[#1f2328] dark:text-slate-100">
								{config.title}
							</h3>
							<p className="mt-0.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
								{config.memberSinceLabel}
							</p>
						</div>
						<p className="shrink-0 text-[28px] font-extrabold leading-none tracking-tight text-[#1562f0]">
							{ptsDisplay}
							<span className="ml-1 text-[14px] font-bold">pts</span>
						</p>
					</div>
				</div>
			</div>

			<div className="mt-5">
				<div className="mb-2 flex items-center justify-between gap-2">
					<span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
						{config.currentTierLabel}
					</span>
					<span className="text-[11px] font-bold text-[#1562f0]">{progressDisplay}</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-[#eef1f3] dark:bg-slate-800">
					<div
						className="h-full rounded-full bg-[#1562f0] transition-[width] duration-300"
						style={{ width: `${progressPct ?? 0}%` }}
					/>
				</div>
				<p className="mt-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">
					{remainingPts} pts to {config.nextTierLabel}
				</p>
				<p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight text-[#1562f0]">
					{progressDisplay}
				</p>
			</div>

			<button
				type="button"
				disabled
				aria-disabled="true"
				className="mt-5 flex w-full cursor-default items-center gap-3 rounded-2xl bg-[#eef4ff] px-4 py-3.5 text-left dark:bg-slate-800/80"
			>
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white shadow-sm">
					<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
				</span>
				<span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-[#1f2328] dark:text-slate-100">
					{config.benefitLabel}
				</span>
				<ChevronRight className="h-5 w-5 shrink-0 text-[#1562f0]" strokeWidth={2.2} aria-hidden />
			</button>
		</div>
	)
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
	const programIconUrl = merchantIconUrlFromMetadataRoot(meta) ?? null
	const programBackgroundImage = merchantBackgroundImageFromMetadataRoot(meta) ?? null
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
	const primaryRechargeBonus = resolveDiscoverPrimaryRechargeBonus(addr, meta)
	const discoverAbout = parseDiscoverAboutFromShare(share)
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
		programIconUrl,
		programBackgroundImage,
		tierTopBackground,
		programDescription,
		currency,
		holderCount: Number.isFinite(holderN) ? Math.max(0, Math.trunc(holderN)) : 0,
		topTierName,
		topTierMinDisplay,
		categoryId,
		symbol,
		merchantImage,
		primaryRechargeBonus,
		discoverAbout,
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
		// Rows written after trusted `/api/latestCards` success; server applies Featured Brands gate only.
		return safe.length > 0 ? safe : null
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
    <IpfsImg
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
    <IpfsImg
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
          <IpfsImg
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
          <IpfsImg
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
      {step === "success" && <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-blue-900/20 to-[#020617]"><div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.6)] flex items-center justify-center mb-8 rotate-12"><Server size={64} className="text-white" /></div><h1 className="text-4xl font-bold mb-2">Welcome, Node #248</h1><p className="text-gray-400 mb-8 max-w-xs">You are now a verified infrastructure partner of the Beamio Network.</p><div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-4 mb-8"><div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-500">{tu('transaction')}</span><span className="font-mono text-blue-400">0x8a...2b9</span></div><div className="flex justify-between py-2"><span className="text-gray-500">Revenue Share</span><span className="text-green-400">Active</span></div></div><button onClick={onConfirm} className="w-full max-w-sm bg-white text-black py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors">Enter Dashboard</button></div>}
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
              <IpfsImg
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
            {heroItem.image && <IpfsImg src={heroItem.image} className="w-full h-full object-cover" alt={heroItem.title} />}
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
        <div className="flex gap-6 mb-8 border-b border-gray-100 pb-8"><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500"><MapPin size={20} /></div><div><div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">Location</div><div className="text-sm font-semibold text-gray-900">{heroItem.location || "Online"}</div></div></div><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500"><ShieldCheck size={20} /></div><div><div className="text-[11px] uppercase font-bold tracking-wide text-gray-400">{tu('security')}</div><div className="text-sm font-semibold text-gray-900">Guaranteed</div></div></div></div>
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
  const { fetchCardMetadata, registerCardAddresses } = useMerchantCardDatabase()
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
    registerCardAddresses([cardAddress])
    let cancelled = false
    const run = async () => {
      try {
        const [contractTiers, meta, assets, upgradeType] = await Promise.all([
          getCardTiersFromContract(cardAddress),
          fetchCardMetadata(cardAddress),
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
  }, [open, ownsCard, cardAddress, profile?.keyID, item, fetchCardMetadata, registerCardAddresses])

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
    <div
      className={[
        "fixed inset-0",
        // Closed: sit under Discover detail (z-100) and global Footer (z-200).
        // Parent `pointer-events-none` alone is not enough on some WebKit builds —
        // opacity-0 layers above the hero still swallow taps (back button / footer).
        open ? "z-[130] pointer-events-auto" : "z-[90] pointer-events-none",
      ].join(" ")}
      // React 18: boolean `inert` via unknown attr; disables hit-testing when sheet is closed.
      {...(!open ? ({ inert: '' } as Record<string, string>) : {})}
      aria-hidden={!open}
    >
      <div
        className={[
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={[
          "absolute inset-x-0 bottom-0 bg-white rounded-t-[36px] shadow-2xl",
          "pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full pointer-events-none",
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
            {submitting ? "Processing…" : tu('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DiscoverAboutDetailBody({
	text,
	className = "",
}: {
	text: string
	className?: string
}) {
	const normalized = discoverAboutDetailForDisplay(text)
	const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
	if (paragraphs.length <= 1) {
		return (
			<p className={`whitespace-pre-line text-[14px] leading-relaxed text-slate-600 dark:text-slate-400${className}`}>
				<DiscoverDescriptionTextWithUrlCapsules text={normalized} />
			</p>
		)
	}
	return (
		<div className={`space-y-3${className}`}>
			{paragraphs.map((paragraph, index) => (
				<p
					key={`about-paragraph-${index}`}
					className="whitespace-pre-line text-[14px] leading-relaxed text-slate-600 dark:text-slate-400"
				>
					<DiscoverDescriptionTextWithUrlCapsules text={paragraph} />
				</p>
			))}
		</div>
	)
}

/** Match http(s) and www. URLs inside merchant description / About copy. */
const DISCOVER_DESCRIPTION_URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`\]})]+/gi

function stripDiscoverDescriptionUrlTrailingPunctuation(raw: string): string {
	return raw.replace(/[)\]}>,.;:!?'"”’。、）》]+$/u, "")
}

function formatDiscoverDescriptionUrlCapsuleLabel(u: URL): string {
	const host = u.host.replace(/^www\./i, "")
	let rest = `${u.pathname === "/" ? "" : u.pathname}${u.search}${u.hash}`
	if (rest.length > 1 && rest.endsWith("/")) rest = rest.slice(0, -1)
	const full = `${host}${rest}`
	if (full.length <= 40) return full
	return `${full.slice(0, 20)}…${full.slice(-12)}`
}

function resolveDiscoverDescriptionUrl(rawMatch: string): { href: string; label: string } | null {
	const cleaned = stripDiscoverDescriptionUrlTrailingPunctuation(rawMatch.trim())
	if (!cleaned) return null
	const candidate = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned
	try {
		const u = new URL(candidate)
		if (u.protocol !== "http:" && u.protocol !== "https:") return null
		return { href: u.href, label: formatDiscoverDescriptionUrlCapsuleLabel(u) }
	} catch {
		return null
	}
}

type DiscoverDescriptionTextSegment =
	| { kind: "text"; value: string }
	| { kind: "url"; href: string; label: string }

function splitDiscoverDescriptionWithUrls(text: string): DiscoverDescriptionTextSegment[] {
	if (!text) return [{ kind: "text", value: "" }]
	const segments: DiscoverDescriptionTextSegment[] = []
	const re = new RegExp(DISCOVER_DESCRIPTION_URL_RE.source, "gi")
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = re.exec(text)) != null) {
		const raw = match[0]
		const start = match.index
		if (start > lastIndex) {
			segments.push({ kind: "text", value: text.slice(lastIndex, start) })
		}
		const cleaned = stripDiscoverDescriptionUrlTrailingPunctuation(raw)
		const trailing = raw.slice(cleaned.length)
		const resolved = resolveDiscoverDescriptionUrl(cleaned)
		if (resolved) {
			segments.push({ kind: "url", href: resolved.href, label: resolved.label })
			if (trailing) segments.push({ kind: "text", value: trailing })
		} else {
			segments.push({ kind: "text", value: raw })
		}
		lastIndex = start + raw.length
	}
	if (lastIndex < text.length) {
		segments.push({ kind: "text", value: text.slice(lastIndex) })
	}
	return segments.length > 0 ? segments : [{ kind: "text", value: text }]
}

function DiscoverDescriptionUrlCapsule({ href, label }: { href: string; label: string }) {
	return (
		<button
			type="button"
			onClick={() => openExternalUrl(href)}
			className="mx-0.5 inline-flex max-w-[min(100%,18rem)] items-center gap-1 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-0.5 align-baseline text-[12px] font-semibold text-[#0051d1] transition hover:bg-[#dce6ff] active:scale-[0.98] dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
			aria-label={`Open link ${href}`}
			title={href}
		>
			<span className="min-w-0 truncate tabular-nums">{label}</span>
			<ExternalLink className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
		</button>
	)
}

function DiscoverDescriptionTextWithUrlCapsules({ text }: { text: string }) {
	const segments = splitDiscoverDescriptionWithUrls(text)
	const hasUrl = segments.some((s) => s.kind === "url")
	if (!hasUrl) return <>{text}</>
	return (
		<>
			{segments.map((segment, index) =>
				segment.kind === "url" ? (
					<DiscoverDescriptionUrlCapsule
						key={`desc-url-${index}-${segment.href}`}
						href={segment.href}
						label={segment.label}
					/>
				) : (
					<span key={`desc-text-${index}`}>{segment.value}</span>
				),
			)}
		</>
	)
}

function DiscoverMerchantInfoPanelCard({ panel }: { panel: DiscoverMerchantInfoPanel }) {
	const aboutTitle = panel.aboutTitle?.trim()
	const aboutText = panel.aboutText?.trim()
	const rows = (
		[
			{ label: "Opening Hours", value: panel.openingHours, Icon: Clock },
			{ label: "Contact", value: panel.contact, Icon: Phone },
			{ label: "Location", value: panel.location, Icon: MapPin },
		] as const
	).filter((row) => row.value?.trim())

	return (
		<div className="rounded-[22px] bg-[#eef1f4] p-4 dark:bg-slate-800/80">
			{aboutTitle || aboutText ? (
				<>
					{aboutTitle ? (
						<h2 className="text-[16px] font-bold text-[#1f2328] dark:text-slate-100">{aboutTitle}</h2>
					) : null}
					{aboutText ? (
						<DiscoverAboutDetailBody text={aboutText} className={aboutTitle ? " mt-2" : ""} />
					) : null}
				</>
			) : null}
			{rows.length > 0 ? (
				<div className={`space-y-4${aboutTitle || aboutText ? " mt-5" : ""}`}>
					{rows.map(({ label, value, Icon }) => (
						<div key={label} className="flex gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1562f0] dark:bg-blue-950/50">
								<Icon className="h-5 w-5" strokeWidth={2} />
							</span>
							<div className="min-w-0 flex-1">
								<p className="text-[14px] font-bold text-[#1f2328] dark:text-slate-100">{label}</p>
								<p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-slate-600 dark:text-slate-400">
									{value}
								</p>
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}

/** Full-screen merchant detail from Discover list (slide in from right). */
/**
 * Bespoke CoNET Genesis Node sale layout for the Discover detail body.
 * Replaces the standard coupons / reward-tier panels for
 * {@link CONET_GENESIS_DISCOVER_CARD_ADDRESS}.
 */
function genesisReferrerRoleLabel(role: GenesisReferrerRole): string {
	if (role === 'admin') return 'Admin'
	if (role === 'l0') return 'L0'
	return 'L1'
}

/** Hide deployer / settle admin EOA that has no real @BeamioTag (search-users → unknow). */
const GENESIS_REFERRAL_HIDDEN_EOA = '0x87caed4e51c36a2c2ece3aaf4ddac9693d2405e1'
/** Placeholder hint for Referral @BeamioTag input (not auto-selected). */
const GENESIS_REFERRAL_TAG_PLACEHOLDER = 'Beamio'

function isHiddenGenesisReferrerEoa(address: string): boolean {
	return address.trim().toLowerCase() === GENESIS_REFERRAL_HIDDEN_EOA
}

/** Exact @BeamioTag match from search-users results (avoid results[0] collisions). */
function pickExactBeamioTagAddressFromSearch(
	res: unknown,
	rawTag: string,
): string | null {
	const want = plainBeamioTagSeed(rawTag)
	if (!want) return null
	const results = (res as { results?: Array<Record<string, unknown>> })?.results
	if (!Array.isArray(results) || results.length === 0) return null
	const tagOf = (row: Record<string, unknown>) =>
		plainBeamioTagSeed(
			String(row.accountName ?? row.username ?? row.account_name ?? ''),
		)
	const exact = results.find((row) => tagOf(row) === want)
	const ci = exact ?? results.find((row) => tagOf(row).toLowerCase() === want.toLowerCase())
	if (!ci) return null
	const addr = typeof ci.address === 'string' ? ci.address : ''
	if (!addr || !ethers.isAddress(addr)) return null
	return ethers.getAddress(addr)
}

function ConetGenesisAboutPanel({ onExplore }: { onExplore: () => void }) {
	return (
		<div className="rounded-[22px] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
			<div className="mb-3 flex items-center gap-2">
				<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
					<Info className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
				</span>
				<h2 className="text-[15px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">About CoNET</h2>
			</div>
			<h3 className="text-[20px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
				Reshaping Digital Infrastructure, Mastering Data Sovereignty
			</h3>
			<p className="mt-3 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
				CoNET is a Layer-1 blockchain based on a Decentralized Physical Infrastructure Network (DePIN).
				Through our pioneering Layer Minus protocol, we discard IP addresses at the network transmission
				layer, using asymmetric encrypted wallet addresses as the unique identifier, making privacy a
				fundamental human right.
			</p>
			<button
				type="button"
				onClick={onExplore}
				className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1562f0] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-blue-500/25 transition active:scale-[0.98] hover:bg-blue-600"
			>
				Explore Network
				<ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.5} aria-hidden />
			</button>
		</div>
	)
}

function ConetGenesisNodeDiscoverSection({
	onLockSeat,
	purchasePhase,
	eoaUsdcBalance6,
	beneficiaryEoa,
	initialReferrerEoa,
}: {
	onLockSeat: (
		quantity: number,
		cloudNode: boolean,
		totalUsdc: number,
		canPayLocally: boolean,
		referrerEoa: string,
	) => void
	purchasePhase: GenesisSeatPurchasePhase
	/** Trusted Base USDC balance of local EOA; null = unknown / not loaded. */
	eoaUsdcBalance6: bigint | null
	beneficiaryEoa: string | null
	/** Deep-link / share referrer EOA to prefill when valid Admin/L0/L1. */
	initialReferrerEoa?: string | null
}) {
	const { resolveTagPlain, searchRemoteAndIngest } = useBeamioTagDatabase()
	const localTestEoa = isGenesisNodeSeatPwaTestBuyer(beneficiaryEoa)
	const [quantity, setQuantity] = useState(1)
	const [selectedReferrerEoa, setSelectedReferrerEoa] = useState<string | null>(null)
	const [referralInputTag, setReferralInputTag] = useState('')
	const [referralVerifyStatus, setReferralVerifyStatus] = useState<
		'idle' | 'loading' | 'success' | 'error'
	>('idle')
	const [referralVerifyMessage, setReferralVerifyMessage] = useState('')
	const [agreementAgreed, setAgreementAgreed] = useState(false)
	const referralVerifyInFlightRef = useRef(false)
	const initialReferrerAppliedRef = useRef(false)

	const purchaseBusy =
		purchasePhase.kind === 'paying' || purchasePhase.kind === 'deploying'
	const purchaseSuccess = purchasePhase.kind === 'success'

	useEffect(() => {
		if (localTestEoa) setQuantity(1)
	}, [localTestEoa])

	useEffect(() => {
		if (initialReferrerAppliedRef.current) return
		const raw = (initialReferrerEoa ?? '').trim()
		if (!raw || !ethers.isAddress(raw)) return
		initialReferrerAppliedRef.current = true
		let cancelled = false
		void (async () => {
			const resolved = await resolveGenesisReferrerRole(raw)
			if (cancelled || !resolved) return
			if (isHiddenGenesisReferrerEoa(resolved.address)) return
			const tag = resolveTagPlain(resolved.address).replace(/^@+/, '')
			if (!tag) return
			setSelectedReferrerEoa(resolved.address)
			setReferralInputTag(tag)
			setReferralVerifyStatus('success')
			setReferralVerifyMessage(`Verified ${genesisReferrerRoleLabel(resolved.role)} referrer.`)
		})()
		return () => {
			cancelled = true
		}
	}, [initialReferrerEoa, resolveTagPlain])

	// Cloud Node Deployment Service is mandatory (always included in the entry package).
	const totalThreshold = useMemo(
		() => quantity * (CONET_GENESIS_NODE_PRICE_USDC + CONET_GENESIS_CLOUD_OPEX_USDC),
		[quantity],
	)

	const { required6: requiredUsdc6 } = useMemo(
		() =>
			genesisNodeSeatLocalRequiredUsdc6({
				beneficiaryEoa,
				quantity,
			}),
		[beneficiaryEoa, quantity],
	)

	const canPayLocally =
		eoaUsdcBalance6 != null && eoaCanSelfFundDiscoverTopup(eoaUsdcBalance6, requiredUsdc6)

	const verifyReferralBeamioTag = useCallback(async () => {
		if (referralVerifyInFlightRef.current) return
		const tag = plainBeamioTagSeed(referralInputTag)
		if (!tag) {
			setSelectedReferrerEoa(null)
			setReferralVerifyStatus('error')
			setReferralVerifyMessage('Enter a Referral @BeamioTag.')
			return
		}
		referralVerifyInFlightRef.current = true
		setReferralVerifyStatus('loading')
		setReferralVerifyMessage('')
		try {
			const res = await searchRemoteAndIngest(tag)
			const eoa = pickExactBeamioTagAddressFromSearch(res, tag)
			if (!eoa) {
				setSelectedReferrerEoa(null)
				setReferralVerifyStatus('error')
				setReferralVerifyMessage('No wallet found for that @BeamioTag.')
				return
			}
			if (isHiddenGenesisReferrerEoa(eoa)) {
				setSelectedReferrerEoa(null)
				setReferralVerifyStatus('error')
				setReferralVerifyMessage('This wallet cannot be used as a Referral partner.')
				return
			}
			const role = await resolveGenesisReferrerRole(eoa)
			if (!role) {
				setSelectedReferrerEoa(null)
				setReferralVerifyStatus('error')
				setReferralVerifyMessage(
					'This wallet is not a valid Genesis Admin, L0, or L1 referrer.',
				)
				return
			}
			setSelectedReferrerEoa(role.address)
			setReferralVerifyStatus('success')
			setReferralVerifyMessage(
				`Verified ${genesisReferrerRoleLabel(role.role)} referrer.`,
			)
		} catch {
			setSelectedReferrerEoa(null)
			setReferralVerifyStatus('error')
			setReferralVerifyMessage('Unable to verify Referral @BeamioTag. Try again.')
		} finally {
			referralVerifyInFlightRef.current = false
		}
	}, [referralInputTag, searchRemoteAndIngest])

	const hasValidReferralTag =
		referralVerifyStatus === 'success' &&
		!!selectedReferrerEoa &&
		ethers.isAddress(selectedReferrerEoa) &&
		!isHiddenGenesisReferrerEoa(selectedReferrerEoa) &&
		!!plainBeamioTagSeed(referralInputTag)

	const lockButtonClass = canPayLocally
		? 'bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:bg-emerald-500'
		: 'bg-[#1562f0] shadow-lg shadow-blue-500/25 hover:bg-blue-600'

	const lockButtonLabel =
		purchasePhase.kind === 'paying'
			? 'Completing payment…'
			: purchasePhase.kind === 'deploying'
				? 'Deploying CoNET DePIN nodes…'
				: 'Lock Infrastructure Seat Now'

	const successTxHash =
		purchaseSuccess && purchasePhase.claimTx
			? purchasePhase.claimTx
			: purchaseSuccess
				? purchasePhase.usdcTx
				: null
	const successTxExplorer =
		purchaseSuccess && purchasePhase.claimTx
			? beamioConetMainnetTxExplorerUrl(purchasePhase.claimTx)
			: purchaseSuccess && purchasePhase.usdcTx
				? `https://basescan.org/tx/${purchasePhase.usdcTx}`
				: null
	const successNodes = purchaseSuccess ? purchasePhase.nodes : []

	return (
		<>
			{/* Genesis Node Offers */}
			<div className="rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
				<div className="mb-4 flex items-center gap-2">
					<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-500 dark:bg-amber-500/15">
						<Star className="h-[18px] w-[18px]" strokeWidth={2.25} fill="currentColor" aria-hidden />
					</span>
					<h2 className="text-[18px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
						Genesis Node Offers
					</h2>
				</div>

				<div className="rounded-[18px] bg-[#eef2fb] p-4 dark:bg-slate-800/70">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[15px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
								Tier 1 (Institutional Cornerstone Round) Genesis Node
							</p>
							<p className="mt-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
								Global cap {CONET_GENESIS_GLOBAL_CAP.toLocaleString('en-US')}, limited spots remaining
							</p>
						</div>
						<div className="shrink-0 text-right">
							<p className="text-[20px] font-bold leading-none text-[#1f2328] dark:text-slate-100">
								{CONET_GENESIS_NODE_PRICE_USDC.toLocaleString('en-US')}
							</p>
							<p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">USDC</p>
							<p className="text-[11px] text-slate-400">per node</p>
						</div>
					</div>

					<div className="mt-4 flex items-center justify-between gap-3">
						<span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">Quantity</span>
						<div className="flex items-center gap-3 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-[#e2e7f0] dark:bg-slate-900 dark:ring-slate-700">
							<button
								type="button"
								onClick={() => setQuantity((q) => Math.max(1, q - 1))}
								disabled={quantity <= 1 || purchaseBusy || purchaseSuccess || localTestEoa}
								className="flex h-7 w-7 items-center justify-center rounded-full text-[#1562f0] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
								aria-label="Decrease quantity"
							>
								<Minus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
							</button>
							<span className="min-w-[1.5rem] text-center text-[15px] font-bold tabular-nums text-[#1f2328] dark:text-slate-100">
								{quantity}
							</span>
							<button
								type="button"
								onClick={() => setQuantity((q) => Math.min(CONET_GENESIS_GLOBAL_CAP, q + 1))}
								disabled={purchaseBusy || purchaseSuccess || localTestEoa}
								className="flex h-7 w-7 items-center justify-center rounded-full text-[#1562f0] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
								aria-label="Increase quantity"
							>
								<Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
							</button>
						</div>
					</div>

					<div className="mt-4 border-t border-white/70 pt-3 dark:border-slate-700/70">
						<div className="flex items-center justify-between gap-3">
							<span className="text-[14px] font-bold text-[#1f2328] dark:text-slate-100">
								Cloud Node Deployment Service
							</span>
							<span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
								Included
							</span>
						</div>
						<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
							OPEX: {CONET_GENESIS_CLOUD_OPEX_USDC} USDC/year/node for 24/7 maintenance. Enjoy dual-track
							rewards with zero hardware maintenance hassle.
						</p>
					</div>
				</div>

				{/* Referral BeamioTag — required */}
				<div className="mt-4 rounded-[18px] border border-[#e2e7f0] bg-[#f8fafc] p-4 dark:border-slate-700 dark:bg-slate-800/40">
					<label className="block" htmlFor="genesis-referral-input">
						<span className="text-[14px] font-bold text-[#1f2328] dark:text-slate-100">
							Referral @BeamioTag
						</span>
						<div className="mt-3 flex gap-2">
							<input
								id="genesis-referral-input"
								type="text"
								autoComplete="off"
								enterKeyHint="done"
								placeholder={`@${GENESIS_REFERRAL_TAG_PLACEHOLDER}`}
								value={referralInputTag}
								disabled={purchaseBusy || purchaseSuccess}
								onChange={(e) => {
									setReferralInputTag(e.target.value.replace(/^@+/, ''))
									setSelectedReferrerEoa(null)
									setReferralVerifyStatus('idle')
									setReferralVerifyMessage('')
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault()
										void verifyReferralBeamioTag()
									}
								}}
								className="min-w-0 flex-1 rounded-xl border border-[#dce2f0] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1f2328] outline-none focus:border-[#1562f0] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
							/>
							<button
								type="button"
								onClick={() => void verifyReferralBeamioTag()}
								disabled={
									purchaseBusy ||
									purchaseSuccess ||
									referralVerifyStatus === 'loading' ||
									!plainBeamioTagSeed(referralInputTag)
								}
								aria-busy={referralVerifyStatus === 'loading'}
								aria-label="Verify referral tag"
								className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1562f0] px-3.5 py-2.5 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{referralVerifyStatus === 'loading' ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									'Verify'
								)}
							</button>
						</div>
					</label>

					{referralVerifyMessage ? (
						<p
							className={`mt-2 text-[12px] font-medium ${
								referralVerifyStatus === 'success'
									? 'text-emerald-600 dark:text-emerald-400'
									: referralVerifyStatus === 'error'
										? 'text-amber-600 dark:text-amber-400'
										: 'text-slate-500'
							}`}
							role={referralVerifyStatus === 'error' ? 'alert' : undefined}
						>
							{referralVerifyMessage}
						</p>
					) : null}

					{!hasValidReferralTag ? (
						<p className="mt-2 text-[12px] font-medium text-amber-600 dark:text-amber-400" role="alert">
							Enter and verify a valid Referral @BeamioTag to continue.
						</p>
					) : null}
				</div>

				<div className="mt-4 rounded-[18px] bg-[#f4f6fa] py-4 text-center dark:bg-slate-800/50">
					<p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Total Entry Threshold</p>
					<p
						className={`mt-1 text-[26px] font-bold leading-none ${
							canPayLocally ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#1562f0]'
						}`}
					>
						{totalThreshold.toLocaleString('en-US')} USDC
					</p>
					{eoaUsdcBalance6 != null ? (
						<p className="mt-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">
							{canPayLocally
								? localTestEoa
									? 'Your wallet has enough USDC — pay 1.37 USDC in-app'
									: 'Your wallet has enough USDC — pay in-app'
								: 'Pay with an external wallet on Base'}
						</p>
					) : null}
				</div>

				{/* Agreement — must scroll + check before Lock */}
				{!purchaseSuccess ? (
					<div className="mt-4 rounded-[18px] border border-[#e2e7f0] bg-white dark:border-slate-700 dark:bg-slate-900/60">
						<div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain px-3.5 py-3.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
							<h3 className="text-[13px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
								CoNET Genesis Node Early Contributor Exemption &amp; Digital Rights Confirmation
								Agreement
							</h3>
							<p className="mt-2.5">
								This agreement serves as a transition and rights confirmation credential between Web2
								fiat compliance and the Web3 Decentralized Physical Infrastructure Network (DePIN),
								used to confirm the Node Operator&apos;s infrastructure grant and corresponding
								underlying digital rights.
							</p>
							<p className="mt-2.5">
								Based on the tiered network launch strategy of the CoNET L1 Data Sovereignty Layer,
								with a global hard cap of 12,000 Genesis nodes, the infrastructure grant details are
								as follows:
							</p>
							<div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
								<table className="w-full min-w-[28rem] border-collapse text-left text-[10px] sm:text-[11px]">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800">
											<th className="border-b border-slate-200 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
												Network Phase
											</th>
											<th className="border-b border-slate-200 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
												Quantity
											</th>
											<th className="border-b border-slate-200 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
												Protocol Infrastructure Grant
											</th>
											<th className="border-b border-slate-200 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
												Decentralized OPEX Grant
											</th>
											<th className="border-b border-slate-200 px-2 py-1.5 font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">
												Total Unit Grant
											</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td className="border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
												Tier 1 Institutional Cornerstone Round
											</td>
											<td className="border-b border-slate-100 px-2 py-1.5 tabular-nums dark:border-slate-700">
												{quantity} {quantity === 1 ? 'seat' : 'seats'}
											</td>
											<td className="border-b border-slate-100 px-2 py-1.5 tabular-nums dark:border-slate-700">
												1,250 USDC
											</td>
											<td className="border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
												120 USDC/year
											</td>
											<td className="border-b border-slate-100 px-2 py-1.5 font-semibold tabular-nums dark:border-slate-700">
												1,370 USDC
											</td>
										</tr>
									</tbody>
								</table>
							</div>
							<p className="mt-2.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">*Special Note:</span>{' '}
								The 120 USDC/year OPEX Grant covers the first-year cloud server procurement, system
								deployment, and automated hosting maintenance. This service is executed by an
								independent third-party technical provider commissioned by the open-source protocol
								community. OPEX for subsequent years will be automatically deducted from the node&apos;s
								daily bandwidth settlement yield via smart contract or renewed separately by the
								operator.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								2. Dual-Role of Genesis Full-Node
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">Block Validation:</span>{' '}
								As an L1 validator, the node executes EVM-compatible smart contracts and maintains a
								6-second/block consensus speed, supporting high-frequency commercial settlement needs.
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">DePIN Routing:</span>{' '}
								Running the W2W Protocol, it acts as a relay point for privacy routing, supporting
								end-to-end encrypted communication and earning compensation through physical bandwidth
								contributions.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								3. Core Digital Rights &amp; Labor Compensation
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">Zero Dev Tax:</span>{' '}
								Zero official commission; all underlying protocol inflationary block rewards and network
								Gas priority fees belong 100% to the nodes.
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">
									Fiat Bandwidth Settlement:
								</span>{' '}
								Nodes earn authentic labor compensation based on the constant underlying benchmark (1 GB
								Settlement Unit = 0.01 USDC). Under the Twice-hop privacy routing mechanism, for every 1
								GB of terminal business traffic consumed by the application layer, a total routing fee of
								0.02 USDC is generated. The system precisely splits this into two 1 GB settlement units,
								distributing 1 GB (equivalent to 0.01 USDC) each to the Relay Node providing blind
								forwarding and the Agent Node providing data push.
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">
									Deflationary Mechanism:
								</span>{' '}
								100% base fee burning under the EIP-1559 mechanism, allowing operators to share in the
								asset scarcity evolution set by the underlying code.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								4. QoS &amp; Slashing Conditions
							</p>
							<p className="mt-1.5">
								To ensure the anti-fragility of the protocol, faking throughput or malicious
								disconnection will trigger Slashing penalties, resulting in the permanent destruction of
								the 32 staked $CNET locked for life.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								5. On-Chain Delivery &amp; Digital Proof
							</p>
							<p className="mt-1.5">
								The digital rights confirmation of this agreement uses the USDC payment hash on the Base
								L2 Value Settlement Layer as the sole technical and jurisprudential proof.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								6. Early Contributor Disclaimer &amp; Non-Entity Acknowledgment
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">
									Decentralized Network Nature:
								</span>{' '}
								The contributor explicitly acknowledges and agrees that CoNET L1 is in a very early,
								non-entity DAO (Decentralized Autonomous Organization) bootstrap phase. There is
								currently no &quot;CoNET Foundation&quot; or any other legal entity bearing statutory
								joint liability.
							</p>
							<p className="mt-1.5">
								<span className="font-semibold text-slate-700 dark:text-slate-200">
									Non-Investment Nature &amp; Risk Disclosure:
								</span>{' '}
								The allocation of 1,250 USDC under this agreement constitutes a{' '}
								<span className="font-semibold">non-refundable technical grant</span> to the open-source
								DePIN, not the purchase of securities, financial products, or equity investments. The
								contributor assumes all risks of network technical failure due to code vulnerabilities,
								extreme macroeconomic volatility (including $CNET price fluctuations), and regulatory
								changes.
							</p>
							<p className="mt-3 font-bold text-[#1f2328] dark:text-slate-100">
								Digital Consent &amp; Compliance Area
							</p>
							<p className="mt-1.5">
								By checking the box below and triggering the smart contract to complete the on-chain
								payment, the grantor fully acknowledges, understands, and voluntarily agrees to be bound
								by all terms of this agreement (including disclaimers). This digital confirmation carries
								the same legal weight as a traditional handwritten signature.
							</p>
						</div>

						<label className="flex cursor-pointer items-start gap-2.5 border-t border-[#e2e7f0] px-3.5 py-3 dark:border-slate-700">
							<input
								type="checkbox"
								checked={agreementAgreed}
								disabled={purchaseBusy}
								onChange={(e) => setAgreementAgreed(e.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1562f0] focus:ring-[#1562f0]"
								aria-label="Agree to Genesis Node Early Contributor Agreement"
							/>
							<span className="min-w-0 text-[12px] leading-snug text-slate-700 dark:text-slate-200">
								I have carefully read and fully agree to all terms of the Agreement, and fully
								understand that I am interacting with a decentralized smart contract, not transacting
								with any corporate entity.
							</span>
						</label>
						<p className="border-t border-[#e2e7f0] px-3.5 py-2.5 text-[11px] leading-snug text-slate-500 dark:border-slate-700 dark:text-slate-400">
							Issuer &amp; Confirming Party: CoNET Open-Source DAO / Multi-sig Smart Contract
						</p>
					</div>
				) : null}

				{purchaseSuccess ? (
					<div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/40">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
							</span>
							<div className="min-w-0 flex-1">
								<p className="text-[15px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">
									Thank you for becoming a CONET Infrastructure node owner
								</p>
								<p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
									Your nodes:{' '}
									<span className="font-semibold text-[#1f2328] dark:text-slate-100">
										{successNodes.length > 0 ? successNodes.join(', ') : 'Assigned on-chain'}
									</span>
								</p>
								{successTxHash && successTxExplorer ? (
									<div className="mt-3">
										<GenesisSeatTxHashCapsule
											txHash={successTxHash}
											explorerUrl={successTxExplorer}
											label="Tx"
										/>
									</div>
								) : null}
							</div>
						</div>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							if (!hasValidReferralTag || !selectedReferrerEoa) return
							onLockSeat(quantity, true, totalThreshold, canPayLocally, selectedReferrerEoa)
						}}
						disabled={purchaseBusy || !agreementAgreed || !hasValidReferralTag}
						aria-busy={purchaseBusy}
						className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${lockButtonClass}`}
					>
						{purchaseBusy ? (
							<>
								<Loader2 className="h-5 w-5 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
								<span className="text-left leading-snug">{lockButtonLabel}</span>
							</>
						) : (
							lockButtonLabel
						)}
					</button>
				)}
				{purchasePhase.kind === 'error' ? (
					<p className="mt-2 text-center text-[12px] font-medium text-amber-600 dark:text-amber-400" role="alert">
						{purchasePhase.message}
					</p>
				) : null}
			</div>
		</>
	)
}

function DiscoverMerchantDetailFullScreen({
	item,
	onClose,
}: {
	item: DiscoverFeaturedCard
	onClose: () => void
}) {
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles, setProfiles, discoverMerchantStatByCard, registerDiscoverMerchantStatFeedCards, applyDiscoverMerchantLikeCountDelta, couponOpenClaimStatusByKey, registerCouponOpenClaimFeedTargets, applyCouponOpenClaimStatus } = useDaemonContext()
	const { registerCardAddresses, resolveDisplayName, lookupByAddress, ensureCardMetadataForAddresses } =
		useMerchantCardDatabase()
	const {
		lookupByAddress: lookupProfileByAddress,
		resolvePeerSearchResult,
		resolveTag,
		searchRemoteAndIngest,
		ingestSearchResponse,
	} = useBeamioTagDatabase()
	const profile = profiles?.[0] as Parameters<typeof getMyAssets>[0] | undefined
	const [resolvedDiscoverAbout, setResolvedDiscoverAbout] = useState<ShareTokenMetadataDiscoverAbout | null>(
		item.discoverAbout,
	)
	const [userLiked, setUserLiked] = useState<boolean | null>(null)
	const [likeLoading, setLikeLoading] = useState(false)
	const merchantLikeCount = pickDiscoverMerchantLikeCount(discoverMerchantStatByCard, item.cardAddress)
	const merchantShareClickCount = pickDiscoverMerchantRefClickCount(discoverMerchantStatByCard, item.cardAddress)
	const [merchantAssets, setMerchantAssets] = useState<Awaited<ReturnType<typeof getMyAssets>> | null>(null)
	const [merchantAssetsLoading, setMerchantAssetsLoading] = useState(false)
	const [merchantCoupons, setMerchantCoupons] = useState<DiscoverMerchantCouponOffer[] | null>(null)
	const [merchantOfferTiers, setMerchantOfferTiers] = useState<DiscoverOfferTierRow[] | null>(null)
	const [merchantOffersLoading, setMerchantOffersLoading] = useState(false)
	const [userSocialPoints13, setUserSocialPoints13] = useState<number | null>(null)
	const [userSocialPointsLoading, setUserSocialPointsLoading] = useState(false)
	const [merchantMetadataRoot, setMerchantMetadataRoot] = useState<Record<string, unknown> | null>(null)
	const [issuerOwnerEoa, setIssuerOwnerEoa] = useState<string | null>(item.cardOwner ?? null)
	const [issuerProfileItem, setIssuerProfileItem] = useState<searchResult | null>(null)
	const [issuerProfileOpening, setIssuerProfileOpening] = useState(false)
	/** Card social missions from getRewardRule(1/2/3); undefined = loading, null = none active on-chain. */
	const [chainCardSocialPromotion, setChainCardSocialPromotion] = useState<
		Awaited<ReturnType<typeof readCardSocialPromotionFromChain>> | undefined
	>(undefined)
	const [couponClaimEligibilityById, setCouponClaimEligibilityById] = useState<
		Record<string, CouponOpenClaimEligibility>
	>({})
	const [couponClaimStatusById, setCouponClaimStatusById] = useState<
		Record<string, DiscoverCouponClaimButtonStatus>
	>({})
	const [couponClaimErrorById, setCouponClaimErrorById] = useState<Record<string, string>>({})
	const couponClaimStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
	const merchantCouponsRef = useRef<DiscoverMerchantCouponOffer[] | null>(null)
	merchantCouponsRef.current = merchantCoupons
	const [usdcTopupPhase, setUsdcTopupPhase] = useState<'idle' | 'amount' | 'receive'>('idle')
	const [usdcTopupAmountText, setUsdcTopupAmountText] = useState('')
	const [usdcTopupFiatAmount, setUsdcTopupFiatAmount] = useState('')
	const [usdcTopupQrValue, setUsdcTopupQrValue] = useState('')
	const [usdcTopupUsdcDisplay, setUsdcTopupUsdcDisplay] = useState('')
	const [usdcTopupBaselineUsdc6, setUsdcTopupBaselineUsdc6] = useState<bigint>(0n)
	const [usdcTopupUserEoa, setUsdcTopupUserEoa] = useState('')
	const [usdcTopupRecipientAa, setUsdcTopupRecipientAa] = useState('')
	const [usdcTopupWorkflow, setUsdcTopupWorkflow] = useState<'' | 'treasuryBridge'>('')
	const [usdcTopupRequiredUsdc6, setUsdcTopupRequiredUsdc6] = useState<bigint>(0n)
	const [usdcTopupProgress, setUsdcTopupProgress] = useState('')
	const [usdcTopupSubmitting, setUsdcTopupSubmitting] = useState(false)
	const [usdcTopupError, setUsdcTopupError] = useState('')
	const [usdcTopupRulesHint, setUsdcTopupRulesHint] = useState('')
	const [usdcTopupIntent, setUsdcTopupIntent] = useState<USDCUserCardTopupIntent>('topup')
	const [usdcTopupUrlCopied, setUsdcTopupUrlCopied] = useState(false)
	const usdcTopupPollAbortRef = useRef<AbortController | null>(null)
	const usdcTopupUrlCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const ccy = (item.currency || "CAD").toUpperCase()
	const passTitle = item.programName.trim() || resolveDisplayName(item.cardAddress ?? '') || item.title

	const openIssuerProfile = useCallback(async () => {
		const ownerEoa = issuerOwnerEoa
		if (!ownerEoa || !ethers.isAddress(ownerEoa) || issuerProfileOpening) return
		setIssuerProfileOpening(true)
		try {
			let itemResult = resolvePeerSearchResult(ownerEoa)
			if (!itemResult) {
				const record = lookupProfileByAddress(ownerEoa)
				const tag = (record?.accountName ?? record?.username ?? '').replace(/^@+/, '')
				if (tag) {
					await searchRemoteAndIngest(tag)
					itemResult = resolvePeerSearchResult(ownerEoa)
				}
			}
			if (!itemResult) {
				const res = await searchUsername(ownerEoa).catch(() => null)
				if (res) {
					ingestSearchResponse(res, ownerEoa)
					itemResult = resolvePeerSearchResult(ownerEoa)
					if (!itemResult) {
						const rows = (res as { results?: searchResult[] })?.results ?? []
						const match =
							rows.find((r) => (r.address || '').toLowerCase() === ownerEoa.toLowerCase()) ?? rows[0]
						if (match) itemResult = match
					}
				}
			}
			if (!itemResult) {
				const rec = lookupProfileByAddress(ownerEoa)
				const tagPlain = resolveTag(ownerEoa)?.replace(/^@+/, '') ?? ''
				itemResult = {
					address: ethers.getAddress(ownerEoa),
					created_at: 0,
					first_name: rec?.first_name ?? rec?.firstName ?? '',
					last_name: rec?.last_name ?? rec?.lastName ?? '',
					follow_count: '',
					follower_count: '',
					username: tagPlain,
					image: rec?.image ?? '',
				}
			}
			setIssuerProfileItem(itemResult)
		} finally {
			setIssuerProfileOpening(false)
		}
	}, [
		issuerOwnerEoa,
		issuerProfileOpening,
		resolvePeerSearchResult,
		lookupProfileByAddress,
		searchRemoteAndIngest,
		ingestSearchResponse,
		resolveTag,
	])

	useEffect(() => {
		setIssuerOwnerEoa(item.cardOwner ?? null)
	}, [item.cardAddress, item.cardOwner])

	useEffect(() => {
		setResolvedDiscoverAbout(item.discoverAbout)
	}, [item.cardAddress, item.discoverAbout])

	useEffect(() => {
		if (!item.cardAddress) return
		setMerchantMetadataRoot(null)
		let cancelled = false
		const cardAddress = item.cardAddress
		void fetch(`${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(cardAddress)}`)
			.then(async (res) => (res.ok ? ((await res.json()) as { metadata?: Record<string, unknown> | null; cardOwner?: string }) : null))
			.then((data) => {
				if (cancelled || !data) return
				if (data.cardOwner && ethers.isAddress(data.cardOwner)) {
					try {
						setIssuerOwnerEoa(ethers.getAddress(data.cardOwner))
					} catch {
						/* ignore invalid owner */
					}
				}
				if (!data?.metadata || typeof data.metadata !== "object") return
				setMerchantMetadataRoot(data.metadata)
				const about = parseDiscoverAboutFromShare(
					readDiscoverNestedObject(data.metadata, "shareTokenMetadata"),
				)
				if (about) setResolvedDiscoverAbout(about)
			})
			.catch(() => {
				/* untrusted — keep item.discoverAbout / cache */
			})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress])

	useEffect(() => {
		if (!item.cardAddress || issuerOwnerEoa) return
		let cancelled = false
		void getCardOwner(item.cardAddress)
			.then((owner) => {
				if (cancelled || !owner || owner === ethers.ZeroAddress) return
				setIssuerOwnerEoa(ethers.getAddress(owner))
			})
			.catch(() => {
				/* untrusted — keep previous issuer if any */
			})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress, issuerOwnerEoa])

	useEffect(() => {
		if (!item.cardAddress) {
			setChainCardSocialPromotion(undefined)
			return
		}
		let cancelled = false
		setChainCardSocialPromotion(undefined)
		void readCardSocialPromotionFromChain(item.cardAddress).then((promo) => {
			if (!cancelled) setChainCardSocialPromotion(promo)
		})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress])

	const merchantInfoPanel =
		item.cardAddress != null
			? resolveDiscoverMerchantInfoPanel(item.cardAddress, resolvedDiscoverAbout, passTitle)
			: undefined
	const discoverWelcomePanel = useMemo(
		() =>
			resolveDiscoverWelcomePanelCopy({
				passTitle,
				subtitle: item.subtitle,
				merchantInfoPanel,
			}),
		[passTitle, item.subtitle, merchantInfoPanel],
	)
	const discoverAboutPanel = useMemo(
		() =>
			merchantInfoPanel && discoverWelcomePanel
				? discoverMerchantAboutPanelForDisplay(merchantInfoPanel, discoverWelcomePanel.body)
				: merchantInfoPanel && hasDiscoverMerchantAboutPanel(merchantInfoPanel)
					? merchantInfoPanel
					: null,
		[merchantInfoPanel, discoverWelcomePanel],
	)
	const displayCurrency = (merchantAssets?.cardCurrency || ccy).toUpperCase() as Parameters<typeof fiatPrefix>[0]
	const balancePrefix = fiatPrefix(displayCurrency)
	const balanceAmount = formatAmount(Number(merchantAssets?.points ?? 0), displayCurrency)
	const balanceDisplay = merchantAssetsLoading
		? "—"
		: balancePrefix
			? `${balancePrefix} ${balanceAmount}`
			: balanceAmount
	const hasActiveMembership =
		merchantAssets != null &&
		merchantAssets.nfts.some((n) => !n.isExpired && Number(n.tokenId) > 0)
	const promoRewardTier =
		item.cardAddress != null
			? DISCOVER_MERCHANT_PROMO_REWARD_TIERS[resolveDiscoverCardPanelKey(item.cardAddress)]
			: undefined
	const curatedOffersPanel =
		item.cardAddress != null
			? DISCOVER_MERCHANT_CURATED_OFFERS[resolveDiscoverCardPanelKey(item.cardAddress)]
			: undefined
	const promoRewardTierForList = curatedOffersPanel ? undefined : promoRewardTier
	const couponsSectionRef = useRef<HTMLDivElement | null>(null)
	const scrollToCouponsSection = useCallback(() => {
		couponsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
	}, [])
	const metadataTierCount = merchantOfferTiers?.length ?? 0
	const rewardTierDisplayCount =
		promoRewardTierForList != null || merchantOfferTiers != null
			? (promoRewardTierForList ? 1 : 0) + metadataTierCount
			: null
	const showRewardTiersLoading = merchantOffersLoading && merchantOfferTiers == null && !promoRewardTierForList
	const hasRewardTierContent =
		promoRewardTierForList != null || (merchantOfferTiers != null && merchantOfferTiers.length > 0)
	const wellnessPointsPanel =
		item.cardAddress != null
			? DISCOVER_MERCHANT_WELLNESS_POINTS_PANELS[resolveDiscoverCardPanelKey(item.cardAddress)]
			: undefined
	const wellnessPointsValue = merchantAssetsLoading
		? null
		: Number(merchantAssets?.points ?? 0)
	const consumptionPointSystemEnabled = useMemo(() => {
		const fromMeta = consumptionPointSystemEnabledFromMetadata(merchantMetadataRoot)
		if (fromMeta != null) return fromMeta
		return false
	}, [merchantMetadataRoot])
	const userConsumptionPoints = useMemo(
		() => parseLoyaltyPointsDisplay(merchantAssets?.chargeRewardPoints),
		[merchantAssets?.chargeRewardPoints],
	)
	const MerchantCategoryIcon = discoverCategoryIconForTab(item.category)
	const topupPromotionPresentation = useMemo(
		() =>
			resolveDiscoverTopupPromotionPresentation({
				metadataRoot: merchantMetadataRoot,
				currency: displayCurrency,
			}),
		[merchantMetadataRoot, displayCurrency],
	)
	const heroRechargeBonusPill = topupPromotionPresentation.heroSidePill
	const isConetGenesisCard = isConetGenesisDiscoverCard(item.cardAddress)
	const [referrerDashboard, setReferrerDashboard] = useState<CardProgramReferrerDashboardSnapshot | null>(null)
	const [referrerDashboardLoading, setReferrerDashboardLoading] = useState(false)
	const [referrerDownlineOpen, setReferrerDownlineOpen] = useState(false)
	const activePromotionsPanel = useMemo(
		() =>
			buildDiscoverActivePromotionsPanelModel({
				metadataRoot: merchantMetadataRoot,
				chainCardSocialPromotion,
			}),
		[merchantMetadataRoot, chainCardSocialPromotion],
	)
	const topupPromotionCapsule = topupPromotionPresentation.capsuleCopy
	const openConetExplore = useCallback(() => {
		void openExternalUrl(CONET_EXPLORE_NETWORK_URL)
	}, [])

	const genesisDeepLinkReferrerEoa = useMemo(() => {
		const fromParams =
			parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(window.location.href))?.referrerEoa ??
			null
		const state = location.state as { discoverShareReferrerEoa?: string | null } | null
		const fromState = state?.discoverShareReferrerEoa ?? null
		const refRaw = fromParams ?? fromState ?? readDiscoverShareReferrer(item.cardAddress)
		return refRaw && ethers.isAddress(refRaw) ? ethers.getAddress(refRaw) : null
	}, [location.state, location.search, item.cardAddress])

	const resolveUserEoa = useCallback((): string | null => {
		const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
		if (privateKeyArmor) {
			try {
				return ethers.getAddress(new ethers.Wallet(privateKeyArmor).address)
			} catch {
				/* fall through to keyID */
			}
		}
		const keyId = profile?.keyID?.trim()
		if (keyId && ethers.isAddress(keyId)) {
			try {
				return ethers.getAddress(keyId)
			} catch {
				return null
			}
		}
		return null
	}, [profile])

	const [genesisEoaUsdcBalance6, setGenesisEoaUsdcBalance6] = useState<bigint | null>(null)
	const [genesisSeatPurchase, setGenesisSeatPurchase] = useState<GenesisSeatPurchasePhase>({ kind: 'idle' })
	const genesisSeatLockInFlightRef = useRef(false)
	const genesisSeatAbortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		return () => {
			genesisSeatAbortRef.current?.abort()
			genesisSeatAbortRef.current = null
		}
	}, [])

	useEffect(() => {
		if (!isConetGenesisCard || !profile?.keyID) {
			setGenesisEoaUsdcBalance6(null)
			return
		}
		let cancelled = false
		void (async () => {
			try {
				const bal = await readEoaUsdcBalance6(profile as profile)
				if (!cancelled) setGenesisEoaUsdcBalance6(bal)
			} catch {
				// Untrusted failure — keep last trusted balance (or null).
			}
		})()
		return () => {
			cancelled = true
		}
	}, [isConetGenesisCard, profile, profile?.keyID])

	const lockConetGenesisSeat = useCallback(
		(
			quantity: number,
			_cloudNode: boolean,
			_totalUsdc: number,
			canPayLocally: boolean,
			referrerEoaFromUi: string,
		) => {
			if (genesisSeatLockInFlightRef.current) return
			const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
			const beneficiary = resolveUserEoa()
			if (!privateKeyArmor || !beneficiary) {
				setGenesisSeatPurchase({
					kind: 'error',
					message: 'Restore your wallet to lock a Genesis seat.',
				})
				return
			}
			const cardOwner = issuerOwnerEoa
			if (!cardOwner || !ethers.isAddress(cardOwner)) {
				setGenesisSeatPurchase({
					kind: 'error',
					message: 'Merchant card owner unavailable. Pull to refresh and try again.',
				})
				return
			}
			if (!profile) {
				setGenesisSeatPurchase({
					kind: 'error',
					message: 'Restore your wallet to lock a Genesis seat.',
				})
				return
			}
			if (
				!referrerEoaFromUi ||
				!ethers.isAddress(referrerEoaFromUi) ||
				isHiddenGenesisReferrerEoa(referrerEoaFromUi)
			) {
				setGenesisSeatPurchase({
					kind: 'error',
					message: 'Enter and verify a valid Referral @BeamioTag before locking a seat.',
				})
				return
			}
			const qty = Math.max(1, Math.floor(Number(quantity) || 1))
			const localTestEoa = isGenesisNodeSeatPwaTestBuyer(beneficiary)
			const payQty = localTestEoa ? 1 : qty
			const referrerL0 = ethers.getAddress(referrerEoaFromUi)

			const openExternalPay = () => {
				const payUrl = buildDiscoverGenesisNodeSeatUrl({
					cardAddress: CONET_GENESIS_DISCOVER_CARD_ADDRESS,
					cardOwner,
					beneficiaryEoa: beneficiary,
					quantity: payQty,
					referrerL0,
					testCode: localTestEoa ? GENESIS_NODE_SEAT_TEST_CODE : undefined,
				})
				void openExternalUrl(payUrl)
			}

			if (!canPayLocally) {
				openExternalPay()
				return
			}

			genesisSeatLockInFlightRef.current = true
			genesisSeatAbortRef.current?.abort()
			const abort = new AbortController()
			genesisSeatAbortRef.current = abort
			setGenesisSeatPurchase({ kind: 'paying' })

			void (async () => {
				try {
					const baseline = await readGenesisSeatBeneficiaryBaseline(beneficiary)
					const result = await payGenesisNodeSeatWithLocalWallet({
						profile: profile as profile,
						privateKeyArmor,
						cardAddress: CONET_GENESIS_DISCOVER_CARD_ADDRESS,
						cardOwner,
						beneficiaryEoa: beneficiary,
						quantity: payQty,
						referrerL0,
					})
					if (abort.signal.aborted) return

					if (result.ok) {
						const usdcTx = result.USDC_tx?.trim() || null
						setGenesisSeatPurchase({ kind: 'deploying', usdcTx, qty: payQty })
						try {
							const bal = await readEoaUsdcBalance6(profile as profile)
							if (!abort.signal.aborted) setGenesisEoaUsdcBalance6(bal)
						} catch {
							/* keep last trusted balance */
						}

						const wait = await waitForGenesisSeatNodesAssigned({
							beneficiaryEoa: beneficiary,
							expectedQty: payQty,
							baseline,
							signal: abort.signal,
						})
						if (abort.signal.aborted) return

						if (wait.ok) {
							setGenesisSeatPurchase({
								kind: 'success',
								usdcTx,
								claimTx: wait.claimTxHash,
								nodes: wait.depinNodeIps,
								qty: payQty,
							})
							return
						}
						setGenesisSeatPurchase({
							kind: 'error',
							message: wait.error || 'Node deployment is still pending. Check your wallet shortly.',
						})
						return
					}
					if (result.insufficientBalance) {
						setGenesisSeatPurchase({ kind: 'idle' })
						openExternalPay()
						return
					}
					setGenesisSeatPurchase({
						kind: 'error',
						message: result.error || 'Genesis seat payment failed.',
					})
				} catch (e: unknown) {
					if (abort.signal.aborted) return
					const msg = e instanceof Error ? e.message : 'Genesis seat payment failed.'
					setGenesisSeatPurchase({ kind: 'error', message: msg })
				} finally {
					genesisSeatLockInFlightRef.current = false
				}
			})()
		},
		[genesisDeepLinkReferrerEoa, issuerOwnerEoa, profile, resolveUserEoa],
	)

	const resolveUserAa = useCallback((): string | null => {
		const raw = String((profile as ProfileForTopup | undefined)?.aaAccount ?? '').trim()
		if (raw && ethers.isAddress(raw) && raw !== ethers.ZeroAddress) {
			try {
				return ethers.getAddress(raw)
			} catch {
				return null
			}
		}
		return null
	}, [profile])

	const shareReferrerEoa = useMemo(() => {
		const keyId = profile?.keyID?.trim() ?? ''
		return keyId && ethers.isAddress(keyId) ? ethers.getAddress(keyId) : null
	}, [profile?.keyID])

	const shareReferrerFromUrl = useMemo(() => {
		const fromParams =
			parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(window.location.href))?.referrerEoa ??
			null
		const state = location.state as { discoverShareReferrerEoa?: string | null } | null
		const fromState = state?.discoverShareReferrerEoa ?? null
		/** Deep-link params are stripped and router state reset before detail mounts — stash is the survivor. */
		const raw = fromParams ?? fromState ?? readDiscoverShareReferrer(item.cardAddress)
		if (!raw || !ethers.isAddress(raw)) return null
		return ethers.getAddress(raw)
	}, [location.state, item.cardAddress])

	const shareClickRecordedRef = useRef(false)
	useEffect(() => {
		const card = item.cardAddress?.trim()
		if (shareClickRecordedRef.current || !card || !ethers.isAddress(card)) return
		const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
		if (!privateKeyArmor) return
		shareClickRecordedRef.current = true
		void recordDiscoverShareClickIfNeeded({
			cardAddress: card,
			privateKeyArmor,
			referrerEoa: shareReferrerFromUrl,
		})
	}, [item.cardAddress, profile, shareReferrerFromUrl])

	useEffect(() => {
		const card = item.cardAddress?.trim()
		if (!card) {
			setUserLiked(null)
			return
		}
		const eoa = resolveUserEoa()
		if (!eoa) {
			setUserLiked(null)
			return
		}
		let cancelled = false
		void resolveDiscoverUserHasLiked(card, eoa, DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD, '0').then((liked) => {
			if (cancelled) return
			if (liked != null) {
				setUserLiked(liked)
				return
			}
			const localSeed = readDiscoverUserLikedLocalSeed(
				eoa,
				card,
				DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD,
				'0',
			)
			if (localSeed != null) setUserLiked(localSeed)
		})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress, resolveUserEoa, profile?.keyID])

	const submitMerchantUserLike = useCallback(async () => {
		const card = item.cardAddress?.trim()
		if (!card || likeLoading || userLiked) return
		let privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
		if (!privateKeyArmor) {
			const stored = await checkStorage()
			if (stored?.profiles?.length) {
				setProfiles(stored.profiles)
				privateKeyArmor = resolveSigningPrivateKeyArmor(stored.profiles[0])
			}
		}
		if (!privateKeyArmor) {
			Toast.show({
				content: tu('unlock_your_wallet_with_your_access_password_to_claim_coupons'),
				position: 'top',
			})
			navigate('/settings')
			return
		}
		setLikeLoading(true)
		try {
			const cardNorm = ethers.getAddress(card)
			const ret = await postCardRecordUserLikeWithCurrentWallet({
				cardAddress: cardNorm,
				privateKeyArmor,
				liked: true,
				targetKind: DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD,
				issuedParentId: '0',
				referrerEoa: shareReferrerFromUrl,
			})
			if (!ret.success) {
				Toast.show({ content: ret.error ?? 'Like update failed', position: 'top' })
				return
			}
			const eoa = resolveUserEoa()
			if (eoa) {
				saveDiscoverUserLikeLocalCache(eoa, cardNorm, DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD, '0', true)
				invalidateDiscoverUserLikeBalanceCache(eoa, cardNorm, DISCOVER_USER_LIKE_TARGET.MERCHANT_CARD, '0')
			}
			setUserLiked(true)
			invalidateDiscoverMerchantStatCache(cardNorm)
			applyDiscoverMerchantLikeCountDelta(cardNorm, 1)
			registerDiscoverMerchantStatFeedCards([cardNorm])
			Toast.show({ content: 'Liked', position: 'top' })
		} finally {
			setLikeLoading(false)
		}
	}, [
		item.cardAddress,
		likeLoading,
		userLiked,
		profile,
		setProfiles,
		navigate,
		resolveUserEoa,
		registerDiscoverMerchantStatFeedCards,
		applyDiscoverMerchantLikeCountDelta,
		shareReferrerFromUrl,
	])

	const onMerchantLikeHeartClick = useCallback(() => {
		if (likeLoading || userLiked) return
		void submitMerchantUserLike()
	}, [likeLoading, userLiked, submitMerchantUserLike])

	const getPrivateKeyArmorForLike = useCallback((): string | undefined => {
		return resolveSigningPrivateKeyArmor(profile) || undefined
	}, [profile])

	const refreshMerchantAssets = useCallback(() => {
		if (!profile?.keyID || !item.cardAddress) return
		getMyAssets(profile, item.cardAddress)
			.then((res) => {
				if (res != null) setMerchantAssets(res)
			})
			.catch(() => {
				/* untrusted — keep last trusted */
			})
	}, [profile, item.cardAddress])

	const resetUsdcTopupFlow = useCallback(() => {
		usdcTopupPollAbortRef.current?.abort()
		usdcTopupPollAbortRef.current = null
		if (usdcTopupUrlCopiedTimerRef.current != null) {
			clearTimeout(usdcTopupUrlCopiedTimerRef.current)
			usdcTopupUrlCopiedTimerRef.current = null
		}
		setUsdcTopupUrlCopied(false)
		setUsdcTopupPhase('idle')
		setUsdcTopupAmountText('')
		setUsdcTopupFiatAmount('')
		setUsdcTopupQrValue('')
		setUsdcTopupUsdcDisplay('')
		setUsdcTopupBaselineUsdc6(0n)
		setUsdcTopupUserEoa('')
		setUsdcTopupRecipientAa('')
		setUsdcTopupWorkflow('')
		setUsdcTopupRequiredUsdc6(0n)
		setUsdcTopupProgress('')
		setUsdcTopupSubmitting(false)
		setUsdcTopupError('')
		setUsdcTopupRulesHint('')
		setUsdcTopupIntent('topup')
	}, [])

	const submitDiscoverEoaTopup = useCallback(
		async (
			requiredUsdc6: bigint,
			transferAmountStr?: string,
			intentOverride?: USDCUserCardTopupIntent,
		): Promise<boolean> => {
			const cardAddress = item.cardAddress?.trim() ?? ''
			if (!cardAddress || !profile?.keyID || !profile?.privateKeyArmor) return false
			if (requiredUsdc6 <= 0n) return false
			const usdcAmount =
				transferAmountStr?.trim() ||
				usdc6ToExactTransferAmount(requiredUsdc6)
			const ret = await postUSDCUserCardTopup({
				profile: profile as profile,
				cardAddress,
				usdcAmount,
				intent: intentOverride ?? usdcTopupIntent,
			})
			if (!ret.success) {
				setUsdcTopupError(mapServerError(ret.error ?? 'Top-up failed'))
				return false
			}
			if (ret.assets) setMerchantAssets(ret.assets as Awaited<ReturnType<typeof getMyAssets>>)
			else refreshMerchantAssets()
			Toast.show({ content: tu('top_up_completed'), position: 'top' })
			resetUsdcTopupFlow()
			return true
		},
		[item.cardAddress, profile, refreshMerchantAssets, resetUsdcTopupFlow, usdcTopupIntent],
	)

	useEffect(() => {
		if (usdcTopupPhase !== 'amount' || !item.cardAddress) return
		const userEoa = resolveUserEoa()
		if (!userEoa) return
		let cancelled = false
		void (async () => {
			const rules = await fetchDiscoverUsdcTopupRules({
				cardAddress: item.cardAddress!,
				fromEoa: userEoa,
			})
			if (cancelled) return
			if (!rules.ok) {
				setUsdcTopupRulesHint('')
				return
			}
			setUsdcTopupIntent(rules.intent)
			setUsdcTopupRulesHint(discoverUsdcTopupRulesHintText(rules.preview))
		})()
		return () => {
			cancelled = true
		}
	}, [item.cardAddress, resolveUserEoa, usdcTopupPhase])

	const handleUsdcTopupContinue = useCallback(async () => {
		const cardAddress = item.cardAddress?.trim() ?? ''
		if (!cardAddress || !ethers.isAddress(cardAddress)) {
			setUsdcTopupError('Merchant card is unavailable.')
			return
		}
		if (!profile?.keyID || !profile?.privateKeyArmor) {
			Toast.show({
				content: tu('unlock_your_wallet_with_your_access_password_to_top_up'),
				position: 'top',
			})
			navigate('/settings')
			return
		}
		const parsed = parseDiscoverTopupAmountInput(usdcTopupAmountText, displayCurrency)
		if (!parsed.ok) {
			setUsdcTopupError(parsed.error)
			return
		}
		const userEoa = resolveUserEoa()
		if (!userEoa) {
			Toast.show({
				content: tu('unlock_your_wallet_with_your_access_password_to_top_up'),
				position: 'top',
			})
			navigate('/settings')
			return
		}
		setUsdcTopupSubmitting(true)
		setUsdcTopupError('')
		try {
			const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
			if (!privateKeyArmor) {
				Toast.show({
					content: tu('unlock_your_wallet_with_your_access_password_to_top_up'),
					position: 'top',
				})
				navigate('/settings')
				return
			}

			let cardOwner: string
			try {
				cardOwner = await getCardOwner(cardAddress)
			} catch {
				setUsdcTopupError(mapServerError('Cannot resolve merchant card owner. Please retry.'))
				return
			}
			if (!cardOwner || cardOwner === ethers.ZeroAddress) {
				setUsdcTopupError(mapServerError('Cannot resolve merchant card owner. Please retry.'))
				return
			}

			const quotedUsdc6 = await fetchDiscoverClientTopupQuotedUsdc6({
				cardAddress,
				cardOwner,
				amount: parsed.apiAmount,
				currency: displayCurrency,
			})
			if (quotedUsdc6 <= 0n) {
				setUsdcTopupError('Invalid top-up amount.')
				return
			}
			const quotePrecheck = await precheckDiscoverUsdcTopupUsdc6({
				cardAddress,
				fromEoa: userEoa,
				usdc6: quotedUsdc6,
			})
			if (!quotePrecheck.ok) {
				setUsdcTopupError(quotePrecheck.error)
				return
			}
			setUsdcTopupIntent(quotePrecheck.intent)
			const usdcDisplay = formatQuotedUsdc6ForDisplay(quotedUsdc6)
			setUsdcTopupFiatAmount(parsed.apiAmount)
			setUsdcTopupRequiredUsdc6(quotedUsdc6)
			setUsdcTopupUsdcDisplay(usdcDisplay)

			const userAa = resolveUserAa()

			/** 1) Prefer Base USDC → treasury → card points (treasuryBridge). */
			let baseUsdc6 = 0n
			try {
				baseUsdc6 = await readEoaUsdcBalance6(profile as profile)
			} catch {
				/* untrusted — treat as 0 for local Base path; may still use CoNET-USDC / QR */
			}
			if (eoaCanSelfFundDiscoverTopup(baseUsdc6, quotedUsdc6)) {
				if (!userAa) {
					setUsdcTopupError(
						'Smart Wallet (AA) is required for Base USDC top-up. Open Wallet and finish setup, then retry.',
					)
					return
				}
				setUsdcTopupBaselineUsdc6(baseUsdc6)
				setUsdcTopupProgress('Paying with Base USDC…')
				const localPay = await payDiscoverTreasuryBridgeWithLocalWallet({
					profile: profile as profile,
					privateKeyArmor,
					cardAddress,
					cardOwner,
					recipientAa: userAa,
					amount: parsed.apiAmount,
					currency: displayCurrency,
					quotedUsdc6,
				})
				if (localPay.ok) {
					refreshMerchantAssets()
					Toast.show({
						content: 'Top-up submitted. Smart Wallet card points update shortly.',
						position: 'top',
					})
					resetUsdcTopupFlow()
					return
				}
				if (!localPay.insufficientBalance) {
					setUsdcTopupError(mapServerError(localPay.error))
					return
				}
				/* Balance raced down — continue to CoNET-USDC / QR. */
			}

			/** 2) Wallet CoNET-USDC self-fund → `/api/usdcTopup`. */
			const baselineUsdc6 = await readEoaConetUsdcBalance6(profile as profile)
			setUsdcTopupBaselineUsdc6(baselineUsdc6)
			const selfFundUsdc6 = await currencyAmountToSafeUsdc6(
				cardAddress,
				displayCurrency,
				parsed.apiAmount,
			)
			if (selfFundUsdc6 > 0n && eoaCanSelfFundDiscoverTopup(baselineUsdc6, selfFundUsdc6)) {
				const selfPrecheck = await precheckDiscoverUsdcTopupUsdc6({
					cardAddress,
					fromEoa: userEoa,
					usdc6: selfFundUsdc6,
				})
				if (!selfPrecheck.ok) {
					setUsdcTopupError(selfPrecheck.error)
					return
				}
				setUsdcTopupIntent(selfPrecheck.intent)
				setUsdcTopupRequiredUsdc6(selfFundUsdc6)
				setUsdcTopupUsdcDisplay(safeUsdc6ToAmountString(selfFundUsdc6))
				setUsdcTopupProgress('Completing top-up…')
				await submitDiscoverEoaTopup(
					selfFundUsdc6,
					safeUsdc6ToAmountString(selfFundUsdc6),
					selfPrecheck.intent,
				)
				return
			}

			/** 3) Insufficient local funds → third-party treasuryBridge QR. */
			if (!userAa) {
				setUsdcTopupError(
					'Smart Wallet (AA) is required for top-up. Open Wallet and finish setup, then retry.',
				)
				return
			}
			const qrValue = buildDiscoverUsdcTreasuryBridgeQrUrl({
				cardAddress,
				cardOwner,
				amount: parsed.apiAmount,
				currency: displayCurrency,
				recipientAa: userAa,
			})
			setUsdcTopupUserEoa(userEoa)
			setUsdcTopupRecipientAa(userAa)
			setUsdcTopupWorkflow('treasuryBridge')
			setUsdcTopupQrValue(qrValue)
			setUsdcTopupProgress('Waiting for payment on beamio.app…')
			setUsdcTopupPhase('receive')
		} catch (e: unknown) {
			setUsdcTopupError(mapServerError(e instanceof Error ? e.message : 'Failed to prepare receive QR'))
		} finally {
			setUsdcTopupSubmitting(false)
		}
	}, [
		displayCurrency,
		item.cardAddress,
		navigate,
		profile,
		refreshMerchantAssets,
		resetUsdcTopupFlow,
		resolveUserAa,
		resolveUserEoa,
		submitDiscoverEoaTopup,
		usdcTopupAmountText,
	])

	const copyUsdcTopupUrl = useCallback(async () => {
		if (!usdcTopupQrValue) return
		try {
			await navigator.clipboard.writeText(usdcTopupQrValue)
			setUsdcTopupUrlCopied(true)
			if (usdcTopupUrlCopiedTimerRef.current != null) {
				clearTimeout(usdcTopupUrlCopiedTimerRef.current)
			}
			usdcTopupUrlCopiedTimerRef.current = setTimeout(() => {
				setUsdcTopupUrlCopied(false)
				usdcTopupUrlCopiedTimerRef.current = null
			}, 2000)
		} catch {
			Toast.show({ content: tu('failed_to_copy_url'), position: 'top' })
		}
	}, [usdcTopupQrValue])

	const runDiscoverEoaTopupNow = useCallback(async () => {
		const cardAddress = item.cardAddress?.trim() ?? ''
		if (!cardAddress || !profile?.keyID || !profile?.privateKeyArmor) return
		if (usdcTopupWorkflow === 'treasuryBridge') {
			setUsdcTopupSubmitting(true)
			setUsdcTopupError('')
			try {
				const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
				const userAa = usdcTopupRecipientAa || resolveUserAa()
				const userEoa = resolveUserEoa()
				if (
					privateKeyArmor &&
					userAa &&
					userEoa &&
					usdcTopupRequiredUsdc6 > 0n &&
					usdcTopupFiatAmount
				) {
					let cardOwner: string | null = null
					try {
						cardOwner = await getCardOwner(cardAddress)
					} catch {
						cardOwner = null
					}
					if (cardOwner && cardOwner !== ethers.ZeroAddress) {
						const localPay = await payDiscoverTreasuryBridgeWithLocalWallet({
							profile: profile as profile,
							privateKeyArmor,
							cardAddress,
							cardOwner,
							recipientAa: userAa,
							amount: usdcTopupFiatAmount,
							currency: displayCurrency,
							quotedUsdc6: usdcTopupRequiredUsdc6,
						})
						if (localPay.ok) {
							refreshMerchantAssets()
							Toast.show({
								content: 'Top-up submitted. Smart Wallet card points update shortly.',
								position: 'top',
							})
							resetUsdcTopupFlow()
							return
						}
						if (!localPay.insufficientBalance) {
							setUsdcTopupError(mapServerError(localPay.error))
							return
						}
					}
				}
				refreshMerchantAssets()
				Toast.show({
					content: 'If payment succeeded, Smart Wallet card points update shortly.',
					position: 'top',
				})
				resetUsdcTopupFlow()
			} finally {
				setUsdcTopupSubmitting(false)
			}
			return
		}
		if (usdcTopupRequiredUsdc6 <= 0n || !usdcTopupFiatAmount) return
		usdcTopupPollAbortRef.current?.abort()
		setUsdcTopupSubmitting(true)
		setUsdcTopupError('')
		try {
			const current6 = await readEoaConetUsdcBalance6(profile as profile)
			const funded =
				eoaCanSelfFundDiscoverTopup(current6, usdcTopupRequiredUsdc6) ||
				eoaMeetsExternalFundingTarget(current6, usdcTopupBaselineUsdc6, usdcTopupRequiredUsdc6)
			if (!funded) {
				setUsdcTopupError('CoNET-USDC has not arrived yet. Ask the payer to complete the payment link.')
				return
			}
			setUsdcTopupProgress('Completing top-up…')
			await submitDiscoverEoaTopup(
				usdcTopupRequiredUsdc6,
				usdc6ToExactTransferAmount(usdcTopupRequiredUsdc6),
			)
		} catch (e: unknown) {
			setUsdcTopupError(mapServerError(e instanceof Error ? e.message : 'Top-up failed'))
		} finally {
			setUsdcTopupSubmitting(false)
		}
	}, [
		displayCurrency,
		item.cardAddress,
		profile,
		refreshMerchantAssets,
		resetUsdcTopupFlow,
		resolveUserAa,
		resolveUserEoa,
		submitDiscoverEoaTopup,
		usdcTopupBaselineUsdc6,
		usdcTopupFiatAmount,
		usdcTopupRecipientAa,
		usdcTopupRequiredUsdc6,
		usdcTopupWorkflow,
	])

	useEffect(() => {
		if (usdcTopupPhase !== 'receive' || !item.cardAddress || !profile?.keyID) return
		if (usdcTopupWorkflow === 'treasuryBridge') return
		if (usdcTopupRequiredUsdc6 <= 0n || !usdcTopupFiatAmount) return
		usdcTopupPollAbortRef.current?.abort()
		const ac = new AbortController()
		usdcTopupPollAbortRef.current = ac
		const cardAddress = item.cardAddress

		void (async () => {
			const outcome = await pollEoaUsdcFundingThenTopup({
				profile: profile as profile,
				cardAddress,
				baselineUsdc6: usdcTopupBaselineUsdc6,
				requiredUsdc6: usdcTopupRequiredUsdc6,
				intent: usdcTopupIntent,
				signal: ac.signal,
				onProgress: setUsdcTopupProgress,
			})
			if (ac.signal.aborted) return

			if (outcome.status === 'success') {
				refreshMerchantAssets()
				Toast.show({ content: tu('top_up_completed'), position: 'top' })
				resetUsdcTopupFlow()
				return
			}
			if (outcome.status === 'error') {
				setUsdcTopupError(outcome.message)
				return
			}
			if (outcome.status === 'timeout') {
				setUsdcTopupError('Timed out waiting for USDC. You can retry after the transfer completes.')
			}
		})()

		return () => {
			ac.abort()
		}
	}, [
		item.cardAddress,
		profile,
		refreshMerchantAssets,
		resetUsdcTopupFlow,
		usdcTopupBaselineUsdc6,
		usdcTopupFiatAmount,
		usdcTopupPhase,
		usdcTopupRequiredUsdc6,
		usdcTopupIntent,
		usdcTopupWorkflow,
	])

	useEffect(
		() => () => {
			usdcTopupPollAbortRef.current?.abort()
		},
		[],
	)

	const scheduleCouponClaimStatusReset = useCallback((rowId: string) => {
		const prev = couponClaimStatusTimersRef.current.get(rowId)
		if (prev) clearTimeout(prev)
		const timer = setTimeout(() => {
			setCouponClaimStatusById((s) => {
				if (!s[rowId]) return s
				const next = { ...s }
				delete next[rowId]
				return next
			})
			setCouponClaimErrorById((s) => {
				if (!s[rowId]) return s
				const next = { ...s }
				delete next[rowId]
				return next
			})
			couponClaimStatusTimersRef.current.delete(rowId)
		}, 3000)
		couponClaimStatusTimersRef.current.set(rowId, timer)
	}, [])

	const handleDiscoverCouponClaim = useCallback(
		async (offer: DiscoverMerchantCouponOffer) => {
			const row = offer.coupon
			const currentStatus = couponClaimStatusById[row.id] ?? 'idle'
			if (currentStatus !== 'idle') return
			let privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
			if (!privateKeyArmor) {
				const stored = await checkStorage()
				if (stored?.profiles?.length) {
					setProfiles(stored.profiles)
					privateKeyArmor = resolveSigningPrivateKeyArmor(stored.profiles[0])
				}
			}
			if (!privateKeyArmor) {
				Toast.show({
					content: tu('unlock_your_wallet_with_your_access_password_to_claim_coupons'),
					position: 'top',
				})
				navigate('/settings')
				return
			}
			const cardAddress = row.cardAddress?.trim() ?? ''
			const couponId = row.couponId?.trim() ?? ''
			const tokenId = row.tokenId?.trim() ?? ''
			if (!cardAddress || !couponId || !tokenId || !ethers.isAddress(cardAddress)) {
				Toast.show({ content: tu('coupon_claim_parameters_are_invalid'), position: 'top' })
				return
			}
			setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'loading' }))
			setCouponClaimErrorById((s) => {
				if (!s[row.id]) return s
				const next = { ...s }
				delete next[row.id]
				return next
			})
			try {
				const ret = await postCardCouponOpenClaimWithCurrentWallet({
					cardAddress: ethers.getAddress(cardAddress),
					couponId,
					tokenId,
					privateKeyArmor,
					referrerEoa: shareReferrerFromUrl,
				})
				if (ret.success) {
					// Cluster accepted queue (`queued: true`) counts as claimed for UI — do not wait for chain tx.
					applyCouponOpenClaimStatus({
						cardAddress: ethers.getAddress(cardAddress),
						tokenId,
						couponId,
						status: 'claimed',
						source: 'optimistic',
					})
					setCouponClaimEligibilityById((s) => ({ ...s, [row.id]: 'already_claimed' }))
					setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'success' }))
					scheduleCouponClaimStatusReset(row.id)
					// No Toast here: Toast remount/scroll often refreshes the Coupons panel on mobile.
				} else {
					const err = ret.error ?? 'Coupon claim failed'
					let claimerEoa: string | null = null
					try {
						claimerEoa = new ethers.Wallet(privateKeyArmor).address
					} catch {
						claimerEoa = null
					}
					if (/already claimed/i.test(err)) {
						if (claimerEoa) {
							applyCouponOpenClaimStatus({
								cardAddress: ethers.getAddress(cardAddress),
								tokenId,
								couponId,
								status: 'claimed',
								source: 'chain',
							})
						}
						setCouponClaimEligibilityById((s) => ({ ...s, [row.id]: 'already_claimed' }))
						setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'idle' }))
					} else if (/already redeemed|already used|SigClaimAlreadyUsed/i.test(err)) {
						if (claimerEoa) {
							applyCouponOpenClaimStatus({
								cardAddress: ethers.getAddress(cardAddress),
								tokenId,
								couponId,
								status: 'redeemed',
								source: 'chain',
							})
						}
						setCouponClaimEligibilityById((s) => ({ ...s, [row.id]: 'already_redeemed' }))
						setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'idle' }))
					} else {
						setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'error' }))
						setCouponClaimErrorById((s) => ({ ...s, [row.id]: err }))
						scheduleCouponClaimStatusReset(row.id)
					}
					Toast.show({ content: mapServerError(err), position: 'top' })
				}
			} catch (e: unknown) {
				const err = e instanceof Error ? e.message : 'Coupon claim failed'
				setCouponClaimStatusById((s) => ({ ...s, [row.id]: 'error' }))
				setCouponClaimErrorById((s) => ({ ...s, [row.id]: err }))
				scheduleCouponClaimStatusReset(row.id)
				Toast.show({ content: mapServerError(err), position: 'top' })
			}
		},
		[couponClaimStatusById, profile, navigate, scheduleCouponClaimStatusReset, setProfiles, shareReferrerFromUrl, applyCouponOpenClaimStatus],
	)

	useEffect(() => {
		if (!profile?.keyID || !item.cardAddress) {
			setMerchantAssets(null)
			setMerchantAssetsLoading(false)
			return
		}
		let cancelled = false
		setMerchantAssetsLoading(true)
		getMyAssets(profile, item.cardAddress)
			.then((res) => {
				if (!cancelled) setMerchantAssets(res ?? null)
			})
			.catch(() => {
				// Untrusted fetch — keep panel visible; do not overwrite with synthetic zero.
				if (!cancelled) setMerchantAssets((prev) => prev)
			})
			.finally(() => {
				if (!cancelled) setMerchantAssetsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [profile?.keyID, item.cardAddress])

	useEffect(() => {
		if (!item.cardAddress) {
			setUserSocialPoints13(null)
			setUserSocialPointsLoading(false)
			return
		}
		const userEOA = resolveUserEoa()
		if (!userEOA) {
			setUserSocialPoints13(null)
			setUserSocialPointsLoading(false)
			return
		}
		let cancelled = false
		setUserSocialPointsLoading(true)
		void readUserSocialPoints13BalanceOnCard(item.cardAddress, userEOA)
			.then((bal) => {
				if (cancelled || bal == null) return
				const n = Number(bal)
				if (Number.isFinite(n) && n >= 0) setUserSocialPoints13(Math.trunc(n))
			})
			.catch(() => {
				/* untrusted — keep last trusted */
			})
			.finally(() => {
				if (!cancelled) setUserSocialPointsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress, resolveUserEoa, profile?.keyID])

	useEffect(() => {
		if (!item.cardAddress) {
			setReferrerDashboard(null)
			setReferrerDashboardLoading(false)
			return
		}
		const userEOA = resolveUserEoa()
		if (!userEOA) {
			setReferrerDashboard(null)
			setReferrerDashboardLoading(false)
			return
		}
		let cancelled = false
		setReferrerDashboardLoading(true)
		setReferrerDashboard(null)
		void fetchCardProgramReferrerDashboard(item.cardAddress, userEOA)
			.then((snap) => {
				if (cancelled || !snap) return
				setReferrerDashboard(snap)
			})
			.catch(() => {
				/* untrusted — keep last trusted snapshot */
			})
			.finally(() => {
				if (!cancelled) setReferrerDashboardLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [item.cardAddress, resolveUserEoa, profile?.keyID])

	useEffect(() => {
		if (!merchantCoupons?.length) {
			setCouponClaimEligibilityById({})
			return
		}
		let cancelled = false
		const userEOA = resolveUserEoa()
		// Register with global daemon so all Coupons UIs share claimed/redeemed refreshes.
		registerCouponOpenClaimFeedTargets(
			merchantCoupons.map((offer) => ({
				cardAddress: offer.seriesRow.cardAddress || offer.coupon.cardAddress,
				tokenId: String(offer.seriesRow.tokenId || offer.coupon.tokenId),
				couponId: offer.coupon.couponId,
			})),
		)
		// Sync hydrate from daemon EOA map (local-first) so remount shows claimed/redeemed immediately.
		const fromDaemon: Record<string, CouponOpenClaimEligibility> = {}
		for (const offer of merchantCoupons) {
			const el = couponOpenClaimEligibilityFromLocal(
				pickCouponOpenClaimStatusFromMap(
					couponOpenClaimStatusByKey,
					offer.seriesRow.cardAddress || offer.coupon.cardAddress,
					offer.seriesRow.tokenId || offer.coupon.tokenId,
				),
			)
			if (el) fromDaemon[offer.coupon.id] = el
		}
		if (Object.keys(fromDaemon).length > 0) {
			setCouponClaimEligibilityById((prev) => ({ ...prev, ...fromDaemon }))
		}
		void (async () => {
			const entries = await Promise.all(
				merchantCoupons.map(async (offer) => {
					const eligibility = await resolveCouponOpenClaimEligibility(offer.seriesRow, userEOA)
					if (eligibility === 'already_claimed' || eligibility === 'already_redeemed') {
						const card = offer.seriesRow.cardAddress || offer.coupon.cardAddress
						const tid = offer.seriesRow.tokenId || offer.coupon.tokenId
						if (card && tid) {
							applyCouponOpenClaimStatus({
								cardAddress: card,
								tokenId: tid,
								couponId: offer.coupon.couponId,
								status: eligibility === 'already_redeemed' ? 'redeemed' : 'claimed',
								source: 'chain',
							})
						}
					}
					return [offer.coupon.id, eligibility] as const
				}),
			)
			if (cancelled) return
			// Merge chain results; keep optimistic claimed/redeemed until chain confirms
			// (queued claim may still read claimable for a few seconds — do not flash the CTA).
			setCouponClaimEligibilityById((prev) => {
				const next = Object.fromEntries(entries) as Record<string, CouponOpenClaimEligibility>
				for (const [id, prevEl] of Object.entries(prev)) {
					if (
						(prevEl === 'already_claimed' || prevEl === 'already_redeemed') &&
						(next[id] === 'claimable' || next[id] === 'unknown' || next[id] == null)
					) {
						next[id] = prevEl
					}
				}
				return next
			})
		})()
		return () => {
			cancelled = true
		}
		// couponOpenClaimStatusByKey intentionally omitted: register+resolve on list change;
		// daemon map merges via dedicated effect below.
	}, [merchantCoupons, resolveUserEoa, registerCouponOpenClaimFeedTargets, applyCouponOpenClaimStatus])

	/** Daemon map updates (optimistic claim / background chain) → Coupons eligibility without remount. */
	useEffect(() => {
		if (!merchantCoupons?.length) return
		const patch: Record<string, CouponOpenClaimEligibility> = {}
		for (const offer of merchantCoupons) {
			const el = couponOpenClaimEligibilityFromLocal(
				pickCouponOpenClaimStatusFromMap(
					couponOpenClaimStatusByKey,
					offer.seriesRow.cardAddress || offer.coupon.cardAddress,
					offer.seriesRow.tokenId || offer.coupon.tokenId,
				),
			)
			if (el) patch[offer.coupon.id] = el
		}
		if (Object.keys(patch).length === 0) return
		setCouponClaimEligibilityById((prev) => {
			let changed = false
			const next = { ...prev }
			for (const [id, el] of Object.entries(patch)) {
				if (next[id] === el) continue
				if (el === 'already_redeemed' || next[id] !== 'already_redeemed') {
					next[id] = el
					changed = true
				}
			}
			return changed ? next : prev
		})
	}, [couponOpenClaimStatusByKey, merchantCoupons])

	useEffect(
		() => () => {
			for (const t of couponClaimStatusTimersRef.current.values()) clearTimeout(t)
			couponClaimStatusTimersRef.current.clear()
		},
		[],
	)

	useEffect(() => {
		if (!item.cardAddress) {
			setMerchantCoupons(null)
			setMerchantOfferTiers(null)
			setMerchantOffersLoading(false)
			return
		}
		let cancelled = false
		const cardAddress = item.cardAddress
		// Only show Coupons loading on first fetch — never blank the panel on metadata/cardMap refresh.
		if (merchantCouponsRef.current == null) {
			setMerchantOffersLoading(true)
		}
		registerCardAddresses([cardAddress])
		Promise.all([
			fetchCardActiveIssuedCouponSeriesTrusted(cardAddress, 50),
			ensureCardMetadataForAddresses([cardAddress], { maxPerTick: 1 }),
		])
			.then(([couponRows, ensuredMap]) => {
				if (cancelled) return
				if (couponRows != null) {
					const mapped = couponRows
						.map((row: CardActiveIssuedCouponSeriesItem) => {
							const seriesRow = row as DiscoverCouponSeriesRow
							const coupon = mapActiveCouponRow(cardAddress, row)
							if (!coupon) return null
							return {
								coupon: {
									...coupon,
									subtitle: normalizeDiscoverCouponSubtitle(coupon.subtitle),
								},
								seriesRow,
								supplySummary: formatDiscoverCouponSupplySummary(seriesRow),
							} satisfies DiscoverMerchantCouponOffer
						})
						.filter((x): x is DiscoverMerchantCouponOffer => x != null)
					setMerchantCoupons((prev) => {
						if (
							prev &&
							prev.length === mapped.length &&
							prev.every(
								(p, i) =>
									p.coupon.id === mapped[i]?.coupon.id &&
									p.coupon.tokenId === mapped[i]?.coupon.tokenId &&
									p.supplySummary === mapped[i]?.supplySummary,
							)
						) {
							return prev
						}
						return mapped
					})
				}
				const key = normalizeCardAddressKey(cardAddress)
				const rec = (key ? ensuredMap[key] : undefined) ?? null
				const metadataRoot =
					rec?.metadataRoot && typeof rec.metadataRoot === 'object' ? rec.metadataRoot : null
				if (metadataRoot) {
					const tiersFromApi = parseDiscoverRewardTiersFromMeta(
						{ tiers: metadataRoot.tiers ?? [] } as Record<string, unknown>,
						ccy,
					)
					if (tiersFromApi.length > 0) {
						setMerchantOfferTiers(tiersFromApi)
					} else {
						setMerchantOfferTiers([])
					}
				}
				const freshAbout = parseDiscoverAboutFromShare(
					readDiscoverNestedObject(metadataRoot, 'shareTokenMetadata'),
				)
				if (freshAbout) setResolvedDiscoverAbout(freshAbout)
			})
			.catch(() => {
				// Untrusted — keep previous coupon/tier state.
			})
			.finally(() => {
				if (!cancelled) setMerchantOffersLoading(false)
			})
		return () => {
			cancelled = true
		}
		// Intentionally omit lookupByAddress: it changes whenever cardMap updates and would
		// re-fetch/remount the Coupons panel (visible flash after claim / metadata warm).
	}, [item.cardAddress, ccy, ensureCardMetadataForAddresses, registerCardAddresses])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	return (
		<>
		<div className="flex h-full min-h-0 flex-col bg-[#f5f7f9] dark:bg-slate-950 text-[#1f2328] dark:text-slate-100">
			<div className="relative shrink-0">
				<div className="relative h-[min(42vh,320px)] w-full overflow-hidden rounded-b-[28px]">
					<DiscoverFeaturedBrandHeroImage
						src={item.image}
						alt=""
						className="pointer-events-none absolute inset-0 h-full w-full object-cover"
					/>
					<div
						className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30"
						aria-hidden
					/>
					{heroRechargeBonusPill ? (
						<DiscoverRechargeBonusHeroChip
							label={heroRechargeBonusPill}
							className="pointer-events-none absolute bottom-4 right-4 z-[15]"
						/>
					) : null}
					<div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 px-5 pb-5 pt-8">
						<div className="mb-1 flex items-center gap-2">
							<span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
								<MerchantCategoryIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
							</span>
						</div>
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
							<h1 className="text-2xl font-bold leading-tight text-white drop-shadow-sm">{item.title}</h1>
							{issuerOwnerEoa ? (
								<span className="pointer-events-auto">
									<DiscoverMerchantOwnerBeamioTagCapsule
										ownerEoa={issuerOwnerEoa}
										onOpenProfile={() => void openIssuerProfile()}
										profileOpening={issuerProfileOpening}
									/>
								</span>
							) : null}
						</div>
						<DiscoverHeroStatCapsules likeCount={merchantLikeCount} shareClickCount={merchantShareClickCount} />
						{item.cardAddress ? (
							<span className="pointer-events-auto">
								<DiscoverMerchantCardAddressCapsule address={item.cardAddress} />
							</span>
						) : null}
					</div>
				</div>
				{/* Chrome outside overflow-hidden so safe-area / WebKit hit targets are not clipped. */}
				<div className={BEAMIO_HERO_FLOATING_BACK_ROW_CLASS} style={beamioHeroFloatingBackTopStyle}>
					<BeamioCircularBackButton variant="onDark" onClick={onClose} />
					<div className="flex items-center gap-2">
						{item.cardAddress ? (
							<DiscoverMerchantShareButton
								cardAddress={item.cardAddress}
								merchantTitle={item.title}
								referrerEoa={shareReferrerEoa}
							/>
						) : null}
						<button
							type="button"
							onClick={onMerchantLikeHeartClick}
							disabled={likeLoading || Boolean(userLiked)}
							className={[
								"flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 active:scale-95 disabled:opacity-70",
								userLiked
									? "bg-rose-500 text-white ring-rose-600/30 disabled:cursor-default"
									: "bg-slate-800/85 text-white ring-white/10",
							].join(" ")}
							aria-label={userLiked ? "Liked" : "Like this brand"}
							aria-pressed={Boolean(userLiked)}
						>
							{likeLoading ? (
								<Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden />
							) : (
								<Heart className="h-5 w-5" strokeWidth={2} fill={userLiked ? "currentColor" : "none"} />
							)}
						</button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
				<div className="mx-auto max-w-lg space-y-4">
					{isConetGenesisCard ? (
						<ConetGenesisNodeDiscoverSection
							onLockSeat={lockConetGenesisSeat}
							purchasePhase={genesisSeatPurchase}
							eoaUsdcBalance6={genesisEoaUsdcBalance6}
							beneficiaryEoa={resolveUserEoa()}
							initialReferrerEoa={genesisDeepLinkReferrerEoa}
						/>
					) : null}
					{/* Genesis card still exposes Coupons below; membership chrome stays non-genesis. */}
					{!isConetGenesisCard ? (
					<>
					{discoverWelcomePanel ? (
						<DiscoverMerchantWelcomePanel
							title={discoverWelcomePanel.title}
							body={discoverWelcomePanel.body}
						/>
					) : null}

					<div className="rounded-[22px] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h3 className="truncate text-[17px] font-semibold leading-snug text-[#1f2328] dark:text-slate-100">
									{passTitle}
								</h3>
								{hasActiveMembership ? (
									<div className="mt-1.5 flex items-center gap-1.5">
										<span className="h-2 w-2 shrink-0 rounded-full bg-[#1562f0]" aria-hidden />
										<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
											Active Member
										</span>
									</div>
								) : null}
							</div>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white shadow-sm">
								<Radio className="h-5 w-5" strokeWidth={2} aria-hidden />
							</span>
						</div>
						<div className="mt-5 flex items-end justify-between gap-3">
							<p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">Available Balance</p>
							{item.cardAddress && usdcTopupPhase === 'idle' ? (
								<button
									type="button"
									onClick={() => {
										setUsdcTopupError('')
										setUsdcTopupAmountText('')
										setUsdcTopupPhase('amount')
									}}
									className="shrink-0 rounded-full border border-[#1562f0]/25 bg-[#1562f0]/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[#1562f0] transition active:scale-[0.98] hover:bg-[#1562f0]/15"
								>
									Top up
								</button>
							) : null}
						</div>
						<p className="mt-1 text-right text-[32px] font-bold leading-none tracking-tight text-[#1f2328] dark:text-slate-100">
							{balanceDisplay}
						</p>

						{usdcTopupPhase === 'amount' ? (
							<div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
								<label htmlFor="discover-usdc-topup-amount" className="block text-[13px] font-semibold text-slate-600 dark:text-slate-400">
									Top-up amount ({displayCurrency})
								</label>
								{usdcTopupRulesHint ? (
									<p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
										{usdcTopupRulesHint}
									</p>
								) : null}
								<input
									id="discover-usdc-topup-amount"
									type="number"
									inputMode="decimal"
									autoComplete="off"
									enterKeyHint="done"
									value={usdcTopupAmountText}
									onChange={(e) => {
										setUsdcTopupAmountText(e.target.value)
										if (usdcTopupError) setUsdcTopupError('')
									}}
									onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
										if (
											e.key === 'ArrowUp' ||
											e.key === 'ArrowDown' ||
											e.key === 'PageUp' ||
											e.key === 'PageDown' ||
											e.key === 'Home' ||
											e.key === 'End'
										) {
											e.preventDefault()
											e.stopPropagation()
										}
									}}
									onWheel={(e: React.WheelEvent<HTMLInputElement>) => {
										e.preventDefault()
										e.stopPropagation()
									}}
									placeholder="0.00"
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-[18px] font-semibold text-[#1f2328] outline-none ring-[#1562f0]/30 focus:border-[#1562f0] focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
								/>
								{usdcTopupError ? (
									<p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">{usdcTopupError}</p>
								) : null}
								<div className="flex gap-2">
									<button
										type="button"
										onClick={resetUsdcTopupFlow}
										className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-600 transition active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
									>{tu('cancel')}</button>
									<button
										type="button"
										disabled={usdcTopupSubmitting}
										onClick={() => void handleUsdcTopupContinue()}
										className="flex-1 rounded-full bg-[#1562f0] px-4 py-2.5 text-[14px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
									>
										{usdcTopupSubmitting ? (
											<span className="inline-flex items-center justify-center gap-2">
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />{tu('continue')}</span>
										) : (
											tu('continue')
										)}
									</button>
								</div>
							</div>
						) : null}

						{usdcTopupPhase === 'receive' && usdcTopupQrValue ? (
							<div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
								<p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
									{discoverTreasuryBridgePaymentHint()}
								</p>
								<p className="text-[12px] text-slate-500 dark:text-slate-400">
									Merchant top-up: {fiatPrefix(displayCurrency)}{usdcTopupFiatAmount} {displayCurrency} → {usdcTopupUsdcDisplay} USDC
									{usdcTopupRecipientAa
										? ` · Smart Wallet ${usdcTopupRecipientAa.slice(0, 6)}…${usdcTopupRecipientAa.slice(-4)}`
										: ''}
								</p>
								{usdcTopupProgress ? (
									<p className="text-[13px] font-medium text-[#1562f0]">{usdcTopupProgress}</p>
								) : null}
								{usdcTopupError ? (
									<p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">{usdcTopupError}</p>
								) : null}
								<ShowPayQR
									successUrl={usdcTopupQrValue}
									beamio={null}
									qrValue={usdcTopupQrValue}
									amount={usdcTopupUsdcDisplay}
									currency="$"
									hideActions
									hideName
								/>
								<div className="flex flex-col items-center gap-1.5">
									<button
										type="button"
										onClick={() => void copyUsdcTopupUrl()}
										className={[
											'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
											'border border-slate-200 bg-white text-slate-600 shadow-sm',
											'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
											'transition active:scale-[0.96]',
										].join(' ')}
										aria-label="Copy payment URL"
										title={usdcTopupUrlCopied ? '已复制' : 'Copy URL'}
									>
										{usdcTopupUrlCopied ? (
											<Check className="h-[17px] w-[17px] text-emerald-500" strokeWidth={2.5} aria-hidden />
										) : (
											<Copy className="h-[17px] w-[17px]" strokeWidth={2.5} aria-hidden />
										)}
									</button>
									<p className="text-[12px] text-slate-500 dark:text-slate-400">Copy URL for another wallet app</p>
								</div>
								<button
									type="button"
									disabled={usdcTopupSubmitting}
									onClick={() => void runDiscoverEoaTopupNow()}
									className="w-full rounded-full bg-[#1562f0] px-4 py-2.5 text-[14px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
								>
									{usdcTopupSubmitting ? (
										<span className="inline-flex items-center justify-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											{usdcTopupWorkflow === 'treasuryBridge' ? 'Refreshing…' : 'Complete top-up'}
										</span>
									) : usdcTopupWorkflow === 'treasuryBridge' ? (
										"I've paid — refresh balance"
									) : (
										'Complete top-up'
									)}
								</button>
								<button
									type="button"
									onClick={resetUsdcTopupFlow}
									className="w-full rounded-full border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-600 transition active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
								>
									Close
								</button>
							</div>
						) : null}
					</div>

					{topupPromotionCapsule ? (
						<DiscoverTopupPromotionCapsule
							title={topupPromotionCapsule.title}
							description={topupPromotionCapsule.description}
						/>
					) : null}

					{(() => {
						const promotionsLoaded =
							merchantMetadataRoot != null || merchantCoupons != null
						const showActivePromotionsPanel =
							(promotionsLoaded && activePromotionsPanel != null) ||
							(merchantOffersLoading && !promotionsLoaded)
						if (!showActivePromotionsPanel) return null
						return (
							<DiscoverMerchantActivePromotionsPanel
								model={promotionsLoaded ? activePromotionsPanel : null}
								loading={merchantOffersLoading && !promotionsLoaded}
								merchantName={item.title}
								cardAddress={item.cardAddress ?? ''}
								getPrivateKeyArmor={getPrivateKeyArmorForLike}
							/>
						)
					})()}

					{curatedOffersPanel ? (
						<DiscoverMerchantCuratedOffersStack
							config={curatedOffersPanel}
							onPointsMallClick={scrollToCouponsSection}
							onCollectOffer={scrollToCouponsSection}
							showTopUpBonus={!topupPromotionCapsule}
						/>
					) : null}
					</>
					) : null}

					{/* Total Points: all Discover merchant details, including CoNET Genesis. */}
					<DiscoverMerchantLoyaltyPointsCard
						consumptionEnabled={consumptionPointSystemEnabled}
						consumptionPoints={userConsumptionPoints}
						socialPoints={userSocialPoints13}
						consumptionLoading={merchantAssetsLoading}
						socialLoading={userSocialPointsLoading}
					/>

					{/* Card program REFERRER dashboard (biz Referrer Reward) — all merchant cards. */}
					<DiscoverMerchantReferrerDashboardCard
						snapshot={referrerDashboard}
						loading={referrerDashboardLoading}
						onOpenMyReferees={
							item.cardAddress && resolveUserEoa()
								? () => setReferrerDownlineOpen(true)
								: undefined
						}
					/>

					<div className="space-y-4">
						<h2 className="text-lg font-bold text-[#1f2328] dark:text-slate-100">Available Offers</h2>

						<div
							ref={couponsSectionRef}
							className="rounded-[22px] bg-white px-6 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800 sm:px-7"
						>
							<header className="mb-3 flex items-center justify-between gap-2">
								<h3 className="text-base font-bold text-[#1f2328] dark:text-slate-100">Coupons</h3>
								{merchantCoupons != null ? (
									<span className="rounded-full border border-[#1562f0]/15 bg-[#1562f0]/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1562f0]">
										{merchantCoupons.length.toLocaleString()} total
									</span>
								) : null}
							</header>
							{merchantOffersLoading && merchantCoupons == null ? (
								<div className="flex items-center justify-center gap-2 py-6 text-slate-500 dark:text-slate-400">
									<Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden />
									<span className="text-[14px] font-medium">Loading coupons…</span>
								</div>
							) : merchantCoupons != null && merchantCoupons.length > 0 ? (
								<div className="space-y-3">
									{merchantCoupons.map((row) => (
										<DiscoverMerchantCouponOfferRow
											key={row.coupon.id}
											row={row}
											claimEligibility={couponClaimEligibilityById[row.coupon.id]}
											claimStatus={couponClaimStatusById[row.coupon.id] ?? 'idle'}
											claimError={couponClaimErrorById[row.coupon.id]}
											onClaim={() => void handleDiscoverCouponClaim(row)}
											referrerEoa={shareReferrerFromUrl}
											getPrivateKeyArmor={getPrivateKeyArmorForLike}
											onWalletUnlock={() => navigate('/settings')}
										/>
									))}
								</div>
							) : (
								<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-center text-[13px] font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
									No coupons available yet.
								</div>
							)}
						</div>

						{!isConetGenesisCard ? (
						<div className="rounded-[22px] bg-[#eef1f3] p-4 dark:bg-slate-900/80 sm:p-5">
							<header className="mb-3 flex items-center justify-between gap-2">
								<h3 className="text-base font-bold text-[#1f2328] dark:text-slate-100">Reward Tiers</h3>
								{rewardTierDisplayCount != null ? (
									<span className="rounded-full border border-[#1562f0]/15 bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1562f0] dark:bg-slate-800">
										{rewardTierDisplayCount.toLocaleString()} reward tiers
									</span>
								) : null}
							</header>
							{showRewardTiersLoading ? (
								<div className="flex items-center justify-center gap-2 py-6 text-slate-500 dark:text-slate-400">
									<Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden />
									<span className="text-[14px] font-medium">Loading reward tiers…</span>
								</div>
							) : hasRewardTierContent ? (
								<div className="space-y-2.5">
									{promoRewardTierForList ? (
										<DiscoverMerchantPromoRewardTierCard
											config={promoRewardTierForList}
											fallbackImage={item.image}
										/>
									) : null}
									{merchantOfferTiers?.map((tier, index) => (
										<DiscoverMerchantTierOfferRow
											key={`${tier.name}-${tier.minUsdc6.toString()}-${index}`}
											tier={tier}
											index={index}
											total={merchantOfferTiers.length}
											currency={displayCurrency}
										/>
									))}
								</div>
							) : (
								<div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-center text-[13px] font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
									No reward tiers configured yet.
								</div>
							)}
						</div>
						) : null}

						{!isConetGenesisCard && wellnessPointsPanel ? (
							<DiscoverMerchantWellnessPointsCard
								config={wellnessPointsPanel}
								points={wellnessPointsValue}
							/>
						) : null}
					</div>

					{/* About always sits below Available Offers (Genesis About CoNET + merchant About). */}
					{isConetGenesisCard ? (
						<ConetGenesisAboutPanel onExplore={openConetExplore} />
					) : discoverAboutPanel ? (
						<DiscoverMerchantInfoPanelCard panel={discoverAboutPanel} />
					) : null}

				</div>
			</div>
		</div>

		{issuerProfileItem &&
			createPortal(
				<AnimatePresence>
					<motion.div
						key="discover-issuer-profile"
						className="fixed inset-0 z-[101] flex flex-col bg-white dark:bg-slate-900"
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ duration: 0.2, ease: 'easeOut' }}
						onTouchMove={(e) => e.stopPropagation()}
					>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							<BeamioContactProfilePreview
								item={issuerProfileItem}
								close={(path) => {
									if (typeof path === 'string') {
										setIssuerProfileItem(null)
										return
									}
									setIssuerProfileItem(null)
								}}
							/>
						</div>
					</motion.div>
				</AnimatePresence>,
				document.body,
			)}
		{referrerDownlineOpen && item.cardAddress && resolveUserEoa() ? (
			<DiscoverReferrerDownlinePage
				cardAddress={item.cardAddress}
				userEoa={resolveUserEoa()!}
				merchantTitle={passTitle}
				onClose={() => setReferrerDownlineOpen(false)}
			/>
		) : null}
		</>
	)
}

export default function Market() {
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles, myAddress, setShowFooter, chatSearchOpen, setChatSearchOpen, beamio, discoverMerchantStatByCard, registerDiscoverMerchantStatFeedCards } = useDaemonContext()
	const {
		registerCardAddresses,
		mergeTrustedCards,
		resolveDisplayName,
		resolveImage,
		fetchCardMetadata,
		peekMetadata,
		lookupByAddress,
	} = useMerchantCardDatabase()
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
	const [discoverCategory, setDiscoverCategory] = useState<DiscoverFilterTab>("all")
	const [discoverMerchantDetail, setDiscoverMerchantDetail] = useState<DiscoverFeaturedCard | null>(null)
	const [discoverDetailEnterImmediate, setDiscoverDetailEnterImmediate] = useState(false)
	const discoverDeepLinkTarget = useMemo(
		() => resolveDiscoverMerchantDeepLinkTarget(location),
		[location],
	)
	/** Persist `ref=` before the deep-link strip + `state: {}` reset below can drop it. */
	useLayoutEffect(() => {
		if (!discoverDeepLinkTarget) return
		const state = location.state as { discoverShareReferrerEoa?: string | null } | null
		const fromUrl =
			parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(window.location.href))?.referrerEoa ?? null
		stashDiscoverShareReferrer(discoverDeepLinkTarget, fromUrl ?? state?.discoverShareReferrerEoa ?? null)
	}, [discoverDeepLinkTarget, location.state])
	const discoverCategoryTabsOrdered = useMemo<DiscoverCategoryOption[]>(() => {
		if (discoverCategory === "all") return DISCOVER_CATEGORY_OPTIONS
		const selected = DISCOVER_CATEGORY_OPTIONS.find((o) => o.id === discoverCategory)
		if (!selected) return DISCOVER_CATEGORY_OPTIONS
		return [selected, ...DISCOVER_CATEGORY_OPTIONS.filter((o) => o.id !== discoverCategory)]
	}, [discoverCategory])

	const renderDiscoverFilterChip = (tab: DiscoverCategoryOption) => {
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
	}
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
				// Visibility: server `/api/latestCards` applies Featured Brands + exclude gate only.
				if (rows.length > 0) {
					setLatestCardsRows(rows)
					if (rows.length > 0) saveCachedTrendingRows(rows)
					const incoming: Record<string, ReturnType<typeof merchantCardRecordFromLatestCardsRaw>> = {}
					for (const rawItem of items) {
						const rec = merchantCardRecordFromLatestCardsRaw(rawItem)
						if (rec) incoming[rec.addressLower] = rec
					}
					mergeTrustedCards(incoming)
					registerCardAddresses(rows.map((r) => r.cardAddress))
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
	}, [mergeTrustedCards, registerCardAddresses])

	useEffect(() => {
		if (latestCardsRows.length === 0) return
		registerCardAddresses(latestCardsRows.map((r) => r.cardAddress))
		registerDiscoverMerchantStatFeedCards(latestCardsRows.map((r) => r.cardAddress))
	}, [latestCardsRows, registerCardAddresses, registerDiscoverMerchantStatFeedCards])

	useEffect(() => {
		const state = location.state as { openCardDetail?: boolean; openDiscoverMerchantCard?: string } | null
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

	const openDiscoverMerchantDetail = useCallback(
		(card: DiscoverFeaturedCard, opts?: { immediate?: boolean }) => {
			if (opts?.immediate) setDiscoverDetailEnterImmediate(true)
			setDiscoverMerchantDetail(card)
			setShowFooter(false)
		},
		[setShowFooter],
	)

	const closeDiscoverMerchantDetail = useCallback(() => {
		const returnTo = discoverDetailReturnToRef.current
		discoverDetailReturnToRef.current = null
		/** Ensure deep-link query cannot keep main Discover `invisible` after back. */
		stripDiscoverMerchantDeepLinkParams()
		setDiscoverMerchantDetail(null)
		setDiscoverDetailEnterImmediate(false)
		if (returnTo) {
			navigate(returnTo, { replace: true })
			setShowFooter(true)
			return
		}
		/** Footer restore deferred to AnimatePresence `onExitComplete` so exit layer cannot steal taps. */
	}, [navigate, setShowFooter])

	const discoverFeaturedCards = useMemo<DiscoverFeaturedCard[]>(() => {
		const rows: DiscoverFeaturedCard[] = latestCardsRows.map((card, idx) => {
			const dbDisplayName = resolveDisplayName(card.cardAddress)
			const dbImage = resolveImage(card.cardAddress)
			const category = classifyDiscoverMerchantCategory({
				name: card.name,
				programDescription: card.programDescription,
				categoryId: card.categoryId,
			})
			const isFood = category === "food-beverage"
			const hero = resolveDiscoverFeaturedHeroImage(card.cardAddress, {
				programBackgroundImage: card.programBackgroundImage,
				merchantImage: card.merchantImage,
				dbImage,
				fallbackIndex: idx,
			})
			const subtitleOverride =
				DISCOVER_CARD_SUBTITLE_OVERRIDES[resolveDiscoverCardPanelKey(card.cardAddress)]
			const topupPresentation = resolveDiscoverFeaturedTopupPresentation(
				card.cardAddress,
				null,
				card.currency,
			)
			return {
				id: card.cardAddress,
				cardAddress: card.cardAddress,
				cardOwner: card.cardOwner,
				category,
				title: card.businessName ?? dbDisplayName ?? card.name,
				programName: card.name,
				subtitle:
					subtitleOverride ||
					card.programDescription ||
					(isFood ? "Modern cuisine" : "Artisan coffee & pastries"),
				assetLabel:
					card.topTierName && card.topTierMinDisplay
						? `${card.topTierName} · ${card.topTierMinDisplay}`
						: card.topTierName ?? card.topTierMinDisplay ?? tu('member_benefits'),
				rating: Math.max(4.6, Math.min(5, 4.7 + (card.holderCount % 4) * 0.1)).toFixed(1),
				image: hero,
				logo: card.programIconUrl ?? card.logoUrl ?? (dbImage || null),
				currency: card.currency,
				primaryRechargeBonus: topupPresentation.primaryRechargeBonus,
				rechargeBonusSidePill: topupPresentation.heroSidePill,
				rechargeBonusDisplay: topupPresentation.displayString,
				discoverAbout: card.discoverAbout,
			}
		})
		if (rows.length > 0) return [...rows].reverse()
		// No placeholder brands when API list is empty (Discover is driven by real `latestCards` only).
		return []
	}, [latestCardsRows, resolveDisplayName, resolveImage])

	const discoverDeepLinkHandledForRef = useRef<string | null>(null)
	const discoverDetailReturnToRef = useRef<string | null>(null)

	useLayoutEffect(() => {
		if (!discoverDeepLinkTarget) return
		const state = location.state as { discoverDetailReturnTo?: string } | null
		const returnTo = state?.discoverDetailReturnTo?.trim()
		if (returnTo) discoverDetailReturnToRef.current = returnTo
		setShowFooter(false)
	}, [discoverDeepLinkTarget, location.state, setShowFooter])

	useLayoutEffect(() => {
		if (!discoverDeepLinkTarget) return
		const cardNorm = discoverDeepLinkTarget.toLowerCase()
		if (discoverDeepLinkHandledForRef.current === cardNorm) return

		const match = discoverFeaturedCards.find((c) => c.cardAddress?.toLowerCase() === cardNorm)
		if (match) {
			discoverDeepLinkHandledForRef.current = cardNorm
			openDiscoverMerchantDetail(match, { immediate: true })
			stripDiscoverMerchantDeepLinkParams()
			navigate('.', { replace: true, state: {} })
			return
		}

		const peeked = peekMetadata(discoverDeepLinkTarget)
		const dbName = resolveDisplayName(discoverDeepLinkTarget)?.trim()
		if (peeked || dbName) {
			const fallback = buildDiscoverFeaturedCardFromMerchantDb(
				discoverDeepLinkTarget,
				peeked,
				resolveDisplayName,
				resolveImage,
				lookupByAddress(discoverDeepLinkTarget)?.metadataRoot,
			)
			discoverDeepLinkHandledForRef.current = cardNorm
			openDiscoverMerchantDetail(fallback, { immediate: true })
			stripDiscoverMerchantDeepLinkParams()
			navigate('.', { replace: true, state: {} })
		}
	}, [
		discoverDeepLinkTarget,
		discoverFeaturedCards,
		lookupByAddress,
		navigate,
		openDiscoverMerchantDetail,
		peekMetadata,
		resolveDisplayName,
		resolveImage,
	])

	useEffect(() => {
		if (!discoverDeepLinkTarget) return
		const cardNorm = discoverDeepLinkTarget.toLowerCase()
		if (discoverDeepLinkHandledForRef.current === cardNorm) return
		if (latestCardsLoading) return

		let cancelled = false
		void (async () => {
			await fetchCardMetadata(discoverDeepLinkTarget)
			if (cancelled || discoverDeepLinkHandledForRef.current === cardNorm) return
			const fallback = buildDiscoverFeaturedCardFromMerchantDb(
				discoverDeepLinkTarget,
				peekMetadata(discoverDeepLinkTarget),
				resolveDisplayName,
				resolveImage,
				lookupByAddress(discoverDeepLinkTarget)?.metadataRoot,
			)
			discoverDeepLinkHandledForRef.current = cardNorm
			openDiscoverMerchantDetail(fallback, { immediate: true })
			stripDiscoverMerchantDeepLinkParams()
			navigate('.', { replace: true, state: {} })
		})()

		return () => {
			cancelled = true
		}
	}, [
		discoverDeepLinkTarget,
		fetchCardMetadata,
		latestCardsLoading,
		lookupByAddress,
		navigate,
		openDiscoverMerchantDetail,
		peekMetadata,
		resolveDisplayName,
		resolveImage,
	])

	const filteredFeaturedCards = useMemo(
		() => {
			const list =
				discoverCategory === "all"
					? discoverFeaturedCards
					: discoverFeaturedCards.filter((item: DiscoverFeaturedCard) => item.category === discoverCategory)
			return discoverCategory === "all" ? orderDiscoverAllWithPinnedTop(list) : list
		},
		[discoverCategory, discoverFeaturedCards]
	)

	const showDiscoverEmpty = !latestCardsLoading && filteredFeaturedCards.length === 0
	/**
	 * Hide Featured Brands list only while a deep link is pending open.
	 * After we have opened (handled ref) or while detail is showing, never keep `invisible`
	 * — otherwise Back leaves a black App shell (`#000414`) with an empty Discover layer.
	 */
	const discoverDeepLinkTargetLower = discoverDeepLinkTarget?.toLowerCase() ?? null
	const hideDiscoverMainForDeepLink =
		discoverDeepLinkTargetLower != null &&
		discoverMerchantDetail == null &&
		discoverDeepLinkHandledForRef.current !== discoverDeepLinkTargetLower

	const getOwnedInstances = (id: number): InventoryInstance[] => inventory[id] ?? []

	const finalizeGenesis = () => {
		setPurchasingGenesis(false)
		const newId = "#GN-" + (248 + getOwnedInstances(999).length)
		setInventory((prev) => ({ ...prev, 999: [...(prev[999] ?? []), { id: newId, date: tu('just_now'), balance: "ACTIVE" }] }))
		setViewingItem(GENESIS_NODE_DATA)
	}

	return (
		<>
		<div
			className={[
				'w-full h-full min-h-0 h-screen bg-[#f5f7f9] dark:bg-slate-950 overflow-x-hidden overflow-y-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] selection:bg-blue-100 text-[#2c2f31] dark:text-slate-100 antialiased',
				hideDiscoverMainForDeepLink ? 'invisible' : '',
			].join(' ')}
		>

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
				<div className="flex min-h-0 items-center gap-2 py-6 pl-4 pr-4 sm:py-7 sm:pl-6 sm:pr-6">
					<div className="shrink-0">{renderDiscoverFilterChip(DISCOVER_ALL_OPTION)}</div>
					<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
						{discoverCategoryTabsOrdered.map((tab) => renderDiscoverFilterChip(tab))}
					</div>
				</div>
			</section>

			<section className="py-4">
				<div className="flex items-center gap-2 mb-4 flex-wrap">
					<h3 className="font-bold text-[21px] leading-none tracking-tight text-[#202227] dark:text-slate-100">{tu('featured_brands')}</h3>
				</div>

				{/* untrusted 错误：仅在彻底无 cache rows 时提示，避免 cache 命中时干扰阅读 */}
				{latestCardsError && latestCardsRows.length === 0 ? (
					<p className="text-[6px] text-amber-600 dark:text-amber-400 mb-3">{latestCardsError}</p>
				) : null}
				{/* loading 文案：仅在没有任何 trusted rows 可显示时出现；有 cache 立即跳过 */}
				{latestCardsLoading && latestCardsRows.length === 0 ? (
					<p className="text-[7px] text-slate-500 dark:text-slate-400 mb-4">正在加载新卡…</p>
				) : null}

				<div className="grid grid-cols-1 gap-5">
				{filteredFeaturedCards.map((item) => {
					const likeCount = pickDiscoverMerchantLikeCount(discoverMerchantStatByCard, item.cardAddress)
					const shareClickCount = pickDiscoverMerchantRefClickCount(discoverMerchantStatByCard, item.cardAddress)
					return (
					<button
						key={item.id}
						type="button"
						onClick={() => openDiscoverMerchantDetail(item)}
						className="w-full min-w-0 text-left bg-white dark:bg-slate-900 rounded-[30px] shadow-[0_8px_22px_rgba(15,23,42,0.06)] border border-[#e8ecf0] dark:border-slate-800 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f7f9] dark:focus-visible:ring-offset-slate-950 active:scale-[0.99] transition-transform"
					>
						<div className="relative">
							<DiscoverFeaturedBrandHeroImage
								src={item.image}
								alt={item.title}
								className="w-full aspect-[16/9] object-cover"
							/>
							{item.rechargeBonusSidePill ? (
								<DiscoverRechargeBonusHeroChip
									label={item.rechargeBonusSidePill}
									className="absolute bottom-3 right-3 z-10"
								/>
							) : null}
							<div className="absolute -bottom-8 left-6">
								<div className="w-16 h-16 rounded-2xl bg-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] flex items-center justify-center border border-slate-100">
									{item.logo ? (
										<DiscoverFeaturedBrandLogoImage
											src={item.logo}
											fallbackLetter={item.title}
											className="w-11 h-11 rounded-xl object-cover"
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
							<p className="text-[#4b5361] dark:text-slate-300 text-[15px] leading-tight line-clamp-2">
								{item.subtitle}
							</p>
							{item.rechargeBonusDisplay && item.rechargeBonusSidePill ? (
								<div className="mt-3 flex items-start gap-2.5">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f797ef]/20 sm:h-9 sm:w-9">
										<Gift className="h-4 w-4 text-[#8d3a8b] sm:h-[1.05rem] sm:w-[1.05rem]" strokeWidth={2} aria-hidden />
									</div>
									<div className="min-w-0">
										<p className="text-[12px] font-bold text-[#2c2f31] dark:text-slate-100 sm:text-sm">Recharge Bonus</p>
										<p className="text-[11px] leading-snug text-[#595c5e] dark:text-slate-400">{item.rechargeBonusDisplay}</p>
									</div>
								</div>
							) : null}
							<div className="mt-2 flex justify-end gap-2">
								<DiscoverFeaturedLikeCountBadge count={likeCount} />
								<DiscoverFeaturedShareClickCountBadge count={shareClickCount} />
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

		<AnimatePresence
			onExitComplete={() => {
				/** Exit motion still mounts `fixed inset-0 z-[110]` briefly; restore Footer after it unmounts. */
				setShowFooter(true)
			}}
		>
			{discoverMerchantDetail ? (
				<motion.div
					key={`discover-merchant-${discoverMerchantDetail.id}`}
					className="fixed inset-0 z-[110] flex flex-col bg-[#f5f7f9] dark:bg-slate-950"
					initial={discoverDetailEnterImmediate ? false : { x: '100%' }}
					animate={{ x: 0 }}
					exit={{ x: '100%' }}
					transition={discoverDetailEnterImmediate ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' }}
					onTouchMove={(e) => e.stopPropagation()}
				>
					<DiscoverMerchantDetailFullScreen
						item={discoverMerchantDetail}
						onClose={closeDiscoverMerchantDetail}
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
				<BeamioCircularBackButton onClick={closeCardDetail} />
				<div className="h-9 w-9 shrink-0" aria-hidden />
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

			{/* Bottom Sheet：从底部向上，参考 Vouchers - PurchaseAccount / TopUpAccount.
			    Closed: z under Discover detail (z-110) + Footer (z-200) + pointer-events-none + inert.
			    Keeping closed sheets at z-120/130 above the detail caused intermittent dead taps on
			    the hero back button and global Footer (WebKit still hit-testing opacity-0 layers). */}
			<div
				className={[
					"fixed inset-0",
					settingsOpen ? "z-[120] pointer-events-auto" : "z-[90] pointer-events-none",
				].join(" ")}
				{...(!settingsOpen ? ({ inert: '' } as Record<string, string>) : {})}
				aria-hidden={!settingsOpen}
			>
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						settingsOpen ? "opacity-100" : "opacity-0 pointer-events-none",
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen("")
						setTopupItemId(null)
						setTopupPresetAmountEmpty(false)
						setQrPayload("")
					}}
					aria-hidden={!settingsOpen}
				/>
				<div
					className={[
						"absolute inset-x-0 bottom-0 z-[121]",
						"transition-transform duration-300 ease-out",
						"will-change-transform",
						settingsOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
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
									<div className="p-6 text-sm text-rose-600">卡地址不可用。</div>
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
