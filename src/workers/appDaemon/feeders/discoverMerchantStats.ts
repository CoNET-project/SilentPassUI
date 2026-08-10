/**
 * Discover merchant like / ref-click aggregates — Worker RPC + API.
 * Main merges + writes discoverMerchantStatsLocalCache.
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC } from '../protocol'

const LIKE_TOKEN_ID = 19n
const REF_CLICK_TOKEN_ID = 21n
const READ_ABI = ['function totalSupply(uint256 id) view returns (uint256)'] as const
const SOCIAL_API = 'https://beamio.app/api/cardProgramSocial'

export type WorkerDiscoverMerchantStat = {
	cardAddress: string
	likeCount: number | null
	refClickChain: number | null
	refClickDb: number | null
}

async function totalSupply(
	provider: ethers.JsonRpcProvider,
	card: string,
	tokenId: bigint,
): Promise<number | null> {
	try {
		const c = new ethers.Contract(card, READ_ABI, provider)
		const raw = (await c.totalSupply(tokenId)) as bigint
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
	} catch {
		return null
	}
}

async function dbShareClick(card: string): Promise<number | null> {
	try {
		const url = `${SOCIAL_API}?${new URLSearchParams({
			cardAddress: card,
			mode: 'summary',
			limit: '1',
		})}`
		const res = await fetch(url)
		if (!res.ok) return null
		const json = (await res.json()) as { dbShareClickTotal?: unknown; shareClickCount?: unknown }
		const raw = json.dbShareClickTotal ?? json.shareClickCount
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
	} catch {
		return null
	}
}

export async function fetchWorkerDiscoverMerchantStats(
	cardAddresses: string[],
): Promise<WorkerDiscoverMerchantStat[]> {
	if (!cardAddresses.length) return []
	const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
		staticNetwork: true,
		batchMaxCount: 1,
	})
	const out: WorkerDiscoverMerchantStat[] = []
	for (const raw of cardAddresses) {
		let card: string
		try {
			card = ethers.getAddress(raw)
		} catch {
			continue
		}
		const [likeCount, refClickChain, refClickDb] = await Promise.all([
			totalSupply(provider, card, LIKE_TOKEN_ID),
			totalSupply(provider, card, REF_CLICK_TOKEN_ID),
			dbShareClick(card),
		])
		if (likeCount == null && refClickChain == null && refClickDb == null) continue
		out.push({
			cardAddress: card.toLowerCase(),
			likeCount,
			refClickChain,
			refClickDb,
		})
	}
	return out
}
