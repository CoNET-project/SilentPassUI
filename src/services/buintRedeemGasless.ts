/**
 * BuintRedeemAirdrop：用户 EIP-712 `RedeemWithCode` + relayer 调用 `redeemWithCodeFor` 代付 gas。
 * Domain 与合约 EIP712("BuintRedeemAirdrop","1") 一致。
 */
import { ethers, type Signer, type TypedDataDomain, type TypedDataField, TypedDataEncoder } from 'ethers'
import { CONET_BUINT_REDEEM_AIRDROP, CONTRACT_ADDRESSES } from '@/config/chainAddresses'

export const BUINT_REDEEM_EIP712_NAME = 'BuintRedeemAirdrop'
export const BUINT_REDEEM_EIP712_VERSION = '1'

/** 与 Solidity `REDEEM_WITH_CODE_TYPEHASH` 对应 */
export const BuintRedeemWithCodeTypes: Record<string, TypedDataField[]> = {
	RedeemWithCode: [
		{ name: 'recipient', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export function buintRedeemTypedDataDomain(
	verifyingContract: string,
	chainId: number = CONTRACT_ADDRESSES.conet.chainId
): TypedDataDomain {
	return {
		name: BUINT_REDEEM_EIP712_NAME,
		version: BUINT_REDEEM_EIP712_VERSION,
		chainId,
		verifyingContract,
	}
}

/** `code` 必须与链上 create 时一致；`codeHash = keccak256(bytes(code))` */
export function buintRedeemCodeHashFromCode(code: string): string {
	return ethers.keccak256(ethers.toUtf8Bytes(code))
}

export type SignBuintRedeemWithCodeParams = {
	recipient: string
	code: string
	deadline: bigint
	/** 默认 CoNET + CONET_BUINT_REDEEM_AIRDROP */
	chainId?: number
	verifyingContract?: string
}

export async function signBuintRedeemWithCode(signer: Signer, params: SignBuintRedeemWithCodeParams): Promise<string> {
	const recipient = ethers.getAddress(params.recipient)
	const codeHash = buintRedeemCodeHashFromCode(params.code)
	const chainId = params.chainId ?? CONTRACT_ADDRESSES.conet.chainId
	const verifyingContract = ethers.getAddress(params.verifyingContract ?? CONET_BUINT_REDEEM_AIRDROP)
	const domain = buintRedeemTypedDataDomain(verifyingContract, chainId)
	const value = {
		recipient,
		codeHash,
		deadline: params.deadline,
	}
	return signer.signTypedData(domain, BuintRedeemWithCodeTypes, value)
}

/** 链下校验 digest 与合约 `getRedeemWithCodeDigest` 一致（需连接 provider） */
export function hashBuintRedeemWithCodeTypedData(params: {
	recipient: string
	code: string
	deadline: bigint
	chainId?: number
	verifyingContract?: string
}): string {
	const recipient = ethers.getAddress(params.recipient)
	const codeHash = buintRedeemCodeHashFromCode(params.code)
	const chainId = params.chainId ?? CONTRACT_ADDRESSES.conet.chainId
	const verifyingContract = ethers.getAddress(params.verifyingContract ?? CONET_BUINT_REDEEM_AIRDROP)
	const domain = buintRedeemTypedDataDomain(verifyingContract, chainId)
	const value = {
		recipient,
		codeHash,
		deadline: params.deadline,
	}
	return TypedDataEncoder.hash(domain, BuintRedeemWithCodeTypes, value)
}
