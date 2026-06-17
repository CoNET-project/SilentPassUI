import {
	checkStorage,
	ensureProfilePrivateKeyArmorFromMnemonic,
	provisionTempCouponClaimWallet,
} from '@/services/beamio'
import {
	hasCompletedBeamioAccount,
	hasLocalPlaintextMnemonic,
} from '@/utils/consumerWalletGate'
import { isCouponOpenClaimDeepLink } from '@/utils/beamioDeepLinkParams'
import { dispatchBeamioWalletReady } from '@/utils/beamioWalletReadyEvent'
import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'

let ensureInFlight: Promise<encrypt_keys_object | null> | null = null

export function isCouponClaimEphemeralWalletContext(): boolean {
	if (typeof window === 'undefined') return false
	return isCouponOpenClaimDeepLink(window.location.href)
}

/**
 * Coupon open-claim URL: ensure a signable local wallet exists (reuse or auto temp account).
 */
export async function ensureEphemeralWalletForCouponClaim(): Promise<encrypt_keys_object | null> {
	if (!isCouponClaimEphemeralWalletContext()) return null

	if (ensureInFlight) return ensureInFlight

	ensureInFlight = (async () => {
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

		publishNativePwaLog('info', '[CouponClaim] provisioning temp wallet + temp tag')
		const provisioned = await provisionTempCouponClaimWallet()
		if (provisioned) {
			dispatchBeamioWalletReady('coupon-claim-ephemeral-wallet')
		}
		return provisioned
	})()

	try {
		return await ensureInFlight
	} finally {
		ensureInFlight = null
	}
}
