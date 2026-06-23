import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { applyBeamioUiLanguageFromProfile, getCurrentBeamioUiLocale } from '@/locale/i18n'
import { writeBeamioUiLanguageBootstrap } from '@/utils/beamioProfileLocaleCurrency'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { useTu } from '@/locale/beamioLocale'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'

/** Business Lite onboarding — top-right EN / 简体中文 picker (pre-login UI only). */
export function BizOnboardingLocalePicker() {
	const { tu: tui } = useTu()
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const locale = getCurrentBeamioUiLocale()

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
		if (next === locale) return
		writeBeamioUiLanguageBootstrap(next)
		await applyBeamioUiLanguageFromProfile(next)
	}

	return (
		<div ref={rootRef} className="relative shrink-0">
			<button
				type="button"
				aria-label={tui('language')}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={`inline-flex h-10 items-center gap-1.5 rounded-full border border-[#abadaf]/35 bg-white/90 px-3 text-xs font-semibold text-[#595c5e] shadow-sm transition-colors hover:bg-[#eef1f3] active:scale-95 ${bizBrandFocusRingClass}`}
			>
				<Globe className="h-4 w-4 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
				<span>{locale === 'zh-CN' ? '中文' : 'EN'}</span>
				<ChevronDown
					className={`h-3.5 w-3.5 shrink-0 text-[#747779] transition-transform ${open ? 'rotate-180' : ''}`}
					strokeWidth={2.5}
					aria-hidden
				/>
			</button>
			{open ? (
				<div
					role="listbox"
					aria-label={tui('language')}
					className="absolute right-0 z-[200] mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-[#abadaf]/25 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
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
						{tui('english')}
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
						{tui('simplified_chinese')}
					</button>
				</div>
			) : null}
		</div>
	)
}
