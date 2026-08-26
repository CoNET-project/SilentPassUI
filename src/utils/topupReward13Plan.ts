import { ethers } from 'ethers'
import {
	getCardMetadataFromApi,
	getCardsOfOwnerWithDetailsForProfile,
	quoteCurrencyAmountInUSDC,
} from '@/services/BeamioCard'
import { CONET_USDC } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

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

const CARD_IFACE = new ethers.Interface([
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function rewardEscrowUsdc6() view returns (uint256)',
	'function currency() view returns (uint8)',
	'function pointsUnitPriceInCurrencyE6() view returns (uint256)',
])

const ERC20_IFACE = new ethers.Interface(['function balanceOf(address) view returns (uint256)'])

const BURN_SEL = ethers.id('burnSocialPointsFromUserForExchange(address,uint256)').slice(0, 10)
const PAY_SEL = ethers.id('payoutSocialExchangeUsdcToUser(address,uint256)').slice(0, 10)

const ENUM_TO_CURRENCY = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const

export type Reward13Row = {
	cardAddress: string
	name: string
	icon?: string
	pointsBalance6: bigint
	escrowUsdc6: bigint
	quotedUsdc6: bigint
	redeemableUsdc6: bigint
	redeemablePoints6: bigint
	supportsRedeem: boolean
}

export type CoverLeg = {
	cardAddress: string
	pointsCost: bigint
	usdcReward6: bigint
	name: string
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

async function cardSupportsRedeem(cardAddress: string): Promise<boolean> {
	try {
		const code = await conetDepinProvider.getCode(cardAddress)
		if (!code || code === '0x') return false
		const lower = code.toLowerCase()
		return lower.includes(BURN_SEL.slice(2).toLowerCase()) && lower.includes(PAY_SEL.slice(2).toLowerCase())
	} catch {
		return false
	}
}

export async function loadReward13RowsForAa(profile: profile, aaAddress?: string | null): Promise<Reward13Row[]> {
	const result = await getCardsOfOwnerWithDetailsForProfile(profile)
	const aa =
		(aaAddress && ethers.isAddress(aaAddress) ? ethers.getAddress(aaAddress) : null) ||
		result.walletResolvedAaAddress ||
		(profile.aaAccount && ethers.isAddress(profile.aaAccount) ? ethers.getAddress(profile.aaAccount) : null)
	if (!aa) return []

	const byKey = result.walletAssetsByCardKey ?? {}
	const addresses = new Set<string>()
	for (const key of Object.keys(byKey)) {
		if (ethers.isAddress(key)) addresses.add(ethers.getAddress(key))
	}
	for (const card of result.holderCards ?? []) {
		if (card.cardAddress && ethers.isAddress(card.cardAddress)) {
			addresses.add(ethers.getAddress(card.cardAddress))
		}
	}

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
			const supportsRedeem = await cardSupportsRedeem(cardAddress)
			const fiat6 = priceE6 > 0n ? (bal13 * priceE6) / 1_000_000n : 0n
			let quotedUsdc6 = 0n
			const currencyCode = ENUM_TO_CURRENCY[Number(currency)] ?? 'USD'
			if (fiat6 > 0n) {
				const { usdc6 } = await quoteCurrencyAmountInUSDC(
					cardAddress,
					currencyCode,
					ethers.formatUnits(fiat6, 6),
				)
				quotedUsdc6 = usdc6
			}
			const cap = quotedUsdc6 < escrow ? quotedUsdc6 : escrow
			const redeemableUsdc6 = supportsRedeem && cap > 0n ? cap : 0n
			let redeemablePoints6 = 0n
			if (quotedUsdc6 > 0n && redeemableUsdc6 > 0n) {
				redeemablePoints6 = (bal13 * redeemableUsdc6) / quotedUsdc6
				if (redeemablePoints6 > bal13) redeemablePoints6 = bal13
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
			})
		} catch {
			continue
		}
	}
	return rows
}

export function planAutoCoverUsdc(rows: Reward13Row[], needUsdc6: bigint): CoverLeg[] {
	if (needUsdc6 <= 0n) return []
	const usable = rows
		.filter((r) => r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n)
		.slice()
		.sort((a, b) => (a.pointsBalance6 < b.pointsBalance6 ? -1 : a.pointsBalance6 > b.pointsBalance6 ? 1 : 0))
	const legs: CoverLeg[] = []
	let remaining = needUsdc6
	for (const row of usable) {
		if (remaining <= 0n) break
		const takeUsdc = row.redeemableUsdc6 < remaining ? row.redeemableUsdc6 : remaining
		if (takeUsdc <= 0n) continue
		const takePts =
			row.quotedUsdc6 > 0n ? (row.pointsBalance6 * takeUsdc) / row.quotedUsdc6 : row.redeemablePoints6
		const pointsCost = takePts > row.pointsBalance6 ? row.pointsBalance6 : takePts
		if (pointsCost <= 0n) continue
		legs.push({
			cardAddress: row.cardAddress,
			pointsCost,
			usdcReward6: takeUsdc,
			name: row.name,
		})
		remaining -= takeUsdc
	}
	return legs
}

export function planManualCoverUsdc(rows: Reward13Row[], selected: Set<string>, needUsdc6: bigint): CoverLeg[] {
	if (needUsdc6 <= 0n) return []
	const chosen = rows.filter((r) => selected.has(r.cardAddress.toLowerCase()) && r.redeemableUsdc6 > 0n)
	chosen.sort((a, b) => (a.pointsBalance6 < b.pointsBalance6 ? -1 : a.pointsBalance6 > b.pointsBalance6 ? 1 : 0))
	return planAutoCoverUsdc(chosen, needUsdc6)
}
