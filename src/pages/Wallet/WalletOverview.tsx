/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Nfc, ChevronRight, Store, Info, QrCode, ShoppingBasket, Clock3 } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { detectDeviceNfcCapability } from '@/utils/cashTreesNativeNfc'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { resolveCardImageUrl, resolveHeldTierPresentation } from '@/pages/Brands/MyBrandsListSection'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'
import { getCardActiveIssuedCouponSeries } from '@/services/BeamioCard'

const STACK_CARD_OVERLAP_PX = 130
const STACK_CARD_H = 200

/** 与 Home 顶栏左侧胶囊 `homeAccent` 一致 */
const WALLET_CAPSULE_ACCENT = '#1562f0'
const ISSUED_NFT_START_ID = 100_000_000_000n

type WalletOwnedCouponItem = {
	id: string
	cardAddress: string
	tokenId: string
	couponId: string
	title: string
	subtitle: string
	iconUrl: string
	backgroundImage: string
	backgroundColorHex: string
	validBeforeSec: number | null
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : null

const readString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const readMetadataCouponId = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const root = readString(meta.couponId)
	if (root) return root
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return readString(beamioCoupon?.couponId)
}

const readMetadataTitle = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readString(meta.title) ||
		readString(meta.name) ||
		readString(beamioCoupon?.title) ||
		readString(beamioCoupon?.name)
	)
}

const readMetadataSubtitle = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readString(meta.subtitle) ||
		readString(meta.description) ||
		readString(beamioCoupon?.subtitle) ||
		readString(beamioCoupon?.description)
	)
}

const readMetadataIconUrl = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	const imageObj = asRecord(meta.image)
	return (
		readString(meta.iconUrl) ||
		readString(meta.icon) ||
		readString(imageObj?.url) ||
		readString(meta.image) ||
		readString(beamioCoupon?.iconUrl) ||
		readString(beamioCoupon?.icon)
	)
}

const readMetadataBackgroundImage = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	return (
		readString(meta.backgroundImage) ||
		readString(meta.coverImage) ||
		readString(beamioCoupon?.backgroundImage) ||
		readString(beamioCoupon?.coverImage)
	)
}

const readMetadataBackgroundColor = (meta: Record<string, unknown> | null): string => {
	if (!meta) return ''
	const props = asRecord(meta.properties)
	const beamioCoupon = asRecord(props?.beamioCoupon)
	const c =
		readString(meta.backgroundColorHex) ||
		readString(meta.background_color) ||
		readString(beamioCoupon?.backgroundColorHex) ||
		readString(beamioCoupon?.background_color)
	if (!c) return ''
	return c.startsWith('#') ? c : `#${c}`
}

const formatCouponExpiryPill = (validBeforeSec: number | null): string => {
	if (!Number.isFinite(validBeforeSec ?? NaN) || (validBeforeSec ?? 0) <= 0) return 'VALID NOW'
	const now = Math.floor(Date.now() / 1000)
	if ((validBeforeSec ?? 0) <= now) return 'EXPIRED'
	const delta = (validBeforeSec ?? now) - now
	if (delta >= 86_400) return `EXPIRES IN ${Math.ceil(delta / 86_400)}D`
	if (delta >= 3_600) return `EXPIRES IN ${Math.ceil(delta / 3_600)}H`
	return `EXPIRES IN ${Math.max(1, Math.ceil(delta / 60))}M`
}

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

export default function WalletOverview() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const {
		myBrandCards,
		myBrandCardDetails,
		myBrandsFeedLoading,
	} = useDaemonContext()

	const myBrandCardsSorted = useMemo(
		() => {
			// 用 detail.assets.points 作为金额；未知（未加载完成 / assets 为 null / 解析失败）记为 NaN
			const getPts = (cardAddress: string): number => {
				const detail = myBrandCardDetails[cardAddress.toLowerCase()]
				const ptsRaw = detail?.assets?.points
				if (ptsRaw == null || String(ptsRaw).trim() === '') return NaN
				const n = Number(ptsRaw)
				return Number.isFinite(n) ? n : NaN
			}
			return [...myBrandCards]
				// 仅当已知 amount 为 0 时隐藏；未加载完成 / 未知金额保留以避免 flicker
				.filter((c) => {
					const n = getPts(c.cardAddress)
					return !(Number.isFinite(n) && n === 0)
				})
				.sort((a, b) => {
					const na = getPts(a.cardAddress)
					const nb = getPts(b.cardAddress)
					const va = Number.isFinite(na) ? na : -Infinity
					const vb = Number.isFinite(nb) ? nb : -Infinity
					if (vb !== va) return vb - va
					return (a.name || '').localeCompare(b.name || '', 'en')
				})
		},
		[myBrandCards, myBrandCardDetails],
	)

	const stackPreviewCards = useMemo(() => myBrandCardsSorted.slice(0, 3), [myBrandCardsSorted])

	const [deviceHasNfc, setDeviceHasNfc] = useState(false)
	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	const [ownedCoupons, setOwnedCoupons] = useState<WalletOwnedCouponItem[]>([])
	const [ownedCouponsLoading, setOwnedCouponsLoading] = useState(false)

	useEffect(() => {
		const run = () => setDeviceHasNfc(detectDeviceNfcCapability())
		run()
		const t = window.setTimeout(run, 0)
		return () => clearTimeout(t)
	}, [])

	useEffect(() => {
		let cancelled = false
		const run = async () => {
			const cardContexts = myBrandCardsSorted
				.map((card) => {
					const cardLower = card.cardAddress.toLowerCase()
					const detail = myBrandCardDetails[cardLower]
					const ownedIssuedTokenIds = new Set<string>()
					for (const nft of detail?.assets?.nfts ?? []) {
						try {
							const tid = BigInt(String(nft.tokenId ?? '0'))
							if (tid >= ISSUED_NFT_START_ID) ownedIssuedTokenIds.add(String(nft.tokenId))
						} catch {
							// ignore invalid token id
						}
					}
					if (!ownedIssuedTokenIds.size) return null
					const fallbackName =
						(detail?.meta?.name && detail.meta.name.trim()) || card.name || 'Merchant Program'
					return { cardAddress: card.cardAddress, cardLower, fallbackName, ownedIssuedTokenIds }
				})
				.filter((x): x is { cardAddress: string; cardLower: string; fallbackName: string; ownedIssuedTokenIds: Set<string> } => !!x)

			if (!cardContexts.length) {
				setOwnedCoupons([])
				setOwnedCouponsLoading(false)
				return
			}

			setOwnedCouponsLoading(true)
			const responses = await Promise.allSettled(
				cardContexts.map(async (ctx) => {
					const rows = await getCardActiveIssuedCouponSeries(ctx.cardAddress, 50)
					const ownedRows = rows.filter((row) => ctx.ownedIssuedTokenIds.has(String(row.tokenId)))
					return { ctx, ownedRows }
				})
			)
			if (cancelled) return

			const successfulCards = new Set<string>()
			const nextRowsById = new Map<string, WalletOwnedCouponItem>()
			for (const response of responses) {
				if (response.status !== 'fulfilled') continue
				successfulCards.add(response.value.ctx.cardLower)
				for (const row of response.value.ownedRows) {
					const meta = asRecord(row.metadata)
					const title = readMetadataTitle(meta) || 'Coupon'
					const subtitle = readMetadataSubtitle(meta) || response.value.ctx.fallbackName
					const couponId = readMetadataCouponId(meta) || `token-${row.tokenId}`
					const id = `${response.value.ctx.cardLower}:${row.tokenId}`
					const validBeforeNum = Number(row.issuedNftValidBefore ?? 0)
					nextRowsById.set(id, {
						id,
						cardAddress: response.value.ctx.cardAddress,
						tokenId: String(row.tokenId),
						couponId,
						title,
						subtitle,
						iconUrl: readMetadataIconUrl(meta),
						backgroundImage: readMetadataBackgroundImage(meta),
						backgroundColorHex: readMetadataBackgroundColor(meta),
						validBeforeSec: Number.isFinite(validBeforeNum) && validBeforeNum > 0 ? validBeforeNum : null,
					})
				}
			}

			const trackedCards = new Set(cardContexts.map((c) => c.cardLower))
			setOwnedCoupons((prev) => {
				const carry = prev.filter((item) => {
					const cardLower = item.cardAddress.toLowerCase()
					if (!trackedCards.has(cardLower)) return false
					return !successfulCards.has(cardLower)
				})
				for (const row of nextRowsById.values()) carry.push(row)
				return carry.sort((a, b) => {
					const av = a.validBeforeSec ?? Number.MAX_SAFE_INTEGER
					const bv = b.validBeforeSec ?? Number.MAX_SAFE_INTEGER
					if (av !== bv) return av - bv
					return a.title.localeCompare(b.title, 'en')
				})
			})
			setOwnedCouponsLoading(false)
		}
		void run()
		return () => {
			cancelled = true
		}
	}, [myBrandCardsSorted, myBrandCardDetails])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 顶栏：无返回；仅保留左侧 Wallet 胶囊 */}
			<div
				className="fixed left-4 right-4 z-40 flex items-center justify-between gap-2 transition-opacity duration-300"
				style={{
					top: 'max(1rem, env(safe-area-inset-top, 0px))',
					opacity: capsuleOpacity,
				}}
			>
				<button
					type="button"
					onClick={() => navigate('/myWallet')}
					className={`flex items-center gap-2.5 py-2 pl-2 pr-4 ${capsuleChrome} transition-transform group active:scale-[0.98]`}
					style={{ pointerEvents: capsulePointer }}
					aria-label="Open wallet details"
				>
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
						style={{ backgroundColor: WALLET_CAPSULE_ACCENT }}
					>
						<WalletBlueIcon className="h-[22px] w-[22px] block shrink-0" aria-hidden />
					</div>
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Wallet</span>
				</button>

			</div>

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-28"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
				/>
				<main className="mx-auto w-full max-w-2xl space-y-6 px-6 pt-2">
					<section className="space-y-4 pt-2">
							<div className="flex items-center justify-between px-1">
								<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
									Your Merchant Passes
								</h3>
								<div className="flex items-center gap-2">
									{myBrandCardsSorted.length > 0 ? (
										<button
											type="button"
											onClick={() => setShowMyBrandsDrawer(true)}
											className="text-[10px] font-semibold text-[#1562f0] hover:text-[#0e4cbb] dark:text-[#6ba3ff]"
										>
											See all
										</button>
									) : null}
									<span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
										{myBrandCardsSorted.length} CARD{myBrandCardsSorted.length !== 1 ? 'S' : ''}
									</span>
								</div>
							</div>

							<div className="flex flex-col">
								{myBrandsFeedLoading && myBrandCardsSorted.length === 0 ? (
									<div className="h-[200px] animate-pulse rounded-[1.5rem] bg-slate-200/80 dark:bg-slate-800" />
								) : (
									stackPreviewCards.map((uc, stackIdx) => {
										const addrKey = uc.cardAddress.toLowerCase()
										const detail = myBrandCardDetails[addrKey]
										const title =
											(detail?.meta?.name && detail.meta.name.trim()) || uc.name || 'Merchant card'
										const tierPres = resolveHeldTierPresentation(detail)
										const tierLbl = tierPres.tierName.trim() || 'Loyalty Member'
										const imgUrl = resolveCardImageUrl(detail?.meta?.image)
										const ptsRaw = detail?.assets?.points
										const ptsNum = Number(ptsRaw ?? '')
										const cardGlobalCurrency = (
											detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD'
										).toUpperCase()
										const balanceLine =
											detail === undefined
												? '…'
												: Number.isFinite(ptsNum)
													? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
													: '—'
										const z = 10 * (stackIdx + 1)
										const isLast = stackIdx === stackPreviewCards.length - 1
										const footerIcons = [Info, QrCode, ShoppingBasket] as const
										const FooterIcon = footerIcons[stackIdx % footerIcons.length]
										const tierGradient = cardTierGradientCss(tierPres.accentColor)
										const tierTheme = cardTierGradientTheme(tierPres.accentColor)
										return (
											<div
												key={uc.cardAddress}
												className="stack-card relative flex flex-col rounded-[1.5rem] border border-white/10 p-5 text-left text-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
												style={{
													zIndex: z,
													marginBottom: isLast ? 0 : -STACK_CARD_OVERLAP_PX,
													height: STACK_CARD_H,
													borderColor: tierTheme.cardBorder,
													color: tierTheme.primary,
												}}
											>
												<div
													className="absolute inset-0 rounded-[1.5rem]"
													style={{ background: tierGradient }}
													aria-hidden
												/>
												<div className="relative z-10 flex w-full flex-1 flex-col">
													<div className="flex w-full items-start justify-between gap-2">
														<div className="flex min-w-0 items-center gap-3">
															<div
																className="h-9 w-9 shrink-0 overflow-hidden rounded-full border p-1 shadow-sm"
																style={{
																	backgroundColor: tierTheme.iconOrbitBg,
																	borderColor: tierTheme.iconOrbitBorder,
																}}
															>
																{imgUrl ? (
																	<img
																		src={imgUrl}
																		alt=""
																		className="h-full w-full object-contain"
																		draggable={false}
																	/>
																) : (
																	<div className="flex h-full w-full items-center justify-center">
																		<Store
																			className="h-4 w-4"
																			style={{ color: tierTheme.defaultBadgeFg }}
																			aria-hidden
																		/>
																	</div>
																)}
															</div>
															<div className="min-w-0">
																<p className="text-sm font-bold tracking-tight truncate" style={{ color: tierTheme.primary }}>
																	{title}
																</p>
																<p className="truncate text-[10px] font-medium" style={{ color: tierTheme.secondary }}>
																	{tierLbl}
																</p>
															</div>
														</div>
														<div className="shrink-0 text-right">
															<p className="text-[10px] font-bold tracking-widest" style={{ color: tierTheme.tertiary }}>
																BALANCE
															</p>
															<p className="text-lg font-bold tabular-nums" style={{ color: tierTheme.primary }}>
																{balanceLine}
															</p>
														</div>
													</div>
													<div className="mt-auto flex items-end justify-between" style={{ color: tierTheme.accent }}>
														<p className="text-[10px] font-bold uppercase">Pass</p>
														<FooterIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
													</div>
												</div>
											</div>
										)
									})
								)}
							</div>
					</section>

					<section className="space-y-3">
						<div className="flex items-center justify-between px-1">
							<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
								Active Vouchers
							</h3>
							<span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
								{ownedCoupons.length} VOUCHER{ownedCoupons.length !== 1 ? 'S' : ''}
							</span>
						</div>

						{ownedCouponsLoading && ownedCoupons.length === 0 ? (
							<div className="space-y-3">
								<div className="h-[136px] animate-pulse rounded-[32px] bg-slate-200/80 dark:bg-slate-800" />
								<div className="h-[136px] animate-pulse rounded-[32px] bg-slate-200/80 dark:bg-slate-800" />
							</div>
						) : ownedCoupons.length === 0 ? (
							<div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
								No active vouchers yet.
							</div>
						) : (
							<div className="space-y-3">
								{ownedCoupons.map((row) => {
									const expires = formatCouponExpiryPill(row.validBeforeSec)
									const isUrgent = /IN \d+H|IN \d+M/.test(expires)
									return (
										<div
											key={row.id}
											className="relative h-[136px] overflow-hidden rounded-[32px] border border-white/10 shadow-[0_8px_24px_rgba(2,6,23,0.18)]"
											style={{ backgroundColor: row.backgroundColorHex || '#2B2E3A' }}
										>
											{row.backgroundImage ? (
												<img
													src={row.backgroundImage}
													alt=""
													className="absolute inset-0 h-full w-full object-cover"
													draggable={false}
												/>
											) : null}
											<div className="absolute inset-0 bg-black/45" />
											<div className="absolute left-[-14px] top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-[#F2F2F7] dark:bg-slate-950" />
											<div className="absolute right-[-14px] top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-[#F2F2F7] dark:bg-slate-950" />

											<div className="relative z-10 flex h-full items-center gap-4 px-5">
												<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-black/20">
													{row.iconUrl ? (
														<img src={row.iconUrl} alt="" className="h-full w-full object-cover" draggable={false} />
													) : (
														<Store className="h-6 w-6 text-white" />
													)}
												</div>
												<div className="min-w-0">
													<p className="truncate text-4xl font-bold leading-tight text-white">{row.title}</p>
													<p className="truncate text-[13px] font-semibold text-white/90">{row.subtitle}</p>
													<div
														className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${isUrgent ? 'bg-rose-500 text-white' : 'bg-white/25 text-white'}`}
													>
														<Clock3 className="h-3 w-3" />
														<span className="text-[11px] font-extrabold tracking-[0.3px]">{expires}</span>
													</div>
												</div>
											</div>
										</div>
									)
								})}
							</div>
						)}
					</section>

					{deviceHasNfc && (
						<section>
							<button
								type="button"
								onClick={() => navigate('/History')}
								className="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-transform active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
							>
								<div className="flex items-center gap-4">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
										<Nfc className="h-5 w-5" />
									</div>
									<p className="font-bold">NFC Keys</p>
								</div>
								<ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
							</button>
						</section>
					)}
				</main>
			</div>
			<MyBrandsFullScreenDrawer open={showMyBrandsDrawer} onClose={() => setShowMyBrandsDrawer(false)} />
		</div>
	)
}
