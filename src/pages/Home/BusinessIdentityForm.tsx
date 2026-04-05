import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import { Eye, EyeOff, AlertTriangle, Check, ArrowRight, ShieldCheck } from "lucide-react"
import {
	bizBrandFocusRingClass,
	bizBrandInvalidFieldRingClass,
	bizBrandOnboardingPrimaryBtnClass,
} from "@/pages/Home/brandUi"
import WorkspaceCreatingOverlay from "@/pages/Home/WorkspaceCreatingOverlay"
import {
	BEAMIO_TAG_ALLOWED_RE,
	BEAMIO_TAG_RULE_HINT,
	normalizeBeamioTagInput,
} from "@/utils/beamioTagRules"

export type BusinessIdentitySuccess = {
	qrDataUrl: string
	pin: string
	passcode: string
	temp: any
	beamioTag: string
}

function passwordRuleChecks(password: string) {
	const len8 = password.length >= 8
	const mixed = /[a-z]/.test(password) && /[A-Z]/.test(password)
	const numbers = /[0-9]/.test(password)
	return { len8, mixed, numbers }
}

export type BusinessIdentityFormProps = {
	onSuccess: (v: BusinessIdentitySuccess) => void
	isRedeemFlow?: boolean
	/** When false, omit Step 1 / title block (parent already shows it). */
	showIntroHeader?: boolean
	/** Rendered after the primary Continue button (e.g. Restore Wallet). */
	trailingAfterSubmit?: React.ReactNode
	/**
	 * When set, full-screen “creating workspace” UI is owned by parent (stays up across route switch)
	 * so Recovery QR does not flash the identity shell underneath.
	 */
	onWorkspaceCreatingChange?: (creating: boolean) => void
}

export default function BusinessIdentityForm({
	onSuccess,
	isRedeemFlow: _isRedeemFlow = false,
	showIntroHeader = true,
	trailingAfterSubmit,
	onWorkspaceCreatingChange,
}: BusinessIdentityFormProps) {
	const [beamioName, setBeamioName] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)

	const lastCheckedRef = useRef("")
	const handleInputRef = useRef<HTMLInputElement>(null)
	const passwordInputRef = useRef<HTMLInputElement>(null)
	const confirmInputRef = useRef<HTMLInputElement>(null)
	const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
	const [tagError, setTagError] = useState("")

	const localValidateTag = (raw: string) => {
		const trimmed = normalizeBeamioTagInput(raw)
		if (!trimmed) return { ok: false, v: "", msg: "Please enter a business handle" }
		if (!BEAMIO_TAG_ALLOWED_RE.test(trimmed)) {
			return { ok: false, v: trimmed, msg: BEAMIO_TAG_RULE_HINT }
		}
		return { ok: true, v: trimmed, msg: "" }
	}

	const validateAndCheckTag = async () => {
		if (tagStatus === "checking") return false

		const { ok, v, msg } = localValidateTag(beamioName)
		setTagError("")

		if (!ok) {
			if (v.length > 0) {
				setTagStatus("invalid")
				setTagError(msg)
			} else {
				setTagStatus("idle")
			}
			return false
		}

		if (v === lastCheckedRef.current && tagStatus === "valid") return true
		lastCheckedRef.current = v

		setTagStatus("checking")
		try {
			const available = await checkBeamioAccountAPI(v)
			if (!available) {
				setTagStatus("invalid")
				setTagError(`@${v} is already taken`)
				return false
			}
			setTagStatus("valid")
			setTagError("")
			return true
		} catch {
			setTagStatus("invalid")
			setTagError("Network error. Try again.")
			return false
		}
	}

	useEffect(() => {
		const trimmed = normalizeBeamioTagInput(beamioName)
		if (trimmed.length <= 2) return
		if (trimmed === lastCheckedRef.current && tagStatus === "valid") return

		const t = setTimeout(() => {
			validateAndCheckTag()
		}, 3000)
		return () => clearTimeout(t)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [beamioName, tagStatus])

	const { len8, mixed, numbers } = passwordRuleChecks(password)
	const tagOk = tagStatus === "valid"
	const isCheckingTag = tagStatus === "checking"
	const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword
	const passwordsMatch = password.length > 0 && password === confirmPassword

	const canSubmit = tagOk && len8 && mixed && numbers && passwordsMatch && !loading && !isCheckingTag

	const handleContinue = async () => {
		const tagOkNow = await validateAndCheckTag()
		if (!tagOkNow) return
		const { len8: l, mixed: m, numbers: n } = passwordRuleChecks(password)
		if (!l || !m || !n || password !== confirmPassword) return

		const trimmedTag = normalizeBeamioTagInput(beamioName || "")
		if (!trimmedTag) return

		onWorkspaceCreatingChange?.(true)
		setLoading(true)
		const kks = await createRecover(trimmedTag, password)
		setLoading(false)

		if (!kks) {
			onWorkspaceCreatingChange?.(false)
			return
		}

		onSuccess({
			qrDataUrl: kks.qrCode,
			pin: password,
			passcode: kks.recoverCode,
			temp: kks.temp,
			beamioTag: trimmedTag,
		})
	}

	const trimmedDisplay = normalizeBeamioTagInput(beamioName)

	const onHandleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		e.stopPropagation()
		if (loading || isCheckingTag) return
		const ok = await validateAndCheckTag()
		if (ok) passwordInputRef.current?.focus()
	}

	const onPasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		e.stopPropagation()
		if (loading) return
		confirmInputRef.current?.focus()
	}

	const onConfirmKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		e.stopPropagation()
		if (loading) return
		if (canSubmit) void handleContinue()
	}

	if (loading) {
		if (onWorkspaceCreatingChange) {
			return <div className="min-h-[72vh] w-full max-w-full" aria-hidden />
		}

		return (
			<>
				{typeof document !== "undefined" ? createPortal(<WorkspaceCreatingOverlay />, document.body) : null}
				<div className="min-h-[72vh] w-full max-w-full" aria-hidden />
			</>
		)
	}

	return (
		<>
			{showIntroHeader && (
				<div className="mb-10">
					<div className="mb-6 flex flex-wrap items-center justify-between gap-2">
						<span className="rounded-full bg-[#1562F0]/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1562F0]">
							Step 1 of 2
						</span>
						<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]/70">Business Identity</span>
					</div>
					<h2 className="biz-identity-headline mb-4 text-3xl font-extrabold tracking-tight text-[#121212]">
						Create your business identity
					</h2>
					<p className="leading-relaxed text-[#666666]">
						Choose your Verra handle and set the password that protects your business workspace.
					</p>
				</div>
			)}

			<form
				className="space-y-8"
				onSubmit={(e) => {
					e.preventDefault()
					if (canSubmit) void handleContinue()
				}}
			>
				<div className="space-y-3">
					<label className="text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70" htmlFor="biz-identity-handle">
						Business Handle
					</label>
					<div className="relative">
						<span
							className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#1562F0]"
							aria-hidden
						>
							@
						</span>
						<input
							ref={handleInputRef}
							id="biz-identity-handle"
							readOnly={loading || isCheckingTag}
							autoCapitalize="none"
							autoCorrect="off"
							autoComplete="username"
							enterKeyHint="next"
							inputMode="text"
							onKeyDown={onHandleKeyDown}
							className={`
								w-full rounded-xl border border-[#E5E7EB] bg-white py-4 pl-10 pr-5 text-lg font-medium transition-all
								text-[#121212] placeholder:text-[#666666]/40
								focus:border-[#1562F0] focus:outline-none focus:ring-2 focus:ring-[#1562F0]/10
								${tagStatus === "invalid" ? bizBrandInvalidFieldRingClass : ""}
								${tagStatus !== "invalid" ? bizBrandFocusRingClass : ""}
								disabled:opacity-70
							`}
							value={beamioName}
							placeholder="yourbusiness"
							onChange={(e) => {
								if (isCheckingTag) return
								const next = normalizeBeamioTagInput(e.currentTarget.value)
								setBeamioName(next)
								setTagStatus("idle")
								setTagError("")
							}}
							onBlur={() => {
								const t = normalizeBeamioTagInput(beamioName)
								if (t.length >= 3) void validateAndCheckTag()
							}}
						/>
					</div>
					{tagStatus === "invalid" && tagError ? (
						<div className="flex items-center gap-1.5 text-[11px] text-orange-600 font-medium pl-1">
							<AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
							{tagError}
						</div>
					) : tagStatus === "valid" && trimmedDisplay ? (
						<div className="flex items-center gap-1.5 pl-1 text-[11px] font-medium text-[#1562F0]">
							<Check className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} aria-hidden />
							@{trimmedDisplay} is available
						</div>
					) : null}
				</div>

				<div className="space-y-4">
					<div className="grid grid-cols-1 gap-6">
						<div className="space-y-2">
							<label
								className="block px-4 text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
								htmlFor="biz-identity-password"
							>
								Account Password
							</label>
							<div className="relative">
								<input
									ref={passwordInputRef}
									id="biz-identity-password"
									readOnly={loading}
									type={showPassword ? "text" : "password"}
									autoComplete="new-password"
									enterKeyHint="next"
									onKeyDown={onPasswordKeyDown}
									className={[
										"w-full rounded-xl border border-[#E5E7EB] bg-white py-4 pl-5 pr-12 text-lg font-medium outline-none transition-all",
										"text-[#121212] placeholder:text-[#666666]/40",
										"focus:border-[#1562F0] focus:ring-2 focus:ring-[#1562F0]/10 disabled:opacity-70",
										bizBrandFocusRingClass,
									].join(" ")}
									value={password}
									placeholder="••••••••••••"
									onChange={(e) => setPassword(e.currentTarget.value)}
								/>
								<button
									type="button"
									tabIndex={-1}
									className="absolute inset-y-0 right-4 flex items-center rounded-md p-1 text-[#666666]/70 transition-colors hover:text-[#121212] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562F0]/30"
									onClick={() => setShowPassword((s) => !s)}
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
								</button>
							</div>
						</div>
						<div className="space-y-2">
							<label
								className="block px-4 text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
								htmlFor="biz-identity-confirm-password"
							>
								Confirm Password
							</label>
							<input
								ref={confirmInputRef}
								id="biz-identity-confirm-password"
								readOnly={loading}
								type={showPassword ? "text" : "password"}
								autoComplete="new-password"
								enterKeyHint="done"
								onKeyDown={onConfirmKeyDown}
								className={[
									"w-full rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-lg font-medium outline-none transition-all",
									"text-[#121212] placeholder:text-[#666666]/40",
									"disabled:opacity-70",
									confirmMismatch
										? "ring-2 ring-orange-400/80 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
										: "focus:border-[#1562F0] focus:ring-2 focus:ring-[#1562F0]/10 " + bizBrandFocusRingClass,
								].join(" ")}
								value={confirmPassword}
								placeholder="••••••••••••"
								onChange={(e) => setConfirmPassword(e.currentTarget.value)}
							/>
							{confirmMismatch ? (
								<div className="flex items-center gap-2 px-4 pt-0.5 text-orange-600">
									<AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
									<span className="text-[13px] font-semibold leading-snug">Passwords do not match</span>
								</div>
							) : null}
						</div>
					</div>

					<ul className="space-y-2.5 px-2 pt-1" aria-label="Password requirements">
						{(
							[
								{ ok: len8, label: "At least 8 characters" },
								{ ok: mixed, label: "Upper and lowercase letters" },
								{ ok: numbers, label: "At least one number" },
							] as const
						).map(({ ok, label }) => (
							<li key={label} className="flex items-center gap-2.5">
								{ok ? (
									<Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
								) : (
									<span className="h-4 w-4 shrink-0 rounded-full border-2 border-[#c3c6d8]" aria-hidden />
								)}
								<span className={`text-[13px] font-medium ${ok ? "text-[#121212]" : "text-[#666666]"}`}>{label}</span>
							</li>
						))}
					</ul>
				</div>

				<div className="flex items-start gap-4 pt-2">
					<ShieldCheck
						className="mt-0.5 h-6 w-6 shrink-0 text-[#666666]/40"
						strokeWidth={1.75}
						aria-hidden
					/>
					<div className="min-w-0 space-y-1">
						<p className="text-[11px] font-bold uppercase tracking-wider text-[#121212]">
							Protected by local encryption
						</p>
						<p className="text-[13px] leading-relaxed text-[#666666]">
							Your business credentials stay encrypted on this device and under your control.
						</p>
					</div>
				</div>

				<div className="space-y-4 pt-4">
					<AppButton
						type="submit"
						fullWidth
						disabled={!canSubmit}
						rightIcon={<ArrowRight className="h-6 w-6 shrink-0" strokeWidth={2.25} aria-hidden />}
						className={`
							rounded-xl py-5 text-lg font-extrabold
							shadow-lg shadow-[#1562F0]/10
							${canSubmit ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass}` : "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"}
						`}
					>
						Continue
					</AppButton>
					{trailingAfterSubmit}
				</div>
			</form>
		</>
	)
}
