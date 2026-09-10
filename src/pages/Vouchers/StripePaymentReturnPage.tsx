import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'

/** Absolute API host — required in iOS Embedded OTA (`cashtrees-local://`). */
const BEAMIO_API_BASE = 'https://beamio.app'

type StripeStatus = {
	status?: 'pending' | 'succeeded' | 'failed'
	paymentStatus?: string
	fulfillmentStatus?: string
	txHash?: string | null
	error?: string | null
}

export default function StripePaymentReturnPage() {
	const [params] = useSearchParams()
	const { setShowFooter } = useDaemonContext()
	const sessionId = params.get('session_id') || params.get('payment_intent') || ''
	const cancelled = params.get('cancelled') === '1'
	const [state, setState] = useState<StripeStatus | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		if (!sessionId) return
		let disposed = false
		let timer: ReturnType<typeof setTimeout> | undefined
		let attempts = 0

		const poll = async () => {
			try {
				const response = await fetch(
					cancelled
						? `${BEAMIO_API_BASE}/api/merchantCardStripe/cancel`
						: `${BEAMIO_API_BASE}/api/merchantCardStripe/poll`,
					{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessionId }),
					},
				)
				const body = (await response.json().catch(() => ({}))) as StripeStatus & { error?: string }
				if (!response.ok) throw new Error(body.error || 'Unable to read Stripe payment status.')
				if (disposed) return
				if (cancelled) return
				setState(body)
				setError('')
				const done =
					body.fulfillmentStatus === 'fulfillment_succeeded' ||
					body.fulfillmentStatus === 'fulfillment_failed' ||
					body.status === 'failed'
				if (!done && attempts < 60) {
					attempts += 1
					timer = setTimeout(() => void poll(), 3000)
				}
			} catch (e) {
				if (disposed) return
				setError(e instanceof Error ? e.message : 'Unable to read Stripe payment status.')
				if (attempts < 60) {
					attempts += 1
					timer = setTimeout(() => void poll(), 5000)
				}
			}
		}

		void poll()
		return () => {
			disposed = true
			if (timer) clearTimeout(timer)
		}
	}, [cancelled, sessionId])

	const fulfilled = state?.fulfillmentStatus === 'fulfillment_succeeded'
	const failed = state?.fulfillmentStatus === 'fulfillment_failed' || state?.status === 'failed'

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f6f8] px-4 py-8">
			<section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.12)]" role="status">
				{cancelled ? (
					<>
						<h1 className="text-xl font-bold text-slate-900">Payment cancelled</h1>
						<p className="mt-2 text-sm text-slate-600">No card top-up was created.</p>
					</>
				) : fulfilled ? (
					<>
						<Check className="h-8 w-8 text-emerald-600" aria-hidden />
						<h1 className="mt-3 text-xl font-bold text-slate-900">Top-up completed</h1>
						<p className="mt-2 text-sm text-slate-600">Your payment was received and the card points were minted.</p>
					</>
				) : failed ? (
					<>
						<AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
						<h1 className="mt-3 text-xl font-bold text-slate-900">Top-up needs attention</h1>
						<p className="mt-2 text-sm text-slate-600">{state?.error || 'Payment succeeded, but card fulfillment failed. Please retry or contact support.'}</p>
					</>
				) : (
					<>
						<Loader2 className="h-8 w-8 animate-spin text-[#635bff]" aria-hidden />
						<h1 className="mt-3 text-xl font-bold text-slate-900">
							{state?.paymentStatus === 'paid' ? 'Completing your top-up…' : 'Checking payment…'}
						</h1>
						<p className="mt-2 text-sm text-slate-600">Stripe payment and card minting are tracked separately.</p>
					</>
				)}
				{error ? <p className="mt-4 text-sm text-amber-700" role="alert">{error}</p> : null}
			</section>
		</div>
	)
}
