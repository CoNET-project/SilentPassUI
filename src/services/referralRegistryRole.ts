import { ethers } from 'ethers'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

const ROLE_CACHE_TTL_MS = 30_000
const ROLE_LOCAL_CACHE_PREFIX = 'beamio:referral:role:v1:'
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
	downstream: ReferralRegistryDownstreamItem[]
	fetchedAt: number
}

export type ReferralRegistryDownstreamItem = {
	address: string
	role: Exclude<ReferralRegistryRole, 'none'>
	/** For merchants: assigned L1 (or zero for legacy direct-under-L0). */
	parentAdmin?: string
	rebateBps: string
	ratioBps: string
	active: boolean
	merchantItems?: ReferralRegistryDownstreamItem[]
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
const treeCache = new Map<string, { fetchedAt: number; directChildren: ReferralRegistryDownstreamItem[] }>()
const treeInFlight = new Map<string, Promise<ReferralRegistryDownstreamItem[]>>()
let rpcQueue: Promise<void> = Promise.resolve()

function roleCacheKey(eoa: string): string {
	return `${ROLE_LOCAL_CACHE_PREFIX}${eoa.toLowerCase()}`
}

export function readCachedReferralRegistryRole(eoa: string): ReferralRegistryRoleSnapshot | null {
	try {
		const raw = localStorage.getItem(roleCacheKey(eoa))
		if (!raw) return null
		const parsed = JSON.parse(raw) as ReferralRegistryRoleSnapshot
		if (parsed.eoa?.toLowerCase() !== eoa.toLowerCase() || !parsed.role || !Array.isArray(parsed.downstream)) return null
		return parsed
	} catch {
		return null
	}
}

function savePersistentSnapshot(snapshot: ReferralRegistryRoleSnapshot): void {
	try {
		localStorage.setItem(roleCacheKey(snapshot.eoa), JSON.stringify(snapshot))
	} catch {
		// Cache failure must not affect the trusted RPC result.
	}
}

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

async function readDownstream(
	eoa: string,
	isAdmin: boolean,
	role: ReferralRegistryRole,
): Promise<ReferralRegistryDownstreamItem[]> {
	if (!isAdmin && role !== 'l0' && role !== 'l1') {
		return []
	}
	const mapChild = (item: {
		account?: string
		role?: ReferralRegistryRole
		parentAdmin?: string | null
		rebateBps?: string
		ratioBps?: string
		active?: boolean
	}): ReferralRegistryDownstreamItem | null => {
		if (!item.account || !ethers.isAddress(item.account) || !item.role || item.role === 'none') return null
		let parentAdmin: string | undefined
		if (item.parentAdmin && ethers.isAddress(item.parentAdmin)) {
			parentAdmin = ethers.getAddress(item.parentAdmin)
		}
		return {
			address: ethers.getAddress(item.account),
			role: item.role as Exclude<ReferralRegistryRole, 'none'>,
			...(parentAdmin && parentAdmin !== ethers.ZeroAddress ? { parentAdmin } : {}),
			rebateBps: String(item.rebateBps ?? '0'),
			ratioBps: String(item.ratioBps ?? '0'),
			active: Boolean(item.active),
		}
	}
	const nestMerchantsUnderL1 = (children: ReferralRegistryDownstreamItem[]): ReferralRegistryDownstreamItem[] => {
		const merchants = children.filter((child) => child.role === 'merchant')
		const others = children.filter((child) => child.role !== 'merchant')
		return others.map((item) => {
			if (item.role !== 'l1') return item
			const merchantItems = merchants
				.filter((merchant) => merchant.parentAdmin?.toLowerCase() === item.address.toLowerCase())
				.sort((a, b) => a.address.localeCompare(b.address))
			return merchantItems.length ? { ...item, merchantItems } : item
		}).concat(
			merchants
				.filter((merchant) => !merchant.parentAdmin || merchant.parentAdmin === ethers.ZeroAddress)
				.sort((a, b) => a.address.localeCompare(b.address)),
		)
	}
	const readTree = async (): Promise<ReferralRegistryDownstreamItem[]> => {
		const key = ethers.getAddress(eoa).toLowerCase()
		const cached = treeCache.get(key)
		if (cached && Date.now() - cached.fetchedAt < ROLE_CACHE_TTL_MS) return cached.directChildren
		const existing = treeInFlight.get(key)
		if (existing) return existing
		const request = fetch(`${beamioApi}/api/referralRegistryTree?account=${encodeURIComponent(eoa)}`)
			.then(async (response) => {
				const json = await response.json() as {
					success?: boolean
					directChildren?: Array<{
						account?: string
						role?: ReferralRegistryRole
						parentAdmin?: string | null
						rebateBps?: string
						ratioBps?: string
						active?: boolean
					}>
					error?: string
				}
				if (!response.ok || json.success !== true || !Array.isArray(json.directChildren)) {
					throw new Error(json.error ?? 'Referral registry tree unavailable.')
				}
				const directChildren = json.directChildren
					.map(mapChild)
					.filter((item): item is ReferralRegistryDownstreamItem => item != null)
					.sort((a, b) => a.address.localeCompare(b.address))
				treeCache.set(key, { fetchedAt: Date.now(), directChildren })
				return directChildren
			})
		treeInFlight.set(key, request)
		try {
			return await request
		} finally {
			treeInFlight.delete(key)
		}
	}
	const directChildren = await readTree()
	if (!isAdmin) {
		if (role === 'l0') return nestMerchantsUnderL1(directChildren)
		return directChildren
	}

	const enriched: ReferralRegistryDownstreamItem[] = []
	for (const item of directChildren) {
		if (item.role !== 'l0') {
			enriched.push(item)
			continue
		}
		try {
			const nestedChildren = nestMerchantsUnderL1(await readTreeForAccount(item.address))
			const merchantItems = nestedChildren
				.filter((child) => child.role === 'merchant')
				.concat(
					nestedChildren.flatMap((child) => child.merchantItems ?? []),
				)
				.sort((a, b) => a.address.localeCompare(b.address))
			enriched.push({ ...item, merchantItems })
		} catch {
			// Preserve the L0 row when the optional nested merchant read is unavailable.
			enriched.push(item)
		}
	}
	return enriched
}

async function readTreeForAccount(eoa: string): Promise<ReferralRegistryDownstreamItem[]> {
	const key = ethers.getAddress(eoa).toLowerCase()
	const cached = treeCache.get(key)
	if (cached && Date.now() - cached.fetchedAt < ROLE_CACHE_TTL_MS) return cached.directChildren
	const existing = treeInFlight.get(key)
	if (existing) return existing
	const request = fetch(`${beamioApi}/api/referralRegistryTree?account=${encodeURIComponent(eoa)}`)
		.then(async (response) => {
			const json = await response.json() as {
				success?: boolean
				directChildren?: Array<{
					account?: string
					role?: ReferralRegistryRole
					parentAdmin?: string | null
					rebateBps?: string
					ratioBps?: string
					active?: boolean
				}>
				error?: string
			}
			if (!response.ok || json.success !== true || !Array.isArray(json.directChildren)) throw new Error(json.error ?? 'Referral registry tree unavailable.')
			const directChildren = json.directChildren
				.filter((item): item is Required<typeof item> => Boolean(item.account && ethers.isAddress(item.account) && item.role && item.role !== 'none'))
				.map((item) => {
					let parentAdmin: string | undefined
					if (item.parentAdmin && ethers.isAddress(item.parentAdmin)) {
						parentAdmin = ethers.getAddress(item.parentAdmin)
					}
					return {
						address: ethers.getAddress(item.account),
						role: item.role as Exclude<ReferralRegistryRole, 'none'>,
						...(parentAdmin && parentAdmin !== ethers.ZeroAddress ? { parentAdmin } : {}),
						rebateBps: String(item.rebateBps ?? '0'),
						ratioBps: String(item.ratioBps ?? '0'),
						active: Boolean(item.active),
					}
				})
				.sort((a, b) => a.address.localeCompare(b.address))
			treeCache.set(key, { fetchedAt: Date.now(), directChildren })
			return directChildren
		})
	treeInFlight.set(key, request)
	try {
		return await request
	} finally {
		treeInFlight.delete(key)
	}
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
	if (!options.force) {
		const persisted = readCachedReferralRegistryRole(key)
		if (persisted && Date.now() - persisted.fetchedAt < ROLE_CACHE_TTL_MS) {
			cache.set(key, { snapshot: persisted, fetchedAt: persisted.fetchedAt })
			return { ok: true, snapshot: persisted }
		}
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
				downstream: await readDownstream(eoa, isAdmin, role),
				fetchedAt: Date.now(),
			}
			cache.set(key, { snapshot, fetchedAt: snapshot.fetchedAt })
			savePersistentSnapshot(snapshot)
			return { ok: true, snapshot }
		} catch (error) {
			console.warn('[ReferralRegistryRole] RPC read failed', error)
			const previous = cache.get(key)?.snapshot ?? readCachedReferralRegistryRole(key)
			if (previous) return { ok: true, snapshot: previous }
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
