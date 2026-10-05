/**
 * Chromium reports "ResizeObserver loop completed with undelivered
 * notifications" when an observer callback mutates layout in the same
 * delivery. That is not an application crash. webpack-dev-server's overlay
 * still treats it as an uncaught runtime error and covers the page.
 *
 * Swallow only this known message so Discover (and other) local preview stays usable.
 */
const RESIZE_OBSERVER_LOOP =
	/ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i

function isResizeObserverLoopError(value: unknown): boolean {
	if (typeof value === 'string') return RESIZE_OBSERVER_LOOP.test(value)
	if (value instanceof Error) return RESIZE_OBSERVER_LOOP.test(value.message)
	return false
}

function dismissWebpackRuntimeOverlay(): void {
	const iframe = document.getElementById('webpack-dev-server-client-overlay')
	if (iframe?.parentNode) iframe.parentNode.removeChild(iframe)
}

export function ignoreResizeObserverLoopError(): void {
	if (typeof window === 'undefined') return

	dismissWebpackRuntimeOverlay()

	window.addEventListener(
		'error',
		(event) => {
			if (
				!isResizeObserverLoopError(event.message) &&
				!isResizeObserverLoopError(event.error)
			) {
				return
			}
			event.stopImmediatePropagation()
			event.preventDefault()
			dismissWebpackRuntimeOverlay()
		},
		true,
	)
}

ignoreResizeObserverLoopError()
