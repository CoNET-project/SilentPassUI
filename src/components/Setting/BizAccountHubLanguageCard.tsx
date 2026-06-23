import { Globe } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'
import { useBizLocaleSelect } from '@/components/locale/useBizLocaleSelect'

/** Account Hub — global display language (persists to chain profile when wallet is unlocked). */
export function BizAccountHubLanguageCard() {
	const { tu } = useTu()
	const { locale, selectLocale, saving, error } = useBizLocaleSelect()

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
			<div className="flex shrink-0 self-end sm:self-center">
				<BeamioLocalePicker
					locale={locale}
					onSelect={selectLocale}
					saving={saving}
					menuAlign="right"
				/>
			</div>
		</div>
	)
}
