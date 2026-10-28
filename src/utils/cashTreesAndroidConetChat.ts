/**
 * Detect / call CashTreesAndroid Conet Chat Module bridge methods.
 * Must use Reflect.apply / callAndroidBridge — never extract a Java method as a
 * free function (Illegal invocation on Android WebView).
 */

type AndroidConetChatHost = {
	/** chat-sdk-android (same contract as the iOS ConetChatSDK). */
	chatModuleAvailable?: () => boolean | string
	chatModuleCommand?: (json: string) => void
	chatModuleSignResponse?: (json: string) => void
	chatModuleIsRunning?: () => boolean | string
	/** Legacy listen-only bridge (shells older than chat-sdk-android). */
	conetChatAvailable?: () => boolean | string
	conetChatInit?: (json: string) => boolean | string
	conetChatStop?: () => void
	conetChatIsRunning?: () => boolean | string
	conetChatUpdateNodes?: (json: string) => void
}

export function getAndroidChatHost(): AndroidConetChatHost | null {
	if (typeof window === 'undefined') return null
	const host = (window as Window & { CashTreesAndroid?: AndroidConetChatHost }).CashTreesAndroid
	return host && typeof host === 'object' ? host : null
}

/**
 * True when this page runs inside the CashTrees Android WebView shell.
 * Any injected `CashTreesAndroid` object means we must **never** spawn the
 * TypeScript gossip Worker — native ConetChat owns LISTEN.
 */
export function isCashTreesAndroidShell(): boolean {
	return getAndroidChatHost() != null
}

/** True when the shell ships `chat-sdk-android` (`chatModuleCommand`). */
export function isCashTreesAndroidChatModuleAvailable(): boolean {
	const host = getAndroidChatHost()
	return !!host && typeof host.chatModuleCommand === 'function'
}

export function isCashTreesAndroidConetChatAvailable(): boolean {
	const host = getAndroidChatHost()
	if (!host) return false
	if (typeof host.chatModuleCommand === 'function') return true
	try {
		if (typeof host.conetChatAvailable === 'function') {
			const v = Reflect.apply(host.conetChatAvailable, host, [])
			if (v === true || v === 'true') return true
			// Shell present but module flagged unavailable — still refuse TS Worker.
			return typeof host.conetChatInit === 'function'
		}
		return typeof host.conetChatInit === 'function'
	} catch {
		// Bridge throw ≠ browser: if the object exists, stay on native path.
		return isCashTreesAndroidShell()
	}
}

export function callAndroidBridgeSafe(
	method: 'conetChatInit' | 'conetChatStop' | 'conetChatIsRunning' | 'conetChatUpdateNodes',
	arg?: string,
): boolean | string | void {
	const host = getAndroidChatHost()
	if (!host) return false
	const fn = host[method]
	if (typeof fn !== 'function') return false
	try {
		if (arg === undefined) {
			return Reflect.apply(fn as (...a: never[]) => unknown, host, []) as boolean | string | void
		}
		return Reflect.apply(fn as (json: string) => unknown, host, [arg]) as boolean | string | void
	} catch {
		return false
	}
}
