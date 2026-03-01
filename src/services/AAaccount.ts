/**
 * AA 账户相关 API：AA→EOA 转账等。
 * POST /api/AAtoEOA 接受 ERC-4337 已签字的 UserOp，由服务端代付 Gas 提交。
 * 客户端按 ERC-4337 构造 PackedUserOp，用 owner EOA 对 userOpHash 做 EIP-191 签名后提交。
 */

import { ethers } from 'ethers'
import {baseEndpoint} from '@/utils/constants'
import BeamioModuleABI from './ABI/BeamioModuleABI.json'
import BeamioAccountABI from './ABI/BeamioAccount.json'


/** Base 主网 USDC */
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/** EntryPoint v0.7（Base 主网） */
export const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

const ERC20_TRANSFER = new ethers.Interface([
	'function transfer(address to, uint256 amount) returns (bool)',
])
const AA_EXECUTE = new ethers.Interface([
	'function execute(address dest, uint256 value, bytes func)',
])

/** EntryPoint v0.7：getUserOpHash / getNonce（PackedUserOperation 与 handleOps 一致） */
const ENTRY_POINT_ABI = [
	'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
	'function getNonce(address sender, uint192 key) view returns (uint256)',
]

/** BeamioAccount：createAccount 时 creator 成为 owner，链上校验 isThresholdManager[signer] 要求 signer === owner */
const BEAMIO_ACCOUNT_OWNER_ABI = ['function owner() view returns (address)']

/** 用于 POST 前确认：查询 AA 的 owner 与 thresholdManagers(0) */
const BEAMIO_ACCOUNT_OWNER_CHECK_ABI = [
	'function owner() view returns (address)',
	'function thresholdManagers(uint256) view returns (address)',
]

/**
 * POST 前确认：链上查询 AA 的 owner（及 thresholdManagers(0)），与当前签名地址比对。
 * 用于在发送 POST /api/AAtoEOA 前明确确认「创建 AA 时的 owner 地址 = 当前私钥对应地址」。
 * @returns { match: true, realOwner } 或 { match: false, realOwner, signerAddress, message }
 */
export async function verifyAAOwnerMatchesSigner(
	provider: ethers.Provider,
	aaSender: string,
	signerAddress: string
): Promise<
	| { match: true; realOwner: string }
	| { match: false; realOwner: string; signerAddress: string; message: string }
> {
	const aa = new ethers.Contract(aaSender, BEAMIO_ACCOUNT_OWNER_CHECK_ABI, provider)
	const realOwner = (await aa.owner()) as string
	const signerNorm = signerAddress.toLowerCase()
	const ownerNorm = realOwner.toLowerCase()
	const match = ownerNorm === signerNorm
	if (match) {
		return { match: true, realOwner }
	}
	return {
		match: false,
		realOwner,
		signerAddress,
		message: `AA on-chain owner is ${realOwner}, current account is ${signerAddress}; they do not match. Please use the private key that was used to create this AA.`,
	}
}

/**
 * AA→EOA 请求参数校验（在调用 API 前执行，避免把 EOA 当 sender 或数据不合法）。
 * @returns { valid: true } 或 { valid: false, error: string }
 */
export async function validateAAtoEOAInput(
	provider: ethers.Provider,
	params: { aaAccount: string; toEOA: string; amountUSDC6: string; ownerAddress?: string }
): Promise<{ valid: true } | { valid: false; error: string }> {
	const { aaAccount, toEOA, amountUSDC6, ownerAddress } = params
	if (!aaAccount || !ethers.isAddress(aaAccount)) return { valid: false, error: 'Invalid AA account address' }
	if (!toEOA || !ethers.isAddress(toEOA)) return { valid: false, error: 'Invalid to EOA address' }
	const amount = BigInt(amountUSDC6)
	if (amount <= 0n) return { valid: false, error: 'Amount must be positive' }
	if (ownerAddress && aaAccount.toLowerCase() === ownerAddress.toLowerCase()) {
		return { valid: false, error: 'Sender must be the Smart Account contract, not the EOA. Please create or link a Smart Account first.' }
	}
	const code = await provider.getCode(aaAccount)
	if (!code || code === '0x' || code.length <= 2) {
		return { valid: false, error: 'AA account address has no contract code (not a Smart Account). Use primaryAccountOf(owner) to get the correct address.' }
	}
	return { valid: true }
}

/**
 * 编码 AA 的 execute(dest, value, func) 的 callData，其中 func = USDC.transfer(toEOA, amount)。
 * 用于 UserOp 的 callData 字段，使 AA 执行一次 USDC 转账到 toEOA。
 */
export function encodeAAExecuteUsdcTransfer(toEOA: string, amountUSDC6: string): string {
	const amount = BigInt(amountUSDC6)
	const transferCalldata = ERC20_TRANSFER.encodeFunctionData('transfer', [toEOA, amount])
	return AA_EXECUTE.encodeFunctionData('execute', [
		USDC_ADDRESS_BASE,
		0n,
		transferCalldata,
	])
}

const AA_SIG_CHECK_ABI = [
	'function owner() view returns (address)',
	'function initialized() view returns (bool)',
	'function threshold() view returns (uint256)',
	'function isThresholdManager(address) view returns (bool)'
  ]


/**
 * 构造并签名 ERC-4337 PackedUserOperation（AA→EOA 转 USDC）。
 * BeamioAccount 要求：owner 对 EntryPoint.getUserOpHash(op) 做 EIP-191 签名，signature 为 65 字节 (r,s,v)。
 * @param provider 只读 provider（Base）
 * @param ownerPrivateKey AA 的 owner EOA 私钥（与 profile.privateKeyArmor 一致）
 * @param aaAccount AA 合约地址（sender）
 * @param toEOA 收款 EOA
 * @param amountUSDC6 金额（6 位小数字符串）
 * @param factoryAddress Beamio Factory 地址，用作 paymasterAndData 前 20 字节（BeamioAccount 校验）
 */
function packUints128(low: bigint, high: bigint): string {
	// bytes32 = (high << 128) | low
	return ethers.toBeHex((high << 128n) | low, 32)
  }
  
  export async function buildAndSignPackedUserOp(
	provider: ethers.Provider,
	ownerPrivateKey: string,
	aaAccount: string,
	toEOA: string,
	amountUSDC6: string,
	factoryAddress: string
  ): Promise<AAtoEOAUserOp> {
	const signer = new ethers.Wallet(ownerPrivateKey, provider)
  
	// --- helpers ---
	async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
	  try {
		return await fn()
	  } catch {
		return null
	  }
	}
  
	// --- AA owner / optional policy checks ---
	const aa = new ethers.Contract(aaAccount, AA_SIG_CHECK_ABI, provider)
  
	const owner = await aa.owner() as string
  
	const initialized = await safeCall(() => aa.initialized() as Promise<boolean>)
	const threshold = await safeCall(() => aa.threshold() as Promise<bigint>)
	const isTM = await safeCall(() => aa.isThresholdManager(signer.address) as Promise<boolean>)
  
	console.log('[AAtoEOA] AA policy snapshot:', {
	  aaAccount,
	  owner,
	  signer: signer.address,
	  initialized,
	  threshold: threshold?.toString?.() ?? threshold,
	  isTM
	})
  
	// 强约束：owner 必须匹配 signer（你当前单签阈值就是这个）
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
	  throw new Error(`AA owner mismatch: owner=${owner} signer=${signer.address}`)
	}
  
	// --- EntryPoint ---
	const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider)
  
	const nonce = await entryPoint.getNonce(aaAccount, 0)
	const callData = encodeAAExecuteUsdcTransfer(toEOA, amountUSDC6)
  
	// --- paymasterAndData (v0.7 header 52 bytes) ---
	// 20 bytes paymaster + 16 bytes verificationGasLimit + 16 bytes postOpGasLimit
	const paymasterVerificationGasLimit = 350_000n
	const paymasterPostOpGasLimit = 60_000n
  
	const paymasterAndData =
	  '0x' +
	  ethers.zeroPadValue(ethers.getAddress(factoryAddress), 20).slice(2) +
	  ethers.toBeHex(paymasterVerificationGasLimit, 16).slice(2) +
	  ethers.toBeHex(paymasterPostOpGasLimit, 16).slice(2)
  
	// --- v0.7 gas fields: MUST NOT be zero ---
	const fee = await provider.getFeeData()
	const maxFeePerGas = fee.maxFeePerGas ?? 2_000_000_000n // 2 gwei fallback
	const maxPriorityFeePerGas = fee.maxPriorityFeePerGas ?? 100_000_000n // 0.1 gwei fallback
  
	// execute(USDC.transfer) 的经验值：给足余量
	const callGasLimit = 220_000n
	const verificationGasLimit = 450_000n
	const preVerificationGas = 80_000n
  
	const accountGasLimits = packUints128(callGasLimit, verificationGasLimit)
	const gasFees = packUints128(maxPriorityFeePerGas, maxFeePerGas)
  
	// --- build opForHash with EMPTY signature (ERC-4337 rule) ---
	const opForHash = {
	  sender: aaAccount,
	  nonce,
	  initCode: '0x',
	  callData,
	  accountGasLimits,
	  preVerificationGas,
	  gasFees,
	  paymasterAndData,
	  signature: '0x'
	}
  
	const userOpHash = await entryPoint.getUserOpHash(opForHash) as string
	const hashBytes = ethers.getBytes(userOpHash)
  
	// EIP-191: signMessage(bytes)
	const signature = await signer.signMessage(hashBytes)
  
	// --- sanity checks ---
	const sigByteLen = (signature.length - 2) / 2
	if (sigByteLen !== 65) {
	  throw new Error(`signature must be 65 bytes, got ${sigByteLen}`)
	}
  
	const recovered = ethers.verifyMessage(hashBytes, signature)
	if (recovered.toLowerCase() !== signer.address.toLowerCase()) {
	  throw new Error(`local verifyMessage mismatch: recovered=${recovered} signer=${signer.address}`)
	}
  
	// --- return packed op to submit ---
	const packedUserOp: AAtoEOAUserOp = {
	  sender: aaAccount,
	  nonce: String(nonce),
	  initCode: '0x',
	  callData,
	  accountGasLimits,
	  preVerificationGas: String(preVerificationGas),
	  gasFees,
	  paymasterAndData,
	  signature
	}
  
	// optional debug
	console.log('[AAtoEOA] PackedUserOp preview:', {
	  sender: packedUserOp.sender,
	  nonce: packedUserOp.nonce,
	  callDataLen: (packedUserOp.callData.length - 2) / 2,
	  accountGasLimits,
	  preVerificationGas: packedUserOp.preVerificationGas,
	  gasFees,
	  paymasterAndDataLen: (packedUserOp.paymasterAndData.length - 2) / 2,
	  sigLen: sigByteLen
	})
  
	return packedUserOp
  }

export type AAtoEOAUserOp = {
	sender: string
	nonce: string | number
	initCode: string
	callData: string
	accountGasLimits: string
	preVerificationGas: string | number
	gasFees: string
	paymasterAndData: string
	signature: string
}

export type AAtoEOARequest = {
	toEOA: string
	amountUSDC6: string
	packedUserOp: AAtoEOAUserOp
}

export type AAtoEOAResponse = {
	success: boolean
	USDC_tx?: string
	error?: string
}

/**
 * 与服务端 AAtoEOAProcess 相同的 packedUserOp 预检（在 POST /api/AAtoEOA 前执行）。
 * 校验：signature 必填、callData/signature 非空、签名恰好 65 字节（130 十六进制字符）、hex 可解码为 65 字节。
 */
export function validateAAtoEOAUserOp(packedUserOp: AAtoEOAUserOp): { valid: true } | { valid: false; error: string } {
	if (packedUserOp.signature === undefined || packedUserOp.signature === null) {
		return { valid: false, error: 'packedUserOp.signature required' }
	}
	const callDataHex = (packedUserOp.callData || '0x').replace(/^0x/, '') ? (packedUserOp.callData || '0x') : '0x'
	const rawSig = packedUserOp.signature
	const sigHex = typeof rawSig === 'string' && rawSig.startsWith('0x') ? rawSig : '0x' + (rawSig || '')
	const sigLen = sigHex.length <= 2 ? 0 : (sigHex.length - 2) / 2
	if (callDataHex.length <= 2 || sigHex.length <= 2 || sigLen === 0) {
		return {
			valid: false,
			error: 'Invalid UserOp: callData and signature must be non-empty (client must sign the UserOp with the AA owner key; see ERC-4337)',
		}
	}
	if (sigLen !== 65) {
		return {
			valid: false,
			error: `Invalid signature length: expected 65 bytes (130 hex chars), got ${sigLen} bytes (${sigHex.length} chars). Ensure client sends EIP-191 signature as hex, not double-encoded.`,
		}
	}
	let sigBytes: Uint8Array
	try {
		sigBytes = ethers.getBytes(sigHex)
	} catch {
		return { valid: false, error: 'Invalid signature hex: cannot decode to bytes' }
	}
	if (sigBytes.length !== 65) {
		return {
			valid: false,
			error: `Signature decoded length is ${sigBytes.length}, expected 65`,
		}
	}
	return { valid: true }
}

/** AAtoEOA 接口根地址（Beamio 正式环境） */
const defaultApiBase = 'https://beamio.app'

/**
 * 调用服务端 POST /api/AAtoEOA，提交 AA→EOA 的已签字 UserOp，由 Beamio 代付 Gas。
 * @param apiBaseUrl 接口根地址，如 https://beamio.app
 * @param toEOA 收款 EOA 地址
 * @param amountUSDC6 金额（USDC 6 位小数，字符串）
 * @param packedUserOp ERC-4337 PackedUserOperation（客户端已签字）
 */
export async function AAtoEOA(
	apiBaseUrl: string,
	toEOA: string,
	amountUSDC6: string,
	packedUserOp: AAtoEOAUserOp
): Promise<AAtoEOAResponse> {
	const preCheck = validateAAtoEOAUserOp(packedUserOp)
	if (!preCheck.valid) {
		return { success: false, error: preCheck.error }
	}
	const url = `${apiBaseUrl.replace(/\/$/, '')}/api/AAtoEOA`
	const body: AAtoEOARequest = {
		toEOA,
		amountUSDC6,
		packedUserOp,
	}
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	const data = await res.json().catch(() => ({})) as AAtoEOAResponse
	if (!res.ok) {
		return { success: false, error: data?.error || res.statusText || 'AAtoEOA request failed' }
	}
	return data
}

export const beamioApiBase = defaultApiBase

/** ContainerItem 与合约 BeamioContainerModuleV07 一致：kind 0=ERC20, 1=ERC1155 */
export type ContainerItemLike = {
	kind: number
	asset: string
	amount: bigint
	tokenId: bigint
	data: string | Uint8Array
}

/** containerMainRelayedOpen 签名结果，与 BeamioContainerModuleV07.containerMainRelayedOpen(to, items, currencyType, maxAmount, nonce_, deadline_, sig) 一致；items 为可 JSON 序列化（amount/tokenId 为 string） */
export type OpenContainerRelayPayload = {
	account: string
	to: string
	items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[]
	currencyType: number
	maxAmount: string
	nonce: string
	deadline: string
	signature: string
}

/** containerMainRelayed（绑定 to）签名结果，供 Factory.relayContainerMainRelayed 或服务端 relay 使用；items 为可 JSON 序列化（amount/tokenId 为 string） */
export type ContainerRelayPayload = {
	account: string
	to: string
	items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[]
	nonce: string
	deadline: string
	signature: string
}

// 与 BeamioContainerModuleV07 一致：domain name/version、OpenContainerMain 字段顺序
const DOMAIN_NAME = 'BeamioAccount'
const DOMAIN_VERSION = '1'

/** 仅接受 0x 开头的 hex 或 Uint8Array，保证与合约 bytes 的 keccak256 一致；否则抛错 */
function normalizeBytesLike(data: string | Uint8Array): Uint8Array {
	if (data instanceof Uint8Array) return data
	if (typeof data !== 'string') throw new Error('ContainerItem.data must be 0x-prefixed hex string or Uint8Array')
	const s = data
	if (!s.startsWith('0x')) throw new Error('ContainerItem.data must be 0x-prefixed hex string')
	if (s.length > 2 && !/^0x[0-9a-fA-F]*$/.test(s)) throw new Error('ContainerItem.data must be valid hex after 0x')
	return ethers.getBytes(s)
}

/**
 * 与合约完全一致：hashItem = keccak256(abi.encode(uint8(kind), asset, amount, tokenId, keccak256(data)))
 * kind 仅允许 0(ERC20) 或 1(ERC1155)；data 必须经 normalizeBytesLike。
 */
function hashItem(it: ContainerItemLike): string {
	if (it.kind !== 0 && it.kind !== 1) throw new Error(`ContainerItem.kind must be 0 (ERC20) or 1 (ERC1155), got ${it.kind}`)
	const rawBytes = normalizeBytesLike(it.data)
	const dataHash = ethers.keccak256(rawBytes)
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
		['uint8', 'address', 'uint256', 'uint256', 'bytes32'],
		[it.kind as 0 | 1, it.asset, it.amount, it.tokenId, dataHash]
	)
	return ethers.keccak256(encoded)
}

/**
 * 与合约一致：先对每个 item 做 hashItem 得到 bytes32[] hs，再 keccak256(abi.encode(hs))。
 */
function hashItems(items: ContainerItemLike[]): string {
	const hashes = items.map((it) => hashItem(it))
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32[]'], [hashes])
	return ethers.keccak256(encoded)
}

/** Base 主网 chainId */
const BASE_CHAIN_ID = 8453
const BEAMIO_ACCOUNT_ABI = [
	'function owner() view returns (address)',
	'function containerModule() view returns (address)'
  ]
  
function slotBase(): bigint {
	const slotHex = ethers.keccak256(ethers.toUtf8Bytes('beamio.container.module.storage.v07'))
	return BigInt(slotHex)
}
  

export async function readContainerNonceFromAAStorage(
	provider: ethers.Provider,
	aaAccount: string,
	kind: 'relayed' | 'openRelayed'
  ): Promise<bigint> {
	const base = slotBase()
	const slot = kind === 'relayed' ? base : (base + 1n)
  
	// ethers v6: getStorage(address, position)
	const raw = await provider.getStorage(aaAccount, slot) // returns 0x...
	return BigInt(raw)
}


/**
 * 使用 BeamioContainerModuleV07.containerMainRelayed（绑定 to）将 AA 内 USDC 转到 owner 的 EOA。
 * 用 owner 私钥对 EIP-712 ContainerMain(account, to, itemsHash, nonce, deadline) 签名，返回 payload 供 Factory.relayContainerMainRelayed 或服务端 relay。
 * @param profile 含 privateKeyArmor、aaAccount（必填）
 * @param amountUSDC 本次转账金额（6 位小数，如 "10.5"），人类可读 → bigint = amountUSDC * 10**6
 * @param options.provider 可选，默认 Base 主网
 */
export async function signAAtoEOA_USDC_with_BeamioContainerMainRelayed(
	profile: profile,
	amountUSDC: string,
	to: string,
	options?: { provider?: ethers.Provider },
	
): Promise<ContainerRelayPayload> {
	const provider = baseEndpoint
	const signer = new ethers.Wallet(profile.privateKeyArmor, provider)

	const aaAccount = profile.aaAccount
	if (!aaAccount || !ethers.isAddress(aaAccount)) {
		throw new Error('profile.aaAccount is required and must be a valid address')
	}

	// owner 校验
	const aa = new ethers.Contract(aaAccount, BEAMIO_ACCOUNT_ABI, provider)
	const owner = await aa.owner() as string
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
		throw new Error(`AA owner does not match signer: owner=${owner} signer=${signer.address}`)
	}

	// ✅ 关键：从 containerModule 读真实 relayedNonce（append account）
	const nonce = await readContainerNonceFromAAStorage(provider, aaAccount, 'relayed')

	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const amount6 = ethers.parseUnits(amountUSDC, 6)
	const toEOA = signer.address

	const items: ContainerItemLike[] = [
		{ kind: 0, asset: USDC_ADDRESS_BASE, amount: amount6, tokenId: 0n, data: '0x' }
	]
	const itemsHash = hashItems(items)

	const domain = {
		name: DOMAIN_NAME,
		version: DOMAIN_VERSION,
		chainId: BASE_CHAIN_ID,
		verifyingContract: aaAccount
	}

	const types = {
		ContainerMain: [
			{ name: 'account', type: 'address' },
			{ name: 'to', type: 'address' },
			{ name: 'itemsHash', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		]
	}

	const value = {
		account: aaAccount,
		to: toEOA,
		itemsHash,
		nonce,
		deadline
	}

	const signature = await signer.signTypedData(domain, types, value)

	return {
		account: aaAccount,
		to: toEOA,
		items: items.map((it) => ({
		kind: it.kind,
		asset: it.asset,
		amount: it.amount.toString(),
		tokenId: it.tokenId.toString(),
		data: typeof it.data === 'string' ? it.data : ethers.hexlify(it.data)
		})),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature
	}
}

/**
 * open relayed（不绑定 to/items）：与 BeamioContainerModuleV07.containerMainRelayedOpen(to, items, currencyType, maxAmount, nonce_, deadline_, sig) 对齐。
 * - 签名仅绑定 OpenContainerMain(account, currencyType, maxAmount, nonce, deadline)，不包含 token/to/items。
 * - nonce 从 AA storage 读 openRelayedNonce。
 */
export async function signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(
	profile: { privateKeyArmor: string; aaAccount: string },
	amountUSDC: string,
	options?: { provider?: ethers.Provider; to?: string; deadlineSeconds?: number }
  ): Promise<OpenContainerRelayPayload> {
	const prov = baseEndpoint

	const signer = new ethers.Wallet(profile.privateKeyArmor, prov)

	const aaAccount = profile.aaAccount
	if (!aaAccount || !ethers.isAddress(aaAccount)) {
	  throw new Error('profile.aaAccount is required and must be a valid address')
	}

	const code = await prov.getCode(aaAccount)
	if (!code || code === '0x' || code.length <= 2) {
	  throw new Error(`AA account has no code: ${aaAccount}`)
	}

	const aa = new ethers.Contract(aaAccount, BeamioAccountABI, prov)
	const owner = (await aa.owner()) as string
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
	  throw new Error(`AA owner does not match signer: owner=${owner} signer=${signer.address}`)
	}

	const nonce = await readContainerNonceFromAAStorage(prov, aaAccount, 'openRelayed')

	const now = Math.floor(Date.now() / 1000)
	const deadline = BigInt(now + (options?.deadlineSeconds ?? 300))

	const amountWei = ethers.parseUnits(amountUSDC, 6)
	const to = options?.to && ethers.isAddress(options.to) ? options.to : signer.address

	const items: ContainerItemLike[] = [
	  { kind: 0, asset: USDC_ADDRESS_BASE, amount: amountWei, tokenId: 0n, data: '0x' }
	]

	const currencyType = 4 // USDC（与 BeamioCurrency 一致）
	const maxAmount = 0n // 0 = no max limit（合约 maxAmount==0 表示不限制）

	const domain = {
	  name: DOMAIN_NAME,
	  version: DOMAIN_VERSION,
	  chainId: BASE_CHAIN_ID,
	  verifyingContract: aaAccount
	}

	// 与合约 OPEN_CONTAINER_TYPEHASH 一致：OpenContainerMain(address account,uint8 currencyType,uint256 maxAmount,uint256 nonce,uint256 deadline)，无 token
	const types = {
	  OpenContainerMain: [
		{ name: 'account', type: 'address' },
		{ name: 'currencyType', type: 'uint8' },
		{ name: 'maxAmount', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' }
	  ]
	}

	const value = {
	  account: aaAccount,
	  currencyType,
	  maxAmount,
	  nonce,
	  deadline
	}

	const signature = await signer.signTypedData(domain, types, value)

	return {
	  account: aaAccount,
	  to,
	  items: items.map((it) => ({
		kind: it.kind,
		asset: it.asset,
		amount: it.amount.toString(),
		tokenId: it.tokenId.toString(),
		data: typeof it.data === 'string' ? it.data : ethers.hexlify(it.data)
	  })),
	  currencyType,
	  maxAmount: maxAmount.toString(),
	  nonce: nonce.toString(),
	  deadline: deadline.toString(),
	  signature
	}
}
