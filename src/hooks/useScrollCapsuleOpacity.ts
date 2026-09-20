import { useCallback, useEffect, useRef, useState } from 'react'

const THRESHOLD = 40
const FADE_RANGE = 100
/** Ignore sub-pixel scroll noise that would thrash Home re-renders / layout. */
const OPACITY_EPS = 0.02

const computeOpacity = (scrollTop: number) =>
	scrollTop <= THRESHOLD ? 1 : Math.max(0, 1 - (scrollTop - THRESHOLD) / FADE_RANGE)

function syncCapsulePointerEvents(layer: HTMLElement, opacity: number): void {
	const pe = opacity < 0.05 ? 'none' : 'auto'
	layer.style.pointerEvents = pe
	layer.querySelectorAll('[data-capsule-interactive]').forEach((el) => {
		;(el as HTMLElement).style.pointerEvents = pe
	})
}

function applyOpacityToLayer(layer: HTMLElement, next: number): void {
	layer.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out'
	layer.style.opacity = String(next)
	// Native WebViews can keep a translucent fixed layer visually present while
	// compositing. Move the layer with the fade so it is unambiguously hidden.
	layer.style.transform = `translate3d(0, ${-(1 - next) * 100}%, 0)`
	syncCapsulePointerEvents(layer, next)
}

/**
 * 根据滚动容器的 scrollTop 计算固定顶栏胶囊不透明度。
 * 全项目守则：beamio-fixed-top-capsule-protocol.mdc（THRESHOLD=40，FADE_RANGE=100）
 * - onScroll + ref 绑定到 overflow-y-auto 主滚动区
 * - document capture 兜底（部分 WebView 下 React onScroll 不触发）
 * - 绑定 setLayerRef 时滚动只写 DOM opacity，不 setState，避免 /home 整页重绘抖动
 * - 未绑 layerRef 的页面仍走 React opacity state（向后兼容）
 */
export function useScrollCapsuleOpacity(enabled = true) {
	const [opacity, setOpacity] = useState(1)
	const scrollRef = useRef<HTMLDivElement | null>(null)
	const layerRef = useRef<HTMLElement | null>(null)
	const opacityRef = useRef(1)
	const lastScrollTopRef = useRef(0)
	const latestScrollTopRef = useRef(0)
	const rafRef = useRef<number | null>(null)
	const hideUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const revealPendingDistanceRef = useRef(0)
	const revealArmedRef = useRef(false)
	const revealReadyRef = useRef(false)

	const commitOpacity = useCallback((next: number) => {
		if (Math.abs(next - opacityRef.current) < OPACITY_EPS) {
			// Snap to exact 0 / 1 endpoints so we still settle.
			if (next > 0 && next < 1) return
			if (next === opacityRef.current) return
		}
		opacityRef.current = next
		const layer = layerRef.current
		if (layer) {
			applyOpacityToLayer(layer, next)
			return
		}
		setOpacity(next)
	}, [])

	const scheduleOpacity = useCallback(
		(scrollTop: number) => {
			if (!enabled) return
			const previousScrollTop = lastScrollTopRef.current
			const scrollDelta = scrollTop - previousScrollTop
			lastScrollTopRef.current = scrollTop
			latestScrollTopRef.current = scrollTop
			if (scrollDelta > 0) {
				revealArmedRef.current = false
				revealReadyRef.current = false
				revealPendingDistanceRef.current = 0
				if (revealTimerRef.current != null) {
					clearTimeout(revealTimerRef.current)
					revealTimerRef.current = null
				}
				// Let the first downward event start the hide animation. Ignore
				// subsequent downward noise until that animation settles.
				if (hideUnlockTimerRef.current != null) return
				const next = computeOpacity(scrollTop)
				hideUnlockTimerRef.current = setTimeout(() => {
					hideUnlockTimerRef.current = null
					if (latestScrollTopRef.current > THRESHOLD && opacityRef.current > 0) {
						commitOpacity(computeOpacity(latestScrollTopRef.current))
					}
				}, 300)
				if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
				rafRef.current = requestAnimationFrame(() => {
					rafRef.current = null
					commitOpacity(next)
				})
				return
			}
			if (scrollDelta < 0 && opacityRef.current < 1) {
				revealPendingDistanceRef.current += Math.abs(scrollDelta)
				if (revealReadyRef.current) {
					const pending = revealPendingDistanceRef.current
					revealPendingDistanceRef.current = 0
					commitOpacity(Math.min(1, opacityRef.current + pending / FADE_RANGE))
					return
				}
				if (!revealArmedRef.current) {
					revealArmedRef.current = true
					revealTimerRef.current = setTimeout(() => {
						revealTimerRef.current = null
						revealArmedRef.current = false
						revealReadyRef.current = true
						const pending = revealPendingDistanceRef.current
						revealPendingDistanceRef.current = 0
						if (pending <= 0 || opacityRef.current >= 1) return
						commitOpacity(Math.min(1, opacityRef.current + pending / FADE_RANGE))
					}, 500)
				}
				return
			}
			if (scrollDelta === 0 && scrollTop <= THRESHOLD) {
				commitOpacity(1)
			}
		},
		[commitOpacity, enabled]
	)

	const onScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			scheduleOpacity(e.currentTarget.scrollTop)
		},
		[scheduleOpacity]
	)

	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			scrollRef.current = node
			if (node) {
				lastScrollTopRef.current = node.scrollTop
				commitOpacity(computeOpacity(node.scrollTop))
			}
		},
		[commitOpacity]
	)

	const setLayerRef = useCallback(
		(node: HTMLElement | null) => {
			layerRef.current = node
			if (node) applyOpacityToLayer(node, opacityRef.current)
		},
		[]
	)

	/** Remounted capsule controls (e.g. Home NFC +) need pointer-events re-synced. */
	const resyncLayerPointerEvents = useCallback(() => {
		const layer = layerRef.current
		if (layer) syncCapsulePointerEvents(layer, opacityRef.current)
	}, [])

	useEffect(() => {
		if (!enabled) {
			commitOpacity(0)
			return
		}
		const top = scrollRef.current?.scrollTop ?? 0
		commitOpacity(computeOpacity(top))
	}, [commitOpacity, enabled])

	useEffect(() => {
		const layer = layerRef.current
		if (!layer || typeof MutationObserver === 'undefined') return
		const mo = new MutationObserver(() => {
			syncCapsulePointerEvents(layer, opacityRef.current)
		})
		mo.observe(layer, { childList: true, subtree: true })
		return () => mo.disconnect()
	}, [enabled])

	// document capture 兜底：部分页面（Chat/Market）onScroll 可能不触发，用原生监听确保能捕获
	useEffect(() => {
		if (!enabled) return
		const handler = (e: Event) => {
			const target = e.target
			const scrollNode = scrollRef.current
			const isKnownScrollTarget =
				target === scrollNode ||
				target === document ||
				target === document.documentElement ||
				target === document.body ||
				target === window
			if (!isKnownScrollTarget) return
			const top =
				target === window || target === document
					? window.scrollY
					: typeof (target as HTMLElement).scrollTop === 'number'
						? (target as HTMLElement).scrollTop
						: scrollNode?.scrollTop ?? 0
			scheduleOpacity(top)
		}
		document.addEventListener('scroll', handler, { passive: true, capture: true })
		window.addEventListener('scroll', handler, { passive: true })
		const scrollNode = scrollRef.current
		if (scrollNode) {
			scrollNode.addEventListener('scroll', handler, { passive: true })
		}
		return () => {
			document.removeEventListener('scroll', handler, true)
			window.removeEventListener('scroll', handler)
			scrollNode?.removeEventListener('scroll', handler)
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
			if (hideUnlockTimerRef.current != null) clearTimeout(hideUnlockTimerRef.current)
			if (revealTimerRef.current != null) clearTimeout(revealTimerRef.current)
		}
	}, [enabled, scheduleOpacity])

	return { opacity, onScroll, setRef, setLayerRef, resyncLayerPointerEvents }
}
