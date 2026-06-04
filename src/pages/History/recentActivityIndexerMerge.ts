/**
 * Beamio indexer Recent Activity 合并拉取（无 React / 无 Daemon — 供全局喂料与 History 面板共用）
 */
import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'
import { formatBeamioTransactionTimeLabel } from '@/utils/beamioTransactionTimeLabel'
import {
	CATALOG_ISSUED_NFT_TOKEN_ID_MIN,
	classifyIndexerIssuedNftRedeemProductKind,
	isIndexerCardRedeemLedgerRow,
	indexerRouteCardAddress,
	indexerRouteMaxPositiveTokenId,
	indexerRowNeedsIssuedNftRedeemDistributionEnrich,
	indexerRowNeedsRouteForIssuedNftClaimClassify,
	indexerTxIsCardRedeemLedgerCategory,
	isGenericIssuedNftClaimActivityTitle,
	isIndexerConsumerIssuedNftClaimType,
	isIndexerIssuedNftCardRedeemTx,
	isIndexerRedeemLedgerPlaceholderTitle,
	mapIndexerIssuedNftConsumerClaimActivity,
	mergeIssuedNftRedeemDistributionIntoDisplayJson,
	parseIndexerCardRedeemDisplayJson,
	fetchBeamioSeriesSharedMetadata,
	issuedNftClaimNeedsSeriesTitleResolve,
	issuedNftClaimRouteIdentity,
	readSeriesMetadataDisplayTitle,
	seriesMetadataProductKind,
	type IndexerIssuedNftRedeemProductKind,
} from '@/utils/indexerCatalogRedeemClaim'
import contracts from '@/utils/contracts'

const BEAMIO_INDEXER = contracts.BeamioDiamond?.address ?? '0xd764eBA64536cFF1bbE7e7c7Bbc90F35620f72a9'

const TX_RECORD_TUPLE =
	'(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists, address topAdmin, address subordinate)'

const TX_FULL_TUPLE =
	'(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, address topAdmin, address subordinate, (address asset, uint256 amountE6, uint8 assetType, uint8 source, uint256 tokenId, uint8 itemCurrencyType, uint256 offsetInRequestCurrencyE6)[] route, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta)'

const INDEXER_ABI = [
	`function getAccountTransactionsByMonthOffsetPaged(address account, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_RECORD_TUPLE}[] page)`,
	`function getTransactionFullByTxId(bytes32 txId) view returns (${TX_FULL_TUPLE})`,
] as const

const ROUTE_ITEM_KEYS = [
	'asset',
	'amountE6',
	'assetType',
	'source',
	'tokenId',
	'itemCurrencyType',
	'offsetInRequestCurrencyE6',
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
const TX_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('newCard'))
const TX_REDEEM_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('redeemNewCard'))
const TX_REDEEM_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('redeemUpgradeNewCard'))
const TX_REDEEM_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('redeemTopupCard'))
const TX_CREDIT_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditTopupCard'))
const TX_CASH_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashTopupCard'))
const TX_CREDIT_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditUpgradeNewCard'))
const TX_CASH_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashUpgradeNewCard'))
const TX_CREDIT_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditNewCard'))
const TX_CASH_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashNewCard'))
const TX_BONUS_CARD = ethers.keccak256(ethers.toUtf8Bytes('bonusCard'))
const TX_USDC_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('usdcNewCard'))
const TX_USDC_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('usdcTopupCard'))
const TX_USDC_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('usdcUpgradeNewCard'))
const TX_TIP = ethers.keccak256(ethers.toUtf8Bytes('TX_TIP'))
const TX_MERCHANT_PAY_TIP_UPDATED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:tip_updated'))

const RECENT_ACTIVITY_CARD_TOPUP_CATEGORIES_LOWER = new Set(
	[
		TX_ISSUE_NEW_CARD,
		TX_UPGRADE_NEW_CARD,
		TX_TOPUP_CARD,
		TX_NEW_CARD,
		TX_REDEEM_NEW_CARD,
		TX_REDEEM_UPGRADE_NEW_CARD,
		TX_REDEEM_TOPUP_CARD,
		TX_CREDIT_TOPUP_CARD,
		TX_CASH_TOPUP_CARD,
		TX_CREDIT_UPGRADE_NEW_CARD,
		TX_CASH_UPGRADE_NEW_CARD,
		TX_CREDIT_NEW_CARD,
		TX_CASH_NEW_CARD,
		TX_BONUS_CARD,
		TX_USDC_NEW_CARD,
		TX_USDC_TOPUP_CARD,
		TX_USDC_UPGRADE_NEW_CARD,
	].map((h) => h.toLowerCase())
)

export function isRecentActivityCardTopupCategory(txCategory: string): boolean {
	const cat = String(txCategory ?? '').toLowerCase()
	return cat !== '' && RECENT_ACTIVITY_CARD_TOPUP_CATEGORIES_LOWER.has(cat)
}

/** Claim coupon/catalog row — includes paged `cardRedeem` before enrich adds `type` + metadata title. */
export function isRecentActivityIssuedNftClaimTxView(tx: TxView): boolean {
	if (tx.type === 'claim_coupon' || tx.type === 'claim_catalog') return true
	const raw = tx.rawTransaction
	if (!raw) return false
	return (
		isIndexerIssuedNftCardRedeemTx({
			txCategory: raw.txCategory,
			displayJson: raw.displayJson,
			route: raw.route,
		}) ||
		isIndexerCardRedeemLedgerRow({
			txCategory: raw.txCategory,
			displayJson: raw.displayJson,
		})
	)
}

export type RecentActivityTopupDisplay = {
	cardName: string
	topupPaymentLeg: string
	source: string
}

export function parseRecentActivityTopupDisplayJson(displayJson: string): RecentActivityTopupDisplay {
	try {
		const j = JSON.parse(displayJson || '{}') as {
			cardName?: string
			topupPaymentLeg?: string
			source?: string
			title?: string
		}
		return {
			cardName: String(j.cardName ?? '').trim(),
			topupPaymentLeg: String(j.topupPaymentLeg ?? '').trim().toLowerCase(),
			source: String(j.source ?? '').trim(),
		}
	} catch {
		return { cardName: '', topupPaymentLeg: '', source: '' }
	}
}

function recentActivityTopupPaymentLeg(displayJson: string): string {
	return parseRecentActivityTopupDisplayJson(displayJson).topupPaymentLeg
}

export function recentActivityTopupProgramName(displayJson: string, fallbackTitle?: string): string {
	const parsed = parseRecentActivityTopupDisplayJson(displayJson)
	const fromCard = parsed.cardName.replace(/\s*card\s*$/i, '').trim()
	if (fromCard) return fromCard
	const m = String(fallbackTitle ?? '').match(/^(?:Buy|Upgrade to|Reload|Top-up)\s+(.+?)(?:\s+Card(?:\s*·.*)?)?$/i)
	if (m?.[1]) return m[1].replace(/\s*·.*$/, '').trim()
	return 'Membership'
}

export function recentActivityTopupListTitle(displayJson: string, fallbackTitle?: string): string {
	return `Top-up: ${recentActivityTopupProgramName(displayJson, fallbackTitle)}`
}

export function recentActivityTopupPaymentLegLabel(txCategory: string, displayJson: string): string {
	const cat = String(txCategory ?? '').toLowerCase()
	const leg = parseRecentActivityTopupDisplayJson(displayJson).topupPaymentLeg
	if (leg === 'credit') return 'Card'
	if (leg === 'cash') return 'Cash'
	if (leg === 'bonus') return 'Bonus'
	if (leg === 'usdc') return 'USDC'
	if (cat === TX_CASH_NEW_CARD.toLowerCase() || cat === TX_CASH_TOPUP_CARD.toLowerCase() || cat === TX_CASH_UPGRADE_NEW_CARD.toLowerCase()) {
		return 'Cash'
	}
	if (cat === TX_BONUS_CARD.toLowerCase()) return 'Bonus'
	if (
		cat === TX_USDC_NEW_CARD.toLowerCase() ||
		cat === TX_USDC_TOPUP_CARD.toLowerCase() ||
		cat === TX_USDC_UPGRADE_NEW_CARD.toLowerCase()
	) {
		return 'USDC'
	}
	if (
		cat === TX_CREDIT_NEW_CARD.toLowerCase() ||
		cat === TX_CREDIT_TOPUP_CARD.toLowerCase() ||
		cat === TX_CREDIT_UPGRADE_NEW_CARD.toLowerCase()
	) {
		return 'Card'
	}
	return 'Card'
}

export type MerchantChargeDisplayParsed = {
	source: string
	title: string
	cardName: string
	cardAddress: string
	requestCurrency: string
	chargeBreakdown?: {
		requestCurrency?: string
		subtotalCurrencyAmount?: string
		tipCurrencyAmount?: string
	}
}

export function parseMerchantChargeDisplayJson(displayJson: string): MerchantChargeDisplayParsed | null {
	try {
		const j = JSON.parse(displayJson || '{}') as Record<string, unknown>
		const source = String(j.source ?? '').trim()
		const title = String(j.title ?? '').trim()
		const chargeBreakdownRaw = j.chargeBreakdown
		const hasChargeBreakdown =
			chargeBreakdownRaw !== null && typeof chargeBreakdownRaw === 'object' && !Array.isArray(chargeBreakdownRaw)
		const isChargeSource = source === 'open-container' || source === 'container'
		const isMerchantTitle = /merchant payment/i.test(title)
		if (!isChargeSource && !hasChargeBreakdown && !isMerchantTitle) return null
		if (!hasChargeBreakdown && !isMerchantTitle) return null
		const chargeBreakdown = hasChargeBreakdown
			? (chargeBreakdownRaw as Record<string, unknown>)
			: undefined
		return {
			source,
			title,
			cardName: String(j.cardName ?? '').trim(),
			cardAddress: String(j.cardAddress ?? '').trim(),
			requestCurrency: String(chargeBreakdown?.requestCurrency ?? j.requestCurrency ?? '').trim().toUpperCase(),
			chargeBreakdown: chargeBreakdown
				? {
						requestCurrency: String(chargeBreakdown.requestCurrency ?? '').trim(),
						subtotalCurrencyAmount: String(chargeBreakdown.subtotalCurrencyAmount ?? '').trim(),
						tipCurrencyAmount: String(chargeBreakdown.tipCurrencyAmount ?? '0').trim(),
					}
				: undefined,
		}
	} catch {
		return null
	}
}

/** Charge / open-container 商户付款行（排除 Tip 子行） */
export function isRecentActivityMerchantChargeTx(raw: RawTxRecord | undefined): boolean {
	if (!raw) return false
	const parsed = parseMerchantChargeDisplayJson(raw.displayJson ?? '')
	if (!parsed) return false
	if (/^tip$/i.test(parsed.title)) return false
	return true
}

function isRecentActivityTipTx(raw: RawTxRecord | undefined): boolean {
	if (!raw) return false
	const cat = String(raw.txCategory ?? '').toLowerCase()
	if (cat === TX_TIP.toLowerCase() || cat === TX_MERCHANT_PAY_TIP_UPDATED.toLowerCase()) return true
	try {
		const j = JSON.parse(raw.displayJson ?? '{}') as { title?: string; handle?: string }
		return /^tip$/i.test(String(j.title ?? '').trim()) || /\btip\b/i.test(String(j.handle ?? '').trim())
	} catch {
		return false
	}
}

/** List row / local cache may omit rawTransaction — use persisted TxView flags as fallback. */
export function isMerchantChargeTxView(tx: TxView | undefined): boolean {
	if (!tx) return false
	if (tx.isMerchantCharge) return true
	if (tx.type === 'merchant_pay' && tx.isAA && !tx.isInbound) return true
	if (isRecentActivityMerchantChargeTx(tx.rawTransaction)) return true
	/** Legacy cache rows: stripped rawTransaction but title still from open-container displayJson */
	if (!tx.rawTransaction) {
		const t = String(tx.title ?? '').trim()
		if (/^(?:qr\s+)?merchant\s+payment$/i.test(t)) return true
	}
	return false
}

/** Card address from enriched raw or persisted TxView field (survives local cache without raw). */
export function merchantChargeCardAddressFromTxView(tx: TxView | undefined): string {
	if (!tx) return ''
	const fromPersisted = String(tx.merchantCardAddress ?? '').trim()
	if (fromPersisted && ethers.isAddress(fromPersisted)) return ethers.getAddress(fromPersisted)
	const raw = tx.rawTransaction
	return raw ? merchantChargeCardAddressFromRaw(raw) : ''
}

/** Top-up rows embed cardAddress in displayJson; also persisted on TxView.merchantCardAddress. */
export function topupCardAddressFromTxView(tx: TxView | undefined): string {
	if (!tx) return ''
	const fromPersisted = String(tx.merchantCardAddress ?? '').trim()
	if (fromPersisted && ethers.isAddress(fromPersisted)) return ethers.getAddress(fromPersisted)
	return parseDisplayJsonCardIdentity(tx.rawTransaction?.displayJson ?? '').cardAddress
}

/** Top-up / issue rows embed cardAddress + cardName in displayJson; Charge historically did not. */
export function parseDisplayJsonCardIdentity(displayJson: string): { cardAddress: string; cardName: string } {
	try {
		const j = JSON.parse(displayJson || '{}') as { cardAddress?: string; cardName?: string }
		const cardAddressRaw = String(j.cardAddress ?? '').trim()
		const cardAddress =
			cardAddressRaw && ethers.isAddress(cardAddressRaw) ? ethers.getAddress(cardAddressRaw) : ''
		const cardName = String(j.cardName ?? '').trim()
		return { cardAddress, cardName }
	} catch {
		return { cardAddress: '', cardName: '' }
	}
}

/** Same-list top-up rows → cardAddress → program name (fallback before merchant card DB). */
export function buildRecentActivityCardNameDirectory(items: TxView[]): Map<string, string> {
	const out = new Map<string, string>()
	for (const tx of items) {
		const { cardAddress, cardName } = parseDisplayJsonCardIdentity(tx.rawTransaction?.displayJson ?? '')
		if (!cardAddress || !cardName) continue
		const key = cardAddress.toLowerCase()
		const cleaned = cardName.replace(/\s*card\s*$/i, '').trim()
		if (cleaned) out.set(key, cleaned)
	}
	return out
}

export function merchantChargeCardAddressFromRaw(raw: RawTxRecord): string {
	const fromDisplayJson = parseDisplayJsonCardIdentity(raw.displayJson ?? '').cardAddress
	if (fromDisplayJson) return fromDisplayJson
	for (const r of raw.route ?? []) {
		const assetType = Number(r.assetType ?? NaN)
		const tokenId = String(r.tokenId ?? '0')
		if (assetType === 1 && tokenId === '0') {
			const asset = String(r.asset ?? '').trim()
			if (asset && ethers.isAddress(asset)) return ethers.getAddress(asset)
		}
	}
	return ''
}

function indexerValueToPlain(v: unknown): unknown {
	if (typeof v === 'bigint') return v.toString()
	if (Array.isArray(v)) return v.map(indexerValueToPlain)
	if (v && typeof v === 'object' && !(v instanceof Date)) {
		const o: Record<string, unknown> = {}
		for (const [k, v2] of Object.entries(v)) o[k] = indexerValueToPlain(v2)
		return o
	}
	return v
}

function extractIndexerAddress(v: unknown): string {
	if (typeof v === 'string') return v.trim()
	if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
	return String(v ?? '').trim()
}

/** Indexer `payee` — Merchant 行 beamioTag 须按此地址查 profile，勿用 subordinate / displayJson.handle。 */
export function resolveIndexerPayeeAddress(raw: RawTxRecord | Record<string, unknown> | undefined): string {
	if (!raw) return ''
	const payeeRaw = extractIndexerAddress((raw as RawTxRecord).payee)
	if (!payeeRaw || !ethers.isAddress(payeeRaw)) return ''
	try {
		return ethers.getAddress(payeeRaw)
	} catch {
		return payeeRaw
	}
}

function parseRouteItemsFromIndexerFull(full: unknown): RouteItemRecord[] {
	const keys = [
		'id',
		'originalPaymentHash',
		'chainId',
		'txCategory',
		'displayJson',
		'timestamp',
		'payer',
		'payee',
		'finalRequestAmountFiat6',
		'finalRequestAmountUSDC6',
		'isAAAccount',
		'topAdmin',
		'subordinate',
		'route',
	] as const
	const arr = Array.isArray(full) ? full : null
	const routeRaw = arr && arr.length >= 14 ? arr[13] : (full as { route?: unknown })?.route
	if (!Array.isArray(routeRaw)) return []
	return routeRaw
		.map((row) => {
			if (!Array.isArray(row) || row.length < 7) return null
			const named: RouteItemRecord = {}
			for (let i = 0; i < ROUTE_ITEM_KEYS.length; i++) {
				const val = indexerValueToPlain(row[i])
				if (val !== undefined && val !== null) {
					;(named as Record<string, unknown>)[ROUTE_ITEM_KEYS[i]!] = val
				}
			}
			return named
		})
		.filter((r): r is RouteItemRecord => r != null)
}

type MerchantChargeFullEnrichment = {
	route: RouteItemRecord[] | null
	subordinate: string | null
}

function parseSubordinateFromIndexerFull(full: unknown): string | null {
	const arr = Array.isArray(full) ? full : null
	if (arr && arr.length >= 13) {
		const sub = extractIndexerAddress(indexerValueToPlain(arr[12]))
		return sub || null
	}
	const sub = extractIndexerAddress(indexerValueToPlain((full as { subordinate?: unknown })?.subordinate))
	return sub || null
}

function parseMerchantChargeFullEnrichment(full: unknown): MerchantChargeFullEnrichment {
	const route = parseRouteItemsFromIndexerFull(full)
	return {
		route: route.length > 0 ? route : null,
		subordinate: parseSubordinateFromIndexerFull(full),
	}
}

const chargeFullEnrichInflight = new Map<string, Promise<MerchantChargeFullEnrichment | null>>()

async function fetchMerchantChargeFullEnrichmentByTxId(txId: string): Promise<MerchantChargeFullEnrichment | null> {
	const key = txId.trim().toLowerCase()
	if (!key) return null
	const existing = chargeFullEnrichInflight.get(key)
	if (existing) return existing

	const task = (async () => {
		try {
			const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
			const full = await indexer.getTransactionFullByTxId(ethers.hexlify(ethers.getBytes(txId)))
			return parseMerchantChargeFullEnrichment(full)
		} catch {
			return null
		} finally {
			chargeFullEnrichInflight.delete(key)
		}
	})()

	chargeFullEnrichInflight.set(key, task)
	return task
}

/** Indexer `subordinate` 为有效非零地址 ⇒ POS 终端 Charge（In-store）；否则 Online。 */
export function merchantChargeHasExplicitSubordinate(raw: RawTxRecord | undefined): boolean {
	if (!raw || raw.subordinate === undefined || raw.subordinate === null) return false
	return extractIndexerAddress(raw.subordinate).length > 0
}

/** Indexer `subordinate` 为有效非零地址 ⇒ POS 终端 Charge（In-store）；否则 Online。 */
export function merchantChargeHasValidSubordinate(raw: RawTxRecord | undefined): boolean {
	if (!raw) return false
	const sub = extractIndexerAddress(raw.subordinate)
	if (!sub || sub === ethers.ZeroAddress || /^0x0+$/i.test(sub)) return false
	return ethers.isAddress(sub)
}

export function resolveMerchantChargeInStore(
	raw: RawTxRecord | undefined,
	persistedInStore?: boolean,
): boolean {
	if (raw && merchantChargeHasExplicitSubordinate(raw)) {
		return merchantChargeHasValidSubordinate(raw)
	}
	if (persistedInStore === true) return true
	if (persistedInStore === false) return false
	if (raw) return merchantChargeHasValidSubordinate(raw)
	return false
}

export function merchantChargeChannelLabel(
	raw: RawTxRecord | undefined,
	persistedInStore?: boolean,
): string {
	return resolveMerchantChargeInStore(raw, persistedInStore)
		? 'In-store payment'
		: 'Online shopping'
}

/** Paged indexer rows omit route[] / subordinate; Charge displayJson often lacks cardAddress — enrich from full tx. */
export async function enrichMerchantChargeItemsWithIndexerRoutes(items: TxView[]): Promise<TxView[]> {
	const need = items.filter((tx) => {
		const raw = tx.rawTransaction
		if (!raw || !isRecentActivityMerchantChargeTx(raw)) return false
		const missingCard = !merchantChargeCardAddressFromRaw(raw)
		const missingSubordinate = !merchantChargeHasExplicitSubordinate(raw)
		return missingCard || missingSubordinate
	})
	if (need.length === 0) return items

	const enrichmentByTxId = new Map<string, MerchantChargeFullEnrichment>()
	await Promise.all(
		need.map(async (tx) => {
			const enrichment = await fetchMerchantChargeFullEnrichmentByTxId(tx.id)
			if (enrichment) enrichmentByTxId.set(tx.id, enrichment)
		}),
	)

	if (enrichmentByTxId.size === 0) return items

	return items.map((tx) => {
		const enrichment = enrichmentByTxId.get(tx.id)
		const raw = tx.rawTransaction
		if (!raw || !enrichment) return tx
		const mergedRaw: RawTxRecord = {
			...raw,
			...(enrichment.route?.length ? { route: enrichment.route } : {}),
			...(enrichment.subordinate ? { subordinate: enrichment.subordinate } : {}),
		}
		const isCharge = isMerchantChargeTxView(tx) || isRecentActivityMerchantChargeTx(mergedRaw)
		if (!isCharge && !enrichment.route?.length && !enrichment.subordinate) return tx
		const cardAddr = merchantChargeCardAddressFromRaw(mergedRaw) || tx.merchantCardAddress || ''
		const merchantChargeInStore = resolveMerchantChargeInStore(mergedRaw, tx.merchantChargeInStore)
		return {
			...tx,
			isMerchantCharge: isCharge || tx.isMerchantCharge,
			merchantCardAddress: cardAddr || tx.merchantCardAddress,
			merchantChargeInStore,
			type: isCharge ? 'merchant_pay' : tx.type,
			rawTransaction: mergedRaw,
		}
	})
}

function mergeIssuedNftClaimDisplayJson(
	displayJson: string,
	seriesMeta: Record<string, unknown>,
	product: IndexerIssuedNftRedeemProductKind
): string {
	const globalCategory =
		product === 'coupon'
			? 'Coupon'
			: String(
					typeof seriesMeta.category === 'string' && seriesMeta.category.trim()
						? seriesMeta.category.trim()
						: 'Service'
				)
	const couponId =
		product === 'coupon' && typeof seriesMeta.couponId === 'string' && seriesMeta.couponId.trim()
			? seriesMeta.couponId.trim()
			: product === 'coupon' && typeof seriesMeta.id === 'string' && seriesMeta.id.trim()
				? seriesMeta.id.trim()
				: undefined
	const productionId =
		product === 'catalog' &&
		typeof seriesMeta.productionId === 'string' &&
		seriesMeta.productionId.trim()
			? seriesMeta.productionId.trim()
			: product === 'catalog' && typeof seriesMeta.id === 'string' && seriesMeta.id.trim()
				? seriesMeta.id.trim()
				: undefined
	const seriesTitle = readSeriesMetadataDisplayTitle(seriesMeta, product)
	let next = mergeIssuedNftRedeemDistributionIntoDisplayJson(displayJson, {
		distributionKind: product,
		globalCategory,
		...(couponId ? { couponId } : {}),
		...(productionId ? { productionId } : {}),
	})
	try {
		const j = JSON.parse(next || '{}') as Record<string, unknown>
		next = JSON.stringify({ ...j, title: seriesTitle })
	} catch {
		/* keep merged distribution */
	}
	return next
}

function reclassifyIssuedNftClaimTxView(
	tx: TxView,
	raw: RawTxRecord,
	seriesMetadata?: Record<string, unknown> | null
): TxView {
	const routeId = issuedNftClaimRouteIdentity(raw.route)
	let displayJson = raw.displayJson ?? ''
	if (seriesMetadata) {
		const product = seriesMetadataProductKind(seriesMetadata)
		if (product) {
			displayJson = mergeIssuedNftClaimDisplayJson(displayJson, seriesMetadata, product)
		}
	}
	const mergedRaw: RawTxRecord = { ...raw, displayJson }
	const claim = mapIndexerIssuedNftConsumerClaimActivity({
		txCategory: mergedRaw.txCategory,
		displayJson: mergedRaw.displayJson,
		route: mergedRaw.route,
		payer: mergedRaw.payer,
		payee: mergedRaw.payee,
		subordinate: mergedRaw.subordinate,
		topAdmin: mergedRaw.topAdmin,
		seriesMetadata,
	})
	const cardAddr = routeId.cardAddress || tx.merchantCardAddress || ''
	if (claim) {
		return {
			...tx,
			type: claim.type,
			title: claim.title,
			...(cardAddr ? { merchantCardAddress: cardAddr } : {}),
			...(routeId.tokenId ? { issuedNftClaimTokenId: routeId.tokenId } : {}),
			rawTransaction: mergedRaw,
		}
	}
	if (seriesMetadata) {
		const product = seriesMetadataProductKind(seriesMetadata)
		if (product) {
			const title = readSeriesMetadataDisplayTitle(seriesMetadata, product)
			return {
				...tx,
				type: product === 'catalog' ? 'claim_catalog' : 'claim_coupon',
				title,
				...(cardAddr ? { merchantCardAddress: cardAddr } : {}),
				...(routeId.tokenId ? { issuedNftClaimTokenId: routeId.tokenId } : {}),
				rawTransaction: mergedRaw,
			}
		}
	}
	return { ...tx, rawTransaction: mergedRaw }
}

/** Paged indexer rows omit route[]; issued-NFT cardRedeem must not stay as Top-up: Membership. */
export async function enrichIssuedNftClaimItemsWithIndexerRoutes(items: TxView[]): Promise<TxView[]> {
	const need = items.filter((tx) => {
		const raw = tx.rawTransaction
		if (raw) {
			if (!isIndexerCardRedeemLedgerRow({ txCategory: raw.txCategory, displayJson: raw.displayJson })) {
				return false
			}
			return issuedNftClaimNeedsSeriesTitleResolve(tx.title)
		}
		return (
			Boolean(tx.merchantCardAddress && tx.issuedNftClaimTokenId) &&
			issuedNftClaimNeedsSeriesTitleResolve(tx.title)
		)
	})
	if (need.length === 0) return items

	const enrichmentByTxId = new Map<string, MerchantChargeFullEnrichment>()
	const seriesMetaByTxId = new Map<string, Record<string, unknown> | null>()

	await Promise.all(
		need.map(async (tx) => {
			const raw = tx.rawTransaction
			let card = tx.merchantCardAddress ?? ''
			let tokenId = tx.issuedNftClaimTokenId ?? ''
			if (raw) {
				const enrichment = await fetchMerchantChargeFullEnrichmentByTxId(tx.id)
				if (enrichment) enrichmentByTxId.set(tx.id, enrichment)
				const mergedRoute = enrichment?.route?.length ? enrichment.route : raw.route
				const routeId = issuedNftClaimRouteIdentity(mergedRoute)
				card = routeId.cardAddress || card
				tokenId = routeId.tokenId || tokenId
			}
			if (card && tokenId) {
				const meta = await fetchBeamioSeriesSharedMetadata(card, tokenId)
				if (meta) seriesMetaByTxId.set(tx.id, meta)
			}
		})
	)

	return items.map((tx) => {
		if (!need.some((n) => n.id === tx.id)) return tx
		const enrichment = enrichmentByTxId.get(tx.id)
		const seriesMeta = seriesMetaByTxId.get(tx.id)
		const raw = tx.rawTransaction
		if (!raw) {
			if (!seriesMeta) return tx
			const product = seriesMetadataProductKind(seriesMeta)
			if (!product) return tx
			return {
				...tx,
				type: product === 'catalog' ? 'claim_catalog' : 'claim_coupon',
				title: readSeriesMetadataDisplayTitle(seriesMeta, product),
			}
		}
		const mergedRaw: RawTxRecord = {
			...raw,
			...(enrichment?.route?.length ? { route: enrichment.route } : {}),
			...(enrichment?.subordinate ? { subordinate: enrichment.subordinate } : {}),
		}
		return reclassifyIssuedNftClaimTxView(tx, mergedRaw, seriesMeta ?? null)
	})
}

export function merchantChargeListCurrencyCode(raw: RawTxRecord, txCurrencyCode: string): string {
	const parsed = parseMerchantChargeDisplayJson(raw.displayJson ?? '')
	const fromBreakdown = parsed?.chargeBreakdown?.requestCurrency?.trim().toUpperCase()
	if (fromBreakdown) return fromBreakdown
	if (parsed?.requestCurrency) return parsed.requestCurrency
	return (txCurrencyCode || 'USD').toUpperCase()
}

/** 列表行展示金额：优先 route 点数腿合计，否则 subtotal + tip */
export function merchantChargeDisplayFiatAmount(raw: RawTxRecord): number {
	const routes = raw.route ?? []
	if (routes.length > 0) {
		let totalE6 = 0n
		for (const r of routes) {
			const source = Number(r.source ?? NaN)
			const assetType = Number(r.assetType ?? NaN)
			const isPointsLeg = source === 1 || (assetType === 1 && String(r.tokenId ?? '0') === '0')
			if (!isPointsLeg) continue
			try {
				const off = r.offsetInRequestCurrencyE6 ?? r.amountE6 ?? '0'
				totalE6 += BigInt(String(off))
			} catch {
				/* skip bad leg */
			}
		}
		if (totalE6 > 0n) return Number(totalE6) / 1e6
	}
	const parsed = parseMerchantChargeDisplayJson(raw.displayJson ?? '')
	if (parsed?.chargeBreakdown) {
		const sub = parseFloat(parsed.chargeBreakdown.subtotalCurrencyAmount ?? '0') || 0
		const tip = parseFloat(parsed.chargeBreakdown.tipCurrencyAmount ?? '0') || 0
		return sub + tip
	}
	const meta = raw.meta
	let fiat6 = raw.finalRequestAmountFiat6 ?? 0n
	if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.requestAmountFiat6 !== undefined) {
		fiat6 = meta.requestAmountFiat6 ?? fiat6
	}
	return Number(fiat6) / 1e6
}

export function rawTxAfterNotePayer(raw: RawTxRecord | undefined): string {
	const m = raw?.meta
	if (!m) return ''
	if (typeof m === 'object' && !Array.isArray(m)) return String(m.afterNotePayer ?? '').trim()
	if (Array.isArray(m)) return String(m[7] ?? '').trim()
	return ''
}

export type TopupRechargeBonusNote = {
	actualPaymentCurrencyFiat6: bigint
	rechargeBonusCurrencyFiat6: bigint
}

export function parseTopupRechargeBonusAfterNotePayer(afterNotePayer: unknown): TopupRechargeBonusNote | null {
	if (typeof afterNotePayer !== 'string' || !afterNotePayer.trim()) return null
	try {
		const j = JSON.parse(afterNotePayer) as {
			actualPaymentCurrencyFiat6?: string | number
			rechargeBonusCurrencyFiat6?: string | number
		}
		const actual = BigInt(String(j.actualPaymentCurrencyFiat6 ?? '0'))
		const bonus = BigInt(String(j.rechargeBonusCurrencyFiat6 ?? '0'))
		if (actual < 0n || bonus <= 0n) return null
		return { actualPaymentCurrencyFiat6: actual, rechargeBonusCurrencyFiat6: bonus }
	} catch {
		return null
	}
}

export type ChargeRewardAfterNoteParsed = {
	point6: bigint
	balance6?: bigint
	chargeRewardRatioE6?: bigint
}

/** Charge reward (NFT#2 tokenId=2) from indexer meta.afterNotePayer JSON — point + optional post-charge balance. */
export function parseChargeRewardAfterNotePayer(afterNotePayer: unknown): ChargeRewardAfterNoteParsed | null {
	if (typeof afterNotePayer !== 'string' || !afterNotePayer.trim()) return null
	try {
		const j = JSON.parse(afterNotePayer) as {
			point?: string | number
			balance?: string | number
			balanceE6?: string | number
			chargeRewardRatioE6?: string | number
		}
		if (j.point === undefined || j.point === null) return null
		const point6 = BigInt(String(j.point))
		const balRaw = j.balance ?? j.balanceE6
		const balance6 =
			balRaw !== undefined && balRaw !== null && String(balRaw).trim() !== ''
				? BigInt(String(balRaw))
				: undefined
		const chargeRewardRatioE6 =
			j.chargeRewardRatioE6 !== undefined && j.chargeRewardRatioE6 !== null
				? BigInt(String(j.chargeRewardRatioE6))
				: undefined
		return {
			point6,
			...(balance6 !== undefined ? { balance6 } : {}),
			...(chargeRewardRatioE6 !== undefined ? { chargeRewardRatioE6 } : {}),
		}
	} catch {
		return null
	}
}

/** Charge reward points (E6) from indexer meta.afterNotePayer JSON */
export function parseChargeRewardPoint6FromAfterNotePayer(afterNotePayer: unknown): bigint | null {
	return parseChargeRewardAfterNotePayer(afterNotePayer)?.point6 ?? null
}

/** Charge-reward point value text (no label) — balance (when indexed) + earned pts for this charge row. */
export function formatChargeRewardPointValue(
	reward: ChargeRewardAfterNoteParsed | null | undefined,
): string | null {
	if (!reward || reward.point6 <= 0n) return null
	const earned = (Number(reward.point6) / 1e6).toFixed(2)
	if (reward.balance6 !== undefined && reward.balance6 >= 0n) {
		const bal = (Number(reward.balance6) / 1e6).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
		return `${bal} + ${earned} pts`
	}
	return `+${earned} pts`
}

export function resolveChargeRewardDisplayFromTxView(
	tx: TxView,
	rawOverride?: RawTxRecord | Record<string, unknown> | null,
): ChargeRewardAfterNoteParsed | null {
	const raw = (rawOverride ?? tx.rawTransaction) as RawTxRecord | undefined
	const parsed = parseChargeRewardAfterNotePayer(rawTxAfterNotePayer(raw))
	const mergedPointRaw = tx.merchantChargeRewardPoint6?.trim()
	if (mergedPointRaw && /^\d+$/.test(mergedPointRaw)) {
		const point6 = BigInt(mergedPointRaw)
		if (point6 > 0n) {
			return {
				point6,
				...(parsed?.balance6 !== undefined ? { balance6: parsed.balance6 } : {}),
				...(parsed?.chargeRewardRatioE6 !== undefined
					? { chargeRewardRatioE6: parsed.chargeRewardRatioE6 }
					: {}),
			}
		}
	}
	return parsed
}

export { formatBeamioTransactionTimeLabel, formatRecentActivityItemTime } from '@/utils/beamioTransactionTimeLabel'

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
	| 'claim_coupon'
	| 'claim_catalog'
	| 'cardmint'
	| 'internal_transfer'
	| 'voucher_burn'
	| 'request_cancel'
	| 'fuel_yield'
	| 'unknown'

const BEAMIO_APP_METADATA_ORIGIN = 'https://beamio.app'

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
	if (RECENT_ACTIVITY_CARD_TOPUP_CATEGORIES_LOWER.has(cat)) return 'topup'
	return 'unknown'
}

const CURRENCY_FIAT_MAP = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const
const currencyFiatToCode = (n: number | undefined): string => CURRENCY_FIAT_MAP[n as number] ?? 'USD'

function normalizeBytes32HexLower(h: unknown): string {
	if (h == null) return ''
	let s = typeof h === 'string' ? h.trim() : ''
	if (!s) return ''
	if (!s.startsWith('0x') && /^[0-9a-fA-F]{64}$/.test(s)) s = `0x${s}`
	try {
		if (!ethers.isHexString(s) || ethers.dataLength(s) !== 32) return ''
		const lower = s.toLowerCase()
		return lower === ethers.ZeroHash.toLowerCase() ? '' : lower
	} catch {
		return ''
	}
}

/** BaseScan tx hash: split NFC top-up legs use synthetic indexer `id`; chain tx is in `displayJson.finishedHash`. */
export function resolveRawTxBaseScanTxHash(tx: RawTxRecord | undefined, indexerTxId?: string): string {
	const pickFirst = (...candidates: unknown[]): string => {
		for (const c of candidates) {
			const n = normalizeBytes32HexLower(c)
			if (n) return n
		}
		return ''
	}
	if (tx) {
		try {
			const j = JSON.parse(tx.displayJson ?? '{}') as {
				finishedHash?: string
				baseRelayTxHash?: string
				requestHash?: string
			}
			const fromDisplay = pickFirst(j?.finishedHash, j?.baseRelayTxHash, j?.requestHash)
			if (fromDisplay) return fromDisplay
		} catch {
			/* ignore */
		}
		const oph = tx.originalPaymentHash
		const ophStr =
			typeof oph === 'string' ? oph : oph != null ? ethers.hexlify(oph as ethers.BytesLike) : ''
		const fromLink = pickFirst(ophStr)
		if (fromLink) return fromLink
	}
	const idNorm = pickFirst(indexerTxId, tx?.id)
	return idNorm
}

export function resolveTxViewBaseScanTxHash(tx: TxView): string {
	return resolveRawTxBaseScanTxHash(tx.rawTransaction, tx.id)
}

function formatTime(ts: bigint): string {
	const ms = Number(ts) < 10_000_000_000 ? Number(ts) * 1000 : Number(ts)
	return formatBeamioTransactionTimeLabel(ms)
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
	topAdmin?: string
	subordinate?: string
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
	/** Open-container / container Charge — persisted for local cache rows without rawTransaction */
	isMerchantCharge?: boolean
	/** Indexer payee — Merchant 明细行 beamioTag 来源（非 subordinate） */
	merchantPayeeAddress?: string
	/** Merchant program card from route / displayJson — persisted for metadata prefetch */
	merchantCardAddress?: string
	/** Issued-NFT claim route tokenId — persisted for metadata title when rawTransaction is stripped */
	issuedNftClaimTokenId?: string
	/** Split top-up display: actual customer payment leg plus Recharge Bonus leg merged into one row. */
	topupActualPaymentFiat?: number
	topupBonusFiat?: number
	/** Charge display: standalone tip row merged into the parent charge row by finished/base tx hash. */
	merchantChargeTipFiat?: number
	merchantChargeTipCurrencyCode?: string
	/** Charge channel: indexer subordinate valid ⇒ In-store; persisted for cache rows without rawTransaction. */
	merchantChargeInStore?: boolean
	/** Merged main + TX_TIP charge-reward points (E6 string) for NFT#2 subtitle. */
	merchantChargeRewardPoint6?: string
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

		const rawRecord = tx as RawTxRecord
		const claimArgs = {
			txCategory: tx.txCategory,
			displayJson: tx.displayJson,
			route: rawRecord.route,
			payer: tx.payer,
			payee: tx.payee,
			subordinate: (tx as { subordinate?: string }).subordinate,
			topAdmin: (tx as { topAdmin?: string }).topAdmin,
		}
		const issuedNftClaim = mapIndexerIssuedNftConsumerClaimActivity(claimArgs)
		const isIssuedNftRedeemRow = isIndexerIssuedNftCardRedeemTx(claimArgs)

		const type = issuedNftClaim?.type ?? txCategoryToType(tx.txCategory ?? '')
		const amPayee = normalized.some((a) => a.toLowerCase() === (tx.payee ?? '').toLowerCase())
		let { title, handle, forText, card } = parseDisplayJson(tx.displayJson ?? '')
		if (issuedNftClaim) {
			title = issuedNftClaim.title
		}
		if (String(tx.txCategory ?? '') === TX_BUINT_USDC && amPayee) {
			title = 'Fuel Yield (1:100)'
			handle = 'USDC Top-up'
		}
		const txCategoryLower = String(tx.txCategory ?? '').toLowerCase()
		const isCardRedeemLedgerRow = isIndexerCardRedeemLedgerRow({
			txCategory: tx.txCategory,
			displayJson: tx.displayJson,
		})
		const isCardTopupLedgerTx =
			!issuedNftClaim &&
			!isCardRedeemLedgerRow &&
			!isIssuedNftRedeemRow &&
			isRecentActivityCardTopupCategory(txCategoryLower)
		const topupCardAddress = isCardTopupLedgerTx
			? parseDisplayJsonCardIdentity(tx.displayJson ?? '').cardAddress
			: ''
		if ((isIssuedNftRedeemRow || isCardRedeemLedgerRow) && !issuedNftClaim) {
			const product = classifyIndexerIssuedNftRedeemProductKind({ displayJson: tx.displayJson })
			title = readSeriesMetadataDisplayTitle(null, product ?? 'coupon')
		} else if (isCardTopupLedgerTx) {
			title = recentActivityTopupListTitle(tx.displayJson ?? '', title)
		}
		const redeemRouteId =
			issuedNftClaim || isIssuedNftRedeemRow || isCardRedeemLedgerRow
				? issuedNftClaimRouteIdentity(rawRecord.route)
				: { cardAddress: '', tokenId: '' }
		const claimCardAddress = redeemRouteId.cardAddress
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
		const merchantPayeeAddress = resolveIndexerPayeeAddress(rawRecord)
		const isMerchantCharge = isRecentActivityMerchantChargeTx(rawRecord)
		const merchantCardAddress = isMerchantCharge ? merchantChargeCardAddressFromRaw(rawRecord) : ''
		const isEoaAaInternal =
			!isMerchantCharge &&
			normalized.length >= 2 &&
			normalized.some((a) => a.toLowerCase() === payerAddr) &&
			normalized.some((a) => a.toLowerCase() === payeeAddr) &&
			payerAddr !== payeeAddr
		const resolvedType = isMerchantCharge
			? 'merchant_pay'
			: isEoaAaInternal
				? 'internal_transfer'
				: type
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
			txHash: resolveRawTxBaseScanTxHash(tx as RawTxRecord, id),
			counterpartyAddress: counterparty || undefined,
			...(merchantPayeeAddress && (isMerchantCharge || isCardTopupLedgerTx)
				? { merchantPayeeAddress }
				: {}),
			...(isMerchantCharge
				? {
						isMerchantCharge: true as const,
						merchantChargeInStore: resolveMerchantChargeInStore(rawRecord),
						...(merchantCardAddress ? { merchantCardAddress } : {}),
					}
				: topupCardAddress
					? { merchantCardAddress: topupCardAddress }
					: claimCardAddress
						? { merchantCardAddress: claimCardAddress }
						: {}),
			...(redeemRouteId.tokenId ? { issuedNftClaimTokenId: redeemRouteId.tokenId } : {}),
			rawTransaction: rawRecord,
			card: card?.image ? card : undefined,
		})
	}
}

function mergeRecentActivityTopupBonusLegs(items: TxView[]): TxView[] {
	const byTxHash = new Map<string, TxView[]>()
	for (const tx of items) {
		const raw = tx.rawTransaction
		const cat = String(raw?.txCategory ?? '').toLowerCase()
		if (!isRecentActivityCardTopupCategory(cat)) continue
		const key = (tx.txHash || resolveRawTxBaseScanTxHash(raw, tx.id)).toLowerCase()
		if (!key || key === ethers.ZeroHash.toLowerCase()) continue
		const arr = byTxHash.get(key) ?? []
		arr.push(tx)
		byTxHash.set(key, arr)
	}

	const replacement = new Map<string, TxView>()
	const suppressed = new Set<string>()
	for (const [, group] of byTxHash) {
		if (group.length < 2) continue
		const bonusRows = group.filter((tx) => recentActivityTopupPaymentLeg(tx.rawTransaction?.displayJson ?? '') === 'bonus')
		if (bonusRows.length === 0) continue
		const primary = group.find((tx) => recentActivityTopupPaymentLeg(tx.rawTransaction?.displayJson ?? '') !== 'bonus')
		if (!primary) continue
		const note =
			group
				.map((tx) => parseTopupRechargeBonusAfterNotePayer(rawTxAfterNotePayer(tx.rawTransaction)))
				.find((v): v is TopupRechargeBonusNote => v != null) ?? null
		const bonusFiat =
			note != null
				? Number(note.rechargeBonusCurrencyFiat6) / 1e6
				: bonusRows.reduce((sum, row) => sum + Math.abs(row.amountFiat), 0)
		if (!(bonusFiat > 0)) continue
		const actualFiat =
			note != null
				? Number(note.actualPaymentCurrencyFiat6) / 1e6
				: Math.abs(primary.amountFiat)
		const totalFiat = actualFiat + bonusFiat
		const totalUSDC = group.reduce((sum, row) => sum + Math.abs(row.amountUSDC), 0)
		const timestampMs = Math.max(...group.map((row) => row.timestampMs || 0), primary.timestampMs)
		replacement.set(primary.id, {
			...primary,
			timestampMs,
			timestamp: formatBeamioTransactionTimeLabel(timestampMs),
			amountFiat: totalFiat,
			amountUSDC: totalUSDC > 0 ? totalUSDC : primary.amountUSDC,
			topupActualPaymentFiat: actualFiat,
			topupBonusFiat: bonusFiat,
		})
		for (const row of bonusRows) {
			if (row.id !== primary.id) suppressed.add(row.id)
		}
	}

	if (replacement.size === 0 && suppressed.size === 0) return items
	return items
		.filter((tx) => !suppressed.has(tx.id))
		.map((tx) => replacement.get(tx.id) ?? tx)
}

function mergeRecentActivityTipRowsIntoCharges(items: TxView[]): TxView[] {
	const groups = new Map<string, TxView[]>()
	for (const tx of items) {
		const raw = tx.rawTransaction
		if (!raw) continue
		if (!isMerchantChargeTxView(tx) && !isRecentActivityTipTx(raw)) continue
		const key = (tx.txHash || resolveRawTxBaseScanTxHash(raw, tx.id)).toLowerCase()
		if (!key || key === ethers.ZeroHash.toLowerCase()) continue
		const arr = groups.get(key) ?? []
		arr.push(tx)
		groups.set(key, arr)
	}

	const replacement = new Map<string, TxView>()
	const suppressed = new Set<string>()
	for (const [, group] of groups) {
		if (group.length < 2) continue
		const charge = group.find((tx) => isMerchantChargeTxView(tx))
		if (!charge) continue
		const tips = group.filter((tx) => tx.id !== charge.id && isRecentActivityTipTx(tx.rawTransaction))
		if (tips.length === 0) continue
		const tipFiat = tips.reduce((sum, row) => sum + Math.abs(Number(row.amountFiat) || 0), 0)
		if (!(tipFiat > 0)) continue
		const tipCurrency = tips.find((row) => String(row.currencyCode ?? '').trim())?.currencyCode || charge.currencyCode
		const timestampMs = Math.max(charge.timestampMs || 0, ...tips.map((row) => row.timestampMs || 0))
		const chargePoint6 =
			parseChargeRewardPoint6FromAfterNotePayer(rawTxAfterNotePayer(charge.rawTransaction)) ?? 0n
		const tipPoint6 = tips.reduce((sum, row) => {
			const p = parseChargeRewardPoint6FromAfterNotePayer(rawTxAfterNotePayer(row.rawTransaction))
			return sum + (p ?? 0n)
		}, 0n)
		const totalRewardPoint6 = chargePoint6 + tipPoint6
		replacement.set(charge.id, {
			...charge,
			timestampMs,
			timestamp: formatBeamioTransactionTimeLabel(timestampMs),
			merchantChargeTipFiat: tipFiat,
			merchantChargeTipCurrencyCode: tipCurrency,
			...(totalRewardPoint6 > 0n ? { merchantChargeRewardPoint6: totalRewardPoint6.toString() } : {}),
		})
		for (const row of tips) suppressed.add(row.id)
	}

	if (replacement.size === 0 && suppressed.size === 0) return items
	return items
		.filter((tx) => !suppressed.has(tx.id))
		.map((tx) => replacement.get(tx.id) ?? tx)
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
		const topupMerged = mergeRecentActivityTopupBonusLegs(merged)
		const chargeTipMerged = mergeRecentActivityTipRowsIntoCharges(topupMerged)
		chargeTipMerged.sort((a, b) => b.timestampMs - a.timestampMs)
		const sliced = chargeTipMerged.slice(0, maxReturn)
		const enriched = await enrichIssuedNftClaimItemsWithIndexerRoutes(
			await enrichMerchantChargeItemsWithIndexerRoutes(sliced)
		)
		return { items: enriched, error: null, trusted: true }
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		return { items: [], error: msg, trusted: false }
	}
}

/** Home / daemon 紧凑列表：全局时间序最近的 5 条 */
export const RECENT_ACTIVITY_PREVIEW_COUNT = 5
