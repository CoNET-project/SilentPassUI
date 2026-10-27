/**
 * Agent → Merchant OS deep link for card ownership claim.
 * Hash-only: temp private key never appears in the server-visible URL.
 */
import { ethers } from 'ethers'
import { unlockDetachedRecoverPrivateKey } from '@/services/beamio'
import type { AgentTempAccount } from '@/utils/agentBusinessWorkspace'

const MERCHANT_OS_BASE = 'https://biz.beamio.app/biz/'
const FLOW = 'agentCardClaim'

export function buildAgentCardClaimUrl(input: {
	tempPrivateKey: string
	cardAddress: string
	agentEoa: string
	tempEoa: string
	/** Optional display name shown on Merchant OS Business handover. */
	businessName?: string
}): string {
	const pk = input.tempPrivateKey.trim()
	if (!pk) throw new Error('Missing temp private key')
	const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`)
	if (wallet.address.toLowerCase() !== ethers.getAddress(input.tempEoa).toLowerCase()) {
		throw new Error('Temp private key does not match this temp account')
	}
	const params = new URLSearchParams({
		flow: FLOW,
		tempPk: wallet.privateKey,
		card: ethers.getAddress(input.cardAddress),
		agent: ethers.getAddress(input.agentEoa),
		temp: ethers.getAddress(input.tempEoa),
	})
	const name = (input.businessName || '').trim().slice(0, 80)
	if (name) params.set('name', name)
	return `${MERCHANT_OS_BASE}#/?${params.toString()}`
}

/** Unlock the temp recover package and build a one-click Merchant OS claim link. */
export async function buildAgentCardClaimUrlForTemp(input: {
	temp: AgentTempAccount
	cardAddress: string
	agentEoa: string
	businessName?: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	try {
		if (!ethers.isAddress(input.agentEoa) || !ethers.isAddress(input.cardAddress)) {
			return { ok: false, error: 'Invalid agent or card address.' }
		}
		const privateKey = await unlockDetachedRecoverPrivateKey(
			input.temp.beamioTag,
			input.temp.accessPassword,
		)
		if (!privateKey) {
			return { ok: false, error: 'Could not unlock the temp wallet for this claim link.' }
		}
		const url = buildAgentCardClaimUrl({
			tempPrivateKey: privateKey,
			cardAddress: input.cardAddress,
			agentEoa: input.agentEoa,
			tempEoa: input.temp.eoa,
			businessName: input.businessName,
		})
		return { ok: true, url }
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Could not build the claim link.',
		}
	}
}
