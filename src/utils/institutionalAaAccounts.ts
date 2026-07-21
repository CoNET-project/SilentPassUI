import { ethers } from 'ethers'
import { CONET_AA_FACTORY } from '@/config/chainAddresses'
import { beamioApi } from '@/utils/constants'

const AA_FACTORY_LIST_ABI = [
	'function nextIndexOfCreator(address creator) view returns (uint256)',
	'function getAddress(address creator, uint256 index) view returns (address)',
	'function beamioAccountOf(address eoa) view returns (address)',
] as const

export type OwnDeployedAaByIndex = {
	aa: string
	index: number
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
			out.push({ aa: predicted, index: Number(i) })
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
	| { success: true; aa: string; index: number; txHash?: string }
	| { success: false; error: string }

/** CoNET Paymaster createAccountFor via Beamio API (ensure index=0, then next). */
export async function createInstitutionalAa(eoa: string): Promise<CreateInstitutionalAaResult> {
	if (!ethers.isAddress(eoa)) {
		return { success: false, error: 'Invalid EOA address' }
	}
	const eoaNorm = ethers.getAddress(eoa)
	try {
		const res = await fetch(`${beamioApi}/api/createInstitutionalAa`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ eoa: eoaNorm }),
		})
		const json = (await res.json().catch(() => null)) as {
			success?: boolean
			aa?: string
			index?: number
			txHash?: string
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
		}
	} catch (e: unknown) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to create institutional Smart Wallet',
		}
	}
}
