/** User chose "Lock Wallet": block protected routes until password unlock (localStorage so all tabs respect lock). */
const WORKSPACE_SCREEN_LOCK_KEY = 'beamio_workspace_screen_lock_v1'

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
