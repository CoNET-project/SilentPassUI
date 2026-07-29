import { ChevronLeft } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

type BeamioCircularBackButtonProps = {
	onClick: () => void
	ariaLabel?: string
	className?: string
	disabled?: boolean
} & Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	'type' | 'onClick' | 'children' | 'onPointerDown' | 'onPointerUp'
>

/**
 * iOS POS `SheetCircularBackButton` parity — frosted circular chevron, floating with shadow.
 * Uses reliable tap (pointerup) so App-level touchmove preventDefault cannot swallow clicks on mobile.
 * Hit target is 44×44 (visual disc remains ~36×36) for Discover hero / edge taps.
 * @see src/posPwa/src/components/BeamioCircularBackButton.tsx
 */
export function BeamioCircularBackButton({
	onClick,
	ariaLabel = tu('back'),
	className = '',
	disabled = false,
	...rest
}: BeamioCircularBackButtonProps) {
	const tap = useReliableTapHandler(onClick)
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
				'text-white/80',
				'transition active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40',
				className,
			].join(' ')}
		>
			{/* Visual 36px disc — blur on non-interactive layer (backdrop-filter on the button can miss taps on iOS WebKit). */}
			<span
				className="pointer-events-none absolute inset-1 rounded-full border border-white/40 bg-white/20 shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:border-white/40 dark:bg-white/20"
				aria-hidden
			>
				<span className="absolute inset-0 rounded-full backdrop-blur-md dark:backdrop-blur-md" aria-hidden />
			</span>
			<ChevronLeft className="relative z-[1] h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
		</button>
	)
}

/** Reserve vertical space for a top-leading floating back control (44px hit + breathing room). */
export const BEAMIO_CIRCULAR_BACK_ROW_CLASS = 'relative mb-4 min-h-11'

/**
 * Hero / gradient header overlay — Discover merchant detail + contact profile (single source).
 * @see beamio-circular-back-button.mdc § Hero overlay placement
 */
export const BEAMIO_HERO_FLOATING_BACK_ROW_CLASS =
	'absolute left-0 right-0 z-40 flex items-start justify-between px-4'

export const beamioHeroFloatingBackTopStyle = {
	top: 'max(0.75rem, env(safe-area-inset-top))',
} as const
