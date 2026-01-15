// App.tsx
import { useEffect, useRef, useState } from "react"
import { Route, Routes, MemoryRouter as Router } from "react-router-dom"
import { useDaemonContext } from "./providers/DaemonProvider"
import Footer from "@/components/Footer"
import Home from "./pages/Home"
import History from "./pages/History/History"
import Pay from "./pages/Pay"
import Settings from "./pages/Settings"
import Chat from "./pages/chat"
import ChatDetail from "./pages/chatDetail"
import BeamioInstallOnboarding from "@/components/launchPage/BeamioInstallOnboarding"
import Browser from "@/pages/Browser"
import layout from './layout.module.scss'

global.Buffer = require("buffer").Buffer

function App() {
	const { isInitialLoading, showFooter, setShowFooter } = useDaemonContext()
	const bodyRef = useRef<HTMLDivElement | null>(null)

	// Footer 是否显示（由滚动决定）
	const [footerVisible, setFooterVisible] = useState(true)

	
	useEffect(() => {
		const canScroll = (el: HTMLElement) => {
			const style = window.getComputedStyle(el)
			const overflowY = style.overflowY
			if (overflowY !== "auto" && overflowY !== "scroll") return false
			return el.scrollHeight > el.clientHeight
		}

		const handleTouchMove = (e: TouchEvent) => {
			const target = e.target as HTMLElement | null
			if (!target) return

			let el: HTMLElement | null = target
			const root = (document.scrollingElement as HTMLElement) || document.documentElement

			while (el && el !== root && !canScroll(el)) el = el.parentElement

			if (!el || el === root) {
				e.preventDefault()
				return
			}

			const current = el
			const touch = e.touches[0]
			if (!touch) return

			if (bodyRef.current && current === bodyRef.current) {
			return
			}

			const anyEl = current as any
			const lastY = anyEl.__lastTouchY as number | undefined
			anyEl.__lastTouchY = touch.clientY
			if (lastY === undefined) return

			const deltaY = touch.clientY - lastY
			const atTop = current.scrollTop <= 0
			const atBottom = current.scrollTop + current.clientHeight >= current.scrollHeight - 1

			if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
				e.preventDefault()
			}
		}

		const handleTouchEnd = (e: TouchEvent) => {
			const target = e.target as HTMLElement | null
			if (!target) return

			let el: HTMLElement | null = target
			const root = (document.scrollingElement as HTMLElement) || document.documentElement

			while (el && el !== root) {
				if ((el as any).__lastTouchY !== undefined) delete (el as any).__lastTouchY
				el = el.parentElement
			}
		}

		document.addEventListener("touchmove", handleTouchMove, { passive: false })
		document.addEventListener("touchend", handleTouchEnd, { passive: true })
		document.addEventListener("touchcancel", handleTouchEnd, { passive: true })

		return () => {
			document.removeEventListener("touchmove", handleTouchMove as any)
			document.removeEventListener("touchend", handleTouchEnd as any)
			document.removeEventListener("touchcancel", handleTouchEnd as any)
		}
	}, [])

	// 你原来的滚动监听（保留，只是控制 footerVisible）
	useEffect(() => {
		const lastTopMap = new WeakMap<EventTarget, number>()
		let ticking = false
		const threshold = 6

		const getScrollTop = (t: EventTarget) => {
			if (t === window || t === document || t === document.documentElement || t === document.body) {
				return window.scrollY || document.documentElement.scrollTop || (document.body as any).scrollTop || 0
			}
			const el = t as HTMLElement
			return typeof (el as any).scrollTop === "number" ? (el as any).scrollTop : 0
		}

		const onAnyScroll = (e: Event) => {
			const target = e.target as HTMLElement | Document | Window | null

			

			if (bodyRef.current && target && target instanceof HTMLElement) {
				if (!bodyRef.current.contains(target)) return
			}

			

			if (ticking) return
			ticking = true

			requestAnimationFrame(() => {
				const src = (e.target || window) as EventTarget
				

				// ✅ 新增：局部滚动不影响 Footer（BalanceCard 等）
				if (src instanceof HTMLElement) {
					if (src.closest('[data-ignore-footer-scroll="1"]')) {
						ticking = false
						return
					}
				}

				const top = getScrollTop(src)
				const lastTop = lastTopMap.get(src) ?? top
				const delta = top - lastTop

				let nearBottom = false
				if (src && (src as any).scrollHeight != null) {
					const el = src as HTMLElement
					const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
					const bottomLockPx = 24
					nearBottom = top >= maxTop - bottomLockPx
				}

				if (top <= 0) {
					setFooterVisible(true)
				} else if (Math.abs(delta) >= threshold) {
					if (delta > 0) setFooterVisible(false)
					else {
						if (!nearBottom) setFooterVisible(true)
					}
				}

				lastTopMap.set(src, top)
				ticking = false
			})
		}

		window.addEventListener("scroll", onAnyScroll, { passive: true })
		document.addEventListener("scroll", onAnyScroll, { passive: true, capture: true })

		return () => {
			window.removeEventListener("scroll", onAnyScroll)
			document.removeEventListener("scroll", onAnyScroll, true)
		}
	}, [])

	// 首次进入显示
	useEffect(() => {
		const t = setTimeout(() => setFooterVisible(true), 0)
		return () => clearTimeout(t)
	}, [])

	useEffect(() => {
		if (isInitialLoading) setShowFooter (false)
		setShowFooter(true)
	},[isInitialLoading])


	return (
		<Router initialEntries={["/Onboarding"]}>
			<div >
				<div ref={bodyRef} >
					<Routes>
						<Route path="/Onboarding" element={<BeamioInstallOnboarding />} />
						<Route path="/" element={<Home />} />
						<Route path="/History" element={<History />} />
						<Route path="/Pay" element={<Pay />} />
						<Route path="/Chat" element={<Chat />} />
						<Route path="/chat/:id" element={<ChatDetail />} />
						<Route path="/settings" element={<Settings />} />
						<Route path="/browser" element={<Browser />} />
					</Routes>
				</div>

				{/* ✅ 外层只当占位（不再做 transform），动画全部在 Footer 自己的 motion.div 上做 */}
				{showFooter && <Footer visible={footerVisible} peek={false} />}
			</div>
		</Router>
	)
}

export default App
