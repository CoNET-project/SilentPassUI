import { useCallback, useEffect, useState } from 'react'
import { CreditCard, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { beamioApi } from '@/utils/constants'
import {
	encodeAdminManagerAdd,
	postCardAddAdmin,
	signExecuteForOwner,
} from '@/services/BeamioCard'
import { openExternalUrl } from '@/utils/openExternalUrl'

type StripeStatus = {
	linked: boolean
	fulfillmentAdmin: string | null
	fulfillmentAdmins?: string[]
}

type Props = {
	cardAddress: string
}

const stripeEndpoint = (path: string) => `${beamioApi}/api/merchantCardStripe/${path}`
const STRIPE_STATUS_TIMEOUT_MS = 15_000

async function fetchStripeStatus(cardAddress: string): Promise<Response> {
	const controller = new AbortController()
	const timeout = window.setTimeout(() => controller.abort(), STRIPE_STATUS_TIMEOUT_MS)
	try {
		return await fetch(stripeEndpoint('status'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cardAddress: ethers.getAddress(cardAddress) }),
			signal: controller.signal,
		})
	} finally {
		window.clearTimeout(timeout)
	}
}

export default function MerchantCardStripePanel({ cardAddress }: Props) {
	const { profiles } = useDaemonContext()
	const [status, setStatus] = useState<StripeStatus | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	const loadStatus = useCallback(async () => {
		if (!ethers.isAddress(cardAddress)) return
		try {
			const response = await fetchStripeStatus(cardAddress)
			const body = (await response.json().catch(() => ({}))) as StripeStatus & { error?: string }
			if (!response.ok) throw new Error(body.error ?? 'Unable to read Stripe status')
			setStatus({
				linked: body.linked === true,
				fulfillmentAdmin: body.fulfillmentAdmin ?? null,
				fulfillmentAdmins: Array.isArray(body.fulfillmentAdmins)
					? body.fulfillmentAdmins.filter((address): address is string => ethers.isAddress(address))
					: body.fulfillmentAdmin && ethers.isAddress(body.fulfillmentAdmin)
						? [body.fulfillmentAdmin]
						: [],
			})
		} catch (e: any) {
			setError(e?.message ?? String(e))
		}
		// Keep the last trusted connection state after a transient read failure.
		// On the first read only, expose a terminal disconnected state so the
		// CTA does not remain in "Checking Stripe…" forever.
		setStatus((previous) => previous ?? {
			linked: false,
			fulfillmentAdmin: null,
			fulfillmentAdmins: [],
		})
	}, [cardAddress])

	useEffect(() => {
		void loadStatus()
	}, [loadStatus])

	const connectStripe = useCallback(async () => {
		if (busy) return
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setError('Unlock the merchant wallet before connecting Stripe.')
			return
		}
		setBusy(true)
		setError('')
		// Reserve the browser tab synchronously from the click handler so the
		// later async API calls cannot make the popup blocker reject Stripe.
		const stripeTab = typeof window !== 'undefined'
			? window.open('', '_blank')
			: null
		let stripeNavigated = false
		try {
			const statusResponse = await fetchStripeStatus(cardAddress)
			const stripeStatus = (await statusResponse.json()) as StripeStatus & { error?: string }
			const fulfillmentAdmins = Array.isArray(stripeStatus.fulfillmentAdmins)
				? stripeStatus.fulfillmentAdmins.filter((address): address is string => ethers.isAddress(address))
				: stripeStatus.fulfillmentAdmin && ethers.isAddress(stripeStatus.fulfillmentAdmin)
					? [stripeStatus.fulfillmentAdmin]
					: []
			if (!statusResponse.ok || fulfillmentAdmins.length === 0) {
				throw new Error(stripeStatus.error ?? 'Stripe fulfillment is not configured.')
			}

			const merchantEoa = profile.keyID
			if (!merchantEoa || !ethers.isAddress(merchantEoa)) {
				throw new Error('Unable to resolve the merchant wallet address.')
			}
			const linkResponse = await fetch(stripeEndpoint('oauth/start'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardAddress: ethers.getAddress(cardAddress),
					merchantEoa: ethers.getAddress(merchantEoa),
				}),
			})
			const link = (await linkResponse.json()) as { url?: string; error?: string }
			if (!linkResponse.ok || !link.url) throw new Error(link.error ?? 'Unable to start Stripe OAuth Connect.')

			// Navigate before the owner-signature flow. The OAuth page must not
			// remain on about:blank while the on-chain admin transactions run.
			if (stripeTab && !stripeTab.closed) {
				stripeTab.location.assign(link.url)
				stripeNavigated = true
			} else if (!openExternalUrl(link.url)) {
				throw new Error('Unable to open Stripe authorization. Please allow pop-ups and try again.')
			} else {
				stripeNavigated = true
			}

			for (const fulfillmentAdmin of fulfillmentAdmins) {
				const deadline = Math.floor(Date.now() / 1000) + 3600
				const nonce = ethers.hexlify(ethers.randomBytes(32))
				const data = encodeAdminManagerAdd(fulfillmentAdmin, 1, '{}')
				const ownerSignature = await signExecuteForOwner(
					profile.privateKeyArmor,
					cardAddress,
					data,
					deadline,
					nonce,
				)
				const adminResult = await postCardAddAdmin({
					cardAddress,
					data,
					deadline,
					nonce,
					ownerSignature,
					adminEOA: fulfillmentAdmin,
				})
				if (!adminResult.success) {
					throw new Error(`Unable to authorize Stripe fulfillment admin ${fulfillmentAdmin}. ${adminResult.error ?? ''}`.trim())
				}
			}
			setStatus({ linked: false, fulfillmentAdmin: fulfillmentAdmins[0], fulfillmentAdmins })
		} catch (e: any) {
			if (!stripeNavigated && stripeTab && !stripeTab.closed) stripeTab.close()
			setError(e?.message ?? String(e))
		} finally {
			setBusy(false)
		}
	}, [busy, cardAddress, profiles])

	if (status?.linked) return null

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Stripe payments">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
						<CreditCard className="h-5 w-5" aria-hidden />
					</div>
					<div>
						<h2 className="text-base font-semibold text-slate-900">Accept card payments</h2>
						<p className="mt-1 text-sm text-slate-500">
							Authorize your Stripe account to receive program card top-ups and membership payments.
						</p>
					</div>
				</div>
				<ShieldCheck className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
			</div>
			{error ? (
				<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
					{error}
				</div>
			) : null}
			<button
				type="button"
				onClick={() => void connectStripe()}
				disabled={busy || status === null}
				aria-busy={busy}
				className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5148e5] disabled:cursor-not-allowed disabled:opacity-60"
			>
				{busy || status === null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ExternalLink className="h-4 w-4" aria-hidden />}
				{busy ? 'Opening Stripe authorization…' : status === null ? 'Checking Stripe…' : 'Connect Stripe account'}
			</button>
		</section>
	)
}
