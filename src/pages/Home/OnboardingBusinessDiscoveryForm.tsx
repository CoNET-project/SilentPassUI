import React, { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Bot, ChevronDown, Globe, Loader2, ShieldCheck, Store } from 'lucide-react'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import {
	onboardingCountrySelectOptionElements,
	OnboardingProvinceControl,
} from '@/pages/Home/onboardingLocationFields'
import { useTu } from '@/locale/beamioLocale'
import { BusinessNameLookupField } from '@/pages/Home/BusinessNameLookupField'
import type { OnboardingBusinessLookupCandidate } from '@/utils/onboardingBusinessLookup'
import type {
	VerraBusinessChannelKind,
	VerraBusinessProfileBusinessType,
} from '@/utils/verraBusinessProfileLocal'

const HEADLINE_FONT = { fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif' } as const

export type OrgTypeSelect = 'sme' | 'franchise' | 'ngo' | ''

export function orgTypeToBusinessType(org: OrgTypeSelect): VerraBusinessProfileBusinessType | null {
	if (org === 'sme') return 'solo'
	if (org === 'franchise') return 'chain'
	if (org === 'ngo') return 'ngo'
	return null
}

export function businessTypeToOrgType(bt: VerraBusinessProfileBusinessType | undefined): OrgTypeSelect {
	if (bt === 'solo') return 'sme'
	if (bt === 'chain') return 'franchise'
	if (bt === 'ngo') return 'ngo'
	return ''
}

export const PHYSICAL_SUBS = [
	{ value: 'food-beverage', labelKey: 'onb_cat_food_beverage' },
	{ value: 'grocery-convenience', labelKey: 'onb_cat_grocery' },
	{ value: 'fitness-wellness', labelKey: 'onb_cat_fitness' },
	{ value: 'education-consulting', labelKey: 'onb_cat_education' },
	{ value: 'entertainment-leisure', labelKey: 'onb_cat_entertainment' },
	{ value: 'health-beauty', labelKey: 'onb_cat_health_beauty' },
	{ value: 'retail-shopping', labelKey: 'onb_cat_retail' },
] as const

export const DIGITAL_SUBS = [
	{ value: 'ecommerce-store', labelKey: 'onb_cat_ecommerce' },
	{ value: 'creator-kol', labelKey: 'onb_cat_creator_kol' },
	{ value: 'digital-services', labelKey: 'onb_cat_digital_services' },
	{ value: 'freelance-agency', labelKey: 'onb_cat_freelance' },
] as const

export const APP_SUBS = [
	{ value: 'saas-platform', labelKey: 'onb_cat_saas' },
	{ value: 'mobile-application', labelKey: 'onb_cat_mobile_app' },
	{ value: 'ai-ml-service', labelKey: 'onb_cat_ai_ml' },
	{ value: 'api-provider', labelKey: 'onb_cat_api_provider' },
] as const

export function subsForChannel(kind: VerraBusinessChannelKind | '') {
	if (kind === 'digital') return DIGITAL_SUBS
	if (kind === 'app') return APP_SUBS
	if (kind === 'physical') return PHYSICAL_SUBS
	return []
}

function SelectChevron(): React.ReactElement {
	return (
		<ChevronDown
			className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]"
			aria-hidden
		/>
	)
}

export type OnboardingBusinessDiscoveryFormProps = {
	storeName: string
	setStoreName: (v: string) => void
	channelKind: VerraBusinessChannelKind | ''
	setChannelKind: (v: VerraBusinessChannelKind) => void
	category: string
	setCategory: (v: string) => void
	orgType: OrgTypeSelect
	setOrgType: (v: OrgTypeSelect) => void
	country: string
	setCountry: (v: string) => void
	city: string
	setCity: (v: string) => void
	province: string
	setProvince: (v: string) => void
	termsAccepted: boolean
	setTermsAccepted: (v: boolean) => void
	onOpenLegalDoc: (docId: 'privacy' | 'terms') => (e: React.MouseEvent) => void
	onSubmit: () => void
	/** Choosing a lookup result hydrates this form; remaining fields stay hidden until then. */
	onSelectLookupCandidate?: (candidate: OnboardingBusinessLookupCandidate) => void
	/** Category, location, terms, and Next stay hidden until a lookup candidate is chosen. */
	detailsVisible?: boolean
	/** Skip refetch after a pick; focus still reopens the last suggestion list. */
	lookupSkipValue?: string
	/** After a lookup pick, Cluster prepares Card Setup logo / background / brand color / Discover copy. */
	cardSetupPreparing?: boolean
	/** Panel-inline prepare error; Continue stays available. */
	cardSetupPrepareError?: string
	/** `embedded` = desktop right panel (no sticky footer). `sheet` = mobile sticky CTA. */
	layout?: 'embedded' | 'sheet'
	idPrefix?: string
}

export function OnboardingBusinessDiscoveryForm({
	storeName,
	setStoreName,
	channelKind,
	setChannelKind,
	category,
	setCategory,
	orgType,
	setOrgType,
	country,
	setCountry,
	city,
	setCity,
	province,
	setProvince,
	termsAccepted,
	setTermsAccepted,
	onOpenLegalDoc,
	onSubmit,
	onSelectLookupCandidate,
	detailsVisible = false,
	lookupSkipValue = '',
	cardSetupPreparing = false,
	cardSetupPrepareError = '',
	layout = 'embedded',
	idPrefix = 'onb-discovery',
}: OnboardingBusinessDiscoveryFormProps): React.ReactElement {
	const { tu } = useTu()
	const subOptions = useMemo(() => subsForChannel(channelKind), [channelKind])

	const canSubmit =
		storeName.trim().length > 2 &&
		Boolean(channelKind) &&
		Boolean(category.trim()) &&
		Boolean(orgType) &&
		Boolean(country.trim()) &&
		Boolean(city.trim()) &&
		Boolean(province.trim()) &&
		termsAccepted

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

	const formBody = (
		<>
			<header className="mb-8">
				<h1
					className="mb-2 text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-[#1a1b1f] md:text-[34px] md:leading-[41px]"
					style={HEADLINE_FONT}
				>
					{tu('onb_tell_business_title')}
				</h1>
				<p className="text-[17px] leading-[22px] text-[#424655]">{tu('onb_tell_business_sub')}</p>
			</header>

			<div className="space-y-8">
				<div className="space-y-2">
					{onSelectLookupCandidate ? (
						<BusinessNameLookupField
							id={`${idPrefix}-name`}
							value={storeName}
							onChange={setStoreName}
							placeholder={tu('onb_lookup_composer_ph')}
							inputClassName={inputClass}
							onSelectCandidate={onSelectLookupCandidate}
							skipLookupValue={lookupSkipValue}
							hintFilled={detailsVisible}
							hintLocationMissing={detailsVisible && !country.trim()}
						/>
					) : (
						<>
							<label className={fieldLabel} htmlFor={`${idPrefix}-name`}>
								{tu('onb_business_name')}
							</label>
							<input
								id={`${idPrefix}-name`}
								type="text"
								value={storeName}
								onChange={(e) => setStoreName(e.target.value)}
								placeholder={tu('onb_business_name_ph')}
								autoComplete="organization"
								className={inputClass}
							/>
						</>
					)}
				</div>

				{detailsVisible ? (
				<>
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
					<div className="space-y-8 transition-opacity duration-300">
						<div className="space-y-2">
							<label className={fieldLabel} htmlFor={`${idPrefix}-org`}>
								{tu('onb_org_type')}
							</label>
							<div className="relative">
								<select
									id={`${idPrefix}-org`}
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
								<label className="sr-only" htmlFor={`${idPrefix}-country`}>
									{tu('onb_country')}
								</label>
								<select
									id={`${idPrefix}-country`}
									key={`${idPrefix}-country-${country || 'empty'}`}
									value={country}
									onChange={(e) => {
										const next = e.target.value
										if (!next) {
											e.currentTarget.value = country
											return
										}
										setCountry(next)
										setProvince('')
									}}
									className={`${inputClass} appearance-none cursor-pointer`}
								>
									{country ? null : (
										<option value="" disabled>
											{tu('onb_select_country')}
										</option>
									)}
									{onboardingCountrySelectOptionElements(country)}
								</select>
								<SelectChevron />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className={fieldLabel} htmlFor={`${idPrefix}-city`}>
										{tu('onb_city')}
									</label>
									<input
										id={`${idPrefix}-city`}
										type="text"
										value={city}
										onChange={(e) => setCity(e.target.value)}
										placeholder={tu('onb_city_ph')}
										autoComplete="address-level2"
										className={inputClass}
									/>
								</div>
								<div className="space-y-1">
									<label className={fieldLabel} htmlFor={`${idPrefix}-province`}>
										{tu('onb_province')}
									</label>
									<OnboardingProvinceControl
										id={`${idPrefix}-province`}
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
				</>
				) : null}
			</div>
		</>
	)

	const termsAndCta = (
		<div className={`flex w-full flex-col gap-4 ${layout === 'sheet' ? 'mx-auto max-w-2xl' : ''}`}>
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
					<button
						type="button"
						className="text-[#1562f0] underline-offset-2 hover:underline"
						onClick={onOpenLegalDoc('privacy')}
					>
						{tu('onb_terms_privacy_link')}
					</button>
					{tu('onb_terms_and')}
					<button
						type="button"
						className="text-[#1562f0] underline-offset-2 hover:underline"
						onClick={onOpenLegalDoc('terms')}
					>
						{tu('onb_terms_link')}
					</button>
					{tu('onb_terms_suffix')}
				</span>
			</label>
			{cardSetupPrepareError ? (
				<div
					role="alert"
					className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900"
				>
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
					<p>{cardSetupPrepareError}</p>
				</div>
			) : null}
			<button
				type="button"
				disabled={!canSubmit || cardSetupPreparing}
				onClick={() => {
					if (!canSubmit || cardSetupPreparing) return
					onSubmit()
				}}
				aria-busy={cardSetupPreparing}
				aria-label={cardSetupPreparing ? tu('onb_card_setup_preparing') : tu('onb_next_claim_tag')}
				className={`
					flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] py-4 text-[17px] font-semibold text-white
					shadow-[0px_10px_20px_rgba(0,0,0,0.05)] transition-all hover:shadow-md active:scale-[0.98]
					disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
					${bizBrandFocusRingClass}
				`}
			>
				{cardSetupPreparing ? (
					<>
						<Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
						{tu('onb_card_setup_preparing')}
					</>
				) : (
					<>
						{tu('onb_next_claim_tag')}
						<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
					</>
				)}
			</button>
		</div>
	)

	if (layout === 'sheet') {
		return (
			<>
				<div className="mx-auto w-full max-w-2xl px-5 pb-4 pt-2 md:px-0">{formBody}</div>
				{detailsVisible ? (
					<div className="fixed bottom-0 left-0 z-50 flex w-full flex-col items-center border-t border-[#e3e2e7] bg-[#faf9fe]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:px-8">
						{termsAndCta}
					</div>
				) : null}
			</>
		)
	}

	return (
		<div className="w-full">
			{formBody}
			{detailsVisible ? (
				<div className="mt-8 space-y-5 border-t border-[#abadaf]/15 pt-6">{termsAndCta}</div>
			) : null}
		</div>
	)
}
