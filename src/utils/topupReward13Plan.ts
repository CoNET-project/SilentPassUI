import { ethers } from 'ethers'
import {
	getCardMetadataFromApi,
	getCardOwner,
	getCardsOfOwnerWithDetailsForProfile,
	quoteCurrencyAmountInUSDC,
	quotePointsForUSDC,
	quotePointsFromDepositUsdc6,
	USDC2Token,
} from '@/services/BeamioCard'
import { CONET_MAINNET_CHAIN_ID, CONET_USDC } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import { getCardFactoryGatewayForEip712 } from '@/utils/beamioUserCardChain'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'

/**
 * #13 Reward PT is held on the deployed Consumer AA (factory + getCode), not EOA.
 * Prefer chain-resolved AA over `profile.aaAccount` (may be missing or a V2 CREATE2
 * prediction with no code while balances sit on the V1 AA).
 * Never return an address without bytecode — balanceOf(empty) is 0 and paints CA$ 0.00.
 */
export async function resolveAaHoldingReward13(
	profile: profile,
	aaHint?: string | null,
): Promise<string | null> {
	const hintRaw =
		(aaHint && ethers.isAddress(aaHint) ? aaHint : null) ||
		(profile?.aaAccount && ethers.isAddress(profile.aaAccount) ? profile.aaAccount : null)
	const hint = hintRaw ? ethers.getAddress(hintRaw) : null

	const eoaRaw = typeof profile?.keyID === 'string' ? profile.keyID.trim() : ''
	if (eoaRaw && ethers.isAddress(eoaRaw)) {
		try {
			const factoryAa = await resolveBeamioAaOnConet(conetDepinProvider, ethers.getAddress(eoaRaw))
			if (factoryAa) return factoryAa
		} catch {
			/* fall through to hint */
		}
	}
	if (!hint) return null
	try {
		const code = await conetDepinProvider.getCode(hint)
		if (code && code !== '0x' && code.length > 2) return hint
	} catch {
		/* untrusted — do not use unverified hint */
	}
	return null
}

/** @deprecated Legacy two-step redeem; atomic container uses TOPUP_WITH_REWARD13_CONTAINER_EIP712_TYPES. */
export const REDEEM_REWARD13_EIP712_TYPES: Record<string, Array<{ name: string; type: string }>> = {
	RedeemReward13ForUsdc: [
		{ name: 'card', type: 'address' },
		{ name: 'userEOA', type: 'address' },
		{ name: 'pointsCost', type: 'uint256' },
		{ name: 'usdcReward6', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

export const CONVERT_REWARD13_EIP712_TYPES: Record<string, Array<{ name: string; type: string }>> = {
	ConvertReward13: [
		{ name: 'card', type: 'address' },
		{ name: 'userEOA', type: 'address' },
		{ name: 'kind', type: 'uint8' },
		{ name: 'burn13', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

export const TOPUP_WITH_REWARD13_CONTAINER_EIP712_TYPES: Record<
	string,
	Array<{ name: string; type: string }>
> = {
	TopupWithReward13Container: [
		{ name: 'targetCard', type: 'address' },
		{ name: 'userEOA', type: 'address' },
		{ name: 'sameStoreBurn13', type: 'uint256' },
		{ name: 'peerUsdcCredited6', type: 'uint256' },
		{ name: 'pointsFromPeerUsdc6', type: 'uint256' },
		{ name: 'minTotalPointsOut0', type: 'uint256' },
		{ name: 'peersHash', type: 'bytes32' },
		{ name: 'cashUsdc6', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

const CARD_IFACE = new ethers.Interface([
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function rewardEscrowUsdc6() view returns (uint256)',
	'function currency() view returns (uint8)',
	'function pointsUnitPriceInCurrencyE6() view returns (uint256)',
	'function convertReward13ToUsdcRatioE6() view returns (uint256)',
	'function quoteUsdcWithdrawForFiat6(uint256 fiatAmount6) view returns (uint256)',
])

const ERC20_IFACE = new ethers.Interface(['function balanceOf(address) view returns (uint256)'])

const ENUM_TO_CURRENCY = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const

export type Reward13CoverKind = 'toProgramPoints' | 'toUsdc'

export type Reward13Row = {
	cardAddress: string
	name: string
	icon?: string
	/** Full AA #13 balance (not escrow-capped). */
	pointsBalance6: bigint
	escrowUsdc6: bigint
	/** Full-balance on-chain USDC quote (peer) or escrow-capped quote (same-store). */
	quotedUsdc6: bigint
	/** Fail-closed max USDC this row can pay: min(quote, escrow, ERC20). */
	redeemableUsdc6: bigint
	/**
	 * Usable burn #13 after escrow + card USDC liquidity.
	 * Same-store and peer both size via findBurn13ForUsdcTarget when capped.
	 */
	redeemablePoints6: bigint
	supportsRedeem: boolean
	coverKind: Reward13CoverKind
	/**
	 * Same-store: true after on-chain escrow+liquidity sized redeemable (incl. 0).
	 * Preview/hydrate rows stay false so UI does not treat escrow-unknown as settled.
	 */
	escrowSized?: boolean
}

export type CoverLeg = {
	cardAddress: string
	pointsCost: bigint
	usdcReward6: bigint
	name: string
	kind: Reward13CoverKind
}

export function formatPtsHuman(points6: bigint): string {
	const n = Number(ethers.formatUnits(points6, 6))
	if (!Number.isFinite(n)) return '0.00'
	return n.toFixed(2)
}

export function sumUsdc6(legs: CoverLeg[]): bigint {
	return legs.reduce((acc, leg) => acc + leg.usdcReward6, 0n)
}

export async function quoteFiat6ToUsdc6(
	cardAddress: string,
	currencyCode: string,
	fiatHuman: string,
): Promise<{ usdc6: bigint; usdc: string }> {
	return quoteCurrencyAmountInUSDC(cardAddress, currencyCode, fiatHuman)
}

export async function readEoaConetUsdc6(eoa: string): Promise<bigint | null> {
	try {
		const c = new ethers.Contract(CONET_USDC, ERC20_IFACE, conetDepinProvider)
		return (await c.balanceOf(eoa)) as bigint
	} catch {
		return null
	}
}

/**
 * Deterministic peersHash = keccak256(concat(solidityPacked(card, burn13, usdcOut6)…))
 * sorted by card address. Empty → ZeroHash. Must match Cluster.
 */
export function hashTopupPeers(
	peers: Array<{ cardAddress: string; burn13: bigint; usdcOut6: bigint }>,
): string {
	if (peers.length === 0) return ethers.ZeroHash
	const sorted = peers
		.map((p) => ({
			cardAddress: ethers.getAddress(p.cardAddress),
			burn13: p.burn13,
			usdcOut6: p.usdcOut6,
		}))
		.sort((a, b) => a.cardAddress.toLowerCase().localeCompare(b.cardAddress.toLowerCase()))
	const chunks = sorted.map((p) =>
		ethers.solidityPacked(['address', 'uint256', 'uint256'], [p.cardAddress, p.burn13, p.usdcOut6]),
	)
	return ethers.keccak256(ethers.concat(chunks))
}

const REWARD13_ROWS_CACHE_TTL_MS = 15_000
const reward13RowsCache = new Map<string, { rows: Reward13Row[]; ts: number }>()
const reward13RowsInflight = new Map<string, Promise<Reward13Row[]>>()
const reward13RowsInflightSubs = new Map<string, Set<(rows: Reward13Row[]) => void>>()
/** Successful same-store balanceOf === 0 (not RPC failure / wrong-AA guess). */
const trustedSameStoreZeroKeys = new Set<string>()

function reward13CacheKey(aa: string, target: string | null): string {
	return `${aa.toLowerCase()}:${(target ?? '').toLowerCase()}`
}

/** True when chain confirmed same-store #13 is 0 for this AA+card (settle cover as 0.00). */
export function isTrustedSameStoreZero(
	aa: string | null | undefined,
	target: string | null | undefined,
): boolean {
	if (!aa || !ethers.isAddress(aa) || !target || !ethers.isAddress(target)) return false
	return trustedSameStoreZeroKeys.has(
		reward13CacheKey(ethers.getAddress(aa), ethers.getAddress(target)),
	)
}

export function peekReward13RowsCache(
	aa: string | null | undefined,
	target: string | null | undefined,
): Reward13Row[] | null {
	if (!aa || !ethers.isAddress(aa)) return null
	const t = target && ethers.isAddress(target) ? ethers.getAddress(target) : null
	return reward13RowsCache.get(reward13CacheKey(ethers.getAddress(aa), t))?.rows ?? null
}

export function mergeReward13Rows(prev: Reward13Row[], incoming: Reward13Row[]): Reward13Row[] {
	const map = new Map(prev.map((r) => [r.cardAddress.toLowerCase(), r]))
	for (const row of incoming) {
		const key = row.cardAddress.toLowerCase()
		const existing = map.get(key)
		// Escrow-sized same-store (incl. usable = 0) always replaces optimistic preview.
		if (row.escrowSized) {
			map.set(key, row)
			continue
		}
		// Never let seed / preview (escrowSized=false) wipe a trusted escrow-sized row.
		if (existing?.escrowSized && !row.escrowSized) {
			if (
				row.coverKind === 'toProgramPoints' &&
				row.pointsBalance6 > existing.pointsBalance6
			) {
				map.set(key, { ...existing, pointsBalance6: row.pointsBalance6 })
			}
			continue
		}
		// Never let a transient empty / failed read wipe a trusted positive #13 balance
		// when the incoming row is not escrow-sized yet.
		if (
			existing &&
			existing.coverKind === 'toProgramPoints' &&
			existing.pointsBalance6 > 0n &&
			row.coverKind === 'toProgramPoints' &&
			row.pointsBalance6 <= 0n
		) {
			map.set(key, {
				...row,
				pointsBalance6: existing.pointsBalance6,
				quotedUsdc6: existing.quotedUsdc6 > row.quotedUsdc6 ? existing.quotedUsdc6 : row.quotedUsdc6,
				redeemableUsdc6: existing.redeemableUsdc6,
				redeemablePoints6: existing.redeemablePoints6,
				escrowUsdc6: existing.escrowUsdc6 > row.escrowUsdc6 ? existing.escrowUsdc6 : row.escrowUsdc6,
				escrowSized: existing.escrowSized,
			})
			continue
		}
		map.set(key, row)
	}
	return [...map.values()]
}

export type Reward13SeedAssets = {
	chargeRewardPoints?: string
	chargeRewardPoints6?: string
}

export function parseReward13Balance6(assets: Reward13SeedAssets | null | undefined): bigint {
	if (!assets) return 0n
	const raw6 = assets.chargeRewardPoints6?.trim()
	if (raw6 && /^\d+$/.test(raw6)) {
		try {
			const bal = BigInt(raw6)
			if (bal > 0n) return bal
		} catch {
			/* fall through to human */
		}
	}
	const human = Number(assets.chargeRewardPoints ?? Number.NaN)
	if (Number.isFinite(human) && human > 0) {
		try {
			return ethers.parseUnits(String(human), 6)
		} catch {
			return 0n
		}
	}
	return 0n
}

/** Prefer the largest trusted #13 among Discover / daemon / cache seeds. Zero is not richest. */
export function pickRichestReward13Seed(
	...sources: Array<Reward13SeedAssets | null | undefined>
): Reward13SeedAssets | null {
	let best6 = 0n
	for (const source of sources) {
		const bal = parseReward13Balance6(source)
		if (bal > best6) best6 = bal
	}
	if (best6 <= 0n) return null
	return { chargeRewardPoints6: best6.toString() }
}

export function seedAssetsFromPoints13Human(
	human: number | null | undefined,
): Reward13SeedAssets | null {
	if (human == null || !Number.isFinite(human) || human <= 0) return null
	return { chargeRewardPoints: String(human) }
}

/**
 * Optimistic same-store row before escrow + liquidity sizing.
 * redeemable stays 0 so Cover / settle do not treat escrow-unknown as full PT.
 */
function previewSameStoreRow(cardAddress: string, bal13: bigint, name?: string): Reward13Row {
	return {
		cardAddress,
		name: name?.trim() || `Program ${cardAddress.slice(0, 6)}…${cardAddress.slice(-4)}`,
		pointsBalance6: bal13,
		escrowUsdc6: 0n,
		quotedUsdc6: 0n,
		redeemableUsdc6: 0n,
		redeemablePoints6: 0n,
		supportsRedeem: false,
		coverKind: 'toProgramPoints',
		escrowSized: false,
	}
}

/** Card-fiat human amount → 6-decimal integer. Empty / invalid → 0n. */
export function parseFiatHumanTo6(fiatHuman: string): bigint {
	const trimmed = fiatHuman.trim()
	if (!trimmed) return 0n
	try {
		return ethers.parseUnits(trimmed, 6)
	} catch {
		const n = Number(trimmed)
		if (!Number.isFinite(n) || n <= 0) return 0n
		try {
			return ethers.parseUnits(n.toFixed(6), 6)
		} catch {
			return 0n
		}
	}
}

/** Sync first-paint row from Discover `getMyAssets` cache. Same-store #13 only. */
export function hydrateSameStoreRowFromAssets(
	cardAddress: string,
	assets: Reward13SeedAssets | null | undefined,
	name?: string,
): Reward13Row | null {
	if (!assets || !ethers.isAddress(cardAddress)) return null
	const bal = parseReward13Balance6(assets)
	if (bal <= 0n) return null
	return previewSameStoreRow(ethers.getAddress(cardAddress), bal, name)
}

/** Sync greedy cover in USDC-6. Same-store first (escrow-capped PT → proportional USDC). */
export function estimateCoverUsdc6(rows: Reward13Row[], needUsdc6: bigint, fiat6 = 0n): bigint {
	if (needUsdc6 <= 0n) return 0n
	const same = rows
		.filter((r) => r.coverKind === 'toProgramPoints' && r.redeemablePoints6 > 0n)
		.slice()
		.sort(sortByRedeemable)
	const other = rows
		.filter((r) => r.coverKind !== 'toProgramPoints' && r.redeemableUsdc6 > 0n)
		.slice()
		.sort(sortByRedeemable)
	let remaining = needUsdc6
	let covered = 0n
	if (fiat6 > 0n) {
		for (const row of same) {
			if (remaining <= 0n) break
			const takePts = row.redeemablePoints6 < fiat6 ? row.redeemablePoints6 : fiat6
			if (takePts <= 0n) continue
			const takeUsdc = (needUsdc6 * takePts) / fiat6
			const take = takeUsdc < remaining ? takeUsdc : remaining
			if (take <= 0n) continue
			covered += take
			remaining -= take
		}
	}
	for (const row of other) {
		if (remaining <= 0n) break
		const take = row.redeemableUsdc6 < remaining ? row.redeemableUsdc6 : remaining
		covered += take
		remaining -= take
	}
	return covered
}

/** Same-store escrow-capped #13 in card fiat: min(amount, redeemablePoints). */
export function estimateSameStoreCoverFiat(rows: Reward13Row[], fiatN: number): number {
	if (!Number.isFinite(fiatN) || fiatN <= 0) return 0
	const same = rows.find((r) => r.coverKind === 'toProgramPoints' && r.redeemablePoints6 > 0n)
	if (!same) return 0
	const pts = Number(ethers.formatUnits(same.redeemablePoints6, 6))
	if (!Number.isFinite(pts) || pts <= 0) return 0
	return Math.min(fiatN, pts)
}

/** Same-store usable burn #13 > 0 after escrow + card USDC liquidity. */
export function sameStoreHasPositiveCover(rows: Reward13Row[]): boolean {
	return rows.some((r) => r.coverKind === 'toProgramPoints' && r.redeemablePoints6 > 0n)
}

/** Same-store #13 was sized against rewardEscrow + card USDC (settle even if usable = 0). */
export function sameStoreEscrowSized(rows: Reward13Row[]): boolean {
	return rows.some((r) => r.coverKind === 'toProgramPoints' && r.escrowSized === true)
}

/** Same-store #13 row present (balance may be 0). Smart Pay cover is settled. */
export function hasSameStoreRow(rows: Reward13Row[]): boolean {
	return rows.some((r) => r.coverKind === 'toProgramPoints')
}

async function quotePeerUsdcForBurn(cardAddress: string, burn13: bigint): Promise<bigint> {
	if (burn13 <= 0n) return 0n
	const card = new ethers.Contract(cardAddress, CARD_IFACE, conetDepinProvider)
	return (await card.quoteUsdcWithdrawForFiat6(burn13)) as bigint
}

/**
 * Cap burn13 so quote(burn) ≤ targetUsdc.
 * Seed with proportional guess from fullBalanceQuote (O(1) RPC), then ≤8 binary
 * steps — never scan full [1, maxBurn] on serial CoNET RPC (hangs Smart Pay spinner).
 */
async function findBurn13ForUsdcTarget(
	cardAddress: string,
	maxBurn: bigint,
	targetUsdc: bigint,
	fullBalanceQuoteUsdc?: bigint,
): Promise<{ burn13: bigint; usdcOut6: bigint } | null> {
	if (maxBurn <= 0n || targetUsdc <= 0n) return null
	const fullQ =
		fullBalanceQuoteUsdc !== undefined && fullBalanceQuoteUsdc > 0n
			? fullBalanceQuoteUsdc
			: await quotePeerUsdcForBurn(cardAddress, maxBurn)
	if (fullQ <= 0n) return null
	if (fullQ <= targetUsdc) return { burn13: maxBurn, usdcOut6: fullQ }

	let lo = 1n
	let hi = (maxBurn * targetUsdc) / fullQ
	if (hi < 1n) hi = 1n
	if (hi > maxBurn) hi = maxBurn
	// Widen hi slightly in case quote is sub-linear.
	const wide = hi + hi / 10n + 1n
	hi = wide < maxBurn ? wide : maxBurn

	let bestBurn = 0n
	let bestUsdc = 0n
	let steps = 0
	const MAX_STEPS = 8
	while (lo <= hi && steps < MAX_STEPS) {
		steps += 1
		const mid = (lo + hi) / 2n
		const q = await quotePeerUsdcForBurn(cardAddress, mid)
		if (q === 0n) {
			hi = mid - 1n
			continue
		}
		if (q <= targetUsdc) {
			bestBurn = mid
			bestUsdc = q
			lo = mid + 1n
		} else {
			hi = mid - 1n
		}
	}
	if (bestBurn <= 0n || bestUsdc <= 0n) {
		// Proportional fail-closed estimate (no more RPC) — good enough for cover UI.
		const approx = (maxBurn * targetUsdc) / fullQ
		if (approx <= 0n) return null
		return { burn13: approx < maxBurn ? approx : maxBurn, usdcOut6: targetUsdc }
	}
	const confirm = await quotePeerUsdcForBurn(cardAddress, bestBurn)
	if (confirm <= 0n || confirm > targetUsdc) {
		return { burn13: bestBurn, usdcOut6: bestUsdc <= targetUsdc ? bestUsdc : targetUsdc }
	}
	return { burn13: bestBurn, usdcOut6: confirm }
}

/** Same-store: map USDC escrow/liquidity cap → usable #13 without binary search. */
function sameStoreRedeemableFromUsdcCap(
	bal13: bigint,
	quotedUsdc6: bigint,
	maxUsdc: bigint,
): { redeemablePoints6: bigint; redeemableUsdc6: bigint } {
	if (bal13 <= 0n || quotedUsdc6 <= 0n || maxUsdc <= 0n) {
		return { redeemablePoints6: 0n, redeemableUsdc6: 0n }
	}
	if (maxUsdc >= quotedUsdc6) {
		return { redeemablePoints6: bal13, redeemableUsdc6: quotedUsdc6 }
	}
	let pts = (bal13 * maxUsdc) / quotedUsdc6
	if (pts > bal13) pts = bal13
	return { redeemablePoints6: pts, redeemableUsdc6: maxUsdc }
}

function fallbackQuotedUsdc6(currencyCode: string, fiat6: bigint, quotedUsdc6: bigint): bigint {
	if (quotedUsdc6 > 0n || fiat6 <= 0n) return quotedUsdc6
	const code = currencyCode.toUpperCase()
	if (code === 'USDC' || code === 'USD') return fiat6
	return 0n
}

async function buildReward13RowForCard(
	aa: string,
	cardAddress: string,
	target: string | null,
): Promise<Reward13Row | null> {
	const contract = new ethers.Contract(cardAddress, CARD_IFACE, conetDepinProvider)
	const usdc = new ethers.Contract(CONET_USDC, ERC20_IFACE, conetDepinProvider)
	const isSameStore = target !== null && cardAddress === target

	// Same-store: never catch balance/escrow/tokenBal → 0. That painted Covered CA$ 0.00
	// while AA still held #13 (fail-closed + escrowSized poison cache). Throw so caller
	// keeps unsized preview and retries instead of settling usable=0.
	const bal13 = isSameStore
		? ((await contract.balanceOf(aa, 13n)) as bigint)
		: ((await contract.balanceOf(aa, 13n).catch(() => 0n)) as bigint)
	if (bal13 <= 0n) return null

	const currency = (await contract.currency().catch(() => 0n)) as bigint
	const priceE6 = (await contract.pointsUnitPriceInCurrencyE6().catch(() => 0n)) as bigint
	const fiat6 = priceE6 > 0n ? (bal13 * priceE6) / 1_000_000n : 0n
	let quotedUsdc6 = 0n
	const currencyCode = ENUM_TO_CURRENCY[Number(currency)] ?? 'USD'

	let redeemableUsdc6 = 0n
	let redeemablePoints6 = 0n
	let supportsRedeem = false
	let coverKind: Reward13CoverKind = 'toUsdc'
	let escrow = 0n

	if (isSameStore) {
		// Same-store burn #13 → #0 is 1:1 card fiat, but usable PT is capped by
		// merchant rewardEscrowUsdc6 + card CONET-USDC liquidity. Use O(1)
		// proportional map — binary search hung Smart Pay on serial RPC.
		coverKind = 'toProgramPoints'
		supportsRedeem = false
		escrow = (await contract.rewardEscrowUsdc6()) as bigint
		try {
			quotedUsdc6 = (await contract.quoteUsdcWithdrawForFiat6(bal13)) as bigint
		} catch {
			quotedUsdc6 = 0n
		}
		if (quotedUsdc6 === 0n && priceE6 > 0n) {
			quotedUsdc6 = fallbackQuotedUsdc6(currencyCode, fiat6, 0n)
			if (quotedUsdc6 === 0n && fiat6 > 0n) quotedUsdc6 = fiat6
		}
		const tokenBal = (await usdc.balanceOf(cardAddress)) as bigint
		const maxUsdc =
			quotedUsdc6 < escrow
				? quotedUsdc6 < tokenBal
					? quotedUsdc6
					: tokenBal
				: escrow < tokenBal
					? escrow
					: tokenBal
		const sized = sameStoreRedeemableFromUsdcCap(bal13, quotedUsdc6, maxUsdc)
		redeemableUsdc6 = sized.redeemableUsdc6
		redeemablePoints6 = sized.redeemablePoints6
	} else {
		escrow = (await contract.rewardEscrowUsdc6().catch(() => 0n)) as bigint
		// Do not gate peer redemption on runtime bytecode inspection or the
		// legacy ratio getter. Module/fallback cards can expose the actual
		// redemption route without either value being present in the proxy
		// runtime bytecode. The quote call below is the capability probe and
		// also gives us the full-balance USDC amount.
		try {
			quotedUsdc6 = (await contract.quoteUsdcWithdrawForFiat6(bal13)) as bigint
			supportsRedeem = quotedUsdc6 > 0n
		} catch {
			quotedUsdc6 = 0n
			supportsRedeem = false
		}
		let tokenBal = 0n
		try {
			tokenBal = (await usdc.balanceOf(cardAddress)) as bigint
		} catch {
			tokenBal = 0n
		}
		const maxUsdc =
			quotedUsdc6 < escrow
				? quotedUsdc6 < tokenBal
					? quotedUsdc6
					: tokenBal
				: escrow < tokenBal
					? escrow
					: tokenBal
		if (supportsRedeem && maxUsdc > 0n && quotedUsdc6 > 0n) {
			if (maxUsdc >= quotedUsdc6) {
				redeemableUsdc6 = quotedUsdc6
				redeemablePoints6 = bal13
			} else {
				const sized = await findBurn13ForUsdcTarget(
					cardAddress,
					bal13,
					maxUsdc,
					quotedUsdc6,
				)
				if (sized) {
					redeemableUsdc6 = sized.usdcOut6
					redeemablePoints6 = sized.burn13
				}
			}
		}
	}

	const meta = await getCardMetadataFromApi(cardAddress).catch(() => null)
	return {
		cardAddress,
		name: meta?.name?.trim() || `Program ${cardAddress.slice(0, 6)}…${cardAddress.slice(-4)}`,
		icon: meta?.icon || meta?.image,
		pointsBalance6: bal13,
		escrowUsdc6: escrow,
		quotedUsdc6,
		redeemableUsdc6,
		redeemablePoints6,
		supportsRedeem,
		coverKind,
		escrowSized: isSameStore ? true : undefined,
	}
}

async function loadReward13RowsForAaUncached(
	profile: profile,
	aa: string,
	target: string | null,
	onPartial?: (rows: Reward13Row[]) => void,
): Promise<Reward13Row[]> {
	const collected = new Map<string, Reward13Row>()
	const emit = () => onPartial?.([...collected.values()])

	// Preview-first: one same-store balanceOf, then emit. CoNET provider is
	// serial (batchMaxCount:1) — never start getCardsOfOwner until same-store
	// preview (+ refine) finish, or Smart Pay stays at CA$ 0.00.
	const zeroKey = target ? reward13CacheKey(aa, target) : null
	if (target) {
		try {
			const contract = new ethers.Contract(target, CARD_IFACE, conetDepinProvider)
			const bal13 = (await contract.balanceOf(aa, 13n)) as bigint
			if (bal13 > 0n) {
				if (zeroKey) trustedSameStoreZeroKeys.delete(zeroKey)
				collected.set(target.toLowerCase(), previewSameStoreRow(target, bal13))
				emit()
			} else if (zeroKey) {
				// Trusted empty — do NOT emit a 0-PT row (that painted CA$ 0.00 via
				// hasSameStoreRow before AA was verified). Caller settles via
				// isTrustedSameStoreZero.
				trustedSameStoreZeroKeys.add(zeroKey)
			}
		} catch {
			/* untrusted — keep seed / last preview; do not emit empty */
		}

		const refineSameStore = async (): Promise<void> => {
			const row = await buildReward13RowForCard(aa, target, target)
			if (row) {
				if (zeroKey) trustedSameStoreZeroKeys.delete(zeroKey)
				collected.set(row.cardAddress.toLowerCase(), row)
				emit()
				return
			}
			// Trusted empty refine (balanceOf === 0) — drop preview; do NOT mark
			// escrowSized with redeemable=0 while preview still had pointsBalance>0.
			collected.delete(target.toLowerCase())
			if (zeroKey) trustedSameStoreZeroKeys.add(zeroKey)
			emit()
		}
		try {
			await refineSameStore()
		} catch {
			// One retry: serial CoNET RPC often fails the first escrow/tokenBal after preview.
			try {
				await refineSameStore()
			} catch {
				// Keep unsized preview (escrowSized=false). Settling usable=0 here was the
				// Covered CA$ 0.00 bug when escrow/tokenBal RPC failed under serial RPC.
			}
		}
	}

	// Peer scan only after same-store is settled on this serial RPC.
	const result = await getCardsOfOwnerWithDetailsForProfile(profile).catch(() => null)
	const addresses = new Set<string>()
	if (target) addresses.add(target)
	if (result) {
		for (const key of Object.keys(result.walletAssetsByCardKey ?? {})) {
			if (ethers.isAddress(key)) addresses.add(ethers.getAddress(key))
		}
		for (const card of result.holderCards ?? []) {
			if (card.cardAddress && ethers.isAddress(card.cardAddress)) {
				addresses.add(ethers.getAddress(card.cardAddress))
			}
		}
	}

	const others = [...addresses].filter((addr) => {
		if (!target) return true
		if (addr.toLowerCase() !== target.toLowerCase()) return true
		return !collected.has(addr.toLowerCase())
	})

	const concurrency = 4
	for (let i = 0; i < others.length; i += concurrency) {
		const batch = others.slice(i, i + concurrency)
		await Promise.all(
			batch.map(async (cardAddress) => {
				const row = await buildReward13RowForCard(aa, cardAddress, target).catch(() => null)
				if (row) collected.set(row.cardAddress.toLowerCase(), row)
			}),
		)
		emit()
	}

	return [...collected.values()]
}

export async function loadReward13RowsForAa(
	profile: profile,
	aaAddress?: string | null,
	targetCardAddress?: string | null,
	opts?: { onPartial?: (rows: Reward13Row[]) => void },
): Promise<Reward13Row[]> {
	// Callers (Top-up flow / Discover prefetch) already ran resolveAaHoldingReward13.
	// Trust a checksummed aaAddress — re-resolve under batchMaxCount:1 can fail and
	// return [] while the caller still settles cover as CA$ 0.00.
	let aa: string | null = null
	if (aaAddress && ethers.isAddress(aaAddress)) {
		aa = ethers.getAddress(aaAddress)
	} else {
		aa = await resolveAaHoldingReward13(profile, aaAddress)
	}
	if (!aa) return []

	const target =
		targetCardAddress && ethers.isAddress(targetCardAddress)
			? ethers.getAddress(targetCardAddress)
			: null
	const key = reward13CacheKey(aa, target)
	const cached = reward13RowsCache.get(key)
	// Only short-circuit on positive usable cover. Sized redeemable=0 with leftover
	// pointsBalance (fail-closed poison / escrow drained) must re-fetch — otherwise
	// Smart Pay sticks at Covered CA$ 0.00 for the TTL window.
	if (
		cached &&
		Date.now() - cached.ts < REWARD13_ROWS_CACHE_TTL_MS &&
		sameStoreHasPositiveCover(cached.rows)
	) {
		opts?.onPartial?.(cached.rows)
		return cached.rows
	}
	if (cached && !sameStoreHasPositiveCover(cached.rows)) {
		reward13RowsCache.delete(key)
	}

	const existing = reward13RowsInflight.get(key)
	if (existing) {
		if (opts?.onPartial) {
			let subs = reward13RowsInflightSubs.get(key)
			if (!subs) {
				subs = new Set()
				reward13RowsInflightSubs.set(key, subs)
			}
			subs.add(opts.onPartial)
		}
		const rows = await existing
		opts?.onPartial?.(rows)
		return rows
	}

	const notifyPartial = (partial: Reward13Row[]) => {
		opts?.onPartial?.(partial)
		reward13RowsInflightSubs.get(key)?.forEach((fn) => fn(partial))
	}
	const promise = loadReward13RowsForAaUncached(profile, aa, target, notifyPartial)
	reward13RowsInflight.set(key, promise)
	try {
		const rows = await promise
		if (sameStoreHasPositiveCover(rows)) {
			reward13RowsCache.set(key, { rows, ts: Date.now() })
		} else {
			// Do not cache escrowSized usable=0 (poisoned fail-closed or drained escrow).
			reward13RowsCache.delete(key)
		}
		return rows
	} finally {
		reward13RowsInflight.delete(key)
		reward13RowsInflightSubs.delete(key)
	}
}

function sortByBalance(a: Reward13Row, b: Reward13Row): number {
	if (a.pointsBalance6 < b.pointsBalance6) return -1
	if (a.pointsBalance6 > b.pointsBalance6) return 1
	return 0
}

/** Prefer larger escrow-capped redeemable capacity when ordering cover legs. */
function sortByRedeemable(a: Reward13Row, b: Reward13Row): number {
	const aPts = a.coverKind === 'toProgramPoints' ? a.redeemablePoints6 : a.redeemableUsdc6
	const bPts = b.coverKind === 'toProgramPoints' ? b.redeemablePoints6 : b.redeemableUsdc6
	if (aPts < bPts) return -1
	if (aPts > bPts) return 1
	return sortByBalance(a, b)
}

async function coverLegsFromRows(
	usable: Reward13Row[],
	needUsdc6: bigint,
	fiat6: bigint,
): Promise<CoverLeg[]> {
	const same = usable.filter((r) => r.coverKind === 'toProgramPoints').slice().sort(sortByRedeemable)
	const other = usable.filter((r) => r.coverKind !== 'toProgramPoints').slice().sort(sortByRedeemable)
	const ordered = [...same, ...other]
	const legs: CoverLeg[] = []
	let remaining = needUsdc6
	let remainingFiat6 = fiat6
	for (const row of ordered) {
		if (remaining <= 0n) break

		if (row.coverKind === 'toProgramPoints') {
			if (row.redeemablePoints6 <= 0n || remainingFiat6 <= 0n || fiat6 <= 0n) continue
			const takePts =
				row.redeemablePoints6 < remainingFiat6 ? row.redeemablePoints6 : remainingFiat6
			if (takePts <= 0n) continue
			const takeUsdc = (needUsdc6 * takePts) / fiat6
			const credit = takeUsdc < remaining ? takeUsdc : remaining
			if (credit <= 0n) continue
			legs.push({
				cardAddress: row.cardAddress,
				pointsCost: takePts,
				usdcReward6: credit,
				name: row.name,
				kind: 'toProgramPoints',
			})
			remaining -= credit
			remainingFiat6 -= takePts
			continue
		}

		if (row.redeemableUsdc6 <= 0n || row.redeemablePoints6 <= 0n) continue

		// Peer: usdcOut6 must equal on-chain quote(burn13). Size burn for remaining need.
		const targetUsdc = row.redeemableUsdc6 < remaining ? row.redeemableUsdc6 : remaining
		let burn13 = 0n
		let usdcOut6 = 0n
		if (targetUsdc === row.redeemableUsdc6) {
			burn13 = row.redeemablePoints6
			usdcOut6 = row.redeemableUsdc6
		} else {
			const sized = await findBurn13ForUsdcTarget(row.cardAddress, row.redeemablePoints6, targetUsdc)
			if (!sized) continue
			burn13 = sized.burn13
			usdcOut6 = sized.usdcOut6
		}
		if (burn13 <= 0n || usdcOut6 <= 0n) continue
		legs.push({
			cardAddress: row.cardAddress,
			pointsCost: burn13,
			usdcReward6: usdcOut6,
			name: row.name,
			kind: 'toUsdc',
		})
		remaining -= usdcOut6
	}
	return legs
}

export async function planAutoCoverUsdc(
	rows: Reward13Row[],
	needUsdc6: bigint,
	fiat6 = 0n,
): Promise<CoverLeg[]> {
	if (needUsdc6 <= 0n) return []
	const usable = rows.filter((r) => {
		if (r.coverKind === 'toProgramPoints') return r.redeemablePoints6 > 0n
		return r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n
	})
	return coverLegsFromRows(usable, needUsdc6, fiat6)
}

export async function planManualCoverUsdc(
	rows: Reward13Row[],
	selected: Set<string>,
	needUsdc6: bigint,
	fiat6 = 0n,
): Promise<CoverLeg[]> {
	if (needUsdc6 <= 0n) return []
	const chosen = rows.filter((r) => {
		if (!selected.has(r.cardAddress.toLowerCase())) return false
		if (r.coverKind === 'toProgramPoints') return r.redeemablePoints6 > 0n
		return r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n
	})
	return coverLegsFromRows(chosen, needUsdc6, fiat6)
}

/** @deprecated Prefer postTopupWithReward13Container for multi-source top-up. */
export async function postConvertReward13ToProgramPoints(params: {
	cardAddress: string
	userEOA: string
	burn13: bigint
	wallet: ethers.Wallet
}): Promise<{ success: boolean; error?: string }> {
	const verifying = await getCardFactoryGatewayForEip712(params.cardAddress)
	const deadline = Math.floor(Date.now() / 1000) + 600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const userSignature = await params.wallet.signTypedData(
		{
			name: 'BeamioUserCard',
			version: '1',
			chainId: CONET_MAINNET_CHAIN_ID,
			verifyingContract: verifying,
		},
		CONVERT_REWARD13_EIP712_TYPES,
		{
			card: ethers.getAddress(params.cardAddress),
			userEOA: params.userEOA,
			kind: 1,
			burn13: params.burn13,
			deadline: BigInt(deadline),
			nonce,
		},
	)
	const res = await fetch(`${beamioApi}/api/convertReward13ToProgramPoints`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cardAddress: ethers.getAddress(params.cardAddress),
			userEOA: params.userEOA,
			burn13: params.burn13.toString(),
			deadline,
			nonce,
			userSignature,
			kind: 'toProgramPoints',
		}),
	})
	const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
	if (!res.ok || data.success === false) {
		return { success: false, error: data.error || 'Reward PT conversion failed' }
	}
	return { success: true }
}

export async function postTopupWithReward13Container(params: {
	targetCard: string
	userEOA: string
	legs: CoverLeg[]
	cashUsdc6: bigint
	privateKeyArmor: string
	wallet: ethers.Wallet
}): Promise<{ success: boolean; error?: string; hash?: string }> {
	const targetCard = ethers.getAddress(params.targetCard)
	const userEOA = ethers.getAddress(params.userEOA)
	const sameLegs = params.legs.filter((l) => l.kind === 'toProgramPoints')
	const peerLegs = params.legs.filter((l) => l.kind === 'toUsdc')
	const sameStoreBurn13 = sameLegs.reduce((s, l) => s + l.pointsCost, 0n)
	const peerUsdcCredited6 = peerLegs.reduce((s, l) => s + l.usdcReward6, 0n)

	if (sameStoreBurn13 === 0n && peerUsdcCredited6 === 0n) {
		return { success: false, error: 'Container requires same-store #13 and/or peer USDC' }
	}

	let pointsFromPeerUsdc6 = 0n
	if (peerUsdcCredited6 > 0n) {
		const q = await quotePointsForUSDC(targetCard, ethers.formatUnits(peerUsdcCredited6, 6))
		pointsFromPeerUsdc6 = q.points6
		if (pointsFromPeerUsdc6 <= 0n) {
			return { success: false, error: 'Peer USDC points quote is zero' }
		}
	}

	let sameStoreMinted0 = 0n
	if (sameStoreBurn13 > 0n) {
		const card = new ethers.Contract(
			targetCard,
			['function pointsUnitPriceInCurrencyE6() view returns (uint256)'],
			conetDepinProvider,
		)
		const price = (await card.pointsUnitPriceInCurrencyE6()) as bigint
		if (price === 0n) {
			return { success: false, error: 'Target card points unit price is zero' }
		}
		sameStoreMinted0 = (sameStoreBurn13 * 1_000_000n) / price
		if (sameStoreMinted0 === 0n) {
			return { success: false, error: 'Same-store burn too small to mint #0' }
		}
	}
	const minTotalPointsOut0 = sameStoreMinted0 + pointsFromPeerUsdc6

	const peers = peerLegs.map((l) => ({
		cardAddress: ethers.getAddress(l.cardAddress),
		burn13: l.pointsCost,
		usdcOut6: l.usdcReward6,
	}))
	const peersHash = hashTopupPeers(peers)
	const cashUsdc6 = params.cashUsdc6 > 0n ? params.cashUsdc6 : 0n

	let cash: {
		from: string
		to: string
		value: string
		validAfter: number
		validBefore: number
		nonce: string
		signature: string
		points6: string
	} | null = null

	if (cashUsdc6 > 0n) {
		const auth = await USDC2Token(
			params.privateKeyArmor,
			ethers.formatUnits(cashUsdc6, 6),
			targetCard,
		)
		const owner = await getCardOwner(targetCard)
		let cashPoints6 = 0n
		try {
			// cashUsdc6 is deposit-spread USDC; mint points from fair USDC (undo merchant FX markup)
			cashPoints6 = await quotePointsFromDepositUsdc6(targetCard, cashUsdc6)
		} catch {
			cashPoints6 = 0n
		}
		cash = {
			from: auth.from,
			to: owner,
			value: auth.usdcAmount,
			validAfter: Number(auth.validAfter ?? 0),
			validBefore: Number(auth.validBefore),
			nonce: auth.nonce,
			signature: auth.userSignature,
			points6: cashPoints6 > 0n ? cashPoints6.toString() : '1',
		}
	}

	const verifying = await getCardFactoryGatewayForEip712(targetCard)
	const deadline = Math.floor(Date.now() / 1000) + 600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const userSignature = await params.wallet.signTypedData(
		{
			name: 'BeamioUserCard',
			version: '1',
			chainId: CONET_MAINNET_CHAIN_ID,
			verifyingContract: verifying,
		},
		TOPUP_WITH_REWARD13_CONTAINER_EIP712_TYPES,
		{
			targetCard,
			userEOA,
			sameStoreBurn13,
			peerUsdcCredited6,
			pointsFromPeerUsdc6,
			minTotalPointsOut0,
			peersHash,
			cashUsdc6,
			deadline: BigInt(deadline),
			nonce,
		},
	)

	const res = await fetch(`${beamioApi}/api/topupWithReward13Container`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			targetCard,
			userEOA,
			sameStoreBurn13: sameStoreBurn13.toString(),
			peerUsdcCredited6: peerUsdcCredited6.toString(),
			pointsFromPeerUsdc6: pointsFromPeerUsdc6.toString(),
			minTotalPointsOut0: minTotalPointsOut0.toString(),
			deadline,
			nonce,
			userSignature,
			peers: peers.map((p) => ({
				cardAddress: p.cardAddress,
				burn13: p.burn13.toString(),
				usdcOut6: p.usdcOut6.toString(),
			})),
			cash,
		}),
	})
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean
		error?: string
		hash?: string
	}
	if (!res.ok || data.success === false) {
		return { success: false, error: data.error || 'Atomic top-up failed' }
	}
	return { success: true, hash: data.hash }
}
