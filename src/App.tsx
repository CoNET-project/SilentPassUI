// App.tsx
import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { Route, Routes, useNavigate, useLocation } from "react-router-dom"
import { useDaemonContext } from "./providers/DaemonProvider"
import Footer from "@/components/Footer"
import SearchInputWithDropdown from "@/components/Home/SearchBarWithResults"
import AppEntryGate from "@/components/AppEntryGate"
import Home from "@/components/Home/Home"
import History from "./pages/History/MyWalletDashboardNew"
import Pay from "./pages/Pay"
import QrOperationPage from "./pages/Pay/QrOperationPage"
import Chat from "./pages/chat"
import ChatDetail from "./pages/chatDetail"
import BeamioInstallOnboarding from "@/components/launchPage"
import Browser from "@/pages/Browser"
import { initChat, checkSign, getKeysFromCoNETPGPSC, makeMessage, sendMessage, getRandomNodes, currentGossipAbortController } from "@/services/chat"
import { checkStorage, searchUsername, storeSystemData, checkBUnitClaimEligibility, signAndClaimBUnits, handleNfcLinkAppDeepLinkScan } from "@/services/beamio"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { baseEndpoint, USDCContract_BASE } from "@/utils/constants"
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
import TenKeyInput from "@/pages/Pay/components/TenKeyInput"
import { Toast } from "antd-mobile"
import EmapmpleCard from '@/pages/Vouchers/example/ExampleCard'
import NewCardExample from '@/pages/Vouchers/example/newCardExample'
import ExampleCardNew from '@/pages/Vouchers/example/ExampleCardNew'
import BeamioTransactions from '@/pages/Vouchers/example/uelCenter'
import MobilePOS from '@/pages/Vouchers/example/Pos'
import CardManager from '@/pages/cardManager'
import WalletOverview from '@/pages/Wallet/WalletOverview'
import MyBrandsPage from '@/pages/Brands/MyBrandsPage'
import RenderActionPage from '@/renderAction'
import { getUserInfo } from "@/services/beamio"
import { AppButton } from "@/components/button/AppButton"
import { Check } from "lucide-react"

global.Buffer = require("buffer").Buffer

const beamioConetContract = {
  address: "0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd",
  network: "CONET DePIN",
  abi: beamioConetCoreABI,
  provider: new ethers.JsonRpcProvider("https://rpc1.conet.network"),
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
  const ROUTE_LOCK_ENABLED = false
  const {
    isInitialLoading,
    showFooter,
    setShowFooter,
    chatSearchOpen,
    setChatSearchOpen,
    setChatHomeItem,
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
    setVoucherPayFromScan,
	setIsInitialLoading,
	beamio,
	setBeamio,
	setRedeemFromUrl,
	redeemResult,
	setRedeemResult,
	setMyAddress,
  } = useDaemonContext()

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [footerVisible, setFooterVisible] = useState(true)
  const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
  /** 扫码 beamio URL 中的 wallet 参数：{ beamioAccount, wallet }，PayScreen 优先使用此地址 */
  const [preferredPayeeWallet, setPreferredPayeeWallet] = useState<{ beamioAccount: string; wallet: string } | null>(null)
  const runningRef = useRef(false)
  const pendingQueueRef = useRef<string[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())
  const setChartsRef = useRef(setCharts)
  setChartsRef.current = setCharts
  const bUnitClaimAttemptedRef = useRef(false)
  const initialRedeemUrlProcessedRef = useRef(false)
  const routeLockHashRef = useRef<string>("")
  const routeLockApplyingRef = useRef(false)

  const navigate = useNavigate()

  // 直接打开 redeem URL（如 https://beamio.app/app/?beamiocard=...&redeemcode=...）时解析并跳转
  useEffect(() => {
    if (isInitialLoading || initialRedeemUrlProcessedRef.current) return
    if (typeof window === 'undefined') return
    // 支持 query 在 search 或 hash 中（HashRouter 下可能为 #/?beamiocard=...）
    let redeemcode: string | null = null
    let beamiocard: string | null = null
    const search = window.location.search
    const hash = window.location.hash || ''
    if (search) {
      const sp = new URLSearchParams(search)
      redeemcode = sp.get('redeemcode') ?? sp.get('Redeemcode')
      beamiocard = sp.get('beamiocard') ?? sp.get('Beamiocard')
    }
    if ((!redeemcode?.trim()) && hash.includes('redeemcode')) {
      const hashQuery = hash.split('?')[1]
      if (hashQuery) {
        const sp = new URLSearchParams(hashQuery)
        redeemcode = sp.get('redeemcode') ?? sp.get('Redeemcode')
        beamiocard = sp.get('beamiocard') ?? sp.get('Beamiocard')
      }
    }
    if (!redeemcode?.trim()) return
    initialRedeemUrlProcessedRef.current = true
    setRedeemFromUrl({
      cardAddress: beamiocard?.trim() || undefined,
      redeemCode: decodeURIComponent(redeemcode.trim()),
    })
    navigate('/History')
  }, [isInitialLoading, navigate, setRedeemFromUrl])

  // App 初始化时检查可否领取 BeamioBUnits，可领取则自动发起领取请求
  // 重要：claimant 必须从私钥推导，不能使用 keyID，否则会导致 signer != claimant 链上失败
  useEffect(() => {
    if (bUnitClaimAttemptedRef.current || !profiles?.length) return
    const p0 = profiles[0] as { privateKeyArmor?: string; keyID?: string } | undefined
    if (!p0?.privateKeyArmor) return
    let claimant: string
    try {
      claimant = new ethers.Wallet(p0.privateKeyArmor).address
    } catch {
      return
    }
    if (!claimant || !ethers.isAddress(claimant)) return
    // 防御：keyID 与私钥推导地址不一致时跳过，避免 signer != claimant 导致链上 revert
    if (p0.keyID && ethers.isAddress(p0.keyID) && p0.keyID.toLowerCase() !== claimant.toLowerCase()) {
      return
    }
    bUnitClaimAttemptedRef.current = true
    checkBUnitClaimEligibility(claimant).then(async (r) => {
      if (!r.canClaim || r.nonce == null || r.deadline == null) return
      const result = await signAndClaimBUnits(p0.privateKeyArmor!, claimant, r.nonce, r.deadline)
      if (result.success) {
        Toast.show({ content: '20 B-Units claimed!', position: 'top' })
      }
    }).catch(() => {})
  }, [profiles])

  const { pathname } = useLocation()

  useEffect(() => {
    if (!ROUTE_LOCK_ENABLED || typeof window === "undefined") return

    const normalizeHash = (hash: string) => (hash && hash.startsWith("#") ? hash : `#${hash || "/"}`)
    const originalPushState = window.history.pushState.bind(window.history)
    const originalReplaceState = window.history.replaceState.bind(window.history)

    routeLockHashRef.current = normalizeHash(window.location.hash || "#/")

    const forceBackToLockedHash = () => {
      const locked = normalizeHash(routeLockHashRef.current || "#/")
      const current = normalizeHash(window.location.hash || "#/")
      if (current === locked) return
      routeLockApplyingRef.current = true
      originalReplaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${locked}`)
      setTimeout(() => {
        routeLockApplyingRef.current = false
      }, 0)
    }

    const onHashChange = (e: HashChangeEvent) => {
      if (routeLockApplyingRef.current) return
      const locked = normalizeHash(routeLockHashRef.current || "#/")
      const current = normalizeHash(window.location.hash || "#/")
      if (current === locked) return
      e.preventDefault?.()
      forceBackToLockedHash()
    }

    const onPopState = () => {
      if (routeLockApplyingRef.current) return
      forceBackToLockedHash()
    }

    const onClickCapture = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!target) return
      if (target.target === "_blank" || target.hasAttribute("download")) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const href = (target.getAttribute("href") || "").trim()
      if (!href) return
      const isHashLink = href.startsWith("#")
      const isRelativeLink = href.startsWith("/") || href.startsWith("./") || href.startsWith("../")
      const isSameOriginAbsolute = /^https?:\/\//i.test(href) && new URL(href, window.location.href).origin === window.location.origin
      if (!isHashLink && !isRelativeLink && !isSameOriginAbsolute) return
      e.preventDefault()
      e.stopPropagation()
      const ie = e as MouseEvent & { stopImmediatePropagation?: () => void }
      ie.stopImmediatePropagation?.()
      forceBackToLockedHash()
    }

    window.history.pushState = ((..._args: Parameters<History["pushState"]>) => {
      forceBackToLockedHash()
    }) as History["pushState"]

    window.history.replaceState = ((..._args: Parameters<History["replaceState"]>) => {
      forceBackToLockedHash()
    }) as History["replaceState"]

    window.addEventListener("hashchange", onHashChange, true)
    window.addEventListener("popstate", onPopState, true)
    document.addEventListener("click", onClickCapture, true)

    forceBackToLockedHash()

    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener("hashchange", onHashChange, true)
      window.removeEventListener("popstate", onPopState, true)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [ROUTE_LOCK_ENABLED])

  const [showAlphaHowItWorks, setShowAlphaHowItWorks] =
    useState<"BeamioContactProfilePreview" | ""|'Pay'>("")
  const [payFocusAmountOnMount, setPayFocusAmountOnMount] = useState(false)

  // 当 showFooter 为 true 或路由变化时恢复 footer 可见，避免 scroll 隐藏后、页面切换时 footerVisible 未重置
  useLayoutEffect(() => {
    if (showFooter) setFooterVisible(true)
  }, [showFooter, pathname])

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
		let touchStartX = 0
		let touchStartY = 0
		let edgeSwipeBlock = false
		const EDGE_GUARD_PX = 28
		const captureOpts: AddEventListenerOptions = { capture: true }
		const capturePassiveStart: AddEventListenerOptions = { capture: true, passive: true }
		const captureActiveMove: AddEventListenerOptions = { capture: true, passive: false }

		const canScrollX = (el: HTMLElement) => {
			const style = window.getComputedStyle(el)
			const overflowX = style.overflowX
			if (overflowX !== "auto" && overflowX !== "scroll") return false
			return el.scrollWidth > el.clientWidth
		}

		/** touch 落在文本节点 / SVG 上时 e.target 可能不是 Element，closest/canScroll 会失效或异常 */
		const touchTargetToElement = (t: EventTarget | null): Element | null => {
			if (t == null) return null
			if (t instanceof Element) return t
			if (t instanceof Text) return t.parentElement
			return null
		}

		const hasHorizontalScrollableAncestor = (target: Element | null) => {
			const root = (document.scrollingElement as HTMLElement) || document.documentElement
			let el: Element | null = target
			while (el && el !== root) {
				if (el instanceof HTMLElement && canScrollX(el)) return true
				el = el.parentElement
			}
			return false
		}

		const stopEvent = (e: TouchEvent) => {
			e.preventDefault()
			e.stopPropagation()
			const ie = e as TouchEvent & { stopImmediatePropagation?: () => void }
			ie.stopImmediatePropagation?.()
		}

		const canScroll = (el: HTMLElement) => {
			const style = window.getComputedStyle(el)
			const overflowY = style.overflowY
			if (overflowY !== "auto" && overflowY !== "scroll") return false
			return el.scrollHeight > el.clientHeight
		}

		const handleTouchStart = (e: TouchEvent) => {
			const t = e.touches[0]
			if (!t) return
			touchStartX = t.clientX
			touchStartY = t.clientY
			const targetEl = touchTargetToElement(e.target)
			const vw = window.innerWidth || document.documentElement.clientWidth || 0
			const startedAtEdge = touchStartX <= EDGE_GUARD_PX || touchStartX >= vw - EDGE_GUARD_PX
			// 保留可横向滚动容器（例如 Market 横向菜单）的手势，不拦截其内部 touch
			edgeSwipeBlock = startedAtEdge && !hasHorizontalScrollableAncestor(targetEl)
		}

		const handleTouchMove = (e: TouchEvent) => {
			const touchTarget = e.target

			const touch = e.touches[0]
			if (!touch) return

			// 禁用 iOS/PWA 边缘左右滑动返回/前进手势
			if (edgeSwipeBlock) {
				const dx = touch.clientX - touchStartX
				const dy = touch.clientY - touchStartY
				if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) + 2) {
					stopEvent(e)
					return
				}
			}

			if (!touchTarget) return

			const elHit = touchTargetToElement(touchTarget)
			if (!elHit) return

			/** 可点击控件（含点在按钮内文字/SVG 子节点时）：勿对 touchmove preventDefault，否则会吞掉 tap */
			if (
				elHit.closest(
					"button, a[href], input, textarea, select, [role='button'], label, summary, [data-touch-priority='1']"
				)
			) {
				return
			}

			const root = (document.scrollingElement as HTMLElement) || document.documentElement
			let node: Element | null = elHit
			while (node && node !== root && !(node instanceof HTMLElement && canScroll(node))) {
				node = node.parentElement
			}

			if (!node || node === root) {
				stopEvent(e)
				return
			}

			const current = node as HTMLElement

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
				stopEvent(e)
			}
		}

		const handleTouchEnd = (e: TouchEvent) => {
			edgeSwipeBlock = false
			const elHit = touchTargetToElement(e.target)
			if (!elHit) return

			let el: Element | null = elHit
			const root = (document.scrollingElement as HTMLElement) || document.documentElement

			while (el && el !== root) {
				if (el instanceof HTMLElement && (el as any).__lastTouchY !== undefined) {
					delete (el as any).__lastTouchY
				}
				el = el.parentElement
			}
		}

		document.addEventListener("touchstart", handleTouchStart, capturePassiveStart)
		document.addEventListener("touchmove", handleTouchMove, captureActiveMove)
		document.addEventListener("touchend", handleTouchEnd, capturePassiveStart)
		document.addEventListener("touchcancel", handleTouchEnd, capturePassiveStart)
		// iOS 某些场景下 document 层拦截不足，补一层 window capture
		window.addEventListener("touchmove", handleTouchMove, captureActiveMove)

		return () => {
			document.removeEventListener("touchstart", handleTouchStart as any, captureOpts)
			document.removeEventListener("touchmove", handleTouchMove as any, captureOpts)
			document.removeEventListener("touchend", handleTouchEnd as any, captureOpts)
			document.removeEventListener("touchcancel", handleTouchEnd as any, captureOpts)
			window.removeEventListener("touchmove", handleTouchMove as any, captureOpts)
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
			setChartsRef.current((prev: string[]) => [...prev, message])
		})
		
		
		bo.initialLoading = true
		
		
		
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await storeSystemData()
		const eoa = profiles[0]?.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) setMyAddress(eoa)
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

			// 验签：支持外层 text 或内层嵌套 { text } 的格式（部分客户端签 inner.text）
			let sign = checkSign(msg.text, msg.signMessage, msg.from)
			let displayText = msg.text
			if (!sign && typeof msg.text === 'string') {
				try {
					const inner = JSON.parse(msg.text) as { text?: string }
					if (typeof inner?.text === 'string') {
						sign = checkSign(inner.text, msg.signMessage, msg.from)
						if (sign) displayText = inner.text
					}
				} catch {}
			}
			if (!sign) continue
			const signAddr = sign

			let idx = chats.findIndex(n => n?.address?.toLowerCase() === signAddr.toLowerCase())
			let chat = idx >= 0 ? { ...chats[idx] } : null

			// ✅ 不存在：创建新 chat
			if (!chat) {
				const _account = await searchUsername(signAddr)
				if (!_account?.results?.length) continue

				const acc: searchResult = _account.results[0]
				const kk = await getKeysFromCoNETPGPSC(acc.address, profile.privateKeyArmor)
				if (!kk?.publicArmored) continue

				chat = {
					address: signAddr,
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

			// ✅ 合并消息（去重 + 排序）；displayText 已归一化（嵌套格式时用 inner.text）
			const nextMessages = makeMessage(
				chat.messages || [],
				displayText,
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

			if (isNew && isMembershipActivatedWithHash(displayText)) chatsToAutoReply.push(nextChat)

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

  /** BeamioUserCard redeem URL：beamiocard + redeemcode → /History 并打开 ccsaRedeemOpen */
  const isRedeemUrl = (raw: string): boolean => {
    try {
      if (!raw || typeof raw !== 'string') return false
      const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://beamio.app')
      const redeemcode = u.searchParams.get('redeemcode') ?? u.searchParams.get('Redeemcode')
      return !!(redeemcode?.trim())
    } catch {
      return false
    }
  }

  const parseRedeemUrl = (raw: string): { cardAddress?: string; redeemCode: string } | null => {
    try {
      const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://beamio.app')
      const redeemcode = u.searchParams.get('redeemcode') ?? u.searchParams.get('Redeemcode')
      const beamiocard = u.searchParams.get('beamiocard') ?? u.searchParams.get('Beamiocard')
      if (!redeemcode?.trim()) return null
      return {
        cardAddress: beamiocard?.trim() || undefined,
        redeemCode: decodeURIComponent(redeemcode.trim()),
      }
    } catch {
      return null
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

    const nfcLinkRes = await handleNfcLinkAppDeepLinkScan(url)
    if (nfcLinkRes !== null) {
      navigate('/History')
      Toast.show({
        icon: nfcLinkRes.success ? 'success' : 'fail',
        content: nfcLinkRes.success ? 'NFC card linked to your wallet.' : (nfcLinkRes.error || 'Link failed'),
      })
      return
    }

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
		// 扫码自己时：直接进入我的钱包
		if (beamio?.accountName && String(_beamio).trim().toLowerCase() === String(beamio.accountName).toLowerCase()) {
			setScanData("")
			navigate('/myWallet')
			return
		}
		const _wallet = searchParams.get("wallet") ?? searchParams.get("Wallet") ?? ""
		const walletAddr = _wallet.trim() && ethers.isAddress(_wallet.trim()) ? ethers.getAddress(_wallet.trim()) : null
		if (walletAddr) {
			setPreferredPayeeWallet({ beamioAccount: _beamio.trim(), wallet: walletAddr })
		}
		const user = await searchUsername(_beamio)
		const results: searchResult[] = user?.results ?? []
		if (!results.length) return

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

  // scan QR workflow：isInitialLoading 时不处理 scanData，扫码逻辑仅适用于已有 wallet 后的正常使用
  useEffect(() => {
    if (!scanData||isInitialLoading) return
    // voucherPay / payBill 全流程由 TenKeyInputComponent 内的 Smart Routing Analysis 处理，此处不消费 scanData
    if (scanIntent === 'voucherPay' || scanIntent === 'payBill') return

    const run = async () => {
      // 符合 paymentUrl 的扫码结果：navigate 到 /History，打开 TenKeyInput 向 request 人支付 request 金额
      if (isPaymentUrl(scanData)) {
        setScanIntent('voucherPay')
        setVoucherPayFromScan(true)
        navigate('/History')
        return
      }
      const nfcLinkFromScan = await handleNfcLinkAppDeepLinkScan(scanData)
      if (nfcLinkFromScan !== null) {
        setScanData('')
        Toast.show({
          icon: nfcLinkFromScan.success ? 'success' : 'fail',
          content: nfcLinkFromScan.success ? 'NFC card linked to your wallet.' : (nfcLinkFromScan.error || 'Link failed'),
        })
        return
      }
      if (isRedeemUrl(scanData)) {
        const parsed = parseRedeemUrl(scanData)
        setScanData("")
        if (parsed) {
          setRedeemFromUrl(parsed)
          navigate("/History")
        }
        return
      }
      if (/^0x/i.test(scanData)) {
        const addr = scanData
        setScanData("")
        try {
          const user = await searchUsername(addr)
          const results: searchResult[] = user?.results || []
          const searchResultItem: searchResult = results[0] ?? {
            address: addr,
            created_at: 0,
            first_name: '',
            last_name: '',
            follow_count: '',
            follower_count: '',
            username: addr.slice(0, 6) + '…' + addr.slice(-4),
            image: '',
          }
          setUserPreviewItem(searchResultItem)
          setPayFocusAmountOnMount(true)
          setShowAlphaHowItWorks('Pay')
          setShowFooter(false)
          navigate("/")
        } catch {
          setUserPreviewItem({
            address: addr,
            created_at: 0,
            first_name: '',
            last_name: '',
            follow_count: '',
            follower_count: '',
            username: addr.slice(0, 6) + '…' + addr.slice(-4),
            image: '',
          })
          setPayFocusAmountOnMount(true)
          setShowAlphaHowItWorks('Pay')
          setShowFooter(false)
          navigate("/")
        }
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
		if (!Array.isArray(charts) || charts.length === 0) return

		// profile 或 temp 未就绪时，延迟重试（防止 init 未完成时丢消息）
		if (!profiles?.length || !profiles[0] || !temp) {
			const t = setTimeout(() => {
				// 触发重新检查：通过 setCharts 保持引用不变但触发 effect 重跑
				setCharts((prev: string[]) => (prev.length ? [...prev] : prev))
			}, 500)
			return () => clearTimeout(t)
		}

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
		<div
			className="overscroll-none h-full min-h-screen flex flex-col"
			style={{ backgroundColor: '#000414' }}
		>
			<div ref={bodyRef} className="overscroll-none flex-1 min-h-0 flex flex-col">
				<div className="flex-1 min-h-0 flex flex-col">
				<Routes>
				<Route path="/Onboarding" element={<BeamioInstallOnboarding />} />
				<Route element={<AppEntryGate />}>
					<Route path="/" element={<Home />} />
					<Route path="/wallet" element={<WalletOverview />} />
					<Route path="/History" element={<History />} />
					<Route path="/Pay" element={<Pay />} />
					<Route path="/qr" element={<QrOperationPage />} />
					<Route path="/Chat" element={<Chat />} />
					<Route path="/chat/:id" element={<ChatDetail />} />
					<Route path="/settings" element={<MyWallet />} />
					<Route path="/discover" element={<Market />} />
					<Route path="/browser" element={<Browser />} />
					<Route path="/myWallet" element={<MyWallet />} />
					<Route path="/myBrands" element={<MyBrandsPage />} />
					<Route path="/HistoryAll" element={<HistoryAll />} />
					<Route path="/vouchers-example" element={<VouchersExample />} />
					<Route path="/example-express" element={<ExampleExpress />} />
					<Route path="/ten-key-input" element={<TenKeyInput />} />
					<Route path="/example-card" element={<EmapmpleCard />} />
					<Route path="/example-new-card" element={<NewCardExample />} />
					<Route path="/transfertion" element={<BeamioTransactions />} />
					<Route path="/native-pos" element={<MobilePOS />} />
					<Route path="/render-action" element={<RenderActionPage />} />
				</Route>
				</Routes>
				</div>
			</div>

			{createPortal(
				<Footer visible={showFooter && footerVisible} peek={false} />,
				document.body
			)}

			{/* 全局 Search：任意页面点击 footer 的 search 图标后，直接显示/隐藏（无滑动动画）
				当 search 控件执行关闭（返回按钮/选择结果）后，父容器必须执行 setChatSearchOpen(false) 隐藏 search */}
			{chatSearchOpen && createPortal(
				<div className="fixed inset-0 z-[100] flex flex-col">
					{/* 遮罩：点击后关闭 search，确保父容器执行隐藏 */}
					<div
						className="flex-1 min-h-0"
						aria-hidden
						onClick={() => {
							setChatSearchOpen(false)
							setShowFooter(true)
						}}
					/>
					<div
						className="flex-shrink-0 flex items-center px-4 pb-5"
						style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
					>
						<SearchInputWithDropdown
							showHistory={false}
							showSideSlidePanel={false}
							closeWindow={item => {
								// 必须：search 关闭后父容器执行隐藏
								setChatSearchOpen(false)
								if (item && typeof item !== 'string') {
									setUserPreviewItem(item)
									setShowAlphaHowItWorks('BeamioContactProfilePreview')
									setShowFooter(false)
								} else {
									setShowFooter(true)
								}
							}}
							showBackIcon={true}
							select={true}
							focus={true}
						/>
					</div>
				</div>,
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
											// 与扫码地址 workflow 一致：打开 Pay 底部栏，聚焦金额输入框
											setUserPreviewItem(item)
											setPayFocusAmountOnMount(true)
											setShowAlphaHowItWorks('Pay')
											setShowFooter(false)
											navigate('/')
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
									preferredToAddress={
										preferredPayeeWallet &&
										preferredPayeeWallet.beamioAccount === userPreviewItem.username &&
										ethers.isAddress(preferredPayeeWallet.wallet)
											? preferredPayeeWallet.wallet
											: undefined
									}
									focusAmountOnMount={payFocusAmountOnMount}
									close={() => {
										setPreferredPayeeWallet(null)
										setPayFocusAmountOnMount(false)
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
							className="fixed inset-x-0 bottom-0 z-[211] bg-white dark:bg-slate-900 rounded-t-[22px] pb-[env(safe-area-inset-bottom)]"
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
  return <AppShell />
}
