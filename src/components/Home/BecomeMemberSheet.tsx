import { useState, type CSSProperties } from 'react'
import type { MembershipKycFormPolicy } from '@/utils/membershipKyc'
import { saveMembershipKycAndLink } from '@/utils/membershipKyc'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'

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

function validEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function validPhone(value: string): boolean {
	return (value.match(/\d/g) ?? []).length >= 7
}

function validityPhrase(label: string): string {
	switch (label.trim()) {
		case 'Daily':
			return '1 day'
		case 'Weekly':
			return '1 week'
		case 'Monthly':
			return '1 month'
		case 'Quarterly':
			return '1 quarter'
		case 'Annually':
			return '1 year'
		case 'Lifetime':
			return 'Lifetime'
		default:
			return label.trim()
	}
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
	const [privacyConsent, setPrivacyConsent] = useState(false)
	const [terms, setTerms] = useState(false)
	const [emailOffers, setEmailOffers] = useState(false)
	const [smsOffers, setSmsOffers] = useState(false)
	const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({})
	const [extraMulti, setExtraMulti] = useState<Record<string, string[]>>({})
	const [documentKind, setDocumentKind] = useState<'terms' | 'privacy' | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const merchant = policy.merchantName || 'This merchant'
	const accent = brandColor?.trim() || '#9a2d4a'
	const surface = pageSurface?.trim() || '#eef3fb'
	const additionalFields = policy.additionalFields ?? []
	const collecting =
		policy.fields.name !== 'off' ||
		policy.fields.phone !== 'off' ||
		policy.fields.email !== 'off' ||
		additionalFields.length > 0
	const showEmailOffers = policy.marketing === true && policy.fields.email !== 'off' && validEmail(email)
	const showSmsOffers = policy.marketing === true && policy.fields.phone !== 'off' && validPhone(phone)
	const topUpSummary = /top-?up/i.test(policy.offerLabel)
	const feeLabel = topUpSummary ? 'Top-up amount' : 'Membership fee'
	const rawFeeValue = policy.offerValue.trim()
	const feeIsFree = !rawFeeValue || Number(rawFeeValue.replace(/[^\d.-]/g, '')) === 0
	const feeValue = topUpSummary
		? rawFeeValue
		: feeIsFree
			? 'Free'
			: rawFeeValue.replace(/\s*·\s*One-time payment\s*$/i, '')
	const validity = validityPhrase(policy.offerReward)
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
		(collecting && !privacyConsent) ||
		!terms

	const continueNext = async () => {
		if (busy || missing) return
		setBusy(true)
		setError('')
		try {
			await saveMembershipKycAndLink({
				cardAddress,
				privateKey,
				fullName: policy.fields.name === 'off' ? '' : fullName,
				phone: policy.fields.phone === 'off' ? '' : phone,
				email: policy.fields.email === 'off' ? '' : email,
				privacyConsent: collecting && privacyConsent,
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

	const openDocument = (kind: 'terms' | 'privacy') => {
		setDocumentKind(kind)
	}

	const handleBack = () => {
		onClose()
	}

	return (
		<div
			className="fixed inset-0 z-[320] pointer-events-auto overflow-y-auto bg-[color:var(--membership-kyc-page-bg)] px-4 py-6 dark:bg-slate-950"
			style={{ ['--membership-kyc-page-bg' as string]: surface } as CSSProperties}
		>
			<div className="mx-auto w-full max-w-lg">
				<BeamioCircularBackButton
					variant="onLight"
					onClick={handleBack}
					className="z-10 mb-4"
				/>
				<h1 className="text-[32px] font-semibold tracking-tight text-[#1c1c1e]">Become a member</h1>
				<div className="mt-5 rounded-2xl border border-[#dedde8] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
					<p className="max-w-[85%] text-[20px] font-semibold leading-7" style={{ color: accent }}>{merchant}</p>
					{feeValue ? (
						<div className="mt-7 flex items-start justify-between gap-4 text-[16px]">
							<span className="text-[#66666f]">{feeLabel}</span>
							<span className="text-right font-semibold text-[#1c1c1e]">{feeValue}</span>
						</div>
					) : null}
					{validity ? (
						<div className="mt-5 flex items-start justify-between gap-4 text-[16px]">
							<span className="text-[#66666f]">{topUpSummary ? 'Membership validity' : 'Valid for'}</span>
							<span className="text-right font-semibold text-[#1c1c1e]">{validity}</span>
						</div>
					) : null}
				</div>
				{collecting ? (
					<>
						<div className="mt-6 flex items-center gap-2">
							<h2 className="text-[19px] font-semibold text-[#1c1c1e]">Member details</h2>
							<svg viewBox="0 0 24 24" className="h-4 w-4 text-[#667085]" aria-hidden>
								<path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6V10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</div>
						<p className="mt-1 text-[13px] leading-5 text-[#5c6570]">
							Only this organization can read these details. Beamio cannot.
						</p>
						{policy.fields.name !== 'off' ? (
							<label className="mt-4 block text-[14px] font-semibold text-[#1c1c1e]">
								Full name {policy.fields.name === 'required' ? <span style={{ color: accent }}>(required)</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
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
								Phone number {policy.fields.phone === 'required' ? <span style={{ color: accent }}>(required)</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
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
								Email {policy.fields.email === 'required' ? <span style={{ color: accent }}>(required)</span> : <span className="font-normal text-[#6b7076]">(optional)</span>}
								<input
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="you@example.com"
									inputMode="email"
									className="mt-2 w-full rounded-xl border border-[#e6e8ee] bg-white px-3 py-3 text-[15px] font-normal"
								/>
							</label>
						) : null}
						{additionalFields.map((field) => (
							<div key={field.id} className="mt-4">
								<p className="text-[14px] font-semibold text-[#1c1c1e]">
									{field.label}{' '}
									{field.state === 'required' ? (
										<span style={{ color: accent }}>(required)</span>
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
							<label className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
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
						<label className="mt-5 flex items-start gap-3 border-t border-[#e7e5ec] pt-5 text-[13px] leading-5 text-[#3d4a57]">
							<input
								type="checkbox"
								checked={privacyConsent}
								onChange={(event) => setPrivacyConsent(event.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--membership-accent)]"
								style={{ ['--membership-accent' as string]: accent } as CSSProperties}
							/>
							<span>
								I consent to this organization collecting and using the details I provide to manage my membership.{' '}
								<button type="button" className="font-semibold underline" style={{ color: accent }} onClick={() => openDocument('privacy')}>
									Privacy Notice
								</button>
							</span>
						</label>
					</>
				) : (
					<div className="mt-5">
						<p className="text-[15px] font-semibold text-[#1c1c1e]">No additional details needed</p>
						<p className="mt-1 text-[13px] leading-5 text-[#5c6570]">
							{merchant} does not request any additional personal details to join. Your wallet will be used as your member ID.
						</p>
						<p className="mt-2 text-[13px] leading-5 text-[#5c6570]">
							Review and accept the Membership Terms to continue to checkout.
						</p>
					</div>
				)}
				<label className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-[#3d4a57]">
					<input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
					<span>
						I agree to this organization’s{' '}
						<button
							type="button"
							className="font-semibold underline"
							style={{ color: accent }}
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								openDocument('terms')
							}}
						>
							Membership Terms
						</button>
						.
					</span>
				</label>
				{!collecting ? (
					<p className="mt-3 text-[13px] leading-5 text-[#5c6570]">
						See how {merchant} uses your wallet ID and membership records in its{' '}
						<button type="button" className="font-semibold underline" style={{ color: accent }} onClick={() => openDocument('privacy')}>
							Privacy Notice
						</button>
						.
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
					{busy ? 'Saving…' : 'Continue to checkout →'}
				</button>
			</div>
			{documentKind ? (
				<div className="fixed inset-0 z-[330] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center">
					<div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5">
						<div className="flex items-start justify-between gap-3">
							<h2 className="text-[18px] font-semibold text-[#1c1c1e]">
								{documentKind === 'terms' ? `${merchant} Membership Terms` : `${merchant} Privacy Notice`}
							</h2>
							<button type="button" className="text-[14px] font-semibold" style={{ color: accent }} onClick={() => setDocumentKind(null)}>
								Close
							</button>
						</div>
						<pre className="mt-4 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-5 text-[#3d4a57]">
							{documentKind === 'terms'
								? policy.terms || 'Membership terms have not been published yet.'
								: policy.privacyNotice || 'A privacy notice has not been published yet.'}
						</pre>
					</div>
				</div>
			) : null}
		</div>
	)
}
