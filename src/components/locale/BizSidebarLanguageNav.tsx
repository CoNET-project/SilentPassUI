import { Globe } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'
import { useBizLocaleSelect } from '@/components/locale/useBizLocaleSelect'

type BizSidebarLanguageNavProps = {
	collapsed: boolean
}

/** Left sidebar System section — language switch (same picker as onboarding / Configuration). */
export function BizSidebarLanguageNav({ collapsed }: BizSidebarLanguageNavProps) {
	const { tu } = useTu()
	const { locale, selectLocale, saving, error } = useBizLocaleSelect()

	if (collapsed) {
		return (
			<div className="mx-2 flex justify-center py-1" title={tu('language')}>
				<BeamioLocalePicker
					locale={locale}
					onSelect={selectLocale}
					saving={saving}
					iconOnly
					menuAlign="left"
				/>
			</div>
		)
	}

	return (
		<div
			className="mx-2 flex min-w-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600"
			title={error ?? tu('language')}
		>
			<Globe size={20} strokeWidth={2} className="shrink-0 text-slate-600" aria-hidden />
			<span className="min-w-0 flex-1 truncate text-left">{tu('language')}</span>
			<BeamioLocalePicker
				locale={locale}
				onSelect={selectLocale}
				saving={saving}
				showGlobeIcon={false}
				menuAlign="right"
			/>
		</div>
	)
}
