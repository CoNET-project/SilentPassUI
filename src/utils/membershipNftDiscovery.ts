/**
 * Discover membership NFTs held as ERC-1155 balances but missing from
 * `_userOwnedNfts` / getOwnership inventory (orphaned membership ledger).
 *
 * Mirror of x402sdk `membershipNftDiscovery.ts` (no DB probe — subprojects independent).
 */
import { ethers } from 'ethers'
import {
	DISCOVER_ISSUED_NFT_START_ID,
	DISCOVER_MEMBERSHIP_NFT_MIN_ID,
	isDiscoverMembershipNftTokenId,
} from '@/utils/discoverMembershipFee'

export type OwnershipNftRow = {
	tokenId: bigint
	attribute: bigint
	tierIndexOrMax: bigint
	expiry: bigint
	isExpired: boolean
}

const OWNERSHIP_ABI = [
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function nftAttributes(uint256 tokenId) view returns (uint256 attr)',
	'function nftExpiresAt(uint256 tokenId) view returns (uint256)',
	'function expiresAt(uint256 tokenId) view returns (uint256)',
	'function nftTierIndexOrMax(uint256 tokenId) view returns (uint256)',
	'function activeMembershipId(address user) view returns (uint256)',
	'function totalMembershipIssued() view returns (uint256)',
] as const

const MEMBERSHIP_BALANCE_PROBE_SPAN = 64n
const MEMBERSHIP_BALANCE_PROBE_HARD_CAP = 256n

function nftKey(n: OwnershipNftRow): string {
	return String(n.tokenId)
}

async function readExpiry(card: ethers.Contract, tokenId: bigint): Promise<bigint> {
	try {
		return BigInt(await card.nftExpiresAt(tokenId))
	} catch {
		try {
			return BigInt(await card.expiresAt(tokenId))
		} catch {
			return 0n
		}
	}
}

async function readTierIndexOrMax(card: ethers.Contract, tokenId: bigint): Promise<bigint> {
	try {
		return BigInt(await card.nftTierIndexOrMax(tokenId))
	} catch {
		return ethers.MaxUint256
	}
}

async function readMembershipNftRowIfHeld(
	card: ethers.Contract,
	holder: string,
	tokenId: bigint,
	nowSec: bigint,
): Promise<OwnershipNftRow | null> {
	if (!isDiscoverMembershipNftTokenId(tokenId)) return null
	try {
		const bal = await card.balanceOf(holder, tokenId)
		if (BigInt(bal ?? 0) <= 0n) return null
		const [attrRaw, expiry, tierIndexOrMax] = await Promise.all([
			card.nftAttributes(tokenId).catch(() => 0n),
			readExpiry(card, tokenId),
			readTierIndexOrMax(card, tokenId),
		])
		const attribute = BigInt(attrRaw ?? 0)
		const isExpired = expiry > 0n && expiry <= nowSec
		if (isExpired) return null
		return { tokenId, attribute, tierIndexOrMax, expiry, isExpired: false }
	} catch {
		return null
	}
}

async function collectMembershipTokenIdCandidates(
	card: ethers.Contract,
	holders: string[],
): Promise<bigint[]> {
	const ids = new Set<string>()
	const add = (raw: unknown) => {
		try {
			const tid = typeof raw === 'bigint' ? raw : BigInt(String(raw ?? '').trim() || '0')
			if (isDiscoverMembershipNftTokenId(tid)) ids.add(tid.toString())
		} catch {
			/* ignore */
		}
	}

	// Always probe #100 — common orphan after bootstrap / dirty inventory.
	ids.add(DISCOVER_MEMBERSHIP_NFT_MIN_ID.toString())

	for (const holder of holders) {
		try {
			add(await card.activeMembershipId(holder))
		} catch {
			/* ignore — dirty ids in [1,99] are filtered by isDiscoverMembershipNftTokenId */
		}
	}

	try {
		const total = BigInt(await card.totalMembershipIssued().catch(() => 0n))
		const span =
			total > 0n && total < MEMBERSHIP_BALANCE_PROBE_HARD_CAP
				? total
				: MEMBERSHIP_BALANCE_PROBE_SPAN
		const end = DISCOVER_MEMBERSHIP_NFT_MIN_ID + span
		for (
			let tid = DISCOVER_MEMBERSHIP_NFT_MIN_ID;
			tid < end && tid < DISCOVER_ISSUED_NFT_START_ID;
			tid++
		) {
			ids.add(tid.toString())
		}
	} catch {
		for (let i = 0n; i < MEMBERSHIP_BALANCE_PROBE_SPAN; i++) {
			ids.add((DISCOVER_MEMBERSHIP_NFT_MIN_ID + i).toString())
		}
	}

	return Array.from(ids)
		.map((s) => BigInt(s))
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * When inventory-backed ownership has no membership NFT, probe balanceOf for
 * membership tokenIds on each holder (EOA and/or AA).
 */
export async function discoverOrphanMembershipNfts(input: {
	provider: ethers.Provider
	cardAddress: string
	holders: string[]
	existingTokenIds?: ReadonlyArray<string | number | bigint>
}): Promise<OwnershipNftRow[]> {
	const holders = Array.from(
		new Set(
			input.holders
				.map((h) => {
					try {
						return ethers.getAddress(String(h || '').trim())
					} catch {
						return ''
					}
				})
				.filter(Boolean),
		),
	)
	if (!holders.length) return []

	const hasMembershipInInventory = (input.existingTokenIds ?? []).some((id) =>
		isDiscoverMembershipNftTokenId(id),
	)
	if (hasMembershipInInventory) return []

	const card = new ethers.Contract(input.cardAddress, OWNERSHIP_ABI, input.provider)
	const nowSec = BigInt(Math.floor(Date.now() / 1000))
	const candidates = await collectMembershipTokenIdCandidates(card, holders)
	const found = new Map<string, OwnershipNftRow>()

	await Promise.all(
		holders.flatMap((holder) =>
			candidates.map(async (tid) => {
				const row = await readMembershipNftRowIfHeld(card, holder, tid, nowSec)
				if (!row) return
				const k = nftKey(row)
				if (!found.has(k)) found.set(k, row)
			}),
		),
	)

	return Array.from(found.values())
}
