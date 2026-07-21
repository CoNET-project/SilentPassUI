import { ethers } from 'ethers'
import { CONET_AA_FACTORY, CONET_ACCOUNT_REGISTRY } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

const AA_FACTORY_LIST_ABI = [
	'function nextIndexOfCreator(address creator) view returns (uint256)',
	'function getAddress(address creator, uint256 index) view returns (address)',
	'function beamioAccountOf(address eoa) view returns (address)',
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

/** Enumerate all deployed CREATE2 AAs for an EOA (`0 .. nextIndex-1` with code). */
export async function listOwnDeployedAaByIndex(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = CONET_AA_FACTORY
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

/** Own institutional Smart Wallets only (index ≥ 1). Excludes personal Express Pay (index=0). */
export async function listOwnInstitutionalAa(
	provider: ethers.Provider,
	eoa: string,
	factoryAddress: string = CONET_AA_FACTORY
): Promise<OwnDeployedAaByIndex[]> {
	const all = await listOwnDeployedAaByIndex(provider, eoa, factoryAddress)
	return all.filter((row) => row.index >= 1)
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
