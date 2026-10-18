/**
 * BeamioAgentReferrerRegistry — Consumer PWA client (RPC read + gasless EIP-712 write).
 * Invite path: new user offline-signs RegisterReferrer under introducer EOA.
 * Writes: POST https://beamio.app/api/agentReferrerRegister
 * Reads: CoNET RPC first; GET /api/agentReferrerRegistry as nonce helper.
 */
import { ethers } from 'ethers'
import { CONET_AGENT_REFERRER_REGISTRY } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'

const BEAMIO_API = 'https://beamio.app/api'

export const AGENT_REFERRER_EIP712_DOMAIN = {
	name: 'BeamioAgentReferrerRegistry',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_AGENT_REFERRER_REGISTRY,
} as const

/** Mutable TypedDataField[] — ethers Wallet.signTypedData rejects readonly `as const` arrays (TS4104). */
export const AGENT_REFERRER_TYPES: Record<string, Array<{ name: string; type: string }>> = {
	RegisterReferrer: [
		{ name: 'introducer', type: 'address' },
		{ name: 'referee', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
	RegisterAgent: [
		{ name: 'agent', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
	RegisterTemp: [
		{ name: 'agent', type: 'address' },
		{ name: 'temp', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
	RegisterMerchant: [
		{ name: 'agent', type: 'address' },
		{ name: 'merchant', type: 'address' },
		{ name: 'temp', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

const VIEW_ABI = [
	'function introducerOf(address) view returns (address)',
	'function nonceOf(address) view returns (uint256)',
	'function isAgent(address) view returns (bool)',
	'function agentOfTemp(address) view returns (address)',
	'function agentOfMerchant(address) view returns (address)',
] as const

const DEADLINE_SEC = 30 * 60

type RegisterResult = { success: true; hash?: string } | { success: false; error: string }

function registryContract(): ethers.Contract {
	return new ethers.Contract(CONET_AGENT_REFERRER_REGISTRY, VIEW_ABI, conetDepinProvider)
}

function walletFromConsumerKey(privateKeyArmor?: string | null): ethers.Wallet | null {
	const pk =
		(privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor(CoNET_Data?.profiles?.[0]) || '').trim()
	if (!pk) return null
	try {
		return new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`)
	} catch {
		return null
	}
}

export async function fetchNonceOf(eoa: string): Promise<bigint | null> {
	if (!ethers.isAddress(eoa)) return null
	try {
		const n = await registryContract().nonceOf(ethers.getAddress(eoa))
		return BigInt(n.toString())
	} catch {
		try {
			const res = await fetch(
				`${BEAMIO_API}/agentReferrerRegistry?wallet=${encodeURIComponent(ethers.getAddress(eoa))}`,
			)
			if (!res.ok) return null
			const j = (await res.json()) as { nonce?: string }
			if (j?.nonce == null) return null
			return BigInt(j.nonce)
		} catch {
			return null
		}
	}
}

/** Trusted RPC read: already bound introducer for this referee (or null). */
export async function fetchIntroducerOf(refereeEoa: string): Promise<string | null> {
	if (!ethers.isAddress(refereeEoa)) return null
	try {
		const v = await registryContract().introducerOf(ethers.getAddress(refereeEoa))
		if (!v || v === ethers.ZeroAddress) return null
		return ethers.getAddress(v)
	} catch {
		return null
	}
}

async function postRegister(body: Record<string, unknown>): Promise<RegisterResult> {
	try {
		const res = await fetch(`${BEAMIO_API}/agentReferrerRegister`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const j = (await res.json().catch(() => ({}))) as {
			success?: boolean
			hash?: string
			error?: string
			txHash?: string
		}
		if (!res.ok || !j.success) {
			return { success: false, error: String(j.error || `HTTP ${res.status}`) }
		}
		return { success: true, hash: j.hash || j.txHash }
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

function deadlineUnix(): bigint {
	return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SEC)
}

/**
 * New user (referee) binds under introducer via offline EIP-712 + Master gas.
 * `privateKeyArmor` = Consumer global signing key (mnemonic-derived).
 */
export async function registerReferrerUnderIntroducer(
	introducerEoa: string,
	privateKeyArmor?: string | null,
	refereeEoa?: string,
): Promise<RegisterResult> {
	const wallet = walletFromConsumerKey(privateKeyArmor)
	if (!wallet) return { success: false, error: 'Wallet signing key is not available' }
	if (!ethers.isAddress(introducerEoa)) {
		return { success: false, error: 'Invalid introducer address' }
	}
	const introducer = ethers.getAddress(introducerEoa)
	const referee = ethers.getAddress(refereeEoa || wallet.address)
	if (wallet.address.toLowerCase() !== referee.toLowerCase()) {
		return { success: false, error: 'Signer mismatch for RegisterReferrer' }
	}
	if (introducer.toLowerCase() === referee.toLowerCase()) {
		return { success: false, error: 'Cannot register yourself as your own introducer' }
	}
	const existing = await fetchIntroducerOf(referee)
	if (existing) {
		return { success: true, hash: undefined }
	}
	const nonce = await fetchNonceOf(referee)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const value = { introducer, referee, nonce, deadline }
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterReferrer: AGENT_REFERRER_TYPES.RegisterReferrer },
		value,
	)
	return postRegister({
		op: 'registerReferrer',
		introducer,
		referee,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}

export async function fetchIsAgent(agentEoa: string): Promise<boolean | null> {
	if (!ethers.isAddress(agentEoa)) return null
	try {
		return Boolean(await registryContract().isAgent(ethers.getAddress(agentEoa)))
	} catch {
		return null
	}
}

export async function fetchAgentOfMerchant(merchantEoa: string): Promise<string | null> {
	if (!ethers.isAddress(merchantEoa)) return null
	try {
		const v = await registryContract().agentOfMerchant(ethers.getAddress(merchantEoa))
		if (!v || v === ethers.ZeroAddress) return null
		return ethers.getAddress(v)
	} catch {
		return null
	}
}

export async function registerAgentOnChain(): Promise<RegisterResult> {
	const wallet = walletFromConsumerKey()
	if (!wallet) return { success: false, error: 'Wallet signing key is not available' }
	const already = await fetchIsAgent(wallet.address)
	if (already === true) return { success: true }
	if (already == null) return { success: false, error: 'Unable to read agent status' }
	const nonce = await fetchNonceOf(wallet.address)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const agent = ethers.getAddress(wallet.address)
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterAgent: AGENT_REFERRER_TYPES.RegisterAgent },
		{ agent, nonce, deadline },
	)
	return postRegister({
		op: 'registerAgent',
		agent,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}

export async function registerTempUnderAgent(tempEoa: string): Promise<RegisterResult> {
	const wallet = walletFromConsumerKey()
	if (!wallet) return { success: false, error: 'Wallet signing key is not available' }
	if (!ethers.isAddress(tempEoa)) return { success: false, error: 'Invalid temp account' }
	const agent = ethers.getAddress(wallet.address)
	const temp = ethers.getAddress(tempEoa)
	if (agent.toLowerCase() === temp.toLowerCase()) {
		return { success: false, error: 'Temp account must be a different wallet' }
	}
	const bound = await registryContract().agentOfTemp(temp).then(
		(v: string) => (v && v !== ethers.ZeroAddress ? ethers.getAddress(v) : null),
	).catch(() => null)
	if (bound && bound.toLowerCase() === agent.toLowerCase()) return { success: true }
	const nonce = await fetchNonceOf(agent)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterTemp: AGENT_REFERRER_TYPES.RegisterTemp },
		{ agent, temp, nonce, deadline },
	)
	return postRegister({
		op: 'registerTemp',
		agent,
		temp,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}

export async function registerMerchantUnderAgent(merchantEoa: string, tempEoa?: string): Promise<RegisterResult> {
	const wallet = walletFromConsumerKey()
	if (!wallet) return { success: false, error: 'Wallet signing key is not available' }
	if (!ethers.isAddress(merchantEoa)) return { success: false, error: 'Invalid merchant account' }
	const agent = ethers.getAddress(wallet.address)
	const merchant = ethers.getAddress(merchantEoa)
	const temp = tempEoa && ethers.isAddress(tempEoa) ? ethers.getAddress(tempEoa) : ethers.ZeroAddress
	const existing = await fetchAgentOfMerchant(merchant)
	if (existing && existing.toLowerCase() === agent.toLowerCase()) return { success: true }
	const nonce = await fetchNonceOf(agent)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterMerchant: AGENT_REFERRER_TYPES.RegisterMerchant },
		{ agent, merchant, temp, nonce, deadline },
	)
	return postRegister({
		op: 'registerMerchant',
		agent,
		merchant,
		temp,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
}
