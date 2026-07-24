/**
 * Referral USDC earnings: ClaimableAccrued income history for /wallet/referral-registry.
 * Total earned = claimable + claimed (from role snapshot); this module loads per-item accruals.
 * Merchant EOA comes from same-tx PaidBUnitConsumed.payer (card owner / fee payer).
 */
import { ethers } from 'ethers'
import {
	CONET_BUNIT_AIRDROP_ADDRESS,
	CONET_REFERRAL_REGISTRY_VAULT_V1,
	CONET_REFERRAL_REGISTRY_VAULT_V1_DEPLOY_BLOCK,
} from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const EARNINGS_TTL_MS = 30_000
const LOG_CHUNK_BLOCKS = 4_500
const LOCAL_CACHE_PREFIX = 'beamio:referral:earnings:v2:'

const VAULT_EARNINGS_ABI = [
	'event ClaimableAccrued(bytes32 indexed settlementId, address indexed account, uint256 amount)',
] as const

const PAID_BUNIT_CONSUMED_ABI = [
	'event PaidBUnitConsumed(address indexed payer, uint256 paidBurned, uint256 usdcAmount, bytes32 indexed sourceHash, uint256 kind)',
] as const

export type ReferralIncomeItem = {
	settlementId: string
	amountUsdc6: string
	blockNumber: number
	transactionHash: string
	timestampMs: number
	/** Fee payer from PaidBUnitConsumed — merchant program card owner for charge/top-up. */
	merchantEoa?: string
	/** Wallet credited by ClaimableAccrued (L0 or L1). */
	beneficiaryEoa?: string
}

export type ReferralEarningsSnapshot = {
	eoa: string
	items: ReferralIncomeItem[]
	scannedToBlock: number
	fetchedAt: number
}

export type ReferralEarningsResult =
	| { ok: true; snapshot: ReferralEarningsSnapshot }
	| { ok: false; error: string }

type CacheEntry = {
	snapshot: ReferralEarningsSnapshot
	fetchedAt: number
}

const memoryCache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<ReferralEarningsResult>>()
let rpcQueue: Promise<void> = Promise.resolve()

function cacheKey(eoa: string): string {
	return `${LOCAL_CACHE_PREFIX}${eoa.toLowerCase()}`
}

function enqueueRpc<T>(work: () => Promise<T>): Promise<T> {
	const next = rpcQueue.then(work, work)
	rpcQueue = next.then(
		() => undefined,
		() => undefined,
	)
	return next
}

export function readCachedReferralEarnings(eoa: string): ReferralEarningsSnapshot | null {
	try {
		const raw = localStorage.getItem(cacheKey(eoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as ReferralEarningsSnapshot
		if (parsed.eoa?.toLowerCase() !== eoa.toLowerCase() || !Array.isArray(parsed.items)) return null
		return parsed
	} catch {
		return null
	}
}

function savePersistent(snapshot: ReferralEarningsSnapshot): void {
	try {
		localStorage.setItem(cacheKey(snapshot.eoa), JSON.stringify(snapshot))
	} catch {
		// ignore quota / private mode
	}
}

export function formatReferralUsdcAmount6(raw: string | bigint): string {
	try {
		const n = Number(ethers.formatUnits(raw, 6))
		if (!Number.isFinite(n)) return '0.0000'
		return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
	} catch {
		return '0.0000'
	}
}

export function sumUsdc6(...parts: Array<string | undefined | null>): string {
	let total = 0n
	for (const part of parts) {
		if (!part) continue
		try {
			total += BigInt(part)
		} catch {
			// skip malformed
		}
	}
	return total.toString()
}

function mergeItems(existing: ReferralIncomeItem[], incoming: ReferralIncomeItem[]): ReferralIncomeItem[] {
	const map = new Map<string, ReferralIncomeItem>()
	for (const item of existing) {
		map.set(`${item.transactionHash}:${item.settlementId}:${item.amountUsdc6}`, item)
	}
	for (const item of incoming) {
		const key = `${item.transactionHash}:${item.settlementId}:${item.amountUsdc6}`
		const prev = map.get(key)
		map.set(key, {
			...prev,
			...item,
			merchantEoa: item.merchantEoa || prev?.merchantEoa,
			beneficiaryEoa: item.beneficiaryEoa || prev?.beneficiaryEoa,
			timestampMs: item.timestampMs || prev?.timestampMs || 0,
		})
	}
	return [...map.values()].sort((a, b) => b.blockNumber - a.blockNumber || b.timestampMs - a.timestampMs)
}

async function loadBlockTimestamps(blockNumbers: number[]): Promise<Map<number, number>> {
	const unique = [...new Set(blockNumbers)]
	const out = new Map<number, number>()
	for (const blockNumber of unique) {
		try {
			const block = await enqueueRpc(() => conetDepinProvider.getBlock(blockNumber))
			if (block?.timestamp) out.set(blockNumber, Number(block.timestamp) * 1000)
		} catch {
			// leave missing; UI shows em dash via time helper
		}
	}
	return out
}

/** Map settlementId (sourceHash) → merchant/payer from PaidBUnitConsumed in the same consume tx. */
async function resolveMerchantsBySettlement(
	items: Array<{ settlementId: string; transactionHash: string; merchantEoa?: string }>,
): Promise<Map<string, string>> {
	const out = new Map<string, string>()
	const needTx = new Set<string>()
	for (const item of items) {
		if (item.merchantEoa && ethers.isAddress(item.merchantEoa)) {
			out.set(item.settlementId.toLowerCase(), ethers.getAddress(item.merchantEoa))
			continue
		}
		if (item.transactionHash) needTx.add(item.transactionHash.toLowerCase())
	}
	if (needTx.size === 0) return out

	const iface = new ethers.Interface(PAID_BUNIT_CONSUMED_ABI)
	const airdropLower = CONET_BUNIT_AIRDROP_ADDRESS.toLowerCase()
	for (const txHash of needTx) {
		try {
			const receipt = await enqueueRpc(() => conetDepinProvider.getTransactionReceipt(txHash))
			if (!receipt?.logs?.length) continue
			for (const log of receipt.logs) {
				if ((log.address || '').toLowerCase() !== airdropLower) continue
				try {
					const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
					if (!parsed || parsed.name !== 'PaidBUnitConsumed') continue
					const sourceHash = String(parsed.args.sourceHash ?? '').toLowerCase()
					const payer = ethers.getAddress(String(parsed.args.payer ?? ''))
					if (sourceHash && payer && payer !== ethers.ZeroAddress) {
						out.set(sourceHash, payer)
					}
				} catch {
					// not this event
				}
			}
		} catch {
			// keep missing merchant; UI shows unavailable
		}
	}
	return out
}

async function scanClaimableAccrued(
	eoa: string,
	fromBlock: number,
	toBlock: number,
): Promise<Array<{ settlementId: string; amountUsdc6: string; blockNumber: number; transactionHash: string }>> {
	const vault = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, VAULT_EARNINGS_ABI, conetDepinProvider)
	const accountTopic = ethers.zeroPadValue(eoa, 32)
	const rows: Array<{ settlementId: string; amountUsdc6: string; blockNumber: number; transactionHash: string }> = []
	for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_BLOCKS) {
		const end = Math.min(start + LOG_CHUNK_BLOCKS - 1, toBlock)
		const logs = await enqueueRpc(() =>
			vault.queryFilter(vault.filters.ClaimableAccrued(null, eoa), start, end),
		)
		for (const log of logs) {
			if (!('args' in log) || !log.args) continue
			const settlementId = String(log.args.settlementId ?? log.topics?.[1] ?? '')
			const amount = log.args.amount?.toString?.() ?? '0'
			if (!settlementId || !log.transactionHash) continue
			// Prefer filter match; still guard topic account when present
			if (log.topics?.[2] && log.topics[2].toLowerCase() !== accountTopic.toLowerCase()) continue
			rows.push({
				settlementId,
				amountUsdc6: amount,
				blockNumber: log.blockNumber,
				transactionHash: log.transactionHash,
			})
		}
	}
	return rows
}

export async function fetchReferralEarnings(
	rawEoa: string,
	options: { force?: boolean } = {},
): Promise<ReferralEarningsResult> {
	let eoa: string
	try {
		eoa = ethers.getAddress(rawEoa.trim())
	} catch {
		return { ok: false, error: 'The current wallet address is unavailable.' }
	}

	const key = eoa.toLowerCase()
	const cached = memoryCache.get(key)
	if (!options.force && cached && Date.now() - cached.fetchedAt < EARNINGS_TTL_MS) {
		const needsMerchant = cached.snapshot.items.some((item) => !item.merchantEoa)
		if (!needsMerchant) return { ok: true, snapshot: cached.snapshot }
	}
	if (!options.force) {
		const persisted = readCachedReferralEarnings(eoa)
		if (persisted && Date.now() - persisted.fetchedAt < EARNINGS_TTL_MS) {
			const needsMerchant = persisted.items.some((item) => !item.merchantEoa)
			if (!needsMerchant) {
				memoryCache.set(key, { snapshot: persisted, fetchedAt: persisted.fetchedAt })
				return { ok: true, snapshot: persisted }
			}
		}
	}

	const existing = inFlight.get(key)
	if (existing) return existing

	const request = (async (): Promise<ReferralEarningsResult> => {
		try {
			const previous = memoryCache.get(key)?.snapshot ?? readCachedReferralEarnings(eoa)
			const head = await enqueueRpc(() => conetDepinProvider.getBlockNumber())
			const floor = CONET_REFERRAL_REGISTRY_VAULT_V1_DEPLOY_BLOCK
			const fromBlock =
				!options.force && previous && previous.scannedToBlock >= floor
					? Math.min(previous.scannedToBlock + 1, head)
					: floor

			let items = previous?.items ?? []
			if (fromBlock <= head) {
				const raw = await scanClaimableAccrued(eoa, fromBlock, head)
				const timestamps = await loadBlockTimestamps(raw.map((r) => r.blockNumber))
				const incoming: ReferralIncomeItem[] = raw.map((r) => ({
					...r,
					beneficiaryEoa: eoa,
					timestampMs: timestamps.get(r.blockNumber) ?? 0,
				}))
				items = mergeItems(items, incoming)
			}

			const merchantBySettlement = await resolveMerchantsBySettlement(items)
			items = items.map((item) => {
				const merchant =
					merchantBySettlement.get(item.settlementId.toLowerCase()) ??
					(item.merchantEoa && ethers.isAddress(item.merchantEoa)
						? ethers.getAddress(item.merchantEoa)
						: undefined)
				return {
					...item,
					beneficiaryEoa: item.beneficiaryEoa ?? eoa,
					...(merchant ? { merchantEoa: merchant } : {}),
				}
			})

			const snapshot: ReferralEarningsSnapshot = {
				eoa,
				items,
				scannedToBlock: head,
				fetchedAt: Date.now(),
			}
			memoryCache.set(key, { snapshot, fetchedAt: snapshot.fetchedAt })
			savePersistent(snapshot)
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[ReferralRegistryEarnings] scan failed', error)
			const previous = memoryCache.get(key)?.snapshot ?? readCachedReferralEarnings(eoa)
			if (previous) return { ok: true, snapshot: previous }
			return { ok: false, error: 'Could not load referral USDC income from CoNET.' }
		}
	})()

	inFlight.set(key, request)
	try {
		return await request
	} finally {
		inFlight.delete(key)
	}
}

const VAULT_BALANCE_ABI = [
	'function claimableConetUsdc(address) view returns (uint256)',
	'function claimedConetUsdc(address) view returns (uint256)',
] as const

/** L0 / L1 (or any accruee): total earned + per-merchant accrual credited to this account.
 * Admin L0 panel uses pool semantics (L0 + L1 shares) via fetchAdminL0ReferralUsdcBreakdown. */
export type ReferralBeneficiaryUsdcRow = {
	account: string
	/** claimable + claimed for this account (beneficiary mode), or L0+L1 pool total (admin L0 mode). */
	totalUsdc6: string
	/** Accrued TO this account (beneficiary), or pool by merchant (admin L0). */
	byMerchant: Record<string, string>
	fetchedAt: number
}

export type ReferralBeneficiaryUsdcBreakdown = {
	byAccount: Record<string, ReferralBeneficiaryUsdcRow>
	fetchedAt: number
}

const beneficiaryBreakdownMemory = new Map<string, { snapshot: ReferralBeneficiaryUsdcBreakdown; fetchedAt: number }>()
const beneficiaryBreakdownInFlight = new Map<string, Promise<ReferralBeneficiaryUsdcResult>>()
const BENEFICIARY_BREAKDOWN_CACHE_PREFIX = 'beamio:referral:beneficiary-usdc:v1:'

export type ReferralBeneficiaryUsdcResult =
	| { ok: true; snapshot: ReferralBeneficiaryUsdcBreakdown }
	| { ok: false; error: string }

/** @deprecated Use ReferralBeneficiaryUsdcRow */
export type AdminL0ReferralUsdcRow = ReferralBeneficiaryUsdcRow & { l0: string }
/** @deprecated Use ReferralBeneficiaryUsdcBreakdown */
export type AdminL0ReferralUsdcBreakdown = ReferralBeneficiaryUsdcBreakdown & {
	byL0: Record<string, AdminL0ReferralUsdcRow>
}
/** @deprecated Use ReferralBeneficiaryUsdcResult */
export type AdminL0ReferralUsdcResult = ReferralBeneficiaryUsdcResult

function beneficiaryBreakdownCacheKey(viewerEoa: string, accountKeys: string[]): string {
	return `${BENEFICIARY_BREAKDOWN_CACHE_PREFIX}${viewerEoa.toLowerCase()}:${accountKeys.join(',')}`
}

export function readCachedReferralBeneficiaryUsdc(
	viewerEoa: string,
	accountAddresses: string[],
): ReferralBeneficiaryUsdcBreakdown | null {
	try {
		const accountKeys = accountAddresses.map((a) => ethers.getAddress(a).toLowerCase()).sort()
		const raw = localStorage.getItem(beneficiaryBreakdownCacheKey(viewerEoa, accountKeys))
		if (!raw) return null
		const parsed = JSON.parse(raw) as ReferralBeneficiaryUsdcBreakdown
		if (!parsed?.byAccount || typeof parsed.byAccount !== 'object') return null
		return parsed
	} catch {
		return null
	}
}

/** @deprecated Prefer reading via fetchAdminL0ReferralUsdcBreakdown memory/local cache (pool semantics). */
export function readCachedAdminL0ReferralUsdc(
	adminEoa: string,
	l0RowsOrAddresses: Array<{ l0: string; l1s?: string[] }> | string[],
): ReferralBeneficiaryUsdcBreakdown | null {
	try {
		const admin = ethers.getAddress(adminEoa)
		const rows: Array<{ l0: string; l1s: string[] }> = (Array.isArray(l0RowsOrAddresses) ? l0RowsOrAddresses : []).map(
			(entry) => {
				if (typeof entry === 'string') {
					return { l0: ethers.getAddress(entry), l1s: [] }
				}
				return {
					l0: ethers.getAddress(entry.l0),
					l1s: (entry.l1s ?? []).filter((a) => ethers.isAddress(a)).map((a) => ethers.getAddress(a)),
				}
			},
		)
		const cacheAccountKeys = rows
			.map((r) => {
				const l1Key = r.l1s.map((a) => a.toLowerCase()).sort().join('+')
				return `${r.l0.toLowerCase()}#${l1Key}`
			})
			.sort()
		const memKey = `beamio:referral:admin-l0-pool-usdc:v1:${admin.toLowerCase()}:${cacheAccountKeys.join(',')}`
		const mem = beneficiaryBreakdownMemory.get(memKey)
		if (mem) return mem.snapshot
		const raw = localStorage.getItem(memKey)
		if (!raw) return null
		const parsed = JSON.parse(raw) as ReferralBeneficiaryUsdcBreakdown
		if (!parsed?.byAccount || typeof parsed.byAccount !== 'object') return null
		return parsed
	} catch {
		return null
	}
}

function saveBeneficiaryBreakdown(
	viewerEoa: string,
	accountKeys: string[],
	snapshot: ReferralBeneficiaryUsdcBreakdown,
): void {
	try {
		localStorage.setItem(beneficiaryBreakdownCacheKey(viewerEoa, accountKeys), JSON.stringify(snapshot))
	} catch {
		// ignore
	}
}

function aggregateMerchantUsdc(items: ReferralIncomeItem[], merchantAllow: Set<string>): Record<string, string> {
	const totals = new Map<string, bigint>()
	for (const merchant of merchantAllow) {
		totals.set(merchant.toLowerCase(), 0n)
	}
	for (const item of items) {
		if (!item.merchantEoa || !ethers.isAddress(item.merchantEoa)) continue
		const key = item.merchantEoa.toLowerCase()
		if (!totals.has(key)) continue
		try {
			totals.set(key, (totals.get(key) ?? 0n) + BigInt(item.amountUsdc6))
		} catch {
			// skip malformed
		}
	}
	const out: Record<string, string> = {}
	for (const [lower, amount] of totals) {
		try {
			out[ethers.getAddress(lower)] = amount.toString()
		} catch {
			out[lower] = amount.toString()
		}
	}
	return out
}

/**
 * Total earned USDC for each beneficiary + per-merchant accrual credited to that account.
 * Used by admin→L0 and L0→L1 member panels.
 */
export async function fetchReferralBeneficiaryUsdcBreakdown(
	viewerEoaRaw: string,
	rows: Array<{ account: string; merchants: string[] }>,
	options: { force?: boolean } = {},
): Promise<ReferralBeneficiaryUsdcResult> {
	let viewerEoa: string
	try {
		viewerEoa = ethers.getAddress(viewerEoaRaw.trim())
	} catch {
		return { ok: false, error: 'The current wallet address is unavailable.' }
	}

	const normalizedRows = rows
		.map((row) => {
			try {
				return {
					account: ethers.getAddress(row.account),
					merchants: row.merchants
						.filter((m) => ethers.isAddress(m))
						.map((m) => ethers.getAddress(m)),
				}
			} catch {
				return null
			}
		})
		.filter((row): row is { account: string; merchants: string[] } => Boolean(row))
		.sort((a, b) => a.account.localeCompare(b.account))

	const accountKeys = normalizedRows.map((r) => r.account.toLowerCase())
	const memKey = beneficiaryBreakdownCacheKey(viewerEoa, accountKeys)
	const cached = beneficiaryBreakdownMemory.get(memKey)
	if (!options.force && cached && Date.now() - cached.fetchedAt < EARNINGS_TTL_MS) {
		return { ok: true, snapshot: cached.snapshot }
	}
	if (!options.force) {
		const persisted = readCachedReferralBeneficiaryUsdc(viewerEoa, accountKeys)
		if (persisted && Date.now() - persisted.fetchedAt < EARNINGS_TTL_MS) {
			beneficiaryBreakdownMemory.set(memKey, { snapshot: persisted, fetchedAt: persisted.fetchedAt })
			return { ok: true, snapshot: persisted }
		}
	}

	const existing = beneficiaryBreakdownInFlight.get(memKey)
	if (existing) return existing

	const request = (async (): Promise<ReferralBeneficiaryUsdcResult> => {
		try {
			const vault = new ethers.Contract(CONET_REFERRAL_REGISTRY_VAULT_V1, VAULT_BALANCE_ABI, conetDepinProvider)
			const byAccount: Record<string, ReferralBeneficiaryUsdcRow> = {}
			const now = Date.now()

			for (const row of normalizedRows) {
				const [claimable, claimed] = await Promise.all([
					enqueueRpc(() => vault.claimableConetUsdc(row.account) as Promise<bigint>),
					enqueueRpc(() => vault.claimedConetUsdc(row.account) as Promise<bigint>),
				])
				const totalUsdc6 = sumUsdc6(claimable.toString(), claimed.toString())
				const earnings = await fetchReferralEarnings(row.account, options)
				const merchantAllow = new Set(row.merchants.map((m) => m.toLowerCase()))
				const byMerchant = earnings.ok
					? aggregateMerchantUsdc(earnings.snapshot.items, merchantAllow)
					: Object.fromEntries(row.merchants.map((m) => [m, '0']))

				byAccount[row.account.toLowerCase()] = {
					account: row.account,
					totalUsdc6,
					byMerchant,
					fetchedAt: now,
				}
			}

			const snapshot: ReferralBeneficiaryUsdcBreakdown = { byAccount, fetchedAt: now }
			beneficiaryBreakdownMemory.set(memKey, { snapshot, fetchedAt: now })
			saveBeneficiaryBreakdown(viewerEoa, accountKeys, snapshot)
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[ReferralRegistryBeneficiaryUsdc] load failed', error)
			const previous =
				beneficiaryBreakdownMemory.get(memKey)?.snapshot ??
				readCachedReferralBeneficiaryUsdc(viewerEoa, accountKeys)
			if (previous) return { ok: true, snapshot: previous }
			return { ok: false, error: 'Could not load referral USDC totals from CoNET.' }
		}
	})()

	beneficiaryBreakdownInFlight.set(memKey, request)
	try {
		return await request
	} finally {
		beneficiaryBreakdownInFlight.delete(memKey)
	}
}

function sumMerchantMap(byMerchant: Record<string, string>): string {
	let total = 0n
	for (const amount of Object.values(byMerchant)) {
		try {
			total += BigInt(amount)
		} catch {
			// skip
		}
	}
	return total.toString()
}

/**
 * Admin → L0 panel: totals are the **full rebate pool** allocated to that L0
 * (`totalRebate` = L0 wallet + shared L1 portions), not L0-only claimable.
 */
export async function fetchAdminL0ReferralUsdcBreakdown(
	adminEoaRaw: string,
	l0Rows: Array<{ l0: string; merchants: string[]; l1s?: string[] }>,
	options: { force?: boolean } = {},
): Promise<ReferralBeneficiaryUsdcResult> {
	let adminEoa: string
	try {
		adminEoa = ethers.getAddress(adminEoaRaw.trim())
	} catch {
		return { ok: false, error: 'The current wallet address is unavailable.' }
	}

	const normalizedRows = l0Rows
		.map((row) => {
			try {
				const l0 = ethers.getAddress(row.l0)
				const merchants = row.merchants
					.filter((m) => ethers.isAddress(m))
					.map((m) => ethers.getAddress(m))
				const l1s = (row.l1s ?? [])
					.filter((a) => ethers.isAddress(a))
					.map((a) => ethers.getAddress(a))
					.filter((a) => a.toLowerCase() !== l0.toLowerCase())
				return { l0, merchants, l1s }
			} catch {
				return null
			}
		})
		.filter((row): row is { l0: string; merchants: string[]; l1s: string[] } => Boolean(row))
		.sort((a, b) => a.l0.localeCompare(b.l0))

	const cacheAccountKeys = normalizedRows.map((r) => {
		const l1Key = r.l1s.map((a) => a.toLowerCase()).sort().join('+')
		return `${r.l0.toLowerCase()}#${l1Key}`
	})
	const memKey = `beamio:referral:admin-l0-pool-usdc:v1:${adminEoa.toLowerCase()}:${cacheAccountKeys.join(',')}`
	const cached = beneficiaryBreakdownMemory.get(memKey)
	if (!options.force && cached && Date.now() - cached.fetchedAt < EARNINGS_TTL_MS) {
		return { ok: true, snapshot: cached.snapshot }
	}

	const existing = beneficiaryBreakdownInFlight.get(memKey)
	if (existing) return existing

	const request = (async (): Promise<ReferralBeneficiaryUsdcResult> => {
		try {
			const byAccount: Record<string, ReferralBeneficiaryUsdcRow> = {}
			const now = Date.now()

			for (const row of normalizedRows) {
				const beneficiaries = [row.l0, ...row.l1s]
				const poolItems: ReferralIncomeItem[] = []
				for (const account of beneficiaries) {
					const earnings = await fetchReferralEarnings(account, options)
					if (!earnings.ok) continue
					for (const item of earnings.snapshot.items) {
						poolItems.push({
							...item,
							beneficiaryEoa: item.beneficiaryEoa ?? account,
						})
					}
				}
				const merchantAllow = new Set(row.merchants.map((m) => m.toLowerCase()))
				const byMerchant =
					row.merchants.length > 0
						? aggregateMerchantUsdc(poolItems, merchantAllow)
						: (() => {
								// No merchant allowlist: sum all pool items by merchant key when known.
								const allow = new Set<string>()
								for (const item of poolItems) {
									if (item.merchantEoa && ethers.isAddress(item.merchantEoa)) {
										allow.add(item.merchantEoa.toLowerCase())
									}
								}
								return aggregateMerchantUsdc(poolItems, allow)
							})()
				const totalUsdc6 = sumMerchantMap(byMerchant)

				byAccount[row.l0.toLowerCase()] = {
					account: row.l0,
					totalUsdc6,
					byMerchant,
					fetchedAt: now,
				}
			}

			const snapshot: ReferralBeneficiaryUsdcBreakdown = { byAccount, fetchedAt: now }
			beneficiaryBreakdownMemory.set(memKey, { snapshot, fetchedAt: now })
			try {
				localStorage.setItem(memKey, JSON.stringify(snapshot))
			} catch {
				// ignore
			}
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[ReferralRegistryAdminL0PoolUsdc] load failed', error)
			const previous = beneficiaryBreakdownMemory.get(memKey)?.snapshot
			if (previous) return { ok: true, snapshot: previous }
			try {
				const raw = localStorage.getItem(memKey)
				if (raw) {
					const parsed = JSON.parse(raw) as ReferralBeneficiaryUsdcBreakdown
					if (parsed?.byAccount) return { ok: true, snapshot: parsed }
				}
			} catch {
				// ignore
			}
			return { ok: false, error: 'Could not load L0 rebate pool USDC totals from CoNET.' }
		}
	})()

	beneficiaryBreakdownInFlight.set(memKey, request)
	try {
		return await request
	} finally {
		beneficiaryBreakdownInFlight.delete(memKey)
	}
}

export function getReferralBeneficiaryUsdcRow(
	snapshot: ReferralBeneficiaryUsdcBreakdown | null | undefined,
	account: string,
): ReferralBeneficiaryUsdcRow | null {
	if (!snapshot || !ethers.isAddress(account)) return null
	return snapshot.byAccount[ethers.getAddress(account).toLowerCase()] ?? null
}

export function getReferralBeneficiaryMerchantUsdc(
	row: ReferralBeneficiaryUsdcRow | null | undefined,
	merchant: string,
): string {
	if (!row || !ethers.isAddress(merchant)) return '0'
	const checksum = ethers.getAddress(merchant)
	return row.byMerchant[checksum] ?? row.byMerchant[checksum.toLowerCase()] ?? '0'
}

/** @deprecated Use getReferralBeneficiaryUsdcRow */
export function getAdminL0UsdcRow(
	snapshot: ReferralBeneficiaryUsdcBreakdown | null | undefined,
	l0: string,
): ReferralBeneficiaryUsdcRow | null {
	return getReferralBeneficiaryUsdcRow(snapshot, l0)
}

/** @deprecated Use getReferralBeneficiaryMerchantUsdc */
export function getAdminL0MerchantUsdc(
	row: ReferralBeneficiaryUsdcRow | null | undefined,
	merchant: string,
): string {
	return getReferralBeneficiaryMerchantUsdc(row, merchant)
}
