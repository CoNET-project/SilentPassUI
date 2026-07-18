/**
 * Wallet overview — aligned with pages/Vouchers/example/codingTemp.html (Wallet, 1–245)
 */

import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { Gift, Hexagon, ShieldCheck, Ticket } from 'lucide-react'
import { ReactComponent as WalletBlueIcon } from '@/components/Footer/assets/wallet-1-icon-blue.svg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useBusinessStartKetRedeemAdmin } from '@/hooks/useBusinessStartKetRedeemAdmin'
import { useReferralRegistryRole } from '@/hooks/useReferralRegistryRole'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import { WalletMerchantPassStack } from '@/pages/Wallet/WalletMerchantPassStack'
import { useWalletMerchantPassesStickyDisplay } from '@/pages/Wallet/useWalletMerchantPassesStickyDisplay'
import ReferralRedeemClaimSheet from '@/pages/Wallet/ReferralRedeemClaimSheet'
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
		setShowFooter,
	} = useDaemonContext()

	const profile = profiles?.[0]
	const signingArmor = resolveSigningPrivateKeyArmor(profile)
	const derivedEoa = signingArmor ? new ethers.Wallet(signingArmor).address : ''
	const profileKeyId = profile?.keyID?.trim() ?? ''
	const profileEoa = ethers.isAddress(profileKeyId) ? ethers.getAddress(profileKeyId) : ''
	const eoa = derivedEoa || profileEoa
	const aaAccount = profile?.aaAccount?.trim() ?? ''
	const showAaMultisigIcon = aaAccount.length > 0
	const eoaLower = eoa.toLowerCase()
	const { isRedeemAdmin } = useBusinessStartKetRedeemAdmin(eoa)
	const showRedeemAdminIcon = isRedeemAdmin === true
	const { snapshot: referralSnapshot, isPrivileged: showReferralRegistryIcon, refresh: refreshReferralRole } = useReferralRegistryRole(eoa)

	const merchantPassesView = useWalletMerchantPassesStickyDisplay(
		eoaLower,
		myBrandCards,
		myBrandCardDetails,
		myBrandsFeedLoading
	)

	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	const [showReferralClaimSheet, setShowReferralClaimSheet] = useState(false)
	const showReferralClaimIcon = referralSnapshot?.isAdmin !== true && referralSnapshot?.role === 'none'

	const openMerchantDetail = useCallback(
		(cardAddress: string) => {
			const trimmed = cardAddress.trim()
			if (!trimmed || !ethers.isAddress(trimmed)) return
			setShowFooter(false)
			navigate('/discover', {
				state: {
					openDiscoverMerchantCard: ethers.getAddress(trimmed),
					discoverDetailReturnTo: '/wallet',
				},
			})
		},
		[navigate, setShowFooter],
	)

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'
	const handleReferralClaimed = useCallback(() => {
		void refreshReferralRole()
	}, [refreshReferralRole])

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			{/* 顶栏：左侧 Wallet 胶囊；右上 AA Multisig / Redeem admin 圆形入口 */}
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
					{showAaMultisigIcon ? (
						<button
							type="button"
							onClick={() => navigate('/wallet/aa-multisig')}
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-[#8d3a8b] transition-transform active:scale-[0.98] hover:bg-slate-50 dark:hover:bg-slate-700/50`}
							style={{ pointerEvents: capsulePointer }}
							aria-label="Smart Wallet Multisig"
							title="Smart Wallet Multisig"
						>
							<Hexagon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						</button>
					) : null}
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
					{showReferralRegistryIcon ? (
						<button
							type="button"
							onClick={() => navigate('/wallet/referral-registry')}
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-indigo-600 transition-transform active:scale-[0.98] hover:bg-slate-50 dark:text-indigo-300 dark:hover:bg-slate-700/50`}
							style={{ pointerEvents: capsulePointer }}
							aria-label="Referral management"
							title="Referral management"
						>
							<ShieldCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						</button>
					) : null}
					{showReferralClaimIcon ? (
						<button
							type="button"
							onClick={() => setShowReferralClaimSheet(true)}
							className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${capsuleChrome} text-emerald-600 transition-transform active:scale-[0.98] hover:bg-slate-50 dark:text-emerald-300 dark:hover:bg-slate-700/50`}
							style={{ pointerEvents: capsulePointer }}
							aria-label="Claim referral redeem code"
							title="Claim referral redeem code"
						>
							<Ticket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
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
						onOpenMerchantDetail={openMerchantDetail}
					/>
				</main>
			</div>
			<MyBrandsFullScreenDrawer open={showMyBrandsDrawer} onClose={() => setShowMyBrandsDrawer(false)} />
			{showReferralClaimSheet && referralSnapshot && signingArmor ? (
				<ReferralRedeemClaimSheet
					snapshot={referralSnapshot}
					privateKeyArmor={signingArmor}
					setShowFooter={setShowFooter}
					onClose={() => setShowReferralClaimSheet(false)}
					onClaimed={handleReferralClaimed}
				/>
			) : null}
		</div>
	)
}
