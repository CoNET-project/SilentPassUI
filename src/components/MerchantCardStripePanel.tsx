import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, CreditCard, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { beamioApi } from '@/utils/constants'
import {
	encodeAddAdminsWithMintLimit,
	postCardAddAdminBatch,
	signExecuteForOwner,
} from '@/services/BeamioCard'
type StripeStatus = {
	connected?: boolean
	linked: boolean
	chargesEnabled?: boolean
	detailsSubmitted?: boolean
	topupEnabled?: boolean
	fulfillmentAdmin: string | null
	fulfillmentAdmins?: string[]
	adminLimitStatus?: Array<{
		admin: string
		isCardAdmin: boolean
		limit: string
		usedFromClear: string
		unlimited: boolean
		requiresOwnerAuthorization: boolean
	}>
}

type Props = {
	cardAddress: string
}

const stripeEndpoint = (path: string) => `${beamioApi}/api/merchantCardStripe/${path}`
const STRIPE_STATUS_TIMEOUT_MS = 15_000
const STRIPE_OAUTH_POPUP_POLL_MS = 500
const STRIPE_OAUTH_MESSAGE_TYPE = 'beamio:merchant-card-stripe-oauth-complete'
const STRIPE_OAUTH_NAVIGATE_TYPE = 'beamio:stripe-oauth-navigate'
const STRIPE_OAUTH_FAIL_TYPE = 'beamio:stripe-oauth-fail'
const STRIPE_CONNECT_OAUTH_ORIGIN = 'https://connect.stripe.com'

function buildStripeDisconnectMessage(params: {
	cardAddress: string
	merchantEoa: string
	deadline: number
	nonce: string
}): string {
	return [
		'Beamio Merchant Card Stripe Disconnect',
		`Card: ${ethers.getAddress(params.cardAddress).toLowerCase()}`,
		`Merchant: ${ethers.getAddress(params.merchantEoa).toLowerCase()}`,
		`Deadline: ${params.deadline}`,
		`Nonce: ${params.nonce.toLowerCase()}`,
	].join('\n')
}

function buildStripeTopupEnabledMessage(params: {
	cardAddress: string
	merchantEoa: string
	deadline: number
	nonce: string
	topupEnabled: boolean
}): string {
	return [
		'Beamio Merchant Card Stripe Top-up Availability',
		`Card: ${ethers.getAddress(params.cardAddress).toLowerCase()}`,
		`Merchant: ${ethers.getAddress(params.merchantEoa).toLowerCase()}`,
		`Top-up enabled: ${params.topupEnabled ? 'true' : 'false'}`,
		`Deadline: ${params.deadline}`,
		`Nonce: ${params.nonce.toLowerCase()}`,
	].join('\n')
}

function buildStripeOAuthConnectMessage(params: {
	cardAddress: string
	merchantEoa: string
	deadline: number
	nonce: string
}): string {
	return [
		'Beamio Merchant Card Stripe OAuth Connect',
		`Card: ${ethers.getAddress(params.cardAddress).toLowerCase()}`,
		`Merchant: ${ethers.getAddress(params.merchantEoa).toLowerCase()}`,
		`Deadline: ${params.deadline}`,
		`Nonce: ${params.nonce.toLowerCase()}`,
	].join('\n')
}

function isStripeTabClosed(tab: Window | null): boolean {
	if (!tab) return true
	try {
		return tab.closed
	} catch {
		return true
	}
}

function isStripeConnectOAuthUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'https:' && parsed.origin === STRIPE_CONNECT_OAUTH_ORIGIN
	} catch {
		return false
	}
}

function writeStripePreparingDocument(stripeTab: Window): void {
	const expectedOrigin = window.location.origin
	stripeTab.document.open()
	stripeTab.document.write(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Preparing Stripe</title></head>
<body style="font-family:system-ui;padding:2rem">
<p id="status">Preparing secure Stripe authorization…</p>
<script>
(function () {
	var expected = ${JSON.stringify(expectedOrigin)};
	window.addEventListener('message', function (event) {
		if (event.origin !== expected) return;
		var data = event.data;
		if (!data || typeof data !== 'object') return;
		if (data.type === ${JSON.stringify(STRIPE_OAUTH_NAVIGATE_TYPE)} && typeof data.url === 'string') {
			try {
				var parsed = new URL(data.url);
				if (parsed.protocol === 'https:' && parsed.origin === ${JSON.stringify(STRIPE_CONNECT_OAUTH_ORIGIN)}) {
					location.replace(data.url);
				}
			} catch (_err) {}
			return;
		}
		if (data.type === ${JSON.stringify(STRIPE_OAUTH_FAIL_TYPE)}) {
			var el = document.getElementById('status');
			if (el) el.textContent = typeof data.message === 'string' && data.message
				? data.message
				: 'Stripe authorization failed.';
		}
	});
})();
</script>
</body>
</html>`)
	stripeTab.document.close()
}

function sendStripeTabMessage(stripeTab: Window, payload: Record<string, unknown>): void {
	try {
		stripeTab.postMessage(payload, window.location.origin)
	} catch {
		// Tab may already be detached; parent location.assign is the fallback.
	}
}

function navigateStripeTab(stripeTab: Window, url: string): void {
	sendStripeTabMessage(stripeTab, { type: STRIPE_OAUTH_NAVIGATE_TYPE, url })
	try {
		stripeTab.location.replace(url)
	} catch {
		try {
			stripeTab.location.href = url
		} catch {
			// Child postMessage listener still navigates when the opener reference is detached.
		}
	}
}

async function ensureStripeFulfillmentAdminsBatch(params: {
	cardAddress: string
	privateKeyArmor: string
	fulfillmentAdmins: string[]
	adminLimitStatus?: StripeStatus['adminLimitStatus']
}): Promise<{ hash?: string }> {
	const admins = Array.from(new Set(params.fulfillmentAdmins.map((admin) => ethers.getAddress(admin))))
	if (admins.length === 0) throw new Error('Stripe fulfillment is not configured.')
	const deadline = Math.floor(Date.now() / 1000) + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const data = encodeAddAdminsWithMintLimit(admins, 1, '{"source":"stripe-fulfillment"}', ethers.MaxUint256)
	const ownerSignature = await signExecuteForOwner(params.privateKeyArmor, params.cardAddress, data, deadline, nonce)
	const result = await postCardAddAdminBatch({
		cardAddress: params.cardAddress,
		data,
		deadline,
		nonce,
		ownerSignature,
		adminEOAs: admins,
	})
	if (!result.success) {
		throw new Error(`Unable to authorize Stripe fulfillment admins in one transaction. ${result.error ?? ''}`.trim())
	}
	const statusResponse = await fetchStripeStatus(params.cardAddress)
	const status = (await statusResponse.json().catch(() => ({}))) as StripeStatus & { error?: string }
	if (!statusResponse.ok) {
		throw new Error(status.error ?? 'Unable to verify Stripe fulfillment admin authorization.')
	}
	const statusByAdmin = new Map(
		(status.adminLimitStatus ?? []).map((entry) => [entry.admin.toLowerCase(), entry]),
	)
	const notUnlimited = admins.filter((admin) => {
		const entry = statusByAdmin.get(admin.toLowerCase())
		return !entry?.isCardAdmin || !entry.unlimited
	})
	if (notUnlimited.length > 0) {
		throw new Error(
			`Stripe fulfillment authorization is incomplete. These Beamio admins are not unlimited: ${notUnlimited.join(', ')}`,
		)
	}
	return { hash: result.hash }
}

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
	const [menuOpen, setMenuOpen] = useState(false)
	const [disconnecting, setDisconnecting] = useState(false)
	const [topupUpdating, setTopupUpdating] = useState(false)
	const [disconnectSlideProgress, setDisconnectSlideProgress] = useState(0)
	const [error, setError] = useState('')
	const disconnectInFlightRef = useRef(false)
	const topupInFlightRef = useRef(false)
	const disconnectSliderRef = useRef<HTMLDivElement | null>(null)
	const disconnectSlideStartRef = useRef<{ pointerId: number; clientX: number; progress: number } | null>(null)
	const disconnectSlideProgressRef = useRef(0)
	const stripePopupRef = useRef<Window | null>(null)
	const stripePopupPollTimerRef = useRef<number | null>(null)

	const stopWatchingStripePopup = useCallback(() => {
		if (stripePopupPollTimerRef.current !== null) {
			window.clearTimeout(stripePopupPollTimerRef.current)
			stripePopupPollTimerRef.current = null
		}
		stripePopupRef.current = null
	}, [])

	const loadStatus = useCallback(async () => {
		if (!ethers.isAddress(cardAddress)) return
		try {
			const response = await fetchStripeStatus(cardAddress)
			const body = (await response.json().catch(() => ({}))) as StripeStatus & { error?: string }
			if (!response.ok) throw new Error(body.error ?? 'Unable to read Stripe status')
			const nextStatus = {
				connected: body.connected === true || body.linked === true,
				linked: body.linked === true,
				chargesEnabled: body.chargesEnabled === true,
				detailsSubmitted: body.detailsSubmitted === true,
				topupEnabled: body.topupEnabled !== false,
				fulfillmentAdmin: body.fulfillmentAdmin ?? null,
				fulfillmentAdmins: Array.isArray(body.fulfillmentAdmins)
					? body.fulfillmentAdmins.filter((address): address is string => ethers.isAddress(address))
					: body.fulfillmentAdmin && ethers.isAddress(body.fulfillmentAdmin)
						? [body.fulfillmentAdmin]
						: [],
				adminLimitStatus: Array.isArray(body.adminLimitStatus) ? body.adminLimitStatus : [],
			}
			setStatus(nextStatus)
			if (!nextStatus.connected) {
				setMenuOpen(false)
			}
		} catch (e: any) {
			setError(e?.message ?? String(e))
		}
	}, [cardAddress])

	useEffect(() => {
		void loadStatus()
	}, [loadStatus])

	useEffect(() => {
		const expectedCardAddress = ethers.isAddress(cardAddress) ? ethers.getAddress(cardAddress).toLowerCase() : ''
		const trustedCallbackOrigin = new URL(beamioApi).origin
		const onStripeOAuthComplete = (event: MessageEvent<unknown>) => {
			if (event.origin !== trustedCallbackOrigin || event.source !== stripePopupRef.current) return
			const payload = event.data
			if (!payload || typeof payload !== 'object') return
			const result = payload as { type?: unknown; status?: unknown; cardAddress?: unknown; message?: unknown }
			if (
				result.type !== STRIPE_OAUTH_MESSAGE_TYPE ||
				typeof result.cardAddress !== 'string' ||
				!ethers.isAddress(result.cardAddress) ||
				ethers.getAddress(result.cardAddress).toLowerCase() !== expectedCardAddress
			) return

			stopWatchingStripePopup()
			setBusy(false)
			if (result.status === 'success') {
				setError('')
				void loadStatus()
				return
			}
			setError(typeof result.message === 'string' && result.message ? result.message : 'Stripe authorization was not completed.')
		}
		window.addEventListener('message', onStripeOAuthComplete)
		return () => {
			window.removeEventListener('message', onStripeOAuthComplete)
			stopWatchingStripePopup()
		}
	}, [cardAddress, loadStatus, stopWatchingStripePopup])

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
			if (!stripeTab) {
				throw new Error('Unable to open Stripe authorization. Please allow pop-ups and try again.')
			}
			stripePopupRef.current = stripeTab
			writeStripePreparingDocument(stripeTab)

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

			const merchantWallet = new ethers.Wallet(profile.privateKeyArmor.trim())
			const merchantEoa = ethers.getAddress(merchantWallet.address)
			const deadline = Math.floor(Date.now() / 1000) + 5 * 60
			const nonce = ethers.hexlify(ethers.randomBytes(32))
			const signature = await merchantWallet.signMessage(buildStripeOAuthConnectMessage({
				cardAddress,
				merchantEoa,
				deadline,
				nonce,
			}))
			const linkResponse = await fetch(stripeEndpoint('oauth/start'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardAddress: ethers.getAddress(cardAddress),
					merchantEoa,
					deadline,
					nonce,
					signature,
				}),
			})
			const link = (await linkResponse.json()) as { url?: string; error?: string }
			if (!linkResponse.ok || !link.url || !isStripeConnectOAuthUrl(link.url)) {
				throw new Error(link.error ?? 'Unable to start Stripe OAuth Connect.')
			}
			if (isStripeTabClosed(stripeTab)) {
				throw new Error('The Stripe authorization window was closed. Please try again.')
			}

			// The card-owner batch authorization must be confirmed before Stripe
			// OAuth continues. A background authorization could leave Stripe
			// connected while one signer still has limit=0.
			await ensureStripeFulfillmentAdminsBatch({
				cardAddress,
				privateKeyArmor: profile.privateKeyArmor!,
				fulfillmentAdmins,
			})
			navigateStripeTab(stripeTab, link.url)
			stripeNavigated = true
			const watchForStripePopupClose = () => {
				if (stripePopupRef.current !== stripeTab) return
				if (isStripeTabClosed(stripeTab)) {
					stopWatchingStripePopup()
					setBusy(false)
					setError('Stripe authorization was closed before it was completed.')
					return
				}
				stripePopupPollTimerRef.current = window.setTimeout(
					watchForStripePopupClose,
					STRIPE_OAUTH_POPUP_POLL_MS,
				)
			}
			watchForStripePopupClose()
		} catch (e: any) {
			const message = e?.message ?? String(e)
			if (!stripeNavigated && stripeTab && !isStripeTabClosed(stripeTab)) {
				sendStripeTabMessage(stripeTab, { type: STRIPE_OAUTH_FAIL_TYPE, message })
				try {
					stripeTab.close()
				} catch {
					// Keep the fail copy in the tab if the browser blocks close().
				}
			}
			stopWatchingStripePopup()
			setError(message)
		} finally {
			if (!stripeNavigated) setBusy(false)
		}
	}, [busy, cardAddress, profiles, stopWatchingStripePopup])

	const disconnectStripe = useCallback(async () => {
		if (disconnectInFlightRef.current) return
		disconnectInFlightRef.current = true
		setDisconnecting(true)
		setError('')
		try {
			const profile = profiles?.[0]
			if (!profile?.privateKeyArmor?.trim()) {
				throw new Error('Unlock the merchant wallet before disconnecting Stripe.')
			}
			const wallet = new ethers.Wallet(profile.privateKeyArmor.trim())
			const merchantEoa = ethers.getAddress(wallet.address)
			const deadline = Math.floor(Date.now() / 1000) + 5 * 60
			const nonce = ethers.hexlify(ethers.randomBytes(32))
			const signature = await wallet.signMessage(buildStripeDisconnectMessage({
				cardAddress,
				merchantEoa,
				deadline,
				nonce,
			}))
			const response = await fetch(stripeEndpoint('disconnect'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardAddress: ethers.getAddress(cardAddress),
					merchantEoa,
					deadline,
					nonce,
					signature,
				}),
			})
			const body = (await response.json().catch(() => ({}))) as { error?: string; disconnected?: boolean }
			if (!response.ok || body.disconnected !== true) {
				throw new Error(body.error ?? 'Unable to disconnect Stripe.')
			}
			setMenuOpen(false)
			disconnectSlideProgressRef.current = 0
			setDisconnectSlideProgress(0)
			await loadStatus()
		} catch (e: any) {
			setError(e?.message ?? String(e))
		} finally {
			disconnectInFlightRef.current = false
			setDisconnecting(false)
		}
	}, [cardAddress, loadStatus, profiles])

	const setStripeTopupEnabled = useCallback(async (topupEnabled: boolean) => {
		if (topupInFlightRef.current || disconnecting) return
		topupInFlightRef.current = true
		setTopupUpdating(true)
		setError('')
		try {
			const profile = profiles?.[0]
			if (!profile?.privateKeyArmor?.trim()) {
				throw new Error('Unlock the merchant wallet before changing Stripe top-ups.')
			}
			if (topupEnabled) {
				const statusResponse = await fetchStripeStatus(cardAddress)
				const stripeStatus = (await statusResponse.json().catch(() => ({}))) as StripeStatus & { error?: string }
				if (!statusResponse.ok) {
					throw new Error(stripeStatus.error ?? 'Unable to verify Stripe fulfillment authorization.')
				}
				const fulfillmentAdmins = Array.isArray(stripeStatus.fulfillmentAdmins)
					? stripeStatus.fulfillmentAdmins.filter((address): address is string => ethers.isAddress(address))
					: stripeStatus.fulfillmentAdmin && ethers.isAddress(stripeStatus.fulfillmentAdmin)
						? [stripeStatus.fulfillmentAdmin]
						: []
				if (fulfillmentAdmins.length === 0) {
					throw new Error('Stripe fulfillment is not configured.')
				}
				await ensureStripeFulfillmentAdminsBatch({
					cardAddress,
					privateKeyArmor: profile.privateKeyArmor.trim(),
					fulfillmentAdmins,
				})
			}
			const wallet = new ethers.Wallet(profile.privateKeyArmor.trim())
			const merchantEoa = ethers.getAddress(wallet.address)
			const deadline = Math.floor(Date.now() / 1000) + 5 * 60
			const nonce = ethers.hexlify(ethers.randomBytes(32))
			const signature = await wallet.signMessage(buildStripeTopupEnabledMessage({
				cardAddress,
				merchantEoa,
				deadline,
				nonce,
				topupEnabled,
			}))
			const response = await fetch(stripeEndpoint('topupEnabled'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardAddress: ethers.getAddress(cardAddress),
					merchantEoa,
					deadline,
					nonce,
					signature,
					topupEnabled,
				}),
			})
			const body = (await response.json().catch(() => ({}))) as { error?: string; topupEnabled?: boolean }
			if (!response.ok || body.topupEnabled !== topupEnabled) {
				throw new Error(body.error ?? 'Unable to update Stripe top-ups.')
			}
			setStatus((current) => current ? { ...current, topupEnabled } : current)
			await loadStatus()
		} catch (e: any) {
			setError(e?.message ?? String(e))
		} finally {
			topupInFlightRef.current = false
			setTopupUpdating(false)
		}
	}, [cardAddress, disconnecting, loadStatus, profiles])

	const resetDisconnectSlider = useCallback(() => {
		disconnectSlideStartRef.current = null
		disconnectSlideProgressRef.current = 0
		setDisconnectSlideProgress(0)
	}, [])

	const setDisconnectSliderProgress = useCallback((progress: number) => {
		const nextProgress = Math.min(1, Math.max(0, progress))
		disconnectSlideProgressRef.current = nextProgress
		setDisconnectSlideProgress(nextProgress)
	}, [])

	const onDisconnectSliderPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if (disconnecting || busy) return
		event.preventDefault()
		event.currentTarget.setPointerCapture(event.pointerId)
		disconnectSlideStartRef.current = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			progress: disconnectSlideProgressRef.current,
		}
	}, [busy, disconnecting])

	const onDisconnectSliderPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		const start = disconnectSlideStartRef.current
		const track = disconnectSliderRef.current
		if (!start || start.pointerId !== event.pointerId || !track) return
		const maxTravel = Math.max(1, track.getBoundingClientRect().width - 56)
		setDisconnectSliderProgress(start.progress + (event.clientX - start.clientX) / maxTravel)
	}, [setDisconnectSliderProgress])

	const onDisconnectSliderPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		const start = disconnectSlideStartRef.current
		if (!start || start.pointerId !== event.pointerId) return
		disconnectSlideStartRef.current = null
		if (disconnectSlideProgressRef.current >= 0.84) {
			setDisconnectSliderProgress(1)
			void disconnectStripe()
			return
		}
		resetDisconnectSlider()
	}, [disconnectStripe, resetDisconnectSlider, setDisconnectSliderProgress])

	const onDisconnectSliderKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
		if (disconnecting || busy) return
		if (event.key === 'ArrowRight') {
			event.preventDefault()
			setDisconnectSliderProgress(disconnectSlideProgressRef.current + 0.1)
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault()
			setDisconnectSliderProgress(disconnectSlideProgressRef.current - 0.1)
		} else if ((event.key === 'Enter' || event.key === ' ') && disconnectSlideProgressRef.current >= 0.84) {
			event.preventDefault()
			setDisconnectSliderProgress(1)
			void disconnectStripe()
		}
	}, [busy, disconnectStripe, disconnecting, setDisconnectSliderProgress])

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
			{status?.connected ? (
				<div className="mt-4">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => {
								setMenuOpen((open) => !open)
								resetDisconnectSlider()
							}}
							disabled={disconnecting || topupUpdating}
							aria-expanded={menuOpen}
							className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
							<span>Stripe connected</span>
							<ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
						</button>
						<button
							type="button"
							onClick={() => void setStripeTopupEnabled(!status.topupEnabled)}
							disabled={topupUpdating || disconnecting || busy}
							aria-busy={topupUpdating}
							aria-label={status.topupEnabled ? 'Turn Stripe top-ups off' : 'Turn Stripe top-ups on'}
							aria-pressed={status.topupEnabled}
							className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-1.5 py-1 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span
								aria-hidden="true"
								className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full px-1 transition-colors ${
									status.topupEnabled ? 'bg-emerald-500' : 'bg-slate-300'
								}`}
							>
								<span
									className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
									topupUpdating ? 'translate-x-3.5' : status.topupEnabled ? 'translate-x-7' : 'translate-x-0'
									}`}
								>
									{topupUpdating ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" aria-hidden />
									) : null}
								</span>
							</span>
						</button>
					</div>
					<p className="mt-2 text-sm text-slate-500">
						{status.linked
							? status.topupEnabled
								? 'This card can accept Stripe top-ups and membership payments.'
								: 'Stripe top-ups are off. Membership payments remain available.'
							: 'Complete your Stripe account setup before this card can accept payments.'}
					</p>
					{menuOpen ? (
						<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
							<p className="text-sm font-medium text-slate-800">Stripe payment options</p>
							<p className="mt-1 text-sm text-slate-600">
								Slide right to disconnect Stripe and remove this card&apos;s saved connection. Your Stripe account will not be closed or deleted.
							</p>
							<div
								ref={disconnectSliderRef}
								role="slider"
								tabIndex={0}
								aria-label="Slide right to disconnect Stripe"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(disconnectSlideProgress * 100)}
								aria-valuetext={disconnecting ? 'Disconnecting Stripe' : 'Slide right to disconnect Stripe'}
								onKeyDown={onDisconnectSliderKeyDown}
								onPointerDown={onDisconnectSliderPointerDown}
								onPointerMove={onDisconnectSliderPointerMove}
								onPointerUp={onDisconnectSliderPointerEnd}
								onPointerCancel={onDisconnectSliderPointerEnd}
								className="relative mt-4 h-14 select-none overflow-hidden rounded-full border border-rose-200 bg-rose-50 outline-none transition focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
								style={{ touchAction: 'none' }}
							>
								<div
									className="absolute inset-y-0 left-0 bg-rose-100 transition-[width] duration-150"
									style={{ width: `${disconnectSlideProgress * 100}%` }}
								/>
								<p className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-sm font-semibold text-rose-800">
									{disconnecting ? 'Disconnecting Stripe…' : 'Slide right to disconnect'}
								</p>
								<div
									className="pointer-events-none absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-md transition-[left] duration-150"
									style={{ left: `calc(${disconnectSlideProgress * 100}% + ${4 - disconnectSlideProgress * 56}px)` }}
								>
									{disconnecting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
								</div>
							</div>
							<p className="mt-2 text-center text-xs text-slate-500">Use the right arrow key or drag the control to confirm.</p>
						</div>
					) : null}
				</div>
			) : (
				<button
					type="button"
					onClick={() => void connectStripe()}
					disabled={busy || status === null || disconnecting}
					aria-busy={busy}
					className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5148e5] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{busy || status === null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ExternalLink className="h-4 w-4" aria-hidden />}
					{busy ? 'Preparing Stripe authorization…' : status === null ? 'Checking Stripe…' : 'Connect Stripe account'}
				</button>
			)}
		</section>
	)
}
