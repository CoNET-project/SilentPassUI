/**
 * Consumer agent workspace: temp Beamio IDs used to pre-register merchants.
 * Chain registry is the bind truth. This store only keeps the temp @tag and
 * access password so the agent can reveal them later. It never stores a private key.
 */
import { ethers } from 'ethers'
import { CONET_BUSINESS_START_KET } from '@/config/chainAddresses'
import {
	checkBeamioAccountAPI,
	createDetachedRecoverAccount,
	unlockDetachedRecoverPrivateKey,
} from '@/services/beamio'
import { getCardOwner, getCardsOfOwnerWithDetails } from '@/services/BeamioCard'
import { claimReferralRedeemCode } from '@/services/referralRegistryRedeem'
import {
	fetchActiveTempCountOf,
	MAX_ACTIVE_TEMPS_PER_AGENT,
	registerTempUnderAgent,
} from '@/utils/agentReferrerRegistryClient'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

export type AgentTempAccount = {
	beamioTag: string
	eoa: string
	accessPassword: string
	createdAt: number
}

const TAG_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function storageKey(agentEoa: string): string {
	return `beamio:app:agent-workspace:v1:${agentEoa.trim().toLowerCase()}`
}

export function loadAgentTempAccounts(agentEoa: string): AgentTempAccount[] {
	if (!agentEoa || !ethers.isAddress(agentEoa)) return []
	try {
		const raw = localStorage.getItem(storageKey(agentEoa))
		if (!raw) return []
		const parsed = JSON.parse(raw) as { temps?: AgentTempAccount[] }
		if (!Array.isArray(parsed?.temps)) return []
		return parsed.temps.filter(
			(row) =>
				row
				&& typeof row.beamioTag === 'string'
				&& ethers.isAddress(row.eoa)
				&& typeof row.accessPassword === 'string',
		)
	} catch {
		return []
	}
}

function saveAgentTempAccounts(agentEoa: string, temps: AgentTempAccount[]): void {
	localStorage.setItem(storageKey(agentEoa), JSON.stringify({ temps }))
}

function randomFrom(alphabet: string, length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length))
	let out = ''
	for (const b of bytes) out += alphabet[b % alphabet.length]
	return out
}

function generateTempPassword(): string {
	const body = randomFrom(TAG_ALPHABET, 10)
	return `A${body}7`
}

async function generateAvailableTempTag(): Promise<string> {
	for (let i = 0; i < 8; i++) {
		const tag = `agt${randomFrom(TAG_ALPHABET, 8)}`
		const available = await checkBeamioAccountAPI(tag)
		if (available) return tag
	}
	throw new Error('Could not find an available temp Beamio ID')
}

export async function createAgentTempAccount(agentEoa: string): Promise<AgentTempAccount> {
	if (!ethers.isAddress(agentEoa)) throw new Error('Sign in before creating a temp account')
	const activeCount = await fetchActiveTempCountOf(agentEoa)
	if (activeCount != null && activeCount >= MAX_ACTIVE_TEMPS_PER_AGENT) {
		throw new Error(
			`You already have ${MAX_ACTIVE_TEMPS_PER_AGENT} active temp accounts. Hand one off to a merchant to free a slot.`,
		)
	}
	const beamioTag = await generateAvailableTempTag()
	const accessPassword = generateTempPassword()
	const created = await createDetachedRecoverAccount(beamioTag, accessPassword)
	if (!created?.eoa) throw new Error('Temp account registration failed')
	const record: AgentTempAccount = {
		beamioTag,
		eoa: ethers.getAddress(created.eoa),
		accessPassword,
		createdAt: Date.now(),
	}
	const temps = loadAgentTempAccounts(agentEoa)
	temps.unshift(record)
	saveAgentTempAccounts(agentEoa, temps)
	const bound = await registerTempUnderAgent(record.eoa)
	if (!bound.success) {
		throw new Error(bound.error || 'Temp account was created but chain bind failed')
	}
	return record
}

export type AgentTempMerchantCard = {
	cardAddress: string
	name: string
	transferred: boolean
	owner: string
}

/** Agent invite sheet only. This card stays off that list; it is not an API exclude. */
const AGENT_INVITE_SHEET_HIDDEN_CARD_ADDRESSES = new Set([
	'0x56aadb2fe8f48867d8810e4469156c6c16790b55',
])

export function isHiddenFromAgentInviteSheet(cardAddress: string): boolean {
	const raw = cardAddress.trim()
	if (!raw || !ethers.isAddress(raw)) return false
	return AGENT_INVITE_SHEET_HIDDEN_CARD_ADDRESSES.has(ethers.getAddress(raw).toLowerCase())
}

export async function listTempMerchantCards(tempEoa: string): Promise<AgentTempMerchantCard[]> {
	const rows = await getCardsOfOwnerWithDetails(tempEoa)
	const out: AgentTempMerchantCard[] = []
	for (const row of rows) {
		let owner = ''
		let transferred = false
		try {
			owner = await getCardOwner(row.cardAddress)
			transferred = owner.toLowerCase() !== tempEoa.toLowerCase()
		} catch {
			transferred = false
		}
		out.push({
			cardAddress: row.cardAddress,
			name: row.name || 'Merchant card',
			transferred,
			owner,
		})
	}
	return out
}

const KET_BALANCE_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'] as const

export async function tempOwnsCreateMerchantCardNft(
	tempEoa: string,
): Promise<'owns' | 'missing' | 'unavailable'> {
	if (!ethers.isAddress(tempEoa)) return 'unavailable'
	try {
		const c = new ethers.Contract(CONET_BUSINESS_START_KET, KET_BALANCE_ABI, conetDepinProvider)
		const balance = await c.balanceOf!(ethers.getAddress(tempEoa), 0n)
		return BigInt(balance.toString()) > 0n ? 'owns' : 'missing'
	} catch {
		return 'unavailable'
	}
}

export async function claimTempCreateMerchantCardNft(
	temp: AgentTempAccount,
	code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const trimmed = code.trim()
	if (!trimmed) return { ok: false, error: 'Enter a redeem code.' }
	if (!ethers.isAddress(temp.eoa)) return { ok: false, error: 'Invalid temp account.' }
	const lower = trimmed.toLowerCase()
	if (lower.startsWith('beamio-start-kit-') || lower.startsWith('beamio-admin-pkg-')) {
		const privateKey = await unlockDetachedRecoverPrivateKey(temp.beamioTag, temp.accessPassword)
		if (!privateKey) return { ok: false, error: 'Could not unlock the temp wallet to sign the claim.' }
		let signingAddress = ''
		try {
			signingAddress = new ethers.Wallet(privateKey).address
		} catch {
			return { ok: false, error: 'Could not unlock the temp wallet to sign the claim.' }
		}
		if (signingAddress.toLowerCase() !== ethers.getAddress(temp.eoa).toLowerCase()) {
			return { ok: false, error: 'Temp wallet does not match this temp account.' }
		}
		try {
			await claimReferralRedeemCode({ secret: trimmed, privateKeyArmor: privateKey })
			return { ok: true }
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : 'Claim failed. Try again.' }
		}
	}
	try {
		const res = await fetch(`${beamioApi}/api/businessStartKetRedeemRedeem`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ eoa: ethers.getAddress(temp.eoa), code: trimmed }),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
		if (!res.ok || !data.success) {
			return { ok: false, error: data.error || 'Claim failed. Try again.' }
		}
		return { ok: true }
	} catch {
		return { ok: false, error: 'Claim failed. Try again.' }
	}
}
