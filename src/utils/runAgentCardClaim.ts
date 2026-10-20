import { ethers } from 'ethers'
import { conetDepinProvider, beamioApi } from '@/utils/constants'
import type { AgentCardClaimHandoff } from '@/utils/agentCardClaimHandoff'
import { clearAgentCardClaimHandoff } from '@/utils/agentCardClaimHandoff'

const OWNABLE_ABI = [
	'function owner() view returns (address)',
	'function transferOwnership(address newOwner)',
] as const

const FUND_MIN_WEI = ethers.parseEther('0.005')
const POLL_MS = 1500
const POLL_MAX = 20

async function postJson(
	path: string,
	body: Record<string, string>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
	try {
		const res = await fetch(`${beamioApi}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
		if (!res.ok || data.success === false) {
			return {
				ok: false,
				error: typeof data.error === 'string' ? data.error : `Request failed (${res.status})`,
			}
		}
		return { ok: true, data }
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
	}
}

async function waitTempFunded(tempEoa: string): Promise<boolean> {
	for (let i = 0; i < POLL_MAX; i++) {
		const bal = await conetDepinProvider.getBalance(tempEoa)
		if (bal >= FUND_MIN_WEI) return true
		await new Promise((r) => setTimeout(r, POLL_MS))
	}
	return false
}

/**
 * After Merchant OS createRecover: fund temp → transferOwnership → Master mints 1000 free B-Unit to merchant.
 */
export async function runAgentCardClaim(input: {
	claim: AgentCardClaimHandoff
	merchantEoa: string
}): Promise<{ ok: true; txHash?: string } | { ok: false; error: string }> {
	const { claim, merchantEoa } = input
	if (!ethers.isAddress(merchantEoa)) {
		return { ok: false, error: 'Invalid merchant wallet.' }
	}
	const merchant = ethers.getAddress(merchantEoa)

	const card = new ethers.Contract(claim.cardAddress, OWNABLE_ABI, conetDepinProvider)
	let owner: string
	try {
		owner = ethers.getAddress(await card.owner!())
	} catch {
		return { ok: false, error: 'Could not read the merchant card owner.' }
	}

	if (owner.toLowerCase() === merchant.toLowerCase()) {
		const complete = await postJson('/api/agentCardClaimComplete', {
			agent: claim.agentEoa,
			temp: claim.tempEoa,
			card: claim.cardAddress,
			merchant,
		})
		clearAgentCardClaimHandoff()
		if (!complete.ok) return complete
		return { ok: true, txHash: typeof complete.data.txHash === 'string' ? complete.data.txHash : undefined }
	}

	if (owner.toLowerCase() !== claim.tempEoa.toLowerCase()) {
		return {
			ok: false,
			error: 'This merchant card is no longer held by the invite temp wallet.',
		}
	}

	const fund = await postJson('/api/agentCardClaimFundTemp', {
		agent: claim.agentEoa,
		temp: claim.tempEoa,
		card: claim.cardAddress,
	})
	if (!fund.ok) return fund

	const funded = await waitTempFunded(claim.tempEoa)
	if (!funded) {
		return { ok: false, error: 'Temp wallet did not receive gas in time. Please try again.' }
	}

	try {
		const pk = claim.tempPrivateKey.startsWith('0x') ? claim.tempPrivateKey : `0x${claim.tempPrivateKey}`
		const tempWallet = new ethers.Wallet(pk, conetDepinProvider)
		const cardWrite = new ethers.Contract(claim.cardAddress, OWNABLE_ABI, tempWallet)
		const tx = await cardWrite.transferOwnership!(merchant)
		const receipt = await tx.wait()
		if (receipt?.status !== 1) {
			return { ok: false, error: 'Ownership transfer reverted.' }
		}
	} catch (e) {
		const msg =
			e instanceof Error
				? (e as { shortMessage?: string }).shortMessage ?? e.message
				: 'Ownership transfer failed'
		return { ok: false, error: msg }
	}

	const complete = await postJson('/api/agentCardClaimComplete', {
		agent: claim.agentEoa,
		temp: claim.tempEoa,
		card: claim.cardAddress,
		merchant,
	})
	clearAgentCardClaimHandoff()
	if (!complete.ok) return complete
	return { ok: true, txHash: typeof complete.data.txHash === 'string' ? complete.data.txHash : undefined }
}
