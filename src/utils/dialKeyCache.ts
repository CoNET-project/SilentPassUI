import { readKey, type Key } from 'openpgp'
import { cachedWallet, resetDialWalletCacheForTest } from './dialWalletCache'

export { cachedWallet }

/**
 * Dial-path key cache: the peer's two OpenPGP keys were parsed on every call;
 * on a phone that work landed after the native call screen covered the page,
 * where WebKit slows its JS. Memory only.
 */
const KEY_MEMO_MAX = 16
const keyMemo = new Map<string, Promise<Key>>()

/** `readKey` for an armored public key, parsed once. A failed parse is not kept. */
export function cachedReadKey(armoredKey: string): Promise<Key> {
	const armor = (armoredKey || '').replace(/\r/g, '').trim()
	let parsed = keyMemo.get(armor)
	if (!parsed) {
		parsed = readKey({ armoredKey: armor })
		keyMemo.set(armor, parsed)
		parsed.catch(() => {
			if (keyMemo.get(armor) === parsed) keyMemo.delete(armor)
		})
		if (keyMemo.size > KEY_MEMO_MAX) {
			const oldest = keyMemo.keys().next().value
			if (oldest !== undefined) keyMemo.delete(oldest)
		}
	}
	return parsed
}

/** Warm the caches before a dial (chat opened): the wallet and the peer's keys. Never throws. */
export function prewarmDialKeys(privateKey: string | undefined, armors: Array<string | undefined>): void {
	try {
		if (privateKey) cachedWallet(privateKey)
	} catch {
		/* not a key */
	}
	for (const armor of armors) {
		if (armor && armor.includes('BEGIN PGP PUBLIC KEY')) void cachedReadKey(armor).catch(() => undefined)
	}
}

/** Test hook. */
export function resetDialKeyCacheForTest(): void {
	resetDialWalletCacheForTest()
	keyMemo.clear()
}
