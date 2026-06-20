import { t, type BeamioUiLocale, getCurrentBeamioUiLocale } from './i18n'

export { t, type BeamioUiLocale, getCurrentBeamioUiLocale }

/** Shorthand for UI copy: `ui.redeem_code` or full key `ui:redeem_code` */
export function tu(key: string, options?: Record<string, unknown>): string {
	const fullKey = key.includes('.') ? key : `ui.${key}`
	return t(fullKey, options)
}
