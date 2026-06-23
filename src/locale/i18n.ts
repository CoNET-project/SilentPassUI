import i18nextLib from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
	detectBrowserBeamioLocale,
	normalizeBeamioUiLocale,
	readBeamioUiLanguageBootstrap,
	type BeamioUiLocale,
} from '@/utils/beamioProfileLocaleCurrency'
import en from './en.json'
import zhCN from './zh-CN.json'
import programsEn from './programsLocale.en.json'
import programsZhCN from './programsLocale.zh-CN.json'

function mergeProgramsUiLocale<T extends { ui: Record<string, string> }>(base: T, programs: Record<string, string>): T {
	return {
		...base,
		ui: {
			...base.ui,
			...programs,
		},
	}
}

const enMerged = mergeProgramsUiLocale(en as { ui: Record<string, string> }, programsEn)
const zhCNMerged = mergeProgramsUiLocale(zhCN as { ui: Record<string, string> }, programsZhCN)

export type { BeamioUiLocale }

function readActiveI18nLanguage(): string {
	const inst = i18nextLib as { language?: string; languages?: readonly string[] }
	return inst.language ?? inst.languages?.[0] ?? 'en'
}

/** @deprecated Profile `beamio.language` is canonical */
export const BEAMIO_UI_LOCALE_STORAGE_KEY = 'beamio:biz:ui-locale'

function removeLegacyUiLocaleStorage(): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(BEAMIO_UI_LOCALE_STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

/** Pre-login onboarding picker choice (session-only; cleared when tab closes). */
export const BEAMIO_ONBOARDING_UI_LOCALE_SESSION_KEY = 'beamio:biz:onboarding-ui-locale'

function readOnboardingUiLocaleSession(): BeamioUiLocale | null {
	if (typeof sessionStorage === 'undefined') return null
	try {
		const raw = sessionStorage.getItem(BEAMIO_ONBOARDING_UI_LOCALE_SESSION_KEY)
		if (!raw) return null
		return normalizeBeamioUiLocale(raw)
	} catch {
		return null
	}
}

function writeOnboardingUiLocaleSession(locale: BeamioUiLocale): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.setItem(BEAMIO_ONBOARDING_UI_LOCALE_SESSION_KEY, locale)
	} catch {
		/* ignore */
	}
}

function resolveInitialUiLocale(): BeamioUiLocale {
	return readBeamioUiLanguageBootstrap() ?? readOnboardingUiLocaleSession() ?? detectBrowserBeamioLocale()
}

function resolveCurrentTranslationLocale(): BeamioUiLocale {
	// Runtime truth: i18next active language (updated by applyBeamioUiLanguageFromProfile).
	const active = normalizeBeamioUiLocale(readActiveI18nLanguage())
	if (active) return active
	return readBeamioUiLanguageBootstrap() ?? readOnboardingUiLocaleSession() ?? detectBrowserBeamioLocale()
}

removeLegacyUiLocaleStorage()

export function applyDocumentLang(locale: BeamioUiLocale): void {
	if (typeof document === 'undefined') return
	document.documentElement.lang = locale === 'zh-CN' ? 'zh-Hans' : 'en'
}

function emitBeamioUiLocaleChanged(locale: BeamioUiLocale): void {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent('beamio:biz-ui-locale-changed', { detail: { locale } }))
}

void i18nextLib.use(initReactI18next).init({
	resources: {
		en: { translation: enMerged },
		'zh-CN': { translation: zhCNMerged },
	},
	lng: resolveInitialUiLocale(),
	fallbackLng: 'en',
	supportedLngs: ['en', 'zh-CN'],
	nonExplicitSupportedLngs: true,
	load: 'currentOnly',
	interpolation: { escapeValue: false },
	returnEmptyString: false,
	react: {
		useSuspense: false,
	},
})

applyDocumentLang(resolveInitialUiLocale())

export async function applyBeamioUiLanguageFromProfile(language: unknown): Promise<void> {
	const next = normalizeBeamioUiLocale(language)
	writeOnboardingUiLocaleSession(next)
	if (readActiveI18nLanguage() === next) {
		applyDocumentLang(next)
		emitBeamioUiLocaleChanged(next)
		return
	}
	applyDocumentLang(next)
	await (i18nextLib as unknown as { changeLanguage: (lng: string) => Promise<unknown> }).changeLanguage(next)
	emitBeamioUiLocaleChanged(next)
}

export async function setBeamioUiLocale(locale: BeamioUiLocale): Promise<void> {
	await applyBeamioUiLanguageFromProfile(locale)
}

export function getStoredBeamioUiLocale(): BeamioUiLocale {
	return normalizeBeamioUiLocale(readActiveI18nLanguage())
}

export function getCurrentBeamioUiLocale(): BeamioUiLocale {
	return resolveCurrentTranslationLocale()
}

export async function syncBeamioUiLocaleFromProfileLanguage(language: unknown): Promise<void> {
	await applyBeamioUiLanguageFromProfile(language)
}

const TRANSLATION_RESOURCES: Record<BeamioUiLocale, unknown> = {
	en: enMerged,
	'zh-CN': zhCNMerged,
}

function readTranslationValue(resource: unknown, key: string): string | null {
	const parts = key.split('.').filter(Boolean)
	let cursor: unknown = resource
	for (const part of parts) {
		if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return null
		cursor = (cursor as Record<string, unknown>)[part]
	}
	return typeof cursor === 'string' ? cursor : null
}

function interpolateTranslation(value: string, options?: Record<string, unknown>): string {
	if (!options) return value
	return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey: string) => {
		const key = String(rawKey).trim()
		const next = options[key]
		return next === undefined || next === null ? '' : String(next)
	})
}

export function t(key: string, options?: Record<string, unknown>): string {
	const locale = resolveCurrentTranslationLocale()
	const localized = readTranslationValue(TRANSLATION_RESOURCES[locale], key)
	const fallback = locale === 'en' ? null : readTranslationValue(TRANSLATION_RESOURCES.en, key)
	return interpolateTranslation(localized ?? fallback ?? key, options)
}

export default i18nextLib
