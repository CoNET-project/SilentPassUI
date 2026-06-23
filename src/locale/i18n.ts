import i18nextLib, { changeLanguage, t as i18nT } from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import zhCN from './zh-CN.json'
import {
	normalizeBeamioUiLocale,
	resolveColdStartUiLocale,
	type BeamioUiLocale,
} from '@/utils/beamioProfileLocaleCurrency'

export type { BeamioUiLocale }

function readActiveI18nLanguage(): string {
	const inst = i18nextLib as { language?: string; languages?: readonly string[] }
	return inst.language ?? inst.languages?.[0] ?? 'en'
}

/** @deprecated Profile `beamio.language` is canonical — do not write UI locale here. */
export const BEAMIO_UI_LOCALE_STORAGE_KEY = 'beamio:ui-locale'

function removeLegacyUiLocaleStorage(): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(BEAMIO_UI_LOCALE_STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

removeLegacyUiLocaleStorage()

export function applyDocumentLang(locale: BeamioUiLocale): void {
	if (typeof document === 'undefined') return
	document.documentElement.lang = locale === 'zh-CN' ? 'zh-Hans' : 'en'
}

void i18nextLib.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		'zh-CN': { translation: zhCN },
	},
	lng: resolveColdStartUiLocale(),
	fallbackLng: 'en',
	supportedLngs: ['en', 'zh-CN'],
	interpolation: { escapeValue: false },
	returnEmptyString: false,
})

applyDocumentLang(resolveColdStartUiLocale())

/** Apply UI language from profile field (single canonical path). */
export async function applyBeamioUiLanguageFromProfile(language: unknown): Promise<void> {
	const next = normalizeBeamioUiLocale(language)
	if (readActiveI18nLanguage() === next) {
		applyDocumentLang(next)
		return
	}
	applyDocumentLang(next)
	await changeLanguage(next)
}

/** @deprecated Use applyBeamioUiLanguageFromProfile(beamio.language) */
export async function setBeamioUiLocale(locale: BeamioUiLocale): Promise<void> {
	await applyBeamioUiLanguageFromProfile(locale)
}

/** @deprecated Profile language is canonical */
export function getStoredBeamioUiLocale(): BeamioUiLocale {
	return normalizeBeamioUiLocale(readActiveI18nLanguage())
}

export function getCurrentBeamioUiLocale(): BeamioUiLocale {
	return normalizeBeamioUiLocale(readActiveI18nLanguage())
}

/** @deprecated Use applyBeamioUiLanguageFromProfile */
export async function syncBeamioUiLocaleFromProfileLanguage(language: unknown): Promise<void> {
	await applyBeamioUiLanguageFromProfile(language)
}

const translate = i18nT as unknown as (key: string, options?: Record<string, unknown>) => string

export function t(key: string, options?: Record<string, unknown>): string {
	return translate(key, options)
}

export default i18nextLib
