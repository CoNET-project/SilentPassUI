const STORAGE_PREFIX = 'beamio:discoverUserLike:v1'

export type DiscoverUserLikeCacheEntry = {
	liked: boolean
	updatedAt: number
}

function storageKey(
	eoaLower: string,
	cardLower: string,
	targetKind: number,
	issuedParentId: string,
): string {
	return `${STORAGE_PREFIX}:${eoaLower}:${cardLower}:${targetKind}:${issuedParentId}`
}

export function loadDiscoverUserLikeLocalCache(
	eoaAddress: string,
	cardAddress: string,
	targetKind: number,
	issuedParentId: string | number = 0,
): DiscoverUserLikeCacheEntry | null {
	try {
		const eoaLower = String(eoaAddress ?? '').trim().toLowerCase()
		const cardLower = String(cardAddress ?? '').trim().toLowerCase()
		if (!eoaLower || !cardLower) return null
		const parentId = String(issuedParentId ?? 0)
		const raw = localStorage.getItem(storageKey(eoaLower, cardLower, targetKind, parentId))
		if (!raw) return null
		const parsed = JSON.parse(raw) as DiscoverUserLikeCacheEntry
		if (typeof parsed?.liked !== 'boolean' || typeof parsed?.updatedAt !== 'number') return null
		return parsed
	} catch {
		return null
	}
}

export function saveDiscoverUserLikeLocalCache(
	eoaAddress: string,
	cardAddress: string,
	targetKind: number,
	issuedParentId: string | number,
	liked: boolean,
): void {
	try {
		const eoaLower = String(eoaAddress ?? '').trim().toLowerCase()
		const cardLower = String(cardAddress ?? '').trim().toLowerCase()
		if (!eoaLower || !cardLower) return
		const parentId = String(issuedParentId ?? 0)
		const entry: DiscoverUserLikeCacheEntry = { liked, updatedAt: Date.now() }
		localStorage.setItem(storageKey(eoaLower, cardLower, targetKind, parentId), JSON.stringify(entry))
	} catch {
		// ignore quota / private mode
	}
}
