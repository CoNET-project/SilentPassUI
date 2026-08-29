import { ethers } from 'ethers'
import { IpfsImg } from '@/components/IpfsImg'

export const beamioSearchAvatarUrl = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

export const beamioSearchDisplayName = (item: searchResult) => {
	const lastname = (item.last_name ?? '').split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '' : lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

export const beamioSearchShortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

export function formatBeamioSearchUserDate(timestamp?: string | number): string {
	if (!timestamp) return ''

	const num = Number(timestamp)
	if (!num) return ''

	const ms = num < 10_000_000_000 ? num * 1000 : num
	const d = new Date(ms)
	if (isNaN(d.getTime())) return ''

	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

/** Address-only row when searchUsername returns empty (matches global search). */
export function makeBeamioSearchAddressOnlyResult(address: string): searchResult {
	return {
		username: 'unknow',
		image: '',
		address: ethers.getAddress(address),
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
	}
}

export function beamioSearchTag(item: searchResult): string {
	return String(item.username || '')
		.trim()
		.replace(/^@+/, '')
}

export function isExactBeamioTagMatch(item: searchResult, query: string): boolean {
	const q = String(query || '')
		.trim()
		.replace(/^@+/, '')
	if (!q) return false
	return beamioSearchTag(item) === q
}

export function sortSearchResultsExactFirst(results: searchResult[], query: string): searchResult[] {
	const q = String(query || '')
		.trim()
		.replace(/^@+/, '')
	if (!q) return results
	const qLower = q.toLowerCase()
	return [...results].sort((a, b) => {
		const aTag = beamioSearchTag(a)
		const bTag = beamioSearchTag(b)
		const aExact = aTag === q ? 0 : 1
		const bExact = bTag === q ? 0 : 1
		if (aExact !== bExact) return aExact - bExact
		const aCi = aTag.toLowerCase() === qLower ? 0 : 1
		const bCi = bTag.toLowerCase() === qLower ? 0 : 1
		return aCi - bCi
	})
}

export function BeamioSearchResultRow({
	item,
	onSelect,
	query,
}: {
	item: searchResult
	onSelect: (item: searchResult) => void
	query?: string
}) {
	const exact = query ? isExactBeamioTagMatch(item, query) : false
	return (
		<button
			type="button"
			className={
				exact
					? 'flex w-full items-center bg-[#faf5ff] px-3 py-2.5 text-left hover:bg-[#f3e8ff] dark:bg-[#2a2233] dark:hover:bg-[#352844]'
					: 'flex w-full items-center px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800'
			}
			onClick={() => onSelect(item)}
		>
			<IpfsImg
				src={item.image ? item.image : beamioSearchAvatarUrl(item.username)}
				alt={item.username}
				className="mr-2 h-7 w-7 shrink-0 rounded-full bg-slate-200 object-cover dark:bg-slate-700"
			/>
			<div className="flex min-w-0 flex-1 items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-[13px] text-slate-900 dark:text-slate-100">
						{beamioSearchDisplayName(item)}
					</span>
					<span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
						@{item.username} · {beamioSearchShortAddress(item.address)}
					</span>
					<span className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
						{Number(item.follow_count || '0').toLocaleString()} following ·{' '}
						{Number(item.follower_count || '0').toLocaleString()} followers
					</span>
				</div>
				<span className="whitespace-nowrap text-[10px] text-slate-400 dark:text-slate-500">
					{formatBeamioSearchUserDate(item.created_at)}
				</span>
			</div>
		</button>
	)
}
