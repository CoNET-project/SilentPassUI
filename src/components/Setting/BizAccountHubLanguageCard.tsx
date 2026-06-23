import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { persistBeamioProfileLocaleCurrency } from '@/services/beamio'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { applyBeamioUiLanguageFromProfile, getCurrentBeamioUiLocale } from '@/locale/i18n'
import { useTu } from '@/locale/beamioLocale'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'

/** Account Hub — global display language (persists to chain profile when wallet is unlocked). */
export function BizAccountHubLanguageCard() {
	const { tu } = useTu()
	const { beamio, setBeamio } = useDaemonContext()
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const locale = getCurrentBeamioUiLocale()

	const selectLocale = async (next: BeamioUiLocale) => {
		if (next === locale || saving) return
		setSaving(true)
		setError(null)
		try {
			const pk = getSessionPrivateKeyArmor()?.trim()
			if (beamio && pk) {
				const nextBeamio = await persistBeamioProfileLocaleCurrency(beamio, pk, { language: next })
				if (nextBeamio) {
					setBeamio({ ...nextBeamio })
					return
				}
				setError(tu('language_save_failed'))
			}
			await applyBeamioUiLanguageFromProfile(next)
		} catch {
			setError(tu('language_save_failed'))
			await applyBeamioUiLanguageFromProfile(next)
		} finally {
			setSaving(false)
		}
	}

	return (
		<div
			className={`${bizBrandFocusRingClass} flex w-full flex-col gap-4 rounded-lg bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center sm:gap-5`}
		>
			<div className="flex min-w-0 flex-1 items-start gap-5 sm:items-center">
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1f3] text-[#0051d1]">
					<Globe className="size-6" strokeWidth={2} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="font-bold text-slate-900">{tu('language')}</h3>
					<p className="mt-1 text-xs leading-relaxed text-[#595c5e]">{tu('account_hub_language_sub')}</p>
					{error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
				</div>
			</div>
			<div
				className="flex shrink-0 items-center gap-2 self-end sm:self-center"
				role="group"
				aria-label={tu('language')}
			>
				{saving ? <Loader2 className="size-4 animate-spin text-[#0051d1]" aria-hidden /> : null}
				<div className="flex rounded-full bg-[#eef1f3] p-1">
					<button
						type="button"
						disabled={saving}
						aria-pressed={locale === 'en'}
						onClick={() => void selectLocale('en')}
						className={`min-w-[3.25rem] rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
							locale === 'en' ? 'bg-white text-[#0051d1] shadow-sm' : 'text-[#595c5e] hover:text-[#2c2f31]'
						}`}
					>
						{tu('english')}
					</button>
					<button
						type="button"
						disabled={saving}
						aria-pressed={locale === 'zh-CN'}
						onClick={() => void selectLocale('zh-CN')}
						className={`min-w-[3.25rem] rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
							locale === 'zh-CN' ? 'bg-white text-[#0051d1] shadow-sm' : 'text-[#595c5e] hover:text-[#2c2f31]'
						}`}
					>
						{tu('simplified_chinese')}
					</button>
				</div>
			</div>
		</div>
	)
}
