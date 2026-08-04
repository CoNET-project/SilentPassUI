/**
 * Native shell push: bind EOA → device token → POST /api/registerPushDevice.
 * iOS APNs (64-hex) + Android FCM (long token). Sync unread via /api/syncChatBadge.
 */

import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { getCashTreesNativeNfcHost, isCashTreesNativeWebView } from '@/utils/cashTreesNativeNfc'
import { CoNET_Data } from '@/utils/globals'

const IOS_BUNDLE_ID = 'com.beamio.beamio'
const ANDROID_BUNDLE_ID = 'com.beamio.app'

type PushPlatform = 'ios' | 'android'

type PushTokenDetail = {
	action?: string
	deviceToken?: string
	eoa?: string
	pgpKeyId?: string
	platform?: string
	bundleId?: string
}

let listenerAttached = false
let lastRegisteredToken = ''
let lastSyncedUnread = -1
let syncInFlight = false

function buildRegisterMessage(params: {
	eoa: string
	deviceToken: string
	platform: string
	bundleId: string
	timestamp: number
}): string {
	return [
		'Beamio registerPushDevice',
		`eoa:${params.eoa.toLowerCase()}`,
		`deviceToken:${params.deviceToken}`,
		`platform:${params.platform}`,
		`bundleId:${params.bundleId}`,
		`timestamp:${params.timestamp}`,
	].join('\n')
}

function buildSyncBadgeMessage(params: { eoa: string; unread: number; timestamp: number }): string {
	return [
		'Beamio syncChatBadge',
		`eoa:${params.eoa.toLowerCase()}`,
		`unread:${params.unread}`,
		`timestamp:${params.timestamp}`,
	].join('\n')
}

async function signMessage(message: string): Promise<{ eoa: string; signature: string } | null> {
	const pk = resolveSigningPrivateKeyArmor(CoNET_Data?.profiles?.[0])
	if (!pk) return null
	const wallet = new ethers.Wallet(pk)
	const signature = await wallet.signMessage(message)
	return { eoa: wallet.address, signature }
}

function normalizePlatform(raw: string | undefined, hostHint: ReturnType<typeof getCashTreesNativeNfcHost>): PushPlatform | null {
	const p = (raw || hostHint || '').toLowerCase()
	if (p === 'ios' || p === 'android') return p
	return null
}

/** APNs = 64 hex; FCM = longer opaque string (often contains `:`). */
function isValidDeviceToken(platform: PushPlatform, token: string): boolean {
	if (platform === 'ios') return /^[0-9a-f]{64}$/i.test(token)
	if (token.length < 80 || token.length > 4096) return false
	return /^[A-Za-z0-9_.:\-]+$/.test(token)
}

function defaultBundleId(platform: PushPlatform, fromNative?: string): string {
	const t = (fromNative || '').trim()
	if (t) return t
	return platform === 'android' ? ANDROID_BUNDLE_ID : IOS_BUNDLE_ID
}

async function registerDeviceToken(
	deviceToken: string,
	opts?: { pgpKeyId?: string; platform?: PushPlatform; bundleId?: string },
): Promise<boolean> {
	const host = getCashTreesNativeNfcHost()
	const platform = opts?.platform || (host === 'android' ? 'android' : host === 'ios' ? 'ios' : null)
	if (!platform) return false

	const token = platform === 'ios' ? deviceToken.trim().toLowerCase() : deviceToken.trim()
	if (!isValidDeviceToken(platform, token)) return false
	if (token === lastRegisteredToken) return true

	const bundleId = defaultBundleId(platform, opts?.bundleId)
	const timestamp = Math.floor(Date.now() / 1000)
	const profileEoa = CoNET_Data?.profiles?.[0]?.keyID
	if (!profileEoa || !ethers.isAddress(profileEoa)) return false

	const message = buildRegisterMessage({
		eoa: ethers.getAddress(profileEoa),
		deviceToken: token,
		platform,
		bundleId,
		timestamp,
	})
	const signed = await signMessage(message)
	if (!signed) return false

	try {
		const res = await fetch(`${beamioApi}/api/registerPushDevice`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				eoa: signed.eoa,
				deviceToken: token,
				platform,
				bundleId,
				pgpKeyId: opts?.pgpKeyId || undefined,
				timestamp,
				signature: signed.signature,
			}),
		})
		if (!res.ok) return false
		const json = (await res.json().catch(() => null)) as { success?: boolean } | null
		if (json?.success) {
			lastRegisteredToken = token
			return true
		}
		return false
	} catch {
		return false
	}
}

function onNativePushEvent(ev: Event): void {
	const detail = (ev as CustomEvent<PushTokenDetail>).detail
	if (!detail || detail.action !== 'pushDeviceToken') return
	const token = String(detail.deviceToken || '').trim()
	if (!token) return
	const platform = normalizePlatform(detail.platform, getCashTreesNativeNfcHost())
	if (!platform) return
	void registerDeviceToken(token, {
		pgpKeyId: detail.pgpKeyId,
		platform,
		bundleId: detail.bundleId,
	})
}

/** Attach once; listens for both iOS and Android CustomEvents. */
export function ensurePushDeviceTokenListener(): void {
	if (typeof window === 'undefined' || listenerAttached) return
	listenerAttached = true
	window.addEventListener('cashtreesios', onNativePushEvent as EventListener)
	window.addEventListener('cashtreesandroid', onNativePushEvent as EventListener)
}

/**
 * After wallet unlock / initChat: ask native to bind EOA and register for push.
 */
export function bindNativePushIdentity(opts?: { eoa?: string; pgpKeyId?: string }): boolean {
	if (typeof window === 'undefined') return false
	if (!isCashTreesNativeWebView()) return false
	ensurePushDeviceTokenListener()

	const eoa = (opts?.eoa || CoNET_Data?.profiles?.[0]?.keyID || '').trim()
	if (!eoa || !ethers.isAddress(eoa)) return false

	const pgpKeyId = (opts?.pgpKeyId || '').trim()
	const host = getCashTreesNativeNfcHost()

	if (host === 'ios') {
		const ios = window.CashTreesIOS as
			| { bindPushIdentity?: (p: { eoa: string; pgpKeyId?: string }) => void }
			| undefined
		if (typeof ios?.bindPushIdentity !== 'function') return false
		try {
			ios.bindPushIdentity({ eoa, pgpKeyId: pgpKeyId || undefined })
			return true
		} catch {
			return false
		}
	}

	if (host === 'android') {
		const android = window.CashTreesAndroid as
			| { bindPushIdentity?: (json: string) => void }
			| undefined
		if (typeof android?.bindPushIdentity !== 'function') return false
		try {
			android.bindPushIdentity(
				JSON.stringify({ eoa, pgpKeyId: pgpKeyId || undefined }),
			)
			return true
		} catch {
			return false
		}
	}

	return false
}

/**
 * Bind push from the current (or given) profile.
 * Safe to call from LoadingPage onboard **and** AppShell even when gossip already started —
 * AppShell used to skip the whole init (including push) when gossip was active after onboard.
 */
export function ensureNativePushBoundForWallet(profile?: {
	keyID?: string
	chatManager?: { pgpKey?: { keyID?: string } }
} | null): boolean {
	const p = profile || CoNET_Data?.profiles?.[0]
	const eoa = (p?.keyID || '').trim()
	if (!eoa || !ethers.isAddress(eoa)) return false
	const chatPgp = p?.chatManager?.pgpKey?.keyID
	return bindNativePushIdentity({
		eoa,
		pgpKeyId: chatPgp ? String(chatPgp) : undefined,
	})
}

/**
 * Persist unread on API for offline SI notify increments.
 * Does **not** trigger iOS/Android alert banners (API syncChatBadge is DB-only).
 * Live icon badge: `syncNativeFooterChatBadge` → native bridge.
 */
export async function syncChatBadgeToApi(unreadRaw: number): Promise<void> {
	if (typeof window === 'undefined') return
	if (!isCashTreesNativeWebView()) return
	const unread = Math.max(0, Math.min(999, Math.floor(Number(unreadRaw) || 0)))
	if (unread === lastSyncedUnread) return
	if (syncInFlight) return
	const profileEoa = CoNET_Data?.profiles?.[0]?.keyID
	if (!profileEoa || !ethers.isAddress(profileEoa)) return

	syncInFlight = true
	try {
		const timestamp = Math.floor(Date.now() / 1000)
		const message = buildSyncBadgeMessage({
			eoa: ethers.getAddress(profileEoa),
			unread,
			timestamp,
		})
		const signed = await signMessage(message)
		if (!signed) return
		const res = await fetch(`${beamioApi}/api/syncChatBadge`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				eoa: signed.eoa,
				unread,
				timestamp,
				signature: signed.signature,
			}),
		})
		if (res.ok) lastSyncedUnread = unread
	} catch {
		/* keep lastSyncedUnread so we retry next tick */
	} finally {
		syncInFlight = false
	}
}
