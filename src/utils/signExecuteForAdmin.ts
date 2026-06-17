import { keccak256, Wallet } from 'ethers'
import { eip712ChainIdForBeamioUserCard } from '@/utils/beamioUserCardChain'

/** EIP-712 ExecuteForAdmin — aligned with POS `signExecuteForAdmin`. */
export async function signExecuteForAdmin(params: {
	privateKeyHex: string
	cardAddress: string
	dataHex: string
	deadline: number
	nonceHex: string
	factoryGateway?: string | null
}): Promise<string> {
	const pk = params.privateKeyHex.replace(/^0x/i, '').trim()
	const wallet = new Wallet(`0x${pk}`)
	const verifyingContract = params.factoryGateway?.trim()
	if (!verifyingContract) {
		throw new Error('Missing factory gateway for EIP-712 signature.')
	}
	const chainId = await eip712ChainIdForBeamioUserCard(params.cardAddress)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract,
	}
	const types = {
		ExecuteForAdmin: [
			{ name: 'cardAddress', type: 'address' },
			{ name: 'dataHash', type: 'bytes32' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	}
	const dataHash = keccak256(params.dataHex)
	const value = {
		cardAddress: params.cardAddress,
		dataHash,
		deadline: params.deadline,
		nonce: params.nonceHex,
	}
	return wallet.signTypedData(domain, types, value)
}
