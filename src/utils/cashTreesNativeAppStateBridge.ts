/**
 * PWA → Native 通用业务状态桥（Footer 角标、App 图标 badge 等）。
 * Android / iOS 分别 feature-detect；浏览器/PWA standalone 下为 no-op。
 */

import { getCashTreesNativeNfcHost, isCashTreesNativeWebView } from './cashTreesNativeNfc'

export type NativeFooterBadges = {
	chat?: number
	history?: number
	wallet?: number
	settings?: number
}

/** Local system notification while shell is backgrounded but PWA still running. */
export type NativeBackgroundChatNotify = {
	title?: string
	body?: string
	/** default true */
	present?: boolean
}

/** 可由 PWA 任意业务模块推送；Native 按字段解析。 */
export type NativeAppState = {
	footerBadges?: NativeFooterBadges
	/** 桌面图标角标；省略时 Native 可回退 footerBadges.chat */
	appIconBadge?: number
	/** When set, native posts a local alert + badge (Home / background). */
	backgroundChatNotify?: NativeBackgroundChatNotify
}

function clampBadgeCount(raw: number): number {
	if (!Number.isFinite(raw)) return 0
	return Math.max(0, Math.min(999, Math.floor(raw)))
}

function normalizeFooterBadges(badges: NativeFooterBadges | undefined): NativeFooterBadges | undefined {
	if (!badges) return undefined
	const out: NativeFooterBadges = {}
	if (badges.chat != null) out.chat = clampBadgeCount(badges.chat)
	if (badges.history != null) out.history = clampBadgeCount(badges.history)
	if (badges.wallet != null) out.wallet = clampBadgeCount(badges.wallet)
	if (badges.settings != null) out.settings = clampBadgeCount(badges.settings)
	return Object.keys(out).length > 0 ? out : undefined
}

export function normalizeNativeAppState(state: NativeAppState): NativeAppState {
	const footerBadges = normalizeFooterBadges(state.footerBadges)
	const appIconBadge =
		state.appIconBadge != null
			? clampBadgeCount(state.appIconBadge)
			: footerBadges?.chat != null
				? footerBadges.chat
				: undefined
	const backgroundChatNotify = state.backgroundChatNotify
		? {
				...(state.backgroundChatNotify.title != null
					? { title: String(state.backgroundChatNotify.title) }
					: {}),
				...(state.backgroundChatNotify.body != null
					? { body: String(state.backgroundChatNotify.body) }
					: {}),
				...(state.backgroundChatNotify.present != null
					? { present: Boolean(state.backgroundChatNotify.present) }
					: {}),
			}
		: undefined
	return {
		...(footerBadges ? { footerBadges } : {}),
		...(appIconBadge != null ? { appIconBadge } : {}),
		...(backgroundChatNotify ? { backgroundChatNotify } : {}),
	}
}

export function isNativeAppStateBridgeSupported(): boolean {
	if (!isCashTreesNativeWebView()) return false
	const host = getCashTreesNativeNfcHost()
	if (host === 'ios') {
		return typeof window.CashTreesIOS?.publishAppState === 'function'
	}
	if (host === 'android') {
		return typeof window.CashTreesAndroid?.publishAppState === 'function'
	}
	return false
}

/** 推送任意 Native 可消费的应用状态（万能业务入口）。 */
export function publishNativeAppState(state: NativeAppState): boolean {
	if (!isCashTreesNativeWebView()) return false
	const normalized = normalizeNativeAppState(state)
	const host = getCashTreesNativeNfcHost()

	if (host === 'ios' && typeof window.CashTreesIOS?.publishAppState === 'function') {
		try {
			window.CashTreesIOS.publishAppState(normalized)
			return true
		} catch {
			return false
		}
	}

	if (host === 'android' && typeof window.CashTreesAndroid?.publishAppState === 'function') {
		try {
			window.CashTreesAndroid.publishAppState(
				JSON.stringify({ action: 'publishAppState', state: normalized }),
			)
			return true
		} catch {
			return false
		}
	}

	return false
}

/** Footer `/chat` tab 冒泡数 → Native App 图标角标（与 Footer badge 同源）。 */
export function syncNativeFooterChatBadge(chatCount: number): boolean {
	return publishNativeAppState({
		footerBadges: { chat: chatCount },
		appIconBadge: chatCount,
	})
}

function chatNotifyBody(badge: number): string {
	if (badge <= 0) return 'New message'
	if (badge === 1) return '1 new message'
	return `${badge} new messages`
}

/**
 * @deprecated Prefer SI mailbox APNs/FCM (`notifyOfflineChat`). PWA must not also present a
 * local system notification on inbound chat — that caused double alerts while listen was alive.
 * Kept for shell bridge compatibility; do not call from chat unread effects.
 */
export function notifyNativeBackgroundChat(chatCount: number): boolean {
	const badge = clampBadgeCount(chatCount)
	const body = chatNotifyBody(badge)
	const host = getCashTreesNativeNfcHost()
	const w = typeof window !== 'undefined' ? (window as Window & {
		CashTreesIOS?: { notifyBackgroundChat?: (p: Record<string, unknown>) => void }
		CashTreesAndroid?: { notifyBackgroundChat?: (json: string) => void }
	}) : null

	if (host === 'ios' && typeof w?.CashTreesIOS?.notifyBackgroundChat === 'function') {
		try {
			w.CashTreesIOS.notifyBackgroundChat({
				badge,
				title: 'Beamio',
				body,
			})
			return true
		} catch {
			/* fall through */
		}
	}
	if (host === 'android' && typeof w?.CashTreesAndroid?.notifyBackgroundChat === 'function') {
		try {
			w.CashTreesAndroid.notifyBackgroundChat(
				JSON.stringify({ badge, title: 'Beamio', body }),
			)
			return true
		} catch {
			/* fall through */
		}
	}

	return publishNativeAppState({
		footerBadges: { chat: badge },
		appIconBadge: badge,
		backgroundChatNotify: {
			title: 'Beamio',
			body,
			present: true,
		},
	})
}
