/**
 * Factory / Start Kit default card0 assets — not merchant branding.
 * Self-contained (Worker-safe; do not import ipfsImageLibrary).
 *
 * Hashes from x402sdk default metadata image URLs:
 * - beamioMaster DEFAULT_METADATA_IMAGE_URL (62-hex, not padded)
 * - beamioFragmentImageProxy / beamioServer DEFAULT_METADATA_FRAGMENT_HASH
 * - BUSINESS_START_KET_METADATA_IMAGE_URL (Start Kit “B” wordmark; reused on many cards)
 */

const FACTORY_DEFAULT_HASH_NEEDLES = [
	'44e7a175e57a337bf5d0a98deb19a0a545e362d504092a7af1aecd58798eab',
	'6022e4efb44990767d1faa1642f570ed8a49ab0417b370aaae35f84884061c97',
	'3e94721678833790ab22c27fd80d2206c90847094c7a7331513aff361f0c83e5',
]

export function isFactoryDefaultMerchantAssetUrl(url: string | undefined | null): boolean {
	if (typeof url !== 'string') return false
	const t = url.trim().toLowerCase()
	if (!t) return false
	if (/default_card\.json/i.test(t)) return true
	return FACTORY_DEFAULT_HASH_NEEDLES.some((needle) => t.includes(needle))
}

export function pickNonFactoryMerchantAssetUrl(
	...urls: Array<string | undefined | null>
): string | undefined {
	for (const u of urls) {
		const t = typeof u === 'string' ? u.trim() : ''
		if (!t) continue
		if (!isFactoryDefaultMerchantAssetUrl(t)) return t
	}
	return undefined
}
