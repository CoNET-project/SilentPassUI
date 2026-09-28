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
	const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({})
	const [extraMulti, setExtraMulti] = useState<Record<string, string[]>>({})
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const merchant = policy.merchantName || 'This merchant'
	const accent = brandColor?.trim() || '#9a2d4a'
	const surface = pageSurface?.trim() || '#eef3fb'

	const additionalFields = policy.additionalFields ?? []
	const showEmailOffers = policy.marketing === true && policy.fields.email !== 'off'
	const showSmsOffers = policy.marketing === true && policy.fields.phone !== 'off'
	const extraMissing = additionalFields.some((field) => {
		if (field.state !== 'required') return false
		if (field.type === 'multi') return (extraMulti[field.id] ?? []).length === 0
		return !(extraAnswers[field.id] ?? '').trim()
	})
	const missing =
		(policy.fields.name === 'required' && !fullName.trim()) ||
		(policy.fields.phone === 'required' && !phone.trim()) ||
		(policy.fields.email === 'required' && !email.trim()) ||
		extraMissing ||
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
				emailOffers: showEmailOffers && emailOffers,
				smsOffers: showSmsOffers && smsOffers,
				additional: Object.fromEntries([
					...additionalFields
						.filter((field) => field.type !== 'multi')
						.map((field) => [field.id, (extraAnswers[field.id] ?? '').trim()]),
					...additionalFields
						.filter((field) => field.type === 'multi')
						.map((field) => [field.id, extraMulti[field.id] ?? []]),
				]),
				signerKind,
				subjectWallet,
			})
			onLinked()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not save membership details.')
			setBusy(false)
		}
	}

	const detailNotes = [
		policy.fields.name !== 'off' ? 'Your name identifies your member profile' : '',
		policy.fields.phone === 'required'
			? 'your phone number is required'
			: policy.fields.phone === 'optional'
				? 'your phone number is optional'
				: '',
		policy.fields.email === 'required'
			? 'your email is required'
			: policy.fields.email === 'optional'
				? 'your email is optional'
				: '',
	].filter(Boolean)
	const detailTail = detailNotes.length ? ` ${detailNotes.join('; ')}.` : ''

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
				<h1 className="text-[28px] font-semibold tracking-tight text-[#1c1c1e]">Become a member</h1>
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
					{merchant} collects these details to create your profile and provide membership services.
					{detailTail}
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
				{additionalFields.map((field) => (
					<div key={field.id} className="mt-4">
						<p className="text-[14px] font-semibold text-[#1c1c1e]">
							{field.label}{' '}
							{field.state === 'required' ? (
								<span style={{ color: accent }}>*</span>
							) : (
								<span className="font-normal text-[#6b7076]">(optional)</span>
							)}
						</p>
						{field.purpose ? <p className="mt-1 text-[12px] text-[#6b7076]">{field.purpose}</p> : null}
						{field.type === 'multi' ? (
							<div className="mt-2 flex flex-wrap gap-3">
								{field.options.map((option) => {
									const selected = (extraMulti[field.id] ?? []).includes(option)
									return (
										<label key={option} className="inline-flex items-center gap-2 text-[14px] text-[#1c1c1e]">
											<input
												type="checkbox"
												checked={selected}
												onChange={(event) => {
													setExtraMulti((current) => {
														const prev = current[field.id] ?? []
														const next = event.target.checked
															? [...prev, option]
															: prev.filter((item) => item !== option)
														return { ...current, [field.id]: next }
													})
												}}
											/>
											{option}
										</label>
									)
								})}
							</div>
						) : field.type === 'single' || field.type === 'gender' || field.type === 'language' ? (
							<select
								value={extraAnswers[field.id] ?? ''}
								onChange={(event) => setExtraAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
								className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px]"
							>
								<option value="">Select</option>
								{(field.type === 'gender'
									? ['Woman', 'Man', 'Non-binary', 'Self-describe', 'Prefer not to say']
									: field.type === 'language'
										? ['English', '简体中文', '繁體中文', 'Français', 'Other']
										: field.options
								).map((option) => (
									<option key={option} value={option}>{option}</option>
								))}
							</select>
						) : (
							<input
								value={extraAnswers[field.id] ?? ''}
								onChange={(event) => setExtraAnswers((current) => ({ ...current, [field.id]: event.target.value }))}
								className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px] font-normal"
							/>
						)}
					</div>
				))}
				{showEmailOffers ? (
				<label className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={emailOffers} onChange={(event) => setEmailOffers(event.target.checked)} />
					<span>Send me offers and updates from {merchant} by email. (Optional. Unsubscribe anytime.)</span>
				</label>
				) : null}
				{showSmsOffers ? (
				<label className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={smsOffers} onChange={(event) => setSmsOffers(event.target.checked)} />
					<span>Send me offers and updates from {merchant} by SMS. (Optional. Unsubscribe anytime.)</span>
				</label>
				) : null}
				{showEmailOffers || showSmsOffers ? (
				<p className="mt-4 text-[12px] text-[#6b7076]">
					Sent by {merchant}
					{policy.mailingAddress ? ` · ${policy.mailingAddress}` : ''}
				</p>
				) : null}
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
