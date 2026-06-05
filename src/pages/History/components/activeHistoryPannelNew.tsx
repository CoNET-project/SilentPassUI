import { IpfsImg } from '@/components/IpfsImg';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ethers } from 'ethers'
import {
	ArrowUpRight,
	ArrowDownLeft,
	Check,
	CreditCard,
	QrCode,
	X,
	XCircle,
	ArrowRightLeft,
	Ticket,
	Loader,
	RefreshCw,
	Wallet,
	Copy,
	ExternalLink,
	Code,
	Hash,
	Share2,
	Clock,
	Ban,
	CheckCircle2,
	Coins,
	MessageCircle,
	ChevronRight,
	ChevronLeft,
	Zap,
	Plus,
	Gift,
	Package,
} from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import {
	fetchMergedRecentActivityFromIndexer,
	resolveTxViewBaseScanTxHash,
	isRecentActivityCardTopupCategory,
	isRecentActivityIssuedNftClaimTxView,
	merchantGiftListTitle,
	isMerchantChargeTxView,
	merchantChargeCardAddressFromTxView,
	merchantChargeCardAddressFromRaw,
	merchantChargeChannelLabel,
	merchantChargeDisplayFiatAmount,
	merchantChargeListCurrencyCode,
	parseMerchantChargeDisplayJson,
	resolveChargeRewardDisplayFromTxView,
	formatChargeRewardPointValue,
	recentActivityTopupPaymentLegLabel,
	buildRecentActivityCardNameDirectory,
	parseRecentActivityTopupDisplayJson,
	topupCardAddressFromTxView,
	resolveIndexerPayeeAddress,
	type TxView,
	type RawTxRecord,
	type RouteItemRecord,
	type TxDisplayType,
} from '@/pages/History/recentActivityIndexerMerge'
import { indexerRouteCardAddress } from '@/utils/indexerCatalogRedeemClaim'
import { useIssuedNftClaimSeriesTitle } from '@/hooks/useIssuedNftClaimSeriesTitle'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import { pickMerchantChargeListTitle, pickMerchantTopupListTitle, pickMerchantProgramDisplayName } from '@/utils/merchantCardDatabase'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { searchUsername } from '@/services/beamio'
import { conetDepinProvider, beamioApi, baseEndpoint } from '@/utils/constants'
import contracts from '@/utils/contracts'
import { formatAmount, formatAmountWithCurrencyProtocol, fiatPrefix, getDecimals } from '@/services/currency'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { formatBeamioTransactionTimeLabel } from '@/utils/beamioTransactionTimeLabel'
import { shouldUpdateRecentActivityList } from '@/utils/recentActivityFeedState'
import { CAPSULE_BTN_CLASS } from '@/utils/uiCommon'
import ShowCard from '@/components/card/ShowCard'
import {
	MyBrandCardAddressCapsule,
	MyBrandMerchantIcon,
	resolveMyBrandCardIconUrl,
} from '@/pages/Brands/MyBrandsListSection'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/logo512.png'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import VscodeJsonBlock from '@/components/VscodeJsonBlock'

const BEAMIO_INDEXER = contracts.BeamioDiamond?.address ?? '0xd764eBA64536cFF1bbE7e7c7Bbc90F35620f72a9'

const TX_RECORD_TUPLE =
	'(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists, address topAdmin, address subordinate)'
const TX_FULL_TUPLE =
	'(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, address topAdmin, address subordinate, (address asset, uint256 amountE6, uint8 assetType, uint8 source, uint256 tokenId, uint8 itemCurrencyType, uint256 offsetInRequestCurrencyE6)[] route, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta)'

/** Indexer 合约 ABI：列表查询 + 完整 Transaction 查询（含 payer/payee/route） */
const INDEXER_ABI = [
	`function getAccountTransactionsByMonthOffsetPaged(address account, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_RECORD_TUPLE}[] page)`,
	`function getTransactionFullByTxId(bytes32 txId) view returns (${TX_FULL_TUPLE})`,
] as const

/** Top Up / 卡元数据展示用 txCategory（与 indexer 一致） */
const TX_ISSUE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('iuuseNewCard'))
const TX_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('upgradeNewCard'))
const TX_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('topupCard'))
const NFT_START_ID = 100n
const ISSUED_NFT_START_ID = 100_000_000_000n

const normalizeHexColor = (raw: unknown): string | null => {
	if (typeof raw !== 'string') return null
	const s = raw.trim().replace(/^#/, '')
	if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
	return `#${s.toUpperCase()}`
}

const getReadableTextColor = (hexColor: string): '#000000' | '#FFFFFF' => {
	const h = hexColor.replace('#', '')
	if (h.length !== 6) return '#FFFFFF'
	const r = parseInt(h.slice(0, 2), 16)
	const g = parseInt(h.slice(2, 4), 16)
	const b = parseInt(h.slice(4, 6), 16)
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
	return luminance > 0.68 ? '#000000' : '#FFFFFF'
}

const UsdcBaseCompositeIcon = ({ className = '' }: { className?: string }) => (
	<span className={`relative flex-shrink-0 ${className || 'w-4 h-4 min-w-[16px] min-h-[16px]'}`}>
		<IpfsImg src={usdcIcon} alt="USDC" className="block w-full h-full rounded-full object-contain" />
		<IpfsImg
			src={baseIcon}
			alt="Base"
			className="block w-[62.5%] h-[62.5%] absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white object-contain"
		/>
	</span>
)

/** 按币种格式化带符号金额，使用 meta.currencyFiat 对应的小数位 */
function formatCurrencySigned(amount: number, currencyCode: string) {
	const amt = Math.abs(amount)
	const decimals = getDecimals(currencyCode as 'CAD'|'USD'|'JPY'|'CNY'|'USDC'|'HKD'|'EUR'|'SGD'|'TWD')
	const formatted = amt.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
	if (amount > 0) return `+ ${formatted} ${currencyCode}`
	if (amount < 0) return `- ${formatted} ${currencyCode}`
	return `0.00 ${currencyCode}`
}

/** Top-up list row: prefix glued to amount, e.g. +CA$100 */
function formatTopupListAmountPositive(amountFiat: number, currencyCode: string): string {
	const ccy = (currencyCode || 'USD') as ICurrency
	const prefix = ccy === 'USDC' ? '$' : fiatPrefix(ccy)
	const formatted = formatAmount(Math.abs(amountFiat), ccy)
	return `+${prefix}${formatted}`
}

function formatTopupBonusSubtitleAmount(amountFiat: number, currencyCode: string): string {
	const ccy = (currencyCode || 'USD') as ICurrency
	const prefix = ccy === 'USDC' ? '$' : fiatPrefix(ccy)
	const formatted = formatAmount(Math.abs(amountFiat), ccy)
	return `+${prefix}${formatted}`
}

/** Merchant charge list row: prefix glued to amount, e.g. -CA$24.00 */
function formatMerchantChargeListAmountNegative(amountFiat: number, currencyCode: string): string {
	const ccy = (currencyCode || 'USD') as ICurrency
	const prefix = ccy === 'USDC' ? '$' : fiatPrefix(ccy)
	const formatted = formatAmount(Math.abs(amountFiat), ccy)
	return `-${prefix}${formatted}`
}

function formatMerchantChargeTipSubtitleAmount(amountFiat: number, currencyCode: string): string {
	const ccy = (currencyCode || 'USD') as ICurrency
	const prefix = ccy === 'USDC' ? '$' : fiatPrefix(ccy)
	const formatted = formatAmount(Math.abs(amountFiat), ccy)
	return `${prefix}${formatted}`
}

function extractTxRecordAddr(v: unknown): string {
	return typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
}

/** 判断 request 类记录是否已过期（request_expired 或 request_create 逾 validDays） */
function isRequestExpired(tx: TxView): boolean {
	if (tx.type === 'request_expired') return true
	if (tx.type !== 'request_create') return false
	const raw = tx.rawTransaction as RawTxRecord | undefined
	const displayJsonStr = raw?.displayJson ?? ''
	try {
		const j = JSON.parse(displayJsonStr || '{}')
		const validity = j.validity as { expiresAt?: number; validDays?: number } | undefined
		const tsRaw = raw?.timestamp ?? 0n
		const tsSec = Number(tsRaw) < 10_000_000_000 ? Number(tsRaw) : Number(tsRaw) / 1000
		const expiresAtSec = validity?.expiresAt ?? (validity?.validDays ? tsSec + validity.validDays * 86400 : 0)
		return expiresAtSec > 0 && Date.now() / 1000 > expiresAtSec
	} catch {
		return false
	}
}

/** 从 rawTransaction 提取 originalPaymentHash（hex 字符串），用于分组 */
function getOriginalPaymentHash(tx: TxView): string {
	const raw = tx.rawTransaction as RawTxRecord | undefined
	const oph = raw?.originalPaymentHash
	if (!oph) return ''
	const hex = typeof oph === 'string' ? oph : ethers.hexlify(oph as ethers.BytesLike)
	return hex === ethers.ZeroHash ? '' : hex
}

function amountFiatSigned(tx: TxView): number {
	return tx.isInbound ? tx.amountFiat : -tx.amountFiat
}

/** Charge routing 商户行：有 tip 时展示 subtotal，使 商户行 + tip = Total */
function resolveMerchantChargeRoutingLineFiat(
	legFiat: number,
	totalFiat: number,
	tipFiat: number,
	voucherLegCount: number,
): number {
	if (!(tipFiat > 0) || !(totalFiat > 0)) return legFiat
	if (voucherLegCount === 1) return Math.max(0, totalFiat - tipFiat)
	return Math.max(0, legFiat - (tipFiat * legFiat) / totalFiat)
}

const FEE_INFO_KEYS = ['gasChainType', 'gasWei', 'gasUSDC6', 'serviceUSDC6', 'bServiceUSDC6', 'bServiceUnits6', 'feePayer'] as const
const META_KEYS = ['requestAmountFiat6', 'requestAmountUSDC6', 'currencyFiat', 'discountAmountFiat6', 'discountRateBps', 'taxAmountFiat6', 'taxRateBps', 'afterNotePayer', 'afterNotePayee'] as const
const ROUTE_ITEM_KEYS = ['asset', 'amountE6', 'assetType', 'source', 'tokenId', 'itemCurrencyType', 'offsetInRequestCurrencyE6'] as const

/** RouteSource: 0=MainUSDC, 1=UserCardPoint, 2=UserCardCoupon, 3=UserCardCashVoucher, 4=TipAppend */
function routeItemLabel(source: number, isAA: boolean): { primary: string; secondary: string } {
	switch (source) {
		case 0: return { primary: 'USDC', secondary: isAA ? 'Cash • Express Pay (AA)' : 'Cash • Main Wallet (EOA)' }
		case 1: return { primary: 'Points', secondary: 'Points • Express Pay' }
		case 2: return { primary: 'Coupon', secondary: 'Coupon • Express Pay' }
		case 3: return { primary: 'Voucher', secondary: 'Voucher • Express Pay' }
		case 4: return { primary: 'Tip', secondary: 'Tip' }
		default: return { primary: 'Asset', secondary: 'Express Pay' }
	}
}

/** 将 positional 数组转为具名对象 */
function arrayToNamed<T extends readonly string[]>(arr: unknown[], keys: T): Record<T[number], unknown> {
	const out = {} as Record<string, unknown>
	keys.forEach((k, i) => { if (arr[i] !== undefined) out[k] = arr[i] })
	return out as Record<T[number], unknown>
}

/** 递归 bigint -> string，并将 fees/meta/route 数组转为具名对象 */
function toNamedTransactionJson(obj: unknown): Record<string, unknown> {
	const toStr = (v: unknown): unknown => {
		if (typeof v === 'bigint') return v.toString()
		if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
			const o: Record<string, unknown> = {}
			for (const [k, v2] of Object.entries(v)) {
				if (v2 !== undefined && !/^\d+$/.test(k)) o[k] = toStr(v2)
			}
			return o
		}
		if (Array.isArray(v)) return v.map(toStr)
		return v
	}

	const raw = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? (obj as Record<string, unknown>) : {}
	const out: Record<string, unknown> = {}

	for (const [k, v] of Object.entries(raw)) {
		if (v === undefined || /^\d+$/.test(k)) continue
		if (k === 'fees' && Array.isArray(v) && v.length >= 7) {
			out.fees = arrayToNamed(v.map(toStr), FEE_INFO_KEYS)
			continue
		}
		if (k === 'meta' && Array.isArray(v) && v.length >= 9) {
			out.meta = arrayToNamed(v.map(toStr), META_KEYS)
			continue
		}
		if (k === 'route' && Array.isArray(v)) {
			out.route = v.map((r) => Array.isArray(r) && r.length >= 7 ? arrayToNamed(r.map(toStr), ROUTE_ITEM_KEYS) : toStr(r))
			continue
		}
		out[k] = toStr(v)
	}
	return out
}

/** 将 raw tx 转为 JSON 可序列化对象（bigint -> string，fees/meta 具名） */
function serializeTransaction(tx: RawTxRecord): Record<string, unknown> {
	return toNamedTransactionJson(tx)
}

/** Smart Receipt 调试视图：与 bizSite TxDisplayRow 一致，顶层为 mapped UI 字段，raw 为 BeamioIndexerDiamond row。 */
function buildSmartReceiptIndexerRowJson(tx: TxView, fullRaw: Record<string, unknown> | null): Record<string, unknown> {
	const { rawTransaction: _rawTransaction, ...mapped } = tx
	return {
		...mapped,
		raw: fullRaw ?? (tx.rawTransaction ? serializeTransaction(tx.rawTransaction) : null),
	}
}

/** 从 request 类 Transaction 组装 https://beamio.app/Vouchers URL */
function buildVouchersUrl(tx: TxView): string | null {
	const raw = tx.rawTransaction as RawTxRecord | undefined
	if (!raw) return null
	const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
	const toAddr = extractAddr(raw.payee)
	if (!toAddr || !ethers.isAddress(toAddr)) return null
	const hashRaw = raw.originalPaymentHash
	const requestHash = hashRaw ? (typeof hashRaw === 'string' ? hashRaw : ethers.hexlify(hashRaw as ethers.BytesLike)) : ''
	if (!requestHash) return null
	let forText = ''
	let validDays = 1
	try {
		const j = JSON.parse(raw.displayJson || '{}')
		forText = typeof j.forText === 'string' ? j.forText.trim() : ''
		validDays = typeof j.validity?.validDays === 'number' ? Math.max(1, Math.floor(j.validity.validDays)) : 1
	} catch {}
	const amount = Math.abs(tx.amountFiat)
	const params = new URLSearchParams({
		Amount: amount.toString(),
		currency: tx.currencyCode,
		acceptTokens: 'USDC,CCSA',
		to: toAddr,
		requestHash,
		validDays: String(validDays),
	})
	if (forText) params.set('forText', forText)
	return `https://beamio.app/Vouchers?${params.toString()}`
}

/** 从地址构建最小 searchResult（无链上 profile 时用于 Chat initMessage） */
function buildSearchResultFromAddress(address: string, cached?: searchResult | null): searchResult {
	if (cached && (cached.address || '').toLowerCase() === address.toLowerCase()) return cached
	return {
		address: ethers.getAddress(address),
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: '',
		image: '',
	}
}

/** 从 searchResult 解析 fullName 与 beamioTag */
function parsePeerToDisplay(peer: searchResult) {
	const first = peer.first_name ?? ''
	const lastRaw = peer.last_name ?? ''
	const lastPart = String(lastRaw).split('\r\n')[0] ?? ''
	const lastNameOnly = /^\{/.test(lastPart) ? '' : lastPart
	const name = `${first} ${lastNameOnly}`.trim()
	const tag = (peer as { username?: string; accountName?: string }).username || (peer as { accountName?: string }).accountName
	return { fullName: name, beamioTag: tag ? `@${tag}` : null }
}

/** 占位 title（地址缩略 / 空 / 通用名）— 异步数据就绪后只升级一次，避免 Recent Activity 列表抖动 */
function isProvisionalRecentActivityTitle(text: string): boolean {
	const t = String(text ?? '').trim()
	if (!t) return true
	if (t === 'Unknown') return true
	if (t === 'Merchant Payment' || t === 'Top-up') return true
	if (/^Top-up:\s*$/i.test(t)) return true
	if (/0x[a-f0-9]{4}…[a-f0-9]{4}/i.test(t)) return true
	return false
}

function isLegacyMislabeledTopupTitle(text: string): boolean {
	return /^top-up:\s*/i.test(String(text ?? '').trim())
}

function isLegacyTopupMembershipMislabel(text: string): boolean {
	return /^top-up:\s*membership$/i.test(String(text ?? '').trim())
}

function isLegacyIndexerRedeemPlaceholderTitle(text: string): boolean {
	return /^redeem\s+(?:new|upgrade(?:\s+new)?|top\s*-?\s*up)\s+card$/i.test(String(text ?? '').trim())
}

function isGenericIssuedNftClaimFallbackTitle(text: string): boolean {
	return /^claim\s+(?:coupon|catalog)s?$/i.test(String(text ?? '').trim())
}

function isIssuedNftClaimActivityTitle(text: string): boolean {
	const t = String(text ?? '').trim()
	if (!t) return false
	if (isLegacyIndexerRedeemPlaceholderTitle(t)) return false
	if (isLegacyMislabeledTopupTitle(t)) return false
	if (isGenericIssuedNftClaimFallbackTitle(t)) return false
	return true
}

function useStableRecentActivityTitle(txId: string, candidate: string): string {
	const ref = useRef<{ txId: string; title: string }>({ txId: '', title: '' })
	if (ref.current.txId !== txId) {
		ref.current = { txId, title: candidate }
		return candidate
	}
	const prev = ref.current.title
	const next = candidate
	if (
		(isLegacyMislabeledTopupTitle(prev) ||
			isLegacyTopupMembershipMislabel(prev) ||
			isLegacyIndexerRedeemPlaceholderTitle(prev) ||
			isGenericIssuedNftClaimFallbackTitle(prev)) &&
		isIssuedNftClaimActivityTitle(next)
	) {
		ref.current.title = next
		return next
	}
	if (!isProvisionalRecentActivityTitle(prev)) {
		return prev
	}
	if (!isProvisionalRecentActivityTitle(next) || next.length > prev.length) {
		ref.current.title = next
		return next
	}
	return prev || next
}

/** 商户 icon URL 就绪后保持，避免 IPFS 加载中空窗与字母来回闪 */
function useStableMerchantIconUrl(txId: string, candidate: string | undefined): string | undefined {
	const ref = useRef<{ txId: string; url: string | undefined }>({ txId: '', url: undefined })
	if (ref.current.txId !== txId) {
		ref.current = { txId, url: candidate }
		return candidate
	}
	if (candidate) {
		ref.current.url = candidate
		return candidate
	}
	return ref.current.url
}

/** Recent Activity 行左侧 icon 槽 — 固定 36px，避免 Lucide 尺寸差导致垂直跳动 */
const RECENT_ACTIVITY_ROW_ICON_OUTER_CLASS =
	'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] shadow-sm'
const RECENT_ACTIVITY_ROW_ICON_INNER_CLASS =
	'flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4'

/** 通过地址获取对方 firstname+lastname 与 @beamioTag，用于 EOA Sent 展示；优先使用 beamioUsers 缓存 */
function useCounterpartyProfile(address: string | undefined) {
	const { beamioUsers, setbBeamioUsers } = useDaemonContext()
	const [fullName, setFullName] = useState('')
	const [beamioTag, setBeamioTag] = useState<string | null>(null)
	const findingRef = useRef(false)
	const lastAddrRef = useRef<string | null>(null)
	const dataForAddrRef = useRef<string | null>(null)

	// 地址变化时重置，避免切换交易时显示上一笔的 beamioTag
	useEffect(() => {
		const addr = address && ethers.isAddress(address) ? address.toLowerCase() : null
		if (addr !== lastAddrRef.current) {
			lastAddrRef.current = addr
			dataForAddrRef.current = null
			setFullName('')
			setBeamioTag(null)
		}
	}, [address])

	useEffect(() => {
		if (!address || !ethers.isAddress(address)) return
		const addr = address.toLowerCase()

		if (dataForAddrRef.current === addr) return

		// 优先从 beamioUsers 缓存读取（与 Chat 一致）
		const cached = beamioUsers?.find((n) => (n?.address || '').toLowerCase() === addr)
		if (cached) {
			const { fullName: fn, beamioTag: bt } = parsePeerToDisplay(cached)
			dataForAddrRef.current = addr
			setFullName(fn)
			setBeamioTag(bt)
			return
		}

		const find = async () => {
			if (findingRef.current || dataForAddrRef.current === addr) return
			findingRef.current = true
			try {
				const res = await searchUsername(addr)
				// 地址已切换则不再更新，避免竞态导致显示错误 beamioTag
				if (lastAddrRef.current !== addr) return
				const peer: searchResult | null = res?.results?.[0] ?? null
				if (!peer) return
				const { fullName: fn, beamioTag: bt } = parsePeerToDisplay(peer)
				dataForAddrRef.current = addr
				setFullName(fn)
				setBeamioTag(bt)
				const updater = (prev: searchResult[]) => {
					const a = (peer.address || '').toLowerCase()
					if (prev.some((u) => (u?.address || '').toLowerCase() === a)) return prev
					return [...prev, peer]
				}
				;(setbBeamioUsers as React.Dispatch<React.SetStateAction<searchResult[]>>)?.(updater)
			} finally {
				findingRef.current = false
			}
		}
		void find()
	}, [address, beamioUsers, setbBeamioUsers])

	return { fullName, beamioTag }
}

type RecentActivityTxItemRowProps = {
	tx: TxView
	activeTab?: 'All' | 'Cash' | 'Vouchers'
	eoa?: string
	aa?: string
	myAddress?: string
	canceledHashes: Set<string>
	recentActivityCardNameDirectory: Map<string, string>
	onSelect: (tx: TxView) => void
	iconForType: (type: TxDisplayType, size: number, tx?: TxView) => React.ReactNode
	colorForType: (type: TxDisplayType) => string
}

function RecentActivityTxItemRow({
	tx,
	activeTab: rowActiveTab,
	eoa,
	aa,
	myAddress,
	canceledHashes,
	recentActivityCardNameDirectory,
	onSelect,
	iconForType,
	colorForType,
}: RecentActivityTxItemRowProps) {
	const { resolveDisplayName, registerCardAddresses, fetchCardMetadata, cardMap, peekMetadata } =
		useMerchantCardDatabase()
	const isInternalTransfer = tx.type === 'internal_transfer' && !isMerchantChargeTxView(tx)
	const isReqExpired = (tx.type === 'request_create' || tx.type === 'request_expired') && isRequestExpired(tx)
	const isReqCanceled = tx.type === 'request_create' && canceledHashes.has(getOriginalPaymentHash(tx))
	const rawTx = tx.rawTransaction as RawTxRecord | undefined
	const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
	const payerAddr = extractTxRecordAddr(rawTx?.payer) ?? ''
	const payeeAddr = extractTxRecordAddr(rawTx?.payee) ?? ''
	const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
	const aaAddr = (aa ?? '').toLowerCase()

	// payee 决定资金流向：payee=EOA → Express Pay → Main Wallet (AA→EOA)，payee=AA → Main Wallet → Express Pay (EOA→AA)
	const internalTitle = isInternalTransfer && eoaAddr && aaAddr
		? (payeeAddr.toLowerCase() === eoaAddr ? 'Express Pay → Main Wallet' : payeeAddr.toLowerCase() === aaAddr ? 'Main Wallet → Express Pay' : 'Internal Transfer')
		: tx.title

	const isAddToExpressPay = isInternalTransfer && payeeAddr.toLowerCase() === aaAddr
	// 根据 payer/payee 判断我方使用的钱包类型：收款时看 payee，付款时看 payer（indexer 的 isAAAccount 可能不准确）
	const mySideIsAA = tx.isInbound ? (payeeAddr.toLowerCase() === aaAddr) : (payerAddr.toLowerCase() === aaAddr)
	const isEoaSent = !mySideIsAA && !tx.isInbound && !isInternalTransfer
	const isAASent = mySideIsAA && !tx.isInbound && !isInternalTransfer
	const isEoaReceived = !mySideIsAA && tx.isInbound && !isInternalTransfer
	const isAAReceived = mySideIsAA && tx.isInbound && !isInternalTransfer
	const needsCounterparty =
		isEoaSent || isEoaReceived || tx.type === 'request_fulfilled' || tx.type === 'merchant_gift'
	const { fullName, beamioTag } = useCounterpartyProfile(needsCounterparty ? tx.counterpartyAddress : undefined)
	const handleIsJson = (s: string | undefined) => !s || /^[\s]*\{/.test(s) || /"currency"/.test(s)
	const safeHandle = handleIsJson(tx.handle) ? '' : tx.handle
	const shortAddr = tx.counterpartyAddress && tx.counterpartyAddress.length >= 10
		? `${tx.counterpartyAddress.slice(0, 6)}…${tx.counterpartyAddress.slice(-4)}`
		: ''
	const counterpartyLabel = fullName || beamioTag || safeHandle || shortAddr || 'Unknown'
	const rowTxCategory = String(rawTx?.txCategory ?? '').toLowerCase()
	const isIssuedNftClaimTx = isRecentActivityIssuedNftClaimTxView(tx)
	const resolvedClaimSeriesTitle = useIssuedNftClaimSeriesTitle(tx, isIssuedNftClaimTx)
	const isCardTopupLedgerTx =
		!isIssuedNftClaimTx && isRecentActivityCardTopupCategory(rowTxCategory)
	const isMerchantGiftLedgerTx = tx.type === 'merchant_gift'
	const isMerchantChargeLedgerTx = !isMerchantGiftLedgerTx && isMerchantChargeTxView(tx)
	const merchantChargeParsed = useMemo(
		() =>
			isMerchantChargeLedgerTx && rawTx
				? parseMerchantChargeDisplayJson(rawTx.displayJson ?? '')
				: null,
		[isMerchantChargeLedgerTx, rawTx?.displayJson]
	)
	const merchantGiftCardAddr = useMemo(
		() => (isMerchantGiftLedgerTx ? merchantChargeCardAddressFromTxView(tx) : ''),
		[isMerchantGiftLedgerTx, tx.id, tx.merchantCardAddress, rawTx]
	)
	const merchantChargeCardAddr = useMemo(
		() => (isMerchantChargeLedgerTx ? merchantChargeCardAddressFromTxView(tx) : ''),
		[isMerchantChargeLedgerTx, tx.id, tx.merchantCardAddress, rawTx]
	)
	const topupDisplayJson = rawTx?.displayJson ?? ''
	const topupParsed = useMemo(
		() => (isCardTopupLedgerTx ? parseRecentActivityTopupDisplayJson(topupDisplayJson) : null),
		[isCardTopupLedgerTx, topupDisplayJson],
	)
	const topupCardAddr = useMemo(
		() => (isCardTopupLedgerTx ? topupCardAddressFromTxView(tx) : ''),
		[isCardTopupLedgerTx, tx.id, tx.merchantCardAddress, rawTx?.displayJson],
	)
	const claimCardAddr = useMemo(() => {
		if (!isIssuedNftClaimTx) return ''
		return tx.merchantCardAddress ?? indexerRouteCardAddress(rawTx?.route) ?? ''
	}, [isIssuedNftClaimTx, tx.merchantCardAddress, rawTx?.route])
	useEffect(() => {
		const addr = merchantGiftCardAddr || merchantChargeCardAddr || topupCardAddr || claimCardAddr
		if (!addr) return
		registerCardAddresses([addr])
		void fetchCardMetadata(addr)
	}, [merchantGiftCardAddr, merchantChargeCardAddr, topupCardAddr, claimCardAddr, registerCardAddresses, fetchCardMetadata])
	const claimMerchantName = useMemo(() => {
		if (!isIssuedNftClaimTx || !claimCardAddr) return ''
		const addrKey = claimCardAddr.toLowerCase()
		return pickMerchantProgramDisplayName({
			displayNameFromDb: resolveDisplayName(claimCardAddr),
			directoryName: recentActivityCardNameDirectory.get(addrKey),
			displayJsonCardName: '',
		})
	}, [
		isIssuedNftClaimTx,
		claimCardAddr,
		tx.title,
		resolveDisplayName,
		cardMap,
		recentActivityCardNameDirectory,
	])
	const merchantChargeIconUrlCandidate = useMemo(() => {
		if (!isMerchantChargeLedgerTx || !merchantChargeCardAddr) return undefined
		return resolveMyBrandCardIconUrl(peekMetadata(merchantChargeCardAddr))
	}, [isMerchantChargeLedgerTx, merchantChargeCardAddr, cardMap, peekMetadata])
	const merchantChargeIconUrl = useStableMerchantIconUrl(tx.id, merchantChargeIconUrlCandidate)
	const merchantCardName = useMemo(() => {
		const cardAddr = isMerchantGiftLedgerTx ? merchantGiftCardAddr : merchantChargeCardAddr
		if (!cardAddr || (!isMerchantGiftLedgerTx && !isMerchantChargeLedgerTx)) return ''
		const addrKey = cardAddr.toLowerCase()
		return pickMerchantChargeListTitle({
			displayNameFromDb: resolveDisplayName(cardAddr),
			directoryName: recentActivityCardNameDirectory.get(addrKey),
			displayJsonCardName: isMerchantChargeLedgerTx ? merchantChargeParsed?.cardName : undefined,
		})
	}, [
		isMerchantGiftLedgerTx,
		isMerchantChargeLedgerTx,
		merchantGiftCardAddr,
		merchantChargeCardAddr,
		merchantChargeParsed?.cardName,
		resolveDisplayName,
		cardMap,
		recentActivityCardNameDirectory,
	])
	const merchantChargeCurrencyCode =
		rawTx && isMerchantChargeLedgerTx
			? merchantChargeListCurrencyCode(rawTx, tx.currencyCode)
			: tx.currencyCode
	const merchantChargeFiatAmount =
		rawTx && isMerchantChargeLedgerTx ? merchantChargeDisplayFiatAmount(rawTx) : 0
	const chargeRewardDisplay = isMerchantChargeLedgerTx
		? resolveChargeRewardDisplayFromTxView(tx, rawTx)
		: null
	const chargeRewardValue = formatChargeRewardPointValue(chargeRewardDisplay)
	const merchantChargeTipFiat = isMerchantChargeLedgerTx ? Math.max(0, Number(tx.merchantChargeTipFiat ?? 0)) : 0
	const merchantChargeTipCurrencyCode = tx.merchantChargeTipCurrencyCode || merchantChargeCurrencyCode
	const topupListTitle = useMemo(() => {
		if (!isCardTopupLedgerTx) return ''
		const addrKey = topupCardAddr.toLowerCase()
		return pickMerchantTopupListTitle({
			displayNameFromDb: topupCardAddr ? resolveDisplayName(topupCardAddr) : '',
			directoryName: topupCardAddr ? recentActivityCardNameDirectory.get(addrKey) : undefined,
			displayJsonCardName: topupParsed?.cardName,
			fallbackTitle: tx.title,
		})
	}, [
		isCardTopupLedgerTx,
		topupCardAddr,
		topupParsed?.cardName,
		tx.title,
		resolveDisplayName,
		cardMap,
		recentActivityCardNameDirectory,
	])
	const isPendingRequesting = (tx.type === 'request_create' || tx.type === 'request_expired') && !isReqExpired && !isReqCanceled
	const isRequestFulfilled = tx.type === 'request_fulfilled'
	// 自己是支付方且对方是 AA 账户时：Title = "Paid to @beamioTag"，subtitle = forText（payee 非己方地址且能解析出 beamioTag 时，视为对方为 Beamio/AA 用户）
	const amPayer = !isInternalTransfer && !tx.isInbound
	const payeeIsOther = amPayer && payeeAddr && payeeAddr !== eoaAddr && payeeAddr !== aaAddr
	const paidToAA = payeeIsOther && !!beamioTag
	// 无 originalPaymentHash 且为付款方时：Title = "Send to [beamio first lastname]"，subtitle = beamioTag
	const sendToNoOph = (isEoaSent || isAASent) && !getOriginalPaymentHash(tx) && (fullName || beamioTag)
	const rawTitleText = isIssuedNftClaimTx
		? resolvedClaimSeriesTitle ?? tx.title
		: isMerchantGiftLedgerTx
		? merchantGiftListTitle(tx.isInbound, beamioTag, counterpartyLabel)
		: isMerchantChargeLedgerTx
		? merchantCardName || tx.title || 'Merchant Payment'
		: isCardTopupLedgerTx
		? topupListTitle || tx.title || 'Top-up'
		: tx.type === 'fuel_yield'
		? 'Fuel Yield (1:100)'
		: isReqExpired
			? 'Request Expired'
			: isReqCanceled
				? 'Request Canceled'
				: isPendingRequesting
				? 'Payment QR'
				: isRequestFulfilled
					? 'Payment Received'
					: sendToNoOph
						? `Send to ${fullName || beamioTag || counterpartyLabel}`
						: paidToAA
							? `Paid to ${beamioTag || counterpartyLabel}`
							: isEoaSent || isAASent
							? `Sent to ${counterpartyLabel}`
							: isEoaReceived
								? `Received from ${counterpartyLabel}`
								: isInternalTransfer
									? internalTitle
									: tx.title
	const titleText = useStableRecentActivityTitle(tx.id, rawTitleText)
	const subtitleText = isIssuedNftClaimTx
		? `${claimMerchantName || 'Claimed'} • ${formatBeamioTransactionTimeLabel(tx.timestampMs)}`
		: isMerchantGiftLedgerTx
		? `${merchantCardName || 'Merchant program'} • ${formatBeamioTransactionTimeLabel(tx.timestampMs)}`
		: isMerchantChargeLedgerTx
		? `${merchantChargeChannelLabel(rawTx, tx.merchantChargeInStore)} • ${formatBeamioTransactionTimeLabel(tx.timestampMs)}`
		: isCardTopupLedgerTx
		? `${recentActivityTopupPaymentLegLabel(rowTxCategory, topupDisplayJson)} • ${formatBeamioTransactionTimeLabel(tx.timestampMs)}`
		: tx.type === 'fuel_yield'
		? 'USDC Top-up'
		: isReqExpired
			? ((tx.forText ?? '').trim() || 'Link Invalidated')
			: isReqCanceled
				? ((tx.forText ?? '').trim() || '')
				: isPendingRequesting
				? ((tx.forText ?? '').trim() || 'QR Generated')
				: isRequestFulfilled
					? (beamioTag ? `Paid by ${beamioTag}` : `Paid by ${fullName || shortAddr || '…'}`)
					: isInternalTransfer
						? 'Internal Transfer'
						: sendToNoOph
							? (beamioTag ?? '')
							: paidToAA
								? ((tx.forText ?? '').trim() || '')
								: isEoaSent || isEoaReceived
								? (fullName ? (beamioTag ?? '') : '')
								: (safeHandle || (tx.isInbound ? 'Received' : 'Sent'))

	const iconBg = isIssuedNftClaimTx
		? tx.type === 'claim_catalog'
			? 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300'
			: 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
		: isMerchantGiftLedgerTx
		? 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
		: isMerchantChargeLedgerTx
		? 'bg-[#1562f0]/10 text-[#1562f0] dark:bg-[#1562f0]/20 dark:text-[#4d8dff]'
		: isCardTopupLedgerTx
		? 'bg-[#34C759]/10 text-[#34C759] dark:bg-[#34C759]/20 dark:text-[#5EDB7B]'
		: tx.type === 'fuel_yield'
		? 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
		: isInternalTransfer
		? (payeeAddr.toLowerCase() === eoaAddr
			? 'bg-[#1562f0]/10 text-[#1562f0] dark:bg-[#1562f0]/20 dark:text-[#4d8dff]'
			: 'bg-[#AF52DE]/10 text-[#AF52DE] dark:bg-[#AF52DE]/20 dark:text-[#c77dff]')
		: isReqExpired || isReqCanceled
			? 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-400'
			: isEoaReceived
				? 'bg-[#34C759]/10 text-[#34C759]'
				: colorForType(tx.type)

	// AA→EOA (Withdraw to Main): 收入，数字显示绿色 +（以 payee=EOA 为准，不受合并顺序影响）
	const isWithdrawToMain = isInternalTransfer && payeeAddr.toLowerCase() === eoaAddr
	// Vouchers 下：Main Wallet → Express Pay 显示 + 绿色，Express Pay → Main Wallet 显示 - 黑色
	const vouchersInternalAmount = rowActiveTab === 'Vouchers' && isInternalTransfer
		? (isAddToExpressPay ? { amt: Math.abs(tx.amountFiat), green: true } : { amt: -Math.abs(tx.amountFiat), green: false })
		: null
	// Add to Express Pay (EOA→AA): 负数用黑色，不显示绿色。Vouchers 下则反转：EOA→AA 为 + 绿色
	const amountIsGreen = isIssuedNftClaimTx || isCardTopupLedgerTx || (isMerchantGiftLedgerTx && tx.isInbound)
		? true
		: tx.type === 'fuel_yield'
		? false
		: vouchersInternalAmount
			? vouchersInternalAmount.green
			: !isAddToExpressPay && ((tx.isInbound && tx.amountUSDC > 0) || (isWithdrawToMain && tx.amountUSDC > 0))
	const fuelYieldSpentUsdc = tx.amountUSDC > 0 ? tx.amountUSDC : Math.abs(tx.amountFiat) / 100
	const topupBonusFiat = isCardTopupLedgerTx ? Math.max(0, Number(tx.topupBonusFiat ?? 0)) : 0

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => onSelect(tx)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onSelect(tx)
				}
			}}
			className="relative flex items-center justify-between py-2.5 px-3 bg-white dark:bg-slate-800/80 rounded-[15px] shadow-[0_2px_9px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-transform duration-200 cursor-pointer border border-gray-100/50 dark:border-slate-700/50"
		>
			<div className="flex items-center gap-3">
				{isMerchantGiftLedgerTx ? (
					<div className={`${RECENT_ACTIVITY_ROW_ICON_OUTER_CLASS} ${iconBg}`}>
						<span className={RECENT_ACTIVITY_ROW_ICON_INNER_CLASS}>
							<Gift size={16} strokeWidth={2} />
						</span>
					</div>
				) : isMerchantChargeLedgerTx ? (
					<MyBrandMerchantIcon
						title={merchantCardName || 'Merchant'}
						iconUrl={merchantChargeIconUrl}
						sizeClassName="h-9 w-9 rounded-[10px] shadow-sm"
						letterClassName="text-sm font-bold text-[#1562f0] dark:text-[#6ba3ff]"
					/>
				) : (
				<div className={`${RECENT_ACTIVITY_ROW_ICON_OUTER_CLASS} ${iconBg}`}>
					<span className={RECENT_ACTIVITY_ROW_ICON_INNER_CLASS}>
						{tx.type === 'fuel_yield' ? (
							<ArrowUpRight size={16} strokeWidth={2} />
						) : isIssuedNftClaimTx ? (
							tx.type === 'claim_catalog' ? (
								<Package size={16} strokeWidth={2} />
							) : (
								<Gift size={16} strokeWidth={2} />
							)
						) : isCardTopupLedgerTx ? (
							<Plus size={16} strokeWidth={2.5} />
						) : isEoaReceived && tx.type !== 'request_fulfilled' ? (
							<ArrowDownLeft size={16} strokeWidth={2} />
						) : isEoaSent || isAASent ? (
							<ArrowUpRight size={16} strokeWidth={2} />
						) : (
							iconForType(tx.type, 16, tx)
						)}
					</span>
				</div>
				)}
				<div className="flex flex-col gap-0.5 min-w-0">
					<h3
						className={`min-h-[15px] text-[12px] font-semibold leading-[15px] tracking-tight truncate ${
							isReqExpired || isReqCanceled ? 'text-gray-400 dark:text-slate-500' : 'text-black dark:text-white'
						}`}
					>
						{titleText}
					</h3>
					<div className="flex items-center gap-1 flex-wrap">
						{subtitleText ? (
							<span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
								{subtitleText}
							</span>
						) : null}
						{tx.type === 'request_fulfilled' && (
							<span className="text-[8px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1 py-0 rounded-[4px]">
								Request
							</span>
						)}
						{tx.type === 'request_create' && !isReqExpired && !isReqCanceled && (
							<span className="text-[8px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-1 py-0 rounded-[4px]">
								Waiting
							</span>
						)}
						{isReqCanceled && (
							<span className="text-[8px] font-semibold text-gray-400 bg-gray-200 dark:bg-slate-600 dark:text-slate-400 px-1 py-0 rounded-[4px]">
								Canceled
							</span>
						)}
						{isReqExpired && (
							<span className="text-[8px] font-semibold text-gray-400 bg-gray-200 dark:bg-slate-600 dark:text-slate-400 px-1 py-0 rounded-[4px]">
								Expired
							</span>
						)}
					</div>
				</div>
			</div>
			<div className="text-right flex flex-col items-end shrink-0">
				<div
					className={`text-[12px] font-semibold tracking-tight ${
						isReqExpired || isReqCanceled ? 'text-gray-500 dark:text-slate-400 opacity-50' :
						amountIsGreen ? 'text-[#34C759]' :
						'text-black dark:text-white'
					}`}
				>
					{tx.type === 'request_create' && !isReqExpired && !isReqCanceled ? (
						<span className="text-[#FF9500]">Pending</span>
					) : tx.type === 'fuel_yield' ? (
						<>-{formatAmount(fuelYieldSpentUsdc, 'USDC')}</>
					) : isReqExpired || isReqCanceled ? (
						formatAmountWithCurrencyProtocol(Math.abs(tx.amountFiat), tx.currencyCode as ICurrency)
					) : isCardTopupLedgerTx ? (
						formatTopupListAmountPositive(tx.amountFiat, tx.currencyCode)
					) : isMerchantGiftLedgerTx ? (
						formatCurrencySigned(
							tx.isInbound ? Math.abs(tx.amountFiat) : -Math.abs(tx.amountFiat),
							tx.currencyCode,
						)
					) : isMerchantChargeLedgerTx ? (
						formatMerchantChargeListAmountNegative(merchantChargeFiatAmount, merchantChargeCurrencyCode)
					) : (
						formatCurrencySigned(
							vouchersInternalAmount
								? vouchersInternalAmount.amt
								: isWithdrawToMain ? Math.abs(tx.amountFiat) : isAddToExpressPay ? -Math.abs(tx.amountFiat) : amountFiatSigned(tx),
							tx.currencyCode
						)
					)}
				</div>
				{tx.type === 'fuel_yield' ? (
					<span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">USDC</span>
				) : isCardTopupLedgerTx && topupBonusFiat > 0 ? (
					<span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-[#FF9500]">
						<span>Incl</span>
						<span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF9500]/15 text-[#FF9500]">
							<Gift size={9} strokeWidth={2.5} />
						</span>
						<span>{formatTopupBonusSubtitleAmount(topupBonusFiat, tx.currencyCode)}</span>
					</span>
				) : isMerchantChargeLedgerTx ? (
					<>
						{chargeRewardValue ? (
							<span className="mt-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
								{chargeRewardValue}
							</span>
						) : null}
						{merchantChargeTipFiat > 0 ? (
							<span className="mt-0.5 text-[9px] font-medium text-gray-500 dark:text-slate-400">
								incl tip{' '}
								{formatMerchantChargeTipSubtitleAmount(
									merchantChargeTipFiat,
									merchantChargeTipCurrencyCode,
								)}
							</span>
						) : null}
					</>
				) : !isCardTopupLedgerTx && !isMerchantChargeLedgerTx && tx.amountUSDC !== 0 && tx.type !== 'request_create' && tx.type !== 'request_expired' ? (
					<span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">
						{Math.abs(tx.amountUSDC).toFixed(2)} USDC
					</span>
				) : null}
			</div>
		</div>
	)
}

interface ActiveHistoryPannelNewProps {
	/** 可选标题，用于 Home Recent Activity 等场景，默认 "Indexer History" */
	title?: string
	/** 覆盖查询地址，调试或指定展示某地址时使用；传入时优先于 profiles */
	overrideAddress?: string
	/** compact 模式：只显示前 N 条，无 tab，顶部显示 All Activity 链接打开完整抽屉 */
	compact?: boolean
	/** compact 模式下的条数限制，默认 5 */
	compactLimit?: number
	/** 嵌入抽屉时隐藏 All Activity 链接（内部用） */
	embeddedInDrawer?: boolean
	/** bare 模式：去除外部圆角、边框、阴影、边距，由父容器设置，避免内部 padding 影响页面左右边距 */
	bare?: boolean
	/** 自定义区块标题 class（如 Home 青柠主题） */
	sectionTitleClassName?: string
	/** 自定义 compact「View all」按钮 class；不传则沿用默认蓝色链接样式 */
	viewAllClassName?: string
	/** 若提供，则点击 View all 执行此回调（例如 navigate('/Pay')），不再打开全屏抽屉 */
	onCompactViewAll?: () => void
	/** 隐藏 tab 下方的账户范围刷新胶囊（如 Pay 页顶部不需要展示 All Accounts） */
	hideAccountScopeCapsule?: boolean
	/** 将标题 + tab bar 固定为顶部半透明胶囊；opacity 由外层滚动容器驱动 */
	floatingTopControlsOpacity?: number
	/** 回传浮动顶部控件实际占用高度，供外层滚动内容避让刘海和按钮区 */
	onFloatingTopControlsSpaceChange?: (spacePx: number) => void
}

const ActiveHistoryPannelNew = ({
	title = 'Indexer History',
	overrideAddress,
	compact = false,
	compactLimit = 5,
	embeddedInDrawer = false,
	bare = false,
	sectionTitleClassName,
	viewAllClassName,
	onCompactViewAll,
	hideAccountScopeCapsule = false,
	floatingTopControlsOpacity,
	onFloatingTopControlsSpaceChange,
}: ActiveHistoryPannelNewProps) => {
	const {
		profiles,
		myAddress,
		setShowFooter,
		setChatHomeItem,
		beamioUsers,
		recentActivityNoAaItems,
		recentActivityNoAaLoading,
		recentActivityNoAaError,
		refreshRecentActivityNoAa,
	} = useDaemonContext()
	const { resolveDisplayName, resolveImage, fetchCardMetadata, registerCardAddresses, peekMetadata, cardMap } = useMerchantCardDatabase()
	const navigate = useNavigate()

	const eoa = profiles?.[0]?.keyID?.trim()
	const aa = profiles?.[0]?.aaAccount?.trim()
	/** 仅调试/指定地址时用本地拉取；正常 EOA+AA 由 Daemon 合并喂料并按时间倒序 */
	const useLocalIndexer = Boolean(overrideAddress && ethers.isAddress(overrideAddress))

	const [items, setItems] = useState<TxView[]>(() =>
		useLocalIndexer ? [] : recentActivityNoAaItems
	)
	const [loading, setLoading] = useState(
		() => !useLocalIndexer && recentActivityNoAaLoading && recentActivityNoAaItems.length === 0
	)
	const [error, setError] = useState<string | null>(() =>
		useLocalIndexer ? null : recentActivityNoAaError
	)
	const [manualRefreshing, setManualRefreshing] = useState(false)
	const [activeTab, setActiveTab] = useState<'All' | 'Cash' | 'Vouchers'>('All')
	const [selectedTx, setSelectedTx] = useState<TxView | null>(null)
	const [showJson, setShowJson] = useState(false)
	const [fullTransactionFromChain, setFullTransactionFromChain] = useState<Record<string, unknown> | null>(null)
	const [fullTxLoading, setFullTxLoading] = useState(false)
	const [showFullDrawer, setShowFullDrawer] = useState(false)
	const [showGiftCard, setShowGiftCard] = useState(false)
	const [showVouchersQRSheet, setShowVouchersQRSheet] = useState(false)
	const [copiedForQR, setCopiedForQR] = useState(false)
	const [copiedRawData, setCopiedRawData] = useState(false)
	const [cancelRequestLoading, setCancelRequestLoading] = useState(false)
	const [cancelRequestError, setCancelRequestError] = useState<string | null>(null)
	const refreshLockRef = useRef(false)
	const itemsCountRef = useRef(items.length)
	const nonLocalSettledRef = useRef(false)
	const nonLocalKeyRef = useRef('')
	useEffect(() => {
		itemsCountRef.current = items.length
	}, [items.length])
	const { opacity: backBtnOpacity, onScroll: onAllActivityScroll, setRef: setAllActivityScrollRef } = useScrollCapsuleOpacity(compact && showFullDrawer)

	// Detail Sheet 与 list 使用同一套 title 逻辑（Sent to / Received from；内部转账用固定文案）
	const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
	// 根据 payer/payee 判断我方钱包类型，用于 detail 展示与 icon
	const selectedTxMySideIsAA = selectedTx && eoa && aa ? (() => {
		const raw = selectedTx.rawTransaction as RawTxRecord | undefined
		const payerAddr = (extractAddr(raw?.payer) ?? '').toLowerCase()
		const payeeAddr = (extractAddr(raw?.payee) ?? '').toLowerCase()
		const aaAddr = aa.toLowerCase()
		return selectedTx.isInbound ? (payeeAddr === aaAddr) : (payerAddr === aaAddr)
	})() : false
	const selectedTxNeedsCounterparty = selectedTx && selectedTx.type !== 'internal_transfer'
	const { fullName: detailFullName, beamioTag: detailBeamioTag } = useCounterpartyProfile(
		selectedTxNeedsCounterparty ? selectedTx!.counterpartyAddress : undefined
	)
	const selectedMerchantPayeeAddress = useMemo(() => {
		if (!selectedTx) return undefined
		const cat = String((selectedTx.rawTransaction as RawTxRecord | undefined)?.txCategory ?? '').toLowerCase()
		if (!isRecentActivityCardTopupCategory(cat) && !isMerchantChargeTxView(selectedTx)) return undefined
		const raw = (fullTransactionFromChain ?? selectedTx.rawTransaction) as RawTxRecord | undefined
		const fromRaw = resolveIndexerPayeeAddress(raw)
		if (fromRaw) return fromRaw
		if (selectedTx.merchantPayeeAddress && ethers.isAddress(selectedTx.merchantPayeeAddress)) {
			return ethers.getAddress(selectedTx.merchantPayeeAddress)
		}
		return undefined
	}, [selectedTx, fullTransactionFromChain])
	const { fullName: merchantPayeeFullName, beamioTag: merchantPayeeBeamioTag } =
		useCounterpartyProfile(selectedMerchantPayeeAddress)
	const handleIsJson = (s: string | undefined) => !s || /^[\s]*\{/.test(s) || /"currency"/.test(s)
	const recentActivityCardNameDirectory = useMemo(
		() => buildRecentActivityCardNameDirectory(items),
		[items],
	)
	const detailTitleText = selectedTx
		? (() => {
				if (selectedTx.type === 'fuel_yield') return 'Fuel Yield (1:100)'
				const selectedRaw = selectedTx.rawTransaction as RawTxRecord | undefined
				const selectedCat = String(selectedRaw?.txCategory ?? '').toLowerCase()
				if (isMerchantChargeTxView(selectedTx)) {
					const chargeAddr = merchantChargeCardAddressFromTxView(selectedTx)
					const chargeParsed = selectedRaw
						? parseMerchantChargeDisplayJson(selectedRaw.displayJson ?? '')
						: null
					const chargeTitle = pickMerchantChargeListTitle({
						displayNameFromDb: chargeAddr ? resolveDisplayName(chargeAddr) : '',
						directoryName: chargeAddr
							? recentActivityCardNameDirectory.get(chargeAddr.toLowerCase())
							: undefined,
						displayJsonCardName: chargeParsed?.cardName,
					})
					if (chargeTitle) return chargeTitle
					return ''
				}
				if (isRecentActivityCardTopupCategory(selectedCat)) {
					const topupAddr = topupCardAddressFromTxView(selectedTx)
					const topupParsed = parseRecentActivityTopupDisplayJson(selectedRaw?.displayJson ?? '')
					return (
						pickMerchantTopupListTitle({
							displayNameFromDb: topupAddr ? resolveDisplayName(topupAddr) : '',
							directoryName: topupAddr
								? recentActivityCardNameDirectory.get(topupAddr.toLowerCase())
								: undefined,
							displayJsonCardName: topupParsed.cardName,
							fallbackTitle: selectedTx.title,
						}) || selectedTx.title
					)
				}
				if (selectedTx.type === 'merchant_gift') {
					const safeHandle = handleIsJson(selectedTx.handle) ? '' : (selectedTx.handle ?? '')
					const shortAddr =
						selectedTx.counterpartyAddress && selectedTx.counterpartyAddress.length >= 10
							? `${selectedTx.counterpartyAddress.slice(0, 6)}…${selectedTx.counterpartyAddress.slice(-4)}`
							: ''
					const counterpartyLabel = detailFullName || detailBeamioTag || safeHandle || shortAddr || 'Unknown'
					return merchantGiftListTitle(selectedTx.isInbound, detailBeamioTag, counterpartyLabel)
				}
				if (selectedTx.type === 'internal_transfer' && eoa && aa) {
					const rawTx = selectedTx.rawTransaction as RawTxRecord | undefined
					const payeeAddr = (extractAddr(rawTx?.payee) ?? '').toLowerCase()
					const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
					const aaAddr = aa.toLowerCase()
					// 与 TxItemRow 的 internalTitle 一致：payee 决定资金流向
					return payeeAddr === eoaAddr ? 'Withdraw from Express Pay' : payeeAddr === aaAddr ? 'Add to Express Pay' : 'Internal Transfer'
				}
				const isEoaSent = !selectedTxMySideIsAA && !selectedTx.isInbound
				const isEoaReceived = !selectedTxMySideIsAA && selectedTx.isInbound
				if (isEoaSent || isEoaReceived) {
					const safeHandle = handleIsJson(selectedTx.handle) ? '' : (selectedTx.handle ?? '')
					const shortAddr =
						selectedTx.counterpartyAddress && selectedTx.counterpartyAddress.length >= 10
							? `${selectedTx.counterpartyAddress.slice(0, 6)}…${selectedTx.counterpartyAddress.slice(-4)}`
							: ''
					const counterpartyLabel = detailFullName || detailBeamioTag || safeHandle || shortAddr || 'Unknown'
					return isEoaSent ? `${counterpartyLabel}` : `${counterpartyLabel}`
				}
				return selectedTx.title
		  })()
		: ''
	const selectedTxCategoryLower = selectedTx
		? String((selectedTx.rawTransaction as RawTxRecord | undefined)?.txCategory ?? '').toLowerCase()
		: ''
	const selectedIsIssuedNftClaimKind = selectedTx ? isRecentActivityIssuedNftClaimTxView(selectedTx) : false
	useEffect(() => {
		if (!selectedTx) return
		if (isMerchantChargeTxView(selectedTx)) {
			const addr = merchantChargeCardAddressFromTxView(selectedTx)
			if (addr) {
				registerCardAddresses([addr])
				void fetchCardMetadata(addr)
			}
			return
		}
		if (selectedIsIssuedNftClaimKind) {
			const raw = selectedTx.rawTransaction as RawTxRecord | undefined
			const addr =
				selectedTx.merchantCardAddress ?? indexerRouteCardAddress(raw?.route) ?? ''
			if (addr) {
				registerCardAddresses([addr])
				void fetchCardMetadata(addr)
			}
		} else if (isRecentActivityCardTopupCategory(selectedTxCategoryLower)) {
			const addr = topupCardAddressFromTxView(selectedTx)
			if (addr) {
				registerCardAddresses([addr])
				void fetchCardMetadata(addr)
			}
		}
	}, [
		selectedTx,
		selectedIsIssuedNftClaimKind,
		selectedTxCategoryLower,
		registerCardAddresses,
		fetchCardMetadata,
	])
	const selectedIsCardTopupKind =
		!selectedIsIssuedNftClaimKind && isRecentActivityCardTopupCategory(selectedTxCategoryLower)
	const selectedIsMerchantChargeKind = selectedTx ? isMerchantChargeTxView(selectedTx) : false
	const selectedIsProgramCardLedgerKind = selectedIsCardTopupKind || selectedIsMerchantChargeKind
	const selectedChargeRaw = selectedTx?.rawTransaction as RawTxRecord | undefined
	const selectedChargeParsed = useMemo(
		() => (selectedChargeRaw ? parseMerchantChargeDisplayJson(selectedChargeRaw.displayJson ?? '') : null),
		[selectedChargeRaw?.displayJson],
	)
	const selectedChargeDetailProgramTitle = useMemo(() => {
		if (!selectedTx || !selectedIsMerchantChargeKind) return ''
		const chargeAddr = merchantChargeCardAddressFromTxView(selectedTx)
		return (
			pickMerchantChargeListTitle({
				displayNameFromDb: chargeAddr ? resolveDisplayName(chargeAddr) : '',
				directoryName: chargeAddr
					? recentActivityCardNameDirectory.get(chargeAddr.toLowerCase())
					: undefined,
				displayJsonCardName: selectedChargeParsed?.cardName,
			}) || ''
		)
	}, [
		selectedTx,
		selectedIsMerchantChargeKind,
		selectedChargeParsed?.cardName,
		resolveDisplayName,
		recentActivityCardNameDirectory,
	])
	const selectedChargeCurrencyCode =
		selectedChargeRaw && selectedIsMerchantChargeKind
			? merchantChargeListCurrencyCode(selectedChargeRaw, selectedTx?.currencyCode ?? 'USD')
			: 'USD'
	const selectedChargeFiatAmount =
		selectedChargeRaw && selectedIsMerchantChargeKind ? merchantChargeDisplayFiatAmount(selectedChargeRaw) : 0
	const selectedChargeTipFiat = selectedIsMerchantChargeKind
		? Math.max(0, Number(selectedTx?.merchantChargeTipFiat ?? 0))
		: 0
	const selectedChargeTipCurrencyCode = selectedTx?.merchantChargeTipCurrencyCode || selectedChargeCurrencyCode
	const selectedChargeRewardDisplay = useMemo(() => {
		if (!selectedIsMerchantChargeKind || !selectedTx) return null
		const raw =
			(fullTransactionFromChain as RawTxRecord | null) ??
			selectedChargeRaw ??
			selectedTx.rawTransaction
		return resolveChargeRewardDisplayFromTxView(selectedTx, raw)
	}, [selectedIsMerchantChargeKind, selectedTx, selectedChargeRaw, fullTransactionFromChain])
	const selectedChargeRewardValue = useMemo(
		() => formatChargeRewardPointValue(selectedChargeRewardDisplay),
		[selectedChargeRewardDisplay],
	)
	const selectedChargeChannelLabel = selectedIsMerchantChargeKind
		? merchantChargeChannelLabel(selectedChargeRaw, selectedTx?.merchantChargeInStore)
		: ''
	const selectedChargeDetailSubtitle = useMemo(
		() =>
			selectedTx && selectedIsMerchantChargeKind
				? `${selectedChargeChannelLabel} • ${formatBeamioTransactionTimeLabel(selectedTx.timestampMs)}`
				: '',
		[selectedTx, selectedIsMerchantChargeKind, selectedChargeChannelLabel],
	)
	const selectedIsUpgradeNewCard =
		selectedTxCategoryLower === TX_UPGRADE_NEW_CARD.toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('creditUpgradeNewCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('cashUpgradeNewCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('usdcUpgradeNewCard')).toLowerCase()
	const selectedIsIssueNewCard =
		selectedTxCategoryLower === TX_ISSUE_NEW_CARD.toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('newCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('creditNewCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('cashNewCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('usdcNewCard')).toLowerCase()
	const selectedIsTopupCard =
		selectedTxCategoryLower === TX_TOPUP_CARD.toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('creditTopupCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('cashTopupCard')).toLowerCase() ||
		selectedTxCategoryLower === ethers.keccak256(ethers.toUtf8Bytes('usdcTopupCard')).toLowerCase()
	const selectedCardName = useMemo(() => {
		if (!selectedTx) return ''
		const displayJson = (selectedTx.rawTransaction as RawTxRecord | undefined)?.displayJson ?? ''
		const addr = selectedIsMerchantChargeKind
			? merchantChargeCardAddressFromTxView(selectedTx)
			: topupCardAddressFromTxView(selectedTx)
		const displayJsonCardName = selectedIsMerchantChargeKind
			? selectedChargeParsed?.cardName
			: parseRecentActivityTopupDisplayJson(displayJson).cardName
		const fromDb = pickMerchantProgramDisplayName({
			displayNameFromDb: addr ? resolveDisplayName(addr) : '',
			directoryName: addr ? recentActivityCardNameDirectory.get(addr.toLowerCase()) : undefined,
			displayJsonCardName,
		})
		if (fromDb) return fromDb
		if (selectedIsMerchantChargeKind) return selectedChargeDetailProgramTitle
		const m = String(selectedTx.title ?? '').match(/^(?:Buy|Upgrade to|Reload|Top-up:?)\s+(.+?)(?:\s+Card(?:\s*·.*)?)?$/i)
		return (m?.[1] ?? '').trim()
	}, [
		selectedTx,
		selectedIsMerchantChargeKind,
		selectedChargeParsed?.cardName,
		selectedChargeDetailProgramTitle,
		resolveDisplayName,
		cardMap,
		recentActivityCardNameDirectory,
	])
	const selectedCardUnitLabel = selectedCardName ? `$${selectedCardName}` : 'Card Voucher'
	const selectedCardAddress = useMemo(() => {
		if (!selectedTx) return ''
		if (selectedIsMerchantChargeKind) return merchantChargeCardAddressFromTxView(selectedTx)
		return topupCardAddressFromTxView(selectedTx)
	}, [selectedTx, selectedIsMerchantChargeKind])
	const selectedCardImage = selectedCardAddress ? resolveImage(selectedCardAddress) : ''
	const selectedCardMetadataName = selectedCardAddress ? String(peekMetadata(selectedCardAddress)?.name ?? '').trim() : ''
	const selectedChargeIconUrl = useMemo(() => {
		if (!selectedIsMerchantChargeKind || !selectedCardAddress) return undefined
		return resolveMyBrandCardIconUrl(peekMetadata(selectedCardAddress))
	}, [selectedIsMerchantChargeKind, selectedCardAddress, cardMap, peekMetadata])
	const selectedMergedUnitLabel = useMemo(() => {
		if (!selectedCardName) return 'Merged Voucher'
		const base = selectedCardName.split('-')[0]?.trim() || selectedCardName
		return `$${base}`
	}, [selectedCardName])
	const selectedCardMetaAmounts = useMemo(() => {
		const txMetaSource = ((fullTransactionFromChain as RawTxRecord | null)?.meta ??
			(selectedTx?.rawTransaction as RawTxRecord | undefined)?.meta) as RawTxRecord['meta'] | unknown
		const toBigIntSafe = (v: unknown): bigint => {
			try {
				if (typeof v === 'bigint') return v
				if (typeof v === 'number') return BigInt(Math.trunc(v))
				if (typeof v === 'string' && v.trim()) return BigInt(v)
			} catch {}
			return 0n
		}
		if (!txMetaSource || typeof txMetaSource !== 'object') {
			return { requestAmountFiat6: 0n, discountAmountFiat6: 0n, requestAmountUSDC6: 0n }
		}
		if (Array.isArray(txMetaSource)) {
			return {
				requestAmountFiat6: toBigIntSafe(txMetaSource[0]),
				discountAmountFiat6: toBigIntSafe(txMetaSource[3]),
				requestAmountUSDC6: toBigIntSafe(txMetaSource[1]),
			}
		}
		const metaObj = txMetaSource as RawTxRecord['meta']
		return {
			requestAmountFiat6: toBigIntSafe(metaObj?.requestAmountFiat6),
			discountAmountFiat6: toBigIntSafe(metaObj?.discountAmountFiat6),
			requestAmountUSDC6: toBigIntSafe(metaObj?.requestAmountUSDC6),
		}
	}, [selectedTx, fullTransactionFromChain])
	const selectedCardTopupUSDCAmount = useMemo(() => {
		if (!selectedTx) return 0
		const fromMeta = Number(selectedCardMetaAmounts.requestAmountUSDC6) / 1e6
		if (fromMeta > 0) return fromMeta
		return Math.abs(selectedTx.amountUSDC)
	}, [selectedTx, selectedCardMetaAmounts])
	const [selectedUpgradeTierColors, setSelectedUpgradeTierColors] = useState<{
		upgradedBg?: string
		upgradedText?: '#000000' | '#FFFFFF'
		mergedBg?: string
		mergedText?: '#000000' | '#FFFFFF'
	}>({})
	const [selectedCardTierColor, setSelectedCardTierColor] = useState<{
		bg?: string
		text?: '#000000' | '#FFFFFF'
	}>({})
	useEffect(() => {
		let cancelled = false
		const clear = () => setSelectedUpgradeTierColors({})
		if (!selectedIsUpgradeNewCard || !selectedCardAddress) {
			clear()
			return
		}
		const upgradedAmount6 = selectedCardMetaAmounts.requestAmountFiat6
		const mergedAmount6 = selectedCardMetaAmounts.discountAmountFiat6
		if (upgradedAmount6 <= 0n && mergedAmount6 <= 0n) {
			clear()
			return
		}
		registerCardAddresses([selectedCardAddress])
		const applyTierColors = (tiersRaw: Array<{ minUsdc6?: string; backgroundColor?: string; background_color?: string }>) => {
			const tiers = tiersRaw
				.map((t) => {
					const minRaw = t?.minUsdc6
					const bgRaw = t?.backgroundColor ?? t?.background_color
					const bg = normalizeHexColor(bgRaw)
					let minUsdc6 = 0n
					try {
						minUsdc6 = BigInt(String(minRaw ?? '0'))
					} catch {}
					return { minUsdc6, bg }
				})
				.filter((t) => t.bg)
				.sort((a, b) => (a.minUsdc6 < b.minUsdc6 ? -1 : a.minUsdc6 > b.minUsdc6 ? 1 : 0))
			if (!tiers.length || cancelled) return
			const pickTierBg = (amount6: bigint) => {
				const matched = tiers.filter((t) => amount6 >= t.minUsdc6)
				return (matched[matched.length - 1] ?? tiers[0]).bg as string
			}
			const upgradedBg = upgradedAmount6 > 0n ? pickTierBg(upgradedAmount6) : undefined
			const mergedBg = mergedAmount6 > 0n ? pickTierBg(mergedAmount6) : undefined
			if (cancelled) return
			setSelectedUpgradeTierColors({
				upgradedBg,
				upgradedText: upgradedBg ? getReadableTextColor(upgradedBg) : undefined,
				mergedBg,
				mergedText: mergedBg ? getReadableTextColor(mergedBg) : undefined,
			})
		}
		const localMeta = peekMetadata(selectedCardAddress)
		if (localMeta?.tiers?.length) {
			applyTierColors(localMeta.tiers)
		}
		void fetchCardMetadata(selectedCardAddress).then((meta) => {
			if (cancelled || !meta?.tiers?.length) return
			applyTierColors(meta.tiers)
		})
		return () => {
			cancelled = true
		}
	}, [
		selectedIsUpgradeNewCard,
		selectedCardAddress,
		selectedCardMetaAmounts.requestAmountFiat6,
		selectedCardMetaAmounts.discountAmountFiat6,
		fetchCardMetadata,
		registerCardAddresses,
		peekMetadata,
	])
	useEffect(() => {
		let cancelled = false
		const clear = () => setSelectedCardTierColor({})
		if ((!selectedIsIssueNewCard && !selectedIsTopupCard) || !selectedCardAddress) {
			clear()
			return
		}
		const txPayer = extractAddr((selectedTx?.rawTransaction as RawTxRecord | undefined)?.payer)
		const fallbackOwner = overrideAddress && ethers.isAddress(overrideAddress)
			? ethers.getAddress(overrideAddress)
			: (eoa && ethers.isAddress(eoa) ? ethers.getAddress(eoa) : (myAddress && ethers.isAddress(myAddress) ? ethers.getAddress(myAddress) : ''))
		const ownerEOA = txPayer && ethers.isAddress(txPayer) ? ethers.getAddress(txPayer) : fallbackOwner
		if (!ownerEOA) {
			clear()
			return
		}
		;(async () => {
			try {
				const cardRead = new ethers.Contract(
					selectedCardAddress,
					['function getOwnershipByEOA(address userEOA) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)'],
					baseEndpoint
				)
				const [, nftsRaw] = await cardRead.getOwnershipByEOA(ownerEOA) as [bigint, Array<{ tokenId: bigint | string | number; isExpired?: boolean }>]
				const nfts = Array.isArray(nftsRaw) ? nftsRaw : []
				const membershipTokenIds = nfts
					.map((n) => {
						try {
							return BigInt((n as { tokenId?: bigint | string | number })?.tokenId ?? 0)
						} catch {
							return 0n
						}
					})
					.filter((tokenId) => tokenId >= NFT_START_ID && tokenId < ISSUED_NFT_START_ID)
				if (!membershipTokenIds.length || cancelled) {
					clear()
					return
				}
				const currentTokenId = membershipTokenIds.reduce((max, cur) => (cur > max ? cur : max), 0n)
				const cardAddressLower = selectedCardAddress.toLowerCase()
				const metaRes = await fetch(`${beamioApi}/metadata/${cardAddressLower}${currentTokenId.toString()}.json`)
				if (!metaRes.ok) return
				const tierMeta = await metaRes.json().catch(() => ({} as Record<string, unknown>))
				const props = (tierMeta?.properties ?? {}) as Record<string, unknown>
				const pickedBg = normalizeHexColor(props?.background_color ?? tierMeta?.background_color)
				if (!pickedBg) return
				if (cancelled) return
				setSelectedCardTierColor({
					bg: pickedBg,
					text: getReadableTextColor(pickedBg),
				})
			} catch {
				// ignore metadata fetch errors; fallback to default colors
			}
		})()
		return () => {
			cancelled = true
		}
	}, [
		selectedIsIssueNewCard,
		selectedIsTopupCard,
		selectedCardAddress,
		selectedTx,
		overrideAddress,
		eoa,
		myAddress,
	])
	const selectedPaidToLabel = useMemo(() => {
		if (!selectedMerchantPayeeAddress) return ''
		if (merchantPayeeBeamioTag) {
			return merchantPayeeBeamioTag.startsWith('@') ? merchantPayeeBeamioTag : `@${merchantPayeeBeamioTag}`
		}
		if (merchantPayeeFullName) return merchantPayeeFullName
		return `${selectedMerchantPayeeAddress.slice(0, 6)}…${selectedMerchantPayeeAddress.slice(-4)}`
	}, [selectedMerchantPayeeAddress, merchantPayeeBeamioTag, merchantPayeeFullName])
	const selectedTopupDisplayJson = useMemo(
		() => String((selectedTx?.rawTransaction as RawTxRecord | undefined)?.displayJson ?? ''),
		[selectedTx]
	)
	const selectedTopupPaymentLeg = useMemo(
		() => (selectedIsCardTopupKind ? recentActivityTopupPaymentLegLabel(selectedTxCategoryLower, selectedTopupDisplayJson) : ''),
		[selectedIsCardTopupKind, selectedTxCategoryLower, selectedTopupDisplayJson]
	)
	const selectedTopupIsUsdcPayment = selectedTopupPaymentLeg === 'USDC'
	const selectedTopupDetailTitle = useMemo(
		() => {
			if (!selectedTx || !selectedIsCardTopupKind) return ''
			const addr = topupCardAddressFromTxView(selectedTx)
			const parsed = parseRecentActivityTopupDisplayJson(selectedTopupDisplayJson)
			return (
				pickMerchantTopupListTitle({
					displayNameFromDb: addr ? resolveDisplayName(addr) : '',
					directoryName: addr ? recentActivityCardNameDirectory.get(addr.toLowerCase()) : undefined,
					displayJsonCardName: parsed.cardName,
					fallbackTitle: selectedTx.title,
				}) || ''
			)
		},
		[selectedTx, selectedIsCardTopupKind, selectedTopupDisplayJson, resolveDisplayName, cardMap, recentActivityCardNameDirectory],
	)
	const selectedTopupDetailProgramTitle = selectedTopupDetailTitle.replace(/^Top-up:?\s*/i, '').trim()
	const selectedProgramCardDetailTitle =
		selectedTopupDetailProgramTitle || selectedChargeDetailProgramTitle
	const selectedCardDisplayLabel = selectedCardName || selectedProgramCardDetailTitle || 'Card Voucher'
	const selectedCardDisplayInitial = (selectedCardDisplayLabel.trim().match(/[A-Za-z0-9]/)?.[0] ?? 'B').toUpperCase()
	const selectedTopupBonusFiat = selectedIsCardTopupKind ? Math.max(0, Number(selectedTx?.topupBonusFiat ?? 0)) : 0
	const selectedTopupDetailSubtitle = useMemo(
		() =>
			selectedTx && selectedIsCardTopupKind
				? `${selectedTopupPaymentLeg} • ${formatBeamioTransactionTimeLabel(selectedTx.timestampMs)}`
				: '',
		[selectedTx, selectedIsCardTopupKind, selectedTopupPaymentLeg]
	)
	const selectedProgramCardDetailSubtitle =
		selectedTopupDetailSubtitle || selectedChargeDetailSubtitle

	const load = useCallback(async () => {
		const accounts: string[] = []
		if (overrideAddress && ethers.isAddress(overrideAddress)) {
			accounts.push(ethers.getAddress(overrideAddress))
		} else {
			if (eoa && ethers.isAddress(eoa)) accounts.push(ethers.getAddress(eoa))
			if (aa && ethers.isAddress(aa) && aa.toLowerCase() !== eoa?.toLowerCase())
				accounts.push(ethers.getAddress(aa))
			if (accounts.length === 0 && myAddress && ethers.isAddress(myAddress))
				accounts.push(ethers.getAddress(myAddress))
		}

		if (accounts.length === 0) {
			setItems([])
			setLoading(false)
			return
		}

		const hadItems = itemsCountRef.current > 0
		if (!hadItems) {
			setLoading(true)
		}
		setError(null)
		const { items: nextItems, error: nextErr, trusted } = await fetchMergedRecentActivityFromIndexer(accounts)
		if (trusted) {
			setItems(nextItems)
			setError(null)
		} else if (!hadItems && nextErr) {
			setError(nextErr)
		}
		setLoading(false)
	}, [eoa, aa, overrideAddress, myAddress])

	const handleRefresh = useCallback(() => {
		if (refreshLockRef.current) return
		refreshLockRef.current = true
		setManualRefreshing(true)
		const done = () => {
			refreshLockRef.current = false
			setManualRefreshing(false)
		}
		if (useLocalIndexer) {
			load().finally(done)
		} else {
			void refreshRecentActivityNoAa().finally(done)
		}
	}, [useLocalIndexer, load, refreshRecentActivityNoAa])

	useEffect(() => {
		if (!useLocalIndexer) {
			const key = `${eoa ?? ''}|${aa ?? ''}|${myAddress ?? ''}`
			if (nonLocalKeyRef.current !== key) {
				nonLocalKeyRef.current = key
				nonLocalSettledRef.current = false
			}
			if (recentActivityNoAaItems.length > 0 || itemsCountRef.current === 0) {
				setItems((prev) =>
					shouldUpdateRecentActivityList(prev, recentActivityNoAaItems)
						? recentActivityNoAaItems
						: prev,
				)
			}
			if (!recentActivityNoAaLoading || recentActivityNoAaItems.length > 0) {
				nonLocalSettledRef.current = true
			}
			setLoading(
				recentActivityNoAaLoading &&
				recentActivityNoAaItems.length === 0 &&
				itemsCountRef.current === 0 &&
				!nonLocalSettledRef.current
			)
			setError(recentActivityNoAaError)
		}
	}, [
		useLocalIndexer,
		recentActivityNoAaItems,
		recentActivityNoAaLoading,
		recentActivityNoAaError,
		eoa,
		aa,
		myAddress,
	])

	useEffect(() => {
		if (!useLocalIndexer) return
		void load()
	}, [useLocalIndexer, load])

	// Detail Sheet 打开时隐藏 global footer，关闭时恢复
	useEffect(() => {
		if (selectedTx) {
			setShowFooter(false)
			return () => setShowFooter(true)
		}
		setShowFooter(true)
	}, [selectedTx, setShowFooter])

	// 关闭 Detail Sheet 或切换 tx 时清空完整 Transaction 缓存
	useEffect(() => {
		if (!selectedTx) {
			setFullTransactionFromChain(null)
			setShowGiftCard(false)
			setShowVouchersQRSheet(false)
			setCancelRequestError(null)
		}
	}, [selectedTx])

	// 选中交易时用 indexer `id`（非 BaseScan finishedHash）拉完整 Transaction（含 route）
	useEffect(() => {
		if (!selectedTx?.id) {
			setFullTxLoading(false)
			return
		}
		setFullTxLoading(true)
		setFullTransactionFromChain(null)
		const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
		indexer
			.getTransactionFullByTxId(ethers.hexlify(ethers.getBytes(selectedTx.id)))
			.then((full: unknown) => {
				const toStr = (v: unknown): unknown => {
					if (typeof v === 'bigint') return v.toString()
					if (Array.isArray(v)) return v.map(toStr)
					if (v && typeof v === 'object' && !(v instanceof Date)) {
						const o: Record<string, unknown> = {}
						for (const [k, v2] of Object.entries(v)) o[k] = toStr(v2)
						return o
					}
					return v
				}
				// 当前 ActionFacet.TransactionFull 顺序：... isAAAccount, topAdmin, subordinate, route, fees, meta
				const keys = ['id','originalPaymentHash','chainId','txCategory','displayJson','timestamp','payer','payee','finalRequestAmountFiat6','finalRequestAmountUSDC6','isAAAccount','topAdmin','subordinate','route','fees','meta']
				const arr = Array.isArray(full) ? full : (full as Record<string, unknown>)
				const raw: Record<string, unknown> = {}
				if (Array.isArray(arr) && arr.length >= 16) {
					for (let i = 0; i < keys.length && i < arr.length; i++) raw[keys[i]] = toStr(arr[i])
				} else {
					const r = (arr as Record<string, unknown>) || {}
					for (const [k, v] of Object.entries(r)) {
						if (v !== undefined && typeof k === 'string' && !/^\d+$/.test(k)) raw[k] = toStr(v)
					}
				}
				// 将 fees/meta/route 数组转为具名对象
				setFullTransactionFromChain(toNamedTransactionJson(raw))
			})
			.catch(() => setFullTransactionFromChain(null))
			.finally(() => setFullTxLoading(false))
	}, [selectedTx?.id])

	const filteredItems = items.filter((tx) => {
		if (activeTab === 'All') return true
		// Cash: Main Wallet 相关。internal_transfer、fuel_yield 虽 isAA 可能为 true，也需展示
		if (activeTab === 'Cash') {
			return (
				!tx.isAA ||
				tx.type === 'internal_transfer' ||
				tx.type === 'fuel_yield' ||
				tx.type === 'merchant_gift'
			)
		}
		if (activeTab === 'Vouchers') return tx.isAA || tx.type === 'merchant_gift'
		return true
	})


	/** 已取消的 request 的 originalPaymentHash 集合（来自 request_cancel 交易） */
	const canceledHashes = useMemo(() => {
		const set = new Set<string>()
		for (const tx of filteredItems) {
			if (tx.type === 'request_cancel') {
				const h = getOriginalPaymentHash(tx)
				if (h) set.add(h)
			}
		}
		return set
	}, [filteredItems])

	/** 按 originalPaymentHash 分组：若 request_create 与 request_fulfilled 同 Hash 则只显示 request_fulfilled；若有 request_cancel 则聚合为 Canceled */
	const groupedDisplayItems = useMemo(() => {
		const byHash = new Map<string, TxView[]>()
		for (const tx of filteredItems) {
			const hash = getOriginalPaymentHash(tx)
			if (hash) {
				const arr = byHash.get(hash) ?? []
				arr.push(tx)
				byHash.set(hash, arr)
			}
		}
		const suppressed = new Set<string>()
		for (const [, arr] of byHash) {
			const hasCreate = arr.some((t) => t.type === 'request_create')
			const hasFulfilled = arr.some((t) => t.type === 'request_fulfilled')
			const hasCancel = arr.some((t) => t.type === 'request_cancel')
			if (hasCreate && hasFulfilled) {
				for (const t of arr) {
					if (t.type === 'request_create') suppressed.add(t.id)
				}
			}
			// request_cancel 与 request_create 同 Hash：隐藏 request_cancel（用 request_create 展示，状态为 Canceled）
			if (hasCreate && hasCancel) {
				for (const t of arr) {
					if (t.type === 'request_cancel') suppressed.add(t.id)
				}
			}
		}
		return filteredItems.filter((tx) => !suppressed.has(tx.id))
	}, [filteredItems])

	const displayItems = compact ? groupedDisplayItems.slice(0, compactLimit) : groupedDisplayItems

	/** internal_transfer 方向：AA→EOA 蓝色 EOA 钱包，EOA→AA 紫色 AA 钱包 */
	const iconForInternalTransfer = (tx: TxView, size: number) => {
		const rawTx = tx.rawTransaction as RawTxRecord | undefined
		const payeeAddr = (extractAddr(rawTx?.payee) ?? '').toLowerCase()
		const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
		const aaAddr = (aa ?? '').toLowerCase()
		// Withdraw from Express Pay (AA→EOA): EOA 钱包图标（蓝色由 iconBg 控制）
		if (payeeAddr === eoaAddr) return <Wallet size={size} strokeWidth={2} />
		// Add to Express Pay (EOA→AA): AA 钱包图标（紫色由 iconBg 控制）
		if (payeeAddr === aaAddr) return <Wallet size={size} strokeWidth={2} />
		return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
	}

	const iconForType = (type: TxDisplayType, size = 22, tx?: TxView) => {
		switch (type) {
			case 'merchant_pay':
				return <CreditCard size={size} strokeWidth={2} />
			case 'merchant_gift':
				return <Gift size={size} strokeWidth={2} />
			case 'transfer_in':
				return <ArrowDownLeft size={size} strokeWidth={2} />
			case 'request_fulfilled':
				return <QrCode size={size} strokeWidth={2} />
			case 'transfer_out':
				return <ArrowUpRight size={size} strokeWidth={2} />
			case 'request_create':
				return <QrCode size={size} strokeWidth={2} />
			case 'request_expired':
				return <XCircle size={size} strokeWidth={2} />
			case 'claim_coupon':
				return <Gift size={size} strokeWidth={2} />
			case 'claim_catalog':
				return <Package size={size} strokeWidth={2} />
			case 'topup':
			case 'cardmint':
				return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
			case 'internal_transfer':
				return tx && eoa && aa ? iconForInternalTransfer(tx, size) : <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
			case 'voucher_burn':
				return <Ticket size={size} strokeWidth={2} />
			case 'request_cancel':
				return <XCircle size={size} strokeWidth={2} />
			case 'fuel_yield':
				return <Plus size={size} strokeWidth={2} />
			default:
				return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
		}
	}

	const colorForType = (type: TxDisplayType) => {
		switch (type) {
			case 'merchant_pay':
				return 'bg-[#1562f0]/10 text-[#1562f0]'
			case 'merchant_gift':
				return 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
			case 'transfer_in':
			case 'request_fulfilled':
				return 'bg-[#34C759]/10 text-[#34C759]'
			case 'transfer_out':
				return 'bg-gray-100 text-black dark:bg-slate-700 dark:text-white'
			case 'request_create':
				return 'bg-[#FF9500]/10 text-[#FF9500]'
			case 'request_expired':
				return 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-400'
			case 'claim_coupon':
				return 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
			case 'claim_catalog':
				return 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300'
			case 'topup':
			case 'cardmint':
			case 'internal_transfer':
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
			case 'voucher_burn':
				return 'bg-[#AF52DE]/10 text-[#AF52DE]'
			case 'request_cancel':
				return 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-400'
			case 'fuel_yield':
				return 'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400'
			default:
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
		}
	}

	const colorForTypeSolid = (type: TxDisplayType) => {
		switch (type) {
			case 'merchant_pay':
				return 'bg-[#1562f0] text-white shadow-blue-200'
			case 'merchant_gift':
				return 'bg-fuchsia-500 text-white shadow-fuchsia-200'
			case 'transfer_in':
			case 'request_fulfilled':
				return 'bg-[#34C759] text-white shadow-green-200'
			case 'transfer_out':
				return 'bg-black text-white shadow-gray-300 dark:bg-white dark:text-black'
			case 'request_create':
				return 'bg-[#FF9500] text-white shadow-orange-200'
			case 'request_expired':
				return 'bg-gray-200 text-gray-500 dark:bg-slate-600 dark:text-slate-300'
			case 'topup':
			case 'cardmint':
			case 'internal_transfer':
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
			case 'voucher_burn':
				return 'bg-[#AF52DE] text-white'
			case 'request_cancel':
				return 'bg-gray-200 text-gray-500 dark:bg-slate-600 dark:text-slate-300'
			case 'fuel_yield':
				return 'bg-orange-500 text-white shadow-orange-200'
			default:
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
		}
	}

	const getStatus = (tx: TxView) => {
		if (tx.type === 'request_create' && canceledHashes.has(getOriginalPaymentHash(tx))) return 'Canceled'
		if (tx.type === 'request_create' && isRequestExpired(tx)) return 'Expired'
		if (tx.type === 'request_create') return 'Waiting'
		if (tx.type === 'request_expired') return 'Expired'
		if (tx.type === 'request_cancel') return 'Canceled'
		if (tx.type === 'voucher_burn' && tx.amountUSDC === 0) return 'Redeemed'
		return tx.isInbound ? 'Received' : 'Finalized'
	}

	/** 带符号的法币金额，用于展示（使用 meta.currencyFiat 对应币种） */
	const useBareStyle = bare || embeddedInDrawer
	const outerClassName = useBareStyle
		? 'overflow-hidden'
		: 'bg-[#F2F2F7] dark:bg-slate-900/80 rounded-[20px] p-4 shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden'
	const useFloatingTopControls = !compact && !embeddedInDrawer && floatingTopControlsOpacity !== undefined
	const floatingControlsInteractive = (floatingTopControlsOpacity ?? 1) >= 0.05
	const floatingTopControlsRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!useFloatingTopControls || !onFloatingTopControlsSpaceChange) return
		const node = floatingTopControlsRef.current
		if (!node) return

		const measure = () => {
			const rect = node.getBoundingClientRect()
			onFloatingTopControlsSpaceChange(Math.ceil(rect.bottom + 16))
		}

		measure()
		const frame = window.requestAnimationFrame(measure)
		const ro = new ResizeObserver(measure)
		ro.observe(node)
		window.addEventListener('resize', measure)
		return () => {
			window.cancelAnimationFrame(frame)
			ro.disconnect()
			window.removeEventListener('resize', measure)
		}
	}, [onFloatingTopControlsSpaceChange, useFloatingTopControls])

	return (
		<>
		{useFloatingTopControls && (
			<div
				ref={floatingTopControlsRef}
				className="pointer-events-none fixed left-4 right-4 z-30 transition-opacity duration-300"
				style={{
					top: 'max(1rem, env(safe-area-inset-top, 0px))',
					opacity: floatingTopControlsOpacity,
				}}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-slate-100/90 bg-white/70 py-2 pl-4 pr-2 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-800/70">
						<h3
							className={
								sectionTitleClassName ??
								'text-[14px] font-bold text-black dark:text-white tracking-tight'
							}
						>
							{title}
						</h3>
						<button
							type="button"
							onClick={handleRefresh}
							disabled={manualRefreshing}
							className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/75 transition-colors hover:bg-white disabled:opacity-50 dark:bg-slate-700/75 dark:hover:bg-slate-700"
							style={{ pointerEvents: floatingControlsInteractive ? 'auto' : 'none' }}
							aria-label="Refresh"
						>
							{manualRefreshing ? (
								<Loader size={13} className="animate-spin text-[#1562f0]" />
							) : (
								<RefreshCw size={13} className="text-[#1562f0]" strokeWidth={2.5} />
							)}
						</button>
					</div>
					<div className="pointer-events-auto flex shrink-0 items-center rounded-full border border-slate-100/90 bg-white/70 p-1 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-800/70">
						{(['All', 'Cash', 'Vouchers'] as const).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => setActiveTab(tab)}
								className={`grid h-8 w-8 place-items-center rounded-full transition-all duration-300 ${
									activeTab === tab
										? 'bg-[#1562f0] text-white shadow-[0_4px_12px_rgba(21,98,240,0.3)]'
										: 'text-gray-500 hover:bg-white/70 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-white'
								}`}
								style={{ pointerEvents: floatingControlsInteractive ? 'auto' : 'none' }}
								aria-label={tab}
								title={tab}
							>
								{tab === 'All' ? (
									<ArrowRightLeft size={15} strokeWidth={2.4} />
								) : tab === 'Cash' ? (
									<Wallet size={15} strokeWidth={2.4} />
								) : (
									<Ticket size={15} strokeWidth={2.4} />
								)}
							</button>
						))}
					</div>
				</div>
			</div>
		)}
		<div className={outerClassName}>
			{/* Header - embeddedInDrawer 时隐藏整行（refresh 移至胶囊内） */}
			{!embeddedInDrawer && !useFloatingTopControls && (
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<h3
						className={
							sectionTitleClassName ??
							'text-[14px] font-bold text-black dark:text-white tracking-tight'
						}
					>
						{title}
					</h3>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={manualRefreshing}
						className="w-[22.4px] h-[22.4px] flex items-center justify-center rounded-full bg-white dark:bg-slate-700 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 shrink-0"
						aria-label="Refresh"
					>
						{manualRefreshing ? (
							<Loader size={13} className="animate-spin text-[#1562f0]" />
						) : (
							<RefreshCw size={13} className="text-[#1562f0]" />
						)}
					</button>
				</div>
				{compact && (
					<button
						type="button"
						onClick={() => {
							if (onCompactViewAll) {
								onCompactViewAll()
								return
							}
							setShowFullDrawer(true)
						}}
						className={[
							'flex items-center gap-1 text-[12px] font-semibold transition-colors',
							viewAllClassName ?? 'text-[#1562f0] hover:text-[#0d47c7]',
						].join(' ')}
					>
						View all
						<ChevronRight size={16} strokeWidth={2.5} />
					</button>
				)}
			</div>
			)}

			{/* Segmented Control - 隐藏于 compact 模式 */}
			{!compact && !useFloatingTopControls && (
			<div className="mb-5">
				
				<div className="flex bg-white dark:bg-slate-800/80 p-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 dark:border-slate-700/50">
					{(['All', 'Cash', 'Vouchers'] as const).map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`flex-1 text-[13px] font-semibold tracking-tight rounded-full py-2.5 transition-all duration-300 ${
								activeTab === tab
									? 'bg-[#1562f0] text-white shadow-[0_4px_12px_rgba(21,98,240,0.3)]'
									: 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700/50'
							}`}
						>
							{tab}
						</button>
					))}
				</div>
				{!hideAccountScopeCapsule && (
				<div className="mb-2 flex justify-center mt-2">
					<button
						type="button"
						onClick={handleRefresh}
						disabled={manualRefreshing}
						className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-700/50 border border-white/40 dark:border-slate-600/50 hover:bg-white/80 dark:hover:bg-slate-700/70 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
						aria-label="Refresh"
					>
						{activeTab === 'Cash' && <Wallet size={12} className="text-[#1562f0]" />}
						{activeTab === 'Vouchers' && <Ticket size={12} className="text-[#1562f0]" />}
						<span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">
							{activeTab === 'Cash' ? 'Main Wallet (USDC)' : activeTab === 'Vouchers' ? 'Express Pay (Assets)' : 'All Accounts'}
						</span>
						{manualRefreshing ? (
							<Loader size={14} className="animate-spin text-[#1562f0] shrink-0" />
						) : (
							<RefreshCw size={14} className="text-[#1562f0] shrink-0" strokeWidth={2.5} />
						)}
					</button>
				</div>
				)}
			</div>
			)}

			{error && (
				<div className="py-6 text-center text-sm text-amber-600 dark:text-amber-400">{error}</div>
			)}

			{!error && loading && items.length === 0 && (
				<div className="py-12 flex justify-center">
					<Loader size={32} className="animate-spin text-[#1562f0]" />
				</div>
			)}

			{!error && !loading && items.length === 0 && (
				<div className="py-12 text-center text-sm text-gray-500 dark:text-slate-400">
					No transactions this month
				</div>
			)}

			{!error && items.length > 0 && (
				<div className="space-y-2 pb-3">
					{displayItems.map((tx) => (
						<RecentActivityTxItemRow
							key={tx.id}
							tx={tx}
							activeTab={activeTab}
							eoa={eoa}
							aa={aa}
							myAddress={myAddress}
							canceledHashes={canceledHashes}
							recentActivityCardNameDirectory={recentActivityCardNameDirectory}
							onSelect={(t) => {
								setShowJson(false)
								setSelectedTx(t)
							}}
							iconForType={iconForType}
							colorForType={colorForType}
						/>
					))}
				</div>
			)}

			{items.length > 0 && !error && (
				<div className="pt-2 pb-1 text-center">
					<span className="text-[12px] font-medium text-gray-400 dark:text-slate-500">Encrypted on CoNET L1</span>
				</div>
			)}

			{/* All Activity 全屏页面 - 从右侧滑入，整页可滚动，左上角透明圆形返回按钮随滚动淡入淡出 */}
			{compact &&
				createPortal(
					<AnimatePresence>
						{showFullDrawer && (
							<motion.div
								className="fixed inset-0 z-[9999] bg-[#F2F2F7] dark:bg-slate-950 flex flex-col overflow-hidden"
								initial={{ x: '100%' }}
								animate={{ x: 0 }}
								exit={{ x: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
							>
								<button
									type="button"
									onClick={() => setShowFullDrawer(false)}
									className={`fixed left-4 z-10 ${CAPSULE_BTN_CLASS}`}
									style={{
										top: 'max(1rem, env(safe-area-inset-top))',
										opacity: backBtnOpacity,
										pointerEvents: backBtnOpacity < 0.05 ? 'none' : 'auto',
									}}
									aria-label="Back"
								>
									<ChevronLeft className="w-6 h-6 text-slate-900 dark:text-slate-100" strokeWidth={2.6} />
								</button>

								<div
									ref={setAllActivityScrollRef}
									onScroll={onAllActivityScroll}
									className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
								>
									{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离（Beamio 主设置 protocol） */}
									<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 5rem)' }} />
									<ActiveHistoryPannelNew
										title="Activity"
										overrideAddress={overrideAddress}
										compact={false}
										embeddedInDrawer
									/>
								</div>
							</motion.div>
						)}
					</AnimatePresence>,
					document.body
				)}

			{/* Detail Sheet */}
			{selectedTx && (
				<div className="fixed inset-0 z-50 flex justify-end flex-col animate-in fade-in duration-300">
					<div
						className="absolute inset-0 bg-black/20 backdrop-blur-sm"
						onClick={() => setSelectedTx(null)}
						aria-hidden="true"
					/>
					<div
						className="bg-white dark:bg-slate-900 w-full rounded-t-[32px] p-6 pb-12 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] relative z-10 overflow-y-auto max-h-[85vh]"
						role="dialog"
						aria-modal="true"
						aria-labelledby="tx-detail-title"
					>
						<div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-8" />
						<button
							onClick={() => setSelectedTx(null)}
							className={`absolute top-6 right-6 z-10 ${CAPSULE_BTN_CLASS}`}
							aria-label="Close"
						>
							<X className="w-6 h-6 text-slate-900 dark:text-slate-100" strokeWidth={2.6} />
						</button>

						<div className="text-center mb-8">
							{(() => {
								const isReqCanceledDetail = selectedTx.type === 'request_create' && canceledHashes.has(getOriginalPaymentHash(selectedTx))
								const isReqExpiredDetail = (selectedTx.type === 'request_create' || selectedTx.type === 'request_expired') && isRequestExpired(selectedTx)
								const payeeAddr = (extractAddr((selectedTx.rawTransaction as RawTxRecord)?.payee) ?? '').toLowerCase()
								const isInternalToEoa = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddr === (eoa ?? myAddress ?? '').toLowerCase()
								const isInternalToAa = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddr === (aa ?? '').toLowerCase()
								const showGreenArrow = !selectedTxMySideIsAA && selectedTx.isInbound && selectedTx.type !== 'internal_transfer'
								// 自己是收款方时，与列表对齐：request_fulfilled 用 QrCode，transfer_in 用 ArrowDownLeft
								const isReceiver = selectedTx.isInbound && selectedTx.type !== 'internal_transfer'
								const detailIcon = selectedIsCardTopupKind
									? <Plus size={40} strokeWidth={2.6} />
									: selectedTx.type === 'fuel_yield'
									? <ArrowUpRight size={36} strokeWidth={2} />
									: isReceiver && selectedTx.type === 'request_fulfilled'
									? iconForType(selectedTx.type, 36, selectedTx)
									: showGreenArrow ? <ArrowDownLeft size={36} strokeWidth={2} /> : (isReqExpiredDetail || isReqCanceledDetail)
										? <XCircle size={36} strokeWidth={2} />
										: iconForType(selectedTx.type, 36, selectedTx)
								// AA→EOA 蓝色背景白色 icon；EOA→AA 紫色背景白色 icon；Request Expired / Canceled 使用灰色
								const capsuleBg = selectedIsCardTopupKind
									? 'bg-[#34C759] text-white dark:bg-[#34C759] dark:text-white shadow-[0_18px_38px_rgba(52,199,89,0.3)]'
									: selectedTx.type === 'fuel_yield'
									? 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
									: isInternalToEoa
									? 'bg-[#1562f0] text-white dark:bg-[#1562f0] dark:text-white'
									: isInternalToAa
										? 'bg-[#AF52DE] text-white dark:bg-[#AF52DE] dark:text-white'
										: (isReqExpiredDetail || isReqCanceledDetail)
										? 'bg-gray-200 text-gray-500 dark:bg-slate-600 dark:text-slate-300'
										: showGreenArrow ? 'bg-[#34C759] text-white shadow-[0_18px_38px_rgba(52,199,89,0.3)]' : colorForTypeSolid(selectedTx.type)
								if (selectedIsMerchantChargeKind) {
									return (
										<MyBrandMerchantIcon
											title={selectedCardName || selectedCardMetadataName || 'Merchant'}
											iconUrl={selectedChargeIconUrl}
											sizeClassName="h-[72px] w-[72px] rounded-[24px] shadow-lg mb-5 mx-auto"
											letterClassName="text-3xl font-bold text-[#1562f0] dark:text-[#6ba3ff]"
										/>
									)
								}
								return (
							<div
								className={`w-[72px] h-[72px] mx-auto rounded-[24px] flex items-center justify-center shadow-lg mb-5 ${capsuleBg}`}
							>
								{detailIcon}
							</div>
								)
							})()}

							<div className="text-center">
								{(() => {
									const raw = selectedTx.rawTransaction as RawTxRecord | undefined
									const extractAddrDetail = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
									const payeeAddrDetail = (extractAddrDetail(raw?.payee) ?? '').toLowerCase()
									const isInternalToEoaDetail = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddrDetail === (eoa ?? myAddress ?? '').toLowerCase()
									const isAddToExpressDetail = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddrDetail === (aa ?? '').toLowerCase()
									// Vouchers 下与一览表对齐：Main Wallet → Express Pay 显示 + 绿色，Express Pay → Main Wallet 显示 - 黑色
									const vouchersDetailAmt = activeTab === 'Vouchers' && selectedTx.type === 'internal_transfer'
										? (isAddToExpressDetail ? { amt: Math.abs(selectedTx.amountFiat), green: true } : { amt: -Math.abs(selectedTx.amountFiat), green: false })
										: null
									const detailAmt = vouchersDetailAmt
										? vouchersDetailAmt.amt
										: isInternalToEoaDetail ? Math.abs(selectedTx.amountFiat) : isAddToExpressDetail ? -Math.abs(selectedTx.amountFiat) : amountFiatSigned(selectedTx)
									const detailAmtGreen = vouchersDetailAmt ? vouchersDetailAmt.green : false
									const amountColorClass = ((selectedTx.type === 'request_create' || selectedTx.type === 'request_expired') && (isRequestExpired(selectedTx) || canceledHashes.has(getOriginalPaymentHash(selectedTx))))
										? 'text-gray-400 dark:text-slate-500'
										: selectedIsCardTopupKind
											? 'text-[#34C759]'
											: selectedIsMerchantChargeKind
											? 'text-black dark:text-white'
											: selectedTx.type === 'fuel_yield'
											? 'text-black dark:text-white'
											: activeTab === 'Vouchers' && selectedTx.type === 'internal_transfer'
												? (detailAmtGreen ? 'text-[#34C759]' : 'text-black dark:text-white')
												: 'text-black dark:text-white'
									return (
								<h2
									id="tx-detail-title"
									className={`text-[28px] font-bold tracking-tight leading-tight ${amountColorClass}`}
								>
									{selectedTx.type === 'request_create' && canceledHashes.has(getOriginalPaymentHash(selectedTx))
										? 'Request Canceled'
										: (selectedTx.type === 'request_create' || selectedTx.type === 'request_expired') && isRequestExpired(selectedTx)
										? 'Request Expired'
										: selectedTx.type === 'fuel_yield'
										? `-${formatAmount(selectedTx.amountUSDC > 0 ? selectedTx.amountUSDC : (Math.abs(selectedTx.amountFiat) / 100), 'USDC')} USDC`
										: selectedTx.type === 'request_create' || selectedTx.type === 'request_expired'
										? `Requesting ${formatAmount(Math.abs(selectedTx.amountFiat), selectedTx.currencyCode as ICurrency)} ${selectedTx.currencyCode}`
										: selectedIsCardTopupKind
											? formatTopupListAmountPositive(selectedTx.amountFiat, selectedTx.currencyCode)
										: selectedIsMerchantChargeKind
											? formatMerchantChargeListAmountNegative(selectedChargeFiatAmount, selectedChargeCurrencyCode)
										: selectedTx.amountUSDC === 0
											? 'Redeemed'
											: formatCurrencySigned(detailAmt, selectedTx.currencyCode)}
								</h2>
									)
								})()}
								{selectedIsProgramCardLedgerKind && selectedProgramCardDetailTitle ? (
									<p className="text-[17px] font-semibold text-black dark:text-white mt-2">{selectedProgramCardDetailTitle}</p>
								) : null}
								{selectedIsProgramCardLedgerKind && selectedProgramCardDetailSubtitle ? (
									<p className="text-[14px] font-medium text-gray-500 dark:text-slate-400 mt-1">{selectedProgramCardDetailSubtitle}</p>
								) : null}
								{((selectedTx.type === 'request_create' || selectedTx.type === 'request_expired') && (isRequestExpired(selectedTx) || canceledHashes.has(getOriginalPaymentHash(selectedTx)))) && (
									<p className="text-[18px] font-semibold text-gray-500 dark:text-slate-400 mt-1">
										{formatAmountWithCurrencyProtocol(Math.abs(selectedTx.amountFiat), selectedTx.currencyCode as ICurrency)}
									</p>
								)}
							</div>
							{(() => {
								if (selectedTx.type === 'request_create' || selectedTx.type === 'request_expired') return null
								const detailSubline =
									selectedTx.type === 'fuel_yield'
										? `Received +${Number(selectedTx.amountFiat).toFixed(2)} B-Units`
										: selectedIsUpgradeNewCard && selectedCardMetaAmounts.discountAmountFiat6 > 0n && selectedCardMetaAmounts.requestAmountFiat6 > 0n
											? `Merged ${formatAmount(Number(selectedCardMetaAmounts.discountAmountFiat6) / 1e6, selectedTx.currencyCode as ICurrency)} ${selectedMergedUnitLabel} into ${formatAmount(Number(selectedCardMetaAmounts.requestAmountFiat6) / 1e6, selectedTx.currencyCode as ICurrency)} ${selectedCardUnitLabel}${selectedTopupIsUsdcPayment ? ` · ${formatAmount(selectedCardTopupUSDCAmount, 'USDC')} USDC` : ''}`
											: selectedIsCardTopupKind
												? (selectedTopupIsUsdcPayment && selectedTx.amountUSDC !== 0
													? `Paid ${formatAmount(selectedCardTopupUSDCAmount, 'USDC')} USDC`
													: null)
												: selectedIsMerchantChargeKind
													? (selectedChargeCurrencyCode.toUpperCase() === 'USDC' && selectedTx.amountUSDC !== 0
														? `Settled for ${formatAmount(Math.abs(selectedTx.amountUSDC), 'USDC')} USDC`
														: null)
													: selectedTx.amountUSDC !== 0
														? `Settled for ${formatAmount(Math.abs(selectedTx.amountUSDC), 'USDC')} USDC`
														: null
								if (!detailSubline) return null
								return (
									<p className={`text-[14px] font-medium mt-0.5 ${
										selectedIsMerchantChargeKind
											? 'text-gray-500 dark:text-slate-400'
											: 'text-blue-600 dark:text-blue-400'
									}`}>
										{detailSubline}
									</p>
								)
							})()}
							{!selectedIsProgramCardLedgerKind ? (
								<p className="text-[15px] font-medium text-gray-500 dark:text-slate-400 mt-1">
									{formatBeamioTransactionTimeLabel(selectedTx.timestampMs)}
								</p>
							) : null}
							<div
								className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold mt-4 ${
									getStatus(selectedTx) === 'Waiting' && !canceledHashes.has(getOriginalPaymentHash(selectedTx))
										? 'bg-[#FF9500]/10 text-[#FF9500]' :
									getStatus(selectedTx) === 'Expired' || getStatus(selectedTx) === 'Canceled' || canceledHashes.has(getOriginalPaymentHash(selectedTx))
										? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400' :
									'bg-[#34C759]/10 text-[#34C759]'
								}`}
							>
								{getStatus(selectedTx) === 'Waiting' && !canceledHashes.has(getOriginalPaymentHash(selectedTx)) && <Clock size={14} />}
								{(getStatus(selectedTx) === 'Expired' || getStatus(selectedTx) === 'Canceled' || canceledHashes.has(getOriginalPaymentHash(selectedTx))) && <Ban size={14} />}
								{(getStatus(selectedTx) === 'Received' || getStatus(selectedTx) === 'Finalized' || getStatus(selectedTx) === 'Redeemed') && (
									<CheckCircle2 size={14} />
								)}
								{canceledHashes.has(getOriginalPaymentHash(selectedTx)) ? 'Canceled' : (getStatus(selectedTx) === 'Received' ? 'Finalized' : getStatus(selectedTx))}
							</div>
						</div>

						{/* displayJson 附带的 title / forText 等文字信息：Fuel Yield / Top-up detail 中不显示旧 indexer title 卡片 */}
						{selectedTx.type !== 'fuel_yield' && !selectedIsProgramCardLedgerKind && (selectedTx.forText ?? selectedTx.handle) && (
							<div className="mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-4 py-3">
								{selectedTx.title !== 'Transaction' && selectedTx.title !== 'Beamio Transfer' && (
									<p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedTx.title}</p>
								)}
								{!handleIsJson(selectedTx.forText ?? selectedTx.handle) && (
									<p className={`text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words ${selectedTx.title !== 'Transaction' && selectedTx.title !== 'Beamio Transfer' ? 'mt-1' : ''}`}>
										{selectedTx.forText ?? selectedTx.handle}
									</p>
								)}
							</div>
						)}

						{/* Requesting Waiting 时：Code is active + Share Again + Cancel Request 按钮 */}
						{getStatus(selectedTx) === 'Waiting' && selectedTx.type === 'request_create' && !canceledHashes.has(getOriginalPaymentHash(selectedTx)) && !isRequestExpired(selectedTx) && (
							<div className="mb-6">
								<div className="rounded-[20px] bg-[#FFF5E0] dark:bg-amber-900/25 px-5 py-5 shadow-[0_2px_12px_rgba(255,153,0,0.08)]">
									<p className="text-[15px] font-semibold text-[#FF9900] dark:text-amber-400 text-center mb-4">
										Code is active. Waiting for payment.
									</p>
									{buildVouchersUrl(selectedTx) && (
										<button
											type="button"
											onClick={async () => {
												const url = buildVouchersUrl(selectedTx)
												if (!url) return
												if (navigator.share) {
													try {
														await navigator.share({ title: 'Beamio Payment', url, text: url })
													} catch {
														await navigator.clipboard.writeText(url)
													}
												} else {
													await navigator.clipboard.writeText(url)
												}
											}}
											className="w-full py-3 rounded-xl font-semibold text-sm bg-white text-[#FF9900] dark:text-amber-400 border border-gray-200/80 dark:border-slate-600/60 shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
										>
											<Share2 size={18} strokeWidth={2.5} />
											Share Again
										</button>
									)}
								</div>
								{cancelRequestError && (
									<p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">{cancelRequestError}</p>
								)}
								<button
									type="button"
									onClick={async () => {
										const reqHash = getOriginalPaymentHash(selectedTx)
										if (!reqHash || !ethers.isHexString(reqHash) || ethers.dataLength(reqHash) !== 32) return
										const pk = profiles?.[0]?.privateKeyArmor
										if (!pk || typeof pk !== 'string') {
											setCancelRequestError('No signing key available')
											return
										}
										setCancelRequestLoading(true)
										setCancelRequestError(null)
										try {
											const wallet = new ethers.Wallet(pk)
											const hashBytes = ethers.getBytes(reqHash as `0x${string}`)
											const payeeSignature = await wallet.signMessage(hashBytes)
											const res = await fetch(`${beamioApi}/api/cancelRequest`, {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({ originalPaymentHash: reqHash, payeeSignature }),
											})
											const data = await res.json().catch(() => ({}))
											if (res.ok && data?.success !== false) {
												load()
												setSelectedTx(null)
											} else {
												setCancelRequestError(data?.error || res.statusText || 'Cancel failed')
											}
										} catch (e: unknown) {
											setCancelRequestError(e instanceof Error ? e.message : 'Cancel failed')
										} finally {
											setCancelRequestLoading(false)
										}
									}}
									disabled={cancelRequestLoading}
									className="w-full mt-4 py-3 font-bold text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 active:opacity-80 transition disabled:opacity-60 flex items-center justify-center gap-2"
								>
									{cancelRequestLoading ? <Loader size={16} className="animate-spin" /> : null}
									Cancel Request (Fuel not refundable)
								</button>
							</div>
						)}

						{/* 附带 Gift Card 时展示查看按钮 */}
						{selectedTx.card?.image && (
							<div className="mb-8">
								<button
									type="button"
									onClick={() => setShowGiftCard(true)}
									className="w-full flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl active:scale-[0.98] transition-transform"
								>
									{selectedTx.card.image && (
										<div className="w-14 h-14 rounded-xl overflow-hidden bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">
											<IpfsImg src={selectedTx.card.image} alt={selectedTx.card.title ?? 'Gift'} className="w-full h-full object-cover" />
										</div>
									)}
									<div className="flex-1 min-w-0 text-left">
										<p className="font-semibold text-amber-900 dark:text-amber-200 truncate">{selectedTx.card.title || 'Gift Card'}</p>
										{selectedTx.card.detail && (
											<p className="text-[12px] text-amber-700 dark:text-amber-300 line-clamp-2 mt-0.5">{selectedTx.card.detail}</p>
										)}
									</div>
									<ChevronRight size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
								</button>
							</div>
						)}


						{['request_create', 'request_expired', 'request_fulfilled'].includes(selectedTx.type) && (() => {
							const raw = selectedTx.rawTransaction
							const displayJsonStr = raw?.displayJson ?? ''
							let validity: { expiresAt?: number; validDays?: number } | undefined
							try {
								const j = JSON.parse(displayJsonStr || '{}')
								validity = j.validity
							} catch {}
							const hashRaw = raw?.originalPaymentHash
							const reqHash = hashRaw
								? (typeof hashRaw === 'string' ? hashRaw : ethers.hexlify(hashRaw as ethers.BytesLike))
								: (selectedTx.txHash || selectedTx.id || '')
							const shortHash = (reqHash && reqHash.startsWith('0x') ? `${reqHash.slice(0, 7)}…${reqHash.slice(-5)}` : reqHash?.slice(0, 18) || '').toUpperCase()
							const tsRaw = raw?.timestamp ?? 0n
							const tsSec = Number(tsRaw) < 10_000_000_000 ? Number(tsRaw) : Number(tsRaw) / 1000
							const expiresAtSec = validity?.expiresAt ?? (validity?.validDays ? tsSec + validity.validDays * 86400 : 0)
							const expiryText = expiresAtSec > 0
								? new Date(expiresAtSec * 1000).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
								: ''
							const vouchersUrl = buildVouchersUrl(selectedTx)
							return (
								<div className="space-y-3 mb-6">
									<div className="flex flex-wrap gap-2">
										{shortHash && (
											<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-[12px] font-medium">
												<Hash size={12} /> Request ID: {shortHash}
											</span>
										)}
										{expiryText && (
											<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-600/40 text-slate-700 dark:text-slate-300 rounded-full text-[12px] font-medium">
												<Clock size={12} /> {selectedTx.type === 'request_expired' ? 'Expired' : 'Expires'}: {expiryText}
											</span>
										)}
									</div>

									{vouchersUrl && selectedTx.type === 'request_create' && !isRequestExpired(selectedTx) && !canceledHashes.has(getOriginalPaymentHash(selectedTx)) && (
										<button
											type="button"
											onClick={() => setShowVouchersQRSheet(true)}
											className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-sky-100 dark:bg-sky-900/40 text-blue-600 dark:text-blue-400 hover:bg-sky-200 dark:hover:bg-sky-900/60 active:scale-[0.98] transition"
										>
											<QrCode size={18} /> Show QR
										</button>
									)}
								</div>
							)
						})()}

						{/* Settled 节：仅当 request 已完成支付时展示 Smart Routing；Request Expired、Waiting、Cancel 状态下不展示；EOA<>AA 内部互转不展示 */}
						{(() => {
							const status = getStatus(selectedTx)
							if (status === 'Waiting' || status === 'Expired' || status === 'Canceled') return null
							if (selectedTx.type === 'internal_transfer') return null
							if (canceledHashes.has(getOriginalPaymentHash(selectedTx))) return null
							const txWithRoute = fullTransactionFromChain ?? (selectedTx?.rawTransaction as unknown as Record<string, unknown>)
							const routeArr = (txWithRoute?.route as RouteItemRecord[] | undefined) ?? []
							const useSyntheticRouting = selectedIsCardTopupKind && selectedTopupIsUsdcPayment && routeArr.length === 0 && selectedTx.amountUSDC !== 0
							const useSyntheticChargeRouting =
								selectedIsMerchantChargeKind && routeArr.length === 0 && selectedChargeFiatAmount > 0
							const chargeSubtotalFiat = Math.max(0, selectedChargeFiatAmount - selectedChargeTipFiat)
							const chargeRouteVoucherLegCount =
								selectedIsMerchantChargeKind && routeArr.length > 0
									? routeArr.filter((item) => {
											const src = Number(item.source ?? 0)
											return src >= 1 && src <= 3
										}).length
									: 0
							const syntheticRows = useSyntheticRouting
								? (selectedIsUpgradeNewCard && selectedCardMetaAmounts.discountAmountFiat6 > 0n && selectedCardMetaAmounts.requestAmountFiat6 > 0n
									? [
										{
											key: 'voucher-upgraded',
											isVoucher: true,
											primary: selectedCardUnitLabel,
											secondary: 'Voucher',
											amountText: `+${(Number(selectedCardMetaAmounts.requestAmountFiat6 + selectedCardMetaAmounts.discountAmountFiat6) / 1e6).toFixed(2)}`,
											amountClass: 'text-[#34C759]',
											iconBg: selectedUpgradeTierColors.upgradedBg ?? '#A855F7',
											iconText: selectedUpgradeTierColors.upgradedText ?? '#FFFFFF',
										},
										{
											key: 'voucher-merged',
											isVoucher: true,
											primary: selectedMergedUnitLabel,
											secondary: 'Voucher · Merged',
											amountText: `-${(Number(selectedCardMetaAmounts.discountAmountFiat6) / 1e6).toFixed(2)}`,
											amountClass: 'text-black dark:text-white',
											iconBg: selectedUpgradeTierColors.mergedBg ?? '#A855F7',
											iconText: selectedUpgradeTierColors.mergedText ?? '#FFFFFF',
										},
										{
											key: 'cash',
											isVoucher: false,
											primary: 'USDC',
											secondary: 'Cash · Main Wallet (EOA)',
											amountText: `-${selectedCardTopupUSDCAmount.toFixed(2)}`,
											amountClass: 'text-black dark:text-white',
										},
									]
									: [
										{
											key: 'voucher',
											isVoucher: true,
											primary: selectedCardUnitLabel,
											secondary: 'Voucher',
											amountText: `+${Math.abs(selectedTx.amountFiat).toFixed(2)}`,
											amountClass: 'text-[#34C759]',
											iconBg: selectedCardTierColor.bg ?? '#A855F7',
											iconText: selectedCardTierColor.text ?? '#FFFFFF',
										},
										{
											key: 'cash',
											isVoucher: false,
											primary: 'USDC',
											secondary: 'Cash · Main Wallet (EOA)',
											amountText: `-${selectedCardTopupUSDCAmount.toFixed(2)}`,
											amountClass: 'text-black dark:text-white',
										},
									])
								: []
							const syntheticChargeRows = useSyntheticChargeRouting
								? [
										{
											key: 'voucher',
											isVoucher: true,
											amountText: formatMerchantChargeListAmountNegative(
												chargeSubtotalFiat,
												selectedChargeCurrencyCode,
											),
											amountClass: 'text-black dark:text-white',
										},
									]
								: []
							if (routeArr.length === 0 && !useSyntheticRouting && !useSyntheticChargeRouting) return null
							// 付款时 payer 是我方，收款时 payer 是对方；route 的 source 0 表示资金来自 payer
							const payerAddr = (extractAddr(txWithRoute?.payer) ?? '').toLowerCase()
							const aaAddr = (aa ?? '').toLowerCase()
							const isAA = selectedTx!.isInbound ? !!txWithRoute?.isAAAccount : (payerAddr === aaAddr)
							const totalUSDC6 = selectedCardMetaAmounts.requestAmountUSDC6 > 0n
								? selectedCardMetaAmounts.requestAmountUSDC6
								: (typeof txWithRoute?.finalRequestAmountUSDC6 === 'string'
								? BigInt(txWithRoute.finalRequestAmountUSDC6 as string)
								: (txWithRoute?.finalRequestAmountUSDC6 as bigint | undefined) ?? 0n)
							return (
								<div className="rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-600/50 p-4 shadow-sm mb-6">
									{(!selectedIsProgramCardLedgerKind || selectedIsUpgradeNewCard) ? (
										<div className="flex items-center justify-between mb-4">
											<h3 className="flex items-center gap-2 text-[14px] font-bold text-black dark:text-white">
												{selectedIsUpgradeNewCard ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#F3E8FF] dark:bg-[#A855F7]/20">
														<ArrowRightLeft size={14} className="text-[#A855F7] dark:text-[#C084FC]" />
													</span>
												) : (
													<Zap size={16} className="text-[#1562f0]" />
												)}
												{selectedIsUpgradeNewCard ? 'Asset Merge & Upgrade' : 'Smart Routing'}
											</h3>
											<span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md tracking-wide">AUTO</span>
										</div>
									) : null}
									<div className="space-y-4 relative">
										<div className="absolute left-[9px] top-3 bottom-3 w-[2px] bg-gray-100 dark:bg-slate-600 -z-10" />
										{useSyntheticRouting && syntheticRows
											.filter((row) => !selectedIsCardTopupKind || row.isVoucher)
											.map((row) => (
											<div key={row.key} className="flex justify-between items-center">
												<div className="flex items-center gap-3">
													{selectedIsCardTopupKind && row.isVoucher ? (
														<div className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10 w-6 h-6 overflow-hidden bg-white dark:bg-slate-700">
															{selectedCardImage ? (
																<IpfsImg src={selectedCardImage} alt={selectedCardDisplayLabel} className="w-full h-full object-cover" />
															) : (
																<div className="w-full h-full flex items-center justify-center bg-[#34C759]/10 text-[#34C759] text-[10px] font-bold">
																	{selectedCardDisplayInitial}
																</div>
															)}
														</div>
													) : row.isVoucher ? (
														<div
															className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-bold z-10 w-6 h-6"
															style={{
																backgroundColor: (row as { iconBg?: string }).iconBg ?? '#AF52DE',
																color: (row as { iconText?: string }).iconText ?? '#FFFFFF',
															}}
														>
															pts
														</div>
													) : (
														<UsdcBaseCompositeIcon className="w-6 h-6" />
													)}
													<div className="flex flex-col">
														<span className="text-[15px] font-semibold text-black dark:text-white leading-tight">
															{selectedIsCardTopupKind && row.isVoucher ? selectedCardDisplayLabel : row.primary}
														</span>
														{!(selectedIsCardTopupKind && row.isVoucher) ? (
															<span className="text-[12px] text-gray-400 dark:text-slate-400 font-medium">{row.secondary}</span>
														) : null}
													</div>
												</div>
												<span className={`text-[15px] font-semibold ${row.amountClass}`}>{row.amountText}</span>
											</div>
										))}
										{useSyntheticChargeRouting && syntheticChargeRows.map((row) => (
											<div key={row.key} className="flex justify-between items-center">
												<div className="flex items-center gap-3">
													<div className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10 w-6 h-6 overflow-hidden bg-white dark:bg-slate-700">
														{selectedCardImage ? (
															<IpfsImg src={selectedCardImage} alt={selectedCardDisplayLabel} className="w-full h-full object-cover" />
														) : (
															<div className="w-full h-full flex items-center justify-center bg-[#1562f0]/10 text-[#1562f0] text-[10px] font-bold">
																{selectedCardDisplayInitial}
															</div>
														)}
													</div>
													<div className="flex flex-col">
														<span className="text-[15px] font-semibold text-black dark:text-white leading-tight">
															{selectedCardDisplayLabel}
														</span>
													</div>
												</div>
												<span className={`text-[15px] font-semibold ${row.amountClass}`}>{row.amountText}</span>
											</div>
										))}
										{!useSyntheticRouting && !useSyntheticChargeRouting && routeArr
											.filter((item) => {
												if (!selectedIsProgramCardLedgerKind) return true
												const src = Number(item.source ?? 0)
												return src >= 1 && src <= 3
											})
											.map((item, idx) => {
											const amtE6 = BigInt(item.amountE6 ?? item.offsetInRequestCurrencyE6 ?? '0')
											const amt = Number(amtE6) / 1e6
											const src = Number(item.source ?? 0)
											const { primary, secondary } = routeItemLabel(src, isAA)
											const isVoucher = src >= 1 && src <= 3
											const isTopupCreditLine = selectedIsCardTopupKind && isVoucher
											const isChargeDebitLine = selectedIsMerchantChargeKind && isVoucher
											const isProgramCardVoucherLine = isTopupCreditLine || isChargeDebitLine
											const chargeLineFiat = isChargeDebitLine
												? resolveMerchantChargeRoutingLineFiat(
														amt,
														selectedChargeFiatAmount,
														selectedChargeTipFiat,
														chargeRouteVoucherLegCount,
													)
												: amt
											const routeAmountText = isTopupCreditLine
												? formatTopupListAmountPositive(amt, selectedTx.currencyCode)
												: isChargeDebitLine
													? formatMerchantChargeListAmountNegative(chargeLineFiat, selectedChargeCurrencyCode)
													: `-${amt.toFixed(2)}`
											const routeAmountClass = isTopupCreditLine ? 'text-[#34C759]' : 'text-black dark:text-white'
											return (
												<div key={idx} className="flex justify-between items-center">
													<div className="flex items-center gap-3">
														{isProgramCardVoucherLine ? (
															<div className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10 w-6 h-6 overflow-hidden bg-white dark:bg-slate-700">
																{selectedCardImage ? (
																	<IpfsImg src={selectedCardImage} alt={selectedCardDisplayLabel} className="w-full h-full object-cover" />
																) : (
																	<div className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${
																		isChargeDebitLine
																			? 'bg-[#1562f0]/10 text-[#1562f0]'
																			: 'bg-[#34C759]/10 text-[#34C759]'
																	}`}>
																		{selectedCardDisplayInitial}
																	</div>
																)}
															</div>
														) : isVoucher ? (
															<div
																className={`rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-bold z-10 ${
																	selectedIsCardTopupKind ? 'w-6 h-6' : 'w-5 h-5'
																}`}
																style={{
																	backgroundColor: selectedIsIssueNewCard || selectedIsTopupCard
																		? (selectedCardTierColor.bg ?? '#A855F7')
																		: (selectedIsCardTopupKind ? '#A855F7' : '#AF52DE'),
																	color: selectedIsIssueNewCard || selectedIsTopupCard
																		? (selectedCardTierColor.text ?? '#FFFFFF')
																		: '#FFFFFF',
																}}
															>
																pts
															</div>
														) : (selectedIsCardTopupKind ? (
															<UsdcBaseCompositeIcon className="w-6 h-6" />
														) : (
															<div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-bold z-10 bg-[#1562f0] text-white">
																$
															</div>
														))}
														<div className="flex flex-col">
															<span className="text-[15px] font-semibold text-black dark:text-white leading-tight">
																{isProgramCardVoucherLine ? selectedCardDisplayLabel : primary}
															</span>
															{!isProgramCardVoucherLine ? (
																<span className="text-[12px] text-gray-400 dark:text-slate-400 font-medium">{secondary}</span>
															) : null}
														</div>
													</div>
													<span className={`text-[15px] font-semibold ${routeAmountClass}`}>{routeAmountText}</span>
												</div>
											)
										})}
										{selectedIsCardTopupKind && selectedTopupBonusFiat > 0 ? (
											<div className="flex justify-between items-center">
												<div className="flex items-center gap-3">
													<div className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10 w-6 h-6 flex items-center justify-center bg-[#FF9500]/15 text-[#FF9500]">
														<Gift size={13} strokeWidth={2.6} />
													</div>
													<div className="flex flex-col">
														<span className="text-[15px] font-semibold text-black dark:text-white leading-tight">Bonus</span>
													</div>
												</div>
												<span className="text-[15px] font-semibold text-[#FF9500]">
													{formatTopupBonusSubtitleAmount(selectedTopupBonusFiat, selectedTx.currencyCode)}
												</span>
											</div>
										) : null}
										{selectedIsMerchantChargeKind && selectedChargeTipFiat > 0 ? (
											<div className="flex justify-between items-center">
												<div className="flex items-center gap-3">
													<div className="rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10 w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
														<Coins size={13} strokeWidth={2.4} />
													</div>
													<div className="flex flex-col">
														<span className="text-[15px] font-semibold text-black dark:text-white leading-tight">Tip</span>
													</div>
												</div>
												<span className="text-[15px] font-semibold text-black dark:text-white">
													{formatMerchantChargeListAmountNegative(selectedChargeTipFiat, selectedChargeTipCurrencyCode)}
												</span>
											</div>
										) : null}
										<div className="border-t border-dashed border-gray-200 dark:border-slate-600 mt-4 pt-4 flex justify-between items-center">
											<span className="text-[13px] font-medium text-gray-400 dark:text-slate-500 pl-9">
												{selectedIsProgramCardLedgerKind ? 'Total' : 'Total Paid'}
											</span>
											<span className={`text-[16px] font-bold ${
												selectedIsCardTopupKind ? 'text-[#34C759]' : 'text-black dark:text-white'
											}`}>
												{selectedIsCardTopupKind
													? formatTopupListAmountPositive(selectedTx.amountFiat, selectedTx.currencyCode)
													: selectedIsMerchantChargeKind
														? formatMerchantChargeListAmountNegative(selectedChargeFiatAmount, selectedChargeCurrencyCode)
													: `${(Number(totalUSDC6) / 1e6).toFixed(2)} USDC`}
											</span>
										</div>
										{selectedIsMerchantChargeKind && selectedChargeRewardValue ? (
											<div className="flex justify-between items-center pt-2">
												<span className="text-[13px] font-medium text-gray-400 dark:text-slate-500 pl-9">
													Point
												</span>
												<span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
													{selectedChargeRewardValue}
												</span>
											</div>
										) : null}
									</div>
								</div>
							)
						})()}

						<div className="bg-[#F9FAFB] dark:bg-slate-800/80 rounded-[24px] p-5 space-y-4 mb-8">

							{selectedTx.type === 'internal_transfer' && eoa && aa && (() => {
								const raw = selectedTx.rawTransaction as RawTxRecord | undefined
								const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
								const payeeAddr = (extractAddr(raw?.payee) ?? '').toLowerCase()
								const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
								const aaAddr = (aa ?? '').toLowerCase()
								// 与 TxItemRow internalTitle 一致：EOA→AA 显示 Main Wallet → Express Pay，AA→EOA 显示 Express Pay → Main Wallet
								const label = payeeAddr === eoaAddr ? 'Express Pay → Main Wallet' : payeeAddr === aaAddr ? 'Main Wallet → Express Pay' : 'Internal Transfer'
								return (
									<div className="flex justify-between items-center text-[14px]">
										<span className="text-gray-500 dark:text-slate-400 font-medium">Transaction Type</span>
										<span className="font-semibold text-black dark:text-white">{label}</span>
									</div>
								)
							})()}
							{selectedTx.type !== 'internal_transfer' && !(getOriginalPaymentHash(selectedTx) && (getStatus(selectedTx) === 'Waiting' || getStatus(selectedTx) === 'Expired' || getStatus(selectedTx) === 'Canceled' || canceledHashes.has(getOriginalPaymentHash(selectedTx)))) && (
							selectedIsProgramCardLedgerKind ? (
								<>
									<div className="flex justify-between items-center text-[14px]">
										<span className="text-gray-500 dark:text-slate-400 font-medium">Program Card</span>
										<span className="flex min-w-0 items-center justify-end gap-1.5 font-semibold text-black dark:text-white">
											{selectedCardAddress ? (
												<MyBrandCardAddressCapsule address={selectedCardAddress} className="max-w-[112px]" />
											) : null}
											<span className="max-w-[150px] truncate text-right">
												{selectedCardMetadataName || selectedCardName || selectedProgramCardDetailTitle || '—'}
											</span>
										</span>
									</div>
									<div className="flex justify-between items-center text-[14px]">
										<span className="text-gray-500 dark:text-slate-400 font-medium">
											{selectedIsMerchantChargeKind ? 'Payment Channel' : 'Payment Method'}
										</span>
										<span className="font-semibold text-black dark:text-white">
											{selectedIsMerchantChargeKind
												? selectedChargeChannelLabel || '—'
												: selectedTopupPaymentLeg || '—'}
										</span>
									</div>
									{selectedPaidToLabel ? (
										<div className="flex justify-between items-center text-[14px]">
											<span className="text-gray-500 dark:text-slate-400 font-medium">Merchant</span>
											<span className="font-semibold text-black dark:text-white flex items-center gap-1.5">
												{selectedMerchantPayeeAddress && ethers.isAddress(selectedMerchantPayeeAddress) && (
													<button
														type="button"
														onClick={() => {
															const addr = selectedMerchantPayeeAddress
															if (!addr || !ethers.isAddress(addr)) return
															const cached = beamioUsers?.find((u: searchResult) => (u?.address || '').toLowerCase() === addr.toLowerCase())
															const item = buildSearchResultFromAddress(addr, cached)
															setChatHomeItem(item)
															setSelectedTx(null)
															setShowFullDrawer(false)
															navigate('/Chat')
														}}
														className="p-1 rounded-full active:scale-95 transition-transform"
													>
														<MessageCircle size={14} className="text-gray-400 dark:text-slate-500" />
													</button>
												)}
												{selectedPaidToLabel}
											</span>
										</div>
									) : null}
								</>
							) : (
							<div className="flex justify-between items-center text-[14px]">
								<span className="text-gray-500 dark:text-slate-400 font-medium">
									{selectedTx.type === 'fuel_yield' ? 'Source' : selectedTx.isInbound ? 'Received From' : getOriginalPaymentHash(selectedTx) ? 'Paid To' : 'Send To'}
								</span>
								<span className="font-semibold text-black dark:text-white flex items-center gap-1.5">
									{selectedTx.type === 'fuel_yield' ? 'USDC Top-up' : detailTitleText}
									{selectedTx.type !== 'fuel_yield' && selectedTx.counterpartyAddress && ethers.isAddress(selectedTx.counterpartyAddress) && (
										<button
											type="button"
											onClick={() => {
												const addr = selectedTx.counterpartyAddress
												if (!addr || !ethers.isAddress(addr)) return
												const cached = beamioUsers?.find((u: searchResult) => (u?.address || '').toLowerCase() === addr.toLowerCase())
												const item = buildSearchResultFromAddress(addr, cached)
												setChatHomeItem(item)
												setSelectedTx(null)
												setShowFullDrawer(false)
												navigate('/Chat')
											}}
											className="p-1 rounded-full active:scale-95 transition-transform"
										>
											<MessageCircle size={14} className="text-gray-400 dark:text-slate-500" />
										</button>
									)}
								</span>
							</div>
							)
							)}
							{selectedTx.type !== 'fuel_yield' && selectedTx.currencyCode !== 'USDC' && Math.abs(selectedTx.amountFiat) > 0 && selectedTx.amountUSDC !== 0 && !(selectedIsCardTopupKind && !selectedTopupIsUsdcPayment) && (
							<div className="flex justify-between items-center text-[14px]">
								<span className="text-gray-500 dark:text-slate-400 font-medium">Exchange Rate</span>
								<span className="font-semibold text-black dark:text-white text-right">
									{selectedIsCardTopupKind ? (
										<span className="flex flex-col items-end leading-tight gap-1">
											<span>{`1 ${selectedTx.currencyCode} = 1 ${selectedIsUpgradeNewCard ? selectedMergedUnitLabel : selectedCardUnitLabel}`}</span>
											<span>{`1 ${selectedTx.currencyCode} ≈ ${(selectedCardTopupUSDCAmount / Math.abs(selectedTx.amountFiat)).toFixed(2)} USDC`}</span>
										</span>
									) : (
										`1 ${selectedTx.currencyCode} ≈ ${(Math.abs(selectedTx.amountUSDC) / Math.abs(selectedTx.amountFiat)).toFixed(4)} USDC`
									)}
								</span>
							</div>
							)}
						</div>

						<div className="space-y-3 mb-8">
							{(() => {
								const baseScanTxHash = resolveTxViewBaseScanTxHash(selectedTx)
								return (
									<>
							<h4 className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-2">
								{baseScanTxHash ? 'Settlement Proof' : 'Creation Proof'}
							</h4>
							{baseScanTxHash ? (
								<button
									type="button"
									onClick={() => openExternalUrl(`https://basescan.org/tx/${baseScanTxHash}`)}
									className="flex w-full items-center justify-between p-3.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-[16px] shadow-sm active:bg-gray-50 dark:active:bg-slate-700 transition-colors cursor-pointer text-left"
								>
									<div className="flex items-center gap-2.5">
										<div className="w-2.5 h-2.5 bg-[#1562f0] rounded-full shadow-[0_0_8px_rgba(21,98,240,0.5)]" />
										<span className="text-[13px] font-semibold text-gray-700 dark:text-slate-300">Base L2 (Value)</span>
									</div>
									<div className="flex items-center gap-2 text-[12px] font-mono text-[#1562f0]">
										{baseScanTxHash.substring(0, 7)}...{baseScanTxHash.slice(-5)} <ExternalLink size={12} />
									</div>
								</button>
							) : (
								<div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-[16px] border-dashed opacity-70">
									<div className="flex items-center gap-2.5">
										<div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
										<span className="text-[13px] font-semibold text-gray-500 dark:text-slate-400">Base L2 (Pending)</span>
									</div>
									<span className="text-[11px] font-medium text-gray-400">Awaiting Payment</span>
								</div>
							)}
									</>
								)
							})()}
						</div>

						<div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										setShowJson(!showJson)
										setCopiedRawData(false)
									}}
									className="flex-1 py-3 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-[16px] text-[13px] font-semibold flex items-center justify-center gap-2 active:bg-gray-50 dark:active:bg-slate-700 transition-colors"
								>
									<Code size={16} /> {showJson ? 'Hide Raw Data' : 'View Smart Receipt'}
								</button>
								{showJson && (
									<button
										type="button"
										disabled={fullTxLoading || !selectedTx}
										onClick={async () => {
											if (!selectedTx || fullTxLoading) return
											const payload = buildSmartReceiptIndexerRowJson(selectedTx, fullTransactionFromChain)
											try {
												await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
												setCopiedRawData(true)
												setTimeout(() => setCopiedRawData(false), 2000)
											} catch {}
										}}
										aria-label="Copy raw data"
										className="flex-shrink-0 w-11 h-11 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-[16px] flex items-center justify-center active:bg-gray-50 dark:active:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{copiedRawData ? (
											<Check size={16} className="text-emerald-500" />
										) : (
											<Copy size={16} />
										)}
									</button>
								)}
							</div>
							{showJson && (
								<div className="mt-4">
									{fullTxLoading ? (
										<div className="flex items-center justify-center gap-2 rounded-[16px] border border-[#d4d4d4] bg-white py-8 text-[#0451a5] shadow-inner dark:border-[#3c3c3c] dark:bg-[#1e1e1e] dark:text-[#9cdcfe]">
											<Loader size={20} className="animate-spin" />
											<span className="text-[13px] font-medium">Loading full Transaction...</span>
										</div>
									) : (
										<VscodeJsonBlock data={buildSmartReceiptIndexerRowJson(selectedTx, fullTransactionFromChain)} />
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>

		{/* Gift Card 全屏展示 */}
		{showGiftCard && selectedTx?.card?.image && (
			<ShowCard
				card={{
					title: selectedTx.card.title ?? 'Gift Card',
					detail: selectedTx.card.detail ?? '',
					image: selectedTx.card.image,
					currency: selectedTx.currencyCode as ICurrency,
					currencyAmount: formatAmount(Math.abs(selectedTx.amountFiat), selectedTx.currencyCode as ICurrency),
				}}
				address={selectedTx.counterpartyAddress ?? ''}
				usdcAmount={formatAmount(Math.abs(selectedTx.amountFiat), selectedTx.currencyCode as ICurrency)}
				cancel={() => setShowGiftCard(false)}
			/>
		)}

		{/* Show QR - Vouchers URL 展示弹窗 */}
		{showVouchersQRSheet && selectedTx && (() => {
			const vouchersUrl = buildVouchersUrl(selectedTx)
			if (!vouchersUrl) return null
			const onCopy = async () => {
				try {
					await navigator.clipboard.writeText(vouchersUrl)
					setCopiedForQR(true)
					setTimeout(() => setCopiedForQR(false), 3000)
				} catch {}
			}
			return (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					onClick={() => setShowVouchersQRSheet(false)}
				>
					<div
						className="relative w-full max-w-[380px] rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							onClick={() => setShowVouchersQRSheet(false)}
							className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition"
							aria-label="Close"
						>
							<X className="w-5 h-5" />
						</button>
						<div className="text-center mb-4">
							<h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Payment QR</h3>
						</div>
						<div className="relative isolate flex justify-center">
							{/* glow：强制放到最底层 */}
							<div
								aria-hidden
								className="
									absolute inset-[-8px] sm:inset-[-12px]
									-z-10
									rounded-[28px] sm:rounded-[36px]
									bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.18),rgba(132,120,255,0.05)_60%,transparent_75%)]
									blur-xl
									pointer-events-none
								"
							/>
							{/* QR 白底板 */}
							<div className="relative z-10 flex justify-center">
								<div
									className="
									rounded-[20px] sm:rounded-[28px]
									bg-white
									p-2 sm:p-[18px]
									shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
									"
								>
									<QRCodeCanvas
										value={vouchersUrl}
										size={220}
										level="H"
										includeMargin={false}
										bgColor="white"
										fgColor="#000000"
										imageSettings={{
											src: bIcon,
											height: 70,
											width: 70,
											excavate: true,
										}}
										className="block"
									/>
								</div>
							</div>
						</div>
						<div className="mt-4">
							<button
								type="button"
								onClick={onCopy}
								className={[
									"mt-2 w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2",
									"bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100",
									"hover:bg-slate-300 dark:hover:bg-slate-500 active:scale-[0.98] transition",
								].join(" ")}
							>
								{copiedForQR ? (
									<><Check className="w-4 h-4" /> Copied</>
								) : (
									<><Copy className="w-4 h-4" /> Copy URL</>
								)}
							</button>
						</div>
					</div>
				</div>
			)
		})()}
	</>
	)
}

export default ActiveHistoryPannelNew
