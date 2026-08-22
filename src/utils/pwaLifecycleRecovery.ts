/**
 * Keep an embedded PWA's layout and native bridge state coherent after iOS
 * restores a WebView from the background. The native shell owns process reload;
 * this layer only repairs browser-side rendering state and notifies consumers.
 */
const PWA_RESUMED_EVENT = 'beamio:pwa-resumed'

export function installPwaLifecycleRecovery(): () => void {
	let frame: number | undefined

	const notifyResume = () => {
		if (frame != null) cancelAnimationFrame(frame)
		frame = requestAnimationFrame(() => {
			frame = undefined
			// Wake a restored compositor without touching overlay overflow locks.
			const root = document.documentElement
			const prevTransform = root.style.transform
			root.style.transform = 'translateZ(0)'
			void root.offsetHeight
			root.style.transform = prevTransform
			window.dispatchEvent(new CustomEvent(PWA_RESUMED_EVENT))
			// Force WebKit to recalculate viewport-dependent layout after restore.
			window.dispatchEvent(new Event('resize'))
		})
	}

	const onVisibilityChange = () => {
		if (document.visibilityState === 'visible') notifyResume()
	}
	const onPageShow = () => notifyResume()

	document.addEventListener('visibilitychange', onVisibilityChange)
	window.addEventListener('pageshow', onPageShow)
	notifyResume()

	return () => {
		document.removeEventListener('visibilitychange', onVisibilityChange)
		window.removeEventListener('pageshow', onPageShow)
		if (frame != null) cancelAnimationFrame(frame)
	}
}
