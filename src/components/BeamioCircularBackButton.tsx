import { ChevronLeft } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

type BeamioCircularBackButtonProps = {
	onClick: () => void
	ariaLabel?: string
	className?: string
	disabled?: boolean
	variant?: 'onLight' | 'onDark'
} & Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	'type' | 'onClick' | 'children' | 'onPointerDown' | 'onPointerUp'
>

export function BeamioCircularBackButton({
	onClick,
	ariaLabel = tu('back'),
	className = '',
	disabled = false,
	variant = 'onLight',
	...rest
}: BeamioCircularBackButtonProps) {
	const tap = useReliableTapHandler(onClick)
	const isDark = variant === 'onDark'
	const discChrome = isDark
		? 'border border-white/40 bg-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.28),0_1px_3px_rgba(0,0,0,0.18)]'
		: [
				'border border-black/[0.08] bg-white/90',
				'dark:border-white/25 dark:bg-slate-800/90',
				'shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(0,0,0,0.12)]',
			].join(' ')
	const chevronClass = isDark ? 'text-white/80' : 'text-[#2c2f31] dark:text-slate-100'

	return (
		<button
			type="button"
			tabIndex={-1}
			disabled={disabled}
			data-touch-priority="1"
			aria-label={ariaLabel}
			{...rest}
			style={{
				touchAction: 'manipulation',
				WebkitTapHighlightColor: 'transparent',
				...(typeof rest.style === 'object' && rest.style ? rest.style : null),
			}}
			onPointerDown={tap.onPointerDown}
			onPointerUp={tap.onPointerUp}
			onClick={tap.onClick}
			className={[
				'relative isolate inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-1',
				RELIABLE_TAP_BUTTON_CLASS,
				chevronClass,
				'transition active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40',
				className,
			].join(' ')}
		>
			<span
				className={['pointer-events-none absolute inset-1 rounded-full', discChrome].join(' ')}
				aria-hidden
			>
				<span className="absolute inset-0 rounded-full backdrop-blur-md" aria-hidden />
			</span>
			<ChevronLeft className="relative z-[1] h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
		</button>
	)
}

export const BEAMIO_CIRCULAR_BACK_ROW_CLASS = 'relative mb-4 min-h-11'
