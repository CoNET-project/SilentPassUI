import { ethers } from 'ethers'
import { BEAMIO_AA_FACTORY_V2, CONET_ACCOUNT_REGISTRY } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'
import { isInstitutionalAaV2 } from '@/utils/aaInstitutionalV2Eip712'
import { readAaThresholdPolicy } from '@/utils/aaMultisigUserOp'

const AA_FACTORY_LIST_ABI = [
	'function nextIndexOfCreator(address creator) view returns (uint256)',
	'function getAddress(address creator, uint256 index) view returns (address)',
	'function accountsOfManager(address manager) view returns (address[])',
] as const

const ACCOUNT_REGISTRY_TAG_ABI = [
	'function getUsernameByAddress(address owner) view returns (string)',
	'function getOwnerByAccountName(string accountName) view returns (address)',
] as const

const BEAMIO_ACCOUNT_NAME_RE = /^[a-zA-Z0-9_.]{3,26}$/

export type OwnDeployedAaByIndex = {
	aa: string
	index: number
	accountName?: string
}

/** Strip @ and validate BeamioTag format (same as /api/addUser). */
export function normalizeInstitutionalBeamioTag(raw: string): string {
	const trimmed = String(raw || '')
		.trim()
		.replace(/^@+/, '')
	return BEAMIO_ACCOUNT_NAME_RE.test(trimmed) ? trimmed : ''
}

/** Read @BeamioTag bound to an address on CoNET AccountRegistry (may be empty). */
export async function resolveBeamioTagForAddress(
	address: string,
	provider: ethers.Provider = conetDepinProvider
): Promise<string> {
	if (!ethers.isAddress(address)) return ''
	try {
		const reg = new ethers.Contract(CONET_ACCOUNT_REGISTRY, ACCOUNT_REGISTRY_TAG_ABI, provider)
		const name = String((await reg.getUsernameByAddress(ethers.getAddress(address))) ?? '').trim()
		return normalizeInstitutionalBeamioTag(name) || name.replace(/^@+/, '')
	} catch {
		return ''
	}
}

/** Enumerate all deployed CREATE2 AAs for an EOA on the given factory (`0 .. nextIndex-1` with code). */
export async function listOwnDeployedAaByIndex(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = BEAMIO_AA_FACTORY_V2
): Promise<OwnDeployedAaByIndex[]> {
	if (!ethers.isAddress(eoa)) return []
	const eoaNorm = ethers.getAddress(eoa)
	const factory = new ethers.Contract(factoryAddress, AA_FACTORY_LIST_ABI, provider)
	const nextIndex = (await factory.nextIndexOfCreator(eoaNorm)) as bigint
	if (nextIndex <= 0n) return []

	const out: OwnDeployedAaByIndex[] = []
	const getAddressFn = factory.getFunction('getAddress(address,uint256)')
	for (let i = 0n; i < nextIndex; i++) {
		try {
			const predicted = ethers.getAddress((await getAddressFn(eoaNorm, i)) as string)
			const code = await provider.getCode(predicted)
			if (!code || code === '0x') continue
			const accountName = await resolveBeamioTagForAddress(predicted, provider)
			out.push({ aa: predicted, index: Number(i), accountName: accountName || undefined })
		} catch {
			/* skip index */
		}
	}
	return out
}

/**
 * Own institutional Smart Wallets on **V2 Factory** (all indexes).
 * Legacy V1 index≥1 institutional AAs are abandoned — do not list them.
 */
export async function listOwnInstitutionalAa(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = BEAMIO_AA_FACTORY_V2
): Promise<OwnDeployedAaByIndex[]> {
	return listOwnDeployedAaByIndex(provider, eoa, factoryAddress)
}

export type ComanagedInstitutionalAa = {
	aa: string
	accountName?: string
	owner: string
}

/**
 * Institutional AAs where `eoa` is a threshold manager (Factory `accountsOfManager`).
 * Includes owner-managed AAs; callers that want co-signer-only should filter owner ≠ eoa.
 */
export async function listAccountsOfManagerFromFactory(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = BEAMIO_AA_FACTORY_V2
): Promise<string[]> {
	if (!ethers.isAddress(eoa)) return []
	try {
		const factory = new ethers.Contract(factoryAddress, AA_FACTORY_LIST_ABI, provider)
		const raw = (await factory.accountsOfManager(ethers.getAddress(eoa))) as string[]
		if (!Array.isArray(raw)) return []
		const out: string[] = []
		const seen = new Set<string>()
		for (const a of raw) {
			if (!ethers.isAddress(a)) continue
			const checksum = ethers.getAddress(a)
			const k = checksum.toLowerCase()
			if (seen.has(k)) continue
			seen.add(k)
			out.push(checksum)
		}
		return out
	} catch {
		return []
	}
}

/**
 * Co-managed institutional AAs (viewer is manager, not owner) via Factory reverse index.
 */
export async function listComanagedInstitutionalAa(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = BEAMIO_AA_FACTORY_V2
): Promise<ComanagedInstitutionalAa[]> {
	if (!ethers.isAddress(eoa)) return []
	const viewer = ethers.getAddress(eoa)
	const viewerLower = viewer.toLowerCase()
	const candidates = await listAccountsOfManagerFromFactory(provider, viewer, factoryAddress)
	const out: ComanagedInstitutionalAa[] = []

	for (const aa of candidates) {
		try {
			if (!(await isInstitutionalAaV2(aa, provider))) continue
			const policy = await readAaThresholdPolicy(provider, aa, { fallbackEoa: viewer })
			if (!policy.managers.some((m) => m.toLowerCase() === viewerLower)) continue
			const owner = ethers.getAddress(policy.owner)
			if (owner.toLowerCase() === viewerLower) continue
			const accountName = await resolveBeamioTagForAddress(aa, provider)
			out.push({
				aa,
				owner,
				accountName: accountName || undefined,
			})
		} catch {
			/* skip unreadable */
		}
	}
	return out
}

export type CreateInstitutionalAaResult =
	| { success: true; aa: string; index: number; txHash?: string; accountName?: string }
	| { success: false; error: string }

/**
 * CoNET Paymaster createAccountFor via Beamio API (ensure index=0, then next).
 * Optional `accountName` registers AccountRegistry BeamioTag → new AA so others can search it.
 */
export async function createInstitutionalAa(
	eoa: string,
	opts?: { accountName?: string }
): Promise<CreateInstitutionalAaResult> {
	if (!ethers.isAddress(eoa)) {
		return { success: false, error: 'Invalid EOA address' }
	}
	const eoaNorm = ethers.getAddress(eoa)
	const accountName = opts?.accountName ? normalizeInstitutionalBeamioTag(opts.accountName) : ''
	if (opts?.accountName?.trim() && !accountName) {
		return {
			success: false,
			error: 'Invalid BeamioTag: use 3–26 letters, numbers, _ or .',
		}
	}
	try {
		const payload: { eoa: string; accountName?: string } = { eoa: eoaNorm }
		if (accountName) payload.accountName = accountName
		const res = await fetch(`${beamioApi}/api/createInstitutionalAa`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const json = (await res.json().catch(() => null)) as {
			success?: boolean
			aa?: string
			index?: number
			txHash?: string
			accountName?: string
			error?: string
		} | null
		if (!res.ok || !json?.success || !json.aa || typeof json.index !== 'number') {
			return {
				success: false,
				error: json?.error || `Failed to create institutional Smart Wallet (HTTP ${res.status})`,
			}
		}
		return {
			success: true,
			aa: ethers.getAddress(json.aa),
			index: json.index,
			txHash: json.txHash || undefined,
			accountName: json.accountName || accountName || undefined,
		}
	} catch (e: unknown) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to create institutional Smart Wallet',
		}
	}
}
