// App.tsx
import { useEffect, useRef, useState, useLayoutEffect } from "react"
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
import {initChat, checkSign, getKeysFromCoNETPGPSC, makeMessage, currentGossipAbortController} from '@/services/chat'
import { isStandalone, MobileType, searchUsername, storeSystemData} from '@/services/beamio'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'


global.Buffer = require("buffer").Buffer

type message = {
	from: string
	signMessage: string
	text: string
	timestamp: number
}



const addNewMessage = async (lines: string[], profiles: profile[], temp: encrypt_keys_object, setProfiles: React.Dispatch<React.SetStateAction<profile[]>>) => {
		// ✅ 永远用“复制”的 chats 来做变更
		const profile = profiles[0]
		const chats: chatData[] = Array.isArray(profile.chats) ? [...profile.chats] : []

		for (const raw of lines) {
			try {
			const msg: message = JSON.parse(raw)
			if (!msg?.from || !msg?.text || !msg?.signMessage) continue

			const sign = checkSign(msg.text, msg.signMessage, msg.from)
			if (!sign) continue

			let idx = chats.findIndex(n => n?.address?.toLowerCase() === sign.toLowerCase())
			let chat = idx >= 0 ? { ...chats[idx] } : null

			// ✅ 不存在：创建新 chat
			if (!chat) {
				const _account = await searchUsername(sign) // 这里用 sign 更合理
				if (!_account?.results?.length) continue

				const acc: searchResult = _account.results[0]
				const kk = await getKeysFromCoNETPGPSC(acc.address, profile.privateKeyArmor)
				if (!kk?.publicArmored) continue

				chat = {
					address: sign,
					beamio: acc,
					messages: [],
					pin: false,
					hide: false,
					chatData: kk,
					unreadCount: 0,
					tag: "grey",
					muted: false
				}

				chats.unshift(chat) // ✅ 新会话放到最上面（更像 Messages）
				idx = 0
			}

			// ✅ 合并消息（去重 + 排序）
			const nextMessages = makeMessage(
				chat.messages || [],
				msg.text,
				msg.timestamp,
				"them",
				"sent"
			)

			// ✅ 未读 +1（仅当消息确实是新增的才加）
			
			
			const wasLen = (chat.messages || []).length
				const nowLen = nextMessages.length

				const lastReadTs = Number(chat.lastReadTs || 0)
				const isNew = nowLen > wasLen

				// ✅ 只有“对方发来的 & timestamp 比 lastReadTs 新” 才算未读
				const shouldIncUnread = isNew && msg.timestamp > lastReadTs

				const unreadNext = shouldIncUnread
				? (Number(chat.unreadCount || 0) + 1)
				: Number(chat.unreadCount || 0)

			const nextChat: chatData = {
			...chat,
			messages: nextMessages,
			unreadCount: unreadNext
			}

			// ✅ 放回 chats（不可变）
			if (idx === 0 && chats[0].address.toLowerCase() === nextChat.address.toLowerCase()) {
				chats[0] = nextChat
			} else {
				const realIdx = chats.findIndex(n => n.address.toLowerCase() === nextChat.address.toLowerCase())
				if (realIdx >= 0) chats[realIdx] = nextChat
				else chats.unshift(nextChat)
			}
			} catch (ex) {
			// 建议至少打印一次，方便你排查脏数据
				console.log("addNewMessage JSON.parse error", ex)
			}
		}

		profile.chats = chats

		// ✅ 关键：setProfiles 必须不可变更新（复制 profile + 复制 profiles 数组）
		setProfiles([...profiles])
		temp.profiles = profiles
		setCoNET_Data(temp)
		await storeSystemData()
	}

function App() {
	const { isInitialLoading, showFooter, setShowFooter, seenMsgRef, charts, setMessageCount, setCharts, profiles, setProfiles, setAllNodes, setGossip, gossip } = useDaemonContext()
	const bodyRef = useRef<HTMLDivElement | null>(null)

	// Footer 是否显示（由滚动决定）
	const [footerVisible, setFooterVisible] = useState(true)
	const runningRef = useRef(false)
	
	  // ✅ showFooter 一旦变成 true，就强制让 footerVisible 显示
	useLayoutEffect(() => {
		if (showFooter) {
		setFooterVisible(true)
		}
	}, [showFooter])
	
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

		initChat(setProfiles,setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})

		const t = setTimeout(() => setFooterVisible(true), 0)
		return () => {
			clearTimeout(t)
			console.log("🧹 Component unmounting, cleaning up gossip...");
			if (currentGossipAbortController) {
				currentGossipAbortController.abort("component_unmount");
			}
		}
	}, [])

	useEffect(() => {
		if (isInitialLoading) setShowFooter (false)
		setShowFooter(true)
	},[isInitialLoading])


	const getMsgKey = (raw: any) => {
	try {
		const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
		const ts = Number(obj?.timestamp)
		const from = String(obj?.from || '')
		if (Number.isFinite(ts) && ts > 0 && from) return `${from}_${ts}`
		if (Number.isFinite(ts) && ts > 0) return `${ts}`
	} catch {}
	return null
	}


	// ① 先统计（不要清 charts）
	useEffect(() => {
	if (!Array.isArray(charts) || charts.length === 0) return

	let delta = 0
	const seen = seenMsgRef.current

	for (const raw of charts) {
		const key = getMsgKey(raw)
		if (!key) continue
		if (seen.has(key)) continue
		seen.add(key)
		delta += 1
	}

	if (delta > 0) setMessageCount(prev => prev + delta)
	}, [charts, setMessageCount, seenMsgRef])

	


	// ② 再消费队列写入 profiles（你原逻辑）
	useEffect(() => {
		const profile = profiles
		const temp = CoNET_Data
		if (!profile || !temp || !Array.isArray(charts) || charts.length === 0) return
		if (runningRef.current) return

		runningRef.current = true

		;(async () => {
			try {
			const messageLines = [...charts]
			setCharts([])
			await addNewMessage(messageLines, profile, temp, setProfiles)
			} finally {
			runningRef.current = false
			}
		})()
	}, [charts])


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
