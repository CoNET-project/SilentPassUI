/**
 * 动态更新 PWA manifest 的 start_url，使「添加到主屏幕」时能携带当前 URL 参数（如 beamioTag、MasterKey）。
 * 方案：将 manifest link 指向 API /app/manifest.json?start_url=xxx，由服务端返回动态 manifest。
 */
export function updateManifestStartUrl(startUrl: string): void {
	if (typeof window === 'undefined') return
	try {
		const manifestUrl = `${window.location.origin}/app/manifest.json?start_url=${encodeURIComponent(startUrl)}`
		const existing = document.querySelector('link[rel="manifest"]')
		if (existing) {
			existing.remove()
		}
		const link = document.createElement('link')
		link.rel = 'manifest'
		link.href = manifestUrl
		document.head.appendChild(link)
	} catch (_) {
		// ignore
	}
}
