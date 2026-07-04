import { ethers } from 'ethers'
import { baseEndpoint, USDCContract_BASE } from '@/utils/constants'
import { BEAMIO_AA_FACTORY } from '@/config/chainAddresses'
import type { AaMultisigPackedUserOp } from '@/utils/aaMultisigProtocol'

export const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

const ENTRY_POINT_ABI = [
	'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
	'function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)',
]

const AA_EXECUTE = new ethers.Interface([
	'function execute(address dest, uint256 value, bytes func)',
])

const AA_EXECUTE_BATCH = new ethers.Interface([
	'function executeBatch(address[] dest, uint256[] value, bytes[] func)',
])

const AA_POLICY = new ethers.Interface([
	'function setThresholdPolicy(address[] managersSorted, uint256 newThreshold)',
])

const ERC20_TRANSFER = new ethers.Interface(['function transfer(address to, uint256 amount)'])

const AA_READ_ABI = [
	'function owner() view returns (address)',
	'function threshold() view returns (uint256)',
	'function thresholdManagers(uint256) view returns (address)',
	'function isThresholdManager(address) view returns (bool)',
]

export type AaThresholdPolicy = {
	owner: string
	managers: string[]
	threshold: number
}

function packUints128(low: bigint, high: bigint): string {
	return ethers.toBeHex((high << 128n) | low, 32)
}

export function encodeAAExecuteUsdcTransfer(toEOA: string, amountUSDC6: string): string {
	const amount = BigInt(amountUSDC6)
	const transferCalldata = ERC20_TRANSFER.encodeFunctionData('transfer', [toEOA, amount])
	return AA_EXECUTE.encodeFunctionData('execute', [USDCContract_BASE, 0n, transferCalldata])
}

export function encodeAAExecuteSetThresholdPolicy(
	aaAccount: string,
	managersSorted: string[],
	newThreshold: number
): string {
	const inner = AA_POLICY.encodeFunctionData('setThresholdPolicy', [managersSorted, newThreshold])
	return AA_EXECUTE.encodeFunctionData('execute', [aaAccount, 0n, inner])
}

export function encodeAACancelNoOpCallData(): string {
	return AA_EXECUTE_BATCH.encodeFunctionData('executeBatch', [[], [], []])
}

export async function readAaThresholdPolicy(
	provider: ethers.Provider,
	aaAccount: string
): Promise<AaThresholdPolicy> {
	const aa = new ethers.Contract(aaAccount, AA_READ_ABI, provider)
	const owner = ethers.getAddress(await aa.owner())
	const threshold = Number(await aa.threshold())
	const managers: string[] = []
	for (let i = 0; i < 32; i++) {
		try {
			const m = await aa.thresholdManagers(i)
			if (!m || m === ethers.ZeroAddress) break
			managers.push(ethers.getAddress(m))
		} catch {
			break
		}
	}
	return { owner, managers, threshold: threshold || 1 }
}

export async function buildUnsignedAaMultisigUserOp(
	provider: ethers.Provider,
	aaAccount: string,
	callData: string,
	factoryAddress: string = BEAMIO_AA_FACTORY
): Promise<{ packedUserOp: AaMultisigPackedUserOp; userOpHash: string }> {
	const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider)
	const nonce = await entryPoint.getNonce(aaAccount, 0)

	const paymasterVerificationGasLimit = 350_000n
	const paymasterPostOpGasLimit = 60_000n
	const paymasterAndData =
		'0x' +
		ethers.zeroPadValue(ethers.getAddress(factoryAddress), 20).slice(2) +
		ethers.toBeHex(paymasterVerificationGasLimit, 16).slice(2) +
		ethers.toBeHex(paymasterPostOpGasLimit, 16).slice(2)

	const fee = await provider.getFeeData()
	const maxFeePerGas = fee.maxFeePerGas ?? 2_000_000_000n
	const maxPriorityFeePerGas = fee.maxPriorityFeePerGas ?? 100_000_000n
	const callGasLimit = 220_000n
	const verificationGasLimit = 450_000n
	const preVerificationGas = 80_000n
	const accountGasLimits = packUints128(callGasLimit, verificationGasLimit)
	const gasFees = packUints128(maxPriorityFeePerGas, maxFeePerGas)

	const opForHash = {
		sender: aaAccount,
		nonce,
		initCode: '0x',
		callData,
		accountGasLimits,
		preVerificationGas,
		gasFees,
		paymasterAndData,
		signature: '0x',
	}

	const userOpHash = (await entryPoint.getUserOpHash(opForHash)) as string

	const packedUserOp: AaMultisigPackedUserOp = {
		sender: aaAccount,
		nonce: String(nonce),
		initCode: '0x',
		callData,
		accountGasLimits,
		preVerificationGas: String(preVerificationGas),
		gasFees,
		paymasterAndData,
		signature: '0x',
	}

	return { packedUserOp, userOpHash }
}

export async function signAaUserOpHash(privateKeyArmor: string, userOpHash: string): Promise<string> {
	const wallet = new ethers.Wallet(privateKeyArmor, baseEndpoint)
	const hashBytes = ethers.getBytes(userOpHash)
	const signature = await wallet.signMessage(hashBytes)
	const sigByteLen = (signature.length - 2) / 2
	if (sigByteLen !== 65) throw new Error(`signature must be 65 bytes, got ${sigByteLen}`)
	return signature
}

export async function submitAaMultisigUserOp(params: {
	toEOA: string
	amountUSDC6: string
	packedUserOp: AaMultisigPackedUserOp
}): Promise<{ success: boolean; hash?: string; error?: string }> {
	const res = await fetch('https://beamio.app/api/AAtoEOA', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			toEOA: params.toEOA,
			amountUSDC6: params.amountUSDC6,
			packedUserOp: params.packedUserOp,
		}),
	})
	const json = (await res.json().catch(() => ({}))) as {
		success?: boolean
		hash?: string
		error?: string
	}
	if (!res.ok || !json.success) {
		return { success: false, error: json.error ?? `HTTP ${res.status}` }
	}
	return { success: true, hash: json.hash }
}
