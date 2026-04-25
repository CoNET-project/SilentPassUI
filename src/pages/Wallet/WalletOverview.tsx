/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Nfc, ChevronRight, Store, Info, QrCode, ShoppingBasket } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { detectDeviceNfcCapability } from '@/utils/cashTreesNativeNfc'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { resolveCardImageUrl, resolveHeldTierPresentation } from '@/pages/Brands/MyBrandsListSection'
import { cardTierGradientCss, cardTierGradientTheme } from '@/utils/cardTierGradient'

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

	useEffect(() => {
		const run = () => setDeviceHasNfc(detectDeviceNfcCapability())
		run()
		const t = window.setTimeout(run, 0)
		return () => clearTimeout(t)
	}, [])

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
