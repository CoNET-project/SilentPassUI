/**
 * BeamioAgentReferrerRegistry — Merchant OS client (RPC read + gasless EIP-712 write).
 * Writes: offline sign → POST https://beamio.app/api/agentReferrerRegister
 * Reads: CoNET RPC first; GET /api/agentReferrerRegistry as nonce helper.
 */
import { ethers } from 'ethers'
import { CONET_AGENT_REFERRER_REGISTRY } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'

const BEAMIO_API = 'https://beamio.app/api'

export const AGENT_REFERRER_EIP712_DOMAIN = {
	name: 'BeamioAgentReferrerRegistry',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_AGENT_REFERRER_REGISTRY,
} as const

/** Mutable TypedDataField[] — ethers Wallet.signTypedData rejects readonly `as const` arrays (TS4104). */
export const AGENT_REFERRER_TYPES: Record<string, Array<{ name: string; type: string }>> = {
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
	RegisterReferrer: [
		{ name: 'introducer', type: 'address' },
		{ name: 'referee', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

const VIEW_ABI = [
	'function isAgent(address) view returns (bool)',
	'function agentOfTemp(address) view returns (address)',
	'function agentOfMerchant(address) view returns (address)',
	'function introducerOf(address) view returns (address)',
	'function nonceOf(address) view returns (uint256)',
	'function tempHandedOff(address) view returns (bool)',
] as const

const IS_AGENT_CACHE_PREFIX = 'beamio:biz:agent-referrer-is-agent:v1:'
const DEADLINE_SEC = 30 * 60

function registryContract(): ethers.Contract {
	return new ethers.Contract(CONET_AGENT_REFERRER_REGISTRY, VIEW_ABI, conetDepinProvider)
}

function walletFromSession(): ethers.Wallet {
	const pk = getSessionPrivateKeyArmor()?.trim()
	if (!pk) throw new Error('Session private key is not unlocked.')
	return new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`)
}

function isAgentCacheKey(eoa: string): string {
	return `${IS_AGENT_CACHE_PREFIX}${ethers.getAddress(eoa).toLowerCase()}`
}

/** Trusted local cache for login routing (RPC-first; failure keeps last trusted). */
export function loadCachedIsAgent(eoa: string): boolean | null {
	if (!ethers.isAddress(eoa)) return null
	try {
		const raw = localStorage.getItem(isAgentCacheKey(eoa))
		if (raw === '1') return true
		if (raw === '0') return false
	} catch {
		/* ignore */
	}
	return null
}

export function saveCachedIsAgent(eoa: string, value: boolean): void {
	if (!ethers.isAddress(eoa)) return
	try {
		localStorage.setItem(isAgentCacheKey(eoa), value ? '1' : '0')
	} catch {
		/* ignore */
	}
}

/**
 * RPC-first `isAgent`. On failure returns cached value (or null if never trusted).
 */
export async function fetchIsAgentOnChain(eoa: string): Promise<{ ok: true; isAgent: boolean } | { ok: false; isAgent: boolean | null }> {
	if (!ethers.isAddress(eoa)) return { ok: false, isAgent: null }
	const addr = ethers.getAddress(eoa)
	try {
		const c = registryContract()
		const v = Boolean(await c.isAgent(addr))
		saveCachedIsAgent(addr, v)
		return { ok: true, isAgent: v }
	} catch {
		return { ok: false, isAgent: loadCachedIsAgent(addr) }
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

type RegisterResult = { success: true; hash?: string } | { success: false; error: string }

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

/** Agent self-registers on-chain (offline EIP-712 + Master gas). */
export async function registerAgentOnChain(agentEoa?: string): Promise<RegisterResult> {
	const wallet = walletFromSession()
	const agent = ethers.getAddress(agentEoa || wallet.address)
	if (wallet.address.toLowerCase() !== agent.toLowerCase()) {
		return { success: false, error: 'Signer mismatch for RegisterAgent' }
	}
	const nonce = await fetchNonceOf(agent)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const value = { agent, nonce, deadline }
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterAgent: AGENT_REFERRER_TYPES.RegisterAgent },
		value,
	)
	const result = await postRegister({
		op: 'registerAgent',
		agent,
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
	if (result.success) saveCachedIsAgent(agent, true)
	return result
}

/** Agent registers a temp EOA under themselves. */
export async function registerTempUnderAgent(agentEoa: string, tempEoa: string): Promise<RegisterResult> {
	const wallet = walletFromSession()
	const agent = ethers.getAddress(agentEoa)
	const temp = ethers.getAddress(tempEoa)
	if (wallet.address.toLowerCase() !== agent.toLowerCase()) {
		return { success: false, error: 'Signer mismatch for RegisterTemp' }
	}
	const nonce = await fetchNonceOf(agent)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const value = { agent, temp, nonce, deadline }
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterTemp: AGENT_REFERRER_TYPES.RegisterTemp },
		value,
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

/** Agent registers a merchant EOA after temp handoff (temp optional). */
export async function registerMerchantUnderAgent(
	agentEoa: string,
	merchantEoa: string,
	tempEoa?: string | null,
): Promise<RegisterResult> {
	const wallet = walletFromSession()
	const agent = ethers.getAddress(agentEoa)
	const merchant = ethers.getAddress(merchantEoa)
	const temp =
		tempEoa && ethers.isAddress(tempEoa) ? ethers.getAddress(tempEoa) : ethers.ZeroAddress
	if (wallet.address.toLowerCase() !== agent.toLowerCase()) {
		return { success: false, error: 'Signer mismatch for RegisterMerchant' }
	}
	const nonce = await fetchNonceOf(agent)
	if (nonce == null) return { success: false, error: 'Unable to read registry nonce' }
	const deadline = deadlineUnix()
	const value = { agent, merchant, temp, nonce, deadline }
	const signature = await wallet.signTypedData(
		AGENT_REFERRER_EIP712_DOMAIN,
		{ RegisterMerchant: AGENT_REFERRER_TYPES.RegisterMerchant },
		value,
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

/**
 * New user (referee) binds under introducer. Uses session key = referee.
 * Used by invite deep-link registration.
 */
export async function registerReferrerUnderIntroducer(
	introducerEoa: string,
	refereeEoa?: string,
): Promise<RegisterResult> {
	const wallet = walletFromSession()
	const introducer = ethers.getAddress(introducerEoa)
	const referee = ethers.getAddress(refereeEoa || wallet.address)
	if (wallet.address.toLowerCase() !== referee.toLowerCase()) {
		return { success: false, error: 'Signer mismatch for RegisterReferrer' }
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

/** Best-effort: if card owner changed away from temp, register merchant under agent. */
export async function maybeRegisterMerchantAfterTempHandoff(params: {
	agentEoa: string
	tempEoa: string
	merchantEoa: string
}): Promise<RegisterResult | null> {
	const { agentEoa, tempEoa, merchantEoa } = params
	if (!ethers.isAddress(agentEoa) || !ethers.isAddress(tempEoa) || !ethers.isAddress(merchantEoa)) {
		return null
	}
	const agent = ethers.getAddress(agentEoa)
	const temp = ethers.getAddress(tempEoa)
	const merchant = ethers.getAddress(merchantEoa)
	if (merchant.toLowerCase() === temp.toLowerCase()) return null
	try {
		const c = registryContract()
		const existing = await c.agentOfMerchant(merchant)
		if (existing && existing !== ethers.ZeroAddress) return null
		const tempAgent = await c.agentOfTemp(temp)
		if (String(tempAgent).toLowerCase() !== agent.toLowerCase()) {
			/* Temp may not be on-chain yet; still try register with temp link */
		}
	} catch {
		/* untrusted read — still attempt write */
	}
	return registerMerchantUnderAgent(agent, merchant, temp)
}
