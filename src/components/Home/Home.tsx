// Home.tsx

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import { createPortal } from 'react-dom';
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, getBalanceProcess, onWalletEvent, getUserInfo, searchUsername, getOracle, parseOracleToCurrencyData} from '@/services/beamio'
import base_icon from '@/components/assets/base-logo.png'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import type { LucideIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData, postBeamio} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion, AnimatePresence } from "framer-motion"
import { Settings, Check, ArrowDownCircle, PlusCircle , X, Zap, Shield, ShieldCheck, Clock, Sparkles, Wallet, Circle, RefreshCw, BadgeCheck, Plus, Send, QrCode, Store, Radio, CreditCard, Loader2, Copy, Info, Star, Nfc, SlidersHorizontal, CheckCircle2, Trash2, Smartphone, ChevronRight, ChevronLeft, ArrowDownToLine, ArrowRightLeft, AlertTriangle, Gift, Scan, UserCircle, MessageCircle, Layers, Search }
	from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import CoinbaseRamps from '@/components/Setting/CoinbaseRamps'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import PayScreen from '@/pages/Pay/send'

import { ethers } from 'ethers'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/logo512.png'
import { baseEndpoint } from '@/utils/constants'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import {
	getAAAccount,
	getMyAssets,
	getMyAssetsAggregated,
	getBUnitBalanceOnConet,
	postNfcLinkApp,
	postNfcLinkAppClaimWithKey,
	postListLinkedNfcCards,
	postNfcCardLinkStateSigned,
} from '@/services/BeamioCard'
import { BEAMIO_USER_CARD_ASSET_ADDRESS } from '@/config/chainAddresses'
import ActiveHistoryPannelNew from '@/pages/History/components/activeHistoryPannelNew'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import {BeamioBetaAccess} from './components/BeamioBetaAccess'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import FuelView from './FuelView'
import ShowPayQR from '@/pages/Vouchers/showPayQR'
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen, type OpenContainerRelayPayload } from '@/services/AAaccount'



const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`
const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

/** beamio 表示 name 的 protocol，与 ChatList displayName 一致。兼容 beamio 与 searchResult 两种类型 */
const displayName = (item: beamio | searchResult | null | undefined) => {
	if (!item) return ''
	const first = 'first_name' in item ? item.first_name : (item as beamio).firstName ?? ''
	const lastRaw = 'last_name' in item ? item.last_name : (item as beamio).lastName ?? ''
	const lastname = String(lastRaw || '').split('\r\n') || []
	const fullName = `${first || ''} ${/^\{/.test(lastname[0] || '') ? '' : lastname[0] || ''}`.trim()
	return fullName || (item as beamio).accountName || (item as searchResult).username || (item as beamio).address || (item as searchResult).address || ''
}

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** Gift To: 下拉与 SearchBarWithResults 一致 */
function giftSearchFormatUserDate(timestamp?: string | number): string {
	if (!timestamp) return ''
	const num = Number(timestamp)
	if (!num) return ''
	const ms = num < 10_000_000_000 ? num * 1000 : num
	const d = new Date(ms)
	if (isNaN(d.getTime())) return ''
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function makeGiftSearchAddressOnlyResult(address: string): searchResult {
	return {
		username: 'unknow',
		image: '',
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
	}
}

/** 与 Pay/send PayScreen 共用，Gift 选人写入后 Pay 侧「最近」一致 */
const PAY_RECENT_KEY = 'beamio_pay_recent'
const PAY_RECENT_MAX = 8
function loadPayRecentRecipients(): searchResult[] {
	try {
		const raw = localStorage.getItem(PAY_RECENT_KEY)
		if (!raw) return []
		const arr = JSON.parse(raw) as searchResult[]
		return Array.isArray(arr) ? arr.slice(0, PAY_RECENT_MAX) : []
	} catch {
		return []
	}
}
function savePayRecentRecipients(items: searchResult[]) {
	try {
		localStorage.setItem(PAY_RECENT_KEY, JSON.stringify(items.slice(0, PAY_RECENT_MAX)))
	} catch {
		/* ignore */
	}
}

type CashTreesNativeNfcStatus =
	| 'unknown'
	| 'no_bridge'
	| 'no_hardware'
	| 'disabled'
	| 'ready'
	| 'permission_denied'

type CashTreesNfcOverlayPhase = 'hidden' | 'tap' | 'fetch' | 'result' | 'error'

type CashTreesNfcLinkOverlayResult = {
	redeemTxHash?: string | null
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

/** Android：`JavascriptInterface` 注入 `window.CashTreesAndroid`。iOS：`WKScriptMessageHandler` + 注入 `window.CashTreesIOS`（方法签名对齐 Android）。 */
type CashTreesNativeNfcBridge = {
	getNfcStatus: () => string
	startPhysicalCardBind: () => void
	cancelPhysicalCardBind?: () => void
}

/** 当前原生壳：由宿主注入的全局决定，优于 UA 猜测。 */
export function getCashTreesNativeNfcHost(): 'android' | 'ios' | null {
	if (typeof window === 'undefined') return null
	const w = window as Window & { CashTreesAndroid?: CashTreesNativeNfcBridge; CashTreesIOS?: CashTreesNativeNfcBridge }
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return 'android'
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return 'ios'
	return null
}

export function getCashTreesNativeNfcBridge(): CashTreesNativeNfcBridge | null {
	if (typeof window === 'undefined') return null
	const w = window as Window & { CashTreesAndroid?: CashTreesNativeNfcBridge; CashTreesIOS?: CashTreesNativeNfcBridge }
	if (typeof w.CashTreesAndroid?.getNfcStatus === 'function') return w.CashTreesAndroid
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return w.CashTreesIOS
	return null
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
}

/** Send a Store Gift：资产来源（与 renderAction UsdcGiftVault / GiftSource 对齐） */
type HomeUsdcGiftVault = {
	id: 'usdc'
	name: string
	type: string
	color: string
	text: string
	balanceCad: number
}

type HomeGiftSource = HomeStoreCardRow | HomeUsdcGiftVault

const INITIAL_HOME_STORE_CARDS: HomeStoreCardRow[] = [
	{ id: 'senpho', name: 'Sen Pho + Cafe', type: 'Black Card', color: 'from-gray-800 to-gray-900', borderColor: 'border-gray-700', iconColor: 'text-yellow-500', bgColor: 'bg-yellow-500/20', icon: Star, balanceCad: 50.0 },
	{ id: 'lumina', name: 'Lumina Roasters', type: 'Green Card', color: 'from-emerald-500 to-teal-700', borderColor: 'border-emerald-600', iconColor: 'text-white', bgColor: 'bg-white/20', icon: CreditCard, balanceCad: 10.0 },
]

type AddCashSheetMode = 'methods' | 'store_qr' | 'coinbase' | 'topup_store'

const Home = ({}) => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio, setCurrencyData,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode,
		currencyData, setRedeemCode, setPayMePayment, setAllNodes, setGossip, gossip, setCharts, charts, setShowFooter, scanData, setScanData
	} = useDaemonContext()
	const navigate = useNavigate()
	  const [settingsOpen, setSettingsOpen] = useState<''|'BeamioBetaAccess'|'Pay'>('')
	
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
	const [language, setLanguage] = useState<"en">("en")
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const [openSearch, setOpenSearch]= useState(false)
	const [reflash, setReflash] = useState(false)
	const [itemTx, setItemtx] = useState<TransferHistork>()
	const [ccsaAssets, setCcsaAssets] = useState<Awaited<ReturnType<typeof getMyAssetsAggregated>> | null>(null)
	const [bUnitBalance, setBUnitBalance] = useState<{ total: number; free: number; paid: number } | null>(null)



	const [activeItems, setActiveItems] = useState<TransferHistork[]>([])

	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|'TransactionsItemDetail'|
		''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')
	const [showPayMeSheet, setShowPayMeSheet] = useState(false)
	/** Home Pay/Receive 底栏（对齐 renderAction Pay|Receive 交互） */
	const [showPayReceiveSheet, setShowPayReceiveSheet] = useState(false)
	const [payReceiveQrMode, setPayReceiveQrMode] = useState<'pay' | 'receive'>('receive')
	/** Pay 模式：与 MyWalletDashboardNew AA relay QR 同源（OpenContainer relay 签名 JSON） */
	const [payRelayQRPayload, setPayRelayQRPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [payRelayQRLoading, setPayRelayQRLoading] = useState(false)
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
	const [showGiftSheet, setShowGiftSheet] = useState(false)
	const [giftAmount, setGiftAmount] = useState('')
	const [giftRecipient, setGiftRecipient] = useState('')
	const [giftMessage, setGiftMessage] = useState('')
	const [giftStore, setGiftStore] = useState<HomeGiftSource | null>(null)
	const [isSelectingGiftStore, setIsSelectingGiftStore] = useState(false)
	const [giftRecipientHits, setGiftRecipientHits] = useState<searchResult[]>([])
	const [giftRecipientSearchLoading, setGiftRecipientSearchLoading] = useState(false)
	const [giftRecipientSuggestOpen, setGiftRecipientSuggestOpen] = useState(true)
	const giftRecipientSearchRef = useRef<HTMLDivElement>(null)
	const giftRecipientSearchSeq = useRef(0)
	const [giftRecipientSelected, setGiftRecipientSelected] = useState<searchResult | null>(null)
	const [giftPayRecentRecipients, setGiftPayRecentRecipients] = useState<searchResult[]>([])
	const [giftPayHandoffPayee, setGiftPayHandoffPayee] = useState<searchResult | null>(null)
	const [giftPayPrefill, setGiftPayPrefill] = useState<{ note?: string; usdc?: string } | null>(null)
	const [aaAddrCopied, setAaAddrCopied] = useState(false)
	/** 首页 CashTrees 大卡：与 getMyAssets(BEAMIO_USER_CARD) 同源（AA USDC + POINTS_ID #0） */
	const [cashTreesWalletSnapshot, setCashTreesWalletSnapshot] = useState<{
		aaUsdc: string
		points0: string
	} | null>(null)
	/** CashTrees 卡点击：AA USDC + 基础设施卡 points（token #0 口径，与 getMyAssets 一致） */
	const [showCashTreesBalanceDetails, setShowCashTreesBalanceDetails] = useState(false)
	const [cashTreesBalanceLoading, setCashTreesBalanceLoading] = useState(false)
	const [cashTreesBalanceError, setCashTreesBalanceError] = useState<string | null>(null)
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
	const [homeStoreCards, setHomeStoreCards] = useState<HomeStoreCardRow[]>(INITIAL_HOME_STORE_CARDS)
	const [selectedHomeStoreCard, setSelectedHomeStoreCard] = useState<HomeStoreCardRow | null>(null)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!openSearch)

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

	const eoaAddressShort = profiles?.[0]?.keyID ? fmtAddr(profiles[0].keyID) : '—'
	/** 已登录 EOA、尚未部署 AA 时在首页展示激活引导（与 renderAction Activate Wallet 对齐） */
	const showActivateWalletPanel = Boolean(profiles?.[0]?.keyID) && !hasAAWallet

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

	/** Activate Wallet 引导展示期间隐藏全局 Footer（与 Pay/Receive 等底栏一致） */
	useEffect(() => {
		if (!showActivateWalletPanel) return
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [showActivateWalletPanel, setShowFooter])

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
		getMyAssets(profile, BEAMIO_USER_CARD_ASSET_ADDRESS)
			.then((res) => {
				setCashTreesWalletSnapshot(
					res
						? { aaUsdc: res.usdcBalance ?? '0', points0: res.points ?? '0' }
						: { aaUsdc: '0', points0: '0' }
				)
			})
			.catch(() => setCashTreesWalletSnapshot({ aaUsdc: '0', points0: '0' }))
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
		// 以当前 AA Factory（config 中 0xFD48...）的链上结果为唯一依据，覆盖本地 aaAccount，避免显示旧 Factory 的地址
		try {
			const chainAa = await getAAAccount(profile)
			const nextAa = chainAa ?? undefined
			const currentAa = profile.aaAccount?.toLowerCase()
			if (currentAa !== (nextAa?.toLowerCase() ?? '')) {
				const nextProfiles = profiles.map((p: profile, i: number) => i === 0 ? { ...p, aaAccount: nextAa } : p)
				setProfiles(nextProfiles)
				if (temp.profiles) temp.profiles = nextProfiles
				setCoNET_Data(temp)
				await storeSystemData()
			}
		} catch {
			// 网络失败时再校验：若本地是 EOA 或无 code 则清除
			if (profile.aaAccount) {
				try {
					const code = await baseEndpoint.getCode(profile.aaAccount)
					const isEOA = profile.keyID && profile.aaAccount.toLowerCase() === profile.keyID.toLowerCase()
					if (!code || code === '0x' || code.length <= 2 || isEOA) {
						const nextProfiles = profiles.map((p: profile, i: number) => i === 0 ? { ...p, aaAccount: undefined } : p)
						setProfiles(nextProfiles)
						if (temp.profiles) temp.profiles = nextProfiles
						setCoNET_Data(temp)
						await storeSystemData()
					}
				} catch {
					// 忽略
				}
			}
		}
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

	/** 用于 exampleExpress 风格的大数字拆分展示。合计：EOA USDC + AA USDC + CCSA 卡余额，转换为用户设定的 currency */
	function getValuationParts(): { symbol: string; whole: string; decimal: string } {
		// 1) EOA USDC 转换为目标币种
		const usdcRate = fxRateUSDCToCurrency(currency)
		const eoaValue = currency === 'USDC' ? usdcbalance : usdcbalance * usdcRate

		// 2) AA 账号 USDC（getMyAssets 返回，与 EOA 分开）
		const aaUsdc = Number(ccsaAssets?.usdcBalance ?? 0)
		const aaValue = currency === 'USDC' ? aaUsdc : aaUsdc * usdcRate

		// 3) CCSA 积分按卡币种计价，转换为目标币种。CCSA 卡币种通常为 CAD
		const ccsaPoints = Number(ccsaAssets?.points ?? 0)
		const ccsaCurrency = ccsaAssets?.cardCurrency ?? 'CAD'
		let ccsaValue = 0
		if (ccsaCurrency === 'USDC') {
			// 卡币种为 USDC 时，直接按 USDC→目标币种折算
			ccsaValue = currency === 'USDC' ? ccsaPoints : ccsaPoints * usdcRate
		} else {
			// 卡币种为法币（如 CAD）：1 ccsaCurrency = ? target 货币
			// 公式：targetPerCcsa = (1 USD = X target) / (1 USD = Y ccsaCurrency) = X/Y
			const targetPerUsd = (currencyData as Record<string, number>)[currency] ?? (currency === 'USD' ? 1 : 0)
			const ccsaPerUsd = (currencyData as Record<string, number>)[ccsaCurrency] ?? (ccsaCurrency === 'CAD' ? 1.35 : 1)
			const ccsaRate = ccsaPerUsd > 0 ? targetPerUsd / ccsaPerUsd : 0
			ccsaValue = ccsaPoints * ccsaRate
		}

		const total = eoaValue + aaValue + ccsaValue
		const fixed = currency === 'JPY' ? 0 : 2
		const formatted = formatWithThousands(total, fixed)
		const [whole = '0', dec = fixed === 0 ? '00' : '00'] = formatted.split('.')
		let symbol = '$'
		switch (currency) {
			case 'EUR': symbol = '€'; break
			case 'TWD': symbol = 'NT$'; break
			case 'SGD': symbol = 'SG$'; break
			case 'HKD': symbol = 'HK$'; break
			case 'JPY': symbol = 'JP¥'; break
			case 'CNY': symbol = 'RMB¥'; break
			case 'CAD': symbol = 'CA$'; break
			case 'USD': symbol = 'US$'; break
			case 'USDC': symbol = ''; break
			default: symbol = 'US$'
		}
		return { symbol: symbol || '', whole, decimal: dec }
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

	const addCashVaultUsdc = useMemo(() => {
		const n = Number(cashTreesWalletSnapshot?.aaUsdc ?? '0')
		return Number.isFinite(n) ? Math.max(0, n) : 0
	}, [cashTreesWalletSnapshot?.aaUsdc])

	/** 1 USDC → CAD；链上刷新成功后以 Oracle 为准，否则与全局 currencyData（同源 feeder）一致 */
	const addCashTopUpCadPerUsdc = useMemo(() => {
		const d = currencyData as Record<string, number> | undefined
		const ctx = (Number(d?.CAD) || 1.35) * (Number(d?.USDC) || 1)
		if (topUpOracleCadPerUsdc != null && topUpOracleCadPerUsdc > 0) return topUpOracleCadPerUsdc
		return ctx
	}, [currencyData, topUpOracleCadPerUsdc])

	/** Gift 资产列表：USDC 金库按 Oracle 折算为 CAD 展示 */
	const giftUsdcValuationCad = useMemo(
		() => addCashVaultUsdc * addCashTopUpCadPerUsdc,
		[addCashVaultUsdc, addCashTopUpCadPerUsdc]
	)

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

	useEffect(() => {
		if (!showAddCashSheet || addCashMode !== 'topup_store') return
		void refreshTopUpOracleRate(false)
	}, [showAddCashSheet, addCashMode, refreshTopUpOracleRate])

	useEffect(() => {
		if (!showGiftSheet) return
		void refreshTopUpOracleRate(false)
	}, [showGiftSheet, refreshTopUpOracleRate])

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
		setAddCashMode('methods')
		setShowAddUsdcInSheet(false)
		setIsSelectingTopUpStore(false)
		setAddCashAmountCad('')
		const first = homeStoreCards[0] ?? INITIAL_HOME_STORE_CARDS[0]!
		setTopUpStore(first)
		setShowAddCashSheet(true)
		setShowFooter(false)
	}

	const closeGiftSheet = useCallback(() => {
		giftRecipientSearchSeq.current++
		setShowGiftSheet(false)
		setIsSelectingGiftStore(false)
		setGiftAmount('')
		setGiftRecipient('')
		setGiftMessage('')
		setGiftStore(null)
		setGiftRecipientSelected(null)
		setGiftRecipientHits([])
		setGiftRecipientSearchLoading(false)
		setGiftRecipientSuggestOpen(true)
		setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		if (showGiftSheet) setGiftPayRecentRecipients(loadPayRecentRecipients())
	}, [showGiftSheet])

	const onPickGiftRecipientHit = useCallback((hit: searchResult) => {
		setGiftRecipientSelected(hit)
		const u = (hit.username || '').trim().toLowerCase()
		if (u && u !== 'unknow') setGiftRecipient(`@${u}`)
		else setGiftRecipient(hit.address)
		setGiftRecipientHits([])
		setGiftRecipientSuggestOpen(false)
		const prev = loadPayRecentRecipients()
		const next = [
			hit,
			...prev.filter((p) => (p.address || '').toLowerCase() !== (hit.address || '').toLowerCase()),
		]
		savePayRecentRecipients(next)
		setGiftPayRecentRecipients(next)
	}, [])

	useEffect(() => {
		if (!showGiftSheet) return
		const down = (e: MouseEvent) => {
			if (!giftRecipientSearchRef.current?.contains(e.target as Node)) {
				setGiftRecipientSuggestOpen(false)
			}
		}
		document.addEventListener('mousedown', down)
		return () => document.removeEventListener('mousedown', down)
	}, [showGiftSheet])

	useEffect(() => {
		if (!showGiftSheet) return
		if (giftRecipientSelected) return
		const q = giftRecipient.trim().replace(/^@/, '')
		if (q.length < 3) {
			setGiftRecipientHits([])
			setGiftRecipientSearchLoading(false)
			return
		}
		const t = window.setTimeout(() => {
			const seq = ++giftRecipientSearchSeq.current
			setGiftRecipientSearchLoading(true)
			void (async () => {
				try {
					const data = await searchUsername(q.toLowerCase())
					if (giftRecipientSearchSeq.current !== seq) return
					let rows: searchResult[] = data?.results ?? []
					const my = (
						profiles?.[0]?.aaAccount ||
						profiles?.[0]?.keyID ||
						''
					).toLowerCase()
					rows = rows.filter((n) => (n.address || '').toLowerCase() !== my)
					if (!rows.length && ethers.isAddress(q)) {
						rows = [makeGiftSearchAddressOnlyResult(q)]
					}
					setGiftRecipientHits(rows)
				} catch {
					if (giftRecipientSearchSeq.current === seq) setGiftRecipientHits([])
				} finally {
					if (giftRecipientSearchSeq.current === seq) setGiftRecipientSearchLoading(false)
				}
			})()
		}, 320)
		return () => window.clearTimeout(t)
	}, [giftRecipient, giftRecipientSelected, showGiftSheet, profiles?.[0]?.aaAccount, profiles?.[0]?.keyID])

	const giftCadAmount = parseFloat(giftAmount) || 0
	const giftCadPerUsdc = addCashTopUpCadPerUsdc
	const giftUsdcEquivalent = giftCadPerUsdc > 0 ? giftCadAmount / giftCadPerUsdc : 0
	let giftFeeUsdc = giftUsdcEquivalent * 0.008
	if (giftCadAmount > 0) {
		if (giftFeeUsdc < 0.02) giftFeeUsdc = 0.02
		if (giftFeeUsdc > 2) giftFeeUsdc = 2
	} else {
		giftFeeUsdc = 0
	}
	const totalGiftCostCad = giftCadAmount + giftFeeUsdc * giftCadPerUsdc

	const handleConfirmGift = useCallback(() => {
		const cadAmt = parseFloat(giftAmount) || 0
		if (!cadAmt || cadAmt <= 0) return
		const r = addCashTopUpCadPerUsdc
		if (!Number.isFinite(r) || r <= 0) return
		let fee = (r > 0 ? cadAmt / r : 0) * 0.008
		if (cadAmt > 0) {
			if (fee < 0.02) fee = 0.02
			if (fee > 2) fee = 2
		} else {
			fee = 0
		}
		const totalCad = cadAmt + fee * r
		const usdcCost = r > 0 ? totalCad / r : 0
		const source = giftStore
		const isStoreCard = Boolean(source && source.id !== 'usdc')

		if (isStoreCard && source && source.id !== 'usdc') {
			const card = source as HomeStoreCardRow
			if (card.balanceCad < totalCad) {
				window.alert('Insufficient store card balance.')
				return
			}
			setHomeStoreCards((prev) =>
				prev.map((c) => (c.id === card.id ? { ...c, balanceCad: c.balanceCad - totalCad } : c))
			)
			closeGiftSheet()
			return
		}
		if (usdcCost > addCashVaultUsdc) {
			window.alert('Insufficient USDC balance.')
			return
		}
		const payee =
			giftRecipientSelected ??
			(ethers.isAddress(giftRecipient.trim()) ? makeGiftSearchAddressOnlyResult(giftRecipient.trim()) : null)
		if (!payee?.address || !ethers.isAddress(payee.address)) {
			window.alert('Please select a recipient from search or enter a valid wallet address.')
			return
		}
		setGiftPayHandoffPayee(payee)
		setGiftPayPrefill({
			note: giftMessage.trim() || undefined,
			usdc: usdcCost.toFixed(6),
		})
		closeGiftSheet()
		setSettingsOpen('Pay')
		setShowFooter(false)
	}, [
		giftAmount,
		giftStore,
		giftRecipient,
		giftRecipientSelected,
		giftMessage,
		addCashTopUpCadPerUsdc,
		addCashVaultUsdc,
		closeGiftSheet,
		setShowFooter,
	])

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
							<img
								src={base_icon}
								alt="Base"
								className={[
									"w-5 h-5 object-contain",
									reflash ? "animate-spin opacity-80" : ""
								].join(" ")}
							/>
						</button>
						<span className="text-[15px] font-medium tracking-wide">
							USDC on Base
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
											<img
												src={usdcIcon}
												alt="USDC"
												className="w-5 h-5 rounded-full"
											/>
											<img
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
									onClick={handleAddFunds}
									className="
										flex-1 flex items-center justify-center gap-1.5
										py-3 rounded-full
										bg-white/15
										text-[10px] font-medium text-white
										hover:bg-white/20 transition
									"
								>
									<PlusCircle className="h-4 w-4 text-white/90" />
									<span>Add funds</span>
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
									<span>Cash out</span>
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
					className="flex-1 h-9 rounded-full bg-white text-sm font-semibold text-blue-600 shadow-md"
					onClick={() => {
						setShowAlphaHowItWorks('Pay')
					}}
				>
					Send
				</button>
				<button
					className="flex-1 h-9 rounded-full border border-blue-600 text-sm font-semibold text-blue-600 bg-white/10 shadow-md"
					onClick={() => {
						setPayTag('request')
						navigate('/Pay')
					}}
				>
					Request
				</button>
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
							setShowAlphaHowItWorks('Search')
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


	/** Home 主视觉：浅灰底 + 青柠强调（与产品 mock 对齐） */
	const homeAccent = '#7ED321'

	const userBeamioTagDisplay = useMemo(
		() => `@${(beamio?.accountName || '').replace(/^@/, '') || 'beamio'}`,
		[beamio?.accountName]
	)

	/** CashTrees 卡片区：AA 短地址；Total = Oracle 牌价 USDC→CAD + 基础设施卡 POINTS_ID（#0） */
	const cashTreesCardDisplay = useMemo(() => {
		const aaFull = (profiles?.[0]?.aaAccount ?? '').trim()
		const d = currencyData as { USDC?: number; CAD?: number } | undefined
		const usdcRate = Number(d?.USDC) > 0 ? Number(d?.USDC) : 1
		const cadPerUsd = Number(d?.CAD) > 0 ? Number(d?.CAD) : 1.35
		const usdcHuman = Number(cashTreesWalletSnapshot?.aaUsdc ?? '0')
		const safeUsdc = Number.isFinite(usdcHuman) ? Math.max(0, usdcHuman) : 0
		const cadFromUsdc = safeUsdc * usdcRate * cadPerUsd
		const ptsHuman = Number(cashTreesWalletSnapshot?.points0 ?? '0')
		const safePts = Number.isFinite(ptsHuman) ? Math.max(0, ptsHuman) : 0
		const totalCad = cadFromUsdc + safePts
		const [whole, frac = '00'] = totalCad.toFixed(2).split('.')
		return { aaFull, aaShort: fmtAddr(aaFull), whole, frac, isPhysicalCardBound: linkedNfcCards.length > 0 }
	}, [profiles?.[0]?.aaAccount, currencyData, cashTreesWalletSnapshot, linkedNfcCards.length])

	/** 链上/后端「已关联实体卡」；以 listLinkedNfcCards 为准。 */
	const cashTreesPhysicalCardBoundEffective = cashTreesCardDisplay.isPhysicalCardBound

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
			const e = typeof sun?.e === 'string' ? sun.e.trim() : ''
			const c = typeof sun?.c === 'string' ? sun.c.trim() : ''
			const m = typeof sun?.m === 'string' ? sun.m.trim() : ''
			if (e.length !== 64 || c.length !== 6 || m.length !== 16) {
				setCashTreesNfcOverlay({
					phase: 'error',
					errorMsg:
						'This card does not support secure link. Missing or invalid SUN data (e, c, m).',
					ndefUri: typeof d.ndefUri === 'string' ? d.ndefUri : undefined,
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
					cardAddress: BEAMIO_USER_CARD_ASSET_ADDRESS,
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
					},
					...base,
				})
				if (profile) {
					void getMyAssets(profile, BEAMIO_USER_CARD_ASSET_ADDRESS)
						.then((res) => {
							if (!res) return
							setCashTreesWalletSnapshot({
								aaUsdc: res.usdcBalance ?? '0',
								points0: res.points ?? '0',
							})
						})
						.catch(() => {})
					void refreshLinkedNfcCards()
				}
			})()
		}
		window.addEventListener('cashtreesnfc', onNfc)
		return () => window.removeEventListener('cashtreesnfc', onNfc)
	}, [profiles, refreshLinkedNfcCards])

	const startCashTreesPhysicalCardBind = () => {
		const native = getCashTreesNativeNfcBridge()
		if (native?.startPhysicalCardBind) {
			cashTreesNfcReq.current++
			setCashTreesNfcOverlay({ phase: 'tap' })
			try {
				native.startPhysicalCardBind()
			} catch {
				setCashTreesNfcOverlay({ phase: 'hidden' })
			}
			return
		}
		navigate('/myWallet')
	}

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
		setCashTreesSheetAaUsdc(null)
		setCashTreesSheetPoints0(null)
		getMyAssets(profile, BEAMIO_USER_CARD_ASSET_ADDRESS)
			.then((res) => {
				if (cancelled) return
				setCashTreesSheetAaUsdc(res?.usdcBalance ?? '0')
				setCashTreesSheetPoints0(res?.points ?? '0')
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

	const closePayReceiveSheet = () => {
		setShowPayReceiveSheet(false)
		setPayReceiveQrMode('receive')
		setPayRelayQRPayload(null)
		setPayRelayQRLoading(false)
		setShowFooter(true)
	}

	/** Pay tab：生成 / 每分钟刷新 Open Relay QR（与 MyWalletDashboardNew handleAaRelayQR 一致） */
	useEffect(() => {
		if (!showPayReceiveSheet || payReceiveQrMode !== 'pay') return
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor || !profile?.aaAccount) {
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
			return
		}
		let cancelled = false
		let intervalId: number | undefined

		const signOnce = async (isInitial: boolean) => {
			if (isInitial) {
				setPayRelayQRLoading(true)
				setPayRelayQRPayload(null)
			}
			try {
				const payload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(
					{ privateKeyArmor: profile.privateKeyArmor, aaAccount: profile.aaAccount },
					'0',
					{ deadlineSeconds: 300 }
				)
				if (!cancelled) setPayRelayQRPayload(payload)
			} catch (e) {
				console.error('[Home] signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen failed:', e)
				if (isInitial && !cancelled) setPayRelayQRPayload(null)
			} finally {
				if (isInitial && !cancelled) setPayRelayQRLoading(false)
			}
		}

		void signOnce(true)
		intervalId = window.setInterval(() => void signOnce(false), 60_000)

		return () => {
			cancelled = true
			if (intervalId) clearInterval(intervalId)
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
		}
	}, [showPayReceiveSheet, payReceiveQrMode, profiles?.[0]?.privateKeyArmor, profiles?.[0]?.aaAccount])

	/** Android WebView：Activate 场景下外层 overflow-hidden + flex 常导致滚动视口高度塌成一条；改为单层 flex 链并写死 flex-basis */
	const homeScrollUsesSingleFlexChain = showActivateWalletPanel && !openSearch

	return (
		<div
			className="
		box-border flex h-full min-h-[100vh] w-full flex-col bg-[#F1F8ED] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-slate-900
		"
		>
			{/* <div className="px-5 pt-6 flex flex-col gap-2">
				<button
					type="button"
							className={styles.headerBtn}
							aria-label="Toggle theme"
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
					className="pointer-events-none fixed left-4 right-4 z-30 flex items-center justify-between transition-opacity duration-300"
					style={{
						top: 'max(1rem, env(safe-area-inset-top))',
						opacity: capsuleOpacity,
					}}
				>
					<button
						type="button"
						onClick={() => navigate('/myWallet')}
						className="flex items-center justify-start"
						style={{ pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
						aria-label="Open wallet"
					>
						<div className="flex items-center gap-2.5 rounded-full border border-slate-100/90 bg-white py-2 pl-2 pr-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition-transform group active:scale-[0.98] dark:border-slate-700/80 dark:bg-slate-800">
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white"
								style={{ backgroundColor: homeAccent }}
							>
								{beamio?.image ? (
									<img
										src={beamio.image}
										alt={beamio.accountName}
										className="h-full w-full object-cover"
										draggable={false}
									/>
								) : (
									<span className="leading-none">
										{(beamio?.accountName || 'B').replace(/^@/, '').charAt(0).toUpperCase() || '?'}
									</span>
								)}
							</div>
							<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
								@{beamio?.accountName?.replace(/^@/, '') || 'Beamio'}
							</span>
						</div>
					</button>
					{hasAAWallet ? (
						<button
							type="button"
							onClick={openCardManagement}
							className="flex items-center justify-end"
							style={{ pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
							aria-label="NFC cards"
						>
							<div className="relative flex items-center justify-center rounded-full border border-slate-100/90 bg-white py-2 pl-2.5 pr-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition-transform group active:scale-[0.98] dark:border-slate-700/80 dark:bg-slate-800">
								<SlidersHorizontal
									className="h-5 w-5 shrink-0 text-[#0F172A] dark:text-slate-100"
									strokeWidth={2.2}
									aria-hidden
								/>
								{linkedNfcCards.length > 0 && (
									<span
										className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#65A30D] dark:border-slate-800"
										aria-hidden
									/>
								)}
							</div>
						</button>
					) : (
						<span className="pointer-events-none w-0 shrink-0" aria-hidden />
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
							{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离 */}
							<div
								className="shrink-0"
								style={{ minHeight: 'calc(env(safe-area-inset-top, 0px) + 5rem)' }}
							/>

							{/* Content — 浅底、白卡片、青柠强调 */}
							<div className="space-y-8 px-5 pt-4">
							{showActivateWalletPanel ? (
								<div className="px-1 pt-2 pb-4">
									{/* WebView：isolate 限制叠层；避免负 z-index 在部分 WebView 下吞掉后续兄弟节点绘制 */}
									<div className="relative isolate flex flex-col items-center rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
											Action Required
										</div>
										<h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 text-center tracking-tight">
											Activate Wallet
										</h2>
										<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center leading-relaxed">
											Your app is currently in EOA mode. Load cash or sync a card to deploy your Smart Account.
										</p>

										<div className="w-full bg-gray-50 dark:bg-slate-800/80 rounded-3xl p-5 mb-4 border border-gray-200 dark:border-slate-600 flex flex-col items-center">
											<span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
												<Store size={14} aria-hidden /> Option 1: Store Deposit
											</span>
											<div
												className="mb-3 flex flex-col items-center justify-center w-full max-w-[min(100%,280px)] select-none"
												role="img"
												aria-label="Store deposit payment QR code. Show to cashier to scan."
											>
												{/* 与 BeamioPayMe EOA 收款 QR 同款：仅展示，不触发 Pay Me 底栏 */}
												<div className="mt-1 flex w-full justify-center">
													<div className="relative">
														<div
															aria-hidden
															className="pointer-events-none absolute inset-[-8px] z-0 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.22),rgba(132,120,255,0.06)_55%,transparent_72%)] opacity-90"
														/>
														<div className="relative z-10 flex justify-center">
															<div
																className="
																	rounded-[20px] bg-white
																	p-2
																	shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
																	border-2 border-[#96EB3C]
																"
															>
																{activateWalletEoaQrValue ? (
																	<QRCodeCanvas
																		value={activateWalletEoaQrValue}
																		size={180}
																		level="H"
																		includeMargin={false}
																		bgColor="#ffffff"
																		fgColor="#000000"
																		imageSettings={{
																			src: bIcon,
																			height: 56,
																			width: 56,
																			excavate: true,
																		}}
																		className="block"
																	/>
																) : (
																	<div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-gray-400 text-center px-4">
																		Loading payment link…
																	</div>
																)}
															</div>
														</div>
													</div>
												</div>
											</div>
											<div className="flex items-center gap-1.5 bg-gray-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-md mb-2 max-w-full">
												<span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono font-semibold truncate">
													EOA: {eoaAddressShort}
												</span>
											</div>
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center font-medium">
												Show QR to cashier to load cash.
											</p>
										</div>

										<button
											type="button"
											className="w-full bg-gray-50 dark:bg-slate-800/80 hover:bg-[#96EB3C]/10 dark:hover:bg-[#96EB3C]/15 transition-colors rounded-3xl p-5 border border-gray-200 dark:border-slate-600 flex flex-col items-center cursor-pointer group text-left"
										>
											<span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
												<CreditCard size={14} aria-hidden /> Option 2: Got a Card?
											</span>
											<div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-2 shadow-sm border border-gray-100 dark:border-slate-600 group-hover:scale-110 transition-transform">
												<Radio size={20} className="text-[#65A30D]" aria-hidden />
											</div>
											<p className="text-sm font-bold text-gray-900 dark:text-slate-100">Sync NFC Card</p>
											<p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Tap funded card to phone.</p>
										</button>
									</div>
								</div>
							) : (
								<>
							{/* CashTrees 卡（对齐 renderAction index 199–266） */}
							<div className="pt-2 pb-2">
								<div
									role="button"
									tabIndex={0}
									onClick={openCashTreesBalanceSheet}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											openCashTreesBalanceSheet()
										}
									}}
									className="relative bg-gradient-to-br from-[#8AE131] to-[#67AD0F] dark:from-[#6fb828] dark:to-[#4f9410] rounded-[2rem] p-6 text-gray-900 shadow-xl shadow-[#96EB3C]/20 dark:shadow-[#65A30D]/15 overflow-hidden transform transition-transform hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer border border-[#96EB3C]/40 dark:border-[#65A30D]/50"
								>
									<div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />

									<div className="flex justify-between items-center mb-8 relative z-10">
										<div className="flex items-center min-w-0">
											<img
												src={`${process.env.PUBLIC_URL ?? ''}/logo512.png`}
												alt="CashTrees"
												className="w-[4.5rem] h-[4.5rem] mr-3 shrink-0 object-contain"
												draggable={false}
											/>
											<div className="flex flex-col items-start justify-center min-w-0">
												<span className="font-extrabold text-[22px] tracking-tight text-gray-900 leading-none mb-1.5">CashTrees</span>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														void copyCashTreesAaAddress()
													}}
													disabled={!cashTreesCardDisplay.aaFull}
													className="flex items-center gap-1.5 bg-gray-900/10 border border-gray-900/5 px-2 py-0.5 rounded-md shadow-sm hover:bg-gray-900/20 transition-colors max-w-full disabled:opacity-50"
													aria-label="Copy Smart Account address"
												>
													<span className="text-[10px] text-gray-800 font-mono tracking-widest font-semibold uppercase truncate">
														{cashTreesCardDisplay.aaShort}
													</span>
													{aaAddrCopied ? (
														<Check size={10} className="text-gray-800 shrink-0" strokeWidth={3} aria-hidden />
													) : (
														<Copy size={10} className="text-gray-700 shrink-0" aria-hidden />
													)}
												</button>
											</div>
										</div>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												openCashTreesBalanceSheet()
											}}
											className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center text-gray-900 backdrop-blur-sm border border-gray-900/5 hover:bg-gray-900/20 transition-colors shadow-sm shrink-0"
											aria-label="Balance details"
										>
											<Info size={16} strokeWidth={2.5} aria-hidden />
										</button>
									</div>

									<div className="relative z-10 flex justify-between items-end gap-3">
										<div className="min-w-0">
											<p className="text-sm text-gray-800 font-bold mb-0.5 opacity-90 tracking-wide">
												Total Balance
											</p>
											<div className="flex items-baseline flex-wrap">
												<span className="text-3xl font-bold mr-1 opacity-80">CA$</span>
												<p className="text-[44px] font-extrabold tracking-tighter text-gray-900 leading-none">
													{cashTreesCardDisplay.whole}
													<span className="text-3xl font-bold text-gray-800/80">.{cashTreesCardDisplay.frac}</span>
												</p>
											</div>
										</div>

										<div className="flex items-center bg-gray-900/10 backdrop-blur-md border border-gray-900/5 px-3 py-1.5 rounded-full shadow-sm mb-1.5 shrink-0">
											<div className="relative flex h-2 w-2 mr-2">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
												<span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
											</div>
											<span className="text-[10px] font-bold text-gray-900 tracking-wider uppercase">
												{cashTreesPhysicalCardBoundEffective ? 'Card Linked' : 'Virtual Active'}
											</span>
										</div>
									</div>
								</div>

								{!cashTreesPhysicalCardBoundEffective && cashTreesNativeNfcStatus === 'permission_denied' && (
									<p className="text-center text-[11px] text-amber-700 dark:text-amber-400 mt-3 px-4 font-medium">
										{getCashTreesNativeNfcHost() === 'ios'
											? 'NFC could not be enabled for this build. Install the latest CashTrees app from the App Store.'
											: 'NFC requires an app update. Please install the latest CashTrees build from the store.'}
									</p>
								)}
								{!cashTreesPhysicalCardBoundEffective && cashTreesNativeNfcStatus === 'ready' && (
									<div className="flex justify-center mt-4 animate-in zoom-in-95 duration-300">
										<button
											type="button"
											onClick={() => startCashTreesPhysicalCardBind()}
											className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-full shadow-sm border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:text-[#65A30D] dark:hover:text-[#9AE66E] hover:border-[#96EB3C]/50 transition-all active:scale-95"
										>
											<Plus size={14} strokeWidth={2.5} aria-hidden />
											<Radio size={14} aria-hidden />
											<span className="text-[12px] font-bold uppercase tracking-wider ml-0.5">Bind Physical Card</span>
										</button>
									</div>
								)}
							</div>

							{/* My Store Cards — 与 beamio.app renderAction 同结构：不外扩 -mx，左右与外层 px-5 对齐；末卡右侧留 pr */}
							<div className="mt-2 mb-1">
								<div className="flex justify-between items-center mb-3">
									<h2 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
										My Store Cards ({homeStoreCards.length})
									</h2>
								</div>
								<div className="flex overflow-x-auto hide-scrollbar gap-4 pb-3 snap-x pr-5">
									{homeStoreCards.map((card) => {
										const IconComponent = card.icon
										return (
											<div
												key={card.id}
												role="button"
												tabIndex={0}
												onClick={() => setSelectedHomeStoreCard(card)}
												onKeyDown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault()
														setSelectedHomeStoreCard(card)
													}
												}}
												className={`snap-start min-w-[240px] bg-gradient-to-br ${card.color} rounded-[1.5rem] p-5 shadow-md border ${card.borderColor} relative overflow-hidden flex-shrink-0 cursor-pointer hover:-translate-y-1 transition-transform`}
											>
												<div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl" />
												<div className="flex justify-between items-start mb-6 relative z-10">
													<div>
														<h3 className="text-white font-bold text-lg leading-tight mb-1">{card.name}</h3>
														<div className={`flex items-center gap-1 ${card.bgColor} ${card.iconColor} px-2 py-0.5 rounded-md w-max`}>
															<IconComponent size={10} aria-hidden />
															<span className="text-[10px] font-bold uppercase tracking-wider text-white">{card.type}</span>
														</div>
													</div>
												</div>
												<div className="relative z-10">
													<p className="text-gray-300 text-xs font-medium mb-0.5">Store Balance (CAD)</p>
													<p className="text-2xl font-extrabold text-white tracking-tight">${card.balanceCad.toFixed(2)}</p>
												</div>
											</div>
										)
									})}
									<div
										role="button"
										tabIndex={0}
										onClick={() => navigate('/Browser')}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault()
												navigate('/Browser')
											}
										}}
										className="snap-start min-w-[120px] bg-gray-50 dark:bg-slate-800/80 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-[1.5rem] flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-[#65A30D] dark:hover:text-[#9AE66E] hover:border-[#65A30D] transition-colors cursor-pointer flex-shrink-0"
									>
										<Plus size={24} className="mb-2" aria-hidden />
										<span className="text-xs font-bold uppercase tracking-wider">Discover</span>
									</div>
								</div>
							</div>

							{/* Add Cash | Gift Card | Pay / Scan — 对齐 beamio.app renderAction */}
							<div className="flex gap-3">
								<button
									type="button"
									onClick={handleAddFunds}
									className="flex-1 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/80 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100 dark:border-slate-600 group"
								>
									<div className="w-12 h-12 bg-[#96EB3C] rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(150,235,60,0.4)]">
										<ArrowDownToLine size={24} className="text-gray-900" />
									</div>
									<span className="font-semibold text-[11px] text-gray-700 dark:text-slate-300 tracking-wide uppercase">Add Cash</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setShowGiftSheet(true)
										setShowFooter(false)
									}}
									className="flex-1 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/80 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100 dark:border-slate-600 group relative overflow-hidden"
								>
									<div className="absolute top-0 right-0 w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full -mr-4 -mt-4 blur-xl opacity-60" />
									<div className="w-12 h-12 bg-pink-50 dark:bg-pink-950/50 rounded-full flex items-center justify-center text-pink-500 border border-pink-100 dark:border-pink-800/50 relative z-10">
										<Gift size={22} className="group-hover:scale-110 transition-transform duration-300" />
									</div>
									<span className="font-semibold text-[11px] text-gray-700 dark:text-slate-300 tracking-wide uppercase relative z-10">Gift Card</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setPayReceiveQrMode('pay')
										setShowPayReceiveSheet(true)
										setShowFooter(false)
									}}
									className="flex-1 bg-gray-900 dark:bg-gray-950 hover:bg-gray-800 dark:hover:bg-black active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-xl shadow-gray-900/20"
								>
									<div className="w-12 h-12 bg-gray-800 dark:bg-gray-800 rounded-full flex items-center justify-center text-white border border-gray-700 dark:border-gray-600">
										<Scan size={20} />
									</div>
									<span className="font-semibold text-[11px] text-white tracking-wide uppercase">Pay / Scan</span>
								</button>
							</div>


							{show200OK && (
								<div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100">
									<p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Beamio Alpha Reward</p>
									<h4 className="font-bold text-gray-900">You've claimed 0.1 USDC</h4>
									<p className="mt-1 text-[11px] text-gray-500 leading-snug">
										Thank you for testing Beamio on Base. Your Beamio wallet has been funded with{" "}
										<span className="font-semibold text-gray-900">0.1 USDC</span> so you can try your first gasless payment.
									</p>
								</div>
							)}

							{/* Recent Activity - 与 Total Valuation、Send/Receive 同层级，左右边距统一 px-5；bare 无外层圆角/边框/边距，内部控件与上方对齐 */}
							<ActiveHistoryPannelNew
								title="Recent Activity"
								compact
								compactLimit={5}
								bare
								sectionTitleClassName="text-base font-bold text-[#0F172A] dark:text-slate-100 tracking-tight"
								viewAllClassName="text-[#7ED321] hover:text-[#6bc11a]"
							/>
								</>
							)}
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
										aria-label="Close"
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
										aria-label="Close"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<p className="text-sm text-gray-500 dark:text-slate-400 mb-2">Store Balance (CAD)</p>
								<p className="text-3xl font-extrabold text-[#0F172A] dark:text-slate-100 mb-6">${selectedHomeStoreCard.balanceCad.toFixed(2)}</p>
								<button
									type="button"
									onClick={() => {
										setSelectedHomeStoreCard(null)
										navigate('/Browser')
									}}
									className="w-full py-3.5 rounded-2xl bg-[#96EB3C] text-[#0F172A] font-bold hover:bg-[#8ad936] active:scale-[0.99] transition-transform"
								>
									View in Discover
								</button>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body,
			)}

			{/* CashTrees 卡：Balance Details（链上 AA USDC + 基础设施卡 points / token #0，对齐 renderAction 1082–1131） */}
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
								className="relative z-10 w-full max-h-[85dvh] pointer-events-auto bg-[#F1F8ED] dark:bg-slate-900 rounded-t-[2.5rem] p-6 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-200/80 dark:border-slate-700 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto overscroll-contain"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mb-6 shrink-0" />

								<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">Balance Details</h3>
								<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center">AA USDC and infrastructure card (token #0) balance</p>

								{cashTreesBalanceLoading && (
									<div className="flex flex-col items-center justify-center py-10 gap-3 mb-4">
										<Loader2 className="w-10 h-10 text-[#65A30D] animate-spin" aria-hidden />
										<span className="text-sm text-gray-500 dark:text-slate-400">Loading balances…</span>
									</div>
								)}

								{cashTreesBalanceError && !cashTreesBalanceLoading && (
									<p className="text-sm text-amber-600 dark:text-amber-400 text-center mb-6">{cashTreesBalanceError}</p>
								)}

								{!cashTreesBalanceLoading && !cashTreesBalanceError && (
									<div className="w-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col mb-8">
										{/* 1：AA 钱包 USDC（getMyAssets 内对 aaAccount 的 USDC balanceOf） */}
										<div className="p-4 flex items-center justify-between border-b border-gray-100/50 dark:border-slate-700">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-slate-600 shrink-0 relative">
													<div className="relative w-7 h-7 shrink-0">
														<img src={usdcIcon} alt="" className="block w-7 h-7 rounded-full object-contain" />
														<img src={baseIcon} alt="" className="block w-4 h-4 absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white" />
													</div>
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">AA Wallet (USDC)</span>
													<span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Smart Account on Base</span>
												</div>
											</div>
											<div className="text-right shrink-0 pl-2">
												<span className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCashTreesUsd2(cashTreesSheetAaUsdc)}</span>
											</div>
										</div>

										{/* 2：基础设施卡 token #0 / points（合约 points 余额，与 getMyAssets.points 一致） */}
										<div className="p-4 flex items-center justify-between bg-gradient-to-r from-[#96EB3C]/15 to-transparent dark:from-[#65A30D]/20 dark:to-transparent">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-[#96EB3C]/30 dark:border-[#65A30D]/40 text-lg shrink-0" aria-hidden>
													🌳
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">Infrastructure Card</span>
													<span className="text-[10px] text-[#65A30D] dark:text-[#9AE66E] font-bold uppercase tracking-wider mt-0.5">Eligible for Store Discounts</span>
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
									className="w-full py-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-[0.98] text-gray-900 dark:text-slate-100 rounded-2xl font-bold transition-all shadow-sm border border-gray-200 dark:border-slate-600 shrink-0"
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
									cashTreesNfcOverlay.phase === 'fetch' ? 'cursor-default' : 'cursor-pointer'
								} bg-gray-900/45 dark:bg-black/55 backdrop-blur-md`}
								aria-label="Dismiss"
								onClick={() => {
									if (cashTreesNfcOverlay.phase !== 'fetch') {
										cancelCashTreesNfcBind()
									}
								}}
							/>
							<div className="relative z-10 w-full max-w-[300px] rounded-[2rem] border-2 border-[#96EB3C]/45 dark:border-[#65A30D]/50 bg-white dark:bg-slate-900 shadow-xl shadow-[#96EB3C]/15 overflow-hidden min-h-[280px] flex flex-col">
								{(cashTreesNfcOverlay.phase === 'tap' || cashTreesNfcOverlay.phase === 'fetch') && (
									<>
										<div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-6 min-h-[220px]">
											<div className="absolute inset-3 border-2 border-[#96EB3C]/25 rounded-[1.65rem] pointer-events-none" />
											{cashTreesNfcOverlay.phase === 'tap' ? (
												<>
													<Nfc
														className="w-[7.5rem] h-[7.5rem] text-gray-200 dark:text-slate-700 mb-4"
														strokeWidth={1.25}
														aria-hidden
													/>
													<p className="text-xs text-gray-500 dark:text-slate-400 text-center font-medium leading-relaxed">
														Hold the CashTrees NTAG card near the NFC sensor on your phone.
													</p>
												</>
											) : (
												<>
													<Loader2
														className="w-16 h-16 text-[#65A30D] dark:text-[#9AE66E] animate-spin mb-4"
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
										<div className="p-4 pt-2">
											<button
												type="button"
												onClick={() => cancelCashTreesNfcBind()}
												className="w-full py-3.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 active:scale-[0.98] text-gray-900 dark:text-slate-100 rounded-full font-bold text-sm border border-gray-200 dark:border-slate-600"
											>
												Cancel
											</button>
										</div>
									</>
								)}
								{cashTreesNfcOverlay.phase === 'result' && cashTreesNfcOverlay.linkResult != null && (
									<div className="flex flex-col p-6 pb-5">
										<div className="flex flex-col items-center mb-5">
											<div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
												<Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
											</div>
											<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight text-center">
												Physical card linked
											</h3>
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center mt-2 leading-relaxed px-1">
												This NFC tag is now bound to your CashTrees wallet. Your home balance will refresh
												shortly.
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
											className="w-full py-3.5 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] dark:from-[#6fb828] dark:to-[#4f9410] text-gray-900 font-bold rounded-full shadow-md border border-[#96EB3C]/40"
										>
											Done
										</button>
									</div>
								)}
								{cashTreesNfcOverlay.phase === 'error' && (
									<div className="flex flex-col p-6">
										<p className="text-sm text-amber-700 dark:text-amber-400 text-center font-semibold mb-2">
											{cashTreesNfcOverlay.errorMsg ?? 'Something went wrong'}
										</p>
										{cashTreesNfcOverlay.ndefUri ? (
											<p className="text-[10px] text-gray-400 text-center break-all line-clamp-3 mb-4" title={cashTreesNfcOverlay.ndefUri}>
												{cashTreesNfcOverlay.ndefUri}
											</p>
										) : (
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-4">
												Tap retry after checking NFC and try again.
											</p>
										)}
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
								aria-label="Close"
								onClick={() => setShowCardManagementModal(false)}
							/>
							<motion.div
								className="pointer-events-auto relative z-10 mt-auto flex max-h-[85dvh] flex-col overflow-y-auto overscroll-contain rounded-t-[2.5rem] bg-[#F1F8ED] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:bg-slate-900 dark:shadow-[0_-10px_40px_rgba(0,0,0,0.35)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto mb-6 h-1.5 w-12 shrink-0 rounded-full bg-gray-300 dark:bg-slate-600" />
								<div className="mb-6 flex items-center justify-between gap-2">
									<h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">NFC Cards</h3>
									<button
										type="button"
										onClick={() => setShowCardManagementModal(false)}
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-base font-bold text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
										aria-label="Close"
									>
										✕
									</button>
								</div>
								<p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
									Manage your linked physical keys. Only one card can be active at a time to prevent conflicts.
								</p>
								{linkedNfcListLoading && linkedNfcCards.length === 0 && (
									<div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
										<Loader2 className="h-4 w-4 animate-spin text-[#65A30D]" aria-hidden />
										Loading linked cards…
									</div>
								)}
								{cardMgmtError && (
									<p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
										{cardMgmtError}
									</p>
								)}
								<div className="mb-auto space-y-3">
									{linkedNfcCards.map((card) => (
										<div
											key={card.id}
											className={`flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all dark:bg-slate-800 ${
												card.isPrimaryUi && card.linkState === 'active'
													? 'border-[#96EB3C] dark:border-[#65A30D]'
													: 'border-gray-100 dark:border-slate-600'
											}`}
										>
											<div className="flex min-w-0 items-center">
												<div
													className={`mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
														card.linkState === 'active'
															? 'bg-[#96EB3C]/20 text-[#65A30D] dark:bg-[#65A30D]/25 dark:text-[#9AE66E]'
															: 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
													}`}
												>
													<Radio size={18} aria-hidden />
												</div>
												<div className="min-w-0">
													<h4 className="font-bold text-gray-900 dark:text-slate-100">CashTrees Card</h4>
													<p className="font-mono text-xs text-gray-500 dark:text-slate-400">•••• {card.last4}</p>
													{card.linkState === 'deactive' && (
														<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
															Paused on server
														</p>
													)}
												</div>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												{card.linkState === 'deactive' && (
													<button
														type="button"
														onClick={() => void enableLinkedNfcOnServer(card.tagId)}
														disabled={nfcLinkActionTagId !== null}
														className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
													>
														{nfcLinkActionTagId === card.tagId ? (
															<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
														) : (
															'Enable'
														)}
													</button>
												)}
												{card.linkState === 'active' && !card.isPrimaryUi && (
													<button
														type="button"
														onClick={() => setLinkedNfcPrimaryById(card.id)}
														disabled={nfcLinkActionTagId !== null}
														className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
													>
														Activate
													</button>
												)}
												{card.linkState === 'active' && card.isPrimaryUi && (
													<span className="flex items-center gap-1 rounded-lg bg-[#96EB3C]/20 px-3 py-1.5 text-xs font-bold text-[#65A30D] dark:bg-[#65A30D]/25 dark:text-[#9AE66E]">
														<CheckCircle2 size={14} aria-hidden /> Active
													</span>
												)}
												<button
													type="button"
													onClick={() => void removeLinkedNfcOnServer(card.tagId)}
													disabled={nfcLinkActionTagId !== null}
													className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
													aria-label="Remove card link"
												>
													{nfcLinkActionTagId === card.tagId ? (
														<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
													) : (
														<Trash2 size={16} aria-hidden />
													)}
												</button>
											</div>
										</div>
									))}
									{!linkedNfcListLoading && linkedNfcCards.length === 0 && (
										<div className="rounded-2xl border border-dashed border-gray-100 bg-white py-10 text-center dark:border-slate-700 dark:bg-slate-800">
											<Smartphone size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" aria-hidden />
											<p className="text-sm font-medium text-gray-400 dark:text-slate-500">No physical cards linked.</p>
										</div>
									)}
								</div>
								<button
									type="button"
									onClick={() => {
										setShowCardManagementModal(false)
										startCashTreesPhysicalCardBind()
									}}
									className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 font-bold text-white shadow-md transition-all hover:bg-gray-800 active:scale-[0.98] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
								>
									<Plus size={20} aria-hidden />
									Bind Another Card
								</button>
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
								className="fixed inset-0 z-[10020] bg-gray-900/40 dark:bg-black/50 backdrop-blur-sm"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closePayReceiveSheet}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[10021] bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[90dvh] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 32, stiffness: 320 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mt-4 mb-2 shrink-0" />
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-6 pb-4">
									<div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-full mb-6 w-full max-w-[240px] mx-auto shadow-inner">
										<button
											type="button"
											onClick={() => setPayReceiveQrMode('pay')}
											className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
												payReceiveQrMode === 'pay'
													? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-slate-100'
													: 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
											}`}
										>
											Pay
										</button>
										<button
											type="button"
											onClick={() => setPayReceiveQrMode('receive')}
											className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
												payReceiveQrMode === 'receive'
													? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-slate-100'
													: 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
											}`}
										>
											Receive
										</button>
									</div>

									{payReceiveQrMode === 'pay' ? (
										<div className="flex flex-col items-center w-full min-h-[min(460px,55dvh)]">
											<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1 tracking-tight text-center">
												Pay with {userBeamioTagDisplay}
											</h3>
											<p className="text-sm text-gray-500 dark:text-slate-400 mb-4 text-center">
												Show this code to cashier to pay.
											</p>
											<div className="w-full flex flex-col items-center mb-4">
												{payRelayQRLoading && !payRelayQRPayload && (
													<div className="flex flex-col items-center justify-center py-10 gap-3">
														<Loader2 className="w-10 h-10 text-[#65A30D] animate-spin" aria-hidden />
														<span className="text-sm text-gray-500 dark:text-slate-400">Generating pay code...</span>
													</div>
												)}
												{payRelayQRPayload && (
													<ShowPayQR
														successUrl={'https://beamio.app?beamio=' + (beamio?.accountName ?? '')}
														beamio={beamio ?? null}
														qrValue={JSON.stringify({
															...payRelayQRPayload,
															validBefore: payRelayQRPayload.deadline,
														})}
														hideActions
														hideUrl
														hideName
													/>
												)}
												{!payRelayQRLoading && !payRelayQRPayload && (
													<p className="text-sm text-center text-amber-600 dark:text-amber-400 px-4 max-w-sm">
														{!profiles?.[0]?.aaAccount
															? 'Smart Account required to show pay QR.'
															: 'Could not generate pay code. Close and try again.'}
													</p>
												)}
											</div>
											<div className="flex items-center gap-2 mb-6">
												<div className="w-2 h-2 bg-[#65A30D] rounded-full animate-pulse" />
												<span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
													Auto-refreshes every minute
												</span>
											</div>
											<button
												type="button"
												onClick={closePayReceiveSheet}
												className="mt-auto w-full rounded-full border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-4 font-bold text-gray-900 shadow-md shadow-[#96EB3C]/25 transition-all hover:opacity-95 active:scale-[0.98] dark:border-[#65A30D]/50 dark:from-[#6fb828] dark:to-[#4f9410] dark:shadow-[#65A30D]/20"
											>
												Done
											</button>
										</div>
									) : (
										<div className="w-full flex flex-col min-h-[min(460px,55dvh)]">
											{/* Receive：与 BeamioPayMe / Alliance PayMe 一致（AmountCurrency、备注、Valid for days、requestAccounting、B-Unit 摘要） */}
											<div className="w-full max-w-[540px] mx-auto px-0">
												<BeamioPayMe
													showActiveTab={false}
													hideOuterFrame
													hideEoaReceivingToggle
													hideReceivingWalletHeading
													receivePanelLimeButtons
													onClose={closePayReceiveSheet}
													onShowFuelCenter={() => {
														closePayReceiveSheet()
														setShowFuelView(true)
													}}
												/>
											</div>
											<button
												type="button"
												onClick={closePayReceiveSheet}
												className="mt-4 w-full shrink-0 rounded-full border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-4 font-bold text-gray-900 shadow-md shadow-[#96EB3C]/25 transition-all hover:opacity-95 active:scale-[0.98] dark:border-[#65A30D]/50 dark:from-[#6fb828] dark:to-[#4f9410] dark:shadow-[#65A30D]/20"
											>
												Done
											</button>
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
										aria-label="Close"
									>
										<X className="w-5 h-5" />
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
												<h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-3 px-1">Funding Source</h4>
												<button
													type="button"
													onClick={() => setAddCashMode('store_qr')}
													className="w-full text-left bg-white dark:bg-slate-800/80 border border-[#96EB3C]/50 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-[#96EB3C]/10 dark:hover:bg-[#96EB3C]/15 active:scale-[0.98] transition-all relative overflow-hidden group"
												>
													<div className="absolute top-0 right-0 w-24 h-24 bg-[#96EB3C]/20 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-[#96EB3C]/30 transition-colors" />
													<div className="flex items-center relative z-10">
														<div className="w-10 h-10 bg-[#96EB3C] rounded-xl flex items-center justify-center mr-3 shadow-sm">
															<Store className="text-gray-900" size={20} />
														</div>
														<div>
															<p className="font-bold text-gray-900 dark:text-slate-100">Load Store Card via Cashier</p>
															<p className="text-xs text-gray-600 dark:text-slate-400">Give physical cash to the issuing merchant</p>
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
															<p className="font-bold text-gray-900 dark:text-slate-100">Buy USDC via Coinbase</p>
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
														<div className="w-10 h-10 bg-blue-50 dark:bg-slate-700 border border-blue-100 dark:border-slate-600 rounded-xl flex items-center justify-center mr-3">
															<ArrowRightLeft className="text-blue-600 dark:text-blue-400" size={20} />
														</div>
														<div>
															<p className="font-bold text-gray-900 dark:text-slate-100">Top Up Store Card</p>
															<p className="text-xs text-gray-500 dark:text-slate-400">Use your USDC to fund a merchant card</p>
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
													className="text-[#65A30D] dark:text-[#96EB3C] font-bold flex items-center text-sm absolute left-0"
												>
													<ChevronRight className="rotate-180 mr-1" size={16} /> Back
												</button>
												<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">Store Deposit</h3>
											</div>
											<div className="flex flex-col items-center justify-center mb-auto pt-4">
												<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center max-w-[260px] leading-relaxed">
													Show this code to the <span className="font-bold text-gray-900 dark:text-slate-100">issuing merchant</span> and hand
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
														<div className="absolute bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-600">
															<div className="w-8 h-8 bg-[#96EB3C] rounded-full flex items-center justify-center text-gray-900 font-bold text-lg">
																🌳
															</div>
														</div>
													</div>
												</div>
												<div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl p-3 w-full max-w-[280px] flex items-center justify-between mb-8">
													<div className="flex flex-col overflow-hidden mr-3">
														<span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
															Wallet Address
														</span>
														<span className="text-xs font-mono text-gray-700 dark:text-slate-200 truncate">
															{addCashDepositAddress || '—'}
														</span>
													</div>
													<button
														type="button"
														onClick={copyAddCashDepositAddress}
														disabled={!addCashDepositAddress}
														className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 shadow-sm text-gray-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
													>
														{addCashWalletCopied ? 'Copied' : 'Copy'}
													</button>
												</div>
											</div>
										</>
									) : addCashMode === 'coinbase' ? (
										<>
											<div className="flex items-center mb-6 w-full relative">
												<button
													type="button"
													onClick={() => setAddCashMode('methods')}
													className="text-[#65A30D] dark:text-[#96EB3C] font-bold flex items-center text-sm absolute left-0"
												>
													<ChevronRight className="rotate-180 mr-1" size={16} /> Back
												</button>
												<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">Coinbase</h3>
											</div>
											<div className="flex flex-col items-center justify-center mb-auto pt-4 w-full">
												<div className="w-16 h-16 bg-[#0052FF] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">
													C
												</div>
												<h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">Buy USDC directly</h4>
												<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center px-4 leading-relaxed">
													CashTrees is a self-custodial wallet and never touches your fiat. You will be securely redirected to Coinbase to
													complete your purchase. USDC will auto-deposit to your wallet.
												</p>
												<div className="w-full max-w-[280px] bg-gray-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-gray-200 dark:border-slate-600 mb-6 shadow-sm">
													<div className="flex justify-between items-center mb-3 gap-2">
														<span className="text-xs text-gray-500 dark:text-slate-400 font-medium shrink-0">To Wallet</span>
														<span className="text-xs font-mono text-gray-900 dark:text-slate-100 font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600 truncate max-w-[60%]">
															{addCashDepositAddress || '—'}
														</span>
													</div>
													<div className="flex justify-between items-center">
														<span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Network</span>
														<div className="flex items-center bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600">
															<div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center mr-1.5" />
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
														aria-label="Back"
													>
														<ChevronLeft size={20} />
													</button>
													<h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mx-auto">Select Store Card</h3>
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
																className="w-full flex items-center p-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-[#65A30D] dark:hover:border-[#96EB3C] hover:bg-[#96EB3C]/5 dark:hover:bg-[#96EB3C]/10 transition-colors shadow-sm text-left"
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
														className="text-[#65A30D] dark:text-[#96EB3C] font-bold flex items-center text-sm absolute left-0"
													>
														<ChevronRight className="rotate-180 mr-1" size={16} /> Back
													</button>
													<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">Top Up Store Card</h3>
												</div>
												<div className="flex flex-col mb-auto pt-2 w-full">
													<div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-3xl p-5 mb-2 relative shadow-inner">
														<div className="flex justify-between items-center mb-2">
															<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">From Vault (USDC)</span>
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
																<div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] mr-1.5">
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
													<div className="bg-white dark:bg-slate-800/80 border border-[#96EB3C]/50 rounded-3xl p-5 mt-2 relative shadow-sm">
														<div className="flex justify-between items-center mb-2">
															<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">To Store Card (CAD)</span>
															<button
																type="button"
																onClick={() => setIsSelectingTopUpStore(true)}
																className="text-xs text-[#65A30D] dark:text-[#96EB3C] font-bold hover:underline"
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
																className="bg-transparent text-3xl font-bold text-[#65A30D] dark:text-[#96EB3C] outline-none w-1/2 min-w-0 placeholder-[#65A30D]/30 dark:placeholder-[#96EB3C]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
															/>
															<div className="flex items-center bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-gray-100 dark:border-slate-600 shrink-0">
																<span className="text-sm font-bold text-gray-700 dark:text-slate-200">CAD</span>
															</div>
														</div>
													</div>
													<div className="mt-8 bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-gray-200 dark:border-slate-600">
														<div className="flex justify-between items-start gap-2 text-sm mb-2">
															<span className="text-gray-500 dark:text-slate-400 shrink-0">Exchange Rate</span>
															<div className="flex flex-col items-end gap-1 min-w-0">
																<div className="flex items-center gap-2">
																	<span className="font-semibold text-gray-900 dark:text-slate-100 text-right inline-flex items-center gap-1">
																		1 USDC = {addCashTopUpCadPerUsdc.toFixed(4)} CAD
																		{topUpOracleLoading && topUpRateRefreshStatus === 'idle' ? (
																			<Loader2 className="w-3.5 h-3.5 animate-spin text-[#65A30D] shrink-0" aria-hidden />
																		) : null}
																	</span>
																	<button
																		type="button"
																		onClick={() => void refreshTopUpOracleRate(true)}
																		disabled={topUpRateRefreshStatus !== 'idle'}
																		className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
																		aria-label="Refresh exchange rate"
																	>
																		{topUpRateRefreshStatus === 'loading' ? (
																			<Loader2 className="w-4 h-4 animate-spin" aria-hidden />
																		) : topUpRateRefreshStatus === 'success' ? (
																			<Check className="w-4 h-4 text-emerald-500" aria-hidden />
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
																: 'bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 shadow-[0_4px_14px_rgba(150,235,60,0.4)]'
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
																	: 'text-gray-900'
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

			{/* Send a Store Gift — 对齐 beamio.app renderAction Gift Modal */}
			{createPortal(
				<AnimatePresence>
					{showGiftSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40 backdrop-blur-md"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closeGiftSheet}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[88dvh] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
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
										onClick={closeGiftSheet}
										className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
										aria-label="Close"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-6 pb-4">
									{isSelectingGiftStore ? (
										<div className="flex flex-col min-h-[240px]">
											<div className="flex items-center mb-6 relative w-full">
												<button
													type="button"
													onClick={() => setIsSelectingGiftStore(false)}
													className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
													aria-label="Back"
												>
													<ChevronLeft size={20} />
												</button>
												<h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mx-auto">Select Asset to Gift</h3>
											</div>
											<div className="space-y-4 overflow-y-auto pb-6">
												{(
													[
														{
															id: 'usdc' as const,
															name: 'USDC Balance',
															type: 'Unallocated Funds',
															color: 'bg-blue-500',
															text: 'text-white',
															balanceCad: giftUsdcValuationCad,
														} satisfies HomeUsdcGiftVault,
														...homeStoreCards,
													] satisfies HomeGiftSource[]
												).map((card) => {
													const IconCmp: LucideIcon =
														card.id === 'usdc' ? Layers : (card as HomeStoreCardRow).icon
													return (
														<button
															type="button"
															key={card.id}
															onClick={() => {
																setGiftStore(card)
																setIsSelectingGiftStore(false)
															}}
															className="w-full flex items-center p-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-[#65A30D] dark:hover:border-[#96EB3C] hover:bg-[#96EB3C]/5 dark:hover:bg-[#96EB3C]/10 transition-colors shadow-sm text-left"
														>
															<div
																className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-inner ${
																	card.id === 'usdc'
																		? 'bg-blue-500'
																		: `bg-gradient-to-br ${(card as HomeStoreCardRow).color}`
																} text-white`}
															>
																{card.id === 'usdc' ? (
																	<span className="font-bold">$</span>
																) : (
																	<IconCmp size={18} />
																)}
															</div>
															<div className="flex-1 min-w-0">
																<h4 className="font-bold text-gray-900 dark:text-slate-100">{card.name}</h4>
																<p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
																	{card.type}
																</p>
															</div>
															<div className="text-right shrink-0">
																<p className="text-sm font-bold text-gray-900 dark:text-slate-100">
																	CA$ {card.balanceCad ? card.balanceCad.toFixed(2) : '0.00'}
																</p>
																<p className="text-[10px] text-gray-400 dark:text-slate-500">Available</p>
															</div>
														</button>
													)
												})}
											</div>
										</div>
									) : (
										<div className="flex flex-col animate-in fade-in duration-200">
											<div className="flex flex-col items-center justify-center mb-6 mt-2">
												<div className="w-16 h-16 bg-pink-50 dark:bg-pink-950/40 rounded-full flex items-center justify-center mb-4 shadow-sm border border-pink-100 dark:border-pink-900/50">
													<Gift size={32} className="text-pink-500" />
												</div>
												<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">
													Send a Store Gift
												</h3>
												<p className="text-sm text-gray-500 dark:text-slate-400 mb-6 text-center px-6">
													Gift specific store cards or unallocated USDC to friends.
												</p>
												<div className="flex items-center text-gray-900 dark:text-slate-100 font-bold text-6xl tracking-tighter">
													<span className="text-3xl mr-1 text-gray-400 dark:text-slate-500">$</span>
													<input
														type="number"
														placeholder="0.00"
														value={giftAmount}
														onChange={(e) => setGiftAmount(e.target.value)}
														inputMode="decimal"
														autoComplete="off"
														className="w-40 bg-transparent outline-none text-center placeholder-gray-200 dark:placeholder-slate-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
													/>
												</div>
												<button
													type="button"
													onClick={() => setIsSelectingGiftStore(true)}
													className="mt-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-gray-200 dark:border-slate-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
												>
													{giftStore ? (
														<>
															<div
																className={`w-4 h-4 rounded-full ${
																	giftStore.id === 'usdc'
																		? 'bg-blue-500'
																		: `bg-gradient-to-br ${(giftStore as HomeStoreCardRow).color}`
																} border border-white/20 shadow-inner`}
															/>
															{giftStore.name}{' '}
															<ChevronRight size={14} className="text-gray-400 inline" />
														</>
													) : (
														<>
															<div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-bold">
																$
															</div>
															Unallocated USDC <ChevronRight size={14} className="text-gray-400 inline" />
														</>
													)}
												</button>
											</div>
											<div
												ref={giftRecipientSearchRef}
												className="relative z-20 mb-3 overflow-visible rounded-2xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/80 shadow-sm"
											>
												{!giftRecipientSelected ? (
													<>
														<div className="flex items-center p-4">
															<UserCircle className="text-gray-400 dark:text-slate-500 mr-3 shrink-0" size={24} />
															<div className="flex-1 flex items-center min-w-0">
																<span className="text-gray-900 dark:text-slate-100 font-bold mr-2 shrink-0">To:</span>
																<input
																	type="text"
																	placeholder="@beamio.tag or Phone #"
																	value={giftRecipient}
																	onChange={(e) => {
																		setGiftRecipient(e.target.value)
																		setGiftRecipientSelected(null)
																		setGiftRecipientSuggestOpen(true)
																	}}
																	onFocus={() => setGiftRecipientSuggestOpen(true)}
																	autoComplete="off"
																	autoCorrect="off"
																	autoCapitalize="none"
																	spellCheck={false}
																	inputMode="search"
																	enterKeyHint="search"
																	className="w-full bg-transparent outline-none text-gray-800 dark:text-slate-200 font-semibold placeholder-gray-400 dark:placeholder-slate-500 text-[13px]"
																/>
															</div>
														</div>
														{giftPayRecentRecipients.length > 0 &&
														!(
															giftRecipientSuggestOpen &&
															giftRecipient.trim().replace(/^@/, '').length >= 3 &&
															(giftRecipientSearchLoading || giftRecipientHits.length > 0)
														) ? (
															<div className="flex items-center gap-3 overflow-x-auto px-4 pb-3 no-scrollbar">
																{giftPayRecentRecipients.map((r) => (
																	<button
																		key={r.address}
																		type="button"
																		onClick={() => onPickGiftRecipientHit(r)}
																		className="flex flex-shrink-0 flex-col items-center gap-1 active:scale-95 transition-transform"
																	>
																		<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 ring-2 ring-transparent hover:ring-blue-300 dark:bg-slate-600 dark:hover:ring-blue-500">
																			{r.image ? (
																				<img src={r.image} alt={r.username} className="h-full w-full object-cover" />
																			) : (
																				<img
																					src={getImg(r.username || r.address)}
																					alt={r.username}
																					className="h-full w-full object-cover"
																				/>
																			)}
																		</div>
																		<span className="max-w-[56px] truncate text-[11px] font-medium text-blue-600 dark:text-blue-400">
																			@
																			{(r.username || r.address?.slice(0, 6) || '').replace(/^@/, '')}
																		</span>
																	</button>
																))}
															</div>
														) : null}
														{giftRecipientSuggestOpen &&
															!giftRecipientSelected &&
															giftRecipient.trim().replace(/^@/, '').length >= 3 && (
																<div
																	className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-slate-900 py-1 shadow-xl shadow-slate-200/80 dark:shadow-black/40"
																	onMouseDown={(e) => e.preventDefault()}
																>
																	<button
																		type="button"
																		className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
																	>
																		<Search
																			className="h-4 w-4 flex-shrink-0 text-slate-500 dark:text-slate-400"
																			strokeWidth={2}
																		/>
																		<span className="flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">
																			{giftRecipient.trim()
																				? `${giftRecipient.trim()} Beamio search`
																				: 'Beamio search'}
																		</span>
																		{giftRecipientSearchLoading ? (
																			<span className="text-[11px] text-slate-400 dark:text-slate-500">
																				Searching…
																			</span>
																		) : null}
																	</button>
																	{!giftRecipientSearchLoading &&
																		giftRecipientHits.map((hit) => (
																			<button
																				key={`${hit.address}-${hit.username}`}
																				type="button"
																				className="flex w-full items-center px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
																				onClick={() => onPickGiftRecipientHit(hit)}
																			>
																				<img
																					src={hit.image ? hit.image : getImg(hit.username)}
																					alt={hit.username}
																					className="mr-2 h-7 w-7 flex-shrink-0 rounded-full bg-slate-200 object-cover dark:bg-slate-700"
																				/>
																				<div className="flex min-w-0 flex-1 items-start justify-between gap-3">
																					<div className="flex min-w-0 flex-col">
																						<span className="truncate text-[13px] text-slate-900 dark:text-slate-100">
																							{displayName(hit)}
																						</span>
																						<span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
																							@{hit.username} · {fmtAddr(hit.address)}
																						</span>
																						<span className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
																							{Number(hit.follow_count || '0').toLocaleString()} following ·{' '}
																							{Number(hit.follower_count || '0').toLocaleString()} followers
																						</span>
																					</div>
																					<span className="whitespace-nowrap text-[10px] text-slate-400 dark:text-slate-500">
																						{giftSearchFormatUserDate(hit.created_at)}
																					</span>
																				</div>
																			</button>
																		))}
																	{!giftRecipientSearchLoading && giftRecipientHits.length === 0 ? (
																		<div className="px-3 py-2.5 text-[12px] text-slate-400 dark:text-slate-500">
																			No results
																		</div>
																	) : null}
																</div>
															)}
													</>
												) : (
													<div className="flex w-full flex-col items-center px-4 pb-4 pt-2">
														<div
															className="inline-flex cursor-default select-none flex-col items-center"
															role="group"
															aria-label="Selected recipient"
														>
															<div className="mt-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
																{giftRecipientSelected.image ? (
																	<img
																		src={giftRecipientSelected.image}
																		alt={giftRecipientSelected.username}
																		className="h-full w-full object-cover"
																	/>
																) : (
																	<img
																		src={getImg(giftRecipientSelected.username)}
																		alt={giftRecipientSelected.username}
																		className="h-full w-full object-cover"
																	/>
																)}
															</div>
															<div className="pointer-events-none mt-1 flex flex-col items-center">
																<div className="text-[18px] font-semibold leading-[18px] text-blue-600 dark:text-blue-400">
																	@{giftRecipientSelected.username}
																</div>
																<div className="mt-0.5 text-[12px] leading-[13px] text-blue-600 dark:text-blue-400">
																	{fmtAddr(giftRecipientSelected.address)}
																</div>
															</div>
														</div>
														<button
															type="button"
															onClick={() => {
																setGiftRecipientSelected(null)
																setGiftRecipient('')
																setGiftRecipientSuggestOpen(true)
															}}
															className="mt-3 text-[13px] font-medium text-blue-600 hover:underline dark:text-blue-400"
														>
															Change recipient
														</button>
													</div>
												)}
											</div>
											<div className="bg-gray-50 dark:bg-slate-800/80 rounded-2xl p-4 mb-auto border border-gray-200 dark:border-slate-600 flex items-center shadow-sm">
												<MessageCircle className="text-gray-400 dark:text-slate-500 mr-3 shrink-0" size={24} />
												<div className="flex-1 flex items-center min-w-0">
													<input
														type="text"
														placeholder="Add a message..."
														value={giftMessage}
														onChange={(e) => setGiftMessage(e.target.value)}
														className="w-full bg-transparent outline-none text-gray-800 dark:text-slate-200 font-medium placeholder-gray-400 dark:placeholder-slate-500"
													/>
												</div>
											</div>
											<div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 mt-6 border border-gray-200 dark:border-slate-600 shadow-sm">
												<div className="flex justify-between items-center mb-3">
													<span className="text-sm text-gray-500 dark:text-slate-400 font-medium">Gift Amount</span>
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100">
														{giftStore && giftStore.id !== 'usdc' ? 'CA$' : 'USDC'} {giftCadAmount.toFixed(2)}
													</span>
												</div>
												<div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200 dark:border-slate-600">
													<span className="text-sm text-gray-500 dark:text-slate-400 font-medium flex items-center">
														Network Fee (0.8%)
														<Info size={12} className="ml-1 text-gray-400 shrink-0" />
													</span>
													<div className="text-right flex flex-col items-end">
														<span className="text-sm font-mono font-bold text-gray-900 dark:text-slate-100">
															+ {giftFeeUsdc.toFixed(2)} USDC
														</span>
														{giftCadAmount > 0 && giftFeeUsdc <= 0.0200001 ? (
															<span className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
																Minimum fee applied
															</span>
														) : giftCadAmount > 0 && giftFeeUsdc >= 1.999 ? (
															<span className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
																Maximum fee cap applied
															</span>
														) : null}
													</div>
												</div>
												<div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-slate-600">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100">Total Cost</span>
													<div className="text-right">
														<span className="text-base font-extrabold text-gray-900 dark:text-slate-100">
															USDC{' '}
															{giftCadPerUsdc > 0
																? (giftCadAmount / giftCadPerUsdc + giftFeeUsdc).toFixed(2)
																: '0.00'}
														</span>
													</div>
												</div>
											</div>
											<button
												type="button"
												onClick={handleConfirmGift}
												disabled={!giftCadAmount || giftCadAmount <= 0}
												className={`w-full py-4 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4 ${
													!giftCadAmount || giftCadAmount <= 0
														? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed shadow-none'
														: 'bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white active:scale-95 text-white dark:text-gray-900'
												}`}
											>
												<Gift
													size={20}
													className={
														!giftCadAmount || giftCadAmount <= 0
															? 'text-gray-400'
															: 'text-white dark:text-gray-900'
													}
												/>
												Confirm & Send Gift
											</button>
										</div>
									)}
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
							: showAlphaHowItWorks === 'Pay' ? 'Pay'
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
							
							
							{showAlphaHowItWorks === 'Pay' && <PayScreen 
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
									setSettingsOpen('Pay')
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

							{ settingsOpen === 'Pay' && (
								<PayScreen 
									beamioer={giftPayHandoffPayee ?? userPreviewItem ?? undefined}
									initialNote={giftPayPrefill?.note}
									initialSendAmount={giftPayPrefill?.usdc}
									focusAmountOnMount={Boolean(giftPayPrefill)}
									close={() => {
										setGiftPayHandoffPayee(null)
										setGiftPayPrefill(null)
										setSettingsOpen('')
										setShowFooter(true)
									}}
									onShowFuelCenter={() => {
										setGiftPayHandoffPayee(null)
										setGiftPayPrefill(null)
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

			
		</div>
	)
}

export default Home
