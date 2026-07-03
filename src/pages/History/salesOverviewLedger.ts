/**
 * Wallet `/History/sales-overview`: aggregate merchant-facing Charge buckets from CoNET BeamioIndexerDiamond.
 * Mirrors Merchant OS ledger semantics (biz.tsx) — classification uses txCategory + displayJson.title.
 */
import { ethers } from 'ethers'
import { BEAMIO_INDEXER_DIAMOND, CONET_BUINT } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const TX_PAGE_TUPLE =
	'tuple(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, tuple(uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, tuple(uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists, address topAdmin, address subordinate)'

const INDEXER_ACCOUNT_ABI = [
	`function getAccountTransactionsPaged(address account, uint256 offset, uint256 limit) view returns (${TX_PAGE_TUPLE}[] page)`,
] as const

const NFC_TOPUP_TX_CREDIT_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditTopupCard')).toLowerCase()
const NFC_TOPUP_TX_CASH_TOPUP_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashTopupCard')).toLowerCase()
const NFC_TOPUP_TX_CREDIT_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditUpgradeNewCard')).toLowerCase()
const NFC_TOPUP_TX_CASH_UPGRADE_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashUpgradeNewCard')).toLowerCase()
const NFC_TOPUP_TX_CREDIT_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('creditNewCard')).toLowerCase()
const NFC_TOPUP_TX_CASH_NEW_CARD = ethers.keccak256(ethers.toUtf8Bytes('cashNewCard')).toLowerCase()
const NFC_TOPUP_TX_BONUS_CARD = ethers.keccak256(ethers.toUtf8Bytes('bonusCard')).toLowerCase()

const INDEXER_TX_TOPUP_CATEGORIES = new Set<string>([
	ethers.keccak256(ethers.toUtf8Bytes('usdcTopupCard')),
	ethers.keccak256(ethers.toUtf8Bytes('usdcNewCard')),
	ethers.keccak256(ethers.toUtf8Bytes('usdcUpgradeNewCard')),
	ethers.keccak256(ethers.toUtf8Bytes('newCard')),
	ethers.keccak256(ethers.toUtf8Bytes('upgradeNewCard')),
	ethers.keccak256(ethers.toUtf8Bytes('topupCard')),
	ethers.keccak256(ethers.toUtf8Bytes('redeemNewCard')),
	ethers.keccak256(ethers.toUtf8Bytes('redeemUpgradeNewCard')),
	ethers.keccak256(ethers.toUtf8Bytes('redeemTopupCard')),
	NFC_TOPUP_TX_CREDIT_TOPUP_CARD,
	NFC_TOPUP_TX_CASH_TOPUP_CARD,
	NFC_TOPUP_TX_CREDIT_UPGRADE_NEW_CARD,
	NFC_TOPUP_TX_CASH_UPGRADE_NEW_CARD,
	NFC_TOPUP_TX_CREDIT_NEW_CARD,
	NFC_TOPUP_TX_CASH_NEW_CARD,
	NFC_TOPUP_TX_BONUS_CARD,
])

const TX_BUINT_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('buintClaim'))
const TX_BUINT_USDC = ethers.keccak256(ethers.toUtf8Bytes('buintUSDC'))
const TX_BUINT_BURN = ethers.keccak256(ethers.toUtf8Bytes('buintBurn'))
const TX_BUINT_REQUEST_ACCOUNTING = ethers.keccak256(ethers.toUtf8Bytes('requestAccounting'))
const TX_BUINT_SEND_USDC = ethers.keccak256(ethers.toUtf8Bytes('sendUSDC'))
const TX_BUINT_X402_SEND = ethers.keccak256(ethers.toUtf8Bytes('x402Send'))

const INDEXER_BUINT_LEDGER_CATEGORY_HEX_LOWER = new Set<string>([
	TX_BUINT_CLAIM.toLowerCase(),
	TX_BUINT_USDC.toLowerCase(),
	TX_BUINT_BURN.toLowerCase(),
	TX_BUINT_REQUEST_ACCOUNTING.toLowerCase(),
	TX_BUINT_SEND_USDC.toLowerCase(),
	TX_BUINT_X402_SEND.toLowerCase(),
])

const TX_BUINT_NFC_TOPUP_SERVICE = ethers.keccak256(ethers.toUtf8Bytes('nfcTopup:bunitService')).toLowerCase()
const TX_BUINT_USDC_TOPUP_SERVICE = ethers.keccak256(ethers.toUtf8Bytes('usdcTopup:bunitService')).toLowerCase()
const TOPUP_BUINT_SERVICE_CATEGORY_LOWER = new Set<string>([TX_BUINT_NFC_TOPUP_SERVICE, TX_BUINT_USDC_TOPUP_SERVICE])

const TX_MERCHANT_PAY_TIP_UPDATED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:tip_updated')).toLowerCase()
const TX_TIP_LEDGER_CATEGORY = ethers.keccak256(ethers.toUtf8Bytes('TX_TIP')).toLowerCase()
const TX_TERMINAL_RESET_LEDGER_CATEGORY = ethers.keccak256(ethers.toUtf8Bytes('TX_Terminal_RESET')).toLowerCase()

const TITLE_USDC_MERCHANT_CHARGE = 'usdc merchant charge'
const TITLE_NFC_MERCHANT_PAYMENT = 'nfc merchant payment'

const FIAT_LABELS = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const

export type SalesOverviewLedgerBuckets = {
	/** Sum of `finalRequestAmountUSDC6 / 1e6` for USDC checkout charges (`displayJson.title` USDC merchant charge). */
	usdcSubtotal: number
	/** NFC / Beamio card checkout — keyed by `meta.currencyFiat` ISO-like label; amounts from `finalRequestAmountFiat6 / 1e6`. */
	cardSubtotalsByCurrency: Record<string, number>
	/** Other merchant charges (legacy / mixed rails), keyed by currency (fiat6 human). */
	cashSubtotalsByCurrency: Record<string, number>
	chargeLikeRowCount: number
}

function normalizeIndexerTxCategoryHex(cat: unknown): string {
	if (cat == null) return ''
	const s = typeof cat === 'string' ? cat.trim() : ''
	if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase()
	try {
		return ethers.hexlify(cat as ethers.BytesLike).toLowerCase()
	} catch {
		return ''
	}
}

function isIndexerBuintConsumePayee(payee: unknown): boolean {
	const p = typeof payee === 'string' && ethers.isAddress(payee) ? ethers.getAddress(payee).toLowerCase() : ''
	return p === CONET_BUINT.toLowerCase()
}

function isIndexerFetchedRowBunitLedger(tx: { txCategory: string; payee: string }): boolean {
	const h = normalizeIndexerTxCategoryHex(tx.txCategory)
	if (h !== '' && INDEXER_BUINT_LEDGER_CATEGORY_HEX_LOWER.has(h)) return true
	return isIndexerBuintConsumePayee(tx.payee)
}

function shouldSkipSalesOverviewRow(tx: { txCategory: string; payee: string }): boolean {
	const cat = normalizeIndexerTxCategoryHex(tx.txCategory)
	if (TOPUP_BUINT_SERVICE_CATEGORY_LOWER.has(cat)) return true
	return isIndexerFetchedRowBunitLedger(tx)
}

function currencyFiatToLabel(code: number): string {
	if (!Number.isFinite(code) || code < 0 || code >= FIAT_LABELS.length) return 'CAD'
	return FIAT_LABELS[code] ?? 'CAD'
}

function fiat6Human(fiat6: bigint): number {
	const n = Number(fiat6) / 1e6
	return Number.isFinite(n) ? n : 0
}

function usdc6Human(usdc6: bigint): number {
	const n = Number(usdc6) / 1e6
	return Number.isFinite(n) ? n : 0
}

function parseDisplayTitle(displayJson: string): string {
	try {
		const j = JSON.parse(displayJson || '{}') as { title?: unknown }
		const t = j.title
		return typeof t === 'string' ? t.trim().toLowerCase() : ''
	} catch {
		return ''
	}
}

function addToBucket(map: Record<string, number>, ccy: string, amt: number): void {
	if (!(amt > 0) || !Number.isFinite(amt)) return
	const k = ccy.trim().toUpperCase() || 'CAD'
	map[k] = (map[k] ?? 0) + amt
}

export function localCalendarDayBoundsUnixSec(anchorMs: number = Date.now()): { startSec: number; endSec: number } {
	const d = new Date(anchorMs)
	const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
	const startSec = Math.floor(startMs / 1000)
	const endSec = startSec + 86400 - 1
	return { startSec, endSec }
}

export async function fetchSalesOverviewBucketsForAccount(
	account: string,
	opts?: { dayStartSec?: number; dayEndSec?: number }
): Promise<SalesOverviewLedgerBuckets> {
	const empty: SalesOverviewLedgerBuckets = {
		usdcSubtotal: 0,
		cardSubtotalsByCurrency: {},
		cashSubtotalsByCurrency: {},
		chargeLikeRowCount: 0,
	}
	const addr = account.trim()
	if (!ethers.isAddress(addr)) return empty

	const bounds =
		opts?.dayStartSec != null && opts?.dayEndSec != null
			? { startSec: opts.dayStartSec, endSec: opts.dayEndSec }
			: localCalendarDayBoundsUnixSec()

	const c = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ACCOUNT_ABI, conetDepinProvider)

	let offset = 0n
	const pageLimit = 80n
	let pages = 0
	const maxPages = 24

	const buckets: SalesOverviewLedgerBuckets = {
		usdcSubtotal: 0,
		cardSubtotalsByCurrency: {},
		cashSubtotalsByCurrency: {},
		chargeLikeRowCount: 0,
	}

	while (pages < maxPages) {
		const page = (await c.getAccountTransactionsPaged(addr, offset, pageLimit)) as Array<{
			txCategory: string
			displayJson: string
			timestamp: bigint
			payee: string
			finalRequestAmountFiat6: bigint
			finalRequestAmountUSDC6: bigint
			meta: { currencyFiat: number | bigint }
		}>
		pages += 1
		if (!page || page.length === 0) break

		let stopPaging = false
		for (const tx of page) {
			const ts = Number(tx.timestamp)
			if (!Number.isFinite(ts) || ts <= 0) continue
			/** Pages are newest-first; entries older than the selected local day end paging early. */
			if (ts < bounds.startSec) {
				stopPaging = true
				break
			}
			if (ts > bounds.endSec) continue

			const catNorm = normalizeIndexerTxCategoryHex(tx.txCategory)
			if (INDEXER_TX_TOPUP_CATEGORIES.has(catNorm)) continue
			if (shouldSkipSalesOverviewRow({ txCategory: tx.txCategory, payee: tx.payee })) continue
			if (catNorm === TX_MERCHANT_PAY_TIP_UPDATED || catNorm === TX_TIP_LEDGER_CATEGORY) continue
			if (catNorm === TX_TERMINAL_RESET_LEDGER_CATEGORY) continue

			const titleLc = parseDisplayTitle(tx.displayJson)
			if (titleLc.includes('terminal settlement')) continue

			const fiatH = fiat6Human(tx.finalRequestAmountFiat6)
			const usdcH = usdc6Human(tx.finalRequestAmountUSDC6)
			const ccy =
				typeof tx.meta?.currencyFiat === 'bigint'
					? currencyFiatToLabel(Number(tx.meta.currencyFiat))
					: currencyFiatToLabel(Number(tx.meta?.currencyFiat ?? 0))

			if (titleLc === 'aa to eoa') continue

			if (titleLc === TITLE_USDC_MERCHANT_CHARGE) {
				buckets.chargeLikeRowCount += 1
				if (usdcH > 0) buckets.usdcSubtotal += usdcH
				continue
			}

			if (titleLc === TITLE_NFC_MERCHANT_PAYMENT) {
				buckets.chargeLikeRowCount += 1
				if (fiatH > 0) addToBucket(buckets.cardSubtotalsByCurrency, ccy, fiatH)
				continue
			}

			if (fiatH > 0 || usdcH > 0) {
				buckets.chargeLikeRowCount += 1
				if (fiatH > 0) addToBucket(buckets.cashSubtotalsByCurrency, ccy, fiatH)
				else if (usdcH > 0 && ccy === 'USDC') buckets.usdcSubtotal += usdcH
				else if (usdcH > 0) addToBucket(buckets.cashSubtotalsByCurrency, 'USDC', usdcH)
			}
		}
		if (stopPaging) break

		offset += BigInt(page.length)
		const oldest = Number(page[page.length - 1]?.timestamp ?? 0n)
		if (oldest < bounds.startSec - 86400 * 14) break
		if (page.length < Number(pageLimit)) break
	}

	return buckets
}

/** Approximate USD gross from oracle map (`currencyData` from DaemonProvider): CAD entry ≈ USD per 1 CAD. */
export function approximateUsdGrossFromBuckets(
	buckets: SalesOverviewLedgerBuckets,
	oracle: { CAD?: number; EUR?: number; JPY?: number }
): number {
	const cadUsd = oracle.CAD && oracle.CAD > 0 ? oracle.CAD : 1 / 1.35
	let sum = buckets.usdcSubtotal
	const sumMap = (m: Record<string, number>) => {
		for (const [ccy, amt] of Object.entries(m)) {
			if (!(amt > 0)) continue
			const u = ccy.toUpperCase()
			if (u === 'USD' || u === 'USDC') sum += amt
			else if (u === 'CAD') sum += amt * cadUsd
			else if (u === 'EUR' && oracle.EUR && oracle.EUR > 0) sum += amt / oracle.EUR
			else if (u === 'JPY' && oracle.JPY && oracle.JPY > 0) sum += amt / oracle.JPY
			else sum += amt * cadUsd
		}
	}
	sumMap(buckets.cardSubtotalsByCurrency)
	sumMap(buckets.cashSubtotalsByCurrency)
	return Number.isFinite(sum) ? sum : 0
}
