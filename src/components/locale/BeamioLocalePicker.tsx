import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe, Loader2 } from 'lucide-react'
import { getCurrentBeamioUiLocale } from '@/locale/i18n'
import { useTu } from '@/locale/beamioLocale'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'

export type BeamioLocalePickerProps = {
	/** Defaults to `getCurrentBeamioUiLocale()`. */
	locale?: BeamioUiLocale
	onSelect: (next: BeamioUiLocale) => void | Promise<void>
	disabled?: boolean
	saving?: boolean
	/** Globe-only circular trigger (collapsed sidebar). */
	iconOnly?: boolean
	/** Hide leading Globe on pill trigger (sidebar row supplies its own icon). */
	showGlobeIcon?: boolean
	/** Align dropdown to trailing edge (onboarding top-right). */
	menuAlign?: 'left' | 'right'
}

const TRIGGER_CLASS = `inline-flex h-10 items-center gap-1.5 rounded-full border border-[#abadaf]/35 bg-white/90 px-3 text-xs font-semibold text-[#595c5e] shadow-sm transition-colors hover:bg-[#eef1f3] active:scale-95 ${bizBrandFocusRingClass}`

const ICON_ONLY_TRIGGER_CLASS = `inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#abadaf]/35 bg-white/90 text-[#595c5e] shadow-sm transition-colors hover:bg-[#eef1f3] active:scale-95 ${bizBrandFocusRingClass}`

/** Business Lite locale dropdown — Globe + short label + chevron (onboarding / Configuration). */
export function BeamioLocalePicker({
	locale: localeProp,
	onSelect,
	disabled = false,
	saving = false,
	iconOnly = false,
	showGlobeIcon = true,
	menuAlign = 'right',
}: BeamioLocalePickerProps) {
	const { tu } = useTu()
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const locale = localeProp ?? getCurrentBeamioUiLocale()
	const isDisabled = disabled || saving

	useEffect(() => {
		if (!open) return
		const onDocumentClick = (e: MouseEvent) => {
			const el = rootRef.current
			if (el && e.target instanceof Node && !el.contains(e.target)) {
				setOpen(false)
			}
		}
		document.addEventListener('click', onDocumentClick)
		return () => {
			document.removeEventListener('click', onDocumentClick)
		}
	}, [open])

	const selectLocale = async (next: BeamioUiLocale) => {
		setOpen(false)
		if (next === locale || isDisabled) return
		await onSelect(next)
	}

	const menuPosClass = menuAlign === 'right' ? 'right-0' : 'left-0'

	return (
		<div ref={rootRef} className="relative shrink-0">
			<button
				type="button"
				aria-label={tu('language')}
				aria-haspopup="listbox"
				aria-expanded={open}
				disabled={isDisabled}
				onClick={() => setOpen((v) => !v)}
				className={iconOnly ? ICON_ONLY_TRIGGER_CLASS : TRIGGER_CLASS}
			>
				{saving ? (
					<Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1562f0]" strokeWidth={2} aria-hidden />
				) : showGlobeIcon || iconOnly ? (
					<Globe className="h-4 w-4 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
				) : null}
				{!iconOnly ? (
					<>
						<span>{locale === 'zh-CN' ? '中文' : 'EN'}</span>
						<ChevronDown
							className={`h-3.5 w-3.5 shrink-0 text-[#747779] transition-transform ${open ? 'rotate-180' : ''}`}
							strokeWidth={2.5}
							aria-hidden
						/>
					</>
				) : null}
			</button>
			{open ? (
				<div
					role="listbox"
					aria-label={tu('language')}
					className={`absolute ${menuPosClass} z-[200] mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-[#abadaf]/25 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]`}
				>
					<button
						type="button"
						role="option"
						aria-selected={locale === 'en'}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => void selectLocale('en')}
						className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[#eef1f3] ${
							locale === 'en' ? 'text-[#1562f0]' : 'text-[#2c2f31]'
						}`}
					>
						{tu('english')}
					</button>
					<button
						type="button"
						role="option"
						aria-selected={locale === 'zh-CN'}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => void selectLocale('zh-CN')}
						className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[#eef1f3] ${
							locale === 'zh-CN' ? 'text-[#1562f0]' : 'text-[#2c2f31]'
						}`}
					>
						{tu('simplified_chinese')}
					</button>
				</div>
			) : null}
		</div>
	)
}
