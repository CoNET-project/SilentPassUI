import { isGenericMerchantCardDisplayName } from './isGenericMerchantCardDisplayName'
import { isFactoryDefaultMerchantAssetUrl } from './isFactoryDefaultMerchantAssetUrl'

export type MerchantCardMetaLike = {
	name?: string
	icon?: string
	image?: string
	tiers?: unknown
}

function hasTiers(meta: MerchantCardMetaLike | null | undefined): boolean {
	return Array.isArray(meta?.tiers) && (meta?.tiers?.length ?? 0) > 0
}

function isWeakAsset(url: string | undefined | null): boolean {
	const t = String(url ?? '').trim()
	return !t || isFactoryDefaultMerchantAssetUrl(t)
}

function pickAsset(
	incoming: string | undefined,
	prev: string | undefined,
): string | undefined {
	if (!isWeakAsset(incoming)) return incoming
	if (!isWeakAsset(prev)) return prev
	return undefined
}

/**
 * Merge merchant card branding. Generic ERC-1155 card0 titles
 * ("Beamio User Card Points") and factory swirl icons/images must not
 * overwrite a previously trusted merchant name / icon / image, even when
 * incoming metadata still has loyalty `tiers[]`.
 */
export function mergeRicherMerchantCardMeta<T extends MerchantCardMetaLike>(
	prev: T | null | undefined,
	incoming: T | null | undefined,
): T | null {
	if (!incoming) return (prev ?? null) as T | null
	if (!prev) {
		return {
			...incoming,
			icon: pickAsset(incoming.icon, undefined),
			image: pickAsset(incoming.image, undefined),
		} as T
	}

	const incomingGeneric = isGenericMerchantCardDisplayName(incoming.name)
	const prevGeneric = isGenericMerchantCardDisplayName(prev.name)
	const incomingWeakBranding =
		incomingGeneric && isWeakAsset(incoming.icon) && isWeakAsset(incoming.image)

	const name =
		incoming.name && !incomingGeneric
			? incoming.name
			: prev.name && !prevGeneric
				? prev.name
				: incoming.name || prev.name

	const icon = pickAsset(incoming.icon, prev.icon)
	const image = pickAsset(incoming.image, prev.image)
	// Default card0 often still ships a dummy Base tier (#1562f0). Do not let
	// that overwrite a previously trusted merchant `tiers[]` (real colors / images).
	const tiers =
		hasTiers(incoming) && !incomingWeakBranding
			? incoming.tiers
			: (prev.tiers ?? incoming.tiers)

	return {
		...prev,
		...incoming,
		...(name ? { name } : {}),
		icon,
		image,
		...(tiers != null ? { tiers } : {}),
	} as T
}
