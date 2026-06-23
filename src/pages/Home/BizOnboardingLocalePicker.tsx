import { applyBeamioUiLanguageFromProfile } from '@/locale/i18n'
import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'
import { writeBeamioUiLanguageBootstrap } from '@/utils/beamioProfileLocaleCurrency'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'

/** Business Lite onboarding — top-right EN / 简体中文 picker (pre-login UI only). */
export function BizOnboardingLocalePicker() {
	useTu()
	const locale = getCurrentBeamioUiLocale()

	const selectLocale = async (next: BeamioUiLocale) => {
		if (next === locale) return
		writeBeamioUiLanguageBootstrap(next)
		await applyBeamioUiLanguageFromProfile(next)
	}

	return <BeamioLocalePicker locale={locale} onSelect={selectLocale} menuAlign="right" />
}
