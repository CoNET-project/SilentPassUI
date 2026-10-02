import {
	checkStorage,
	ensureProfilePrivateKeyArmorFromMnemonic,
} from '@/services/beamio'
import {
	hasCompletedBeamioAccount,
	hasLocalPlaintextMnemonic,
} from '@/utils/consumerWalletGate'
import { isCouponOpenClaimDeepLink } from '@/utils/beamioDeepLinkParams'
import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'

export function isCouponClaimEphemeralWalletContext(): boolean {
	if (typeof window === 'undefined') return false
	return isCouponOpenClaimDeepLink(window.location.href)
}

/**
 * Coupon open-claim URL: reuse an already-complete local wallet only.
 * No temp account is ever created automatically; a visitor without a local
 * private key goes through the normal onboarding (own @beamioTag + password).
 */
export async function ensureEphemeralWalletForCouponClaim(): Promise<encrypt_keys_object | null> {
	if (!isCouponClaimEphemeralWalletContext()) return null

	const stored = await checkStorage()
	const hydrated = ensureProfilePrivateKeyArmorFromMnemonic(stored) ?? stored
	if (
		hydrated &&
		hasLocalPlaintextMnemonic(hydrated) &&
		hasCompletedBeamioAccount(hydrated)
	) {
		publishNativePwaLog('info', '[CouponClaim] reuse existing local wallet')
		return hydrated
	}
	publishNativePwaLog('info', '[CouponClaim] no local wallet → normal onboarding')
	return null
}
