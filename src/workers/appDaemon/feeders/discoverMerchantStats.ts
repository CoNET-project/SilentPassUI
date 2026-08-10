/**
 * Discover merchant like / ref-click — Multicall3 batched totalSupply.
 */

import { ethers } from 'ethers'
import { multicallAggregate3Conet, decodeUint256 } from '../multicall'

const LIKE_TOKEN_ID = 19n
const REF_CLICK_TOKEN_ID = 21n
const READ_IFACE = new ethers.Interface(['function totalSupply(uint256 id) view returns (uint256)'])
const SOCIAL_API = 'https://beamio.app/api/cardProgramSocial'

export type WorkerDiscoverMerchantStat = {
	cardAddress: string
	likeCount: number | null
	refClickChain: number | null
	refClickDb: number | null
}

function asCount(raw: bigint | null): number | null {
	if (raw == null) return null
	const n = Number(raw)
	return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
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
	const cards: string[] = []
	for (const raw of cardAddresses) {
		try {
			cards.push(ethers.getAddress(raw))
		} catch {
			/* skip */
		}
	}
	if (!cards.length) return []

	const calls = cards.flatMap((card) => [
		{
			target: card,
			allowFailure: true,
			callData: READ_IFACE.encodeFunctionData('totalSupply', [LIKE_TOKEN_ID]),
		},
		{
			target: card,
			allowFailure: true,
			callData: READ_IFACE.encodeFunctionData('totalSupply', [REF_CLICK_TOKEN_ID]),
		},
	])
	const [mc, dbRows] = await Promise.all([
		multicallAggregate3Conet(calls),
		Promise.all(cards.map((c) => dbShareClick(c))),
	])

	const out: WorkerDiscoverMerchantStat[] = []
	for (let i = 0; i < cards.length; i++) {
		const likeRaw = mc[i * 2]?.success ? decodeUint256(mc[i * 2].returnData) : null
		const refRaw = mc[i * 2 + 1]?.success ? decodeUint256(mc[i * 2 + 1].returnData) : null
		const likeCount = asCount(likeRaw)
		const refClickChain = asCount(refRaw)
		const refClickDb = dbRows[i]
		if (likeCount == null && refClickChain == null && refClickDb == null) continue
		out.push({
			cardAddress: cards[i].toLowerCase(),
			likeCount,
			refClickChain,
			refClickDb,
		})
	}
	return out
}
