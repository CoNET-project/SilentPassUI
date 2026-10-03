import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'

const CACHE_KEY = 'beamio:silentpass:global:reward-pt-usdc-merchants:v1'

/** Lowercase card addresses that publish a Reward PT → USDC exchange. `null` means the last read was untrusted. */
export function loadRewardPtUsdcMerchantAddresses(): Set<string> | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as { addresses?: unknown }
		return parseAddressList(parsed?.addresses)
	} catch {
		return null
	}
}

function saveRewardPtUsdcMerchantAddresses(addresses: Set<string>): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ addresses: [...addresses] }))
	} catch {
		/* quota / private mode */
	}
}

function parseAddressList(raw: unknown): Set<string> | null {
	if (!Array.isArray(raw)) return null
	const out = new Set<string>()
	for (const row of raw) {
		const value = String(row ?? '').trim()
		if (!ethers.isAddress(value)) continue
		out.add(value.toLowerCase())
	}
	return out
}

/** Trusted address set, including an empty set. `null` when the response cannot be trusted. */
export async function fetchRewardPtUsdcMerchantAddresses(): Promise<Set<string> | null> {
	const res = await fetch(`${beamioApi}/api/rewardPtUsdcMerchants`, { cache: 'no-store' })
	if (!res.ok) return null
	const body = (await res.json()) as { items?: unknown }
	if (!Array.isArray(body?.items)) return null
	const out = new Set<string>()
	for (const row of body.items) {
		if (!row || typeof row !== 'object') continue
		const cardRaw = String((row as { cardAddress?: unknown }).cardAddress ?? '').trim()
		if (!ethers.isAddress(cardRaw)) continue
		const offers = (row as { offers?: unknown }).offers
		if (!Array.isArray(offers) || offers.length === 0) continue
		out.add(cardRaw.toLowerCase())
	}
	saveRewardPtUsdcMerchantAddresses(out)
	return out
}
