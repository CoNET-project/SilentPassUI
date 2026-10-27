/**
 * Detect / call CashTreesAndroid Conet Chat Module bridge methods.
 * Must use Reflect.apply / callAndroidBridge — never extract a Java method as a
 * free function (Illegal invocation on Android WebView).
 */

type AndroidConetChatHost = {
	conetChatAvailable?: () => boolean | string
	conetChatInit?: (json: string) => boolean | string
	conetChatStop?: () => void
	conetChatIsRunning?: () => boolean | string
	conetChatUpdateNodes?: (json: string) => void
}

function getAndroidHost(): AndroidConetChatHost | null {
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
	return getAndroidHost() != null
}

export function isCashTreesAndroidConetChatAvailable(): boolean {
	const host = getAndroidHost()
	if (!host) return false
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
	const host = getAndroidHost()
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
