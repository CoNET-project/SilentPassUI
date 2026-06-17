/**
 * Match x402sdk resolveBeamioAaViaUserCardFactory: beamioAccountOf on BEAMIO_AA_FACTORY.
 * New AA deploys only on CoNET (224422); Base no longer used for resolution or creation.
 */
import { ethers } from 'ethers'
import { BEAMIO_AA_FACTORY } from '../config/chainAddresses'
import { conetDepinProvider } from '../utils/constants'

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

/** CoNET 224422：跨链同址 BEAMIO_AA_FACTORY 上查已部署 AA（须 getCode 非空）。 */
export async function resolveBeamioAaOnConet(
	provider: ethers.Provider = conetDepinProvider,
	eoa: string
): Promise<string | null> {
	return aaFromFactory(provider, eoa, BEAMIO_AA_FACTORY)
}

/** 解析 EOA → AA：仅 CoNET。`provider` 保留兼容，默认 conetDepinProvider。 */
export async function resolveBeamioAaForEoaWithFallback(
	provider: ethers.Provider = conetDepinProvider,
	eoa: string
): Promise<string | null> {
	return resolveBeamioAaOnConet(provider, eoa)
}
