import React, { createContext, useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'

export const BeamioLocaleVersionContext = createContext(0)

/** Keeps a stable app tree while forcing `useTu()` consumers to re-render on locale changes. */
export function BeamioLocaleRoot({ children }: { children: React.ReactNode }) {
	const [localeVersion, setLocaleVersion] = useState(0)

	useEffect(() => {
		const bump = () => setLocaleVersion((v) => v + 1)
		const inst = i18n as unknown as {
			on?: (event: string, cb: () => void) => void
			off?: (event: string, cb: () => void) => void
		}
		inst.on?.('languageChanged', bump)
		window.addEventListener('beamio:biz-ui-locale-changed', bump)
		return () => {
			inst.off?.('languageChanged', bump)
			window.removeEventListener('beamio:biz-ui-locale-changed', bump)
		}
	}, [])

	return (
		<I18nextProvider i18n={i18n}>
			<BeamioLocaleVersionContext.Provider value={localeVersion}>
				{children}
			</BeamioLocaleVersionContext.Provider>
		</I18nextProvider>
	)
}
