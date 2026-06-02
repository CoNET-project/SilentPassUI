import { useCallback, useEffect, useRef, useState } from 'react'

const THRESHOLD = 40
const FADE_RANGE = 100

const computeOpacity = (scrollTop: number) =>
	scrollTop <= THRESHOLD ? 1 : Math.max(0, 1 - (scrollTop - THRESHOLD) / FADE_RANGE)

/**
 * 根据滚动容器的 scrollTop 计算固定顶栏胶囊不透明度。
 * 全项目守则：beamio-fixed-top-capsule-protocol.mdc（THRESHOLD=40，FADE_RANGE=100）
 * - onScroll + ref 绑定到 overflow-y-auto 主滚动区
 * - document capture 兜底（部分 WebView 下 React onScroll 不触发）
 */
export function useScrollCapsuleOpacity(enabled = true) {
	const [opacity, setOpacity] = useState(1)
	const ref = useRef<HTMLDivElement | null>(null)

	const onScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			if (!enabled) return
			setOpacity(computeOpacity(e.currentTarget.scrollTop))
		},
		[enabled]
	)

	const setRef = useCallback((node: HTMLDivElement | null) => {
		ref.current = node
		if (node) setOpacity(computeOpacity(node.scrollTop))
	}, [])

	useEffect(() => {
		if (!enabled || !ref.current) return
		setOpacity(computeOpacity(ref.current.scrollTop))
	}, [enabled])

	// document capture 兜底：部分页面（Chat/Market）onScroll 可能不触发，用原生监听确保能捕获
	useEffect(() => {
		if (!enabled) return
		const handler = (e: Event) => {
			const target = e.target as HTMLElement | null
			if (!target || target !== ref.current) return
			const top = typeof target.scrollTop === 'number' ? target.scrollTop : 0
			setOpacity(computeOpacity(top))
		}
		document.addEventListener('scroll', handler, { passive: true, capture: true })
		return () => document.removeEventListener('scroll', handler, true)
	}, [enabled])

	return { opacity, onScroll, setRef }
}
