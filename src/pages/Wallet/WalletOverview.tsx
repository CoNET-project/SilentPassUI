/**
 * Wallet overview — layout aligned with pages/Vouchers/example/onboard.html
 */

import React, { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Nfc, ChevronRight, Store } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { detectDeviceNfcCapability } from '@/utils/cashTreesNativeNfc'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { resolveCardImageUrl } from '@/pages/Brands/MyBrandsListSection'

function formatAaUsdcDisplay(raw: string): string {
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0) return '0.00'
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 与 Home 顶栏左侧胶囊 `homeAccent` 一致 */
const WALLET_CAPSULE_ACCENT = '#1562f0'

export default function WalletOverview() {
	const navigate = useNavigate()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const { aaAccountUsdcBalance, myBrandCards, myBrandCardDetails, myBrandsFeedLoading } = useDaemonContext()
	const aaUsdcFormatted = formatAaUsdcDisplay(aaAccountUsdcBalance ?? '0')

	const myBrandCardsSorted = useMemo(
		() => [...myBrandCards].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en')),
		[myBrandCards]
	)

	const [deviceHasNfc, setDeviceHasNfc] = useState(false)
	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	useEffect(() => {
		const run = () => setDeviceHasNfc(detectDeviceNfcCapability())
		run()
		/** 与 Home NFC 探测一致：WK 注入偶发晚一帧 */
		const t = window.setTimeout(run, 0)
		return () => clearTimeout(t)
	}, [])

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 与 Home 一致：随主滚动区 scrollTop 淡入淡出 */}
			<div
				className="pointer-events-none fixed left-4 right-4 z-40 flex items-center justify-start transition-opacity duration-300"
				style={{
					top: 'max(1rem, env(safe-area-inset-top, 0px))',
					opacity: capsuleOpacity,
				}}
				aria-hidden
			>
				<div className="flex items-center gap-2.5 rounded-full border border-slate-100/90 bg-white py-2 pl-2 pr-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800">
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
						style={{ backgroundColor: WALLET_CAPSULE_ACCENT }}
					>
						<WalletBlueIcon className="h-[22px] w-[22px] block shrink-0" aria-hidden />
					</div>
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Wallet</span>
				</div>
			</div>

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-28"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				{/* 与 Home 一致：刘海 + 5rem，避免首屏与固定胶囊重叠 */}
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
				/>
				<main className="px-6 max-w-2xl mx-auto w-full space-y-8">
				<section className="space-y-1">
					<p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
						Total Purchasing Power
					</p>
					<h2 className="text-5xl font-extrabold tracking-tighter tabular-nums">${aaUsdcFormatted}</h2>
					<p className="text-sm font-medium text-slate-500 dark:text-slate-400 pt-2">
						USDC on Beamio AA (Base){' '}
						<span className="text-slate-900 dark:text-slate-100 tabular-nums">${aaUsdcFormatted}</span>
					</p>
				</section>

				<section>
					<div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm flex flex-col gap-6 border border-slate-200/60 dark:border-slate-800">
						<div className="flex justify-between items-center gap-4">
							<div className="flex items-center gap-4 min-w-0">
								<div className="relative flex-shrink-0 w-12 h-12 min-w-[48px] min-h-[48px]">
									<img src={usdcIcon} alt="USDC" className="block w-12 h-12 rounded-full object-contain" />
									<img
										src={baseIcon}
										alt="Base"
										className="block w-[18px] h-[18px] absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white object-contain"
									/>
								</div>
								<div className="min-w-0">
									<p className="font-bold truncate">USDC Wallet</p>
									<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Digital Dollar on Base</p>
								</div>
							</div>
							<div className="text-right shrink-0">
								<p className="text-2xl font-bold tabular-nums">${aaUsdcFormatted}</p>
								<p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
									Ready to use
								</p>
							</div>
						</div>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => navigate('/History')}
								className="flex-1 font-bold py-3.5 rounded-full bg-[#1562f0]/10 text-[#1562f0] hover:bg-[#1562f0]/20 dark:bg-[#6ba3ff]/15 dark:text-[#6ba3ff] dark:hover:bg-[#6ba3ff]/25 transition-colors active:scale-[0.98]"
							>
								Add Cash
							</button>
							<button
								type="button"
								onClick={() => navigate('/History')}
								className="flex-1 font-bold py-3.5 rounded-full bg-[#1562f0]/10 text-[#1562f0] hover:bg-[#1562f0]/20 dark:bg-[#6ba3ff]/15 dark:text-[#6ba3ff] dark:hover:bg-[#6ba3ff]/25 transition-colors active:scale-[0.98]"
							>
								Withdraw
							</button>
						</div>
					</div>
				</section>

				{deviceHasNfc && (
					<section>
						<button
							type="button"
							onClick={() => navigate('/History')}
							className="w-full bg-white dark:bg-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-sm border border-slate-200/80 dark:border-slate-800 active:scale-[0.99] transition-transform text-left"
						>
							<div className="flex items-center gap-4">
								<div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
									<Nfc className="w-5 h-5" />
								</div>
								<p className="font-bold">NFC Keys (1 Active)</p>
							</div>
							<ChevronRight className="w-5 h-5 text-slate-400" />
						</button>
					</section>
				)}

				{(myBrandsFeedLoading || myBrandCards.length > 0) && (
					<section className="mb-10">
						<div className="mb-4 flex items-end justify-between px-1">
							<h2 className="text-xl font-extrabold tracking-tight text-[#191c1d] dark:text-slate-100">
								My Brands
							</h2>
							<button
								type="button"
								onClick={() => setShowMyBrandsDrawer(true)}
								className="flex items-center gap-1 text-[12px] font-semibold text-[#1562f0] transition-colors hover:text-[#0e4cbb]"
							>
								See all
								<ChevronRight size={16} strokeWidth={2.5} />
							</button>
						</div>
						<div className="flex flex-col rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
							{myBrandsFeedLoading && myBrandCards.length === 0 ? (
								<>
									<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
										<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
										<div className="flex-1 space-y-2">
											<div className="h-3.5 w-24 rounded bg-white/80 dark:bg-slate-700" />
											<div className="h-3 w-36 rounded bg-white/60 dark:bg-slate-600" />
										</div>
										<div className="h-10 w-16 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
									</div>
									<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
										<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
										<div className="flex-1 space-y-2">
											<div className="h-3.5 w-28 rounded bg-white/80 dark:bg-slate-700" />
											<div className="h-3 w-32 rounded bg-white/60 dark:bg-slate-600" />
										</div>
										<div className="h-10 w-16 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
									</div>
								</>
							) : (
								myBrandCardsSorted.map((uc) => {
									const addrKey = uc.cardAddress.toLowerCase()
									const detail = myBrandCardDetails[addrKey]
									const title =
										(detail?.meta?.name && detail.meta.name.trim()) || uc.name || 'Merchant card'
									const tierLbl =
										detail?.meta?.tiers?.find((t) => t.name)?.name ?? detail?.meta?.tiers?.[0]?.name
									const subtitle = tierLbl || `${uc.currency} merchant card`
									const imgUrl = resolveCardImageUrl(detail?.meta?.image)
									const ptsRaw = detail?.assets?.points
									const ptsNum = Number(ptsRaw ?? '')
									const cardGlobalCurrency = (
										detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD'
									).toUpperCase()
									const pointsLine =
										detail === undefined
											? '…'
											: Number.isFinite(ptsNum)
												? `${cardGlobalCurrency} ${ptsNum.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
												: '—'
									const activePasses =
										detail?.assets?.nfts?.filter((n) => Number(n.tokenId) > 0 && !n.isExpired).length ?? 0
									const passLine =
										detail === undefined
											? '…'
											: activePasses > 0
												? `${activePasses} active Pass${activePasses !== 1 ? 'es' : ''}`
												: 'No active Passes'
									return (
										<button
											key={uc.cardAddress}
											type="button"
											onClick={() => navigate('/myWallet')}
											className="group flex w-full cursor-pointer items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-[#edeeef] dark:hover:bg-slate-700/80"
										>
											<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#c3c6d8]/25 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
												{imgUrl ? (
													<img
														src={imgUrl}
														alt={title}
														className="h-full w-full object-cover"
														draggable={false}
													/>
												) : (
													<Store size={22} className="text-[#1562f0] dark:text-[#6ba3ff]" aria-hidden />
												)}
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{title}</p>
												<p className="text-[11px] leading-tight text-[#424655] dark:text-slate-400">{subtitle}</p>
											</div>
											<div className="shrink-0 text-right">
												<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{pointsLine}</p>
												<p
													className={
														activePasses > 0
															? 'text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
															: 'text-[10px] font-medium text-[#424655] dark:text-slate-500'
													}
												>
													{passLine}
												</p>
											</div>
										</button>
									)
								})
							)}
						</div>
					</section>
				)}
				</main>
			</div>
			<MyBrandsFullScreenDrawer open={showMyBrandsDrawer} onClose={() => setShowMyBrandsDrawer(false)} />
		</div>
	)
}
