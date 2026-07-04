import { beamioApi } from '@/utils/constants'
import type { AaMultisigInner, AaMultisigSignInner } from '@/utils/aaMultisigProtocol'

export type AaMultisigOfflineSubmitApiResult =
	| { ok: true; consumeTxHash?: string; alreadySubmitted?: boolean }
	| { ok: false; error: string }

/** Paid offline sign submit (0.1 B-Unit). Reject/propose still use gossip/import only. */
export async function postAaMultisigOfflineSignSubmit(
	inner: AaMultisigSignInner,
	submitterEoa: string
): Promise<AaMultisigOfflineSubmitApiResult> {
	try {
		const res = await fetch(`${beamioApi}/api/aaMultisigOfflineSubmit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ inner, submitterEoa }),
		})
		const data = (await res.json().catch(() => ({}))) as {
			success?: boolean
			error?: string
			consumeTxHash?: string
			alreadySubmitted?: boolean
		}
		if (!res.ok || !data.success) {
			return { ok: false, error: String(data.error ?? `HTTP ${res.status}`) }
		}
		return {
			ok: true,
			consumeTxHash: data.consumeTxHash,
			alreadySubmitted: data.alreadySubmitted === true,
		}
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { ok: false, error: err?.message ?? String(e) }
	}
}

export function isPaidOfflineSignInner(inner: AaMultisigInner): inner is AaMultisigSignInner {
	return inner.action === 'sign'
}
