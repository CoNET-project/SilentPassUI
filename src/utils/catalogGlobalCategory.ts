/** Catalog global category — mirrors bizSite / x402sdk `couponMetadataCategory` catalog slice. */

export const BEAMIO_COUPON_NFT_CATEGORY = 'Coupon' as const

export const BEAMIO_PRODUCTION_NFT_CATEGORY = 'productions' as const

export const CATALOG_GLOBAL_CATEGORY_OPTIONS = [
	{ id: 'Product', label: 'Product' },
	{ id: 'Service', label: 'Service' },
	{ id: 'Menu', label: 'Menu' },
	{ id: 'ShareLink', label: 'Share link' },
	{ id: 'SalesManagement', label: 'Sales Management' },
] as const

export type CatalogGlobalCategoryId = (typeof CATALOG_GLOBAL_CATEGORY_OPTIONS)[number]['id']

export const DEFAULT_CATALOG_GLOBAL_CATEGORY: CatalogGlobalCategoryId = 'Service'

export function isCatalogGlobalCategoryId(value: unknown): value is CatalogGlobalCategoryId {
	return (
		typeof value === 'string' &&
		CATALOG_GLOBAL_CATEGORY_OPTIONS.some((opt) => opt.id === value.trim())
	)
}

export function normalizeCatalogGlobalCategory(raw: unknown): CatalogGlobalCategoryId {
	if (isCatalogGlobalCategoryId(raw)) return raw.trim() as CatalogGlobalCategoryId
	const legacy = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
	if (legacy === BEAMIO_PRODUCTION_NFT_CATEGORY) return DEFAULT_CATALOG_GLOBAL_CATEGORY
	return DEFAULT_CATALOG_GLOBAL_CATEGORY
}

export function catalogGlobalCategoryLabel(id: CatalogGlobalCategoryId): string {
	return CATALOG_GLOBAL_CATEGORY_OPTIONS.find((opt) => opt.id === id)?.label ?? id
}

export function isCouponNftCategory(value: unknown): boolean {
	return typeof value === 'string' && value.trim().toLowerCase() === BEAMIO_COUPON_NFT_CATEGORY.toLowerCase()
}

export function isCatalogNftCategory(value: unknown): boolean {
	if (isCatalogGlobalCategoryId(value)) return true
	return typeof value === 'string' && value.trim().toLowerCase() === BEAMIO_PRODUCTION_NFT_CATEGORY.toLowerCase()
}

export function readMetadataGlobalCategory(meta: Record<string, unknown> | null | undefined): CatalogGlobalCategoryId {
	if (!meta || typeof meta !== 'object') return DEFAULT_CATALOG_GLOBAL_CATEGORY
	const props =
		meta.properties && typeof meta.properties === 'object' && !Array.isArray(meta.properties)
			? (meta.properties as Record<string, unknown>)
			: null
	const beamioProduction =
		props?.beamioProduction && typeof props.beamioProduction === 'object' && !Array.isArray(props.beamioProduction)
			? (props.beamioProduction as Record<string, unknown>)
			: null
	const candidates = [meta.category, beamioProduction?.category]
	for (const raw of candidates) {
		if (isCatalogGlobalCategoryId(raw)) return raw.trim() as CatalogGlobalCategoryId
	}
	for (const raw of candidates) {
		if (typeof raw === 'string' && raw.trim().toLowerCase() === BEAMIO_PRODUCTION_NFT_CATEGORY.toLowerCase()) {
			return DEFAULT_CATALOG_GLOBAL_CATEGORY
		}
	}
	return DEFAULT_CATALOG_GLOBAL_CATEGORY
}
