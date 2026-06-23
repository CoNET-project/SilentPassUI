import { useState } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { persistBeamioProfileLocaleCurrency, persistBeamioLanguageLocally } from '@/services/beamio'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import { applyBeamioUiLanguageFromProfile } from '@/locale/i18n'
import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'

/** Shared biz locale switch — chain profile when unlocked, else local bootstrap. */
export function useBizLocaleSelect() {
	const { tu } = useTu()
	const { beamio, setBeamio } = useDaemonContext()
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	// useTu subscription — re-read locale after global language switch
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
			const localBo = await persistBeamioLanguageLocally(beamio, next)
			if (localBo) {
				setBeamio({ ...localBo })
				return
			}
			if (!beamio) {
				await applyBeamioUiLanguageFromProfile(next)
			}
		} catch {
			setError(tu('language_save_failed'))
			await persistBeamioLanguageLocally(beamio, next)
		} finally {
			setSaving(false)
		}
	}

	return { locale, selectLocale, saving, error }
}
