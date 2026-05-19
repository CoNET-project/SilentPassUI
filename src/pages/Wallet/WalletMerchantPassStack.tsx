import React, { useMemo } from 'react'
import { WalletMerchantPassStackCard } from '@/pages/Wallet/WalletMerchantPassStackCard'
import { getStableWalletMerchantPassStackDisplay } from '@/pages/Wallet/walletMerchantPassDisplayCache'
import { buildWalletMerchantPassStackDisplay } from '@/pages/Wallet/walletMerchantPassDisplay'
import type { WalletMerchantPassesStickyView } from '@/pages/Wallet/useWalletMerchantPassesStickyDisplay'

const STACK_CARD_OVERLAP_PX = 130
const STACK_CARD_H = 200
const STACK_STEP_PX = STACK_CARD_H - STACK_CARD_OVERLAP_PX

type Props = {
	view: WalletMerchantPassesStickyView
	onSeeAll: () => void
}

function stackLayoutHeight(count: number): number {
	if (count <= 0) return STACK_CARD_H
	return STACK_CARD_H + (count - 1) * STACK_STEP_PX
}

function PassStackSkeleton({ cardCount }: { cardCount: number }) {
	const n = Math.min(Math.max(cardCount, 1), 3)
	const height = stackLayoutHeight(n)
	return (
		<div
			className="relative w-full overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-slate-200/60 dark:border-slate-800 dark:bg-slate-800/70"
			style={{ height }}
			aria-hidden
		/>
	)
}

function WalletMerchantPassStackInner({ view, onSeeAll }: Props) {
	const { stackCards, details, badgeCount, showEmpty, showSkeleton, showStack } = view
	const stackHeight = stackLayoutHeight(stackCards.length)

	const displays = useMemo(() => {
		const out: {
			uc: (typeof stackCards)[0]
			display: ReturnType<typeof getStableWalletMerchantPassStackDisplay>
		}[] = []
		for (const uc of stackCards) {
			const key = uc.cardAddress.toLowerCase()
			out.push({
				uc,
				display: getStableWalletMerchantPassStackDisplay(uc, details[key]),
			})
		}
		return out
	}, [stackCards, details])

	return (
		<section className="space-y-4 pt-2">
			<div className="flex items-center justify-between px-1">
				<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
					Your Merchant Passes
				</h3>
				<div className="flex items-center gap-2">
					{badgeCount > 0 ? (
						<button
							type="button"
							onClick={onSeeAll}
							className="text-[10px] font-semibold text-[#1562f0] hover:text-[#0e4cbb] dark:text-[#6ba3ff]"
						>
							See all
						</button>
					) : null}
					<span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
						{badgeCount} CARD{badgeCount !== 1 ? 'S' : ''}
					</span>
				</div>
			</div>

			{showSkeleton || showEmpty ? (
				<PassStackSkeleton cardCount={Math.max(stackCards.length, badgeCount, 1)} />
			) : showStack ? (
				<div
					className="wallet-merchant-pass-stack relative w-full"
					style={{
						height: stackHeight,
						contain: 'layout style paint',
						isolation: 'isolate',
					}}
				>
					{displays.map(({ uc, display }, stackIdx) => (
						<WalletMerchantPassStackCard
							key={uc.cardAddress}
							uc={uc}
							display={display}
							stackIdx={stackIdx}
							topPx={stackIdx * STACK_STEP_PX}
						/>
					))}
				</div>
			) : (
				<PassStackSkeleton cardCount={1} />
			)}
		</section>
	)
}

export const WalletMerchantPassStack = React.memo(WalletMerchantPassStackInner, (prev, next) => {
	if (prev.view.showEmpty !== next.view.showEmpty) return false
	if (prev.view.showSkeleton !== next.view.showSkeleton) return false
	if (prev.view.showStack !== next.view.showStack) return false
	if (prev.view.badgeCount !== next.view.badgeCount) return false
	const prevAddrs = prev.view.stackCards.map((c) => c.cardAddress.toLowerCase()).join('|')
	const nextAddrs = next.view.stackCards.map((c) => c.cardAddress.toLowerCase()).join('|')
	if (prevAddrs !== nextAddrs) return false
	if (!next.view.showStack) return true
	for (const uc of next.view.stackCards) {
		const key = uc.cardAddress.toLowerCase()
		const sigPrev = buildWalletMerchantPassStackDisplay(uc, prev.view.details[key]).sig
		const sigNext = buildWalletMerchantPassStackDisplay(uc, next.view.details[key]).sig
		if (sigPrev !== sigNext) return false
	}
	return true
})
