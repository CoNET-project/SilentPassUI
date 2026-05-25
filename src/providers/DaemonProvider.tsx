import React, { createContext, useContext, ReactNode, useState, useEffect, useLayoutEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import packageData from '../../package.json'
import ScanButton, { type  ScanButtonHandle } from "@/components/scanBtn/ScanButton"
import { getOracle, parseOracleToCurrencyData, ORACLE_REFRESH_MS } from "@/services/beamio"
import { ethers } from 'ethers'
import {
	getCardsOfOwnerWithDetailsForProfile,
	fetchMyBrandsCouponSeriesForUser,
	fetchOwnedCouponsForKnownCards,
	fetchOwnedCouponsFromRecentSeriesForUser,
	fetchOwnedCouponsFromWalletAssetsForCards,
	isCardExcludedFromDisplay,
	getMyAssets,
	getCardBasicMetadataStaleWhileRevalidate,
	getAAAccount,
	rememberCardBasicMetadataTrusted,
	type UserCardInfo,
	type CardMetadataFromUri,
	type CardActiveIssuedCouponSeriesItem,
} from '@/services/BeamioCard'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
import { baseEndpoint, USDCContract_BASE } from '@/utils/constants'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import { getUsdcBalanceFromApi } from '@/services/beamio'
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from '@/utils/rpcStatus'
import { fetchMergedRecentActivityFromIndexer, type TxView } from '@/pages/History/recentActivityIndexerMerge'
import {
  loadMyBrandsFeedLocalCache,
  saveMyBrandsFeedLocalCache,
  type MyBrandsOwnedCouponSnapshot,
} from '@/utils/myBrandsFeedLocalCache'
import {
	loadRecentActivityLocalCache,
	saveRecentActivityLocalCache,
	txViewsFromLocalCache,
} from '@/utils/recentActivityLocalCache'
import { shouldUpdateRecentActivityList } from '@/utils/recentActivityFeedState'
import {
	areMyBrandDetailsMapsEqual,
	myBrandCardListSignature,
	type MyBrandCardFeedDetailsMap,
} from '@/utils/myBrandsFeedState'

export type { MyBrandCardFeedDetailsMap }

/** CoNET mainnet RPC（与 App CoreContract 一致） */
const CONET_MAINNET_RPC_HTTP = 'https://rpc1.conet.network'

/** My Brands 全局喂料间隔（毫秒）；与 CoNET `block` 时钟并列用于「时间机」元数据 */
const MY_BRANDS_FEED_INTERVAL_MS = 6_000

type ClaimableCouponSummary = {
  count: number
  firstTitle?: string
  firstCoupon?: MyBrandsOwnedCouponSnapshot | null
  coupons?: MyBrandsOwnedCouponSnapshot[]
}

const couponMetaAsRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null

const couponMetaString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const couponMetaStringFromKeys = (src: Record<string, unknown> | null, keys: readonly string[]): string => {
  if (!src) return ''
  for (const key of keys) {
    const v = couponMetaString(src[key])
    if (v) return v
  }
  return ''
}

const couponMetaBackgroundImageKeys = [
  'couponImage',
  'background',
  'backgroundImage',
  'backgroundImageUrl',
  'cover',
  'coverImage',
] as const

const couponMetaBackgroundColorKeys = [
  'backgroundColor',
  'bgColor',
  'color',
  'backgroundColorHex',
  'background_color',
] as const

function mapMyBrandsOwnedCoupon(row: CardActiveIssuedCouponSeriesItem, cardAddress: string): MyBrandsOwnedCouponSnapshot | null {
  const meta = couponMetaAsRecord(row.metadata)
  if (!meta) return null
  const props = couponMetaAsRecord(meta.properties)
  const beamioCoupon = couponMetaAsRecord(props?.beamioCoupon)
  const couponId = couponMetaString(meta.couponId) || couponMetaString(beamioCoupon?.couponId)
  if (!couponId) return null
  const imageObj = couponMetaAsRecord(meta.image)
  const title =
    couponMetaString(meta.title) ||
    couponMetaString(meta.name) ||
    couponMetaString(beamioCoupon?.title) ||
    couponMetaString(beamioCoupon?.name) ||
    'Coupon'
  const subtitle =
    couponMetaString(meta.subtitle) ||
    couponMetaString(meta.description) ||
    couponMetaString(beamioCoupon?.subtitle) ||
    couponMetaString(beamioCoupon?.description) ||
    'Gift voucher'
  const iconUrl =
    couponMetaString(meta.iconUrl) ||
    couponMetaString(meta.icon) ||
    couponMetaString(imageObj?.url) ||
    couponMetaString(meta.image) ||
    couponMetaString(beamioCoupon?.iconUrl) ||
    couponMetaString(beamioCoupon?.icon)
  const backgroundImage =
    couponMetaStringFromKeys(meta, couponMetaBackgroundImageKeys) ||
    couponMetaStringFromKeys(beamioCoupon, couponMetaBackgroundImageKeys)
  const rawBackgroundColor =
    couponMetaStringFromKeys(meta, couponMetaBackgroundColorKeys) ||
    couponMetaStringFromKeys(beamioCoupon, couponMetaBackgroundColorKeys)
  const validBeforeNum = Number(row.issuedNftValidBefore ?? 0)
  return {
    id: `${cardAddress.toLowerCase()}:${row.tokenId}`,
    cardAddress,
    tokenId: String(row.tokenId),
    couponId,
    title,
    subtitle,
    iconUrl,
    backgroundImage,
    backgroundColorHex: rawBackgroundColor ? (rawBackgroundColor.startsWith('#') ? rawBackgroundColor : `#${rawBackgroundColor}`) : '',
    validBeforeSec: Number.isFinite(validBeforeNum) && validBeforeNum > 0 ? validBeforeNum : null,
  }
}

function readMyBrandsCouponTitle(meta: Record<string, unknown> | null | undefined): string {
	if (!meta || typeof meta !== 'object') return ''
	const props = meta.properties
	const beamioCoupon =
		props && typeof props === 'object'
			? (props as Record<string, unknown>).beamioCoupon
			: null
	const couponObj =
		beamioCoupon && typeof beamioCoupon === 'object'
			? (beamioCoupon as Record<string, unknown>)
			: null
	const candidates = [
		meta.title,
		meta.name,
		couponObj?.title,
		couponObj?.name,
	]
	for (const v of candidates) {
		if (typeof v === 'string' && v.trim()) return v.trim()
	}
	return ''
}

function summarizeClaimableCouponCards(
	rows: CardActiveIssuedCouponSeriesItem[] | null
): Map<string, ClaimableCouponSummary> | null {
	if (rows === null) return null
	const out = new Map<string, ClaimableCouponSummary>()
	for (const row of rows) {
		const raw = row.cardAddress?.trim()
		if (!raw || !ethers.isAddress(raw)) continue
		const cardAddress = ethers.getAddress(raw)
		if (isCardExcludedFromDisplay(cardAddress)) continue
		const key = cardAddress.toLowerCase()
		const prev = out.get(key)
		const title = readMyBrandsCouponTitle(row.metadata ?? null)
		const mapped = mapMyBrandsOwnedCoupon(row, cardAddress)
		const coupons = [...(prev?.coupons ?? [])]
		if (mapped && !coupons.some((c) => c.id === mapped.id)) coupons.push(mapped)
		const firstCoupon = prev?.firstCoupon ?? mapped ?? null
		out.set(key, {
			count: (prev?.count ?? 0) + 1,
			firstTitle: prev?.firstTitle || title || mapped?.title || undefined,
			firstCoupon,
			coupons,
		})
	}
	return out
}

function resolveClaimableCouponsForCard(
	cardKey: string,
	couponSummaries: Map<string, ClaimableCouponSummary> | null,
	couponRows: CardActiveIssuedCouponSeriesItem[] | null,
	prevRow: MyBrandCardFeedDetailsMap[string] | undefined
): ClaimableCouponSummary | null {
	if (couponSummaries === null || couponRows === null) {
		return prevRow?.claimableCoupons ?? null
	}
	return couponSummaries.get(cardKey) ?? null
}

function couponFallbackCardInfo(cardAddressLower: string, summary: ClaimableCouponSummary): UserCardInfo {
	return {
		cardAddress: ethers.getAddress(cardAddressLower),
		name: summary.firstTitle ? 'Merchant coupon' : 'Coupon available',
		currency: 'CAD',
		priceE6: '1000000',
		ptsPer1Currency: '1',
	}
}

/** /home「Total Power」：仅 CAD 展示用（whole.frac）；由全局 wallet 喂料写入 */
export type HomeTotalPowerCad = { whole: string; frac: string }

/** EOA+AA USDC（各算一次）+ 所有 BeamioUserCard 的 points 按卡币种经 Oracle（currencyData）折 CAD */
function computeHomeTotalPowerCad(
	eoaUsdcStr: string,
	aaUsdcStr: string,
	cardDetails: MyBrandCardFeedDetailsMap,
	d: currencyData
): HomeTotalPowerCad {
	const dr = d as Record<string, number>
	const cadPerUsdc = (Number(dr.CAD) || 1.35) * (Number(dr.USDC) || 1)
	const eoaU = Math.max(0, Number(eoaUsdcStr) || 0)
	const aaU = Math.max(0, Number(aaUsdcStr) || 0)
	const cadFromUsdc = (eoaU + aaU) * cadPerUsdc
	let pointsCad = 0
	for (const entry of Object.values(cardDetails)) {
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
			const targetPerUsd = Number(dr.CAD) > 0 ? Number(dr.CAD) : 1.35
			const srcRaw = dr[pCur]
			const srcPerUsd = typeof srcRaw === 'number' && srcRaw > 0 ? srcRaw : 1
			pointsCad += pts * (targetPerUsd / srcPerUsd)
		}
	}
	const totalCad = cadFromUsdc + pointsCad
	const [whole, frac = '00'] = totalCad.toFixed(2).split('.')
	return { whole, frac }
}

type DaemonContext = {
	historyPayData: searchResult|null
	setHistoryPayData: (val: searchResult|null) => void
	scanRef: React.MutableRefObject<ScanButtonHandle | null>
	msgCountLockRef: React.MutableRefObject<boolean>
	seenMsgRef: React.MutableRefObject<Set<string>>
	messageCount: number
	setMessageCount: React.Dispatch<React.SetStateAction<number>>
	scanData: string
	setScanData: (val: string) => void
	scanIntent: '' | 'voucherPay' | 'payBill' | 'payByNfc'
	setScanIntent: (val: '' | 'voucherPay' | 'payBill' | 'payByNfc') => void
	voucherPayAmount: string
	setVoucherPayAmount: (val: string) => void
	voucherPayToAA: string
	setVoucherPayToAA: (val: string) => void
	voucherPayError: string
	setVoucherPayError: (val: string) => void
	chatHomeItem: searchResult|null
	setChatHomeItem: Dispatch<SetStateAction<searchResult | null>>
	charts: string[]
	setCharts: React.Dispatch<React.SetStateAction<string[]>>
	gossip: boolean
	setGossip: (val: boolean) => void
	allNodes: nodeInfo[]
	setAllNodes: (val: nodeInfo[]) => void
	navigateLeftButtonArray: INavigateLeftButtonArray[]
	setNavigateLeftButtonArray: Dispatch<SetStateAction<INavigateLeftButtonArray[]>>
	payMePayment: searchResult|null
	setPayMePayment: Dispatch<SetStateAction<searchResult | null>>
	showFooter: boolean
	setShowFooter: (val: boolean) => void
	chatSearchOpen: boolean
	setChatSearchOpen: (val: boolean) => void
	beamioUsers: searchResult[]
	setbBeamioUsers: (val: searchResult[]) => void
	currencyData: currencyData
	setCurrencyData: (val: currencyData) => void
	/** 手动触发 oracle 刷新（全局 feeder 每 5 分钟自动刷新，页面一般无需调用） */
	refreshOracle: () => void
	/** 全局 My Brands 喂料：CoNET `block` 更新 currentBlock；每 6s setTimeout 链串行拉取用户 BeamioUserCard */
	myBrandCards: UserCardInfo[]
	myBrandCardDetails: MyBrandCardFeedDetailsMap
	myBrandsFeedLoading: boolean
	myBrandsFeedLastConetBlock: number
	/** 全局喂料写入：EOA + 独立 AA（若存在）合并拉取、按时间倒序；overrideAddress 调试场景外均由面板读此数据 */
	recentActivityNoAaItems: TxView[]
	recentActivityNoAaLoading: boolean
	recentActivityNoAaError: string | null
	refreshRecentActivityNoAa: () => Promise<void>
	paymentLinkCode: string
	setPaymentLinkCode: (val: string) => void
	redeemCode: string
	setRedeemCode: (val: string) => void
	myAddress: string
	setMyAddress: (val: string) => void
	listenningProcess: boolean
	setListenningProcess: (va: boolean) => void
	setSendToMemo: (val: string) => void
	sendToMemo: string
	darkModle: boolean
	setDarkModle: (val: boolean) => void
  version: string
  power: boolean;
  setPower: (val: boolean) => void;
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
  closestRegion: nodes_info[];
  setClosestRegion: (region: nodes_info[]) => void;
  isRandom: boolean;
  setIsRandom: (val: boolean) => void;
  miningData: any;
  setMiningData: (data: any) => void;
  profiles: any;
  setProfiles: React.Dispatch<React.SetStateAction<profile[]>>
  isMiningUp: boolean;
  setIsMiningUp: (val: boolean) => void;
  setaAllNodes: (data: nodes_info[]) => void
  getAllNodes: nodes_info[]
  serverIpAddress: string
  setServerIpAddress: (ip: string) => void
  serverPort: string
  setServerPort: (port: string) => void
  serverPac: string
  setServerPac: (pac: string) => void
  _vpnTimeUsedInMin: React.MutableRefObject<number>
  isPassportInfoPopupOpen: boolean
  setIsPassportInfoPopupOpen: (val: boolean) => void
  activePassportUpdated: boolean
  setActivePassportUpdated: (val: boolean) => void
  activePassport: any
  setActivePassport: (val: any) => void
  isSelectPassportPopupOpen: any
  setIsSelectPassportPopupOpen: (val: any) => void
  randomSolanaRPC: nodes_info | null
  setRandomSolanaRPC: (val: nodes_info) => void;
  isIOS: boolean
  setIsIOS: (val: boolean) => void
  isLocalProxy: boolean
  setIsLocalProxy: (val: boolean)=> void
  globalProxy: boolean,
  setGlobalProxy: (val: boolean)=> void
  paymentKind: number,
  setPaymentKind: (val: number) => void
  successNFTID: string,
  setSuccessNFTID: (val: string) => void
  selectedPlan: "12" | "1" |'3' | string
  setSelectedPlan: (val: "12" | "1" |'3'| string ) => void
  airdropProcess: boolean,
  setAirdropProcess: (val: boolean) => void
  setAirdropSuccess: (val: boolean) => void
  airdropSuccess: boolean
  airdropTokens: number
  setAirdropTokens: (val: number) => void
  airdropProcessReff: boolean
  setAirdropProcessReff: (val: boolean) => void
  getWebFilter: boolean
  setGetWebFilter: (val:boolean) => void
  switchValue: boolean;
  setSwitchValue: (val: boolean) => void;
  webFilterRef:React.MutableRefObject<boolean>;
  quickLinksShow: boolean;
  setQuickLinksShow: (val: boolean) => void;
  duplicateAccount: any
  setDuplicateAccount: (profile: any) => void
  showReferralsInput: boolean,
  setShowReferralsInput: (val: boolean) => void;
  subscriptionVisible: boolean;
  setSubscriptionVisible: (val: boolean) => void;
  airdropVisible: boolean;
  setAirdropVisible: (val: boolean) => void;
  referralsVisible: boolean;
  setReferralsVisible: (val: boolean) => void;
  passportVisible: boolean;
  setPassportVisible: (val: boolean) => void;
  checkInVisible: boolean;
  setCheckInVisible: (val: boolean) => void;
  genesisVisible: boolean;
  setGenesisVisible: Dispatch<SetStateAction<boolean>>;
  isInitialLoading: boolean;
  setIsInitialLoading: (val: boolean) => void;
  statusVisible: boolean,
  setStatusVisible: (val: boolean) => void;
  checkinBalanceUP: boolean,
  setCheckinBalanceUP: (val: boolean) => void;
  ruleVisible: boolean,
  setRuleVisible: Dispatch<SetStateAction<boolean>>;
  hasNewVersion: boolean|string,
  setHasNewVersion: Dispatch<SetStateAction<boolean|string>>;
  setPrivacyMode: (val: boolean) => void;
  privacyMode: boolean;
  currentBlock: number
  setCurrentBlock: (val: number) => void
  beamio: beamio|null
  setBeamio : (val:beamio|null) => void
  usdcbalance : number

  setUsdcbalance: (val: number) => void
	usdcToUSD: number
	setUsdcToUSD: (val: number) => void
	/** Base 上 Beamio AA 的 USDC 余额（`ethers.formatUnits(..., 6)` 字符串）；由全局 wallet feed（与 Recent Activity 同轨 6s）更新 */
	aaAccountUsdcBalance: string
	/** /home Total Power：EOA+AA USDC + 全部 BeamioUserCard points，Oracle（currencyData）折 CAD；与 My Brands / 6s 喂料同轨 */
	homeTotalPowerCad: HomeTotalPowerCad

  paymentLink: any
  setPaymentLink: (val: any) => void
  setBeamioAppInstalled: (val:boolean) => void
	beamioAppInstalled: boolean
	setSecureCode: (val: string) => void,
	secureCode: string
	ignoreUrl: boolean
	setIgnoreUrl: (val: boolean) => void
	setPayTag: (val: string) => void
	payTag: string
	/** 扫码/链接解析得到的 BeamioUserCard redeem 参数，打开 redeem 面板并预填 */
	redeemFromUrl: { cardAddress?: string; redeemCode: string } | null
	setRedeemFromUrl: (val: { cardAddress?: string; redeemCode: string } | null) => void
	/** BeamioOnboardingModal Go To Home 后后台 redeem 的结果，从下往上滑出展示 */
	redeemResult: { success: boolean; tx?: string; error?: string } | null
	setRedeemResult: (val: { success: boolean; tx?: string; error?: string } | null) => void
	/** 扫码 paymentUrl 后导航到 /History 并打开 TenKeyInput 支付 workflow */
	voucherPayFromScan: boolean
	setVoucherPayFromScan: (val: boolean) => void
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
	historyPayData: null,
	setHistoryPayData: (val: searchResult|null) => {},
	// ...
	scanRef: { current: null },
	// ...
	
	msgCountLockRef: { current: false },
	seenMsgRef: { current: new Set() },
	messageCount: 0,
	setMessageCount: (val: React.SetStateAction<number>) => {},
	scanData: '',
	setScanData: (val) => {},
	scanIntent: '',
	setScanIntent: () => {},
	voucherPayAmount: '',
	setVoucherPayAmount: () => {},
	voucherPayToAA: '',
	setVoucherPayToAA: () => {},
	voucherPayError: '',
	setVoucherPayError: () => {},
	chatHomeItem: null,
	setChatHomeItem: (val) => {},
	charts: [],
	setCharts: (_value: React.SetStateAction<string[]>) => {},
	gossip: false,
	setGossip: (val: boolean) => {},
	allNodes: [],
	setAllNodes: (val) => {},
	navigateLeftButtonArray: [],
	setNavigateLeftButtonArray: (_value: React.SetStateAction<INavigateLeftButtonArray[]>) => {},
	payMePayment:null,
	setPayMePayment: () => {},
	showFooter: true,
	setShowFooter: (val: boolean) => {},
	chatSearchOpen: false,
	setChatSearchOpen: (val: boolean) => {},
	currencyData: {
		CAD: 0,
		USD: 0,
		JPY: 0,
		CNY: 0,
		USDC: 0,
		HKD: 0,
		EUR: 0,
		TWD: 0,
		SGD: 0
	},
	refreshOracle: () => {},
	myBrandCards: [],
	myBrandCardDetails: {},
	myBrandsFeedLoading: false,
	myBrandsFeedLastConetBlock: 0,
	recentActivityNoAaItems: [],
	recentActivityNoAaLoading: false,
	recentActivityNoAaError: null,
	refreshRecentActivityNoAa: async () => {},

	beamioUsers: [],
	setbBeamioUsers: (val: searchResult[]) => {},

	setCurrencyData: (val: currencyData) => {},
	paymentLinkCode: '',
	setPaymentLinkCode: (val: string) => {},
	redeemCode: '',
	setRedeemCode: (val: string) => {},
	myAddress: '',
	setMyAddress: (val: string) => {},
	usdcToUSD: 0,
	setUsdcToUSD: (val: number) => {},
	aaAccountUsdcBalance: '0',
	homeTotalPowerCad: { whole: '0', frac: '00' },
	listenningProcess: false,
	setListenningProcess: (va: boolean) => {},
	setSendToMemo: (val: string) => {},
	sendToMemo: '',
	setPayTag: (val: string) => {},
	payTag: '',
	ignoreUrl: false,
	setIgnoreUrl: (val: boolean) => {},
	redeemFromUrl: null,
	setRedeemFromUrl: () => {},
	redeemResult: null,
	setRedeemResult: () => {},
	voucherPayFromScan: false,
	setVoucherPayFromScan: () => {},
	setSecureCode: (val: string) => {},
	secureCode: '',
	  setBeamioAppInstalled: () => {},
	beamioAppInstalled: true,
	darkModle: false,
	setDarkModle: () => {},
  power: false,
  setPower: () => { },
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
  closestRegion: [],
  setClosestRegion: () => { },
  isRandom: true,
  setIsRandom: () => { },
  miningData: null,
  setMiningData: () => { },
  profiles: null,
  setProfiles: (_value: React.SetStateAction<profile[]>) => {},
  isMiningUp: false,
  setIsMiningUp: () => { },
  setaAllNodes: () => { },
  getAllNodes: [],
  serverIpAddress: "127.0.0.1",
  setServerIpAddress: () => { },
  serverPort: "8888",
  setServerPort: () => { },
  serverPac: "",
  setServerPac: () => { },
  _vpnTimeUsedInMin: { current: 0 },
  isPassportInfoPopupOpen: false,
  setIsPassportInfoPopupOpen: () => { },
  activePassportUpdated: false,
  setActivePassportUpdated: () => { },
  activePassport: null,
  setActivePassport: () => { },
  isSelectPassportPopupOpen: false,
  setIsSelectPassportPopupOpen: () => { },
  setRandomSolanaRPC: () => { },
  randomSolanaRPC: null,
  isIOS: false,
  setIsIOS: () => {},
  isLocalProxy: false,
  setIsLocalProxy(val) {},
  globalProxy: false,
  setGlobalProxy: () => {},
  paymentKind: 0,
  setPaymentKind: () => {},
  successNFTID: '0',
  setSuccessNFTID: () => {},
  selectedPlan: "12",
  setSelectedPlan: () => {},
  setAirdropProcess: () => {},
  airdropProcess: false,
  setAirdropSuccess: () => {},
  airdropSuccess: false,
  airdropTokens: 0,
  setAirdropTokens: () => {},
  airdropProcessReff: false,
  setAirdropProcessReff: () => {},
  getWebFilter: false,
  setGetWebFilter: () => {},
  switchValue: true,
  setSwitchValue: () => {},
  webFilterRef:{ current: false },
  quickLinksShow: false,
  setQuickLinksShow: () => {},
  version: '1.21.1',
  duplicateAccount: null,
  setDuplicateAccount: () => {},
  showReferralsInput: false,
  setShowReferralsInput: () => {},
  subscriptionVisible: false,
  setSubscriptionVisible: () => {},
  airdropVisible: false,
  setAirdropVisible: () => {},
  referralsVisible: false,
  setReferralsVisible: () => {},
  passportVisible: false,
  setPassportVisible: () => {},
  checkInVisible: false,
  setCheckInVisible: () => {},
  genesisVisible: false,
  setGenesisVisible: () => {},
  isInitialLoading: false,
  setIsInitialLoading: () => {},
  statusVisible: true,
  setStatusVisible: () => {},
  checkinBalanceUP: false,
  setCheckinBalanceUP: (val: boolean) => {},
  ruleVisible: false,
  setRuleVisible: () => {},
  hasNewVersion: false,
  setHasNewVersion: () => {},
  setPrivacyMode: () => {},
  privacyMode: false,
  currentBlock: 0,
  setCurrentBlock: () => {},
  setBeamio: () => {},
	beamio: null,
	usdcbalance: 0,
	setUsdcbalance: () => {},
	paymentLink: null,
  setPaymentLink: () => {},
}

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
	const [historyPayData, setHistoryPayData] = useState<searchResult | null>(null)
	const scanRef = useRef<ScanButtonHandle | null>(null)
	const seenMsgRef = useRef<Set<string>>(new Set())
	const msgCountLockRef = useRef(false) // 可选：避免同一帧重复统计
	const [messageCount, setMessageCount] = useState(0)
	const [scanData, setScanData] = useState('')
	const [scanIntent, setScanIntent] = useState<'' | 'voucherPay' | 'payBill' | 'payByNfc'>('')
	const [voucherPayAmount, setVoucherPayAmount] = useState('')
	const [voucherPayToAA, setVoucherPayToAA] = useState('')
	const [voucherPayError, setVoucherPayError] = useState('')
	const [chatHomeItem,setChatHomeItem] = useState<searchResult | null>(null)
	const [charts, setCharts] = useState<string[]>([])
	const [gossip, setGossip] = useState(false)
	const [allNodes, setAllNodes] = useState<nodeInfo[]>([])
	const [navigateLeftButtonArray, setNavigateLeftButtonArray] = useState<INavigateLeftButtonArray[]>([])
	 const [payMePayment, setPayMePayment] = useState<searchResult | null>(null)
	const [paymentLinkCode, setPaymentLinkCode] = useState('')

	const [usdcToUSD, setUsdcToUSD] = useState(0)
	const [listenningProcess, setListenningProcess] = useState<boolean>(false)
	
	const [sendToMemo, setSendToMemo]= useState('')
	const [beamioAppInstalled, setBeamioAppInstalled] = useState(false)
	const [paymentLink, setPaymentLink] = useState(null)
	const [darkModle, setDarkModle] = useState<boolean>(false)
  const [version] = useState(packageData.version)
  const [power, setPower] = useState<boolean>(false);
  const [globalProxy, setGlobalProxy] = useState(false)
  const [isRandom, setIsRandom] = useState<boolean>(true);
  const [sRegion, setSRegion] = useState<number>(-1);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [closestRegion, setClosestRegion] = useState<any>(null);
  const [miningData, setMiningData] = useState<any>(null);
  const [profilesState, setProfilesState] = useState<any>(null);
  const setProfiles = useCallback((value: React.SetStateAction<profile[]>) => {
    setProfilesState((prev: profile[] | null) => {
      const next = typeof value === 'function' ? (value as (prev: profile[] | null) => profile[])(prev) : value
      if (!next || !Array.isArray(next)) return next
      const first = next[0]
      if (next.length > 0 && Array.isArray(first) && typeof (first as any)?.keyID === 'undefined') {
        return (next as any[]).flat()
      }
      return next
    })
  }, [])
  const profiles = profilesState
  const profilesRef = useRef(profiles)
  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])
  const myAddressRef = useRef('')

  const [currentBlock, setCurrentBlock] = useState(0)

  const conetProviderRef = useRef<ethers.JsonRpcProvider | null>(null)
  if (!conetProviderRef.current) {
    conetProviderRef.current = new ethers.JsonRpcProvider(CONET_MAINNET_RPC_HTTP)
  }
  const conetBlockRef = useRef(0)

  const [myBrandCards, setMyBrandCards] = useState<UserCardInfo[]>([])
  const myBrandCardsRef = useRef<UserCardInfo[]>([])
  const myBrandHolderUnionCardsRef = useRef<UserCardInfo[]>([])
  const [myBrandCardDetails, setMyBrandCardDetails] = useState<MyBrandCardFeedDetailsMap>({})
  const myBrandCardDetailsRef = useRef<MyBrandCardFeedDetailsMap>({})
  useEffect(() => {
    myBrandCardsRef.current = myBrandCards
  }, [myBrandCards])
  useEffect(() => {
    myBrandCardDetailsRef.current = myBrandCardDetails
  }, [myBrandCardDetails])
  const lastEoaUsdcForPowerRef = useRef('0')
  const lastAaUsdcForPowerRef = useRef('0')
  const [myBrandsFeedLoading, setMyBrandsFeedLoading] = useState(false)
  const [myBrandsFeedLastConetBlock, setMyBrandsFeedLastConetBlock] = useState(0)
  const myBrandsFeedInFlight = useRef(false)

  /** EOA 切换或登出：从本地恢复 My Brands；无缓存则保持直至首轮拉取（不清空已有 state 除非无效 profile） */
  useLayoutEffect(() => {
    const raw = profiles?.[0]?.keyID?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      myBrandHolderUnionCardsRef.current = []
      setMyBrandCards([])
      setMyBrandCardDetails({})
      return
    }
    const hit = loadMyBrandsFeedLocalCache(eoaLower)
    if (hit) {
      myBrandHolderUnionCardsRef.current = hit.holderUnionCards
      setMyBrandCards(hit.cards)
      setMyBrandCardDetails(hit.details)
      for (const c of hit.cards) {
        const row = hit.details[c.cardAddress.toLowerCase()]
        if (row?.meta) rememberCardBasicMetadataTrusted(c.cardAddress, row.meta)
      }
    } else {
      myBrandHolderUnionCardsRef.current = []
      setMyBrandCards([])
      setMyBrandCardDetails({})
    }
  }, [profiles?.[0]?.keyID])

  const runMyBrandsFeedTick = useCallback(async (): Promise<MyBrandCardFeedDetailsMap | null> => {
    if (myBrandsFeedInFlight.current) return null
    const profile = profilesRef.current?.[0]
    if (!profile || (!profile.keyID && !profile.privateKeyArmor && !profile.aaAccount)) {
      myBrandHolderUnionCardsRef.current = []
      setMyBrandCards([])
      setMyBrandCardDetails({})
      setMyBrandsFeedLoading(false)
      return {}
    }
    myBrandsFeedInFlight.current = true
    /** 本地优先：已有列表或详情时不打「全空白 loading」，仅后台刷新（Stale-while-revalidate） */
    const hasRenderable =
      myBrandCardsRef.current.length > 0 || Object.keys(myBrandCardDetailsRef.current).length > 0
    if (!hasRenderable) {
      setMyBrandsFeedLoading(true)
    }
    try {
      const { ownerCards, holderCards, trusted, walletAssetsByCardKey, walletResolvedAaAddress } =
        await getCardsOfOwnerWithDetailsForProfile(profile)
      if (!trusted) {
        return null
      }
      setMyBrandsFeedLastConetBlock(conetBlockRef.current)
      const eoaSave = profile.keyID?.trim().toLowerCase() ?? ''
      const eoaForCoupons = profile.keyID?.trim()
      let aaForCoupons: string | null =
        profile.aaAccount && ethers.isAddress(profile.aaAccount)
          ? ethers.getAddress(profile.aaAccount)
          : null
      if (
        !aaForCoupons &&
        walletResolvedAaAddress &&
        ethers.isAddress(walletResolvedAaAddress)
      ) {
        aaForCoupons = ethers.getAddress(walletResolvedAaAddress)
      }
      if (eoaForCoupons && ethers.isAddress(eoaForCoupons)) {
        const resolvedAa = await getAAAccount(profile).catch(() => null)
        if (resolvedAa && ethers.isAddress(resolvedAa)) {
          aaForCoupons = ethers.getAddress(resolvedAa)
        }
      }
      const knownCouponCardAddresses = [...ownerCards, ...holderCards].map((c) => c.cardAddress)
      const holderOnlyAddresses = holderCards.map((c) => c.cardAddress)
      let couponRows: CardActiveIssuedCouponSeriesItem[] | null = null
      if (eoaForCoupons && ethers.isAddress(eoaForCoupons)) {
        const eoaNorm = ethers.getAddress(eoaForCoupons)
        const aaNorm =
          aaForCoupons && ethers.isAddress(aaForCoupons) ? ethers.getAddress(aaForCoupons) : null
        couponRows = await fetchOwnedCouponsFromWalletAssetsForCards(eoaNorm, null, 50).catch(
          () => null
        )
        if (!couponRows?.length) {
          couponRows = await fetchOwnedCouponsFromRecentSeriesForUser(eoaNorm, aaNorm, null, 50).catch(
            () => null
          )
        }
        if (!couponRows?.length) {
          if (holderOnlyAddresses.length > 0) {
            couponRows = await fetchOwnedCouponsForKnownCards(holderOnlyAddresses, eoaNorm, aaNorm, 50).catch(
              () => null
            )
          }
        }
        if (!couponRows?.length) {
          couponRows = await fetchMyBrandsCouponSeriesForUser(50, eoaNorm, aaNorm, knownCouponCardAddresses).catch(
            () => null
          )
        }
      }
      const couponSummaries = summarizeClaimableCouponCards(couponRows)
      const nextHolderUnionMap = new Map<string, UserCardInfo>()
      for (const c of myBrandHolderUnionCardsRef.current) {
        nextHolderUnionMap.set(c.cardAddress.toLowerCase(), c)
      }
      for (const c of holderCards) {
        nextHolderUnionMap.set(c.cardAddress.toLowerCase(), c)
      }
      for (const c of ownerCards) {
        nextHolderUnionMap.delete(c.cardAddress.toLowerCase())
      }
      const holderUnionCards = [...nextHolderUnionMap.values()]
      myBrandHolderUnionCardsRef.current = holderUnionCards
      const cards = [...ownerCards]
      const seenCards = new Set(cards.map((c) => c.cardAddress.toLowerCase()))
      for (const c of holderUnionCards) {
        const key = c.cardAddress.toLowerCase()
        if (seenCards.has(key)) continue
        seenCards.add(key)
        cards.push(c)
      }
      if (couponSummaries) {
        for (const [key, summary] of couponSummaries) {
          if (seenCards.has(key)) continue
          seenCards.add(key)
          cards.push(couponFallbackCardInfo(key, summary))
        }
      } else {
        /**
         * Coupon discovery is another remote source. If it is untrusted this round,
         * keep previously trusted coupon-only brands instead of treating the miss as empty.
         */
        for (const c of myBrandCardsRef.current) {
          const key = c.cardAddress.toLowerCase()
          if (seenCards.has(key)) continue
          const prevCoupon = myBrandCardDetailsRef.current[key]?.claimableCoupons
          if (!prevCoupon || prevCoupon.count <= 0) continue
          seenCards.add(key)
          cards.push(c)
        }
      }
      const prevCards = myBrandCardsRef.current
      const prevDetails = myBrandCardDetailsRef.current
      if (cards.length === 0) {
        if (prevCards.length > 0 || Object.keys(prevDetails).length > 0) {
          /**
           * My Brands 依赖窗口扫描 / 多源合并；周期刷新中的空结果不能作为负向删除依据。
           * 必须在 setMyBrandCards 前返回，否则 /home 会每 6s 显示/消失。
           */
          return prevDetails
        }
        if (Object.keys(prevDetails).length > 0) {
          setMyBrandCardDetails({})
        }
        if (eoaSave && ethers.isAddress(eoaSave)) {
          saveMyBrandsFeedLocalCache(eoaSave, [], [], {})
        }
        return {}
      }
      const nextSig = myBrandCardListSignature(cards)
      if (myBrandCardListSignature(prevCards) !== nextSig) {
        setMyBrandCards(cards)
      }
      const allowed = new Set(cards.map((c) => c.cardAddress.toLowerCase()))
      const next: MyBrandCardFeedDetailsMap = {}
      for (const k of allowed) {
        if (prevDetails[k]) next[k] = prevDetails[k]!
      }
      const eoaNormForCoupons =
        eoaForCoupons && ethers.isAddress(eoaForCoupons) ? ethers.getAddress(eoaForCoupons) : null
      const aaNormForCoupons =
        aaForCoupons && ethers.isAddress(aaForCoupons) ? ethers.getAddress(aaForCoupons) : null

      const resolveCouponsForCardKey = async (
        key: string,
        cardAddress: string,
        prevRow: MyBrandCardFeedDetailsMap[string] | undefined
      ): Promise<ClaimableCouponSummary | null> => {
        const batch = resolveClaimableCouponsForCard(key, couponSummaries, couponRows, prevRow)
        if (batch?.count) return batch
        if (!eoaNormForCoupons) return batch ?? prevRow?.claimableCoupons ?? null
        const fromWalletAssets = await fetchOwnedCouponsFromWalletAssetsForCards(
          eoaNormForCoupons,
          [cardAddress],
          50
        ).catch(() => null)
        if (fromWalletAssets?.length) {
          return summarizeClaimableCouponCards(fromWalletAssets)?.get(key) ?? batch ?? null
        }
        const fromRecent = await fetchOwnedCouponsFromRecentSeriesForUser(
          eoaNormForCoupons,
          aaNormForCoupons,
          [cardAddress],
          50
        ).catch(() => null)
        if (fromRecent?.length) {
          return summarizeClaimableCouponCards(fromRecent)?.get(key) ?? batch ?? null
        }
        if (fromRecent === null) {
          const cardOwned = await fetchOwnedCouponsForKnownCards(
            [cardAddress],
            eoaNormForCoupons,
            aaNormForCoupons,
            50
          ).catch(() => null)
          if (cardOwned?.length) {
            return summarizeClaimableCouponCards(cardOwned)?.get(key) ?? batch ?? null
          }
          return batch ?? prevRow?.claimableCoupons ?? null
        }
        return batch ?? null
      }

      const claimableByCardKey = new Map<string, ClaimableCouponSummary | null>()
      for (const uc of cards) {
        const key = uc.cardAddress.toLowerCase()
        claimableByCardKey.set(key, await resolveCouponsForCardKey(key, uc.cardAddress, prevDetails[key]))
      }

      await Promise.all(
        cards.map(async (uc) => {
          const key = uc.cardAddress.toLowerCase()
          const prevRow = prevDetails[key]
          const claimableCoupons = claimableByCardKey.get(key) ?? null
          const [assetsFromMyAssets, meta] = await Promise.all([
            getMyAssets(profile, uc.cardAddress).catch(() => null),
            getCardBasicMetadataStaleWhileRevalidate(uc.cardAddress).catch(() => prevRow?.meta ?? null),
          ])
          const assetsFromWallet = walletAssetsByCardKey?.[key] ?? null
          let couponsForRow = claimableCoupons ?? prevRow?.claimableCoupons ?? null
          if (!couponsForRow?.count && assetsFromMyAssets && eoaNormForCoupons) {
            const lateOwned =
              (await fetchOwnedCouponsFromWalletAssetsForCards(
                eoaNormForCoupons,
                [uc.cardAddress],
                50
              ).catch(() => null)) ??
              (await fetchOwnedCouponsFromRecentSeriesForUser(
                eoaNormForCoupons,
                aaNormForCoupons,
                [uc.cardAddress],
                50
              ).catch(() => null))
            const lateSummary = lateOwned?.length
              ? summarizeClaimableCouponCards(lateOwned)?.get(key) ?? null
              : null
            if (lateSummary?.count) couponsForRow = lateSummary
          }
          next[key] = {
            meta: meta ?? prevRow?.meta ?? null,
            assets: assetsFromMyAssets ?? assetsFromWallet ?? prevRow?.assets ?? null,
            claimableCoupons: couponsForRow,
          }
          if (meta) rememberCardBasicMetadataTrusted(uc.cardAddress, meta)
        })
      )
      if (!areMyBrandDetailsMapsEqual(prevDetails, next)) {
        setMyBrandCardDetails(next)
      }
      if (eoaSave && ethers.isAddress(eoaSave)) {
        saveMyBrandsFeedLocalCache(eoaSave, ownerCards, holderUnionCards, next)
      }
      return next
    } catch {
      /** 拉取失败：不覆盖内存/本地缓存，下一轮再试；Total Power 等用 ref 兜底 */
      return null
    } finally {
      setMyBrandsFeedLoading(false)
      myBrandsFeedInFlight.current = false
    }
  }, [])

  /** CoNET mainnet 新块：`currentBlock` + 喂料机块高元数据（时间机） */
  useEffect(() => {
    const p = conetProviderRef.current!
    const onBlock = (n: number) => {
      conetBlockRef.current = n
      setCurrentBlock(n)
    }
    p.on('block', onBlock)
    return () => {
      p.off('block', onBlock)
    }
  }, [])

  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [getAllNodes, setaAllNodes] = useState<nodes_info[]>([]);
  const [serverIpAddress, setServerIpAddress] = useState<string>(defaultContextValue.serverIpAddress);
  const [serverPort, setServerPort] = useState<string>(defaultContextValue.serverPort);
  const [serverPac, setServerPac] = useState<string>("");
  const _vpnTimeUsedInMin = useRef<number>(0);
  const [isPassportInfoPopupOpen, setIsPassportInfoPopupOpen] = useState<boolean>(false);
  const [isSelectPassportPopupOpen, setIsSelectPassportPopupOpen] = useState<boolean>(false);
  const [activePassportUpdated, setActivePassportUpdated] = useState<boolean>(false);
  const [activePassport, setActivePassport] = useState<any>(null);
  const [randomSolanaRPC, setRandomSolanaRPC] = useState<nodes_info | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isLocalProxy, setIsLocalProxy] = useState(false);
  const [paymentKind, setPaymentKind] = useState(0)
  const [successNFTID, setSuccessNFTID] = useState('0')
  const [myAddress, setMyAddress] = useState('')
  useEffect(() => {
    myAddressRef.current = myAddress
  }, [myAddress])
  const [selectedPlan, setSelectedPlan] = useState< '12' | '1' | string >('12');
  const [airdropProcess, setAirdropProcess] = useState(false)
  const [airdropSuccess, setAirdropSuccess] = useState(false)
  const [airdropTokens, setAirdropTokens] = useState(0)
  const [airdropProcessReff, setAirdropProcessReff] = useState(false)
  const [getWebFilter, setGetWebFilter] = useState(false)
  const webFilterRef=useRef(getWebFilter);
  const [switchValue, setSwitchValue] = useState(true);
  const [quickLinksShow, setQuickLinksShow] = useState(false);
  const [showReferralsInput, setShowReferralsInput] = useState(false);
  const firstLoad = useRef(true); //系统代理 第一次
  const firstLoad2 = useRef(true);  //快捷链接 第一次
  const firstLoad3 = useRef(true);  //过滤开启 第一次
  const [duplicateAccount, setDuplicateAccount] = useState(null)
  const [subscriptionVisible, setSubscriptionVisible] = useState<boolean>(false);
  const [airdropVisible, setAirdropVisible] = useState<boolean>(false);
  const [referralsVisible, setReferralsVisible] = useState<boolean>(false);
  const [passportVisible, setPassportVisible] = useState<boolean>(false);
  const [checkInVisible, setCheckInVisible] = useState<boolean>(false);
  const [genesisVisible, setGenesisVisible] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [statusVisible, setStatusVisible] = useState<boolean>(false);
  const [checkinBalanceUP, setCheckinBalanceUP] = useState<boolean>(false);
  const [ruleVisible, setRuleVisible] = useState<boolean>(false);
  const [hasNewVersion, setHasNewVersion] = useState<boolean|string>(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [beamio, setBeamio] = useState<beamio|null>(null)
  const [usdcbalance, setUsdcbalance] = useState(0)
	const [aaAccountUsdcBalance, setAaAccountUsdcBalance] = useState('0')
	const [homeTotalPowerCad, setHomeTotalPowerCad] = useState<HomeTotalPowerCad>({ whole: '0', frac: '00' })
	const [showFooter, setShowFooter] = useState(true)
	const [chatSearchOpen, setChatSearchOpen] = useState(false)
	const [secureCode, setSecureCode] = useState('')
	const [redeemCode, setRedeemCode] = useState('')
	const [ignoreUrl, setIgnoreUrl] = useState(false)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress?: string; redeemCode: string } | null>(null)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [voucherPayFromScan, setVoucherPayFromScan] = useState(false)
	const [payTag, setPayTag] = useState('')
	const [beamioUsers, setbBeamioUsers] = useState<searchResult[]>([])
	const [currencyData, setCurrencyData] = useState({
		CAD: 0,
		USD: 0,
		JPY: 0,
		CNY: 0,
		USDC: 0,
		HKD: 0,
		SGD: 0,
		EUR: 0,
		TWD: 0
	})
	const currencyDataRef = useRef(currencyData)
	useEffect(() => {
		currencyDataRef.current = currencyData
	}, [currencyData])

  const noAaRecentActivityInFlight = useRef(false)
  const [recentActivityNoAaItems, setRecentActivityNoAaItems] = useState<TxView[]>([])
  const recentActivityNoAaItemsRef = useRef<TxView[]>([])
  const recentActivityNoAaSettledRef = useRef(false)
  const [recentActivityNoAaLoading, setRecentActivityNoAaLoading] = useState(false)
  const [recentActivityNoAaError, setRecentActivityNoAaError] = useState<string | null>(null)
  useEffect(() => {
    recentActivityNoAaItemsRef.current = recentActivityNoAaItems
  }, [recentActivityNoAaItems])

  /** EOA 切换：从本地恢复 Recent Activity；无缓存则等首轮拉取 */
  useLayoutEffect(() => {
    const raw = profiles?.[0]?.keyID?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaError(null)
      setRecentActivityNoAaLoading(false)
      return
    }
    const hit = loadRecentActivityLocalCache(eoaLower)
    if (hit?.length) {
      const restored = txViewsFromLocalCache(hit)
      recentActivityNoAaSettledRef.current = true
      setRecentActivityNoAaItems(restored)
      setRecentActivityNoAaError(null)
      setRecentActivityNoAaLoading(false)
    } else {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaError(null)
    }
  }, [profiles?.[0]?.keyID])

  /** AA 检测 + indexer Recent Activity + EOA USDC + Total Power CAD；与 My Brands 同轨 6s setTimeout 链 */
  const runNoAaWalletFeedTick = useCallback(async (cardDetails: MyBrandCardFeedDetailsMap | null) => {
    if (noAaRecentActivityInFlight.current) return
    const profile = profilesRef.current?.[0]
    if (!profile?.keyID?.trim()) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaLoading(false)
      setRecentActivityNoAaError(null)
      setAaAccountUsdcBalance('0')
      setHomeTotalPowerCad({ whole: '0', frac: '00' })
      lastEoaUsdcForPowerRef.current = '0'
      lastAaUsdcForPowerRef.current = '0'
      return
    }
    const eoa = profile.keyID.trim()
    if (!ethers.isAddress(eoa)) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaLoading(false)
      setRecentActivityNoAaError(null)
      setAaAccountUsdcBalance('0')
      setHomeTotalPowerCad({ whole: '0', frac: '00' })
      lastEoaUsdcForPowerRef.current = '0'
      lastAaUsdcForPowerRef.current = '0'
      return
    }

    noAaRecentActivityInFlight.current = true
    const hasRenderableActivity =
      recentActivityNoAaItemsRef.current.length > 0 || recentActivityNoAaSettledRef.current
    if (!hasRenderableActivity) {
      setRecentActivityNoAaLoading(true)
    }
    let eoaUsdcStr = '0'
    let aaUsdcStr = '0'
    try {
      let effectiveAa: string | undefined =
        profile.aaAccount?.trim() && ethers.isAddress(profile.aaAccount.trim())
          ? ethers.getAddress(profile.aaAccount.trim())
          : undefined

      try {
        const chainAa = await getAAAccount(profile)
        const nextAa = chainAa ?? undefined
        const currentAaNorm = profile.aaAccount?.toLowerCase() ?? ''
        const nextAaNorm = nextAa?.toLowerCase() ?? ''
        if (currentAaNorm !== nextAaNorm) {
          const cur = profilesRef.current
          const temp = CoNET_Data
          if (cur && temp) {
            const nextProfiles = cur.map((p: profile, i: number) =>
              i === 0 ? { ...p, aaAccount: nextAa } : p
            )
            setProfiles(nextProfiles)
            if (temp.profiles) temp.profiles = nextProfiles
            setCoNET_Data(temp)
            await storeSystemData()
          }
        }
        effectiveAa =
          chainAa && ethers.isAddress(chainAa) ? ethers.getAddress(chainAa) : undefined
      } catch {
        if (effectiveAa) {
          try {
            const code = await baseEndpoint.getCode(effectiveAa)
            const isEOA =
              profile.keyID && effectiveAa.toLowerCase() === profile.keyID.toLowerCase()
            if (!code || code === '0x' || code.length <= 2 || isEOA) {
              const cur = profilesRef.current
              const temp = CoNET_Data
              if (cur && temp) {
                const nextProfiles = cur.map((p: profile, i: number) =>
                  i === 0 ? { ...p, aaAccount: undefined } : p
                )
                setProfiles(nextProfiles)
                if (temp.profiles) temp.profiles = nextProfiles
                setCoNET_Data(temp)
                await storeSystemData()
              }
              effectiveAa = undefined
            }
          } catch {
            /* 保持 effectiveAa */
          }
        }
      }

      const eoaAddr = ethers.getAddress(eoa)
      const accounts: string[] = [eoaAddr]
      if (effectiveAa && effectiveAa.toLowerCase() !== eoaAddr.toLowerCase()) {
        accounts.push(effectiveAa)
      }
      const ma = myAddressRef.current?.trim()
      if (ma && ethers.isAddress(ma)) {
        const maAddr = ethers.getAddress(ma)
        if (!accounts.some((a) => a.toLowerCase() === maAddr.toLowerCase())) {
          accounts.push(maAddr)
        }
      }
      const eoaSave = eoa.toLowerCase()
      const { items, error, trusted } = await fetchMergedRecentActivityFromIndexer(accounts)
      if (trusted) {
        recentActivityNoAaSettledRef.current = true
        const prevItems = recentActivityNoAaItemsRef.current
        if (items.length === 0 && prevItems.length > 0) {
          /**
           * Recent Activity 是不可变历史。周期刷新中的空列表不能负向覆盖已有历史，
           * 否则 /home 会每 6s 在 loading 与旧数据之间闪动。
           */
        } else if (shouldUpdateRecentActivityList(prevItems, items)) {
          setRecentActivityNoAaItems(items)
        }
        setRecentActivityNoAaError(null)
        if (items.length > 0 && eoaSave && ethers.isAddress(eoaSave)) {
          saveRecentActivityLocalCache(eoaSave, items)
        }
      } else if (!hasRenderableActivity && error) {
        setRecentActivityNoAaError(error)
      }

      try {
        const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
        const eoaRaw = await usdcContract.balanceOf(eoaAddr)
        eoaUsdcStr = ethers.formatUnits(eoaRaw, 6)
        setUsdcbalance(parseFloat(eoaUsdcStr) || 0)
      } catch (e) {
        if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
        if (!isRpcDegraded()) {
          const bal = await getUsdcBalanceFromApi(eoaAddr)
          if (bal != null) {
            eoaUsdcStr = bal
            setUsdcbalance(parseFloat(bal) || 0)
          }
        }
      }

      if (!effectiveAa || effectiveAa.toLowerCase() === eoaAddr.toLowerCase()) {
        aaUsdcStr = '0'
        setAaAccountUsdcBalance('0')
      } else {
        try {
          const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
          const balanceRaw = await usdcContract.balanceOf(effectiveAa)
          aaUsdcStr = ethers.formatUnits(balanceRaw, 6)
          setAaAccountUsdcBalance(aaUsdcStr)
        } catch (e) {
          if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
          if (!isRpcDegraded()) {
            const bal = await getUsdcBalanceFromApi(effectiveAa)
            if (bal != null) {
              aaUsdcStr = bal
              setAaAccountUsdcBalance(bal)
            }
          }
        }
      }

      lastEoaUsdcForPowerRef.current = eoaUsdcStr
      lastAaUsdcForPowerRef.current = aaUsdcStr
      const detailsForPower = cardDetails ?? myBrandCardDetailsRef.current
      setHomeTotalPowerCad(
        computeHomeTotalPowerCad(eoaUsdcStr, aaUsdcStr, detailsForPower, currencyDataRef.current)
      )
    } finally {
      setRecentActivityNoAaLoading(false)
      noAaRecentActivityInFlight.current = false
    }
  }, [setProfiles])

  /** Oracle（currencyData）刷新后立即用上次链上余额重算 Total Power CAD，不必等下一轮 6s */
  useEffect(() => {
    const profile = profilesRef.current?.[0]
    if (!profile?.keyID?.trim()) {
      setHomeTotalPowerCad({ whole: '0', frac: '00' })
      return
    }
    setHomeTotalPowerCad(
      computeHomeTotalPowerCad(
        lastEoaUsdcForPowerRef.current,
        lastAaUsdcForPowerRef.current,
        myBrandCardDetailsRef.current,
        currencyData
      )
    )
  }, [currencyData])

  const runGlobalWalletFeedTick = useCallback(async () => {
    const cardDetails = await runMyBrandsFeedTick()
    await runNoAaWalletFeedTick(cardDetails)
  }, [runMyBrandsFeedTick, runNoAaWalletFeedTick])

  const refreshRecentActivityNoAa = useCallback(async () => {
    const cardDetails = await runMyBrandsFeedTick()
    await runNoAaWalletFeedTick(cardDetails)
  }, [runMyBrandsFeedTick, runNoAaWalletFeedTick])

  /** My Brands + Recent Activity（EOA+AA 合并）：setTimeout 串行链，每轮 await 结束后再排 6s */
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const runChain = () => {
      if (cancelled) return
      void (async () => {
        await runGlobalWalletFeedTick()
        if (!cancelled) {
          timer = window.setTimeout(runChain, MY_BRANDS_FEED_INTERVAL_MS) as unknown as number
        }
      })()
    }
    runChain()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [runGlobalWalletFeedTick])

  const walletFeedProfileKeyId = profiles?.[0]?.keyID
  const walletFeedProfileAa = profiles?.[0]?.aaAccount
  const walletFeedProfilePk = profiles?.[0]?.privateKeyArmor
  useEffect(() => {
    void runGlobalWalletFeedTick()
  }, [walletFeedProfileKeyId, walletFeedProfileAa, walletFeedProfilePk, myAddress, runGlobalWalletFeedTick])

  useEffect(() => {
    const pac = `http://${serverIpAddress}:${serverPort}/pac`
    setServerPac(pac)
  }, [serverIpAddress, serverPort])

  useEffect(()=>{
    let storage = window.localStorage;
    const systemProxy=(storage&&storage.systemProxy?JSON.parse(storage.systemProxy):true);
    setSwitchValue(systemProxy);

    const webFilter=(storage&&storage.webFilter?JSON.parse(storage.webFilter):false);
    setGetWebFilter(webFilter);

    const LOCAL_SHOW_KEY = 'silentpass_shortcut_show';
    const isShowLinks=(storage&&storage[LOCAL_SHOW_KEY]?JSON.parse(storage[LOCAL_SHOW_KEY]):false);
    setQuickLinksShow(isShowLinks);
  },[])

  useEffect(()=>{
    if(!firstLoad.current){
      let storage = window.localStorage;
      storage.systemProxy=JSON.stringify(switchValue);
    }
    firstLoad.current=false;
  },[switchValue])

  useEffect(()=>{
    if(!firstLoad3.current){
      let storage = window.localStorage;
      webFilterRef.current=getWebFilter;
      storage.webFilter=JSON.stringify(getWebFilter);
    }
    firstLoad3.current=false;
  },[getWebFilter])

  useEffect(()=>{
    if(!firstLoad2.current){
      const LOCAL_SHOW_KEY = 'silentpass_shortcut_show';
      let storage = window.localStorage;
      storage[LOCAL_SHOW_KEY]=JSON.stringify(quickLinksShow);
    }
    firstLoad2.current=false;
  },[quickLinksShow])

  /** 全局 Oracle 喂料器：启动时拉取一次，之后每 5 分钟刷新，供应所有页面 */
  const fetchOracle = useCallback(async () => {
    const data = await getOracle()
    setCurrencyData(parseOracleToCurrencyData(data))
  }, [])

  const refreshOracle = useCallback(() => {
    fetchOracle()
  }, [fetchOracle])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const runOracleChain = () => {
      if (cancelled) return
      void (async () => {
        try {
          await fetchOracle()
        } finally {
          if (!cancelled) {
            timer = window.setTimeout(runOracleChain, ORACLE_REFRESH_MS) as unknown as number
          }
        }
      })()
    }
    runOracleChain()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [fetchOracle])

  return (
    <Daemon.Provider value={{ power, setPower, sRegion, setSRegion, allRegions, setAllRegions, setRuleVisible,hasNewVersion, setHasNewVersion, version, secureCode, setSecureCode,
				closestRegion, setClosestRegion, isRandom, setIsRandom, miningData, setMiningData, currentBlock,setCurrentBlock,paymentLink, setPaymentLink, redeemCode, setRedeemCode,
				profiles, setProfiles, isMiningUp, setIsMiningUp, getAllNodes, setaAllNodes, serverIpAddress,darkModle, setDarkModle, beamioAppInstalled, setBeamioAppInstalled,
				setServerIpAddress, serverPort, setServerPort, serverPac, setServerPac, _vpnTimeUsedInMin, privacyMode, setPrivacyMode, ignoreUrl, setIgnoreUrl, 				paymentLinkCode, setPaymentLinkCode, redeemFromUrl, setRedeemFromUrl, redeemResult, setRedeemResult, voucherPayFromScan, setVoucherPayFromScan,
				isPassportInfoPopupOpen, setIsPassportInfoPopupOpen, activePassportUpdated, setActivePassportUpdated,beamio, setBeamio,payTag, setPayTag, myAddress, setMyAddress,
				activePassport, setActivePassport, isSelectPassportPopupOpen, setIsSelectPassportPopupOpen, showReferralsInput, setShowReferralsInput, usdcToUSD, setUsdcToUSD,
				setRandomSolanaRPC, randomSolanaRPC, isIOS, setIsIOS, isLocalProxy, setIsLocalProxy, globalProxy, setGlobalProxy,usdcbalance, setUsdcbalance, aaAccountUsdcBalance, homeTotalPowerCad, currencyData, setCurrencyData, refreshOracle,
				paymentKind, setPaymentKind, successNFTID, setSuccessNFTID, selectedPlan, setSelectedPlan, airdropProcess, setAirdropProcess,sendToMemo, setSendToMemo, charts, setCharts,
				airdropSuccess, setAirdropSuccess, airdropTokens, setAirdropTokens, airdropProcessReff, setAirdropProcessReff, getWebFilter, listenningProcess, setListenningProcess,
				myBrandCards, myBrandCardDetails, myBrandsFeedLoading, myBrandsFeedLastConetBlock,
				recentActivityNoAaItems, recentActivityNoAaLoading, recentActivityNoAaError, refreshRecentActivityNoAa,
				setGetWebFilter,switchValue, setSwitchValue, webFilterRef, quickLinksShow, setQuickLinksShow, duplicateAccount, checkinBalanceUP, setCheckinBalanceUP, gossip, setGossip,
				beamioUsers, setbBeamioUsers, showFooter, setShowFooter, chatSearchOpen, setChatSearchOpen, payMePayment, setPayMePayment, navigateLeftButtonArray, setNavigateLeftButtonArray, allNodes, setAllNodes,
				chatHomeItem,setChatHomeItem,scanData, setScanData, scanIntent, setScanIntent, voucherPayAmount, setVoucherPayAmount, voucherPayToAA, setVoucherPayToAA, voucherPayError, setVoucherPayError, messageCount, setMessageCount, msgCountLockRef, seenMsgRef, scanRef, historyPayData, setHistoryPayData,
        		setDuplicateAccount,subscriptionVisible, setSubscriptionVisible, airdropVisible, setAirdropVisible, referralsVisible, setReferralsVisible, passportVisible, 
				setPassportVisible, checkInVisible, setCheckInVisible, genesisVisible, setGenesisVisible, isInitialLoading, setIsInitialLoading, statusVisible, setStatusVisible, ruleVisible }}>
			{/* ✅ 常驻隐藏扫码组件：不占布局，但随时可 start */}
			<div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
			<ScanButton ref={scanRef} hidden />
			</div>
			{/* h-full 确保 App 获得明确高度，修复 Android WebView 中主内容不可见 */}
			<div className="h-full min-h-0 flex flex-col">
      {children}
			</div>
    </Daemon.Provider>
  );
}
