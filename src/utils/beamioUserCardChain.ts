import { ethers } from 'ethers'
import { CONET_CARD_FACTORY } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

export const CONET_MAINNET_CHAIN_ID = 224422

/** Default merchant UserCard factory (CoNET 224422 only — Base merchant cards deprecated). */
export const DEFAULT_MERCHANT_CARD_FACTORY = CONET_CARD_FACTORY

/** Merchant program cards: CoNET 224422 only (see `beamio-merchant-card-conet-only-no-base-factory.mdc`). */
export async function providerForBeamioUserCard(
	_cardAddress: string,
): Promise<{ provider: ethers.Provider; chainId: number }> {
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

export const CONET_MAINNET_TX_EXPLORER_BASE = 'https://mainnet.conet.network/tx/' as const

export function beamioConetMainnetTxExplorerUrl(txHash: string): string {
	const raw = String(txHash ?? '').trim()
	const normalized = raw.startsWith('0x') ? raw : `0x${raw}`
	return `${CONET_MAINNET_TX_EXPLORER_BASE}${normalized}`
}

export function beamioUserCardAddressExplorerUrl(address: string, chainId: number): string {
	const normalized = ethers.getAddress(address)
	if (chainId === CONET_MAINNET_CHAIN_ID) {
		return `https://scan.conet.network/address/${normalized}`
	}
	return `https://basescan.org/address/${normalized}`
}

export async function resolveBeamioUserCardAddressExplorerUrl(cardAddress: string): Promise<string> {
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
	return beamioUserCardAddressExplorerUrl(cardAddress, chainId)
}
