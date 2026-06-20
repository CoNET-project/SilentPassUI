import React from 'react'
import { useTranslation } from 'react-i18next'

/** Remount subtree when UI locale changes so `t()` imports re-render. */
export function BeamioLocaleRoot({ children }: { children: React.ReactNode }) {
	const { i18n } = useTranslation()
	return <React.Fragment key={i18n.language}>{children}</React.Fragment>
}
