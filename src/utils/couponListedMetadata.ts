/** Merchant delisted coupon (`disable: true` in series / shareTokenMetadata). Mirror x402sdk couponMetadataCategory. */

export function readCouponDisabledFromMetadata(meta: unknown): boolean {
	if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
	const m = meta as Record<string, unknown>
	if (m.disable === true) return true
	const props = m.properties
	if (props && typeof props === 'object' && !Array.isArray(props)) {
		const beamioCoupon = (props as Record<string, unknown>).beamioCoupon
		if (
			beamioCoupon &&
			typeof beamioCoupon === 'object' &&
			!Array.isArray(beamioCoupon) &&
			(beamioCoupon as Record<string, unknown>).disable === true
		) {
			return true
		}
	}
	return false
}

export function filterListedCouponSeriesRows<T extends { metadata?: unknown | null }>(rows: T[]): T[] {
	return rows.filter((row) => !readCouponDisabledFromMetadata(row.metadata ?? null))
}
