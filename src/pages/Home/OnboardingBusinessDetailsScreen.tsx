import React from "react"
import {
	ArrowRight,
	BadgeCheck,
	ChevronDown,
	Hexagon,
	Info,
	LayoutGrid,
	ShieldCheck,
	UserRound,
} from "lucide-react"
import { bizBrandFocusRingClass } from "@/pages/Home/brandUi"
import { ONBOARDING_REGIONS_BY_COUNTRY } from "@/pages/Home/onboardingRegions"

const HEADLINE_FONT = { fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" } as const

function OnboardingDetailsSelectChevron(): React.ReactElement {
	return (
		<ChevronDown
			className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]"
			aria-hidden
		/>
	)
}

export type OnboardingBusinessDetailsScreenProps = {
	appVersion: string
	detailBusinessName: string
	setDetailBusinessName: (v: string) => void
	detailCategory: string
	setDetailCategory: (v: string) => void
	detailCountry: string
	setDetailCountry: (v: string) => void
	detailCity: string
	setDetailCity: (v: string) => void
	detailProvince: string
	setDetailProvince: (v: string) => void
	onContinue: () => void
}

/** Module-scoped screen so parent state updates do not remount inputs (stable component identity). */
export function OnboardingBusinessDetailsScreen({
	appVersion,
	detailBusinessName,
	setDetailBusinessName,
	detailCategory,
	setDetailCategory,
	detailCountry,
	setDetailCountry,
	detailCity,
	setDetailCity,
	detailProvince,
	setDetailProvince,
	onContinue,
}: OnboardingBusinessDetailsScreenProps): React.ReactElement {
	const canContinue = detailBusinessName.trim().length > 0 && detailCategory.trim().length > 0

	return (
		<div
			className="
				min-h-[max(884px,100dvh)] w-full flex flex-col relative overflow-x-hidden bg-[#f5f7f9] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#2c2f31] antialiased
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			<header
				className="fixed top-0 left-0 right-0 z-50 flex w-full items-center justify-end border-b border-[#abadaf]/10 bg-[#f5f7f9]/70 px-6 py-4 shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<nav className="flex items-center gap-4 text-[10px] font-bold tracking-tight" style={HEADLINE_FONT}>
					<span className="text-[#abadaf]">Select Type</span>
					<span className="text-[#1562f0] border-b-2 border-[#1562f0] pb-0.5">Details</span>
					<span className="text-[#abadaf]">Identity</span>
				</nav>
			</header>

			{appVersion && (
				<div
					className="fixed right-4 z-[60] text-[11px] font-medium text-[#abadaf] md:right-6"
					style={{ top: "calc(env(safe-area-inset-top) + 4.25rem)" }}
				>
					v{appVersion}
				</div>
			)}

			<main className="min-h-0 flex-1 pt-[calc(4rem+env(safe-area-inset-top))] pb-28 md:pb-10">
				<section className="overflow-hidden bg-[#f5f7f9] px-6 pb-12 pt-8">
					<div className="mx-auto w-full max-w-md">
						<h1
							className="mb-4 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight text-[#2c2f31]"
							style={HEADLINE_FONT}
						>
							Set up your business for <span className="text-[#1562f0]">live</span> commerce.
						</h1>
						<p className="mb-10 max-w-[85%] text-lg leading-relaxed text-[#595c5e]">
							Create a dedicated workspace for global cards, payments, and smart-contract utility.
						</p>
						<div className="grid grid-cols-2 gap-4">
							<div className="translate-y-1 rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(21,98,240,0.04)] sm:translate-y-4">
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#d8e3fb]">
									<LayoutGrid className="h-5 w-5 text-[#1562f0]" strokeWidth={2} aria-hidden />
								</div>
								<h3 className="mb-1 text-sm font-bold" style={HEADLINE_FONT}>
									Business Control
								</h3>
								<p className="text-[11px] leading-tight text-[#595c5e]">Centralized dashboard for all operational workflows.</p>
							</div>
							<div className="-translate-y-0.5 rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(21,98,240,0.04)] sm:-translate-y-2">
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f797ef]/20">
									<Hexagon className="h-5 w-5 text-[#8d3a8b]" strokeWidth={2} aria-hidden />
								</div>
								<h3 className="mb-1 text-sm font-bold" style={HEADLINE_FONT}>
									Brand Identity
								</h3>
								<p className="text-[11px] leading-tight text-[#595c5e]">Smart-contract loyalty and membership tiers.</p>
							</div>
						</div>
					</div>
				</section>

				<section className="-mt-4 rounded-t-3xl bg-white px-6 py-12 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
					<div className="mx-auto w-full max-w-md">
						<div className="mb-10">
							<h2 className="mb-2 text-2xl font-bold tracking-tight text-[#2c2f31]" style={HEADLINE_FONT}>
								Tell us about your business
							</h2>
							<p className="text-sm text-[#595c5e]">Essential for market discovery and regulatory compliance.</p>
						</div>

						<div className="space-y-8">
							<div className="space-y-2">
								<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-detail-name">
									Business Name
								</label>
								<input
									id="onb-detail-name"
									type="text"
									value={detailBusinessName}
									onChange={(e) => setDetailBusinessName(e.target.value)}
									placeholder="e.g., Main Street Roasters"
									autoComplete="organization"
									className={`
										w-full rounded-2xl border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] placeholder:text-[#abadaf]
										transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
										${bizBrandFocusRingClass}
									`}
								/>
							</div>

							<div className="space-y-2">
								<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-detail-category">
									Business Category
								</label>
								<div className="relative">
									<select
										id="onb-detail-category"
										value={detailCategory}
										onChange={(e) => setDetailCategory(e.target.value)}
										className={`
											w-full appearance-none rounded-2xl border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
											focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
											${bizBrandFocusRingClass}
										`}
									>
										<option value="">Select category</option>
										<option value="food-beverage">Food &amp; Beverage</option>
										<option value="grocery-convenience">Grocery &amp; Convenience</option>
										<option value="retail-shopping">Retail &amp; Shopping</option>
										<option value="education-training">Education &amp; Training</option>
										<option value="health-beauty">Health &amp; Beauty</option>
										<option value="fitness-wellness">Fitness &amp; Wellness</option>
										<option value="entertainment-leisure">Entertainment &amp; Leisure</option>
										<option value="local-services">Local Services</option>
									</select>
									<OnboardingDetailsSelectChevron />
								</div>
							</div>

							<div className="space-y-2">
								<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-detail-country">
									Country
								</label>
								<div className="relative">
									<select
										id="onb-detail-country"
										value={detailCountry}
										onChange={(e) => {
											setDetailCountry(e.target.value)
											setDetailProvince("")
										}}
										className={`
											w-full appearance-none rounded-2xl border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
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
									<OnboardingDetailsSelectChevron />
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-detail-city">
										City
									</label>
									<input
										id="onb-detail-city"
										type="text"
										value={detailCity}
										onChange={(e) => setDetailCity(e.target.value)}
										placeholder="e.g., Vancouver"
										autoComplete="address-level2"
										className={`
											w-full rounded-2xl border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] placeholder:text-[#abadaf]
											transition-all focus:bg-white focus:ring-2 focus:ring-[#1562f0]/20
											${bizBrandFocusRingClass}
										`}
									/>
								</div>
								<div className="space-y-2">
									<label className="ml-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#595c5e]" htmlFor="onb-detail-province">
										Province
									</label>
									<div className="relative">
										<select
											id="onb-detail-province"
											value={detailProvince}
											disabled={!detailCountry}
											onChange={(e) => setDetailProvince(e.target.value)}
											className={`
												w-full appearance-none rounded-2xl border-0 bg-[#eef1f3] px-5 py-4 text-base text-[#2c2f31] transition-all
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
										<OnboardingDetailsSelectChevron />
									</div>
								</div>
							</div>
						</div>

						<div className="mt-12 flex items-start gap-4 rounded-2xl bg-[#1562f0]/5 p-6">
							<ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
							<div>
								<p className="mb-1 text-xs font-semibold text-[#1562f0]">Encrypted Infrastructure</p>
								<p className="text-[11px] leading-relaxed text-[#595c5e]">
									Your data is stored using AES-256 encryption. We never share your commercial details with third-party brokers.
								</p>
							</div>
						</div>

						<button
							type="button"
							disabled={!canContinue}
							className={`
								mt-10 flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] px-8 py-5 text-base font-bold text-white
								shadow-[0_20px_40px_rgba(21,98,240,0.15)] transition-all hover:shadow-[0_20px_40px_rgba(21,98,240,0.25)] active:scale-[0.98]
								disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:shadow-none disabled:active:scale-100
								${bizBrandFocusRingClass}
							`}
							onClick={() => {
								if (!canContinue) return
								onContinue()
							}}
						>
							Continue
							<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
						</button>
					</div>
				</section>
			</main>

			<footer className="mt-auto flex flex-col items-center justify-between gap-6 border-t border-[#abadaf]/10 bg-[#eef1f3] px-8 py-8 pb-24 text-[10px] font-bold uppercase tracking-[0.2em] text-[#595c5e] md:flex-row md:px-16 md:pb-8">
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

			<nav
				className="fixed bottom-0 left-0 right-0 z-50 flex justify-around rounded-t-[2rem] bg-white/70 px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_40px_rgba(21,98,240,0.06)] backdrop-blur-2xl md:hidden"
				aria-label="Onboarding steps"
			>
				<div className="flex flex-col items-center justify-center p-3 text-slate-400">
					<BadgeCheck className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={HEADLINE_FONT}>
						Select Type
					</span>
				</div>
				<div className="flex flex-col items-center justify-center rounded-full bg-[#1562f0] p-3 text-white">
					<Info className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={HEADLINE_FONT}>
						Details
					</span>
				</div>
				<div className="flex flex-col items-center justify-center p-3 text-slate-400">
					<UserRound className="h-6 w-6" strokeWidth={2} aria-hidden />
					<span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={HEADLINE_FONT}>
						Identity
					</span>
				</div>
			</nav>
		</div>
	)
}
