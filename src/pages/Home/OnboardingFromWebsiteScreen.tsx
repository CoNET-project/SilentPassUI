import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bot, ChevronDown, Globe, ShieldCheck, Store } from 'lucide-react'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { MerchantLegalDocumentOverlay } from '@/pages/Vouchers/example/MerchantLegalDocumentOverlay'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import {
	subsForChannel,
	type OrgTypeSelect,
} from '@/pages/Home/OnboardingBusinessDiscoveryForm'
import { normalizeOnboardingCountryCode } from '@/pages/Home/onboardingCountries'
import { normalizeOnboardingProvince } from '@/pages/Home/onboardingRegions'
import {
	OnboardingCountrySelectOptions,
	OnboardingProvinceControl,
} from '@/pages/Home/onboardingLocationFields'
import { useTu } from '@/locale/beamioLocale'
import type { BeamioLegalDocId } from '@/utils/beamioLegalDocuments'
import type { VerraBusinessChannelKind } from '@/utils/verraBusinessProfileLocal'
import {
	enrichLookupCandidateFromPublicName,
	normalizeOnboardingCategory,
	type OnboardingBusinessLookupCandidate,
} from '@/utils/onboardingBusinessLookup'

const HEADLINE_FONT = { fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' } as const
export type OnboardingFromWebsiteContinuePayload = {
	storeName: string
	website: string
	publicBio: string
	channelKind: VerraBusinessChannelKind
	category: string
	orgType: OrgTypeSelect
	country: string
	city: string
	province: string
}

type Props = {
	appVersion: string
	candidate: OnboardingBusinessLookupCandidate
	onBack: () => void
	onContinue: (payload: OnboardingFromWebsiteContinuePayload) => void
}

function SelectChevron(): React.ReactElement {
	return (
		<ChevronDown
			className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]"
			aria-hidden
		/>
	)
}

export function seedOnboardingFormFromCandidate(
	c: OnboardingBusinessLookupCandidate,
	extraHint = '',
) {
	const filled = enrichLookupCandidateFromPublicName(c, extraHint)
	const country = normalizeOnboardingCountryCode(filled.country)
	const province = country ? normalizeOnboardingProvince(country, filled.province) : ''
	return {
		storeName: filled.name,
		website: filled.website,
		publicBio: filled.publicBio || filled.snippet,
		channelKind: filled.channelKind,
		category: normalizeOnboardingCategory(filled.channelKind, filled.category || filled.name),
		orgType: filled.orgType,
		country,
		city: filled.city,
		province,
		street: filled.street,
		phone: filled.phone,
		email: filled.email,
		postalCode: filled.postalCode,
	}
}

export function OnboardingFromWebsiteScreen({
	appVersion,
	candidate,
	onBack,
	onContinue,
}: Props): React.ReactElement {
	const { tu } = useTu()
	const seeded = useMemo(() => seedOnboardingFormFromCandidate(candidate), [candidate])
	const [storeName, setStoreName] = useState(seeded.storeName)
	const [website, setWebsite] = useState(seeded.website)
	const [publicBio, setPublicBio] = useState(seeded.publicBio)
	const [channelKind, setChannelKind] = useState<VerraBusinessChannelKind | ''>(seeded.channelKind)
	const [category, setCategory] = useState(seeded.category)
	const [orgType, setOrgType] = useState<OrgTypeSelect>(seeded.orgType)
	const [country, setCountry] = useState(seeded.country)
	const [city, setCity] = useState(seeded.city)
	const [province, setProvince] = useState(seeded.province)
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [legalDocId, setLegalDocId] = useState<BeamioLegalDocId | null>(null)

	useEffect(() => {
		const next = seedOnboardingFormFromCandidate(candidate)
		setStoreName(next.storeName)
		setWebsite(next.website)
		setPublicBio(next.publicBio)
		setChannelKind(next.channelKind)
		setCategory(next.category)
		setOrgType(next.orgType)
		setCountry(next.country)
		setCity(next.city)
		setProvince(next.province)
		setTermsAccepted(false)
	}, [candidate])

	const subOptions = useMemo(() => subsForChannel(channelKind), [channelKind])
	const allowedCats = useMemo(() => new Set(subOptions.map((s) => s.value)), [subOptions])
	const categoryOk = Boolean(category) && allowedCats.has(category as never)

	const canSubmit =
		storeName.trim().length > 2 &&
		Boolean(channelKind) &&
		categoryOk &&
		Boolean(orgType) &&
		Boolean(country.trim()) &&
		Boolean(city.trim()) &&
		Boolean(province.trim()) &&
		termsAccepted

	const onPickChannel = (next: VerraBusinessChannelKind) => {
		setChannelKind(next)
		const allowed = new Set(subsForChannel(next).map((s) => s.value))
		if (!allowed.has(category as never)) setCategory('')
	}

	const fieldLabel = 'ml-1 block text-[12px] font-semibold uppercase tracking-[0.05em] text-[#424655]'
	const inputClass = `
		w-full rounded-lg border-0 bg-[#f4f3f8] px-4 py-3.5 text-[17px] leading-[22px] text-[#1a1b1f]
		placeholder:text-[#424655]/50 transition-colors
		focus:bg-white focus:ring-2 focus:ring-[#1562f0]/30
		${bizBrandFocusRingClass}
	`

	const channels: {
		id: VerraBusinessChannelKind
		titleKey: string
		descKey: string
		Icon: typeof Store
	}[] = [
		{ id: 'physical', titleKey: 'onb_channel_physical_title', descKey: 'onb_channel_physical_desc', Icon: Store },
		{ id: 'digital', titleKey: 'onb_channel_digital_title', descKey: 'onb_channel_digital_desc', Icon: Globe },
		{ id: 'app', titleKey: 'onb_channel_app_title', descKey: 'onb_channel_app_desc', Icon: Bot },
	]

	const openLegal = (docId: BeamioLegalDocId) => (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setLegalDocId(docId)
	}

	return (
		<div
			className="
				min-h-[max(720px,100dvh)] w-full flex flex-col relative bg-[#f5f7f9] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#2c2f31]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			{appVersion ? (
				<div className="pointer-events-none fixed left-4 z-[5] text-[11px] font-medium text-[#abadaf] md:left-6 top-[calc(env(safe-area-inset-top)+0.5rem)]">
					v{appVersion}
				</div>
			) : null}

			<div
				className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
			>
				<div className={`flex items-center justify-between ${BEAMIO_CIRCULAR_BACK_ROW_CLASS}`}>
					<BeamioCircularBackButton variant="onLight" onClick={onBack} />
					<BizOnboardingLocalePicker />
				</div>

				<header className="pb-7 pt-2">
					<p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747779]">
						{tu('onb_from_web_eyebrow')}
					</p>
					<h1
						className="mb-2 text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-[#1a1b1f] md:text-[34px] md:leading-[41px]"
						style={HEADLINE_FONT}
					>
						{tu('onb_from_web_title')}
					</h1>
					<p className="text-[17px] leading-[22px] text-[#424655]">{tu('onb_from_web_sub')}</p>
				</header>

				<div className="space-y-8">
					<div className="space-y-2">
						<label className={fieldLabel} htmlFor="onb-web-name">
							{tu('onb_business_name')}
						</label>
						<input
							id="onb-web-name"
							type="text"
							value={storeName}
							onChange={(e) => setStoreName(e.target.value)}
							autoComplete="organization"
							className={inputClass}
						/>
					</div>

					<div className="space-y-2">
						<label className={fieldLabel} htmlFor="onb-web-website">
							{tu('onb_website')}
						</label>
						<input
							id="onb-web-website"
							type="text"
							inputMode="url"
							autoComplete="url"
							value={website}
							onChange={(e) => setWebsite(e.target.value)}
							placeholder={tu('onb_website_ph')}
							className={inputClass}
						/>
					</div>

					<div className="space-y-2">
						<label className={fieldLabel} htmlFor="onb-web-bio">
							{tu('onb_public_bio')}
						</label>
						<textarea
							id="onb-web-bio"
							value={publicBio}
							onChange={(e) => setPublicBio(e.target.value)}
							placeholder={tu('onb_public_bio_ph')}
							rows={4}
							enterKeyHint="next"
							autoComplete="off"
							className={`${inputClass} min-h-[6.5rem] resize-y`}
						/>
					</div>

					<div className="space-y-3">
						<p className={fieldLabel}>{tu('onb_business_category')}</p>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
							{channels.map(({ id, titleKey, descKey, Icon }) => {
								const selected = channelKind === id
								return (
									<button
										key={id}
										type="button"
										onClick={() => onPickChannel(id)}
										aria-pressed={selected}
										className={`
											h-full rounded-xl border p-4 text-left shadow-sm transition-all
											${
												selected
													? 'border-[#1562f0] bg-[#1562f0]/5'
													: 'border-[#c3c6d8] bg-white/70 hover:border-[#1562f0]/50'
											}
											${bizBrandFocusRingClass}
										`}
									>
										<Icon className="mb-3 h-6 w-6 text-[#1562f0]" strokeWidth={2} aria-hidden />
										<h3 className="mb-1 text-[17px] font-semibold leading-[22px] text-[#1a1b1f]">{tu(titleKey)}</h3>
										<p className="text-[15px] leading-tight text-[#424655]">{tu(descKey)}</p>
									</button>
								)
							})}
						</div>
						{channelKind ? (
							<div className="mt-4">
								<p className={`${fieldLabel} mb-2`}>{tu('onb_select_subcategory')}</p>
								<div className="flex flex-wrap gap-2">
									{subOptions.map(({ value, labelKey }) => {
										const selected = category === value
										return (
											<button
												key={value}
												type="button"
												onClick={() => setCategory(value)}
												aria-pressed={selected}
												className={`
													inline-block whitespace-nowrap rounded-full border px-4 py-2 text-[15px] transition-colors
													${
														selected
															? 'border-[#1562f0] bg-[#1562f0]/10 text-[#1562f0]'
															: 'border-[#c3c6d8] text-[#424655] hover:border-[#1562f0]/40'
													}
													${bizBrandFocusRingClass}
												`}
											>
												{tu(labelKey)}
											</button>
										)
									})}
								</div>
							</div>
						) : null}
					</div>

					{channelKind ? (
						<div className="space-y-8">
							<div className="space-y-2">
								<label className={fieldLabel} htmlFor="onb-web-org">
									{tu('onb_org_type')}
								</label>
								<div className="relative">
									<select
										id="onb-web-org"
										value={orgType}
										onChange={(e) => setOrgType(e.target.value as OrgTypeSelect)}
										className={`${inputClass} appearance-none cursor-pointer`}
									>
										<option value="" disabled>
											{tu('onb_select_org_type')}
										</option>
										<option value="sme">{tu('onb_org_sme')}</option>
										<option value="franchise">{tu('onb_org_franchise')}</option>
										<option value="ngo">{tu('onb_org_ngo')}</option>
									</select>
									<SelectChevron />
								</div>
							</div>

							<div className="space-y-4">
								<p className={`${fieldLabel} mb-2`}>{tu('onb_location_label')}</p>
								<div className="relative">
									<label className="sr-only" htmlFor="onb-web-country">
										{tu('onb_country')}
									</label>
									<select
										id="onb-web-country"
										value={country}
										onChange={(e) => {
											setCountry(e.target.value)
											setProvince('')
										}}
										className={`${inputClass} appearance-none cursor-pointer`}
									>
										<option value="">{tu('onb_select_country')}</option>
										<OnboardingCountrySelectOptions current={country} />
									</select>
									<SelectChevron />
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1">
										<label className={fieldLabel} htmlFor="onb-web-city">
											{tu('onb_city')}
										</label>
										<input
											id="onb-web-city"
											type="text"
											value={city}
											onChange={(e) => setCity(e.target.value)}
											placeholder={tu('onb_city_ph')}
											autoComplete="address-level2"
											className={inputClass}
										/>
									</div>
									<div className="space-y-1">
										<label className={fieldLabel} htmlFor="onb-web-province">
											{tu('onb_province')}
										</label>
										<OnboardingProvinceControl
											id="onb-web-province"
											country={country}
											value={province}
											onChange={setProvince}
											selectClassName={`${inputClass} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
											emptySelectLabel={tu('onb_select')}
											noCountryLabel={tu('onb_select_country_first')}
											freeTextPlaceholder={tu('onb_province_ph')}
										/>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-xl border border-[#dbe1ff] bg-[#dbe1ff]/30 p-4">
								<ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
								<div>
									<p className="text-[15px] font-semibold text-[#003fa5]">{tu('onb_encrypted_title')}</p>
									<p className="mt-1 text-[15px] leading-snug text-[#424655]">{tu('onb_encrypted_body')}</p>
								</div>
							</div>
						</div>
					) : null}

					<div className="flex w-full flex-col gap-4 pb-4">
						<label className="flex cursor-pointer items-start gap-3">
							<div className="relative flex items-center pt-1">
								<input
									type="checkbox"
									className="peer sr-only"
									checked={termsAccepted}
									onChange={(e) => setTermsAccepted(e.target.checked)}
								/>
								<div
									className={`
										flex h-5 w-5 items-center justify-center rounded border-2 border-[#737687] bg-transparent transition-colors
										peer-checked:border-[#1562f0] peer-checked:bg-[#1562f0]
										${bizBrandFocusRingClass}
									`}
								>
									{termsAccepted ? (
										<svg className="h-3.5 w-3.5 text-white" viewBox="0 0 12 12" fill="none" aria-hidden>
											<path d="M2 6.5L4.5 9L10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									) : null}
								</div>
							</div>
							<span className="text-[12px] font-semibold uppercase leading-relaxed tracking-[0.05em] text-[#424655]">
								{tu('onb_terms_prefix')}
								<button type="button" className="text-[#1562f0] underline-offset-2 hover:underline" onClick={openLegal('privacy')}>
									{tu('onb_terms_privacy_link')}
								</button>
								{tu('onb_terms_and')}
								<button type="button" className="text-[#1562f0] underline-offset-2 hover:underline" onClick={openLegal('terms')}>
									{tu('onb_terms_link')}
								</button>
								{tu('onb_terms_suffix')}
							</span>
						</label>
						<button
							type="button"
							disabled={!canSubmit}
							onClick={() => {
								if (!canSubmit || !channelKind || !orgType) return
								onContinue({
									storeName: storeName.trim(),
									website: website.trim(),
									publicBio: publicBio.trim(),
									channelKind,
									category,
									orgType,
									country,
									city: city.trim(),
									province,
								})
							}}
							className={`
								flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] py-4 text-[17px] font-semibold text-white
								shadow-[0px_10px_20px_rgba(0,0,0,0.05)] transition-all hover:shadow-md active:scale-[0.98]
								disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
								${bizBrandFocusRingClass}
							`}
						>
							{tu('onb_next_claim_tag')}
							<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
						</button>
					</div>
				</div>
			</div>

			<MerchantLegalDocumentOverlay
				open={legalDocId != null}
				docId={legalDocId ?? 'privacy'}
				onClose={() => setLegalDocId(null)}
			/>
		</div>
	)
}
