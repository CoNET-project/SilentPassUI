import { useEffect, useState } from 'react'
import {
	type DeliveryHealth,
	deliveryFixHint,
	dismissDeliveryHealthNotice,
	openDeliverySettings,
	parseDeliveryHealth,
	requestDeliveryHealth,
} from '@/utils/cashTreesDeliveryHealth'

/**
 * Android shell only: shown when the phone blocks Beamio's wake-up pushes
 * (background restricted / Samsung deep sleep) or Beamio was force stopped.
 * Nothing shows otherwise.
 */
export function DeliveryHealthBanner() {
	const [health, setHealth] = useState<DeliveryHealth | null>(null)

	useEffect(() => {
		const onEvent = (event: Event) => {
			const next = parseDeliveryHealth((event as CustomEvent).detail)
			if (next) setHealth(next)
		}
		window.addEventListener('cashtreesandroid', onEvent)
		requestDeliveryHealth()
		return () => window.removeEventListener('cashtreesandroid', onEvent)
	}, [])

	if (!health?.needsAttention) return null

	if (health.backgroundRestricted) {
		return (
			<div className="mx-4 mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900" role="alert">
				<p className="text-sm font-semibold">Calls and messages may not reach you while Beamio is closed</p>
				<p className="mt-1 text-xs leading-relaxed">
					Your phone is limiting Beamio in the background. {deliveryFixHint(health.vendor)}
				</p>
				<button
					type="button"
					onClick={() => openDeliverySettings()}
					className="mt-2 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white"
				>
					Fix
				</button>
			</div>
		)
	}

	return (
		<div className="mx-4 mb-2 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800" role="status">
			<p className="text-sm font-semibold">Beamio was force stopped</p>
			<p className="mt-1 text-xs leading-relaxed text-slate-600">
				While it was stopped, calls and messages could not reach you. They arrive again now that Beamio is open.
			</p>
			<button
				type="button"
				onClick={() => {
					dismissDeliveryHealthNotice()
					setHealth((current) => (current ? { ...current, forceStopped: false, needsAttention: current.backgroundRestricted } : current))
				}}
				className="mt-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700"
			>
				Got it
			</button>
		</div>
	)
}
