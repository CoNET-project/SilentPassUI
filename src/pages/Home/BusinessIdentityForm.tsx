import React, { useEffect, useRef, useState } from "react"
import { AppButton } from "@/components/button/AppButton"
import { ethers } from "ethers"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import { ensureConetAaForEoa } from "@/utils/ensureConetAa"
import { ArrowRight, Eye, EyeOff, AlertTriangle, Check, ShieldCheck, Loader2 } from "lucide-react"
import {
	bizBrandFocusRingClass,
	bizBrandInvalidFieldRingClass,
	bizBrandOnboardingPrimaryBtnClass,
} from "@/pages/Home/brandUi"
import WorkspaceCreatingOverlay, {
	awaitWorkspaceCreatingPaint,
	WORKSPACE_CREATING_LEAD_MS,
	WORKSPACE_CREATING_STEP_DURATION_MS,
	WORKSPACE_CREATING_STEPS,
} from "@/pages/Home/WorkspaceCreatingOverlay"
import {
	BEAMIO_TAG_ALLOWED_RE,
	normalizeBeamioTagInput,
} from "@/utils/beamioTagRules"
import type { VerraBusinessProfileDraft } from "@/utils/verraBusinessProfileLocal"
import { useTu } from '@/locale/beamioLocale'

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

/** Align with SilentPassUI onboarding BeamioTag: wait 3s after typing stops. */
const TAG_AVAILABILITY_DEBOUNCE_MS = 3000

export type BusinessIdentityFormProps = {
	onSuccess: (v: BusinessIdentitySuccess) => void
	recoveryDraft?: Partial<VerraBusinessProfileDraft> | null
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
	recoveryDraft,
	isRedeemFlow: _isRedeemFlow = false,
	showIntroHeader = true,
	trailingAfterSubmit,
	onWorkspaceCreatingChange,
}: BusinessIdentityFormProps) {
	const { tu } = useTu()
	const [beamioName, setBeamioName] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [creatingStep, setCreatingStep] = useState(0)
	const [submitError, setSubmitError] = useState("")

	const lastCheckedRef = useRef("")
	const tagCheckSeqRef = useRef(0)
	const tagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const beamioNameRef = useRef("")
	const tagStatusRef = useRef<"idle" | "checking" | "valid" | "invalid">("idle")
	const handleInputRef = useRef<HTMLInputElement>(null)
	const passwordInputRef = useRef<HTMLInputElement>(null)
	const confirmInputRef = useRef<HTMLInputElement>(null)
	const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
	const [tagError, setTagError] = useState("")

	const setTagStatusSynced = (next: "idle" | "checking" | "valid" | "invalid") => {
		tagStatusRef.current = next
		setTagStatus(next)
	}

	const isHandleConfirmedAvailable = (v: string) =>
		v.length >= 3 && v === lastCheckedRef.current

	const settleTagStatusAfterStaleCheck = () => {
		const current = normalizeBeamioTagInput(beamioNameRef.current)
		if (isHandleConfirmedAvailable(current)) {
			setTagStatusSynced("valid")
			setTagError("")
			return
		}
		if (tagStatusRef.current === "checking") {
			setTagStatusSynced("idle")
		}
	}

	const localValidateTag = (raw: string) => {
		const trimmed = normalizeBeamioTagInput(raw)
		if (!trimmed) return { ok: false, v: "", msg: tu('onb_identity_enter_handle') }
		if (!BEAMIO_TAG_ALLOWED_RE.test(trimmed)) {
			return { ok: false, v: trimmed, msg: tu('onb_identity_tag_rule_hint') }
		}
		return { ok: true, v: trimmed, msg: "" }
	}

	const validateAndCheckTag = async () => {
		const { ok, v, msg } = localValidateTag(beamioName)
		setTagError("")

		if (!ok) {
			if (v.length > 0) {
				setTagStatusSynced("invalid")
				setTagError(msg)
			} else {
				setTagStatusSynced("idle")
			}
			return false
		}

		if (isHandleConfirmedAvailable(v)) {
			if (tagStatusRef.current !== "valid") {
				setTagStatusSynced("valid")
			}
			return true
		}

		if (tagStatusRef.current === "checking") {
			return false
		}

		const seq = ++tagCheckSeqRef.current
		setTagStatusSynced("checking")
		try {
			const available = await checkBeamioAccountAPI(v)
			if (seq !== tagCheckSeqRef.current) return false
			if (normalizeBeamioTagInput(beamioNameRef.current) !== v) {
				settleTagStatusAfterStaleCheck()
				return false
			}
			if (!available) {
				setTagStatusSynced("invalid")
				setTagError(tu('onb_identity_tag_taken', { tag: v }))
				return false
			}
			lastCheckedRef.current = v
			setTagStatusSynced("valid")
			setTagError("")
			return true
		} catch {
			if (seq !== tagCheckSeqRef.current) return false
			if (normalizeBeamioTagInput(beamioNameRef.current) !== v) {
				settleTagStatusAfterStaleCheck()
				return false
			}
			setTagStatusSynced("invalid")
			setTagError(tu('onb_identity_network_error'))
			return false
		}
	}

	const scheduleTagAvailabilityCheck = (raw?: string) => {
		if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current)
		const trimmed = normalizeBeamioTagInput(raw ?? beamioName)
		if (trimmed.length <= 2) return
		const { ok } = localValidateTag(trimmed)
		if (!ok) return
		if (isHandleConfirmedAvailable(trimmed)) return
		tagDebounceRef.current = setTimeout(() => {
			tagDebounceRef.current = null
			void validateAndCheckTag()
		}, TAG_AVAILABILITY_DEBOUNCE_MS)
	}

	useEffect(() => {
		beamioNameRef.current = beamioName
	}, [beamioName])

	useEffect(() => {
		return () => {
			if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current)
		}
	}, [])

	const { len8, mixed, numbers } = passwordRuleChecks(password)
	const tagOk = tagStatus === "valid"
	const isCheckingTag = tagStatus === "checking"
	const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword
	const passwordsMatch = password.length > 0 && password === confirmPassword

	const canSubmit = tagOk && len8 && mixed && numbers && passwordsMatch && !loading && !isCheckingTag

	useEffect(() => {
		onWorkspaceCreatingChange?.(loading)
	}, [loading, onWorkspaceCreatingChange])

	useEffect(() => {
		if (!loading) {
			setCreatingStep(0)
			return
		}
		const advance = () => setCreatingStep((prev) => Math.min(prev + 1, WORKSPACE_CREATING_STEPS.length - 1))
		const timers: ReturnType<typeof setTimeout>[] = []
		for (let i = 1; i < WORKSPACE_CREATING_STEPS.length; i++) {
			timers.push(setTimeout(advance, WORKSPACE_CREATING_LEAD_MS + i * WORKSPACE_CREATING_STEP_DURATION_MS))
		}
		return () => timers.forEach((t) => clearTimeout(t))
	}, [loading])

	const handleContinue = async () => {
		const tagOkNow = await validateAndCheckTag()
		if (!tagOkNow) return
		const { len8: l, mixed: m, numbers: n } = passwordRuleChecks(password)
		if (!l || !m || !n || password !== confirmPassword) return

		const trimmedTag = normalizeBeamioTagInput(beamioName || "")
		if (!trimmedTag) return

		setSubmitError("")
		setLoading(true)
		await awaitWorkspaceCreatingPaint()

		let kks: Awaited<ReturnType<typeof createRecover>> = null
		try {
			kks = await createRecover(trimmedTag, password, recoveryDraft)
		} catch {
			kks = null
		}

		if (!kks) {
			setLoading(false)
			setSubmitError(tu('onb_identity_create_failed'))
			return
		}

		const createEoa = kks.temp?.profiles?.[0]?.keyID?.trim()
		if (createEoa && ethers.isAddress(createEoa)) {
			try {
				const aa = await ensureConetAaForEoa(ethers.getAddress(createEoa))
				if (aa && kks.temp?.profiles?.[0]) {
					kks.temp.profiles[0] = { ...kks.temp.profiles[0], aaAccount: aa }
				}
			} catch {
				/* 不可信失败：不阻断 onboarding；Daemon / Wallet 会重试 */
			}
		}

		onSuccess({
			qrDataUrl: kks.qrCode,
			pin: password,
			passcode: kks.recoverCode,
			temp: kks.temp,
			beamioTag: trimmedTag,
		})
		// 成功：保持 loading/workspaceCreating 遮罩直至父级切到 Recovery（避免 Identity 表单闪回）
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
		// 父级 LoadingPage 持有全屏遮罩时，避免子级卸载遮罩导致 Identity 闪屏
		if (onWorkspaceCreatingChange) return null
		return <WorkspaceCreatingOverlay creatingStep={creatingStep} />
	}

	return (
		<>
			{showIntroHeader && (
				<div className="mb-10 text-center">
					<h2 className="biz-identity-headline mb-2 text-3xl font-extrabold tracking-tight text-[#121212]">
						{tu('onb_identity_title')}
					</h2>
					<p className="mb-4 text-2xl leading-none" aria-hidden>
						✨
					</p>
					<p className="leading-relaxed text-[#666666]">
						{tu('onb_identity_sub')}
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
						{tu('onb_identity_handle_label')}
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
							readOnly={loading}
							autoCapitalize="none"
							autoCorrect="off"
							autoComplete="username"
							enterKeyHint="next"
							inputMode="text"
							onKeyDown={onHandleKeyDown}
							className={`
								w-full rounded-2xl border border-[#E5E7EB] bg-white py-4 pl-10 pr-12 text-lg font-medium
								text-[#121212] placeholder:text-[#666666]/40
								focus:border-[#1562F0] focus:outline-none focus:ring-2 focus:ring-[#1562F0]/10
								${tagStatus === "invalid" ? bizBrandInvalidFieldRingClass : ""}
								${tagStatus !== "invalid" ? bizBrandFocusRingClass : ""}
								read-only:opacity-100
							`}
							value={beamioName}
							placeholder={tu('onb_identity_handle_ph')}
							onChange={(e) => {
								const next = normalizeBeamioTagInput(e.currentTarget.value)
								setBeamioName(next)
								beamioNameRef.current = next
								if (tagDebounceRef.current) {
									clearTimeout(tagDebounceRef.current)
									tagDebounceRef.current = null
								}
								const local = localValidateTag(next)
								if (!local.ok) {
									tagCheckSeqRef.current += 1
									if (local.v.length > 0) {
										setTagStatusSynced("invalid")
										setTagError(local.msg)
									} else {
										setTagStatusSynced("idle")
										setTagError("")
									}
									return
								}
								setTagError("")
								if (isHandleConfirmedAvailable(local.v)) return
								if (tagStatusRef.current === "checking") {
									tagCheckSeqRef.current += 1
									setTagStatusSynced("idle")
								} else if (
									local.v !== lastCheckedRef.current &&
									(tagStatusRef.current === "valid" || tagStatusRef.current === "invalid")
								) {
									setTagStatusSynced("idle")
								}
								scheduleTagAvailabilityCheck(local.v)
							}}
							onBlur={() => {
								const t = normalizeBeamioTagInput(beamioName)
								if (t.length < 3 || isHandleConfirmedAvailable(t)) return
								if (tagDebounceRef.current) {
									clearTimeout(tagDebounceRef.current)
									tagDebounceRef.current = null
								}
								void validateAndCheckTag()
							}}
						/>
						<div className="pointer-events-none absolute inset-y-0 right-4 flex w-5 items-center justify-center">
							<Loader2
								className={`absolute h-5 w-5 text-[#1562F0] ${isCheckingTag ? "animate-spin opacity-100" : "opacity-0"}`}
								strokeWidth={2.25}
								aria-hidden
							/>
							<div
								className={`absolute flex items-center justify-center rounded-full bg-emerald-500 p-0.5 ${
									tagOk && trimmedDisplay && !isCheckingTag ? "opacity-100" : "opacity-0"
								}`}
							>
								<Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
							</div>
						</div>
					</div>
					<div className="min-h-[1.375rem] pl-1" aria-live="polite">
						{tagStatus === "invalid" && tagError ? (
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600">
								<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
								<span>{tagError}</span>
							</div>
						) : tagStatus === "valid" && trimmedDisplay ? (
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1562F0]">
								<Check className="h-[14px] w-[14px] shrink-0" strokeWidth={2.5} aria-hidden />
								<span>{tu('onb_identity_tag_available', { tag: trimmedDisplay })}</span>
							</div>
						) : tagStatus === "checking" ? (
							<p className="text-[11px] font-medium text-[#666666]/80">{tu('onb_identity_tag_checking')}</p>
						) : (
							<p className="text-[11px] font-medium text-[#666666]/70">{tu('onb_identity_handle_permanent_hint')}</p>
						)}
					</div>
				</div>

				<div className="space-y-4">
					<div className="grid grid-cols-1 gap-6">
						<div className="space-y-2">
							<label
								className="block px-4 text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
								htmlFor="biz-identity-password"
							>
								{tu('onb_identity_password_label')}
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
										"w-full rounded-2xl border border-[#E5E7EB] bg-white py-4 pl-5 pr-12 text-lg font-medium outline-none transition-all",
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
									aria-label={showPassword ? tu('hide_password') : tu('show_password')}
								>
									{showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
								</button>
							</div>
							<p className="px-1 text-[12px] leading-snug text-[#666666]/80">
								{tu('onb_identity_password_hint')}
							</p>
						</div>
						<div className="space-y-2">
							<label
								className="block px-4 text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
								htmlFor="biz-identity-confirm-password"
							>
								{tu('onb_identity_confirm_password_label')}
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
									"w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 text-lg font-medium outline-none transition-all",
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
									<span className="text-[13px] font-semibold leading-snug">{tu('onb_identity_passwords_mismatch')}</span>
								</div>
							) : null}
						</div>
					</div>

					<ul className="space-y-2.5 px-2 pt-1" aria-label={tu('onb_identity_pw_req_aria')}>
						{(
							[
								{ ok: len8, key: "onb_identity_pw_len8" },
								{ ok: mixed, key: "onb_identity_pw_mixed" },
								{ ok: numbers, key: "onb_identity_pw_numbers" },
							] as const
						).map(({ ok, key }) => (
							<li key={key} className="flex items-center gap-2.5">
								{ok ? (
									<Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
								) : (
									<span className="h-4 w-4 shrink-0 rounded-full border-2 border-[#c3c6d8]" aria-hidden />
								)}
								<span className={`text-[13px] font-medium ${ok ? "text-[#121212]" : "text-[#666666]"}`}>{tu(key)}</span>
							</li>
						))}
					</ul>
				</div>

				<div className="flex items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-4 sm:gap-4 sm:px-5">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562F0]/10">
						<ShieldCheck
							className="h-5 w-5 text-[#1562F0]"
							strokeWidth={2}
							aria-hidden
						/>
					</div>
					<div className="min-w-0 space-y-1">
						<p className="text-[11px] font-bold uppercase tracking-wider text-[#121212]">
							{tu('onb_identity_encryption_title')}
						</p>
						<p className="text-[13px] leading-relaxed text-[#666666]">
							{tu('onb_identity_encryption_body')}
						</p>
					</div>
				</div>

				<div className="space-y-4 pt-4">
					{submitError ? (
						<div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
							<p className="text-[13px] font-semibold leading-snug">{submitError}</p>
						</div>
					) : null}
					<AppButton
						type="submit"
						fullWidth
						disabled={!canSubmit}
						className={`
							rounded-xl py-5 text-lg font-extrabold
							${canSubmit ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass}` : "cursor-not-allowed bg-[#c5d4f5] text-white/90 shadow-none"}
						`}
						rightIcon={<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />}
					>{tu('continue')}</AppButton>
					{trailingAfterSubmit}
				</div>
			</form>
		</>
	)
}
