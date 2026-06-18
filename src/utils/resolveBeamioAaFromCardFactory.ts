/**
 * Match x402sdk resolveBeamioAaViaUserCardFactory: only UserCardFactory._aaFactory() then beamioAccountOf / primaryAccountOf. No BASE_AA_FACTORY fallback.
 */
import { ethers } from 'ethers'
import { BASE_CARD_FACTORY, CONET_AA_FACTORY } from '../config/chainAddresses'

const paymasterAbi = ['function _aaFactory() view returns (address)'] as const
const aaFactoryAbi = [
	'function beamioAccountOf(address) view returns (address)',
	'function primaryAccountOf(address) view returns (address)',
] as const

async function aaFromFactory(provider: ethers.Provider, eoa: string, factoryAddr: string): Promise<string | null> {
	try {
		const eoaAddr = ethers.getAddress(eoa)
		const f = new ethers.Contract(factoryAddr, aaFactoryAbi, provider)
		let a = await f.beamioAccountOf(eoaAddr).catch(() => ethers.ZeroAddress)
		if (!a || a === ethers.ZeroAddress) {
			a = await f.primaryAccountOf(eoaAddr).catch(() => ethers.ZeroAddress)
		}
		if (!a || a === ethers.ZeroAddress) return null
		const code = await provider.getCode(a)
		return code && code !== '0x' && code.length > 2 ? ethers.getAddress(a) : null
	} catch {
		return null
	}
}

export async function resolveBeamioAaForEoaWithFallback(provider: ethers.Provider, eoa: string): Promise<string | null> {
	try {
		const pm = new ethers.Contract(BASE_CARD_FACTORY, paymasterAbi, provider)
		const fac = await pm._aaFactory()
		if (fac && fac !== ethers.ZeroAddress) {
			return aaFromFactory(provider, eoa, ethers.getAddress(fac))
		}
	} catch {
		/* ignore */
	}
	return null
}

/** CoNET 224422：当前 CoNET AA Factory 上查已部署 AA（须 getCode 非空）。 */
export async function resolveBeamioAaOnConet(provider: ethers.Provider, eoa: string): Promise<string | null> {
	return aaFromFactory(provider, eoa, CONET_AA_FACTORY)
}
