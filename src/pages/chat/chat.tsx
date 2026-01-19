import React, { useEffect, useMemo, useRef, useState } from "react"
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

type message = {
	from: string
	signMessage: string
	text: string
	timestamp: number
}

type ChatMessage = {
	id: string
	from: "me" | "them"
	text: string
	createdAt: number
	status?: "sending" | "sent" | "failed"
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
		charts
  	} = useDaemonContext()

	const [messages, setMessages] = useState<ChatMessage[]>(chatData.messages)

	const scrollRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)

	const toAddress = chatData.address

	const canSend = useMemo(() => {
		return !!toAddress && text.trim().length > 0
	}, [toAddress, text])

	const runningRef = useRef(false)

	const reflashdata = async () => {
		if (!profiles?.length) return
		const profile: profile = profiles[0]
		const chats = profile?.chats
		if (!chats?.length) return
		const myChat = chats.filter(n => n.address === chatData.address)[0]
		if (!myChat) return
		const mess = myChat.messages
		setMessages(prof => [...mess])
	}




	useEffect(() => {
		if (runningRef.current) return // ✅ 已在运行，直接忽略

		runningRef.current = true

		;(async () => {
			try {
				await reflashdata()
			} finally {
				runningRef.current = false // ✅ 确保释放锁
			}
		})()
	}, [profiles])

  // 滚动到底部
	useEffect(() => {
		 const el = scrollRef.current
		if (!el) return

		// 只在用户本来就在底部时自动跟随到底（更像 iOS）
		const distance = el.scrollHeight - el.scrollTop - el.clientHeight
		const wasAtBottom = distance <= 48

		if (wasAtBottom) {
			el.scrollTop = el.scrollHeight
		}

		// ✅ 渲染后如果在底部，清未读
		clearUnreadIfNeeded()
	}, [messages.length])

	// textarea 自适应高度
	useEffect(() => {
		const el = inputRef.current
		if (!el) return
		el.style.height = "0px"
		const next = Math.min(140, Math.max(44, el.scrollHeight))
		el.style.height = `${next}px`
	}, [text])

	const storageData = async () => {
		const temp = CoNET_Data
		if (!temp||!profiles.length) return
		const profile: profile = profiles[0]
		if (!profile?.chats?.length) profile.chats = []
		const index = profile.chats.findIndex(n => n.address === chatData.address)
		profile.chats.splice(index, 1)
		profile.chats.push(chatData)
		setProfiles(profiles)
		temp.profiles = profiles
		setCoNET_Data(temp)
		await storeSystemData()
	}

	async function send() {
		const temp = CoNET_Data

		if (!canSend || !temp||!profiles?.length) return
		const t = text.trim()

		setText("")

		const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()
		
		setMessages(prev => [
			...prev,
			{
				id: tempId,
				from: "me",
				text: t,
				createdAt: now,
				status: "sending"
			}
		])

		

		
		const node = allNodes[0] //getRandomNode(allNodes)
		if (!node) {
			return setMessages(prev =>
				prev.map(m =>
				m.id === tempId ? { ...m, status: "failed" } : m
				)
			)
		}

		const kkk = await sendMessage(chatData.chatData.publicArmored, t, privateKey, node)
		if (!kkk) {
			return setMessages(prev =>
				prev.map(m =>
				m.id === tempId ? { ...m, status: "failed" } : m
				)
			)
		}
		
		
		

		setMessages(prev =>
			prev.map(m =>
				m.id === tempId ? { ...m, status: "sent" } : m
			)
		)

		chatData.messages = makeMessage(messages, t, now, 'me', 'sent')
		await storageData()
	}

	useEffect(() => {
		if (chatData.unreadCount > 0) {
			clearedRef.current = false
		}
	}, [chatData.unreadCount])

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
	if (!profiles?.length) return
	if (!chatData?.address) return

	// ✅ 已经清过一次，避免频繁 setProfiles（但当 unread 又变大时会自动解除）
	if (clearedRef.current && chatData.unreadCount === 0) return

	// ✅ 不在底部不清
	if (!isAtBottom()) return

	// ✅ 没未读不清
	if (!chatData.unreadCount || chatData.unreadCount <= 0) return

	clearedRef.current = true

	// ✅ 不要直接改 chatData / profiles，做不可变更新
	setProfiles(prev => {
		if (!prev?.length) return prev
		const p0 = prev[0]
		const chats = Array.isArray(p0.chats) ? p0.chats : []
		const idx = chats.findIndex(c => c.address?.toLowerCase() === chatData.address.toLowerCase())
		if (idx < 0) return prev

		const nextChats = chats.slice()
		nextChats[idx] = { ...nextChats[idx], unreadCount: 0 }

		const next = prev.slice()
		next[0] = { ...p0, chats: nextChats }
		return next
	})

	// ✅ 同步持久化（别阻塞 UI）
	void storeSystemData()
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
      <ChatHeaderIOS beamioer={chatData.beamio} onBack={onBack} online={chatData.chatData.online} />
      
      {/* ✅ 渐变蒙版：从顶部100%不透明+模糊 -> 下方0%透明+无模糊，高度10rem */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10"
        style={{
          top: `0`,
          height: "10rem",
          background: "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)"
        }}
      />

      {/* 内容区：消息列表 */}
      <div
        className={[
          "absolute inset-0",
          "bg-white"
        ].join(" ")}
		style={{
			// // ✅ 顶部：safe-area + 头像/Tag 浮层占位（你现在大概 22px 不够）
			// // 建议给一个更像 iOS 的空间：safe-area + 120~140px
			// paddingTop: "calc(env(safe-area-inset-top) + 140px)",

			// ✅ 底部：输入框区域 + safe-area
			// 这里 112px 约等于：输入框本体(≈70~80) + 提示(≈20) + 间距
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
              {messages.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  className={[
                    "w-full flex mb-2",
                    m.from === "me" ? "justify-end" : "justify-start"
                  ].join(" ")}
                >
                  <div className="max-w-[78%] sm:max-w-[62%]">
                    {/* 气泡 */}
                    <div
						className={[
							"relative",
							"px-3.5 py-2.5",
							"rounded-[18px]",
							"shadow-[0_8px_22px_rgba(15,23,42,0.08)]",
							m.from === "me"
							? "bg-[#1652f0] text-white rounded-br-[10px]"
							: "bg-white text-slate-900 ring-1 ring-black/5 rounded-bl-[10px]"
						].join(" ")}
						>
						<div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
							{m.text}
						</div>

						{/* ✅ 三态角标：sending / sent / failed */}
						{m.from === "me" && (
							<BubbleCornerStatus
							status={m.status}
							onRetry={() => {
								// 复用你现有逻辑：把失败消息放回输入框，并删除该条
								if (m.status !== "failed") return
								setText(m.text)
								setMessages(prev => prev.filter(x => x.id !== m.id))
							}}
							/>
						)}
						</div>

                    {/* 时间 & 状态 */}
                    <div
                      className={[
                        "mt-1 flex items-center gap-2",
                        m.from === "me" ? "justify-end" : "justify-start"
                      ].join(" ")}
                    >
                      <span className="text-[11px] text-slate-400">
                        {fmtTime(m.createdAt)}
                      </span>

                      {m.from === "me" && (
                        <span className="text-[11px]">
                          {m.status === "sending" && (
                            <span className="text-slate-400">Sending…</span>
                          )}
                          {m.status === "sent" && (
                            <span className="text-slate-400">Delivered</span>
                          )}
                          {m.status === "failed" && (
                            <button
                              type="button"
                              onClick={() => {
                                // 简单重发：把 failed 的消息复制到输入框
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
              ))}
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
        <div
          className={[
            "bg-white/0"
          ].join(" ")}
        >
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

      // ✅ 给右侧按钮预留空间：保证文字不进按钮区
      "pr-14",

      "text-[15px] leading-[20px]",
      "placeholder:text-slate-400",
      "disabled:opacity-60",

      // ✅ 超过3行：内部滚动但不露滚动条
      "overflow-y-auto",
      "[scrollbar-width:none]",
      "[-ms-overflow-style:none]",
      "[&::-webkit-scrollbar]:hidden"
    ].join(" ")}
  />

				{/* ✅ 按钮放进输入框内部，最右对齐 */}
				<button
					type="button"
					onClick={send}
					disabled={!canSend}
					className={[
					"absolute right-2 bottom-2",
					"h-8 w-8 rounded-full",
					"grid place-items-center",
					"transition active:scale-[0.95]",
					canSend
						? "bg-[rgba(22,82,240,0.40)] text-[#1652f0] shadow-[0_4px_12px_rgba(22,82,240,0.15)]"
						: "bg-transparent text-slate-300"
					].join(" ")}
					aria-label="Send"
				>
					<ArrowUp className="w-5 h-5" strokeWidth={2.8} />
				</button>
				</div>

            </div>

            
          </div>
		  </div>
        </div>
      </div>
    </div>
  )
}