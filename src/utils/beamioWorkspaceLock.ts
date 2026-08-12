import { wipeSessionSecrets } from '@/utils/beamioSessionSecrets'

/** User chose "锁定钱包": block protected routes until password unlock (localStorage so all tabs respect lock). */
const WORKSPACE_SCREEN_LOCK_KEY = 'beamio_workspace_screen_lock_v1'

/** Set after successful biz gateway password login this browser tab session only. */
const WORKSPACE_SESSION_UNLOCK_KEY = 'beamio_workspace_session_unlock_v1'

export function setWorkspaceScreenLocked(locked: boolean): void {
	if (typeof window === 'undefined') return
	try {
		if (locked) {
			localStorage.setItem(WORKSPACE_SCREEN_LOCK_KEY, '1')
		} else {
			localStorage.removeItem(WORKSPACE_SCREEN_LOCK_KEY)
		}
	} catch {
		// ignore quota / private mode
	}
}

export function isWorkspaceScreenLocked(): boolean {
	if (typeof window === 'undefined') return false
	try {
		return localStorage.getItem(WORKSPACE_SCREEN_LOCK_KEY) === '1'
	} catch {
		return false
	}
}

export function markWorkspaceSessionUnlocked(): void {
	if (typeof window === 'undefined') return
	try {
		sessionStorage.setItem(WORKSPACE_SESSION_UNLOCK_KEY, '1')
	} catch {
		// ignore quota / private mode
	}
	setWorkspaceScreenLocked(false)
}

export function clearWorkspaceSessionUnlock(): void {
	if (typeof window === 'undefined') return
	wipeSessionSecrets()
	try {
		// Lazy require: chat.ts imports beamio.ts which imports this file.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { stopBizChatListen } = require('@/services/chat') as {
			stopBizChatListen?: () => void
		}
		stopBizChatListen?.()
	} catch {
		/* ignore */
	}
	try {
		sessionStorage.removeItem(WORKSPACE_SESSION_UNLOCK_KEY)
	} catch {
		// ignore quota / private mode
	}
	setWorkspaceScreenLocked(true)
}

export function isWorkspaceSessionUnlocked(): boolean {
	if (typeof window === 'undefined') return false
	try {
		return sessionStorage.getItem(WORKSPACE_SESSION_UNLOCK_KEY) === '1'
	} catch {
		return false
	}
}

/** Wallet on disk ≠ unlocked workspace; requires explicit session unlock (biz gateway login). */
export function isWorkspaceAccessGranted(): boolean {
	return !isWorkspaceScreenLocked() && isWorkspaceSessionUnlocked()
}
