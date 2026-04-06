import React, { useEffect, useState, useRef } from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe, ArrowRight, AlertTriangle, X, Building2, Cloud, Store, Heart, LayoutDashboard, BadgeCheck, Info, UserRound } from "lucide-react"
import { getAAAccount, getRedeemDetailsForDisplay, postCardRedeem, postCardRedeemAdmin, getMyAssets, checkRedeemAdminCodeValid, isCardAdmin } from "@/services/BeamioCard"
import { initChat}from '@/services/chat'

import { getUsdcBalanceFromApi, formatWithThousands, isStandalone } from "@/services/beamio"
import { ethers } from "ethers"
import { BASE_MAINNET_FACTORIES } from "@/config/chainAddresses"
import { updateManifestStartUrl } from "@/utils/updateManifestStartUrl"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { getUserInfo, storeSystemData, checkStorage, restoreWithRedeem } from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BusinessIdentityForm from './BusinessIdentityForm'
import WorkspaceCreatingOverlay from './WorkspaceCreatingOverlay'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { OnboardingBusinessDetailsScreen } from '@/pages/Home/OnboardingBusinessDetailsScreen'
import {
	clearSessionOnboardingBusinessDraft,
	loadSessionOnboardingBusinessDraft,
	mergeSessionOnboardingDraftIntoEoa,
	saveSessionOnboardingBusinessDraft,
} from '@/utils/verraBusinessProfileLocal'
import type { VerraBusinessProfileBusinessType } from '@/utils/verraBusinessProfileLocal'

const APP_VERSION = (packageJson as { version?: string }).version ?? ''
const ISSUED_NFT_START_ID = 100_000_000_000

/** 从 NFT tokenId 推导卡号显示：issued NFT 用序号，tier NFT 用 tokenId */
function formatMemberNo(tokenId: string | number): string {
	const n = Number(tokenId)
	if (n >= ISSUED_NFT_START_ID) {
		return `M-${String(n - ISSUED_NFT_START_ID + 1).padStart(6, '0')}`
	}
	return `M-${String(n).padStart(6, '0')}`
}

// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
	onInitComplete?: () => void
}

export default function BeamioOnboardingModal({home, onInitComplete}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, 
		setAllNodes, setGossip, gossip,
		setIsInitialLoading, myAddress, setMyAddress, usdcbalance, setShowFooter, setCharts } = useDaemonContext()
	const [walletAddr, setWalletAddr] = useState('')
	const [usdcBal, setUsdcBal] = useState('0')
	const [eoaAddress, setEoaAddress] = useState('')
	const [loading, SetLoading] = useState(true)
	const [settingsOpen, setSettingsOpen] = useState<''|'RecoveryQRScreen'|'RestoreEntryScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(true)
	/** Cover splash（newOnloading.html 风格）— 在进入 InitialEntryScreen 前展示 */
	const [showOnboardingCover, setShowOnboardingCover] = useState(true)
	const [coverBusinessType, setCoverBusinessType] = useState<VerraBusinessProfileBusinessType>(() => {
		const d = loadSessionOnboardingBusinessDraft()
		const bt = d?.businessType
		return bt === 'chain' || bt === 'ngo' || bt === 'solo' ? bt : 'solo'
	})
	const [coverTermsAccepted, setCoverTermsAccepted] = useState(() =>
		Boolean(loadSessionOnboardingBusinessDraft()?.onboardingTermsAccepted)
	)
	/** Select Type → Details（单列业务资料）→ Identity（InitialEntryScreen） */
	const [showOnboardingBusinessDetails, setShowOnboardingBusinessDetails] = useState(false)
	const [detailBusinessName, setDetailBusinessName] = useState(
		() => loadSessionOnboardingBusinessDraft()?.storeName ?? ''
	)
	const [detailCategory, setDetailCategory] = useState(() => loadSessionOnboardingBusinessDraft()?.category ?? 'retail')
	const [detailCountry, setDetailCountry] = useState(() => loadSessionOnboardingBusinessDraft()?.country ?? '')
	const [detailCity, setDetailCity] = useState(() => loadSessionOnboardingBusinessDraft()?.city ?? '')
	const [detailProvince, setDetailProvince] = useState(() => loadSessionOnboardingBusinessDraft()?.province ?? '')
	/** Full-screen creating overlay owned here so it survives InitialEntry → Recovery layout swap (avoids flash). */
	const [workspaceCreating, setWorkspaceCreating] = useState(false)
	const [qrDataUrl, setQrDataUrl] = useState('')
	const [recoveryCode, setRecoveryCode]  = useState('')
	const [beamioTag, setBeamioTag] = useState('')
	const [temp, setTemp] = useState<any>()

	// Redeem from URL (beamiocard + redeemcode)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress: string; redeemCode: string } | null>(null)
	const [hasCheckedUrl, setHasCheckedUrl] = useState(false)
	/** 从 URL 的 MasterKey 参数进入的 recover 模式，预填 Account Recovery 的备份密钥框 */
	const [restoreFromUrlMasterKey, setRestoreFromUrlMasterKey] = useState('')
	const [redeemDetails, setRedeemDetails] = useState<import('@/services/BeamioCard').RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [redeeming, setRedeeming] = useState(false)
	const [redeemDone, setRedeemDone] = useState(false)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [ccsaAssets, setCcsaAssets] = useState<{ points: string; nfts: { tokenId: string }[] } | null>(null)
	const redeemHandledByRecoveryRef = useRef(false)
	const homeCalledRef = useRef(false)
	const [redeemActivating, setRedeemActivating] = useState(false)
	const [redeemPostCreateInProgress, setRedeemPostCreateInProgress] = useState(false)

	useEffect(() => {
		if (!isInitialEntry) return
		saveSessionOnboardingBusinessDraft({
			businessType: coverBusinessType,
			onboardingTermsAccepted: coverTermsAccepted,
			storeName: detailBusinessName,
			category: detailCategory,
			country: detailCountry,
			city: detailCity,
			province: detailProvince,
		})
	}, [
		isInitialEntry,
		coverBusinessType,
		coverTermsAccepted,
		detailBusinessName,
		detailCategory,
		detailCountry,
		detailCity,
		detailProvince,
	])


	const init = async (temp?: encrypt_keys_object, opts?: { dontClose?: boolean }) => {

		const isAcc = await checkStorage()
		if (!isAcc) {
			clearSessionOnboardingBusinessDraft()
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			setShowOnboardingCover(true)
			setShowOnboardingBusinessDetails(false)
			setCoverBusinessType("solo")
			setCoverTermsAccepted(false)
			setDetailBusinessName("")
			setDetailCategory("retail")
			setDetailCountry("")
			setDetailCity("")
			setDetailProvince("")
			setWorkspaceCreating(false)
			onInitComplete?.()
			return
		}

		temp = temp||isAcc
	
		const profiles = temp?.profiles
		

		
		if (!temp || !profiles ) {
			clearSessionOnboardingBusinessDraft()
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			setShowOnboardingCover(true)
			setShowOnboardingBusinessDetails(false)
			setCoverBusinessType("solo")
			setCoverTermsAccepted(false)
			setDetailBusinessName("")
			setDetailCategory("retail")
			setDetailCountry("")
			setDetailCity("")
			setDetailProvince("")
			setWorkspaceCreating(false)
			onInitComplete?.()
			return
		}

		setProfiles(profiles)

		
		const loadUserInfo = (): Promise<beamio> => new Promise(async (resolve) => {
			const userInfo = await getUserInfo(profiles[0].keyID)
			if (!userInfo) {
				return setTimeout(async () => {
					return resolve(await loadUserInfo())
				}, 1000)
			}
			return resolve(userInfo)
		})
			
		const userInfo = await loadUserInfo()
		if (!userInfo) return
		
		const bo: beamio = userInfo

		SetLoading(true)
		initChat(setProfiles, setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})
		
		bo.initialLoading = true
		
		
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await storeSystemData()
		const eoa = profiles[0]?.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) {
			const eoaNorm = ethers.getAddress(eoa)
			setEoaAddress(eoa)
			setMyAddress(eoa)
			mergeSessionOnboardingDraftIntoEoa(eoaNorm)
		}
		SetLoading(false)
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		if (!opts?.dontClose) setSettingsOpen('')
		onInitComplete?.()
  	}


	const headlineFont = { fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" } as const

	/** 与 newOnloading.html / 设计稿一致：顶栏步骤 + 40/60 双栏 + 业务类型 + 条款 + Continue */
	const OnboardingCoverScreen = () => (
		<div
			className="
				min-h-[max(720px,100dvh)] w-full flex flex-col relative bg-[#f5f7f9] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#2c2f31]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			<nav
				className="fixed top-0 left-0 right-0 z-50 flex max-w-full items-center justify-end border-b border-[#abadaf]/10 bg-[#f5f7f9]/70 px-4 py-3 backdrop-blur-xl"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<div className="hidden items-center gap-4 text-[10px] font-bold tracking-tight md:flex" style={headlineFont}>
					<span className="text-[#1562f0] border-b-2 border-[#1562f0] pb-0.5">Select Type</span>
					<span className="text-[#abadaf]">Details</span>
					<span className="text-[#abadaf]">Identity</span>
				</div>
			</nav>

			{APP_VERSION && (
				<div
					className="fixed right-4 z-[60] text-[11px] font-medium text-[#abadaf] md:right-6"
					style={{ top: "calc(env(safe-area-inset-top) + 4.25rem)" }}
				>
					v{APP_VERSION}
				</div>
			)}

			<main className="flex min-h-0 flex-1 flex-col pt-[calc(4rem+env(safe-area-inset-top))] md:flex-row md:pt-[calc(3.5rem+env(safe-area-inset-top))] pb-20 md:pb-0">
				<section className="flex w-full flex-col justify-center bg-[#eef1f3] p-5 md:w-[40%] md:p-10 lg:p-12">
					<div className="mx-auto w-full max-w-md md:mx-0">
						<div className="mb-6 flex items-center gap-0 md:mb-8">
							<img
								src={BIZ_PUBLIC_LOGO512}
								alt=""
								className="h-9 w-9 shrink-0 rounded-lg object-contain"
							/>
							<div className="text-2xl font-black tracking-tighter text-[#1562f0]" style={headlineFont}>
								Verra Business
							</div>
						</div>
						<h1
							className="mb-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-[#2c2f31] md:text-4xl lg:text-5xl"
							style={headlineFont}
						>
							Set up your business for <span className="text-[#1562f0]">live commerce.</span>
						</h1>
						<p className="mb-6 text-base leading-relaxed text-[#595c5e] md:mb-8 md:text-lg">
							Create your Verra Business workspace to issue membership cards, manage customer balance, and run branded payments in one
							place.
						</p>
						<div className="space-y-4">
							<div className="rounded-2xl bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5 md:p-5">
								<div className="flex items-start gap-4">
									<div className="rounded-full bg-[#7a9dff]/20 p-2">
										<LayoutDashboard className="h-6 w-6 text-[#1562f0]" strokeWidth={2} aria-hidden />
									</div>
									<div>
										<h3 className="mb-1 font-bold text-[#2c2f31]">Business Control</h3>
										<p className="text-sm leading-relaxed text-[#595c5e]">
											Centralized dashboard for all your commerce nodes and liquid assets.
										</p>
									</div>
								</div>
							</div>
							<div className="rounded-2xl bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5 md:p-5">
								<div className="flex items-start gap-4">
									<div className="rounded-full bg-[#7a9dff]/20 p-2">
										<Fingerprint className="h-6 w-6 text-[#1562f0]" strokeWidth={2} aria-hidden />
									</div>
									<div>
										<h3 className="mb-1 font-bold text-[#2c2f31]">Brand Identity</h3>
										<p className="text-sm leading-relaxed text-[#595c5e]">
											Deploy custom smart-contract backed membership tiers and loyalty rails.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="flex w-full flex-col justify-center bg-white p-5 md:w-[60%] md:p-10 lg:p-14">
					<div className="mx-auto w-full max-w-xl md:mx-0">
						<header className="mb-6 md:mb-8">
							<h2 className="mb-2 text-2xl font-bold text-[#2c2f31] md:text-[1.75rem]" style={headlineFont}>
								Select your business type
							</h2>
							<p className="leading-relaxed text-[#595c5e]">
								Choose your organization structure. We&apos;ll tailor your workspace and network settings accordingly.
							</p>
						</header>

						<div className="space-y-4">
							{(
								[
									{
										id: "solo" as const,
										title: "Solo Business or Creator",
										desc: "Perfect for single-location stores, pop-ups, and independent brands.",
										Icon: Store,
									},
									{
										id: "chain" as const,
										title: "Chain or Franchise",
										desc: "Advanced terminal routing, multi-location analytics, and staff roles.",
										Icon: Building2,
									},
									{
										id: "ngo" as const,
										title: "NGO or Community",
										desc: "Zero-fee donation routing, member drives, and fund tracking.",
										Icon: Heart,
									},
								] as const
							).map(({ id, title, desc, Icon }) => (
								<label
									key={id}
									className={`
										group relative flex cursor-pointer items-center rounded-2xl border-2 border-transparent bg-[#eef1f3] p-4 md:p-5
										transition-all hover:bg-[#e5e9eb] hover:shadow-md
										${coverBusinessType === id ? "border-[#1562f0] bg-[#7a9dff]/5" : ""}
									`}
								>
									<input
										type="radio"
										name="cover_business_type"
										className="peer sr-only"
										checked={coverBusinessType === id}
										onChange={() => setCoverBusinessType(id)}
									/>
									<div
										className={`
											flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#595c5e] transition-colors
											group-hover:text-[#1562f0] ${coverBusinessType === id ? "text-[#1562f0]" : ""}
										`}
									>
										<Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
									</div>
									<div className="ml-6 min-w-0 flex-grow">
										<div className="flex items-center justify-between gap-3">
											<span
												className={`block font-bold transition-colors ${
													coverBusinessType === id ? "text-[#1562f0]" : "text-[#2c2f31] group-hover:text-[#1562f0]"
												}`}
											>
												{title}
											</span>
											<div
												className={`
													flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#abadaf] transition-colors
													${coverBusinessType === id ? "border-[#1562f0] bg-[#1562f0]" : ""}
												`}
											>
												{coverBusinessType === id ? <div className="h-2 w-2 rounded-full bg-white" aria-hidden /> : null}
											</div>
										</div>
										<span className="mt-1 block text-sm text-[#595c5e]">{desc}</span>
									</div>
								</label>
							))}
						</div>

						<div className="mt-6 space-y-5 border-t border-[#abadaf]/10 pt-6">
							<label className="flex cursor-pointer gap-4">
								<div className="mt-0.5 shrink-0">
									<input
										type="checkbox"
										className={`
											h-5 w-5 rounded border-[#abadaf] text-[#1562f0] focus:ring-[#1562f0]
											${bizBrandFocusRingClass}
										`}
										checked={coverTermsAccepted}
										onChange={(e) => setCoverTermsAccepted(e.target.checked)}
									/>
								</div>
								<p className="text-[11px] font-semibold uppercase leading-relaxed tracking-wider text-[#595c5e]">
									I agree to{" "}
									<a
										className="text-[#1562f0] underline-offset-2 hover:underline"
										href="https://verra.network/terms"
										target="_blank"
										rel="noopener noreferrer"
									>
										the Verra terms of service and smart contract deployment agreement
									</a>
									. I understand this initiates a non-custodial environment.
								</p>
							</label>

							<button
								type="button"
								disabled={!coverTermsAccepted}
								className={`
									flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] px-6 py-4 text-sm font-bold text-white md:text-base
									shadow-[0_20px_40px_rgba(21,98,240,0.15)] transition-all hover:shadow-[0_20px_40px_rgba(21,98,240,0.25)] active:scale-[0.98]
									disabled:pointer-events-none disabled:opacity-40
									${bizBrandFocusRingClass}
								`}
								onClick={() => {
									if (!coverTermsAccepted) return
									setShowOnboardingCover(false)
									setShowOnboardingBusinessDetails(true)
								}}
							>
								Continue
								<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
							</button>
						</div>
					</div>
				</section>
			</main>

			<footer className="mt-auto flex flex-col items-center justify-between gap-4 border-t border-[#abadaf]/10 bg-[#eef1f3] px-5 py-6 pb-20 text-[10px] font-bold uppercase tracking-[0.2em] text-[#595c5e] md:flex-row md:px-10 md:pb-6">
				<div className="text-center tracking-[0.2em] md:text-left">Securely hosted by Beamio Infrastructure © 2026</div>
				<div className="flex flex-wrap justify-center gap-8 text-[11px] font-bold tracking-widest">
					<a className="transition-colors hover:text-[#1562f0]" href="https://verra.network/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="transition-colors hover:text-[#1562f0]" href="https://verra.network/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="transition-colors hover:text-[#1562f0]" href="https://verra.network/contact" target="_blank" rel="noopener noreferrer">
						Help Center
					</a>
				</div>
			</footer>

			<nav
				className="fixed bottom-0 left-0 right-0 z-50 flex justify-around rounded-t-[2rem] bg-white/70 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_40px_rgba(21,98,240,0.06)] backdrop-blur-2xl md:hidden"
				aria-label="Onboarding steps"
			>
				<div className="flex flex-col items-center justify-center rounded-full bg-[#1562f0] p-3 text-white">
					<BadgeCheck className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={headlineFont}>
						Select Type
					</span>
				</div>
				<div className="flex flex-col items-center justify-center p-3 text-slate-400">
					<Info className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={headlineFont}>
						Details
					</span>
				</div>
				<div className="flex flex-col items-center justify-center p-3 text-slate-400">
					<UserRound className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={headlineFont}>
						Identity
					</span>
				</div>
			</nav>
		</div>
	)

	const InitialEntryScreen = () => (
		<div
			className="
				relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-white font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#121212]
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			<div
				className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(21,98,240,0.04)_0%,transparent_70%)]"
				aria-hidden
			/>
			<div
				className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(21,98,240,0.04)_0%,transparent_70%)] opacity-50"
				aria-hidden
			/>

			{APP_VERSION && (
				<div className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-6 z-10 text-[11px] text-[#abadaf] font-medium">
					v{APP_VERSION}
				</div>
			)}

			{/* newOnloading.html — 单列顶栏 */}
			<header className="relative z-10 flex shrink-0 items-center justify-center gap-0 px-5 pt-5 lg:justify-start lg:px-8">
				<img
					src={BIZ_PUBLIC_LOGO512}
					alt=""
					className="h-8 w-8 shrink-0 rounded-lg object-contain"
				/>
				<span className="text-xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
					Verra Business
				</span>
			</header>

			<main className="relative z-10 flex min-h-0 flex-1 flex-grow items-center justify-center px-4 py-8">
				<div className="w-full max-w-md">
					<div className="mb-6 text-center lg:text-left">
						<h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[#121212] sm:text-3xl" style={headlineFont}>
							Create your business identity
						</h2>
						<p className="leading-relaxed text-[#666666]">
							Choose your Verra handle and set the password that protects your business workspace.
						</p>
					</div>

					{isStandalone && (
						<div className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50 p-4">
							<p className="text-[13px] font-medium leading-snug text-amber-900">
								Opened from home screen? Wallet data from Safari doesn&apos;t transfer. Use <strong>Restore Wallet</strong> below.
							</p>
						</div>
					)}

					<BusinessIdentityForm
						isRedeemFlow={!!redeemFromUrl}
						showIntroHeader={false}
						onWorkspaceCreatingChange={setWorkspaceCreating}
						onSuccess={(qr) => {
							setQrDataUrl(qr.qrDataUrl)
							setRecoveryCode(qr.passcode)
							setBeamioTag(qr.beamioTag ?? '')
							setTemp(qr.temp)
							if (redeemFromUrl) {
								setRedeemActivating(true)
								setRedeemPostCreateInProgress(true)
							}
							setSettingsOpen('RecoveryQRScreen')
							// Let Recovery mount + paint under overlay, then remove overlay (avoids identity shell / empty layout flash).
							window.requestAnimationFrame(() => {
								window.requestAnimationFrame(() => {
									window.setTimeout(() => setWorkspaceCreating(false), 340)
								})
							})
						}}
						trailingAfterSubmit={
							<>
								<AppButton
									fullWidth
									variant="secondary"
									className={`
										rounded-xl border border-[#E5E7EB] bg-white py-3 text-sm font-semibold text-[#121212] sm:text-base
										shadow-sm hover:bg-[#F9FAFB]
										${bizBrandFocusRingClass}
									`}
									onClick={() => setSettingsOpen('RestoreEntryScreen')}
								>
									Restore Wallet
								</AppButton>
								<p className="pt-1 text-center text-[11px] font-medium text-[#abadaf]">Gas sponsored. Non-custodial.</p>
							</>
						}
					/>
				</div>
			</main>

			<footer className="mx-auto mt-auto flex w-full max-w-screen-xl flex-col items-center justify-between gap-4 border-t border-transparent px-5 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]/50 md:flex-row lg:px-8">
				<div className="flex items-center gap-2 text-center md:text-left">
					<Cloud className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
					<span>Securely hosted by Beamio Infrastructure © 2026</span>
				</div>
				<div className="flex flex-wrap justify-center gap-8 md:gap-8">
					<a className="transition-colors hover:text-[#1562F0]" href="https://verra.network/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="https://verra.network/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="https://verra.network/contact" target="_blank" rel="noopener noreferrer">
						Help Center
					</a>
				</div>
			</footer>
		</div>
	)

	const wrapWithWorkspaceCreatingOverlay = (node: React.ReactNode) => (
		<>
			{workspaceCreating ? <WorkspaceCreatingOverlay /> : null}
			{node}
		</>
	)

	
	// 首次进入（无钱包）：Select Type → Details（单列）→ Identity（Create/Restore）
	if (isInitialEntry && !settingsOpen && showOnboardingCover) {
		return wrapWithWorkspaceCreatingOverlay(<OnboardingCoverScreen />)
	}

	if (isInitialEntry && !settingsOpen && showOnboardingBusinessDetails) {
		return wrapWithWorkspaceCreatingOverlay(
			<OnboardingBusinessDetailsScreen
				appVersion={APP_VERSION}
				detailBusinessName={detailBusinessName}
				setDetailBusinessName={setDetailBusinessName}
				detailCategory={detailCategory}
				setDetailCategory={setDetailCategory}
				detailCountry={detailCountry}
				setDetailCountry={setDetailCountry}
				detailCity={detailCity}
				setDetailCity={setDetailCity}
				detailProvince={detailProvince}
				setDetailProvince={setDetailProvince}
				onContinue={() => setShowOnboardingBusinessDetails(false)}
			/>,
		)
	}

	if (isInitialEntry && !settingsOpen) {
		return wrapWithWorkspaceCreatingOverlay(<InitialEntryScreen />)
	}

	return wrapWithWorkspaceCreatingOverlay((
		<div className="
				min-h-screen w-full bg-white dark:bg-slate-900
				/* 👇 安全区补偿 */
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]

		">
			<div className="min-h-screen">
				
				
				
			</div>
			<AnimatePresence>
				{settingsOpen && (
					<motion.div
						className={
							"fixed inset-0 z-[9998] flex flex-col " +
							(settingsOpen === "RestoreEntryScreen"
								? "bg-[#f5f7f9]"
								: "bg-white dark:bg-slate-900")
						}
						initial={settingsOpen === "RecoveryQRScreen" ? { x: 0 } : { x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
					{/* RecoveryQRScreen / RestoreEntryScreen 自带顶栏 */}
					{/* 内容区域 */}
						<div 
							className="flex-1 overflow-y-auto min-h-0"
						>
							
							{
								settingsOpen === 'RecoveryQRScreen' && <RecoveryQRScreen
									qrDataUrl={qrDataUrl}
									recoveryCode={recoveryCode}
									showButton={true}
									beamioTag={beamioTag || undefined}
									isRedeemFlow={!!redeemFromUrl}
									redeemActivating={redeemActivating}
									onBack={() => {
										setWorkspaceCreating(false)
										setSettingsOpen('')
									}}
									close={redeemFromUrl ? () => {
										// redeem 流程下 init+redeem 已在进入时完成，此处仅关闭
										setWorkspaceCreating(false)
										setSettingsOpen('')
									} : async () => {
										setWorkspaceCreating(false)
										await init(temp, { dontClose: true })
										// URL 带 redeemAdmin + redeemCode 时：校验 code 有效、EOA 非 admin 后，向 endpoint 完成 redeem admin
										const redeemAdminParams = parseRedeemAdminFromUrl()
										if (redeemAdminParams) {
											const userEOA = temp?.profiles?.[0]?.keyID?.trim()
											if (userEOA && ethers.isAddress(userEOA)) {
												const valid = await checkRedeemAdminCodeValid(redeemAdminParams.cardAddress, redeemAdminParams.redeemCode)
												if (!valid) {
													console.warn('[RecoveryQRScreen] redeemAdmin code invalid or expired, skip')
												} else {
													const alreadyAdmin = await isCardAdmin(redeemAdminParams.cardAddress, userEOA)
													if (alreadyAdmin) {
														console.warn('[RecoveryQRScreen] EOA already admin, skip redeem')
													} else {
														const res = await postCardRedeemAdmin(
															redeemAdminParams.cardAddress,
															redeemAdminParams.redeemCode,
															userEOA
														)
														if (!res.success && res.error) {
															console.warn('[RecoveryQRScreen] redeemAdmin failed:', res.error)
														}
													}
												}
											}
										}
										home()
									}} />
							}
							
							{
								settingsOpen === 'RestoreEntryScreen' && (
									<RestoreEntryScreen
										onClose={() => {
											setWorkspaceCreating(false)
											setSettingsOpen('')
										}}
										onWorkspaceCreatingChange={setWorkspaceCreating}
										initialRecoveryCode={restoreFromUrlMasterKey}
										onRestore={async (temp) => {
											setSettingsOpen('')
											setRestoreFromUrlMasterKey('')
											try {
												await init(temp)
												home()
											} finally {
												setWorkspaceCreating(false)
											}
										}}
									/>
								)
							}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

		</div>
	))
}
