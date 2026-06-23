import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { persistBeamioProfileLocaleCurrency, persistBeamioLanguageLocally } from '@/services/beamio'
import { getCurrentBeamioUiLocale } from '@/locale/i18n'
import { useTu } from '@/locale/beamioLocale'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'

type HomeLanguageSelectorProps = {
	capsuleOpacity: number
}

/** Home fixed capsule — compact EN / 简体中文 segmented control (top-right). */
export function HomeLanguageSelector({ capsuleOpacity }: HomeLanguageSelectorProps) {
	const { tu } = useTu()
	const { beamio, setBeamio, profiles } = useDaemonContext()
	const [saving, setSaving] = useState(false)
	const locale = getCurrentBeamioUiLocale()
	const pointerEvents = capsuleOpacity < 0.05 ? 'none' : 'auto'

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
		<div
			className="flex shrink-0 items-center gap-1"
			role="group"
			aria-label={tu('language')}
			style={{ pointerEvents }}
		>
			{saving ? (
				<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" aria-hidden />
			) : null}
			<div className="flex rounded-full border border-slate-100/90 bg-white p-0.5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800">
				<button
					type="button"
					disabled={saving}
					aria-pressed={locale === 'en'}
					aria-label={tu('english')}
					onClick={() => void selectLocale('en')}
					className={`min-w-[2rem] rounded-full px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-60 sm:min-w-[2.25rem] sm:px-2.5 sm:text-[11px] ${
						locale === 'en'
							? 'bg-[#eef1f3] text-[#0051d1] shadow-sm dark:bg-slate-700 dark:text-blue-400'
							: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
					}`}
				>
					EN
				</button>
				<button
					type="button"
					disabled={saving}
					aria-pressed={locale === 'zh-CN'}
					aria-label={tu('simplified_chinese')}
					onClick={() => void selectLocale('zh-CN')}
					className={`min-w-[2rem] rounded-full px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-60 sm:min-w-[2.25rem] sm:px-2.5 sm:text-[11px] ${
						locale === 'zh-CN'
							? 'bg-[#eef1f3] text-[#0051d1] shadow-sm dark:bg-slate-700 dark:text-blue-400'
							: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
					}`}
				>
					{tu('simplified_chinese_short')}
				</button>
			</div>
		</div>
	)
}
