import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import {
	AlertTriangle,
	Building2,
	Clapperboard,
	Dumbbell,
	GraduationCap,
	Heart,
	HeartPulse,
	LayoutGrid,
	Share2,
	Loader2,
	ShoppingBag,
	ShoppingCart,
	UtensilsCrossed,
} from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useObjectImgSrc } from '@/components/card/useObjectImgSrc'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import {
	merchantBackgroundImageFromMetadataRoot,
	merchantIconUrlFromMetadataRoot,
	merchantProgramCardDisplayNameFromMetadataRoot,
	merchantProgramImageUrlFromMetadataRoot,
} from '@/services/BeamioCard'
import { beamioApi } from '@/utils/constants'
import { formatDiscoverLikeCount } from '@/utils/discoverMerchantLikeCount'
import {
	classifyDiscoverMerchantCategory,
	discoverCategoryLabel,
	discoverProgramDescriptionFromMetadata,
	type DiscoverCategoryTab,
} from '@/utils/discoverMerchantCategory'
import {
	pickDiscoverMerchantLikeCount,
	pickDiscoverMerchantRefClickCount,
} from '@/utils/discoverMerchantStatsLocalCache'
import {
	discoverMixCssColorWithWhite,
	parseDiscoverMerchantBrandColor,
	resolveDiscoverTopupPromotionPresentation,
} from '@/utils/discoverMerchantPromotions'
import { isFactoryDefaultMerchantAssetUrl } from '@/utils/isFactoryDefaultMerchantAssetUrl'
import {
	pickMerchantCardListIconUrl,
	pickMerchantCardListTitle,
} from '@/utils/merchantCardDatabase'
import {
	socialExchangeSummaryLabel,
	type SocialExchangeConfig,
} from '@/utils/socialExchangeMetadata'

const CACHE_KEY = 'beamio:silentpass:global:reward-pt-usdc-merchants:v1'
const MAX_OFFERS = 8
const BRAND_FALLBACK = '#4b4537'
const HERO_FALLBACKS = [
	'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
	'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
] as const
const CHIP_CLASS =
	'max-w-[min(72%,220px)] rounded-full bg-[#f797ef]/90 px-2.5 py-1 text-center text-[10px] font-bold leading-tight text-[#610e62] shadow-[0_4px_12px_rgba(247,151,239,0.35)] backdrop-blur-sm'

type FilterTab = 'all' | DiscoverCategoryTab

const CATEGORY_CHIPS: { id: DiscoverCategoryTab; Icon: typeof Building2 }[] = [
	{ id: 'food-beverage', Icon: UtensilsCrossed },
	{ id: 'grocery-convenience', Icon: ShoppingCart },
	{ id: 'retail-shopping', Icon: ShoppingBag },
	{ id: 'education-training', Icon: GraduationCap },
	{ id: 'health-beauty', Icon: HeartPulse },
	{ id: 'fitness-wellness', Icon: Dumbbell },
	{ id: 'entertainment-leisure', Icon: Clapperboard },
	{ id: 'local-services', Icon: Building2 },
]

type RewardPtUsdcOffer = {
	tokenId: string
	title: string
	pointsCost: number
	usdcReward6: string
}

type RewardPtUsdcMerchant = {
	cardAddress: string
	cardOwner: string
	offers: RewardPtUsdcOffer[]
}

function loadTrustedMerchants(): RewardPtUsdcMerchant[] | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { items?: unknown }
		return parseMerchantItems(parsed?.items)
	} catch {
		return null
	}
}

function saveTrustedMerchants(items: RewardPtUsdcMerchant[]): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ items }))
	} catch {
		/* quota / private mode — list still shows this session */
	}
}

function parseMerchantItems(raw: unknown): RewardPtUsdcMerchant[] | null {
	if (!Array.isArray(raw)) return null
	const items: RewardPtUsdcMerchant[] = []
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue
		const rec = row as Record<string, unknown>
		const cardRaw = String(rec.cardAddress ?? '').trim()
		if (!ethers.isAddress(cardRaw)) continue
		const offersRaw = Array.isArray(rec.offers) ? rec.offers : []
		const offers: RewardPtUsdcOffer[] = []
		for (const offer of offersRaw) {
			if (!offer || typeof offer !== 'object') continue
			const o = offer as Record<string, unknown>
			const pointsCost = Number(o.pointsCost)
			const usdcReward6 = String(o.usdcReward6 ?? '').trim()
			if (!Number.isInteger(pointsCost) || pointsCost <= 0) continue
			try {
				if (BigInt(usdcReward6) <= 0n) continue
			} catch {
				continue
			}
			offers.push({
				tokenId: String(o.tokenId ?? ''),
				title: String(o.title ?? '').trim().slice(0, 120),
				pointsCost,
				usdcReward6,
			})
			if (offers.length >= MAX_OFFERS) break
		}
		if (!offers.length) continue
		items.push({
			cardAddress: ethers.getAddress(cardRaw),
			cardOwner: String(rec.cardOwner ?? ''),
			offers,
		})
	}
	return items
}

function merchantWideHeroUrl(root: Record<string, unknown> | null): string {
	if (!root) return ''
	const share =
		root.shareTokenMetadata && typeof root.shareTokenMetadata === 'object'
			? (root.shareTokenMetadata as Record<string, unknown>)
			: null
	for (const src of [root, share]) {
		if (!src) continue
		for (const key of ['merchantImage', 'merchant_image']) {
			const raw = src[key]
			if (typeof raw !== 'string') continue
			const url = raw.trim()
			if (url && !isFactoryDefaultMerchantAssetUrl(url)) return url
		}
	}
	return ''
}

function offerExchange(offer: RewardPtUsdcOffer): SocialExchangeConfig {
	return {
		enabled: true,
		kind: 'usdc',
		pointsCost: offer.pointsCost,
		usdcReward6: BigInt(offer.usdcReward6),
	}
}

function exchangeChipLabel(offer: RewardPtUsdcOffer, extra: number): string {
	const full = socialExchangeSummaryLabel(offerExchange(offer))
	const compact = full.replace(/^Use\s+/i, '').replace(/\s+Reward PT/, ' PT')
	return extra > 0 ? `${compact} · +${extra}` : compact
}

function FeaturedPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
	const trimmed = src.trim()
	if (!trimmed) return <div className={className} aria-hidden />
	if (/^https?:\/\//i.test(trimmed) && !/ipfs\.conet\.network|\/api\/fragment/i.test(trimmed)) {
		return <img src={trimmed} alt={alt} className={className} draggable={false} />
	}
	return <IpfsImg src={trimmed} alt={alt} className={className} draggable={false} />
}

function FeaturedLogo({ src, letter }: { src: string; letter: string }) {
	const displaySrc = useObjectImgSrc(src.trim() || undefined)
	if (!displaySrc) {
		return (
			<span className="text-[20px] font-semibold leading-none text-[#94afff]">
				{letter.slice(0, 1).toUpperCase()}
			</span>
		)
	}
	return <img src={displaySrc} alt="" className="h-14 w-14 rounded-xl object-cover" draggable={false} />
}

export default function RewardPtUsdcMerchantsPage() {
	const navigate = useNavigate()
	const { setShowFooter, discoverMerchantStatByCard, registerDiscoverMerchantStatFeedCards } = useDaemonContext()
	const {
		resolveName,
		resolveImage,
		peekMetadata,
		lookupByAddress,
		registerCardAddresses,
		ensureCardsForAddresses,
	} = useMerchantCardDatabase()
	const cached = loadTrustedMerchants()
	const [items, setItems] = useState<RewardPtUsdcMerchant[]>(() => cached ?? [])
	const [trusted, setTrusted] = useState(() => cached != null)
	const [loading, setLoading] = useState(false)
	const [category, setCategory] = useState<FilterTab>('all')

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const res = await fetch(`${beamioApi}/api/rewardPtUsdcMerchants`, { cache: 'no-store' })
			if (!res.ok) return
			const body = (await res.json()) as { items?: unknown }
			const next = parseMerchantItems(body?.items)
			if (!next) return
			setItems(next)
			setTrusted(true)
			saveTrustedMerchants(next)
		} catch {
			/* keep the last trusted list */
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		if (!items.length) return
		const addrs = items.map((item) => item.cardAddress)
		registerCardAddresses(addrs)
		registerDiscoverMerchantStatFeedCards(addrs)
		void ensureCardsForAddresses(addrs)
	}, [items, registerCardAddresses, registerDiscoverMerchantStatFeedCards, ensureCardsForAddresses])

	const cards = useMemo(() => {
		return items.map((item, index) => {
			const record = lookupByAddress(item.cardAddress)
			const root = record?.metadataRoot ?? null
			const meta = peekMetadata(item.cardAddress)
			const title = pickMerchantCardListTitle({
				workerName: resolveName(item.cardAddress) || merchantProgramCardDisplayNameFromMetadataRoot(root),
				metaName: meta?.name,
				fallback: 'Merchant card',
			})
			const description =
				discoverProgramDescriptionFromMetadata(root) || meta?.programDescription?.trim() || ''
			const categoryId = classifyDiscoverMerchantCategory({
				name: title,
				programDescription: description,
				categoryId: meta?.categoryId ?? null,
			})
			const hero =
				merchantBackgroundImageFromMetadataRoot(root) ||
				merchantWideHeroUrl(root) ||
				merchantProgramImageUrlFromMetadataRoot(root) ||
				pickMerchantCardListIconUrl({ workerImage: resolveImage(item.cardAddress), meta }) ||
				HERO_FALLBACKS[index % HERO_FALLBACKS.length]
			const logo =
				merchantIconUrlFromMetadataRoot(root) ||
				pickMerchantCardListIconUrl({ workerImage: resolveImage(item.cardAddress), meta }) ||
				''
			const brand = parseDiscoverMerchantBrandColor(root) ?? BRAND_FALLBACK
			const tint = discoverMixCssColorWithWhite(brand, 0.9) ?? '#ffffff'
			const topup = resolveDiscoverTopupPromotionPresentation({ metadataRoot: root, currency: 'CAD' })
			const newest = item.offers[0]
			const extra = Math.max(0, item.offers.length - 1)
			return {
				item,
				title,
				subtitle: description || socialExchangeSummaryLabel(offerExchange(newest)),
				categoryId,
				hero,
				logo,
				tint,
				chip: topup.heroSidePill || exchangeChipLabel(newest, extra),
			}
		})
	}, [items, lookupByAddress, peekMetadata, resolveImage, resolveName])

	const visibleCategories = useMemo(() => {
		const present = new Set(cards.map((card) => card.categoryId))
		return CATEGORY_CHIPS.filter((chip) => present.has(chip.id))
	}, [cards])

	const visibleCards = category === 'all' ? cards : cards.filter((card) => card.categoryId === category)

	return (
		<div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f7f9] text-[#2c2f31] antialiased selection:bg-blue-100 dark:bg-slate-950 dark:text-slate-100">
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-10 [scrollbar-width:thin]">
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(0.5rem, env(safe-area-inset-top, 0px)) + 4.5rem)' }}
				/>
				<div className="mx-auto w-full max-w-lg px-3 pb-6 sm:px-5">
					{!trusted && loading ? (
						<p className="mb-4 flex items-center gap-2 text-sm text-slate-500" aria-busy="true">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading merchants…
						</p>
					) : null}

					{!trusted && !loading ? (
						<div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<div>
								<p>{"Couldn't load merchants that exchange Reward PT for USDC."}</p>
								<button type="button" onClick={() => void load()} className="mt-2 font-semibold text-[#1562f0]">
									Try again
								</button>
							</div>
						</div>
					) : null}

					{trusted && items.length === 0 ? (
						<p className="py-10 text-center text-sm text-slate-500">
							No merchants are exchanging Reward PT for USDC yet.
						</p>
					) : null}

					{trusted && items.length > 0 ? (
						<div className="grid grid-cols-1 gap-4">
							{visibleCards.map((card) => {
								const likeCount = pickDiscoverMerchantLikeCount(discoverMerchantStatByCard, card.item.cardAddress)
								const shareCount = pickDiscoverMerchantRefClickCount(discoverMerchantStatByCard, card.item.cardAddress)
								return (
									<button
										key={card.item.cardAddress}
										type="button"
										onClick={() =>
											navigate('/discover', {
												state: { openDiscoverMerchantCard: card.item.cardAddress },
											})
										}
										className="w-full min-w-0 overflow-hidden rounded-[30px] border border-[#e8ecf0] bg-white text-left shadow-[0_8px_22px_rgba(15,23,42,0.09)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f7f9] active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
									>
										<div className="relative">
											<FeaturedPhoto src={card.hero} alt={card.title} className="aspect-[16/9] w-full object-cover" />
											{card.chip ? (
												<span className={`absolute bottom-3 right-3 z-10 ${CHIP_CLASS}`}>{card.chip}</span>
											) : null}
											<div className="absolute -bottom-8 left-6">
												<div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]">
													<FeaturedLogo src={card.logo} letter={card.title} />
												</div>
											</div>
										</div>
										<div className="px-5 pb-5 pt-10" style={{ backgroundColor: card.tint }}>
											<div className="mb-1 flex items-start justify-between gap-3">
												<h4 className="line-clamp-1 text-[19px] font-bold leading-[1.15] tracking-tight text-[#1f2328] dark:text-slate-100">
													{card.title}
												</h4>
												<div className="flex shrink-0 -translate-y-10 items-center gap-2">
													{likeCount != null ? (
														<span
															className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e8ecf0] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
															aria-label={`${formatDiscoverLikeCount(likeCount)} likes`}
														>
															<Heart className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.25} fill="currentColor" aria-hidden />
															{formatDiscoverLikeCount(likeCount)}
														</span>
													) : null}
													{shareCount != null ? (
														<span
															className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e8ecf0] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
															aria-label={`${formatDiscoverLikeCount(shareCount)} share clicks`}
														>
															<Share2 className="h-3.5 w-3.5 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
															{formatDiscoverLikeCount(shareCount)}
														</span>
													) : null}
												</div>
											</div>
											<p className="line-clamp-2 whitespace-pre-line text-[15px] leading-tight text-[#4b5361] dark:text-slate-300">
												{card.subtitle}
											</p>
										</div>
									</button>
								)
							})}
						</div>
					) : null}
				</div>
			</div>

			<div
				className="pointer-events-none fixed inset-x-0 z-40 flex items-center gap-2 px-3 sm:px-5"
				style={{ top: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
			>
				<BeamioCircularBackButton
					variant="onLight"
					onClick={() => navigate(-1)}
					className="pointer-events-auto shrink-0"
				/>
				<div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full border border-white/70 bg-white/55 px-1 py-1 shadow-[0_8px_28px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/55">
					<button
						type="button"
						aria-label="All categories"
						onClick={() => setCategory('all')}
						className={[
							'flex shrink-0 items-center rounded-full px-3 py-2',
							category === 'all'
								? 'bg-[#1562f0] text-white shadow-[0_8px_22px_rgba(21,98,240,0.42)]'
								: 'border border-white/70 bg-white/60 text-[#1f2328] shadow-[0_2px_10px_rgba(15,23,42,0.08)]',
						].join(' ')}
					>
						<LayoutGrid className="h-[17px] w-[17px]" strokeWidth={category === 'all' ? 2.25 : 2} aria-hidden />
					</button>
					<div className="flex min-w-0 flex-1 touch-pan-x items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{visibleCategories.map((chip) => {
							const active = category === chip.id
							const Icon = chip.Icon
							return (
								<button
									key={chip.id}
									type="button"
									onClick={() => setCategory(chip.id)}
									className={[
										'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold tracking-tight',
										active
											? 'bg-[#1562f0] text-white shadow-[0_8px_22px_rgba(21,98,240,0.42)]'
											: 'border border-white/70 bg-white/60 text-[#1f2328] shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-100',
									].join(' ')}
								>
									<Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
									{discoverCategoryLabel(chip.id)}
								</button>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}
