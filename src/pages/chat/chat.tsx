import React, { useEffect, useMemo, useRef, useState, useLayoutEffect} from "react"
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { motion, AnimatePresence } from "framer-motion"
import {checkSign} from '@/services/chat' 
import {
  ArrowUp,
  ChevronLeft,
  Info,
  Phone,
  Video,
  Check,
  Mic,
  AlertTriangle
} from "lucide-react"
import { ChatHeaderIOS } from "./components/ChatHeaderIOS"
import {
	initBeamioPGPKeys,
	regiestChatRoute,
	getKeysFromCoNETPGPSC,
	connectToGossipNode,
	getRandomNode, sendMessage,
	makeMessage

} from '@/services/chat'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {searchUsername, storeSystemData} from '@/services/beamio'
import { messageSendReceiveCard } from "./components/messageSendReceiveCard"

const REACTIONS = [
  { key: "like", label: "👍" },
  { key: "love", label: "❤️" },
  { key: "ok", label: "👌" },
  { key: "exclamation", label: "❗️" },
  { key: "question", label: "❓" },
  { key: "laugh", label: "😂" },
  { key: "bad", label: "👎" }
] as const

type ReactionKey = typeof REACTIONS[number]["key"]

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

type ChatProps = {
	onBack?: () => void
	allNodes: nodeInfo[]
	chatData: chatData
	privateKey: string

}

function fmtTime(ts: number) {
  const d = new Date(ts)
  if (!isFinite(d.getTime())) return ""
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function BubbleCornerStatus({
  status,
  onRetry
}: {
  status?: "sending" | "sent" | "failed"
  onRetry?: () => void
}) {
  if (!status) return null

  // 容器：右下角小胶囊点
  const shell = [
    "absolute -bottom-1 -right-1",
    "h-4 w-4 rounded-full",
    "bg-white/75 backdrop-blur",
    "ring-1 ring-black/5",
    "grid place-items-center",
    "shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
  ].join(" ")

  if (status === "sending") {
    return (
      <span className={shell} aria-label="Sending">
        <motion.span
          className="block h-3 w-3 rounded-full border-2 border-slate-300 border-t-[#1652f0]"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      </span>
    )
  }

  if (status === "sent") {
    return (
      <span className={shell} aria-label="Delivered">
        <Check className="h-3 w-3 text-[#1652f0]" strokeWidth={3} />
      </span>
    )
  }

  // failed：可点
  return (
    <button
      type="button"
      onClick={onRetry}
      className={[
        shell,
        "cursor-pointer",
        "bg-white/80",
        "ring-1 ring-rose-200",
        "active:scale-[0.96] transition"
      ].join(" ")}
      aria-label="Failed, tap to retry"
      title="Failed · Tap to retry"
    >
      <AlertTriangle className="h-3 w-3 text-rose-600" strokeWidth={2.8} />
    </button>
  )
}


// ---------- Your existing Chat messages render (patched) ----------
type ChatListProps = {
	messages: ChatMessage[]
	pressTimerRef: React.MutableRefObject<number | null>
	openReactionBarForElement: (id: string, el: HTMLElement) => void
	setText: (t: string) => void
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
	BubbleCornerStatus: React.FC<{ status?: "sending" | "sent" | "failed"; onRetry: () => void }>
}




export default function Chat({ onBack, chatData, privateKey }: ChatProps) {
	const [text, setText] = useState("")
	 
  	const {
		profiles,
		setProfiles,
		setShowFooter,
		allNodes,
		setGossip,
		gossip,
		charts,
		
  	} = useDaemonContext()
	

	const [messages, setMessages] = useState<ChatMessage[]>(chatData.messages)

	const scrollRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)

	const toAddress = chatData.address
	const pressTimerRef = useRef<number | null>(null)
	const messagesRef = useRef<ChatMessage[]>(chatData.messages || [])
	const skipNextReflashdataRef = useRef(false)

	const [reactionUI, setReactionUI] = useState<{
		open: boolean
		messageId?: string
		x: number
		y: number
		placement: "top"
	}>(() => ({ open: false, x: 0, y: 0, placement: "top" }))

	const canSend = useMemo(() => {
		return !!toAddress && text.trim().length > 0
	}, [toAddress, text])

	const runningRef = useRef(false)

	const reflashdata = async () => {
		if (!profiles?.length) return

		const p0: profile = profiles[0]
		const chats = Array.isArray(p0?.chats) ? p0.chats : []
		if (!chats.length) return

		const addr = String(chatData.address || "").toLowerCase()
		if (!addr) return

		const myChat = chats.find(n => String(n.address || "").toLowerCase() === addr)
		if (!myChat) return

		// profiles/落盘的消息（“远端”）
		const remote = Array.isArray(myChat.messages) ? myChat.messages : []

		// 本地 UI 正在显示的消息（可能包含 tmp_ / 更先进的 status）
		const local = Array.isArray(messagesRef.current) ? messagesRef.current : []

		// 建索引：local by id
		const localById = new Map<string, ChatMessage>()
		for (const m of local) {
			if (!m?.id) continue
			localById.set(m.id, m)
		}

		// ✅ 1) 先以 remote 为基础，逐条 merge：如果 local 同 id 且 status 更“新”，用 local 覆盖
		const merged: ChatMessage[] = remote.map(rm => {
			const lm = localById.get(rm.id)
			if (!lm) return rm

			// status 更“新” => 用 local
			if (statusRank(lm.status) > statusRank(rm.status)) {
			return { ...rm, ...lm }
			}

			// status 一样但 local 有 paymentCard / text 等更完整，也可以选择补齐
			// 这里保守：remote 为主，只用 local 补 status（避免把落盘 text 覆盖错）
			if (statusRank(lm.status) === statusRank(rm.status) && lm.status && lm.status !== rm.status) {
			return { ...rm, status: lm.status }
			}

			return rm
		})

		// ✅ 2) 把 local 里仍然存在但 remote 里没有的 tmp_ 消息追加回去（防止被冲掉）
		const remoteIdSet = new Set(remote.map(m => m.id))
		const localTempExtras = local.filter(m => isTempId(m.id) && !remoteIdSet.has(m.id))

		const next = [...merged, ...localTempExtras]
			.slice()
			.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

		// ✅ 3) 刷 UI
		pendingInitialScrollRef.current = true
		messagesRef.current = next
		setMessages(next)
	}

	// ✅ 放在 Chat 组件内部，refs 声明处附近
	const didInitialScrollRef = useRef(false)     // 只允许“首次到底”执行一次
	const pendingInitialScrollRef = useRef(true)  // 用于 reflashdata 异步回来后也能触发一次

	const scrollToBottom = (mode: "auto" | "smooth" = "auto") => {
	const el = scrollRef.current
	
	if (!el) return
	// 直接到底（不依赖 scrollHeight - clientHeight）
	el.scrollTo({ top: el.scrollHeight, behavior: mode })
	}

	// ✅ 1) 首次进入：用 useLayoutEffect，避免初次渲染闪烁
	useLayoutEffect(() => {
		if (didInitialScrollRef.current) return

		requestAnimationFrame(() => {
			scrollToBottom("auto")
			didInitialScrollRef.current = true
			// 这里不要 pendingInitialScrollRef.current = false
			// 让 pending 那个 effect 负责“最终一次的清 unread”
		})
	}, [])

	function openReactionBarForElement(messageId: string, el: HTMLElement) {
		const r = el.getBoundingClientRect()

		// bar 大约宽度：7 个按钮 * 36 + padding ≈ 7*36 + 16 = 268
		const approxW = 280
		const x = clamp(r.left + r.width / 2 - approxW / 2, 8, window.innerWidth - approxW - 8)

		// 放在气泡上方 8px
		const y = clamp(r.top - 52, 8, window.innerHeight - 80)

		setReactionUI({
			open: true,
			messageId,
			x,
			y,
			placement: "top"
		})
		}

		function closeReactionBar() {
		setReactionUI(prev => ({ ...prev, open: false, messageId: undefined }))
	}


		type paymentCard = {
			amount: number
			token: ICurrency
			approx: string
			title: string
			timeStamp: number
		}

	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	useLayoutEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [])

	const statusRank = (s?: ChatMessage["status"]) => {
	if (s === "sent") return 3
	if (s === "failed") return 3
	if (s === "sending") return 2
	return 1 // undefined / 其它
	}

	const isTempId = (id: string) => /^tmp_/i.test(id || "")


	useEffect(() => {
		// ✅ 如果这次 profiles 变化来自本组件 storageData()，跳过一次 reflashdata
		if (skipNextReflashdataRef.current) {
			skipNextReflashdataRef.current = false
			return
		}

		if (runningRef.current) return
		runningRef.current = true

		;(async () => {
			try {
			await reflashdata()
			} finally {
			runningRef.current = false
			}
		})()
	}, [profiles])

  // 滚动到底部
	useEffect(() => {
		if (!pendingInitialScrollRef.current) return
		if (!messages?.length) return

		requestAnimationFrame(() => {
			scrollToBottom("auto")
			didInitialScrollRef.current = true
			pendingInitialScrollRef.current = false
			forceClearUnread()
		})

	}, [messages.length])

	// textarea 自适应高度
	useEffect(() => {
		const el = inputRef.current
		if (!el) return
		el.style.height = "0px"
		const next = Math.min(140, Math.max(44, el.scrollHeight))
		el.style.height = `${next}px`
	}, [text])

	const forceClearUnread = () => {
		const ps = Array.isArray(profiles) ? profiles : []
		if (ps.length === 0 || !chatData?.address) return

		const addr = chatData.address.toLowerCase()
		const now = Date.now()

		// ✅ 先判断：当前 unread 是否真的 > 0，不需要清就直接退出
		const p0 = ps[0]
		const chats0: chatData[] = Array.isArray(p0?.chats) ? p0.chats : []
		const idx0 = chats0.findIndex(c => c.address?.toLowerCase() === addr)
		const cur = idx0 >= 0 ? chats0[idx0] : null
		if (!cur || Number(cur.unreadCount || 0) <= 0) return

		// ✅ 1) React state
		setProfiles(prev => {
			if (!prev?.length) return prev
			const p = prev[0]
			const chats = Array.isArray(p.chats) ? p.chats : []
			const idx = chats.findIndex(c => c.address?.toLowerCase() === addr)
			if (idx < 0) return prev

			const nextChats = chats.slice()
			const old = nextChats[idx]
			nextChats[idx] = {
			...old,
			unreadCount: 0,
			lastReadTs: Math.max(Number(old?.lastReadTs || 0), now)
			}

			const next = prev.slice()
			next[0] = { ...p, chats: nextChats }
			return next
		})

		// ✅ 2) CoNET_Data snapshot（让 storeSystemData 写到最新）
		const temp = CoNET_Data
		if (temp) {
			const nextChats = chats0.slice()
			const old = nextChats[idx0]
			nextChats[idx0] = {
			...old,
			unreadCount: 0,
			lastReadTs: Math.max(Number(old?.lastReadTs || 0), now)
			}
			const nextProfiles = ps.slice()
			nextProfiles[0] = { ...p0, chats: nextChats }
			temp.profiles = nextProfiles
			setCoNET_Data(temp)
		}

		void storeSystemData()
	}


	async function send() {
		const temp = CoNET_Data
		if (!canSend || !temp || !profiles?.length) return

		const t = text.trim()
		if (!t) return

		setText("")

		const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()

		// ✅ 1) 先插入 sending（同步构造 next）
		const pendingMsg: ChatMessage = {
			id: tempId,
			from: "me",
			text: t,
			createdAt: now,
			status: "sending"
		}

		{
			const next: ChatMessage[] = [...(messagesRef.current || []), pendingMsg]
			messagesRef.current = next
			setMessages(next)
		}

		// ✅ 2) 找节点
		const node = getRandomNode(allNodes)
		if (!node) {
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "failed" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
			return
		}

		// ✅ 3) 发送
		let ok = false
		try {
			const kkk = await sendMessage(chatData.chatData.publicArmored, t, privateKey, node)
			ok = !!kkk
		} catch {
			ok = false
		}

		if (!ok) {
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "failed" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
			return
		}

		// ✅ 4) 标记 sent（同步构造 next），并用同一份 next 去落盘
		{
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "sent" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
		}
	}

	useEffect(() => {
		if (chatData.unreadCount > 0) {
			clearedRef.current = false
		}
	}, [chatData.unreadCount])

	// ✅ 2) messages 初次装载 / reflashdata 后：补一枪“首屏到底”（只做一次）
	useEffect(() => {
		if (!pendingInitialScrollRef.current) return
		// 只要有消息，就在下一帧到底
		if (!messages?.length) return

		requestAnimationFrame(() => {
				scrollToBottom("auto")
			didInitialScrollRef.current = true
			pendingInitialScrollRef.current = false
			forceClearUnread() // ✅ 替代 clearUnreadIfNeeded
		})
	}, [messages.length])



	const clearedRef = useRef(false)
	// 距离底部多少 px 视为“已到最底”
	const BOTTOM_EPS = 24

	const isAtBottom = () => {
		const el = scrollRef.current
		if (!el) return false
		const distance = el.scrollHeight - el.scrollTop - el.clientHeight
		return distance <= BOTTOM_EPS
	}

	const clearUnreadIfNeeded = () => {
		if (!chatData?.unreadCount || chatData.unreadCount <= 0) return
		if (!isAtBottom()) return

		// 避免在一次到底滚动中重复触发多次
		if (clearedRef.current) return
		clearedRef.current = true

		forceClearUnread()
	}

	const storageData = async () => {
		const temp = CoNET_Data
		const ps = Array.isArray(profiles) ? profiles : []
		if (!temp || ps.length === 0) return

		const p0: profile = ps[0]
		const chats: chatData[] = Array.isArray(p0?.chats) ? p0.chats : []

		const addr = String(chatData?.address || "").toLowerCase()
		if (!addr) return

		const idx = chats.findIndex(c => String(c?.address || "").toLowerCase() === addr)

		const nextChats =
			idx >= 0
			? chats.map((c, i) => (i === idx ? { ...c, ...chatData } : c))
			: [...chats, { ...chatData }]

		const nextProfile = { ...p0, chats: nextChats }
		const nextProfiles = ps.slice()
		nextProfiles[0] = nextProfile

		// ✅ 关键：告诉 useEffect([profiles]) 这次更新是我自己触发的，不要 reflashdata 覆盖 messages
		skipNextReflashdataRef.current = true

		setProfiles(nextProfiles)

		const nextTemp = temp
		nextTemp.profiles = nextProfiles
		setCoNET_Data(nextTemp)

		await storeSystemData()
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			send()
		}
	}

  // textarea 自适应高度（1~3行），超过3行时只显示最后3行
	useEffect(() => {
		const el = inputRef.current
		if (!el) return

		// 你现在的 textarea 是 leading-[20px]
		const lineH = 20
		const maxLines = 3
		const maxH = lineH * maxLines

		// reset -> measure
		el.style.height = "0px"
		const next = Math.min(maxH, Math.max(lineH, el.scrollHeight))
		el.style.height = `${next}px`

		// 超过3行：保持滚动在底部（只显示最后3行）
		// 注意：需要 textarea overflow-y-auto 才能内部滚动
		el.scrollTop = el.scrollHeight
	}, [text])

	


  return (
		<div className="fixed inset-0 bg-white">
			<ChatHeaderIOS
				beamioer={chatData.beamio}
				onBack={onBack}
				online={chatData.chatData.online}
			/>

			{/* ✅ 渐变蒙版：从顶部100%不透明+模糊 -> 下方0%透明+无模糊，高度10rem */}
			<div
				className="absolute left-0 right-0 pointer-events-none z-10"
				style={{
					top: `0`,
					height: "10rem",
					background:
					"linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
					backdropFilter: "blur(12px)",
					WebkitBackdropFilter: "blur(12px)",
					maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
					WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)"
				}}
			/>

			{/* 内容区：消息列表 */}
			<div
				className={["absolute inset-0", "bg-white"].join(" ")}
				style={{
					// paddingTop: "calc(env(safe-area-inset-top) + 140px)",
					// paddingBottom: "calc(env(safe-area-inset-bottom) + 112px)"
				}}
			>
			<div
				ref={scrollRef}
				className="h-full overflow-y-auto px-4 py-4"
				onScroll={() => {
				clearUnreadIfNeeded()
				}}
			>
				<div className="min-h-full flex flex-col justify-end">
				<div className="mx-auto w-full max-w-[820px]">
					<AnimatePresence initial={false}>
							{messages.map(m => {
								const isMe = m.from === "me"
								const hasCard = !!m.paymentCard

								return (
								<motion.div
									key={m.id}
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 6 }}
									transition={{ type: "spring", stiffness: 520, damping: 40 }}
									className={["w-full flex mb-2", isMe ? "justify-end" : "justify-start"].join(" ")}
								>
									<div className="max-w-[78%] sm:max-w-[62%]">
									{/* ✅ 分支：有 paymentCard -> Send/Receive Card；否则普通 message */}
									{hasCard ? (
										<div
										className="relative"
										onPointerDown={e => {
											if (e.pointerType === "mouse" && e.button !== 0) return
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											const target = e.currentTarget as HTMLElement
											pressTimerRef.current = window.setTimeout(() => {
											openReactionBarForElement(m.id, target)
											}, 450)
										}}
										onPointerUp={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onPointerCancel={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onPointerLeave={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onContextMenu={e => {
											e.preventDefault()
											openReactionBarForElement(m.id, e.currentTarget as HTMLElement)
										}}
										>
										{messageSendReceiveCard({
											variant: isMe ? "sent" : "received",
											status: "Completed",
											amount: m.paymentCard!.amount,
											usdcAmount:  m.paymentCard!.usdcAmount,
											
											title: m.paymentCard!.title,
											timeLabel: "Just now",
											onMenu: () => {},
											currency: m.paymentCard!.currency,
											className: isMe ? "ml-auto" : "mr-auto"
										})}

										{/* ✅ 卡片也可以挂三态角标（只对我方消息） */}
										{isMe && (
											<div className="absolute -bottom-2 -right-2">
											<BubbleCornerStatus
												status={m.status}
												onRetry={() => {
												if (m.status !== "failed") return
												setText(m.text)
												setMessages(prev => prev.filter(x => x.id !== m.id))
												}}
											/>
											</div>
										)}
										</div>
									) : (
										<div
										className={[
											"relative",
											"px-3.5 py-2.5",
											"rounded-[18px]",
											"shadow-[0_8px_22px_rgba(15,23,42,0.08)]",
											isMe
											? "bg-[#1652f0] text-white rounded-br-[10px]"
											: "bg-white text-slate-900 ring-1 ring-black/5 rounded-bl-[10px]"
										].join(" ")}
										onPointerDown={e => {
											if (e.pointerType === "mouse" && e.button !== 0) return
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											const target = e.currentTarget as HTMLElement
											pressTimerRef.current = window.setTimeout(() => {
											openReactionBarForElement(m.id, target)
											}, 450)
										}}
										onPointerUp={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onPointerCancel={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onPointerLeave={() => {
											if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
											pressTimerRef.current = null
										}}
										onContextMenu={e => {
											e.preventDefault()
											openReactionBarForElement(m.id, e.currentTarget as HTMLElement)
										}}
										>
										<div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
											{m.text}
										</div>

										{isMe && (
											<BubbleCornerStatus
											status={m.status}
											onRetry={() => {
												if (m.status !== "failed") return
												setText(m.text)
												setMessages(prev => prev.filter(x => x.id !== m.id))
											}}
											/>
										)}
										</div>
									)}

									{/* 时间 & 状态（两种都显示） */}
									<div className={["mt-1 flex items-center gap-2", isMe ? "justify-end" : "justify-start"].join(" ")}>
										<span className="text-[11px] text-slate-400">
										{fmtTime(hasCard ? (m.paymentCard!.timeStamp || m.createdAt) : m.createdAt)}
										</span>

										{isMe && (
										<span className="text-[11px]">
											{m.status === "sending" && <span className="text-slate-400">Sending…</span>}
											{m.status === "sent" && <span className="text-slate-400">Delivered</span>}
											{m.status === "failed" && (
											<button
												type="button"
												onClick={() => {
												setText(m.text)
												setMessages(prev => prev.filter(x => x.id !== m.id))
												}}
												className="text-rose-600 underline underline-offset-2"
											>
												Failed · Tap to retry
											</button>
											)}
										</span>
										)}
									</div>
									</div>
								</motion.div>
								)
							})}
							</AnimatePresence>

					{/* ✅ 关键：底部 spacer */}
					<div aria-hidden className="h-[96px]" />
				</div>
				</div>
			</div>
			</div>

			{/* 底部：输入栏（iOS 毛玻璃 + pill） */}
			<div
			className={[
				"fixed left-0 right-0 bottom-0 z-50",
				"pb-[env(safe-area-inset-bottom)]"
			].join(" ")}
			>
			<div className={["bg-white/0"].join(" ")}>
				<div className="relative">
				<div className="mx-auto w-full max-w-[820px] px-3 pt-3 pb-4">
					<div className="flex items-end">
					{/* ✅ 输入框：内部放 send 按钮 */}
					<div
						className={[
						"relative flex-1",
						"rounded-[22px]",
						"bg-white/60 backdrop-blur-xl",
						"ring-1 ring-black/5",
						"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
						].join(" ")}
					>
						<textarea
						ref={inputRef}
						value={text}
						onChange={e => setText(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder={"iMessage…"}
						rows={1}
						className={[
							"w-full resize-none bg-transparent outline-none",
							"px-4 py-3",
							"pr-14",
							"text-[15px] leading-[20px]",
							"placeholder:text-slate-400",
							"disabled:opacity-60",
							"overflow-y-auto",
							"[scrollbar-width:none]",
							"[-ms-overflow-style:none]",
							"[&::-webkit-scrollbar]:hidden"
						].join(" ")}
						/>

						{/* ✅ 按钮放进输入框内部，最右对齐 */}
						<button
						type="button"
						onClick={canSend ? send : undefined}
						disabled={false}
						onMouseDown={() => {
							if (!canSend) {
							console.log("start voice message")
							}
						}}
						onTouchStart={() => {
							if (!canSend) {
							console.log("start voice message (touch)")
							}
						}}
						className={[
							"absolute right-2 bottom-2",
							"h-8 w-8 rounded-full",
							"grid place-items-center",
							"transition active:scale-[0.95]",
							canSend
							? [
								"bg-[rgba(22,82,240,0.60)]",
								"shadow-[0_4px_12px_rgba(22,82,240,0.15)]"
								].join(" ")
							: ["bg-transparent", "ring-1 ring-slate-300/70"].join(" ")
						].join(" ")}
						aria-label={canSend ? "Send" : "Voice message"}
						>
						{canSend ? (
							<ArrowUp className="h-4 w-4 text-white/70" strokeWidth={2.8} />
						) : (
							<Mic className="h-4 w-4 text-slate-400" strokeWidth={2.4} />
						)}
						</button>
					</div>
					</div>
				</div>
				</div>
			</div>
			</div>

			{/* ✅ 渐变蒙版：顶部0%透明+无模糊 -> 下方100%不透明+模糊，高度10rem（固定在底部，不考虑安全区） */}
			<div
			className="absolute left-0 right-0 bottom-0 pointer-events-none z-10"
			style={{
				height: "10rem",
				background:
				"linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
				backdropFilter: "blur(12px)",
				WebkitBackdropFilter: "blur(12px)",
				maskImage: "linear-gradient(to bottom, transparent 0%, black 100%)",
				WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 100%)"
			}}
			/>
		</div>
		)
}