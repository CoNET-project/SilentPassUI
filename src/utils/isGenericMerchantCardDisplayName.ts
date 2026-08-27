/** Placeholder titles — not merchant program display names. */
export function isGenericMerchantCardDisplayName(name: string | undefined | null): boolean {
	const t = String(name ?? '').trim()
	if (!t) return true
	if (/^beamio$/i.test(t)) return true
	if (/^(?:qr\s+)?merchant\s+payment$/i.test(t)) return true
	if (/^user\s+card$/i.test(t)) return true
	if (/^beamio\s+user\s+card(?:\s+points|\s+membership(?:\s*#\d+)?)?$/i.test(t)) return true
	if (/^merchant\s+pass$/i.test(t)) return true
	return false
}
