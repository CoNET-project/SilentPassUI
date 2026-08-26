import React, { useEffect, useState, useRef } from "react";
import { IpfsImg } from '@/components/IpfsImg';
import beamio_icon from '@/components/assets/32x32.svg'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Check, Loader, ArrowRight, ArrowLeft, AlertTriangle, X, Cloud, History, Smartphone } from "lucide-react"
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
import { checkStorageWithTimeout, restoreWithRedeem, fetchUserInfoWithRetry, flushStoreSystemData } from "@/services/beamio"
import { ensureConetAaForProfileAndPersist } from "@/utils/ensureConetAa"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BusinessIdentityForm, { type BusinessIdentitySuccess } from './BusinessIdentityForm'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import BizHome from './bizHome'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { OnboardingBusinessDetailsScreen } from '@/pages/Home/OnboardingBusinessDetailsScreen'
import {
	OnboardingBusinessDiscoveryForm,
	businessTypeToOrgType,
	orgTypeToBusinessType,
	type OrgTypeSelect,
} from '@/pages/Home/OnboardingBusinessDiscoveryForm'
import { MerchantLegalDocumentOverlay } from '@/pages/Vouchers/example/MerchantLegalDocumentOverlay'
import type { BeamioLegalDocId } from '@/utils/beamioLegalDocuments'
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
	type VerraBusinessChannelKind,
	type VerraBusinessProfileDraft,
} from '@/utils/verraBusinessProfileLocal'
import type { VerraBusinessProfileBusinessType } from '@/utils/verraBusinessProfileLocal'
import {
	isWorkspaceScreenLocked,
	markWorkspaceSessionUnlocked,
} from '@/utils/beamioWorkspaceLock'
import { hasSessionPrivateKeyArmor, ingestSessionPrivateKeyFromProfiles, hydrateProfilesWithSessionSecrets } from '@/utils/beamioSessionSecrets'
import { useTu } from '@/locale/beamioLocale'
import WorkspaceCreatingOverlay from '@/pages/Home/WorkspaceCreatingOverlay'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'

const APP_VERSION = (packageJson as { version?: string }).version ?? ''

/** Onboarding business details：无草稿时默认国家（Canada） */
const DEFAULT_ONBOARDING_DETAIL_COUNTRY = "CA"

type OnboardingCoverMobilePhase = 'entry' | 'businessForm'

function parseDraftChannelKind(raw: unknown): VerraBusinessChannelKind | '' {
	return raw === 'physical' || raw === 'digital' || raw === 'app' ? raw : ''
}
const ISSUED_NFT_START_ID = 100_000_000_000

function ensureFlatProfiles(p: unknown): profile[] {
	if (!p || !Array.isArray(p)) return []
	if (p.length === 0) return []
	const first = (p as unknown[])[0]
	if (Array.isArray(first)) return (p as profile[][]).flat()
	return p as profile[]
}

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
	/** Home gate already read local storage (incl. timeout fallback) — avoid a second IndexedDB hang in Safari Private. */
	bootResolved?: boolean
	bootCoNETData?: encrypt_keys_object | null
}

export default function BeamioOnboardingModal({
	home,
	onInitComplete,
	bootResolved = false,
	bootCoNETData = null,
}: Props) {
	const { tu } = useTu()
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
	const [onboardingLegalDocId, setOnboardingLegalDocId] = useState<BeamioLegalDocId | null>(null)
	/** Mobile: entry → Lite 登记页（Continue 即 solo + 进入 Identity，无 Select business type） */
	const [onboardingCoverMobilePhase, setOnboardingCoverMobilePhase] = useState<OnboardingCoverMobilePhase>('entry')
	/** Select Type → Details（单列业务资料）→ Identity（InitialEntryScreen） */
	const [showOnboardingBusinessDetails, setShowOnboardingBusinessDetails] = useState(false)
	const [detailBusinessName, setDetailBusinessName] = useState(
		() => loadSessionOnboardingBusinessDraft()?.storeName ?? ''
	)
	const [detailChannelKind, setDetailChannelKind] = useState<VerraBusinessChannelKind | ''>(() =>
		parseDraftChannelKind(loadSessionOnboardingBusinessDraft()?.channelKind),
	)
	const [detailOrgType, setDetailOrgType] = useState<OrgTypeSelect>(() =>
		businessTypeToOrgType(loadSessionOnboardingBusinessDraft()?.businessType),
	)
	const [detailCategory, setDetailCategory] = useState(
		() => loadSessionOnboardingBusinessDraft()?.category?.trim() ?? '',
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
		setShowFooter?.(!workspaceCreating)
		return () => setShowFooter?.(true)
	}, [workspaceCreating, setShowFooter])

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
			channelKind: detailChannelKind || undefined,
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
		detailChannelKind,
	])


	const init = async (
		temp?: encrypt_keys_object,
		opts?: { dontClose?: boolean; accountName?: string },
	) => {

		if (isWorkspaceScreenLocked()) {
			onInitComplete?.()
			if (typeof window !== 'undefined') window.location.href = '/'
			return
		}

		// Prefer gate snapshot; otherwise bounded read (Safari Private IndexedDB may hang forever).
		const isAcc = bootResolved
			? bootCoNETData
			: await checkStorageWithTimeout()
		temp = temp || isAcc || undefined

		if (!temp?.profiles?.length) {
			clearSessionOnboardingBusinessDraft()
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			setShowOnboardingCover(true)
			setShowOnboardingBusinessDetails(false)
			setCoverBusinessType("solo")
			setCoverTermsAccepted(false)
			setOnboardingCoverMobilePhase('entry')
			setDetailBusinessName("")
			setDetailChannelKind('')
			setDetailOrgType('')
			setDetailCategory('')
			setDetailCountry(DEFAULT_ONBOARDING_DETAIL_COUNTRY)
			setDetailCity("")
			setDetailProvince("")
			setWorkspaceCreating(false)
			onInitComplete?.()
			return
		}

		const profiles = ensureFlatProfiles(temp.profiles)
		ingestSessionPrivateKeyFromProfiles(profiles)
		setProfiles(hydrateProfilesWithSessionSecrets(profiles))

		const accountNameHint =
			opts?.accountName?.trim() ||
			temp.beamio?.accountName?.trim() ||
			''

		const userInfo = await fetchUserInfoWithRetry(profiles[0].keyID, {
			accountNameFallback: accountNameHint,
		})
		if (!userInfo) {
			onInitComplete?.()
			return
		}

		if (!hasSessionPrivateKeyArmor()) {
			onInitComplete?.()
			setShowBizLogin(true)
			return
		}
		
		const bo: beamio = userInfo

		SetLoading(true)
		void initChat(setProfiles, setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})
		
		bo.initialLoading = false
		
		
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await flushStoreSystemData()
		try {
			await ensureConetAaForProfileAndPersist(profiles[0], setProfiles)
		} catch {
			/* 不可信失败：保留 profile，Daemon 会重试 */
		}
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

	const mobileCoverMeshStyle: React.CSSProperties = {
		backgroundImage: [
			"radial-gradient(at 0% 0%, #f5f7f9 0%, transparent 50%)",
			"radial-gradient(at 100% 0%, #eef1f3 0%, transparent 50%)",
			"radial-gradient(at 100% 100%, #d8e3fb 0%, transparent 50%)",
			"radial-gradient(at 0% 100%, #f5f7f9 0%, transparent 50%)",
		].join(", "),
	}

	const openOnboardingLegalDoc = (docId: BeamioLegalDocId) => (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setOnboardingLegalDocId(docId)
	}

	const setDetailOrgTypeAndSync = (org: OrgTypeSelect) => {
		setDetailOrgType(org)
		const bt = orgTypeToBusinessType(org)
		if (bt) setCoverBusinessType(bt)
	}

	const discoveryFormSharedProps = {
		storeName: detailBusinessName,
		setStoreName: setDetailBusinessName,
		channelKind: detailChannelKind,
		setChannelKind: (v: VerraBusinessChannelKind) => setDetailChannelKind(v),
		category: detailCategory,
		setCategory: setDetailCategory,
		orgType: detailOrgType,
		setOrgType: setDetailOrgTypeAndSync,
		country: detailCountry,
		setCountry: setDetailCountry,
		city: detailCity,
		setCity: setDetailCity,
		province: detailProvince,
		setProvince: setDetailProvince,
		termsAccepted: coverTermsAccepted,
		setTermsAccepted: setCoverTermsAccepted,
		onOpenLegalDoc: openOnboardingLegalDoc,
	}

	const onboardingLegalFooterLinks = (
		<>
			<button
				type="button"
				className="transition-colors hover:text-[#1562f0]"
				onClick={() => setOnboardingLegalDocId('privacy')}
			>
				{tu('onb_privacy_policy')}
			</button>
			<button
				type="button"
				className="transition-colors hover:text-[#1562f0]"
				onClick={() => setOnboardingLegalDocId('terms')}
			>
				{tu('onb_terms_of_service')}
			</button>
		</>
	)

	/** Discovery 表单完成后跳过 OnboardingBusinessDetailsScreen，直达 Identity */
	const onboardingCoverContinue = (skipBusinessDetailsScreen: boolean, termsOverride?: boolean) => {
		const termsOk = termsOverride ?? coverTermsAccepted
		if (!termsOk) return
		setOnboardingCoverMobilePhase('entry')
		setShowOnboardingCover(false)
		setShowOnboardingBusinessDetails(!skipBusinessDetailsScreen)
	}

	const submitOnboardingDiscovery = () => {
		const bt = orgTypeToBusinessType(detailOrgType) ?? coverBusinessType
		setCoverBusinessType(bt)
		setCoverTermsAccepted(true)
		saveSessionOnboardingBusinessDraft({
			businessType: bt,
			onboardingTermsAccepted: true,
			storeName: detailBusinessName,
			category: detailCategory,
			country: detailCountry,
			city: detailCity,
			province: detailProvince,
			channelKind: detailChannelKind || undefined,
		})
		onboardingCoverContinue(true, true)
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
				className="hidden md:flex fixed top-0 left-0 right-0 z-50 max-w-full items-center justify-end gap-5 overflow-visible border-b border-[#abadaf]/10 bg-[#f5f7f9]/70 px-4 py-3 backdrop-blur-xl"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<div className="flex items-center gap-4 text-[10px] font-bold tracking-tight" style={headlineFont}>
					<span className="text-[#1562f0] border-b-2 border-[#1562f0] pb-0.5">{tu('onb_step_select_type')}</span>
					<span className="text-[#abadaf]">{tu('onb_step_details')}</span>
					<span className="text-[#abadaf]">{tu('onb_step_identity')}</span>
				</div>
				<BizOnboardingLocalePicker />
			</nav>

			{APP_VERSION && (
				<div className="pointer-events-none fixed left-4 z-[5] text-[11px] font-medium text-[#abadaf] md:left-6 top-[calc(env(safe-area-inset-top)+0.5rem)]">
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
								className="sticky top-0 z-50 flex w-full items-center justify-between gap-3 overflow-visible bg-[#f5f7f9]/70 px-6 py-6 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl"
								style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
							>
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0] shadow-md shadow-[#1562f0]/25">
										<Smartphone className="h-[18px] w-[18px] text-white" strokeWidth={2.25} aria-hidden />
									</div>
									<h1
										className="truncate text-xl font-extrabold leading-none tracking-tighter text-[#1562f0]"
										style={headlineFont}
									>
										{tu('onb_beamio_business_lite')}
									</h1>
								</div>
								<BizOnboardingLocalePicker />
							</header>

							<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-10 pt-8">
								<div className="mb-10 space-y-3">
									<span
										className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#1562f0]"
										style={headlineFont}
									>
										{tu('onb_lite_eyebrow')}
									</span>
									<h2
										className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[#2c2f31]"
										style={headlineFont}
									>
										{tu('onb_lite_hero_prefix')}{' '}
										<span className="text-[#1562f0]">
											{tu('onb_lite_hero_accent')}
											{tu('onb_lite_hero_suffix')}
										</span>
									</h2>
									<p className="text-base font-medium leading-relaxed text-[#595c5e]">
										{tu('onb_lite_hero_sub')}
									</p>
								</div>

								<div className="grid gap-4">
									<button
										type="button"
										onClick={() => setOnboardingCoverMobilePhase('businessForm')}
										className={`group relative w-full overflow-hidden rounded-2xl bg-white p-6 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_40px_rgba(21,98,240,0.12)] active:scale-[0.98] ${bizBrandFocusRingClass}`}
									>
										<div className="relative z-10">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1562f0] shadow-lg shadow-[#1562f0]/25">
												<Home className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
											</div>
											<h3 className="mb-2 text-xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
												{tu('onb_lite_new_setup_title')}
											</h3>
											<p className="mb-5 text-sm font-medium leading-relaxed text-[#595c5e]">
												{tu('onb_lite_new_setup_desc')}
											</p>
											<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#1562f0]">
												<span>{tu('onb_lite_get_started')}</span>
												<ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
											</div>
										</div>
									</button>

									<button
										type="button"
										onClick={() => setShowBizLogin(true)}
										className={`group relative w-full overflow-hidden rounded-2xl bg-white p-6 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)] active:scale-[0.98] ${bizBrandFocusRingClass}`}
									>
										<div className="relative z-10">
											<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8eaed]">
												<History className="h-6 w-6 text-[#747779]" strokeWidth={2} aria-hidden />
											</div>
											<h3 className="mb-2 text-xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
												{tu('onb_lite_restore_title')}
											</h3>
											<p className="mb-5 text-sm font-medium leading-relaxed text-[#595c5e]">
												{tu('onb_lite_restore_desc')}
											</p>
											<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#1562f0]">
												<span>{tu('onb_lite_restore_cta')}</span>
												<ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
											</div>
										</div>
									</button>
								</div>

								<div className="relative mt-12">
									<div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#050b1d]">
										<div
											className="absolute inset-0 opacity-90"
											aria-hidden
											style={{
												backgroundImage: [
													'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(34,211,238,0.22) 0%, transparent 55%)',
													'radial-gradient(circle at 22% 38%, rgba(251,146,60,0.55) 0 2px, transparent 3px)',
													'radial-gradient(circle at 48% 28%, rgba(34,211,238,0.7) 0 2.5px, transparent 3.5px)',
													'radial-gradient(circle at 72% 42%, rgba(251,146,60,0.5) 0 2px, transparent 3px)',
													'radial-gradient(circle at 35% 62%, rgba(34,211,238,0.55) 0 2px, transparent 3px)',
													'radial-gradient(circle at 62% 68%, rgba(251,146,60,0.45) 0 1.5px, transparent 2.5px)',
													'radial-gradient(circle at 80% 58%, rgba(34,211,238,0.45) 0 2px, transparent 3px)',
													'linear-gradient(135deg, rgba(21,98,240,0.12) 0%, transparent 40%, rgba(141,58,139,0.1) 100%)',
												].join(', '),
												backgroundColor: '#071126',
											}}
										/>
										<svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 400 250" fill="none" aria-hidden>
											<path d="M88 95 L192 70 L288 105 L248 170 L140 155 Z" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" />
											<path d="M192 70 L248 170" stroke="rgba(251,146,60,0.35)" strokeWidth="1" />
											<path d="M88 95 L140 155 L288 105" stroke="rgba(34,211,238,0.25)" strokeWidth="1" />
											<circle cx="88" cy="95" r="3.5" fill="#f97316" />
											<circle cx="192" cy="70" r="4" fill="#22d3ee" />
											<circle cx="288" cy="105" r="3.5" fill="#f97316" />
											<circle cx="248" cy="170" r="3" fill="#22d3ee" />
											<circle cx="140" cy="155" r="3" fill="#22d3ee" />
											<circle cx="320" cy="145" r="2.5" fill="#22d3ee" opacity="0.8" />
											<path d="M288 105 L320 145" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
										</svg>
									</div>
									<div className="absolute bottom-3 right-3 max-w-[190px] rounded-xl bg-white/95 px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.16)] backdrop-blur-sm">
										<p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1562f0]">{tu('onb_lite_secure_eyebrow')}</p>
										<p className="text-[11px] font-medium leading-snug text-[#595c5e]">
											{tu('onb_lite_secure_body')}
										</p>
									</div>
								</div>

								<p className="mx-auto mt-12 max-w-sm text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#abadaf]">
									{tu('onb_lite_footer')}
								</p>
							</div>
						</>
					) : (
						<>
							<header
								className="fixed top-0 left-0 right-0 z-50 flex w-full items-center gap-3 overflow-visible bg-[#f5f7f9]/70 px-6 py-4 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl"
								style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
							>
								<button
									type="button"
									onClick={() => setOnboardingCoverMobilePhase('entry')}
									className={`-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#1562f0] transition-opacity hover:opacity-80 active:scale-95 ${bizBrandFocusRingClass}`}
									aria-label={tu('onb_back')}
								>
									<ArrowLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden />
								</button>
								<span className="min-w-0 flex-1 truncate text-xl font-black tracking-tight text-[#1562f0]" style={headlineFont}>
									{tu('onb_beamio_business_lite')}
								</span>
								<BizOnboardingLocalePicker />
							</header>

							<div className="flex-1 overflow-y-auto overflow-x-hidden pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(11rem+env(safe-area-inset-bottom))]">
								<div className="mx-auto w-full max-w-2xl px-5 pt-6">
									<div className="mb-2 rounded-xl border border-[#c3c6d8]/60 bg-[#eeedf3]/80 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
										<p className="text-sm text-[#424655]">
											<span className="font-semibold text-[#2c2f31]">{tu('onb_returning_title')}</span>{' '}
											{tu('onb_returning_sub')}
										</p>
										<button
											type="button"
											onClick={() => setShowBizLogin(true)}
											className={`mt-3 inline-flex shrink-0 items-center justify-center rounded-full border border-[#1562f0]/40 bg-white px-4 py-2 text-sm font-bold text-[#1562f0] transition hover:bg-[#1562f0]/5 sm:mt-0 ${bizBrandFocusRingClass}`}
										>
											{tu('onb_restore_account')}
											<span className="ml-1" aria-hidden>
												→
											</span>
										</button>
									</div>
									<OnboardingBusinessDiscoveryForm
										{...discoveryFormSharedProps}
										layout="sheet"
										idPrefix="onb-mobile"
										onSubmit={submitOnboardingDiscovery}
									/>
								</div>
							</div>
						</>
					)}
				</div>

				{/* —— Desktop: left splash (Beamio OS) —— */}
				<section className="hidden w-full flex-col justify-center bg-[#f5f7f9] p-5 md:flex md:w-[40%] md:p-10 lg:p-12">
					<div className="mx-auto w-full max-w-md md:mx-0">
						<div className="mb-8 flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] shadow-md shadow-[#1562f0]/25">
								<Smartphone className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
							</div>
							<div className="text-2xl font-extrabold tracking-tighter text-[#1562f0]" style={headlineFont}>
								{tu('onb_beamio_business_lite')}
							</div>
						</div>
						<span
							className="mb-3 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#1562f0]"
							style={headlineFont}
						>
							{tu('onb_lite_eyebrow')}
						</span>
						<h1
							className="mb-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#2c2f31] md:text-4xl lg:text-[2.75rem]"
							style={headlineFont}
						>
							{tu('onb_lite_hero_prefix')}{' '}
							<span className="text-[#1562f0]">
								{tu('onb_lite_hero_accent')}
								{tu('onb_lite_hero_suffix')}
							</span>
						</h1>
						<p className="mb-10 text-base font-medium leading-relaxed text-[#595c5e] md:text-lg">
							{tu('onb_lite_hero_sub')}
						</p>
						<div className="relative">
							<div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#050b1d]">
								<div
									className="absolute inset-0 opacity-90"
									aria-hidden
									style={{
										backgroundImage: [
											'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(34,211,238,0.22) 0%, transparent 55%)',
											'radial-gradient(circle at 22% 38%, rgba(251,146,60,0.55) 0 2px, transparent 3px)',
											'radial-gradient(circle at 48% 28%, rgba(34,211,238,0.7) 0 2.5px, transparent 3.5px)',
											'radial-gradient(circle at 72% 42%, rgba(251,146,60,0.5) 0 2px, transparent 3px)',
											'radial-gradient(circle at 35% 62%, rgba(34,211,238,0.55) 0 2px, transparent 3px)',
											'radial-gradient(circle at 62% 68%, rgba(251,146,60,0.45) 0 1.5px, transparent 2.5px)',
											'radial-gradient(circle at 80% 58%, rgba(34,211,238,0.45) 0 2px, transparent 3px)',
											'linear-gradient(135deg, rgba(21,98,240,0.12) 0%, transparent 40%, rgba(141,58,139,0.1) 100%)',
										].join(', '),
										backgroundColor: '#071126',
									}}
								/>
								<svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 400 250" fill="none" aria-hidden>
									<path d="M88 95 L192 70 L288 105 L248 170 L140 155 Z" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" />
									<path d="M192 70 L248 170" stroke="rgba(251,146,60,0.35)" strokeWidth="1" />
									<path d="M88 95 L140 155 L288 105" stroke="rgba(34,211,238,0.25)" strokeWidth="1" />
									<circle cx="88" cy="95" r="3.5" fill="#f97316" />
									<circle cx="192" cy="70" r="4" fill="#22d3ee" />
									<circle cx="288" cy="105" r="3.5" fill="#f97316" />
									<circle cx="248" cy="170" r="3" fill="#22d3ee" />
									<circle cx="140" cy="155" r="3" fill="#22d3ee" />
									<circle cx="320" cy="145" r="2.5" fill="#22d3ee" opacity="0.8" />
									<path d="M288 105 L320 145" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
								</svg>
							</div>
							<div className="absolute bottom-3 right-3 max-w-[200px] rounded-xl bg-white/95 px-3.5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.16)] backdrop-blur-sm">
								<p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1562f0]">{tu('onb_lite_secure_eyebrow')}</p>
								<p className="text-[11px] font-medium leading-snug text-[#595c5e]">{tu('onb_lite_secure_body')}</p>
							</div>
						</div>
						<p className="mt-10 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#abadaf] md:text-left">
							{tu('onb_lite_footer')}
						</p>
					</div>
				</section>

				<section className="hidden w-full flex-col justify-center bg-white p-5 md:flex md:w-[60%] md:p-10 lg:p-14">
					<div className="mx-auto w-full max-w-xl md:mx-0">
						<div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-[#1562f0]/10 bg-[#1562f0]/5 p-5 md:mb-8 md:flex-row md:items-center md:p-6">
							<div>
								<h3 className="font-bold text-[#2c2f31]">{tu('onb_returning_title')}</h3>
								<p className="mt-1 text-sm text-[#595c5e]">{tu('onb_returning_sub')}</p>
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
								{tu('onb_restore_account')}
								<ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
							</button>
						</div>

						<OnboardingBusinessDiscoveryForm
							{...discoveryFormSharedProps}
							layout="embedded"
							idPrefix="onb-desktop"
							onSubmit={submitOnboardingDiscovery}
						/>
					</div>
				</section>
			</main>

			<footer className="mt-auto hidden flex-col items-center justify-between gap-4 border-t border-[#abadaf]/10 bg-[#eef1f3] px-5 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#595c5e] md:flex md:flex-row md:px-10">
				<div className="text-center tracking-[0.2em] md:text-left">{tu('onb_footer_hosted')}</div>
				<div className="flex flex-wrap justify-center gap-8 text-[11px] font-bold tracking-widest">
					{onboardingLegalFooterLinks}
					<a className="transition-colors hover:text-[#1562f0]" href="mailto:support@beamio.app?subject=Beamio%20Business%20help">
						{tu('onb_help_center')}
					</a>
				</div>
			</footer>
			<MerchantLegalDocumentOverlay
				open={onboardingLegalDocId != null}
				docId={onboardingLegalDocId ?? 'privacy'}
				onClose={() => setOnboardingLegalDocId(null)}
			/>
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
				<div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.5rem)] left-6 z-[5] text-[11px] font-medium text-[#abadaf] lg:left-8">
					v{APP_VERSION}
				</div>
			)}

			<header className="relative z-30 flex shrink-0 items-center justify-between gap-3 overflow-visible px-5 pt-5 lg:px-8">
				<div className="flex items-center justify-center gap-0 lg:justify-start">
					<IpfsImg
						src={BIZ_PUBLIC_LOGO512}
						alt=""
						className="h-8 w-8 shrink-0 rounded-lg object-contain"
					/>
					<span className="text-xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
						{tu('onb_beamio_business')}
					</span>
				</div>
				<BizOnboardingLocalePicker />
			</header>

			<main className="relative z-0 flex min-h-0 flex-1 flex-grow items-start justify-center px-4 pb-8 pt-6 sm:pt-10">
				<div className="w-full max-w-md">
					<div className="mb-6 text-center lg:text-left">
						<h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[#121212] sm:text-3xl" style={headlineFont}>
							{tu('onb_identity_title')}
						</h2>
						<p className="leading-relaxed text-[#666666]">
							{tu('onb_identity_sub')}
						</p>
					</div>

					{isStandalone && (
						<div className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50 p-4">
							<p className="text-[13px] font-medium leading-snug text-amber-900">
								{tu('onb_identity_standalone_hint_prefix')}
								<strong>{tu('restore_wallet')}</strong>
								{tu('onb_identity_standalone_hint_suffix')}
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
							channelKind: detailChannelKind || undefined,
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
							setWorkspaceCreating(true)
							setSettingsOpen('RecoveryQRScreen')
							// Recovery 挂载后再撤遮罩。Safari Private 可能永不触发 rAF，只用 setTimeout。
							window.setTimeout(() => setWorkspaceCreating(false), 340)
						}}
					/>
				</div>
			</main>

			<footer className="mx-auto mt-auto flex w-full max-w-screen-xl flex-col items-center justify-between gap-4 border-t border-transparent px-5 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]/50 md:flex-row lg:px-8">
				<div className="flex items-center gap-2 text-center md:text-left">
					<Cloud className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
					<span>{tu('onb_footer_hosted')}</span>
				</div>
				<div className="flex flex-wrap justify-center gap-8 md:gap-8">
					{onboardingLegalFooterLinks}
					<a className="transition-colors hover:text-[#1562F0]" href="mailto:support@beamio.app?subject=Beamio%20Business%20help">
						{tu('onb_help_center')}
					</a>
				</div>
			</footer>
			{workspaceCreating ? <WorkspaceCreatingOverlay /> : null}
			<MerchantLegalDocumentOverlay
				open={onboardingLegalDocId != null}
				docId={onboardingLegalDocId ?? 'privacy'}
				onClose={() => setOnboardingLegalDocId(null)}
			/>
		</div>
	)

	if (showBizLogin) {
		return <BizHome />
	}

	
	// 首次进入（无钱包）：Select Type → Details（单列）→ Identity（Create/Restore）
	if (isInitialEntry && !settingsOpen && showOnboardingCover) {
		return onboardingCoverScreen
	}

	if (isInitialEntry && !settingsOpen && showOnboardingBusinessDetails) {
		return (
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
			/>
		)
	}

	if (isInitialEntry && !settingsOpen) {
		return initialEntryScreen
	}

	return (
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
										try {
											await flushStoreSystemData()
											await init(temp, { dontClose: true, accountName: beamioTag })
											const profileAfterInit = temp?.profiles?.[0]
											if (profileAfterInit?.keyID && ethers.isAddress(profileAfterInit.keyID)) {
												try {
													await ensureConetAaForProfileAndPersist(profileAfterInit, setProfiles)
												} catch {
													/* 不可信失败：不阻断进入 Merchant OS */
												}
											}
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
											setSettingsOpen('')
											home()
										} finally {
											setWorkspaceCreating(false)
										}
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
												const hadLocalWallet = Boolean(await checkStorageWithTimeout())
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
			{workspaceCreating ? <WorkspaceCreatingOverlay /> : null}

		</div>
	)
}
