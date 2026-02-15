// App.tsx
import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { Route, Routes, MemoryRouter as Router, useNavigate } from "react-router-dom"
import { useDaemonContext } from "./providers/DaemonProvider"
import Footer from "@/components/Footer"
import Home from "./pages/Home"
import History from "./pages/History/MyWalletDashboardNew"
import Pay from "./pages/Pay"
import Chat from "./pages/chat"
import ChatDetail from "./pages/chatDetail"
import BeamioInstallOnboarding from "@/components/launchPage/BeamioInstallOnboarding"
import Browser from "@/pages/Browser"
import { initChat, checkSign, getKeysFromCoNETPGPSC, makeMessage, sendMessage, getRandomNodes, currentGossipAbortController } from "@/services/chat"
import { checkStorage, searchUsername, storeSystemData } from "@/services/beamio"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { baseEndpoint, USDCContract_BASE, setBaseRpcNodeProvider, setRpcDegradedGetter } from "@/utils/constants"
import { isRpcDegraded } from "@/utils/rpcStatus"
import usdc_abi from "@/services/ABI/usdc_abi.json"
import Vouchers from "@/pages/Vouchers/index"
import MyWallet from "@/pages/Settings/index"
import { ethers } from "ethers"
import beamioConetCoreABI from "@/services/ABI/beamioConetCoreABI.json"
import BeamioContactProfilePreview from "@/components/Home/BeamioContactProfilePreview"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import PayScreen from '@/pages/Pay/send'
import HistoryAll from '@/pages/History/components/HistoryAll'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import Market from "@/pages/Vouchers/Market"
import VouchersExample from "@/pages/Vouchers/example/index"
import Express from "@/pages/Vouchers/example/express"
import ExampleExpress from "@/pages/Vouchers/example/exampleExpress"
import ExampleExpress2 from "@/pages/Vouchers/example/ExampleExpress2"
import TenKeyInput from "@/pages/Pay/components/TenKeyInput"
import { Toast } from "antd-mobile"
import EmapmpleCard from '@/pages/Vouchers/example/ExampleCard'
import CardManager from '@/pages/cardManager'
import { getUserInfo } from "@/services/beamio"
import { AppButton } from "@/components/button/AppButton"
import { Check } from "lucide-react"
import RedeemOnboardingApp from "@/example/beamioRedeemOnboard"

global.Buffer = require("buffer").Buffer

const beamioConetContract = {
  address: "0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd",
  network: "CONET DePIN",
  abi: beamioConetCoreABI,
  provider: new ethers.JsonRpcProvider("https://mainnet-rpc1.conet.network"),
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
    allNodes,
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
    scanIntent,
    setScanIntent,
	setIsInitialLoading,
	setBeamio,
	setRedeemFromUrl,
	redeemResult,
	setRedeemResult,
  } = useDaemonContext()

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [footerVisible, setFooterVisible] = useState(true)
  const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
  const runningRef = useRef(false)
  const pendingQueueRef = useRef<string[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())

  // ✅ 现在安全了：AppShell 已经在 <Router> 内
  const navigate = useNavigate()

  const [showAlphaHowItWorks, setShowAlphaHowItWorks] =
    useState<"BeamioContactProfilePreview" | ""|'Pay'>("")

  useLayoutEffect(() => {
    if (showFooter) setFooterVisible(true)
  }, [showFooter])

  // 注册 Base RPC 节点提供者与熔断状态：限流时仅使用 CoNET allNodes
  useEffect(() => {
    setBaseRpcNodeProvider(() => allNodes)
    setRpcDegradedGetter(() => isRpcDegraded())
    return () => {
      setBaseRpcNodeProvider(null)
      setRpcDegradedGetter(null)
    }
  }, [allNodes])

	/** 消息唯一键：优先 sendId，否则 from_timestamp，用于去重与角标 */
	const getMsgKey = (raw: any) => {
		try {
			const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
			const from = String(obj?.from || '')
			const ts = Number(obj?.timestamp)
			const text = obj?.text
			// 优先用内层 sendId（发送方已用 crypto.randomUUID）
			if (text && typeof text === 'string') {
				try {
					const inner = JSON.parse(text)
					if (inner?.sendId) return String(inner.sendId)
				} catch {}
			}
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

	const init = async (temp?: encrypt_keys_object) => {

		const isAcc = await checkStorage()
		if (!isAcc) {
			setIsInitialLoading(true)
			return 
		}

		temp = temp||isAcc
	
		const profiles = temp?.profiles
		

		
		if (!temp || !profiles ) {
			setIsInitialLoading(true)
			return 
		}

		setProfiles(profiles)

		
		const loadUserInfo = (): Promise<beamio> => new Promise(async (resolve) => {
			const userInfo = await getUserInfo(profiles[0].keyID)
			if (!userInfo) {
				return setTimeout(async () => {
					return resolve(await loadUserInfo())
				}, 1000)
			}
			return resolve(userInfo)
		})
			
		const userInfo = await loadUserInfo()
		if (!userInfo) return
		
		const bo: beamio = userInfo

		await initChat(setProfiles,setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})
		
		
		bo.initialLoading = true
		
		
		
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await storeSystemData()
		setIsInitialLoading(false)

  	}

	// 首次进入显示
	useEffect(() => {
		init()
		

		const t = setTimeout(() => setFooterVisible(true), 0)
		return () => {
			clearTimeout(t)
			console.log("🧹 Component unmounting, cleaning up gossip...")
			if (currentGossipAbortController) {
				currentGossipAbortController.abort("component_unmount")
			}
			// 必须重置 gossip 状态，否则重挂载时 initChat 会因 if (gossip) return 直接返回，无法恢复聆听
			setGossip(false)
		}
	}, [])

	const autoReplayMessage = async (text: string, chatData: chatData) => {
		const profile = profiles?.[0]
		if (!profile?.chats || !chatData?.chatData?.publicArmored) return

		const now = Date.now()
		const nextMessages = makeMessage(chatData.messages || [], text, now, "me", "sent")

		// 更新该会话的 messages，并写回 profile.chats
		const chats = [...profile.chats]
		const idx = chats.findIndex((c) => c.address.toLowerCase() === chatData.address.toLowerCase())
		if (idx < 0) return
		chats[idx] = { ...chatData, messages: nextMessages }
		profile.chats = chats

		const temp = CoNET_Data
		if (temp?.profiles?.length) temp.profiles[0].chats = chats
		setCoNET_Data(temp)
		setProfiles([...profiles])
		await storeSystemData()

		// 送出 message 到对方（随机 2 节点并行 post）
		const nodes = getRandomNodes(allNodes, 2)
		if (nodes.length) {
			await sendMessage(chatData.chatData.publicArmored, text, profile.privateKeyArmor, nodes)
		}
	}



	const AUTO_REPLY_TEXT = "这是自动回复测试"
	const AUTO_REPLY_TEXT_WITH_HASH = "这是自动回复测试，已确认 on-chain"
	const AUTO_REPLY_TEXT_WITHOUT_HASH = "这是自动回复测试，未确认 on-chain"

	/** 在 Base 链上根据 tx hash 查该笔记录：只要存在 USDC 转账且金额 > 0 即承认该记录（contractCallSuccess）；或返回 USDC 转账的受益人 */
	const getUsdcTransferRecipientOnBase = async (
		txHash: string
	): Promise<{
		isUsdcTransfer: boolean
		recipient: string | null
		/** 该 tx 中存在 USDC 转账且金额 > 0 时为 true，承认这条记录 */
		contractCallSuccess?: boolean
	}> => {
		const logPrefix = "[getUsdcTransferRecipientOnBase]"
		try {
			console.log(logPrefix, "start", { txHash })

			const receipt = await baseEndpoint.getTransactionReceipt(txHash)
			console.log(logPrefix, "fetched receipt", {
				hasReceipt: !!receipt,
				receiptStatus: receipt?.status,
				logsLength: receipt?.logs?.length,
			})

			if (!receipt?.logs?.length) {
				console.log(logPrefix, "result: no logs", { isUsdcTransfer: false, recipient: null })
				return { isUsdcTransfer: false, recipient: null }
			}
			if (receipt.status !== 1) {
				console.log(logPrefix, "result: tx failed", { receiptStatus: receipt.status })
				return { isUsdcTransfer: false, recipient: null }
			}

			const usdcAddr = USDCContract_BASE.toLowerCase()
			const transferTopic = ethers.id("Transfer(address,address,uint256)")
			const transferIface = new ethers.Interface([
				"event Transfer(address indexed from, address indexed to, uint256 value)",
			])
			for (const log of receipt.logs) {
				if (log.address.toLowerCase() !== usdcAddr || log.topics[0] !== transferTopic)
					continue
				const parsed = transferIface.parseLog({ topics: log.topics, data: log.data })
				if (parsed?.name === "Transfer") {
					const value = BigInt(parsed.args[2])
					const recipient = parsed.args[1] as string
					console.log(logPrefix, "USDC Transfer found", {
						value: value.toString(),
						valueGt0: value > 0n,
						recipient,
					})
					if (value > 0n) {
						console.log(logPrefix, "result: contractCallSuccess=true (USDC > 0)")
						return { isUsdcTransfer: false, recipient: null, contractCallSuccess: true }
					}
					console.log(logPrefix, "result: USDC Transfer (value=0)", { isUsdcTransfer: true, recipient })
					return { isUsdcTransfer: true, recipient }
				}
			}
			console.log(logPrefix, "result: no USDC Transfer in logs", { isUsdcTransfer: false, recipient: null })
			return { isUsdcTransfer: false, recipient: null }
		} catch (err) {
			console.warn(logPrefix, "error", err)
			return { isUsdcTransfer: false, recipient: null }
		}
	}

	/** 进入的 message 是否为附带 Membership Activated 卡片且带 hash 字段（才触发自动回复） */
	const isMembershipActivatedWithHash = (text: string): boolean => {
		try {
			const obj = JSON.parse(text) as { paymentCard?: { cardType?: string; hash?: string } }
			return !!(obj?.paymentCard?.cardType === "membershipActivated" && obj?.paymentCard?.hash)
		} catch {
			return false
		}
	}

	const addNewMessage = async (
		lines: string[],
		profiles: profile[],
		temp: encrypt_keys_object,
		setProfiles: React.Dispatch<React.SetStateAction<profile[]>>,
		onAutoReply?: (chatData: chatData) => Promise<void>
	) => {
		// profile 为空说明 init 还未完成
		if (!profiles?.length || !profiles[0]) return
		// ✅ 去重：double post 时同一消息可能从不同节点到达两次
		const seenRaw = new Set<string>()
		const uniqLines: string[] = []
		for (const raw of lines) {
			const key = raw.trim()
			if (!key || seenRaw.has(key)) continue
			seenRaw.add(key)
			uniqLines.push(raw)
		}

		const profile = profiles[0]
		const chats: chatData[] = Array.isArray(profile.chats) ? [...profile.chats] : []
		const chatsToAutoReply: chatData[] = []

		for (const raw of uniqLines) {
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

			if (isNew && isMembershipActivatedWithHash(msg.text)) chatsToAutoReply.push(nextChat)

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

		// ✅ 聆听进入的新 message 后自动回复
		if (onAutoReply && chatsToAutoReply.length > 0) {
			for (const chat of chatsToAutoReply) {
				try {
					await onAutoReply(chat)
				} catch (e) {
					console.warn("autoReplayMessage error", e)
				}
			}
		}
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

  /**
   * 检查字符串是否是 signOfflineTransferERC3009 产生的 JSON 结构
   * ERC3009 签名数据应包含：fromEOA, id, maxAmount, validAfter, validBefore, nonce, signature, digest
   */
  const isERC3009SignatureData = (str: string): boolean => {
    try {
      const parsed = JSON.parse(str)
      // 检查是否包含 ERC3009 签名数据的所有必需字段
	  
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.fromEOA === 'string' &&
        typeof parsed.id === 'string' &&
        typeof parsed.maxAmount === 'string' &&
        typeof parsed.validAfter === 'string' &&
        typeof parsed.validBefore === 'string' &&
        typeof parsed.nonce === 'string' &&
        typeof parsed.signature === 'string' &&
        typeof parsed.digest === 'string'
      )
    } catch {
      return false
    }
  }

  /** 商家发行的 bill paymentUrl：Amount=、currency=、acceptTokens= 为必选项，缺一视为非法 bill 不处理；路径为 /Vouchers 或域名含 beamio */
  const isPaymentUrl = (raw: string): boolean => {
    try {
      if (!raw || typeof raw !== 'string') return false
      const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://beamio.app')
      const amount = u.searchParams.get('Amount') ?? u.searchParams.get('amount')
      const currency = u.searchParams.get('currency') ?? u.searchParams.get('Currency') ?? ''
      const acceptTokens = u.searchParams.get('acceptTokens') ?? u.searchParams.get('accepttokens') ?? ''
      if (!amount || Number(amount) <= 0) return false
      if (!currency || !acceptTokens) return false
      if (u.pathname === '/Vouchers' || /beamio\.app/i.test(u.origin)) return true
      return /\/Vouchers/i.test(u.pathname)
    } catch {
      return false
    }
  }

  const checkUrl = async (url: string) => {
    // 首先检查是否是 ERC3009 签名数据的 JSON 字符串
    if (isERC3009SignatureData(url)) {
		const parsed = JSON.parse(url) as { fromEOA: string, id: string, maxAmount: string, validAfter: string, validBefore: string, nonce: string, signature: string, digest: string }
		console.log("parsed", parsed)
		return
    }

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
    const _beamiocard = searchParams.get("beamiocard") || searchParams.get("Beamiocard") || ""
    const _redeemcode = searchParams.get("redeemcode") || searchParams.get("Redeemcode") || ""

	setScanData("")

    // BeamioUserCard redeem URL: beamiocard + redeemcode → 打开 redeem 面板并预填
    if (_redeemcode?.trim()) {
      setRedeemFromUrl({
        cardAddress: _beamiocard?.trim() || undefined,
        redeemCode: decodeURIComponent(_redeemcode.trim()),
      })
      navigate("/History")
      return
    }

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
    // voucherPay / payBill 全流程由 TenKeyInputComponent 内的 Smart Routing Analysis 处理，此处不消费 scanData
    if (scanIntent === 'voucherPay' || scanIntent === 'payBill') return

    const run = async () => {
      // 符合 paymentUrl 的扫码结果交给 TenKeyInputComponent 处理（进入 Smart Routing → 确认 → 支付）
      if (isPaymentUrl(scanData)) {
        setScanIntent('voucherPay')
        navigate('/ten-key-input')
        return
      }
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
  }, [scanData, scanIntent])

  // ② 入站 chat 串行队列处理：避免并行 addNewMessage 导致同一消息被处理两次
	useEffect(() => {
		const temp = CoNET_Data
		// profile 为空说明 init 还未完成，不处理
		if (!profiles?.length || !profiles[0] || !temp || !Array.isArray(charts) || charts.length === 0) return

		// 新消息入队
		pendingQueueRef.current.push(...charts)
		setCharts([])

		const processQueue = async () => {
			if (runningRef.current) return
			runningRef.current = true
			try {
				const batch = pendingQueueRef.current.splice(0)
				if (batch.length === 0) {
					runningRef.current = false
					return
				}

				// 全局去重：按 sendId 或 from_timestamp 过滤已处理
				const toProcess: string[] = []
				for (const raw of batch) {
					const key = getMsgKey(raw)
					if (!key || processedIdsRef.current.has(key)) continue
					processedIdsRef.current.add(key)
					toProcess.push(raw)
				}
				if (toProcess.length === 0) {
					runningRef.current = false
					if (pendingQueueRef.current.length > 0) setTimeout(processQueue, 0)
					return
				}

				await addNewMessage(toProcess, profiles, temp, setProfiles, async (chatData) => {
					const p0 = profiles?.[0]
					if (!p0?.privateKeyArmor) return
					const lastMsg = chatData.messages[chatData.messages.length - 1]
					const msgText = (lastMsg as { text?: string })?.text
					let hash: string | undefined
					try {
						const obj = JSON.parse(msgText ?? "") as { paymentCard?: { hash?: string } }
						hash = obj?.paymentCard?.hash
					} catch {}
					let text: string
					if (!hash) {
						text = AUTO_REPLY_TEXT_WITHOUT_HASH
					} else {
						const result = await getUsdcTransferRecipientOnBase(hash)
						if (result.contractCallSuccess) {
							text = AUTO_REPLY_TEXT_WITH_HASH
						} else {
							const myAddress = new ethers.Wallet(p0.privateKeyArmor).address
							const isBeneficiaryMe = !!(
								result.isUsdcTransfer &&
								result.recipient &&
								myAddress &&
								result.recipient.toLowerCase() === myAddress.toLowerCase()
							)
							text = isBeneficiaryMe ? AUTO_REPLY_TEXT_WITH_HASH : AUTO_REPLY_TEXT_WITHOUT_HASH
						}
					}
					await autoReplayMessage(text, chatData)
				})
			} finally {
				runningRef.current = false
				if (pendingQueueRef.current.length > 0) setTimeout(processQueue, 0)
			}
		}
		processQueue()
	}, [charts, profiles])

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
				<Route path="/settings" element={<Market />} />
				<Route path="/browser" element={<Browser />} />
				<Route path="/myWallet" element={<MyWallet />} />
				<Route path="/HistoryAll" element={<HistoryAll />} />
				<Route path="/vouchers-example" element={<VouchersExample />} />
				<Route path="/express" element={<Express />} />
				<Route path="/example-express" element={<ExampleExpress2 />} />
				<Route path="/ten-key-input" element={<TenKeyInput />} />
				<Route path="/example-card" element={<EmapmpleCard />} />
				<Route path="/cardManager" element={<CardManager />} />
				<Route path="/redeem-onboarding" element={<RedeemOnboardingApp />} />
				</Routes>
			</div>

			{showFooter && createPortal(
				<Footer visible={footerVisible} peek={false} />,
				document.body
			)}

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

			{/* Redeem 结果：BeamioOnboardingModal Go To Home 后后台 redeem 完成，从下往上滑出 */}
			<AnimatePresence>
				{redeemResult && (
					<>
						<motion.div
							className="fixed inset-0 z-[210] bg-black/50"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							onClick={() => setRedeemResult(null)}
							aria-hidden
						/>
						<motion.div
							className="fixed inset-x-0 bottom-0 z-[211] bg-white dark:bg-slate-900 rounded-t-[22px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]"
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
						>
							<div className="flex justify-center pt-2 pb-1">
								<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
							</div>
							<div className="px-6 pb-6">
								{redeemResult.success ? (
									<>
										<div className="flex items-center gap-3 mb-4">
											<div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
												<Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
											</div>
											<div>
												<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Redeem Successful</h3>
												<p className="text-sm text-slate-600 dark:text-slate-400">Your reward has been added to your account.</p>
											</div>
										</div>
										{redeemResult.tx && (
											<a
												href={`https://basescan.org/tx/${redeemResult.tx}`}
												target="_blank"
												rel="noopener noreferrer"
												className="block mb-4 text-sm text-[#1652f0] underline"
											>
												View transaction
											</a>
										)}
									</>
								) : (
									<>
										<div className="flex items-center gap-3 mb-4">
											<div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
												<span className="text-xl text-rose-600 dark:text-rose-400">!</span>
											</div>
											<div>
												<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Redeem Failed</h3>
												<p className="text-sm text-rose-600 dark:text-rose-400">{redeemResult.error}</p>
											</div>
										</div>
									</>
								)}
								<AppButton fullWidth onClick={() => setRedeemResult(null)} className="rounded-xl">
									Done
								</AppButton>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
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
