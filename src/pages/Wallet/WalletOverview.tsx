/**
 * Wallet overview — asset grid, quick actions, and DeFi banner.
 * Header keeps Smart Wallet Multisig and Claim referral redeem code.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { Gift, Hexagon, ShieldCheck, Ticket } from 'lucide-react'
import { useBusinessStartKetRedeemAdmin } from '@/hooks/useBusinessStartKetRedeemAdmin'
import { useReferralRegistryRole } from '@/hooks/useReferralRegistryRole'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import ReferralRedeemClaimSheet from '@/pages/Wallet/ReferralRedeemClaimSheet'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import { getBUnitBalanceOnConet, isCardExcludedFromDisplay, type BUnitBalanceOnConet } from '@/services/BeamioCard'
import { rewardPointsTotal } from '@/utils/myBrandsFeedState'
import { formatDigitalAssetDisplay } from '@/utils/formatDigitalAssetDisplay'
import FuelView from '@/components/Home/FuelView'
import WalletAssetDetail, { type WalletAssetActionId, type WalletAssetKind } from '@/pages/Wallet/WalletAssetDetail'

const headerCircleButtonClass =
	'flex h-[47px] w-[47px] shrink-0 items-center justify-center rounded-full border border-[rgba(210,224,241,0.75)] bg-white/75 text-[#080817] shadow-[0_8px_24px_rgba(84,126,170,0.07)] backdrop-blur-[16px] transition-transform active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/80'

function formatFiat2(n: number): string {
	return Math.max(0, n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function WalletAssetIcon({
	className,
	children,
}: {
	className: string
	children: React.ReactNode
}) {
	return (
		<div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ${className}`}>
			{children}
		</div>
	)
}

export default function WalletOverview() {
	const navigate = useNavigate()
	const {
		profiles,
		myBrandCardDetails,
		recentActivityNoAaItems,
		usdcbalance,
		conetWalletBalances,
		conetAaWalletBalances,
		currencyData,
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
	const { isRedeemAdmin } = useBusinessStartKetRedeemAdmin(eoa)
	const showRedeemAdminIcon = isRedeemAdmin === true
	const { snapshot: referralSnapshot, isPrivileged: showReferralRegistryIcon, refresh: refreshReferralRole } = useReferralRegistryRole(eoa)
	const showReferralClaimIcon = referralSnapshot?.isAdmin !== true && referralSnapshot?.role === 'none'

	const [showReferralClaimSheet, setShowReferralClaimSheet] = useState(false)
	const [depositStart, setDepositStart] = useState<null | 'hub' | 'stripe' | 'coinbase' | 'transfer' | 'receive'>(null)
	const [assetKind, setAssetKind] = useState<WalletAssetKind | null>(null)
	const [showFuel, setShowFuel] = useState(false)
	const [bUnitBalance, setBUnitBalance] = useState<BUnitBalanceOnConet | null>(null)

	useEffect(() => {
		const account = profile?.keyID?.trim() ?? ''
		if (!account) return
		let cancelled = false
		void getBUnitBalanceOnConet(account)
			.then((balance) => {
				if (cancelled || !Number.isFinite(balance.total)) return
				setBUnitBalance(balance)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [profile?.keyID])

	const usdcTotal = useMemo(() => {
		const baseEoa = Math.max(0, Number(usdcbalance) || 0)
		const conetEoa = Math.max(0, Number(conetWalletBalances?.usdc) || 0)
		const conetAa = Math.max(0, Number(conetAaWalletBalances?.usdc) || 0)
		return baseEoa + conetEoa + conetAa
	}, [usdcbalance, conetWalletBalances?.usdc, conetAaWalletBalances?.usdc])

	const cadPerUsdc = useMemo(() => {
		const rates = currencyData as Record<string, number>
		return (Number(rates.CAD) || 1.35) * (Number(rates.USDC) || 1)
	}, [currencyData])

	const storeCreditsCad = useMemo(() => {
		const rates = currencyData as Record<string, number>
		let pointsCad = 0
		for (const [cardKey, entry] of Object.entries(myBrandCardDetails)) {
			if (isCardExcludedFromDisplay(cardKey)) continue
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
				const targetPerUsd = Number(rates.CAD) > 0 ? Number(rates.CAD) : 1.35
				const srcRaw = rates[pCur]
				const srcPerUsd = typeof srcRaw === 'number' && srcRaw > 0 ? srcRaw : 1
				pointsCad += pts * (targetPerUsd / srcPerUsd)
			}
		}
		return pointsCad
	}, [myBrandCardDetails, currencyData, cadPerUsdc])

	const rewardPt = useMemo(() => {
		let total = 0
		for (const [cardKey, entry] of Object.entries(myBrandCardDetails)) {
			if (isCardExcludedFromDisplay(cardKey)) continue
			total += rewardPointsTotal(entry?.assets)
		}
		return Math.max(0, total)
	}, [myBrandCardDetails])

	const handleReferralClaimed = useCallback(() => {
		void refreshReferralRole()
	}, [refreshReferralRole])

	const openDeposit = useCallback((start: 'hub' | 'stripe' | 'coinbase' | 'transfer' | 'receive' = 'hub') => {
		setShowFooter(false)
		setDepositStart(start)
	}, [setShowFooter])

	const closeDeposit = useCallback(() => {
		setDepositStart(null)
		if (!assetKind && !showFuel) setShowFooter(true)
	}, [assetKind, setShowFooter, showFuel])

	useEffect(() => {
		if (!assetKind && !showFuel) return
		setShowFooter(false)
		return () => {
			if (!depositStart) setShowFooter(true)
		}
	}, [assetKind, depositStart, setShowFooter, showFuel])

	const merchantCount = useMemo(
		() => Object.keys(myBrandCardDetails).filter((key) => !isCardExcludedFromDisplay(key)).length,
		[myBrandCardDetails],
	)
	const rewardMerchantCount = useMemo(() => {
		let count = 0
		for (const [cardKey, entry] of Object.entries(myBrandCardDetails)) {
			if (isCardExcludedFromDisplay(cardKey)) continue
			if (rewardPointsTotal(entry?.assets) > 0) count += 1
		}
		return count
	}, [myBrandCardDetails])

	const handleAssetAction = useCallback((id: WalletAssetActionId) => {
		if (id === 'buy-card') { openDeposit('stripe'); return }
		if (id === 'buy-coinbase') { openDeposit('coinbase'); return }
		if (id === 'from-wallet') { openDeposit('transfer'); return }
		if (id === 'receive-usdc') { openDeposit('receive'); return }
		if (id === 'bunit-topup') { setShowFuel(true); return }
		setAssetKind(null)
		setShowFooter(true)
		if (id === 'topup-pay') navigate('/qr', { state: { tab: 'mycode' } })
		else if (id === 'store-cards' || id === 'my-rewards') navigate('/myBrands')
		else if (id === 'bunit-learn') navigate('/BountyBoard')
		else if (id === 'more-activity') navigate('/Pay')
		else navigate('/discover')
	}, [navigate, openDeposit, setShowFooter])

	const bUnits = bUnitBalance?.total ?? null
	const usdcLabel = formatDigitalAssetDisplay(usdcTotal)
	const usdcCadLabel = `≈ CA$ ${formatFiat2(usdcTotal * cadPerUsdc)}`
	const storeLabel = `CA$ ${formatFiat2(storeCreditsCad)}`
	const rewardLabel = `${formatFiat2(rewardPt)} PT`
	const bUnitLabel = bUnits == null ? '…' : `${formatFiat2(bUnits)} B-Units`
	const bUnitUsdLabel = bUnits == null ? '…' : `≈ $${formatFiat2(bUnits * 0.01)}`

	return (
		<div
			className="flex h-full min-h-0 flex-1 flex-col bg-[#f8fbff] text-[#080817] dark:bg-slate-950 dark:text-slate-50"
			style={{
				backgroundImage:
					'radial-gradient(circle at 50% 15%, rgba(213, 235, 255, 0.22), transparent 40%)',
			}}
		>
			<div
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<main className="mx-auto w-full max-w-[520px] px-5 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-[calc(env(safe-area-inset-top)+38px)]">
					<header className="mb-5 flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h1 className="m-0 text-[clamp(42px,10vw,56px)] font-extrabold leading-[0.98] tracking-[-2.7px]">
								Wallet
							</h1>
							<p className="mb-0 mt-2.5 text-[17px] font-normal tracking-[-0.35px] text-[#777da8] dark:text-slate-400">
								Your assets, cards and more.
							</p>
						</div>
						<div className="flex shrink-0 gap-2.5">
							{showAaMultisigIcon ? (
								<button
									type="button"
									onClick={() => navigate('/wallet/aa-multisig')}
									className={`${headerCircleButtonClass} text-[#8d3a8b]`}
									aria-label="Smart Wallet Multisig"
									title="Smart Wallet Multisig"
								>
									<Hexagon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
							) : null}
							{showRedeemAdminIcon ? (
								<button
									type="button"
									onClick={() => navigate('/wallet/business-start-ket-redeem')}
									className={`${headerCircleButtonClass} text-[#1562f0]`}
									aria-label="Redeem admin"
									title="Redeem admin"
								>
									<Gift className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
							) : null}
							{showReferralRegistryIcon ? (
								<button
									type="button"
									onClick={() => navigate('/wallet/referral-registry')}
									className={`${headerCircleButtonClass} text-indigo-600 dark:text-indigo-300`}
									aria-label="Referral management"
									title="Referral management"
								>
									<ShieldCheck className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
							) : null}
							{showReferralClaimIcon ? (
								<button
									type="button"
									onClick={() => setShowReferralClaimSheet(true)}
									className={`${headerCircleButtonClass} text-emerald-600 dark:text-emerald-300`}
									aria-label="Claim referral redeem code"
									title="Claim referral redeem code"
								>
									<Ticket className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
							) : null}
						</div>
					</header>

					<section className="grid grid-cols-2 gap-[13px]">
						<button type="button" onClick={() => setAssetKind('usdc')} className="relative min-h-[144px] w-full overflow-hidden rounded-[18px] border border-white/55 bg-gradient-to-br from-[#edf6ff] to-[#e5f1ff] p-[15px] text-left font-[inherit] text-inherit dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
							<div className="mb-[13px] flex items-center gap-[11px]">
								<WalletAssetIcon className="bg-gradient-to-br from-[#1088ff] to-[#0866e8]">
									<span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[21px] font-bold leading-none">
										$
									</span>
								</WalletAssetIcon>
								<div className="min-w-0 whitespace-nowrap text-[16px] font-bold tracking-[-0.5px]">USDC</div>
							</div>
							<div className="whitespace-nowrap text-[clamp(25px,6vw,31px)] font-extrabold leading-[1.05] tracking-[-1.5px]">
								{usdcLabel} USDC
							</div>
							<div className="mt-[7px] text-[15px] leading-snug tracking-[-0.25px] text-[#777da8] dark:text-slate-400">
								{usdcCadLabel}
							</div>
						</button>

						<button type="button" onClick={() => setAssetKind('credits')} className="relative min-h-[144px] w-full overflow-hidden rounded-[18px] border border-white/55 bg-gradient-to-br from-[#edfdf7] to-[#e8f9f3] p-[15px] text-left font-[inherit] text-inherit dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
							<div className="mb-[13px] flex items-center gap-[11px]">
								<WalletAssetIcon className="bg-gradient-to-br from-[#04d3ad] to-[#00af86]">
									<svg viewBox="0 0 48 48" className="h-[31px] w-[31px]" aria-hidden>
										<path d="M12 17h24l-2-6H14l-2 6Z" fill="currentColor" />
										<rect x="13" y="19" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
										<circle cx="20" cy="27" r="2" fill="currentColor" />
										<circle cx="29" cy="27" r="2" fill="currentColor" />
									</svg>
								</WalletAssetIcon>
								<div className="min-w-0 whitespace-nowrap text-[16px] font-bold tracking-[-0.5px]">Store Credits</div>
							</div>
							<div className="whitespace-nowrap text-[clamp(25px,6vw,31px)] font-extrabold leading-[1.05] tracking-[-1.5px]">
								{storeLabel}
							</div>
							<div className="mt-[7px] text-[15px] leading-snug tracking-[-0.25px] text-[#777da8] dark:text-slate-400">
								Across your merchants
							</div>
						</button>

						<button type="button" onClick={() => setAssetKind('points')} className="relative min-h-[144px] w-full overflow-hidden rounded-[18px] border border-white/55 bg-gradient-to-br from-[#fff8e9] to-[#fff3db] p-[15px] text-left font-[inherit] text-inherit dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
							<div className="mb-[13px] flex items-center gap-[11px]">
								<WalletAssetIcon className="bg-gradient-to-br from-[#ffc24c] to-[#ff9f21]">
									<svg viewBox="0 0 48 48" className="h-[31px] w-[31px]" aria-hidden>
										<path d="M11 20l7 7 6-14 7 14 7-7-3 17H14L11 20Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
										<path d="M16 39h17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
									</svg>
								</WalletAssetIcon>
								<div className="min-w-0 whitespace-nowrap text-[16px] font-bold tracking-[-0.5px]">Reward PT</div>
							</div>
							<div className="whitespace-nowrap text-[clamp(25px,6vw,31px)] font-extrabold leading-[1.05] tracking-[-1.5px]">
								{rewardLabel}
							</div>
							<div className="mt-[7px] text-[15px] leading-snug tracking-[-0.25px] text-[#777da8] dark:text-slate-400">
								Earn more rewards
							</div>
						</button>

						<button type="button" onClick={() => setAssetKind('units')} className="relative min-h-[144px] w-full overflow-hidden rounded-[18px] border border-white/55 bg-gradient-to-br from-[#f7efff] to-[#f0e8ff] p-[15px] text-left font-[inherit] text-inherit dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
							<div className="mb-[13px] flex items-center gap-[11px]">
								<WalletAssetIcon className="bg-gradient-to-br from-[#ae4cff] to-[#8429e7]">
									<svg viewBox="0 0 48 48" className="h-[31px] w-[31px]" aria-hidden>
										<path d="M24 10 35 17v14L24 38 13 31V17L24 10Z" fill="none" stroke="currentColor" strokeWidth="3" />
									</svg>
								</WalletAssetIcon>
								<div className="min-w-0 whitespace-nowrap text-[16px] font-bold tracking-[-0.5px]">Service Credits</div>
							</div>
							<div className="whitespace-nowrap text-[clamp(22px,5.2vw,31px)] font-extrabold leading-[1.05] tracking-[-1.5px]">
								{bUnitLabel}
							</div>
							<div className="mt-[7px] text-[15px] leading-snug tracking-[-0.25px] text-[#777da8] dark:text-slate-400">
								{bUnitUsdLabel}
							</div>
						</button>
					</section>

					<section className="mt-7">
						<h2 className="mb-3 ml-0.5 mt-0 text-[21px] font-extrabold leading-none tracking-[-0.7px]">Quick Actions</h2>
						<div className="grid min-h-[98px] grid-cols-[1fr_1fr_0.8fr_1.2fr] overflow-hidden rounded-[21px] border border-[rgba(213,225,239,0.72)] bg-white/75 shadow-[0_12px_35px_rgba(71,112,156,0.055)] backdrop-blur-[20px] dark:border-slate-700 dark:bg-slate-900/80">
							<QuickAction
								label="Deposit"
								tone="blue"
								onClick={() => openDeposit()}
								icon={
									<span className="grid h-[31px] w-[31px] place-items-center rounded-full bg-[#0878f9] text-white">
										<svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
											<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" />
										</svg>
									</span>
								}
							/>
							<QuickAction
								label="Top up & Pay"
								tone="green"
								onClick={() => navigate('/qr', { state: { tab: 'mycode' } })}
								icon={
									<svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
										<path d="M10 19v-7h7" />
										<path d="M31 12h7v7" />
										<path d="M38 29v7h-7" />
										<path d="M17 36h-7v-7" />
										<path d="M18 18h5v5h-5z" />
										<path d="M27 18h3" />
										<path d="M27 23h5" />
										<path d="M18 28h4" />
										<path d="M26 27h6v6h-6z" />
									</svg>
								}
							/>
							<QuickAction
								label="Swap"
								tone="blue"
								disabled
								icon={
									<svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
										<path d="M11 17h24" />
										<path d="m30 11 6 6-6 6" />
										<path d="M37 31H13" />
										<path d="m18 25-6 6 6 6" />
									</svg>
								}
							/>
							<QuickAction
								label="Transaction History"
								tone="purple"
								onClick={() => navigate('/Pay')}
								icon={
									<svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
										<rect x="15" y="10" width="19" height="27" rx="3" />
										<path d="M20 18h9M20 24h9M20 30h6" />
									</svg>
								}
							/>
						</div>
					</section>

					<section className="relative mt-4 h-[132px] overflow-hidden rounded-[21px] bg-[radial-gradient(circle_at_80%_45%,rgba(89,161,255,0.25),transparent_34%),linear-gradient(110deg,#edf7ff_0%,#e1f0ff_55%,#cfe5ff_100%)]">
						<div className="relative z-[3] px-[22px] py-[25px]">
							<h2 className="m-0 text-[22px] font-extrabold tracking-[-0.8px] text-[#080817]">Put idle USDC to work</h2>
							<p className="mb-3 mt-1.5 text-[15px] tracking-[-0.3px] text-[#777da8]">
								Earn yield with trusted DeFi partners.
							</p>
							<button
								type="button"
								onClick={() => navigate('/BountyBoard')}
								className="border-0 bg-transparent p-0 text-[17px] font-medium text-[#0878f9]"
							>
								Explore DeFi
							</button>
						</div>
						<div className="pointer-events-none absolute inset-0" aria-hidden>
							<span className="absolute -top-8 right-[115px] h-[78px] w-[78px] rounded-full bg-[rgba(112,174,255,0.14)]" />
							<span className="absolute right-[-18px] top-0 h-[65px] w-[65px] rounded-full bg-[rgba(112,174,255,0.14)]" />
							<span className="absolute bottom-[-18px] right-[146px] h-[52px] w-[52px] rounded-full bg-[rgba(112,174,255,0.14)]" />
							<span className="absolute bottom-[-12px] right-[-18px] h-[65px] w-[65px] rounded-full bg-[rgba(112,174,255,0.14)]" />
							<div className="absolute bottom-0.5 right-2 h-[115px] w-[140px]">
								<div className="absolute left-[43px] top-4 h-7 w-[41px] rotate-[30deg] rounded-[100%_0_100%_0] bg-gradient-to-br from-[#8fd1ff] to-[#0879ef]" />
								<div className="absolute left-[76px] top-[13px] h-7 w-[41px] -rotate-[26deg] rounded-[0_100%_0_100%] bg-gradient-to-br from-[#8fd1ff] to-[#0879ef]" />
								<div className="absolute bottom-2 right-[13px] grid h-[65px] w-[93px] place-items-center rounded-[10px] border border-white/65 bg-gradient-to-br from-[rgba(108,180,255,0.78)] to-[rgba(22,119,242,0.83)] text-white/90 shadow-[0_12px_22px_rgba(0,109,255,0.18)]">
									<svg viewBox="0 0 120 70" className="w-[73px]" aria-hidden>
										<path d="M17 52 42 30 57 42 89 13" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
										<path d="M75 13h14v14" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
									</svg>
								</div>
							</div>
						</div>
					</section>
				</main>
			</div>

			{assetKind ? (
				<WalletAssetDetail
					kind={assetKind}
					account={profileKeyId}
					activity={recentActivityNoAaItems}
					usdcBalance={`${usdcLabel} USDC`}
					usdcFiat={usdcCadLabel}
					usdcRateLabel={`1 USDC = CA$ ${formatFiat2(cadPerUsdc)}`}
					storeBalance={storeLabel}
					merchantCount={merchantCount}
					rewardBalance={rewardLabel}
					rewardMerchantCount={rewardMerchantCount}
					bUnitBalance={bUnitLabel}
					bUnitFiat={bUnitUsdLabel}
					onClose={() => setAssetKind(null)}
					onAction={handleAssetAction}
				/>
			) : null}

			{depositStart
				? createPortal(
					<div className="fixed inset-0 z-[130] overflow-y-auto bg-[#f8fbff] dark:bg-slate-950">
						<div className="px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
							<BeamioCircularBackButton variant="onLight" onClick={closeDeposit} ariaLabel="Back" />
						</div>
						<BeamioAddUSDCFlow
							key={depositStart}
							initialScreen={depositStart === 'coinbase' ? 'hub' : depositStart}
							autoStartCoinbase={depositStart === 'coinbase'}
						/>
					</div>,
					document.body,
				)
				: null}

			{showFuel
				? createPortal(
					<div className="fixed inset-0 z-[130] flex flex-col overflow-y-auto bg-white pt-[env(safe-area-inset-top)] dark:bg-slate-900">
						<FuelView
							onClose={() => setShowFuel(false)}
							bUnitBalance={bUnitBalance}
							account={profile?.keyID}
							onRefresh={() => {
								const id = profile?.keyID?.trim()
								if (!id) return
								void getBUnitBalanceOnConet(id).then((balance) => {
									if (Number.isFinite(balance.total)) setBUnitBalance(balance)
								}).catch(() => {})
							}}
						/>
					</div>,
					document.body,
				)
				: null}

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

function QuickAction({
	label,
	tone,
	icon,
	onClick,
	disabled = false,
}: {
	label: string
	tone: 'blue' | 'green' | 'purple'
	icon: React.ReactNode
	onClick?: () => void
	disabled?: boolean
}) {
	const toneClass =
		tone === 'green'
			? 'bg-[rgba(0,197,149,0.10)] text-[#04bc91]'
			: tone === 'purple'
				? 'bg-[rgba(153,68,232,0.10)] text-[#9944e8]'
				: 'bg-[rgba(8,120,249,0.09)] text-[#0878f9]'
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={disabled ? undefined : onClick}
			aria-disabled={disabled || undefined}
			className={`relative flex min-w-0 flex-col items-center gap-[7px] border-0 bg-transparent px-[5px] pb-2.5 pt-[11px] text-[#777da8] [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:right-0 [&:not(:last-child)]:after:top-[22px] [&:not(:last-child)]:after:h-[52px] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-[rgba(204,211,228,0.65)] ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
		>
			<span className={`grid h-[45px] w-[45px] place-items-center rounded-full [&_svg]:h-7 [&_svg]:w-7 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[2.5] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${toneClass}`}>
				{icon}
			</span>
			<span className="whitespace-nowrap text-[clamp(11px,3vw,14px)] tracking-[-0.4px]">{label}</span>
		</button>
	)
}
