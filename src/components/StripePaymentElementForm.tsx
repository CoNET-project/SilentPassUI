import { FormEvent, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'

type Props = {
	clientSecret: string
	publishableKey: string
	amountLabel: string
	onSuccess: (paymentIntentId: string) => void
	onCancel: () => void
}

function PaymentForm({ amountLabel, onSuccess, onCancel }: Omit<Props, 'clientSecret' | 'publishableKey'>) {
	const stripe = useStripe()
	const elements = useElements()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!stripe || !elements || busy) return
		setBusy(true)
		setError('')
		try {
			const result = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${window.location.origin}/app/stripe-payment-return`,
				},
				redirect: 'if_required',
			})
			if (result.error) {
				setError(result.error.message || 'Unable to complete the payment.')
				return
			}
			if (result.paymentIntent?.id) {
				onSuccess(result.paymentIntent.id)
				return
			}
			setError('Stripe did not return a payment status. Please try again.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Unable to complete the payment.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<form onSubmit={submit} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-slate-900">Card payment</p>
					<p className="mt-0.5 text-xs text-slate-500">{amountLabel} · Email is optional</p>
				</div>
				<Check className="h-5 w-5 text-emerald-600" aria-hidden />
			</div>
			<div className="mt-4">
				<PaymentElement options={{ fields: { billingDetails: { email: 'never' } } }} />
			</div>
			{error ? (
				<div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<p>{error}</p>
				</div>
			) : null}
			<div className="mt-4 flex gap-3">
				<button
					type="button"
					onClick={onCancel}
					disabled={busy}
					className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={busy || !stripe || !elements}
					aria-busy={busy}
					className="flex-1 rounded-xl bg-[#635bff] px-3 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden /> : 'Pay securely'}
				</button>
			</div>
		</form>
	)
}

export default function StripePaymentElementForm(props: Props) {
	const stripePromise = useMemo<Promise<Stripe | null>>(
		() => loadStripe(props.publishableKey),
		[props.publishableKey],
	)
	return (
		<Elements
			stripe={stripePromise}
			options={{
				clientSecret: props.clientSecret,
				appearance: { theme: 'stripe' },
			}}
		>
			<PaymentForm
				amountLabel={props.amountLabel}
				onSuccess={props.onSuccess}
				onCancel={props.onCancel}
			/>
		</Elements>
	)
}
