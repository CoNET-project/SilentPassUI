import type { CardActiveIssuedCouponSeriesItem } from '@/services/BeamioCard'
import type { MyBrandsOwnedCatalogSnapshot } from '@/utils/myBrandsFeedLocalCache'
import {
	catalogGlobalCategoryLabel,
	isCouponNftCategory,
	normalizeCatalogGlobalCategory,
	readMetadataGlobalCategory,
	type CatalogGlobalCategoryId,
} from '@/utils/catalogGlobalCategory'

const metaAsRecord = (v: unknown): Record<string, unknown> | null =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const metaString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function flattenProductionMetadata(meta: Record<string, unknown>): Record<string, unknown> {
	const props = metaAsRecord(meta.properties) ?? {}
	const fromProps = metaAsRecord(props.beamioProduction) ?? {}
	const fromRoot = metaAsRecord(meta.beamioProduction) ?? {}
	const productionId =
		metaString(meta.productionId) ||
		metaString(fromRoot.productionId) ||
		metaString(fromProps.productionId) ||
		metaString(meta.id) ||
		metaString(fromRoot.id) ||
		metaString(fromProps.id) ||
		''
	return {
		...meta,
		...fromProps,
		...fromRoot,
		...(productionId ? { productionId, id: productionId } : {}),
	}
}

function readProductionId(meta: Record<string, unknown>): string {
	const flat = flattenProductionMetadata(meta)
	return metaString(flat.productionId) || metaString(flat.id)
}

function metadataLooksLikeCoupon(meta: Record<string, unknown>): boolean {
	if (isCouponNftCategory(meta.category)) return true
	if (metaString(meta.couponId)) return true
	const props = metaAsRecord(meta.properties)
	const beamioCoupon = metaAsRecord(props?.beamioCoupon)
	if (beamioCoupon && metaString(beamioCoupon.couponId)) return true
	return false
}

export function mapMyBrandsOwnedCatalog(
	row: CardActiveIssuedCouponSeriesItem,
	cardAddress: string,
): MyBrandsOwnedCatalogSnapshot | null {
	const meta = metaAsRecord(row.metadata)
	if (!meta) return null
	if (metadataLooksLikeCoupon(meta)) return null

	const flat = flattenProductionMetadata(meta)
	const productionId = readProductionId(flat)
	if (!productionId) return null

	const globalCategory = readMetadataGlobalCategory(flat)
	const categoryLabel = catalogGlobalCategoryLabel(globalCategory)
	const title = metaString(flat.name) || metaString(flat.title) || categoryLabel || 'Catalog item'
	const description = metaString(flat.subtitle) || metaString(flat.description) || categoryLabel
	const iconUrl = metaString(flat.icon) || metaString(flat.iconUrl)
	const backgroundImage =
		metaString(flat.productionImage) ||
		metaString(flat.backgroundImage) ||
		metaString(flat.backgroundImageUrl) ||
		metaString(flat.cover) ||
		metaString(flat.coverImage)
	const rawBackgroundColor = metaString(flat.backgroundColor) || metaString(flat.backgroundColorHex)
	const validBeforeNum = Number(row.issuedNftValidBefore ?? 0)

	return {
		id: `${cardAddress.toLowerCase()}:${row.tokenId}`,
		cardAddress,
		tokenId: String(row.tokenId),
		productionId,
		globalCategory,
		title,
		subtitle: description,
		iconUrl,
		backgroundImage,
		backgroundColorHex: rawBackgroundColor
			? rawBackgroundColor.startsWith('#')
				? rawBackgroundColor
				: `#${rawBackgroundColor}`
			: '',
		validBeforeSec: Number.isFinite(validBeforeNum) && validBeforeNum > 0 ? validBeforeNum : null,
	}
}

export type OwnedCatalogSummary = {
	count: number
	firstTitle?: string
	firstCatalog?: MyBrandsOwnedCatalogSnapshot | null
	catalogs?: MyBrandsOwnedCatalogSnapshot[]
}

export function summarizeOwnedCatalogCards(
	rows: CardActiveIssuedCouponSeriesItem[] | null,
): Map<string, OwnedCatalogSummary> | null {
	if (rows === null) return null
	const out = new Map<string, OwnedCatalogSummary>()
	for (const row of rows) {
		const raw = row.cardAddress?.trim()
		if (!raw) continue
		const cardAddress = raw
		const key = cardAddress.toLowerCase()
		const mapped = mapMyBrandsOwnedCatalog({ ...row, cardAddress }, cardAddress)
		if (!mapped) continue
		const prev = out.get(key)
		const catalogs = [...(prev?.catalogs ?? [])]
		if (!catalogs.some((c) => c.id === mapped.id)) catalogs.push(mapped)
		out.set(key, {
			count: (prev?.count ?? 0) + 1,
			firstTitle: prev?.firstTitle || mapped.title,
			firstCatalog: prev?.firstCatalog ?? mapped,
			catalogs,
		})
	}
	return out
}

export function ownedCatalogGlobalCategoryLabel(category: CatalogGlobalCategoryId | string): string {
	return catalogGlobalCategoryLabel(normalizeCatalogGlobalCategory(category))
}
