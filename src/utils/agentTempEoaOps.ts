/**
 * Agent temp-EOA create / open-card / return-to-agent.
 * createRecover overwrites IndexedDB — always restore the agent afterward.
 */

import { ethers } from 'ethers'
import {
	checkBeamioAccountAPI,
	createRecover,
	restoreWithUserPin,
} from '@/services/beamio'
import { getCardsOfOwnerWithDetails, getCardOwner } from '@/services/BeamioCard'
import { getCoNET_Data } from '@/utils/globals'
import {
	unlockMerchantWorkspaceSession,
	type UnlockMerchantWorkspaceDeps,
} from '@/utils/unlockMerchantWorkspaceSession'
import {
	ensureAgentWorkspace,
	upsertAgentTempEoa,
	updateAgentTempKnownCards,
	saveLastStaffProgramCardForEoa,
	loadAgentWorkspace,
	type AgentTempEoaRecord,
} from '@/utils/agentWorkspaceLocal'
import {
	getSessionAgentAccessPassword,
	setSessionAgentAccessPassword,
} from '@/utils/agentSessionSecrets'

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PASS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASS_LOWER = 'abcdefghijkmnpqrstuvwxyz'
const PASS_DIGIT = '23456789'
const PASS_ALL = PASS_UPPER + PASS_LOWER + PASS_DIGIT

function randomChars(alphabet: string, n: number): string {
	const bytes = new Uint8Array(n)
	crypto.getRandomValues(bytes)
	let out = ''
	for (let i = 0; i < n; i++) out += alphabet[bytes[i]! % alphabet.length]!
	return out
}

export function generateRandomAgentTempPassword(): string {
	// ≥8, upper + lower + digit
	const base = [
		randomChars(PASS_UPPER, 1),
		randomChars(PASS_LOWER, 1),
		randomChars(PASS_DIGIT, 1),
		randomChars(PASS_ALL, 9),
	].join('')
	const arr = base.split('')
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
	}
	return arr.join('')
}

export async function generateAvailableTempBeamioTag(maxAttempts = 12): Promise<string> {
	for (let i = 0; i < maxAttempts; i++) {
		const tag = `agt${randomChars(ALPHANUM, 8)}`
		const available = await checkBeamioAccountAPI(tag).catch(() => false)
		if (available) return tag
	}
	throw new Error('Could not allocate a free BeamioTag for a temp EOA. Try again.')
}

export type AgentTempCardRow = {
	cardAddress: string
	/** true when on-chain owner() !== temp EOA */
	transferred: boolean
	owner?: string
	name?: string
}

export async function listTempEoaCardsWithTransferStatus(
	tempEoa: string,
	knownCardAddresses: string[] = [],
): Promise<AgentTempCardRow[]> {
	if (!ethers.isAddress(tempEoa)) return []
	const tempNorm = ethers.getAddress(tempEoa)
	const cards = await getCardsOfOwnerWithDetails(tempNorm).catch(() => [] as Awaited<
		ReturnType<typeof getCardsOfOwnerWithDetails>
	>)
	const rows: AgentTempCardRow[] = []
	const seen = new Set<string>()
	const nameByAddr = new Map<string, string>()

	for (const c of cards ?? []) {
		const addr = c?.cardAddress
		if (!addr || !ethers.isAddress(addr)) continue
		nameByAddr.set(ethers.getAddress(addr).toLowerCase(), c?.name ?? '')
		seen.add(ethers.getAddress(addr).toLowerCase())
	}
	for (const raw of knownCardAddresses) {
		if (!ethers.isAddress(raw)) continue
		seen.add(ethers.getAddress(raw).toLowerCase())
	}

	for (const lower of seen) {
		const cardAddress = ethers.getAddress(lower)
		let owner: string | undefined
		let transferred = false
		try {
			owner = await getCardOwner(cardAddress)
			transferred = owner.toLowerCase() !== tempNorm.toLowerCase()
		} catch {
			/* untrusted — keep as manageable until proven transferred */
			transferred = false
		}
		rows.push({
			cardAddress,
			transferred,
			owner,
			name: nameByAddr.get(lower) || undefined,
		})
	}

	return rows
}

async function restoreAgentSession(
	agentTag: string,
	agentPassword: string,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<boolean> {
	const result = await restoreWithUserPin(agentTag, agentPassword, false)
	const temp = result && typeof result === 'object' && result.profiles ? result : null
	if (!temp) return false
	const ready = await unlockMerchantWorkspaceSession(temp, deps)
	if (ready) setSessionAgentAccessPassword(agentPassword)
	return ready
}

export type CreateAgentTempEoaResult = {
	temp: AgentTempEoaRecord
	workspace: NonNullable<ReturnType<typeof loadAgentWorkspace>>
}

/**
 * Create a new temp EOA (random tag + password), register on-chain recover,
 * then restore the agent session so IndexedDB is not left on the temp wallet.
 */
export async function createAgentTempEoa(
	deps: UnlockMerchantWorkspaceDeps,
): Promise<CreateAgentTempEoaResult> {
	const agentData = getCoNET_Data()
	const agentEoa = agentData?.profiles?.[0]?.keyID?.trim()
	const agentTag = agentData?.beamio?.accountName?.trim()
	const agentPassword = getSessionAgentAccessPassword()
	if (!agentEoa || !ethers.isAddress(agentEoa) || !agentTag) {
		throw new Error('Agent wallet is not unlocked.')
	}
	if (!agentPassword) {
		throw new Error('Agent Access Password is missing from this session. Sign in again.')
	}

	ensureAgentWorkspace(agentEoa, agentTag)

	const beamioTag = await generateAvailableTempBeamioTag()
	const accessPassword = generateRandomAgentTempPassword()

	const created = await createRecover(beamioTag, accessPassword, null)
	if (!created?.temp?.profiles?.[0]?.keyID) {
		throw new Error('Failed to create temp EOA workspace.')
	}
	const tempEoa = ethers.getAddress(created.temp.profiles[0].keyID)
	const aaAccount = created.temp.profiles[0].aaAccount?.trim()

	const restored = await restoreAgentSession(agentTag, agentPassword, deps)
	if (!restored) {
		throw new Error('Temp EOA was created, but restoring the agent session failed. Sign in again with your agent Access Password.')
	}

	const record: AgentTempEoaRecord = {
		beamioTag,
		eoa: tempEoa,
		aaAccount: aaAccount && ethers.isAddress(aaAccount) ? ethers.getAddress(aaAccount) : undefined,
		accessPassword,
		createdAt: Date.now(),
		knownCardAddresses: [],
	}
	const workspace = upsertAgentTempEoa(agentEoa, record)
	return { temp: record, workspace }
}

/**
 * Switch session to a temp EOA and open Merchant OS (create / manage cards).
 * Does not select a specific card — use openTempMerchantCard for that.
 */
export async function openTempMerchantWorkspace(
	temp: AgentTempEoaRecord,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<{ ok: true } | { ok: false; reason: 'restore_failed' | 'invalid' }> {
	if (!ethers.isAddress(temp.eoa) || !temp.beamioTag || !temp.accessPassword) {
		return { ok: false, reason: 'invalid' }
	}
	const result = await restoreWithUserPin(temp.beamioTag, temp.accessPassword, false)
	const wallet = result && typeof result === 'object' && result.profiles ? result : null
	if (!wallet) return { ok: false, reason: 'restore_failed' }
	const ready = await unlockMerchantWorkspaceSession(wallet, deps)
	if (!ready) return { ok: false, reason: 'restore_failed' }
	return { ok: true }
}

/**
 * Switch session to a temp EOA and open Merchant OS for one of its cards.
 * Rejects if the card owner is no longer the temp EOA (transferred).
 */
export async function openTempMerchantCard(
	temp: AgentTempEoaRecord,
	cardAddress: string,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<{ ok: true } | { ok: false; reason: 'transferred' | 'restore_failed' | 'invalid' }> {
	if (!ethers.isAddress(cardAddress) || !ethers.isAddress(temp.eoa)) {
		return { ok: false, reason: 'invalid' }
	}
	const cardNorm = ethers.getAddress(cardAddress)
	const tempNorm = ethers.getAddress(temp.eoa)

	try {
		const owner = await getCardOwner(cardNorm)
		if (owner.toLowerCase() !== tempNorm.toLowerCase()) {
			return { ok: false, reason: 'transferred' }
		}
	} catch {
		/* proceed; Merchant OS will fail loudly if wrong */
	}

	const result = await restoreWithUserPin(temp.beamioTag, temp.accessPassword, false)
	const wallet = result && typeof result === 'object' && result.profiles ? result : null
	if (!wallet) return { ok: false, reason: 'restore_failed' }

	const ready = await unlockMerchantWorkspaceSession(wallet, deps)
	if (!ready) return { ok: false, reason: 'restore_failed' }

	saveLastStaffProgramCardForEoa(tempNorm, cardNorm)

	const agentData = getCoNET_Data()
	const agentWs = agentData?.profiles?.[0]?.keyID
		? loadAgentWorkspace(agentData.profiles[0].keyID)
		: null
	if (agentWs) {
		const known = new Set(temp.knownCardAddresses.map((a) => a.toLowerCase()))
		known.add(cardNorm.toLowerCase())
		updateAgentTempKnownCards(agentWs.agentEoa, tempNorm, [...known])
	}

	return { ok: true }
}

/** Restore the agent EOA after managing a temp merchant card. */
export async function returnToAgentWorkspace(
	deps: UnlockMerchantWorkspaceDeps,
): Promise<boolean> {
	const password = getSessionAgentAccessPassword()
	const ws = (() => {
		const data = getCoNET_Data()
		const eoa = data?.profiles?.[0]?.keyID
		if (eoa && ethers.isAddress(eoa)) {
			const direct = loadAgentWorkspace(eoa)
			if (direct) return direct
		}
		return null
	})()

	// Current session may be a temp — find agent via temp index
	const currentEoa = getCoNET_Data()?.profiles?.[0]?.keyID
	let agentTag = ws?.agentBeamioTag
	let agentEoa = ws?.agentEoa

	if (!agentTag && currentEoa && ethers.isAddress(currentEoa)) {
		const { findAgentWorkspaceByTempEoa } = await import('@/utils/agentWorkspaceLocal')
		const byTemp = findAgentWorkspaceByTempEoa(currentEoa)
		if (byTemp) {
			agentTag = byTemp.agentBeamioTag
			agentEoa = byTemp.agentEoa
		}
	}

	if (!agentTag || !password) return false
	void agentEoa
	return restoreAgentSession(agentTag, password, deps)
}

export function syncTempKnownCardsFromChain(
	agentEoa: string,
	tempEoa: string,
	rows: AgentTempCardRow[],
): void {
	updateAgentTempKnownCards(
		agentEoa,
		tempEoa,
		rows.map((r) => r.cardAddress),
	)
}
