import { ethers } from 'ethers'

import { beamioApi } from '@/utils/constants'

const UC_TARGET_MERCHANT_CARD = 1
const SESSION_KEY_PREFIX = 'beamio:discover-share-click:v1:'

function sessionDedupeKey(cardAddress: string, actorEOA: string): string {
	return `${SESSION_KEY_PREFIX}${cardAddress.toLowerCase()}:${actorEOA.toLowerCase()}`
}

function wasShareClickRecordedThisSession(cardAddress: string, actorEOA: string): boolean {
	try {
		return sessionStorage.getItem(sessionDedupeKey(cardAddress, actorEOA)) === '1'
	} catch {
		return false
	}
}

function markShareClickRecordedThisSession(cardAddress: string, actorEOA: string): void {
	try {
		sessionStorage.setItem(sessionDedupeKey(cardAddress, actorEOA), '1')
	} catch {
		/* ignore quota / private mode */
	}
}

function resolveShareClickRefWallet(actorEOA: string, referrerEoa?: string | null): string | undefined {
	const raw = referrerEoa?.trim() ?? ''
	if (!raw || !ethers.isAddress(raw)) return undefined
	try {
		const ref = ethers.getAddress(raw)
		const actor = ethers.getAddress(actorEOA)
		if (ref === actor) return undefined
		return ref
	} catch {
		return undefined
	}
}

async function signShareClickAttestation(
	wallet: ethers.Wallet,
	cardAddress: string,
): Promise<{ clickAttestation: string; attestationTs: number }> {
	const attestationTs = Date.now()
	const payload = JSON.stringify({
		kind: 'beamio_discover_share_click_v1',
		cardAddress: ethers.getAddress(cardAddress),
		actor: wallet.address,
		ts: attestationTs,
	})
	const clickAttestation = await wallet.signMessage(payload)
	return { clickAttestation, attestationTs }
}

export type DiscoverShareClickResult =
	| { ok: true; actorEOA: string; txQueued: boolean; skipped?: 'session' }
	| { ok: false; reason: string }

/** Record Discover merchant share-link open (USER_CLICK + REF_CLICK) for the signed-in APP wallet. */
export async function recordDiscoverShareClickIfNeeded(params: {
	cardAddress: string
	privateKeyArmor: string
	referrerEoa?: string | null
}): Promise<DiscoverShareClickResult> {
	let card: string
	try {
		card = ethers.getAddress(String(params.cardAddress ?? '').trim())
	} catch {
		return { ok: false, reason: 'invalid_card' }
	}

	const privateKeyArmor = params.privateKeyArmor?.trim() ?? ''
	if (!privateKeyArmor) return { ok: false, reason: 'wallet_unavailable' }

	let wallet: ethers.Wallet
	try {
		wallet = new ethers.Wallet(privateKeyArmor)
	} catch {
		return { ok: false, reason: 'wallet_unavailable' }
	}

	const actorEOA = ethers.getAddress(wallet.address)
	if (wasShareClickRecordedThisSession(card, actorEOA)) {
		return { ok: true, actorEOA, txQueued: false, skipped: 'session' }
	}

	const refWallet = resolveShareClickRefWallet(actorEOA, params.referrerEoa)
	const { clickAttestation, attestationTs } = await signShareClickAttestation(wallet, card)

	try {
		const res = await fetch(`${beamioApi}/api/cardRecordDiscoverShareClick`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: card,
				actorWallet: actorEOA,
				...(refWallet ? { refWallet } : {}),
				cumulativeTargetKind: UC_TARGET_MERCHANT_CARD,
				cumulativeIssuedParentId: '0',
				clickAttestation,
				attestationTs,
			}),
		})
		const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
		if (!res.ok || !json?.success) {
			return { ok: false, reason: json?.error ?? `http_${res.status}` }
		}

		markShareClickRecordedThisSession(card, actorEOA)
		return { ok: true, actorEOA, txQueued: true }
	} catch {
		return { ok: false, reason: 'network' }
	}
}
