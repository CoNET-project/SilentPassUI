/**
 * SilentPassUI：OpenContainer EIP-712 签名（与 bizSite / 合约 BeamioContainerModuleV07 一致）。
 * account 必须通过 UserCard 工厂链路与链上扣点一致，见 resolveBeamioAaForEoaWithFallback。
 */
import { ethers } from 'ethers'
import { baseEndpoint, conetDepinProvider, USDCContract_BASE } from '../utils/constants'
import { CONET_MAINNET_CHAIN_ID } from '@/config/chainAddresses'
import { resolveBeamioAaForEoaWithFallback, resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'

const USDC_ADDRESS_BASE = USDCContract_BASE

/** POST /api/AAtoEOA 等 Beamio API 根 URL（与 bizSite AAaccount.beamioApiBase 一致） */
export const beamioApiBase = 'https://beamio.app'

export type ContainerItemLike = {
	kind: number
	asset: string
	amount: bigint
	tokenId: bigint
	data: string | Uint8Array
}

export type OpenContainerRelayPayload = {
	account: string
	to: string
	items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[]
	currencyType: number
	maxAmount: string
	nonce: string
	deadline: string
	signature: string
	chain?: 'base' | 'conet'
	chainId?: number
	openContainerPayloads?: {
		base?: OpenContainerRelayPayload
		conet?: OpenContainerRelayPayload
	}
}

/** containerMainRelayed（绑定 to）：与 bizSite / BeamioContainerModuleV07 一致 */
export type ContainerRelayPayload = {
	account: string
	to: string
	items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[]
	nonce: string
	deadline: string
	signature: string
}

function compactOpenContainerPayloadForQr(payload: OpenContainerRelayPayload): Record<string, unknown> {
	return {
		a: payload.account,
		c: payload.currencyType,
		m: payload.maxAmount,
		n: payload.nonce,
		d: payload.deadline,
		s: payload.signature,
	}
}

function legacyOpenContainerPayloadForQr(payload: OpenContainerRelayPayload): Record<string, unknown> {
	return {
		account: payload.account,
		to: payload.to,
		items: [],
		currencyType: payload.currencyType,
		maxAmount: payload.maxAmount,
		nonce: payload.nonce,
		deadline: payload.deadline,
		validBefore: payload.deadline,
		signature: payload.signature,
	}
}

export function encodeOpenContainerRelayQrPayload(payload: OpenContainerRelayPayload): string {
	if (payload.openContainerPayloads) {
		const encoded: Record<string, unknown> = {}
		if (payload.openContainerPayloads.base) {
			encoded.b = compactOpenContainerPayloadForQr(payload.openContainerPayloads.base)
		}
		if (payload.openContainerPayloads.conet) {
			encoded.c = compactOpenContainerPayloadForQr(payload.openContainerPayloads.conet)
		}
		const legacyPrimary = payload.openContainerPayloads.conet ?? payload.openContainerPayloads.base ?? payload
		return JSON.stringify({ ...legacyOpenContainerPayloadForQr(legacyPrimary), v: 1, p: encoded })
	}
	return JSON.stringify(legacyOpenContainerPayloadForQr(payload))
}

const DOMAIN_NAME = 'BeamioAccount'
const DOMAIN_VERSION = '1'
const BASE_CHAIN_ID = 8453

const BEAMIO_ACCOUNT_ABI = [
	'function owner() view returns (address)',
	'function containerModule() view returns (address)',
	'function relayedNonce() view returns (uint256)',
	'function openRelayedNonce() view returns (uint256)',
]

function normalizeBytesLike(data: string | Uint8Array): Uint8Array {
	if (data instanceof Uint8Array) return data
	if (typeof data !== 'string') throw new Error('ContainerItem.data must be 0x-prefixed hex string or Uint8Array')
	const s = data
	if (!s.startsWith('0x')) throw new Error('ContainerItem.data must be 0x-prefixed hex string')
	if (s.length > 2 && !/^0x[0-9a-fA-F]*$/.test(s)) throw new Error('ContainerItem.data must be valid hex after 0x')
	return ethers.getBytes(s)
}

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

function hashItems(items: ContainerItemLike[]): string {
	const hashes = items.map((it) => hashItem(it))
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32[]'], [hashes])
	return ethers.keccak256(encoded)
}

export async function readContainerNonceFromAAStorage(
	provider: ethers.Provider,
	aaAccount: string,
	kind: 'relayed' | 'openRelayed'
): Promise<bigint> {
	const base = BigInt(ethers.keccak256(ethers.toUtf8Bytes('beamio.container.module.storage.v07')))
	const slot = kind === 'relayed' ? base : base + 1n
	const raw = await provider.getStorage(ethers.getAddress(aaAccount), slot)
	return BigInt(raw)
}

async function resolveSigningAaAccount(
	provider: ethers.Provider,
	profileAa: string | undefined,
	signerEoa: string,
	resolveCanonical: (provider: ethers.Provider, eoa: string) => Promise<string | null> = resolveBeamioAaForEoaWithFallback
): Promise<string> {
	const canonical = await resolveCanonical(provider, signerEoa)
	if (!canonical) {
		throw new Error(
			'No Beamio AA for this EOA on the UserCard factory path. Create or link a smart account, or check factory config.'
		)
	}
	const aa = ethers.getAddress(canonical)
	if (
		profileAa &&
		ethers.isAddress(profileAa) &&
		ethers.getAddress(profileAa).toLowerCase() !== aa.toLowerCase()
	) {
		console.warn(
			`[AAaccount] profile.aaAccount ${profileAa} != canonical ${aa} (UserCard factory); signing with canonical`
		)
	}
	return aa
}

async function signOpenContainerForChain(params: {
	profile: { privateKeyArmor: string; aaAccount?: string }
	amountUSDC: string
	provider: ethers.Provider
	chainId: number
	chain: 'base' | 'conet'
	to?: string
	deadlineSeconds?: number
	resolveCanonical?: (provider: ethers.Provider, eoa: string) => Promise<string | null>
}): Promise<OpenContainerRelayPayload> {
	const signer = new ethers.Wallet(params.profile.privateKeyArmor, params.provider)
	const aaAccount = await resolveSigningAaAccount(
		params.provider,
		params.profile.aaAccount,
		signer.address,
		params.resolveCanonical
	)

	const code = await params.provider.getCode(aaAccount)
	if (!code || code === '0x' || code.length <= 2) {
		throw new Error(`AA account has no code: ${aaAccount}`)
	}

	const aa = new ethers.Contract(aaAccount, BEAMIO_ACCOUNT_ABI, params.provider)
	const owner = (await aa.owner()) as string
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
		throw new Error(`AA owner does not match signer: owner=${owner} signer=${signer.address}`)
	}

	const nonce = await readContainerNonceFromAAStorage(params.provider, aaAccount, 'openRelayed')
	const now = Math.floor(Date.now() / 1000)
	const deadline = BigInt(now + (params.deadlineSeconds ?? 300))
	const amountWei = ethers.parseUnits(params.amountUSDC, 6)
	const to = params.to && ethers.isAddress(params.to) ? params.to : signer.address

	const items: ContainerItemLike[] = [
		{ kind: 0, asset: USDC_ADDRESS_BASE, amount: amountWei, tokenId: 0n, data: '0x' },
	]

	const currencyType = 4
	const maxAmount = 0n

	const domain = {
		name: DOMAIN_NAME,
		version: DOMAIN_VERSION,
		chainId: params.chainId,
		verifyingContract: aaAccount,
	}

	const types = {
		OpenContainerMain: [
			{ name: 'account', type: 'address' },
			{ name: 'currencyType', type: 'uint8' },
			{ name: 'maxAmount', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	}

	const value = {
		account: aaAccount,
		currencyType,
		maxAmount,
		nonce,
		deadline,
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
			data: typeof it.data === 'string' ? it.data : ethers.hexlify(it.data),
		})),
		currencyType,
		maxAmount: maxAmount.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
		chain: params.chain,
		chainId: params.chainId,
	}
}

/**
 * containerMainRelayed：EIP-712 ContainerMain(account, to, itemsHash, nonce, deadline)，将 AA 内 USDC 转到 owner EOA。
 * 与 bizSite signAAtoEOA_USDC_with_BeamioContainerMainRelayed 对齐。
 */
export async function signAAtoEOA_USDC_with_BeamioContainerMainRelayed(
	profile: { privateKeyArmor: string; aaAccount?: string },
	amountUSDC: string,
	_to: string,
	options?: { provider?: ethers.Provider }
): Promise<ContainerRelayPayload> {
	const provider = baseEndpoint
	const signer = new ethers.Wallet(profile.privateKeyArmor, provider)
	const aaAccount = await resolveSigningAaAccount(provider, profile.aaAccount, signer.address)

	const aa = new ethers.Contract(aaAccount, BEAMIO_ACCOUNT_ABI, provider)
	const owner = await aa.owner()
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
		throw new Error(`AA owner does not match signer: owner=${owner} signer=${signer.address}`)
	}

	const nonce = await readContainerNonceFromAAStorage(provider, aaAccount, 'relayed')
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const amount6 = ethers.parseUnits(amountUSDC, 6)
	const toEOA = signer.address

	const items: ContainerItemLike[] = [
		{ kind: 0, asset: USDC_ADDRESS_BASE, amount: amount6, tokenId: 0n, data: '0x' },
	]
	const itemsHash = hashItems(items)

	const domain = {
		name: DOMAIN_NAME,
		version: DOMAIN_VERSION,
		chainId: BASE_CHAIN_ID,
		verifyingContract: aaAccount,
	}

	const types = {
		ContainerMain: [
			{ name: 'account', type: 'address' },
			{ name: 'to', type: 'address' },
			{ name: 'itemsHash', type: 'bytes32' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	}

	const value = {
		account: aaAccount,
		to: toEOA,
		itemsHash,
		nonce,
		deadline,
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
			data: typeof it.data === 'string' ? it.data : ethers.hexlify(it.data),
		})),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	}
}

/**
 * OpenContainer：签名绑定 OpenContainerMain(account, currencyType, maxAmount, nonce, deadline)。
 */
export async function signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(
	profile: { privateKeyArmor: string; aaAccount?: string },
	amountUSDC: string,
	options?: { provider?: ethers.Provider; to?: string; deadlineSeconds?: number }
): Promise<OpenContainerRelayPayload> {
	const basePayload = await signOpenContainerForChain({
		profile,
		amountUSDC,
		provider: options?.provider ?? baseEndpoint,
		chainId: BASE_CHAIN_ID,
		chain: 'base',
		to: options?.to,
		deadlineSeconds: options?.deadlineSeconds,
		resolveCanonical: resolveBeamioAaForEoaWithFallback,
	})

	let conetPayload: OpenContainerRelayPayload | undefined
	try {
		conetPayload = await signOpenContainerForChain({
			profile,
			amountUSDC,
			provider: conetDepinProvider,
			chainId: CONET_MAINNET_CHAIN_ID,
			chain: 'conet',
			to: options?.to,
			deadlineSeconds: options?.deadlineSeconds,
			resolveCanonical: resolveBeamioAaOnConet,
		})
	} catch (e) {
		console.warn('[AAaccount] CoNET OpenContainer pay QR unavailable; emitting Base-only QR:', e)
	}

	return {
		...basePayload,
		openContainerPayloads: {
			base: basePayload,
			...(conetPayload ? { conet: conetPayload } : {}),
		},
	}
}
