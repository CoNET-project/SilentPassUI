/** Province/state options keyed by country code (matches country <select> values). */
export const ONBOARDING_REGIONS_BY_COUNTRY: Readonly<
	Record<string, readonly { value: string; label: string }[]>
> = {
	CA: [
		{ value: "AB", label: "Alberta" },
		{ value: "BC", label: "British Columbia" },
		{ value: "MB", label: "Manitoba" },
		{ value: "NB", label: "New Brunswick" },
		{ value: "NL", label: "Newfoundland and Labrador" },
		{ value: "NS", label: "Nova Scotia" },
		{ value: "NT", label: "Northwest Territories" },
		{ value: "NU", label: "Nunavut" },
		{ value: "ON", label: "Ontario" },
		{ value: "PE", label: "Prince Edward Island" },
		{ value: "QC", label: "Quebec" },
		{ value: "SK", label: "Saskatchewan" },
		{ value: "YT", label: "Yukon" },
	],
	US: [
		{ value: "AL", label: "Alabama" },
		{ value: "AK", label: "Alaska" },
		{ value: "AZ", label: "Arizona" },
		{ value: "AR", label: "Arkansas" },
		{ value: "CA", label: "California" },
		{ value: "CO", label: "Colorado" },
		{ value: "CT", label: "Connecticut" },
		{ value: "DE", label: "Delaware" },
		{ value: "DC", label: "District of Columbia" },
		{ value: "FL", label: "Florida" },
		{ value: "GA", label: "Georgia" },
		{ value: "HI", label: "Hawaii" },
		{ value: "ID", label: "Idaho" },
		{ value: "IL", label: "Illinois" },
		{ value: "IN", label: "Indiana" },
		{ value: "IA", label: "Iowa" },
		{ value: "KS", label: "Kansas" },
		{ value: "KY", label: "Kentucky" },
		{ value: "LA", label: "Louisiana" },
		{ value: "ME", label: "Maine" },
		{ value: "MD", label: "Maryland" },
		{ value: "MA", label: "Massachusetts" },
		{ value: "MI", label: "Michigan" },
		{ value: "MN", label: "Minnesota" },
		{ value: "MS", label: "Mississippi" },
		{ value: "MO", label: "Missouri" },
		{ value: "MT", label: "Montana" },
		{ value: "NE", label: "Nebraska" },
		{ value: "NV", label: "Nevada" },
		{ value: "NH", label: "New Hampshire" },
		{ value: "NJ", label: "New Jersey" },
		{ value: "NM", label: "New Mexico" },
		{ value: "NY", label: "New York" },
		{ value: "NC", label: "North Carolina" },
		{ value: "ND", label: "North Dakota" },
		{ value: "OH", label: "Ohio" },
		{ value: "OK", label: "Oklahoma" },
		{ value: "OR", label: "Oregon" },
		{ value: "PA", label: "Pennsylvania" },
		{ value: "RI", label: "Rhode Island" },
		{ value: "SC", label: "South Carolina" },
		{ value: "SD", label: "South Dakota" },
		{ value: "TN", label: "Tennessee" },
		{ value: "TX", label: "Texas" },
		{ value: "UT", label: "Utah" },
		{ value: "VT", label: "Vermont" },
		{ value: "VA", label: "Virginia" },
		{ value: "WA", label: "Washington" },
		{ value: "WV", label: "West Virginia" },
		{ value: "WI", label: "Wisconsin" },
		{ value: "WY", label: "Wyoming" },
	],
	GB: [
		{ value: "ENG", label: "England" },
		{ value: "SCT", label: "Scotland" },
		{ value: "WLS", label: "Wales" },
		{ value: "NIR", label: "Northern Ireland" },
	],
	AU: [
		{ value: "ACT", label: "Australian Capital Territory" },
		{ value: "NSW", label: "New South Wales" },
		{ value: "NT", label: "Northern Territory" },
		{ value: "QLD", label: "Queensland" },
		{ value: "SA", label: "South Australia" },
		{ value: "TAS", label: "Tasmania" },
		{ value: "VIC", label: "Victoria" },
		{ value: "WA", label: "Western Australia" },
	],
	DE: [
		{ value: "BW", label: "Baden-Württemberg" },
		{ value: "BY", label: "Bavaria" },
		{ value: "BE", label: "Berlin" },
		{ value: "BB", label: "Brandenburg" },
		{ value: "HB", label: "Bremen" },
		{ value: "HH", label: "Hamburg" },
		{ value: "HE", label: "Hesse" },
		{ value: "MV", label: "Mecklenburg-Vorpommern" },
		{ value: "NI", label: "Lower Saxony" },
		{ value: "NW", label: "North Rhine-Westphalia" },
		{ value: "RP", label: "Rhineland-Palatinate" },
		{ value: "SL", label: "Saarland" },
		{ value: "SN", label: "Saxony" },
		{ value: "ST", label: "Saxony-Anhalt" },
		{ value: "SH", label: "Schleswig-Holstein" },
		{ value: "TH", label: "Thuringia" },
	],
}

function foldOnboardingRegionKey(s: string): string {
	return s
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

/** Independent copy of Cluster province aliases — do not import x402sdk. */
const EXTRA_ONBOARDING_PROVINCE_ALIASES: Record<string, Record<string, string>> = {
	CA: {
		卑诗: 'BC',
		卑詩: 'BC',
		不列颠哥伦比亚: 'BC',
		不列顛哥倫比亞: 'BC',
		安大略: 'ON',
		魁北克: 'QC',
		阿尔伯塔: 'AB',
		阿爾伯塔: 'AB',
	},
	US: {
		加州: 'CA',
		加利福尼亚: 'CA',
		加利福尼亞: 'CA',
		纽约: 'NY',
		紐約: 'NY',
		德州: 'TX',
		得克萨斯: 'TX',
	},
	GB: {
		英格兰: 'ENG',
		英格蘭: 'ENG',
		苏格兰: 'SCT',
		蘇格蘭: 'SCT',
		威尔士: 'WLS',
		威爾士: 'WLS',
	},
	AU: {
		新南威尔士: 'NSW',
		新南威爾士: 'NSW',
		维多利亚: 'VIC',
		維多利亞: 'VIC',
	},
	DE: {
		bayern: 'BY',
		nrw: 'NW',
		nordrheinwestfalen: 'NW',
		巴伐利亚: 'BY',
		巴伐利亞: 'BY',
	},
}

export function hasCodedOnboardingProvinces(country: string): boolean {
	const regions = ONBOARDING_REGIONS_BY_COUNTRY[country]
	return Array.isArray(regions) && regions.length > 0
}

/** Map a full name or alias onto the region `value` code. Uncoded countries keep clipped free text. */
export function normalizeOnboardingProvince(country: string, raw: string): string {
	if (!country) return ''
	const t = raw.trim()
	if (!t || /^unknown$/i.test(t)) return ''
	const regions = ONBOARDING_REGIONS_BY_COUNTRY[country]
	if (!regions?.length) return t.slice(0, 80)
	const upper = t.toUpperCase()
	if (regions.some((r) => r.value === upper)) return upper
	const folded = foldOnboardingRegionKey(t)
	const byLabel = regions.find(
		(r) => foldOnboardingRegionKey(r.label) === folded || foldOnboardingRegionKey(r.value) === folded,
	)
	if (byLabel) return byLabel.value
	const extras = EXTRA_ONBOARDING_PROVINCE_ALIASES[country]
	if (!extras) return ''
	for (const [alias, code] of Object.entries(extras)) {
		if (foldOnboardingRegionKey(alias) === folded) return code
	}
	return ''
}
