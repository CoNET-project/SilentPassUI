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
import {
	getCardsOfOwnerWithDetails,
	getCardOwner,
	isReferralAdminMerchantPackageCode,
	isReferralMerchantStartKitCode,
	postBusinessStartKetRedeemRedeem,
	postReferralAdminMerchantPackageClaim,
	postReferralMerchantStartKitClaim,
} from '@/services/BeamioCard'
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
	findAgentWorkspaceByTempEoa,
	type AgentTempEoaRecord,
} from '@/utils/agentWorkspaceLocal'
import {
	getSessionAgentAccessPassword,
	setSessionAgentAccessPassword,
} from '@/utils/agentSessionSecrets'
import { registerTempUnderAgent } from '@/utils/agentReferrerRegistryClient'

const AGENT_RETURN_CONTEXT_KEY = 'beamio:biz:agent-return-context:v1'

export type AgentReturnContext = {
	agentTag: string
	agentEoa: string
	at: number
}

/** Snapshot agent identity before switching into a temp EOA session. */
export function rememberAgentReturnContext(): void {
	const data = getCoNET_Data()
	const eoa = data?.profiles?.[0]?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) return
	const addr = ethers.getAddress(eoa)
	const byTemp = findAgentWorkspaceByTempEoa(addr)
	const direct = loadAgentWorkspace(addr)
	const ws =
		byTemp
		?? (direct && direct.agentEoa.toLowerCase() === addr.toLowerCase() ? direct : null)
	const agentTag = (ws?.agentBeamioTag || data?.beamio?.accountName || '').trim()
	const agentEoa = ws?.agentEoa || addr
	if (!agentTag || !ethers.isAddress(agentEoa)) return
	try {
		const payload: AgentReturnContext = {
			agentTag,
			agentEoa: ethers.getAddress(agentEoa),
			at: Date.now(),
		}
		sessionStorage.setItem(AGENT_RETURN_CONTEXT_KEY, JSON.stringify(payload))
	} catch {
		/* ignore quota / private mode */
	}
}

export function loadAgentReturnContext(): AgentReturnContext | null {
	try {
		const raw = sessionStorage.getItem(AGENT_RETURN_CONTEXT_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as AgentReturnContext
		const tag = typeof parsed?.agentTag === 'string' ? parsed.agentTag.trim() : ''
		const eoa = typeof parsed?.agentEoa === 'string' ? parsed.agentEoa.trim() : ''
		if (!tag || !ethers.isAddress(eoa)) return null
		return { agentTag: tag, agentEoa: ethers.getAddress(eoa), at: Number(parsed.at) || 0 }
	} catch {
		return null
	}
}

export function clearAgentReturnContext(): void {
	try {
		sessionStorage.removeItem(AGENT_RETURN_CONTEXT_KEY)
	} catch {
		/* ignore */
	}
}

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
	// Best-effort: register temp under agent on BeamioAgentReferrerRegistry.
	try {
		await registerTempUnderAgent(ethers.getAddress(agentEoa), tempEoa)
	} catch {
		/* local workspace still usable; retry on next create or dashboard refresh */
	}
	return { temp: record, workspace }
}

/**
 * Switch session to a temp EOA and open Merchant OS (create / manage cards).
 * Does not select a specific card — use openTempMerchantCard for that.
 */
export async function openTempMerchantWorkspace(
	temp: AgentTempEoaRecord,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<{ ok: true } | { ok: false; reason: 'restore_failed' | 'invalid' | 'missing_agent_password' }> {
	if (!ethers.isAddress(temp.eoa) || !temp.beamioTag || !temp.accessPassword) {
		return { ok: false, reason: 'invalid' }
	}
	if (!getSessionAgentAccessPassword()) {
		return { ok: false, reason: 'missing_agent_password' }
	}
	rememberAgentReturnContext()
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

	if (!getSessionAgentAccessPassword()) {
		return { ok: false, reason: 'restore_failed' }
	}
	rememberAgentReturnContext()
	const agentEoaBeforeSwitch = (() => {
		const eoa = getCoNET_Data()?.profiles?.[0]?.keyID
		if (eoa && ethers.isAddress(eoa)) {
			const byTemp = findAgentWorkspaceByTempEoa(eoa)
			if (byTemp) return byTemp.agentEoa
			const direct = loadAgentWorkspace(eoa)
			if (direct && direct.agentEoa.toLowerCase() === ethers.getAddress(eoa).toLowerCase()) {
				return direct.agentEoa
			}
		}
		return loadAgentReturnContext()?.agentEoa
	})()

	const result = await restoreWithUserPin(temp.beamioTag, temp.accessPassword, false)
	const wallet = result && typeof result === 'object' && result.profiles ? result : null
	if (!wallet) return { ok: false, reason: 'restore_failed' }

	const ready = await unlockMerchantWorkspaceSession(wallet, deps)
	if (!ready) return { ok: false, reason: 'restore_failed' }

	saveLastStaffProgramCardForEoa(tempNorm, cardNorm)

	if (agentEoaBeforeSwitch && ethers.isAddress(agentEoaBeforeSwitch)) {
		const known = new Set(temp.knownCardAddresses.map((a) => a.toLowerCase()))
		known.add(cardNorm.toLowerCase())
		updateAgentTempKnownCards(agentEoaBeforeSwitch, tempNorm, [...known])
	}

	return { ok: true }
}

/**
 * Restore the agent EOA after managing a temp merchant card.
 * Prefer temp→agent lookup over loadAgentWorkspace(currentEoa): a polluted
 * workspace key under the temp address must never win.
 */
export async function returnToAgentWorkspace(
	deps: UnlockMerchantWorkspaceDeps,
	opts?: { agentPassword?: string },
): Promise<boolean> {
	const password = (opts?.agentPassword?.trim() || getSessionAgentAccessPassword() || '').trim()
	const currentEoa = getCoNET_Data()?.profiles?.[0]?.keyID?.trim()

	let agentTag: string | undefined
	let agentEoa: string | undefined

	// 1) Current session is a known temp → owning agent workspace
	if (currentEoa && ethers.isAddress(currentEoa)) {
		const byTemp = findAgentWorkspaceByTempEoa(currentEoa)
		if (byTemp?.agentBeamioTag) {
			agentTag = byTemp.agentBeamioTag
			agentEoa = byTemp.agentEoa
		}
	}

	// 2) Current EOA is the agent workspace root (not a polluted temp key)
	if (!agentTag && currentEoa && ethers.isAddress(currentEoa)) {
		const addr = ethers.getAddress(currentEoa)
		const direct = loadAgentWorkspace(addr)
		if (direct && direct.agentEoa.toLowerCase() === addr.toLowerCase() && direct.agentBeamioTag) {
			agentTag = direct.agentBeamioTag
			agentEoa = direct.agentEoa
		}
	}

	// 3) sessionStorage snapshot taken before openTemp
	if (!agentTag) {
		const hint = loadAgentReturnContext()
		if (hint?.agentTag) {
			agentTag = hint.agentTag
			agentEoa = hint.agentEoa
		}
	}

	if (!agentTag || !password) return false
	const ok = await restoreAgentSession(agentTag, password, deps)
	if (ok) {
		clearAgentReturnContext()
		void agentEoa
	}
	return ok
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

/**
 * Claim create-merchant-card entitlement (BusinessStartKet #0) onto the temp EOA.
 * Plain Ket codes need only the temp address; Start Kit / admin package codes need
 * a temp-session EIP-712 signature, then the agent session is restored.
 */
export async function claimTempCreateMerchantCardNft(
	temp: AgentTempEoaRecord,
	code: string,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<{ ok: true; recipient?: string } | { ok: false; error: string }> {
	const trimmed = code.trim()
	if (!trimmed) return { ok: false, error: 'Enter a redeem code.' }
	if (!ethers.isAddress(temp.eoa)) return { ok: false, error: 'Invalid temp EOA.' }

	const isAdminPkg = isReferralAdminMerchantPackageCode(trimmed)
	const isStartKit = isReferralMerchantStartKitCode(trimmed)

	if (isAdminPkg || isStartKit) {
		const agentPassword = getSessionAgentAccessPassword()
		const agentData = getCoNET_Data()
		const agentTag =
			loadAgentWorkspace(agentData?.profiles?.[0]?.keyID ?? '')?.agentBeamioTag
			|| agentData?.beamio?.accountName?.trim()
			|| ''
		if (!agentPassword || !agentTag) {
			return {
				ok: false,
				error: 'Agent Access Password is missing from this session. Sign in again.',
			}
		}

		const unlocked = await restoreWithUserPin(temp.beamioTag, temp.accessPassword, false)
		const profiles =
			unlocked && typeof unlocked === 'object' && Array.isArray(unlocked.profiles)
				? unlocked.profiles
				: null
		const pk =
			typeof profiles?.[0]?.privateKeyArmor === 'string'
				? profiles[0].privateKeyArmor.trim()
				: ''
		if (!pk) {
			await restoreAgentSession(agentTag, agentPassword, deps).catch(() => false)
			return { ok: false, error: 'Could not unlock the temp wallet to sign the claim.' }
		}

		let signingAddress = ''
		try {
			signingAddress = new ethers.Wallet(pk).address
		} catch {
			await restoreAgentSession(agentTag, agentPassword, deps).catch(() => false)
			return { ok: false, error: 'Could not unlock the temp wallet to sign the claim.' }
		}
		if (signingAddress.toLowerCase() !== ethers.getAddress(temp.eoa).toLowerCase()) {
			await restoreAgentSession(agentTag, agentPassword, deps).catch(() => false)
			return { ok: false, error: 'Temp session wallet does not match this temp EOA.' }
		}

		try {
			const res = isAdminPkg
				? await postReferralAdminMerchantPackageClaim({ privateKeyArmor: pk, code: trimmed })
				: await postReferralMerchantStartKitClaim({ privateKeyArmor: pk, code: trimmed })
			if (!res.success) {
				return { ok: false, error: res.error ?? 'Claim failed. Try again.' }
			}
			return { ok: true }
		} finally {
			await restoreAgentSession(agentTag, agentPassword, deps).catch(() => false)
		}
	}

	const res = await postBusinessStartKetRedeemRedeem(temp.eoa, trimmed)
	if (!res.success) {
		return { ok: false, error: res.error ?? 'Claim failed. Try again.' }
	}
	return { ok: true, recipient: res.recipient }
}
