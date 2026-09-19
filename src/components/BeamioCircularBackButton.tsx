import { ChevronLeft } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

/** Discover hero `onDark` disc — Share / Like must reuse this chrome. */
export const BEAMIO_ON_DARK_GLASS_DISC_CLASS =
	'border border-white/40 bg-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.28),0_1px_3px_rgba(0,0,0,0.18)]'

type BeamioCircularBackButtonProps = {
	onClick: () => void
	ariaLabel?: string
	className?: string
	disabled?: boolean
	/**
	 * `onLight` (default): dark chevron on frosted white — light sheets / grey shells.
	 * `onDark`: white chevron glass — only when floating over dark / photo heroes.
	 */
	variant?: 'onLight' | 'onDark'
} & Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	'type' | 'onClick' | 'children' | 'onPointerDown' | 'onPointerUp'
>

/**
 * iOS POS `SheetCircularBackButton` parity — frosted circular chevron with visible shadow.
 * Default `onLight` is readable on white / light grey pages (not white-on-white).
 * Uses reliable tap (pointerup) so App-level touchmove preventDefault cannot swallow clicks.
 * Hit target is 44×44 (visual disc remains ~36×36) for Discover hero / edge taps.
 * @see beamio-circular-back-button.mdc
 */
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
		? BEAMIO_ON_DARK_GLASS_DISC_CLASS
		: [
				'border border-black/[0.08] bg-white/90',
				'dark:border-white/25 dark:bg-slate-800/90',
				'shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(0,0,0,0.12)]',
			].join(' ')
	const chevronClass = isDark
		? 'text-white/80'
		: 'text-[#2c2f31] dark:text-slate-100'
	// Caller `absolute` / `fixed` must win — base `relative` otherwise steals layout
	// (Tailwind conflict order) and floats Confirm off the Back baseline.
	const positionClass = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'

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
				positionClass,
				'isolate inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-1',
				RELIABLE_TAP_BUTTON_CLASS,
				chevronClass,
				'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{/* Visual 36px disc — blur on non-interactive layer (backdrop-filter on the button can miss taps on iOS WebKit). */}
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

type BeamioHeroGlassIconButtonProps = {
	onClick: () => void
	children: ReactNode
	ariaLabel: string
	title?: string
	className?: string
	disabled?: boolean
	/** Keep full chrome when disabled (e.g. Liked heart). */
	keepOpacityWhenDisabled?: boolean
	ariaPressed?: boolean
} & Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	'type' | 'onClick' | 'children' | 'onPointerDown' | 'onPointerUp' | 'aria-pressed' | 'aria-label'
>

/**
 * Same 44×44 hit + 36px frosted disc as `BeamioCircularBackButton` `onDark`.
 * Use for Discover hero Share / Like so chrome matches Back.
 */
export function BeamioHeroGlassIconButton({
	onClick,
	children,
	ariaLabel,
	title,
	className = '',
	disabled = false,
	keepOpacityWhenDisabled = false,
	ariaPressed,
	...rest
}: BeamioHeroGlassIconButtonProps) {
	const tap = useReliableTapHandler(onClick)
	const positionClass = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'

	return (
		<button
			type="button"
			tabIndex={-1}
			disabled={disabled}
			data-touch-priority="1"
			aria-label={ariaLabel}
			aria-pressed={ariaPressed}
			title={title}
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
				positionClass,
				'isolate inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-1',
				RELIABLE_TAP_BUTTON_CLASS,
				'text-white/80 transition-colors duration-150 disabled:pointer-events-none',
				keepOpacityWhenDisabled ? '' : 'disabled:opacity-40',
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			<span
				className={['pointer-events-none absolute inset-1 rounded-full', BEAMIO_ON_DARK_GLASS_DISC_CLASS].join(' ')}
				aria-hidden
			>
				<span className="absolute inset-0 rounded-full backdrop-blur-md" aria-hidden />
			</span>
			<span className="relative z-[1] inline-flex items-center justify-center">{children}</span>
		</button>
	)
}
