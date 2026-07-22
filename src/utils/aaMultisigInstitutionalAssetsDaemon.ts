/**
 * Institutional AA Multisig — daemon tick for per-item Smart Wallet asset balances.
 * Candidates = local institutional manageable list; trusted success only merges cache.
 * See: beamio-app-dashboard-daemon-local-first.mdc, beamio-trusted-vs-untrusted-fetch.mdc
 */
import { ethers } from 'ethers'
import { fetchAaMultisigTransferAssetOptions } from '@/utils/aaMultisigConetTransferAssets'
import { loadInstitutionalManageableWalletsLocal } from '@/utils/institutionalManageableWalletsLocalCache'
import {
	loadInstitutionalAaAssetsLocalCache,
	mergeTrustedInstitutionalAaAssetsLocal,
	type InstitutionalAaAssetsByAa,
} from '@/utils/aaMultisigInstitutionalAssetsLocalCache'

/** Background refresh interval (setTimeout chain in DaemonProvider). */
export const AA_MULTISIG_INSTITUTIONAL_ASSETS_FEED_INTERVAL_MS = 30_000

/** Cap AAs refreshed per tick to avoid RPC storms when many wallets. */
const MAX_AA_PER_TICK = 12

export type InstitutionalAaAssetsDaemonResult = {
	ok: true
	aaRefreshed: number
	byAa: InstitutionalAaAssetsByAa
}

export type InstitutionalAaAssetsDaemonFailure = {
	ok: false
	error: string
}

/**
 * Fetch transfer-asset options for institutional AAs the viewer manages.
 * Partial success: each AA that succeeds is merged; failures leave prior trusted rows.
 */
export async function runAaMultisigInstitutionalAssetsDaemonTick(
	viewerEoa: string,
	opts?: { aaAccounts?: string[] }
): Promise<InstitutionalAaAssetsDaemonResult | InstitutionalAaAssetsDaemonFailure> {
	if (!ethers.isAddress(viewerEoa)) {
		return { ok: false, error: 'Invalid viewer EOA' }
	}
	const viewer = ethers.getAddress(viewerEoa)
	const prev = loadInstitutionalAaAssetsLocalCache(viewer)

	const seen = new Set<string>()
	const candidates: string[] = []
	const push = (raw: string) => {
		if (!ethers.isAddress(raw)) return
		const a = ethers.getAddress(raw)
		const k = a.toLowerCase()
		if (seen.has(k)) return
		seen.add(k)
		candidates.push(a)
	}

	if (opts?.aaAccounts?.length) {
		for (const a of opts.aaAccounts) push(a)
	} else {
		for (const w of loadInstitutionalManageableWalletsLocal(viewer)) {
			push(w.aaAccount)
		}
	}

	if (candidates.length === 0) {
		return { ok: true, aaRefreshed: 0, byAa: prev }
	}

	const slice = candidates.slice(0, MAX_AA_PER_TICK)
	const patch: InstitutionalAaAssetsByAa = {}
	let aaRefreshed = 0

	for (const aa of slice) {
		const aaLower = aa.toLowerCase()
		try {
			const previousBase = (prev[aaLower] ?? []).filter((o) => o.chain === 'base')
			const options = await fetchAaMultisigTransferAssetOptions(aa, { previousBase })
			patch[aaLower] = options
			aaRefreshed += 1
		} catch {
			/* untrusted — keep prior for this AA */
		}
	}

	if (aaRefreshed === 0) {
		return { ok: false, error: 'No institutional AA balances refreshed' }
	}

	const byAa = mergeTrustedInstitutionalAaAssetsLocal(viewer, patch)
	return { ok: true, aaRefreshed, byAa }
}
