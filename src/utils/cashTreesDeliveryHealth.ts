/**
 * Android shell push delivery check (`BeamioDeliveryHealth.kt`).
 *
 * A force stop, Samsung "Deep sleeping apps" or Android's "Restricted" battery
 * mode makes the system drop the FCM wake-up before Beamio runs: no message
 * notification and no incoming call until the app is opened again. The shell
 * checks on every resume and sends `cashtreesandroid { action: 'deliveryHealth' }`;
 * the chat list shows a banner only when something needs the user.
 */

export type DeliveryHealth = {
	backgroundRestricted: boolean
	forceStopped: boolean
	vendor: string
	needsAttention: boolean
}

type AndroidBridge = Record<string, unknown>

function androidBridge(): AndroidBridge | null {
	if (typeof window === 'undefined') return null
	const a = (window as unknown as { CashTreesAndroid?: unknown }).CashTreesAndroid
	return a && typeof a === 'object' ? (a as AndroidBridge) : null
}

/** Keep the injected object as `this` (see callAndroidBridge in cashTreesNativeNfc). */
function callBridge(method: string): boolean {
	const a = androidBridge()
	const fn = a?.[method]
	if (!a || typeof fn !== 'function') return false
	try {
		Reflect.apply(fn as () => unknown, a, [])
		return true
	} catch {
		return false
	}
}

export function parseDeliveryHealth(detail: unknown): DeliveryHealth | null {
	if (!detail || typeof detail !== 'object') return null
	const d = detail as Record<string, unknown>
	if (d.action !== 'deliveryHealth') return null
	const backgroundRestricted = d.backgroundRestricted === true
	const forceStopped = d.forceStopped === true
	return {
		backgroundRestricted,
		forceStopped,
		vendor: typeof d.vendor === 'string' ? d.vendor.toLowerCase() : '',
		needsAttention: backgroundRestricted || forceStopped,
	}
}

export const requestDeliveryHealth = (): boolean => callBridge('requestDeliveryHealth')
export const openDeliverySettings = (): boolean => callBridge('openDeliverySettings')
export const dismissDeliveryHealthNotice = (): boolean => callBridge('dismissDeliveryHealthNotice')

/** Where to turn the restriction off, per maker. Short, in our own words. */
export function deliveryFixHint(vendor: string): string {
	switch (vendor) {
		case 'samsung':
			return 'Tap Fix, then Add apps and choose Beamio.'
		case 'xiaomi':
		case 'redmi':
		case 'poco':
			return 'In Settings > Apps > Beamio, turn on Autostart and set Battery saver to No restrictions.'
		case 'huawei':
		case 'honor':
			return 'In Settings > Battery > App launch, set Beamio to Manage manually and allow all.'
		case 'oppo':
		case 'realme':
		case 'oneplus':
			return 'In Settings > Apps > Beamio > Battery, allow background activity and auto launch.'
		case 'vivo':
		case 'iqoo':
			return 'In Settings > Battery, allow high background power use for Beamio, and turn on Autostart.'
		default:
			return 'Tap Fix and set Beamio’s battery use to Unrestricted.'
	}
}
