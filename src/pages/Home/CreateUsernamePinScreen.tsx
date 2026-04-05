import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import {
	Eye,
	EyeOff,
	AlertTriangle,
	Check,
	Loader,
	KeyRound,
	RefreshCw,
	Shield,
	ArrowRight,
} from "lucide-react"
import { ACTIVATING_STEPS } from "./RecoveryQRScreen"
import { VerraFloatingNavChrome } from "./VerraFloatingNavChrome"
import { APP_FLOATING_CHROME_MAIN_TOP_PT, APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB } from "@/ui/appContentSpacing"

const BEAMIO_TERMS_URL = "https://beamio.app/terms"
const BEAMIO_PRIVACY_URL = "https://beamio.app/privacy"

function CreateIdentityDecorativeBg() {
	return (
		<>
			<div
				className="pointer-events-none fixed top-0 right-0 -z-10 h-1/3 w-1/3 min-h-[200px] min-w-[200px] translate-x-1/2 -translate-y-1/2 rounded-full bg-[#004bc3]/5 blur-[120px]"
				aria-hidden
			/>
			<div
				className="pointer-events-none fixed bottom-0 left-0 -z-10 h-1/2 w-1/2 min-h-[240px] min-w-[240px] -translate-x-1/4 translate-y-1/4 rounded-full bg-[#465c99]/5 blur-[160px]"
				aria-hidden
			/>
		</>
	)
}

const CREATING_STEPS = [
	{ id: 0, title: "Generating Secure ID", desc: "Creating cryptographic keys", icon: KeyRound },
	{ id: 1, title: "Finalizing Terminal", desc: "Preparing user interface", icon: RefreshCw },
] as const
const STEP_DURATION_MS = 2000
const ACTIVATING_STEP_DURATION_MS = 5000

export type CreateUsernamePinScreenRef = { goBack: () => boolean }

const CREATE_RECOVER_START_DELAY_MS = 300

/** IME / paste: fullwidth digits (e.g. １００) → ASCII, strip zero-width chars, trim, remove @. */
function normalizeBeamioTagInput(raw: string): string {
	return String(raw)
		.replace(/@/g, "")
		.trim()
		.normalize("NFKC")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
}

/** Same rules as bizSite `BusinessIdentityForm` — wallet password must pass before createRecover. */
function passwordRuleChecks(password: string) {
	const len8 = password.length >= 8
	const mixed = /[a-z]/.test(password) && /[A-Z]/.test(password)
	const numbers = /[0-9]/.test(password)
	return { len8, mixed, numbers }
}

const CreateUsernamePinScreen = forwardRef<
	CreateUsernamePinScreenRef,
	{
		close: (val: { qrDataUrl: string; pin: string; passcode: string; temp: any; beamioTag: string }) => void,
		isRedeemFlow?: boolean,
		onRequestClose?: () => void,
		/** 创建钱包 loading 时通知父级（用于隐藏顶栏、整页垂直居中，避免光晕被裁切） */
		onCreatingWalletChange?: (creating: boolean) => void,
	}
>(function CreateUsernamePinScreen(
	{ close, isRedeemFlow = false, onRequestClose, onCreatingWalletChange },
	ref
) {
	const [beamioName, setBeamioName] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [showPassword, setShowPassword] = useState(false)
	const lastCheckedRef = useRef("")
	const passwordInputRef = useRef<HTMLInputElement>(null)
	const confirmInputRef = useRef<HTMLInputElement>(null)
	const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
	const [tagError, setTagError] = useState("")
	const [loading, setLoading] = useState(false)
	const [creatingStep, setCreatingStep] = useState(0)

	const steps = isRedeemFlow ? ACTIVATING_STEPS : CREATING_STEPS
	const stepDuration = isRedeemFlow ? ACTIVATING_STEP_DURATION_MS : STEP_DURATION_MS

	const localValidateTag = (raw: string) => {
		const trimmed = normalizeBeamioTagInput(raw)
		if (!trimmed) return { ok: false, v: "", msg: "Please enter a BeamioTag" }
		if (!/^[a-zA-Z0-9_\.]{3,20}$/.test(trimmed)) {
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

	const tagChecking = tagStatus === "checking"
	const tagValid = tagStatus === "valid"

	useEffect(() => {
		const trimmed = normalizeBeamioTagInput(beamioName)
		if (trimmed.length <= 2) return
		if (trimmed === lastCheckedRef.current && tagStatus === "valid") return

		const t = setTimeout(() => {
			void validateAndCheckTag()
		}, 3000)
		return () => clearTimeout(t)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 beamioName / tagStatus 重置 debounce
	}, [beamioName, tagStatus])

	const { len8, mixed, numbers } = passwordRuleChecks(password)
	const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword
	const passwordsMatch = password.length > 0 && password === confirmPassword
	const pwdRulesOk = len8 && mixed && numbers
	const canSubmit = tagValid && pwdRulesOk && passwordsMatch && !loading && !tagChecking

	useEffect(() => {
		onCreatingWalletChange?.(loading)
	}, [loading, onCreatingWalletChange])

	useEffect(() => {
		if (!loading) {
			setCreatingStep(0)
			return
		}
		const advance = () => setCreatingStep((prev) => Math.min(prev + 1, steps.length - 1))
		const timers: ReturnType<typeof setTimeout>[] = []
		// 与 CREATE_RECOVER_START_DELAY_MS 对齐：先留出首帧与 Step1，再与加密运算并行计时
		const lead = CREATE_RECOVER_START_DELAY_MS
		for (let i = 1; i < steps.length; i++) {
			timers.push(setTimeout(advance, lead + i * stepDuration))
		}
		return () => timers.forEach((t) => clearTimeout(t))
	}, [loading, isRedeemFlow, steps.length, stepDuration])

	useImperativeHandle(
		ref,
		() => ({
			goBack: () => {
				onRequestClose?.()
				return true
			},
		}),
		[onRequestClose]
	)

	const handleCreateWallet = async (pwd: string) => {
		const trimmedTag = normalizeBeamioTagInput(beamioName || "")
		const { len8: l, mixed: m, numbers: n } = passwordRuleChecks(pwd)
		if (!trimmedTag || !l || !m || !n || pwd !== confirmPassword.trim()) return

		setLoading(true)
		// 先让浏览器提交 loading UI 并跑几步动画，再进入会长时间占用主线程的加密运算
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, CREATE_RECOVER_START_DELAY_MS)
		})

		let kks: Awaited<ReturnType<typeof createRecover>> = null
		try {
			kks = await createRecover(trimmedTag, pwd)
		} finally {
			setLoading(false)
		}

		if (!kks) return

		close({
			qrDataUrl: kks.qrCode,
			pin: pwd,
			passcode: kks.recoverCode,
			temp: kks.temp,
			beamioTag: trimmedTag,
		})
	}

	const onSubmitPress = async () => {
		if (!canSubmit) return
		const ok = await validateAndCheckTag()
		if (!ok) return
		const p = password.trim()
		const { len8: l, mixed: m, numbers: n } = passwordRuleChecks(p)
		if (!l || !m || !n || p !== confirmPassword.trim()) return
		await handleCreateWallet(p)
	}

	if (loading) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-white px-6 py-12 dark:bg-white">
				<div className="flex w-full max-w-sm flex-col items-center justify-center">
					<div className="relative mb-10 py-8">
						<div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#1562f0] to-[#0e4cbb] shadow-[0_14px_40px_rgba(21,98,240,0.38)]">
							<Loader className="h-9 w-9 animate-spin text-white" strokeWidth={2.5} />
						</div>
						<div
							className="pointer-events-none absolute -inset-4 animate-pulse rounded-[40px] bg-[#1562f0] opacity-[0.12] blur-xl"
							aria-hidden
						/>
					</div>
					<div className="w-full space-y-6">
					{steps.map((s, idx) => {
						const isCompleted = idx < creatingStep
						const isActive = idx === creatingStep
						const Icon = s.icon
						return (
							<div key={s.id} className="flex items-start gap-4">
								<div
									className={[
										"flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors",
										isCompleted && "bg-[#0e4cbb]",
										isActive && "bg-[#1562f0]",
										!isCompleted && !isActive && "bg-slate-200",
									]
										.filter(Boolean)
										.join(" ")}
								>
									{isCompleted ? (
										<Check className="h-5 w-5 text-white" strokeWidth={2.5} />
									) : isActive ? (
										<Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
									) : (
										<Icon className="h-5 w-5 text-slate-400" strokeWidth={2.5} />
									)}
								</div>
								<div className="min-w-0 flex-1 pt-0.5">
									<p
										className={[
											"text-[15px] font-semibold transition-colors",
											isActive && "font-bold text-[#1562f0]",
											isCompleted && "text-slate-700",
											!isCompleted && !isActive && "text-slate-400",
										]
											.filter(Boolean)
											.join(" ")}
									>
										{s.title}
									</p>
									<p
										className={[
											"mt-0.5 text-sm transition-colors",
											isActive && "text-slate-700",
											isCompleted && "text-slate-500",
											!isCompleted && !isActive && "text-slate-400",
										]
											.filter(Boolean)
											.join(" ")}
									>
										{s.desc}
									</p>
								</div>
							</div>
						)
					})}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f3f8] font-[Inter,system-ui,sans-serif] text-[#1a1c1f]">
			<CreateIdentityDecorativeBg />
			<VerraFloatingNavChrome onBack={() => onRequestClose?.()} tone="create" />
			<main
				lang="en"
				className={`flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${APP_FLOATING_CHROME_MAIN_TOP_PT}`}
			>
				<div className="mx-auto w-full max-w-md">
					<div className={`text-center ${APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB}`}>
						<h1 className="mb-4 text-3xl font-extrabold tracking-tight text-[#1a1c1f] md:text-5xl">
							Create your Verra ID
						</h1>
						<p className="text-lg font-medium leading-relaxed text-[#424655]">
							Your unique identity in the Verra network. Use it to connect with friends and local brands.
						</p>
					</div>

					<div className="space-y-6">
						<div className="space-y-2">
							<label htmlFor="create-beamio-tag-input" className="block px-4 text-xs font-bold uppercase tracking-widest text-[#424655]">
								BeamioTag
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-5 flex items-center">
									<span className="text-lg font-bold text-[#004bc3]">@</span>
								</div>
								<input
									id="create-beamio-tag-input"
									lang="en-US"
									dir="ltr"
									translate="no"
									name="beamioTag"
									readOnly={loading || tagChecking}
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									enterKeyHint="next"
									autoComplete="username"
									inputMode="text"
									className={[
										"w-full rounded-lg border-none bg-[#e2e2e7] py-5 pl-12 pr-12 text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50",
										"focus:ring-2 focus:ring-[#004bc3]/20",
										"disabled:opacity-70",
										tagStatus === "invalid" ? "ring-2 ring-orange-400/80 focus:ring-orange-400/30" : "",
									].join(" ")}
									value={beamioName}
									placeholder="username"
									onChange={(e) => {
										if (tagChecking) return
										const next = normalizeBeamioTagInput(e.currentTarget.value)
										setBeamioName(next)
										setTagStatus("idle")
										setTagError("")
									}}
									onBlur={async () => {
										const trimmed = normalizeBeamioTagInput(beamioName)
										if (trimmed.length < 3) return
										const ok = await validateAndCheckTag()
										if (ok) passwordInputRef.current?.focus()
									}}
									onKeyDown={async (e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											e.stopPropagation()
											const ok = await validateAndCheckTag()
											if (ok) passwordInputRef.current?.focus()
										}
									}}
								/>
								<div className="pointer-events-none absolute inset-y-0 right-5 flex items-center">
									{tagChecking && (
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80">
											<div className="h-4 w-4 animate-spin rounded-full border-2 border-[#737687] border-t-[#004bc3]" />
										</div>
									)}
									{tagValid && !tagChecking && (
										<div className="flex items-center justify-center rounded-full bg-emerald-500 p-0.5">
											<Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
										</div>
									)}
								</div>
							</div>
							{tagStatus === "invalid" ? (
								<div className="flex items-center gap-2 px-4 pt-1 text-orange-600">
									<AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
									<span className="text-[13px] font-semibold leading-snug">{tagError}</span>
								</div>
							) : tagValid ? (
								<p className="px-4 text-[13px] font-medium text-emerald-600">This tag is available</p>
							) : (
								<p className="px-4 text-[13px] font-medium text-[#424655]">Permanent. Cannot be changed later.</p>
							)}
						</div>

						<div className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="create-wallet-password" className="block px-4 text-xs font-bold uppercase tracking-widest text-[#424655]">
									Secure Password
								</label>
								<div className="relative">
									<input
										ref={passwordInputRef}
										id="create-wallet-password"
										readOnly={loading}
										type={showPassword ? "text" : "password"}
										autoComplete="new-password"
										enterKeyHint="next"
										className="w-full rounded-lg border-none bg-[#e2e2e7] py-5 pl-5 pr-14 text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50 focus:ring-2 focus:ring-[#004bc3]/20 disabled:opacity-70"
										value={password}
										placeholder="••••••••••••"
										onChange={(e) => setPassword(e.currentTarget.value)}
										onKeyDown={(e) => {
											if (e.key !== "Enter") return
											e.preventDefault()
											e.stopPropagation()
											if (loading) return
											confirmInputRef.current?.focus()
										}}
									/>
									<button
										type="button"
										tabIndex={-1}
										className="absolute inset-y-0 right-5 flex items-center rounded-lg p-1 text-[#424655] transition-colors hover:text-[#1a1c1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/30"
										onClick={() => setShowPassword(!showPassword)}
										aria-label={showPassword ? "Hide password" : "Show password"}
									>
										{showPassword ? <EyeOff className="h-6 w-6" strokeWidth={2} /> : <Eye className="h-6 w-6" strokeWidth={2} />}
									</button>
								</div>
							</div>

							<div className="space-y-2">
								<label
									htmlFor="create-wallet-confirm-password"
									className="block px-4 text-xs font-bold uppercase tracking-widest text-[#424655]"
								>
									Confirm Password
								</label>
								<input
									ref={confirmInputRef}
									id="create-wallet-confirm-password"
									readOnly={loading}
									type={showPassword ? "text" : "password"}
									autoComplete="new-password"
									enterKeyHint="done"
									className={[
										"w-full rounded-lg border-none bg-[#e2e2e7] py-5 pl-5 pr-5 text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50 focus:ring-2 focus:ring-[#004bc3]/20 disabled:opacity-70",
										confirmMismatch ? "ring-2 ring-orange-400/80 focus:ring-orange-400/30" : "",
									].join(" ")}
									value={confirmPassword}
									placeholder="••••••••••••"
									onChange={(e) => setConfirmPassword(e.currentTarget.value)}
									onKeyDown={(e) => {
										if (e.key !== "Enter") return
										e.preventDefault()
										e.stopPropagation()
										if (loading) return
										if (canSubmit) void onSubmitPress()
									}}
								/>
								{confirmMismatch ? (
									<div className="flex items-center gap-2 px-4 pt-0.5 text-orange-600">
										<AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
										<span className="text-[13px] font-semibold leading-snug">Passwords do not match</span>
									</div>
								) : null}
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
											<span
												className="h-4 w-4 shrink-0 rounded-full border-2 border-[#c3c6d8]"
												aria-hidden
											/>
										)}
										<span
											className={`text-[13px] font-medium ${ok ? "text-[#1a1c1f]" : "text-[#424655]"}`}
										>
											{label}
										</span>
									</li>
								))}
							</ul>
						</div>

						<div className="grid grid-cols-2 gap-4 pt-2">
							<div className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
								<Shield className="h-6 w-6 shrink-0 text-[#004bc3]" strokeWidth={2} aria-hidden />
								<div className="space-y-1">
									<p className="text-xs font-bold uppercase tracking-widest text-[#424655]">Vault</p>
									<p className="text-sm font-semibold leading-snug text-[#1a1c1f]">Encrypted Local Storage</p>
								</div>
							</div>
							<div className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
								<RefreshCw className="h-6 w-6 shrink-0 text-[#004bc3]" strokeWidth={2} aria-hidden />
								<div className="space-y-1">
									<p className="text-xs font-bold uppercase tracking-widest text-[#424655]">Sync</p>
									<p className="text-sm font-semibold leading-snug text-[#1a1c1f]">Multi-device Continuity</p>
								</div>
							</div>
						</div>

						<p className="px-1 text-center text-[13px] leading-snug text-[#424655]">
							Verra is non-custodial. We cannot reset this password for you.
						</p>
					</div>

					<div className="mt-8 flex w-full shrink-0 flex-col items-center px-0 pt-2">
						<AppButton
							fullWidth
							loading={loading}
							disabled={!canSubmit}
							rightIcon={!loading ? <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : undefined}
							className={[
								"!rounded-full !py-5 !text-lg !font-bold !shadow-[0_8px_30px_rgba(21,98,240,0.3)] !transition-transform active:scale-[0.98]",
								canSubmit
									? "!inline-flex !items-center !justify-center !gap-2 !bg-gradient-to-br !from-[#004bc3] !to-[#1562f0] hover:!opacity-[0.96] !text-white focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/50 focus-visible:!ring-offset-2 focus-visible:!ring-offset-[#f3f3f8]"
									: "!cursor-not-allowed !bg-[#c3c6d8] !text-[#737687] !shadow-none",
							].join(" ")}
							onClick={() => void onSubmitPress()}
						>
							Next
						</AppButton>
						<div className="mt-6 flex max-w-md flex-col gap-1 px-4 text-center text-[13px] font-normal leading-snug text-[#424655]">
							<p>By continuing, you agree to our</p>
							<p>
								<a
									href={BEAMIO_TERMS_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="font-bold text-[#004bc3] hover:underline"
								>
									Terms of Service
								</a>
								{" and "}
								<a
									href={BEAMIO_PRIVACY_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="font-bold text-[#004bc3] hover:underline"
								>
									Privacy Policy
								</a>
								.
							</p>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
})

export default CreateUsernamePinScreen
