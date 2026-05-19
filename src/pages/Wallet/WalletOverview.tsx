/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { Store, Clock3 } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { WalletMerchantPassStack } from '@/pages/Wallet/WalletMerchantPassStack'
import { useWalletMerchantPassesStickyDisplay } from '@/pages/Wallet/useWalletMerchantPassesStickyDisplay'
import { getCardActiveIssuedCouponSeries } from '@/services/BeamioCard'
import {
	loadWalletOwnedCouponsLocalCache,
	saveWalletOwnedCouponsLocalCache,
	walletOwnedCouponsSignature,
	type WalletOwnedCouponCacheRow,
} from '@/utils/walletOwnedCouponsLocalCache'

/** 与 Home 顶栏左侧胶囊 `homeAccent` 一致 */
const WALLET_CAPSULE_ACCENT = '#1562f0'
const ISSUED_NFT_START_ID = 100_000_000_000n

type WalletOwnedCouponItem = WalletOwnedCouponCacheRow

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
		profiles,
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

	const eoaLower = profiles?.[0]?.keyID?.trim().toLowerCase() ?? ''
	const merchantPassesView = useWalletMerchantPassesStickyDisplay(
		eoaLower,
		myBrandCards,
		myBrandCardDetails,
		myBrandsFeedLoading
	)

	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	const [ownedCoupons, setOwnedCoupons] = useState<WalletOwnedCouponItem[]>([])
	const ownedCouponsRef = useRef<WalletOwnedCouponItem[]>([])
	const [ownedCouponsLoading, setOwnedCouponsLoading] = useState(false)
	useEffect(() => {
		ownedCouponsRef.current = ownedCoupons
	}, [ownedCoupons])

	/** EOA 切换：从本地恢复 Active Vouchers */
	useLayoutEffect(() => {
		const eoaLower = profiles?.[0]?.keyID?.trim().toLowerCase() ?? ''
		if (!eoaLower || !ethers.isAddress(eoaLower)) {
			setOwnedCoupons([])
			setOwnedCouponsLoading(false)
			return
		}
		const hit = loadWalletOwnedCouponsLocalCache(eoaLower)
		if (hit?.length) {
			setOwnedCoupons(hit)
			setOwnedCouponsLoading(false)
		}
	}, [profiles?.[0]?.keyID])

	useEffect(() => {
		let cancelled = false
		const run = async () => {
			const eoaSave = profiles?.[0]?.keyID?.trim().toLowerCase() ?? ''
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

			const detailsStillLoading = myBrandCardsSorted.some((c) => {
				const d = myBrandCardDetails[c.cardAddress.toLowerCase()]
				return d === undefined || d.assets == null
			})

			if (!cardContexts.length) {
				if (detailsStillLoading && ownedCouponsRef.current.length > 0) {
					setOwnedCouponsLoading(false)
					return
				}
				if (ownedCouponsRef.current.length === 0) {
					setOwnedCoupons([])
				}
				setOwnedCouponsLoading(false)
				return
			}

			const hasRenderableCoupons = ownedCouponsRef.current.length > 0
			if (!hasRenderableCoupons) {
				setOwnedCouponsLoading(true)
			}
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
			const carry = ownedCouponsRef.current.filter((item) => {
				const cardLower = item.cardAddress.toLowerCase()
				if (!trackedCards.has(cardLower)) return false
				return !successfulCards.has(cardLower)
			})
			const merged: WalletOwnedCouponItem[] = [...carry]
			for (const row of nextRowsById.values()) merged.push(row)
			merged.sort((a, b) => {
				const av = a.validBeforeSec ?? Number.MAX_SAFE_INTEGER
				const bv = b.validBeforeSec ?? Number.MAX_SAFE_INTEGER
				if (av !== bv) return av - bv
				return a.title.localeCompare(b.title, 'en')
			})

			const prevSig = walletOwnedCouponsSignature(ownedCouponsRef.current)
			const nextSig = walletOwnedCouponsSignature(merged)
			if (prevSig !== nextSig) {
				setOwnedCoupons(merged)
			}
			const allCardsFetched =
				cardContexts.length > 0 &&
				cardContexts.every((c) => successfulCards.has(c.cardLower))
			if (eoaSave && ethers.isAddress(eoaSave) && allCardsFetched) {
				saveWalletOwnedCouponsLocalCache(eoaSave, merged)
			}
			setOwnedCouponsLoading(false)
		}
		void run()
		return () => {
			cancelled = true
		}
	}, [myBrandCardsSorted, myBrandCardDetails, profiles?.[0]?.keyID])

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
					<WalletMerchantPassStack
						view={merchantPassesView}
						onSeeAll={() => setShowMyBrandsDrawer(true)}
					/>

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

				</main>
			</div>
			<MyBrandsFullScreenDrawer open={showMyBrandsDrawer} onClose={() => setShowMyBrandsDrawer(false)} />
		</div>
	)
}
