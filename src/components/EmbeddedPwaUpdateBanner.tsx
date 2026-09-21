import React, { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'
import {
	isEmbeddedPwaOtaSupported,
	readEmbeddedPwaPendingVersion,
	readEmbeddedPwaVersion,
	requestEmbeddedPwaUpdateApply,
	subscribeApplyEmbeddedPwaUpdateResult,
	subscribeEmbeddedPwaUpdateAvailable,
} from '@/utils/cashTreesEmbeddedPwaUpdate'

/**
 * Native-shell OTA banner for the Consumer PWA.
 *
 * The native daemon downloads the bundle in the background and emits an
 * event. Keep the banner persistent until the user explicitly applies it.
 */
export function EmbeddedPwaUpdateBanner(): React.ReactElement | null {
	const [pendingVersion, setPendingVersion] = useState('')
	const [currentVersion, setCurrentVersion] = useState('')
	const [applying, setApplying] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!isEmbeddedPwaOtaSupported()) return undefined

		setCurrentVersion(readEmbeddedPwaVersion())
		const pending = readEmbeddedPwaPendingVersion()
		if (pending) setPendingVersion(pending)

		const offAvailable = subscribeEmbeddedPwaUpdateAvailable(({ currentVer, pendingVer }) => {
			setCurrentVersion(currentVer)
			setPendingVersion(pendingVer)
			setError('')
		})
		const offApply = subscribeApplyEmbeddedPwaUpdateResult(({ ok, ver, error: applyError }) => {
			setApplying(false)
			if (ok) {
				setCurrentVersion(ver || readEmbeddedPwaVersion())
				setPendingVersion('')
				setError('')
				return
			}
			// A native shell may have already consumed or discarded the staged
			// bundle while the page was being recreated. Do not keep a stale
			// "Update ready" banner visible when the bridge says no bundle
			// remains; the next native poll can advertise it again.
			const actualPendingVersion = readEmbeddedPwaPendingVersion()
			if (!actualPendingVersion && applyError === 'No staged update') {
				setPendingVersion('')
				setError('')
				return
			}
			setError(applyError || tu('update_failed'))
		})

		return () => {
			offAvailable()
			offApply()
		}
	}, [])

	const applyUpdate = useCallback(() => {
		if (applying || !pendingVersion) return
		setApplying(true)
		setError('')
		requestEmbeddedPwaUpdateApply()
	}, [applying, pendingVersion])

	if (!isEmbeddedPwaOtaSupported() || !pendingVersion) return null

	return (
		<div
			className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-between gap-3 border-b border-white/10 bg-[#000414]/95 px-4 py-2 text-sm text-white backdrop-blur-md"
			style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
			role="status"
			aria-live="polite"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{tu('update_ready')} ({pendingVersion})</p>
				{currentVersion ? (
					<p className="truncate text-xs text-white/70">{tu('current')}: {currentVersion}</p>
				) : null}
				{error ? <p className="truncate text-xs text-amber-300">{error}</p> : null}
			</div>
			<button
				type="button"
				className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#000414] disabled:cursor-not-allowed disabled:opacity-50"
				disabled={applying}
				aria-busy={applying}
				aria-label="Apply app update"
				onClick={applyUpdate}
			>
				{applying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
				{applying ? tu('restarting') : tu('restart')}
			</button>
		</div>
	)
}

export default EmbeddedPwaUpdateBanner
