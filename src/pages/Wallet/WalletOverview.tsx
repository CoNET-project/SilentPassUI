/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Nfc, ChevronRight, Store, ArrowLeftRight, Pencil, Plus, Info, QrCode, ShoppingBasket, CreditCard, Building2 } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { detectDeviceNfcCapability } from '@/utils/cashTreesNativeNfc'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { resolveCardImageUrl, resolveHeldTierPresentation } from '@/pages/Brands/MyBrandsListSection'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import type { RampMode } from '@/components/addUSDC/StepAmount'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'

function formatAaUsdcDisplay(raw: string): string {
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0) return '0.00'
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function cadPartsFromNumber(n: number): { whole: string; frac: string } {
	const [whole, frac = '00'] = Math.max(0, n).toFixed(2).split('.')
	return { whole, frac }
}

const STACK_CARD_OVERLAP_PX = 130
const STACK_CARD_H = 200

/** 与 Home 顶栏左侧胶囊 `homeAccent` 一致 */
const WALLET_CAPSULE_ACCENT = '#1562f0'

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

export default function WalletOverview() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const {
		aaAccountUsdcBalance,
		usdcbalance,
		myBrandCards,
		myBrandCardDetails,
		myBrandsFeedLoading,
		homeTotalPowerCad,
		currencyData,
		refreshOracle,
		refreshRecentActivityNoAa,
		setShowFooter,
	} = useDaemonContext()
	const aaUsdcFormatted = formatAaUsdcDisplay(aaAccountUsdcBalance ?? '0')
	const aaUsdcNum = Math.max(0, Number(aaAccountUsdcBalance) || 0)

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

	const homeHubWalletCad = useMemo(() => {
		const d = currencyData as Record<string, number>
		const cadPerUsdc = (Number(d.CAD) || 1.35) * (Number(d.USDC) || 1)
		const eoaU = Math.max(0, Number(usdcbalance) || 0)
		const aaU = Math.max(0, Number(aaAccountUsdcBalance) || 0)
		return cadPartsFromNumber((eoaU + aaU) * cadPerUsdc)
	}, [usdcbalance, aaAccountUsdcBalance, currencyData])

	const homeHubMerchantCad = useMemo(() => {
		const d = currencyData as Record<string, number>
		const cadPerUsdc = (Number(d.CAD) || 1.35) * (Number(d.USDC) || 1)
		let pointsCad = 0
		for (const entry of Object.values(myBrandCardDetails)) {
			const assets = entry?.assets
			if (!assets) continue
			const pts = Number(assets.points ?? 0)
			if (!Number.isFinite(pts) || pts <= 0) continue
			const pCur = (assets.cardCurrency ?? 'CAD').toUpperCase()
			if (pCur === 'CAD') {
				pointsCad += pts
			} else if (pCur === 'USDC') {
				pointsCad += pts * cadPerUsdc
			} else {
				const targetPerUsd = Number(d.CAD) > 0 ? Number(d.CAD) : 1.35
				const srcRaw = d[pCur]
				const srcPerUsd = typeof srcRaw === 'number' && srcRaw > 0 ? srcRaw : 1
				pointsCad += pts * (targetPerUsd / srcPerUsd)
			}
		}
		return cadPartsFromNumber(pointsCad)
	}, [myBrandCardDetails, currencyData])

	const aaApproxCadParts = useMemo(() => {
		const d = currencyData as Record<string, number>
		const cadPerUsdc = (Number(d.CAD) || 1.35) * (Number(d.USDC) || 1)
		return cadPartsFromNumber(aaUsdcNum * cadPerUsdc)
	}, [aaUsdcNum, currencyData])

	const stackPreviewCards = useMemo(() => myBrandCardsSorted.slice(0, 3), [myBrandCardsSorted])

	const [deviceHasNfc, setDeviceHasNfc] = useState(false)
	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	const [syncBusy, setSyncBusy] = useState(false)
	/** Base USDC：Coinbase 入金 / 出金（与 History BankingBridge + BeamioAddUSDCFlow 同源） */
	const [rampSheetOpen, setRampSheetOpen] = useState(false)
	const [rampSheetView, setRampSheetView] = useState<'menu' | RampMode>('menu')

	useEffect(() => {
		const run = () => setDeviceHasNfc(detectDeviceNfcCapability())
		run()
		const t = window.setTimeout(run, 0)
		return () => clearTimeout(t)
	}, [])

	const onHeaderSync = useCallback(async () => {
		if (syncBusy) return
		setSyncBusy(true)
		try {
			refreshOracle()
			await refreshRecentActivityNoAa()
		} finally {
			setSyncBusy(false)
		}
	}, [refreshOracle, refreshRecentActivityNoAa, syncBusy])

	const openRampSheetMenu = useCallback(() => {
		setRampSheetView('menu')
		setRampSheetOpen(true)
		setShowFooter(false)
	}, [setShowFooter])

	const closeRampSheet = useCallback(() => {
		setRampSheetOpen(false)
		setRampSheetView('menu')
		setShowFooter(true)
	}, [setShowFooter])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 顶栏：无返回；左侧 Wallet 胶囊 + 右侧与胶囊同高、同式 shadow/border 的圆角操作组（codingTemp sync / edit / add） */}
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

				<div
					className={`flex shrink-0 items-center gap-0.5 p-1 ${capsuleChrome}`}
					style={{ pointerEvents: capsulePointer }}
				>
					<button
						type="button"
						disabled={syncBusy}
						onClick={() => void onHeaderSync()}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-colors hover:bg-slate-100 active:scale-95 disabled:opacity-50 dark:text-[#6ba3ff] dark:hover:bg-slate-700/80"
						aria-label="Refresh balances"
					>
						<ArrowLeftRight className={`h-[22px] w-[22px] ${syncBusy ? 'animate-pulse' : ''}`} strokeWidth={2.2} aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => navigate('/settings')}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-colors hover:bg-slate-100 active:scale-95 dark:text-[#6ba3ff] dark:hover:bg-slate-700/80"
						aria-label="Edit wallet settings"
					>
						<Pencil className="h-[22px] w-[22px]" strokeWidth={2.2} aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => navigate('/myWallet')}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-colors hover:bg-slate-100 active:scale-95 dark:text-[#6ba3ff] dark:hover:bg-slate-700/80"
						aria-label="Add merchant card or funds"
					>
						<Plus className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden />
					</button>
				</div>
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
					{/* Premium portfolio summary — gradient + 下部 frosted USDC 区 */}
					<section>
						<div className="relative overflow-hidden rounded-[1.5rem] text-white shadow-xl">
							<div
								className="absolute inset-0 bg-gradient-to-br from-[#1562f0] to-[#4c1d95]"
								aria-hidden
							/>
							<div
								aria-hidden
								className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_80%_0%,rgba(255,255,255,0.35),transparent_55%)]"
							/>
							<div className="relative z-10 flex flex-col">
								<div className="space-y-6 border-b border-white/10 p-8">
									<div className="space-y-1">
										<p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
											Total Purchasing Power
										</p>
										<h2 className="text-4xl font-extrabold tabular-nums tracking-tight">
											CA$ {homeTotalPowerCad.whole}.{homeTotalPowerCad.frac}
										</h2>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1 text-left">
											<p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
												USDC Balance
											</p>
											<p className="text-lg font-bold tabular-nums">
												CA$ {homeHubWalletCad.whole}.{homeHubWalletCad.frac}
											</p>
										</div>
										<div className="space-y-1 text-right">
											<p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
												Merchant Assets
											</p>
											<p className="text-lg font-bold tabular-nums">
												CA$ {homeHubMerchantCad.whole}.{homeHubMerchantCad.frac}
											</p>
										</div>
									</div>
								</div>
								<div className="space-y-4 bg-white/5 p-8 backdrop-blur-sm">
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<div className="relative h-8 w-8 shrink-0">
												<img src={usdcIcon} alt="" className="block h-8 w-8 rounded-full object-contain" />
												<img
													src={baseIcon}
													alt=""
													className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border border-white bg-white object-contain"
												/>
											</div>
											<p className="truncate text-sm font-bold">USDC Account</p>
										</div>
										<div className="shrink-0 text-right">
											<p className="text-xl font-bold tabular-nums">
												{aaUsdcFormatted}{' '}
												<span className="text-lg font-bold">USDC</span>
											</p>
											<span className="block text-right text-sm font-medium text-white/50">
												≈ CA$ {aaApproxCadParts.whole}.{aaApproxCadParts.frac}
											</span>
										</div>
									</div>
									<div className="flex gap-3">
										<button
											type="button"
											onClick={() => navigate('/Pay')}
											className="flex-1 rounded-full border border-white/20 bg-white/10 py-3.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-[0.98]"
										>
											Transfer
										</button>
										<button
											type="button"
											onClick={openRampSheetMenu}
											className="flex-1 rounded-full bg-[#1562F0] py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.98]"
										>
											Buy &amp; Sell
										</button>
									</div>
								</div>
							</div>
						</div>
					</section>

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

			{createPortal(
				<AnimatePresence>
					{rampSheetOpen && (
						<>
							<motion.button
								type="button"
								aria-label="Close"
								className="fixed inset-0 z-[60] bg-black/40"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closeRampSheet}
							/>
							<motion.div
								className="fixed inset-x-0 bottom-0 z-[61] max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] overflow-hidden rounded-t-[22px] bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-slate-900"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 32, stiffness: 320 }}
							>
								<div className="flex justify-center pt-2 pb-1">
									<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
								</div>
								{rampSheetView === 'menu' ? (
									<div className="space-y-4 px-5 pb-8 pt-2">
										<div className="text-center">
											<p className="text-base font-bold text-slate-900 dark:text-slate-100">USDC on Base</p>
											<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
												Add funds or cash out via Coinbase Pay.
											</p>
										</div>
										<div className="space-y-3">
											<button
												type="button"
												onClick={() => setRampSheetView('onramp')}
												className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
											>
												<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DCEBFF] dark:bg-[#1562f0]/20">
													<CreditCard className="h-6 w-6 text-[#2F6BFF] dark:text-[#6ba3ff]" strokeWidth={2.2} aria-hidden />
												</div>
												<div className="min-w-0 flex-1">
													<p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Add funds</p>
													<p className="text-xs text-slate-500 dark:text-slate-400">Buy USDC via Coinbase</p>
												</div>
												<ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
											</button>
											<button
												type="button"
												onClick={() => setRampSheetView('offramp')}
												className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
											>
												<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-700">
													<Building2 className="h-6 w-6 text-slate-600 dark:text-slate-300" strokeWidth={2.2} aria-hidden />
												</div>
												<div className="min-w-0 flex-1">
													<p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Cash out</p>
													<p className="text-xs text-slate-500 dark:text-slate-400">Withdraw to your bank via Coinbase</p>
												</div>
												<ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
											</button>
										</div>
									</div>
								) : (
									<div className="max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-3rem))] overflow-y-auto">
										<BeamioNavBack
											title=""
											onClose={() => setRampSheetView('menu')}
											onMore={() => {}}
										/>
										<BeamioAddUSDCFlow
											key={rampSheetView}
											embedInSheet
											initialMode={rampSheetView}
											onCancel={() => setRampSheetView('menu')}
										/>
									</div>
								)}
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}
		</div>
	)
}
