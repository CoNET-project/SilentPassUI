/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Server } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useBusinessStartKetRedeemAdmin } from '@/hooks/useBusinessStartKetRedeemAdmin'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { WalletMerchantPassStack } from '@/pages/Wallet/WalletMerchantPassStack'
import { useWalletMerchantPassesStickyDisplay } from '@/pages/Wallet/useWalletMerchantPassesStickyDisplay'
import { tu } from '@/locale/beamioLocale'

/** 与 Home 顶栏左侧胶囊 `homeAccent` 一致 */
const WALLET_CAPSULE_ACCENT = '#1562f0'

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

	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const eoaLower = eoa.toLowerCase()
	const { isRedeemAdmin } = useBusinessStartKetRedeemAdmin(eoa)
	const showRedeemAdminIcon = isRedeemAdmin === true

	const merchantPassesView = useWalletMerchantPassesStickyDisplay(
		eoaLower,
		myBrandCards,
		myBrandCardDetails,
		myBrandsFeedLoading
	)

	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 顶栏：左侧 Wallet 胶囊；BusinessStartKetRedeem admin 可见右侧 redeem 入口 */}
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
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">{tu('wallet')}</span>
				</button>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => navigate('/wallet/conet-nodes')}
						className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-[#1562f0] transition-transform active:scale-[0.98] hover:bg-slate-50 dark:hover:bg-slate-700/50`}
						style={{ pointerEvents: capsulePointer }}
						aria-label="My CoNET nodes"
						title="My CoNET nodes"
					>
						<Server className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</button>
					{showRedeemAdminIcon ? (
						<button
							type="button"
							onClick={() => navigate('/wallet/business-start-ket-redeem')}
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-[#1562f0] transition-transform active:scale-[0.98] hover:bg-slate-50 dark:hover:bg-slate-700/50`}
							style={{ pointerEvents: capsulePointer }}
							aria-label="Redeem admin"
							title="Redeem admin"
						>
							<Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						</button>
					) : null}
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
					<WalletMerchantPassStack
						view={merchantPassesView}
						onSeeAll={() => setShowMyBrandsDrawer(true)}
					/>
				</main>
			</div>
			<MyBrandsFullScreenDrawer open={showMyBrandsDrawer} onClose={() => setShowMyBrandsDrawer(false)} />
		</div>
	)
}
