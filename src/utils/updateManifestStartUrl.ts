/**
 * 动态更新 PWA manifest 的 start_url，使「添加到主屏幕」时能携带当前 URL 参数（如 beamioTag、MasterKey）。
 * Merchant OS 挂在 /biz/；勿指向 Consumer PWA 的 /app/manifest.json（biz.beamio.app 上会 404）。
 * 使用 cache-busting (_v) 并预取 manifest，避免浏览器使用旧缓存导致 Add to Home Screen 显示错误 URL。
 */
export function updateManifestStartUrl(startUrl: string): void {
	if (typeof window === 'undefined') return
	try {
		const ts = Date.now()
		const publicUrl = (process.env.PUBLIC_URL || '/biz').replace(/\/$/, '')
		const manifestUrl = `${window.location.origin}${publicUrl}/manifest.json?start_url=${encodeURIComponent(startUrl)}&_v=${ts}`
		const existing = document.querySelector('link[rel="manifest"]')
		if (existing) {
			existing.remove()
		}
		const link = document.createElement('link')
		link.rel = 'manifest'
		link.href = manifestUrl
		document.head.appendChild(link)
		// 预取 manifest 以刷新缓存，确保 Add to Home Screen 时使用最新 start_url
		fetch(manifestUrl, { cache: 'reload' }).catch(() => {})
	} catch (_) {
		// ignore
	}
}

/** 先刷新 manifest 再执行 callback，用于 Add to Home Screen 前确保 manifest 已更新 */
export function refreshManifestThen(onDone: () => void): void {
	if (typeof window === 'undefined') return onDone()
	updateManifestStartUrl(window.location.href)
	// 短暂延迟确保 DOM 更新后 browser 能读到新 manifest link
	setTimeout(onDone, 150)
}
