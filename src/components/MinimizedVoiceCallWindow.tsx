import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IpfsImg } from '@/components/IpfsImg'
import {
	getMinimizedVoiceCallWindow,
	subscribeMinimizedVoiceCallWindow,
} from '@/utils/minimizedVoiceCallWindow'

export default function MinimizedVoiceCallWindow() {
	const call = useSyncExternalStore(
		subscribeMinimizedVoiceCallWindow,
		getMinimizedVoiceCallWindow,
		getMinimizedVoiceCallWindow,
	)
	if (!call || typeof document === 'undefined') return null
	const initial = call.peerName.replace(/^@/, '').slice(0, 1).toUpperCase() || 'B'
	return createPortal(
		<button
			type="button"
			onClick={call.onRestore}
			className="fixed left-4 right-4 z-[220] flex items-center gap-3 rounded-full border border-white/30 bg-[#3d7fe8]/95 px-3 py-2 text-left text-white shadow-[0_10px_28px_rgba(15,23,42,0.28)]"
			style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
			aria-label="Return to voice call"
		>
			<span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#10233f] ring-2 ring-white/50">
				{call.avatarSrc ? (
					<IpfsImg src={call.avatarSrc} alt="" className="h-full w-full object-cover" />
				) : (
					<span className="text-sm font-semibold">{initial}</span>
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold">{call.peerName}</span>
				<span className="block text-xs text-white/80">{call.statusLabel}</span>
			</span>
		</button>,
		document.body,
	)
}
