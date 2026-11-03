/**
 * Old builds copied our own decrypted PGP private key into every peer chat as
 * `chatData.privateArmored` (the AddressPGP lookup returned the viewer's key
 * next to the peer's public key). Nothing reads it. Remove it from stored data.
 */

type ChatLike = { chatData?: { privateArmored?: unknown } | null }
type ProfileLike = { chats?: ChatLike[] | null }
type StoredDataLike = { profiles?: unknown }

/** True when a chat still holds a non-empty copy. */
const chatHoldsPrivateArmored = (chat: unknown): boolean => {
	const cd = (chat as ChatLike | null)?.chatData
	return !!cd && typeof cd === 'object' && typeof cd.privateArmored === 'string' && cd.privateArmored.length > 0
}

const chatHasPrivateArmoredKey = (chat: unknown): boolean => {
	const cd = (chat as ChatLike | null)?.chatData
	return !!cd && typeof cd === 'object' && 'privateArmored' in cd
}

const withoutPrivateArmored = <C>(chat: C): C => {
	const { privateArmored: _dropped, ...rest } = (chat as ChatLike).chatData as Record<string, unknown>
	return { ...chat, chatData: rest }
}

/**
 * Remove `chatData.privateArmored` from every chat of every profile.
 * Returns the same object when no chat has the key.
 * `changed` is true only when a non-empty copy was removed, so the caller
 * writes back once instead of on every load.
 */
export function stripPeerChatPrivateArmored<T extends StoredDataLike>(data: T): { data: T; changed: boolean } {
	if (!data || typeof data !== 'object' || !Array.isArray(data.profiles)) return { data, changed: false }
	let changed = false
	let touched = false
	const stripProfile = (p: unknown): unknown => {
		if (Array.isArray(p)) return p.map(stripProfile)
		const chats = (p as ProfileLike | null)?.chats
		if (!Array.isArray(chats) || !chats.some(chatHasPrivateArmoredKey)) return p
		touched = true
		if (chats.some(chatHoldsPrivateArmored)) changed = true
		return { ...(p as object), chats: chats.map((c) => (chatHasPrivateArmoredKey(c) ? withoutPrivateArmored(c) : c)) }
	}
	const profiles = (data.profiles as unknown[]).map(stripProfile)
	if (!touched) return { data, changed: false }
	return { data: { ...data, profiles }, changed }
}
