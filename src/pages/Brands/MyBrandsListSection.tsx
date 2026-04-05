/**
 * Shared My Brands list body — used by full page route and slide-over drawer.
 */

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Store } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'

export function resolveCardImageUrl(url: string | undefined): string | undefined {
	if (!url?.trim()) return undefined
	const u = url.trim()
	if (/^ipfs:\/\//i.test(u)) return `https://ipfs.io/ipfs/${u.replace(/^ipfs:\/\//i, '')}`
	return u
}

export function MyBrandsListSection() {
	const navigate = useNavigate()
	const { myBrandCards, myBrandCardDetails, myBrandsFeedLoading } = useDaemonContext()

	const sorted = useMemo(
		() => [...myBrandCards].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en')),
		[myBrandCards]
	)

	return (
		<>
			{myBrandsFeedLoading && sorted.length === 0 ? (
				<div className="flex flex-col rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
					<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
						<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
						<div className="flex-1 space-y-2">
							<div className="h-3.5 w-28 rounded bg-white/80 dark:bg-slate-700" />
							<div className="h-3 w-36 rounded bg-white/60 dark:bg-slate-600" />
						</div>
						<div className="h-10 w-20 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
					</div>
					<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
						<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
						<div className="flex-1 space-y-2">
							<div className="h-3.5 w-32 rounded bg-white/80 dark:bg-slate-700" />
							<div className="h-3 w-28 rounded bg-white/60 dark:bg-slate-600" />
						</div>
						<div className="h-10 w-20 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
					</div>
				</div>
			) : sorted.length === 0 ? (
				<div className="rounded-xl border border-slate-200/80 bg-white/80 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
					<p className="text-sm font-medium text-slate-600 dark:text-slate-400">No merchant cards yet.</p>
					<button
						type="button"
						onClick={() => navigate('/myWallet')}
						className="mt-4 text-sm font-semibold text-[#004bc3] dark:text-[#6ba3ff]"
					>
						Add a card in Wallet
					</button>
				</div>
			) : (
				<>
					<div className="flex flex-col rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
						{sorted.map((uc) => {
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
						})}
					</div>
					<button
						type="button"
						onClick={() => navigate('/myWallet')}
						className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 py-6 text-slate-500 transition-all hover:border-[#1562f0] hover:bg-white/60 hover:text-[#1562f0] dark:border-slate-600 dark:text-slate-400 dark:hover:border-[#6ba3ff] dark:hover:bg-slate-900/60 dark:hover:text-[#6ba3ff]"
					>
						<CreditCard className="h-5 w-5" />
						<span className="font-bold">+ Add New Merchant Card</span>
					</button>
				</>
			)}
		</>
	)
}
