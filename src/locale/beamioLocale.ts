import { useCallback, useEffect, useState } from 'react'
import i18n, { t, type BeamioUiLocale, getCurrentBeamioUiLocale } from './i18n'

export { t, type BeamioUiLocale, getCurrentBeamioUiLocale }

/** Shorthand for UI copy: `ui.redeem_code` or full key `ui:redeem_code` */
export function tu(key: string, options?: Record<string, unknown>): string {
	const fullKey = key.includes('.') ? key : `ui.${key}`
	return t(fullKey, options)
}

/**
 * Live UI strings — re-render when i18n language changes.
 * Static `tu()` alone only updates after navigation / parent re-render.
 */
export function useTu() {
	const [localeVersion, setLocaleVersion] = useState(0)

	useEffect(() => {
		const bump = () => setLocaleVersion((v) => v + 1)
		const inst = i18n as unknown as {
			on?: (event: string, cb: () => void) => void
			off?: (event: string, cb: () => void) => void
		}
		inst.on?.('languageChanged', bump)
		return () => {
			inst.off?.('languageChanged', bump)
		}
	}, [])

	const translate = useCallback(
		(key: string, options?: Record<string, unknown>) => {
			const fullKey = key.includes('.') ? key : `ui.${key}`
			return t(fullKey, options)
		},
		[localeVersion],
	)
	return { tu: translate, i18n }
}
