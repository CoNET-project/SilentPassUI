import React, { useEffect, useState, useRef } from "react";
import { IpfsImg } from '@/components/IpfsImg';
import beamio_icon from '@/components/assets/32x32.svg'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe, ArrowRight, ArrowLeft, AlertTriangle, X, Building2, Cloud, Store, Heart, LayoutDashboard, Briefcase, HelpCircle, History, ChevronDown, LayoutGrid, Hexagon, ShieldCheck } from "lucide-react"
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
import BusinessIdentityForm, { type BusinessIdentitySuccess } from './BusinessIdentityForm'
import WorkspaceCreatingOverlay from './WorkspaceCreatingOverlay'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import BizHome from './bizHome'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { OnboardingBusinessDetailsScreen } from '@/pages/Home/OnboardingBusinessDetailsScreen'
import {
	clearSessionOnboardingBusinessDraft,
	clearLiteBusinessChainAck,
	hasVerraLiteBusinessRequiredFields,
	loadBusinessProfileDraftForEoa,
	loadSessionOnboardingBusinessDraft,
	mergeSessionOnboardingDraftIntoEoa,
	patchBusinessProfileDraftForEoa,
	pickVerraBusinessFieldsFromRecover,
	saveSessionOnboardingBusinessDraft,
	setLiteBusinessChainAck,
	type VerraBusinessProfileDraft,
} from '@/utils/verraBusinessProfileLocal'
import type { VerraBusinessProfileBusinessType } from '@/utils/verraBusinessProfileLocal'
import {
	isWorkspaceScreenLocked,
	markWorkspaceSessionUnlocked,
} from '@/utils/beamioWorkspaceLock'
import { hasSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { ONBOARDING_REGIONS_BY_COUNTRY } from '@/pages/Home/onboardingRegions'

const APP_VERSION = (packageJson as { version?: string }).version ?? ''

/** Onboarding business details：无草稿时默认国家（Canada） */
const DEFAULT_ONBOARDING_DETAIL_COUNTRY = "CA"
/** 无草稿时默认经营类目 */
const DEFAULT_ONBOARDING_DETAIL_CATEGORY = "local-services"

type OnboardingCoverMobilePhase = 'entry' | 'businessForm'

function LoadingPageOnboardingDetailsSelectChevron(): React.ReactElement {
	return (
		<ChevronDown
			className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]"
			aria-hidden
		/>
	)
}
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
	const [showBizLogin, setShowBizLogin] = useState(false)
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
	/** Mobile: entry → Lite 登记页（Continue 即 solo + 进入 Identity，无 Select business type） */
	const [onboardingCoverMobilePhase, setOnboardingCoverMobilePhase] = useState<OnboardingCoverMobilePhase>('entry')
	/** Select Type → Details（单列业务资料）→ Identity（InitialEntryScreen） */
	const [showOnboardingBusinessDetails, setShowOnboardingBusinessDetails] = useState(false)
	const [detailBusinessName, setDetailBusinessName] = useState(
		() => loadSessionOnboardingBusinessDraft()?.storeName ?? ''
	)
	const [detailCategory, setDetailCategory] = useState(
		() => loadSessionOnboardingBusinessDraft()?.category || DEFAULT_ONBOARDING_DETAIL_CATEGORY,
	)
	const [detailCountry, setDetailCountry] = useState(
		() => loadSessionOnboardingBusinessDraft()?.country || DEFAULT_ONBOARDING_DETAIL_COUNTRY,
	)
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
		if (isWorkspaceScreenLocked()) {
			onInitComplete?.()
			if (typeof window !== 'undefined') window.location.href = '/'
			return
		}
		if (!isAcc) {
			clearSessionOnboardingBusinessDraft()
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			setShowOnboardingCover(true)
			setShowOnboardingBusinessDetails(false)
			setCoverBusinessType("solo")
			setCoverTermsAccepted(false)
			setOnboardingCoverMobilePhase('entry')
			setDetailBusinessName("")
			setDetailCategory(DEFAULT_ONBOARDING_DETAIL_CATEGORY)
			setDetailCountry(DEFAULT_ONBOARDING_DETAIL_COUNTRY)
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
			setOnboardingCoverMobilePhase('entry')
			setDetailBusinessName("")
			setDetailCategory(DEFAULT_ONBOARDING_DETAIL_CATEGORY)
			setDetailCountry(DEFAULT_ONBOARDING_DETAIL_COUNTRY)
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
		if (hasSessionPrivateKeyArmor()) {
			markWorkspaceSessionUnlocked()
		}
		onInitComplete?.()
  	}


	const headlineFont = { fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" } as const

	const coverBusinessTypeChoices = [
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

	const mobileCoverMeshStyle: React.CSSProperties = {
		backgroundImage: [
			"radial-gradient(at 0% 0%, #f5f7f9 0%, transparent 50%)",
			"radial-gradient(at 100% 0%, #eef1f3 0%, transparent 50%)",
			"radial-gradient(at 100% 100%, #d8e3fb 0%, transparent 50%)",
			"radial-gradient(at 0% 100%, #f5f7f9 0%, transparent 50%)",
		].join(", "),
	}

	const onboardingCoverMobileCanSubmitRegistration =
		detailBusinessName.trim().length > 0 && detailCategory.trim().length > 0

	/** Mobile cover 已填登记页：完成后跳过 OnboardingBusinessDetailsScreen，直达 Identity */
	const onboardingCoverContinue = (skipBusinessDetailsScreen: boolean) => {
		if (!coverTermsAccepted) return
		setOnboardingCoverMobilePhase('entry')
		setShowOnboardingCover(false)
		setShowOnboardingBusinessDetails(!skipBusinessDetailsScreen)
	}

	/** Desktop: 顶栏步骤 + 40/60 双栏。Mobile: Vouchers/example/marketExample.html 风格入口 + 展开后业务类型与条款。
	 *  必须是 JSX 片段而非内部 `const Foo = () => …`：否则父组件每次 setState 都会产生新组件类型，子树重挂载导致输入框失焦。 */
	const onboardingCoverScreen = (
		<div
			className="
				min-h-[max(720px,100dvh)] w-full flex flex-col relative bg-[#f5f7f9] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#2c2f31]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			<nav
				className="hidden md:flex fixed top-0 left-0 right-0 z-50 max-w-full items-center justify-end border-b border-[#abadaf]/10 bg-[#f5f7f9]/70 px-4 py-3 backdrop-blur-xl"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<div className="flex items-center gap-4 text-[10px] font-bold tracking-tight" style={headlineFont}>
					<span className="text-[#1562f0] border-b-2 border-[#1562f0] pb-0.5">Select Type</span>
					<span className="text-[#abadaf]">Details</span>
					<span className="text-[#abadaf]">Identity</span>
				</div>
			</nav>

			{APP_VERSION && (
				<div className="fixed right-4 z-[60] text-[11px] font-medium text-[#abadaf] md:right-6 top-[calc(env(safe-area-inset-top)+5.5rem)] md:top-[calc(env(safe-area-inset-top)+4.25rem)]">
					v{APP_VERSION}
				</div>
			)}

			<main className="flex min-h-0 flex-1 flex-col md:flex-row md:pt-[calc(3.5rem+env(safe-area-inset-top))] md:pb-0 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
				{/* —— Mobile: marketExample.html —— */}
				<div
					className="flex min-h-[max(720px,100dvh)] flex-1 flex-col md:hidden"
					style={onboardingCoverMobilePhase === 'entry' ? mobileCoverMeshStyle : { backgroundColor: '#f5f7f9' }}
				>
					{onboardingCoverMobilePhase === 'entry' ? (
						<>
							<header
								className="sticky top-0 z-50 flex w-full items-center justify-between bg-[#f5f7f9]/70 px-6 py-6 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl"
								style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
							>
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] shadow-lg shadow-[#1562f0]/20">
										<Briefcase className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
									</div>
									<h1
										className="truncate text-xl font-extrabold leading-none tracking-tighter text-[#1562f0]"
										style={headlineFont}
									>
										Beamio Business Lite
									</h1>
								</div>
								<a
									className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-[#eef1f3] active:scale-95 ${bizBrandFocusRingClass}`}
									href="mailto:support@beamio.app?subject=Beamio%20Business%20help"
									aria-label="Help"
								>
									<HelpCircle className="h-6 w-6 text-[#595c5e]" strokeWidth={2} aria-hidden />
								</a>
							</header>

							<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-10 pt-8">
								<div className="mb-10 space-y-3">
									<span
										className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#1562f0]"
										style={headlineFont}
									>
										Enterprise Ready
									</span>
									<h2
										className="text-4xl font-extrabold leading-[1.1] tracking-tight text-[#2c2f31]"
										style={headlineFont}
									>
										Launch your digital <span className="text-[#1562f0]">storefront.</span>
									</h2>
									<p className="text-lg font-medium leading-relaxed text-[#595c5e]/80">
										The most elegant way to manage memberships and merchant assets in one workspace.
									</p>
								</div>

								<div className="grid gap-6">
									<button
										type="button"
										onClick={() => setOnboardingCoverMobilePhase('businessForm')}
										className={`group relative w-full overflow-hidden rounded-2xl bg-white p-8 text-left shadow-[0_20px_40px_rgba(21,98,240,0.04)] transition-all duration-500 hover:shadow-[0_30px_60px_rgba(21,98,240,0.1)] active:scale-[0.98] ${bizBrandFocusRingClass}`}
									>
										<div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#1562f0]/5 transition-transform duration-700 group-hover:scale-110" aria-hidden />
										<div className="relative z-10">
											<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1562f0] shadow-xl shadow-[#1562f0]/25 transition-transform group-hover:rotate-3">
												<Store className="h-8 w-8 text-white" strokeWidth={2} aria-hidden />
											</div>
											<h3 className="mb-2 text-2xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
												New Business Setup
											</h3>
											<p className="mb-6 text-sm font-medium leading-relaxed text-[#595c5e]">
												Create a new digital workspace and issue your first membership cards.
											</p>
											<div className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#1562f0]">
												<span>GET STARTED</span>
												<ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
											</div>
										</div>
									</button>

									<button
										type="button"
										onClick={() => setShowBizLogin(true)}
										className={`group relative w-full rounded-2xl border border-white/40 bg-[#eef1f3]/50 p-8 text-left backdrop-blur-md transition-all duration-300 hover:bg-[#eef1f3] active:scale-[0.98] ${bizBrandFocusRingClass}`}
									>
										<div className="flex items-start gap-6">
											<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d9dde0] transition-colors duration-300 group-hover:bg-white">
												<History className="h-6 w-6 text-[#595c5e]" strokeWidth={2} aria-hidden />
											</div>
											<div className="min-w-0 space-y-1">
												<h3 className="text-xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
													Restore Workspace
												</h3>
												<p className="text-xs font-medium leading-relaxed text-[#595c5e]">
													Access your existing workspace using your @BeamioTag or Recovery QR.
												</p>
												<div className="mt-4 flex items-center gap-2 text-sm font-bold tracking-wide text-[#1562f0]">
													<span>RESTORE</span>
													<ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
												</div>
											</div>
										</div>
									</button>
								</div>

								<div className="relative mt-14">
									<div className="aspect-[16/10] overflow-hidden rounded-lg opacity-40 mix-blend-multiply grayscale">
										<IpfsImg
											alt=""
											className="h-full w-full object-cover"
											src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-lOOZSffTjg2F90jGhQQCV5JGl0HYwdJshlRF7JS-vuz6_xwBwr1DWrZN8TusbAKh2gifA-EbWTl0uyfIBnIaVZuhtQYmayWamMPuKyc3VwTkgy2RdHO93Ux5rP3j1R7vMz2zLssVdWgYWRPm0Pjh-9Cs4kW29OllrPYDwm-9i0yPcqdl-lNiEiOUAzmGD2VitahYc35dG883pISfBCRCI7wFQnZb2RtWSksGm6GfpyZKe5Jr-84-RleF5YP4gtWIO9C_d8lZgm0"
										/>
									</div>
									<div className="absolute -bottom-6 -right-2 max-w-[200px] rounded-2xl border border-white/20 bg-white/70 p-5 shadow-xl backdrop-blur-xl">
										<p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1562f0]">Secure by Design</p>
										<p className="text-[11px] font-medium leading-tight text-[#595c5e]">
											Encryption keys are stored locally. Only you hold the access.
										</p>
									</div>
								</div>

								<p className="mx-auto mt-16 max-w-sm text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#595c5e]/80">
									By Beamio © 2026
								</p>
							</div>
						</>
					) : (
						<>
							<header
								className="fixed top-0 left-0 right-0 z-50 flex w-full items-center gap-3 bg-[#f5f7f9]/70 px-6 py-4 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl"
								style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
							>
								<button
									type="button"
									onClick={() => setOnboardingCoverMobilePhase('entry')}
									className={`-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#1562f0] transition-opacity hover:opacity-80 active:scale-95 ${bizBrandFocusRingClass}`}
									aria-label="Back"
								>
									<ArrowLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
								<span className="text-xl font-black tracking-tight text-[#1562f0]" style={headlineFont}>
									Beamio Business Lite
								</span>
							</header>

							<div className="flex-1 overflow-y-auto overflow-x-hidden pt-[calc(4rem+env(safe-area-inset-top))] pb-28">
								<>
										<section className="overflow-hidden bg-[#f5f7f9] px-6 pb-12 pt-10">
											<div className="mx-auto w-full max-w-md">
												<h1
													className="mb-4 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight text-[#2c2f31]"
													style={headlineFont}
												>
													Set up your business for <span className="text-[#1562f0]">Lite</span> commerce.
												</h1>
												<p className="mb-10 max-w-[85%] text-lg leading-relaxed text-[#595c5e]">
													Create a dedicated workspace for global cards, payments, and smart-contract utility.
												</p>
												<div className="grid grid-cols-2 gap-4">
													<div className="translate-y-4 rounded-lg bg-white p-6 shadow-[0_10px_30px_rgba(21,98,240,0.04)]">
														<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#d8e3fb]">
															<LayoutGrid className="h-5 w-5 text-[#1562f0]" strokeWidth={2} aria-hidden />
														</div>
														<h3 className="mb-1 text-sm font-bold text-[#2c2f31]" style={headlineFont}>
															Business Control
														</h3>
														<p className="text-[11px] leading-tight text-[#595c5e]">
															Centralized dashboard for all operational workflows.
														</p>
													</div>
													<div className="-translate-y-2 rounded-lg bg-white p-6 shadow-[0_10px_30px_rgba(21,98,240,0.04)]">
														<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f797ef]/20">
															<Hexagon className="h-5 w-5 text-[#8d3a8b]" strokeWidth={2} aria-hidden />
														</div>
														<h3 className="mb-1 text-sm font-bold text-[#2c2f31]" style={headlineFont}>
															Brand Identity
														</h3>
														<p className="text-[11px] leading-tight text-[#595c5e]">
															Smart-contract loyalty and membership tiers.
														</p>
													</div>
												</div>
											</div>
										</section>

										<section className="-mt-4 rounded-t-xl bg-white px-6 py-12 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
											<div className="mx-auto w-full max-w-md">
												<div className="mb-10">
													<h2 className="mb-2 text-2xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
														Tell us about your business
													</h2>
													<p className="text-sm text-[#595c5e]">Essential for market discovery and regulatory compliance.</p>
												</div>

												<div className="space-y-8">
													<div className="space-y-2">
														<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-mobile-cover-name">
															Business Name
														</label>
														<input
															id="onb-mobile-cover-name"
															type="text"
															value={detailBusinessName}
															onChange={(e) => setDetailBusinessName(e.target.value)}
															placeholder="e.g., Main Street Roasters"
															autoComplete="organization"
															className={`
																w-full rounded-lg border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] placeholder:text-[#abadaf]
																transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
																${bizBrandFocusRingClass}
															`}
														/>
													</div>

													<div className="space-y-2">
														<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-mobile-cover-category">
															Business Category
														</label>
														<div className="relative">
															<select
																id="onb-mobile-cover-category"
																value={detailCategory}
																onChange={(e) => setDetailCategory(e.target.value)}
																className={`
																	w-full appearance-none rounded-lg border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
																	focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
																	${bizBrandFocusRingClass}
																`}
															>
																<option value="">Select category (e.g., Cafe, Retail, Bakery)</option>
																<option value="food-beverage">Food &amp; Beverage</option>
																<option value="grocery-convenience">Grocery &amp; Convenience</option>
																<option value="retail-shopping">Retail &amp; Shopping</option>
																<option value="education-training">Education &amp; Training</option>
																<option value="health-beauty">Health &amp; Beauty</option>
																<option value="fitness-wellness">Fitness &amp; Wellness</option>
																<option value="entertainment-leisure">Entertainment &amp; Leisure</option>
																<option value="local-services">Local Services</option>
															</select>
															<LoadingPageOnboardingDetailsSelectChevron />
														</div>
													</div>

													<div className="space-y-2">
														<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-mobile-cover-country">
															Country
														</label>
														<div className="relative">
															<select
																id="onb-mobile-cover-country"
																value={detailCountry}
																onChange={(e) => {
																	setDetailCountry(e.target.value)
																	setDetailProvince("")
																}}
																className={`
																	w-full appearance-none rounded-lg border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
																	focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
																	${bizBrandFocusRingClass}
																`}
															>
																<option value="">Select country</option>
																<option value="CA">Canada</option>
																<option value="US">United States</option>
																<option value="GB">United Kingdom</option>
																<option value="AU">Australia</option>
																<option value="DE">Germany</option>
															</select>
															<LoadingPageOnboardingDetailsSelectChevron />
														</div>
													</div>

													<div className="grid grid-cols-2 gap-4">
														<div className="space-y-2">
															<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-mobile-cover-city">
																City
															</label>
															<input
																id="onb-mobile-cover-city"
																type="text"
																value={detailCity}
																onChange={(e) => setDetailCity(e.target.value)}
																placeholder="e.g., Vancouver"
																autoComplete="address-level2"
																className={`
																	w-full rounded-lg border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] placeholder:text-[#abadaf]
																	transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
																	${bizBrandFocusRingClass}
																`}
															/>
														</div>
														<div className="space-y-2">
															<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-mobile-cover-province">
																Province
															</label>
															<div className="relative">
																<select
																	id="onb-mobile-cover-province"
																	value={detailProvince}
																	disabled={!detailCountry}
																	onChange={(e) => setDetailProvince(e.target.value)}
																	className={`
																		w-full appearance-none rounded-lg border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
																		focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
																		disabled:cursor-not-allowed disabled:opacity-60
																		${bizBrandFocusRingClass}
																	`}
																>
																	<option value="">
																		{detailCountry ? "Select" : "Select country first"}
																	</option>
																	{(detailCountry ? ONBOARDING_REGIONS_BY_COUNTRY[detailCountry] ?? [] : []).map(({ value, label }) => (
																		<option key={value} value={value}>
																			{label}
																		</option>
																	))}
																</select>
																<LoadingPageOnboardingDetailsSelectChevron />
															</div>
														</div>
													</div>
												</div>

												<div className="mt-12 flex items-start gap-4 rounded-lg bg-[#1562f0]/5 p-6">
													<ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
													<div>
														<p className="mb-1 text-xs font-semibold text-[#1562f0]">Encrypted Infrastructure</p>
														<p className="text-[11px] leading-relaxed text-[#595c5e]">
															Your data is stored using AES-256 encryption. We never share your commercial details with third-party brokers.
														</p>
													</div>
												</div>

												<div className="mt-10 space-y-5 border-t border-[#abadaf]/20 pt-6">
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
																href="https://beamio.app/terms"
																target="_blank"
																rel="noopener noreferrer"
															>
																the Beamio terms of service and smart contract deployment agreement
															</a>
															. I understand this initiates a non-custodial environment.
														</p>
													</label>
												</div>

												<button
													type="button"
													disabled={!onboardingCoverMobileCanSubmitRegistration || !coverTermsAccepted}
													className={`
														mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] px-8 py-5 text-base font-bold text-white
														shadow-[0_20px_40px_rgba(21,98,240,0.15)] transition-all hover:shadow-[0_20px_40px_rgba(21,98,240,0.25)] active:scale-[0.98]
														disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
														${bizBrandFocusRingClass}
													`}
													onClick={() => {
														if (!onboardingCoverMobileCanSubmitRegistration || !coverTermsAccepted) return
														setCoverBusinessType('solo')
														saveSessionOnboardingBusinessDraft({
															businessType: 'solo',
															onboardingTermsAccepted: coverTermsAccepted,
															storeName: detailBusinessName,
															category: detailCategory,
															country: detailCountry,
															city: detailCity,
															province: detailProvince,
														})
														onboardingCoverContinue(true)
													}}
												>
													Continue
													<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
												</button>
											</div>
										</section>
								</>
							</div>
						</>
					)}
				</div>

				{/* —— Desktop: 原有双栏 —— */}
				<section className="hidden w-full flex-col justify-center bg-[#eef1f3] p-5 md:flex md:w-[40%] md:p-10 lg:p-12">
					<div className="mx-auto w-full max-w-md md:mx-0">
						<div className="mb-6 flex items-center gap-0 md:mb-8">
							<IpfsImg src={BIZ_PUBLIC_LOGO512} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
							<div className="text-2xl font-black tracking-tighter text-[#1562f0]" style={headlineFont}>
								Beamio Business
							</div>
						</div>
						<h1
							className="mb-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-[#2c2f31] md:text-4xl lg:text-5xl"
							style={headlineFont}
						>
							Set up your business for <span className="text-[#1562f0]">live commerce.</span>
						</h1>
						<p className="mb-6 text-base leading-relaxed text-[#595c5e] md:mb-8 md:text-lg">
							Create your Beamio Business workspace to issue membership cards, manage customer balance, and run branded payments in one
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

				<section className="hidden w-full flex-col justify-center bg-white p-5 md:flex md:w-[60%] md:p-10 lg:p-14">
					<div className="mx-auto w-full max-w-xl md:mx-0">
						<div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-[#1562f0]/10 bg-[#1562f0]/5 p-5 md:mb-8 md:flex-row md:items-center md:p-6">
							<div>
								<h3 className="font-bold text-[#2c2f31]">Returning user?</h3>
								<p className="mt-1 text-sm text-[#595c5e]">Access your existing business nodes.</p>
							</div>
							<button
								type="button"
								onClick={() => setShowBizLogin(true)}
								className={`
									inline-flex items-center justify-center gap-2 rounded-full border border-[#1562f0]/20 bg-white px-6 py-3 text-sm font-bold text-[#1562f0]
									shadow-sm transition-all hover:bg-[#1562f0]/5 hover:shadow-md active:scale-[0.98]
									${bizBrandFocusRingClass}
								`}
							>
								Restore Account
								<ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
							</button>
						</div>

						<header className="mb-6 md:mb-8">
							<h2 className="mb-2 text-2xl font-bold text-[#2c2f31] md:text-[1.75rem]" style={headlineFont}>
								Select your business type
							</h2>
							<p className="leading-relaxed text-[#595c5e]">
								Choose your organization structure. We&apos;ll tailor your workspace and network settings accordingly.
							</p>
						</header>

						<div className="space-y-4">
							{coverBusinessTypeChoices.map(({ id, title, desc, Icon }) => (
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
										href="https://beamio.app/terms"
										target="_blank"
										rel="noopener noreferrer"
									>
										the Beamio terms of service and smart contract deployment agreement
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
								onClick={() => onboardingCoverContinue(false)}
							>
								Continue
								<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
							</button>
						</div>
					</div>
				</section>
			</main>

			<footer className="mt-auto hidden flex-col items-center justify-between gap-4 border-t border-[#abadaf]/10 bg-[#eef1f3] px-5 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#595c5e] md:flex md:flex-row md:px-10">
				<div className="text-center tracking-[0.2em] md:text-left">Securely hosted by Beamio Infrastructure © 2026</div>
				<div className="flex flex-wrap justify-center gap-8 text-[11px] font-bold tracking-widest">
					<a className="transition-colors hover:text-[#1562f0]" href="https://beamio.app/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="transition-colors hover:text-[#1562f0]" href="https://beamio.app/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="transition-colors hover:text-[#1562f0]" href="mailto:support@beamio.app?subject=Beamio%20Business%20help">
						Help Center
					</a>
				</div>
			</footer>
		</div>
	)

	/** Identity（Create handle + password）：必须是 JSX 片段，不能写内部 `const X = () => …`；否则父级每次 setState 都会换组件类型，BusinessIdentityForm 重挂载、输入被清空（手机键盘/视口常触发重渲染）。 */
	const initialEntryScreen = (
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
				<IpfsImg
					src={BIZ_PUBLIC_LOGO512}
					alt=""
					className="h-8 w-8 shrink-0 rounded-lg object-contain"
				/>
				<span className="text-xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
					Beamio Business
				</span>
			</header>

			<main className="relative z-10 flex min-h-0 flex-1 flex-grow items-center justify-center px-4 py-8">
				<div className="w-full max-w-md">
					<div className="mb-6 text-center lg:text-left">
						<h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[#121212] sm:text-3xl" style={headlineFont}>
							Create your business identity
						</h2>
						<p className="leading-relaxed text-[#666666]">
							Choose your Beamio handle and set the password that protects your business workspace.
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
						recoveryDraft={{
							businessType: coverBusinessType,
							onboardingTermsAccepted: coverTermsAccepted,
							storeName: detailBusinessName,
							category: detailCategory,
							country: detailCountry,
							city: detailCity,
							province: detailProvince,
						}}
						isRedeemFlow={!!redeemFromUrl}
						showIntroHeader={false}
						onWorkspaceCreatingChange={setWorkspaceCreating}
						onSuccess={(qr: BusinessIdentitySuccess) => {
							setQrDataUrl(qr.qrDataUrl)
							setRecoveryCode(qr.passcode)
							setBeamioTag(qr.beamioTag ?? '')
							setTemp(qr.temp)
							const createEoa = qr.temp?.profiles?.[0]?.keyID?.trim()
							if (createEoa && ethers.isAddress(createEoa)) {
								setLiteBusinessChainAck(ethers.getAddress(createEoa))
							}
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
					/>
				</div>
			</main>

			<footer className="mx-auto mt-auto flex w-full max-w-screen-xl flex-col items-center justify-between gap-4 border-t border-transparent px-5 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]/50 md:flex-row lg:px-8">
				<div className="flex items-center gap-2 text-center md:text-left">
					<Cloud className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
					<span>Securely hosted by Beamio Infrastructure © 2026</span>
				</div>
				<div className="flex flex-wrap justify-center gap-8 md:gap-8">
					<a className="transition-colors hover:text-[#1562F0]" href="https://beamio.app/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="https://beamio.app/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="mailto:support@beamio.app?subject=Beamio%20Business%20help">
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

	if (showBizLogin) {
		return <BizHome />
	}

	
	// 首次进入（无钱包）：Select Type → Details（单列）→ Identity（Create/Restore）
	if (isInitialEntry && !settingsOpen && showOnboardingCover) {
		return wrapWithWorkspaceCreatingOverlay(onboardingCoverScreen)
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
		return wrapWithWorkspaceCreatingOverlay(initialEntryScreen)
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
												const hadLocalWallet = Boolean(await checkStorage())
												const recoveredDraft = (temp as { recoveredBusinessDraft?: unknown }).recoveredBusinessDraft
												const recoveredEoa = temp?.profiles?.[0]?.keyID?.trim()
												const hasLocalBusinessDraft =
													recoveredEoa && ethers.isAddress(recoveredEoa)
														? Boolean(loadBusinessProfileDraftForEoa(ethers.getAddress(recoveredEoa)))
														: false
												const recoverPatch = pickVerraBusinessFieldsFromRecover(recoveredDraft)
												if (
													!hadLocalWallet &&
													!hasLocalBusinessDraft &&
													Object.keys(recoverPatch).length > 0
												) {
													saveSessionOnboardingBusinessDraft(recoverPatch as Partial<VerraBusinessProfileDraft>)
												}
												await init(temp)
												const eoaAfter = temp?.profiles?.[0]?.keyID?.trim()
												if (eoaAfter && ethers.isAddress(eoaAfter)) {
													const norm = ethers.getAddress(eoaAfter)
													if (Object.keys(recoverPatch).length > 0) {
														patchBusinessProfileDraftForEoa(norm, recoverPatch)
													}
													if (hasVerraLiteBusinessRequiredFields(loadBusinessProfileDraftForEoa(norm))) {
														setLiteBusinessChainAck(norm)
													} else {
														clearLiteBusinessChainAck(norm)
													}
												}
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
