import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Home, Loader2 } from 'lucide-react'
import { ethers } from 'ethers'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useUnlockMerchantWorkspaceDeps } from '@/hooks/useUnlockMerchantWorkspaceDeps'
import { returnToAgentWorkspace } from '@/utils/agentTempEoaOps'
import { getCoNET_Data } from '@/utils/globals'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import {
	OnboardingBusinessDiscoveryForm,
	businessTypeToOrgType,
	orgTypeToBusinessType,
	type OrgTypeSelect,
} from '@/pages/Home/OnboardingBusinessDiscoveryForm'
import { seedOnboardingFormFromCandidate } from '@/pages/Home/OnboardingFromWebsiteScreen'
import {
	clearOnboardingWebCandidate,
	fetchOnboardingCardSetupAssets,
	type OnboardingBusinessLookupCandidate,
} from '@/utils/onboardingBusinessLookup'
import {
	applyOnboardingCardSetupAssetsToEoa,
	clearOnboardingCardSetupAssets,
	dispatchOnboardingCardSetupReady,
	loadOnboardingCardSetupAssets,
	persistOnboardingCardSetupAssets,
	pickEmptyOnly,
	type OnboardingCardSetupAssets,
} from '@/utils/onboardingCardSetupAssetsLocal'
import { MerchantLegalDocumentOverlay } from '@/pages/Vouchers/example/MerchantLegalDocumentOverlay'
import type { BeamioLegalDocId } from '@/utils/beamioLegalDocuments'
import {
	hasVerraLiteBusinessRequiredFields,
	loadBusinessProfileDraftForEoa,
	loadSessionOnboardingBusinessDraft,
	mergeSessionOnboardingDraftIntoEoa,
	normalizeVerraBusinessChannelKind,
	patchBusinessProfileDraftForEoa,
	saveSessionOnboardingBusinessDraft,
	type VerraBusinessChannelKind,
	type VerraBusinessProfileBusinessType,
} from '@/utils/verraBusinessProfileLocal'
import { useTu } from '@/locale/beamioLocale'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import packageJson from '../../../package.json'

const APP_VERSION = (packageJson as { version?: string }).version ?? ''
const DEFAULT_ONBOARDING_DETAIL_COUNTRY = ''

type Phase = 'entry' | 'businessForm'

const headlineFont = {
	fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const

function parseDraftChannelKind(raw: unknown): VerraBusinessChannelKind | '' {
	return normalizeVerraBusinessChannelKind(raw) ?? ''
}

function currentTempEoa(): string {
	const key = String(getCoNET_Data()?.profiles?.[0]?.keyID ?? '').trim()
	return ethers.isAddress(key) ? ethers.getAddress(key) : ''
}

/**
 * Agent temp-EOA path: business discovery (AI lookup or manual) before Merchant OS
 * Fuel Packages / create card. Wallet is already unlocked via openTempMerchantWorkspace.
 */
export default function AgentMerchantOnboardingPage() {
	const navigate = useNavigate()
	const { setShowFooter } = useDaemonContext()
	const unlockDeps = useUnlockMerchantWorkspaceDeps()
	const { tu } = useTu()

	const [phase, setPhase] = useState<Phase>('entry')
	const [returningToAgent, setReturningToAgent] = useState(false)
	const [returnError, setReturnError] = useState('')
	const [returnPassword, setReturnPassword] = useState('')
	const [needReturnPassword, setNeedReturnPassword] = useState(false)
	const [legalDocId, setLegalDocId] = useState<BeamioLegalDocId | null>(null)

	const [detailBusinessName, setDetailBusinessName] = useState('')
	const [detailChannelKind, setDetailChannelKind] = useState<VerraBusinessChannelKind | ''>('')
	const [detailCategory, setDetailCategory] = useState('')
	const [detailOrgType, setDetailOrgType] = useState<OrgTypeSelect>('')
	const [detailCountry, setDetailCountry] = useState(DEFAULT_ONBOARDING_DETAIL_COUNTRY)
	const [detailCity, setDetailCity] = useState('')
	const [detailProvince, setDetailProvince] = useState('')
	const [detailWebsite, setDetailWebsite] = useState('')
	const [detailPublicBio, setDetailPublicBio] = useState('')
	const [coverBusinessType, setCoverBusinessType] = useState<VerraBusinessProfileBusinessType | ''>('')
	const [coverTermsAccepted, setCoverTermsAccepted] = useState(false)
	const [coverDetailsUnlocked, setCoverDetailsUnlocked] = useState(false)
	const [lookupSkipName, setLookupSkipName] = useState('')
	const [cardSetupPreparing, setCardSetupPreparing] = useState(false)
	const [cardSetupPrepareError, setCardSetupPrepareError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const cardSetupGenRef = useRef(0)
	const eoaRef = useRef('')

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		const eoa = currentTempEoa()
		eoaRef.current = eoa
		if (!eoa) {
			navigate('/agent', { replace: true })
			return
		}
		const sess = loadSessionOnboardingBusinessDraft()
		const local = loadBusinessProfileDraftForEoa(eoa)
		const src = sess && Object.keys(sess).length ? sess : local
		if (!src) return
		if (typeof src.storeName === 'string' && src.storeName.trim()) setDetailBusinessName(src.storeName.trim())
		const ch = parseDraftChannelKind(src.channelKind)
		if (ch) setDetailChannelKind(ch)
		if (typeof src.category === 'string') setDetailCategory(src.category)
		const org = businessTypeToOrgType(src.businessType)
		if (org) {
			setDetailOrgType(org)
			const bt = orgTypeToBusinessType(org)
			if (bt) setCoverBusinessType(bt)
		}
		if (typeof src.country === 'string' && src.country.trim()) setDetailCountry(src.country.trim())
		if (typeof src.city === 'string') setDetailCity(src.city)
		if (typeof src.province === 'string') setDetailProvince(src.province)
		if (typeof src.website === 'string') setDetailWebsite(src.website)
		if (typeof src.publicBio === 'string') setDetailPublicBio(src.publicBio)
		if (src.onboardingTermsAccepted) setCoverTermsAccepted(true)
		if (src.coverDetailsUnlocked === true || hasVerraLiteBusinessRequiredFields(src)) {
			setCoverDetailsUnlocked(true)
			if (src.storeName?.trim()) setLookupSkipName(src.storeName.trim())
		}
	}, [navigate])

	const openLegalDoc = (docId: BeamioLegalDocId) => (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setLegalDocId(docId)
	}

	const setDetailOrgTypeAndSync = (org: OrgTypeSelect) => {
		setDetailOrgType(org)
		const bt = orgTypeToBusinessType(org)
		if (bt) setCoverBusinessType(bt)
	}

	const commitPreparedCardSetupAssets = (assets: OnboardingCardSetupAssets) => {
		persistOnboardingCardSetupAssets(assets)
		const sess = loadSessionOnboardingBusinessDraft() ?? {}
		saveSessionOnboardingBusinessDraft({
			logoUrl: pickEmptyOnly(sess.logoUrl ?? '', assets.logoUrl),
			merchantImageUrl: pickEmptyOnly(sess.merchantImageUrl ?? '', assets.backgroundUrl),
			brandHex: pickEmptyOnly(sess.brandHex ?? '', assets.brandColor),
			publicBio: pickEmptyOnly(sess.publicBio ?? '', assets.discoverCopy),
		})
		const eoa = eoaRef.current
		if (eoa) applyOnboardingCardSetupAssetsToEoa(eoa, assets)
		dispatchOnboardingCardSetupReady()
	}

	const collapseCoverDetails = () => {
		cardSetupGenRef.current += 1
		setCardSetupPreparing(false)
		setCardSetupPrepareError('')
		clearOnboardingCardSetupAssets()
		setLookupSkipName('')
		setCoverDetailsUnlocked(false)
		setDetailChannelKind('')
		setDetailOrgType('')
		setDetailCategory('')
		setDetailCountry(DEFAULT_ONBOARDING_DETAIL_COUNTRY)
		setDetailCity('')
		setDetailProvince('')
		setDetailWebsite('')
		setDetailPublicBio('')
		setCoverTermsAccepted(false)
		saveSessionOnboardingBusinessDraft({
			coverDetailsUnlocked: false,
			streetAddress: '',
			postalCode: '',
			supportEmail: '',
			supportPhone: '',
		})
	}

	const discoveryFormSharedProps = {
		storeName: detailBusinessName,
		setStoreName: (v: string) => {
			setLookupSkipName('')
			setDetailBusinessName(v)
			if (!v.trim()) collapseCoverDetails()
		},
		channelKind: detailChannelKind,
		setChannelKind: (v: VerraBusinessChannelKind) => setDetailChannelKind(v),
		category: detailCategory,
		setCategory: setDetailCategory,
		orgType: detailOrgType,
		setOrgType: setDetailOrgTypeAndSync,
		country: detailCountry,
		setCountry: (v: string) => {
			if (!v.trim()) return
			setDetailCountry(v)
		},
		city: detailCity,
		setCity: setDetailCity,
		province: detailProvince,
		setProvince: setDetailProvince,
		termsAccepted: coverTermsAccepted,
		setTermsAccepted: setCoverTermsAccepted,
		onOpenLegalDoc: openLegalDoc,
		detailsVisible: coverDetailsUnlocked,
		onShowDetailsManually: () => {
			setCoverDetailsUnlocked((open) => {
				const next = !open
				saveSessionOnboardingBusinessDraft({ coverDetailsUnlocked: next })
				return next
			})
		},
		lookupSkipValue: lookupSkipName,
		cardSetupPreparing,
		cardSetupPrepareError,
		onSelectLookupCandidate: (candidate: OnboardingBusinessLookupCandidate) => {
			const seeded = seedOnboardingFormFromCandidate(candidate, detailBusinessName)
			setLookupSkipName(seeded.storeName.trim())
			setDetailBusinessName(seeded.storeName)
			setDetailChannelKind(seeded.channelKind)
			setDetailCategory(seeded.category)
			setDetailOrgTypeAndSync(seeded.orgType)
			setDetailCountry(seeded.country)
			setDetailCity(seeded.city)
			setDetailProvince(seeded.province)
			setDetailWebsite(seeded.website)
			setDetailPublicBio(seeded.publicBio)
			setCoverDetailsUnlocked(true)
			saveSessionOnboardingBusinessDraft({
				streetAddress: seeded.street,
				postalCode: seeded.postalCode,
				supportEmail: seeded.email,
				supportPhone: seeded.phone,
			})
			clearOnboardingWebCandidate()
			const gen = ++cardSetupGenRef.current
			setCardSetupPreparing(true)
			setCardSetupPrepareError('')
			void (async () => {
				try {
					const result = await fetchOnboardingCardSetupAssets({
						name: seeded.storeName,
						website: seeded.website,
						snippet: candidate.snippet,
						publicBio: seeded.publicBio,
						channelKind: seeded.channelKind,
						category: seeded.category,
						country: seeded.country,
						city: seeded.city,
					})
					if (gen !== cardSetupGenRef.current) return
					if (!result.ok) {
						setCardSetupPrepareError(
							result.error === 'rate_limited'
								? tu('onb_lookup_rate_limited')
								: tu('onb_card_setup_prepare_error'),
						)
						return
					}
					commitPreparedCardSetupAssets({
						logoUrl: result.logoUrl,
						backgroundUrl: result.backgroundUrl,
						brandColor: result.brandColor,
						discoverCopy: result.discoverCopy,
					})
				} finally {
					if (gen === cardSetupGenRef.current) setCardSetupPreparing(false)
				}
			})()
		},
	}

	const submitDiscovery = () => {
		if (submitting) return
		const eoa = eoaRef.current || currentTempEoa()
		if (!eoa) {
			navigate('/agent', { replace: true })
			return
		}
		const bt = orgTypeToBusinessType(detailOrgType) ?? coverBusinessType
		if (!bt) return
		setSubmitting(true)
		setCoverBusinessType(bt)
		setCoverTermsAccepted(true)
		const assets = loadOnboardingCardSetupAssets()
		const sess = loadSessionOnboardingBusinessDraft() ?? {}
		const draft = {
			businessType: bt,
			onboardingTermsAccepted: true,
			storeName: detailBusinessName,
			category: detailCategory,
			country: detailCountry,
			city: detailCity,
			province: detailProvince,
			channelKind: detailChannelKind || undefined,
			coverDetailsUnlocked: true,
			website: detailWebsite,
			publicBio: detailPublicBio.trim() || pickEmptyOnly(sess.publicBio ?? '', assets?.discoverCopy ?? ''),
			logoUrl: pickEmptyOnly(sess.logoUrl ?? '', assets?.logoUrl ?? ''),
			merchantImageUrl: pickEmptyOnly(sess.merchantImageUrl ?? '', assets?.backgroundUrl ?? ''),
			brandHex: pickEmptyOnly(sess.brandHex ?? '', assets?.brandColor ?? ''),
		}
		saveSessionOnboardingBusinessDraft(draft)
		patchBusinessProfileDraftForEoa(eoa, draft)
		mergeSessionOnboardingDraftIntoEoa(eoa)
		navigate('/native-pos', { replace: true })
	}

	/** Leave onboarding: restore agent EOA first (Create unlocked the temp session). */
	const goBack = useCallback(
		(opts?: { agentPassword?: string }) => {
			if (phase === 'businessForm') {
				setPhase('entry')
				return
			}
			if (returningToAgent) return
			setReturningToAgent(true)
			setReturnError('')
			void (async () => {
				try {
					const ok = await returnToAgentWorkspace(unlockDeps, {
						agentPassword: opts?.agentPassword,
					})
					if (ok) {
						navigate('/agent', { replace: true })
						return
					}
					setNeedReturnPassword(true)
					setReturnError(
						opts?.agentPassword
							? tu('agent_return_failed')
							: tu('agent_return_need_password'),
					)
				} finally {
					setReturningToAgent(false)
				}
			})()
		},
		[phase, returningToAgent, unlockDeps, navigate, tu],
	)

	const retryReturnWithPassword = useCallback(() => {
		const pw = returnPassword.trim()
		if (!pw) {
			setReturnError(tu('agent_return_need_password'))
			return
		}
		goBack({ agentPassword: pw })
	}, [returnPassword, goBack, tu])

	return (
		<div
			className="
				min-h-[max(720px,100dvh)] w-full flex flex-col relative bg-[#f5f7f9] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#2c2f31]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			{phase === 'entry' ? (
				<>
					<header
						className="relative z-20 flex w-full items-center justify-between gap-3 px-4 py-3"
						style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
					>
						{returningToAgent ? (
							<span
								className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 shadow-md"
								aria-busy
								aria-label={tu('agent_returning')}
							>
								<Loader2 className="h-4 w-4 animate-spin text-[#2c2f31]" aria-hidden />
							</span>
						) : (
							<BeamioCircularBackButton
								variant="onLight"
								onClick={() => goBack()}
								ariaLabel={tu('onb_back')}
							/>
						)}
						<BizOnboardingLocalePicker />
					</header>

					<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-10 pt-4">
						{returnError || needReturnPassword ? (
							<div
								role="alert"
								className="mb-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900"
							>
								{returnError ? <p>{returnError}</p> : null}
								{needReturnPassword ? (
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
										<label className="sr-only" htmlFor="onb-agent-return-password">
											{tu('agent_return_password_label')}
										</label>
										<input
											id="onb-agent-return-password"
											type="password"
											autoComplete="current-password"
											value={returnPassword}
											onChange={(e) => setReturnPassword(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') retryReturnWithPassword()
											}}
											placeholder={tu('agent_return_password_placeholder')}
											disabled={returningToAgent}
											className="min-w-0 flex-1 rounded-xl border border-amber-300/80 bg-white px-3 py-2 text-sm text-[#2c2f31] placeholder:text-slate-400 focus:border-[#1562f0] focus:outline-none"
										/>
										<button
											type="button"
											onClick={retryReturnWithPassword}
											disabled={returningToAgent || !returnPassword.trim()}
											aria-busy={returningToAgent}
											className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
										>
											{returningToAgent ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : null}
											{tu('agent_return_retry')}
										</button>
									</div>
								) : null}
							</div>
						) : null}
						<div className="mb-10 space-y-3">
							<span
								className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#1562f0]"
								style={headlineFont}
							>
								{tu('onb_lite_eyebrow')}
							</span>
							<h1
								className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[#2c2f31]"
								style={headlineFont}
							>
								{tu('onb_lite_hero_prefix')}{' '}
								<span className="text-[#1562f0]">
									{tu('onb_lite_hero_accent')}
									{tu('onb_lite_hero_suffix')}
								</span>
							</h1>
							<p className="text-base font-medium leading-relaxed text-[#595c5e]">
								{tu('onb_lite_hero_sub')}
							</p>
						</div>

						<button
							type="button"
							onClick={() => setPhase('businessForm')}
							className={`group relative w-full overflow-hidden rounded-2xl bg-white p-6 text-left shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_40px_rgba(21,98,240,0.12)] active:scale-[0.98] ${bizBrandFocusRingClass}`}
						>
							<div className="relative z-10">
								<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1562f0] shadow-lg shadow-[#1562f0]/25">
									<Home className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
								</div>
								<h2 className="mb-2 text-xl font-bold tracking-tight text-[#2c2f31]" style={headlineFont}>
									{tu('onb_lite_new_setup_title')}
								</h2>
								<p className="mb-5 text-sm font-medium leading-relaxed text-[#595c5e]">
									{tu('onb_lite_new_setup_desc')}
								</p>
								<div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#1562f0]">
									<span>{tu('onb_lite_get_started')}</span>
									<ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
								</div>
							</div>
						</button>

						{APP_VERSION ? (
							<p className="mx-auto mt-12 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#abadaf]">
								v{APP_VERSION}
							</p>
						) : null}
					</div>
				</>
			) : (
				<>
					<header
						className="fixed top-0 left-0 right-0 z-50 flex w-full items-center gap-3 overflow-visible bg-[#f5f7f9]/70 px-4 py-3 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl md:px-6"
						style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
					>
						<BeamioCircularBackButton
							variant="onLight"
							onClick={() => goBack()}
							ariaLabel={tu('onb_back')}
						/>
						<span className="min-w-0 flex-1 truncate text-xl font-black tracking-tight text-[#1562f0]" style={headlineFont}>
							{tu('onb_beamio_business_lite')}
						</span>
						<BizOnboardingLocalePicker />
					</header>

					<main className="flex min-h-0 flex-1 flex-col md:flex-row">
						<section className="hidden w-full flex-col justify-center bg-[#f5f7f9] p-5 md:flex md:w-[40%] md:p-10 lg:p-12">
							<div className="mx-auto w-full max-w-md md:mx-0">
								<span
									className="mb-3 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#1562f0]"
									style={headlineFont}
								>
									{tu('onb_lite_eyebrow')}
								</span>
								<h2
									className="mb-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#2c2f31] md:text-4xl"
									style={headlineFont}
								>
									{tu('onb_lite_hero_prefix')}{' '}
									<span className="text-[#1562f0]">
										{tu('onb_lite_hero_accent')}
										{tu('onb_lite_hero_suffix')}
									</span>
								</h2>
								<p className="text-base font-medium leading-relaxed text-[#595c5e] md:text-lg">
									{tu('onb_lite_hero_sub')}
								</p>
							</div>
						</section>

						<section
							className={`flex-1 overflow-y-auto overflow-x-hidden pt-[calc(4rem+env(safe-area-inset-top))] md:bg-white md:pt-[calc(5rem+env(safe-area-inset-top))] ${
								coverDetailsUnlocked
									? 'pb-[calc(11rem+env(safe-area-inset-bottom))]'
									: 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'
							}`}
						>
							<div className="mx-auto w-full max-w-2xl px-5 pt-6 md:max-w-xl md:px-10 lg:px-14">
								{/* Mobile: sheet layout; desktop: embedded (Continue in-panel). */}
								<div className="md:hidden">
									<OnboardingBusinessDiscoveryForm
										{...discoveryFormSharedProps}
										layout="sheet"
										idPrefix="agent-onb-mobile"
										onSubmit={submitDiscovery}
									/>
								</div>
								<div className="hidden md:block">
									<OnboardingBusinessDiscoveryForm
										{...discoveryFormSharedProps}
										layout="embedded"
										idPrefix="agent-onb-desktop"
										onSubmit={submitDiscovery}
									/>
								</div>
							</div>
						</section>
					</main>
				</>
			)}

			<MerchantLegalDocumentOverlay
				open={legalDocId != null}
				docId={legalDocId ?? 'privacy'}
				onClose={() => setLegalDocId(null)}
			/>
		</div>
	)
}
