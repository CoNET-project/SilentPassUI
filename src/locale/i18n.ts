import i18next, { changeLanguage, t as i18nT } from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import zhCN from './zh-CN.json'

export type BeamioUiLocale = 'en' | 'zh-CN'

export const BEAMIO_UI_LOCALE_STORAGE_KEY = 'beamio:biz:ui-locale'

export function normalizeBeamioUiLocale(raw: unknown): BeamioUiLocale {
	if (raw === 'en' || raw === 'zh-CN') return raw
	return 'zh-CN'
}

export function getStoredBeamioUiLocale(): BeamioUiLocale {
	if (typeof window === 'undefined') return 'zh-CN'
	try {
		return normalizeBeamioUiLocale(localStorage.getItem(BEAMIO_UI_LOCALE_STORAGE_KEY))
	} catch {
		return 'zh-CN'
	}
}

export function applyDocumentLang(locale: BeamioUiLocale): void {
	if (typeof document === 'undefined') return
	document.documentElement.lang = locale === 'zh-CN' ? 'zh-Hans' : 'en'
}

void i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		'zh-CN': { translation: zhCN },
	},
	lng: getStoredBeamioUiLocale(),
	fallbackLng: 'en',
	supportedLngs: ['en', 'zh-CN'],
	interpolation: { escapeValue: false },
	returnEmptyString: false,
})

applyDocumentLang(getStoredBeamioUiLocale())

export async function setBeamioUiLocale(locale: BeamioUiLocale): Promise<void> {
	const next = normalizeBeamioUiLocale(locale)
	try {
		localStorage.setItem(BEAMIO_UI_LOCALE_STORAGE_KEY, next)
	} catch {
		/* ignore */
	}
	applyDocumentLang(next)
	await changeLanguage(next)
}

export function getCurrentBeamioUiLocale(): BeamioUiLocale {
	return getStoredBeamioUiLocale()
}

/** Sync UI locale from persisted beamio profile language field. */
export async function syncBeamioUiLocaleFromProfileLanguage(language: unknown): Promise<void> {
	const next = normalizeBeamioUiLocale(language)
	const stored = getStoredBeamioUiLocale()
	if (stored === next) return
	await setBeamioUiLocale(next)
}

const translate = i18nT as unknown as (key: string, options?: Record<string, unknown>) => string

export function t(key: string, options?: Record<string, unknown>): string {
	return translate(key, options)
}

export default i18next
