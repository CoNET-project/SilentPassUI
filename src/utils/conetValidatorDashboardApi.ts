/**
 * Cluster JSON for Blockscout `/validator/:pubkey` pages.
 *
 * HTML: https://mainnet.conet.network/validator/{pubkey}
 * API:  https://beamio.app/api/v2/conet/validators/{pubkey}
 *
 * Blockscout native `https://mainnet.conet.network/api/v2/...` does **not** expose this
 * (`Unknown API v2 action`). CL skim (`clRewardPaidWei`) is the server-side aggregate of
 * `NodeRewardSettled` — never recover it with genesis `eth_getLogs`.
 */

const BEAMIO_API_BASE = 'https://beamio.app'
const PUBKEY_RE = /^0x[0-9a-f]{96}$/
const FETCH_TIMEOUT_MS = 12_000
const MEMORY_TTL_MS = 30_000
const FETCH_CONCURRENCY = 4

export type ConetValidatorDashboardClPaid = {
	pubkey: string
	guardianId: number
	clRewardPaidWei: bigint
}

type CacheEntry = {
	value: ConetValidatorDashboardClPaid
	fetchedAt: number
}

const memory = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<ConetValidatorDashboardClPaid | null>>()

export function normalizeConetValidatorPubkey(raw: unknown): string | null {
	if (typeof raw !== 'string') return null
	const s = raw.trim().toLowerCase()
	if (!s || s === '0x') return null
	const withPrefix = s.startsWith('0x') ? s : `0x${s}`
	return PUBKEY_RE.test(withPrefix) ? withPrefix : null
}

function parseWei(raw: unknown): bigint | null {
	const s = String(raw ?? '').trim()
	if (!s) return null
	try {
		if (s.includes('.')) return ethersParseUnitsSafe(s)
		const n = BigInt(s)
		return n >= 0n ? n : null
	} catch {
		return null
	}
}

function ethersParseUnitsSafe(s: string): bigint | null {
	try {
		const [whole, frac = ''] = s.split('.')
		const fracPad = (frac + '000000000000000000').slice(0, 18)
		return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPad || '0')
	} catch {
		return null
	}
}

function parseGuardianId(raw: unknown): number | null {
	const n = Number(String(raw ?? ''))
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.floor(n)
}

export async function fetchConetValidatorDashboardClPaid(
	pubkeyRaw: string,
): Promise<ConetValidatorDashboardClPaid | null> {
	const pubkey = normalizeConetValidatorPubkey(pubkeyRaw)
	if (!pubkey) return null

	const cached = memory.get(pubkey)
	if (cached && Date.now() - cached.fetchedAt < MEMORY_TTL_MS) {
		return cached.value
	}

	const existing = inFlight.get(pubkey)
	if (existing) return existing

	const task = (async (): Promise<ConetValidatorDashboardClPaid | null> => {
		try {
			const res = await fetch(`${BEAMIO_API_BASE}/api/v2/conet/validators/${pubkey}`, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			})
			if (!res.ok) return null
			const payload = (await res.json()) as {
				success?: boolean
				pubkey?: string
				chain?: {
					guardianId?: string
					clRewardPaidWei?: string
				}
				income?: {
					nodes?: Array<{ guardianId?: number; cnet?: { cumulative?: string } }>
				}
			}
			if (!payload.success) return null
			const guardianId = parseGuardianId(payload.chain?.guardianId)
			let clRewardPaidWei = parseWei(payload.chain?.clRewardPaidWei)
			if (clRewardPaidWei === null && guardianId !== null) {
				const row = (payload.income?.nodes ?? []).find((n) => Number(n.guardianId) === guardianId)
				clRewardPaidWei = parseWei(row?.cnet?.cumulative)
			}
			if (guardianId === null || clRewardPaidWei === null) return null
			const value: ConetValidatorDashboardClPaid = { pubkey, guardianId, clRewardPaidWei }
			memory.set(pubkey, { value, fetchedAt: Date.now() })
			return value
		} catch {
			return null
		} finally {
			inFlight.delete(pubkey)
		}
	})()

	inFlight.set(pubkey, task)
	return task
}

export async function fetchClRewardPaidByValidatorPubkeys(
	nodes: ReadonlyArray<{ guardianId?: number; validatorPubkey?: string }>,
): Promise<Map<number, bigint> | null> {
	const targets: string[] = []
	const seen = new Set<string>()
	for (const n of nodes) {
		const pubkey = normalizeConetValidatorPubkey(n.validatorPubkey)
		if (!pubkey || seen.has(pubkey)) continue
		seen.add(pubkey)
		targets.push(pubkey)
	}
	if (targets.length === 0) return null

	const out = new Map<number, bigint>()
	let trusted = 0
	for (let i = 0; i < targets.length; i += FETCH_CONCURRENCY) {
		const batch = targets.slice(i, i + FETCH_CONCURRENCY)
		const rows = await Promise.all(batch.map((pubkey) => fetchConetValidatorDashboardClPaid(pubkey)))
		for (let j = 0; j < rows.length; j++) {
			const row = rows[j]
			if (!row) continue
			trusted += 1
			const gid = row.guardianId
			out.set(gid, (out.get(gid) ?? 0n) + row.clRewardPaidWei)
		}
	}
	return trusted > 0 ? out : null
}
