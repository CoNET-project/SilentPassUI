import { beamioApi } from '@/utils/constants'

export type UsdcChargeSessionState =
	| 'unknown'
	| 'verifying'
	| 'settling'
	| 'awaiting_topup_auth'
	| 'awaiting_beneficiary'
	| 'topup_pending'
	| 'topup_confirmed'
	| 'charge_pending'
	| 'success'
	| 'error'

export interface UsdcChargeSessionResult {
	ok: boolean
	sid: string
	state: UsdcChargeSessionState
	error?: string
	topupTxHash?: string
	chargeTxHash?: string
	total?: string
	pendingTopupCardAddr?: string
	pendingTopupData?: string
	pendingTopupDeadline?: number
	pendingTopupNonce?: string
	pendingTopupVerifyingContract?: string
}

export async function fetchUsdcChargeSession(sid: string): Promise<UsdcChargeSessionResult | null> {
	const sidTrim = sid.trim().toLowerCase()
	if (!sidTrim || sidTrim.length !== 36) return null
	try {
		const params = new URLSearchParams({ sid: sidTrim })
		const res = await fetch(`${beamioApi}/api/nfcUsdcChargeSession?${params}`)
		const json = (await res.json()) as Record<string, unknown>
		if (!res.ok) {
			return {
				ok: false,
				sid: sidTrim,
				state: 'unknown',
				error: String(json.error ?? `HTTP ${res.status}`),
			}
		}
		const stateRaw = String(json.state ?? 'unknown')
		return {
			ok: Boolean(json.ok ?? true),
			sid: String(json.sid ?? sidTrim),
			state: stateRaw as UsdcChargeSessionState,
			error: json.error ? String(json.error) : undefined,
			topupTxHash: json.topupTxHash ? String(json.topupTxHash) : undefined,
			chargeTxHash: json.chargeTxHash ? String(json.chargeTxHash) : undefined,
			total: json.total ? String(json.total) : undefined,
			pendingTopupCardAddr: json.pendingTopupCardAddr
				? String(json.pendingTopupCardAddr)
				: undefined,
			pendingTopupData: json.pendingTopupData ? String(json.pendingTopupData) : undefined,
			pendingTopupDeadline:
				typeof json.pendingTopupDeadline === 'number'
					? json.pendingTopupDeadline
					: Number(json.pendingTopupDeadline) || undefined,
			pendingTopupNonce: json.pendingTopupNonce ? String(json.pendingTopupNonce) : undefined,
			pendingTopupVerifyingContract: json.pendingTopupVerifyingContract
				? String(json.pendingTopupVerifyingContract)
				: undefined,
		}
	} catch {
		return null
	}
}

export async function submitUsdcChargeTopupAuth(
	sid: string,
	signature: string,
): Promise<{ ok: boolean; errorMessage?: string } | null> {
	const sidTrim = sid.trim().toLowerCase()
	const sigTrim = signature.trim()
	if (!sidTrim || sigTrim.length < 130) return null
	try {
		const res = await fetch(`${beamioApi}/api/nfcUsdcChargeTopupAuth`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sid: sidTrim, signature: sigTrim }),
		})
		const json = (await res.json()) as Record<string, unknown>
		return {
			ok: Boolean(json.ok),
			errorMessage: json.error ? String(json.error) : undefined,
		}
	} catch {
		return null
	}
}
