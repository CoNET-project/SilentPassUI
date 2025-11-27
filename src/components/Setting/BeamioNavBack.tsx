import { ArrowLeft } from 'lucide-react'

export default function BeamioNavBack({ title, onClose }: {title: string, onClose: () => void }) {
	
	return (
			<header
			className="
				sticky top-0 z-10 
				flex items-center 
				px-4 py-3
				bg-white/90 dark:bg-slate-900/80
				backdrop-blur-md
				border-b border-slate-200 dark:border-slate-700
				relative
			"
			>
			{/* Left button */}
			<button
				onClick={onClose}
				className="
				flex h-8 w-8 items-center justify-center
				rounded-full 
				active:bg-slate-200/60 dark:active:bg-slate-700/40
				transition
				"
			>
				<ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-200" />
			</button>

			{/* Center title - absolute to be perfectly centered */}
			<h1
				className="
				absolute left-1/2 -translate-x-1/2
				text-base font-semibold 
				text-slate-900 dark:text-slate-100
				"
			>
				{title}
			</h1>

			{/* Right placeholder to balance layout (same width as button) */}
			<div className="w-8"></div>
			</header>
	)
}
