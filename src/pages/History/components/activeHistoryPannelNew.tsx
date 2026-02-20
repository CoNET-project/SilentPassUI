import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ethers } from 'ethers'
import {
	ArrowUpRight,
	ArrowDownLeft,
	CreditCard,
	QrCode,
	X,
	XCircle,
	ArrowRightLeft,
	Ticket,
	Loader,
	RefreshCw,
	Fuel,
	Wallet,
	Copy,
	ExternalLink,
	Code,
	Share2,
	Clock,
	Ban,
	CheckCircle2,
	Coins,
	MessageCircle,
	ChevronRight,
	ChevronLeft,
} from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { searchUsername } from '@/services/beamio'
import { conetDepinProvider } from '@/utils/constants'
import contracts from '@/utils/contracts'
import { formatAmount, getDecimals } from '@/services/currency'
import { CAPSULE_BTN_CLASS } from '@/utils/uiCommon'

const BEAMIO_INDEXER = contracts.BeamioDiamond?.address ?? '0x0DBDF27E71f9c89353bC5e4dC27c9C5dAe0cc612'

/** Indexer 合约 ABI：列表查询 + 完整 Transaction 查询（含 payer/payee/route） */
const INDEXER_ABI = [
	'function getAccountTransactionsByMonthOffsetPaged(address account, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, (bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists)[] page)',
	'function getTransactionFullByTxId(bytes32 txId) view returns ((bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (address asset, uint256 amountE6, uint8 assetType, uint8 source, uint256 tokenId, uint8 itemCurrencyType, uint256 offsetInRequestCurrencyE6)[] route, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta))',
] as const

/** txCategory 预设 hash（与 readme 一致） */
const TX_TRANSFER_OUT = ethers.keccak256(ethers.toUtf8Bytes('transfer_out:confirmed'))
const TX_TRANSFER_IN = ethers.keccak256(ethers.toUtf8Bytes('transfer_in:confirmed'))
const TX_MERCHANT_PAY = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:confirmed'))
const TX_REQUEST_FULFILLED = ethers.keccak256(ethers.toUtf8Bytes('request_fulfilled:confirmed'))
const TX_REQUEST_CREATE = ethers.keccak256(ethers.toUtf8Bytes('request_create:confirmed'))
const TX_REQUEST_EXPIRED = ethers.keccak256(ethers.toUtf8Bytes('request_expired:confirmed'))
const TX_TOPUP = ethers.keccak256(ethers.toUtf8Bytes('topup:confirmed'))
const TX_INTERNAL = ethers.keccak256(ethers.toUtf8Bytes('internal_transfer:confirmed'))
const TX_VOUCHER_BURN = ethers.keccak256(ethers.toUtf8Bytes('voucher_burn:confirmed'))

type TxDisplayType =
	| 'merchant_pay'
	| 'transfer_in'
	| 'transfer_out'
	| 'request_fulfilled'
	| 'request_create'
	| 'request_expired'
	| 'topup'
	| 'internal_transfer'
	| 'voucher_burn'
	| 'unknown'

function txCategoryToType(txCategory: string): TxDisplayType {
	const cat = txCategory.toLowerCase()
	if (cat === TX_TRANSFER_OUT.toLowerCase()) return 'transfer_out'
	if (cat === TX_TRANSFER_IN.toLowerCase()) return 'transfer_in'
	if (cat === TX_MERCHANT_PAY.toLowerCase()) return 'merchant_pay'
	if (cat === TX_REQUEST_FULFILLED.toLowerCase()) return 'request_fulfilled'
	if (cat === TX_REQUEST_CREATE.toLowerCase()) return 'request_create'
	if (cat === TX_REQUEST_EXPIRED.toLowerCase()) return 'request_expired'
	if (cat === TX_TOPUP.toLowerCase()) return 'topup'
	if (cat === TX_INTERNAL.toLowerCase()) return 'internal_transfer'
	if (cat === TX_VOUCHER_BURN.toLowerCase()) return 'voucher_burn'
	return 'unknown'
}

/** BeamioCurrency.CurrencyType (uint8) -> 币种代码，来自 TransactionMeta.currencyFiat */
const CURRENCY_FIAT_MAP = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const
const currencyFiatToCode = (n: number | undefined): string => CURRENCY_FIAT_MAP[n as number] ?? 'USD'

function formatTime(ts: bigint): string {
	const ms = Number(ts) < 10_000_000_000 ? Number(ts) * 1000 : Number(ts)
	const d = new Date(ms)
	if (!isFinite(d.getTime())) return ''
	return d.toLocaleString(undefined, {
		month: 'short',
		day: '2-digit',
		hour: 'numeric',
		minute: '2-digit',
	})
}

interface TxView {
	id: string
	type: TxDisplayType
	title: string
	handle: string
	timestamp: string
	timestampMs: number
	amountUSDC: number
	/** 法币金额（来自 finalRequestAmountFiat6/1e6），用于按 meta.currencyFiat 展示 */
	amountFiat: number
	/** TransactionMeta.currencyFiat 币种代码（CAD/USD/JPY 等） */
	currencyCode: string
	isInbound: boolean
	isAA: boolean
	txHash: string
	/** 对方地址：Sent 时为 payee，Received 时为 payer */
	counterpartyAddress?: string
	/** 合约原始 Transaction 数据（用于 Smart Receipt 展示） */
	rawTransaction?: RawTxRecord
}

/** 按币种格式化带符号金额，使用 meta.currencyFiat 对应的小数位 */
function formatCurrencySigned(amount: number, currencyCode: string) {
	const amt = Math.abs(amount)
	const decimals = getDecimals(currencyCode as 'CAD'|'USD'|'JPY'|'CNY'|'USDC'|'HKD'|'EUR'|'SGD'|'TWD')
	const formatted = amt.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
	if (amount > 0) return `+ ${formatted} ${currencyCode}`
	if (amount < 0) return `- ${formatted} ${currencyCode}`
	return `0.00 ${currencyCode}`
}

function parseDisplayJson(displayJson: string): { title: string; handle: string } {
	try {
		const j = JSON.parse(displayJson || '{}')
		return {
			title: j.title ?? 'Transaction',
			handle: j.handle ?? j.note ?? '',
		}
	} catch {
		return { title: 'Transaction', handle: displayJson?.slice(0, 40) ?? '' }
	}
}

/** 合约 Transaction 完整结构（与 readme 一致，不含 route 因当前 ABI 未返回） */
interface RawTxRecord {
	id: string | ethers.BytesLike
	originalPaymentHash?: string | ethers.BytesLike
	chainId?: bigint
	txCategory?: string
	displayJson?: string
	timestamp?: bigint
	payer?: string
	payee?: string
	finalRequestAmountFiat6?: bigint
	finalRequestAmountUSDC6?: bigint
	isAAAccount?: boolean
	fees?: {
		gasChainType?: number
		gasWei?: bigint
		gasUSDC6?: bigint
		serviceUSDC6?: bigint
		bServiceUSDC6?: bigint
		bServiceUnits6?: bigint
		feePayer?: string
	}
	meta?: {
		requestAmountFiat6?: bigint
		requestAmountUSDC6?: bigint
		currencyFiat?: number
		discountAmountFiat6?: bigint
		discountRateBps?: number
		taxAmountFiat6?: bigint
		taxRateBps?: number
		afterNotePayer?: string
		afterNotePayee?: string
	}
	exists?: boolean
}

const FEE_INFO_KEYS = ['gasChainType', 'gasWei', 'gasUSDC6', 'serviceUSDC6', 'bServiceUSDC6', 'bServiceUnits6', 'feePayer'] as const
const META_KEYS = ['requestAmountFiat6', 'requestAmountUSDC6', 'currencyFiat', 'discountAmountFiat6', 'discountRateBps', 'taxAmountFiat6', 'taxRateBps', 'afterNotePayer', 'afterNotePayee'] as const
const ROUTE_ITEM_KEYS = ['asset', 'amountE6', 'assetType', 'source', 'tokenId', 'itemCurrencyType', 'offsetInRequestCurrencyE6'] as const

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

/** 通过地址获取对方 firstname+lastname 与 @beamioTag，用于 EOA Sent 展示；优先使用 beamioUsers 缓存 */
function useCounterpartyProfile(address: string | undefined) {
	const { beamioUsers, setbBeamioUsers } = useDaemonContext()
	const [fullName, setFullName] = useState('')
	const [beamioTag, setBeamioTag] = useState<string | null>(null)
	const findingRef = useRef(false)

	useEffect(() => {
		if (!address || !ethers.isAddress(address)) return
		const addr = address.toLowerCase()

		// 已有数据则不再执行 find
		if (fullName || beamioTag) return

		// 优先从 beamioUsers 缓存读取（与 Chat 一致）
		const cached = beamioUsers?.find((n) => (n?.address || '').toLowerCase() === addr)
		if (cached) {
			const { fullName: fn, beamioTag: bt } = parsePeerToDisplay(cached)
			setFullName(fn)
			setBeamioTag(bt)
			return
		}

		
		const find = async () => {
			if (findingRef.current|| beamioTag|| fullName) return
			findingRef.current = true
			try {
				const res = await searchUsername(addr)
				
				const peer: searchResult | null = res?.results?.[0]
				if (!peer) return
				const { fullName: fn, beamioTag: bt } = parsePeerToDisplay(peer)
				
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
		find()
		
	}, [address, beamioUsers, setbBeamioUsers, fullName, beamioTag])

	return { fullName, beamioTag }
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
}

const ActiveHistoryPannelNew = ({
	title = 'Indexer History',
	overrideAddress,
	compact = false,
	compactLimit = 5,
	embeddedInDrawer = false,
	bare = false,
}: ActiveHistoryPannelNewProps) => {
	const { profiles, myAddress, setShowFooter, setChatHomeItem, beamioUsers } = useDaemonContext()
	const navigate = useNavigate()
	const [items, setItems] = useState<TxView[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<'All' | 'Cash' | 'Vouchers'>('All')
	const [selectedTx, setSelectedTx] = useState<TxView | null>(null)
	const [showJson, setShowJson] = useState(false)
	const [fullTransactionFromChain, setFullTransactionFromChain] = useState<Record<string, unknown> | null>(null)
	const [fullTxLoading, setFullTxLoading] = useState(false)
	const [showFullDrawer, setShowFullDrawer] = useState(false)
	const { opacity: backBtnOpacity, onScroll: onAllActivityScroll, setRef: setAllActivityScrollRef } = useScrollCapsuleOpacity(compact && showFullDrawer)

	const eoa = profiles?.[0]?.keyID?.trim()
	const aa = profiles?.[0]?.aaAccount?.trim()

	// Detail Sheet 与 list 使用同一套 title 逻辑（Sent to / Received from；内部转账用固定文案）
	const selectedTxNeedsCounterparty = selectedTx && !selectedTx.isAA && selectedTx.type !== 'internal_transfer'
	const { fullName: detailFullName, beamioTag: detailBeamioTag } = useCounterpartyProfile(
		selectedTxNeedsCounterparty ? selectedTx!.counterpartyAddress : undefined
	)
	const handleIsJson = (s: string | undefined) => !s || /^[\s]*\{/.test(s) || /"currency"/.test(s)
	const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
	const detailTitleText = selectedTx
		? (() => {
				if (selectedTx.type === 'internal_transfer' && eoa && aa) {
					const rawTx = selectedTx.rawTransaction as RawTxRecord | undefined
					const payeeAddr = (extractAddr(rawTx?.payee) ?? '').toLowerCase()
					const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
					const aaAddr = aa.toLowerCase()
					// 与 TxItemRow 的 internalTitle 一致：payee 决定资金流向
					return payeeAddr === eoaAddr ? 'Withdraw to Main' : payeeAddr === aaAddr ? 'Add to Express Pay' : 'Internal Transfer'
				}
				const isEoaSent = !selectedTx.isAA && !selectedTx.isInbound
				const isEoaReceived = !selectedTx.isAA && selectedTx.isInbound
				if (isEoaSent || isEoaReceived) {
					const safeHandle = handleIsJson(selectedTx.handle) ? '' : (selectedTx.handle ?? '')
					const shortAddr =
						selectedTx.counterpartyAddress && selectedTx.counterpartyAddress.length >= 10
							? `${selectedTx.counterpartyAddress.slice(0, 6)}…${selectedTx.counterpartyAddress.slice(-4)}`
							: ''
					const counterpartyLabel = detailFullName || detailBeamioTag || safeHandle || shortAddr || 'Unknown'
					return isEoaSent ? `Sent to ${counterpartyLabel}` : `Received from ${counterpartyLabel}`
				}
				return selectedTx.title
		  })()
		: ''

	const load = useCallback(async () => {
		const accounts: string[] = []
		if (overrideAddress && ethers.isAddress(overrideAddress)) {
			accounts.push(ethers.getAddress(overrideAddress))
		} else {
			if (eoa && ethers.isAddress(eoa)) accounts.push(ethers.getAddress(eoa))
			if (aa && ethers.isAddress(aa) && aa.toLowerCase() !== eoa?.toLowerCase())
				accounts.push(ethers.getAddress(aa))
			// profiles 无有效地址时，回退到 myAddress
			if (accounts.length === 0 && myAddress && ethers.isAddress(myAddress))
				accounts.push(ethers.getAddress(myAddress))
		}

		if (accounts.length === 0) {
			setItems([])
			setLoading(false)
			return
		}

		setLoading(true)
		setError(null)
		try {
			const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
			const TX_FILTER = ethers.ZeroHash

			const results = await Promise.all(
				accounts.map((account) =>
					indexer.getAccountTransactionsByMonthOffsetPaged(
						account,
						0, // periodOffset: 0 = 本月
						0, // pageOffset
						20, // pageLimit
						TX_FILTER
					)
				)
			)

			const seen = new Set<string>()
			const merged: TxView[] = []

			for (const res of results) {
				const [, , , page] = res as [bigint, bigint, bigint, RawTxRecord[]]
				const list = Array.isArray(page) ? page : []
				for (const tx of list) {
					if (!tx?.exists) continue
					const id = typeof tx.id === 'string' ? tx.id : tx.id != null ? ethers.hexlify(tx.id as ethers.BytesLike) : ethers.ZeroHash
					if (seen.has(id)) continue
					seen.add(id)

					const type = txCategoryToType(tx.txCategory ?? '')
					const { title, handle } = parseDisplayJson(tx.displayJson ?? '')
					const amountUSDC = Number(ethers.formatUnits(tx.finalRequestAmountUSDC6 ?? 0n, 6))
					const metaRaw = (tx as RawTxRecord).meta
					// finalRequestAmountFiat6 = requestAmountFiat6 - discountAmountFiat6 + taxAmountFiat6（readme 7.2）
					const req = metaRaw && typeof metaRaw === 'object'
						? (Array.isArray(metaRaw)
							? { requestAmountFiat6: metaRaw[0] ?? 0n, discountAmountFiat6: metaRaw[3] ?? 0n, taxAmountFiat6: metaRaw[5] ?? 0n }
							: { requestAmountFiat6: (metaRaw as RawTxRecord['meta'])?.requestAmountFiat6 ?? 0n, discountAmountFiat6: (metaRaw as RawTxRecord['meta'])?.discountAmountFiat6 ?? 0n, taxAmountFiat6: (metaRaw as RawTxRecord['meta'])?.taxAmountFiat6 ?? 0n })
						: null
					const amountFiat6 = req
						? req.requestAmountFiat6 - req.discountAmountFiat6 + req.taxAmountFiat6
						: (tx.finalRequestAmountFiat6 ?? (metaRaw as RawTxRecord['meta'])?.requestAmountFiat6 ?? 0n)
					const amountFiat = Number(amountFiat6) / 1e6
					const currencyFiatNum = (metaRaw && typeof metaRaw === 'object' && 'currencyFiat' in metaRaw)
						? (metaRaw as { currencyFiat?: number }).currencyFiat
						: (Array.isArray(metaRaw) ? metaRaw[2] : (metaRaw as Record<number, unknown>)?.[2])
					const currencyCode = currencyFiatToCode(Number(currencyFiatNum ?? 1))
					const amPayee = accounts.some((a) => a.toLowerCase() === (tx.payee ?? '').toLowerCase())
					const isInbound = amPayee
					const tsRaw = tx.timestamp ?? 0n
					const tsMs = Number(tsRaw) < 10_000_000_000 ? Number(tsRaw) * 1000 : Number(tsRaw)

					const counterparty = amPayee ? (tx.payer ?? '') : (tx.payee ?? '')
					const payerAddr = (tx.payer ?? '').toLowerCase()
					const payeeAddr = (tx.payee ?? '').toLowerCase()
					const isEoaAaInternal =
						accounts.length >= 2 &&
						accounts.some((a) => a.toLowerCase() === payerAddr) &&
						accounts.some((a) => a.toLowerCase() === payeeAddr) &&
						payerAddr !== payeeAddr
					const resolvedType = isEoaAaInternal ? 'internal_transfer' : type
					merged.push({
						id,
						type: resolvedType,
						title: title ?? 'Transaction',
						handle: handle ?? '',
						timestamp: formatTime(tsRaw),
						timestampMs: tsMs,
						amountUSDC,
						amountFiat,
						currencyCode,
						isInbound,
						isAA: !!tx.isAAAccount,
						txHash: id.startsWith('0x') && id.length === 66 ? id : '',
						counterpartyAddress: counterparty || undefined,
						rawTransaction: tx as RawTxRecord,
					})
				}
			}

			merged.sort((a, b) => b.timestampMs - a.timestampMs)
			setItems(merged.slice(0, 20))
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			setError(msg)
			setItems([])
		} finally {
			setLoading(false)
		}
	}, [eoa, aa, overrideAddress, myAddress])

	useEffect(() => {
		load()
	}, [load])

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
		if (!selectedTx) setFullTransactionFromChain(null)
	}, [selectedTx])

	// 点击 View Smart Receipt 时，若有 txHash 则调用 getTransactionFullByTxId 获取完整 Transaction（含 payer/payee/route）
	useEffect(() => {
		if (!showJson || !selectedTx?.txHash) {
			if (!showJson) setFullTxLoading(false)
			return
		}
		setFullTxLoading(true)
		setFullTransactionFromChain(null)
		const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
		indexer
			.getTransactionFullByTxId(ethers.hexlify(ethers.getBytes(selectedTx.txHash)))
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
				// ethers 可能返回数组 [id,originalPaymentHash,...,payer,payee,...,route,fees,meta]，映射为具名字段
				const keys = ['id','originalPaymentHash','chainId','txCategory','displayJson','timestamp','payer','payee','finalRequestAmountFiat6','finalRequestAmountUSDC6','isAAAccount','route','fees','meta']
				const arr = Array.isArray(full) ? full : (full as Record<string, unknown>)
				const raw: Record<string, unknown> = {}
				if (Array.isArray(arr) && arr.length >= 14) {
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
	}, [showJson, selectedTx?.txHash])

	const filteredItems = items.filter((tx) => {
		if (activeTab === 'All') return true
		if (activeTab === 'Cash') return !tx.isAA
		if (activeTab === 'Vouchers') return tx.isAA
		return true
	})

	const displayItems = compact ? filteredItems.slice(0, compactLimit) : filteredItems

	/** internal_transfer 方向：按图示 - Withdraw to Main Wallet 用平行双向箭头，Add to Express Pay 用钱包图标 */
	const iconForInternalTransfer = (tx: TxView, size: number) => {
		const rawTx = tx.rawTransaction as RawTxRecord | undefined
		const payeeAddr = (extractAddr(rawTx?.payee) ?? '').toLowerCase()
		const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
		const aaAddr = (aa ?? '').toLowerCase()
		// Withdraw to Main Wallet (AA→EOA): 平行双向箭头
		if (payeeAddr === eoaAddr) return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
		// Add to Express Pay (EOA→AA): 钱包图标
		if (payeeAddr === aaAddr) return <Wallet size={size} strokeWidth={2} />
		return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
	}

	const iconForType = (type: TxDisplayType, size = 22, tx?: TxView) => {
		switch (type) {
			case 'merchant_pay':
				return <CreditCard size={size} strokeWidth={2} />
			case 'transfer_in':
			case 'request_fulfilled':
				return <ArrowDownLeft size={size} strokeWidth={2} />
			case 'transfer_out':
				return <ArrowUpRight size={size} strokeWidth={2} />
			case 'request_create':
				return <QrCode size={size} strokeWidth={2} />
			case 'request_expired':
				return <XCircle size={size} strokeWidth={2} />
			case 'topup':
				return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
			case 'internal_transfer':
				return tx && eoa && aa ? iconForInternalTransfer(tx, size) : <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
			case 'voucher_burn':
				return <Ticket size={size} strokeWidth={2} />
			default:
				return <ArrowRightLeft size={size === 22 ? 20 : size} strokeWidth={2} />
		}
	}

	const colorForType = (type: TxDisplayType) => {
		switch (type) {
			case 'merchant_pay':
				return 'bg-[#1562f0]/10 text-[#1562f0]'
			case 'transfer_in':
			case 'request_fulfilled':
				return 'bg-[#34C759]/10 text-[#34C759]'
			case 'transfer_out':
				return 'bg-gray-100 text-black dark:bg-slate-700 dark:text-white'
			case 'request_create':
				return 'bg-[#FF9500]/10 text-[#FF9500]'
			case 'request_expired':
				return 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-400'
			case 'topup':
			case 'internal_transfer':
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
			case 'voucher_burn':
				return 'bg-[#AF52DE]/10 text-[#AF52DE]'
			default:
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
		}
	}

	const colorForTypeSolid = (type: TxDisplayType) => {
		switch (type) {
			case 'merchant_pay':
				return 'bg-[#1562f0] text-white shadow-blue-200'
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
			case 'internal_transfer':
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
			case 'voucher_burn':
				return 'bg-[#AF52DE] text-white'
			default:
				return 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
		}
	}

	const getStatus = (tx: TxView) => {
		if (tx.type === 'request_create') return 'Waiting'
		if (tx.type === 'request_expired') return 'Expired'
		if (tx.type === 'voucher_burn' && tx.amountUSDC === 0) return 'Redeemed'
		return tx.isInbound ? 'Received' : 'Finalized'
	}

	/** 带符号的法币金额，用于展示（使用 meta.currencyFiat 对应币种） */
	const amountFiatSigned = (tx: TxView) => (tx.isInbound ? tx.amountFiat : -tx.amountFiat)

	function TxItemRow({ tx }: { tx: TxView }) {
		const isInternalTransfer = tx.type === 'internal_transfer'
		const rawTx = tx.rawTransaction as RawTxRecord | undefined
		const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
		const payerAddr = extractAddr(rawTx?.payer) ?? ''
		const payeeAddr = extractAddr(rawTx?.payee) ?? ''
		const eoaAddr = (eoa ?? myAddress ?? '').toLowerCase()
		const aaAddr = (aa ?? '').toLowerCase()

		// payee 决定资金流向：payee=EOA → Withdraw to Main，payee=AA → Add to Express Pay（与 isInbound 无关）
		const internalTitle = isInternalTransfer && eoaAddr && aaAddr
			? (payeeAddr.toLowerCase() === eoaAddr ? 'Withdraw to Main' : payeeAddr.toLowerCase() === aaAddr ? 'Add to Express Pay' : 'Internal Transfer')
			: tx.title

		const isAddToExpressPay = isInternalTransfer && payeeAddr.toLowerCase() === aaAddr
		const isEoaSent = !tx.isAA && !tx.isInbound && !isInternalTransfer
		const isEoaReceived = !tx.isAA && tx.isInbound && !isInternalTransfer
		const needsCounterparty = isEoaSent || isEoaReceived
		const { fullName, beamioTag } = useCounterpartyProfile(needsCounterparty ? tx.counterpartyAddress : undefined)
		const handleIsJson = (s: string | undefined) => !s || /^[\s]*\{/.test(s) || /"currency"/.test(s)
		const safeHandle = handleIsJson(tx.handle) ? '' : tx.handle
		const shortAddr = tx.counterpartyAddress && tx.counterpartyAddress.length >= 10
			? `${tx.counterpartyAddress.slice(0, 6)}…${tx.counterpartyAddress.slice(-4)}`
			: ''
		const counterpartyLabel = fullName || beamioTag || safeHandle || shortAddr || 'Unknown'
		const titleText = isEoaSent
			? `Sent to ${counterpartyLabel}`
			: isEoaReceived
				? `Received from ${counterpartyLabel}`
				: isInternalTransfer
					? internalTitle
					: tx.title
		const subtitleText = isInternalTransfer
			? 'Internal Transfer'
			: isEoaSent || isEoaReceived
				? (fullName ? (beamioTag ?? '') : '')
				: (safeHandle || (tx.isInbound ? 'Received' : 'Sent'))

		const iconBg = isInternalTransfer
			? 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
			: isEoaReceived
				? 'bg-[#34C759]/10 text-[#34C759]'
				: colorForType(tx.type)

		// AA→EOA (Withdraw to Main): 收入，数字显示绿色 +（以 payee=EOA 为准，不受合并顺序影响）
		const isWithdrawToMain = isInternalTransfer && payeeAddr.toLowerCase() === eoaAddr
		// Add to Express Pay (EOA→AA): 负数用黑色，不显示绿色
		const amountIsGreen = !isAddToExpressPay && ((tx.isInbound && tx.amountUSDC > 0) || (isWithdrawToMain && tx.amountUSDC > 0))

		return (
			<div
				role="button"
				tabIndex={0}
				onClick={() => {
					setShowJson(false)
					setSelectedTx(tx)
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						setShowJson(false)
						setSelectedTx(tx)
					}
				}}
				className="relative flex items-center justify-between py-2.5 px-3 bg-white dark:bg-slate-800/80 rounded-[15px] shadow-[0_2px_9px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all duration-200 cursor-pointer border border-gray-100/50 dark:border-slate-700/50"
			>
				<div className="flex items-center gap-3">
					<div
						className={`w-9 h-9 rounded-[10px] flex items-center justify-center shadow-sm shrink-0 ${iconBg}`}
					>
						{isEoaReceived ? <ArrowDownLeft size={16} strokeWidth={2} /> : iconForType(tx.type, 16, tx)}
					</div>
					<div className="flex flex-col gap-0.5 min-w-0">
						<h3
							className={`text-[12px] font-semibold tracking-tight truncate ${
								tx.type === 'request_expired' ? 'text-gray-400 dark:text-slate-500' : 'text-black dark:text-white'
							}`}
						>
							{titleText}
						</h3>
						<div className="flex items-center gap-1 flex-wrap">
							{subtitleText ? (
								<span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium truncate max-w-[105px]">
									{subtitleText}
								</span>
							) : null}
							{tx.type === 'request_fulfilled' && (
								<span className="text-[8px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1 py-0 rounded-[4px]">
									Request
								</span>
							)}
							{tx.type === 'request_create' && (
								<span className="text-[8px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-1 py-0 rounded-[4px]">
									Waiting
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="text-right flex flex-col items-end shrink-0">
					<div
						className={`text-[12px] font-semibold tracking-tight ${
							amountIsGreen ? 'text-[#34C759]' :
							tx.type === 'request_expired' ? 'text-gray-400 dark:text-slate-500' :
							'text-black dark:text-white'
						}`}
					>
						{tx.type === 'request_create' ? (
							<span className="text-[#FF9500]">Pending</span>
						) : tx.type === 'request_expired' ? (
							'Expired'
						) : (
							formatCurrencySigned(
								isWithdrawToMain ? Math.abs(tx.amountFiat) : isAddToExpressPay ? -Math.abs(tx.amountFiat) : amountFiatSigned(tx),
								tx.currencyCode
							)
						)}
					</div>
					{tx.amountUSDC !== 0 && tx.type !== 'request_create' && tx.type !== 'request_expired' && (
						<span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">
							{Math.abs(tx.amountUSDC).toFixed(2)} USDC
						</span>
					)}
				</div>
			</div>
		)
	}

	const useBareStyle = bare || embeddedInDrawer
	const outerClassName = useBareStyle
		? 'overflow-hidden'
		: 'bg-[#F2F2F7] dark:bg-slate-900/80 rounded-[20px] p-4 shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden'

	return (
		<div className={outerClassName}>
			{/* Header - embeddedInDrawer 时隐藏整行（refresh 移至胶囊内） */}
			{!embeddedInDrawer && (
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-[14px] font-bold text-black dark:text-white tracking-tight">{title}</h3>
				<div className="flex items-center gap-2">
					{compact ? (
						<button
							type="button"
							onClick={() => setShowFullDrawer(true)}
							className="flex items-center gap-1 text-[12px] font-semibold text-[#1562f0] hover:text-[#0d47c7] transition-colors"
						>
							View all
							<ChevronRight size={16} strokeWidth={2.5} />
						</button>
					) : (
						<button
							type="button"
							onClick={load}
							disabled={loading}
							className="p-2 rounded-full bg-white dark:bg-slate-700 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
							aria-label="Refresh"
						>
							{loading ? (
								<Loader size={20} className="animate-spin text-[#1562f0]" />
							) : (
								<RefreshCw size={20} className="text-gray-600 dark:text-slate-300" />
							)}
						</button>
					)}
				</div>
			</div>
			)}

			{/* Segmented Control - 隐藏于 compact 模式 */}
			{!compact && (
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
				<div className="mb-2 flex justify-center mt-2">
					<button
						type="button"
						onClick={load}
						disabled={loading}
						className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-700/50 border border-white/40 dark:border-slate-600/50 hover:bg-white/80 dark:hover:bg-slate-700/70 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
						aria-label="Refresh"
					>
						{activeTab === 'Cash' && <Wallet size={12} className="text-[#1562f0]" />}
						{activeTab === 'Vouchers' && <Ticket size={12} className="text-[#1562f0]" />}
						<span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">
							{activeTab === 'Cash' ? 'Main Wallet (USDC)' : activeTab === 'Vouchers' ? 'Express Pay (Assets)' : 'All Accounts'}
						</span>
						{loading ? (
							<Loader size={14} className="animate-spin text-[#1562f0] shrink-0" />
						) : (
							<RefreshCw size={14} className="text-[#1562f0] shrink-0" strokeWidth={2.5} />
						)}
					</button>
				</div>
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
						<TxItemRow key={tx.id} tx={tx} />
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
								const isInternalToEoa = selectedTx.type === 'internal_transfer' && eoa && aa &&
									(extractAddr((selectedTx.rawTransaction as RawTxRecord)?.payee) ?? '').toLowerCase() === (eoa ?? myAddress ?? '').toLowerCase()
								const showGreenArrow = (!selectedTx.isAA && selectedTx.isInbound && selectedTx.type !== 'internal_transfer') || isInternalToEoa
								return (
							<div
								className={`w-[72px] h-[72px] mx-auto rounded-[24px] flex items-center justify-center shadow-lg mb-5 ${
									showGreenArrow ? 'bg-[#34C759] text-white shadow-[0_18px_38px_rgba(52,199,89,0.3)]' : colorForTypeSolid(selectedTx.type)
								}`}
							>
								{showGreenArrow && selectedTx.type !== 'internal_transfer' ? <ArrowDownLeft size={36} strokeWidth={2} /> : iconForType(selectedTx.type, 36, selectedTx)}
							</div>
								)
							})()}
							<h2
								id="tx-detail-title"
								className={`text-[28px] font-bold tracking-tight leading-tight ${
									selectedTx.type === 'request_expired' ? 'text-gray-400 dark:text-slate-500' : 'text-black dark:text-white'
								}`}
							>
								{selectedTx.type === 'request_create' || selectedTx.type === 'request_expired'
									? `Requesting ${formatAmount(Math.abs(selectedTx.amountFiat), selectedTx.currencyCode as ICurrency)} ${selectedTx.currencyCode}`
									: selectedTx.amountUSDC === 0
										? 'Redeemed'
										: (() => {
											const raw = selectedTx.rawTransaction as RawTxRecord | undefined
											const extractAddr = (v: unknown) => typeof v === 'string' ? v : (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')
											const payeeAddr = (extractAddr(raw?.payee) ?? '').toLowerCase()
											const isInternalToEoa = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddr === (eoa ?? myAddress ?? '').toLowerCase()
											const isAddToExpress = selectedTx.type === 'internal_transfer' && eoa && aa && payeeAddr === (aa ?? '').toLowerCase()
											const amt = isInternalToEoa ? Math.abs(selectedTx.amountFiat) : isAddToExpress ? -Math.abs(selectedTx.amountFiat) : amountFiatSigned(selectedTx)
											return formatCurrencySigned(amt, selectedTx.currencyCode)
										})()}
							</h2>
							{selectedTx.type !== 'request_create' && selectedTx.type !== 'request_expired' && (
								<p className="text-[13px] font-medium text-[#1562f0] mt-0.5">
									Settled for {formatAmount(Math.abs(selectedTx.amountUSDC), 'USDC')} USDC
								</p>
							)}
							<p className="text-[15px] font-medium text-gray-500 dark:text-slate-400 mt-1">{selectedTx.timestamp}</p>
							<div
								className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold mt-4 ${
									getStatus(selectedTx) === 'Waiting' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
									getStatus(selectedTx) === 'Expired' ? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400' :
									'bg-[#34C759]/10 text-[#34C759]'
								}`}
							>
								{getStatus(selectedTx) === 'Waiting' && <Clock size={14} />}
								{getStatus(selectedTx) === 'Expired' && <Ban size={14} />}
								{(getStatus(selectedTx) === 'Received' || getStatus(selectedTx) === 'Finalized' || getStatus(selectedTx) === 'Redeemed') && (
									<CheckCircle2 size={14} />
								)}
								{getStatus(selectedTx)}
							</div>
						</div>

						{selectedTx.type !== 'internal_transfer' && (
						<div className="grid grid-cols-2 gap-4 mb-8">
							<button
								type="button"
								className="flex items-center justify-center gap-2 py-4 bg-[#1562f0] text-white rounded-[18px] font-bold text-[16px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
							>
								<Coins size={20} /> Add Tip
							</button>
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
								className="flex items-center justify-center gap-2 py-4 bg-[#F2F2F7] dark:bg-slate-700 text-black dark:text-white rounded-[18px] font-bold text-[16px] active:scale-95 transition-transform"
							>
								<MessageCircle size={20} /> Chat
							</button>
						</div>
						)}

						<div className="bg-[#F9FAFB] dark:bg-slate-800/80 rounded-[24px] p-5 space-y-4 mb-8">
							<div className="flex justify-between items-center text-[14px]">
								<span className="text-gray-500 dark:text-slate-400 font-medium">Recipient</span>
								<span className="font-semibold text-black dark:text-white flex items-center gap-1.5">
									{detailTitleText}
									<Share2 size={14} className="text-gray-400 dark:text-slate-500" />
								</span>
							</div>
							<div className="flex justify-between items-center text-[14px]">
								<span className="text-gray-500 dark:text-slate-400 font-medium">Network Fee</span>
								<span className="flex items-center gap-2">
									<span className="font-bold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded text-[12px]">Sponsored</span>
									{(selectedTx.type === 'internal_transfer' || (!selectedTx.isAA && (selectedTx.type === 'transfer_out' || selectedTx.type === 'transfer_in'))) && (
										<>
											<Fuel size={14} className="text-gray-400 dark:text-slate-500" />
											<span className="font-semibold text-gray-600 dark:text-slate-400">-2</span>
										</>
									)}
								</span>
							</div>
							<div className="flex justify-between items-center text-[14px]">
								<span className="text-gray-500 dark:text-slate-400 font-medium">Beamio Fee</span>
								<span className="font-semibold text-black dark:text-white">$0.00</span>
							</div>
						</div>

						<div className="space-y-3 mb-8">
							<h4 className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 pl-2">
								{selectedTx.txHash ? 'Settlement Proof' : 'Creation Proof'}
							</h4>
							{selectedTx.txHash ? (
								<a
									href={`https://basescan.org/tx/${selectedTx.txHash}`}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-[16px] shadow-sm active:bg-gray-50 dark:active:bg-slate-700 transition-colors cursor-pointer"
								>
									<div className="flex items-center gap-2.5">
										<div className="w-2.5 h-2.5 bg-[#1562f0] rounded-full shadow-[0_0_8px_rgba(21,98,240,0.5)]" />
										<span className="text-[13px] font-semibold text-gray-700 dark:text-slate-300">Base L2 (Value)</span>
									</div>
									<div className="flex items-center gap-2 text-[12px] font-mono text-[#1562f0]">
										{selectedTx.txHash.substring(0, 7)}...{selectedTx.txHash.slice(-5)} <ExternalLink size={12} />
									</div>
								</a>
							) : (
								<div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-[16px] border-dashed opacity-70">
									<div className="flex items-center gap-2.5">
										<div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
										<span className="text-[13px] font-semibold text-gray-500 dark:text-slate-400">Base L2 (Pending)</span>
									</div>
									<span className="text-[11px] font-medium text-gray-400">Awaiting Payment</span>
								</div>
							)}
						</div>

						<div>
							<button
								type="button"
								onClick={() => setShowJson(!showJson)}
								className="w-full py-3 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-[16px] text-[13px] font-semibold flex items-center justify-center gap-2 active:bg-gray-50 dark:active:bg-slate-700 transition-colors"
							>
								<Code size={16} /> {showJson ? 'Hide Raw Data' : 'View Smart Receipt'}
							</button>
							{showJson && (
								<div className="mt-4 bg-[#1C1C1E] rounded-[16px] p-5 overflow-x-auto shadow-inner">
									{fullTxLoading ? (
										<div className="flex items-center justify-center gap-2 py-8 text-[#34C759]">
											<Loader size={20} className="animate-spin" />
											<span className="text-[13px] font-medium">Loading full Transaction...</span>
										</div>
									) : (
										<pre className="text-[11px] text-[#34C759] font-mono leading-relaxed">
											{JSON.stringify(
												toNamedTransactionJson(
													fullTransactionFromChain ??
														(selectedTx.rawTransaction
															? selectedTx.rawTransaction
															: selectedTx)
												),
												null,
												2
											)}
										</pre>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default ActiveHistoryPannelNew
