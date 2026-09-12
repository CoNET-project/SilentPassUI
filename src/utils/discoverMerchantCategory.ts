/** Discover / My Brands merchant category — aligned with Market.tsx `DiscoverCategoryTab` + biz `CARD_ISSUANCE_CATEGORY_OPTIONS`. */

export type DiscoverCategoryTab =
	| 'food-beverage'
	| 'grocery-convenience'
	| 'retail-shopping'
	| 'education-training'
	| 'health-beauty'
	| 'fitness-wellness'
	| 'entertainment-leisure'
	| 'local-services'

export const DISCOVER_CATEGORY_LABEL_BY_ID: Record<DiscoverCategoryTab, string> = {
	'food-beverage': 'Food & Beverage',
	'grocery-convenience': 'Grocery & Convenience',
	'retail-shopping': 'Retail & Shopping',
	'education-training': 'Education & Training',
	'health-beauty': 'Health & Beauty',
	'fitness-wellness': 'Fitness & Wellness',
	'entertainment-leisure': 'Entertainment & Leisure',
	'local-services': 'Local Services',
}

export function discoverCategoryLabel(category: DiscoverCategoryTab): string {
	return DISCOVER_CATEGORY_LABEL_BY_ID[category] ?? DISCOVER_CATEGORY_LABEL_BY_ID['local-services']
}

/** Read the canonical business profile category, with categories[] as a legacy fallback. */
export function parseDiscoverPrimaryCategoryId(meta: Record<string, unknown> | null): string | null {
	if (meta == null) return null
	const share =
		meta.shareTokenMetadata != null && typeof meta.shareTokenMetadata === 'object'
			? (meta.shareTokenMetadata as Record<string, unknown>)
			: null
	const businessProfile =
		share?.businessProfile != null && typeof share.businessProfile === 'object'
			? (share.businessProfile as Record<string, unknown>)
			: null
	const businessProfileCategory = businessProfile?.category
	if (typeof businessProfileCategory === 'string' && businessProfileCategory.trim()) {
		return businessProfileCategory.trim().toLowerCase()
	}
	const raw = share?.categories
	if (!Array.isArray(raw) || raw.length === 0) return null
	for (const c of raw) {
		if (typeof c === 'string' && c.trim()) return c.trim().toLowerCase()
	}
	return null
}

export function discoverProgramDescriptionFromMetadata(meta: Record<string, unknown> | null): string {
	if (meta == null) return ''
	const share =
		meta.shareTokenMetadata != null && typeof meta.shareTokenMetadata === 'object'
			? (meta.shareTokenMetadata as Record<string, unknown>)
			: null
	const descRaw = share?.description ?? meta.description
	return typeof descRaw === 'string' ? descRaw.trim() : ''
}

export function discoverCategoryFieldsFromMetadataRoot(metaJson: Record<string, unknown>): {
	categoryId: string | null
	programDescription: string
} {
	return {
		categoryId: parseDiscoverPrimaryCategoryId(metaJson),
		programDescription: discoverProgramDescriptionFromMetadata(metaJson),
	}
}

export type DiscoverMerchantCategoryInput = {
	name: string
	programDescription?: string
	categoryId?: string | null
}

export function classifyDiscoverMerchantCategory(input: DiscoverMerchantCategoryInput): DiscoverCategoryTab {
	const name = (input.name || '').toLowerCase()
	const description = (input.programDescription || '').toLowerCase()
	const category = (input.categoryId ?? '').toLowerCase()
	// A declared merchant category is authoritative. `local-services` remains
	// the legacy/default bucket, so heuristics may still refine that value.
	if (category === 'food-beverage' || category === 'food') return 'food-beverage'
	if (category === 'grocery-convenience') return 'grocery-convenience'
	if (category === 'retail-shopping' || category === 'shopping') return 'retail-shopping'
	if (category === 'education-training') return 'education-training'
	if (category === 'fitness-wellness') return 'fitness-wellness'
	if (category === 'entertainment-leisure' || category === 'movies') return 'entertainment-leisure'
	const foodNameOrCopy =
		/restaurant|dining|bistro|kitchen|steakhouse|noodle|\bpoke\b|\bpho\b|cuisine|dumpling|xiaolong|xiao long|dim\s*sum|shanghainese|longdhang|老弄堂|弄堂|餐厅|饭店|酒楼|火锅|烧烤|茶餐厅|面馆|小吃|美食|餐饮/.test(
			name,
		) ||
		/\bcafe\b|\bcafé\b|\bcoffee\b/.test(name) ||
		/restaurant|dining|bistro|kitchen|steak|cuisine|dumpling|xiaolong|xiao long|dim\s*sum|shanghainese|\bpoke\b|\bpho\b|老弄堂|弄堂|餐厅|饭店|酒楼|火锅|烧烤|茶餐厅|面馆|小吃|美食|餐饮/.test(
			description,
		)
	// Brand name / dining copy beats metadata tags and promo “wellness / store” wording.
	if (foodNameOrCopy) {
		return 'food-beverage'
	}
	if (category === 'health-beauty' || category === 'health' || category === 'beauty') return 'health-beauty'
	if (/\bbeauty\b|\bspa\b|\bsalon\b|medspa|barbershop|美容|护肤|美发|美甲|养生馆|水疗/.test(name)) {
		return 'health-beauty'
	}
	if (category === 'local-services') return 'local-services'
	if (/grocery|supermarket|mart|convenience|store/.test(name) || /grocery|supermarket|mart|convenience|store/.test(description)) {
		return 'grocery-convenience'
	}
	if (/retail|shopping|fashion|boutique|mall/.test(name) || /retail|shopping|fashion|boutique|mall/.test(description)) {
		return 'retail-shopping'
	}
	if (/education|school|academy|training|course|lesson/.test(name) || /education|school|academy|training|course|lesson/.test(description)) {
		return 'education-training'
	}
	if (/beauty|spa|salon|health|clinic|wellness/.test(name) || /beauty|spa|salon|health|clinic|wellness/.test(description)) {
		return 'health-beauty'
	}
	if (/gym|fitness|yoga|pilates|workout/.test(name) || /gym|fitness|yoga|pilates|workout/.test(description)) {
		return 'fitness-wellness'
	}
	if (/movie|cinema|game|gaming|theater|entertainment|leisure/.test(name) || /movie|cinema|game|gaming|theater|entertainment|leisure/.test(description)) {
		return 'entertainment-leisure'
	}
	if (
		category === 'food' ||
		/bar|wine/.test(name) ||
		/bar|wine/.test(description)
	) {
		return 'food-beverage'
	}
	if (
		/cof|cafe|roast|espresso|latte/.test(name) ||
		/cof|cafe|roast|espresso|latte/.test(description)
	) {
		return 'food-beverage'
	}
	return 'local-services'
}

/** My Brands left subtitle: human-readable Discover category for a held merchant card. */
export function resolveMyBrandMerchantCategoryLabel(
	detail:
		| {
				meta?: {
					name?: string
					categoryId?: string | null
					programDescription?: string
				} | null
		  }
		| undefined,
	fallbackName: string
): string {
	const meta = detail?.meta
	const category = classifyDiscoverMerchantCategory({
		name: (meta?.name && meta.name.trim()) || fallbackName.trim() || 'Merchant card',
		programDescription: meta?.programDescription ?? '',
		categoryId: meta?.categoryId ?? null,
	})
	return discoverCategoryLabel(category)
}
