import { useState, type CSSProperties } from 'react'
import type { MembershipKycFormPolicy } from '@/utils/membershipKyc'
import { saveMembershipKycAndLink } from '@/utils/membershipKyc'

type Props = {
	policy: MembershipKycFormPolicy
	cardAddress: string
	privateKey: string
	subjectWallet: string
	signerKind: 'wallet' | 'admin'
	onClose: () => void
	onLinked: () => void
	/** Merchant detail brand color. Accents (title mark, offer, links, continue) follow it. */
	brandColor?: string | null
	/** Same surface as the merchant detail page (`merchantDetailPageSurface`). */
	pageSurface?: string | null
}

export function BecomeMemberSheet({
	policy,
	cardAddress,
	privateKey,
	subjectWallet,
	signerKind,
	onClose,
	onLinked,
	brandColor,
	pageSurface,
}: Props) {
	const [fullName, setFullName] = useState('')
	const [phone, setPhone] = useState('')
	const [email, setEmail] = useState('')
	const [consent, setConsent] = useState(false)
	const [terms, setTerms] = useState(false)
	const [emailOffers, setEmailOffers] = useState(false)
	const [smsOffers, setSmsOffers] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const merchant = policy.merchantName || 'This merchant'
	const accent = brandColor?.trim() || '#9a2d4a'
	const surface = pageSurface?.trim() || '#eef3fb'

	const missing =
		(policy.fields.name === 'required' && !fullName.trim()) ||
		(policy.fields.phone === 'required' && !phone.trim()) ||
		(policy.fields.email === 'required' && !email.trim()) ||
		!consent ||
		!terms

	const continueNext = async () => {
		if (busy || missing) return
		setBusy(true)
		setError('')
		try {
			await saveMembershipKycAndLink({
				cardAddress,
				privateKey,
				fullName,
				phone,
				email,
				emailOffers,
				smsOffers,
				signerKind,
				subjectWallet,
			})
			onLinked()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not save membership details.')
			setBusy(false)
		}
	}

	const phoneOff = policy.fields.phone === 'off'
	const emailOff = policy.fields.email === 'off'
	const detailTail =
		phoneOff && emailOff
			? '.'
			: policy.fields.phone !== 'required' && policy.fields.email !== 'required'
				? '; phone and email are optional.'
				: '; phone and email follow the merchant’s request.'

	return (
		<div
			className="fixed inset-0 z-[320] overflow-y-auto bg-[color:var(--membership-kyc-page-bg)] px-4 py-6 dark:bg-slate-950"
			style={{ ['--membership-kyc-page-bg' as string]: surface } as CSSProperties}
		>
			<div className="mx-auto w-full max-w-lg">
				<button
					type="button"
					aria-label="Back"
					tabIndex={-1}
					onClick={onClose}
					className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2c2f31] shadow"
				>
					<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
						<path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</button>
				<p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>{merchant}</p>
				<h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1c1c1e]">Become a member</h1>
				<p className="mt-1 text-[15px] text-[#6b7076]">Add your details to set up your membership.</p>
				{policy.offerValue ? (
					<div className="mt-4 flex items-center justify-between rounded-2xl border bg-white px-3 py-3" style={{ borderColor: accent }}>
						<div className="flex items-center gap-2">
							<span className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: accent, color: accent }} aria-hidden>
								<svg viewBox="0 0 24 24" className="h-5 w-5">
									<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
								</svg>
							</span>
							<div>
								<p className="text-[15px] font-semibold" style={{ color: accent }}>{merchant}</p>
								<p className="text-[12px] text-[#6b7076]">{policy.offerLabel}</p>
							</div>
						</div>
						<div className="text-right">
							<p className="text-[11px] font-semibold uppercase" style={{ color: accent }}>{policy.offerValue}</p>
							<p className="text-[18px] font-semibold" style={{ color: accent }}>{policy.offerReward}</p>
						</div>
					</div>
				) : null}
				<p className="mt-4 text-[13px] leading-5 text-[#5c6570]">
					{merchant} collects these details to create your profile and provide membership services. Your name
					identifies your member profile{detailTail}
				</p>
				<div className="mt-3 rounded-2xl bg-white px-3 py-3 text-[13px] leading-5 text-[#3d4a57]">
					Your wallet is your member ID. You control your private key. {merchant} accesses its member
					information through its own private key on CoNET L1. Additional details below are requested by the
					merchant.
				</div>
				{policy.fields.name !== 'off' ? (
					<label className="mt-4 block text-[14px] font-semibold text-[#1c1c1e]">
						Full name {policy.fields.name === 'required' ? <span style={{ color: accent }}>*</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
						<input
							value={fullName}
							onChange={(event) => setFullName(event.target.value)}
							placeholder="Your name"
							className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px] font-normal"
						/>
					</label>
				) : null}
				{policy.fields.phone !== 'off' ? (
					<label className="mt-4 block text-[14px] font-semibold text-[#1c1c1e]">
						Phone number {policy.fields.phone === 'required' ? <span style={{ color: accent }}>*</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
						<input
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							placeholder="+1 604 555 0123"
							inputMode="tel"
							className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px] font-normal"
						/>
					</label>
				) : null}
				{policy.fields.email !== 'off' ? (
					<label className="mt-4 block text-[14px] font-semibold text-[#1c1c1e]">
						Email {policy.fields.email === 'required' ? <span style={{ color: accent }}>*</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
						<input
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="you@example.com"
							inputMode="email"
							className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px] font-normal"
						/>
					</label>
				) : null}
				<label className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
					<span>
						I consent to {merchant} processing the information I provide for the purposes described in the{' '}
						<span style={{ color: accent }}>{merchant} Privacy Notice</span>.
					</span>
				</label>
				<label className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
					<span>
						I have read and agree to the <span style={{ color: accent }}>{merchant} Membership Terms</span>.
					</span>
				</label>
				<label className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={emailOffers} onChange={(event) => setEmailOffers(event.target.checked)} />
					<span>Send me offers and updates from {merchant} by email. (Optional. Unsubscribe anytime.)</span>
				</label>
				<label className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={smsOffers} onChange={(event) => setSmsOffers(event.target.checked)} />
					<span>Send me offers and updates from {merchant} by SMS. (Optional. Unsubscribe anytime.)</span>
				</label>
				<p className="mt-4 text-[12px] text-[#6b7076]">Sent by {merchant} · Merchant contact details</p>
				{error ? (
					<p role="alert" className="mt-3 rounded-xl bg-[#fff4e5] px-3 py-2 text-[13px] text-[#9a3412]">
						{error}
					</p>
				) : null}
				<button
					type="button"
					disabled={missing || busy}
					onClick={() => void continueNext()}
					className="mt-4 w-full rounded-xl py-3 text-[16px] font-semibold text-white disabled:opacity-50"
					style={{ backgroundColor: accent }}
				>
					{busy ? 'Saving…' : 'Continue to payment →'}
				</button>
				<p className="mt-3 text-center text-[12px] leading-5 text-[#6b7076]">
					Review your payment next. You will not be charged yet.
					<br />
					Powered by Beamio · Technology & tools
				</p>
			</div>
		</div>
	)
}
