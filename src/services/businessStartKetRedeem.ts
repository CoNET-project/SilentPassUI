import { ethers } from 'ethers'
import {
	CONET_BUSINESS_START_KET_REDEEM,
	CONET_MAINNET_CHAIN_ID,
} from '@/config/chainAddresses'
import { conetDepinProvider, beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const uuid62 = require('uuid62') as { v4: () => string }

const REDEEM_ADMINS_ABI = ['function redeemAdmins(address account) view returns (bool)'] as const
const REDEEM_ADMIN_NONCES_ABI = ['function redeemAdminNonces(address account) view returns (uint256)'] as const

/** 与 x402sdk MemberCard KET_REDEEM_CREATE_* 一致 */
export const BUSINESS_START_KET_REDEEM_CREATE_TOKEN_ID = 0n
export const BUSINESS_START_KET_REDEEM_CREATE_KET_AMOUNT = 1n

export const BUSINESS_START_KET_REDEEM_CREATE_TYPED_DATA_TYPES: Record<string, { name: string; type: string }[]> = {
	CreateRedeem: [
		{ name: 'admin', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'amount', type: 'uint256' },
		{ name: 'buintAmount', type: 'uint256' },
		{ name: 'validAfter', type: 'uint256' },
		{ name: 'validBefore', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export function businessStartKetRedeemEip712Domain() {
	return {
		name: 'BusinessStartKetRedeem',
		version: '1',
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: ethers.getAddress(CONET_BUSINESS_START_KET_REDEEM),
	} as const
}

/** 链上 `codeHash = keccak256(bytes(secretCode))` */
export function businessStartKetRedeemCodeHashFromSecret(code: string): string {
	return ethers.keccak256(ethers.toUtf8Bytes(code))
}

export function generateBusinessStartKetRedeemSecretCode(): { code: string; codeHash: string } {
	const code = uuid62.v4()
	return { code, codeHash: businessStartKetRedeemCodeHashFromSecret(code) }
}

/** 用户可见 B-Unit（两位小数）→ 链上 6 位精度 */
export function parseBuintAmount6FromDisplay(raw: string): bigint | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	const n = Number(trimmed)
	if (!Number.isFinite(n) || n <= 0) return null
	return BigInt(Math.round(n * 1_000_000))
}

export function formatBuintAmount6ForDisplay(buintAmount6: bigint): string {
	return (Number(buintAmount6) / 1_000_000).toFixed(2)
}

export type BusinessStartKetRedeemAdminProbe =
	| { ok: true; isAdmin: boolean }
	| { ok: false; error: string }

/** CoNET publicrpc：当前 EOA 是否为 BusinessStartKetRedeem redeem admin */
export async function probeBusinessStartKetRedeemAdmin(eoa: string): Promise<BusinessStartKetRedeemAdminProbe> {
	if (!eoa || !ethers.isAddress(eoa)) {
		return { ok: false, error: 'Invalid EOA' }
	}
	const addr = ethers.getAddress(eoa.trim())
	const c = new ethers.Contract(CONET_BUSINESS_START_KET_REDEEM, REDEEM_ADMINS_ABI, conetDepinProvider)
	try {
		const isAdmin = Boolean(await c.redeemAdmins!(addr))
		return { ok: true, isAdmin }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'redeemAdmins read failed' }
	}
}

/** CoNET publicrpc 直读 redeemAdminNonces（与 admin 探测同源；避免 API 仍连 rpc1 时 decode 失败） */
export async function readBusinessStartKetRedeemAdminNonceOnChain(
	admin: string
): Promise<{ ok: true; nonce: string } | { ok: false; error: string }> {
	if (!admin || !ethers.isAddress(admin)) {
		return { ok: false, error: 'Invalid admin' }
	}
	const adminNorm = ethers.getAddress(admin.trim())
	const c = new ethers.Contract(CONET_BUSINESS_START_KET_REDEEM, REDEEM_ADMIN_NONCES_ABI, conetDepinProvider)
	try {
		const n = (await c.redeemAdminNonces!(adminNorm)) as bigint
		return { ok: true, nonce: n.toString() }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'redeemAdminNonces read failed' }
	}
}

export type BusinessStartKetRedeemCreateResult =
	| { success: true; txHash?: string }
	| { success: false; error: string }

export async function postBusinessStartKetRedeemAdminCreate(body: {
	admin: string
	codeHash: string
	buintAmount: string
	validAfter?: string
	validBefore?: string
	nonce: string
	deadline: string
	signature: string
}): Promise<BusinessStartKetRedeemCreateResult> {
	try {
		const res = await fetch(`${beamioApi}/api/businessStartKetRedeemAdminCreate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await res.json().catch(() => ({}))) as {
			success?: boolean
			txHash?: string
			error?: string
		}
		if (!res.ok || !data.success) {
			return { success: false, error: data.error ?? res.statusText ?? 'Create redeem failed' }
		}
		return { success: true, txHash: data.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? 'Network error' }
	}
}

export async function signAndSubmitBusinessStartKetRedeemCreate(params: {
	adminEoa: string
	codeHash: string
	buintAmount6: bigint
	validAfter?: bigint
	validBefore?: bigint
	privateKeyArmor?: string
}): Promise<
	| { success: true; txHash?: string; codeHash: string }
	| { success: false; error: string }
> {
	const admin = ethers.getAddress(params.adminEoa.trim())
	const armor = params.privateKeyArmor?.trim() || resolveSigningPrivateKeyArmor()
	if (!armor) {
		return { success: false, error: 'Wallet signing key unavailable. Unlock your wallet and try again.' }
	}

	const nonceRes = await readBusinessStartKetRedeemAdminNonceOnChain(admin)
	if (!nonceRes.ok) {
		return { success: false, error: nonceRes.error }
	}

	const nonce = BigInt(nonceRes.nonce)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
	const validAfter = params.validAfter ?? 0n
	const validBefore = params.validBefore ?? 0n
	const domain = businessStartKetRedeemEip712Domain()
	const message = {
		admin,
		codeHash: params.codeHash as `0x${string}`,
		tokenId: BUSINESS_START_KET_REDEEM_CREATE_TOKEN_ID,
		amount: BUSINESS_START_KET_REDEEM_CREATE_KET_AMOUNT,
		buintAmount: params.buintAmount6,
		validAfter,
		validBefore,
		nonce,
		deadline,
	}

	let signature: string
	try {
		const wallet = new ethers.Wallet(armor, conetDepinProvider)
		signature = await wallet.signTypedData(
			domain,
			BUSINESS_START_KET_REDEEM_CREATE_TYPED_DATA_TYPES,
			message
		)
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'Signing failed' }
	}

	const submit = await postBusinessStartKetRedeemAdminCreate({
		admin,
		codeHash: params.codeHash,
		buintAmount: params.buintAmount6.toString(),
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})

	if (!submit.success) {
		return { success: false, error: submit.error }
	}
	return { success: true, txHash: submit.txHash, codeHash: params.codeHash }
}
