import React, { createContext, useContext, ReactNode, useState, useEffect, useLayoutEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import packageData from '../../package.json'
import ScanButton, { type  ScanButtonHandle } from "@/components/scanBtn/ScanButton"
import { applyBeamioUiLanguageFromProfile } from '@/locale/i18n'
import { ethers } from 'ethers'
import {
	getCardsOfOwnerWithDetailsForProfile,
	fetchMyBrandsCouponSeriesForUser,
	fetchMyBrandsProductionSeriesForUser,
	fetchOwnedCouponsForKnownCards,
	fetchOwnedCouponsFromRecentSeriesForUser,
	fetchOwnedCouponsFromWalletAssetsForCards,
	isCardExcludedFromDisplay,
	filterDisplayUserCards,
	loadApiExcludedUserCards,
	getMyAssets,
	getCardBasicMetadataStaleWhileRevalidate,
	getAAAccount,
	resolveMyCardAssetsForFeedRow,
	myCardAssetsHasHoldings,
	refreshCouponOpenClaimChainStatus,
	type UserCardInfo,
	type CardActiveIssuedCouponSeriesItem,
} from '@/services/BeamioCard'
import {
	buildCouponOpenClaimStatusKey,
	loadCouponOpenClaimStatusMapForEoa,
	pickCouponOpenClaimStatusFromMap,
	saveCouponOpenClaimLocalStatus,
	type CouponOpenClaimFeedTarget,
	type CouponOpenClaimLocalEntry,
	type CouponOpenClaimLocalStatus,
	type CouponOpenClaimStatusMap,
} from '@/utils/couponOpenClaimStatusLocalCache'
import { fetchCouponSocialStatsBundle } from '@/utils/couponSocialStats'
import {
	buildCouponSocialStatKey,
	formatCouponSupplySummaryFromStat,
	loadCouponSocialStatsLocalCache,
	mergeCouponSocialLikeCount,
	pickCouponSocialStatFromMap,
	saveCouponSocialStatEntry,
	type CouponSocialStatEntry,
	type CouponSocialStatsMap,
} from '@/utils/couponSocialStatsLocalCache'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
import { fetchMyBrandsCardAssetsBatch } from '@/utils/myBrandsDashboard'
import {
	enrichMerchantChargeItemsWithIndexerRoutes,
	fetchMergedRecentActivityFromIndexer,
	filterRecentActivityExcludedBunitRows,
	mergeChargeRouteEnrichmentIntoTxViews,
	RECENT_ACTIVITY_DAEMON_MONTH_LOOKBACK,
	type TxView,
} from '@/pages/History/recentActivityIndexerMerge'
import {
  loadMyBrandsFeedLocalCache,
  saveMyBrandsFeedLocalCache,
  type MyBrandsOwnedCouponSnapshot,
} from '@/utils/myBrandsFeedLocalCache'
import { filterExcludedCardDetailKeys } from '@/utils/apiExcludedUserCards'
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
import { subscribeCardBasicMetadataUpdates } from '@/utils/cardBasicMetadataGlobalCache'
import { mergeRicherMerchantCardMeta } from '@/utils/mergeRicherMerchantCardMeta'
import { clearWalletMerchantPassStackDisplayCache } from '@/pages/Wallet/walletMerchantPassDisplayCache'
import {
	summarizeOwnedCatalogCards,
	type OwnedCatalogSummary,
} from '@/utils/myBrandsOwnedCatalog'
import {
	syncNativeFooterChatBadge,
} from '@/utils/cashTreesNativeAppStateBridge'
import { ensureCashTreesAppLifecycleTracking } from '@/utils/cashTreesAppLifecycle'
import { syncChatBadgeToApi } from '@/utils/cashTreesPushBind'
import { CONET_RPC_URL } from '@/config/chainAddresses'
import {
	initAppDaemonWorker,
	onAppDaemonCouponOpenClaim,
	onAppDaemonCouponSocial,
	onAppDaemonDiscoverMerchantStats,
	onAppDaemonL0StartKit,
	onAppDaemonMiningStats,
	onAppDaemonNeedMainTick,
	onAppDaemonOracleRates,
	onAppDaemonReferrerSummary,
	onAppDaemonUnifiedIncome,
	onAppDaemonValidatorProfile,
	onAppDaemonWalletBalances,
	onAppDaemonBaseUsdcBalances,
	registerAppDaemonCouponTargets,
	registerAppDaemonDiscoverCards,
	registerAppDaemonGenesisAccounts,
	refreshAppDaemonNow,
	setAppDaemonSession,
} from '@/services/appDaemonWorkerBridge'
import type { AppDaemonMainTickKind } from '@/workers/appDaemon/protocol'
import {
	type ConetNetworkStats,
	type ConetDepinStats,
} from '@/services/conetNetworkStats'
import {
	loadConetMiningStatsLocalCache,
	saveConetMiningStatsLocalCache,
	CONET_MINING_STATS_SEED,
} from '@/utils/conetMiningStatsLocalCache'
import {
	fetchDiscoverMerchantDbShareClickTotal,
	fetchDiscoverMerchantLikeCount,
	fetchDiscoverMerchantRefClickCount,
} from '@/utils/discoverMerchantLikeCount'
import {
  loadDiscoverMerchantStatsLocalCache,
  mergeDiscoverMerchantLikeCount,
  mergeDiscoverMerchantRefClickCount,
  saveDiscoverMerchantStatEntry,
	type DiscoverMerchantStatEntry,
	type DiscoverMerchantStatsMap,
} from '@/utils/discoverMerchantStatsLocalCache'
import {
	fetchConetWalletBalances,
	type ConetWalletBalances,
} from '@/services/conetUsdcBalance'
import {
	fetchValidatorWalletNodeProfile,
	fetchUnifiedIncomeStats,
	type ValidatorWalletNodeProfile,
	type UnifiedIncomeStats,
	type ReferrerDashboardSummary,
} from '@/services/validatorWalletNodeProfile'
import {
	peekValidatorWalletNodeProfileCache,
	seedValidatorWalletNodeProfileCache,
} from '@/hooks/useValidatorWalletNodeProfile'
import {
	peekUnifiedIncomeStatsCache,
	seedUnifiedIncomeStatsCache,
} from '@/hooks/useUnifiedIncomeStats'
import {
	peekReferrerSummaryCache,
	seedReferrerSummaryCache,
	fetchReferrerSummaryForDaemon,
} from '@/hooks/useReferrerSummary'
import {
	loadConetWalletBalancesLocalCache,
	saveConetWalletBalancesLocalCache,
	EMPTY_CONET_WALLET_BALANCES,
} from '@/utils/conetWalletBalancesLocalCache'
import {
	loadBaseUsdcBalanceLocalCache,
	saveBaseUsdcBalanceLocalCache,
} from '@/utils/baseUsdcBalanceLocalCache'
import {
	clearReferralL0StartKitQuotaLocalCache,
	fetchReferralL0StartKitQuotaFeed,
	loadReferralL0StartKitQuotaLocalCache,
	saveReferralL0StartKitQuotaLocalCache,
	type ReferralL0StartKitQuota,
} from '@/services/referralL0StartKitQuotaFeed'
import {
	readCachedGenesisIncome,
	runGenesisIncomeFeedForAccount,
	type GenesisIncomeSnapshot,
} from '@/services/genesisNodeReferral'
import {
	runAaInstitutionalV2PendingTasksDaemonTick,
} from '@/utils/aaInstitutionalV2PendingDaemon'
import {
	runAaMultisigInstitutionalAssetsDaemonTick,
} from '@/utils/aaMultisigInstitutionalAssetsDaemon'
import {
	loadInstitutionalAaAssetsLocalCache,
	type InstitutionalAaAssetsByAa,
} from '@/utils/aaMultisigInstitutionalAssetsLocalCache'
import type { AaMultisigTransferAssetOption } from '@/utils/aaMultisigConetTransferAssets'
import { viewerNeedsToSignMultisigTask } from '@/utils/aaMultisigTaskUi'
import { loadAllAaMultisigTasksForWallet } from '@/utils/aaMultisigLocalStore'

const EMPTY_INSTITUTIONAL_AA_ASSETS: AaMultisigTransferAssetOption[] = []

export type { MyBrandCardFeedDetailsMap }

type ClaimableCouponSummary = {
  count: number
  firstTitle?: string
  firstCoupon?: MyBrandsOwnedCouponSnapshot | null
  coupons?: MyBrandsOwnedCouponSnapshot[]
}

/** Trusted empty owned-coupon summary (balance/redeem cleared). Distinct from `null` = untrusted miss. */
const EMPTY_OWNED_COUPON_SUMMARY: ClaimableCouponSummary = {
	count: 0,
	firstTitle: undefined,
	firstCoupon: null,
	coupons: [],
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

function summarizeOwnedCouponsForCardKey(
	rows: CardActiveIssuedCouponSeriesItem[] | null,
	cardKey: string,
): ClaimableCouponSummary | null {
	if (rows === null) return null
	return summarizeClaimableCouponCards(rows)?.get(cardKey) ?? EMPTY_OWNED_COUPON_SUMMARY
}

/** Drop My Brands owned coupons already marked redeemed in Coupons global status map. */
function pruneRedeemedOwnedCouponsFromDetails(
	details: MyBrandCardFeedDetailsMap,
	statusMap: CouponOpenClaimStatusMap,
): MyBrandCardFeedDetailsMap {
	let changed = false
	const next: MyBrandCardFeedDetailsMap = { ...details }
	for (const [cardKey, row] of Object.entries(details)) {
		const summary = row?.claimableCoupons
		if (!summary?.count) continue
		let list = [...(summary.coupons ?? [])]
		if (list.length === 0 && summary.firstCoupon) list = [summary.firstCoupon]
		const kept = list.filter((c) => {
			const st = pickCouponOpenClaimStatusFromMap(statusMap, c.cardAddress || cardKey, c.tokenId)
			return st?.status !== 'redeemed'
		})
		if (kept.length === list.length) continue
		changed = true
		next[cardKey] = {
			...row!,
			claimableCoupons: {
				count: kept.length,
				firstTitle: kept[0]?.title,
				firstCoupon: kept[0] ?? null,
				coupons: kept,
			},
		}
	}
	return changed ? next : details
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
	/** Trusted fetch with no owned rows for this card → clear, do not keep redeemed cache. */
	return couponSummaries.get(cardKey) ?? EMPTY_OWNED_COUPON_SUMMARY
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

function catalogFallbackCardInfo(cardAddressLower: string, summary: OwnedCatalogSummary): UserCardInfo {
	return {
		cardAddress: ethers.getAddress(cardAddressLower),
		name: summary.firstTitle ? 'Merchant catalog' : 'Catalog item',
		currency: 'CAD',
		priceE6: '1000000',
		ptsPer1Currency: '1',
	}
}

function resolveOwnedCatalogsForCard(
	cardKey: string,
	catalogSummaries: Map<string, OwnedCatalogSummary> | null,
	catalogRows: CardActiveIssuedCouponSeriesItem[] | null,
	prevRow: MyBrandCardFeedDetailsMap[string] | undefined
): OwnedCatalogSummary | null {
	if (catalogSummaries === null || catalogRows === null) {
		return prevRow?.ownedCatalogs ?? null
	}
	return catalogSummaries.get(cardKey) ?? null
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
	for (const [cardKey, entry] of Object.entries(cardDetails)) {
		if (isCardExcludedFromDisplay(cardKey)) continue
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
	/** 全局 My Brands 喂料：CoNET `block` 写入 conetBlockRef；每 6s setTimeout 链串行拉取用户 BeamioUserCard（勿用每块 setState 广播，否则 /home 文字抖动） */
	myBrandCards: UserCardInfo[]
	myBrandCardDetails: MyBrandCardFeedDetailsMap
	myBrandsFeedLoading: boolean
	myBrandsFeedLastConetBlock: number
	/** 全局喂料写入：EOA + 独立 AA（若存在）合并拉取、按时间倒序；overrideAddress 调试场景外均由面板读此数据 */
	recentActivityNoAaItems: TxView[]
	recentActivityNoAaSettled: boolean
	recentActivityNoAaLoading: boolean
	recentActivityNoAaError: string | null
	refreshRecentActivityNoAa: () => Promise<void>
	/**
	 * CoNET Mining dashboard 全网指标（L1 验证节点 / CONET 增发 + DePIN 节点 / GB 总产量）。
	 * 由全局 background daemon 刷新；本地优先（首屏即有 seed/缓存值，永不 `—`、永不 loading）。
	 */
	conetNetworkStats: ConetNetworkStats
	conetDepinStats: ConetDepinStats
	/** CoNET L1 钱包 USDC / CNET / GB；本地优先，全局 daemon 每 6s 刷新 */
	conetWalletBalances: ConetWalletBalances
	/** CoNET Smart Wallet（AA）USDC / CNET / GB；本地优先，全局 daemon 每 6s 刷新 */
	conetAaWalletBalances: ConetWalletBalances
	/** 用户 Validator / DePIN 节点档案；本地优先，全局 daemon 每 6s 刷新 */
	validatorWalletNodeProfile: ValidatorWalletNodeProfile | null
	/** 用户 CoNET Mining 收益（resolveUnifiedIncomeStats）；本地优先，全局 daemon 每 6s 刷新 */
	unifiedIncomeStats: UnifiedIncomeStats | null
	/** 用户 Genesis Node 推荐进度（ValidatorDepositRedeem referrer extension）；本地优先，daemon 每 6s 刷新 */
	referrerSummary: ReferrerDashboardSummary | null
	/**
	 * L0 Start Kit remaining（merchantQuotas）；仅当前 EOA 为 L0 时有值。
	 * 本地优先 + 全局钱包 feeder 串行刷新；页面只读，勿在页面内自建轮询。
	 */
	referralL0StartKitQuota: ReferralL0StartKitQuota | null
	/** 发行 Start Kit / Admin 改配额后强制刷新（仍走同一 trusted fetch） */
	refreshReferralL0StartKitQuota: () => Promise<void>
	/**
	 * Genesis Partnership purchase history（EOA → semi-permanent local ledger）.
	 * Daemon 只拉 `sinceMs` 增量；页面只读本地 / 本 map，勿全量轮询 API。
	 */
	genesisIncomeByEoa: Record<string, GenesisIncomeSnapshot>
	/** 注册需守护的钱包（当前用户 + Downstream partners）；合并去重 */
	registerGenesisIncomeFeedAccounts: (accounts: string[]) => void
	/** 手动触发一轮增量同步（仍 trusted-only merge） */
	refreshGenesisIncomeFeed: () => Promise<void>
	/** Discover Featured Brands 链上点赞 / 转发点击；localStorage 首屏 + daemon 30s 刷新 */
	discoverMerchantStatByCard: DiscoverMerchantStatsMap
	/** Market 注册需刷新的商户卡地址（来自 trusted `/api/latestCards`） */
	registerDiscoverMerchantStatFeedCards: (cardAddresses: string[]) => void
	/** Like/unlike API 成功后乐观更新点赞数（链上 totalSupply 确认前） */
	applyDiscoverMerchantLikeCountDelta: (cardAddress: string, delta: number) => void
	/**
	 * Coupons open-claim claimed/redeemed（按 card:tokenId）。
	 * 首屏从 EOA localStorage hydrate；daemon 30s 链上刷新；页面只读，勿自建 localStorage 键。
	 */
	couponOpenClaimStatusByKey: CouponOpenClaimStatusMap
	/** Discover / Active Coupons 等注册需刷新的 (card, tokenId) */
	registerCouponOpenClaimFeedTargets: (targets: CouponOpenClaimFeedTarget[]) => void
	/** Claim queued / chain confirmed：写本地库并更新 daemon map（所有 Coupons UI 共享） */
	applyCouponOpenClaimStatus: (params: {
		cardAddress: string
		tokenId: string | number | bigint
		couponId?: string | null
		status: CouponOpenClaimLocalStatus
		source: 'optimistic' | 'chain'
	}) => void
	/** 取某一 coupon 的 claimed/redeemed 条目（内存 map） */
	getCouponOpenClaimStatus: (
		cardAddress: string | null | undefined,
		tokenId: string | number | bigint | null | undefined,
	) => CouponOpenClaimLocalEntry | null
	/** 手动触发一轮 Coupons 状态链上刷新 */
	refreshCouponOpenClaimStatusFeed: () => Promise<void>
	/**
	 * Coupons 社交 + 库存（点赞 / 分享点击 / TOTAL·LEFT），按 card:tokenId。
	 * 本地优先 + daemon 30s 链上刷新；页面只读。
	 */
	couponSocialStatByKey: CouponSocialStatsMap
	/** 与 open-claim 共用 feed targets；Discover / ticket 注册即可 */
	registerCouponSocialFeedTargets: (targets: CouponOpenClaimFeedTarget[]) => void
	getCouponSocialStat: (
		cardAddress: string | null | undefined,
		tokenId: string | number | bigint | null | undefined,
	) => CouponSocialStatEntry | null
	/** TOTAL n · LEFT m 文案（daemon 库存优先） */
	formatCouponSupplySummary: (
		cardAddress: string | null | undefined,
		tokenId: string | number | bigint | null | undefined,
	) => string | null
	/** Like API 成功后乐观 +1 */
	applyCouponSocialLikeCountDelta: (
		cardAddress: string,
		tokenId: string | number | bigint,
		delta: number,
	) => void
	refreshCouponSocialStatsFeed: () => Promise<void>
	/**
	 * Institutional AA V2：当前 EOA 作为共同签署者仍需投票的 pending task 数。
	 * 由全局 daemon 拉取链上 task → 本地 store；页面只读，勿自建轮询。
	 */
	aaV2PendingNeedVoteCount: number
	/** 手动触发一轮 V2 pending task 拉取（propose/vote 后可调用） */
	refreshAaV2PendingTasks: () => Promise<void>
	/**
	 * Smart Wallet Multisig 列表项资产余额（按 AA）；本地优先 + 30s daemon。
	 * 页面只读；勿在 item 内自建 fetch。
	 */
	institutionalAaAssetsByAa: InstitutionalAaAssetsByAa
	/** 手动刷新（创建 AA / Transfer 成功后）；可传指定 AA 列表 */
	refreshInstitutionalAaAssets: (aaAccounts?: string[]) => Promise<void>
	/** 取某一 AA 的资产选项（内存 map，缺省为空数组） */
	getInstitutionalAaAssets: (aaAccount: string) => AaMultisigTransferAssetOption[]
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
  /** Base USDC (EOA); Worker 6s feeder + local cache. Local-first. */
  usdcbalance : number

  setUsdcbalance: (val: number) => void
	usdcToUSD: number
	setUsdcToUSD: (val: number) => void
	/** Base 上 Beamio AA 的 USDC 余额（`ethers.formatUnits(..., 6)` 字符串）；由 Worker 6s Base USDC feeder 更新 */
	aaAccountUsdcBalance: string
	/** /home Total Power：EOA+AA Base USDC + 全部 BeamioUserCard points，Oracle（currencyData）折 CAD */
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
	recentActivityNoAaSettled: false,
	recentActivityNoAaLoading: false,
	recentActivityNoAaError: null,
	refreshRecentActivityNoAa: async () => {},
	conetNetworkStats: CONET_MINING_STATS_SEED.network,
	conetDepinStats: CONET_MINING_STATS_SEED.depin,
	conetWalletBalances: EMPTY_CONET_WALLET_BALANCES,
	conetAaWalletBalances: EMPTY_CONET_WALLET_BALANCES,
	validatorWalletNodeProfile: null,
	unifiedIncomeStats: null,
	referrerSummary: null,
	referralL0StartKitQuota: null,
	refreshReferralL0StartKitQuota: async () => {},
	genesisIncomeByEoa: {},
	registerGenesisIncomeFeedAccounts: () => {},
	refreshGenesisIncomeFeed: async () => {},
	discoverMerchantStatByCard: {},
	applyDiscoverMerchantLikeCountDelta: () => {},
	registerDiscoverMerchantStatFeedCards: () => {},
	couponOpenClaimStatusByKey: {},
	registerCouponOpenClaimFeedTargets: () => {},
	applyCouponOpenClaimStatus: () => {},
	getCouponOpenClaimStatus: () => null,
	refreshCouponOpenClaimStatusFeed: async () => {},
	couponSocialStatByKey: {},
	registerCouponSocialFeedTargets: () => {},
	getCouponSocialStat: () => null,
	formatCouponSupplySummary: () => null,
	applyCouponSocialLikeCountDelta: () => {},
	refreshCouponSocialStatsFeed: async () => {},
	aaV2PendingNeedVoteCount: 0,
	refreshAaV2PendingTasks: async () => {},
	institutionalAaAssetsByAa: {},
	refreshInstitutionalAaAssets: async () => {},
	getInstitutionalAaAssets: () => EMPTY_INSTITUTIONAL_AA_ASSETS,

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

	useEffect(() => {
		ensureCashTreesAppLifecycleTracking()
	}, [])

	/**
	 * Footer `/chat` → native icon badge. API unread sync is DB-only (no alert).
	 * System push is SI mailbox → APNs/FCM only — do not also ask native for a local
	 * `notifyBackgroundChat` (that caused double notifications while listen was alive).
	 */
	useEffect(() => {
		syncNativeFooterChatBadge(messageCount)
		void syncChatBadgeToApi(messageCount)
	}, [messageCount])

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
  const profileWalletKeyId = profiles?.[0]?.keyID
  const profilesRef = useRef(profiles)
  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])
  const myAddressRef = useRef('')

  const [currentBlock, setCurrentBlock] = useState(0)

  const conetProviderRef = useRef<ethers.JsonRpcProvider | null>(null)
  if (!conetProviderRef.current) {
    conetProviderRef.current = new ethers.JsonRpcProvider(CONET_RPC_URL)
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

  /**
   * SWR refreshes card metadata into the global cache without rewriting My Brands state.
   * When tier.image / imageFit changes, patch the in-memory feed so /wallet pass updates.
   */
  useEffect(() => {
    return subscribeCardBasicMetadataUpdates((cardLower, meta) => {
      setMyBrandCardDetails((prev) => {
        const row = prev[cardLower]
        if (!row) return prev
        const mergedMeta = mergeRicherMerchantCardMeta(row.meta, meta) ?? meta
        const next: MyBrandCardFeedDetailsMap = {
          ...prev,
          [cardLower]: { ...row, meta: mergedMeta },
        }
        if (areMyBrandDetailsMapsEqual(prev, next)) return prev
        myBrandCardDetailsRef.current = next
        clearWalletMerchantPassStackDisplayCache()
        const eoa = profileWalletKeyId?.trim().toLowerCase() ?? ''
        if (eoa && ethers.isAddress(eoa)) {
          saveMyBrandsFeedLocalCache(
            eoa,
            filterDisplayUserCards(myBrandCardsRef.current),
            filterDisplayUserCards(myBrandHolderUnionCardsRef.current),
            next
          )
        }
        return next
      })
    })
  }, [profileWalletKeyId])

  const lastEoaUsdcForPowerRef = useRef('0')
  const lastAaUsdcForPowerRef = useRef('0')
  const [myBrandsFeedLoading, setMyBrandsFeedLoading] = useState(false)
  const [myBrandsFeedLastConetBlock, setMyBrandsFeedLastConetBlock] = useState(0)
  const myBrandsFeedInFlight = useRef(false)
  const registerCouponOpenClaimFeedTargetsRef = useRef<
    ((targets: CouponOpenClaimFeedTarget[]) => void) | null
  >(null)

  /** EOA 切换或登出：先拉 blacklist，再从本地恢复 My Brands（避免缓存先展示废弃卡）。 */
  useEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      myBrandHolderUnionCardsRef.current = []
      setMyBrandCards([])
      setMyBrandCardDetails({})
      return
    }
    let cancelled = false
    void (async () => {
      await loadApiExcludedUserCards()
      if (cancelled) return
      const hit = loadMyBrandsFeedLocalCache(eoaLower)
      if (hit) {
        const cards = filterDisplayUserCards(hit.cards)
        const statusMap = loadCouponOpenClaimStatusMapForEoa(eoaLower)
        const details = pruneRedeemedOwnedCouponsFromDetails(
          filterExcludedCardDetailKeys(hit.details),
          statusMap,
        )
        myBrandHolderUnionCardsRef.current = filterDisplayUserCards(hit.holderUnionCards)
        setMyBrandCards(cards)
        setMyBrandCardDetails(details)
        // Do not rememberCardBasicMetadataTrusted(LS meta) here — that re-poisons the global
        // card-basic cache with stale tier.image / imageFit and races awaitFresh feed ticks.
      } else {
        myBrandHolderUnionCardsRef.current = []
        setMyBrandCards([])
        setMyBrandCardDetails({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileWalletKeyId])

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
    /** 空列表不进入 loading；仅有数据时后台刷新也不闪 loading（Stale-while-revalidate） */
    try {
      await loadApiExcludedUserCards()
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
      if (!aaForCoupons && eoaForCoupons && ethers.isAddress(eoaForCoupons)) {
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
        /**
         * My Brands Coupons = held redeemable NFTs only (balance > 0).
         * Trusted empty (`[]`) must not fall through to another source that can revive redeemed rows.
         * Only `null` (untrusted) continues the cascade.
         */
        couponRows = await fetchOwnedCouponsFromWalletAssetsForCards(eoaNorm, null, 50).catch(
          () => null
        )
        if (couponRows === null) {
          couponRows = await fetchOwnedCouponsFromRecentSeriesForUser(eoaNorm, aaNorm, null, 50).catch(
            () => null
          )
        }
        if (couponRows === null && holderOnlyAddresses.length > 0) {
          couponRows = await fetchOwnedCouponsForKnownCards(holderOnlyAddresses, eoaNorm, aaNorm, 50).catch(
            () => null
          )
        }
        if (couponRows === null) {
          couponRows = await fetchMyBrandsCouponSeriesForUser(50, eoaNorm, aaNorm, knownCouponCardAddresses).catch(
            () => null
          )
        }
      }
      let catalogRows: CardActiveIssuedCouponSeriesItem[] | null = null
      if (eoaForCoupons && ethers.isAddress(eoaForCoupons)) {
        const eoaNorm = ethers.getAddress(eoaForCoupons)
        const aaNorm =
          aaForCoupons && ethers.isAddress(aaForCoupons) ? ethers.getAddress(aaForCoupons) : null
        catalogRows = await fetchMyBrandsProductionSeriesForUser(
          50,
          eoaNorm,
          aaNorm,
          knownCouponCardAddresses
        ).catch(() => null)
      }
      const couponSummaries = summarizeClaimableCouponCards(couponRows)
      const catalogSummaries = summarizeOwnedCatalogCards(catalogRows)
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
          if (isCardExcludedFromDisplay(key)) continue
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
          if (isCardExcludedFromDisplay(key)) continue
          if (seenCards.has(key)) continue
          const prevCoupon = myBrandCardDetailsRef.current[key]?.claimableCoupons
          if (!prevCoupon || prevCoupon.count <= 0) continue
          seenCards.add(key)
          cards.push(c)
        }
      }
      if (catalogSummaries) {
        for (const [key, summary] of catalogSummaries) {
          if (isCardExcludedFromDisplay(key)) continue
          if (seenCards.has(key)) continue
          seenCards.add(key)
          cards.push(catalogFallbackCardInfo(key, summary))
        }
      } else {
        for (const c of myBrandCardsRef.current) {
          const key = c.cardAddress.toLowerCase()
          if (isCardExcludedFromDisplay(key)) continue
          if (seenCards.has(key)) continue
          const prevCatalog = myBrandCardDetailsRef.current[key]?.ownedCatalogs
          if (!prevCatalog || prevCatalog.count <= 0) continue
          seenCards.add(key)
          cards.push(c)
        }
      }
      const displayCards = filterDisplayUserCards(cards)
      myBrandHolderUnionCardsRef.current = filterDisplayUserCards(holderUnionCards)
      const prevCards = myBrandCardsRef.current
      const prevDetails = filterExcludedCardDetailKeys(myBrandCardDetailsRef.current)
      if (displayCards.length === 0) {
        if (cards.length === 0 && (prevCards.length > 0 || Object.keys(prevDetails).length > 0)) {
          /**
           * My Brands 依赖窗口扫描 / 多源合并；周期刷新中的空结果不能作为负向删除依据。
           * 必须在 setMyBrandCards 前返回，否则 /home 会每 6s 显示/消失。
           */
          return prevDetails
        }
        if (Object.keys(prevDetails).length > 0) {
          setMyBrandCardDetails({})
        }
        if (filterDisplayUserCards(prevCards).length > 0) {
          setMyBrandCards([])
        }
        if (eoaSave && ethers.isAddress(eoaSave)) {
          saveMyBrandsFeedLocalCache(eoaSave, [], [], {})
        }
        return {}
      }
      const nextSig = myBrandCardListSignature(displayCards)
      if (myBrandCardListSignature(filterDisplayUserCards(prevCards)) !== nextSig) {
        setMyBrandCards(displayCards)
      }
      const allowed = new Set(displayCards.map((c) => c.cardAddress.toLowerCase()))
      const next: MyBrandCardFeedDetailsMap = {}
      for (const k of allowed) {
        if (prevDetails[k]) next[k] = prevDetails[k]!
      }
      /** getWalletAssets 快照先写入持仓，避免 RPC getMyAssets 慢/失败时 assets:null 误隐藏 /wallet 叠卡。 */
      if (walletAssetsByCardKey) {
        for (const uc of displayCards) {
          const key = uc.cardAddress.toLowerCase()
          const wa = walletAssetsByCardKey[key]
          if (!wa || !myCardAssetsHasHoldings(wa)) continue
          const prevRow = next[key]
          next[key] = {
            meta: prevRow?.meta ?? null,
            assets: resolveMyCardAssetsForFeedRow(null, wa, prevRow?.assets ?? null),
            claimableCoupons: prevRow?.claimableCoupons ?? null,
            ownedCatalogs: prevRow?.ownedCatalogs ?? null,
          }
        }
        const walletSeeded = filterExcludedCardDetailKeys(next)
        if (!areMyBrandDetailsMapsEqual(myBrandCardDetailsRef.current, walletSeeded)) {
          setMyBrandCardDetails(walletSeeded)
          myBrandCardDetailsRef.current = walletSeeded
        }
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
        /** Batch trusted empty (count 0) or positive — do not re-fetch to revive redeemed. */
        if (batch != null && couponRows !== null) return batch
        if (batch?.count) return batch
        if (!eoaNormForCoupons) return batch ?? prevRow?.claimableCoupons ?? null
        const fromWalletAssets = await fetchOwnedCouponsFromWalletAssetsForCards(
          eoaNormForCoupons,
          [cardAddress],
          50
        ).catch(() => null)
        if (fromWalletAssets !== null) {
          return summarizeOwnedCouponsForCardKey(fromWalletAssets, key)
        }
        const fromRecent = await fetchOwnedCouponsFromRecentSeriesForUser(
          eoaNormForCoupons,
          aaNormForCoupons,
          [cardAddress],
          50
        ).catch(() => null)
        if (fromRecent !== null) {
          return summarizeOwnedCouponsForCardKey(fromRecent, key)
        }
        const cardOwned = await fetchOwnedCouponsForKnownCards(
          [cardAddress],
          eoaNormForCoupons,
          aaNormForCoupons,
          50
        ).catch(() => null)
        if (cardOwned !== null) {
          return summarizeOwnedCouponsForCardKey(cardOwned, key)
        }
        return batch ?? prevRow?.claimableCoupons ?? null
      }

      const claimableByCardKey = new Map<string, ClaimableCouponSummary | null>()
      const ownedCatalogByCardKey = new Map<string, OwnedCatalogSummary | null>()
      for (const uc of displayCards) {
        const key = uc.cardAddress.toLowerCase()
        claimableByCardKey.set(key, await resolveCouponsForCardKey(key, uc.cardAddress, prevDetails[key]))
        ownedCatalogByCardKey.set(
          key,
          resolveOwnedCatalogsForCard(key, catalogSummaries, catalogRows, prevDetails[key])
        )
      }

      /**
       * Prefer My Brands aggregator (1 eth_call / ≤32 cards). null = untrusted → per-card getMyAssets.
       * Do not clear prior assets on aggregator failure.
       */
      const dashboardAssetsByCard =
        eoaNormForCoupons && ethers.isAddress(eoaNormForCoupons)
          ? await fetchMyBrandsCardAssetsBatch(
              displayCards.map((c) => c.cardAddress),
              eoaNormForCoupons,
              aaNormForCoupons
            ).catch(() => null)
          : null

      await Promise.all(
        displayCards.map(async (uc) => {
          const key = uc.cardAddress.toLowerCase()
          const prevRow = prevDetails[key]
          const claimableCoupons = claimableByCardKey.get(key) ?? null
          const ownedCatalogs = ownedCatalogByCardKey.get(key) ?? prevRow?.ownedCatalogs ?? null
          const fromDashboard = dashboardAssetsByCard?.get(key) ?? null
          const [assetsFromMyAssets, meta] = await Promise.all([
            fromDashboard
              ? Promise.resolve(fromDashboard)
              : getMyAssets(profile, uc.cardAddress).catch(() => null),
            // awaitFresh: must not seed feed from stale local (tier.imageFit / image would stick).
            getCardBasicMetadataStaleWhileRevalidate(uc.cardAddress, { awaitFresh: true }).catch(
              () => prevRow?.meta ?? null
            ),
          ])
          const assetsFromWallet = walletAssetsByCardKey?.[key] ?? null
          let couponsForRow = claimableCoupons
          if (couponsForRow == null) {
            couponsForRow = prevRow?.claimableCoupons ?? null
          }
          /**
           * Trusted empty (count 0) must stick. Only backfill when still missing holdings after untrusted miss.
           * Never treat empty as “try late sources that might re-show redeemed coupons”.
           */
          if (couponsForRow == null && eoaNormForCoupons) {
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
            if (lateOwned !== null) {
              couponsForRow = summarizeOwnedCouponsForCardKey(lateOwned, key)
            }
          }
          let mergedAssets = resolveMyCardAssetsForFeedRow(
              assetsFromMyAssets,
              assetsFromWallet,
              prevRow?.assets ?? null
            )
          next[key] = {
            meta: mergeRicherMerchantCardMeta(prevRow?.meta, meta ?? undefined) ?? prevRow?.meta ?? null,
            assets: mergedAssets,
            claimableCoupons: couponsForRow,
            ownedCatalogs,
          }
          // Fresh meta already remembered inside awaitFresh path — do not re-remember SWR-local.
        })
      )
      if (!areMyBrandDetailsMapsEqual(prevDetails, next)) {
        setMyBrandCardDetails(next)
      }
      let detailsToSave = next
      if (eoaSave && ethers.isAddress(eoaSave)) {
        const statusMap = loadCouponOpenClaimStatusMapForEoa(eoaSave)
        detailsToSave = pruneRedeemedOwnedCouponsFromDetails(next, statusMap)
        if (!areMyBrandDetailsMapsEqual(next, detailsToSave)) {
          setMyBrandCardDetails(detailsToSave)
          myBrandCardDetailsRef.current = detailsToSave
        }
        saveMyBrandsFeedLocalCache(eoaSave, ownerCards, holderUnionCards, detailsToSave)
        const ownedTargets: CouponOpenClaimFeedTarget[] = []
        for (const [cardKey, row] of Object.entries(detailsToSave)) {
          for (const c of row?.claimableCoupons?.coupons ?? []) {
            if (!c.tokenId) continue
            ownedTargets.push({
              cardAddress: c.cardAddress || cardKey,
              tokenId: String(c.tokenId),
              couponId: c.couponId,
            })
          }
        }
        if (ownedTargets.length > 0) {
          registerCouponOpenClaimFeedTargetsRef.current?.(ownedTargets)
        }
      }
      return detailsToSave
    } catch {
      /** 拉取失败：不覆盖内存/本地缓存，下一轮再试；Total Power 等用 ref 兜底 */
      return null
    } finally {
      setMyBrandsFeedLoading(false)
      myBrandsFeedInFlight.current = false
    }
  }, [])

  /**
   * CoNET mainnet 新块：只写 ref 供喂料机读块高。
   * 禁止在此 setCurrentBlock —— 每 ~2s 出块会重建整棵 Daemon context，
   * 导致 /home 等消费者整页重绘、文字亚像素抖动。
   * 需要 React 态时用 myBrandsFeedLastConetBlock（喂料节拍）或显式 setCurrentBlock。
   */
  useEffect(() => {
    const p = conetProviderRef.current!
    const onBlock = (n: number) => {
      conetBlockRef.current = n
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

	useEffect(() => {
		if (!beamio?.language) return
		void applyBeamioUiLanguageFromProfile(beamio.language)
	}, [beamio?.language])

	useEffect(() => {
		void loadApiExcludedUserCards().then(() => {
			setMyBrandCards((prev) => filterDisplayUserCards(prev))
			setMyBrandCardDetails((prev) => filterExcludedCardDetailKeys(prev))
			myBrandHolderUnionCardsRef.current = filterDisplayUserCards(myBrandHolderUnionCardsRef.current)
			setHomeTotalPowerCad(
				computeHomeTotalPowerCad(
					lastEoaUsdcForPowerRef.current,
					lastAaUsdcForPowerRef.current,
					filterExcludedCardDetailKeys(myBrandCardDetailsRef.current),
					currencyDataRef.current
				)
			)
		})
	}, [])

  const noAaRecentActivityInFlight = useRef(false)
  const [recentActivityNoAaItems, setRecentActivityNoAaItems] = useState<TxView[]>([])
  const [recentActivityNoAaSettled, setRecentActivityNoAaSettled] = useState(false)
  const recentActivityNoAaItemsRef = useRef<TxView[]>([])
  const recentActivityNoAaSettledRef = useRef(false)
  const [recentActivityNoAaLoading, setRecentActivityNoAaLoading] = useState(false)
  const [recentActivityNoAaError, setRecentActivityNoAaError] = useState<string | null>(null)
  useEffect(() => {
    recentActivityNoAaItemsRef.current = recentActivityNoAaItems
  }, [recentActivityNoAaItems])

  const [conetWalletBalances, setConetWalletBalances] = useState<ConetWalletBalances>(
    () => EMPTY_CONET_WALLET_BALANCES
  )
  const [conetAaWalletBalances, setConetAaWalletBalances] = useState<ConetWalletBalances>(
    () => EMPTY_CONET_WALLET_BALANCES
  )

  /** EOA 切换：从本地恢复 CoNET USDC / CNET / GB；无缓存则用零值首帧，等 daemon 回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      setConetWalletBalances(EMPTY_CONET_WALLET_BALANCES)
      return
    }
    const hit = loadConetWalletBalancesLocalCache(eoaLower)
    setConetWalletBalances(hit ?? EMPTY_CONET_WALLET_BALANCES)
  }, [profileWalletKeyId])

  /** EOA 切换：从本地恢复 Base USDC（EOA+AA）；无缓存则零值首帧，等 Worker 6s 回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      setUsdcbalance(0)
      setAaAccountUsdcBalance('0')
      lastEoaUsdcForPowerRef.current = '0'
      lastAaUsdcForPowerRef.current = '0'
      return
    }
    const hit = loadBaseUsdcBalanceLocalCache(eoaLower)
    const eoaUsdc = hit?.eoaUsdc ?? '0'
    const aaUsdc = hit?.aaUsdc ?? '0'
    const eoaNum = parseFloat(eoaUsdc) || 0
    setUsdcbalance((prev) => (prev === eoaNum ? prev : eoaNum))
    setAaAccountUsdcBalance((prev) => (prev === aaUsdc ? prev : aaUsdc))
    lastEoaUsdcForPowerRef.current = eoaUsdc
    lastAaUsdcForPowerRef.current = aaUsdc
  }, [profileWalletKeyId])

  /** AA 切换：从本地恢复 Smart Wallet 的 CoNET CNET / GB / USDC 余额。 */
  const profileAaAccount = profiles?.[0]?.aaAccount?.trim() ?? ''
  useLayoutEffect(() => {
    const aaLower = profileAaAccount.toLowerCase()
    if (!aaLower || !ethers.isAddress(aaLower)) {
      setConetAaWalletBalances(EMPTY_CONET_WALLET_BALANCES)
      return
    }
    const hit = loadConetWalletBalancesLocalCache(aaLower)
    setConetAaWalletBalances(hit ?? EMPTY_CONET_WALLET_BALANCES)
  }, [profileAaAccount])

  const runConetWalletBalancesFeedTick = useCallback(async (): Promise<void> => {
    const eoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoa || !ethers.isAddress(eoa)) return
    const eoaLower = eoa.toLowerCase()
    const res = await fetchConetWalletBalances(eoa).catch(
      () => ({ ok: false as const })
    )
    if (!res.ok) return
    if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== eoaLower) return
    setConetWalletBalances(res.balances)
    saveConetWalletBalancesLocalCache(eoaLower, res.balances)

    const aa = profilesRef.current?.[0]?.aaAccount?.trim() ?? ''
    if (!aa || !ethers.isAddress(aa)) {
      setConetAaWalletBalances(EMPTY_CONET_WALLET_BALANCES)
      return
    }
    const aaLower = aa.toLowerCase()
    const aaRes = await fetchConetWalletBalances(aa).catch(
      () => ({ ok: false as const })
    )
    if (!aaRes.ok) return
    const currentAa = profilesRef.current?.[0]?.aaAccount?.trim().toLowerCase() ?? ''
    if (currentAa !== aaLower) return
    setConetAaWalletBalances(aaRes.balances)
    saveConetWalletBalancesLocalCache(aaLower, aaRes.balances)
  }, [])

  const [validatorWalletNodeProfile, setValidatorWalletNodeProfile] =
    useState<ValidatorWalletNodeProfile | null>(null)

  /** EOA 切换：从 hook 模块缓存恢复用户节点档案；无缓存则等 daemon 回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      setValidatorWalletNodeProfile(null)
      return
    }
    setValidatorWalletNodeProfile(peekValidatorWalletNodeProfileCache(eoaLower))
  }, [profileWalletKeyId])

  const runValidatorWalletNodeProfileFeedTick = useCallback(async (): Promise<void> => {
    const eoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoa || !ethers.isAddress(eoa)) return
    const eoaLower = eoa.toLowerCase()
    const res = await fetchValidatorWalletNodeProfile(eoa).catch(() => ({ ok: false as const }))
    if (!res.ok) return
    if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== eoaLower) return
    setValidatorWalletNodeProfile(res.profile)
    seedValidatorWalletNodeProfileCache(eoaLower, res.profile)
  }, [])

  const [unifiedIncomeStats, setUnifiedIncomeStats] = useState<UnifiedIncomeStats | null>(null)
  const unifiedIncomeStatsRef = useRef<UnifiedIncomeStats | null>(null)

  /** EOA 切换：从模块缓存恢复收益统计；无缓存则等 daemon 回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      unifiedIncomeStatsRef.current = null
      setUnifiedIncomeStats(null)
      return
    }
    const hit = peekUnifiedIncomeStatsCache(eoaLower)
    unifiedIncomeStatsRef.current = hit
    setUnifiedIncomeStats(hit)
  }, [profileWalletKeyId])

  const runUnifiedIncomeStatsFeedTick = useCallback(async (): Promise<void> => {
    const eoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoa || !ethers.isAddress(eoa)) return
    const eoaLower = eoa.toLowerCase()
    const res = await fetchUnifiedIncomeStats(eoa, 0).catch(() => ({ ok: false as const }))
    if (!res.ok) return
    if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== eoaLower) return
    const previous = unifiedIncomeStatsRef.current
    const sameBeneficiary =
      previous?.beneficiary &&
      res.stats.beneficiary &&
      previous.beneficiary.toLowerCase() === res.stats.beneficiary.toLowerCase()
    let nextStats = res.stats
    if (!res.stats.airdropReadOk && sameBeneficiary && previous?.airdrop) {
      nextStats = { ...nextStats, airdrop: previous.airdrop }
    }
    if (!res.stats.gbPaidDepinReadOk && sameBeneficiary && previous?.gbPaidDepinReceived) {
      nextStats = { ...nextStats, gbPaidDepinReceived: previous.gbPaidDepinReceived }
    }
    unifiedIncomeStatsRef.current = nextStats
    setUnifiedIncomeStats(nextStats)
    seedUnifiedIncomeStatsCache(eoaLower, nextStats)
  }, [])

  const [referrerSummary, setReferrerSummary] = useState<ReferrerDashboardSummary | null>(null)

  /** EOA 切换：从模块缓存恢复推荐进度；无缓存则等 daemon 回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      setReferrerSummary(null)
      return
    }
    setReferrerSummary(peekReferrerSummaryCache(eoaLower))
  }, [profileWalletKeyId])

  const runReferrerSummaryFeedTick = useCallback(async (): Promise<void> => {
    const eoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoa || !ethers.isAddress(eoa)) return
    const eoaLower = eoa.toLowerCase()
    const summary = await fetchReferrerSummaryForDaemon(eoaLower)
    if (!summary) return
    if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== eoaLower) return
    setReferrerSummary(summary)
    seedReferrerSummaryCache(eoaLower, summary)
  }, [])

  const [referralL0StartKitQuota, setReferralL0StartKitQuota] = useState<ReferralL0StartKitQuota | null>(null)

  /** EOA 切换：L0 Start Kit 配额本地优先；非 L0 / 无缓存则为 null，等 feeder 可信回填 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) {
      setReferralL0StartKitQuota(null)
      return
    }
    setReferralL0StartKitQuota(loadReferralL0StartKitQuotaLocalCache(raw))
  }, [profileWalletKeyId])

  const runReferralL0StartKitQuotaFeedTick = useCallback(async (force = false): Promise<void> => {
    const eoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoa || !ethers.isAddress(eoa)) {
      setReferralL0StartKitQuota(null)
      return
    }
    const eoaLower = eoa.toLowerCase()
    const result = await fetchReferralL0StartKitQuotaFeed(eoa, { force }).catch(() => ({ ok: false }) as const)
    if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== eoaLower) return
    if (!result.ok) return
    if (!result.isL0) {
      setReferralL0StartKitQuota(null)
      return
    }
    setReferralL0StartKitQuota(result.quota)
  }, [])

  const refreshReferralL0StartKitQuota = useCallback(async () => {
    await refreshAppDaemonNow('wallet')
  }, [])

  const genesisIncomeFeedAccountsRef = useRef<string[]>([])
  const genesisIncomeFeedInFlightRef = useRef(false)
  const [genesisIncomeByEoa, setGenesisIncomeByEoa] = useState<Record<string, GenesisIncomeSnapshot>>({})

  const registerGenesisIncomeFeedAccounts = useCallback((accounts: string[]) => {
    const incoming = [
      ...new Set(
        accounts
          .map((a) => String(a ?? '').trim())
          .filter((a) => {
            try {
              return ethers.isAddress(a)
            } catch {
              return false
            }
          })
          .map((a) => ethers.getAddress(a).toLowerCase()),
      ),
    ]
    const prev = genesisIncomeFeedAccountsRef.current
    const merged = [...new Set([...prev, ...incoming])]
    if (merged.length === prev.length && merged.every((a, i) => a === prev[i])) return
    genesisIncomeFeedAccountsRef.current = merged
    if (incoming.length > 0) {
      void registerAppDaemonGenesisAccounts(incoming)
    }
    // Seed map from semi-permanent local store for newly registered EOAs.
    setGenesisIncomeByEoa((prevMap) => {
      const next = { ...prevMap }
      let changed = false
      for (const key of incoming) {
        if (next[key]) continue
        const local = readCachedGenesisIncome(key)
        if (local) {
          next[key] = local
          changed = true
        }
      }
      return changed ? next : prevMap
    })
  }, [])

  const runGenesisIncomeFeedTick = useCallback(async (): Promise<void> => {
    if (genesisIncomeFeedInFlightRef.current) return
    const sessionEoa = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    const registered = genesisIncomeFeedAccountsRef.current
    const targets = [
      ...new Set(
        [sessionEoa, ...registered]
          .map((a) => String(a ?? '').trim())
          .filter((a) => ethers.isAddress(a))
          .map((a) => ethers.getAddress(a).toLowerCase()),
      ),
    ]
    if (targets.length === 0) return
    genesisIncomeFeedInFlightRef.current = true
    try {
      const updates: Record<string, GenesisIncomeSnapshot> = {}
      for (const addr of targets) {
        const snap = await runGenesisIncomeFeedForAccount(addr).catch(() => null)
        if (snap) updates[addr.toLowerCase()] = snap
      }
      if (Object.keys(updates).length === 0) return
      setGenesisIncomeByEoa((prev) => ({ ...prev, ...updates }))
    } finally {
      genesisIncomeFeedInFlightRef.current = false
    }
  }, [])

  const refreshGenesisIncomeFeed = useCallback(async () => {
    await runGenesisIncomeFeedTick()
  }, [runGenesisIncomeFeedTick])

  /** EOA 切换：hydrate current wallet purchase history from local store */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) return
    const key = ethers.getAddress(raw).toLowerCase()
    const local = readCachedGenesisIncome(key)
    if (!local) return
    setGenesisIncomeByEoa((prev) => (prev[key] ? prev : { ...prev, [key]: local }))
  }, [profileWalletKeyId])

  const discoverMerchantStatFeedAddressesRef = useRef<string[]>([])
  const discoverMerchantStatsFeedInFlightRef = useRef(false)
  const [discoverMerchantStatByCard, setDiscoverMerchantStatByCard] = useState<DiscoverMerchantStatsMap>(
    () => loadDiscoverMerchantStatsLocalCache(),
  )

  const runDiscoverMerchantStatsFeedTick = useCallback(async (): Promise<void> => {
    if (discoverMerchantStatsFeedInFlightRef.current) return
    const addresses = discoverMerchantStatFeedAddressesRef.current
    if (!addresses.length) return
    discoverMerchantStatsFeedInFlightRef.current = true
    try {
      for (const cardLower of addresses) {
        let addr: string
        try {
          addr = ethers.getAddress(cardLower)
        } catch {
          continue
        }
        const likeCount = await fetchDiscoverMerchantLikeCount(addr)
        const refClickChain = await fetchDiscoverMerchantRefClickCount(addr)
        const refClickDb = await fetchDiscoverMerchantDbShareClickTotal(addr)
        if (likeCount == null && refClickChain == null && refClickDb == null) continue

        setDiscoverMerchantStatByCard((prev) => {
          const existing = prev[cardLower]
          const mergedLike = mergeDiscoverMerchantLikeCount(likeCount, existing?.likeCount, existing?.savedAt)
          const mergedRef = mergeDiscoverMerchantRefClickCount(
            refClickChain,
            refClickDb,
            existing?.refClickCount,
          )
          const nextEntry: DiscoverMerchantStatEntry = {
            likeCount: mergedLike,
            refClickCount: mergedRef,
            savedAt: Date.now(),
          }
          if (
            existing?.likeCount === nextEntry.likeCount &&
            existing?.refClickCount === nextEntry.refClickCount
          ) {
            return prev
          }
          return { ...prev, [cardLower]: nextEntry }
        })

        const patch: { likeCount?: number; refClickCount?: number } = {}
        const existingEntry = loadDiscoverMerchantStatsLocalCache()[cardLower]
        const mergedLikeForSave = mergeDiscoverMerchantLikeCount(
          likeCount,
          existingEntry?.likeCount,
          existingEntry?.savedAt,
        )
        if (mergedLikeForSave != null) patch.likeCount = mergedLikeForSave
        const mergedRefForSave = mergeDiscoverMerchantRefClickCount(
          refClickChain,
          refClickDb,
          existingEntry?.refClickCount,
        )
        if (mergedRefForSave != null) patch.refClickCount = mergedRefForSave
        saveDiscoverMerchantStatEntry(cardLower, patch)
      }
    } finally {
      discoverMerchantStatsFeedInFlightRef.current = false
    }
  }, [])

  const registerDiscoverMerchantStatFeedCards = useCallback(
    (cardAddresses: string[]) => {
      const incoming = [
        ...new Set(
          cardAddresses
            .map((a) => String(a ?? '').trim())
            .filter((a) => {
              try {
                return ethers.isAddress(a)
              } catch {
                return false
              }
            })
            .map((a) => ethers.getAddress(a).toLowerCase()),
        ),
      ]
      const prev = discoverMerchantStatFeedAddressesRef.current
      const merged = [...new Set([...prev, ...incoming])]
      discoverMerchantStatFeedAddressesRef.current = merged
      if (incoming.length > 0) {
        void registerAppDaemonDiscoverCards(incoming)
      }
    },
    [],
  )

  const applyDiscoverMerchantLikeCountDelta = useCallback((cardAddress: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return
    let cardLower: string
    try {
      cardLower = ethers.getAddress(String(cardAddress ?? '').trim()).toLowerCase()
    } catch {
      return
    }
    setDiscoverMerchantStatByCard((prev) => {
      const existing = prev[cardLower]
      const base =
        typeof existing?.likeCount === 'number' && Number.isFinite(existing.likeCount)
          ? existing.likeCount
          : 0
      const nextLikeCount = Math.max(0, Math.trunc(base + delta))
      if (existing?.likeCount === nextLikeCount) return prev
      const nextEntry: DiscoverMerchantStatEntry = {
        ...existing,
        likeCount: nextLikeCount,
        savedAt: Date.now(),
      }
      saveDiscoverMerchantStatEntry(cardLower, { likeCount: nextLikeCount })
      return { ...prev, [cardLower]: nextEntry }
    })
  }, [])

  /**
   * Coupons open-claim claimed/redeemed：EOA localStorage hydrate + 30s daemon 链上刷新。
   * 所有 Coupons UI 只读本 map；claim 成功走 applyCouponOpenClaimStatus。
   */
  const couponOpenClaimFeedTargetsRef = useRef<CouponOpenClaimFeedTarget[]>([])
  const couponOpenClaimFeedInFlightRef = useRef(false)
  const runCouponSocialStatsFeedTickRef = useRef<() => Promise<void>>(async () => {})
  const [couponOpenClaimStatusByKey, setCouponOpenClaimStatusByKey] = useState<CouponOpenClaimStatusMap>({})

  useEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) {
      setCouponOpenClaimStatusByKey({})
      couponOpenClaimFeedTargetsRef.current = []
      return
    }
    setCouponOpenClaimStatusByKey(loadCouponOpenClaimStatusMapForEoa(raw))
  }, [profileWalletKeyId])

  const runCouponOpenClaimStatusFeedTick = useCallback(async (): Promise<void> => {
    if (couponOpenClaimFeedInFlightRef.current) return
    const eoaRaw = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!eoaRaw || !ethers.isAddress(eoaRaw)) return
    const targets = couponOpenClaimFeedTargetsRef.current
    if (!targets.length) return
    couponOpenClaimFeedInFlightRef.current = true
    try {
      const userEOA = ethers.getAddress(eoaRaw)
      for (const t of targets) {
        const status = await refreshCouponOpenClaimChainStatus({
          cardAddress: t.cardAddress,
          userEOA,
          tokenId: t.tokenId,
          couponId: t.couponId,
        })
        if (status !== 'claimed' && status !== 'redeemed') continue
        const k = buildCouponOpenClaimStatusKey(t.cardAddress, t.tokenId)
        if (!k) continue
        const entry = pickCouponOpenClaimStatusFromMap(
          loadCouponOpenClaimStatusMapForEoa(userEOA),
          t.cardAddress,
          t.tokenId,
        )
        if (!entry) continue
        setCouponOpenClaimStatusByKey((prev) => {
          const prevEntry = prev[k]
          if (
            prevEntry &&
            prevEntry.status === entry.status &&
            prevEntry.source === entry.source &&
            prevEntry.savedAt === entry.savedAt
          ) {
            return prev
          }
          return { ...prev, [k]: entry }
        })
        if (status === 'redeemed') {
          setMyBrandCardDetails((prev) => {
            const pruned = pruneRedeemedOwnedCouponsFromDetails(prev, {
              ...loadCouponOpenClaimStatusMapForEoa(userEOA),
              [k]: entry,
            })
            if (pruned === prev) return prev
            myBrandCardDetailsRef.current = pruned
            return pruned
          })
        }
      }
    } finally {
      couponOpenClaimFeedInFlightRef.current = false
    }
  }, [])

  const registerCouponOpenClaimFeedTargets = useCallback(
    (targets: CouponOpenClaimFeedTarget[]) => {
      const normalized: CouponOpenClaimFeedTarget[] = []
      const seen = new Set<string>()
      for (const t of targets) {
        const k = buildCouponOpenClaimStatusKey(t.cardAddress, t.tokenId)
        if (!k || seen.has(k)) continue
        seen.add(k)
        let card: string
        let tokenId: string
        try {
          card = ethers.getAddress(String(t.cardAddress).trim()).toLowerCase()
          tokenId = BigInt(String(t.tokenId).trim()).toString()
        } catch {
          continue
        }
        normalized.push({
          cardAddress: card,
          tokenId,
          ...(t.couponId?.trim() ? { couponId: t.couponId.trim() } : {}),
        })
      }
      if (!normalized.length) return
      const prev = couponOpenClaimFeedTargetsRef.current
      const mergedMap = new Map<string, CouponOpenClaimFeedTarget>()
      for (const p of prev) {
        const k = buildCouponOpenClaimStatusKey(p.cardAddress, p.tokenId)
        if (k) mergedMap.set(k, p)
      }
      for (const n of normalized) {
        const k = buildCouponOpenClaimStatusKey(n.cardAddress, n.tokenId)!
        mergedMap.set(k, n)
      }
      couponOpenClaimFeedTargetsRef.current = [...mergedMap.values()]
      // Worker side tick owns coupon social + open-claim RPC (register schedules immediately).
      if (normalized.length > 0) {
        void registerAppDaemonCouponTargets(normalized)
      }
    },
    [],
  )

  registerCouponOpenClaimFeedTargetsRef.current = registerCouponOpenClaimFeedTargets

  const applyCouponOpenClaimStatus = useCallback(
    (params: {
      cardAddress: string
      tokenId: string | number | bigint
      couponId?: string | null
      status: CouponOpenClaimLocalStatus
      source: 'optimistic' | 'chain'
    }) => {
      const eoaRaw = profilesRef.current?.[0]?.keyID?.trim() ?? ''
      if (!eoaRaw || !ethers.isAddress(eoaRaw)) return
      const entry = saveCouponOpenClaimLocalStatus({
        eoaAddress: eoaRaw,
        cardAddress: params.cardAddress,
        tokenId: params.tokenId,
        couponId: params.couponId,
        status: params.status,
        source: params.source,
      })
      const k = buildCouponOpenClaimStatusKey(params.cardAddress, params.tokenId)
      if (!entry || !k) return
      setCouponOpenClaimStatusByKey((prev) => ({ ...prev, [k]: entry }))
      registerCouponOpenClaimFeedTargets([
        {
          cardAddress: params.cardAddress,
          tokenId: String(params.tokenId),
          couponId: params.couponId ?? undefined,
        },
      ])
      /** My Brands Coupons: hide immediately once redeemed (no longer a held redeemable asset). */
      if (params.status === 'redeemed' && ethers.isAddress(params.cardAddress)) {
        const cardKey = ethers.getAddress(params.cardAddress).toLowerCase()
        const tokenIdStr = String(params.tokenId).trim()
        setMyBrandCardDetails((prev) => {
          const row = prev[cardKey]
          const summary = row?.claimableCoupons
          if (!summary?.count) return prev
          const coupons = (summary.coupons ?? []).filter(
            (c) => String(c.tokenId ?? '').trim() !== tokenIdStr,
          )
          const firstStill =
            summary.firstCoupon && String(summary.firstCoupon.tokenId ?? '').trim() !== tokenIdStr
              ? summary.firstCoupon
              : null
          const firstCoupon = firstStill && coupons.some((c) => c.id === firstStill.id)
            ? firstStill
            : coupons[0] ?? null
          const nextSummary: ClaimableCouponSummary = {
            count: coupons.length,
            firstTitle: firstCoupon?.title ?? (coupons.length ? summary.firstTitle : undefined),
            firstCoupon,
            coupons,
          }
          const next = {
            ...prev,
            [cardKey]: { ...row!, claimableCoupons: nextSummary },
          }
          myBrandCardDetailsRef.current = next
          const eoaSave = profilesRef.current?.[0]?.keyID?.trim()
          if (eoaSave && ethers.isAddress(eoaSave)) {
            saveMyBrandsFeedLocalCache(
              eoaSave,
              myBrandCardsRef.current,
              myBrandHolderUnionCardsRef.current,
              next,
            )
          }
          return next
        })
      }
    },
    [registerCouponOpenClaimFeedTargets],
  )

  const getCouponOpenClaimStatus = useCallback(
    (
      cardAddress: string | null | undefined,
      tokenId: string | number | bigint | null | undefined,
    ): CouponOpenClaimLocalEntry | null =>
      pickCouponOpenClaimStatusFromMap(couponOpenClaimStatusByKey, cardAddress, tokenId),
    [couponOpenClaimStatusByKey],
  )

  const refreshCouponOpenClaimStatusFeed = useCallback(async () => {
    await refreshAppDaemonNow('all')
  }, [])

  /**
   * Coupons 社交 KPI + TOTAL·LEFT：与 open-claim 共用 targets ref；30s 链上刷新。
   */
  const [couponSocialStatByKey, setCouponSocialStatByKey] = useState<CouponSocialStatsMap>(() =>
    loadCouponSocialStatsLocalCache(),
  )
  const couponSocialFeedInFlightRef = useRef(false)

  const runCouponSocialStatsFeedTick = useCallback(async (): Promise<void> => {
    if (couponSocialFeedInFlightRef.current) return
    const targets = couponOpenClaimFeedTargetsRef.current
    if (!targets.length) return
    couponSocialFeedInFlightRef.current = true
    try {
      for (const t of targets) {
        const bundle = await fetchCouponSocialStatsBundle(t.cardAddress, t.tokenId)
        if (!bundle) continue
        const k = buildCouponSocialStatKey(t.cardAddress, t.tokenId)
        if (!k) continue
        setCouponSocialStatByKey((prev) => {
          const existing = prev[k]
          const mergedLike = mergeCouponSocialLikeCount(
            bundle.likeCount,
            existing?.likeCount,
            existing?.savedAt,
          )
          const patch: {
            likeCount?: number
            shareClickCount?: number
            maxSupply?: string | null
            remainingSupply?: string | null
          } = {}
          if (mergedLike != null) patch.likeCount = mergedLike
          if (bundle.shareClickCount != null) patch.shareClickCount = bundle.shareClickCount
          if (bundle.maxSupply !== undefined) patch.maxSupply = bundle.maxSupply
          if (bundle.remainingSupply !== undefined) patch.remainingSupply = bundle.remainingSupply
          if (Object.keys(patch).length === 0) return prev
          const saved = saveCouponSocialStatEntry(t.cardAddress, t.tokenId, patch)
          if (!saved) return prev
          if (
            existing?.likeCount === saved.likeCount &&
            existing?.shareClickCount === saved.shareClickCount &&
            existing?.maxSupply === saved.maxSupply &&
            existing?.remainingSupply === saved.remainingSupply
          ) {
            return prev
          }
          return { ...prev, [k]: saved }
        })
      }
    } finally {
      couponSocialFeedInFlightRef.current = false
    }
  }, [])

  runCouponSocialStatsFeedTickRef.current = runCouponSocialStatsFeedTick

  const registerCouponSocialFeedTargets = useCallback(
    (targets: CouponOpenClaimFeedTarget[]) => {
      registerCouponOpenClaimFeedTargets(targets)
    },
    [registerCouponOpenClaimFeedTargets],
  )

  const getCouponSocialStat = useCallback(
    (
      cardAddress: string | null | undefined,
      tokenId: string | number | bigint | null | undefined,
    ): CouponSocialStatEntry | null =>
      pickCouponSocialStatFromMap(couponSocialStatByKey, cardAddress, tokenId),
    [couponSocialStatByKey],
  )

  const formatCouponSupplySummary = useCallback(
    (
      cardAddress: string | null | undefined,
      tokenId: string | number | bigint | null | undefined,
    ): string | null =>
      formatCouponSupplySummaryFromStat(
        pickCouponSocialStatFromMap(couponSocialStatByKey, cardAddress, tokenId),
      ),
    [couponSocialStatByKey],
  )

  const applyCouponSocialLikeCountDelta = useCallback(
    (cardAddress: string, tokenId: string | number | bigint, delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return
      const k = buildCouponSocialStatKey(cardAddress, tokenId)
      if (!k) return
      setCouponSocialStatByKey((prev) => {
        const existing = prev[k]
        const base =
          typeof existing?.likeCount === 'number' && Number.isFinite(existing.likeCount)
            ? existing.likeCount
            : 0
        const nextLike = Math.max(0, Math.trunc(base + delta))
        if (existing?.likeCount === nextLike) return prev
        const saved = saveCouponSocialStatEntry(cardAddress, tokenId, { likeCount: nextLike })
        if (!saved) return prev
        return { ...prev, [k]: saved }
      })
      registerCouponOpenClaimFeedTargets([
        { cardAddress, tokenId: String(tokenId) },
      ])
    },
    [registerCouponOpenClaimFeedTargets],
  )

  const refreshCouponSocialStatsFeed = useCallback(async () => {
    await refreshAppDaemonNow('all')
  }, [])

  /**
   * Institutional AA V2 pending tasks：共同签署者本地优先 + 15s daemon 拉取链上 task。
   * 发起者离线 EIP-712 上链后，共管方靠本 feeder 发现待投票项（非 gossip alone）。
   */
  const [aaV2PendingNeedVoteCount, setAaV2PendingNeedVoteCount] = useState(0)
  const aaV2PendingInFlightRef = useRef(false)

  const refreshLocalAaV2PendingNeedVoteCount = useCallback((eoa: string) => {
    if (!ethers.isAddress(eoa)) {
      setAaV2PendingNeedVoteCount(0)
      return
    }
    try {
      const n = loadAllAaMultisigTasksForWallet(eoa).filter((t) =>
        viewerNeedsToSignMultisigTask(t, eoa)
      ).length
      setAaV2PendingNeedVoteCount(n)
    } catch {
      /* keep last trusted count */
    }
  }, [])

  const runAaV2PendingTasksFeedTick = useCallback(async (): Promise<void> => {
    if (aaV2PendingInFlightRef.current) return
    const raw = profilesRef.current?.[0]?.keyID?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) {
      setAaV2PendingNeedVoteCount(0)
      return
    }
    aaV2PendingInFlightRef.current = true
    try {
      const r = await runAaInstitutionalV2PendingTasksDaemonTick(raw)
      if (r.ok) {
        setAaV2PendingNeedVoteCount(r.pendingNeedVote)
      } else {
        refreshLocalAaV2PendingNeedVoteCount(raw)
      }
    } catch {
      refreshLocalAaV2PendingNeedVoteCount(raw)
    } finally {
      aaV2PendingInFlightRef.current = false
    }
  }, [refreshLocalAaV2PendingNeedVoteCount])

  const refreshAaV2PendingTasks = useCallback(async () => {
    await runAaV2PendingTasksFeedTick()
  }, [runAaV2PendingTasksFeedTick])

  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) {
      setAaV2PendingNeedVoteCount(0)
      return
    }
    refreshLocalAaV2PendingNeedVoteCount(raw)
  }, [profileWalletKeyId, refreshLocalAaV2PendingNeedVoteCount])

  /**
   * Smart Wallet Multisig list-item balances：本地优先 + 30s daemon（按 AA 串行拉取）。
   */
  const [institutionalAaAssetsByAa, setInstitutionalAaAssetsByAa] =
    useState<InstitutionalAaAssetsByAa>({})
  const institutionalAaAssetsInFlightRef = useRef(false)

  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    if (!raw || !ethers.isAddress(raw)) {
      setInstitutionalAaAssetsByAa({})
      return
    }
    setInstitutionalAaAssetsByAa(loadInstitutionalAaAssetsLocalCache(raw))
  }, [profileWalletKeyId])

  const runInstitutionalAaAssetsFeedTick = useCallback(
    async (aaAccounts?: string[]): Promise<void> => {
      const forced = Boolean(aaAccounts?.length)
      if (!forced && institutionalAaAssetsInFlightRef.current) return
      const raw = profilesRef.current?.[0]?.keyID?.trim() ?? ''
      if (!raw || !ethers.isAddress(raw)) {
        setInstitutionalAaAssetsByAa({})
        return
      }
      if (!forced) institutionalAaAssetsInFlightRef.current = true
      try {
        const r = await runAaMultisigInstitutionalAssetsDaemonTick(raw, {
          aaAccounts,
        })
        if (r.ok) {
          if (profilesRef.current?.[0]?.keyID?.trim().toLowerCase() !== raw.toLowerCase()) {
            return
          }
          setInstitutionalAaAssetsByAa(r.byAa)
        }
        /* failure: keep last trusted map */
      } catch {
        /* keep last trusted */
      } finally {
        if (!forced) institutionalAaAssetsInFlightRef.current = false
      }
    },
    []
  )

  const refreshInstitutionalAaAssets = useCallback(
    async (aaAccounts?: string[]) => {
      await runInstitutionalAaAssetsFeedTick(aaAccounts)
    },
    [runInstitutionalAaAssetsFeedTick]
  )

  const getInstitutionalAaAssets = useCallback(
    (aaAccount: string): AaMultisigTransferAssetOption[] => {
      const key = aaAccount?.trim().toLowerCase()
      if (!key) return EMPTY_INSTITUTIONAL_AA_ASSETS
      return institutionalAaAssetsByAa[key] ?? EMPTY_INSTITUTIONAL_AA_ASSETS
    },
    [institutionalAaAssetsByAa]
  )

  /**
   * CoNET Mining 全网指标（Total staked validators / DePIN nodes）：本地优先 + 6s 全局喂料。
   * 与 CoNetMiningDetailPage 同源（conetNetworkStats / conetDepinStats）。
   */
  const [conetNetworkStats, setConetNetworkStats] = useState<ConetNetworkStats>(
    () => loadConetMiningStatsLocalCache().network
  )
  const [conetDepinStats, setConetDepinStats] = useState<ConetDepinStats>(
    () => loadConetMiningStatsLocalCache().depin
  )

  /** EOA 切换：从本地恢复 Recent Activity；无缓存则等首轮拉取 */
  useLayoutEffect(() => {
    const raw = profileWalletKeyId?.trim() ?? ''
    const eoaLower = raw.toLowerCase()
    if (!eoaLower || !ethers.isAddress(eoaLower)) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaSettled(false)
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaError(null)
      setRecentActivityNoAaLoading(false)
      return
    }
    const hit = loadRecentActivityLocalCache(eoaLower)
    if (hit?.length) {
      const restored = filterRecentActivityExcludedBunitRows(txViewsFromLocalCache(hit))
      recentActivityNoAaSettledRef.current = true
      setRecentActivityNoAaSettled(true)
      setRecentActivityNoAaItems(restored)
      setRecentActivityNoAaError(null)
      setRecentActivityNoAaLoading(false)
      void enrichMerchantChargeItemsWithIndexerRoutes(restored).then((enriched) => {
        setRecentActivityNoAaItems((prev) => {
          const next = mergeChargeRouteEnrichmentIntoTxViews(
            prev.length > 0 ? prev : restored,
            enriched,
          )
          if (next.length > 0) saveRecentActivityLocalCache(eoaLower, next)
          return next
        })
      })
    } else {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaSettled(false)
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaError(null)
    }
  }, [profileWalletKeyId])

  /** AA 检测 + indexer Recent Activity + Total Power CAD（Base USDC 用 Worker 6s 上次可信值）；30s side tick */
  const runNoAaWalletFeedTick = useCallback(async (cardDetails: MyBrandCardFeedDetailsMap | null) => {
    if (noAaRecentActivityInFlight.current) return
    const profile = profilesRef.current?.[0]
    if (!profile?.keyID?.trim()) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaSettled(false)
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaLoading(false)
      setRecentActivityNoAaError(null)
      setHomeTotalPowerCad({ whole: '0', frac: '00' })
      return
    }
    const eoa = profile.keyID.trim()
    if (!ethers.isAddress(eoa)) {
      recentActivityNoAaSettledRef.current = false
      setRecentActivityNoAaSettled(false)
      setRecentActivityNoAaItems([])
      setRecentActivityNoAaLoading(false)
      setRecentActivityNoAaError(null)
      setHomeTotalPowerCad({ whole: '0', frac: '00' })
      return
    }

    noAaRecentActivityInFlight.current = true
    const hasRenderableActivity =
      recentActivityNoAaItemsRef.current.length > 0 || recentActivityNoAaSettledRef.current
    if (!hasRenderableActivity) {
      setRecentActivityNoAaLoading(true)
    }
    try {
      let effectiveAa: string | undefined =
        profile.aaAccount?.trim() && ethers.isAddress(profile.aaAccount.trim())
          ? ethers.getAddress(profile.aaAccount.trim())
          : undefined

      try {
        /**
         * Prefer session AA — skip getAAAccount RPC every side tick when already known.
         * Only resolve from chain when profile lacks a valid aaAccount.
         */
        if (!effectiveAa) {
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
        }
      } catch (e: any) {
        console.warn(`[runNoAaWalletFeedTick] getAAAccount failed (retaining existing aaAccount): ${e?.message ?? e}`)
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
      const { items, error, trusted } = await fetchMergedRecentActivityFromIndexer(accounts, {
        monthLookback: RECENT_ACTIVITY_DAEMON_MONTH_LOOKBACK,
        maxReturn: 30,
      })
      if (trusted) {
        recentActivityNoAaSettledRef.current = true
        setRecentActivityNoAaSettled(true)
        const prevItems = recentActivityNoAaItemsRef.current
        if (items.length === 0 && prevItems.length > 0) {
          /**
           * Recent Activity 是不可变历史。周期刷新中的空列表不能负向覆盖已有历史，
           * 否则 /home 会在 loading 与旧数据之间闪动。
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

      const detailsForPower = cardDetails ?? myBrandCardDetailsRef.current
      const nextPower = computeHomeTotalPowerCad(
        lastEoaUsdcForPowerRef.current,
        lastAaUsdcForPowerRef.current,
        detailsForPower,
        currencyDataRef.current
      )
      setHomeTotalPowerCad((prev) =>
        prev.whole === nextPower.whole && prev.frac === nextPower.frac ? prev : nextPower
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
      setHomeTotalPowerCad((prev) =>
        prev.whole === '0' && prev.frac === '00' ? prev : { whole: '0', frac: '00' }
      )
      return
    }
    const nextPower = computeHomeTotalPowerCad(
      lastEoaUsdcForPowerRef.current,
      lastAaUsdcForPowerRef.current,
      myBrandCardDetailsRef.current,
      currencyData
    )
    setHomeTotalPowerCad((prev) =>
      prev.whole === nextPower.whole && prev.frac === nextPower.frac ? prev : nextPower
    )
  }, [currencyData])

  const globalWalletFeedInFlightRef = useRef<Promise<void> | null>(null)
  /**
   * Main-thread remainder of the 30s side chain (not 6s wallet).
   * Worker 6s owns CoNET dashboard snapshot + Base USDC;
   * main runs My Brands + Recent Activity on side cadence.
   */
  const runGlobalWalletFeedTick = useCallback(
    async (kinds?: Set<AppDaemonMainTickKind>) => {
      const current = globalWalletFeedInFlightRef.current
      if (current) return current
      const wantAll = !kinds || kinds.size === 0
      const wantBrands = wantAll || kinds.has('myBrands') || kinds.has('recentActivity')
      if (!wantBrands) return
      const work = (async () => {
        const cardDetails = await runMyBrandsFeedTick()
        await runNoAaWalletFeedTick(cardDetails)
      })()
      globalWalletFeedInFlightRef.current = work
      try {
        await work
      } finally {
        if (globalWalletFeedInFlightRef.current === work) {
          globalWalletFeedInFlightRef.current = null
        }
      }
    },
    [runMyBrandsFeedTick, runNoAaWalletFeedTick],
  )

  const refreshRecentActivityNoAa = useCallback(async () => {
    await refreshAppDaemonNow('wallet')
  }, [])

  /** Push EOA/AA session to App Daemon Worker (no private keys). */
  useEffect(() => {
    const eoa = profileWalletKeyId?.trim()
    const aa = profiles?.[0]?.aaAccount?.trim()
    void setAppDaemonSession(eoa, aa).catch(() => undefined)
  }, [profileWalletKeyId, profiles?.[0]?.aaAccount])

  /** Mirror Worker CoNET balances into React state (trusted-only). */
  useEffect(() => {
    void initAppDaemonWorker(null).catch(() => undefined)
    return onAppDaemonWalletBalances((ev) => {
      const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
      if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
      setConetWalletBalances(ev.eoaBalances)
      saveConetWalletBalancesLocalCache(ev.eoa, ev.eoaBalances)
      if (ev.aaBalances) {
        const aa = profilesRef.current?.[0]?.aaAccount?.trim().toLowerCase() ?? ''
        if (aa) {
          setConetAaWalletBalances(ev.aaBalances)
          saveConetWalletBalancesLocalCache(aa, ev.aaBalances)
        }
      }
    })
  }, [])

  /** Mirror Worker 6s Base USDC (EOA+AA) — trusted-only; never zero on RPC failure. */
  useEffect(() => {
    return onAppDaemonBaseUsdcBalances((ev) => {
      const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
      if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
      const eoaNum = parseFloat(ev.eoaUsdc) || 0
      setUsdcbalance((prev) => (prev === eoaNum ? prev : eoaNum))
      lastEoaUsdcForPowerRef.current = ev.eoaUsdc
      if (ev.aaUsdc === null) {
        setAaAccountUsdcBalance((prev) => (prev === '0' ? prev : '0'))
        lastAaUsdcForPowerRef.current = '0'
        saveBaseUsdcBalanceLocalCache(currentEoa, { eoaUsdc: ev.eoaUsdc, aaUsdc: '0' })
      } else if (typeof ev.aaUsdc === 'string') {
        const aaTrusted = ev.aaUsdc
        setAaAccountUsdcBalance((prev) => (prev === aaTrusted ? prev : aaTrusted))
        lastAaUsdcForPowerRef.current = aaTrusted
        saveBaseUsdcBalanceLocalCache(currentEoa, { eoaUsdc: ev.eoaUsdc, aaUsdc: aaTrusted })
      } else {
        saveBaseUsdcBalanceLocalCache(currentEoa, { eoaUsdc: ev.eoaUsdc })
      }
      const nextPower = computeHomeTotalPowerCad(
        lastEoaUsdcForPowerRef.current,
        lastAaUsdcForPowerRef.current,
        myBrandCardDetailsRef.current,
        currencyDataRef.current,
      )
      setHomeTotalPowerCad((prev) =>
        prev.whole === nextPower.whole && prev.frac === nextPower.frac ? prev : nextPower,
      )
    })
  }, [])

  /** Worker mining / oracle / L0 / validator / referrer / discover / coupon mirrors. */
  useEffect(() => {
    const offs = [
      onAppDaemonMiningStats((ev) => {
        if (ev.network) {
          setConetNetworkStats(ev.network)
          saveConetMiningStatsLocalCache({ network: ev.network })
        }
        if (ev.depin) {
          setConetDepinStats(ev.depin)
          saveConetMiningStatsLocalCache({ depin: ev.depin })
        }
      }),
      onAppDaemonOracleRates((ev) => {
        setCurrencyData(ev.currencyData)
      }),
      onAppDaemonL0StartKit((ev) => {
        const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
        if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
        if (!ev.isL0) {
          clearReferralL0StartKitQuotaLocalCache(ev.eoa)
          setReferralL0StartKitQuota(null)
          return
        }
        if (ev.quota) {
          saveReferralL0StartKitQuotaLocalCache(ev.quota)
          setReferralL0StartKitQuota(ev.quota)
        }
      }),
      onAppDaemonValidatorProfile((ev) => {
        const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
        if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
        const profile = ev.profile as ValidatorWalletNodeProfile
        if (!profile?.wallet) return
        setValidatorWalletNodeProfile(profile)
        seedValidatorWalletNodeProfileCache(ev.eoa.toLowerCase(), profile)
      }),
      onAppDaemonReferrerSummary((ev) => {
        const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
        if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
        const summary = ev.summary as ReferrerDashboardSummary
        if (!summary?.referrer) return
        setReferrerSummary(summary)
        seedReferrerSummaryCache(ev.eoa.toLowerCase(), summary)
      }),
      onAppDaemonUnifiedIncome((ev) => {
        const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
        if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
        const stats = ev.stats as UnifiedIncomeStats
        if (!stats || typeof stats !== 'object') return
        const previous = unifiedIncomeStatsRef.current
        const sameBeneficiary =
          previous?.beneficiary &&
          stats.beneficiary &&
          previous.beneficiary.toLowerCase() === stats.beneficiary.toLowerCase()
        let nextStats = stats
        if (!stats.airdropReadOk && sameBeneficiary && previous?.airdrop) {
          nextStats = { ...nextStats, airdrop: previous.airdrop }
        }
        if (!stats.gbPaidDepinReadOk && sameBeneficiary && previous?.gbPaidDepinReceived) {
          nextStats = { ...nextStats, gbPaidDepinReceived: previous.gbPaidDepinReceived }
        }
        unifiedIncomeStatsRef.current = nextStats
        setUnifiedIncomeStats(nextStats)
        seedUnifiedIncomeStatsCache(ev.eoa.toLowerCase(), nextStats)
      }),
      onAppDaemonDiscoverMerchantStats((ev) => {
        for (const row of ev.stats) {
          const cardLower = row.cardAddress.toLowerCase()
          setDiscoverMerchantStatByCard((prev) => {
            const existing = prev[cardLower]
            const mergedLike = mergeDiscoverMerchantLikeCount(
              row.likeCount,
              existing?.likeCount,
              existing?.savedAt,
            )
            const mergedRef = mergeDiscoverMerchantRefClickCount(
              row.refClickChain,
              row.refClickDb,
              existing?.refClickCount,
            )
            const nextEntry: DiscoverMerchantStatEntry = {
              likeCount: mergedLike,
              refClickCount: mergedRef,
              savedAt: Date.now(),
            }
            if (
              existing?.likeCount === nextEntry.likeCount &&
              existing?.refClickCount === nextEntry.refClickCount
            ) {
              return prev
            }
            return { ...prev, [cardLower]: nextEntry }
          })
          const patch: { likeCount?: number; refClickCount?: number } = {}
          if (row.likeCount != null) {
            const merged = mergeDiscoverMerchantLikeCount(row.likeCount, undefined, undefined)
            if (merged != null) patch.likeCount = merged
          }
          const mergedRef = mergeDiscoverMerchantRefClickCount(
            row.refClickChain,
            row.refClickDb,
            undefined,
          )
          if (mergedRef != null) patch.refClickCount = mergedRef
          if (Object.keys(patch).length > 0) {
            saveDiscoverMerchantStatEntry(cardLower, patch)
          }
        }
      }),
      onAppDaemonCouponSocial((ev) => {
        for (const row of ev.stats) {
          const k = buildCouponSocialStatKey(row.cardAddress, row.tokenId)
          if (!k) continue
          setCouponSocialStatByKey((prev) => {
            const existing = prev[k]
            const mergedLike = mergeCouponSocialLikeCount(
              row.likeCount,
              existing?.likeCount,
              existing?.savedAt,
            )
            const patch: {
              likeCount?: number
              shareClickCount?: number
              maxSupply?: string | null
              remainingSupply?: string | null
            } = {}
            if (mergedLike != null) patch.likeCount = mergedLike
            if (row.shareClickCount != null) patch.shareClickCount = row.shareClickCount
            if (row.maxSupply !== undefined) patch.maxSupply = row.maxSupply
            if (row.remainingSupply !== undefined) patch.remainingSupply = row.remainingSupply
            if (Object.keys(patch).length === 0) return prev
            const saved = saveCouponSocialStatEntry(row.cardAddress, row.tokenId, patch)
            if (!saved) return prev
            if (
              existing?.likeCount === saved.likeCount &&
              existing?.shareClickCount === saved.shareClickCount &&
              existing?.maxSupply === saved.maxSupply &&
              existing?.remainingSupply === saved.remainingSupply
            ) {
              return prev
            }
            return { ...prev, [k]: saved }
          })
        }
      }),
      onAppDaemonCouponOpenClaim((ev) => {
        const currentEoa = profilesRef.current?.[0]?.keyID?.trim().toLowerCase() ?? ''
        if (!currentEoa || ev.eoa.toLowerCase() !== currentEoa) return
        for (const row of ev.results) {
          const entry = saveCouponOpenClaimLocalStatus({
            eoaAddress: ev.eoa,
            cardAddress: row.cardAddress,
            tokenId: row.tokenId,
            couponId: row.couponId,
            status: row.status,
            source: 'chain',
          })
          const k = buildCouponOpenClaimStatusKey(row.cardAddress, row.tokenId)
          if (!entry || !k) continue
          setCouponOpenClaimStatusByKey((prev) => {
            const prevEntry = prev[k]
            if (
              prevEntry &&
              prevEntry.status === entry.status &&
              prevEntry.source === entry.source &&
              prevEntry.savedAt === entry.savedAt
            ) {
              return prev
            }
            return { ...prev, [k]: entry }
          })
          if (row.status === 'redeemed') {
            setMyBrandCardDetails((prev) => {
              const pruned = pruneRedeemedOwnedCouponsFromDetails(prev, {
                ...loadCouponOpenClaimStatusMapForEoa(ev.eoa),
                [k]: entry,
              })
              return pruned
            })
          }
        }
      }),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [])

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

  /** 全局 Oracle：Worker 5min tick 镜像；手动 refresh 触发 Worker 立刻重拉 */
  const fetchOracle = useCallback(async () => {
    await refreshAppDaemonNow('all')
  }, [])

  const refreshOracle = useCallback(() => {
    void fetchOracle()
  }, [fetchOracle])

  /**
   * App Daemon Worker owns feeder schedules + portable pure reads (incl. unifiedIncome).
   * Main only runs needMainTick for My Brands / Recent Activity / Genesis / AA pending+assets.
   */
  useEffect(() => {
    return onAppDaemonNeedMainTick(async (ev) => {
      const kinds = new Set<AppDaemonMainTickKind>(ev.kinds)
      const walletKinds: AppDaemonMainTickKind[] = ['myBrands', 'recentActivity']
      if (walletKinds.some((k) => kinds.has(k))) {
        await runGlobalWalletFeedTick(kinds)
      }
      if (kinds.has('genesisIncome')) {
        await runGenesisIncomeFeedTick()
      }
      if (kinds.has('aaV2Pending')) {
        await runAaV2PendingTasksFeedTick()
      }
      if (kinds.has('aaInstitutionalAssets')) {
        await runInstitutionalAaAssetsFeedTick()
      }
    })
  }, [
    runGlobalWalletFeedTick,
    runGenesisIncomeFeedTick,
    runAaV2PendingTasksFeedTick,
    runInstitutionalAaAssetsFeedTick,
  ])

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
				recentActivityNoAaItems, recentActivityNoAaSettled, recentActivityNoAaLoading, recentActivityNoAaError, refreshRecentActivityNoAa,
				conetNetworkStats, conetDepinStats, conetWalletBalances, conetAaWalletBalances, validatorWalletNodeProfile, unifiedIncomeStats, referrerSummary,
				referralL0StartKitQuota, refreshReferralL0StartKitQuota,
				genesisIncomeByEoa, registerGenesisIncomeFeedAccounts, refreshGenesisIncomeFeed,
				discoverMerchantStatByCard, registerDiscoverMerchantStatFeedCards, applyDiscoverMerchantLikeCountDelta,
				couponOpenClaimStatusByKey, registerCouponOpenClaimFeedTargets, applyCouponOpenClaimStatus,
				getCouponOpenClaimStatus, refreshCouponOpenClaimStatusFeed,
				couponSocialStatByKey, registerCouponSocialFeedTargets, getCouponSocialStat,
				formatCouponSupplySummary, applyCouponSocialLikeCountDelta, refreshCouponSocialStatsFeed,
				aaV2PendingNeedVoteCount, refreshAaV2PendingTasks,
				institutionalAaAssetsByAa, refreshInstitutionalAaAssets, getInstitutionalAaAssets,
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
