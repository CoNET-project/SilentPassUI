import { ethers } from 'ethers'
import { BASE_MAINNET_CHAIN_ID, CONET_CARD_FACTORY } from '@/config/chainAddresses'
import { baseEndpoint, conetDepinProvider } from '@/utils/constants'

export const CONET_MAINNET_CHAIN_ID = 224422

/** Default merchant UserCard factory (CoNET 224422). Override server-side with BEAMIO_MERCHANT_USER_CARD_CHAIN=base. */
export const DEFAULT_MERCHANT_CARD_FACTORY = CONET_CARD_FACTORY

export async function providerForBeamioUserCard(
	cardAddress: string,
): Promise<{ provider: ethers.Provider; chainId: number }> {
	const addr = ethers.getAddress(cardAddress)
	try {
		const conetCode = await conetDepinProvider.getCode(addr)
		if (conetCode && conetCode !== '0x') {
			return { provider: conetDepinProvider, chainId: CONET_MAINNET_CHAIN_ID }
		}
	} catch {
		/* fall through */
	}
	return { provider: baseEndpoint, chainId: BASE_MAINNET_CHAIN_ID }
}

export async function eip712ChainIdForBeamioUserCard(cardAddress: string): Promise<number> {
	const { chainId } = await providerForBeamioUserCard(cardAddress)
	return chainId
}

export async function getCardFactoryGatewayForEip712(cardAddress: string): Promise<string> {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const c = new ethers.Contract(ethers.getAddress(cardAddress), ['function factoryGateway() view returns (address)'], provider)
	return ethers.getAddress(await c.factoryGateway())
}
