// Home.tsx

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'
import { createPortal } from 'react-dom';
import { IpfsImg } from '@/components/IpfsImg';
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, getBalanceProcess, onWalletEvent, getUserInfo, getOracle, parseOracleToCurrencyData} from '@/services/beamio'
import base_icon from '@/components/assets/base-logo.png'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { detectDeviceNfcCapability, getCashTreesNativeNfcBridge } from '@/utils/cashTreesNativeNfc'
import { WALLET_READY_INTENT_KEY } from '@/pages/Home/walletReadyIntent'
import type { LucideIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData, postBeamio} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion, AnimatePresence } from "framer-motion"
import { Settings, Check, ArrowDownCircle, PlusCircle , X, Zap, Shield, ShieldCheck, Clock, Sparkles, Wallet, Circle, RefreshCw, BadgeCheck, Plus, Send, QrCode, Store, Radio, CreditCard, Loader2, Copy, Star, Key, Home as HomeHardwareIcon, Ban, Smartphone, ChevronRight, ChevronLeft, ArrowDownToLine, ArrowRightLeft, AlertTriangle, Gift }
	from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import CoinbaseRamps from '@/components/Setting/CoinbaseRamps'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import cashTreesHeroBg1 from '@/components/assets/cashTreesHeroBg1.png'
import cashTreesHeroBg2 from '@/components/assets/cashTreesHeroBg2.png'
import cashTreesHeroBg3 from '@/components/assets/cashTreesHeroBg3.png'
import senPhoCafeStoreCardBg from '@/components/assets/senPhoCafeStoreCardBg.png'
import luminaRoastersStoreCardBg from '@/components/assets/luminaRoastersStoreCardBg.png'
import PayScreen from '@/pages/Pay/send'
import ActiveCouponsScreen from '@/pages/Home/ActiveCouponsScreen'
import RedeemVoucherScreen from '@/pages/Home/RedeemVoucherScreen'
import { buildRedeemVoucherHistoryPath } from '@/pages/Home/redeemVoucherPath'

import { ethers } from 'ethers'
import { QRCodeCanvas } from 'qrcode.react'
import { baseEndpoint, USDCContract_BASE } from '@/utils/constants'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import {
	getMyAssets,
	getMyAssetsAggregated,
	getBUnitBalanceOnConet,
	postNfcLinkApp,
	postNfcLinkAppClaimWithKey,
	postListLinkedNfcCards,
	postNfcCardLinkStateSigned,
} from '@/services/BeamioCard'
import ActiveHistoryPannelNew from '@/pages/History/components/activeHistoryPannelNew'
import { MyBrandsFullScreenDrawer } from '@/pages/Brands/MyBrandsFullScreenDrawer'
import {
	MyBrandListEntries,
	sortMyBrandCardsForList,
} from '@/pages/Brands/MyBrandsListSection'
import { RECENT_ACTIVITY_PREVIEW_COUNT } from '@/pages/History/recentActivityIndexerMerge'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import {BeamioBetaAccess} from './components/BeamioBetaAccess'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import FuelView from './FuelView'
import MerchantAssetGiftSheet, { type MerchantGiftCardOption } from './MerchantAssetGiftSheet'
import { encodeOpenContainerRelayQrPayload, signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpenOnConet, type OpenContainerRelayPayload } from '@/services/AAaccount'
import { ensureConetAaForProfileAndPersist } from '@/utils/ensureConetAa'
import { tu } from '@/locale/beamioLocale'

/** CashTrees 大卡背景轮播：每图静止 5s，短时 cross-fade 切换 */
const CASH_TREES_HERO_BACKGROUNDS = [cashTreesHeroBg1, cashTreesHeroBg2, cashTreesHeroBg3] as const
const CASH_TREES_HERO_BG_INTERVAL_MS = 5000
const CASH_TREES_HERO_BG_FADE_MS = 480

const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`
const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

/** Mobile home CTAs: single-tap reliability (pairs with App.tsx touch-gesture guard). */
const HOME_TOUCH_BUTTON_CLASS = RELIABLE_TAP_BUTTON_CLASS

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** CAD 展示用 whole.frac，与 DaemonProvider computeHomeTotalPowerCad 一致 */
function cadPartsFromNumber(n: number): { whole: string; frac: string } {
	const [whole, frac = '00'] = Math.max(0, n).toFixed(2).split('.')
	return { whole, frac }
}

/** Open Relay QR：与 signAAtoEOA `deadlineSeconds` 一致，用于进度条比例 */
const PAY_RELAY_QR_TTL_SECONDS = 300

function formatPayRelayCountdown(secondsLeft: number): string {
	if (secondsLeft <= 0) return '0:00'
	const m = Math.floor(secondsLeft / 60)
	const s = secondsLeft % 60
	return `${m}:${s.toString().padStart(2, '0')}`
}

type CashTreesNativeNfcStatus =
	| 'unknown'
	| 'no_bridge'
	| 'no_hardware'
	| 'disabled'
	| 'ready'
	| 'permission_denied'

type CashTreesNfcOverlayPhase = 'hidden' | 'scanning' | 'fetch' | 'result' | 'error'

type CashTreesNfcLinkOverlayResult = {
	redeemTxHash?: string | null
	migrationEoaSweepTxHashes?: string[]
	address?: string
}

type CashTreesNfcOverlayState = {
	phase: CashTreesNfcOverlayPhase
	errorMsg?: string
	/** Link App 完成后的链上/账户摘要（替代原 getUIDAssets 余额展示） */
	linkResult?: CashTreesNfcLinkOverlayResult | null
	ndefUri?: string
	tagUidHex?: string
}

/** Card Management 列表行（/api/listLinkedNfcCards + 本地主卡 UI） */
type HomeLinkedNfcCardRow = {
	id: string
	uid: string
	tagId: string
	linkState: 'active' | 'deactive'
	last4: string
	isPrimaryUi: boolean
}

const shortNfcId = (s: string, head = 8, tail = 4) =>
	s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s

/** 与 nfcLinkAppClaimWithKey 服务端校验一致：导出 0x+64 hex 私钥 */
function privateKeyHexForNfcLinkClaim(raw: string | null | undefined): string | null {
	const t = raw?.trim() ?? ''
	if (!t) return null
	try {
		const w = new ethers.Wallet(t.startsWith('0x') ? t : `0x${t}`)
		const pk = w.privateKey
		if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return null
		return pk
	} catch {
		return null
	}
}

/**
 * 与 MainActivity.parseSunParamsFromNdefUrl 一致：从 NDEF URL 的 query 取 e/c/m。
 * 用于原生已传 `ndefUri` 但 `detail.sun` 缺失/序列化异常时的回退解析。
 */
function parseSunEcmFromNdefUrl(urlStr: string | undefined): { e: string; c: string; m: string } | null {
	if (!urlStr || typeof urlStr !== 'string') return null
	const trimmed = urlStr.trim()
	if (!trimmed) return null
	try {
		const u = new URL(trimmed)
		const e = u.searchParams.get('e')?.trim() ?? ''
		const c = u.searchParams.get('c')?.trim() ?? ''
		const m = u.searchParams.get('m')?.trim() ?? ''
		if (e.length !== 64 || c.length !== 6 || m.length !== 16) return null
		if (!/^[0-9a-fA-F]+$/.test(e) || !/^[0-9a-fA-F]+$/.test(c) || !/^[0-9a-fA-F]+$/.test(m)) return null
		const el = e.toLowerCase()
		const cl = c.toLowerCase()
		const ml = m.toLowerCase()
		if (el.split('').every((ch) => ch === '0') && cl.split('').every((ch) => ch === '0') && ml.split('').every((ch) => ch === '0')) {
			return null
		}
		return { e, c, m }
	} catch {
		return null
	}
}

/** POS 仅写入模板（e/c/m 全 0）时尚无可用 SUN，与链上/服务端一致应拒绝 link。 */
function isTemplateOnlySunNdefUrl(urlStr: string | undefined): boolean {
	if (!urlStr || typeof urlStr !== 'string') return false
	try {
		const u = new URL(urlStr.trim())
		const e = u.searchParams.get('e')?.trim() ?? ''
		const c = u.searchParams.get('c')?.trim() ?? ''
		const m = u.searchParams.get('m')?.trim() ?? ''
		if (e.length !== 64 || c.length !== 6 || m.length !== 16) return false
		if (!/^[0-9a-fA-F]+$/.test(e) || !/^[0-9a-fA-F]+$/.test(c) || !/^[0-9a-fA-F]+$/.test(m)) return false
		return (
			e.toLowerCase().split('').every((ch) => ch === '0') &&
			c.toLowerCase().split('').every((ch) => ch === '0') &&
			m.toLowerCase().split('').every((ch) => ch === '0')
		)
	} catch {
		return false
	}
}

type HomeStoreCardRow = {
	id: string
	name: string
	type: string
	color: string
	borderColor: string
	iconColor: string
	bgColor: string
	icon: LucideIcon
	balanceCad: number
	/** Full-bleed card artwork (bundled asset URL); text sits in a frosted panel. */
	backgroundImage?: string
}

/** Bundled Sen Pho artwork URL — also used when card state omits `backgroundImage`. */
const SEN_PHO_STORE_CARD_ART_URL: string = senPhoCafeStoreCardBg

/** Bundled Lumina Roasters artwork URL — also used when card state omits `backgroundImage`. */
const LUMINA_STORE_CARD_ART_URL: string = luminaRoastersStoreCardBg

const INITIAL_HOME_STORE_CARDS: HomeStoreCardRow[] = [
	{ id: 'senpho', name: 'Sen Pho + Cafe', type: 'Black Card', color: 'from-[#1562f0] to-[#0e4cbb]', borderColor: 'border-[#0e4cbb]/50', iconColor: 'text-blue-100', bgColor: 'bg-[#1562f0]/25', icon: Star, balanceCad: 50.0, backgroundImage: SEN_PHO_STORE_CARD_ART_URL },
	{ id: 'lumina', name: 'Lumina Roasters', type: 'Green Card', color: 'from-amber-900 to-stone-900', borderColor: 'border-amber-950/50', iconColor: 'text-amber-200', bgColor: 'bg-amber-950/30', icon: CreditCard, balanceCad: 10.0, backgroundImage: LUMINA_STORE_CARD_ART_URL },
]

/** CashTrees 大卡：EOA / AA 两侧 USDC（链上 balanceOf）+ 程序卡 points（与 getMyAssetsAggregated 同源）；CAD 合计在 UI 内按 Oracle 折算 */
const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`

async function loadCashTreesWalletSnapshot(profile: Parameters<typeof getMyAssets>[0]): Promise<{
	eoaUsdc: string
	aaUsdc: string
	points0: string
	pointsCurrency: string
}> {
	const res = await getMyAssetsAggregated(profile)
	const points0 = res?.points ?? '0'
	const pointsCurrency = res?.cardCurrency ?? 'CAD'
	const eoa = profile.keyID
	if (!eoa || !ethers.isAddress(eoa)) {
		return { eoaUsdc: '0', aaUsdc: '0', points0, pointsCurrency }
	}
	const usdc = new ethers.Contract(USDCContract_BASE, usdc_abi, baseEndpoint)
	const readBal = async (addr: string) => {
		try {
			return ethers.formatUnits(await usdc.balanceOf(addr), 6)
		} catch {
			return '0'
		}
	}
	const aa = (profile.aaAccount ?? '').trim()
	const hasDistinctAa = Boolean(aa && ethers.isAddress(aa) && aa.toLowerCase() !== eoa.toLowerCase())
	if (!hasDistinctAa) {
		const bal = await readBal(eoa)
		return { eoaUsdc: bal, aaUsdc: '0', points0, pointsCurrency }
	}
	const [eoaBal, aaBal] = await Promise.all([readBal(eoa), readBal(aa)])
	return { eoaUsdc: eoaBal, aaUsdc: aaBal, points0, pointsCurrency }
}

type AddCashSheetMode = 'methods' | 'store_qr' | 'coinbase' | 'topup_store'

type HomeProps = {
}

const Home = (_props: HomeProps) => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio, setCurrencyData,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode,
		currencyData, setRedeemCode, setPayMePayment, setAllNodes, setGossip, gossip, setCharts, charts, setShowFooter, scanData, setScanData,
		myBrandCards, myBrandCardDetails, myBrandsFeedLoading, homeTotalPowerCad,
		aaAccountUsdcBalance, refreshRecentActivityNoAa,
	} = useDaemonContext()
	const navigate = useNavigate()
	  const [settingsOpen, setSettingsOpen] = useState<''|'BeamioBetaAccess'|'支付'>('')
	
	const [avatarName, setAvatarName] = useState('')
	const [processing, setProcessing] = useState(false)
	const [showGetFaucet, setShowGetFaucet] = useState<'Faucet'|'finished'|'sameIP'>('Faucet')
	const [show200OK, setShow200OK] = useState(false)
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [language, setLanguage] = useState<ILanguage>('en')
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const [openSearch, setOpenSearch]= useState(false)
	const [reflash, setReflash] = useState(false)
	const [itemTx, setItemtx] = useState<TransferHistork>()
	const [ccsaAssets, setCcsaAssets] = useState<Awaited<ReturnType<typeof getMyAssetsAggregated>> | null>(null)
	const [bUnitBalance, setBUnitBalance] = useState<{ total: number; free: number; paid: number } | null>(null)



	const [activeItems, setActiveItems] = useState<TransferHistork[]>([])

	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'支付'|'TransactionsItemDetail'|
		''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'搜索'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')
	const [showPayMeSheet, setShowPayMeSheet] = useState(false)
	const [showMerchantGiftSheet, setShowMerchantGiftSheet] = useState(false)
	/** Home Pay/Receive 底栏（对齐 renderAction Pay|Receive 交互） */
	const [showPayReceiveSheet, setShowPayReceiveSheet] = useState(false)
	const [payReceiveQrMode, setPayReceiveQrMode] = useState<'pay' | 'receive'>('receive')
	/** Pay 模式：与 MyWalletDashboardNew AA relay QR 同源（OpenContainer relay 签名 JSON） */
	const [payRelayQRPayload, setPayRelayQRPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [payRelayQRLoading, setPayRelayQRLoading] = useState(false)
	const [payRelaySecondsLeft, setPayRelaySecondsLeft] = useState(0)
	/** Scan to Pay：按可视高度收缩 QR，面板高度随内容收紧，避免内部滚动条 / 整块上下拖动感 */
	const [paySheetQrSize, setPaySheetQrSize] = useState(256)
	const [showAddCashSheet, setShowAddCashSheet] = useState(false)
	const [showFuelView, setShowFuelView] = useState(false)
	/** Coinbase：methods 内进入后展示 BeamioAddUSDCFlow */
	const [showAddUsdcInSheet, setShowAddUsdcInSheet] = useState(false)
	const [addCashMode, setAddCashMode] = useState<AddCashSheetMode>('methods')
	const [addCashAmountCad, setAddCashAmountCad] = useState('')
	const [topUpStore, setTopUpStore] = useState<HomeStoreCardRow>(() => INITIAL_HOME_STORE_CARDS[0]!)
	const [isSelectingTopUpStore, setIsSelectingTopUpStore] = useState(false)
	const [addCashWalletCopied, setAddCashWalletCopied] = useState(false)
	/** Top Up：链上 BeamioOracle 报价，1 USDC 可换多少 CAD（与 TenKeyInput cad/usdc 换算一致：CAD×USDC） */
	const [topUpOracleCadPerUsdc, setTopUpOracleCadPerUsdc] = useState<number | null>(null)
	const [topUpOracleLoading, setTopUpOracleLoading] = useState(false)
	const [topUpOracleError, setTopUpOracleError] = useState(false)
	const [topUpRateRefreshStatus, setTopUpRateRefreshStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [showMyBrandsDrawer, setShowMyBrandsDrawer] = useState(false)
	const [aaAddrCopied, setAaAddrCopied] = useState(false)
	/** 首页 CashTrees 大卡：EOA+AA USDC（链上）+ 基础设施卡 points；合计 CAD 用 Oracle（与 Top Up 同源） */
	const [cashTreesWalletSnapshot, setCashTreesWalletSnapshot] = useState<{
		eoaUsdc: string
		aaUsdc: string
		points0: string
		pointsCurrency: string
	} | null>(null)
	/** CashTrees 卡点击：EOA / AA USDC + 基础设施卡 token #0（points） */
	const [showCashTreesBalanceDetails, setShowCashTreesBalanceDetails] = useState(false)
	const [cashTreesBalanceLoading, setCashTreesBalanceLoading] = useState(false)
	const [cashTreesBalanceError, setCashTreesBalanceError] = useState<string | null>(null)
	const [cashTreesSheetEoaUsdc, setCashTreesSheetEoaUsdc] = useState<string | null>(null)
	const [cashTreesSheetAaUsdc, setCashTreesSheetAaUsdc] = useState<string | null>(null)
	const [cashTreesSheetPoints0, setCashTreesSheetPoints0] = useState<string | null>(null)
	/** CaehTrees Android WebView：NFC 能力探测与贴卡绑定 */
	const [cashTreesNativeNfcStatus, setCashTreesNativeNfcStatus] =
		useState<CashTreesNativeNfcStatus>('unknown')
	const [cashTreesNfcOverlay, setCashTreesNfcOverlay] = useState<CashTreesNfcOverlayState>({
		phase: 'hidden',
	})
	const [linkedNfcCards, setLinkedNfcCards] = useState<HomeLinkedNfcCardRow[]>([])
	const [showCardManagementModal, setShowCardManagementModal] = useState(false)
	const [linkedNfcListLoading, setLinkedNfcListLoading] = useState(false)
	const [nfcLinkActionTagId, setNfcLinkActionTagId] = useState<string | null>(null)
	const [cardMgmtError, setCardMgmtError] = useState<string | null>(null)
	const cashTreesNfcReq = useRef(0)
	const [activateGiftVoucherScreen, setActivateGiftVoucherScreen] = useState<'' | 'activeCoupons' | 'redeemVoucher'>('')
	const [cashTreesHeroBgIndex, setCashTreesHeroBgIndex] = useState(0)
	const [homeStoreCards, setHomeStoreCards] = useState<HomeStoreCardRow[]>(INITIAL_HOME_STORE_CARDS)
	const [selectedHomeStoreCard, setSelectedHomeStoreCard] = useState<HomeStoreCardRow | null>(null)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!openSearch)

	/** CashTrees 大卡：背景每 5s 切换，短 opacity 过渡交叉淡入淡出 */
	useEffect(() => {
		const id = window.setInterval(() => {
			setCashTreesHeroBgIndex((i) => (i + 1) % CASH_TREES_HERO_BACKGROUNDS.length)
		}, CASH_TREES_HERO_BG_INTERVAL_MS)
		return () => window.clearInterval(id)
	}, [])

	/** 链上 / 本地已存在与 EOA 不同的 Smart Account 地址时视为已激活 AA */
	const hasAAWallet = useMemo(() => {
		const aa = profiles?.[0]?.aaAccount
		if (!aa || typeof aa !== 'string' || aa.length < 4) return false
		const eoa = (profiles?.[0]?.keyID || '').toLowerCase()
		return aa.toLowerCase() !== eoa
	}, [profiles?.[0]?.aaAccount, profiles?.[0]?.keyID])

	/** POST /api/listLinkedNfcCards：AA 已部署时传 AA，否则传 EOA */
	const refreshLinkedNfcCards = useCallback(async () => {
		const profile = profiles?.[0]
		if (!profile?.keyID) return
		const aa = profile.aaAccount?.trim()
		const eoa = profile.keyID.toLowerCase()
		const useAa = Boolean(aa && ethers.isAddress(aa) && aa.toLowerCase() !== eoa)
		const wallet = useAa && aa ? aa : profile.keyID
		if (!wallet || !ethers.isAddress(wallet)) return
		setLinkedNfcListLoading(true)
		setCardMgmtError(null)
		try {
			const res = await postListLinkedNfcCards(wallet)
			if (!res.ok) {
				setLinkedNfcCards([])
				return
			}
			const cards = res.cards
			setLinkedNfcCards((prev) => {
				if (!cards.length) return []
				const preferred = prev.find((x) => x.isPrimaryUi)?.id ?? null
				const ids = new Set(cards.map((c) => `${c.uid}-${c.tagId}`))
				let primaryId = preferred && ids.has(preferred) ? preferred : null
				if (!primaryId) {
					const idx = cards.findIndex((c) => c.linkState === 'active')
					const pick = idx >= 0 ? cards[idx]! : cards[0]!
					primaryId = `${pick.uid}-${pick.tagId}`
				}
				return cards.map((c) => {
					const id = `${c.uid}-${c.tagId}`
					return {
						id,
						uid: c.uid,
						tagId: c.tagId,
						linkState: c.linkState,
						last4: c.tagId.slice(-4),
						isPrimaryUi: id === primaryId,
					}
				})
			})
		} finally {
			setLinkedNfcListLoading(false)
		}
	}, [profiles?.[0]?.keyID, profiles?.[0]?.aaAccount])

	const myBrandCardsPreview = useMemo(
		() => sortMyBrandCardsForList(myBrandCards).slice(0, 5),
		[myBrandCards]
	)

	const eoaAddressShort = profiles?.[0]?.keyID ? fmtAddr(profiles[0].keyID) : '—'

	/** 与 BeamioPayMe `successUrl` 在 EOA 模式下一致：任意金额收款链接，wallet=EOA */
	const activateWalletEoaQrValue = useMemo(() => {
		if (!beamio?.accountName) return ''
		const params = new URLSearchParams({ beamio: beamio.accountName })
		const walletAddr =
			myAddress && ethers.isAddress(myAddress)
				? myAddress
				: profiles?.[0]?.keyID && ethers.isAddress(profiles[0].keyID)
					? profiles[0].keyID
					: null
		if (walletAddr) params.set('wallet', walletAddr)
		return `https://beamio.app?${params.toString()}`
	}, [beamio?.accountName, myAddress, profiles?.[0]?.keyID])

	useEffect(() => {
		if (!activateGiftVoucherScreen) return
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [activateGiftVoucherScreen, setShowFooter])

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
		avatarName
	)}`


	const getAccountData = (bo: beamio) => {
		if (!bo) return
		setCurrency(bo.currency)
		setLanguage(bo.language)
	}

	const storee = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const bo: beamio = temp?.beamio || await getUserInfo(profiles[0].keyID)
		bo.isUSDCFaucet = true
		setBeamio ({...bo})
		temp.beamio = bo
		setCoNET_Data(temp)
		storeSystemData()

	}

	const reflashProcess = async () => {
		if (reflash) return
		const profile: profile = profiles?.[0]
		if (!profile) return
		setReflash(true)

		await getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		getMyAssetsAggregated(profile)
			.then(setCcsaAssets)
			.catch(() => setCcsaAssets(null))
		loadCashTreesWalletSnapshot(profile)
			.then(setCashTreesWalletSnapshot)
			.catch(() =>
				setCashTreesWalletSnapshot({
					eoaUsdc: '0',
					aaUsdc: '0',
					points0: '0',
					pointsCurrency: 'CAD',
				})
			)
		getBUnitBalanceOnConet(profile.keyID)
			.then(setBUnitBalance)
			.catch(() => setBUnitBalance(null))
		setReflash(false)
	}

	const handleSaveAvatar = async (curr: ICurrency) => {
		if (!CoNET_Data||!beamio ) return
		
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio
		bo.currency = curr
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})

	}

	const init = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles?.length) {
			return
		}
		const profile: profile = profiles[0]
		if (!profile) return
		// AA 地址检测与落盘由 DaemonProvider 全局喂料 runNoAaWalletFeedTick 负责（与 EOA-only Recent Activity 同轨）
		reflashProcess()
		// 拉取 CCSA + beamioUserCard 聚合资产（延迟执行，避免首屏阻塞）
		setTimeout(() => {
			getMyAssetsAggregated(profile)
				.then(setCcsaAssets)
				.catch(() => setCcsaAssets(null))
		}, 150)
		const bo: beamio = temp?.beamio || await getUserInfo(profile.keyID)

		if (!bo) return

		bo.initialLoading = true
		
		
		if (bo.isUSDCFaucet) {
			setShowGetFaucet('finished')
		} else {
			setShowGetFaucet('Faucet')
		}
		
		await postBeamio(bo, profile.privateKeyArmor)
		setDarkModle(bo.darkTheme)
		setBeamio ({...bo})
		temp.beamio = bo
		getAccountData(bo)
		setCoNET_Data(temp)
		storeSystemData()
		
		
		setMyAddress (profile.keyID)
		
		
		if (ignoreUrl) {
			return
		}
		//checkUrl(window.location.href)
  	}

  	const firStartRef = useRef<boolean>(false)




  	useEffect(() => {
		setShowFooter(true)
		if (firStartRef.current) {
			return
		}
		
		firStartRef.current = true
		init()

				// 只在挂载时注册一次
		// const off = onWalletEvent("scan:url", (url: string) => {
		// 	if (/^0x/i.test(url)) {
		// 		setPaymentLink({code: '', note: '', address: url, amount: ''})
				
		// 		setSendToMemo(url)
		// 		navigate('/Pay')
		// 		return 
		// 	}
		// 	checkUrl(url)
		// })
				// 卸载时把监听取消，避免旧实例继续吃事件
		// return () => {
		// 	if (typeof off === 'function') off()
		// }

  	}, [])

	/** profiles 可用时刷新 B-Unit 余额（init 可能早于 profiles 加载完成） */
	useEffect(() => {
		if (profiles?.length && profiles[0]?.keyID) {
			reflashProcess()
			void refreshLinkedNfcCards()
		}
	}, [profiles?.length, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, refreshLinkedNfcCards])



	/** 常见币种相对 USD 的 fallback 汇率（1 USD = X 该币种），用于 currencyData 未加载时 */
	const FALLBACK_RATES: Record<string, number> = { USD: 1, CAD: 1.35, JPY: 150, EUR: 0.92, CNY: 7.2, HKD: 7.8, TWD: 31, SGD: 1.35 }

	/**
	 * @returns 1 USDC ≈ X {currency}
	 */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		const usdcToUSD = (currencyData.USDC ?? 1) || 1
		if (currency === 'USD') return usdcToUSD
		const raw = (currencyData as Record<string, number>)[currency] ?? FALLBACK_RATES[currency] ?? 1
		const rate = usdcToUSD * (raw || (FALLBACK_RATES[currency] ?? 1))
		return rate > 0 ? rate : (FALLBACK_RATES[currency] ?? 1)
	}

	function formatFiat() {
		// 1 USDC ≈ X {currency}
		const rate = fxRateUSDCToCurrency(currency)

		// 目标币种金额
		const v = currency === 'USDC' ? usdcbalance : usdcbalance * rate

		switch (currency) {
			case 'EUR': {
				// 欧元
				return `€ ${formatWithThousands(v, 2)}`
			}

			case 'TWD': {
				// 新台币（更通用写法）
				return `NT$ ${formatWithThousands(v, 2)}`
			}

			case 'SGD': {
				return `SG$ ${formatWithThousands(v, 2)}`
			}

			case 'HKD': {
				return `HK$ ${formatWithThousands(v, 2)}`
			}

			case 'JPY':
				// 日元无小数
				return `JP¥ ${formatWithThousands(v, 0)}`

			case 'CNY':
				// 人民币
				return `RMB¥ ${formatWithThousands(v, 2)}`

			case 'CAD':
				return `CA$ ${formatWithThousands(v, 2)}`

			case 'USDC':
				// USDC 是 token，不是法币
				return `${formatWithThousands(usdcbalance)} USDC`

			case 'USD':
			default:
				return `US$ ${formatWithThousands(v, 2)}`
		}
	}

	const claimFaucet = async () => {
		setShowAlphaHowItWorks('BeamioAlphaDropConfirm')
	}

	const handleCashOut = () => {
		setShowAlphaHowItWorks('CoinbaseRamps')
	}

	const addCashDepositAddress = useMemo(() => {
		const eoa = profiles?.[0]?.keyID?.trim() ?? ''
		const aa = profiles?.[0]?.aaAccount?.trim() ?? ''
		if (hasAAWallet && aa && ethers.isAddress(aa)) return aa
		if (eoa && ethers.isAddress(eoa)) return eoa
		return ''
	}, [hasAAWallet, profiles?.[0]?.aaAccount, profiles?.[0]?.keyID])

	/** Top Up → Receive：优先 Beamio 深链，否则 EOA/AA 地址（与 Add Cash Store QR 一致） */
	const topUpReceiveQrValue = useMemo(() => {
		const v = activateWalletEoaQrValue?.trim()
		if (v) return v
		return addCashDepositAddress
	}, [activateWalletEoaQrValue, addCashDepositAddress])

	const addCashVaultUsdc = useMemo(() => {
		const a = Number(cashTreesWalletSnapshot?.eoaUsdc ?? '0')
		const b = Number(cashTreesWalletSnapshot?.aaUsdc ?? '0')
		const t = (Number.isFinite(a) ? Math.max(0, a) : 0) + (Number.isFinite(b) ? Math.max(0, b) : 0)
		return t
	}, [cashTreesWalletSnapshot?.eoaUsdc, cashTreesWalletSnapshot?.aaUsdc])

	/** 1 USDC → CAD；链上刷新成功后以 Oracle 为准，否则与全局 currencyData（同源 feeder）一致 */
	const addCashTopUpCadPerUsdc = useMemo(() => {
		const d = currencyData as Record<string, number> | undefined
		const ctx = (Number(d?.CAD) || 1.35) * (Number(d?.USDC) || 1)
		if (topUpOracleCadPerUsdc != null && topUpOracleCadPerUsdc > 0) return topUpOracleCadPerUsdc
		return ctx
	}, [currencyData, topUpOracleCadPerUsdc])

	const refreshTopUpOracleRate = useCallback(
		async (fromUserRefresh: boolean) => {
			if (fromUserRefresh) setTopUpRateRefreshStatus('loading')
			setTopUpOracleLoading(true)
			setTopUpOracleError(false)
			try {
				const raw = await getOracle()
				const parsed = parseOracleToCurrencyData(raw)
				const v = Number(parsed.CAD) * Number(parsed.USDC)
				if (!Number.isFinite(v) || v <= 0) throw new Error('invalid oracle rate')
				setTopUpOracleCadPerUsdc(v)
				if (fromUserRefresh) {
					setTopUpRateRefreshStatus('success')
					window.setTimeout(() => setTopUpRateRefreshStatus('idle'), 3000)
				}
			} catch {
				setTopUpOracleError(true)
				const d = currencyData as Record<string, number> | undefined
				setTopUpOracleCadPerUsdc((Number(d?.CAD) || 1.35) * (Number(d?.USDC) || 1))
				if (fromUserRefresh) {
					setTopUpRateRefreshStatus('error')
					window.setTimeout(() => setTopUpRateRefreshStatus('idle'), 3000)
				}
			} finally {
				setTopUpOracleLoading(false)
			}
		},
		[currencyData]
	)

	/** CashTrees 大卡合计依赖链上 Oracle；登录后预拉取与 Top Up 一致 */
	useEffect(() => {
		if (!profiles?.[0]?.keyID) return
		void refreshTopUpOracleRate(false)
	}, [profiles?.[0]?.keyID, refreshTopUpOracleRate])

	useEffect(() => {
		if (!showAddCashSheet || addCashMode !== 'topup_store') return
		void refreshTopUpOracleRate(false)
	}, [showAddCashSheet, addCashMode, refreshTopUpOracleRate])

	const closeAddCashSheet = useCallback(() => {
		setShowAddCashSheet(false)
		setShowAddUsdcInSheet(false)
		setAddCashMode('methods')
		setIsSelectingTopUpStore(false)
		setAddCashAmountCad('')
		setTopUpOracleCadPerUsdc(null)
		setTopUpOracleLoading(false)
		setTopUpOracleError(false)
		setTopUpRateRefreshStatus('idle')
		setShowFooter(true)
	}, [setShowFooter])

	const copyAddCashDepositAddress = useCallback(async () => {
		const a = addCashDepositAddress
		if (!a) return
		try {
			await navigator.clipboard.writeText(a)
			setAddCashWalletCopied(true)
			window.setTimeout(() => setAddCashWalletCopied(false), 2000)
		} catch {
			/* ignore */
		}
	}, [addCashDepositAddress])

	const handleConfirmHomeTopUp = useCallback(() => {
		const cadToAdd = parseFloat(addCashAmountCad)
		if (!cadToAdd || cadToAdd <= 0) return
		const cadPerUsdc = addCashTopUpCadPerUsdc
		if (!Number.isFinite(cadPerUsdc) || cadPerUsdc <= 0) return
		const usdcRequired = cadToAdd / cadPerUsdc
		if (usdcRequired > addCashVaultUsdc) return
		setHomeStoreCards((prev) =>
			prev.map((c) => (c.id === topUpStore.id ? { ...c, balanceCad: c.balanceCad + cadToAdd } : c))
		)
		closeAddCashSheet()
	}, [addCashAmountCad, addCashTopUpCadPerUsdc, addCashVaultUsdc, closeAddCashSheet, topUpStore.id])

	const handleAddFunds = () => {
		setPayReceiveQrMode('receive')
		setShowPayReceiveSheet(true)
		setShowFooter(false)
	}

	const openReceiveSheetTap = useReliableTapHandler(handleAddFunds)
	const openPayCodeSheetTap = useReliableTapHandler(() => {
		setPayReceiveQrMode('pay')
		setShowPayReceiveSheet(true)
		setShowFooter(false)
	})

	const topUpReceiveDisplayTag = useMemo(() => {
		const tag = (beamio?.accountName ?? '').trim()
		if (tag) return `@${tag}`
		return eoaAddressShort !== '—' ? eoaAddressShort : '—'
	}, [beamio?.accountName, eoaAddressShort])

	/** 余额卡：白底 + 渐变描边 */
	function BalanceCard() {
		const [showSetup, setShowSetup] = useState(false)

		// 🔁 用你真实的 currency state 替换

		const options = useMemo(
			() => [
				{ value: 'USD' as const, label: 'USD', hint: 'US Dollar' },
				{ value: 'CAD' as const, label: 'CAD', hint: 'Canadian Dollar' },
				{ value: 'EUR' as const, label: 'EUR', hint: 'Euro' },                 // 👈 欧元
				{ value: 'JPY' as const, label: 'JPY', hint: 'Japanese Yen' },
				{ value: 'CNY' as const, label: 'CNY', hint: 'Chinese Yuan' },
				{ value: 'HKD' as const, label: 'HKD', hint: 'Hong Kong Dollar' },     // 👈 港币
				{ value: 'TWD' as const, label: 'TWD', hint: 'New Taiwan Dollar' },    // 👈 台币
				{ value: 'SGD' as const, label: 'SGD', hint: 'Singapore Dollar' },     // 👈 新加坡币
			],
			[]
		)

		const closeSetup = () => setShowSetup(false)

		const chooseCurrency = (v: ICurrency) => {

			setCurrency(v)
			// handleSaveAvatar(v)
			// 轻微延迟，保证点击反馈先出现
			setTimeout(() => setShowSetup(false), 80)
			
		}

		return (
			<div className="rounded-3xl bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b] p-4 shadow-lg mb-4 overflow-hidden">
				{/* 顶部：标题 + Base 标识 */}
				<div className="flex items-center justify-between mb-4 w-full max-w-[640px] px-4">
					<div className="text-xs font-medium text-white/80">
						Beamio Balance
					</div>

					<div className="flex items-center gap-1 text-white">
						
						<button
							type="button"
							className="
								inline-flex items-center justify-center
								w-7 h-7
								rounded-full
								border border-white/60
								bg-transparent
								transition
								hover:bg-white/10
								active:scale-[0.95]
								focus:outline-none
								focus-visible:ring-2
								focus-visible:ring-white/40
							"
							onClick={reflashProcess}
							disabled={reflash}
						>
							<IpfsImg
								src={base_icon}
								alt="Base"
								className={[
									"w-5 h-5 object-contain",
									reflash ? "animate-spin opacity-80" : ""
								].join(" ")}
							/>
						</button>
						<span className="text-[15px] font-medium tracking-wide">
							{tu('usdc_on_base')}
						</span>
					</div>
				</div>

				{/* 固定高度视口 */}
				<div className="relative">
					<div
						className={`
							flex w-[200%] h-full
							transition-transform duration-300 ease-out
							${showSetup ? '-translate-x-1/2' : 'translate-x-0'}
						`}
					>
						{/* ===== Page A：主内容 ===== */}
						<div className="w-1/2 h-full flex justify-center">
  							<div className="w-full max-w-[640px] px-4 mb-2">
							{/* 金额 + Setup（右侧） */}
							<div className="mb-4 flex items-center justify-between">
								<div>
									<button
										type="button"
										className="
											inline-flex
											items-center
											rounded-full          /* ⭐ 半圆 / 胶囊 */
											border border-white/30
											bg-white/0
											px-4 py-2
											text-left
											transition
											hover:bg-white/10
											active:scale-[0.98]
											focus:outline-none
											focus-visible:ring-2
											focus-visible:ring-white/40
										"
										onClick={() => setShowSetup(true)}
									>
										<div className="text-3xl font-semibold text-white tabular-nums leading-tight">
											{formatFiat()}
										</div>
									</button>

									<div className="mt-1 flex items-center text-[16px] text-white/80">
										<div className="relative mr-2 flex-shrink-0">
											<IpfsImg
												src={usdcIcon}
												alt="USDC"
												className="w-5 h-5 rounded-full"
											/>
											<IpfsImg
												src={baseIcon}
												alt="Base"
												className="
													w-3 h-3
													absolute -bottom-0.5 -right-0.5
													rounded-full
													border border-white dark:border-slate-900
												"
											/>
										</div>
										<span>
											{usdcbalance.toFixed(4)}
										</span>
									</div>
								</div>

								
							</div>

							{/* Gas sponsored */}
							<div className="flex justify-end mb-4">
								<div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
									<Sparkles
										className="w-4 h-4 text-amber-500"
										strokeWidth={2.2}
									/>
									<span className="text-[11px] font-medium text-white">
										Gas sponsored
									</span>
								</div>
							</div>

							{/* 操作按钮 */}
							<div className="flex items-center gap-2 mt-1">
								<button
									type="button"
									data-touch-priority="1"
									{...openReceiveSheetTap}
									className={`
										flex-1 flex items-center justify-center gap-1.5
										py-3 rounded-full
										bg-white/15
										text-[10px] font-medium text-white
										active:bg-white/20 transition
										${HOME_TOUCH_BUTTON_CLASS}
									`}
								>
									<PlusCircle className="h-4 w-4 text-white/90" />
									<span>{tu('add_funds')}</span>
								</button>

								<button
									type="button"
									onClick={handleCashOut}
									className="
										flex-1 flex items-center justify-center gap-1.5
										py-3 rounded-full
										bg-white/10
										text-[10px] font-medium text-white
										hover:bg-white/15 transition
									"
								>
									<ArrowDownCircle className="h-4 w-4 text-white/90" />
									<span>{tu('cash_out')}</span>
								</button>
							</div>
						</div>
						</div>

						{/* ===== Page B：Setup ===== */}
						{
							showSetup && <div className="w-1/2 px-4 overflow-y-auto h-[170px]" data-ignore-footer-scroll="1">
							

							<div className="space-y-2">
								{[
									// ⭐ 已选中的永远放第一
									...options.filter(opt => opt.value === currency),
									// 其余的保持原顺序
									...options.filter(opt => opt.value !== currency),
								].map(opt => {
									const active = currency === opt.value

									return (
										<button
											key={opt.value}
											type="button"
											onClick={() => chooseCurrency(opt.value)}
											className={`
												w-full flex items-center justify-between
												rounded-xl px-3 py-1.5
												backdrop-blur
												transition
												${active
													? 'bg-white/25'
													: 'bg-white/12 hover:bg-white/18'}
											`}
										>
											<div className="text-left">
												<div className="text-[12px] font-semibold text-white">
													{opt.label}
												</div>
												<div className="text-[11px] leading-tight text-white/75">
													{opt.hint}
												</div>
											</div>

											<div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
												{active ? (
													<Check className="w-4 h-4 text-white" />
												) : (
													<span className="text-[11px] text-white/70">
														{opt.value}
													</span>
												)}
											</div>
										</button>
									)
								})}
							</div>
						</div>
						}
						
					</div>
				</div>
			</div>
		)
	}

	const ButtonArea = () => {
		return (
			<div className="flex gap-3 mt-4">
				<button
					className="flex-1 h-9 rounded-full bg-white text-sm font-semibold text-[#1562f0] shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0] focus-visible:ring-offset-2"
					onClick={() => {
						setShowAlphaHowItWorks('支付')
					}}
				>{tu('send')}</button>
				<button
					className="flex-1 h-9 rounded-full border border-[#1562f0] text-sm font-semibold text-[#1562f0] bg-white/10 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0] focus-visible:ring-offset-2"
					onClick={() => {
						setPayTag('request')
						navigate('/Pay')
					}}
				>{tu('request')}</button>
			</div>	
		)
	}

	const Claim02Pannel = () => {
		return (
			<section className="mb-4">
				<div className="rounded-3xl bg-gradient-to-r from-[#ff8a3c] via-[#f7478f] to-[#8b5cf6] px-5 py-4 text-white shadow-md">
					<div className="flex items-center gap-2">
					<span className="text-lg">🔥</span>
					<div className="flex flex-col">
						<span className="text-sm font-semibold mb-1">
							0.2 USDC added to your wallet
						</span>
						<span className="text-xs text-white/90 mb-4">
							Use this to try a few small test transfers with friends or family. For everyday payments, you can add more USDC later.
						</span>
					</div>
					</div>
					<div className="flex flex-wrap gap-2 mt-1">
					<button className="flex-1 h-9 rounded-full border border-white/60 text-xs font-medium bg-white/10"
						onClick={() => {
							setShowAlphaHowItWorks('搜索')
						}}
					>
						Start a payment
					</button>
					<button className="flex-1 h-9 rounded-full bg-white text-xs font-semibold text-orange-500"
						onClick={() => {
							setShowAlphaHowItWorks('BeamioTestBalance')
						}}
					>
						About this 0.2 USDC
					</button>
					</div>
				</div>
			</section>
		)
	}

	useEffect(() => {

		if (!showLinkPay) {
			return
		}
		
		if (recipient && !power) {
			navigate('/Pay')
			return
		}

		if ((secureCode || (amt && code && recipient)) && !power) {
			navigate('/Browser')
			return
		}

	
	}, [showLinkPay])


	/** 顶部左侧胶囊：beamioTag 协议（对齐 BeamioPayMe / beamio-capsule）— 头像优先 `image`，否则 `getImg(tag)`；展示单一 `@` + tag */
	const { homeBeamioTagLabel, homeCapsuleAvatarSrc } = useMemo(() => {
		const raw = (beamio?.accountName ?? '').trim()
		const normalized = raw.replace(/^@+/, '') || 'Beamio'
		const label = `@${normalized}`
		const img = beamio?.image != null ? String(beamio.image).trim() : ''
		const src = img || getImg(normalized)
		return { homeBeamioTagLabel: label, homeCapsuleAvatarSrc: src }
	}, [beamio?.accountName, beamio?.image])

	/** CashTrees 卡片区：AA 短地址；Total CAD = (EOA+AA) USDC × BeamioOracle(USDC→CAD) + 基础设施卡 points 按卡币种折 CAD */
	const cashTreesCardDisplay = useMemo(() => {
		const aaFull = (profiles?.[0]?.aaAccount ?? '').trim()
		const d = currencyData as Record<string, number> | undefined
		const cadPerUsdc =
			topUpOracleCadPerUsdc != null && topUpOracleCadPerUsdc > 0
				? topUpOracleCadPerUsdc
				: (Number(d?.CAD) || 1.35) * (Number(d?.USDC) || 1)
		const eoaU = Number(cashTreesWalletSnapshot?.eoaUsdc ?? '0')
		const aaU = Number(cashTreesWalletSnapshot?.aaUsdc ?? '0')
		const totalUsdc =
			(Number.isFinite(eoaU) ? Math.max(0, eoaU) : 0) + (Number.isFinite(aaU) ? Math.max(0, aaU) : 0)
		const cadFromUsdc = totalUsdc * cadPerUsdc
		const ptsHuman = Number(cashTreesWalletSnapshot?.points0 ?? '0')
		const safePts = Number.isFinite(ptsHuman) ? Math.max(0, ptsHuman) : 0
		const pCur = (cashTreesWalletSnapshot?.pointsCurrency ?? 'CAD').toUpperCase()
		let pointsCad = 0
		if (safePts > 0) {
			if (pCur === 'CAD') {
				pointsCad = safePts
			} else if (pCur === 'USDC') {
				pointsCad = safePts * cadPerUsdc
			} else {
				const targetPerUsd = Number(d?.CAD) > 0 ? Number(d?.CAD) : 1.35
				const srcRaw = d?.[pCur]
				const srcPerUsd = typeof srcRaw === 'number' && srcRaw > 0 ? srcRaw : 1
				pointsCad = safePts * (targetPerUsd / srcPerUsd)
			}
		}
		const totalCad = cadFromUsdc + pointsCad
		const [whole, frac = '00'] = totalCad.toFixed(2).split('.')
		return { aaFull, aaShort: fmtAddr(aaFull), whole, frac, isPhysicalCardBound: linkedNfcCards.length > 0 }
	}, [
		profiles?.[0]?.aaAccount,
		currencyData,
		topUpOracleCadPerUsdc,
		cashTreesWalletSnapshot,
		linkedNfcCards.length,
	])

	/** 链上/后端「已关联实体卡」；以 listLinkedNfcCards 为准。 */
	const cashTreesPhysicalCardBoundEffective = cashTreesCardDisplay.isPhysicalCardBound

	const deviceHasNfcReadCapability = useMemo(() => detectDeviceNfcCapability(), [cashTreesNativeNfcStatus])

	/** 仅原生壳读卡器：无 CashTrees WebView 注入或 `no_hardware` 时不在顶部展示「关联 NFC」+（纯浏览器 Web NFC 不计入） */
	const hasNativeNfcReaderForLink = useMemo(() => {
		const native = getCashTreesNativeNfcBridge()
		if (!native?.getNfcStatus) return false
		try {
			const s = native.getNfcStatus()
			if (s === 'no_hardware') return false
			return s === 'ready' || s === 'disabled' || s === 'nfc_permission_denied'
		} catch {
			return false
		}
	}, [cashTreesNativeNfcStatus])

	useEffect(() => {
		const apply = () => {
			const native = getCashTreesNativeNfcBridge()
			if (!native?.getNfcStatus) {
				setCashTreesNativeNfcStatus('no_bridge')
				return
			}
			try {
				const s = native.getNfcStatus()
				if (s === 'ready') setCashTreesNativeNfcStatus('ready')
				else if (s === 'no_hardware') setCashTreesNativeNfcStatus('no_hardware')
				else if (s === 'disabled') setCashTreesNativeNfcStatus('disabled')
				else if (s === 'nfc_permission_denied') setCashTreesNativeNfcStatus('permission_denied')
				else setCashTreesNativeNfcStatus('no_bridge')
			} catch {
				setCashTreesNativeNfcStatus('no_bridge')
			}
		}
		apply()
		/** iOS WK 注入在 document start，极少数情况下首帧早于注入可用，下一帧再读一次 */
		const t = window.setTimeout(apply, 0)
		return () => window.clearTimeout(t)
	}, [])

	useEffect(() => {
		const profile = profiles?.[0]
		const onNfc = (ev: Event) => {
			const d = (ev as CustomEvent<Record<string, unknown>>).detail
			if (!d || typeof d !== 'object') return
			if (d.ok === false) {
				const err = typeof d.error === 'string' ? d.error : 'NFC error'
				if (err === 'cancelled' || err === 'paused') {
					cashTreesNfcReq.current++
					setCashTreesNfcOverlay({ phase: 'hidden' })
					return
				}
				setCashTreesNfcOverlay({ phase: 'error', errorMsg: err })
				return
			}
			if (d.ok !== true) return
			const queryUid = typeof d.queryUid === 'string' ? d.queryUid.trim() : ''
			if (!queryUid) {
				setCashTreesNfcOverlay({ phase: 'error', errorMsg: 'Invalid NFC payload' })
				return
			}
			const sunRaw = d.sun
			const sun =
				sunRaw && typeof sunRaw === 'object'
					? (sunRaw as { e?: string; c?: string; m?: string })
					: undefined
			let e = typeof sun?.e === 'string' ? sun.e.trim() : ''
			let c = typeof sun?.c === 'string' ? sun.c.trim() : ''
			let m = typeof sun?.m === 'string' ? sun.m.trim() : ''
			const ndefUriStr = typeof d.ndefUri === 'string' ? d.ndefUri : undefined
			if (e.length !== 64 || c.length !== 6 || m.length !== 16) {
				const fromUrl = parseSunEcmFromNdefUrl(ndefUriStr)
				if (fromUrl) {
					e = fromUrl.e
					c = fromUrl.c
					m = fromUrl.m
				}
			}
			if (e.length !== 64 || c.length !== 6 || m.length !== 16) {
				const templateOnly = isTemplateOnlySunNdefUrl(ndefUriStr)
				setCashTreesNfcOverlay({
					phase: 'error',
					errorMsg: templateOnly
						? 'This tag is still a template (SUN not enabled). Ask the merchant to finish NFC provisioning on the card before linking.'
						: 'This card does not support secure link. Missing or invalid SUN data (e, c, m).',
					ndefUri: ndefUriStr,
					tagUidHex: typeof d.tagUidHex === 'string' ? d.tagUidHex : undefined,
				})
				return
			}
			const pkHex = privateKeyHexForNfcLinkClaim(profile?.privateKeyArmor ?? null)
			if (!pkHex) {
				setCashTreesNfcOverlay({
					phase: 'error',
					errorMsg: 'Wallet key is not available. Unlock your wallet and try again.',
					ndefUri: typeof d.ndefUri === 'string' ? d.ndefUri : undefined,
					tagUidHex: typeof d.tagUidHex === 'string' ? d.tagUidHex : undefined,
				})
				return
			}
			const rid = ++cashTreesNfcReq.current
			const base = {
				ndefUri: typeof d.ndefUri === 'string' ? d.ndefUri : undefined,
				tagUidHex: typeof d.tagUidHex === 'string' ? d.tagUidHex : undefined,
			}
			setCashTreesNfcOverlay({
				phase: 'fetch',
				...base,
			})
			void (async () => {
				const link = await postNfcLinkApp({
					uid: queryUid,
					e,
					c,
					m,
				})
				if (rid !== cashTreesNfcReq.current) return
				if (!link.ok) {
					const locked =
						link.errorCode === 'NFC_LINK_APP_CARD_LOCKED' || link.httpStatus === 409
					setCashTreesNfcOverlay({
						phase: 'error',
						errorMsg: locked
							? 'This card is already in a pending link session. Ask the merchant to cancel the link lock on the POS, then try again.'
							: link.error,
						...base,
					})
					return
				}
				const claim = await postNfcLinkAppClaimWithKey({
					nftRedeemcode: link.nftRedeemcode,
					tagid: link.tagid,
					uid: link.uid,
					counter: link.counter,
					privateKey: pkHex,
				})
				if (rid !== cashTreesNfcReq.current) return
				if (!claim.ok) {
					setCashTreesNfcOverlay({
						phase: 'error',
						errorMsg: claim.error,
						...base,
					})
					return
				}
				setCashTreesNfcOverlay({
					phase: 'result',
					linkResult: {
						address: claim.address,
						redeemTxHash: claim.redeemTxHash,
						migrationEoaSweepTxHashes: claim.migrationEoaSweepTxHashes,
					},
					...base,
				})
				if (profile) {
					void loadCashTreesWalletSnapshot(profile).then(setCashTreesWalletSnapshot).catch(() => {})
					void refreshLinkedNfcCards()
				}
			})()
		}
		window.addEventListener('cashtreesnfc', onNfc)
		return () => window.removeEventListener('cashtreesnfc', onNfc)
	}, [profiles, refreshLinkedNfcCards])

	const startCashTreesPhysicalCardBind = useCallback(() => {
		const native = getCashTreesNativeNfcBridge()
		if (native?.startPhysicalCardBind) {
			cashTreesNfcReq.current++
			/** 含 iOS：先显示 scanning 加载层，提示等待读卡；系统全屏 NFC UI 仍由原生承载 */
			setCashTreesNfcOverlay({ phase: 'scanning' })
			try {
				native.startPhysicalCardBind()
			} catch {
				setCashTreesNfcOverlay({ phase: 'hidden' })
			}
			return
		}
		navigate('/myWallet')
	}, [navigate])

	/**
	 * WalletReadyScreen follow-up:
	 * - Cashier: scroll Activate Wallet panel.
	 * - NFC: `startCashTreesPhysicalCardBind` → native read → `cashtreesnfc` → `postNfcLinkApp` (SUN only) then
	 *   `postNfcLinkAppClaimWithKey` sends the logged-in EOA `privateKey` to backend `POST /api/nfcLinkAppClaimWithKey`
	 *   to complete the link / redeem workflow (same as rest of Home NFC bind).
	 */
	useEffect(() => {
		if (!profiles?.[0]?.keyID) return
		let intent: string | null = null
		try {
			intent = sessionStorage.getItem(WALLET_READY_INTENT_KEY)
		} catch {
			return
		}
		if (!intent) return

		if (intent === 'activate') {
			try {
				sessionStorage.removeItem(WALLET_READY_INTENT_KEY)
			} catch {
				/* ignore */
			}
			return
		}

		if (intent === 'nfcSync') {
			try {
				sessionStorage.removeItem(WALLET_READY_INTENT_KEY)
			} catch {
				/* ignore */
			}
			const t = window.setTimeout(() => {
				startCashTreesPhysicalCardBind()
			}, 200)
			return () => window.clearTimeout(t)
		}
	}, [profiles?.[0]?.keyID, startCashTreesPhysicalCardBind])

	const cancelCashTreesNfcBind = () => {
		getCashTreesNativeNfcBridge()?.cancelPhysicalCardBind?.()
		cashTreesNfcReq.current++
		setCashTreesNfcOverlay({ phase: 'hidden' })
	}

	const copyCashTreesAaAddress = async () => {
		if (!cashTreesCardDisplay.aaFull) return
		try {
			await navigator.clipboard.writeText(cashTreesCardDisplay.aaFull)
			setAaAddrCopied(true)
			window.setTimeout(() => setAaAddrCopied(false), 2000)
		} catch {
			// ignore
		}
	}

	const openCardManagement = () => {
		setCardMgmtError(null)
		setShowCardManagementModal(true)
		void refreshLinkedNfcCards()
	}

	const setLinkedNfcPrimaryById = (id: string) => {
		setLinkedNfcCards((prev) => prev.map((c) => ({ ...c, isPrimaryUi: c.id === id })))
	}

	const enableLinkedNfcOnServer = async (tagId: string) => {
		const pk = profiles?.[0]?.privateKeyArmor
		if (!pk) {
			setCardMgmtError('Wallet key is not available.')
			return
		}
		setNfcLinkActionTagId(tagId)
		setCardMgmtError(null)
		try {
			const out = await postNfcCardLinkStateSigned({
				privateKeyArmorOrHex: pk,
				action: 'active',
				tagId16: tagId.replace(/^0x/i, '').toUpperCase(),
			})
			if (!out.ok) {
				setCardMgmtError(out.error)
				return
			}
			await refreshLinkedNfcCards()
		} finally {
			setNfcLinkActionTagId(null)
		}
	}

	const removeLinkedNfcOnServer = async (tagId: string) => {
		const pk = profiles?.[0]?.privateKeyArmor
		if (!pk) {
			setCardMgmtError('Wallet key is not available.')
			return
		}
		setNfcLinkActionTagId(tagId)
		setCardMgmtError(null)
		try {
			const out = await postNfcCardLinkStateSigned({
				privateKeyArmorOrHex: pk,
				action: 'remove',
				tagId16: tagId.replace(/^0x/i, '').toUpperCase(),
			})
			if (!out.ok) {
				setCardMgmtError(out.error)
				return
			}
			await refreshLinkedNfcCards()
		} finally {
			setNfcLinkActionTagId(null)
		}
	}

	const openCashTreesBalanceSheet = () => {
		setShowCashTreesBalanceDetails(true)
		setShowFooter(false)
	}

	const closeCashTreesBalanceSheet = () => {
		setShowCashTreesBalanceDetails(false)
		setShowFooter(true)
		setCashTreesBalanceError(null)
	}

	const formatCashTreesUsd2 = (raw: string | null | undefined) => {
		const n = Number(raw ?? '')
		if (!Number.isFinite(n)) return '—'
		return `$${n.toFixed(2)}`
	}

	useEffect(() => {
		if (!showCashTreesBalanceDetails || !profiles?.[0]) return
		const profile = profiles[0]
		let cancelled = false
		setCashTreesBalanceLoading(true)
		setCashTreesBalanceError(null)
		setCashTreesSheetEoaUsdc(null)
		setCashTreesSheetAaUsdc(null)
		setCashTreesSheetPoints0(null)
		loadCashTreesWalletSnapshot(profile)
			.then((snap) => {
				if (cancelled) return
				setCashTreesSheetEoaUsdc(snap.eoaUsdc)
				setCashTreesSheetAaUsdc(snap.aaUsdc)
				setCashTreesSheetPoints0(snap.points0)
			})
			.catch((e: unknown) => {
				if (!cancelled) setCashTreesBalanceError(e instanceof Error ? e.message : 'Failed to load balances')
			})
			.finally(() => {
				if (!cancelled) setCashTreesBalanceLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [showCashTreesBalanceDetails, profiles?.[0]?.keyID])

	const closePayReceiveSheet = useCallback(() => {
		setShowPayReceiveSheet(false)
		setPayReceiveQrMode('receive')
		setPayRelayQRPayload(null)
		setPayRelayQRLoading(false)
		setShowFooter(true)
	}, [setShowFooter])

	const closePayReceiveSheetTap = useReliableTapHandler(closePayReceiveSheet)

	const payRelayDeadlineUnix = useMemo(() => {
		if (!payRelayQRPayload?.deadline) return NaN
		const n = parseInt(String(payRelayQRPayload.deadline), 10)
		return Number.isFinite(n) ? n : NaN
	}, [payRelayQRPayload])

	const payQrDisplayValue = useMemo(
		() =>
			payRelayQRPayload
				? encodeOpenContainerRelayQrPayload(payRelayQRPayload)
				: '',
		[payRelayQRPayload]
	)

	/** Pay tab：Open Relay QR 剩余有效期（与 payTemp1 顶部倒计时一致） */
	useEffect(() => {
		if (!showPayReceiveSheet || payReceiveQrMode !== 'pay' || !Number.isFinite(payRelayDeadlineUnix)) {
			return
		}
		let cancelled = false
		let timer: number | undefined
		const tick = () => {
			if (cancelled) return
			setPayRelaySecondsLeft(Math.max(0, payRelayDeadlineUnix - Math.floor(Date.now() / 1000)))
			timer = window.setTimeout(tick, 1000) as unknown as number
		}
		tick()
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [showPayReceiveSheet, payReceiveQrMode, payRelayDeadlineUnix])

	useEffect(() => {
		if (!showPayReceiveSheet || payReceiveQrMode !== 'pay') return
		const compute = () => {
			const vh = window.innerHeight
			const vw = window.innerWidth
			const reserved = 52 + 156 + 100 + 20 + 40
			const maxByH = Math.floor(vh - reserved)
			const maxByW = vw - 64
			let s = Math.min(256, maxByH, maxByW - 48)
			s = Math.max(152, Math.round(s / 8) * 8)
			setPaySheetQrSize((prev) => (Math.abs(prev - s) < 4 ? prev : s))
		}
		const onResize = () => requestAnimationFrame(compute)
		onResize()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [showPayReceiveSheet, payReceiveQrMode])

	/** Pay tab：生成 / 每分钟刷新 Open Relay QR（setTimeout 链，与 MyWalletDashboardNew handleAaRelayQR 一致） */
	useEffect(() => {
		if (!showPayReceiveSheet || payReceiveQrMode !== 'pay') {
			setPayRelaySecondsLeft(0)
			return
		}
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
			setPayRelaySecondsLeft(0)
			return
		}
		let cancelled = false
		let refreshTimer: number | undefined

		const signOnce = async (isInitial: boolean) => {
			if (isInitial) {
				setPayRelayQRLoading(true)
				setPayRelayQRPayload(null)
			}
			try {
				const aaAccount = await ensureConetAaForProfileAndPersist(profile, setProfiles)
				if (!aaAccount) throw new Error('CoNET Smart Account is not available')
				const payload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpenOnConet(
					{ privateKeyArmor: profile.privateKeyArmor, aaAccount },
					'0',
					{ deadlineSeconds: PAY_RELAY_QR_TTL_SECONDS }
				)
				if (!cancelled) setPayRelayQRPayload(payload)
			} catch (e) {
				console.error('[Home] signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpenOnConet failed:', e)
				if (isInitial && !cancelled) setPayRelayQRPayload(null)
			} finally {
				if (isInitial && !cancelled) setPayRelayQRLoading(false)
			}
		}

		const scheduleNextRefresh = () => {
			if (cancelled) return
			refreshTimer = window.setTimeout(async () => {
				await signOnce(false)
				scheduleNextRefresh()
			}, 60_000) as unknown as number
		}

		void (async () => {
			await signOnce(true)
			if (!cancelled) scheduleNextRefresh()
		})()

		return () => {
			cancelled = true
			if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
		}
	}, [showPayReceiveSheet, payReceiveQrMode, profiles?.[0]?.privateKeyArmor, profiles?.[0]?.aaAccount, setProfiles])

	/** Android WebView：Activate 场景下外层 overflow-hidden + flex 常导致滚动视口高度塌成一条；改为单层 flex 链并写死 flex-basis */
	const homeScrollUsesSingleFlexChain = false

	/** 与 DaemonProvider「points」折 CAD 同源，用于 Hub 双列（USDC / Merchant） */
	const homeHubWalletCad = useMemo(() => {
		const d = currencyData as Record<string, number>
		const cadPerUsdc = (Number(d.CAD) || 1.35) * (Number(d.USDC) || 1)
		const eoaU = Math.max(0, Number(usdcbalance) || 0)
		const aaU = Math.max(0, Number(aaAccountUsdcBalance) || 0)
		return cadPartsFromNumber((eoaU + aaU) * cadPerUsdc)
	}, [usdcbalance, aaAccountUsdcBalance, currencyData])

	const homeHubMerchantCad = useMemo(() => {
		const d = currencyData as Record<string, number>
		const cadPerUsdc = (Number(d.CAD) || 1.35) * (Number(d.USDC) || 1)
		let pointsCad = 0
		for (const entry of Object.values(myBrandCardDetails)) {
			const assets = entry?.assets
			if (!assets) continue
			const pts = Number(assets.points ?? 0)
			if (!Number.isFinite(pts) || pts <= 0) continue
			const pCur = (assets.cardCurrency ?? 'CAD').toUpperCase()
			if (pCur === 'CAD') {
				pointsCad += pts
			} else if (pCur === 'USDC') {
				pointsCad += pts * cadPerUsdc
			} else {
				const targetPerUsd = Number(d.CAD) > 0 ? Number(d.CAD) : 1.35
				const srcRaw = d[pCur]
				const srcPerUsd = typeof srcRaw === 'number' && srcRaw > 0 ? srcRaw : 1
				pointsCad += pts * (targetPerUsd / srcPerUsd)
			}
		}
		return cadPartsFromNumber(pointsCad)
	}, [myBrandCardDetails, currencyData])

	const merchantGiftCardOptions = useMemo((): MerchantGiftCardOption[] => {
		const out: MerchantGiftCardOption[] = []
		for (const uc of myBrandCards) {
			const addrKey = uc.cardAddress.toLowerCase()
			const detail = myBrandCardDetails[addrKey]
			const pts = Number(detail?.assets?.points ?? 0)
			if (!Number.isFinite(pts) || pts <= 0) continue
			const title =
				(detail?.meta?.name && detail.meta.name.trim()) || uc.name || '商户卡'
			out.push({
				cardAddress: uc.cardAddress,
				title,
				points: pts,
				currency: detail?.assets?.cardCurrency ?? uc.currency ?? 'CAD',
			})
		}
		return out.sort((a, b) => b.points - a.points)
	}, [myBrandCards, myBrandCardDetails])

	const merchantGiftEnabled = useMemo(() => {
		if (merchantGiftCardOptions.length > 0) return true
		const cad = Number(`${homeHubMerchantCad.whole}.${homeHubMerchantCad.frac}`)
		return Number.isFinite(cad) && cad > 0
	}, [merchantGiftCardOptions.length, homeHubMerchantCad])

	const closeMerchantGiftSheet = useCallback(() => {
		setShowMerchantGiftSheet(false)
		setShowFooter(true)
	}, [setShowFooter])

	const openMerchantGiftSheetTap = useReliableTapHandler(() => {
		if (!merchantGiftEnabled || merchantGiftCardOptions.length === 0) return
		setShowMerchantGiftSheet(true)
		setShowFooter(false)
	})

	return (
		<div
			className="
		box-border flex h-full min-h-[100vh] w-full flex-col bg-[#f8f9fa] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-slate-900 dark:bg-slate-950
		"
		>
			{/* <div className="px-5 pt-6 flex flex-col gap-2">
				<button
					type="button"
							className={styles.headerBtn}
							aria-label={tu('toggle_theme')}
							onClick={() => setDarkModle(!darkModle)}
				>
					<span className={styles.headerBtnIcon}>
						{darkModle ? <LightDrakMode /> : <LightDrakModeBlue />}
					</span>
				</button>
			</div> */}
			{/* 顶部栏：左右胶囊同一行 items-center 上下对齐；中间不拦截触摸 */}
			{!openSearch && (
				<div
					className="pointer-events-none fixed left-4 right-4 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-2 transition-opacity duration-300"
					style={{
						// 与下方主内容顶部占位一致；WebView 常返回 safe-area 0，需至少 1rem 与浏览器+PWA 视觉对齐
						top: 'max(1rem, env(safe-area-inset-top, 0px))',
						opacity: capsuleOpacity,
					}}
				>
					<button
						type="button"
						onClick={() => navigate('/myWallet')}
						className="flex items-center justify-self-start"
						style={{ pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
						aria-label="Open wallet"
					>
						<div className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-slate-100/90 bg-white py-2 pl-2 pr-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition-transform group active:scale-[0.98] dark:border-slate-700/80 dark:bg-slate-800">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-700/80 dark:ring-slate-600/80">
								<IpfsImg
									src={homeCapsuleAvatarSrc}
									alt=""
									className="h-full w-full object-cover"
									draggable={false}
								/>
							</div>
							<span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
								{homeBeamioTagLabel}
							</span>
						</div>
					</button>
					<div
						className="pointer-events-none min-w-0 max-w-[46vw] justify-self-center min-[400px]:max-w-[min(56vw,14rem)]"
						aria-hidden
					/>
					{linkedNfcListLoading && linkedNfcCards.length === 0 ? (
						<div
							className="pointer-events-none flex items-center justify-self-end"
							aria-busy
							aria-label="Loading linked cards"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800">
								<Loader2
									className="h-5 w-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400"
									strokeWidth={2.2}
									aria-hidden
								/>
							</div>
						</div>
					) : linkedNfcCards.length > 0 ? (
						<button
							type="button"
							onClick={openCardManagement}
							className="relative flex h-10 w-10 items-center justify-center justify-self-end rounded-full transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
							style={{ pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
							aria-label="Physical keys"
						>
							{/* Match Vouchers/example/codingTemp.html header: material-symbols sensors */}
							<svg
								className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400"
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-hidden
							>
								<path d="M7.76 16.24C6.67 15.16 6 13.66 6 12s.67-3.16 1.76-4.24l1.42 1.42C8.45 9.9 8 10.9 8 12s.45 2.1 1.17 2.83zm8.48 0C17.33 15.16 18 13.66 18 12s-.67-3.16-1.76-4.24l-1.42 1.42C15.55 9.9 16 10.9 16 12s-.45 2.1-1.17 2.83zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m8 2c0 2.21-.9 4.21-2.35 5.65l1.42 1.42C20.88 17.26 22 14.76 22 12s-1.12-5.26-2.93-7.07l-1.42 1.42C19.1 7.79 20 9.79 20 12M6.35 6.35 4.93 4.93C3.12 6.74 2 9.24 2 12s1.12 5.26 2.93 7.07l1.42-1.42C4.9 16.21 4 14.21 4 12s.9-4.21 2.35-5.65" />
							</svg>
							<span
								className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1562f0] dark:border-slate-800"
								aria-hidden
							/>
						</button>
					) : hasNativeNfcReaderForLink ? (
						<button
							type="button"
							onClick={() => startCashTreesPhysicalCardBind()}
							className="flex items-center justify-self-end"
							style={{ pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
							aria-label="Link NFC card"
						>
							<div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition-transform group active:scale-[0.98] hover:bg-slate-200/50 dark:border-slate-700/80 dark:bg-slate-800 dark:hover:bg-slate-800/50">
								<Plus
									className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
									strokeWidth={2.2}
									aria-hidden
								/>
							</div>
						</button>
					) : (
						<span className="pointer-events-none w-0 shrink-0 justify-self-end" aria-hidden />
					)}
				</div>
			)}

			{/*
				默认：外层 overflow-hidden + 内层 overflow-y-auto。
				Activate Wallet：去掉外层 overflow-hidden，并对滚动层写 flex: 1 1 0% + minHeight: 0，避免 Android WebView 可视区域塌条只露出顶部胶囊。
			*/}
			<div
				className={
					homeScrollUsesSingleFlexChain
						? 'flex min-h-0 flex-1 flex-col'
						: 'flex min-h-0 flex-1 flex-col overflow-hidden'
				}
			>
				<div
					ref={setScrollRef}
					onScroll={onCapsuleScroll}
					className={
						homeScrollUsesSingleFlexChain
							? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-24'
							: 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-44'
					}
					style={
						homeScrollUsesSingleFlexChain
							? { WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }
							: { WebkitOverflowScrolling: 'touch' }
					}
				>
					{!openSearch && (
						<>
							{/* 顶部留白：与固定胶囊 top 同源 max(1rem, safe-area) + 5rem；避免 WebView 下 safe-area=0 时面板贴顶 */}
							<div
								className="shrink-0"
								style={{
									minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)',
								}}
							/>

							{/* Content — 浅底、白卡片、青柠强调 */}
							<div className="space-y-8 px-5 pt-4">

							{/* Universal Pay Hub（codingTemp.html）：NFC 独立 + 渐变卡 + 白底 Show Pay Code + Quick Actions */}
							<div className="mb-10 flex flex-col gap-6 min-[480px]:gap-8">
								{/* Premium Universal Pay Hub — signature gradient */}
								<section className="shrink-0">
									<div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1562f0] to-[#4c1d95] text-white shadow-2xl">
										<div
											aria-hidden
											className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(ellipse_at_80%_0%,rgba(255,255,255,0.45),transparent_55%)]"
										/>
										<div className="relative z-10">
											<div className="p-8 pb-6 pt-7 min-[480px]:p-8">
												<div className="mb-6 flex items-start justify-between">
													<div className="space-y-1">
														<p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
															{tu('total_purchasing_power')}
														</p>
														<h2 className="text-4xl font-extrabold tabular-nums tracking-tight">
															CA$ {homeTotalPowerCad.whole}.{homeTotalPowerCad.frac}
														</h2>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-1 text-left">
														<p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
															{tu('usdc_balance')}
														</p>
														<p className="text-lg font-bold tabular-nums">
															CA$ {homeHubWalletCad.whole}.{homeHubWalletCad.frac}
														</p>
													</div>
													<div className="space-y-1 text-right">
														<p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
															{tu('merchant_assets')}
														</p>
														<p className="text-lg font-bold tabular-nums">
															CA$ {homeHubMerchantCad.whole}.{homeHubMerchantCad.frac}
														</p>
													</div>
												</div>
											</div>
											<div className="space-y-6 px-8 pb-8">
												<div className="py-2 text-center">
													<p className="text-sm font-medium leading-relaxed text-white/80">
														{tu('tap_at_any_beamio_softpos_to_pay_seamlessly')}
													</p>
												</div>
												<button
													type="button"
													data-touch-priority="1"
													{...openPayCodeSheetTap}
													className={`relative z-10 flex w-full min-h-[48px] items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-[#1562f0] shadow-xl shadow-black/20 transition-transform duration-300 active:scale-[0.98] active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1562f0] ${HOME_TOUCH_BUTTON_CLASS}`}
												>
													<QrCode className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden />
													<span className="text-base font-bold uppercase tracking-widest">{tu('show_pay_code')}</span>
												</button>
											</div>
										</div>
									</div>
								</section>

								{/* Quick Actions — 与 codingTemp.html 同结构 */}
								<section className="shrink-0 flex gap-2 min-[480px]:gap-3 [@media(max-height:700px)]:gap-2">
									<button
										type="button"
										data-touch-priority="1"
										{...openReceiveSheetTap}
										className={`flex flex-1 flex-col items-start gap-2 rounded-lg bg-[#f3f4f5] p-3 text-left transition-transform active:scale-95 active:bg-[#e7e8e9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/50 focus-visible:ring-offset-2 min-[480px]:gap-3 min-[480px]:p-4 dark:bg-slate-800/90 dark:active:bg-slate-800 dark:focus-visible:ring-offset-slate-900 [@media(max-height:700px)]:gap-1.5 [@media(max-height:700px)]:p-2.5 ${HOME_TOUCH_BUTTON_CLASS}`}
									>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#b3c5ff]/30 text-[#004bc3] dark:bg-[#1562f0]/25 dark:text-[#6ba3ff]">
										<Wallet size={22} strokeWidth={2} aria-hidden />
									</div>
									<div>
										<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{tu('top_up')}</p>
									</div>
									</button>
									<button
										type="button"
										data-touch-priority="1"
										{...openMerchantGiftSheetTap}
										disabled={!merchantGiftEnabled || merchantGiftCardOptions.length === 0}
										className={`flex flex-1 flex-col items-start gap-2 rounded-lg bg-[#f3f4f5] p-3 text-left transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/50 focus-visible:ring-offset-2 min-[480px]:gap-3 min-[480px]:p-4 dark:bg-slate-800/90 dark:focus-visible:ring-offset-slate-900 [@media(max-height:700px)]:gap-1.5 [@media(max-height:700px)]:p-2.5 ${HOME_TOUCH_BUTTON_CLASS} ${
											merchantGiftEnabled && merchantGiftCardOptions.length > 0
												? 'active:scale-95 active:bg-[#e7e8e9] dark:active:bg-slate-800'
												: 'cursor-not-allowed opacity-45'
										}`}
										aria-label={tu('gift_merchant_balance')}
									>
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#b3c5ff]/30 text-[#004bc3] dark:bg-[#1562f0]/25 dark:text-[#6ba3ff]">
											<Gift size={22} strokeWidth={2} aria-hidden />
										</div>
										<div>
											<p className="text-sm font-bold text-[#191c1d] dark:text-slate-100">{tu('gift')}</p>
										</div>
									</button>
								</section>
							</div>

							<section className="mb-10">
									<div className="mb-4 flex items-end justify-between px-1">
										<h2 className="text-xl font-extrabold tracking-tight text-[#191c1d] dark:text-slate-100">{tu('my_brands')}</h2>
										<button
											type="button"
											onClick={() => setShowMyBrandsDrawer(true)}
											className="flex items-center gap-1 text-[12px] font-semibold text-[#1562f0] transition-colors hover:text-[#0e4cbb]"
										>
											{tu('see_all')}
											<ChevronRight size={16} strokeWidth={2.5} />
										</button>
									</div>
									<div className="flex flex-col gap-2 rounded-lg bg-[#f3f4f5] p-2 dark:bg-slate-800/80">
										{myBrandsFeedLoading && myBrandCardsPreview.length === 0 ? (
											<div className="flex animate-pulse items-center gap-4 rounded-lg p-3">
												<div className="h-12 w-12 shrink-0 rounded-md bg-white/80 dark:bg-slate-700" />
												<div className="flex-1 space-y-2">
													<div className="h-3.5 w-28 rounded bg-white/80 dark:bg-slate-700" />
													<div className="h-3 w-36 rounded bg-white/60 dark:bg-slate-600" />
												</div>
												<div className="h-10 w-20 shrink-0 rounded bg-white/60 dark:bg-slate-700" />
											</div>
										) : myBrandCardsPreview.length === 0 ? (
											<div className="rounded-lg p-3 text-sm font-medium text-[#424655] dark:text-slate-400">
												{tu('no_merchant_brands_yet')}
											</div>
										) : (
											<MyBrandListEntries
												cards={myBrandCardsPreview}
												details={myBrandCardDetails}
											/>
										)}
									</div>
								</section>

							{show200OK && (
								<div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100">
									<p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">{tu('beamio_alpha_reward')}</p>
									<h4 className="font-bold text-gray-900">{tu('youve_claimed_0_1_usdc')}</h4>
									<p className="mt-1 text-[11px] text-gray-500 leading-snug">
										{tu('thank_you_for_testing_beamio_on_base_your_beamio_wallet_has_been_funded_with')}{' '}
										<span className="font-semibold text-gray-900">0.1 USDC</span>{' '}
										{tu('so_you_can_try_your_first_gasless_payment')}
									</p>
								</div>
							)}

							{/* Recent Activity - 与 Total Valuation、Send/Receive 同层级，左右边距统一 px-5；bare 无外层圆角/边框/边距，内部控件与上方对齐 */}
							<ActiveHistoryPannelNew
								title={tu('recent_activity')}
								compact
								compactLimit={RECENT_ACTIVITY_PREVIEW_COUNT}
								bare
								sectionTitleClassName="text-lg font-bold tracking-tight text-[#0F172A] dark:text-slate-100"
								viewAllClassName="text-[#1562f0] hover:text-[#0e4cbb]"
								onCompactViewAll={() => navigate('/Pay')}
							/>
						</div>

							<div className="pointer-events-none h-[128px] shrink-0 pb-[env(safe-area-inset-bottom,0px)]" />
						</>
					)}
				</div>
			</div>




			{/* Receive - BeamioPayMe 底部滑出 */}
			{createPortal(
				<AnimatePresence>
					{showPayMeSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={() => setShowPayMeSheet(false)}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl flex flex-col max-h-[92dvh] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-[480px]:pb-[calc(env(safe-area-inset-bottom)+4rem)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
									<div className="w-10" />
									<div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
									<button
										type="button"
										onClick={() => setShowPayMeSheet(false)}
										className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
										aria-label={tu('close')}
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
									<BeamioPayMe
										showActiveTab={false}
										hideOuterFrame
										onClose={() => setShowPayMeSheet(false)}
										onShowFuelCenter={() => {
											setShowPayMeSheet(false)
											setShowFuelView(true)
										}}
									/>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* Gift merchant points — bottom sheet */}
			{createPortal(
				<AnimatePresence>
					{showMerchantGiftSheet && merchantGiftCardOptions.length > 0 && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closeMerchantGiftSheet}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] flex max-h-[92dvh] flex-col rounded-t-[24px] bg-white pb-[calc(env(safe-area-inset-bottom)+2rem)] shadow-2xl dark:bg-slate-900"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex shrink-0 items-center justify-between px-4 py-2">
									<div className="w-10" />
									<div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-slate-600" />
									<button
										type="button"
										onClick={closeMerchantGiftSheet}
										className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
										aria-label={tu('close')}
									>
										<X className="h-5 w-5" aria-hidden />
									</button>
								</div>
								<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
									<MerchantAssetGiftSheet
										onClose={closeMerchantGiftSheet}
										cards={merchantGiftCardOptions}
										profile={profiles?.[0]}
										onSuccess={() => void refreshRecentActivityNoAa()}
									/>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* My Store Card：首页横向卡点击摘要（对齐 renderAction） */}
			{createPortal(
				<AnimatePresence>
					{selectedHomeStoreCard && (
						<>
							<motion.div
								key="home-store-card-backdrop"
								className="fixed inset-0 z-[10040] bg-black/50 dark:bg-black/60 backdrop-blur-sm"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={() => setSelectedHomeStoreCard(null)}
							/>
							<motion.div
								key="home-store-card-sheet"
								className="fixed left-0 right-0 bottom-0 z-[10041] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1.25rem)] px-6 pt-2"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mb-4" />
								<div className="flex justify-between items-start gap-3 mb-4">
									<div className="min-w-0">
										<h3 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 truncate">{selectedHomeStoreCard.name}</h3>
										<p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{selectedHomeStoreCard.type}</p>
									</div>
									<button
										type="button"
										onClick={() => setSelectedHomeStoreCard(null)}
										className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
										aria-label={tu('close')}
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<p className="text-sm text-gray-500 dark:text-slate-400 mb-2">{tu('store_balance_cad')}</p>
								<p className="text-3xl font-extrabold text-[#0F172A] dark:text-slate-100 mb-6">${selectedHomeStoreCard.balanceCad.toFixed(2)}</p>
								<button
									type="button"
									onClick={() => {
										setSelectedHomeStoreCard(null)
										navigate('/Browser')
									}}
									className="w-full py-3.5 rounded-2xl bg-[#1562f0] text-white font-bold hover:bg-[#1257d9] active:scale-[0.99] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/80 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
								>
									View in Discover
								</button>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{/* CashTrees 卡：Balance Details（链上 EOA+AA USDC + 基础设施卡 token #0 / points） */}
			{createPortal(
				<AnimatePresence>
					{showCashTreesBalanceDetails && (
						<motion.div
							key="cash-trees-balance-details"
							className="fixed inset-0 z-[10050] flex flex-col justify-end pointer-events-none"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							{/* 单根子树：避免 Fragment 下双 motion 时 AnimatePresence 只驱动第一个，底栏卡在 y:100% 仅见蒙版 */}
							<div
								className="absolute inset-0 pointer-events-auto bg-gray-900/40 dark:bg-black/50 backdrop-blur-md"
								onClick={closeCashTreesBalanceSheet}
								aria-hidden
							/>
							<motion.div
								className="relative z-10 w-full max-h-[85dvh] pointer-events-auto bg-[#F3F8FF] dark:bg-slate-900 rounded-t-[2.5rem] p-6 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-200/80 dark:border-slate-700 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto overscroll-contain"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mb-6 shrink-0" />

								<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">{tu('balance_details')}</h3>
								
								{cashTreesBalanceLoading && (
									<div className="flex flex-col items-center justify-center py-10 gap-3 mb-4">
										<Loader2 className="w-10 h-10 text-[#1562f0] animate-spin" aria-hidden />
										<span className="text-sm text-gray-500 dark:text-slate-400">{tu('loading_balances')}</span>
									</div>
								)}

								{cashTreesBalanceError && !cashTreesBalanceLoading && (
									<p className="text-sm text-amber-600 dark:text-amber-400 text-center mb-6">{cashTreesBalanceError}</p>
								)}

								{!cashTreesBalanceLoading && !cashTreesBalanceError && (
									<div className="w-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col mb-8">
										{/* Wallet (USDC)：EOA + AA 链上 USDC 合计 */}
										<div className="p-4 flex items-center justify-between border-b border-gray-100/50 dark:border-slate-700">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-slate-600 shrink-0 relative">
													<div className="relative w-7 h-7 shrink-0">
														<IpfsImg src={usdcIcon} alt="" className="block w-7 h-7 rounded-full object-contain" />
														<IpfsImg src={baseIcon} alt="" className="block w-4 h-4 absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white" />
													</div>
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">{tu('wallet_usdc')}</span>
													<span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">{tu('on_base')}</span>
												</div>
											</div>
											<div className="text-right shrink-0 pl-2">
												<span className="text-lg font-bold text-gray-900 dark:text-slate-100">
													{formatCashTreesUsd2(
														String(
															Math.max(0, Number(cashTreesSheetEoaUsdc ?? '') || 0) +
																Math.max(0, Number(cashTreesSheetAaUsdc ?? '') || 0)
														)
													)}
												</span>
											</div>
										</div>

										{/* 基础设施卡 token #0 / points */}
										<div className="p-4 flex items-center justify-between bg-gradient-to-r from-[#1562f0]/15 to-transparent dark:from-[#1562f0]/20 dark:to-transparent">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-[#1562f0]/30 dark:border-[#1562f0]/40 shrink-0" aria-hidden>
													<IpfsImg
														src={`${process.env.PUBLIC_URL ?? ''}/logo512.png`}
														alt=""
														className="h-7 w-7 object-contain"
														draggable={false}
													/>
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">Sen Pho + Cafe</span>
													<span className="text-[10px] text-[#1562f0] dark:text-[#6ba3ff] font-bold uppercase tracking-wider mt-0.5">{tu('eligible_for_store_discounts')}</span>
												</div>
											</div>
											<div className="text-right shrink-0 pl-2">
												<span className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCashTreesUsd2(cashTreesSheetPoints0)}</span>
											</div>
										</div>
									</div>
								)}

								<button
									type="button"
									onClick={closeCashTreesBalanceSheet}
									className="w-full py-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-[0.98] text-gray-900 dark:text-slate-100 rounded-2xl font-bold transition-all shadow-sm border border-gray-200 dark:border-slate-600 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/55 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
								>
									Close
								</button>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>,
				document.body
			)}

			{createPortal(
				<AnimatePresence>
					{cashTreesNfcOverlay.phase !== 'hidden' && (
						<div className="fixed inset-0 z-[10030] flex items-center justify-center p-5">
							<button
								type="button"
								className={`absolute inset-0 border-0 p-0 ${
									cashTreesNfcOverlay.phase === 'fetch' || cashTreesNfcOverlay.phase === 'scanning'
										? 'cursor-default'
										: 'cursor-pointer'
								} bg-gray-900/45 dark:bg-black/55 backdrop-blur-md`}
								aria-label="Dismiss"
								onClick={() => {
									if (
										cashTreesNfcOverlay.phase !== 'fetch' &&
										cashTreesNfcOverlay.phase !== 'scanning'
									) {
										cancelCashTreesNfcBind()
									}
								}}
							/>
							<div className="relative z-10 w-full max-w-[300px] rounded-[2rem] border-2 border-[#1562f0]/45 dark:border-[#1562f0]/50 bg-white dark:bg-slate-900 shadow-xl shadow-[#1562f0]/15 overflow-hidden min-h-[280px] flex flex-col">
								{(cashTreesNfcOverlay.phase === 'scanning' || cashTreesNfcOverlay.phase === 'fetch') && (
									<>
										<div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-6 min-h-[220px]">
											<div className="absolute inset-3 border-2 border-[#1562f0]/25 rounded-[1.65rem] pointer-events-none" />
											{cashTreesNfcOverlay.phase === 'scanning' ? (
												<>
													<Loader2
														className="w-16 h-16 text-[#1562f0] dark:text-[#6ba3ff] animate-spin mb-4"
														aria-hidden
													/>
													<p className="text-lg font-bold text-gray-900 dark:text-slate-100 text-center">
														Waiting...
													</p>
												</>
											) : (
												<>
													<Loader2
														className="w-16 h-16 text-[#1562f0] dark:text-[#6ba3ff] animate-spin mb-4"
														aria-hidden
													/>
													<p className="text-lg font-bold text-gray-900 dark:text-slate-100 text-center">
														Linking your card
													</p>
													<p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-2">
														Opening a secure session and attaching this tag to your wallet.
													</p>
												</>
											)}
										</div>
										<div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50/90 dark:bg-slate-800/90 border-t border-gray-100 dark:border-slate-700">
											<ShieldCheck size={14} className="text-gray-400 shrink-0" aria-hidden />
											<span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
												Secured by Beamio Protocol
											</span>
										</div>
									</>
								)}
								{cashTreesNfcOverlay.phase === 'result' && cashTreesNfcOverlay.linkResult != null && (
									<div className="flex flex-col p-6 pb-5">
										<div className="flex flex-col items-center mb-5">
											<div className="w-12 h-12 rounded-full bg-[#1562f0]/15 flex items-center justify-center mb-3">
												<Check className="w-7 h-7 text-[#1562f0] dark:text-[#6ba3ff]" strokeWidth={2.5} aria-hidden />
											</div>
											<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight text-center">
												Physical card linked
											</h3>
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-2 leading-relaxed px-1">
												This NFC tag is now bound to your CashTrees wallet.
												{(cashTreesNfcOverlay.linkResult.redeemTxHash ||
													(cashTreesNfcOverlay.linkResult.migrationEoaSweepTxHashes?.length ?? 0) > 0) ? (
													<>
														{' '}
														USDC, CADD, Beamio card balances, and membership NFTs from the tag wallet were moved to your app wallet.
													</>
												) : null}{' '}
												Your home balance will refresh shortly.
											</p>
											<p className="text-[11px] text-gray-500 dark:text-slate-400 mt-3 font-mono text-center">
												{shortNfcId(cashTreesNfcOverlay.tagUidHex || '—', 6, 4)}
											</p>
											{cashTreesNfcOverlay.linkResult.redeemTxHash ? (
												<p
													className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 text-center break-all line-clamp-2 max-w-full"
													title={cashTreesNfcOverlay.linkResult.redeemTxHash}
												>
													Tx {shortNfcId(cashTreesNfcOverlay.linkResult.redeemTxHash, 10, 6)}
												</p>
											) : null}
											{cashTreesNfcOverlay.ndefUri ? (
												<p
													className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 text-center break-all line-clamp-2 max-w-full"
													title={cashTreesNfcOverlay.ndefUri}
												>
													{cashTreesNfcOverlay.ndefUri}
												</p>
											) : null}
										</div>
										<button
											type="button"
											onClick={() => cancelCashTreesNfcBind()}
											className="w-full py-3.5 bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] dark:from-[#3d8ef5] dark:to-[#1562f0] text-white font-bold rounded-full shadow-md shadow-[#1562f0]/25 border border-[#1562f0]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/80 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
										>{tu('done')}</button>
									</div>
								)}
								{cashTreesNfcOverlay.phase === 'error' && (
									<div className="flex flex-col p-6">
										<p className="text-sm text-amber-700 dark:text-amber-400 text-center font-semibold mb-2">
											{cashTreesNfcOverlay.errorMsg ?? tu('something_went_wrong')}
										</p>
										{cashTreesNfcOverlay.ndefUri ? (
											<p className="text-[10px] text-gray-400 text-center break-all line-clamp-3 mb-4" title={cashTreesNfcOverlay.ndefUri}>
												{cashTreesNfcOverlay.ndefUri}
											</p>
										) : (
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-4">
												Check NFC is on, then retry or close.
											</p>
										)}
										{getCashTreesNativeNfcBridge()?.startPhysicalCardBind ? (
											<button
												type="button"
												onClick={() => startCashTreesPhysicalCardBind()}
												className="w-full py-3.5 mb-2 bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] dark:from-[#3d8ef5] dark:to-[#1562f0] text-white font-bold rounded-full shadow-md shadow-[#1562f0]/25 border border-[#1562f0]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/80"
											>
												Retry scan
											</button>
										) : null}
										<button
											type="button"
											onClick={() => cancelCashTreesNfcBind()}
											className="w-full py-3.5 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-full font-bold border border-gray-200 dark:border-slate-600"
										>
											Close
										</button>
									</div>
								)}
							</div>
						</div>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{/* NFC Card Management（对齐 beamio.app renderAction） */}
			{createPortal(
				<AnimatePresence>
					{showCardManagementModal && (
						<motion.div
							key="home-nfc-card-management"
							className="pointer-events-none fixed inset-0 z-[10035] flex flex-col"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<button
								type="button"
								className="pointer-events-auto absolute inset-0 border-0 bg-gray-900/60 p-0 backdrop-blur-sm dark:bg-black/55"
								aria-label={tu('close')}
								onClick={() => setShowCardManagementModal(false)}
							/>
							<motion.div
								className="pointer-events-auto relative z-10 mt-auto flex max-h-[90dvh] flex-col overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[#F2F2F7] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] dark:bg-slate-950 dark:shadow-[0_-10px_40px_rgba(0,0,0,0.35)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto mb-5 h-1.5 w-12 shrink-0 rounded-full bg-[#c3c6d8] dark:bg-slate-600" />
								<div className="mb-2 flex items-center justify-between gap-2">
									<h3 className="text-2xl font-extrabold tracking-tight text-[#191c1d] dark:text-slate-50">{tu('physical_keys')}</h3>
									<button
										type="button"
										onClick={() => setShowCardManagementModal(false)}
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-black/5 dark:text-blue-400 dark:hover:bg-white/10"
										aria-label={tu('close')}
									>
										<X className="h-5 w-5" strokeWidth={2.2} aria-hidden />
									</button>
								</div>
								<p className="mb-6 text-sm leading-relaxed text-[#424655] dark:text-slate-400">
									Manage your secure hardware authentication devices and access tokens.
								</p>
								{!deviceHasNfcReadCapability && (
									<p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
										This device cannot read NFC. You can still manage keys already linked to your account. To register a new key, use a phone or tablet with NFC.
									</p>
								)}
								{linkedNfcListLoading && linkedNfcCards.length === 0 && (
									<div className="mb-4 flex items-center gap-2 text-sm text-[#424655] dark:text-slate-400">
										<Loader2 className="h-4 w-4 animate-spin text-[#1562f0]" aria-hidden />
										Loading keys…
									</div>
								)}
								{cardMgmtError && (
									<p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
										{cardMgmtError}
									</p>
								)}
								<div className="mb-auto space-y-6">
									{linkedNfcCards.map((card, cardIndex) => {
										const isPaused = card.linkState === 'deactive'
										const isPrimary = card.linkState === 'active' && card.isPrimaryUi
										const isActiveSecondary = card.linkState === 'active' && !card.isPrimaryUi
										const title = isPaused
											? 'Paused hardware key'
											: isPrimary
												? 'Primary hardware key'
												: 'Linked hardware key'
										const idLine = `ID: VR-${card.last4}-${String(cardIndex + 1).padStart(2, '0')}`
										return (
											<div
												key={card.id}
												className={`rounded-2xl border border-[#c3c6d8]/15 bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:border-slate-700/50 dark:bg-slate-900 ${
													isPaused ? 'opacity-80' : ''
												}`}
											>
												<div className="mb-6 flex items-start justify-between gap-3">
													<div className="flex min-w-0 items-center gap-4">
														<div
															className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
																isPrimary
																	? 'bg-gradient-to-br from-[#004bc3] to-[#1562f0] text-white'
																	: isActiveSecondary
																		? 'bg-[#edeeef] text-[#465c99] dark:bg-slate-800 dark:text-[#b3c5ff]'
																		: 'bg-[#e1e3e4] text-[#424655] dark:bg-slate-700 dark:text-slate-400'
															}`}
														>
															{isPrimary ? (
																<Key className="h-7 w-7" strokeWidth={2} aria-hidden />
															) : isActiveSecondary ? (
																<HomeHardwareIcon className="h-7 w-7" strokeWidth={2} aria-hidden />
															) : (
																<Ban className="h-7 w-7" strokeWidth={2} aria-hidden />
															)}
														</div>
														<div className="min-w-0">
															<h4
																className={`text-lg font-bold tracking-tight ${
																	isPaused ? 'text-[#424655] dark:text-slate-500' : 'text-[#191c1d] dark:text-slate-100'
																}`}
															>
																{title}
															</h4>
															<p
																className={`mt-0.5 font-mono text-sm ${
																	isPaused ? 'text-[#424655]/60 dark:text-slate-500/80' : 'text-[#424655] dark:text-slate-400'
																}`}
															>
																{idLine}
															</p>
															{isPaused && (
																<p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
																	Paused on server
																</p>
															)}
														</div>
													</div>
													<div className="flex flex-col items-end gap-2 shrink-0">
														<span
															className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
																card.linkState === 'active'
																	? 'bg-[#1562f0]/10 text-[#004bc3] dark:bg-[#1562f0]/20 dark:text-[#6ba3ff]'
																	: 'bg-[#c3c6d8]/30 text-[#424655] dark:bg-slate-600 dark:text-slate-300'
															}`}
														>
															{card.linkState === 'active' ? 'Active' : 'Inactive'}
														</span>
														{isPrimary && card.linkState === 'active' && (
															<p className="text-[10px] text-[#424655] dark:text-slate-500">{tu('primary_device')}</p>
														)}
													</div>
												</div>
												<div
													className={`flex items-center justify-between border-t pt-4 ${
														isPaused ? 'border-[#e1e3e4]/30 dark:border-slate-600/50' : 'border-[#edeeef] dark:border-slate-700'
													}`}
												>
													{card.linkState === 'deactive' ? (
														<button
															type="button"
															onClick={() => void enableLinkedNfcOnServer(card.tagId)}
															disabled={nfcLinkActionTagId !== null}
															className="px-2 text-sm font-semibold text-[#004bc3] transition-colors hover:!text-[#1562f0] disabled:opacity-50 dark:text-blue-400"
														>
															{nfcLinkActionTagId === card.tagId ? (
																<span className="inline-flex items-center gap-1">
																	<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Enable
																</span>
															) : (
																'Unfreeze key'
															)}
														</button>
													) : !card.isPrimaryUi ? (
														<button
															type="button"
															onClick={() => setLinkedNfcPrimaryById(card.id)}
															disabled={nfcLinkActionTagId !== null}
															className="px-2 text-sm font-semibold text-[#004bc3] transition-colors hover:!text-[#1562f0] disabled:opacity-50 dark:text-blue-400"
														>
															Set primary
														</button>
													) : (
														<span className="px-2 text-sm font-semibold text-[#004bc3]/40 dark:text-slate-500">{tu('settings')}</span>
													)}
													<button
														type="button"
														onClick={() => void removeLinkedNfcOnServer(card.tagId)}
														disabled={nfcLinkActionTagId !== null}
														className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-red-600 transition-opacity hover:opacity-75 disabled:opacity-50 dark:text-red-400"
													>
														{nfcLinkActionTagId === card.tagId ? (
															<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
														) : null}
														Freeze key
													</button>
												</div>
											</div>
										)
									})}
									{!linkedNfcListLoading && linkedNfcCards.length === 0 && (
										<div className="rounded-2xl border border-dashed border-[#c3c6d8] bg-white py-10 text-center dark:border-slate-600 dark:bg-slate-900">
											<Smartphone size={32} className="mx-auto mb-2 text-[#c3c6d8] dark:text-slate-600" aria-hidden />
											<p className="text-sm font-medium text-[#424655] dark:text-slate-500">{tu('no_physical_keys_linked')}</p>
										</div>
									)}
								</div>
								<button
									type="button"
									disabled={!deviceHasNfcReadCapability}
									onClick={() => {
										if (!deviceHasNfcReadCapability) return
										setShowCardManagementModal(false)
										startCashTreesPhysicalCardBind()
									}}
									className="group mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#737687] p-8 transition-all duration-300 hover:border-[#1562f0] hover:bg-[#1562f0]/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#737687] disabled:hover:bg-transparent dark:border-slate-500 dark:hover:border-[#1562f0]"
								>
									<PlusCircle className="h-6 w-6 text-[#737687] transition-colors group-hover:text-[#004bc3] dark:text-slate-400" strokeWidth={2} aria-hidden />
									<span className="text-lg font-bold tracking-tight text-[#737687] transition-colors group-hover:text-[#004bc3] dark:text-slate-400 dark:group-hover:text-blue-400">
										Register New Hardware Key
									</span>
								</button>
								<div className="mt-10 flex gap-4 rounded-2xl border border-[#c3c6d8]/20 bg-[#edeeef] p-6 dark:border-slate-700 dark:bg-slate-800/80">
									<ShieldCheck className="h-8 w-8 shrink-0 text-[#004bc3] dark:text-[#6ba3ff]" strokeWidth={2} aria-hidden />
									<div>
										<h4 className="mb-1 font-bold text-[#191c1d] dark:text-slate-100">{tu('hardware_security_layer')}</h4>
										<p className="text-sm leading-relaxed text-[#424655] dark:text-slate-400">
											Beamio keys use physical-layer encryption. Freezing a key immediately revokes access across all terminal endpoints globally.
										</p>
									</div>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{/* Pay / Receive 底栏（对齐 renderAction index Pay|Receive） */}
			{createPortal(
				<AnimatePresence>
					{showPayReceiveSheet && (
						<>
							<motion.div
								className={
									payReceiveQrMode === 'pay'
										? 'fixed inset-0 z-[10020] bg-[#191c1d]/10 backdrop-blur-md'
										: 'fixed inset-0 z-[10020] bg-black/40 backdrop-blur-md dark:bg-black/50'
								}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								role="button"
								tabIndex={-1}
								aria-label={tu('close')}
								data-touch-priority="1"
								{...closePayReceiveSheetTap}
							/>
							<motion.div
								className={
									payReceiveQrMode === 'pay'
										? 'fixed bottom-0 left-0 right-0 z-[10021] flex max-h-[92dvh] flex-col items-center overflow-hidden overscroll-contain rounded-t-xl bg-[#f3f4f5] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.1)] dark:bg-slate-900'
										: 'fixed bottom-0 left-0 right-0 z-[10021] flex flex-col items-center overflow-hidden overscroll-contain rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] dark:bg-slate-900'
								}
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 32, stiffness: 320 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div
									className={
										payReceiveQrMode === 'pay'
											? 'flex w-full shrink-0 items-center justify-between px-4 pb-2 pt-3'
											: 'flex w-full shrink-0 items-center justify-between px-4 pb-1 pt-2'
									}
								>
									<span className="w-10 shrink-0" aria-hidden />
									<div
										className={
											payReceiveQrMode === 'pay'
												? 'h-1.5 w-12 shrink-0 rounded-full bg-[#e1e3e4] dark:bg-slate-600'
												: 'h-1.5 w-12 shrink-0 rounded-full bg-gray-200 dark:bg-slate-600'
										}
									/>
									<button
										type="button"
										data-touch-priority="1"
										{...closePayReceiveSheetTap}
										className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors active:bg-gray-100 dark:text-slate-400 dark:active:bg-slate-700 ${HOME_TOUCH_BUTTON_CLASS}`}
										aria-label={tu('close')}
									>
										<X className="h-5 w-5 text-[#191c1d] dark:text-slate-100" aria-hidden />
									</button>
								</div>
								<div
									className={
										payReceiveQrMode === 'pay'
											? 'mx-auto w-full max-w-lg shrink-0 overflow-hidden overscroll-none px-6 pb-4'
											: 'mx-auto w-full max-w-lg shrink-0 overflow-hidden overscroll-none px-5 pb-3'
									}
								>
									{payReceiveQrMode === 'pay' ? (
										<div className="mx-auto flex w-full max-w-md flex-col gap-4 px-0 pb-2 pt-0 sm:px-2">
											<div className="shrink-0 space-y-2 text-center">
												<h2 className="text-2xl font-extrabold tracking-tight text-[#191c1d] dark:text-slate-100">
													Scan to Pay
												</h2>
												<p className="mx-auto max-w-[280px] text-sm leading-snug text-[#424655] dark:text-slate-400">
													Position the QR code within the frame to authorize the transaction.
												</p>
											</div>

											<div className="relative flex shrink-0 flex-col items-center py-2">
												{payRelayQRLoading && !payRelayQRPayload && (
													<div className="flex flex-col items-center gap-3 py-8">
														<Loader2 className="h-12 w-12 animate-spin text-[#1562f0]" aria-hidden />
														<span className="text-sm text-[#424655] dark:text-slate-400">{tu('generating_pay_code')}</span>
													</div>
												)}
												{!payRelayQRLoading && !payRelayQRPayload && (
													<p className="max-w-sm px-4 text-center text-sm text-amber-600 dark:text-amber-400">
														{!profiles?.[0]?.privateKeyArmor
															? 'Unlock your wallet to show pay QR.'
															: 'Could not generate pay code. Close and try again.'}
													</p>
												)}
												{payRelayQRPayload && payQrDisplayValue && (
													<div className="relative shrink-0">
														<div
															aria-hidden
															className="absolute -left-4 -top-4 h-12 w-12 rounded-tl-xl border-l-4 border-t-4 border-[#1562f0] opacity-20"
														/>
														<div
															aria-hidden
															className="absolute -right-4 -top-4 h-12 w-12 rounded-tr-xl border-r-4 border-t-4 border-[#1562f0] opacity-20"
														/>
														<div
															aria-hidden
															className="absolute -bottom-4 -left-4 h-12 w-12 rounded-bl-xl border-b-4 border-l-4 border-[#1562f0] opacity-20"
														/>
														<div
															aria-hidden
															className="absolute -bottom-4 -right-4 h-12 w-12 rounded-br-xl border-b-4 border-r-4 border-[#1562f0] opacity-20"
														/>
														<div className="rounded-xl bg-gradient-to-br from-[#1562f0] to-[#004bc3] p-2 shadow-xl min-[400px]:p-3">
															<div className="rounded-lg border border-[#e1e3e4] bg-white p-2 shadow-xl dark:border-slate-200 min-[400px]:p-4">
																<div
																	className="relative flex items-center justify-center"
																	style={{ width: paySheetQrSize, height: paySheetQrSize }}
																>
																	<QRCodeCanvas
																		value={payQrDisplayValue}
																		size={paySheetQrSize}
																		level="M"
																		includeMargin={false}
																		bgColor="#ffffff"
																		fgColor="#000000"
																		className="block rounded-sm"
																	/>
																	<div
																		className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
																		style={{
																			width: Math.min(64, Math.max(44, Math.round((64 * paySheetQrSize) / 256))),
																			height: Math.min(64, Math.max(44, Math.round((64 * paySheetQrSize) / 256))),
																			borderRadius: Math.min(18, Math.max(12, Math.round((18 * paySheetQrSize) / 256))),
																			padding: Math.min(6, Math.max(4, Math.round((6 * paySheetQrSize) / 256))),
																		}}
																	>
																		<IpfsImg
																			src={APP_LOGO_SRC}
																			alt="Beamio"
																			className="h-full w-full object-contain"
																			style={{
																				borderRadius: Math.min(14, Math.max(10, Math.round((14 * paySheetQrSize) / 256))),
																			}}
																			draggable={false}
																		/>
																	</div>
																	{payRelaySecondsLeft <= 0 && (
																		<div
																			className="absolute inset-0 flex items-center justify-center rounded-sm bg-white/90 backdrop-blur-sm dark:bg-slate-900/85"
																			aria-label="Pay code expired"
																		>
																			<span className="text-lg font-bold text-slate-800 dark:text-slate-100">
																				Expired
																			</span>
																		</div>
																	)}
																</div>
															</div>
														</div>
													</div>
												)}
											</div>

											<div className="mx-auto w-full max-w-xs shrink-0 pb-1 min-[400px]:pb-2">
												{payRelayQRPayload && (
													<div className="space-y-3">
														<div className="flex items-end justify-between">
															<div className="flex min-w-0 items-center gap-2">
																<ShieldCheck
																	className="h-4 w-4 shrink-0 text-[#1562f0] dark:text-[#6ba3ff]"
																	strokeWidth={2.5}
																	aria-hidden
																/>
																<span className="text-[10px] font-bold uppercase tracking-widest text-[#1562f0] dark:text-[#6ba3ff]">
																	Secure Dynamic Key
																</span>
															</div>
															<span className="shrink-0 font-mono text-[10px] text-[#424655] dark:text-slate-400">
																{formatPayRelayCountdown(payRelaySecondsLeft)}
															</span>
														</div>
														<div className="h-1.5 w-full overflow-hidden rounded-full bg-[#edeeef] dark:bg-slate-700">
															<div
																className="h-full rounded-full bg-[#004bc3] shadow-[0_0_8px_rgba(0,75,195,0.4)] transition-[width] duration-300 ease-out dark:bg-[#1562f0]"
																style={{
																	width: `${Math.min(100, Math.max(0, (payRelaySecondsLeft / PAY_RELAY_QR_TTL_SECONDS) * 100))}%`,
																}}
															/>
														</div>
													</div>
												)}
											</div>
										</div>
									) : (
										<div
											className="flex w-full flex-col items-center overflow-hidden overscroll-none"
											style={{ touchAction: 'manipulation' }}
										>
											{/* Receive：topupExample1.html — Add Funds at Store（可扫描 QR，不在码心叠加遮挡） */}
											<div className="mb-3 w-full space-y-1 text-center">
												<h3 className="text-lg font-bold tracking-tight text-[#191c1d] dark:text-slate-100">
													Add Funds at Store
												</h3>
												<p className="mx-auto max-w-md px-2 text-sm leading-snug text-[#424655] dark:text-slate-400">
													Show this code to the cashier to top up your balance.
												</p>
											</div>
											<div className="relative flex w-full max-w-full justify-center overflow-hidden px-1">
												<div
													aria-hidden
													className="pointer-events-none absolute inset-0 rounded-xl opacity-90"
													style={{
														background:
															'radial-gradient(circle, rgba(21, 98, 240, 0.1) 0%, rgba(21, 98, 240, 0) 70%)',
													}}
												/>
												<div className="relative flex w-64 max-w-full flex-col items-center rounded-xl border-2 border-dashed border-[#c3c6d8] bg-[#f3f4f5] p-4 dark:border-slate-600 dark:bg-slate-800/90">
													<div className="relative rounded-md bg-white p-2 shadow-sm dark:bg-slate-900">
														{topUpReceiveQrValue ? (
															<div className="relative h-40 w-40">
																<QRCodeCanvas
																	value={topUpReceiveQrValue}
																	size={160}
																	level="H"
																	includeMargin={false}
																	bgColor="#ffffff"
																	fgColor="#000000"
																	className="block rounded-sm"
																/>
																<div className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[16px] bg-white p-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
																	<IpfsImg
																		src={APP_LOGO_SRC}
																		alt="Beamio"
																		className="h-full w-full rounded-[12px] object-contain"
																		draggable={false}
																	/>
																</div>
															</div>
														) : (
															<div className="flex h-40 w-40 items-center justify-center text-center text-sm text-[#424655] dark:text-slate-400">
																Loading code…
															</div>
														)}
													</div>
													<div className="mt-3 flex items-center gap-2 rounded-full border border-[#c3c6d8]/40 bg-white px-3 py-1 shadow-sm dark:border-slate-600 dark:bg-slate-900">
														<span className="text-sm font-semibold tracking-wide text-[#004bc3] dark:text-[#6ba3ff]">
															{topUpReceiveDisplayTag}
														</span>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* Add Cash — 与 beamio.app renderAction 同结构（methods / store_qr / coinbase / topup_store） */}
			{createPortal(
				<AnimatePresence>
					{showAddCashSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40 backdrop-blur-md"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closeAddCashSheet}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85dvh] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex-shrink-0 flex items-center justify-between px-4 pt-2 pb-1">
									<div className="w-10" />
									<div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600" />
									<button
										type="button"
										onClick={closeAddCashSheet}
										className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
										aria-label={tu('close')}
									>
										
									</button>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-6 pb-4 flex flex-col">
									{showAddUsdcInSheet ? (
										<>
											<BeamioNavBack
												title=""
												onClose={() => setShowAddUsdcInSheet(false)}
												onMore={() => {}}
											/>
											<BeamioAddUSDCFlow
												embedInSheet
												onCancel={() => setShowAddUsdcInSheet(false)}
											/>
										</>
									) : addCashMode === 'methods' ? (
										<>
											<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">
												Add Funds
											</h3>
											<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center px-4">
												Fund your self-custodial wallet or top up merchant cards.
											</p>
											<div className="space-y-3 mb-auto">
												<h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-3 px-1">{tu('funding_source')}</h4>
												<button
													type="button"
													onClick={() => setAddCashMode('store_qr')}
													className="w-full text-left bg-white dark:bg-slate-800/80 border border-[#1562f0]/50 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-[#1562f0]/10 dark:hover:bg-[#1562f0]/15 active:scale-[0.98] transition-all relative overflow-hidden group"
												>
													<div className="absolute top-0 right-0 w-24 h-24 bg-[#1562f0]/20 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-[#1562f0]/30 transition-colors" />
													<div className="flex items-center relative z-10">
														<div className="w-10 h-10 bg-[#1562f0] rounded-xl flex items-center justify-center mr-3 shadow-sm">
															<Store className="text-white" size={20} />
														</div>
														<div>
															<p className="font-bold text-gray-900 dark:text-slate-100">{tu('load_store_card_via_cashier')}</p>
															<p className="text-xs text-gray-600 dark:text-slate-400">{tu('give_physical_cash_to_the_issuing_merchant')}</p>
														</div>
													</div>
													<QrCode className="text-gray-900 dark:text-slate-100 relative z-10" size={20} />
												</button>
												<button
													type="button"
													onClick={() => setAddCashMode('coinbase')}
													className="w-full text-left bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all mt-4"
												>
													<div className="flex items-center">
														<div className="w-10 h-10 bg-[#0052FF] rounded-xl flex items-center justify-center mr-3 shadow-sm">
															<span className="text-white font-bold text-xl">C</span>
														</div>
														<div>
															<p className="font-bold text-gray-900 dark:text-slate-100">{tu('buy_usdc_via_coinbase')}</p>
															<p className="text-xs text-gray-500 dark:text-slate-400">3rd-party platform. Auto-deposits to wallet.</p>
														</div>
													</div>
													<ChevronRight className="text-gray-400" size={20} />
												</button>
												<button
													type="button"
													onClick={() => setAddCashMode('topup_store')}
													className="w-full text-left bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all mt-4"
												>
													<div className="flex items-center">
														<div className="w-10 h-10 bg-[#1562f0]/10 dark:bg-slate-700 border border-[#1562f0]/20 dark:border-slate-600 rounded-xl flex items-center justify-center mr-3">
															<ArrowRightLeft className="text-[#1562f0] dark:text-[#6ba3ff]" size={20} />
														</div>
														<div>
															<p className="font-bold text-gray-900 dark:text-slate-100">{tu('top_up_store_card')}</p>
															<p className="text-xs text-gray-500 dark:text-slate-400">{tu('use_your_usdc_to_fund_a_merchant_card')}</p>
														</div>
													</div>
													<ChevronRight className="text-gray-400" size={20} />
												</button>
											</div>
										</>
									) : addCashMode === 'store_qr' ? (
										<>
											<div className="flex items-center mb-6 w-full relative">
												<button
													type="button"
													onClick={() => setAddCashMode('methods')}
													className="text-[#1562f0] dark:text-[#6ba3ff] font-bold flex items-center text-sm absolute left-0"
												>
													<ChevronRight className="rotate-180 mr-1" size={16} /> Back
												</button>
												<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">{tu('store_deposit')}</h3>
											</div>
											<div className="flex flex-col items-center justify-center mb-auto pt-4">
												<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center max-w-[260px] leading-relaxed">
													Show this code to the <span className="font-bold text-gray-900 dark:text-slate-100">{tu('issuing_merchant')}</span> and hand
													them your paper cash.
												</p>
												<div className="w-64 h-64 bg-white dark:bg-slate-800 rounded-[2rem] p-4 mb-6 shadow-md border border-gray-100 dark:border-slate-600">
													<div className="w-full h-full bg-gray-50 dark:bg-slate-900/80 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200 dark:border-slate-600">
														{addCashDepositAddress ? (
															<QRCodeCanvas
																value={addCashDepositAddress}
																size={180}
																className="rounded-xl"
																includeMargin={false}
															/>
														) : (
															<QrCode size={140} className="text-gray-900 dark:text-slate-300" />
														)}
													</div>
												</div>
											</div>
										</>
									) : addCashMode === 'coinbase' ? (
										<>
											<div className="flex items-center mb-6 w-full relative">
												<button
													type="button"
													onClick={() => setAddCashMode('methods')}
													className="text-[#1562f0] dark:text-[#6ba3ff] font-bold flex items-center text-sm absolute left-0"
												>
													<ChevronRight className="rotate-180 mr-1" size={16} /> Back
												</button>
												<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">Coinbase</h3>
											</div>
											<div className="flex flex-col items-center justify-center mb-auto pt-4 w-full">
												<div className="w-16 h-16 bg-[#0052FF] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">
													C
												</div>
												<h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">{tu('buy_usdc_directly')}</h4>
												<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center px-4 leading-relaxed">
													CashTrees is a self-custodial wallet and never touches your fiat. You will be securely redirected to Coinbase to
													complete your purchase. USDC will auto-deposit to your wallet.
												</p>
												<div className="w-full max-w-[280px] bg-gray-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-gray-200 dark:border-slate-600 mb-6 shadow-sm">
													<div className="flex justify-between items-center mb-3 gap-2">
														<span className="text-xs text-gray-500 dark:text-slate-400 font-medium shrink-0">{tu('to_wallet')}</span>
														<span className="text-xs font-mono text-gray-900 dark:text-slate-100 font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600 truncate max-w-[60%]">
															{addCashDepositAddress || '—'}
														</span>
													</div>
													<div className="flex justify-between items-center">
														<span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{tu('network')}</span>
														<div className="flex items-center bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600">
															<div className="w-3.5 h-3.5 bg-[#1562f0] rounded-full flex items-center justify-center mr-1.5" />
															<span className="text-xs font-bold text-gray-900 dark:text-slate-100">Base</span>
														</div>
													</div>
												</div>
												<button
													type="button"
													onClick={() => setShowAddUsdcInSheet(true)}
													className="w-full max-w-[280px] py-4 rounded-2xl font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] active:scale-[0.98] transition-all shadow-lg"
												>
													Continue with Coinbase
												</button>
											</div>
										</>
									) : addCashMode === 'topup_store' ? (
										isSelectingTopUpStore ? (
											<div className="flex flex-col h-full min-h-[280px]">
												<div className="flex items-center mb-6 relative w-full">
													<button
														type="button"
														onClick={() => setIsSelectingTopUpStore(false)}
														className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
														aria-label={tu('back')}
													>
														<ChevronLeft size={20} />
													</button>
													<h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mx-auto">{tu('select_store_card')}</h3>
												</div>
												<div className="space-y-4 overflow-y-auto pb-6">
													{homeStoreCards.map((card) => {
														const IconCmp = card.icon
														return (
															<button
																type="button"
																key={card.id}
																onClick={() => {
																	setTopUpStore(card)
																	setIsSelectingTopUpStore(false)
																}}
																className="w-full flex items-center p-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-[#1562f0] dark:hover:border-[#1562f0] hover:bg-[#1562f0]/5 dark:hover:bg-[#1562f0]/10 transition-colors shadow-sm text-left"
															>
																<div
																	className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-inner bg-gradient-to-br ${card.color} text-white`}
																>
																	<IconCmp size={18} />
																</div>
																<div className="flex-1 min-w-0">
																	<h4 className="font-bold text-gray-900 dark:text-slate-100">{card.name}</h4>
																	<p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">{card.type}</p>
																</div>
																<div className="text-right shrink-0">
																	<p className="text-sm font-bold text-gray-900 dark:text-slate-100">CA$ {card.balanceCad.toFixed(2)}</p>
																</div>
															</button>
														)
													})}
												</div>
											</div>
										) : (
											<>
												<div className="flex items-center mb-6 w-full relative">
													<button
														type="button"
														onClick={() => setAddCashMode('methods')}
														className="text-[#1562f0] dark:text-[#6ba3ff] font-bold flex items-center text-sm absolute left-0"
													>
														<ChevronRight className="rotate-180 mr-1" size={16} /> Back
													</button>
													<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">{tu('top_up_store_card')}</h3>
												</div>
												<div className="flex flex-col mb-auto pt-2 w-full">
													<div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-3xl p-5 mb-2 relative shadow-inner">
														<div className="flex justify-between items-center mb-2">
															<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{tu('from_vault_usdc')}</span>
															<span className="text-xs font-bold text-gray-400 dark:text-slate-500">Bal: {addCashVaultUsdc.toFixed(2)}</span>
														</div>
														<div className="flex items-center justify-between gap-2">
															<span className="text-3xl font-bold text-gray-900 dark:text-slate-100 break-all">
																{addCashAmountCad &&
																addCashTopUpCadPerUsdc > 0 &&
																Number.isFinite(parseFloat(addCashAmountCad))
																	? (parseFloat(addCashAmountCad) / addCashTopUpCadPerUsdc).toFixed(2)
																	: '0.00'}
															</span>
															<div className="flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-gray-100 dark:border-slate-600 shrink-0">
																<div className="w-5 h-5 bg-[#1562f0] rounded-full flex items-center justify-center text-white font-bold text-[10px] mr-1.5">
																	$
																</div>
																<span className="text-sm font-bold text-gray-900 dark:text-slate-100">USDC</span>
															</div>
														</div>
													</div>
													<div className="flex justify-center -my-4 relative z-10">
														<div className="w-10 h-10 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-full flex items-center justify-center shadow-sm">
															<ArrowDownToLine size={18} className="text-gray-400" />
														</div>
													</div>
													<div className="bg-white dark:bg-slate-800/80 border border-[#1562f0]/50 rounded-3xl p-5 mt-2 relative shadow-sm">
														<div className="flex justify-between items-center mb-2">
															<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{tu('to_store_card_cad')}</span>
															<button
																type="button"
																onClick={() => setIsSelectingTopUpStore(true)}
																className="text-xs text-[#1562f0] dark:text-[#6ba3ff] font-bold hover:underline"
															>
																Change
															</button>
														</div>
														<div className="flex items-center justify-between mb-4">
															<div className="flex items-center gap-2 min-w-0">
																<div
																	className={`w-6 h-6 rounded-full bg-gradient-to-br ${topUpStore.color} border border-gray-200 dark:border-slate-600 shadow-inner shrink-0`}
																/>
																<span className="font-bold text-gray-900 dark:text-slate-100 truncate">{topUpStore.name}</span>
															</div>
														</div>
														<div className="flex items-center justify-between gap-2">
															<input
																type="number"
																placeholder="0.00"
																value={addCashAmountCad}
																onChange={(e) => setAddCashAmountCad(e.target.value)}
																inputMode="decimal"
																autoComplete="off"
																className="bg-transparent text-3xl font-bold text-[#1562f0] dark:text-[#6ba3ff] outline-none w-1/2 min-w-0 placeholder-[#1562f0]/30 dark:placeholder-[#6ba3ff]/35 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
															/>
															<div className="flex items-center bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-gray-100 dark:border-slate-600 shrink-0">
																<span className="text-sm font-bold text-gray-700 dark:text-slate-200">CAD</span>
															</div>
														</div>
													</div>
													<div className="mt-8 bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-gray-200 dark:border-slate-600">
														<div className="flex justify-between items-start gap-2 text-sm mb-2">
															<span className="text-gray-500 dark:text-slate-400 shrink-0">{tu('exchange_rate')}</span>
															<div className="flex flex-col items-end gap-1 min-w-0">
																<div className="flex items-center gap-2">
																	<span className="font-semibold text-gray-900 dark:text-slate-100 text-right inline-flex items-center gap-1">
																		1 USDC = {addCashTopUpCadPerUsdc.toFixed(4)} CAD
																		{topUpOracleLoading && topUpRateRefreshStatus === 'idle' ? (
																			<Loader2 className="w-3.5 h-3.5 animate-spin text-[#1562f0] shrink-0" aria-hidden />
																		) : null}
																	</span>
																	<button
																		type="button"
																		onClick={() => void refreshTopUpOracleRate(true)}
																		disabled={topUpRateRefreshStatus !== 'idle'}
																		className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/60"
																		aria-label="Refresh exchange rate"
																	>
																		{topUpRateRefreshStatus === 'loading' ? (
																			<Loader2 className="w-4 h-4 animate-spin" aria-hidden />
																		) : topUpRateRefreshStatus === 'success' ? (
																			<Check className="w-4 h-4 text-[#1562f0]" aria-hidden />
																		) : topUpRateRefreshStatus === 'error' ? (
																			<AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden />
																		) : (
																			<RefreshCw className="w-4 h-4" aria-hidden />
																		)}
																	</button>
																</div>
																<span className="text-[10px] text-gray-400 dark:text-slate-500 text-right">
																	Base BeamioOracle (USDC→CAD)
																</span>
															</div>
														</div>
														{topUpOracleError ? (
															<p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1">
																Oracle unreachable; using app cache fallback. Use refresh to retry.
															</p>
														) : null}
														<p className="text-[11px] text-gray-400 dark:text-slate-500">
															Demo: store card balances update locally only; vault balance follows chain after refresh.
														</p>
													</div>
													<button
														type="button"
														onClick={handleConfirmHomeTopUp}
														disabled={
															!addCashAmountCad ||
															addCashTopUpCadPerUsdc <= 0 ||
															!Number.isFinite(parseFloat(addCashAmountCad)) ||
															parseFloat(addCashAmountCad) / addCashTopUpCadPerUsdc > addCashVaultUsdc
														}
														className={`w-full py-4 mt-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
															!addCashAmountCad ||
															addCashTopUpCadPerUsdc <= 0 ||
															!Number.isFinite(parseFloat(addCashAmountCad)) ||
															parseFloat(addCashAmountCad) / addCashTopUpCadPerUsdc > addCashVaultUsdc
																? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
																: 'bg-[#1562f0] hover:bg-[#1257d9] active:scale-95 text-white shadow-[0_4px_14px_rgba(21,98,240,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/80 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900'
														}`}
													>
														<ArrowDownToLine
															size={20}
															className={
																!addCashAmountCad ||
																addCashTopUpCadPerUsdc <= 0 ||
																!Number.isFinite(parseFloat(addCashAmountCad)) ||
																parseFloat(addCashAmountCad) / addCashTopUpCadPerUsdc > addCashVaultUsdc
																	? 'text-gray-400'
																	: 'text-white'
															}
														/>
														Confirm Top Up
													</button>
												</div>
											</>
										)
									) : null}
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}


			{showFuelView && createPortal(
				<AnimatePresence>
					<motion.div
						key="fuel-view-overlay"
						className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
					>
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pt-[env(safe-area-inset-top)]">
							<FuelView
								onClose={() => setShowFuelView(false)}
								bUnitBalance={bUnitBalance}
								account={profiles?.[0]?.keyID}
								onRefresh={() => {
									const p = profiles?.[0]
									if (p?.keyID) getBUnitBalanceOnConet(p.keyID).then(setBUnitBalance).catch(() => setBUnitBalance(null))
								}}
							/>
						</div>
					</motion.div>
				</AnimatePresence>,
				document.body
			)}

			{!openSearch && showAlphaHowItWorks && createPortal(
				<AnimatePresence>
					<motion.div
						key="modal-overlay"
						className="
							fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
						onTouchMove={(e) => e.stopPropagation()}
					>
					{/* 顶部 Header */}
					<BeamioNavBack
						title={
							showAlphaHowItWorks === 'BeamioAlphaHowItWorks' ? 'How Beamio Alpha works'
							: showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' ? 'How Beamio works'
							: showAlphaHowItWorks === 'BeamioTestBalance' ? 'About this 0.2 USDC'
							: showAlphaHowItWorks === '支付' ? '支付'
							: ''
						}
						onClose={() => {
							setShowAlphaHowItWorks('')
							setShowFooter(true)
						}}
						onMore={() => {

						}}
					/>

						{/* 内容区域 */}
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
							{showAlphaHowItWorks === 'BeamioAlphaHowItWorks' && <BeamioAlphaHowItWorks />}
							{showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' && <BeamioLearnHowItWorksCard />}
							{showAlphaHowItWorks === 'BeamioAlphaDropConfirm' && (
							<BeamioAlphaDropConfirm
								wallet={myAddress}
								close={(success) => {
									setShowAlphaHowItWorks('')

									if (!success) return
									if (success === 'error') {
										return setShowGetFaucet('sameIP')
									}
									storee()
									setShowGetFaucet('finished')
								}}
							/>
							)}
							{showAlphaHowItWorks === 'BeamioTestBalance' && <BeamioTestBalanceDetailsCard />}
							
							
							{showAlphaHowItWorks === '支付' && <PayScreen 
								beamioer={userPreviewItem||undefined}
								close={path => {
									setShowAlphaHowItWorks('')
								}}
								onShowFuelCenter={() => {
									setShowAlphaHowItWorks('')
									setShowFuelView(true)
								}}
							/>}
							{showAlphaHowItWorks === 'OnrampOfframpGuide' && <OnrampOfframpGuide />}
							{showAlphaHowItWorks === 'CoinbaseRamps' && <BeamioAddUSDCFlow />}
							{showAlphaHowItWorks === 'BeamioContactProfilePreview' && userPreviewItem && 
								<BeamioContactProfilePreview 
								item={userPreviewItem} 
								close={item => {
									setShowAlphaHowItWorks('')
									setSettingsOpen('支付')
									setShowFooter(false)
							}} />}

							{
								showAlphaHowItWorks === 'TransactionsItemDetail' && itemTx &&
								<TransactionsItemDetail
									localMode='pay' tx={itemTx}
								/>
							}

						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}



			{/**		检索	 */}
			{createPortal(
				<div
					className={[
						"fixed inset-0 z-[9998] bg-white w-full h-full overscroll-none touch-action-none",
						
						// ✅ 修改点 1: 时间改为 500ms (0.5秒)，ease-in-out 让加减速更自然
						"transition-opacity duration-500 ease-in-out",
						
						// 状态切换：控制透明度和点击穿透
						openSearch ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
					].join(" ")}
					style={{ top: 0, left: 0, bottom: 0, right: 0 }}
				>
					{/* ✅ 修改点 2: 移除了 {openSearch && (...)} 
					让内容常驻 DOM，这样“关闭”时，内容会跟随背景一起慢慢淡出，
					而不是瞬间消失只剩下背景在淡出。
					
					注意：如果 BeamioSearch 内部有需要每次打开都重置的逻辑（比如 useEffect），
					请确保它监听了 openSearch 或者是通过 key={openSearch ? 'open' : 'closed'} 来强制刷新。
					*/}
					<div className="h-full w-full flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
						<BeamioSearch
							isOpen={openSearch}
							close={(item) => {
								
								if (!item || typeof item === "string") {
									
								} else {
									setUserPreviewItem(item)
									setShowAlphaHowItWorks('BeamioContactProfilePreview')
								}
								setShowFooter(true)
								setOpenSearch(false)
							}}
						/>
					</div>
				</div>,
				document.body
			)}

			{/* 底部向上弹出窗口 */}
			<div
			className={[
				"fixed inset-0 z-40",
				settingsOpen ? "pointer-events-auto" : "pointer-events-none"
			].join(" ")}
			>
				{/* 灰色遮罩：父页面不可用 */}
				<div
					className={[
					"absolute inset-0",
					"bg-black/50 transition-opacity duration-300 ease-out",
					settingsOpen ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen('')
					}}
				/>

				{/* Bottom Sheet：全宽，从底部上来 */}
				<div
					className={[
					"absolute inset-x-0 bottom-0",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-y-0" : "translate-y-full"
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
							{ settingsOpen === 'BeamioBetaAccess' && 
							<BeamioBetaAccess 

							onClose={() => {
								setShowFooter(true)
								setSettingsOpen('')
							}} />}

							{ settingsOpen === '支付' && (
								<PayScreen 
									beamioer={userPreviewItem ?? undefined}
									close={() => {
										setSettingsOpen('')
										setShowFooter(true)
									}}
									onShowFuelCenter={() => {
										setSettingsOpen('')
										setShowFooter(true)
										setShowFuelView(true)
									}}
								/>
							)}
							{/* <div
								className="
								h-[24px]
								pb-[env(safe-area-inset-bottom)]
								pointer-events-none
								"
							/> */}
						</div>
					</div>
				</div>
			</div>

			<MyBrandsFullScreenDrawer
				open={showMyBrandsDrawer}
				onClose={() => setShowMyBrandsDrawer(false)}
				onAddNewMerchantCard={() => {
					setShowMyBrandsDrawer(false)
					navigate('/discover')
				}}
			/>

			{activateGiftVoucherScreen
				? createPortal(
						<AnimatePresence>
							<motion.div
								key="activate-gift-voucher-overlay"
								className="fixed inset-0 z-[9998] flex min-h-0 flex-col bg-white dark:bg-slate-900"
								initial={{ x: '100%' }}
								animate={{ x: 0 }}
								exit={{ x: '100%' }}
								transition={{ duration: 0.3, ease: 'easeOut' }}
							>
								{activateGiftVoucherScreen === 'activeCoupons' ? (
									<ActiveCouponsScreen
										onBack={() => setActivateGiftVoucherScreen('')}
										onManualEntry={() => setActivateGiftVoucherScreen('redeemVoucher')}
										getPrivateKeyArmor={() => profiles?.[0]?.privateKeyArmor}
										onClaimSuccess={() => setActivateGiftVoucherScreen('')}
									/>
								) : null}
								{activateGiftVoucherScreen === 'redeemVoucher' ? (
									<RedeemVoucherScreen
										onBack={() => setActivateGiftVoucherScreen('activeCoupons')}
										onActivateVoucher={(voucherInput) => {
											const path = buildRedeemVoucherHistoryPath(voucherInput)
											if (!path) return
											setActivateGiftVoucherScreen('')
											setShowFooter(true)
											navigate(path)
										}}
									/>
								) : null}
							</motion.div>
						</AnimatePresence>,
						document.body
					)
				: null}
		</div>
	)
}

export default Home
