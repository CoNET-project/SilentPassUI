/**
 * Agent workspace local store — role + temp EOA metadata + Access Passwords.
 * Private keys stay session-only (bizSite rule); Access Passwords may persist so the
 * agent can reveal credentials for temp EOAs they created.
 */

import { ethers } from 'ethers'

export type BizWorkspaceRole = 'merchant' | 'agent'

export type AgentTempEoaRecord = {
	/** BeamioTag without @ */
	beamioTag: string
	/** Checksum EOA */
	eoa: string
	/** Optional AA once known */
	aaAccount?: string
	/** Access Password (revealable to the agent) */
	accessPassword: string
	createdAt: number
	/** Merchant cards last seen under this temp (addresses lowercased) */
	knownCardAddresses: string[]
}

export type AgentWorkspaceRecord = {
	role: 'agent'
	/** Agent BeamioTag without @ */
	agentBeamioTag: string
	/** Agent EOA checksum */
	agentEoa: string
	temps: AgentTempEoaRecord[]
	updatedAt: number
}

const ROLE_KEY_LEGACY = 'beamio:biz:workspace-role:v1'
const ROLE_KEY_PREFIX = 'beamio:biz:workspace-role:v1:'
const AGENT_PREFIX = 'beamio:biz:agent-workspace:v1:'

function agentKey(agentEoa: string): string {
	return `${AGENT_PREFIX}${ethers.getAddress(agentEoa).toLowerCase()}`
}

function roleKeyForEoa(eoa: string): string {
	return `${ROLE_KEY_PREFIX}${ethers.getAddress(eoa).toLowerCase()}`
}

/**
 * Persist workspace role. When `eoa` is known, also write an EOA-partitioned key
 * so merchant vs agent logins on the same browser do not overwrite each other.
 * Legacy global key remains for mid-onboarding (role chosen before EOA exists).
 */
export function setBizWorkspaceRole(role: BizWorkspaceRole, eoa?: string | null): void {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(ROLE_KEY_LEGACY, role)
		if (eoa && ethers.isAddress(eoa)) {
			window.localStorage.setItem(roleKeyForEoa(eoa), role)
		}
	} catch {
		/* ignore */
	}
}

/**
 * Prefer EOA-partitioned role when `eoa` is provided; fall back to legacy global
 * when no partitioned value exists (migration / mid-onboarding).
 */
export function getBizWorkspaceRole(eoa?: string | null): BizWorkspaceRole | null {
	if (typeof window === 'undefined') return null
	try {
		if (eoa && ethers.isAddress(eoa)) {
			const keyed = window.localStorage.getItem(roleKeyForEoa(eoa))
			if (keyed === 'merchant' || keyed === 'agent') return keyed
		}
		const v = window.localStorage.getItem(ROLE_KEY_LEGACY)
		if (v === 'merchant' || v === 'agent') return v
		return null
	} catch {
		return null
	}
}

export function loadAgentWorkspace(agentEoa: string | null | undefined): AgentWorkspaceRecord | null {
	if (typeof window === 'undefined' || !agentEoa || !ethers.isAddress(agentEoa)) return null
	try {
		const raw = window.localStorage.getItem(agentKey(agentEoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as AgentWorkspaceRecord
		if (parsed?.role !== 'agent' || !Array.isArray(parsed.temps)) return null
		return parsed
	} catch {
		return null
	}
}

export function saveAgentWorkspace(record: AgentWorkspaceRecord): void {
	if (typeof window === 'undefined') return
	try {
		const next: AgentWorkspaceRecord = {
			...record,
			role: 'agent',
			agentEoa: ethers.getAddress(record.agentEoa),
			temps: record.temps.map((t) => ({
				...t,
				eoa: ethers.getAddress(t.eoa),
				knownCardAddresses: (t.knownCardAddresses ?? []).map((a) => a.toLowerCase()),
			})),
			updatedAt: Date.now(),
		}
		window.localStorage.setItem(agentKey(next.agentEoa), JSON.stringify(next))
		setBizWorkspaceRole('agent', next.agentEoa)
	} catch {
		/* ignore */
	}
}

export function ensureAgentWorkspace(agentEoa: string, agentBeamioTag: string): AgentWorkspaceRecord {
	const existing = loadAgentWorkspace(agentEoa)
	if (existing) {
		if (existing.agentBeamioTag !== agentBeamioTag) {
			const next = { ...existing, agentBeamioTag, updatedAt: Date.now() }
			saveAgentWorkspace(next)
			return next
		}
		return existing
	}
	const fresh: AgentWorkspaceRecord = {
		role: 'agent',
		agentBeamioTag,
		agentEoa: ethers.getAddress(agentEoa),
		temps: [],
		updatedAt: Date.now(),
	}
	saveAgentWorkspace(fresh)
	return fresh
}

export function upsertAgentTempEoa(agentEoa: string, temp: AgentTempEoaRecord): AgentWorkspaceRecord {
	const ws = loadAgentWorkspace(agentEoa) ?? {
		role: 'agent' as const,
		agentBeamioTag: '',
		agentEoa: ethers.getAddress(agentEoa),
		temps: [],
		updatedAt: Date.now(),
	}
	const eoaLower = ethers.getAddress(temp.eoa).toLowerCase()
	const temps = ws.temps.filter((t) => t.eoa.toLowerCase() !== eoaLower)
	temps.unshift({
		...temp,
		eoa: ethers.getAddress(temp.eoa),
		knownCardAddresses: (temp.knownCardAddresses ?? []).map((a) => a.toLowerCase()),
	})
	const next = { ...ws, temps, updatedAt: Date.now() }
	saveAgentWorkspace(next)
	return next
}

export function updateAgentTempKnownCards(
	agentEoa: string,
	tempEoa: string,
	cardAddresses: string[],
): void {
	const ws = loadAgentWorkspace(agentEoa)
	if (!ws) return
	const tempLower = ethers.getAddress(tempEoa).toLowerCase()
	const temps = ws.temps.map((t) =>
		t.eoa.toLowerCase() === tempLower
			? {
					...t,
					knownCardAddresses: cardAddresses
						.filter((a) => ethers.isAddress(a))
						.map((a) => ethers.getAddress(a).toLowerCase()),
				}
			: t,
	)
	saveAgentWorkspace({ ...ws, temps, updatedAt: Date.now() })
}

/** Find agent workspace that owns a given temp EOA (for return-to-agent). */
export function findAgentWorkspaceByTempEoa(tempEoa: string): AgentWorkspaceRecord | null {
	if (typeof window === 'undefined' || !ethers.isAddress(tempEoa)) return null
	const needle = ethers.getAddress(tempEoa).toLowerCase()
	try {
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i)
			if (!key?.startsWith(AGENT_PREFIX)) continue
			const raw = window.localStorage.getItem(key)
			if (!raw) continue
			const parsed = JSON.parse(raw) as AgentWorkspaceRecord
			if (parsed?.role !== 'agent' || !Array.isArray(parsed.temps)) continue
			if (parsed.temps.some((t) => t.eoa?.toLowerCase() === needle)) return parsed
		}
	} catch {
		/* ignore */
	}
	return null
}

/** Same trusted-cache shape as Merchant OS last-staff-program-card. */
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'

export function lastStaffProgramCardTrustedCacheKey(eoa: string): string {
	return `eoa:${ethers.getAddress(eoa)}:biz:last-staff-program-card:v1`
}

export function saveLastStaffProgramCardForEoa(eoa: string, cardAddress: string): void {
	if (typeof window === 'undefined') return
	if (!ethers.isAddress(eoa) || !ethers.isAddress(cardAddress)) return
	try {
		window.localStorage.setItem(
			`${BIZ_CACHE_PREFIX}${lastStaffProgramCardTrustedCacheKey(eoa)}`,
			JSON.stringify({ value: ethers.getAddress(cardAddress), updatedAt: Date.now() }),
		)
	} catch {
		/* ignore */
	}
}
