// App.tsx
import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { Route, Routes, MemoryRouter as Router, useNavigate } from "react-router-dom"
import { useDaemonContext } from "./providers/DaemonProvider"
import Footer from "@/components/Footer"
import Home from "./pages/Home"
import History from "./pages/History/History"
import Pay from "./pages/Pay"
import Chat from "./pages/chat"
import ChatDetail from "./pages/chatDetail"
import BeamioInstallOnboarding from "@/components/launchPage/BeamioInstallOnboarding"
import Browser from "@/pages/Browser"
import { initChat, checkSign, getKeysFromCoNETPGPSC, makeMessage, currentGossipAbortController } from "@/services/chat"
import { searchUsername, storeSystemData } from "@/services/beamio"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { VouchersMockup } from "@/pages/Vouchers/VouchersMockup"
import MyWallet from "@/pages/Settings/index"
import { ethers } from "ethers"
import beamioConetCoreABI from "@/services/ABI/beamioConetCoreABI.json"
import BeamioContactProfilePreview from "@/components/Home/BeamioContactProfilePreview"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import PayScreen from '@/pages/Pay/send'
import HistoryAll from '@/pages/History/components/HistoryAll'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'

global.Buffer = require("buffer").Buffer

const beamioConetContract = {
  address: "0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd",
  network: "CONET DePIN",
  abi: beamioConetCoreABI,
  provider: new ethers.JsonRpcProvider("https://mainnet-rpc.conet.network"),
}

type message = {
  from: string
  signMessage: string
  text: string
  timestamp: number
}

const CoreContract = new ethers.Contract(
  beamioConetContract.address,
  beamioConetContract.abi,
  beamioConetContract.provider
)

// 你原来的 addNewMessage 保持不动（略）
// ...

function AppShell() {
  const {
    isInitialLoading,
    showFooter,
    setShowFooter,
    seenMsgRef,
    charts,
    setMessageCount,
    setCharts,
    profiles,
    setProfiles,
    setAllNodes,
    setGossip,
    setSecureCode,
    setRedeemCode,
    setPaymentLinkCode,
    gossip,
    scanData,
    setPaymentLink,
    setSendToMemo,
    setScanData,
  } = useDaemonContext()

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [footerVisible, setFooterVisible] = useState(true)
  const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
  const runningRef = useRef(false)

  // ✅ 现在安全了：AppShell 已经在 <Router> 内
  const navigate = useNavigate()

  const [showAlphaHowItWorks, setShowAlphaHowItWorks] =
    useState<"BeamioContactProfilePreview" | ""|'Pay'>("")

  useLayoutEffect(() => {
    if (showFooter) setFooterVisible(true)
  }, [showFooter])

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

	useEffect(() => {
		if (isInitialLoading) setShowFooter (false)
		setShowFooter(true)
	},[isInitialLoading])


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

  const checkUrl = async (url: string) => {
    let searchParams: URLSearchParams
    try {
      const u = new URL(url)
      searchParams = u.searchParams
    } catch {
      searchParams = new URLSearchParams(url)
    }

    let code = searchParams.get("code") || ""
    const _secureCode =
      searchParams.get("secureCode") || searchParams.get("securecode") || ""
    const cashcode = searchParams.get("cashcode") || ""
    const _beamio = searchParams.get("beamio") || ""

	setScanData("")

    if (_beamio) {
      const user = await searchUsername(_beamio)
      const results: searchResult[] = user?.results
      if (!results?.length) return

      const filtered = results.filter(n => n.username === _beamio)
      if (!filtered.length) return

      setUserPreviewItem(filtered[0])
      setScanData("")
      setShowAlphaHowItWorks("BeamioContactProfilePreview")
      return
    }


    if (_secureCode) {

		setSecureCode (_secureCode)
		setRedeemCode(cashcode)
		navigate('/History')
		return
      
    }

    if (code) {
      if (!code.startsWith("0x")) {
        code = ethers.solidityPackedKeccak256(["string"], [code])
      }
      try {
        const fx = await CoreContract.getLinkMemo(code)
        if (fx.to !== ethers.ZeroAddress) {
          setPaymentLinkCode(code)
          navigate("/browser")
          return
        }
      } catch (ex) {
        console.log("await CoreContract.getLinkMemo(code) Error")
      }
    }
  }

  useEffect(() => {
    if (!scanData||isInitialLoading) return

    const run = async () => {
      if (/^0x/i.test(scanData)) {
        setPaymentLink({ code: "", note: "", address: scanData, amount: "" })
        setSendToMemo(scanData)
        setScanData("")
        navigate("/Pay")
        return
      }
	  navigate('/History')
      try {
        await checkUrl(scanData)
      } finally {
        setScanData("")
      }
    }

    run()
  }, [scanData])

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
		<div>
			<div ref={bodyRef}>
				<Routes>
				<Route path="/Onboarding" element={<BeamioInstallOnboarding />} />
				<Route path="/" element={<Home />} />
				<Route path="/History" element={<History />} />
				<Route path="/Pay" element={<Pay />} />
				<Route path="/Chat" element={<Chat />} />
				<Route path="/chat/:id" element={<ChatDetail />} />
				<Route path="/settings" element={<VouchersMockup />} />
				<Route path="/browser" element={<Browser />} />
				<Route path="/myWallet" element={<MyWallet />} />
				<Route path="/HistoryAll" element={<HistoryAll />} />
				</Routes>
			</div>

			{showFooter && <Footer visible={footerVisible} peek={false} />}

			{/**	全画面 	 */}
			{showAlphaHowItWorks === 'BeamioContactProfilePreview' && createPortal(
				<AnimatePresence>
					<motion.div
						key="modal-overlay"
						className="
							fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						onTouchMove={(e) => e.stopPropagation()}
					>
					{/* 顶部 Header */}
					{/* <BeamioNavBack
						title=''
						onClose={() => {
							setShowAlphaHowItWorks('')
						}}
					/> */}

						{/* 内容区域 */}
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
							
							{
								showAlphaHowItWorks === 'BeamioContactProfilePreview' && userPreviewItem &&
								
									
									<BeamioContactProfilePreview
										item={userPreviewItem}
										close={item => {
											if (typeof item === 'string') {
												setShowAlphaHowItWorks('')

												return
											}
											setShowAlphaHowItWorks('Pay')
											setShowFooter(false)
										}}
									/>
										
							}
							
						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}

			{/* 全画面 从底部上来 */}
			<div
				className={[
					"fixed inset-0 z-40",
					showAlphaHowItWorks ? "pointer-events-auto" : "pointer-events-none"
				].join(" ")}
			>
				{/* 灰色遮罩：父页面不可用 */}
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						showAlphaHowItWorks ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setShowAlphaHowItWorks('')
					}}
				/>

				{/* Bottom Sheet：全宽，从底部上来 */}
				<div
					className={[
					"absolute inset-x-0 bottom-0",
					"transition-transform duration-300 ease-out",
					showAlphaHowItWorks ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体：h-auto 自适应内容高度 */}
					<div
					className={[
						"w-full",
						"bg-white dark:bg-slate-900",
						"rounded-t-[22px]",
						"shadow-[0_-12px_40px_rgba(0,0,0,0.18)]",

						// ✅ 自适应高度，但最多不超过屏幕（避免顶到状态栏）
						// 你也可以改成 90dvh
						"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
						"h-auto",

						// ✅ 安全区：底部留出 Home indicator
						"pb-[env(safe-area-inset-bottom)]"
					].join(" ")}
					>
						{/* 顶部拖拽条（可选） */}
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>


						{/* 内容区：内容少就不滚动；内容多才滚动 */}
						<div className="px-4 pb-4 overflow-y-auto">
							{showAlphaHowItWorks === "Pay" && userPreviewItem &&(
								<PayScreen 
									beamioer={userPreviewItem}
									close={() => {
										setShowAlphaHowItWorks('')
										setShowFooter(true)
								}}/>
							)}
							
							<div
								className="
								h-[24px]
								pb-[env(safe-area-inset-bottom)]
								pointer-events-none
								"
							/>
						</div>
					</div>
				</div>
			</div>

				
		</div>
	)
}

export default function App() {
  return (
    <Router initialEntries={["/Onboarding"]}>
      <AppShell />
    </Router>
  )
}
