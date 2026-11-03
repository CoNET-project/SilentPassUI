import { useEffect, useState } from 'react'

/**
 * Keep a full-screen page inside the part of the screen the keyboard leaves visible.
 *
 * iOS WKWebView (the shell ignores the keyboard safe area) and Safari do not
 * shrink the layout viewport when the keyboard opens. WebKit pans the visual
 * viewport up to reveal the focused input instead, so `position: fixed` bars
 * anchored to the layout viewport (chat header with back + call buttons) are
 * pushed off the top of the screen.
 *
 * While the visual viewport is shorter than the layout viewport, the page root
 * is moved to the visual viewport's top (`transform`) and sized to its height.
 * A transformed element is the containing block of its fixed descendants, so
 * the header stays at the top of the visible area and the composer sits on the
 * keyboard; only the message list gets shorter. Where the WebView resizes the
 * layout viewport itself (layout and visual heights match), nothing changes.
 */

/** Keyboard open = the visual viewport is shorter than the layout viewport by at least this. */
export const KEYBOARD_MIN_COVER_PX = 80

export type VisualViewportFrame = { top: number; height: number }

export function visualViewportFrameFor(
	layoutHeight: number,
	viewport: { height: number; offsetTop: number },
): VisualViewportFrame | null {
	if (!(layoutHeight > 0) || !(viewport.height > 0)) return null
	const covered = layoutHeight - viewport.height
	if (covered < KEYBOARD_MIN_COVER_PX) return null
	return { top: Math.max(0, Math.round(viewport.offsetTop)), height: Math.round(viewport.height) }
}

const clearFrame = (el: HTMLElement) => {
	el.style.transform = ''
	el.style.height = ''
	el.style.bottom = ''
}

/** Returns whether the keyboard (or another inset) currently covers part of the screen. */
export function useVisualViewportFrame(el: HTMLElement | null): boolean {
	const [covered, setCovered] = useState(false)
	useEffect(() => {
		const viewport = typeof window !== 'undefined' ? window.visualViewport : null
		if (!el || !viewport) return
		let frameRequest = 0
		const apply = () => {
			frameRequest = 0
			// The layout viewport: documentElement.clientHeight does not follow the keyboard.
			const layoutHeight = document.documentElement.clientHeight || window.innerHeight
			const frame = visualViewportFrameFor(layoutHeight, viewport)
			if (frame) {
				el.style.transform = `translate3d(0, ${frame.top}px, 0)`
				el.style.height = `${frame.height}px`
				el.style.bottom = 'auto'
			} else {
				clearFrame(el)
			}
			setCovered(Boolean(frame))
		}
		const schedule = () => {
			if (!frameRequest) frameRequest = requestAnimationFrame(apply)
		}
		apply()
		viewport.addEventListener('resize', schedule)
		viewport.addEventListener('scroll', schedule)
		window.addEventListener('resize', schedule)
		return () => {
			if (frameRequest) cancelAnimationFrame(frameRequest)
			viewport.removeEventListener('resize', schedule)
			viewport.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			clearFrame(el)
			setCovered(false)
		}
	}, [el])
	return covered
}
