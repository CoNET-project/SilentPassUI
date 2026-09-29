export type MinimizedVoiceCallWindowState = {
	peerName: string
	avatarSrc: string
	statusLabel: string
	onRestore: () => void
}

let current: MinimizedVoiceCallWindowState | null = null
const listeners = new Set<() => void>()

export function publishMinimizedVoiceCallWindow(next: MinimizedVoiceCallWindowState | null): void {
	current = next
	listeners.forEach((listener) => listener())
}

export function subscribeMinimizedVoiceCallWindow(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function getMinimizedVoiceCallWindow(): MinimizedVoiceCallWindowState | null {
	return current
}
