/**
 * Beamio indexer Recent Activity 合并拉取（无 React / 无 Daemon — 供全局喂料与 History 面板共用）
 */
import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'
import contracts from '@/utils/contracts'

const BEAMIO_INDEXER = contracts.BeamioDiamond?.address ?? '0x0DBDF27E71f9c89353bC5e4dC27c9C5dAe0cc612'

const INDEXER_ABI = [
	'function getAccountTransactionsByMonthOffsetPaged(address account, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, (bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists)[] page)',
] as const

const TX_TRANSFER_OUT = ethers.keccak256(ethers.toUtf8Bytes('transfer_out:confirmed'))
const TX_TRANSFER_IN = ethers.keccak256(ethers.toUtf8Bytes('transfer_in:confirmed'))
const TX_MERCHANT_PAY = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:confirmed'))
const TX_REQUEST_FULFILLED = ethers.keccak256(ethers.toUtf8Bytes('request_fulfilled:confirmed'))
const TX_REQUEST_CREATE = ethers.keccak256(ethers.toUtf8Bytes('request_create:confirmed'))
const TX_REQUEST_EXPIRED = ethers.keccak256(ethers.toUtf8Bytes('request_expired:confirmed'))
const TX_TOPUP = ethers.keccak256(ethers.toUtf8Bytes('topup:confirmed'))
const TX_INTERNAL = ethers.keccak256(ethers.toUtf8Bytes('internal_transfer:confirmed'))
const TX_VOUCHER_BURN = ethers.keccak256(ethers.toUtf8Bytes('voucher_burn:confirmed'))
const TX_REQUEST_CANCEL = ethers.keccak256(ethers.toUtf8Bytes('request_cancel:confirmed'))
const TX_CARDMINT = ethers.keccak256(ethers.toUtf8Bytes('cardmint:confirmed'))
const TX_ISSUE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('iuuseNewCard'))
const TX_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('upgradeNewCard'))
const TX_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('topupCard'))
const TX_BUINT_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('buintClaim'))
const TX_BUINT_USDC = ethers.keccak256(ethers.toUtf8Bytes('buintUSDC'))
const TX_REQUEST_ACCOUNTING = ethers.keccak256(ethers.toUtf8Bytes('requestAccounting'))
const TX_BUINT_BURN = ethers.keccak256(ethers.toUtf8Bytes('buintBurn'))
const TX_BUINT_BURN_KINDS = ['sendUSDC', 'cardTopup', 'issueCard', 'x402Send'].map((n) =>
	ethers.keccak256(ethers.toUtf8Bytes(n))
)
const TX_BUINT_EXCLUDE = new Set(
	[TX_BUINT_CLAIM, TX_REQUEST_ACCOUNTING, TX_BUINT_BURN, ...TX_BUINT_BURN_KINDS].map((h) => h.toLowerCase())
)

export type TxDisplayType =
	| 'merchant_pay'
	| 'transfer_in'
	| 'transfer_out'
	| 'request_fulfilled'
	| 'request_create'
	| 'request_expired'
	| 'topup'
	| 'cardmint'
	| 'internal_transfer'
	| 'voucher_burn'
	| 'request_cancel'
	| 'fuel_yield'
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
	if (cat === TX_CARDMINT.toLowerCase()) return 'cardmint'
	if (cat === TX_INTERNAL.toLowerCase()) return 'internal_transfer'
	if (cat === TX_VOUCHER_BURN.toLowerCase()) return 'voucher_burn'
	if (cat === TX_REQUEST_CANCEL.toLowerCase()) return 'request_cancel'
	if (cat === TX_BUINT_USDC.toLowerCase()) return 'fuel_yield'
	return 'unknown'
}

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

function parseDisplayJson(displayJson: string): {
	title: string
	handle: string
	forText?: string
	card?: { title?: string; detail?: string; image?: string }
} {
	try {
		const j = JSON.parse(displayJson || '{}')
		const forText = typeof j.forText === 'string' ? j.forText.trim() : undefined
		return {
			title: j.title ?? 'Transaction',
			handle: j.handle ?? j.forText ?? j.note ?? '',
			forText: forText || undefined,
			card: j.card,
		}
	} catch {
		return { title: 'Transaction', handle: displayJson?.slice(0, 40) ?? '' }
	}
}

/** RouteItem — 与 activeHistoryPannelNew 一致 */
export type RouteItemRecord = {
	asset?: string
	amountE6?: string
	assetType?: number
	source?: number
	tokenId?: string
	itemCurrencyType?: number
	offsetInRequestCurrencyE6?: string
}

export interface RawTxRecord {
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
	route?: RouteItemRecord[]
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

export interface TxView {
	id: string
	type: TxDisplayType
	title: string
	handle: string
	forText?: string
	timestamp: string
	timestampMs: number
	amountUSDC: number
	amountFiat: number
	currencyCode: string
	isInbound: boolean
	isAA: boolean
	txHash: string
	counterpartyAddress?: string
	rawTransaction?: RawTxRecord
	card?: { title?: string; detail?: string; image?: string }
}

const INDEXER_TIMEOUT_MS = 15_000
/** 多个月并行 eth_call 总超时（CoNET indexer） */
const INDEXER_MULTI_MONTH_TIMEOUT_MS = 45_000

/** 单月每地址最多拉取条数（与 indexer 分页一致） */
const INDEXER_PAGE_LIMIT_PER_MONTH = 30

/**
 * periodOffset 0=当月，1=上月… 多个月合并后按时间取全局最近 N 条，避免仅查当月时 Recent Activity 为空。
 */
const RECENT_ACTIVITY_MONTH_LOOKBACK = 24

export type FetchRecentActivityOptions = {
	/** 全局排序后保留条数（默认 30，Home 紧凑区用 compactLimit 再截 5） */
	maxReturn?: number
	monthLookback?: number
}

function withTimeout<T>(p: Promise<T>, ms: number = INDEXER_TIMEOUT_MS): Promise<T> {
	return Promise.race([
		p,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Indexer RPC timeout')), ms)),
	])
}

function appendIndexerPage(
	list: RawTxRecord[],
	normalized: string[],
	seen: Set<string>,
	merged: TxView[]
): void {
	for (const tx of list) {
		if (!tx?.exists) continue
		const cat = String(tx.txCategory ?? '').toLowerCase()
		if (TX_BUINT_EXCLUDE.has(cat)) continue
		const id =
			typeof tx.id === 'string'
				? tx.id
				: tx.id != null
					? ethers.hexlify(tx.id as ethers.BytesLike)
					: ethers.ZeroHash
		if (seen.has(id)) continue
		seen.add(id)

		const type = txCategoryToType(tx.txCategory ?? '')
		const amPayee = normalized.some((a) => a.toLowerCase() === (tx.payee ?? '').toLowerCase())
		let { title, handle, forText, card } = parseDisplayJson(tx.displayJson ?? '')
		if (String(tx.txCategory ?? '') === TX_BUINT_USDC && amPayee) {
			title = 'Fuel Yield (1:100)'
			handle = 'USDC Top-up'
		}
		const txCategoryLower = String(tx.txCategory ?? '').toLowerCase()
		const isCardTopupLedgerTx =
			txCategoryLower === TX_ISSUE_NEW_CARD.toLowerCase() ||
			txCategoryLower === TX_UPGRADE_NEW_CARD.toLowerCase() ||
			txCategoryLower === TX_TOPUP_CARD.toLowerCase()
		if (isCardTopupLedgerTx) {
			let cardName = ''
			try {
				const j = JSON.parse(tx.displayJson ?? '{}')
				cardName = String(j.cardName ?? '').trim()
			} catch {}
			const baseName = (cardName || title || 'Membership').replace(/\s*card\s*$/i, '').trim() || 'Membership'
			if (txCategoryLower === TX_ISSUE_NEW_CARD.toLowerCase()) {
				title = `Buy ${baseName} Card`
			} else if (txCategoryLower === TX_UPGRADE_NEW_CARD.toLowerCase()) {
				title = `Upgrade to ${baseName} Card`
			} else {
				title = `Reload ${baseName} Card`
			}
		}
		const amountUSDC = Number(ethers.formatUnits(tx.finalRequestAmountUSDC6 ?? 0n, 6))
		const metaRaw = (tx as RawTxRecord).meta
		const req =
			metaRaw && typeof metaRaw === 'object'
				? Array.isArray(metaRaw)
					? {
							requestAmountFiat6: metaRaw[0] ?? 0n,
							discountAmountFiat6: metaRaw[3] ?? 0n,
							taxAmountFiat6: metaRaw[5] ?? 0n,
						}
					: {
							requestAmountFiat6: (metaRaw as RawTxRecord['meta'])?.requestAmountFiat6 ?? 0n,
							discountAmountFiat6: (metaRaw as RawTxRecord['meta'])?.discountAmountFiat6 ?? 0n,
							taxAmountFiat6: (metaRaw as RawTxRecord['meta'])?.taxAmountFiat6 ?? 0n,
						}
				: null
		const amountFiat6 = isCardTopupLedgerTx
			? (tx.finalRequestAmountFiat6 ?? req?.requestAmountFiat6 ?? 0n)
			: req
				? req.requestAmountFiat6 - req.discountAmountFiat6 + req.taxAmountFiat6
				: (tx.finalRequestAmountFiat6 ?? (metaRaw as RawTxRecord['meta'])?.requestAmountFiat6 ?? 0n)
		const amountFiat = Number(amountFiat6) / 1e6
		const currencyFiatNum =
			metaRaw && typeof metaRaw === 'object' && 'currencyFiat' in metaRaw
				? (metaRaw as { currencyFiat?: number }).currencyFiat
				: Array.isArray(metaRaw)
					? metaRaw[2]
					: (metaRaw as Record<number, unknown>)?.[2]
		const currencyCode = currencyFiatToCode(Number(currencyFiatNum ?? 1))
		const isInbound = amPayee
		const tsRaw = tx.timestamp ?? 0n
		const tsMs = Number(tsRaw) < 10_000_000_000 ? Number(tsRaw) * 1000 : Number(tsRaw)

		const counterparty = amPayee ? (tx.payer ?? '') : (tx.payee ?? '')
		const payerAddr = (tx.payer ?? '').toLowerCase()
		const payeeAddr = (tx.payee ?? '').toLowerCase()
		const isEoaAaInternal =
			normalized.length >= 2 &&
			normalized.some((a) => a.toLowerCase() === payerAddr) &&
			normalized.some((a) => a.toLowerCase() === payeeAddr) &&
			payerAddr !== payeeAddr
		const resolvedType = isEoaAaInternal ? 'internal_transfer' : type
		merged.push({
			id,
			type: resolvedType,
			title: title ?? 'Transaction',
			handle: handle ?? '',
			forText: forText || undefined,
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
			card: card?.image ? card : undefined,
		})
	}
}

/**
 * 合并多地址、多自然月 indexer 记账，去重后按时间降序截取「全局最近」若干条（不限于当月）。
 */
export type FetchRecentActivityResult = {
	items: TxView[]
	error: string | null
	/** false = RPC/超时等不可信，调用方不得用空列表覆盖已有可信缓存 */
	trusted: boolean
}

export async function fetchMergedRecentActivityFromIndexer(
	accounts: string[],
	options?: FetchRecentActivityOptions
): Promise<FetchRecentActivityResult> {
	const normalized = accounts
		.filter((a) => a && ethers.isAddress(a))
		.map((a) => ethers.getAddress(a))
	if (normalized.length === 0) {
		return { items: [], error: null, trusted: true }
	}

	const maxReturn = options?.maxReturn ?? 30
	const monthLookback = options?.monthLookback ?? RECENT_ACTIVITY_MONTH_LOOKBACK

	try {
		const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
		const TX_FILTER = ethers.ZeroHash

		const seen = new Set<string>()
		const merged: TxView[] = []

		const resultsByMonth = await withTimeout(
			Promise.all(
				Array.from({ length: monthLookback }, (_, periodOffset) =>
					Promise.all(
						normalized.map((account) =>
							indexer.getAccountTransactionsByMonthOffsetPaged(
								account,
								periodOffset,
								0,
								INDEXER_PAGE_LIMIT_PER_MONTH,
								TX_FILTER
							)
						)
					)
				)
			),
			INDEXER_MULTI_MONTH_TIMEOUT_MS
		)

		for (const monthBatch of resultsByMonth) {
			for (const res of monthBatch) {
				const [, , , page] = res as [bigint, bigint, bigint, RawTxRecord[]]
				appendIndexerPage(Array.isArray(page) ? page : [], normalized, seen, merged)
			}
		}

		merged.sort((a, b) => b.timestampMs - a.timestampMs)
		return { items: merged.slice(0, maxReturn), error: null, trusted: true }
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		return { items: [], error: msg, trusted: false }
	}
}

/** Home / daemon 紧凑列表：全局时间序最近的 5 条 */
export const RECENT_ACTIVITY_PREVIEW_COUNT = 5
