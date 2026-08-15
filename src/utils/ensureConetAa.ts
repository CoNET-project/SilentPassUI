import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'
import { conetDepinProvider } from '@/utils/constants'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
const conetEnsureInFlight = new Map<string, Promise<string | null>>()
const ENSURE_AA_TIMEOUT_MS = 12_000

function raceWithTimeout<T>(work: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
	if (typeof window === 'undefined') return work
	return new Promise<T>((resolve, reject) => {
		const timer = window.setTimeout(() => resolve(fallback), timeoutMs)
		work.then(
			(value) => {
				window.clearTimeout(timer)
				resolve(value)
			},
			(err) => {
				window.clearTimeout(timer)
				reject(err)
			},
		)
	})
}

async function fetchEnsureConetAaFromApi(eoa: string): Promise<string | null> {
	const ctrl = new AbortController()
	const abortTimer = typeof window !== 'undefined' ? window.setTimeout(() => ctrl.abort(), ENSURE_AA_TIMEOUT_MS) : undefined
	try {
		const res = await fetch(`${beamioApi}/api/ensureAAForEOA?eoa=${encodeURIComponent(eoa)}`, {
			signal: ctrl.signal,
		})
		if (!res.ok) return null
		const data = await res.json().catch(() => ({}))
		const aa = typeof data?.aa === 'string' ? data.aa.trim() : ''
		return aa && ethers.isAddress(aa) ? ethers.getAddress(aa) : null
	} catch {
		return null
	} finally {
		if (abortTimer !== undefined) window.clearTimeout(abortTimer)
	}
}

/** 在 CoNET 上检测 AA；无则经 API 创建。失败返回 null（保留上次 profile，不当作「无 AA」覆写）。 */
export async function ensureConetAaForEoa(eoa: string): Promise<string | null> {
	const norm = ethers.getAddress(eoa)
	const key = norm.toLowerCase()
	const inflight = conetEnsureInFlight.get(key)
	if (inflight) return inflight

	const task = (async (): Promise<string | null> => {
		const existing = await raceWithTimeout(
			resolveBeamioAaOnConet(conetDepinProvider, norm).catch(() => null),
			ENSURE_AA_TIMEOUT_MS,
			null,
		)
		if (existing) return existing

		const created = await fetchEnsureConetAaFromApi(norm)
		if (!created) return null

		const code = await raceWithTimeout(
			conetDepinProvider.getCode(created).catch(() => '0x'),
			ENSURE_AA_TIMEOUT_MS,
			'0x',
		)
		if (!code || code === '0x') return null
		return created
	})()

	conetEnsureInFlight.set(key, task)
	try {
		return await raceWithTimeout(task, ENSURE_AA_TIMEOUT_MS * 2, null)
	} finally {
		conetEnsureInFlight.delete(key)
	}
}

/** 确保 CoNET AA 并将 aaAccount 写入 profile + IndexedDB（仅可信成功时）。 */
export async function ensureConetAaForProfileAndPersist(
	profile: profile | null | undefined,
	setProfiles?: (next: profile[]) => void
): Promise<string | null> {
	const eoa = profile?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) return null

	const aa = await ensureConetAaForEoa(eoa)
	if (!aa || aa.toLowerCase() === eoa.toLowerCase()) return null

	const temp = CoNET_Data
	if (!temp?.profiles?.length) return aa

	const current = temp.profiles[0].aaAccount?.toLowerCase() ?? ''
	if (current === aa.toLowerCase()) return aa

	const nextProfiles = temp.profiles.map((p, i) =>
		i === 0 ? { ...p, aaAccount: aa } : p
	)
	temp.profiles = nextProfiles
	setCoNET_Data(temp)
	setProfiles?.(nextProfiles)
	await storeSystemData()
	return aa
}
