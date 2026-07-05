/**
 * Multisig co-signer must be EOA. Resolve pasted AA / address via CoNET RPC + factory.
 */
import { ethers } from 'ethers'
import { CONET_AA_FACTORY } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'

export type BeamioWalletIdentity = {
	queriedAddress: string
	eoa: string
	aaAccount: string | null
	inputKind: 'eoa' | 'aa' | 'contract'
}

const aaFactoryAbi = [
	'function isBeamioAccount(address) view returns (bool)',
] as const
const ownerAbi = ['function owner() view returns (address)'] as const

async function readContractOwner(addr: string): Promise<string | null> {
	try {
		const c = new ethers.Contract(addr, ownerAbi, conetDepinProvider)
		const o = (await c.owner()) as string
		if (!o || o === ethers.ZeroAddress) return null
		return ethers.getAddress(o)
	} catch {
		return null
	}
}

async function readIsBeamioAccount(addr: string): Promise<boolean> {
	try {
		const fac = new ethers.Contract(CONET_AA_FACTORY, aaFactoryAbi, conetDepinProvider)
		return Boolean(await fac.isBeamioAccount(addr))
	} catch {
		return false
	}
}

/** Chain-first: CoNET getCode + factory isBeamioAccount + owner() → EOA; beamioAccountOf → AA. */
export async function resolveBeamioWalletIdentityFromAddress(input: string): Promise<BeamioWalletIdentity | null> {
	if (!ethers.isAddress(input)) return null
	const queriedAddress = ethers.getAddress(input)

	let code = ''
	try {
		code = await conetDepinProvider.getCode(queriedAddress)
	} catch {
		code = ''
	}
	const isContract = Boolean(code && code !== '0x' && code.length > 2)

	if (!isContract) {
		const aaAccount = await resolveBeamioAaOnConet(conetDepinProvider, queriedAddress)
		return { queriedAddress, eoa: queriedAddress, aaAccount, inputKind: 'eoa' }
	}

	const isBeamioAa = await readIsBeamioAccount(queriedAddress)
	const owner = await readContractOwner(queriedAddress)

	if (owner) {
		const aaFromEoa = await resolveBeamioAaOnConet(conetDepinProvider, owner)
		const aaAccount =
			aaFromEoa && aaFromEoa.toLowerCase() === queriedAddress.toLowerCase()
				? aaFromEoa
				: aaFromEoa ?? (isBeamioAa ? queriedAddress : null)
		return {
			queriedAddress,
			eoa: owner,
			aaAccount,
			inputKind: isBeamioAa || aaAccount === queriedAddress ? 'aa' : 'contract',
		}
	}

	if (isBeamioAa) {
		return {
			queriedAddress,
			eoa: queriedAddress,
			aaAccount: queriedAddress,
			inputKind: 'aa',
		}
	}

	return {
		queriedAddress,
		eoa: queriedAddress,
		aaAccount: null,
		inputKind: 'contract',
	}
}

/** Co-signer policy managers must be EOA — never AA or unknown contract without owner. */
export async function resolveCosignerEoaFromInput(input: string): Promise<BeamioWalletIdentity | null> {
	const identity = await resolveBeamioWalletIdentityFromAddress(input)
	if (!identity) return null

	if (identity.inputKind === 'aa' && identity.eoa.toLowerCase() === identity.queriedAddress.toLowerCase()) {
		const owner = await readContractOwner(identity.queriedAddress)
		if (!owner) return null
		const aaAccount = await resolveBeamioAaOnConet(conetDepinProvider, owner)
		return {
			queriedAddress: identity.queriedAddress,
			eoa: owner,
			aaAccount: aaAccount ?? identity.queriedAddress,
			inputKind: 'aa',
		}
	}

	if (identity.inputKind === 'contract' && identity.eoa.toLowerCase() === identity.queriedAddress.toLowerCase()) {
		return null
	}

	return identity
}

export async function resolveCosignerEoaFromSearchRow(row: searchResult): Promise<string | null> {
	const addr = String(row?.address ?? '').trim()
	if (!addr || !ethers.isAddress(addr)) return null
	const queried = String((row as { queriedAddress?: string }).queriedAddress ?? addr).trim()
	const identity =
		queried && ethers.isAddress(queried) && queried.toLowerCase() !== addr.toLowerCase()
			? await resolveCosignerEoaFromInput(queried)
			: await resolveCosignerEoaFromInput(addr)
	if (!identity) return null
	if (identity.inputKind === 'contract' && identity.eoa.toLowerCase() === identity.queriedAddress.toLowerCase()) {
		return null
	}
	return ethers.getAddress(identity.eoa)
}

export function applyWalletIdentityToSearchResult(row: searchResult, identity: BeamioWalletIdentity): searchResult {
	return {
		...row,
		address: identity.eoa,
	} as searchResult
}
