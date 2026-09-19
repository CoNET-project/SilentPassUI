import {  ArrowLeft, MoreVertical } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

export default function BeamioNavBack({ title, onClose, onMore, showMore=false }: {title: string, onClose: () => void,  onMore: () => void, showMore?: boolean}) {
		const closeTap = useReliableTapHandler(onClose)
		const moreTap = useReliableTapHandler(onMore)
	
		return (
			<header
			className="
				absolute inset-x-0 top-0 z-50
				flex items-center justify-center
				px-4
				pt-[calc(env(safe-area-inset-top)+2rem)]
				pb-3
				bg-transparent
			"
			>
			{/* Left droplet back button */}
			<button
				type="button"
				data-touch-priority="1"
				onPointerDown={closeTap.onPointerDown}
				onPointerUp={closeTap.onPointerUp}
				onClick={closeTap.onClick}
				className={[
					'absolute left-4 top-[calc(50%+1rem)] -translate-y-1/2 h-12 w-12 min-w-12 min-h-12 rounded-full flex items-center justify-center transition active:scale-[0.96]',
					RELIABLE_TAP_BUTTON_CLASS,
				].join(' ')}
				aria-label={tu('back')}
			>
				<span
				aria-hidden
				className="
					absolute inset-0 rounded-full
            bg-white/90 dark:bg-slate-900/70
            shadow-[0_10px_24px_rgba(0,0,0,0.12)]
            ring-1 ring-black/5 dark:ring-white/10
            flex items-center justify-center
				"
				/>
				<span
				aria-hidden
				className="
					absolute inset-[2px] rounded-full
					bg-[linear-gradient(180deg,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.18)_55%,rgba(255,255,255,0.04)_100%)]
					opacity-90
				"
				/>
				<ArrowLeft
				className="
					relative h-5 w-5
					text-slate-500/50
					drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]
				"
				/>
			</button>

			{/* Right droplet more button */}
			{
				showMore && (
					<button
						type="button"
						data-touch-priority="1"
						onPointerDown={moreTap.onPointerDown}
						onPointerUp={moreTap.onPointerUp}
						onClick={moreTap.onClick}
						className={[
							'pointer-events-auto absolute right-4 h-10 w-10 rounded-full flex items-center justify-center transition active:scale-[0.96] translate-y-[1px]',
							RELIABLE_TAP_BUTTON_CLASS,
						].join(' ')}
						aria-label="More"
					>
						<span
						aria-hidden
						className="
							absolute inset-0 rounded-full
							bg-white/90 dark:bg-slate-900/70
							shadow-[0_10px_24px_rgba(0,0,0,0.12)]
							ring-1 ring-black/5 dark:ring-white/10
							flex items-center justify-center
						"
						/>
						<span
						aria-hidden
						className="
							absolute inset-[2px] rounded-full
							bg-[linear-gradient(180deg,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.18)_55%,rgba(255,255,255,0.04)_100%)]
							opacity-90
						"
						/>
						<MoreVertical
						className="
							relative h-5 w-5
							text-slate-500/50
							drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]
						"
						/>
					</button>
				)
			}
			

			{/* Center title */}
			<h1
				className="
				pointer-events-none
				text-[16px] font-semibold
				text-white
				tracking-tight
				drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]
				[text-shadow:0_2px_10px_rgba(0,0,0,0.55),0_1px_0_rgba(0,0,0,0.65)]
				backdrop-blur-[1.5px]
				"
			>
				{title}
			</h1>
			</header>
	)
}
