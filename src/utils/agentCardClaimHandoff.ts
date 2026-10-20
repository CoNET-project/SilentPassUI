import { ethers } from 'ethers'

/**
 * Hash-only agent → merchant card claim handoff.
 * Captured before HashRouter rewrites location.hash (same pattern as merchantOsCredentialHandoff).
 * Never put tempPk in the server-visible search string.
 */
const FLOW_KEY = 'flow'
const FLOW_CLAIM = 'agentCardClaim'
const TEMP_PK_KEY = 'tempPk'
const CARD_KEY = 'card'
const AGENT_KEY = 'agent'
const TEMP_KEY = 'temp'

export type AgentCardClaimHandoff = {
	tempPrivateKey: string
	cardAddress: string
	agentEoa: string
	tempEoa: string
}

let held: AgentCardClaimHandoff | null | undefined

function readHashQuery(): URLSearchParams | null {
	if (typeof window === 'undefined') return null
	const hash = window.location.hash || ''
	const q = hash.indexOf('?')
	if (q < 0) return null
	return new URLSearchParams(hash.slice(q + 1))
}

function stripClaimParams(): void {
	if (typeof window === 'undefined') return
	const hash = window.location.hash || ''
	const q = hash.indexOf('?')
	if (q < 0) return
	const params = new URLSearchParams(hash.slice(q + 1))
	if (
		!params.has(FLOW_KEY) &&
		!params.has(TEMP_PK_KEY) &&
		!params.has(CARD_KEY) &&
		!params.has(AGENT_KEY) &&
		!params.has(TEMP_KEY)
	) {
		return
	}
	params.delete(FLOW_KEY)
	params.delete(TEMP_PK_KEY)
	params.delete(CARD_KEY)
	params.delete(AGENT_KEY)
	params.delete(TEMP_KEY)
	const path = hash.slice(1, q) || '/'
	const rest = params.toString()
	const nextHash = `#${path.startsWith('/') ? path : `/${path}`}${rest ? `?${rest}` : ''}`
	const url = `${window.location.pathname}${window.location.search}${nextHash === '#/' ? '' : nextHash}`
	window.history.replaceState(window.history.state, '', url)
}

function parseClaim(params: URLSearchParams): AgentCardClaimHandoff | null {
	if (params.get(FLOW_KEY) !== FLOW_CLAIM) return null
	const pkRaw = (params.get(TEMP_PK_KEY) || '').trim()
	const cardRaw = (params.get(CARD_KEY) || '').trim()
	const agentRaw = (params.get(AGENT_KEY) || '').trim()
	const tempRaw = (params.get(TEMP_KEY) || '').trim()
	if (!pkRaw || !ethers.isAddress(cardRaw) || !ethers.isAddress(agentRaw) || !ethers.isAddress(tempRaw)) {
		return null
	}
	try {
		const wallet = new ethers.Wallet(pkRaw.startsWith('0x') ? pkRaw : `0x${pkRaw}`)
		if (wallet.address.toLowerCase() !== ethers.getAddress(tempRaw).toLowerCase()) return null
		return {
			tempPrivateKey: wallet.privateKey,
			cardAddress: ethers.getAddress(cardRaw),
			agentEoa: ethers.getAddress(agentRaw),
			tempEoa: ethers.getAddress(tempRaw),
		}
	} catch {
		return null
	}
}

function readOnce(): AgentCardClaimHandoff | null {
	const params = readHashQuery()
	if (!params) return null
	const claim = parseClaim(params)
	if (params.get(FLOW_KEY) === FLOW_CLAIM || params.has(TEMP_PK_KEY)) {
		stripClaimParams()
	}
	return claim
}

if (typeof window !== 'undefined') {
	held = readOnce()
}

/** Peek without consuming — claim runs after createRecover, so keep until done. */
export function peekAgentCardClaimHandoff(): AgentCardClaimHandoff | null {
	return held ?? null
}

export function hasAgentCardClaimHandoff(): boolean {
	return peekAgentCardClaimHandoff() != null
}

/** Drop after claim succeeds or user abandons. */
export function clearAgentCardClaimHandoff(): void {
	held = null
}
