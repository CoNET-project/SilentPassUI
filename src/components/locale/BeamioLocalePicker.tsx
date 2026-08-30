import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, Globe, Loader2 } from 'lucide-react'
import { getCurrentBeamioUiLocale } from '@/locale/i18n'
import { useTu } from '@/locale/beamioLocale'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'

export type BeamioLocalePickerVariant = 'hero' | 'home' | 'create'

export type BeamioLocalePickerProps = {
	/** Defaults to `getCurrentBeamioUiLocale()`. */
	locale?: BeamioUiLocale
	onSelect: (next: BeamioUiLocale) => void | Promise<void>
	disabled?: boolean
	saving?: boolean
	pointerEvents?: CSSProperties['pointerEvents']
	variant?: BeamioLocalePickerVariant
	/** Home top-right: align menu to trailing edge. */
	menuAlign?: 'left' | 'right'
}

const TRIGGER_CLASS: Record<BeamioLocalePickerVariant, string> = {
	hero: 'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60',
	home: 'inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-100/90 bg-white px-3 text-xs font-semibold text-[#0F172A] shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80',
	create:
		'inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#dce2f3] text-[14px] font-medium leading-5 text-[#424655] transition-colors hover:bg-[#d3daea] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35 disabled:opacity-60',
}

const CHEVRON_CLASS: Record<BeamioLocalePickerVariant, string> = {
	hero: 'h-3.5 w-3.5 shrink-0 opacity-80 transition-transform',
	home: 'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform dark:text-slate-400',
	create: 'hidden',
}

const GLOBE_CLASS: Record<BeamioLocalePickerVariant, string> = {
	hero: 'h-3.5 w-3.5 shrink-0 opacity-90',
	home: 'h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400',
	create: 'hidden',
}

/** Onboarding-style locale dropdown (Globe + label + chevron). Shared by splash hero and Home capsule. */
export function BeamioLocalePicker({
	locale: localeProp,
	onSelect,
	disabled = false,
	saving = false,
	pointerEvents,
	variant = 'hero',
	menuAlign = 'left',
}: BeamioLocalePickerProps) {
	const { tu } = useTu()
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const locale = localeProp ?? getCurrentBeamioUiLocale()
	const isDisabled = disabled || saving

	useEffect(() => {
		if (!open) return
		const onPointerDown = (e: MouseEvent | TouchEvent) => {
			const el = rootRef.current
			if (el && e.target instanceof Node && !el.contains(e.target)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', onPointerDown)
		document.addEventListener('touchstart', onPointerDown)
		return () => {
			document.removeEventListener('mousedown', onPointerDown)
			document.removeEventListener('touchstart', onPointerDown)
		}
	}, [open])

	const selectLocale = async (next: BeamioUiLocale) => {
		setOpen(false)
		if (next === locale || isDisabled) return
		await onSelect(next)
	}

	const menuPosClass = menuAlign === 'right' ? 'right-0' : 'left-0'

	return (
		<div ref={rootRef} className="relative shrink-0" style={pointerEvents != null ? { pointerEvents } : undefined}>
			<button
				type="button"
				aria-label={tu('language')}
				aria-haspopup="listbox"
				aria-expanded={open}
				disabled={isDisabled}
				onClick={() => setOpen((v) => !v)}
				className={TRIGGER_CLASS[variant]}
			>
				{saving ? (
					<Loader2
						className={
							variant === 'create'
								? 'h-3.5 w-3.5 animate-spin text-[#424655]'
								: `${GLOBE_CLASS[variant]} animate-spin`
						}
						strokeWidth={2}
						aria-hidden
					/>
				) : (
					<Globe className={GLOBE_CLASS[variant]} strokeWidth={2} aria-hidden />
				)}
				{variant === 'create' && saving ? null : (
					<span>{locale === 'zh-CN' ? tu('simplified_chinese_short') : 'EN'}</span>
				)}
				{variant === 'create' && saving ? null : (
					<ChevronDown
						className={`${CHEVRON_CLASS[variant]} ${open ? 'rotate-180' : ''}`}
						strokeWidth={2.5}
						aria-hidden
					/>
				)}
			</button>
			{open ? (
				<div
					role="listbox"
					aria-label={tu('language')}
					className={
						variant === 'create'
							? `absolute ${menuPosClass} z-50 mt-2 min-w-[9.5rem] overflow-hidden rounded-xl border border-[#c3c6d8]/80 bg-white py-1 shadow-lg`
							: `absolute ${menuPosClass} z-50 mt-2 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/20 bg-[#0e4cbb]/95 py-1 shadow-lg backdrop-blur-md`
					}
				>
					<button
						type="button"
						role="option"
						aria-selected={locale === 'en'}
						onClick={() => void selectLocale('en')}
						className={
							variant === 'create'
								? `flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[#f0f3ff] ${
										locale === 'en' ? 'text-[#004bc3]' : 'text-[#151c27]'
									}`
								: `flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10 ${
										locale === 'en' ? 'text-[#fef9c3]' : 'text-white/90'
									}`
						}
					>
						{tu('english')}
					</button>
					<button
						type="button"
						role="option"
						aria-selected={locale === 'zh-CN'}
						onClick={() => void selectLocale('zh-CN')}
						className={
							variant === 'create'
								? `flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[#f0f3ff] ${
										locale === 'zh-CN' ? 'text-[#004bc3]' : 'text-[#151c27]'
									}`
								: `flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-white/10 ${
										locale === 'zh-CN' ? 'text-[#fef9c3]' : 'text-white/90'
									}`
						}
					>
						{tu('simplified_chinese')}
					</button>
				</div>
			) : null}
		</div>
	)
}
