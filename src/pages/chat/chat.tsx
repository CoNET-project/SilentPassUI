import React, { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from "react"
import { flushSync } from "react-dom"
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { motion, AnimatePresence } from "framer-motion"
import { checkSign, emitReactionAsNewMessage, createMembershipActivatedCard } from '@/services/chat' 
import {
  ArrowUp,
  ChevronLeft,
  Info,
  Phone,
  Video,
  Check,
  Plus,
  Mic,
  AlertTriangle,
  Camera,
  ImageIcon,
  Clock,
  BarChart3,
  Sticker,
  DollarSign,
  MoreHorizontal,
  Copy,
  Loader2,
  CheckCircle2,
  ExternalLink,
  X
} from "lucide-react"
import { ChatHeaderIOS } from "./components/ChatHeaderIOS"
import {
	initBeamioPGPKeys,
	regiestChatRoute,
	getKeysFromCoNETPGPSC,
	connectToGossipNode,
	getRandomNode, getRandomNodes, sendMessage,
	makeMessage

} from '@/services/chat'
import { PlusActionMenu } from "./components/PlusActionMenu"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getCashcodeData, searchUsername, storeSystemData, AuthorizationSign } from '@/services/beamio'
import { fiatPrefix } from '@/services/currency'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { MessageSendReceiveCard } from "./components/messageSendReceiveCard"

const aptEndpoint = 'https://api.settleonbase.xyz'
const baseExplorerTxUrl = (hash: string) => `https://basescan.org/tx/${hash}`

const REACTIONS = [
  { key: "love", label: "❤️" },
  { key: "like", label: "👍" },
  { key: "bad", label: "👎" },
  { key: "laugh", label: "😂" },
  { key: "exclamation", label: "❗️" },
  { key: "question", label: "❓" },
  { key: "sweat", label: "😅" },
  { key: "ok", label: "👌" },
] as const

type ReactionKey = typeof REACTIONS[number]["key"]

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const unknowAcc = (address: string):searchResult => {
	const ret: searchResult = {
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: 'Unknow',
		image: ''
	}
	return ret
}


type ChatSection = {
	key: string
	title: string
	kind: "day" | "month" | "year"
	items: ChatMessage[]
  }
  
  function startOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  
  function dayDiff(today0: Date, d0: Date) {
	return Math.floor((today0.getTime() - d0.getTime()) / 86_400_000)
  }
  
  function fmtMonthYear(d: Date) {
	return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
  }
  
  function fmtWeekday(d: Date) {
	return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  }
  
  function getMsgTs(m: ChatMessage) {
	const ts = Number(m?.paymentCard?.timeStamp || m?.createdAt || 0)
	return isFinite(ts) ? ts : 0
  }

  function formatTimeLabel(ts: number): string {
	const t = typeof ts === "number" && ts > 0 && ts < 1e12 ? ts * 1000 : ts
	const d = new Date(t)
	if (!isFinite(d.getTime())) return "Just now"
	const now = Date.now()
	if (now - t < 60 * 1000) return "Just now"
	const h = d.getHours()
	const m = d.getMinutes()
	const ampm = h >= 12 ? "p.m." : "a.m."
	const h12 = h % 12 || 12
	return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
  }
  
  function groupChatMessages(items: ChatMessage[], now = new Date()): ChatSection[] {
	const today0 = startOfDay(now)
	const currentYear = now.getFullYear()
  
	// ✅ Chat 建议升序显示（旧 -> 新），但分组标题从旧到新/新到旧都可以
	// 这里用升序，配合你 UI 最底部显示更自然
	const sorted = [...items].sort((a, b) => getMsgTs(a) - getMsgTs(b))
  
	const map = new Map<string, ChatSection>()
  
	for (const m of sorted) {
	  const ts = getMsgTs(m)
	  const d = new Date(ts)
	  const d0 = startOfDay(d)
	  const diff = dayDiff(today0, d0)
  
	  // 1) 一周内：按天
	  if (diff >= 0 && diff <= 6) {
		let title = fmtWeekday(d0)
		if (diff === 0) title = "TODAY"
		if (diff === 1) title = "YESTERDAY"
  
		const key = `day:${d0.getFullYear()}-${d0.getMonth()}-${d0.getDate()}`
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "day", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
		continue
	  }
  
	  // 2) 超过一周：今年内按月
	  if (d.getFullYear() === currentYear) {
		const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
		const key = `month:${ym}`
		const title = fmtMonthYear(new Date(d.getFullYear(), d.getMonth(), 1))
  
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "month", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
		continue
	  }
  
	  // 3) 跨年：按年
	  {
		const y = String(d.getFullYear())
		const key = `year:${y}`
		const title = y
  
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "year", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
	  }
	}
  
	// ✅ sections 顺序：跟你显示方向一致
	// 这里用 “按最早消息时间升序” 排（老分组在上，新分组在下）
	const sections = Array.from(map.values())
	sections.sort((a, b) => (getMsgTs(a.items[0]) || 0) - (getMsgTs(b.items[0]) || 0))
	return sections
  }
  
  function ChatSectionHeader({ title }: { title: string }) {
	return (
	  <div className="px-1 pt-3 pb-2">
		<div className="text-[11px] tracking-[0.22em] font-extrabold text-slate-300 text-center">
		  {title}
		</div>
	  </div>
	)
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
		<>
		{/* <span className={shell} aria-label="Delivered">
			<Check className="h-3 w-3 text-[#1652f0]" strokeWidth={3} />
		</span> */}
		</>
      
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
		setbBeamioUsers,
		currencyData = {} as Record<string, number>,
		usdcbalance = 0,
	} = useDaemonContext()
	


	const [messages, setMessages] = useState<ChatMessage[]>(chatData.messages)

	const scrollRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)

	const toAddress = chatData.address
	const pressTimerRef = useRef<number | null>(null)
	const messagesRef = useRef<ChatMessage[]>(chatData.messages || [])
	const skipNextReflashdataRef = useRef(false)
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const [userImg, setUserImg] = useState('')
	const [plusOpen, setPlusOpen] = useState(false)
	const plusBtnRef = useRef<HTMLButtonElement | null>(null)
	const [reactionUI, setReactionUI] = useState<{
		open: boolean
		messageId?: string
		x: number
		y: number
		placement: "top"
	}>(() => ({ open: false, x: 0, y: 0, placement: "top" }))
	/** 接收方点击 Pay 后，在卡片内显示确认（该条消息的 sendId 或 id） */
	const [payConfirmForSendId, setPayConfirmForSendId] = useState<string | null>(null)
	/** 正在执行 Payment Request 转账的 sendId（显示 loading） */
	const [payTransferLoading, setPayTransferLoading] = useState<string | null>(null)
	const [payTransferError, setPayTransferError] = useState<string | null>(null)
	/** 正在发送 Decline 的 sendId（防止重复点击） */
	const [declineLoadingForSendId, setDeclineLoadingForSendId] = useState<string | null>(null)

	/** 仅展示“正文”消息（含文字或 paymentCard）；带 reply 的 reaction 消息不单独成行，用于在目标消息上显示 icon */
	const displayableMessages = useMemo(() => {
		return (messages || []).filter(m => !m.reply || !!m.text || !!m.paymentCard)
	}, [messages])

	const sections = useMemo(() => {
		return groupChatMessages(displayableMessages, new Date())
	}, [displayableMessages])

	/** messageId（或时间戳字符串）-> 该条消息收到的 reaction 列表。paymentRequestCancel / paymentRequestPaid 不计入 reaction。 */
	const reactionsByMessageId = useMemo(() => {
		const map = new Map<string, { reactionKey: string; from: 'me' | 'them' }[]>()
		for (const m of messages || []) {
			if (!m.reply) continue
			if (m.reply.replyType === 'paymentRequestCancel' || m.reply.replyType === 'paymentRequestPaid') continue
			if (!m.reply.reactionKey) continue
			const list = map.get(m.reply.messageId) || []
			list.push({ reactionKey: m.reply.reactionKey, from: m.from })
			map.set(m.reply.messageId, list)
		}
		return map
	}, [messages])

	/** 已被取消的 Payment Request：sendId -> 取消消息的 createdAt（用于显示取消时间） */
	const cancelledPaymentRequestMap = useMemo(() => {
		const map = new Map<string, number>()
		for (const m of messages || []) {
			if (m.reply?.replyType === 'paymentRequestCancel' && m.reply.messageId != null && m.createdAt != null) {
				// 若同一条 request 被多次 cancel，保留第一次的 timestamp
				if (!map.has(m.reply.messageId)) map.set(m.reply.messageId, m.createdAt)
			}
		}
		return map
	}, [messages])
	const cancelledPaymentRequestSendIds = useMemo(() => new Set(cancelledPaymentRequestMap.keys()), [cancelledPaymentRequestMap])

	/** 已支付的 Payment Request：sendId -> { hash, createdAt }（用于卡片显示绿色 check + hash） */
	const paidPaymentRequestMap = useMemo(() => {
		const map = new Map<string, { hash: string; createdAt: number }>()
		for (const m of messages || []) {
			if (m.reply?.replyType === 'paymentRequestPaid' && m.reply.messageId != null && m.reply.paymentHash && m.createdAt != null) {
				if (!map.has(m.reply.messageId)) map.set(m.reply.messageId, { hash: m.reply.paymentHash, createdAt: m.createdAt })
			}
		}
		return map
	}, [messages])

	/** 1 USDC = ? in given currency (for converting fiat amount to USDC at Pay click) */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		const usdcToUSD = Number((currencyData as Record<string, number>)?.USDC ?? 1)
		if (currency === 'USD') return usdcToUSD
		const usdToCurrency = Number((currencyData as Record<string, number>)?.[currency] ?? 1)
		return usdcToUSD * usdToCurrency
	}

	/** 取某条消息对应的 reaction 列表：优先 sendId（reply 必须指向 sendId），再 id/createdAt/时间戳容差（兼容旧数据） */
	const getReactionsForMessage = useCallback(
		(m: ChatMessage) => {
			if (m.sendId) {
				const bySendId = reactionsByMessageId.get(m.sendId)
				if (bySendId?.length) return bySendId
			}
			const byId = reactionsByMessageId.get(m.id ?? '')
			if (byId?.length) return byId
			const byCreated = reactionsByMessageId.get(String(m.createdAt ?? ''))
			if (byCreated?.length) return byCreated
			const ts = Number(m.createdAt)
			if (!Number.isFinite(ts)) return undefined
			const tolerance = 15000
			for (const [key, list] of reactionsByMessageId) {
				const keyNum = Number(key)
				if (Number.isFinite(keyNum) && Math.abs(keyNum - ts) <= tolerance) return list
			}
			return undefined
		},
		[reactionsByMessageId]
	)


	const hasRoute = !!(chatData.chatData?.routersArmoreds?.trim())

	const canSend = useMemo(() => {
		return !!toAddress && !!hasRoute && text.trim().length > 0
	}, [toAddress, hasRoute, text])

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

		// 建索引：local by id 与 sendId（远端可能用任一来匹配）
		const localById = new Map<string, ChatMessage>()
		for (const m of local) {
			if (m?.id) localById.set(m.id, m)
			if (m?.sendId) localById.set(m.sendId, m)
		}

		// ✅ 1) 先以 remote 为基础，逐条 merge：如果 local 同 id 且 status 更“新”，用 local 覆盖
		const merged: ChatMessage[] = remote.map(rm => {
			const lm = localById.get(rm.id ?? rm.sendId ?? '')
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
		const remoteIdSet = new Set(remote.map(m => m.id ?? m.sendId ?? '').filter(Boolean))
		const localTempExtras = local.filter(m => (m.id && isTempId(m.id)) && !remoteIdSet.has(m.id))

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
		// iOS 风格：菜单宽度适中，可横向滚动显示更多
		const menuWidth = Math.min(280, window.innerWidth - 24)
		const x = clamp(r.left + r.width / 2 - menuWidth / 2, 12, window.innerWidth - menuWidth - 12)
		// 放在气泡上方，留出小间隙
		const y = clamp(r.top - 48, 12, window.innerHeight - 120)
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

	/** 发送 reaction：带 reply 指针的消息，对方可根据 messageId 找到原消息并显示 icon */
	async function sendReaction(targetMessageId: string, reactionKey: string) {
		closeReactionBar()
		if (!profiles?.length || !chatData?.chatData?.publicArmored) return
		const tempId = `tmp_reaction_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()
		const payload: ChatMessage = {
			id: tempId,
			from: 'me',
			text: '',
			createdAt: now,
			status: 'sending',
			reply: { messageId: targetMessageId, reactionKey },
		}
		{
			const next: ChatMessage[] = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
		}
		const nodes = getRandomNodes(allNodes, 2)
		if (!nodes.length) {
			const next = (messagesRef.current || []).map(m =>
				m.id === tempId ? { ...m, status: 'failed' as const } : m
			)
			messagesRef.current = next
			setMessages(next)
			chatData.messages = next
			await storageData()
			return
		}
		let ok = false
		try {
			ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, nodes))
		} catch {
			ok = false
		}
		const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: (ok ? 'sent' : 'failed') as 'sent' | 'failed' } : m
		)
		messagesRef.current = next
		setMessages(next)
		chatData.messages = next
		await storageData()
	}

	/** 发送方取消 Payment Request：发送一条 reply 指向该卡片的 paymentRequestCancel 消息；完成后才把消息加入列表并显示 decline 信息 */
	async function sendPaymentRequestCancel(targetSendId: string) {
		if (!profiles?.length || !chatData?.chatData?.publicArmored) return
		setDeclineLoadingForSendId(targetSendId)
		const now = Date.now()
		const payload: ChatMessage = {
			id: `tmp_cancel_pr_${now}_${Math.random().toString(16).slice(2)}`,
			from: 'me',
			text: '',
			createdAt: now,
			status: 'sent',
			reply: { messageId: targetSendId, replyType: 'paymentRequestCancel' },
		}
		try {
			const nodes = getRandomNodes(allNodes, 2)
			if (!nodes.length) {
				return
			}
			const ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, nodes))
			if (ok) {
				const next: ChatMessage[] = [...(messagesRef.current || []), payload]
				messagesRef.current = next
				setMessages(next)
				chatData.messages = next
				await storageData()
			}
		} finally {
			setDeclineLoadingForSendId(null)
		}
	}

	/** 执行 Payment Request 的 USDC 转账（与 PayScreen BeamioTransfer workflow 一致）。使用显式参数 currency/currencyAmount/usdcAmount。 */
	async function executePaymentRequestTransfer(
		prSendId: string,
		usdcAmountNum: number,
		toAddress: string,
		originalCurrency: ICurrency,
		originalCurrencyAmount: string
	) {
		if (!profiles?.length || !chatData?.chatData?.publicArmored || !toAddress) {
			setPayTransferError('Missing profile or chat')
			return
		}
		setPayTransferLoading(prSendId)
		setPayTransferError(null)
		const usdcAmountStr = usdcAmountNum > 0 ? usdcAmountNum.toFixed(6) : '0'
		const params = new URLSearchParams({
			amount: usdcAmountStr,
			usdcAmount: usdcAmountStr,
			currency: originalCurrency,
			currencyAmount: originalCurrencyAmount,
			toAddress,
			note: '',
		}).toString()
		const requestEndpoint = `${aptEndpoint}/api/BeamioTransfer?${params}`
		try {
			const response = await fetch(requestEndpoint, { method: 'GET' })
			if (response.status !== 402) {
				setPayTransferError('Transfer request failed')
				setPayTransferLoading(null)
				return
			}
			const { accepts } = await response.json().catch(() => ({}))
			const message = Array.isArray(accepts) ? accepts[0] : null
			if (!message?.payTo || message.maxAmountRequired == null) {
				setPayTransferError('Invalid payment challenge')
				setPayTransferLoading(null)
				return
			}
			const pay = BigInt(Number(message.maxAmountRequired).toFixed(0))
			const paymentHeader = await AuthorizationSign(pay, message.payTo)
			if (!paymentHeader) {
				setPayTransferError('Sign failed')
				setPayTransferLoading(null)
				return
			}
			const secondResponse = await fetch(message.data?.reqUrl ?? requestEndpoint, {
				method: 'GET',
				headers: { 'X-PAYMENT': paymentHeader, 'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE' },
				// @ts-ignore
				__is402Retry: true,
			})
			const body = await secondResponse.json().catch(() => ({}))
			if (!secondResponse.ok || !body?.USDC_tx) {
				setPayTransferError(body?.error || 'Transfer failed')
				setPayTransferLoading(null)
				return
			}
			const txHash = body.USDC_tx
			const now = Date.now()
			const tempId = `tmp_paid_pr_${now}_${Math.random().toString(16).slice(2)}`
			const payload: ChatMessage = {
				id: tempId,
				from: 'me',
				text: '',
				createdAt: now,
				status: 'sent',
				reply: { messageId: prSendId, replyType: 'paymentRequestPaid', paymentHash: txHash },
			}
			const next: ChatMessage[] = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
			chatData.messages = next
			const nodes = getRandomNodes(allNodes, 2)
			if (nodes.length) {
				try {
					await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, nodes)
				} catch (_) {}
			}
			await storageData()
			setPayConfirmForSendId(null)
		} catch (e) {
			setPayTransferError((e as Error)?.message || 'Transfer failed')
		} finally {
			setPayTransferLoading(null)
		}
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

	type UrlKind = "cashcode" | "paymentlink" | "beamio" | "url"

	const isUrl = (input: string): UrlKind | undefined => {
		if (!input || typeof input !== "string") return
	  
		let searchParams: URLSearchParams
	  
		try {
		  // 尝试作为完整 URL 解析
		  const u = new URL(input)
		  searchParams = u.searchParams
		} catch {
		  // 再尝试作为 query string 解析
		  try {
			searchParams = new URLSearchParams(input)
		  } catch {
			// 两种都失败 → 非 URL
			return
		  }
		}
	  
		const code = searchParams.get("code") || ""
		const secureCode =
		  searchParams.get("secureCode") ||""
		const cashcode = searchParams.get("cashcode") || ""
		const beamio = searchParams.get("beamio") || ""
	  
		if (beamio) return "beamio"
		if (secureCode || cashcode) return "cashcode"
		if (code) return "paymentlink"
	  
		// 是 URL，但不属于你关心的类型
		return "url"
	  }

	 


	async function send() {
		const temp = CoNET_Data
		if (!canSend || !temp || !profiles?.length) return

		const t = text.trim()
		if (!t) return

		// 立即清空输入：flushSync 确保同步更新，避免异步流程中其他 re-render 覆盖
		flushSync(() => setText(""))

		const mode = isUrl(t)
		let cashcodeCard: ChatMessage | undefined
		if (mode === 'cashcode') {
			const cashcodeUrl = t
			const res = await getCashcodeData(cashcodeUrl)
			const { card, payme } = res ?? { card: undefined, payme: undefined }
			if (!payme) return
			cashcodeCard = emitReactionAsNewMessage(Number(payme.currencyAmount), payme.currency, card?.title || '',payme.usdcAmount||0, cashcodeUrl)

			
		}
		


		const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()
		const sendId = crypto.randomUUID()

		// ✅ 1) 先插入 sending（同步构造 next），带 sendId 供对方 reply 时引用
		const pendingMsg: ChatMessage = {
			id: tempId,
			sendId,
			from: "me",
			text: t,
			createdAt: now,
			status: "sending",
			paymentCard: cashcodeCard ? cashcodeCard.paymentCard : undefined
		}

		{
			const next: ChatMessage[] = [...(messagesRef.current || []), pendingMsg]
			messagesRef.current = next
			setMessages(next)
		}

		// ✅ 2) 找节点（随机 2 个，并行 post）
		const nodes = getRandomNodes(allNodes, 2)
		if (!nodes.length) {
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "failed" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
			return
		}

		// ✅ 3) 发送：统一发 JSON 包，带 sendId，对方据此可 reply
		const payload = cashcodeCard
			? { ...cashcodeCard, sendId, from: 'me' as const, text: t, createdAt: now }
			: { sendId, from: 'me' as const, text: t, createdAt: now }
		let ok = false
		try {
			ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, nodes))
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

	// 当用户发送新消息后，视图自动滚动到最底部
	const prevMessagesLengthRef = useRef(messages.length)
	useEffect(() => {
		if (messages.length > prevMessagesLengthRef.current) {
			const last = messages[messages.length - 1]
			if (last?.from === 'me') {
				requestAnimationFrame(() => scrollToBottom('smooth'))
			}
			prevMessagesLengthRef.current = messages.length
		} else {
			prevMessagesLengthRef.current = messages.length
		}
	}, [messages])

	const findingRef = useRef(false)

	const findUser = useCallback(async () => {
		if (findingRef.current) return
		if (fromBeamio) return

		findingRef.current = true
		try {
			let account: searchResult|undefined = undefined
				const _account = await searchUsername(chatData.address)
				if (_account?.results?.[0]) account = _account.results[0]
			

			if (!account) {
				account = unknowAcc(chatData.address) 
			} 
			//@ts-ignore
			setbBeamioUsers(prev => {
			const addr = (account?.address || '').toLowerCase()
			//@ts-ignore
			if (prev.some(u => (u.address || '').toLowerCase() === addr)) return prev
				return [...prev, account!]
			})
			
			setfromBeamio(account)

			setUserImg(account.image||getImg(account.username))
		} finally {
			findingRef.current = false
			
		}
	}, [chatData])

	useEffect(() => {
		findUser()
	}, [chatData])

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
		<div className="fixed inset-0 bg-[#F1F8ED]">
			<ChatHeaderIOS
				beamioer={fromBeamio}
				onBack={onBack}
				online={chatData.chatData.online}
				avatarSrc={userImg}
			/>

			{/* iOS 风格 Message Reaction 菜单：仅对收到的消息显示，在 message 上方，内容可左右滚动；一点展开/收缩动画 */}
			<AnimatePresence>
			{reactionUI.open && (
				<motion.div
					key="reaction-menu-layer"
					className="fixed inset-0 z-[200]"
					initial={{ scale: 0, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0, opacity: 0 }}
					transition={{
						duration: 0.28,
						ease: [0.22, 0.61, 0.36, 1],
					}}
					style={{
						transformOrigin: `${reactionUI.x}px ${reactionUI.y}px`,
					}}
				>
					<div
						className="absolute inset-0"
						aria-hidden
						onClick={closeReactionBar}
						onTouchStart={closeReactionBar}
					/>
					<div
						className="fixed z-[201] flex flex-col items-center pointer-events-none ml-4"
						style={{
							left: reactionUI.x,
							top: reactionUI.y,
							width: Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 24 : 280),
						}}
					>
						{/* 主菜单：毛玻璃椭圆（恢复点击以操作内部按钮） */}
						<div
							className="relative flex items-center rounded-full bg-black/5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm py-2 px-3 min-w-0 pointer-events-auto"
							style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
							onClick={e => e.stopPropagation()}
						>
							<div className="flex gap-0.5 overflow-x-auto overflow-y-hidden scrollbar-hide w-full max-w-[280px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								{REACTIONS.map(({ key, label }) => (
									<button
										key={key}
										type="button"
										className="flex-shrink-0 w-9 h-9 rounded-full grid place-items-center text-xl active:scale-95 transition-transform hover:bg-black/5"
										onClick={() => {
											if (reactionUI.messageId) sendReaction(reactionUI.messageId, key)
										}}
										aria-label={key}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					</div>
				</motion.div>
			)}
			</AnimatePresence>

			{/* 内容区：消息列表 */}
			<div
				className={["absolute inset-0", "bg-[#F1F8ED]"].join(" ")}
				style={{
					// paddingTop: "calc(env(safe-area-inset-top) + 140px)",
					// paddingBottom: "calc(env(safe-area-inset-bottom) + 112px)"
				}}
			>
			{/* 顶部白色渐变蒙版 */}
			<div
				className="absolute left-0 right-0 top-0 h-[10rem] pointer-events-none z-10"
				style={{ background: "linear-gradient(to bottom, rgba(241,248,237,1) 0%, rgba(241,248,237,0) 100%)" }}
				aria-hidden
			/>
			{/* 底部白色渐变蒙版 */}
			<div
				className="absolute left-0 right-0 bottom-0 h-[10rem] pointer-events-none z-10"
				style={{ background: "linear-gradient(to top, rgba(241,248,237,1) 0%, rgba(241,248,237,0) 100%)" }}
				aria-hidden
			/>
			<div
				ref={scrollRef}
				className="h-full overflow-y-auto px-4 py-4"
				onScroll={() => {
				clearUnreadIfNeeded()
				}}
			>
				<div className="min-h-full flex flex-col justify-end">
				<div className="mx-auto w-full max-w-[820px]">
					<div aria-hidden className="h-[96px]" />
					<AnimatePresence initial={false}>
							{sections.map(sec => (
									<div key={sec.key}>
									<ChatSectionHeader title={sec.title} />

									{sec.items.map(m => {
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
											{hasCard ? (
												<div
													className="relative"
													onPointerDown={e => {
														if (e.pointerType === "mouse" && e.button !== 0) return
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														const target = e.currentTarget as HTMLElement
														pressTimerRef.current = window.setTimeout(() => {
															if (!isMe) openReactionBarForElement(m.sendId ?? m.id ?? '', target)
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
														if (!isMe) openReactionBarForElement(m.sendId ?? m.id ?? '', e.currentTarget as HTMLElement)
													}}
												>
												{(() => {
													const reactions = getReactionsForMessage(m)
													const show = reactions?.slice(-2) ?? []
													if (!show.length) return null
													const hasMyReply = show.some(r => r.from === 'me')
													return (
														<div
															className={["absolute -top-2 -left-2 z-10 flex items-center gap-0.5 rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-[6px] px-1.5 py-1 shadow-lg ring-1 ring-black/5", hasMyReply ? "bg-[#1652f0]/80" : "bg-slate-100/15"].join(" ")}
															style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.2)' }}
															aria-hidden
														>
															{show.map((r, i) => {
																const label = REACTIONS.find(x => x.key === r.reactionKey)?.label ?? r.reactionKey
																return <span key={`${r.reactionKey}-${i}`} className="text-base leading-none" title={r.reactionKey}>{label}</span>
															})}
														</div>
													)
												})()}
												{m.paymentCard!.cardType === "paymentRequest" ? (
													(() => {
														const prCancelled = m.sendId ? cancelledPaymentRequestSendIds.has(m.sendId) : false
														const prPaid = m.sendId ? paidPaymentRequestMap.has(m.sendId) : false
														const prDeclineLoading = declineLoadingForSendId === (m.sendId ?? m.id ?? '')
														const prPayConfirm = !isMe && !prCancelled && !prPaid && payConfirmForSendId === (m.sendId ?? m.id ?? '')
														const pc = m.paymentCard!
														// USDC amount: for USDC request use stored value; for fiat convert at current rate when receiver clicks Pay
														const usdcForConfirm = pc.currency === 'USDC'
															? Number(pc.usdcAmount || 0)
															: (() => { const rate = fxRateUSDCToCurrency(pc.currency); return rate > 0 ? Number(pc.amount) / rate : 0 })()
														const usdcStr = Number.isFinite(usdcForConfirm) ? usdcForConfirm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
														const prLoading = payTransferLoading === (m.sendId ?? m.id ?? '')
														let actionBlock: React.ReactNode
														if (prPaid) {
															const paidInfo = m.sendId ? paidPaymentRequestMap.get(m.sendId) : null
															const hash = paidInfo?.hash ?? ''
															actionBlock = (
																<>
																	<div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 py-3 px-4">
																		<CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
																		<span className="text-[13px] font-semibold text-emerald-700">Payment Sent</span>
																	</div>
																	{hash && (
																		<div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 mt-2">
																			<code className="flex-1 text-[10px] text-slate-600 truncate" title={hash}>{hash.slice(0, 10)}…{hash.slice(-8)}</code>
																			<button type="button" onClick={() => navigator.clipboard.writeText(hash)} className="p-1 text-slate-500 hover:text-slate-700" aria-label="Copy"><Copy className="w-3.5 h-3.5" /></button>
																			<button type="button" onClick={() => openExternalUrl(baseExplorerTxUrl(hash))} className="p-1 text-slate-500 hover:text-slate-700" aria-label="Open explorer"><ExternalLink className="w-3.5 h-3.5" /></button>
																		</div>
																	)}
																</>
															)
														} else if (prCancelled) {
															actionBlock = null
														} else if (prPayConfirm) {
															const insufficientBalance = Number(usdcbalance) < usdcForConfirm
															actionBlock = (
																<div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-2">
																	<div className="text-[11px] text-slate-600 leading-tight">
																		Pay with EOA account USDC (converted at current rate): <span className="font-semibold tabular-nums">{usdcStr} USDC</span>
																	</div>
																	{insufficientBalance && (
																		<div className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
																			Insufficient balance
																		</div>
																	)}
																	{payTransferError && (
																		<div className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">{payTransferError}</div>
																	)}
																	<div className="flex gap-2">
																		<button type="button" onClick={() => { setPayConfirmForSendId(null); setPayTransferError(null); }} disabled={prLoading} className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
																		{!insufficientBalance && (
																		<button type="button" disabled={prLoading} onClick={() => {
																			if (!m.sendId) return
																			const origAmountStr = (pc.currency === 'JPY' || pc.currency === 'TWD') ? String(Math.round(Number(pc.amount))) : Number(pc.amount).toFixed(2)
																			executePaymentRequestTransfer(m.sendId, usdcForConfirm, toAddress, pc.currency, origAmountStr)
																		}} className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-[#1652f0] hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-1.5">
																			{prLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Confirm'}
																		</button>
																		)}
																	</div>
																</div>
															)
														} else {
															// 发送方(请求方)：只显示 Cancel；接收方：只显示 Decline + Pay
															actionBlock = (
																<div className="flex gap-2">
																	{isMe ? (
																		<button
																			type="button"
																			disabled={prDeclineLoading}
																			onClick={() => m.sendId && !prDeclineLoading && sendPaymentRequestCancel(m.sendId)}
																			className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-70 flex items-center justify-center gap-1.5"
																		>
																			{prDeclineLoading ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Cancelling…</> : 'Cancel'}
																		</button>
																	) : (
																		<>
																			<button
																				type="button"
																				disabled={prDeclineLoading}
																				onClick={() => m.sendId && !prDeclineLoading && sendPaymentRequestCancel(m.sendId)}
																				className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-70 flex items-center justify-center gap-1.5"
																			>
																				{prDeclineLoading ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Declining…</> : 'Decline'}
																			</button>
																			{!prDeclineLoading && (
																				<button
																					type="button"
																					onClick={() => setPayConfirmForSendId(m.sendId ?? m.id ?? '')}
																					className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1652f0] hover:opacity-90"
																				>
																					Pay
																				</button>
																			)}
																		</>
																	)}
																</div>
															)
														}
														const timeLabel = prPaid && m.sendId && paidPaymentRequestMap.has(m.sendId)
															? formatTimeLabel(paidPaymentRequestMap.get(m.sendId)!.createdAt)
															: prCancelled && m.sendId && cancelledPaymentRequestMap.has(m.sendId)
																? formatTimeLabel(cancelledPaymentRequestMap.get(m.sendId)!)
																: formatTimeLabel(pc.timeStamp)
														const headerIcon = prPaid ? (
															<div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
																<CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
															</div>
														) : prCancelled ? (
															<div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
																<X className="w-5 h-5 text-red-600" strokeWidth={2.5} />
															</div>
														) : (
															<div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
																<DollarSign className="w-5 h-5 text-slate-600" strokeWidth={2.2} />
															</div>
														)
														const headerTitle = prPaid ? 'Paid via Beamio' : prCancelled ? 'Request Declined' : 'Payment Request'
														const amountStr = `${fiatPrefix(pc.currency)}${Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
														return (
													<div className={`w-[280px] max-w-full rounded-[22px] bg-white text-slate-900 shadow-[0_6px_18px_rgba(2,6,23,0.10)] ring-1 ring-black/5 overflow-hidden ${isMe ? "ml-auto" : "mr-auto"}`}>
														<div className="p-4">
															<div className="flex items-start justify-between gap-2 mb-3">
																<div className="flex items-center gap-2 min-w-0">
																	{headerIcon}
																	<div className="min-w-0">
																		<div className="font-bold text-[15px] text-slate-900">{headerTitle}</div>
																		<div className="text-[11px] text-slate-500 truncate">
																			{prCancelled && m.sendId && cancelledPaymentRequestMap.has(m.sendId)
																				? formatTimeLabel(cancelledPaymentRequestMap.get(m.sendId)!)
																				: (pc.walletLabel ?? 'Main Wallet • EOA')}
																		</div>
																	</div>
																</div>
																<span className="text-[11px] text-slate-400 shrink-0">{timeLabel}</span>
															</div>
															<div className="text-center mb-1">
																<div className="text-[22px] font-bold text-slate-900">{amountStr}</div>
															</div>
															{(pc.memo ?? pc.title) && (
																<div className="text-center text-[13px] text-slate-500 mb-3">{pc.memo ?? pc.title}</div>
															)}
															{actionBlock}
															<div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
																<span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Secured by Beamio</span>
																<button type="button" className="p-1 text-slate-400 hover:text-slate-600" aria-label="More">
																	<MoreHorizontal className="w-4 h-4" />
																</button>
															</div>
														</div>
													</div>
														)
													})()
												) : (
												<MessageSendReceiveCard
													variant={
														m.paymentCard!.cardType === "membershipActivated"
															? "membershipActivated"
															: m.paymentCard!.cashcodeUrl
																? "cashcode"
																: isMe
																	? "sent"
																	: "received"
													}
													status="Completed"
													amount={m.paymentCard!.amount}
													usdcAmount={m.paymentCard!.usdcAmount}
													cashcodeUrl={m.paymentCard!.cashcodeUrl}
													title={m.paymentCard!.title}
													timeLabel={formatTimeLabel(m.paymentCard!.timeStamp)}
													onMenu={() => {}}
													currency={m.paymentCard!.currency}
													className={isMe ? "ml-auto" : "mr-auto"}
													statusLabel={m.paymentCard!.cardType === "membershipActivated" ? m.paymentCard!.statusLabel : undefined}
													onViewInvoice={m.paymentCard!.cardType === "membershipActivated" ? () => { /* TODO: 跳转发票/详情 */ } : undefined}
												/>
												)}

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
														if (!isMe) openReactionBarForElement(m.sendId ?? m.id ?? '', target)
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
													if (!isMe) openReactionBarForElement(m.sendId ?? m.id ?? '', e.currentTarget as HTMLElement)
												}}
												>
												{(() => {
													const reactions = getReactionsForMessage(m)
													const show = reactions?.slice(-2) ?? []
													if (!show.length) return null
													const hasMyReply = show.some(r => r.from === 'me')
													return (
														<div
															className={["absolute -top-2 -left-2 z-10 flex items-center gap-0.5 rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-[6px] px-1.5 py-1 shadow-lg ring-1 ring-black/5", hasMyReply ? "bg-[#1652f0]/30" : "bg-slate-100/25"].join(" ")}
															style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.2)' }}
															aria-hidden
														>
															{show.map((r, i) => {
																const label = REACTIONS.find(x => x.key === r.reactionKey)?.label ?? r.reactionKey
																return <span key={`${r.reactionKey}-${i}`} className="text-base leading-none" title={r.reactionKey}>{label}</span>
															})}
														</div>
													)
												})()}
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

											<div className={["mt-1 flex items-center gap-2", isMe ? "justify-end" : "justify-start"].join(" ")}>
												<span className="text-[11px] text-slate-400">
												{fmtTime(getMsgTs(m))}
												</span>

												{isMe && (
												<span className="text-[11px]">
													{m.status === "sending" && <span className="text-slate-400">Sending…</span>}
													{
														m.status === "sent" && (
															<>
															<span className="text-slate-400">Delivered</span>
															</>
														)
													}
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
									</div>
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
				<div className={["bg-white/0"].join(" ")}>
					<div className="relative">
						<div className="mx-auto w-full max-w-[820px] px-3 pt-3 pb-4">
						<div className="flex items-center gap-2">
							<PlusActionMenu
								open={plusOpen}
								onClose={() => setPlusOpen(false)}
								anchorRef={plusBtnRef}
								
							/>
							 {/* ✅ 左侧：+ 透明圆圈按钮（与右侧同风格） */}
							<button
								ref={plusBtnRef}
								type="button"
								onClick={() => setPlusOpen(true)}
								className={[
								"h-9 w-9 rounded-full",
								"grid place-items-center",
								"transition active:scale-[0.95]",
								"bg-transparent",
								"ring-1 ring-slate-300/70",
								"backdrop-blur-xl"
								].join(" ")}
								aria-label="More actions"
							>
								<Plus className="h-4 w-4 text-slate-500" strokeWidth={2.6} />
							</button>
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
									onChange={e => hasRoute && setText(e.target.value)}
									onKeyDown={hasRoute ? onKeyDown : undefined}
									placeholder={hasRoute ? "iMessage…" : "No route – message may not be delivered"}
									readOnly={!hasRoute}
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
		</div>
		)
}