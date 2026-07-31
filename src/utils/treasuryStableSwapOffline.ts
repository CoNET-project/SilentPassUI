/**
 * CoNET 本链离线签字 StableSwap helper（USDC ↔ paid GB / USDC ↔ paid B-Unit）。
 * EIP-712 verifyingContract = Peer；执行入口 = Offline；gas 由 Master 代付。
 */
import { ethers } from 'ethers'

export const CONET_STABLE_SWAP_CHAIN_ID = 224422n
export const CONET_TREASURY_PEER = '0x6093871d8a3EE6EaADc9869451D1693973cFBCC0'
export const CONET_TREASURY_PEER_STABLE_SWAP_OFFLINE =
	'0xdB91AaFf8d076a8B45B48f5d8bA8A1191627f1F2'
export const CONET_TREASURY_CREATE2 = '0xa311c8fBE7CafC611603Ee925465A62493B73B30'

export const CANONICAL_GB_ERC20 = 1
export const CANONICAL_USDC_ERC20 = 2
export const CANONICAL_BUINT_ERC20 = 3

const BEAMIO_API = 'https://beamio.app'

export const TREASURY_STABLE_SWAP_TYPES = {
	StableSwap: [
		{ name: 'user', type: 'address' },
		{ name: 'burnAssetKind', type: 'uint8' },
		{ name: 'amount', type: 'uint256' },
		{ name: 'destinationChainId', type: 'uint256' },
		{ name: 'recipient', type: 'address' },
		{ name: 'creditAssetKind', type: 'uint8' },
		{ name: 'minCreditAmount', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const

export function treasuryStableSwapEip712Domain() {
	return {
		name: 'ConetTreasuryPeer',
		version: '1',
		chainId: Number(CONET_STABLE_SWAP_CHAIN_ID),
		verifyingContract: CONET_TREASURY_PEER,
	}
}

export type SignTreasuryStableSwapParams = {
	user: string
	burnAssetKind: number
	amount: bigint
	destinationChainId?: bigint
	recipient?: string
	creditAssetKind: number
	minCreditAmount: bigint
	nonce: bigint
	deadline: bigint
	signer: ethers.Signer
}

export async function signTreasuryStableSwap(params: SignTreasuryStableSwapParams): Promise<string> {
	const user = ethers.getAddress(params.user)
	const recipient = ethers.getAddress(params.recipient ?? user)
	const destinationChainId = params.destinationChainId ?? CONET_STABLE_SWAP_CHAIN_ID
	return params.signer.signTypedData(
		treasuryStableSwapEip712Domain(),
		TREASURY_STABLE_SWAP_TYPES,
		{
			user,
			burnAssetKind: params.burnAssetKind,
			amount: params.amount,
			destinationChainId,
			recipient,
			creditAssetKind: params.creditAssetKind,
			minCreditAmount: params.minCreditAmount,
			nonce: params.nonce,
			deadline: params.deadline,
		},
	)
}

export async function fetchTreasuryStableSwapNonce(user: string): Promise<{
	nonce: bigint
	domain: ReturnType<typeof treasuryStableSwapEip712Domain>
}> {
	const res = await fetch(
		`${BEAMIO_API}/api/treasuryStableSwapNonce?user=${encodeURIComponent(ethers.getAddress(user))}`,
	)
	const json = (await res.json()) as {
		success?: boolean
		nonce?: string
		domain?: ReturnType<typeof treasuryStableSwapEip712Domain>
		error?: string
	}
	if (!res.ok || !json.success || json.nonce == null) {
		throw new Error(json.error || 'Failed to fetch stableSwap nonce')
	}
	return { nonce: BigInt(json.nonce), domain: json.domain ?? treasuryStableSwapEip712Domain() }
}

export type PostTreasuryStableSwapBody = {
	user: string
	burnAssetKind: number
	amount: string
	destinationChainId: string
	recipient: string
	creditAssetKind: number
	minCreditAmount: string
	nonce: string
	deadline: string
	signature: string
	permit?: {
		value: string
		deadline: string
		v: number
		r: string
		s: string
	}
}

export async function postTreasuryStableSwap(body: PostTreasuryStableSwapBody): Promise<{
	success: boolean
	txHash?: string
	error?: string
}> {
	const res = await fetch(`${BEAMIO_API}/api/treasuryStableSwap`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})
	const json = (await res.json()) as { success?: boolean; txHash?: string; error?: string }
	if (!res.ok || !json.success) {
		return { success: false, error: json.error || `HTTP ${res.status}` }
	}
	return { success: true, txHash: json.txHash }
}

/**
 * 读链 quote + nonce → 签字 → POST /api/treasuryStableSwap。
 * `privateKeyArmor` 仅用于本地 signTypedData；不落盘。
 */
export async function executeTreasuryStableSwapOffline(args: {
	privateKeyArmor: string
	burnAssetKind: number
	creditAssetKind: number
	amount: bigint
	minCreditAmount?: bigint
	recipient?: string
	deadlineSecs?: number
	rpcUrl?: string
}): Promise<{ success: boolean; txHash?: string; quote?: string; error?: string }> {
	const provider = new ethers.JsonRpcProvider(args.rpcUrl || 'https://rpc1.conet.network')
	const wallet = new ethers.Wallet(args.privateKeyArmor, provider)
	const user = await wallet.getAddress()

	const peer = new ethers.Contract(
		CONET_TREASURY_PEER,
		['function quoteStableSwap(uint8,uint256,uint8) view returns (uint256)'],
		provider,
	)
	const quote = BigInt((await peer.quoteStableSwap!(args.burnAssetKind, args.amount, args.creditAssetKind)).toString())
	const minCreditAmount = args.minCreditAmount ?? quote
	if (quote < minCreditAmount) {
		return { success: false, quote: quote.toString(), error: 'quote below minCreditAmount' }
	}

	const { nonce } = await fetchTreasuryStableSwapNonce(user)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + (args.deadlineSecs ?? 600))
	const recipient = ethers.getAddress(args.recipient ?? user)
	const signature = await signTreasuryStableSwap({
		user,
		burnAssetKind: args.burnAssetKind,
		amount: args.amount,
		destinationChainId: CONET_STABLE_SWAP_CHAIN_ID,
		recipient,
		creditAssetKind: args.creditAssetKind,
		minCreditAmount,
		nonce,
		deadline,
		signer: wallet,
	})

	const posted = await postTreasuryStableSwap({
		user,
		burnAssetKind: args.burnAssetKind,
		amount: args.amount.toString(),
		destinationChainId: CONET_STABLE_SWAP_CHAIN_ID.toString(),
		recipient,
		creditAssetKind: args.creditAssetKind,
		minCreditAmount: minCreditAmount.toString(),
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	})
	return { ...posted, quote: quote.toString() }
}
