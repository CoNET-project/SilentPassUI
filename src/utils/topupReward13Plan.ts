import { ethers } from 'ethers'
import {
	getCardMetadataFromApi,
	getCardOwner,
	getCardsOfOwnerWithDetailsForProfile,
	quoteCurrencyAmountInUSDC,
	quotePointsForUSDC,
	USDC2Token,
} from '@/services/BeamioCard'
import { CONET_MAINNET_CHAIN_ID, CONET_USDC } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import { getCardFactoryGatewayForEip712 } from '@/utils/beamioUserCardChain'

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

/** peerRedeem13ForContainerTopup(address,uint256,uint256,address) */
const PEER_REDEEM_SEL = ethers.id('peerRedeem13ForContainerTopup(address,uint256,uint256,address)').slice(0, 10)

const ENUM_TO_CURRENCY = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const

export type Reward13CoverKind = 'toProgramPoints' | 'toUsdc'

export type Reward13Row = {
	cardAddress: string
	name: string
	icon?: string
	pointsBalance6: bigint
	escrowUsdc6: bigint
	/** Full-balance on-chain USDC quote (peer) or fiat≈USDC cover (same-store). */
	quotedUsdc6: bigint
	/** Fail-closed max USDC this row can pay: min(quote, escrow, ERC20). */
	redeemableUsdc6: bigint
	/** Burn #13 that quotes exactly to redeemableUsdc6 (peer) or full bal (same-store). */
	redeemablePoints6: bigint
	supportsRedeem: boolean
	coverKind: Reward13CoverKind
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

async function cardSupportsPeerContainerRedeem(cardAddress: string): Promise<boolean> {
	try {
		const code = await conetDepinProvider.getCode(cardAddress)
		if (!code || code === '0x') return false
		return code.toLowerCase().includes(PEER_REDEEM_SEL.slice(2).toLowerCase())
	} catch {
		return false
	}
}

async function quotePeerUsdcForBurn(cardAddress: string, burn13: bigint): Promise<bigint> {
	if (burn13 <= 0n) return 0n
	const card = new ethers.Contract(cardAddress, CARD_IFACE, conetDepinProvider)
	return (await card.quoteUsdcWithdrawForFiat6(burn13)) as bigint
}

/**
 * Largest burn13 in [1, maxBurn] whose on-chain quote is ≤ targetUsdc and as close as possible.
 * Fail-closed: never return a burn whose quote exceeds target or liquidity.
 */
async function findBurn13ForUsdcTarget(
	cardAddress: string,
	maxBurn: bigint,
	targetUsdc: bigint,
): Promise<{ burn13: bigint; usdcOut6: bigint } | null> {
	if (maxBurn <= 0n || targetUsdc <= 0n) return null
	let lo = 1n
	let hi = maxBurn
	let bestBurn = 0n
	let bestUsdc = 0n
	while (lo <= hi) {
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
	if (bestBurn <= 0n || bestUsdc <= 0n) return null
	// Re-quote to confirm (Cluster requires usdcOut6 === quote(burn13)).
	const confirm = await quotePeerUsdcForBurn(cardAddress, bestBurn)
	if (confirm !== bestUsdc || confirm > targetUsdc) return null
	return { burn13: bestBurn, usdcOut6: confirm }
}

function fallbackQuotedUsdc6(currencyCode: string, fiat6: bigint, quotedUsdc6: bigint): bigint {
	if (quotedUsdc6 > 0n || fiat6 <= 0n) return quotedUsdc6
	const code = currencyCode.toUpperCase()
	if (code === 'USDC' || code === 'USD') return fiat6
	return 0n
}

export async function loadReward13RowsForAa(
	profile: profile,
	aaAddress?: string | null,
	targetCardAddress?: string | null,
): Promise<Reward13Row[]> {
	const result = await getCardsOfOwnerWithDetailsForProfile(profile)
	const aa =
		(aaAddress && ethers.isAddress(aaAddress) ? ethers.getAddress(aaAddress) : null) ||
		result.walletResolvedAaAddress ||
		(profile.aaAccount && ethers.isAddress(profile.aaAccount) ? ethers.getAddress(profile.aaAccount) : null)
	if (!aa) return []

	const target =
		targetCardAddress && ethers.isAddress(targetCardAddress)
			? ethers.getAddress(targetCardAddress)
			: null

	const byKey = result.walletAssetsByCardKey ?? {}
	const addresses = new Set<string>()
	if (target) addresses.add(target)
	for (const key of Object.keys(byKey)) {
		if (ethers.isAddress(key)) addresses.add(ethers.getAddress(key))
	}
	for (const card of result.holderCards ?? []) {
		if (card.cardAddress && ethers.isAddress(card.cardAddress)) {
			addresses.add(ethers.getAddress(card.cardAddress))
		}
	}

	const usdc = new ethers.Contract(CONET_USDC, ERC20_IFACE, conetDepinProvider)
	const rows: Reward13Row[] = []
	for (const cardAddress of addresses) {
		try {
			const contract = new ethers.Contract(cardAddress, CARD_IFACE, conetDepinProvider)
			const [bal13, escrow, currency, priceE6] = await Promise.all([
				contract.balanceOf(aa, 13n) as Promise<bigint>,
				contract.rewardEscrowUsdc6() as Promise<bigint>,
				contract.currency() as Promise<bigint>,
				contract.pointsUnitPriceInCurrencyE6() as Promise<bigint>,
			])
			if (bal13 <= 0n) continue
			const isSameStore = target !== null && cardAddress === target
			const fiat6 = priceE6 > 0n ? (bal13 * priceE6) / 1_000_000n : 0n
			let quotedUsdc6 = 0n
			const currencyCode = ENUM_TO_CURRENCY[Number(currency)] ?? 'USD'

			let redeemableUsdc6 = 0n
			let redeemablePoints6 = 0n
			let supportsRedeem = false
			let coverKind: Reward13CoverKind = 'toUsdc'

			if (isSameStore && priceE6 > 0n) {
				coverKind = 'toProgramPoints'
				if (fiat6 > 0n) {
					try {
						const { usdc6 } = await quoteCurrencyAmountInUSDC(
							cardAddress,
							currencyCode,
							ethers.formatUnits(fiat6, 6),
						)
						quotedUsdc6 = usdc6
					} catch {
						quotedUsdc6 = 0n
					}
				}
				quotedUsdc6 = fallbackQuotedUsdc6(currencyCode, fiat6, quotedUsdc6)
				if (quotedUsdc6 === 0n && fiat6 > 0n) quotedUsdc6 = fiat6
				redeemableUsdc6 = quotedUsdc6
				redeemablePoints6 = bal13
			} else {
				supportsRedeem = await cardSupportsPeerContainerRedeem(cardAddress)
				let ratio = 0n
				try {
					ratio = (await contract.convertReward13ToUsdcRatioE6()) as bigint
				} catch {
					ratio = 0n
				}
				if (supportsRedeem && ratio > 0n) {
					try {
						quotedUsdc6 = (await contract.quoteUsdcWithdrawForFiat6(bal13)) as bigint
					} catch {
						quotedUsdc6 = 0n
					}
					let tokenBal = 0n
					try {
						tokenBal = (await usdc.balanceOf(cardAddress)) as bigint
					} catch {
						tokenBal = 0n
					}
					// Fail-closed liquidity: escrow AND ERC20; no silent cap past either.
					const maxUsdc =
						quotedUsdc6 < escrow
							? quotedUsdc6 < tokenBal
								? quotedUsdc6
								: tokenBal
							: escrow < tokenBal
								? escrow
								: tokenBal
					if (maxUsdc > 0n && quotedUsdc6 > 0n) {
						if (maxUsdc === quotedUsdc6) {
							redeemableUsdc6 = quotedUsdc6
							redeemablePoints6 = bal13
						} else {
							const sized = await findBurn13ForUsdcTarget(cardAddress, bal13, maxUsdc)
							if (sized) {
								redeemableUsdc6 = sized.usdcOut6
								redeemablePoints6 = sized.burn13
							}
						}
					}
				}
			}

			const meta = await getCardMetadataFromApi(cardAddress).catch(() => null)
			rows.push({
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
			})
		} catch {
			continue
		}
	}
	return rows
}

function sortByBalance(a: Reward13Row, b: Reward13Row): number {
	if (a.pointsBalance6 < b.pointsBalance6) return -1
	if (a.pointsBalance6 > b.pointsBalance6) return 1
	return 0
}

async function coverLegsFromRows(usable: Reward13Row[], needUsdc6: bigint): Promise<CoverLeg[]> {
	const same = usable.filter((r) => r.coverKind === 'toProgramPoints').slice().sort(sortByBalance)
	const other = usable.filter((r) => r.coverKind !== 'toProgramPoints').slice().sort(sortByBalance)
	const ordered = [...same, ...other]
	const legs: CoverLeg[] = []
	let remaining = needUsdc6
	for (const row of ordered) {
		if (remaining <= 0n) break
		if (row.redeemableUsdc6 <= 0n || row.redeemablePoints6 <= 0n) continue

		if (row.coverKind === 'toProgramPoints') {
			const takeUsdc = row.redeemableUsdc6 < remaining ? row.redeemableUsdc6 : remaining
			if (takeUsdc <= 0n) continue
			const takePts =
				row.quotedUsdc6 > 0n
					? (row.pointsBalance6 * takeUsdc) / row.quotedUsdc6
					: row.redeemablePoints6
			const pointsCost = takePts > row.pointsBalance6 ? row.pointsBalance6 : takePts
			if (pointsCost <= 0n) continue
			legs.push({
				cardAddress: row.cardAddress,
				pointsCost,
				usdcReward6: takeUsdc,
				name: row.name,
				kind: 'toProgramPoints',
			})
			remaining -= takeUsdc
			continue
		}

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

export async function planAutoCoverUsdc(rows: Reward13Row[], needUsdc6: bigint): Promise<CoverLeg[]> {
	if (needUsdc6 <= 0n) return []
	const usable = rows.filter((r) => r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n)
	return coverLegsFromRows(usable, needUsdc6)
}

export async function planManualCoverUsdc(
	rows: Reward13Row[],
	selected: Set<string>,
	needUsdc6: bigint,
): Promise<CoverLeg[]> {
	if (needUsdc6 <= 0n) return []
	const chosen = rows.filter((r) => selected.has(r.cardAddress.toLowerCase()) && r.redeemableUsdc6 > 0n)
	return coverLegsFromRows(chosen, needUsdc6)
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
			const pq = await quotePointsForUSDC(targetCard, ethers.formatUnits(cashUsdc6, 6))
			cashPoints6 = pq.points6
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
