import React from 'react'

/**
 * i18n wrapper — do NOT remount the tree on language change.
 * Remounting resets route/modal state (e.g. profile → Language & Currency slide-over).
 * Components that need live locale use `useTranslation()`; static `tu()` updates on navigation.
 */
export function BeamioLocaleRoot({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}
