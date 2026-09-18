export type MediaRecord = {
	id: string
	url: string
	thumbnailUrl?: string
	name: string
	kind: 'image' | 'video'
	createdAt: number
}

export type MediaInput = Partial<Omit<MediaRecord, 'url'>> & Pick<MediaRecord, 'url'>

export const MEDIA_STORAGE_PREFIX = 'beamio:merchant-media:v1:'

export function storageKey(address: string): string {
	return `${MEDIA_STORAGE_PREFIX}${address.trim().toLowerCase()}`
}

export function loadMedia(address: string): MediaRecord[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(storageKey(address)) || '[]')
		return Array.isArray(parsed) ? (parsed as MediaRecord[]) : []
	} catch {
		return []
	}
}

export function saveMedia(address: string, rows: MediaRecord[]): void {
	localStorage.setItem(storageKey(address), JSON.stringify(rows))
}

export function resolveMerchantMediaItems(initialMedia: MediaInput[], eoaAddress: string): MediaRecord[] {
	if (initialMedia.length > 0) {
		return initialMedia.map((item, index) => ({
			id: item.id || `${item.url}-${index}`,
			url: item.url,
			...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
			name: item.name || 'Merchant media',
			kind: item.kind === 'video' ? 'video' : 'image',
			createdAt: item.createdAt || Date.now(),
		}))
	}
	const address = eoaAddress.trim()
	return address ? loadMedia(address) : []
}

/** Hero / Discover banner: use poster for video items when available. */
export function merchantMediaHeroUrlFromRecord(item: MediaRecord): string {
	if (item.kind === 'video') {
		return (item.thumbnailUrl || item.url).trim()
	}
	return item.url.trim()
}
