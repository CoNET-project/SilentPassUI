/**
 * MerchantPOSManagement 相关服务：EIP-712 签名与 registerPOS API。
 * 商家 manager 离线签字 RegisterPOS，由服务端代付 Gas 提交到 CoNET。
 */

import { ethers } from 'ethers'
import { beamioApiBase } from '@/services/AAaccount'
import { CONET_RPC_URL } from '@/config/chainAddresses'

/** CoNET chainId */
const CONET_CHAIN_ID = 224422

/** MerchantPOSManagement 合约地址（CoNET 主网） */
export const MERCHANT_POS_MANAGEMENT_ADDRESS = '0x3Eb57035d3237Fce4b1cB273662E875EdfA0D54f'

/** EIP-712 domain：与合约 MerchantPOSManagement.eip712Domain() 一致 */
const EIP712_DOMAIN = {
	name: 'MerchantPOSManagement',
	version: '1',
	chainId: CONET_CHAIN_ID,
	verifyingContract: MERCHANT_POS_MANAGEMENT_ADDRESS as `0x${string}`,
}

/** RegisterPOS 类型定义 */
const REGISTER_POS_TYPES = {
	RegisterPOS: [
		{ name: 'merchant', type: 'address' },
		{ name: 'pos', type: 'address' },
		{ name: 'deadline', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

/** RemovePOS 类型定义 */
const REMOVE_POS_TYPES = {
	RemovePOS: [
		{ name: 'merchant', type: 'address' },
		{ name: 'pos', type: 'address' },
		{ name: 'deadline', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

export type RegisterPOSPayload = {
	merchant: string
	pos: string
	deadline: number
	nonce: string
	signature: string
}

/**
 * 使用 merchant EOA 私钥对 RegisterPOS 做 EIP-712 签名。
 * @param privateKey merchant 的 EOA 私钥（hex）
 * @param merchant merchant EOA 地址
 * @param pos POS 机 EOA 地址
 * @param deadline 签名过期时间戳（秒）
 * @param nonce 防重放随机数（bytes32 hex）
 */
export async function signRegisterPOS(
	privateKey: string,
	merchant: string,
	pos: string,
	deadline: number,
	nonce: string
): Promise<string> {
	const wallet = new ethers.Wallet(privateKey)
	const merchantNorm = ethers.getAddress(merchant)
	const posNorm = ethers.getAddress(pos)
	const nonceHex = nonce.startsWith('0x') ? nonce : '0x' + nonce
	if (ethers.dataLength(nonceHex) !== 32) {
		throw new Error('nonce must be 32 bytes (64 hex chars)')
	}
	const value = {
		merchant: merchantNorm,
		pos: posNorm,
		deadline: BigInt(deadline),
		nonce: nonceHex as `0x${string}`,
	}
	return wallet.signTypedData(EIP712_DOMAIN, REGISTER_POS_TYPES, value)
}

/**
 * 生成随机 bytes32 nonce（用于防重放）
 */
export function generateRegisterPOSNonce(): string {
	return ethers.hexlify(ethers.randomBytes(32))
}

const MERCHANT_POS_ABI = [
	'function getMerchantPOSList(address merchant) view returns (address[])',
	'function getMerchantPOSCount(address merchant) view returns (uint256)',
] as const

/**
 * 从 CoNET 主网合约获取商家的 POS 终端列表。
 */
export async function getMerchantPOSListFromCoNET(merchant: string): Promise<string[]> {
	if (!merchant || !ethers.isAddress(merchant)) return []
	const provider = new ethers.JsonRpcProvider(CONET_RPC_URL)
	const contract = new ethers.Contract(MERCHANT_POS_MANAGEMENT_ADDRESS, MERCHANT_POS_ABI, provider)
	const list = await contract.getMerchantPOSList(merchant)
	return Array.isArray(list) ? list.map((a: string) => ethers.getAddress(a)) : []
}

/**
 * 提交 registerPOS 到服务端，由服务端代付 Gas 调用 registerPOSBySignature。
 */
export type RemovePOSPayload = {
	merchant: string
	pos: string
	deadline: number
	nonce: string
	signature: string
}

/**
 * 使用 merchant EOA 私钥对 RemovePOS 做 EIP-712 签名。
 */
export async function signRemovePOS(
	privateKey: string,
	merchant: string,
	pos: string,
	deadline: number,
	nonce: string
): Promise<string> {
	const wallet = new ethers.Wallet(privateKey)
	const merchantNorm = ethers.getAddress(merchant)
	const posNorm = ethers.getAddress(pos)
	const nonceHex = nonce.startsWith('0x') ? nonce : '0x' + nonce
	if (ethers.dataLength(nonceHex) !== 32) {
		throw new Error('nonce must be 32 bytes (64 hex chars)')
	}
	const value = {
		merchant: merchantNorm,
		pos: posNorm,
		deadline: BigInt(deadline),
		nonce: nonceHex as `0x${string}`,
	}
	return wallet.signTypedData(EIP712_DOMAIN, REMOVE_POS_TYPES, value)
}

export async function registerPOSApi(payload: RegisterPOSPayload): Promise<{ success: boolean; txHash?: string; error?: string }> {
	try {
		const res = await fetch(`${beamioApiBase.replace(/\/$/, '')}/api/registerPOS`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok) return { success: false, error: data?.error ?? res.statusText }
		return { success: true, txHash: data.txHash }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? '请求失败' }
	}
}

/**
 * 提交 removePOS 到服务端，由服务端代付 Gas 调用 removePOSBySignature。
 */
export async function removePOSApi(payload: RemovePOSPayload): Promise<{ success: boolean; txHash?: string; error?: string }> {
	try {
		const res = await fetch(`${beamioApiBase.replace(/\/$/, '')}/api/removePOS`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok) return { success: false, error: data?.error ?? res.statusText }
		return { success: true, txHash: data.txHash }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? '请求失败' }
	}
}
