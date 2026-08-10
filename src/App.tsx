// App.tsx
import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect, startTransition } from "react"
import { Route, Routes, useNavigate, useLocation } from "react-router-dom"
import { useDaemonContext } from "./providers/DaemonProvider"
import { useBeamioTagDatabase } from "./providers/BeamioTagDatabaseProvider"
import Footer from "@/components/Footer"
import { openExternalUrl } from "@/utils/cashTreesNativeNfc"
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
import { initChat, checkSign, createInboundChatSession, makeMessage, sendMessage, resumeGossipListenOnForeground, pauseGossipListenOnBackground, getGossipDeliveryAckContext, getKeysFromCoNETPGPSC } from "@/services/chat"
import {
	parseChatDeliveryReceiptV1,
	markMessageDeliveredBySendId,
	extractInboundSendId,
	emitDualChatDeliveryReceipts,
	postMailboxDeliveryAck,
} from "@/utils/chatDeliveryReceipt"
import { ensureNativePushBoundForWallet, ensurePushDeviceTokenListener } from "@/utils/cashTreesPushBind"
import { mirrorChatMessageToHistory, mergeHistoryEntriesIntoMessages } from "@/services/chatHistoryMirror"
import { onHistoryBuffer, loadWorkerHistory } from "@/services/chatWorkerBridge"
import type { HistoryEntry } from "./vendor/beamio-chat-sdk/types"
import { checkStorage, storeSystemData, runAutoBUnitFreeClaimIfEligible, handleNfcLinkAppDeepLinkScan, ensureProfilePrivateKeyArmorFromMnemonic, bootstrapProfileLocaleCurrencyIfUnset, mergeLocalLocaleLanguageOntoChainProfile } from "@/services/beamio"
import { hasLocalPlaintextMnemonic } from "@/utils/consumerWalletGate"
import { ensureEphemeralWalletForCouponClaim } from "@/utils/ephemeralCouponClaimWallet"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { resolveSigningPrivateKeyArmor } from "@/utils/resolveSigningPrivateKeyArmor"
import { bindStashedShareRefereesIfNeeded, recordDiscoverShareClickIfNeeded } from '@/utils/discoverShareClickEvent'
import { baseEndpoint, USDCContract_BASE } from "@/utils/constants"
import usdc_abi from "@/services/ABI/usdc_abi.json"
import Vouchers from "@/pages/Vouchers/index"
import MyWallet from "@/pages/Settings/index"
import { ethers } from "ethers"
import { getDeprecatedBeamioConetLinkMemo } from "@/utils/deprecatedBeamioConet"
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
import BusinessStartKetRedeemAdminPage from '@/pages/Wallet/BusinessStartKetRedeemAdminPage'
import AaMultisigPage from '@/pages/Wallet/AaMultisigPage'
import ValidatorNodeProfilePage from '@/pages/Wallet/ValidatorNodeProfilePage'
import ReferralRegistryDashboardPage from '@/pages/Wallet/ReferralRegistryDashboardPage'
import MyBrandsPage from '@/pages/Brands/MyBrandsPage'
import BountyBoard from '@/pages/BountyBoard'
import CoNetMiningDetailPage from '@/pages/BountyBoard/CoNetMiningDetailPage'
import GenesisNodeReferralPage from '@/pages/BountyBoard/GenesisNodeReferralPage'
import GenesisL0RedeemManagePage from '@/pages/BountyBoard/GenesisL0RedeemManagePage'
import GenesisL1EvangelistManagePage from '@/pages/BountyBoard/GenesisL1EvangelistManagePage'
import RenderActionPage from '@/renderAction'
import { getUserInfo } from "@/services/beamio"
import { AppButton } from "@/components/button/AppButton"
import { Check } from "lucide-react"
import { postCardCouponOpenClaimWithCurrentWallet, postCardRedeem, type CouponOpenClaimEligibility } from "@/services/BeamioCard"
import CouponClaimTicketPreview from "@/components/Home/CouponClaimTicketPreview"
import ShowPayCodeSheet from "@/components/Home/ShowPayCodeSheet"
import RedeemClaimTicketPreview from "@/components/Home/RedeemClaimTicketPreview"
import type { ActiveCouponListItem } from "@/pages/Home/ActiveCouponsScreen"
import {
	collectDeepLinkSearchParams,
	parseCouponOpenClaimFromParams,
	parseRedeemClaimFromParams,
	isRedeemDeepLink,
	isCouponOpenClaimDeepLink,
} from "@/utils/beamioDeepLinkParams"
import { parseDiscoverMerchantFromParams, stripDiscoverMerchantDeepLinkParams } from "@/utils/discoverMerchantShare"
import { readDiscoverShareReferrer, stashDiscoverShareReferrer } from "@/utils/discoverShareReferrerStash"
import { applyPendingConsumerDeepLinkIfNeeded } from "@/utils/pendingConsumerDeepLink"
import { publishNativePwaLog } from "@/utils/cashTreesNativePwaLog"
import { BEAMIO_WALLET_READY_EVENT } from "@/utils/beamioWalletReadyEvent"
import { ensureConetAaForProfileAndPersist } from "@/utils/ensureConetAa"
import { ingestAaMultisigFromChat } from '@/utils/aaMultisigIngest'
import { tu } from '@/locale/beamioLocale'
import { mapServerError } from '@/locale/mapServerError'

global.Buffer = require("buffer").Buffer

type message = {
  from: string
  signMessage: string
  text: string
  timestamp: number
  /** Attached by gossip decrypt — keccak256(utf8(PGP armor)) for mailbox ACK */
  _beamioPgpArmorHash?: string
}

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
	redeemResult,
	setRedeemResult,
	setMyAddress,
	refreshRecentActivityNoAa,
	applyCouponOpenClaimStatus,
  } = useDaemonContext()

  const {
    searchRemoteAndIngest,
    resolvePeerSearchResult,
  } = useBeamioTagDatabase()

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [footerVisible, setFooterVisible] = useState(true)
  const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
  const [couponClaimIntent, setCouponClaimIntent] = useState<{
    cardAddress: string
    couponId: string
    referrerEoa?: string | null
  } | null>(null)
  const [couponClaimPreviewRow, setCouponClaimPreviewRow] = useState<ActiveCouponListItem | null>(null)
  const [couponClaimEligibility, setCouponClaimEligibility] = useState<CouponOpenClaimEligibility | null>(null)
  const [couponClaimSubmitting, setCouponClaimSubmitting] = useState(false)
  /** Already-claimed open-claim → OpenContainer QR for POS 核销. */
  const [couponClaimShowPayOpen, setCouponClaimShowPayOpen] = useState(false)
  const [redeemClaimIntent, setRedeemClaimIntent] = useState<{ cardAddress?: string; redeemCode: string } | null>(null)
  const [redeemClaimSubmitting, setRedeemClaimSubmitting] = useState(false)
  /** 扫码 beamio URL 中的 wallet 参数：{ beamioAccount, wallet }，PayScreen 优先使用此地址 */
  const [preferredPayeeWallet, setPreferredPayeeWallet] = useState<{ beamioAccount: string; wallet: string } | null>(null)
  const runningRef = useRef(false)
  const pendingQueueRef = useRef<string[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())
  const setChartsRef = useRef(setCharts)
  setChartsRef.current = setCharts
  const gossipActiveRef = useRef(gossip)
  gossipActiveRef.current = gossip
  const bUnitClaimAttemptedRef = useRef(false)
  const initialRedeemUrlProcessedRef = useRef(false)
  const initialOpenClaimUrlProcessedRef = useRef(false)
  const initialDiscoverMerchantUrlProcessedRef = useRef(false)
  const routeLockHashRef = useRef<string>("")
  const routeLockApplyingRef = useRef(false)

  const navigate = useNavigate()
  const location = useLocation()

  /** Restore merchant/coupon + `ref=` stashed on app-download before App Store install. */
  useLayoutEffect(() => {
    applyPendingConsumerDeepLinkIfNeeded()
  }, [])

  /** 钱包解锁后静默 ensure CoNET AA（任意路由；深链 /discover 不再仅限 Home `/`）。 */
  useEffect(() => {
    if (isInitialLoading) return
    const profile = profiles?.[0]
    const eoa = profile?.keyID?.trim()
    if (!eoa || !ethers.isAddress(eoa)) return
    const persistedAa = profile.aaAccount?.trim()
    if (
      persistedAa &&
      ethers.isAddress(persistedAa) &&
      persistedAa.toLowerCase() !== eoa.toLowerCase()
    ) {
      return
    }
    void ensureConetAaForProfileAndPersist(profile, setProfiles)
  }, [isInitialLoading, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, setProfiles])

  /** Share-link `ref=` binds need the opener's AA, which usually appears after the first open. */
  useEffect(() => {
    if (isInitialLoading) return
    const profile = profiles?.[0]
    const eoa = profile?.keyID?.trim()
    const aa = profile?.aaAccount?.trim()
    if (!eoa || !ethers.isAddress(eoa)) return
    if (!aa || !ethers.isAddress(aa) || aa.toLowerCase() === eoa.toLowerCase()) return
    const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
    if (!privateKeyArmor) return
    void bindStashedShareRefereesIfNeeded(privateKeyArmor)
  }, [isInitialLoading, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount])
  // 直接打开 redeem URL（如 https://beamio.app/app/?beamiocard=...&redeemcode=...）时先打开确认页
  useEffect(() => {
    if (isInitialLoading || initialRedeemUrlProcessedRef.current) return
    if (typeof window === 'undefined') return
    const parsed = parseRedeemClaimFromParams(collectDeepLinkSearchParams(window.location.href))
    if (!parsed) return
    initialRedeemUrlProcessedRef.current = true
    setCouponClaimIntent(null)
    setRedeemClaimIntent(parsed)
    setShowFooter(false)
    navigate('/History')
  }, [isInitialLoading, navigate, setShowFooter])

  // 直接打开 coupon open-claim URL（如 ?beamiocard=0x...&couponId=...&claim=open）时先打开确认页
  useEffect(() => {
    if (isInitialLoading || initialOpenClaimUrlProcessedRef.current) return
    if (typeof window === 'undefined') return

    const parsed = parseCouponOpenClaimFromParams(collectDeepLinkSearchParams(window.location.href))
    if (!parsed) return

    initialOpenClaimUrlProcessedRef.current = true
    stashDiscoverShareReferrer(parsed.cardAddress, parsed.referrerEoa)
    setRedeemClaimIntent(null)
    setCouponClaimIntent(parsed)
    setShowFooter(false)
    navigate('/History', {
      state: { discoverShareReferrerEoa: parsed.referrerEoa },
    })
  }, [isInitialLoading, navigate, setShowFooter])

  // Discover merchant deep link (?beamiocard=…&discover=open) → open merchant detail on /discover
  useEffect(() => {
    if (isInitialLoading || initialDiscoverMerchantUrlProcessedRef.current) return
    if (typeof window === 'undefined') return

    const parsed = parseDiscoverMerchantFromParams(collectDeepLinkSearchParams(window.location.href))
    if (!parsed) return

    initialDiscoverMerchantUrlProcessedRef.current = true
    stashDiscoverShareReferrer(parsed.cardAddress, parsed.referrerEoa)
    setShowFooter(true)
    navigate('/discover', {
      state: {
        openDiscoverMerchantCard: parsed.cardAddress,
        discoverShareReferrerEoa: parsed.referrerEoa,
      },
    })
    /** Clear `?beamiocard=&discover=open` so Discover Back cannot leave main UI `invisible`. */
    stripDiscoverMerchantDeepLinkParams()
  }, [isInitialLoading, navigate, setShowFooter])

  const couponShareClickRecordedRef = useRef(false)
  useEffect(() => {
    if (isInitialLoading || couponShareClickRecordedRef.current || !couponClaimIntent) return
    const privateKeyArmor = resolveSigningPrivateKeyArmor(profiles?.[0])
    if (!privateKeyArmor) return
    couponShareClickRecordedRef.current = true
    void recordDiscoverShareClickIfNeeded({
      cardAddress: couponClaimIntent.cardAddress,
      privateKeyArmor,
      referrerEoa: couponClaimIntent.referrerEoa ?? readDiscoverShareReferrer(couponClaimIntent.cardAddress),
      couponId: couponClaimIntent.couponId,
    })
  }, [isInitialLoading, couponClaimIntent, profiles?.[0]])

  const handleConfirmRedeemClaim = async () => {
    if (!redeemClaimIntent || redeemClaimSubmitting) return
    const cardAddress = redeemClaimIntent.cardAddress?.trim() ?? ''
    if (!cardAddress || !ethers.isAddress(cardAddress)) {
      Toast.show({ content: tu('redeem_link_is_missing_a_valid_card_address'), position: 'top' })
      return
    }
    const privateKeyArmor = resolveSigningPrivateKeyArmor(profiles?.[0])
    const toUserEOA = (profiles?.[0]?.keyID ?? '').trim()
    if (!privateKeyArmor || !toUserEOA || !ethers.isAddress(toUserEOA)) {
      Toast.show({ content: tu('unlock_your_wallet_with_your_access_password_to_continue'), position: 'top' })
      return
    }
    setRedeemClaimSubmitting(true)
    try {
      const ret = await postCardRedeem(
        ethers.getAddress(cardAddress),
        redeemClaimIntent.redeemCode,
        ethers.getAddress(toUserEOA)
      )
      if (ret.success) {
        setRedeemResult({ success: true, tx: ret.tx })
        closeRedeemClaimPanel()
        void refreshRecentActivityNoAa()
        Toast.show({ content: tu('redeem_submitted_successfully'), position: 'top' })
      } else {
        Toast.show({ content: mapServerError(ret.error, 'redeemFailed'), position: 'top' })
      }
    } catch (e: any) {
      Toast.show({ content: mapServerError(e?.message), position: 'top' })
    } finally {
      setRedeemClaimSubmitting(false)
    }
  }

  useEffect(() => {
    if (!couponClaimIntent) {
      setCouponClaimPreviewRow(null)
      setCouponClaimEligibility(null)
      setCouponClaimShowPayOpen(false)
    }
  }, [couponClaimIntent])

  const closeCouponClaimPanel = () => {
    setCouponClaimIntent(null)
    setCouponClaimEligibility(null)
    setCouponClaimShowPayOpen(false)
    setShowFooter(true)
    navigate('/')
  }

  const closeRedeemClaimPanel = () => {
    setRedeemClaimIntent(null)
    setShowFooter(true)
    navigate('/')
  }

  const handleConfirmCouponClaim = async () => {
    if (!couponClaimIntent || couponClaimSubmitting) return
    if (
      couponClaimEligibility === 'already_claimed' ||
      couponClaimEligibility === 'already_redeemed' ||
      couponClaimEligibility === 'sold_out' ||
      couponClaimEligibility === 'expired' ||
      couponClaimEligibility === 'not_open_claim' ||
      couponClaimEligibility === 'insufficient_social_points'
    ) {
      return
    }
    const privateKeyArmor = resolveSigningPrivateKeyArmor(profiles?.[0])
    if (!privateKeyArmor) {
      Toast.show({ content: tu('unlock_your_wallet_with_your_access_password_to_claim_coupons'), position: 'top' })
      return
    }
    setCouponClaimSubmitting(true)
    try {
      const ret = await postCardCouponOpenClaimWithCurrentWallet({
        cardAddress: couponClaimIntent.cardAddress,
        couponId: couponClaimIntent.couponId,
        tokenId: couponClaimPreviewRow?.tokenId,
        privateKeyArmor,
        referrerEoa: couponClaimIntent.referrerEoa ?? null,
      })
      Toast.show({
        content: ret.success
          ? tu('claimed')
          : (ret.error ?? tu('coupon_open_claim_failed')),
        position: 'top',
      })
      if (ret.success) {
        const tid = couponClaimPreviewRow?.tokenId?.trim()
        if (tid) {
          applyCouponOpenClaimStatus({
            cardAddress: couponClaimIntent.cardAddress,
            tokenId: tid,
            couponId: couponClaimIntent.couponId,
            status: 'claimed',
            source: 'optimistic',
          })
        }
        // Keep panel open → Show Pay for POS redeem/burn (same as app-download landing).
        setCouponClaimEligibility('already_claimed')
      }
    } catch (e: any) {
      Toast.show({ content: mapServerError(e?.message), position: 'top' })
    } finally {
      setCouponClaimSubmitting(false)
    }
  }

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
    void runAutoBUnitFreeClaimIfEligible(p0.privateKeyArmor!, claimant).then((outcome) => {
      if (outcome === 'claimed_success') {
        Toast.show({ content: tu('20_b_units_claimed'), position: 'top' })
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
    useState<"BeamioContactProfilePreview" | ""|'支付'>("")
  const [payFocusAmountOnMount, setPayFocusAmountOnMount] = useState(false)

	// 当 showFooter 为 true 或路由变化时恢复 footer 可见，避免 scroll 隐藏后、页面切换时 footerVisible 未重置
  useLayoutEffect(() => {
    if (showFooter) setFooterVisible(true)
  }, [showFooter, pathname])

	/** Main Footer tabs: keep global bar always tappable (no scroll-hide). Sub-routes use setShowFooter(false). */
	const isGlobalBarPinRoute = useMemo(() => {
		const p = (pathname || '/').toLowerCase()
		if (p === '/' || p.startsWith('/?')) return true
		if (p === '/wallet' || p.startsWith('/wallet?')) return true
		if (p === '/discover' || p.startsWith('/discover?')) return true
		if (p === '/chat' || p.startsWith('/chat?')) return true
		if (p === '/bountyboard' || p.startsWith('/bountyboard?')) return true
		return false
	}, [pathname])

	useEffect(() => {
		if (isGlobalBarPinRoute) setFooterVisible(true)
	}, [isGlobalBarPinRoute])

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
		/** touch identifier(s) that began on an interactive control — skip scroll suppression for whole gesture */
		const interactiveTouchIds = new Set<number>()
		const TOUCH_INTERACTIVE_SELECTOR =
			"button, a[href], input, textarea, select, [role='button'], label, summary, [data-touch-priority='1']"
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
			// Do not stopImmediatePropagation — it can prevent synthesized click on buttons.
		}

		const canScroll = (el: HTMLElement) => {
			const style = window.getComputedStyle(el)
			const overflowY = style.overflowY
			if (overflowY !== "auto" && overflowY !== "scroll") return false
			return el.scrollHeight > el.clientHeight
		}

		const isTouchInteractiveTarget = (target: Element | null) =>
			Boolean(target?.closest(TOUCH_INTERACTIVE_SELECTOR))

		const handleTouchStart = (e: TouchEvent) => {
			const t = e.touches[0]
			if (!t) return
			touchStartX = t.clientX
			touchStartY = t.clientY
			const targetEl = touchTargetToElement(e.target)
			if (isTouchInteractiveTarget(targetEl)) {
				for (let i = 0; i < e.touches.length; i++) {
					interactiveTouchIds.add(e.touches[i].identifier)
				}
			}
			const vw = window.innerWidth || document.documentElement.clientWidth || 0
			const startedAtEdge = touchStartX <= EDGE_GUARD_PX || touchStartX >= vw - EDGE_GUARD_PX
			// 保留可横向滚动容器（例如 Market 横向菜单）的手势，不拦截其内部 touch
			edgeSwipeBlock = startedAtEdge && !hasHorizontalScrollableAncestor(targetEl)
		}

		const touchMoveIsOnInteractiveGesture = (e: TouchEvent) => {
			for (let i = 0; i < e.touches.length; i++) {
				if (interactiveTouchIds.has(e.touches[i].identifier)) return true
			}
			return false
		}

		const clearInteractiveTouchIds = (e: TouchEvent) => {
			for (let i = 0; i < e.changedTouches.length; i++) {
				interactiveTouchIds.delete(e.changedTouches[i].identifier)
			}
		}

		const handleTouchMove = (e: TouchEvent) => {
			const touchTarget = e.target

			const touch = e.touches[0]
			if (!touch) return

			if (touchMoveIsOnInteractiveGesture(e)) return

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
			if (isTouchInteractiveTarget(elHit)) {
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
			clearInteractiveTouchIds(e)
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
		/** Larger than sub-pixel / overflow-anchor noise so /home mid-scroll does not flip footer every frame. */
		const threshold = 12
		let footerVisibleCommitTimer: ReturnType<typeof setTimeout> | undefined
		let pendingFooterVisible: boolean | null = null

		const commitFooterVisible = (next: boolean) => {
			pendingFooterVisible = next
			if (footerVisibleCommitTimer !== undefined) clearTimeout(footerVisibleCommitTimer)
			footerVisibleCommitTimer = setTimeout(() => {
				footerVisibleCommitTimer = undefined
				if (pendingFooterVisible == null) return
				const v = pendingFooterVisible
				pendingFooterVisible = null
				setFooterVisible(v)
			}, 80)
		}

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

				// Main tab routes: never scroll-hide the global bar (BountyBoard / Home / … taps must stay live).
				if (isGlobalBarPinRoute) {
					commitFooterVisible(true)
					lastTopMap.set(src, getScrollTop(src))
					ticking = false
					return
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
					commitFooterVisible(true)
				} else if (Math.abs(delta) >= threshold) {
					if (delta > 0) commitFooterVisible(false)
					else {
						if (!nearBottom) commitFooterVisible(true)
					}
				}

				lastTopMap.set(src, top)
				ticking = false
			})
		}

		window.addEventListener("scroll", onAnyScroll, { passive: true })
		document.addEventListener("scroll", onAnyScroll, { passive: true, capture: true })

		return () => {
			if (footerVisibleCommitTimer !== undefined) clearTimeout(footerVisibleCommitTimer)
			window.removeEventListener("scroll", onAnyScroll)
			document.removeEventListener("scroll", onAnyScroll, true)
		}
	}, [isGlobalBarPinRoute])

	const init = async (source = 'mount', temp?: encrypt_keys_object) => {
		publishNativePwaLog('info', `[AppShell] init start (${source})`)

		let isAcc = temp ?? (await checkStorage())
		if ((!isAcc || !hasLocalPlaintextMnemonic(isAcc)) && !temp) {
			const provisioned = await ensureEphemeralWalletForCouponClaim()
			if (provisioned) {
				isAcc = provisioned
				temp = provisioned
			}
		}

		if (!isAcc) {
			publishNativePwaLog('info', '[AppShell] init skip: no local wallet storage')
			setIsInitialLoading(true)
			return 
		}

		temp = temp || isAcc
		temp = ensureProfilePrivateKeyArmorFromMnemonic(temp) ?? temp

		const profiles = temp?.profiles

		if (!temp || !profiles) {
			publishNativePwaLog('info', '[AppShell] init skip: missing profiles')
			setIsInitialLoading(true)
			return 
		}

		if (!hasLocalPlaintextMnemonic(temp)) {
			publishNativePwaLog('info', '[AppShell] init skip: wallet recover required (no local mnemonic) — gossip not started')
			setIsInitialLoading(true)
			return
		}

		if (gossipActiveRef.current) {
			// Onboard LoadingPage may have already started gossip — still bind push here.
			publishNativePwaLog('info', '[AppShell] init skip chat (gossip active); ensuring push bind')
			setCoNET_Data(temp)
			setProfiles(profiles)
			ensurePushDeviceTokenListener()
			ensureNativePushBoundForWallet(profiles[0])
			// History restore is owned by the worker; re-kick in case the early gossip=true
			// race queued a load before activeClient existed (or App effect ran too early).
			void loadWorkerHistory()
			setIsInitialLoading(false)
			return
		}

		publishNativePwaLog('info', '[AppShell] init proceeding → initChat')

		setCoNET_Data(temp)
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
		
		let bo: beamio = mergeLocalLocaleLanguageOntoChainProfile(userInfo, temp.beamio)
		const pk = profiles[0]?.privateKeyArmor
		if (pk) {
			bo = await bootstrapProfileLocaleCurrencyIfUnset(bo, pk)
		} else {
			const { applyBeamioUiLanguageFromProfile } = await import('@/locale/i18n')
			await applyBeamioUiLanguageFromProfile(bo.language)
		}

		await initChat(setProfiles,setAllNodes, setGossip, gossipActiveRef.current, message => {
			setChartsRef.current((prev: string[]) => [...prev, message])
		})

		ensurePushDeviceTokenListener()
		ensureNativePushBoundForWallet(profiles[0])
		
		
		bo.initialLoading = true
		
		
		
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await storeSystemData()
		const eoa = profiles[0]?.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) {
			setMyAddress(eoa)
			void ensureConetAaForProfileAndPersist(profiles[0], setProfiles).catch(() => {})
		}
		setIsInitialLoading(false)

  	}

	// 首次进入 + 钱包恢复后重试 gossip（冷启动时 AppShell 往往早于 recover 完成）
	useEffect(() => {
		void init('mount')

		const onWalletReady = () => {
			void init('wallet-ready')
		}
		window.addEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)

		// Home / app-switcher: keep gossip listen alive so the still-running PWA can receive
		// chat and push a **local** system notification via the native bridge
		// (`notifyBackgroundChat`). Aborting listen on every visibilitychange would force the
		// SI offline path — but APNs often does not update the icon while the process is still
		// "current". Only tear down listen on pagehide / bfcache (true unload).
		const onForegroundResume = () => {
			void resumeGossipListenOnForeground(
				setProfiles,
				setAllNodes,
				setGossip,
				message => {
					setChartsRef.current((prev: string[]) => [...prev, message])
				},
			).catch(err => {
				publishNativePwaLog(
					'warn',
					`[AppShell] gossip foreground resume failed: ${(err as Error)?.message ?? String(err)}`,
				)
			})
		}
		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				onForegroundResume()
			}
		}
		const onPageShow = (ev: PageTransitionEvent) => {
			// bfcache restore or shell bring-to-front — do not abort a connecting stream
			if (ev.persisted || document.visibilityState === 'visible') onForegroundResume()
		}
		document.addEventListener('visibilitychange', onVisibility)
		window.addEventListener('pageshow', onPageShow)
		const onPageHide = () => {
			// True unload / bfcache — drop listen so mailbox can saveLocal + APNs for killed app.
			pauseGossipListenOnBackground(setGossip)
		}
		window.addEventListener('pagehide', onPageHide)

		const t = setTimeout(() => setFooterVisible(true), 0)
		return () => {
			clearTimeout(t)
			window.removeEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)
			document.removeEventListener('visibilitychange', onVisibility)
			window.removeEventListener('pageshow', onPageShow)
			window.removeEventListener('pagehide', onPageHide)
			// Do NOT abort gossip / setGossip(false) here.
			// React StrictMode remount + LoadingPage/AppShell dual init previously killed the
			// SSE, which made mailbox B call setUserOnlineOnMe true/false in a tight loop.
			// Gossip is process-lifetime; only replace via connectToGossipNode when dead.
		}
	}, [])

	// Restore encrypted chat history on a fresh device (post account delete/restore):
	// decrypt (worker) → create missing peer sessions → dedup-merge into `profile.chats[].messages`.
	// Recover wipes local chats[]; history must be allowed to CREATE sessions (not only merge).
	//
	// Critical: do NOT await AddressPGP / searchUsername for every peer on the main thread —
	// that froze the whole UI for seconds after launch (jitter + dead buttons until done).
	useEffect(() => {
		let cancelled = false
		/** Serialize batches so tail + backfill cannot stack concurrent merges. */
		let chain: Promise<void> = Promise.resolve()
		const yieldToUi = () => new Promise<void>((r) => window.setTimeout(r, 0))

		const unsub = onHistoryBuffer((batch) => {
			const entries = batch?.entries
			if (!entries?.length) return
			const byPeer = new Map<string, HistoryEntry[]>()
			for (const e of entries) {
				const p = (e?.peer || batch?.peer || '').toLowerCase()
				if (!p || p === 'all' || !ethers.isAddress(p)) continue
				const arr = byPeer.get(p) || []
				arr.push(e)
				byPeer.set(p, arr)
			}
			if (byPeer.size === 0) return

			chain = chain.then(async () => {
				if (cancelled) return
				const profile0 = CoNET_Data?.profiles?.[0]
				const pk =
					resolveSigningPrivateKeyArmor(profile0) ||
					(typeof profile0?.privateKeyArmor === 'string' ? profile0.privateKeyArmor : '')
				if (!pk) {
					console.warn('[historyRestore] skip: no signing key yet')
					return
				}

				publishNativePwaLog(
					'info',
					`[historyRestore] batch peers=${byPeer.size} entries=${entries.length}`,
				)

				const existingChats = profile0?.chats
				const existing: chatData[] = Array.isArray(existingChats) ? existingChats : []
				const created = new Map<string, chatData>()
				let peerIdx = 0
				for (const peer of byPeer.keys()) {
					if (cancelled) return
					const has = existing.some((c) => (c?.address || '').toLowerCase() === peer)
					if (has) continue
					// Local tag DB only — never block restore on remote searchUsername.
					const acc: searchResult | null = resolvePeerSearchResult(peer)
					try {
						created.set(
							peer,
							await createInboundChatSession(peer, pk, acc, { skipKeyFetch: true }),
						)
					} catch (ex) {
						console.warn('[historyRestore] createInboundChatSession failed', peer, ex)
					}
					peerIdx += 1
					if (peerIdx % 3 === 0) await yieldToUi()
				}

				if (cancelled) return
				let changed = false
				startTransition(() => {
					setProfiles((prev) => {
						const list = Array.isArray(prev) ? prev : []
						const profile = list[0]
						if (!profile) return prev
						let chats = Array.isArray(profile.chats) ? [...profile.chats] : []
						let localChanged = false
						for (const [peer, es] of byPeer) {
							let idx = chats.findIndex((c) => (c?.address || '').toLowerCase() === peer)
							let sessionCreated = false
							if (idx < 0) {
								const stub = created.get(peer)
								if (!stub) continue
								chats.unshift(stub)
								idx = 0
								sessionCreated = true
								localChanged = true
							}
							const { messages, added } = mergeHistoryEntriesIntoMessages(chats[idx].messages, es)
							if (added <= 0 && !sessionCreated) continue
							if (!sessionCreated) {
								chats = [...chats]
								localChanged = true
								idx = chats.findIndex((c) => (c?.address || '').toLowerCase() === peer)
								if (idx < 0) continue
							}
							const last = messages[messages.length - 1]
							chats[idx] = {
								...chats[idx],
								messages,
								// History restore is catch-up: do not inflate unread badges.
								unreadCount: 0,
								...(last?.createdAt != null ? { lastReadTs: Number(last.createdAt) } : {}),
							}
						}
						if (!localChanged) return prev
						changed = true
						const nextProfile = { ...profile, chats }
						const nextList = [...list]
						nextList[0] = nextProfile
						if (CoNET_Data?.profiles?.length) CoNET_Data.profiles[0].chats = chats
						return nextList
					})
				})
				// Let React paint before scheduling IndexedDB stringify.
				await yieldToUi()
				if (changed && !cancelled) void storeSystemData()
			})
		})
		return () => {
			cancelled = true
			unsub()
		}
	}, [setProfiles, resolvePeerSearchResult])

	// Kick history restore once gossip worker is live; re-run when EOA is ready after recover.
	const historyEoa = (profiles?.[0]?.keyID || '').toLowerCase()
	useEffect(() => {
		if (!gossip || !historyEoa) return
		void loadWorkerHistory()
	}, [gossip, historyEoa])

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

		// 送出 message 到对方（sendMessage 内部挑选健康 entry 并重试）
		if (allNodes?.length) {
			await sendMessage(chatData.chatData.publicArmored, text, profile.privateKeyArmor, allNodes)
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
			if (!sign) {
				console.warn('[addNewMessage] skip: signature verify failed', { from: msg.from })
				continue
			}
			const signAddr = sign

			// Delivery receipt → mark sender bubble Delivered; never a chat bubble / unread.
			// Still mailbox-ACK this armor (cancels offline APNs); do NOT emit another sender receipt.
			const deliveryReceipt = parseChatDeliveryReceiptV1(displayText)
			if (deliveryReceipt) {
				const applied = markMessageDeliveredBySendId(chats, deliveryReceipt.sendId)
				if (applied.updated) {
					for (let i = 0; i < chats.length; i++) chats[i] = applied.chats[i]
				}
				const armorHashRaw =
					typeof (msg as { _beamioPgpArmorHash?: string })._beamioPgpArmorHash === 'string'
						? String((msg as { _beamioPgpArmorHash?: string })._beamioPgpArmorHash)
						: ''
				const ackCtx = getGossipDeliveryAckContext()
				const pk = profile.privateKeyArmor
				if (armorHashRaw && ackCtx?.routerArmoredPublicKey && pk) {
					void postMailboxDeliveryAck({
						armorHash: armorHashRaw,
						sendId: deliveryReceipt.sendId,
						routerArmoredPublicKey: ackCtx.routerArmoredPublicKey,
						privateKeyArmor: pk,
						entryNodes: ackCtx.entryNodes.length
							? ackCtx.entryNodes
							: allNodes?.length
								? allNodes
								: [],
						mailboxDomains: ackCtx.mailboxDomains,
					})
				}
				continue
			}

			const walletEoa = profile.keyID?.trim() ?? ''
			if (walletEoa) {
				try {
					ingestAaMultisigFromChat({ displayText, fromEoa: signAddr, walletEoa })
				} catch {
					/* multisig ingest must not break chat */
				}
			}

			let idx = chats.findIndex(n => n?.address?.toLowerCase() === signAddr.toLowerCase())
			let chat = idx >= 0 ? { ...chats[idx] } : null

			// ✅ 不存在：创建新 chat（无 profile / 无发件人 PGP 也保留会话，禁止静默丢弃）
			if (!chat) {
				let acc: searchResult | null = resolvePeerSearchResult(signAddr)
				if (!acc) {
					const res = await searchRemoteAndIngest(signAddr)
					let rows: searchResult[] = []
					if (res && typeof res === 'object' && Array.isArray((res as { results?: unknown }).results)) {
						rows = (res as { results: searchResult[] }).results
					}
					acc =
						rows.find((r) => (r?.address ?? '').toLowerCase() === signAddr.toLowerCase()) ??
						rows[0] ??
						null
				}

				chat = await createInboundChatSession(signAddr, profile.privateKeyArmor, acc)
				chats.unshift(chat)
				idx = 0
				console.log('[addNewMessage] verified inbound new session', {
					from: signAddr,
					hasProfile: !!acc?.username,
					hasPgp: !!chat.chatData?.publicArmored,
					textPreview: String(displayText).slice(0, 80),
				})
				Toast.show({
					content: acc?.username
						? `New message from @${acc.username}`
						: `New message from ${signAddr.slice(0, 6)}…${signAddr.slice(-4)}`,
					position: 'top',
				})
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

			// Mirror the newly-ingested inbound message into encrypted history (fresh-device recovery).
			if (isNew) {
				const inboundSendIdForMirror = extractInboundSendId(displayText)
				const addedInbound =
					nextMessages.find(m =>
						inboundSendIdForMirror
							? m.sendId === inboundSendIdForMirror
							: String(m.createdAt) === String(msg.timestamp),
					) || null
				mirrorChatMessageToHistory(nextChat.address, addedInbound || undefined, 'in')
			}

			// ✅ 放回 chats（不可变）
			if (idx === 0 && chats[0].address.toLowerCase() === nextChat.address.toLowerCase()) {
				chats[0] = nextChat
			} else {
				const realIdx = chats.findIndex(n => n.address.toLowerCase() === nextChat.address.toLowerCase())
				if (realIdx >= 0) chats[realIdx] = nextChat
				else chats.unshift(nextChat)
			}

			// After successful ingest: **must** dual-ack mailbox + sender (cancels SI 2-heartbeat APNs).
			if (isNew) {
				const armorHashRaw =
					typeof (msg as { _beamioPgpArmorHash?: string })._beamioPgpArmorHash === 'string'
						? String((msg as { _beamioPgpArmorHash?: string })._beamioPgpArmorHash)
						: ''
				const armorHash = armorHashRaw || undefined
				const inboundSendId = extractInboundSendId(displayText)
				const ackCtx = getGossipDeliveryAckContext()
				const pk = profile.privateKeyArmor
				if (pk) {
					void (async () => {
						let senderPgp = nextChat.chatData?.publicArmored || ''
						if (!senderPgp.trim()) {
							try {
								const keys = await getKeysFromCoNETPGPSC(signAddr, pk)
								senderPgp = keys?.publicArmored || ''
								if (senderPgp && nextChat.chatData) {
									nextChat.chatData = {
										...nextChat.chatData,
										publicArmored: senderPgp,
									}
									const realIdx = chats.findIndex(
										n => n.address.toLowerCase() === nextChat.address.toLowerCase(),
									)
									if (realIdx >= 0) chats[realIdx] = nextChat
								}
							} catch {
								/* sender receipt may skip if no PGP */
							}
						}
						await emitDualChatDeliveryReceipts({
							armorHash,
							sendId: inboundSendId,
							privateKeyArmor: pk,
							entryNodes: allNodes?.length ? allNodes : ackCtx?.entryNodes || [],
							mailboxAck: ackCtx
								? {
										routerArmoredPublicKey: ackCtx.routerArmoredPublicKey,
										entryNodes: ackCtx.entryNodes,
										mailboxDomains: ackCtx.mailboxDomains,
									}
								: null,
							senderPublicArmored: senderPgp || null,
							sendMessage,
						})
					})()
				}
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

	/** Initial boot: hide footer while loading. Do NOT force `true` on every tick —
	 *  overlays (Active Coupons, claim panels, Discover detail) manage their own hide;
	 *  stomping `setShowFooter(true)` lets the global bar reappear over Coupons. */
	useEffect(() => {
		if (isInitialLoading) setShowFooter(false)
	}, [isInitialLoading, setShowFooter])


	// ① 先统计（不要清 charts）— 排除 delivery receipt（不进 native icon badge）
	useEffect(() => {
		if (!Array.isArray(charts) || charts.length === 0) return

		let delta = 0
		const seen = seenMsgRef.current

		for (const raw of charts) {
			const key = getMsgKey(raw)
			if (!key) continue
			if (seen.has(key)) continue
			// Protocol delivery receipt must not bump Footer / native icon badge.
			try {
				const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
				const text = obj?.text
				if (text != null && parseChatDeliveryReceiptV1(text)) {
					seen.add(key)
					continue
				}
			} catch {
				/* count as normal if unwrap fails */
			}
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

  /** BeamioUserCard redeem URL：beamiocard + redeemcode */
  const isRedeemUrl = (raw: string): boolean => isRedeemDeepLink(raw)

  const parseRedeemUrl = (raw: string): { cardAddress?: string; redeemCode: string } | null =>
    parseRedeemClaimFromParams(collectDeepLinkSearchParams(raw))

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
      searchParams = collectDeepLinkSearchParams(url)
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
    const _couponId = decodeURIComponent((searchParams.get("couponId") || searchParams.get("couponid") || "").trim())
    const _claim = (searchParams.get("claim") || "").trim().toLowerCase()

	setScanData("")

    const nfcLinkRes = await handleNfcLinkAppDeepLinkScan(url)
    if (nfcLinkRes !== null) {
      navigate('/History')
      Toast.show({
        icon: nfcLinkRes.success ? 'success' : 'fail',
        content: nfcLinkRes.success ? tu('nfc_card_linked_to_your_wallet') : (nfcLinkRes.error || tu('link_failed')),
      })
      return
    }

    // BeamioUserCard redeem URL → 打开 Redeem 确认页（与 coupon open-claim 相同流程）
    if (_redeemcode?.trim()) {
      const parsedRedeem = parseRedeemClaimFromParams(searchParams)
      if (!parsedRedeem) {
        Toast.show({ content: tu('redeem_link_is_invalid_or_wallet_is_not_ready'), position: 'top' })
        navigate('/History')
        return
      }
      setRedeemClaimIntent(parsedRedeem)
      setCouponClaimIntent(null)
      setShowFooter(false)
      navigate('/History')
      return
    }

    // Discover merchant URL → /discover detail panel
    const parsedDiscover = parseDiscoverMerchantFromParams(searchParams)
    if (parsedDiscover) {
      stashDiscoverShareReferrer(parsedDiscover.cardAddress, parsedDiscover.referrerEoa)
      setShowFooter(true)
      navigate('/discover', {
        state: {
          openDiscoverMerchantCard: parsedDiscover.cardAddress,
          discoverShareReferrerEoa: parsedDiscover.referrerEoa,
        },
      })
      stripDiscoverMerchantDeepLinkParams()
      return
    }

    // Coupon open-claim URL: beamiocard + couponId + claim=open/1/true
    if (_beamiocard?.trim() && _couponId && (!_claim || _claim === "open" || _claim === "1" || _claim === "true")) {
      const parsedCoupon = parseCouponOpenClaimFromParams(searchParams)
      if (!parsedCoupon) {
        Toast.show({ content: tu('coupon_link_is_invalid_or_wallet_is_not_ready'), position: "top" })
        navigate("/History")
        return
      }
      stashDiscoverShareReferrer(parsedCoupon.cardAddress, parsedCoupon.referrerEoa)
      setCouponClaimIntent(parsedCoupon)
      setRedeemClaimIntent(null)
      setShowFooter(false)
      navigate("/History", {
        state: { discoverShareReferrerEoa: parsedCoupon.referrerEoa },
      })
      return
    }

    if (_beamio) {
		// 扫码自己时：直接进入我的钱包
		if (beamio?.accountName && String(_beamio).trim().toLowerCase() === String(beamio.accountName).toLowerCase()) {
			setScanData("")
			navigate('/myWallet')
			return
		}
		const _wallet = searchParams.get("wallet") ?? searchParams.get(tu('wallet')) ?? ""
		const walletAddr = _wallet.trim() && ethers.isAddress(_wallet.trim()) ? ethers.getAddress(_wallet.trim()) : null
		if (walletAddr) {
			setPreferredPayeeWallet({ beamioAccount: _beamio.trim(), wallet: walletAddr })
		}
		const user = await searchRemoteAndIngest(_beamio)
		const results: searchResult[] = (user as { results?: searchResult[] } | null)?.results ?? []
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
        const fx = await getDeprecatedBeamioConetLinkMemo(code)
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

    const run = async () => {
      // Coupon / redeem deep links must win over stale voucherPay scanIntent (global search paste after bill scan).
      // Redeem deep links win when both redeemcode and couponId are present (redeem-required coupons).
      if (isRedeemUrl(scanData)) {
        const parsed = parseRedeemUrl(scanData)
        setScanData('')
        setScanIntent('')
        if (parsed) {
          setCouponClaimIntent(null)
          setRedeemClaimIntent(parsed)
          setShowFooter(false)
          navigate('/History')
        }
        return
      }
      if (isCouponOpenClaimDeepLink(scanData)) {
        const parsed = parseCouponOpenClaimFromParams(collectDeepLinkSearchParams(scanData))
        setScanData('')
        setScanIntent('')
        if (parsed) {
          stashDiscoverShareReferrer(parsed.cardAddress, parsed.referrerEoa)
          setRedeemClaimIntent(null)
          setCouponClaimIntent(parsed)
          setShowFooter(false)
          navigate('/History', {
            state: { discoverShareReferrerEoa: parsed.referrerEoa },
          })
        } else {
          Toast.show({ content: tu('coupon_link_is_invalid_or_wallet_is_not_ready'), position: 'top' })
        }
        return
      }

      // voucherPay / payBill 全流程由 TenKeyInputComponent 内的 Smart Routing Analysis 处理，此处不消费 scanData
      if (scanIntent === 'voucherPay' || scanIntent === 'payBill') return

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
          content: nfcLinkFromScan.success ? tu('nfc_card_linked_to_your_wallet') : (nfcLinkFromScan.error || tu('link_failed')),
        })
        return
      }
      if (/^0x/i.test(scanData)) {
        const addr = scanData
        setScanData("")
        try {
          let results: searchResult[] = []
          const localPeer = resolvePeerSearchResult(addr)
          if (localPeer) {
            results = [localPeer]
          } else {
            const user = await searchRemoteAndIngest(addr)
            results = (user as { results?: searchResult[] } | null)?.results || []
          }
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
          setShowAlphaHowItWorks('支付')
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
          setShowAlphaHowItWorks('支付')
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
			className="overscroll-none flex min-h-[100dvh] flex-col"
			style={{ backgroundColor: '#000414' }}
		>
			<div ref={bodyRef} className="overscroll-none flex-1 min-h-0 flex flex-col">
				<div className="flex-1 min-h-0 flex flex-col">
				<Routes>
				<Route path="/Onboarding" element={<BeamioInstallOnboarding />} />
				<Route element={<AppEntryGate />}>
					<Route path="/" element={<Home />} />
					<Route path="/wallet" element={<WalletOverview />} />
					<Route path="/wallet/business-start-ket-redeem" element={<BusinessStartKetRedeemAdminPage />} />
					<Route path="/wallet/aa-multisig" element={<AaMultisigPage />} />
					<Route path="/wallet/conet-nodes" element={<ValidatorNodeProfilePage />} />
					<Route path="/wallet/referral-registry" element={<ReferralRegistryDashboardPage />} />
					<Route path="/History" element={<History />} />
					<Route path="/Pay" element={<Pay />} />
					<Route path="/BountyBoard" element={<BountyBoard />} />
					<Route path="/BountyBoard/conet-mining" element={<CoNetMiningDetailPage />} />
					<Route path="/BountyBoard/genesis-referral" element={<GenesisNodeReferralPage />} />
					<Route path="/BountyBoard/genesis-referral/redeem" element={<GenesisL0RedeemManagePage />} />
					<Route path="/BountyBoard/genesis-referral/l1" element={<GenesisL1EvangelistManagePage />} />
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
				<div className="fixed inset-0 z-[210]">
					{/* Full-screen dim — search bar sits above; avoids bright strip below the bar */}
					<div
						className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
						aria-hidden
						onClick={() => {
							setChatSearchOpen(false)
							setShowFooter(true)
						}}
					/>
					<div
						className="absolute inset-x-0 bottom-0 z-10 flex items-center px-4 pb-5"
						style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
						onClick={(e) => e.stopPropagation()}
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
											setShowAlphaHowItWorks('支付')
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
				{/* 灰色遮罩：父页面不可用。Closed children must also be pointer-events-none —
				    default `auto` on descendants re-enables hit-testing under a `none` parent. */}
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						showAlphaHowItWorks ? "opacity-100" : "opacity-0 pointer-events-none"
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
					showAlphaHowItWorks ? "translate-y-0" : "translate-y-full pointer-events-none"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体：h-auto 自适应内容高度。Closed: pe-none on body too —
					    default auto on descendants would steal taps from Home top capsules (z-30 < z-40). */}
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
						"pb-[env(safe-area-inset-bottom)]",
						showAlphaHowItWorks ? "" : "pointer-events-none",
					].join(" ")}
					>
						{/* 顶部拖拽条（可选） */}
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>


						{/* 内容区：内容少就不滚动；内容多才滚动 */}
						<div className="px-4 pb-4 overflow-y-auto">
							{showAlphaHowItWorks === '支付' && userPreviewItem &&(
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
				{redeemClaimIntent && (
					<motion.div
						key="redeem-claim-overlay"
						className="fixed inset-0 z-[10000] bg-white dark:bg-slate-900 flex flex-col"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.25, ease: "easeOut" }}
					>
						<div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 border-b border-slate-200 dark:border-slate-800">
							<div>
								<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('redeem_code')}</h2>
								<p className="text-xs text-slate-500 dark:text-slate-400">{tu('confirm_before_submitting_on_chain_redeem')}</p>
							</div>
							<button
								type="button"
								onClick={() => {
									if (redeemClaimSubmitting) return
									closeRedeemClaimPanel()
								}}
								disabled={redeemClaimSubmitting}
								className="text-sm font-medium text-slate-600 dark:text-slate-300 disabled:opacity-50"
							>
								Close
							</button>
						</div>

						<div className="flex-1 overflow-y-auto px-5 py-5">
							{redeemClaimIntent.cardAddress ? (
								<RedeemClaimTicketPreview
									cardAddress={redeemClaimIntent.cardAddress}
									redeemCode={redeemClaimIntent.redeemCode}
									submitting={redeemClaimSubmitting}
									getPrivateKeyArmor={() => resolveSigningPrivateKeyArmor(profiles?.[0]) || undefined}
									onWalletUnlock={() => navigate('/settings')}
								/>
							) : (
								<div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
									<p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{tu('missing_card_address')}</p>
									<p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{tu('this_redeem_link_must_include_a_valid_program_card_address')}</p>
								</div>
							)}
						</div>

						<div className="px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 border-t border-slate-200 dark:border-slate-800">
							<AppButton
								fullWidth
								onClick={handleConfirmRedeemClaim}
								disabled={redeemClaimSubmitting || !redeemClaimIntent.cardAddress}
								className="rounded-xl"
							>
								{redeemClaimSubmitting ? tu('redeeming') : tu('redeem')}
							</AppButton>
						</div>
					</motion.div>
				)}
				{couponClaimIntent && (
					<motion.div
						key="coupon-claim-overlay"
						className="fixed inset-0 z-[10000] bg-white dark:bg-slate-900 flex flex-col"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.25, ease: "easeOut" }}
					>
						<div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 border-b border-slate-200 dark:border-slate-800">
							<div>
								<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('coupon_claim')}</h2>
								<p className="text-xs text-slate-500 dark:text-slate-400">
									{couponClaimEligibility === 'already_redeemed'
										? 'You already used this coupon.'
										: couponClaimEligibility === 'already_claimed'
											? 'You already claimed this coupon. Show Pay at the merchant POS to redeem.'
											: tu('confirm_before_submitting_on_chain_claim')}
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									if (couponClaimSubmitting) return
									closeCouponClaimPanel()
								}}
								disabled={couponClaimSubmitting}
								className="text-sm font-medium text-slate-600 dark:text-slate-300 disabled:opacity-50"
							>
								Close
							</button>
						</div>

						<div className="flex-1 overflow-y-auto px-5 py-5">
							<CouponClaimTicketPreview
								cardAddress={couponClaimIntent.cardAddress}
								couponId={couponClaimIntent.couponId}
								submitting={couponClaimSubmitting}
								onResolved={setCouponClaimPreviewRow}
								onEligibilityChange={setCouponClaimEligibility}
								onClaim={() => void handleConfirmCouponClaim()}
								onShowPay={() => setCouponClaimShowPayOpen(true)}
								referrerEoa={couponClaimIntent.referrerEoa ?? null}
								userEoa={profiles?.[0]?.keyID ?? null}
								getPrivateKeyArmor={() => resolveSigningPrivateKeyArmor(profiles?.[0]) || undefined}
								onWalletUnlock={() => navigate('/settings')}
							/>
						</div>

						<div className="px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 border-t border-slate-200 dark:border-slate-800">
							{(() => {
								const alreadyClaimed = couponClaimEligibility === 'already_claimed'
								const alreadyRedeemed = couponClaimEligibility === 'already_redeemed'
								const claimBlocked =
									alreadyClaimed ||
									alreadyRedeemed ||
									couponClaimEligibility === 'sold_out' ||
									couponClaimEligibility === 'expired' ||
									couponClaimEligibility === 'not_open_claim' ||
									couponClaimEligibility === 'insufficient_social_points'
								if (alreadyClaimed) {
									return (
										<AppButton
											fullWidth
											onClick={() => setCouponClaimShowPayOpen(true)}
											className="rounded-xl"
											aria-label="Show Pay"
										>
											Show Pay
										</AppButton>
									)
								}
								const bottomLabel = alreadyRedeemed
									? tu('redeemed')
									: couponClaimEligibility === 'sold_out'
										? 'Sold out'
										: couponClaimEligibility === 'expired'
											? tu('expired')
											: couponClaimSubmitting
												? tu('claiming')
												: tu('claim')
								return (
									<AppButton
										fullWidth
										onClick={handleConfirmCouponClaim}
										disabled={couponClaimSubmitting || claimBlocked}
										className="rounded-xl"
									>
										{bottomLabel}
									</AppButton>
								)
							})()}
						</div>
						<ShowPayCodeSheet
							isOpen={couponClaimShowPayOpen}
							onClose={() => setCouponClaimShowPayOpen(false)}
							profile={profiles?.[0]}
							setProfiles={setProfiles}
						/>
					</motion.div>
				)}
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
												<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('redeem_successful')}</h3>
												<p className="text-sm text-slate-600 dark:text-slate-400">{tu('your_reward_has_been_added_to_your_account')}</p>
											</div>
										</div>
										{redeemResult.tx && (
											<button
												type="button"
												onClick={() => openExternalUrl(`https://basescan.org/tx/${redeemResult.tx}`)}
												className="block mb-4 text-sm text-[#1652f0] underline"
											>{tu('view_transaction')}</button>
										)}
									</>
								) : (
									<>
										<div className="flex items-center gap-3 mb-4">
											<div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
												<span className="text-xl text-rose-600 dark:text-rose-400">!</span>
											</div>
											<div>
												<h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('redeem_failed_2')}</h3>
												<p className="text-sm text-rose-600 dark:text-rose-400">{redeemResult.error}</p>
											</div>
										</div>
									</>
								)}
								<AppButton fullWidth onClick={() => setRedeemResult(null)} className="rounded-xl">{tu('done')}</AppButton>
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
