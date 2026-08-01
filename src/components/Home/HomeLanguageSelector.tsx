import { useState } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { persistBeamioProfileLocaleCurrency, persistBeamioLanguageLocally } from '@/services/beamio'
import { getCurrentBeamioUiLocale } from '@/locale/i18n'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'

/** Home fixed capsule — same dropdown as onboarding (`BeamioLocalePicker`). */
export function HomeLanguageSelector() {
	const { beamio, setBeamio, profiles } = useDaemonContext()
	const [saving, setSaving] = useState(false)
	const locale = getCurrentBeamioUiLocale()

	const selectLocale = async (next: BeamioUiLocale) => {
		if (next === locale || saving) return
		setSaving(true)
		try {
			const pk = resolveSigningPrivateKeyArmor(profiles?.[0])
			if (beamio && pk) {
				const nextBeamio = await persistBeamioProfileLocaleCurrency(beamio, pk, { language: next })
				if (nextBeamio) {
					setBeamio({ ...nextBeamio })
					return
				}
			}
			const localBo = await persistBeamioLanguageLocally(beamio, next)
			if (localBo) setBeamio({ ...localBo })
		} catch {
			await persistBeamioLanguageLocally(beamio, next)
		} finally {
			setSaving(false)
		}
	}

	return (
		<div data-capsule-interactive>
			<BeamioLocalePicker
				variant="home"
				menuAlign="right"
				locale={locale}
				saving={saving}
				onSelect={selectLocale}
			/>
		</div>
	)
}
