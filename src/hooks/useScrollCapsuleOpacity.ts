import { useCallback, useEffect, useRef, useState } from 'react'

const THRESHOLD = 40
const FADE_RANGE = 100
/** Ignore sub-pixel scroll noise that would thrash Home re-renders / layout. */
const OPACITY_EPS = 0.02

const computeOpacity = (scrollTop: number) =>
	scrollTop <= THRESHOLD ? 1 : Math.max(0, 1 - (scrollTop - THRESHOLD) / FADE_RANGE)

/**
 * 根据滚动容器的 scrollTop 计算固定顶栏胶囊不透明度。
 * 全项目守则：beamio-fixed-top-capsule-protocol.mdc（THRESHOLD=40，FADE_RANGE=100）
 * - onScroll + ref 绑定到 overflow-y-auto 主滚动区
 * - document capture 兜底（部分 WebView 下 React onScroll 不触发）
 * - 仅在透明度变化超过 OPACITY_EPS 时 setState，避免 /home 亚像素抖动反馈环
 */
export function useScrollCapsuleOpacity(enabled = true) {
	const [opacity, setOpacity] = useState(1)
	const ref = useRef<HTMLDivElement | null>(null)
	const opacityRef = useRef(1)
	const rafRef = useRef<number | null>(null)

	const commitOpacity = useCallback((next: number) => {
		if (Math.abs(next - opacityRef.current) < OPACITY_EPS) {
			// Snap to exact 0 / 1 endpoints so we still settle.
			if (next > 0 && next < 1) return
			if (next === opacityRef.current) return
		}
		opacityRef.current = next
		setOpacity(next)
	}, [])

	const scheduleOpacity = useCallback(
		(scrollTop: number) => {
			if (!enabled) return
			const next = computeOpacity(scrollTop)
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null
				commitOpacity(next)
			})
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
			ref.current = node
			if (node) commitOpacity(computeOpacity(node.scrollTop))
		},
		[commitOpacity]
	)

	useEffect(() => {
		if (!enabled || !ref.current) return
		commitOpacity(computeOpacity(ref.current.scrollTop))
	}, [commitOpacity, enabled])

	// document capture 兜底：部分页面（Chat/Market）onScroll 可能不触发，用原生监听确保能捕获
	useEffect(() => {
		if (!enabled) return
		const handler = (e: Event) => {
			const target = e.target as HTMLElement | null
			if (!target || target !== ref.current) return
			const top = typeof target.scrollTop === 'number' ? target.scrollTop : 0
			scheduleOpacity(top)
		}
		document.addEventListener('scroll', handler, { passive: true, capture: true })
		return () => {
			document.removeEventListener('scroll', handler, true)
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
		}
	}, [enabled, scheduleOpacity])

	return { opacity, onScroll, setRef }
}
