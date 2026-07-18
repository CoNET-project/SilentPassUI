import { ethers } from 'ethers'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

const ROLE_CACHE_TTL_MS = 30_000

const REFERRAL_REGISTRY_ABI = [
	'function admins(address) view returns (bool)',
	'function members(address) view returns (uint8 role, address parentAdmin, address parentL0, uint256 rebateBps, uint256 ratioBps, bool active)',
	'function merchantQuotas(address) view returns (uint256 starterKetRemaining, uint256 paidBunitRemaining, uint256 issuedCodeCount, uint256 claimedCodeCount)',
	'function claimableConetUsdc(address) view returns (uint256)',
	'function l0ClaimPaused(address) view returns (bool)',
	'function l1ClaimPaused(address l0, address l1) view returns (bool)',
] as const

export type ReferralRegistryRole = 'none' | 'l0' | 'l1' | 'merchant'

export type ReferralRegistryRoleSnapshot = {
	eoa: string
	isAdmin: boolean
	role: ReferralRegistryRole
	parentAdmin: string
	parentL0: string
	rebateBps: string
	ratioBps: string
	active: boolean
	starterKetRemaining: string
	paidBunitRemaining: string
	issuedCodeCount: string
	claimedCodeCount: string
	claimableConetUsdc: string
	claimPaused: boolean
	fetchedAt: number
}

export type ReferralRegistryRoleResult =
	| { ok: true; snapshot: ReferralRegistryRoleSnapshot }
	| { ok: false; error: string }

type CacheEntry = {
	snapshot: ReferralRegistryRoleSnapshot
	fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<ReferralRegistryRoleResult>>()
let rpcQueue: Promise<void> = Promise.resolve()

function enqueueRpc<T>(work: () => Promise<T>): Promise<T> {
	const next = rpcQueue.then(work, work)
	rpcQueue = next.then(
		() => undefined,
		() => undefined,
	)
	return next
}

function roleFromValue(role: number): ReferralRegistryRole {
	if (role === 1) return 'l0'
	if (role === 2) return 'l1'
	if (role === 3) return 'merchant'
	return 'none'
}

export function referralRegistryRoleLabel(role: ReferralRegistryRole): string {
	if (role === 'l0') return 'L0'
	if (role === 'l1') return 'L1'
	if (role === 'merchant') return 'Merchant'
	return 'Unregistered'
}

export async function fetchReferralRegistryRole(
	rawEoa: string,
	options: { force?: boolean } = {},
): Promise<ReferralRegistryRoleResult> {
	let eoa: string
	try {
		eoa = ethers.getAddress(rawEoa.trim())
	} catch {
		return { ok: false, error: 'The current wallet address is unavailable.' }
	}

	const key = eoa.toLowerCase()
	const cached = cache.get(key)
	if (!options.force && cached && Date.now() - cached.fetchedAt < ROLE_CACHE_TTL_MS) {
		return { ok: true, snapshot: cached.snapshot }
	}
	const existing = inFlight.get(key)
	if (existing) return existing

	const request = enqueueRpc(async (): Promise<ReferralRegistryRoleResult> => {
		try {
			const registry = new ethers.Contract(
				CONET_REFERRAL_REGISTRY_VAULT_V1,
				REFERRAL_REGISTRY_ABI,
				conetDepinProvider,
			)
			const isAdmin = Boolean(await registry.admins(eoa))
			const member = await registry.members(eoa)
			const role = roleFromValue(Number(member.role))
			const parentAdmin = ethers.getAddress(member.parentAdmin)
			const parentL0 = ethers.getAddress(member.parentL0)
			let quota = {
				starterKetRemaining: '0',
				paidBunitRemaining: '0',
				issuedCodeCount: '0',
				claimedCodeCount: '0',
			}
			let claimPaused = false
			if (role === 'l0') {
				const q = await registry.merchantQuotas(eoa)
				quota = {
					starterKetRemaining: q.starterKetRemaining.toString(),
					paidBunitRemaining: q.paidBunitRemaining.toString(),
					issuedCodeCount: q.issuedCodeCount.toString(),
					claimedCodeCount: q.claimedCodeCount.toString(),
				}
				claimPaused = Boolean(await registry.l0ClaimPaused(eoa))
			} else if (role === 'l1' && parentL0 !== ethers.ZeroAddress) {
				claimPaused = Boolean(await registry.l1ClaimPaused(parentL0, eoa))
			}
			const snapshot: ReferralRegistryRoleSnapshot = {
				eoa,
				isAdmin,
				role,
				parentAdmin,
				parentL0,
				rebateBps: member.rebateBps.toString(),
				ratioBps: member.ratioBps.toString(),
				active: Boolean(member.active),
				...quota,
				claimableConetUsdc: (await registry.claimableConetUsdc(eoa)).toString(),
				claimPaused,
				fetchedAt: Date.now(),
			}
			cache.set(key, { snapshot, fetchedAt: snapshot.fetchedAt })
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[ReferralRegistryRole] RPC read failed', error)
			return { ok: false, error: 'Could not read referral permissions from CoNET.' }
		}
	})

	inFlight.set(key, request)
	try {
		return await request
	} finally {
		inFlight.delete(key)
	}
}
