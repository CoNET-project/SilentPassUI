/**
 * Native shell push: bind EOA → device token → POST /api/registerPushDevice.
 * iOS APNs (64-hex) + Android FCM (long token). Sync unread via /api/syncChatBadge.
 */

import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	getCashTreesNativeNfcHost,
	isCashTreesNativeWebView,
	setNativeChatPgpSecrets,
} from '@/utils/cashTreesNativeNfc'
import { CoNET_Data } from '@/utils/globals'
import { postWorkerOwnMailboxCommand } from '@/services/chatWorkerBridge'

const IOS_BUNDLE_ID = 'com.beamio.beamio'
const ANDROID_BUNDLE_ID = 'com.beamio.app'

type PushPlatform = 'ios' | 'ios_voip' | 'android'

type PushTokenDetail = {
	action?: string
	deviceToken?: string
	eoa?: string
	pgpKeyId?: string
	platform?: string
	bundleId?: string
	fullScreenIntent?: boolean
	callKit?: boolean
	ok?: boolean
	ios?: string
	ios_voip?: string
}

let listenerAttached = false
/** Per-platform last token — ios and ios_voip are different APNs tokens and must both register. */
const lastRegisteredTokenByPlatform: Partial<Record<PushPlatform, string>> = {}
/** EOA that last successfully HTTP-registered each platform token (same token ≠ same wallet). */
const lastRegisteredEoaByPlatform: Partial<Record<PushPlatform, string>> = {}
/** Last non-empty hex seen from native (survives empty invalidate events). */
const lastSeenTokensByPlatform: Partial<Record<PushPlatform, string>> = {}
/** Tokens that arrived before wallet unlock / HTTP failed — retry after bind. */
const pendingTokensByPlatform: Partial<
	Record<
		PushPlatform,
		{
			token: string
			pgpKeyId?: string
			bundleId?: string
			fullScreenIntent?: boolean
			callKit?: boolean
		}
	>
> = {}
let pendingFlushTimer: ReturnType<typeof setTimeout> | undefined
let lastSyncedUnread = -1
let syncInFlight = false
const PENDING_PUSH_SS_KEY = 'beamio:pendingPushTokens:v1'
let visibilityFlushAttached = false

function persistPendingTokensToSession(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		const payload: Record<string, unknown> = {}
		for (const platform of Object.keys(pendingTokensByPlatform) as PushPlatform[]) {
			const p = pendingTokensByPlatform[platform]
			if (p) payload[platform] = p
		}
		for (const platform of Object.keys(lastSeenTokensByPlatform) as PushPlatform[]) {
			const seen = lastSeenTokensByPlatform[platform]
			if (!seen) continue
			if (!payload[platform]) {
				payload[platform] = {
					token: seen,
					callKit: platform === 'ios_voip' ? true : undefined,
				}
			}
		}
		if (Object.keys(payload).length === 0) {
			sessionStorage.removeItem(PENDING_PUSH_SS_KEY)
		} else {
			sessionStorage.setItem(PENDING_PUSH_SS_KEY, JSON.stringify(payload))
		}
	} catch {
		/* ignore quota */
	}
}

function currentProfileEoaLower(): string | null {
	const profileEoa = CoNET_Data?.profiles?.[0]?.keyID
	if (!profileEoa || !ethers.isAddress(profileEoa)) return null
	return ethers.getAddress(profileEoa).toLowerCase()
}

/** True only when this device token was already HTTP-registered for the current wallet. */
function isTokenRegisteredForCurrentWallet(platform: PushPlatform, token: string): boolean {
	if (lastRegisteredTokenByPlatform[platform] !== token) return false
	const lastEoa = lastRegisteredEoaByPlatform[platform]
	const profileEoa = currentProfileEoaLower()
	if (!lastEoa || !profileEoa) return false
	return lastEoa === profileEoa
}

function hydratePendingTokensFromSession(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		const raw = sessionStorage.getItem(PENDING_PUSH_SS_KEY)
		if (!raw) return
		const parsed = JSON.parse(raw) as Record<
			string,
			{
				token?: string
				pgpKeyId?: string
				bundleId?: string
				fullScreenIntent?: boolean
				callKit?: boolean
			}
		>
		for (const key of Object.keys(parsed)) {
			const platform = normalizePlatform(key, null)
			if (!platform) continue
			const row = parsed[key]
			const token = String(row?.token || '').trim()
			if (!token || !isValidDeviceToken(platform, token)) continue
			lastSeenTokensByPlatform[platform] = token
			if (!pendingTokensByPlatform[platform] && !isTokenRegisteredForCurrentWallet(platform, token)) {
				rememberPendingToken(platform, token, {
					pgpKeyId: row?.pgpKeyId,
					bundleId: row?.bundleId,
					fullScreenIntent: row?.fullScreenIntent,
					callKit: platform === 'ios_voip' ? true : row?.callKit,
				})
			}
		}
	} catch {
		/* ignore corrupt */
	}
}

function buildRegisterMessage(params: {
	eoa: string
	deviceToken: string
	platform: string
	bundleId: string
	timestamp: number
	capabilities: {
		nativeCallUi: boolean
		fullScreenIntent: boolean
		callKit: boolean
	}
}): string {
	return [
		'Beamio registerPushDevice',
		`eoa:${params.eoa.toLowerCase()}`,
		`deviceToken:${params.deviceToken}`,
		`platform:${params.platform}`,
		`bundleId:${params.bundleId}`,
		`capabilities:${JSON.stringify(params.capabilities)}`,
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
	if (p === 'ios' || p === 'ios_voip' || p === 'android') return p
	return null
}

/** APNs = 64 hex; FCM = longer opaque string (often contains `:`). */
function isValidDeviceToken(platform: PushPlatform, token: string): boolean {
	if (platform === 'ios' || platform === 'ios_voip') return /^[0-9a-f]{64}$/i.test(token)
	if (token.length < 80 || token.length > 4096) return false
	return /^[A-Za-z0-9_.:\-]+$/.test(token)
}

function defaultBundleId(platform: PushPlatform, fromNative?: string): string {
	const t = (fromNative || '').trim()
	if (t) return t
	return platform === 'android' ? ANDROID_BUNDLE_ID : IOS_BUNDLE_ID
}

function rememberPendingToken(
	platform: PushPlatform,
	token: string,
	opts?: {
		pgpKeyId?: string
		bundleId?: string
		fullScreenIntent?: boolean
		callKit?: boolean
	},
): void {
	pendingTokensByPlatform[platform] = {
		token,
		pgpKeyId: opts?.pgpKeyId,
		bundleId: opts?.bundleId,
		fullScreenIntent: opts?.fullScreenIntent,
		callKit: opts?.callKit,
	}
	lastSeenTokensByPlatform[platform] = token
	persistPendingTokensToSession()
}

async function flushPendingPushTokens(): Promise<void> {
	const platforms = Object.keys(pendingTokensByPlatform) as PushPlatform[]
	for (const platform of platforms) {
		const pending = pendingTokensByPlatform[platform]
		if (!pending) continue
		const ok = await registerDeviceToken(pending.token, {
			platform,
			pgpKeyId: pending.pgpKeyId,
			bundleId: pending.bundleId,
			fullScreenIntent: pending.fullScreenIntent,
			callKit: pending.callKit,
		})
		if (ok) delete pendingTokensByPlatform[platform]
	}
	persistPendingTokensToSession()
}

function schedulePendingPushFlush(): void {
	if (typeof window === 'undefined') return
	if (pendingFlushTimer !== undefined) clearTimeout(pendingFlushTimer)
	hydratePendingTokensFromSession()
	// Unlock / EIP-191 may lag far behind PushKit; ramp then forever 60s (no setInterval).
	const delays = [0, 1500, 4000, 8000, 15000, 30000, 60000]
	let i = 0
	const tick = () => {
		pendingFlushTimer = undefined
		// Re-seed pending from lastSeen if empty-token wipe cleared the map.
		for (const platform of Object.keys(lastSeenTokensByPlatform) as PushPlatform[]) {
			const seen = lastSeenTokensByPlatform[platform]
			if (!seen) continue
			if (pendingTokensByPlatform[platform]) continue
			if (isTokenRegisteredForCurrentWallet(platform, seen)) continue
			rememberPendingToken(platform, seen, {
				callKit: platform === 'ios_voip' ? true : undefined,
			})
		}
		void flushPendingPushTokens().finally(() => {
			const stillPending = Object.keys(pendingTokensByPlatform).length > 0
			const unregisteredSeen = (Object.keys(lastSeenTokensByPlatform) as PushPlatform[]).some(
				(p) => {
					const seen = lastSeenTokensByPlatform[p]
					return !!seen && !isTokenRegisteredForCurrentWallet(p, seen)
				},
			)
			if (!stillPending && !unregisteredSeen) {
				persistPendingTokensToSession()
				return
			}
			i += 1
			const wait =
				i < delays.length
					? delays[i]! - (delays[i - 1] ?? 0)
					: 60_000
			pendingFlushTimer = setTimeout(tick, wait)
		})
	}
	pendingFlushTimer = setTimeout(tick, delays[0]!)
}

function ingestNativePushSnapshot(): void {
	if (typeof window === 'undefined') return
	const snap = (
		window as unknown as {
			__beamioNativePushSnapshot?: { ios?: string; ios_voip?: string }
		}
	).__beamioNativePushSnapshot
	if (!snap) return
	const voip = String(snap.ios_voip || '')
		.trim()
		.toLowerCase()
	const alert = String(snap.ios || '')
		.trim()
		.toLowerCase()
	if (voip && isValidDeviceToken('ios_voip', voip)) {
		lastSeenTokensByPlatform.ios_voip = voip
		if (!isTokenRegisteredForCurrentWallet('ios_voip', voip)) {
			rememberPendingToken('ios_voip', voip, { callKit: true })
		}
	}
	if (alert && isValidDeviceToken('ios', alert)) {
		lastSeenTokensByPlatform.ios = alert
		if (!isTokenRegisteredForCurrentWallet('ios', alert)) {
			rememberPendingToken('ios', alert)
		}
	}
	schedulePendingPushFlush()
}

/** Native delayed kick after bind / webContentReady (wallet unlock may be late). */
function exposeNativePushFlushHook(): void {
	if (typeof window === 'undefined') return
	const w = window as unknown as {
		__beamioFlushPushRegister?: () => void
		__beamioIngestNativePushSnapshot?: () => void
	}
	w.__beamioFlushPushRegister = () => {
		hydratePendingTokensFromSession()
		ingestNativePushSnapshot()
		schedulePendingPushFlush()
	}
	w.__beamioIngestNativePushSnapshot = () => {
		ingestNativePushSnapshot()
	}
}

function attachVisibilityPushFlush(): void {
	if (typeof document === 'undefined' || visibilityFlushAttached) return
	visibilityFlushAttached = true
	const kick = () => {
		if (document.visibilityState === 'hidden') return
		hydratePendingTokensFromSession()
		ingestNativePushSnapshot()
		schedulePendingPushFlush()
	}
	document.addEventListener('visibilitychange', kick)
	window.addEventListener('focus', kick)
}

async function registerDeviceToken(
	deviceToken: string,
	opts?: {
		pgpKeyId?: string
		platform?: PushPlatform
		bundleId?: string
		fullScreenIntent?: boolean
		callKit?: boolean
	},
): Promise<boolean> {
	const host = getCashTreesNativeNfcHost()
	const platform = opts?.platform || (host === 'android' ? 'android' : host === 'ios' ? 'ios' : null)
	if (!platform) return false

	const token = platform === 'ios' || platform === 'ios_voip'
		? deviceToken.trim().toLowerCase()
		: deviceToken.trim()
	if (!isValidDeviceToken(platform, token)) return false
	// Same device token bound to a different EOA must re-POST (wallet switch / unlock).
	if (isTokenRegisteredForCurrentWallet(platform, token)) {
		delete pendingTokensByPlatform[platform]
		return true
	}

	const bundleId = defaultBundleId(platform, opts?.bundleId)
	// PushKit voip token always implies CallKit Incoming; native may omit the flag.
	const callKit = platform === 'ios_voip' ? true : opts?.callKit === true
	const capabilities = {
		nativeCallUi: true,
		fullScreenIntent: opts?.fullScreenIntent === true,
		callKit,
	}
	const timestamp = Math.floor(Date.now() / 1000)
	const profileEoa = CoNET_Data?.profiles?.[0]?.keyID
	if (!profileEoa || !ethers.isAddress(profileEoa)) {
		rememberPendingToken(platform, token, { ...opts, callKit })
		return false
	}

	// Sign with the unlocked wallet address (must match EIP-191 recover on API).
	// Using profile.keyID in the message while body.eoa is wallet.address causes 403
	// when they diverge — CallKit wake never gets ios_voip in DB.
	const pk = resolveSigningPrivateKeyArmor(CoNET_Data?.profiles?.[0])
	if (!pk) {
		rememberPendingToken(platform, token, {
			pgpKeyId: opts?.pgpKeyId,
			bundleId,
			fullScreenIntent: opts?.fullScreenIntent,
			callKit,
		})
		console.warn('[push] register deferred — no signing key yet', platform)
		return false
	}
	const signerEoa = ethers.getAddress(new ethers.Wallet(pk).address)
	if (ethers.getAddress(profileEoa) !== signerEoa) {
		console.warn(
			'[push] profile keyID !== signing wallet — registering under signer',
			profileEoa,
			signerEoa,
		)
	}

	const message = buildRegisterMessage({
		eoa: signerEoa,
		deviceToken: token,
		platform,
		bundleId,
		timestamp,
		capabilities,
	})
	const signed = await signMessage(message)
	if (!signed) {
		rememberPendingToken(platform, token, {
			pgpKeyId: opts?.pgpKeyId,
			bundleId,
			fullScreenIntent: opts?.fullScreenIntent,
			callKit,
		})
		console.warn('[push] register deferred — signMessage failed', platform)
		return false
	}

	const httpBody = {
		eoa: signed.eoa,
		deviceToken: token,
		platform,
		bundleId,
		pgpKeyId: opts?.pgpKeyId || undefined,
		timestamp,
		signature: signed.signature,
		capabilities,
	}

	// CallKit force-quit wake needs beamio_push_devices NOW. Mailbox postToEntries
	// can stall ~12s×N before HTTP — do HTTP first (native URLSession preferred).
	let httpOk = await postRegisterPushDeviceHttp(httpBody)
	if (!httpOk) {
		try {
			const res = await fetch(`${beamioApi}/api/registerPushDevice`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(httpBody),
			})
			if (res.ok) {
				const json = (await res.json().catch(() => null)) as { success?: boolean } | null
				httpOk = json?.success === true
			} else {
				console.warn('[push] registerPushDevice HTTP', res.status, platform)
			}
		} catch (e) {
			console.warn('[push] registerPushDevice fetch failed', e)
		}
	}

	if (httpOk) {
		lastRegisteredTokenByPlatform[platform] = token
		lastRegisteredEoaByPlatform[platform] = signed.eoa.toLowerCase()
		delete pendingTokensByPlatform[platform]
		console.info('[push] registerPushDevice ok', platform, bundleId, 'http', signed.eoa)
		// Best-effort mailbox mirror — never block CallKit registration on gossip.
		const command = {
			command: 'push_device_register',
			walletAddress: signed.eoa,
			deviceToken: token,
			platform,
			bundleId,
			pgpKeyId: opts?.pgpKeyId || undefined,
			timestamp,
			registrationSignature: signed.signature,
			capabilities,
		}
		void postWorkerOwnMailboxCommand(command).catch(() => {})
		return true
	}

	rememberPendingToken(platform, token, {
		pgpKeyId: opts?.pgpKeyId,
		bundleId,
		fullScreenIntent: opts?.fullScreenIntent,
		callKit,
	})
	console.warn('[push] registerPushDevice HTTP failed — will retry', platform)
	return false
}

/**
 * iOS WKWebView custom-scheme fetch to beamio.app can fail silently.
 * Native URLSession posts the already-signed body (PWA still owns EIP-191).
 */
async function postRegisterPushDeviceHttp(body: {
	eoa: string
	deviceToken: string
	platform: string
	bundleId: string
	pgpKeyId?: string
	timestamp: number
	signature: string
	capabilities: {
		nativeCallUi: boolean
		fullScreenIntent: boolean
		callKit: boolean
	}
}): Promise<boolean> {
	if (typeof window === 'undefined') return false
	const host = getCashTreesNativeNfcHost()
	if (host !== 'ios') return false
	const ios = window.CashTreesIOS as
		| {
				registerPushDeviceHttp?: (p: {
					requestId: string
					url: string
					body: string
				}) => void
		  }
		| undefined
	const hasBridge =
		typeof ios?.registerPushDeviceHttp === 'function' ||
		!!(
			window as unknown as {
				webkit?: { messageHandlers?: { CashTreesIOS?: { postMessage: (m: unknown) => void } } }
			}
		).webkit?.messageHandlers?.CashTreesIOS
	if (!hasBridge) return false

	const requestId = `pushreg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	const url = `${beamioApi}/api/registerPushDevice`
	const bodyJson = JSON.stringify(body)

	return await new Promise<boolean>((resolve) => {
		let settled = false
		const finish = (ok: boolean) => {
			if (settled) return
			settled = true
			window.removeEventListener('cashtreesios', onEvent as EventListener)
			window.clearTimeout(timer)
			resolve(ok)
		}
		const onEvent = (ev: Event) => {
			const detail = (ev as CustomEvent<{ action?: string; requestId?: string; ok?: boolean }>).detail
			if (!detail || detail.action !== 'registerPushDeviceHttp') return
			if (String(detail.requestId || '') !== requestId) return
			finish(detail.ok === true)
		}
		window.addEventListener('cashtreesios', onEvent as EventListener)
		const timer = window.setTimeout(() => finish(false), 15_000)
		try {
			if (typeof ios?.registerPushDeviceHttp === 'function') {
				ios.registerPushDeviceHttp({ requestId, url, body: bodyJson })
			} else {
				;(
					window as unknown as {
						webkit: { messageHandlers: { CashTreesIOS: { postMessage: (m: unknown) => void } } }
					}
				).webkit.messageHandlers.CashTreesIOS.postMessage({
					action: 'registerPushDeviceHttp',
					requestId,
					url,
					body: bodyJson,
				})
			}
		} catch {
			finish(false)
		}
	})
}

function onBindPushIdentityReply(ev: Event): void {
	const detail = (ev as CustomEvent<Record<string, unknown>>).detail
	if (!detail || detail.action !== 'bindPushIdentity' || detail.ok !== true) return
	const voip = String(detail.ios_voip || '')
		.trim()
		.toLowerCase()
	const alert = String(detail.ios || '')
		.trim()
		.toLowerCase()
	if (voip && isValidDeviceToken('ios_voip', voip)) {
		lastSeenTokensByPlatform.ios_voip = voip
		void registerDeviceToken(voip, { platform: 'ios_voip', callKit: true }).then((ok) => {
			if (!ok) schedulePendingPushFlush()
		})
	}
	if (alert && isValidDeviceToken('ios', alert)) {
		lastSeenTokensByPlatform.ios = alert
		void registerDeviceToken(alert, { platform: 'ios' }).then((ok) => {
			if (!ok) schedulePendingPushFlush()
		})
	}
	ingestNativePushSnapshot()
	schedulePendingPushFlush()
}

function onNativePushEvent(ev: Event): void {
	const detail = (ev as CustomEvent<PushTokenDetail>).detail
	if (!detail) return
	if (detail.action === 'bindPushIdentity') {
		onBindPushIdentityReply(ev)
		return
	}
	if (detail.action !== 'pushDeviceToken') return
	const token = String(detail.deviceToken || '').trim()
	const platform = normalizePlatform(detail.platform, getCashTreesNativeNfcHost())
	if (!platform) return
	// Empty hex = PushKit invalidate / alert clear. Drop HTTP dedupe only —
	// do **not** wipe pending/lastSeen; cold-start invalidate used to erase
	// the only voip hex before unlock and block force-quit CallKit wake.
	if (!token) {
		delete lastRegisteredTokenByPlatform[platform]
		delete lastRegisteredEoaByPlatform[platform]
		const seen = lastSeenTokensByPlatform[platform]
		if (seen) {
			rememberPendingToken(platform, seen, {
				pgpKeyId: detail.pgpKeyId,
				bundleId: detail.bundleId,
				fullScreenIntent: detail.fullScreenIntent,
				callKit: platform === 'ios_voip' ? true : detail.callKit,
			})
			schedulePendingPushFlush()
		}
		return
	}
	lastSeenTokensByPlatform[platform] = token
	void registerDeviceToken(token, {
		pgpKeyId: detail.pgpKeyId,
		platform,
		bundleId: detail.bundleId,
		fullScreenIntent: detail.fullScreenIntent,
		callKit: detail.callKit,
	}).then((ok) => {
		if (!ok) schedulePendingPushFlush()
	})
}

/** Attach once; listens for both iOS and Android CustomEvents. */
export function ensurePushDeviceTokenListener(): void {
	if (typeof window === 'undefined' || listenerAttached) return
	listenerAttached = true
	hydratePendingTokensFromSession()
	window.addEventListener('cashtreesios', onNativePushEvent as EventListener)
	window.addEventListener('cashtreesandroid', onNativePushEvent as EventListener)
	exposeNativePushFlushHook()
	attachVisibilityPushFlush()
	ingestNativePushSnapshot()
	schedulePendingPushFlush()
}

/** Public kick — wallet unlock / profiles ready / native becomeActive. */
export function kickPendingPushRegisterFlush(): void {
	ensurePushDeviceTokenListener()
	hydratePendingTokensFromSession()
	ingestNativePushSnapshot()
	schedulePendingPushFlush()
}

// Capture tokens that arrive before AppShell / wallet unlock attaches the listener.
if (typeof window !== 'undefined') {
	ensurePushDeviceTokenListener()
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
		const payload = { eoa, pgpKeyId: pgpKeyId || undefined }
		try {
			if (typeof ios?.bindPushIdentity === 'function') {
				ios.bindPushIdentity(payload)
			} else {
				// CashTreesIOS object not injected yet — postMessage directly.
				const handler = (
					window as unknown as {
						webkit?: { messageHandlers?: { CashTreesIOS?: { postMessage: (m: unknown) => void } } }
					}
				).webkit?.messageHandlers?.CashTreesIOS
				if (!handler?.postMessage) return false
				handler.postMessage({
					action: 'bindPushIdentity',
					eoa,
					pgpKeyId: pgpKeyId || '',
				})
			}
			// Native will re-dispatch cached voip/alert; also retry any deferred HTTP.
			schedulePendingPushFlush()
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
			schedulePendingPushFlush()
			return true
		} catch {
			return false
		}
	}

	return false
}

/**
 * Inject recipient user PGP (+ mailbox route / entry domains) into the native
 * shell for killed-app CallKit / Incoming identity. Safe to call repeatedly.
 */
export function injectNativeChatPgpSecretsFromProfile(
	profile?: {
		keyID?: string
		chatManager?: {
			pgpKey?: { keyID?: string; privateKey?: string; publicKey?: string }
			router?: string
		}
	} | null,
	entryDomains?: string[],
): boolean {
	if (!isCashTreesNativeWebView()) return false
	const p = profile || CoNET_Data?.profiles?.[0]
	const privateKeyArmor = String(p?.chatManager?.pgpKey?.privateKey || '').trim()
	if (!privateKeyArmor.includes('BEGIN PGP PRIVATE KEY')) return false
	const domains =
		Array.isArray(entryDomains) && entryDomains.length
			? entryDomains
			: undefined
	return setNativeChatPgpSecrets({
		privateKeyArmor,
		publicKeyArmor: String(p?.chatManager?.pgpKey?.publicKey || '').trim() || undefined,
		pgpKeyId: p?.chatManager?.pgpKey?.keyID
			? String(p.chatManager.pgpKey.keyID)
			: undefined,
		routePublicKeyArmor: String(p?.chatManager?.router || '').trim() || undefined,
		entryDomains: domains,
		eoa: (p?.keyID || '').trim() || undefined,
	})
}

/**
 * Bind push from the current (or given) profile.
 * Safe to call from LoadingPage onboard **and** AppShell even when gossip already started —
 * AppShell used to skip the whole init (including push) when gossip was active after onboard.
 */
export function ensureNativePushBoundForWallet(profile?: {
	keyID?: string
	chatManager?: {
		pgpKey?: { keyID?: string; privateKey?: string; publicKey?: string }
		router?: string
	}
} | null): boolean {
	const p = profile || CoNET_Data?.profiles?.[0]
	const eoa = (p?.keyID || '').trim()
	if (!eoa || !ethers.isAddress(eoa)) return false
	const chatPgp = p?.chatManager?.pgpKey?.keyID
	const ok = bindNativePushIdentity({
		eoa,
		pgpKeyId: chatPgp ? String(chatPgp) : undefined,
	})
	// Chat route register / push bind: keep shell PGP in sync for killed-app identity.
	injectNativeChatPgpSecretsFromProfile(p)
	// Bind alone is not enough — EIP-191 HTTP register must land ios_voip in DB.
	kickPendingPushRegisterFlush()
	return ok
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

/** Notify registered VoIP/FCM devices about a signed voice-call offer. */
export async function registerVoiceCallPush(params: {
	callId: string
	sessionId: string
	callerEoa: string
	calleeEoa: string
	expiresAt: number
}): Promise<boolean> {
	const timestamp = Math.floor(Date.now() / 1000)
	const message = [
		'Beamio voiceCallPush',
		`callId:${params.callId}`,
		`sessionId:${params.sessionId}`,
		`callerEoa:${params.callerEoa.toLowerCase()}`,
		`calleeEoa:${params.calleeEoa.toLowerCase()}`,
		`expiresAt:${params.expiresAt}`,
		`timestamp:${timestamp}`,
	].join('\n')
	const signed = await signMessage(message)
	if (!signed) return false
	try {
		const res = await fetch(`${beamioApi}/api/voiceCallPush`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...params, timestamp, signature: signed.signature }),
		})
		return res.ok
	} catch {
		return false
	}
}
