/**
 * Align with bizSite / x402sdk `appendAppDownloadCacheBust`.
 * WhatsApp/Meta cache OG by the pasted URL — without `v=`, a prior failed scrape sticks.
 */
export function appendAppDownloadShareCacheBust(
	appDownloadUrl: string,
	cacheBustV: string = String(Date.now()),
): string {
	const vTrim = cacheBustV.trim()
	if (!vTrim) return appDownloadUrl
	try {
		const u = new URL(appDownloadUrl)
		u.searchParams.set('v', vTrim)
		return u.toString()
	} catch {
		return appDownloadUrl
	}
}
