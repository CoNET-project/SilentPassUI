import { ethers } from 'ethers'
import { CONET_CARD_FACTORY } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

export const CONET_MAINNET_CHAIN_ID = 224422

/** Default merchant UserCard factory (CoNET 224422). Biz Merchant OS reads program cards on CoNET L1 only. */
export const DEFAULT_MERCHANT_CARD_FACTORY = CONET_CARD_FACTORY

/** True when the program card bytecode is deployed on CoNET L1 (224422). */
export async function isMerchantUserCardOnConet(cardAddress: string): Promise<boolean> {
	const addr = ethers.getAddress(cardAddress)
	try {
		const conetCode = await conetDepinProvider.getCode(addr)
		return Boolean(conetCode && conetCode !== '0x')
	} catch {
		return false
	}
}

/** Biz Merchant OS: program cards are read on CoNET L1 only (no Base L2 fallback). */
export async function providerForBeamioUserCard(
	cardAddress: string,
): Promise<{ provider: ethers.Provider; chainId: number }> {
	const addr = ethers.getAddress(cardAddress)
	if (await isMerchantUserCardOnConet(addr)) {
		return { provider: conetDepinProvider, chainId: CONET_MAINNET_CHAIN_ID }
	}
	return { provider: conetDepinProvider, chainId: CONET_MAINNET_CHAIN_ID }
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
