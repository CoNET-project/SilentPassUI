import React from 'react'
import { ChevronDown } from 'lucide-react'
import {
	onboardingCountryLabel,
	onboardingCountryOptions,
} from '@/pages/Home/onboardingCountries'
import { ONBOARDING_REGIONS_BY_COUNTRY } from '@/pages/Home/onboardingRegions'

/** Direct `<option>` nodes for a native `<select>`. Do not wrap these in a custom component. */
export function onboardingCountrySelectOptionElements(current?: string): React.ReactNode {
	const options = onboardingCountryOptions()
	const extra =
		current && !options.some((o) => o.value === current)
			? [{ value: current, label: onboardingCountryLabel(current) || current }]
			: []
	return extra.concat(options).map((o) => (
		<option key={o.value} value={o.value}>
			{o.label}
		</option>
	))
}

export function OnboardingCountrySelectOptions({
	current,
}: {
	current?: string
}): React.ReactElement {
	return <>{onboardingCountrySelectOptionElements(current)}</>
}

export function OnboardingProvinceControl({
	id,
	country,
	value,
	onChange,
	disabled,
	selectClassName,
	inputClassName,
	emptySelectLabel,
	noCountryLabel,
	freeTextPlaceholder,
	showChevron = true,
}: {
	id: string
	country: string
	value: string
	onChange: (next: string) => void
	disabled?: boolean
	selectClassName: string
	inputClassName?: string
	emptySelectLabel: string
	noCountryLabel: string
	freeTextPlaceholder: string
	showChevron?: boolean
}): React.ReactElement {
	const codedProvinces = country ? ONBOARDING_REGIONS_BY_COUNTRY[country] : undefined
	if (country && !(Array.isArray(codedProvinces) && codedProvinces.length > 0)) {
		return (
			<input
				id={id}
				type="text"
				value={value}
				maxLength={80}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value)}
				placeholder={freeTextPlaceholder}
				autoComplete="address-level1"
				className={inputClassName ?? selectClassName}
			/>
		)
	}
	const regions = country ? ONBOARDING_REGIONS_BY_COUNTRY[country] ?? [] : []
	const extra =
		value && !regions.some((r) => r.value === value) ? [{ value, label: value }] : []
	return (
		<div className="relative">
			<select
				id={id}
				key={`${id}-${country || 'none'}-${value || 'empty'}`}
				value={value}
				disabled={disabled || !country}
				onChange={(e) => {
					const next = e.target.value
					if (!next) {
						e.currentTarget.value = value
						return
					}
					onChange(next)
				}}
				className={selectClassName}
			>
				{value ? null : (
					<option value="" disabled>
						{country ? emptySelectLabel : noCountryLabel}
					</option>
				)}
				{extra.concat(regions).map(({ value: code, label }) => (
					<option key={code} value={code}>
						{label}
					</option>
				))}
			</select>
			{showChevron ? (
				<ChevronDown
					className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#747779]"
					aria-hidden
				/>
			) : null}
		</div>
	)
}
