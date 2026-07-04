import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'
import { CONET_AA_FACTORY, CONET_BUINT, CONET_GB_ERC20, CONET_USDC, USDC_BASE } from '@/config/chainAddresses'
import type { AaMultisigPackedUserOp } from '@/utils/aaMultisigProtocol'
import type { AaMultisigTransferAssetId } from '@/utils/aaMultisigProtocol'

/** CoNET 224422 — Smart Wallet multisig 唯一 RPC（AA 仅部署在 CoNET）。 */
export const aaMultisigProvider = conetDepinProvider

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

export function encodeAAExecuteUsdcTransfer(toEOA: string, amountUSDC6: string, usdcToken = CONET_USDC): string {
	const amount = BigInt(amountUSDC6)
	const transferCalldata = ERC20_TRANSFER.encodeFunctionData('transfer', [toEOA, amount])
	return AA_EXECUTE.encodeFunctionData('execute', [usdcToken, 0n, transferCalldata])
}

export function encodeAAExecuteNativeCnetTransfer(toEOA: string, amountWei: bigint): string {
	return AA_EXECUTE.encodeFunctionData('execute', [toEOA, amountWei, '0x'])
}

export function encodeAAExecuteErc20Transfer(token: string, toEOA: string, amount: bigint): string {
	const transferCalldata = ERC20_TRANSFER.encodeFunctionData('transfer', [toEOA, amount])
	return AA_EXECUTE.encodeFunctionData('execute', [token, 0n, transferCalldata])
}

export function encodeAAExecuteConetAssetTransfer(params: {
	asset: AaMultisigTransferAssetId
	toEOA: string
	amountRaw: bigint
}): string {
	const to = ethers.getAddress(params.toEOA)
	switch (params.asset) {
		case 'cnet':
		case 'base_eth':
			return encodeAAExecuteNativeCnetTransfer(to, params.amountRaw)
		case 'usdc':
			return encodeAAExecuteErc20Transfer(CONET_USDC, to, params.amountRaw)
		case 'base_usdc':
			return encodeAAExecuteErc20Transfer(USDC_BASE, to, params.amountRaw)
		case 'gb_paid':
			return encodeAAExecuteErc20Transfer(CONET_GB_ERC20, to, params.amountRaw)
		case 'buint_paid':
			return encodeAAExecuteErc20Transfer(CONET_BUINT, to, params.amountRaw)
		default:
			throw new Error(`Unsupported transfer asset: ${params.asset}`)
	}
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

function isValidManagerAddress(raw: string | undefined | null): raw is string {
	if (!raw || !ethers.isAddress(raw)) return false
	return ethers.getAddress(raw) !== ethers.ZeroAddress
}

async function readThresholdManagers(aa: ethers.Contract): Promise<string[]> {
	const managers: string[] = []
	for (let i = 0; i < 64; i++) {
		try {
			const raw = (await aa.thresholdManagers(i)) as string
			if (!isValidManagerAddress(raw)) break
			managers.push(ethers.getAddress(raw))
		} catch {
			break
		}
	}
	return managers
}

export function normalizeAaThresholdPolicy(
	ownerRaw: string,
	managers: string[],
	threshold: number
): AaThresholdPolicy {
	let owner = isValidManagerAddress(ownerRaw) ? ethers.getAddress(ownerRaw) : ethers.ZeroAddress
	const mgrs = managers.filter((m) => isValidManagerAddress(m)).map((m) => ethers.getAddress(m))

	if (owner === ethers.ZeroAddress && mgrs.length > 0) {
		owner = mgrs[0]
	}
	if (owner !== ethers.ZeroAddress) {
		const ownerKey = owner.toLowerCase()
		if (!mgrs.some((m) => m.toLowerCase() === ownerKey)) {
			mgrs.unshift(owner)
		}
	}

	const safeThreshold = threshold > 0 ? threshold : 1
	const cappedThreshold = mgrs.length > 0 ? Math.min(safeThreshold, mgrs.length) : safeThreshold

	return { owner, managers: mgrs, threshold: cappedThreshold }
}

/** Resolve AA owner for UI when chain owner() is missing or zero. */
export function resolveEffectiveAaOwner(
	policy: AaThresholdPolicy | null | undefined,
	fallbackEoa: string
): string | null {
	if (policy) {
		if (isValidManagerAddress(policy.owner)) return ethers.getAddress(policy.owner)
		if (policy.managers.length > 0 && isValidManagerAddress(policy.managers[0])) {
			return ethers.getAddress(policy.managers[0])
		}
	}
	if (isValidManagerAddress(fallbackEoa)) return ethers.getAddress(fallbackEoa)
	return null
}

export async function readAaThresholdPolicy(
	provider: ethers.Provider,
	aaAccount: string,
	opts?: { fallbackEoa?: string }
): Promise<AaThresholdPolicy> {
	const addr = ethers.getAddress(aaAccount)
	const code = await provider.getCode(addr)
	if (!code || code === '0x' || code.length <= 2) {
		throw new Error('Smart Wallet is not deployed on CoNET for this address.')
	}

	const aa = new ethers.Contract(addr, AA_READ_ABI, provider)
	let ownerRaw = ethers.ZeroAddress
	try {
		ownerRaw = (await aa.owner()) as string
	} catch {
		ownerRaw = ethers.ZeroAddress
	}
	let threshold = 1
	try {
		threshold = Number(await aa.threshold())
	} catch {
		threshold = 1
	}
	const managers = await readThresholdManagers(aa)
	const normalized = normalizeAaThresholdPolicy(ownerRaw, managers, threshold || 1)
	if (normalized.managers.length === 0 && isValidManagerAddress(opts?.fallbackEoa)) {
		const eoa = ethers.getAddress(opts!.fallbackEoa!)
		return normalizeAaThresholdPolicy(eoa, [eoa], 1)
	}
	return normalized
}

/** UI list order: AA owner first, then remaining managers (chain order preserved). */
export function orderAaCosignersWithOwnerFirst(owner: string, managers: string[]): string[] {
	const out: string[] = []
	const seen = new Set<string>()
	const pushUnique = (raw: string) => {
		if (!isValidManagerAddress(raw)) return
		const addr = ethers.getAddress(raw)
		const key = addr.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		out.push(addr)
	}
	pushUnique(owner)
	for (const m of managers) pushUnique(m)
	return out
}

export async function buildUnsignedAaMultisigUserOp(
	provider: ethers.Provider,
	aaAccount: string,
	callData: string,
	factoryAddress: string = CONET_AA_FACTORY
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
	const wallet = new ethers.Wallet(privateKeyArmor)
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
