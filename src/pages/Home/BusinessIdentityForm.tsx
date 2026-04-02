import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import {
	Eye,
	EyeOff,
	AlertTriangle,
	Check,
	ArrowRight,
	ShieldCheck,
	Building2,
	Briefcase,
} from "lucide-react"
import {
	bizBrandFocusRingClass,
	bizBrandInvalidFieldRingClass,
	bizBrandOnboardingPrimaryBtnClass,
} from "@/pages/Home/brandUi"

/** Loading overlay — aligned with `marketExample.html` (fluid-bg, ring loader, top bar). */
const WORKSPACE_LOADING_STYLE = `
@keyframes biz-workspace-soft-pulse {
	0%, 100% { opacity: 0.1; transform: scale(0.95); }
	50% { opacity: 0.2; transform: scale(1.05); }
}
@keyframes biz-workspace-draw-ring {
	0% { stroke-dashoffset: 283; transform: rotate(0deg); }
	50% { stroke-dashoffset: 70; transform: rotate(180deg); }
	100% { stroke-dashoffset: 283; transform: rotate(360deg); }
}
.biz-workspace-fluid-bg {
	background: radial-gradient(circle at 50% 50%, #f1f4f9 0%, #ffffff 100%);
}
.biz-workspace-soft-pulse { animation: biz-workspace-soft-pulse 4s ease-in-out infinite; }
.biz-workspace-ring-loader {
	stroke-dasharray: 283;
	animation: biz-workspace-draw-ring 3s ease-in-out infinite;
	transform-origin: center;
}
.biz-identity-headline { font-family: Manrope, ui-sans-serif, system-ui, sans-serif; }
`

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
}

export default function BusinessIdentityForm({
	onSuccess,
	isRedeemFlow: _isRedeemFlow = false,
	showIntroHeader = true,
	trailingAfterSubmit,
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
		const trimmed = raw.trim().replace(/^@+/, "")
		if (!trimmed) return { ok: false, v: "", msg: "Please enter a business handle" }
		if (!/^[a-zA-Z0-9_.]{3,20}$/.test(trimmed)) {
			return { ok: false, v: trimmed, msg: "Use 3–20 letters, numbers, dots, or underscores" }
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
		const trimmed = beamioName.trim().replace(/^@+/, "")
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

		const trimmedTag = (beamioName || "").trim().replace(/^@+/, "")
		if (!trimmedTag) return

		setLoading(true)
		const kks = await createRecover(trimmedTag, password)
		setLoading(false)

		if (!kks) return

		onSuccess({
			qrDataUrl: kks.qrCode,
			pin: password,
			passcode: kks.recoverCode,
			temp: kks.temp,
			beamioTag: trimmedTag,
		})
	}

	const trimmedDisplay = beamioName.trim().replace(/^@+/, "")

	const onHandleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		if (loading || isCheckingTag) return
		const ok = await validateAndCheckTag()
		if (ok) passwordInputRef.current?.focus()
	}

	const onPasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		if (loading) return
		confirmInputRef.current?.focus()
	}

	const onConfirmKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== "Enter") return
		e.preventDefault()
		if (loading) return
		if (canSubmit) void handleContinue()
	}

	if (loading) {
		const overlay = (
			<>
				<style>{WORKSPACE_LOADING_STYLE}</style>
				<div
					className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#1a1c1e]"
					style={{
						paddingLeft: "env(safe-area-inset-left)",
						paddingRight: "env(safe-area-inset-right)",
						boxSizing: "border-box",
					}}
				>
					{/* TopAppBar — marketExample.html */}
					<header
						className="fixed left-0 right-0 top-0 z-[10052] flex items-center justify-between bg-white/80 px-6 py-5 backdrop-blur-xl"
						style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
					>
						<div className="flex items-center gap-2">
							<Building2
								className="h-7 w-7 shrink-0 scale-110 text-[#0051d1]"
								strokeWidth={2}
								aria-hidden
							/>
							<h1 className="biz-identity-headline text-lg font-bold tracking-tight text-[#0051d1]">Verra Identity</h1>
						</div>
						<div className="flex items-center gap-4">
							<span className="biz-identity-headline text-[10px] font-bold uppercase tracking-widest text-[#44474e]/60">
								Step 1 of 2
							</span>
							<div
								className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white bg-[#d9dde0] shadow-sm"
								aria-hidden
							/>
						</div>
					</header>

					{/* Main canvas — fluid-bg, centered loader + copy */}
					<main
						className="biz-workspace-fluid-bg relative z-[10051] flex min-h-[100dvh] w-full flex-grow flex-col items-center justify-center px-8"
						style={{
							paddingTop: "calc(5.5rem + env(safe-area-inset-top))",
							paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
						}}
					>
						<div className="mx-auto flex w-full max-w-lg flex-col items-center">
							<div className="relative mb-16 flex h-48 w-48 shrink-0 items-center justify-center">
								<div
									className="biz-workspace-soft-pulse absolute inset-0 rounded-full bg-[#0051d1]/5"
									aria-hidden
								/>
								<svg className="relative h-full w-full" viewBox="0 0 100 100" aria-hidden>
									<circle
										className="text-[#d9dde0]/30"
										cx="50"
										cy="50"
										r="45"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
									<circle
										className="biz-workspace-ring-loader text-[#0051d1]"
										cx="50"
										cy="50"
										r="45"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeWidth="2"
									/>
								</svg>
								<div className="absolute inset-0 flex items-center justify-center">
									<Briefcase
										className="h-9 w-9 text-[#0051d1]/40"
										strokeWidth={1.5}
										aria-hidden
									/>
								</div>
							</div>

							<div className="max-w-sm space-y-4 text-center">
								<h2 className="biz-identity-headline text-2xl font-extrabold tracking-tight text-[#1a1c1e] md:text-3xl">
									Creating your business workspace…
								</h2>
								<p className="text-base leading-relaxed text-[#44474e]">
									We&apos;re preparing your business identity and getting your Verra workspace ready.
								</p>
								<div className="pt-2">
									<p className="text-sm font-medium text-[#44474e]/50">This usually takes a few seconds.</p>
								</div>
							</div>
						</div>
					</main>

					{/* Footer status — fixed bottom-12 */}
					<footer
						className="fixed left-0 right-0 z-[10052] flex justify-center px-4"
						style={{ bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" }}
					>
						<div className="inline-flex items-center gap-2.5 rounded-full border border-[#dfe2eb]/40 bg-white px-6 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
							<div
								className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#0051d1]/30"
								aria-hidden
							/>
							<span className="biz-identity-headline text-[10px] font-bold uppercase tracking-[0.15em] text-[#44474e]/70">
								Business setup in progress
							</span>
						</div>
					</footer>

					<div
						className="pointer-events-none fixed left-0 top-1/4 -left-32 z-[10048] h-96 w-96 rounded-full bg-[#0051d1]/[0.03] blur-[120px]"
						aria-hidden
					/>
					<div
						className="pointer-events-none fixed -right-32 bottom-1/4 z-[10048] h-80 w-80 rounded-full bg-[#0051d1]/[0.03] blur-[100px]"
						aria-hidden
					/>
				</div>
			</>
		)

		return (
			<>
				{typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
				{/* In-flow height: portal does not occupy layout; keep parent glass column from collapsing */}
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
								w-full rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-lg font-medium transition-all
								text-[#121212] placeholder:text-[#666666]/40
								focus:border-[#1562F0] focus:outline-none focus:ring-2 focus:ring-[#1562F0]/10
								${tagStatus === "invalid" ? bizBrandInvalidFieldRingClass : ""}
								${tagStatus !== "invalid" ? bizBrandFocusRingClass : ""}
								disabled:opacity-70
							`}
							value={beamioName}
							placeholder="@yourbusiness"
							onChange={(e) => {
								if (isCheckingTag) return
								const next = e.currentTarget.value.replace(/@/g, "")
								setBeamioName(next)
								setTagStatus("idle")
								setTagError("")
							}}
							onBlur={() => {
								const t = beamioName.trim().replace(/^@+/, "")
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

				<div className="grid grid-cols-1 gap-6">
					<div className="space-y-3">
						<label
							className="text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
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
								className={`
									w-full rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 pr-12 text-lg transition-all
									text-[#121212] placeholder:text-[#666666]/40
									focus:border-[#1562F0] focus:outline-none focus:ring-2 focus:ring-[#1562F0]/10
									${bizBrandFocusRingClass}
								`}
								value={password}
								placeholder="••••••••••••"
								onChange={(e) => setPassword(e.currentTarget.value)}
							/>
							<button
								type="button"
								tabIndex={-1}
								className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#666666]/70 transition-colors hover:text-[#121212]"
								onClick={() => setShowPassword((s) => !s)}
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
							</button>
						</div>
					</div>
					<div className="space-y-3">
						<label
							className="text-[11px] font-extrabold uppercase tracking-widest text-[#121212]/70"
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
							className={`
								w-full rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-lg transition-all
								text-[#121212] placeholder:text-[#666666]/40
								focus:border-[#1562F0] focus:outline-none focus:ring-2 focus:ring-[#1562F0]/10
								${confirmMismatch ? bizBrandInvalidFieldRingClass : bizBrandFocusRingClass}
							`}
							value={confirmPassword}
							placeholder="••••••••••••"
							onChange={(e) => setConfirmPassword(e.currentTarget.value)}
						/>
					</div>
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
						className={`
							flex items-center justify-center gap-2 rounded-xl py-5 text-lg font-extrabold
							shadow-lg shadow-[#1562F0]/10
							${canSubmit ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass}` : "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"}
						`}
					>
						Continue
						<ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
					</AppButton>
					{trailingAfterSubmit}
				</div>
			</form>
		</>
	)
}
