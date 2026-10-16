/** Android：`JavascriptInterface` 注入 `window.CashTreesAndroid`。iOS：WK 注入 `window.CashTreesIOS`（方法签名对齐 Android）。 */

/** Guardian node the shell may POST `http://{ip}/post`. Domain is diagnostic only. */
export type NativeSiNode = {
	ip: string
	domain?: string
	region?: string
}

/** PWA → native shell Chat secrets (Keychain / EncryptedSharedPreferences). */
export type NativeChatPgpSecretsPayload = {
	privateKeyArmor: string
	publicKeyArmor?: string
	pgpKeyId?: string
	/** Mailbox B route PGP public (encrypt `voice_offer_fetch`). */
	routePublicKeyArmor?: string
	/** Legacy domains. Shell HTTP does not use these as URLs. */
	entryDomains?: string[]
	/** Guardian IP roster. Shell picks the entry; PWA must not pass a URL. */
	siNodes?: NativeSiNode[]
	/** This wallet's mailbox B IP. Shell never POSTs here. */
	mailboxIp?: string
	eoa?: string
}

export type CashTreesNativeNfcBridge = {
	getNfcStatus: () => string
	startPhysicalCardBind: () => void
	cancelPhysicalCardBind?: () => void
	saveRecoveryQrToPhotos?: (payload: { dataUrl: string; filename?: string; requestId?: string }) => void
	saveFile?: (payload: { dataUrl: string; filename?: string; mimeType?: string; requestId?: string }) => void
	scanRecoveryQr?: (payload: { requestId?: string }) => void
	scanQr?: (payload: { requestId?: string }) => void
	/** Opens the native camera UI. Older shells omit this method and use the PWA input fallback. */
	requestCameraCapture?: (payload: { requestId?: string; mediaType?: 'video' }) => void
	requestPhotoPicker?: (payload: { requestId?: string }) => void
	startSystemCall?: (payload: Record<string, unknown>) => void
	reportIncomingSystemCall?: (payload: Record<string, unknown>) => void
	endSystemCall?: (payload: Record<string, unknown>) => void
	/** iOS WK bridge — object payload. Android `@JavascriptInterface` accepts a plain URL string (use `openExternalUrl`). */
	openURL?: (payload: { url: string }) => void
	/**
	 * Full-screen in-app WebView (bottom → top). Top Back closes; title = URL domain.
	 * iOS: `{ url, requestId? }`. Android: plain URL or JSON `{"url","requestId"}`.
	 * On dismiss, shell dispatches `inAppBrowserClosed` on `cashtreesios` / `cashtreesandroid`.
	 */
	openInAppBrowser?: (payload: { url: string; requestId?: string }) => void
	/** PWA catalog → native install probe. iOS uses `{ requestId, queries }` + `cashtreesios`. */
	queryInstalledApps?: (payload?: { requestId: string; queries?: NativeInstalledAppQuery[] }) => void
	/** Legacy alias of `queryInstalledApps`. iOS uses `{ requestId, queries? }` + `cashtreesios`. */
	listInstalledWalletApps?: (payload?: { requestId: string; queries?: NativeInstalledAppQuery[] }) => void | string
	/** PWA → Native 通用状态（Footer 角标、App 图标 badge 等） */
	publishAppState?: (state: Record<string, unknown>) => void
	/**
	 * iOS: POST already-signed `registerPushDevice` body via URLSession.
	 * Result: `cashtreesios` `{ action: 'registerPushDeviceHttp', requestId, ok }`.
	 */
	registerPushDeviceHttp?: (payload: { requestId: string; url: string; body: string }) => void
	/** Enter Chat: clear offline tray only; badge stays unread via publishAppState */
	clearOfflineChatAlerts?: () => void
	/** @deprecated Shell may still expose; PWA must not call for inbound chat (SI push only). */
	notifyBackgroundChat?: (payload: Record<string, unknown> | string) => void
	/** Android: mic opened — promote Telecom to ACTIVE (cancel deferred setActive). */
	notifyVoiceMicReady?: (json: string) => void
	/** Android: AudioRecord outside WebView. Returns true when recording starts. */
	startNativeVoiceMic?: () => boolean
	stopNativeVoiceMic?: () => void
	/**
	 * Inject recipient **user PGP** private (armored) for killed-app CallKit /
	 * Incoming identity. Optional mailbox route public + entry domains for
	 * `voice_offer_fetch`. Never send the EOA mnemonic for display.
	 */
	setNativeChatPgpSecrets?: (payload: NativeChatPgpSecretsPayload) => void
	/** Roster-only update. Shell picks `http://{ip}/post`; PWA does not pass a URL. */
	setNativeSiNodeRoster?: (payload: { siNodes?: NativeSiNode[]; mailboxIp?: string }) => void
	postPgpCiphertext?: (payload: { requestId: string; data: string; excludeIps?: string[] }) => void
	debugLog?: (level: string, message: string) => void
}

/** One catalog row the PWA asks native to probe. Native returns only installed `id`s. */
export type NativeInstalledAppQuery = {
	id: string
	schemes: string[]
	packages: string[]
}

/** Android bridge variant: `openURL(url: string)` + `publishAppState(json: string)` */
type CashTreesAndroidOpenUrlBridge = CashTreesNativeNfcBridge & {
	openURL?: ((url: string) => void) | ((payload: { url: string }) => void)
	openInAppBrowser?: ((url: string) => void) | ((payload: { url: string; requestId?: string }) => void)
	publishAppState?: (json: string) => void
	queryInstalledApps?: (json: string) => string
	listInstalledWalletApps?: () => string
	saveFile?: (json: string) => void
}

/** Fired when the native in-app WebView overlay/modal is dismissed. */
export type InAppBrowserClosedDetail = {
	action: 'inAppBrowserClosed'
	ok?: boolean
	requestId?: string
	url?: string
	reason?: string
}

export type OpenInAppBrowserOptions = {
	/** Echoed on `inAppBrowserClosed` so callers can match concurrent opens. */
	requestId?: string
	/** Invoked once when the native drawer closes (or immediately on external fallback). */
	onClosed?: (detail: InAppBrowserClosedDetail) => void
}

type PendingInAppBrowserClose = {
	requestId: string
	url: string
	onClosed: (detail: InAppBrowserClosedDetail) => void
}

const pendingInAppBrowserCloses = new Map<string, PendingInAppBrowserClose>()
let inAppBrowserCloseListenerInstalled = false
let inAppBrowserCloseSeq = 0

function nextInAppBrowserRequestId(): string {
	inAppBrowserCloseSeq += 1
	return `iab-${Date.now().toString(36)}-${inAppBrowserCloseSeq.toString(36)}`
}

function settleInAppBrowserClosed(detail: InAppBrowserClosedDetail): void {
	const rid = typeof detail.requestId === 'string' ? detail.requestId.trim() : ''
	const pending = rid ? pendingInAppBrowserCloses.get(rid) : undefined
	if (pending) {
		pendingInAppBrowserCloses.delete(rid)
		try {
			pending.onClosed({
				...detail,
				action: 'inAppBrowserClosed',
				requestId: rid,
				url: detail.url || pending.url,
			})
		} catch {
			/* ignore listener errors */
		}
		return
	}
	// No requestId match: notify the most recent pending (single-drawer shells).
	if (!rid && pendingInAppBrowserCloses.size === 1) {
		const only = pendingInAppBrowserCloses.values().next().value as PendingInAppBrowserClose | undefined
		if (only) {
			pendingInAppBrowserCloses.delete(only.requestId)
			try {
				only.onClosed({
					...detail,
					action: 'inAppBrowserClosed',
					requestId: only.requestId,
					url: detail.url || only.url,
				})
			} catch {
				/* ignore */
			}
		}
	}
}

function ensureInAppBrowserCloseListener(): void {
	if (inAppBrowserCloseListenerInstalled || typeof window === 'undefined') return
	inAppBrowserCloseListenerInstalled = true
	const onNative = (ev: Event) => {
		const detail = (ev as CustomEvent<InAppBrowserClosedDetail>).detail
		if (!detail || detail.action !== 'inAppBrowserClosed') return
		settleInAppBrowserClosed(detail)
	}
	window.addEventListener('cashtreesios', onNative as EventListener)
	window.addEventListener('cashtreesandroid', onNative as EventListener)
}

/**
 * Register a one-shot listener for native `inAppBrowserClosed` (any requestId).
 * Prefer [openInAppBrowser] `onClosed` for open→close pairing.
 */
export function onInAppBrowserClosed(
	handler: (detail: InAppBrowserClosedDetail) => void,
): () => void {
	ensureInAppBrowserCloseListener()
	const wrap = (ev: Event) => {
		const detail = (ev as CustomEvent<InAppBrowserClosedDetail>).detail
		if (!detail || detail.action !== 'inAppBrowserClosed') return
		handler(detail)
	}
	window.addEventListener('cashtreesios', wrap as EventListener)
	window.addEventListener('cashtreesandroid', wrap as EventListener)
	return () => {
		window.removeEventListener('cashtreesios', wrap as EventListener)
		window.removeEventListener('cashtreesandroid', wrap as EventListener)
	}
}

/**
 * Promise that resolves when the matching in-app browser closes.
 * Use with a `requestId` returned from [openInAppBrowser].
 */
export function waitForInAppBrowserClosed(requestId: string, timeoutMs = 0): Promise<InAppBrowserClosedDetail> {
	ensureInAppBrowserCloseListener()
	const rid = requestId.trim()
	return new Promise((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		const finish = (detail: InAppBrowserClosedDetail) => {
			if (timer !== undefined) clearTimeout(timer)
			unsub()
			resolve(detail)
		}
		const unsub = onInAppBrowserClosed((detail) => {
			const dRid = typeof detail.requestId === 'string' ? detail.requestId.trim() : ''
			if (rid && dRid && dRid !== rid) return
			finish(detail)
		})
		if (timeoutMs > 0) {
			timer = setTimeout(() => {
				unsub()
				reject(new Error('inAppBrowserClosed timeout'))
			}, timeoutMs)
		}
	})
}

const LEGACY_RECEIVE_WALLET_NATIVE_IDS = new Set(['metamask', 'base'])

function allowedNativeAppIds(queries: NativeInstalledAppQuery[]): Set<string> {
	const ids = queries
		.map((q) => q.id.trim().toLowerCase())
		.filter(Boolean)
	return ids.length > 0 ? new Set(ids) : LEGACY_RECEIVE_WALLET_NATIVE_IDS
}

function parseNativeWalletIds(raw: unknown, allowed: Set<string>): string[] | null {
	if (raw == null) return null
	let ids: unknown = raw
	if (typeof raw === 'string') {
		const t = raw.trim()
		if (!t) return []
		try {
			ids = JSON.parse(t)
		} catch {
			return null
		}
	}
	if (!Array.isArray(ids)) return null
	return ids
		.filter((x): x is string => typeof x === 'string')
		.map((x) => x.trim().toLowerCase())
		.filter((id) => allowed.has(id))
}

function isNativeInstalledAppListAction(action: string | undefined): boolean {
	return action === 'queryInstalledApps' || action === 'listInstalledWalletApps'
}

/** True when this shell can answer an installed-app catalog query. */
export function hasNativeWalletListApi(): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	if (typeof w.CashTreesAndroid?.queryInstalledApps === 'function') return true
	if (typeof w.CashTreesAndroid?.listInstalledWalletApps === 'function') return true
	if (typeof w.CashTreesIOS?.queryInstalledApps === 'function') return true
	if (typeof w.CashTreesIOS?.listInstalledWalletApps === 'function') return true
	return false
}

/**
 * Shell-only install probe. PWA sends the catalog; native returns only installed ids.
 * `null` = old shell / no API (do not invent a list).
 * `[]` = shell confirmed none of the queried apps are installed.
 */
export function listInstalledWalletAppsFromNative(
	queries: NativeInstalledAppQuery[] = [],
): Promise<string[] | null> {
	const w = cashTreesNativeWindow()
	if (!w) return Promise.resolve(null)
	const allowed = allowedNativeAppIds(queries)

	if (typeof w.CashTreesAndroid?.queryInstalledApps === 'function') {
		try {
			const requestId =
				typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: `wallets-${Date.now()}`
			return Promise.resolve(
				parseNativeWalletIds(
					callAndroidBridge(
						w.CashTreesAndroid,
						'queryInstalledApps',
						JSON.stringify({ requestId, queries }),
					),
					allowed,
				),
			)
		} catch {
			return Promise.resolve(null)
		}
	}

	if (typeof w.CashTreesAndroid?.listInstalledWalletApps === 'function') {
		try {
			return Promise.resolve(
				parseNativeWalletIds(
					callAndroidBridge(w.CashTreesAndroid, 'listInstalledWalletApps'),
					allowed,
				),
			)
		} catch {
			return Promise.resolve(null)
		}
	}

	const iosQuery = w.CashTreesIOS?.queryInstalledApps
	const iosList = w.CashTreesIOS?.listInstalledWalletApps
	const iosFn = typeof iosQuery === 'function' ? iosQuery : iosList
	if (typeof iosFn === 'function') {
		return new Promise((resolve) => {
			const requestId =
				typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: `wallets-${Date.now()}`
			let done = false
			const finish = (v: string[] | null) => {
				if (done) return
				done = true
				window.removeEventListener('cashtreesios', onEvent as EventListener)
				window.clearTimeout(timer)
				resolve(v)
			}
			const onEvent = (e: Event) => {
				const d = (e as CustomEvent<{
					action?: string
					requestId?: string
					ids?: unknown
				}>).detail
				if (!isNativeInstalledAppListAction(d?.action) || d.requestId !== requestId) return
				finish(parseNativeWalletIds(d.ids, allowed) ?? [])
			}
			window.addEventListener('cashtreesios', onEvent as EventListener)
			const timer = window.setTimeout(() => finish(null), 2500)
			try {
				iosFn({ requestId, queries })
			} catch {
				finish(null)
			}
		})
	}

	return Promise.resolve(null)
}

type CashTreesNativeWindow = Window & {
	CashTreesAndroid?: CashTreesAndroidOpenUrlBridge
	CashTreesIOS?: CashTreesNativeNfcBridge
	webkit?: {
		messageHandlers?: {
			CashTreesIOS?: { postMessage: (message: unknown) => void }
		}
	}
}

function cashTreesNativeWindow(): CashTreesNativeWindow | null {
	if (typeof window === 'undefined') return null
	return window as CashTreesNativeWindow
}

/** True when the Android WebView bridge is present (any known method). */
function hasCashTreesAndroidBridge(w: CashTreesNativeWindow): boolean {
	const a = w.CashTreesAndroid
	if (!a || typeof a !== 'object') return false
	return (
		typeof a.getNfcStatus === 'function' ||
		typeof a.debugLog === 'function' ||
		typeof a.notifyVoiceMicReady === 'function' ||
		typeof a.endSystemCall === 'function' ||
		typeof a.openURL === 'function' ||
		typeof a.openInAppBrowser === 'function'
	)
}

/**
 * Invoke an Android `@JavascriptInterface` method with the injected object as `this`.
 *
 * Extracting the function (`const fn = android.openX; fn(...)`) or Babel/Terser
 * `(0, android.openX)(...)` throws:
 * `Java bridge method can't be invoked on a non-injected object`.
 * `Reflect.apply(fn, android, args)` keeps the WebView receiver and survives minify.
 */
function callAndroidBridge(android: object, method: string, ...args: unknown[]): unknown {
	const fn = (android as Record<string, unknown>)[method]
	if (typeof fn !== 'function') {
		throw new Error(`CashTreesAndroid.${method} missing`)
	}
	return Reflect.apply(fn as (...a: unknown[]) => unknown, android, args)
}

/** 当前原生壳：由宿主注入的全局决定，优于 UA 猜测。 */
export function getCashTreesNativeNfcHost(): 'android' | 'ios' | null {
	const w = cashTreesNativeWindow()
	if (!w) return null
	if (hasCashTreesAndroidBridge(w)) return 'android'
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return 'ios'
	// Bridge inject may lag documentStart; WK messageHandlers still means iOS shell.
	if (w.webkit?.messageHandlers?.CashTreesIOS) return 'ios'
	return null
}

/**
 * Tell Android Telecom the mic is open so it can setActive() now
 * (MODE_IN_COMMUNICATION) instead of waiting for the Answer fallback timer.
 */
export function notifyNativeVoiceMicReady(payload: {
	callId?: string
	sessionId?: string
}): boolean {
	const w = cashTreesNativeWindow()
	if (!w?.CashTreesAndroid || typeof w.CashTreesAndroid.notifyVoiceMicReady !== 'function') {
		return false
	}
	try {
		callAndroidBridge(
			w.CashTreesAndroid,
			'notifyVoiceMicReady',
			JSON.stringify({
				callId: String(payload.callId || ''),
				sessionId: String(payload.sessionId || ''),
			}),
		)
		return true
	} catch {
		return false
	}
}

/** Start the Android AudioRecord uplink. False when the shell has no bridge. */
export function startNativeVoiceMic(): boolean {
	const w = cashTreesNativeWindow()
	if (!w?.CashTreesAndroid || typeof w.CashTreesAndroid.startNativeVoiceMic !== 'function') {
		return false
	}
	try {
		const started = callAndroidBridge(w.CashTreesAndroid, 'startNativeVoiceMic')
		return started === true || started === 'true'
	} catch {
		return false
	}
}

export function stopNativeVoiceMic(): void {
	const w = cashTreesNativeWindow()
	if (!w?.CashTreesAndroid || typeof w.CashTreesAndroid.stopNativeVoiceMic !== 'function') return
	try {
		callAndroidBridge(w.CashTreesAndroid, 'stopNativeVoiceMic')
	} catch {
		/* already stopped */
	}
}

/** PWA 是否运行在 iOS / Android 原生 WebView 壳内（CashTreesIOS / CashTreesAndroid 已注入）。 */
export function isCashTreesNativeWebView(): boolean {
	if (getCashTreesNativeNfcHost() !== null) return true
	if (typeof window === 'undefined') return false
	const w = cashTreesNativeWindow()
	if (!w) return false
	// Fallback when NFC host probe is null but WK / Android bridge exists.
	if (w.webkit?.messageHandlers?.CashTreesIOS) return true
	if (hasCashTreesAndroidBridge(w)) return true
	return false
}

/**
 * Persist recipient user PGP (and optional mailbox route / entry domains) in
 * the native shell for killed-app `voice_offer_fetch` + local decrypt.
 * Idempotent; call after Chat route register and whenever PGP rotates.
 */
export function setNativeChatPgpSecrets(payload: NativeChatPgpSecretsPayload): boolean {
	if (typeof window === 'undefined') return false
	if (!isCashTreesNativeWebView()) return false
	const privateKeyArmor = String(payload.privateKeyArmor || '').trim()
	if (!privateKeyArmor.includes('BEGIN PGP PRIVATE KEY')) return false

	const body: NativeChatPgpSecretsPayload = {
		privateKeyArmor,
		publicKeyArmor: payload.publicKeyArmor?.trim() || undefined,
		pgpKeyId: payload.pgpKeyId?.trim() || undefined,
		routePublicKeyArmor: payload.routePublicKeyArmor?.trim() || undefined,
		entryDomains: Array.isArray(payload.entryDomains)
			? payload.entryDomains.map((d) => String(d || '').trim()).filter(Boolean).slice(0, 64)
			: undefined,
		siNodes: normalizeNativeSiNodes(payload.siNodes),
		mailboxIp: payload.mailboxIp?.trim() || undefined,
		eoa: payload.eoa?.trim() || undefined,
	}

	const host = getCashTreesNativeNfcHost()
	try {
		if (host === 'ios') {
			const ios = window.CashTreesIOS as
				| { setNativeChatPgpSecrets?: (p: NativeChatPgpSecretsPayload) => void }
				| undefined
			if (typeof ios?.setNativeChatPgpSecrets === 'function') {
				ios.setNativeChatPgpSecrets(body)
				return true
			}
			const handler = (
				window as unknown as {
					webkit?: { messageHandlers?: { CashTreesIOS?: { postMessage: (m: unknown) => void } } }
				}
			).webkit?.messageHandlers?.CashTreesIOS
			if (!handler?.postMessage) return false
			handler.postMessage({ action: 'setNativeChatPgpSecrets', ...body })
			return true
		}
		if (host === 'android') {
			const android = window.CashTreesAndroid as
				| { setNativeChatPgpSecrets?: (json: string) => void }
				| undefined
			if (typeof android?.setNativeChatPgpSecrets !== 'function') return false
			callAndroidBridge(android, 'setNativeChatPgpSecrets', JSON.stringify(body))
			return true
		}
	} catch {
		return false
	}
	return false
}

function normalizeNativeSiNodes(nodes: NativeSiNode[] | undefined): NativeSiNode[] | undefined {
	if (!Array.isArray(nodes) || !nodes.length) return undefined
	const out: NativeSiNode[] = []
	for (const node of nodes) {
		const ip = String(node?.ip || '').trim()
		if (!ip) continue
		out.push({
			ip,
			domain: node.domain?.trim() || undefined,
			region: node.region?.trim() || undefined,
		})
	}
	return out.length ? out : undefined
}

export type NativePgpCipherPostResult = {
	ok: boolean
	status: number
	body: string
	error: string
}

/**
 * Ask the native shell to POST `{ data: armor }` to `http://{ip}/post`.
 * The shell chooses the entry IP. Returns `bridge_missing` when the shell
 * has no method yet, and `no_si_roster` when the shell has no IP list.
 */
export function postNativePgpCiphertext(
	armor: string,
	excludeIps?: string[],
	timeoutMs = 15_000,
): Promise<NativePgpCipherPostResult> {
	const fail = (error: string): NativePgpCipherPostResult => ({
		ok: false,
		status: 0,
		body: '',
		error,
	})
	if (typeof window === 'undefined' || !isCashTreesNativeWebView()) {
		return Promise.resolve(fail('bridge_missing'))
	}
	const data = String(armor || '').trim()
	if (!data.includes('BEGIN PGP MESSAGE')) return Promise.resolve(fail('not_pgp'))
	const requestId = `pgp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
	const payload = {
		requestId,
		data,
		excludeIps: (excludeIps || []).map((ip) => String(ip || '').trim()).filter(Boolean),
	}
	return new Promise((resolve) => {
		let settled = false
		const finish = (result: NativePgpCipherPostResult) => {
			if (settled) return
			settled = true
			window.clearTimeout(timer)
			window.removeEventListener('cashtreesios', onNative as EventListener)
			window.removeEventListener('cashtreesandroid', onNative as EventListener)
			resolve(result)
		}
		const onNative = (event: Event) => {
			const detail = (event as CustomEvent).detail as {
				action?: string
				requestId?: string
				ok?: boolean
				status?: number
				body?: string
				error?: string
			} | null
			if (!detail || detail.action !== 'postPgpCiphertext' || detail.requestId !== requestId) return
			finish({
				ok: detail.ok === true,
				status: Number(detail.status) || 0,
				body: typeof detail.body === 'string' ? detail.body : '',
				error: detail.ok === true ? '' : String(detail.error || 'post_failed'),
			})
		}
		const timer = window.setTimeout(() => finish(fail('timeout')), timeoutMs)
		window.addEventListener('cashtreesios', onNative as EventListener)
		window.addEventListener('cashtreesandroid', onNative as EventListener)
		try {
			const ios = window.CashTreesIOS as
				| { postPgpCiphertext?: (p: typeof payload) => void }
				| undefined
			if (typeof ios?.postPgpCiphertext === 'function') {
				ios.postPgpCiphertext(payload)
				return
			}
			const handler = (
				window as unknown as {
					webkit?: { messageHandlers?: { CashTreesIOS?: { postMessage: (m: unknown) => void } } }
				}
			).webkit?.messageHandlers?.CashTreesIOS
			if (handler?.postMessage) {
				handler.postMessage({ action: 'postPgpCiphertext', ...payload })
				return
			}
			const android = window.CashTreesAndroid as
				| { postPgpCiphertext?: (json: string) => void }
				| undefined
			if (typeof android?.postPgpCiphertext === 'function') {
				callAndroidBridge(android, 'postPgpCiphertext', JSON.stringify(payload))
				return
			}
			finish(fail('bridge_missing'))
		} catch {
			finish(fail('bridge_missing'))
		}
	})
}

export function getCashTreesNativeNfcBridge(): CashTreesNativeNfcBridge | null {
	const w = cashTreesNativeWindow()
	if (!w) return null
	if (hasCashTreesAndroidBridge(w)) return w.CashTreesAndroid ?? null
	if (typeof w.CashTreesIOS?.getNfcStatus === 'function') return w.CashTreesIOS
	return null
}

/** Start native video capture while keeping Android's String-only JS bridge contract. */
export function requestNativeCameraCapture(payload: {
	requestId?: string
	mediaType?: 'video'
}): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	if (typeof w.CashTreesAndroid?.requestCameraCapture === 'function') {
		try {
			callAndroidBridge(w.CashTreesAndroid, 'requestCameraCapture', JSON.stringify(payload))
			return true
		} catch {
			return false
		}
	}
	if (typeof w.CashTreesIOS?.requestCameraCapture === 'function') {
		try {
			w.CashTreesIOS.requestCameraCapture(payload)
			return true
		} catch {
			return false
		}
	}
	return false
}

export function requestNativePhotoPicker(payload: { requestId?: string }): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	if (typeof w.CashTreesIOS?.requestPhotoPicker === 'function') {
		try {
			w.CashTreesIOS.requestPhotoPicker(payload)
			return true
		} catch {
			return false
		}
	}
	if (typeof w.CashTreesAndroid?.requestPhotoPicker === 'function') {
		try {
			callAndroidBridge(w.CashTreesAndroid, 'requestPhotoPicker', JSON.stringify(payload))
			return true
		} catch {
			return false
		}
	}
	return false
}

export function dispatchNativeSystemCallAction(
	action: 'startSystemCall' | 'reportIncomingSystemCall' | 'endSystemCall',
	payload: Record<string, unknown>,
): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	const bridge = (w.CashTreesAndroid || w.CashTreesIOS) as
		| (Record<string, unknown> & { __android?: boolean })
		| undefined
	try {
		if (w.CashTreesAndroid) {
			const json = JSON.stringify({ action, ...payload })
			// Call on the Java object. A detached `fn(json)` drops the WebView
			// receiver and throws before the @JavascriptInterface method runs.
			callAndroidBridge(w.CashTreesAndroid, action, json)
		} else {
			const fn = bridge?.[action]
			if (typeof fn !== 'function') return false
			;(fn as unknown as (value: Record<string, unknown>) => void)({ action, ...payload })
		}
		return true
	} catch {
		return false
	}
}

function tryNativeOpenUrl(url: string): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false

	if (typeof w.CashTreesIOS?.openURL === 'function') {
		try {
			w.CashTreesIOS.openURL({ url })
			return true
		} catch {
			return false
		}
	}

	if (typeof w.CashTreesAndroid?.openURL === 'function') {
		try {
			callAndroidBridge(w.CashTreesAndroid, 'openURL', url)
			return true
		} catch {
			return false
		}
	}

	return false
}

function tryNativeOpenInAppBrowser(url: string, requestId?: string): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	const rid = typeof requestId === 'string' ? requestId.trim() : ''

	if (typeof w.CashTreesIOS?.openInAppBrowser === 'function') {
		try {
			w.CashTreesIOS.openInAppBrowser(rid ? { url, requestId: rid } : { url })
			return true
		} catch {
			return false
		}
	}

	if (typeof w.CashTreesAndroid?.openInAppBrowser === 'function') {
		try {
			// Prefer JSON so requestId is available; plain URL remains valid for older shells.
			// Must use Reflect.apply — extracted/minified `(0, bridge.fn)(...)` fails on Android.
			callAndroidBridge(
				w.CashTreesAndroid,
				'openInAppBrowser',
				rid ? JSON.stringify({ url, requestId: rid }) : url,
			)
			return true
		} catch {
			return false
		}
	}

	return false
}

export function saveFileToNative(payload: {
	dataUrl: string
	filename?: string
	mimeType?: string
	requestId?: string
}): boolean {
	const w = cashTreesNativeWindow()
	if (!w) return false
	if (typeof w.CashTreesIOS?.saveFile === 'function') {
		try {
			w.CashTreesIOS.saveFile(payload)
			return true
		} catch {
			return false
		}
	}
	if (typeof w.CashTreesAndroid?.saveFile === 'function') {
		try {
			callAndroidBridge(w.CashTreesAndroid, 'saveFile', JSON.stringify(payload))
			return true
		} catch {
			return false
		}
	}
	return false
}

/**
 * 设备是否具备可用的 NFC 能力（用于是否展示 NFC Keys 等入口）。
 * - 原生壳：以 `getNfcStatus()` 为准，`no_hardware` 为无硬件；`ready` / `disabled` / `nfc_permission_denied` 为有硬件。
 * - 浏览器：存在 Web NFC（`NDEFReader`，多见于 Android Chrome + HTTPS）。
 */
export function detectDeviceNfcCapability(): boolean {
	if (typeof window === 'undefined') return false
	try {
		const native = getCashTreesNativeNfcBridge()
		if (native?.getNfcStatus) {
			const s = native.getNfcStatus()
			if (s === 'no_hardware') return false
			if (s === 'ready' || s === 'disabled' || s === 'nfc_permission_denied') return true
		}
	} catch {
		/* PWA / 桌面 */
	}
	return 'NDEFReader' in window
}

/**
 * Open a URL externally — **single entry for browser + native shell**.
 * - Native WebView (`CashTreesIOS` / `CashTreesAndroid`): prefer `openURL` bridge → system browser.
 * - If shell is present but `openURL` is missing (older App build): fall back to `window.open`
 *   (still better than top-level `<a target="_blank">` navigation inside WKWebView).
 * - Plain browser / installable PWA: `window.open(..., '_blank', 'noopener,noreferrer')`.
 *
 * All user-initiated external http(s) / mailto / tel opens MUST go through this helper.
 * Known wallet custom schemes (`ethereum` EIP-681 / `metamask` / `cbwallet` /
 * `coinbase` / `base` / `okx` / `okex` / `tpdapp` / `tpoutside` / `phantom` / `trust`) are
 * also allowed when the native `openURL` allowlist includes them
 * (see `.cursor/rules/beamio-native-external-url-bridge.mdc`).
 */
export function openExternalUrl(rawUrl: string): boolean {
	const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!url || typeof window === 'undefined') return false

	// Prefer bridge whenever openURL exists (even if getNfcStatus probe differs).
	if (tryNativeOpenUrl(url)) {
		return true
	}

	try {
		// `noopener` makes a successful open return null, which looks like a blocked popup.
		// Null `opener` after the window exists so the return value stays trustworthy.
		const opened = window.open(url, '_blank')
		if (!opened) return false
		try {
			opened.opener = null
		} catch {
			/* cross-origin already */
		}
		return true
	} catch {
		return false
	}
}

/**
 * Open http(s) in the native shell's full-screen in-app WebView (slides up from bottom).
 * Top Back closes; chrome title = URL domain (no title param).
 * - Native shell with `openInAppBrowser`: in-app overlay / modal.
 * - Older shell / browser: falls back to [openExternalUrl] (system browser / new tab).
 */
function nativeBridgeDebugLog(level: string, message: string): void {
	try {
		console[level === 'error' ? 'error' : 'info'](`[CashTreesBridge] ${message}`)
	} catch {
		/* ignore */
	}
	const w = cashTreesNativeWindow()
	if (!w) return
	try {
		if (typeof w.CashTreesAndroid?.debugLog === 'function') {
			callAndroidBridge(w.CashTreesAndroid, 'debugLog', level, message)
			return
		}
		if (typeof w.CashTreesIOS?.debugLog === 'function') {
			w.CashTreesIOS.debugLog(level, message)
		}
	} catch {
		/* ignore */
	}
}

/** Coinbase Wallet free-send trampoline — redirects to market:// / intent://; never load in WebView. */
export function isCoinbaseWalletTrampolineUrl(rawUrl: string): boolean {
	try {
		const host = new URL(rawUrl.trim()).hostname.toLowerCase()
		return host === 'go.cb-w.com' || host.endsWith('.cb-w.com')
	} catch {
		return false
	}
}

/**
 * Deposit → Coinbase: open Onramp HTTPS in the in-app WebView drawer.
 * go.cb-w.com trampolines must never load in WebView (Android store "Open with" loop);
 * if one is passed, fall back to openExternalUrl (Receive-from-wallet Coinbase Wallet only).
 * Pass `onClosed` to run the next step after the native drawer is dismissed.
 */
export function openCoinbaseCheckoutUrl(rawUrl: string, options?: OpenInAppBrowserOptions): boolean {
	const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!url) return false
	if (isCoinbaseWalletTrampolineUrl(url)) {
		const opened = openExternalUrl(url)
		if (opened && options?.onClosed) {
			options.onClosed({
				action: 'inAppBrowserClosed',
				ok: true,
				requestId: options.requestId || '',
				url,
				reason: 'external',
			})
		}
		return opened
	}
	return openInAppBrowser(url, options)
}

/**
 * Open http(s) in the native shell's full-screen in-app WebView (slides up from bottom).
 * Top Back closes; chrome title = URL domain (no title param).
 * - Native shell with `openInAppBrowser`: in-app overlay / modal; dismiss → `onClosed` / `inAppBrowserClosed`.
 * - Older shell / browser: falls back to [openExternalUrl]; `onClosed` fires immediately with `reason: 'external'`.
 * @returns `requestId` when a close callback was registered (or generated); `true`/`false` for legacy callers via boolean coercion.
 */
export function openInAppBrowser(
	rawUrl: string,
	options?: OpenInAppBrowserOptions,
): boolean {
	const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!url || typeof window === 'undefined') return false

	let scheme = ''
	let host = ''
	try {
		const parsed = new URL(url)
		scheme = parsed.protocol.replace(':', '').toLowerCase()
		host = parsed.hostname.toLowerCase()
	} catch {
		nativeBridgeDebugLog('error', `openInAppBrowser invalid url`)
		return false
	}
	if (scheme !== 'http' && scheme !== 'https') {
		nativeBridgeDebugLog('error', `openInAppBrowser reject scheme=${scheme}`)
		return false
	}
	// Defense: go.cb-w.com must not open the in-app drawer (store chooser loop on Android).
	if (host === 'go.cb-w.com' || host.endsWith('.cb-w.com')) {
		nativeBridgeDebugLog('warn', `openInAppBrowser refuse trampoline host=${host} → openExternalUrl`)
		const opened = openExternalUrl(url)
		if (opened && options?.onClosed) {
			options.onClosed({
				action: 'inAppBrowserClosed',
				ok: true,
				requestId: options.requestId || '',
				url,
				reason: 'external',
			})
		}
		return opened
	}

	const wantClose = typeof options?.onClosed === 'function'
	const requestId =
		(typeof options?.requestId === 'string' && options.requestId.trim()) ||
		(wantClose ? nextInAppBrowserRequestId() : '')

	if (wantClose && requestId) {
		ensureInAppBrowserCloseListener()
		pendingInAppBrowserCloses.set(requestId, {
			requestId,
			url,
			onClosed: options!.onClosed!,
		})
	}

	if (tryNativeOpenInAppBrowser(url, requestId || undefined)) {
		nativeBridgeDebugLog('info', `openInAppBrowser native drawer ok host=${host} requestId=${requestId || '-'}`)
		return true
	}

	// Bridge missing — clear pending and fall back; invoke onClosed as external.
	if (requestId) pendingInAppBrowserCloses.delete(requestId)
	nativeBridgeDebugLog(
		'warn',
		`openInAppBrowser bridge missing — fallback openExternalUrl host=${host}`,
	)
	const opened = openExternalUrl(url)
	if (opened && options?.onClosed) {
		options.onClosed({
			action: 'inAppBrowserClosed',
			ok: true,
			requestId,
			url,
			reason: 'external',
		})
	}
	return opened
}

/** Browser-only placeholder opened in the click that starts Coinbase checkout. */
let reservedBrowserWindow: Window | null = null

/**
 * True after `reserveExternalBrowserWindow` in this click, even if the Window
 * handle is null. Cursor/Electron can still create the named tab and later
 * `window.open(url, '_blank')` would add a second Coinbase tab.
 */
let reservedNamedHandoff = false

/** Same name so the later Coinbase URL reuses the click-reserved tab. */
const EXTERNAL_HANDOFF_WINDOW_NAME = 'beamio_external_handoff'

function reservedWindowStillBlank(reserved: Window): boolean {
	try {
		const href = reserved.location.href
		return !href || href === 'about:blank'
	} catch {
		// Cross-origin: this tab already left about:blank (usually Coinbase).
		return false
	}
}

/**
 * Same-origin `about:blank` can still run this document. Coinbase COOP often
 * ignores `location.replace` from the opener and opens a sibling tab, leaving
 * the reserved window blank. Writing a same-document redirect uses that tab.
 */
function navigateReservedDocument(target: Window, url: string): void {
	try {
		const doc = target.document
		doc.open()
		doc.write(
			`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Opening Coinbase</title>` +
				`<script>location.replace(${JSON.stringify(url)})</script></head><body></body></html>`
		)
		doc.close()
		return
	} catch {
		/* document may already be closed */
	}
	try {
		target.location.replace(url)
	} catch {
		try {
			target.location.href = url
		} catch {
			/* COOP */
		}
	}
}

/** Blocking GET for a click handler so Coinbase can open without an about:blank placeholder. */
export function fetchJsonSync<T>(url: string): T | null {
	if (typeof XMLHttpRequest === 'undefined') return null
	try {
		const xhr = new XMLHttpRequest()
		xhr.open('GET', url, false)
		xhr.setRequestHeader('Accept', 'application/json')
		xhr.send(null)
		if (xhr.status < 200 || xhr.status >= 300) return null
		const text = xhr.responseText
		if (!text) return null
		return JSON.parse(text) as T
	} catch {
		return null
	}
}

function openNamedExternalHandoff(url: string): boolean {
	reservedNamedHandoff = false
	reservedBrowserWindow = null
	try {
		const named = window.open(url, EXTERNAL_HANDOFF_WINDOW_NAME)
		if (named && !named.closed) {
			try {
				named.opener = null
			} catch {
				/* already navigated */
			}
		}
		// A null handle still counts as success: the named tab often already
		// received the Coinbase URL. Do not fall through to `_blank`.
		return true
	} catch {
		return openExternalUrl(url)
	}
}

/**
 * Call synchronously inside a click handler so a later async URL can navigate
 * the same tab. Native shells skip this and use `openExternalUrl` after the URL exists.
 */
export function reserveExternalBrowserWindow(): Window | null {
	if (typeof window === 'undefined' || isCashTreesNativeWebView()) return null
	closeReservedExternalWindow(reservedBrowserWindow)
	try {
		const opened = window.open('about:blank', EXTERNAL_HANDOFF_WINDOW_NAME)
		reservedBrowserWindow = opened
		reservedNamedHandoff = true
		return opened
	} catch {
		reservedBrowserWindow = null
		reservedNamedHandoff = false
		return null
	}
}

/** The placeholder from the latest click, if it is still a blank tab. */
export function peekReservedExternalWindow(): Window | null {
	const opened = reservedBrowserWindow
	if (!opened || opened.closed) {
		reservedBrowserWindow = null
		return null
	}
	return opened
}

export function consumeReservedExternalWindow(): void {
	reservedBrowserWindow = null
	reservedNamedHandoff = false
}

export function navigateReservedOrOpenExternal(reserved: Window | null | undefined, rawUrl: string): boolean {
	const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
	if (!url) return false
	if (isCashTreesNativeWebView()) return openExternalUrl(url)

	const target = reserved && !reserved.closed ? reserved : peekReservedExternalWindow()
	if (target && !target.closed) {
		navigateReservedDocument(target, url)
		if (!reservedWindowStillBlank(target)) {
			try {
				target.opener = null
			} catch {
				/* already navigated */
			}
			if (reservedBrowserWindow === target) reservedBrowserWindow = null
			reservedNamedHandoff = false
			return true
		}
		// Coinbase Cross-Origin-Opener-Policy often opens the onramp in a *new*
		// tab and leaves this click-reserved window on about:blank. Closing the
		// leftover blank is required — a second window.open would add another Coinbase tab.
		try {
			target.close()
		} catch {
			/* ignore */
		}
		if (reservedBrowserWindow === target) reservedBrowserWindow = null
		reservedNamedHandoff = false
		return true
	}

	if (reservedNamedHandoff) return openNamedExternalHandoff(url)

	return openExternalUrl(url)
}

export function closeReservedExternalWindow(reserved: Window | null | undefined): void {
	if (!reserved || reserved.closed) return
	try {
		const href = reserved.location.href
		if (href && href !== 'about:blank') return
	} catch {
		// Cross-origin means the tab already left about:blank for Coinbase.
		return
	}
	try {
		reserved.close()
	} catch {
		/* ignore */
	}
	if (reservedBrowserWindow === reserved) reservedBrowserWindow = null
	reservedNamedHandoff = false
}
