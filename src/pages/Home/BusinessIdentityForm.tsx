import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import { Eye, EyeOff, AlertTriangle, Check, Circle, ArrowRight, Lock, BadgeHelp, Building2, Briefcase } from "lucide-react"
import {
	bizBrandFocusRingClass,
	bizBrandInvalidFieldRingClass,
	bizBrandOnboardingPrimaryBtnClass,
} from "@/pages/Home/brandUi"

const WORKSPACE_LOADING_STYLE = `
@keyframes biz-identity-soft-pulse {
	0%, 100% { opacity: 0.1; transform: scale(0.95); }
	50% { opacity: 0.2; transform: scale(1.05); }
}
@keyframes biz-identity-draw-ring {
	0% { stroke-dashoffset: 283; transform: rotate(0deg); }
	50% { stroke-dashoffset: 70; transform: rotate(180deg); }
	100% { stroke-dashoffset: 283; transform: rotate(360deg); }
}
.biz-identity-soft-pulse { animation: biz-identity-soft-pulse 4s ease-in-out infinite; }
.biz-identity-ring-loader {
	stroke-dasharray: 283;
	animation: biz-identity-draw-ring 3s ease-in-out infinite;
	transform-origin: 50% 50%;
}
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

type RulePillProps = { ok: boolean; label: string }
function RulePill({ ok, label }: RulePillProps) {
	return (
		<div className={`flex items-center gap-1.5 text-[10px] font-medium ${ok ? "text-[#0051d1]" : "text-[#abadaf]"}`}>
			{ok ? (
				<Check className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} aria-hidden />
			) : (
				<Circle className="w-[14px] h-[14px] shrink-0" strokeWidth={2} aria-hidden />
			)}
			{label}
		</div>
	)
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

	if (loading) {
		const overlay = (
			<>
				<style>{WORKSPACE_LOADING_STYLE}</style>
				<div
					className="fixed inset-0 z-[10050] flex h-[100dvh] min-h-[100dvh] w-full max-w-none flex-col bg-white text-[#1a1c1e]"
					style={{
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						paddingTop: "env(safe-area-inset-top)",
						paddingBottom: "env(safe-area-inset-bottom)",
						paddingLeft: "env(safe-area-inset-left)",
						paddingRight: "env(safe-area-inset-right)",
						boxSizing: "border-box",
					}}
				>
					<header className="relative z-10 flex shrink-0 items-center justify-between border-b border-transparent bg-white/80 px-6 py-5 backdrop-blur-xl">
						<div className="flex items-center gap-2">
							<Building2 className="h-6 w-6 shrink-0 scale-110 text-[#0051d1]" strokeWidth={2} aria-hidden />
							<h1 className="text-lg font-bold tracking-tight text-[#0051d1]">Verra Identity</h1>
						</div>
						<div className="flex items-center gap-4">
							<span className="hidden text-[10px] font-bold uppercase tracking-widest text-[#44474e]/60 sm:inline">
								Step 1 of 2
							</span>
							<div
								className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white bg-[#dfe3e6] shadow-sm"
								aria-hidden
							/>
						</div>
					</header>

					<main
						className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-8"
						style={{
							background: "radial-gradient(circle at 50% 50%, #f1f4f9 0%, #ffffff 100%)",
						}}
					>
						<div className="relative mb-12 flex h-48 w-48 shrink-0 items-center justify-center sm:mb-16">
							<div className="biz-identity-soft-pulse absolute inset-0 rounded-full bg-[#0051d1]/5" aria-hidden />
							<svg className="relative h-full w-full" viewBox="0 0 100 100" aria-hidden>
								<circle
									className="text-[#d9dde0]/55"
									cx="50"
									cy="50"
									r="45"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
								/>
								<circle
									className="biz-identity-ring-loader text-[#0051d1]"
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
								<Briefcase className="h-10 w-10 text-[#0051d1]/40" strokeWidth={1.5} aria-hidden />
							</div>
						</div>

						<div className="max-w-sm shrink-0 space-y-4 px-1 text-center">
							<h2 className="text-2xl font-extrabold tracking-tight text-[#1a1c1e] md:text-3xl">
								Creating your business workspace…
							</h2>
							<p className="text-base leading-relaxed text-[#44474e]">
								We&apos;re preparing your business identity and getting your Verra workspace ready.
							</p>
							<div className="pt-2">
								<p className="text-sm font-medium text-[#44474e]/40">This usually takes a few seconds.</p>
							</div>
						</div>
					</main>

					<footer className="relative z-10 flex shrink-0 justify-center pb-10 pt-4">
						<div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-[#dfe2eb]/60 bg-white px-6 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
							<div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#0051d1]/30" aria-hidden />
							<span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#44474e]/70">Business setup in progress</span>
						</div>
					</footer>

					<div
						className="pointer-events-none fixed top-1/4 -left-32 z-0 h-96 w-96 rounded-full bg-[#0051d1]/[0.03] blur-[120px]"
						aria-hidden
					/>
					<div
						className="pointer-events-none fixed bottom-1/4 -right-32 z-0 h-80 w-80 rounded-full bg-[#0051d1]/[0.03] blur-[100px]"
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
				<div className="mb-8">
					<div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
						<span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0051d1] bg-[#0051d1]/5 px-3 py-1 rounded-full">Step 1 of 2</span>
						<span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#abadaf]">Business Identity</span>
					</div>
					<h2 className="font-bold text-2xl text-[#2c2f31] mb-3 tracking-tight">Create your business identity</h2>
					<p className="text-[#595c5e] text-sm leading-relaxed">
						Choose your Verra handle and set the password that protects your business workspace.
					</p>
				</div>
			)}

			<form
				className="space-y-6"
				onSubmit={(e) => {
					e.preventDefault()
					if (canSubmit) void handleContinue()
				}}
			>
				<div className="space-y-2">
					<div className="flex justify-between items-center gap-2">
						<label className="text-[10px] font-bold uppercase tracking-widest text-[#2c2f31]">Business Handle</label>
						<button
							type="button"
							className={`text-[#abadaf] hover:text-[#2c2f31] transition-colors ${bizBrandFocusRingClass} rounded-md p-0.5`}
							title="3–20 characters: letters, numbers, dots, underscores"
							aria-label="Handle format help"
						>
							<BadgeHelp className="w-4 h-4" aria-hidden />
						</button>
					</div>
					<div className="relative">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0051d1] font-bold pointer-events-none select-none">@</span>
						<input
							readOnly={loading || isCheckingTag}
							autoCapitalize="none"
							autoCorrect="off"
							autoComplete="username"
							enterKeyHint="next"
							inputMode="text"
							className={`
								w-full pl-9 pr-4 py-3.5 rounded-xl border-none transition-all font-medium
								text-[#2c2f31] placeholder:text-[#abadaf]
								bg-[#eef1f3]/50 focus:bg-white focus:ring-2 focus:ring-[#0051d1]/20
								${tagStatus === "invalid" ? bizBrandInvalidFieldRingClass : ""}
								${tagStatus !== "invalid" ? bizBrandFocusRingClass : ""}
								disabled:opacity-70
							`}
							value={beamioName}
							placeholder="yourbusiness"
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
						<div className="flex items-center gap-1.5 text-[11px] text-[#0051d1] font-medium pl-1">
							<Check className="w-[14px] h-[14px] shrink-0" strokeWidth={2.5} aria-hidden />
							@{trimmedDisplay} is available
						</div>
					) : null}
				</div>

				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-[10px] font-bold uppercase tracking-widest text-[#2c2f31]">Account Password</label>
						<div className="relative">
							<input
								readOnly={loading}
								type={showPassword ? "text" : "password"}
								autoComplete="new-password"
								enterKeyHint="next"
								className={`
									w-full px-4 py-3.5 rounded-xl border-none transition-all
									text-[#2c2f31] placeholder:text-[#abadaf]
									bg-[#eef1f3]/50 focus:bg-white focus:ring-2 focus:ring-[#0051d1]/20
									${bizBrandFocusRingClass}
								`}
								value={password}
								placeholder="••••••••••••"
								onChange={(e) => setPassword(e.currentTarget.value)}
							/>
							<button
								type="button"
								tabIndex={-1}
								className="absolute right-4 top-1/2 -translate-y-1/2 text-[#abadaf] hover:text-[#2c2f31] transition-colors p-1 rounded-md"
								onClick={() => setShowPassword((s) => !s)}
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
							</button>
						</div>
					</div>
					<div className="space-y-2">
						<label className="text-[10px] font-bold uppercase tracking-widest text-[#2c2f31]">Confirm Password</label>
						<input
							readOnly={loading}
							type={showPassword ? "text" : "password"}
							autoComplete="new-password"
							enterKeyHint="done"
							className={`
								w-full px-4 py-3.5 rounded-xl border-none transition-all
								text-[#2c2f31] placeholder:text-[#abadaf]
								bg-[#eef1f3]/50 focus:bg-white focus:ring-2 focus:ring-[#0051d1]/20
								${confirmMismatch ? bizBrandInvalidFieldRingClass : bizBrandFocusRingClass}
							`}
							value={confirmPassword}
							placeholder="••••••••••••"
							onChange={(e) => setConfirmPassword(e.currentTarget.value)}
						/>
					</div>
				</div>

				<div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
					<RulePill ok={len8} label="8+ characters" />
					<RulePill ok={mixed} label="Mixed case" />
					<RulePill ok={numbers} label="Numbers" />
				</div>

				<div className="p-4 rounded-xl bg-[#0051d1]/5 flex gap-4 border border-[#0051d1]/10">
					<Lock className="w-5 h-5 text-[#0051d1]/80 shrink-0 mt-0.5" strokeWidth={2} aria-hidden />
					<div className="space-y-1 min-w-0">
						<p className="text-[10px] font-bold text-[#2c2f31] uppercase tracking-wider">Protected by local encryption</p>
						<p className="text-[11px] leading-relaxed text-[#595c5e]">
							Your business credentials stay encrypted on this device and under your control.
						</p>
					</div>
				</div>

				<div className="space-y-4 pt-2">
					<AppButton
						type="submit"
						fullWidth
						disabled={!canSubmit}
						className={`
							rounded-full py-4 text-base font-bold flex items-center justify-center gap-2
							shadow-lg shadow-[#0051d1]/10
							${canSubmit ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass}` : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"}
						`}
					>
						Continue
						<ArrowRight className="w-5 h-5 shrink-0" aria-hidden />
					</AppButton>
					{trailingAfterSubmit}
				</div>
			</form>
		</>
	)
}
