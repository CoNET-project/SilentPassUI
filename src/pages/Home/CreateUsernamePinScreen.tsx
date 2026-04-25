import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import {
	Eye,
	EyeOff,
	AlertTriangle,
	Check,
	Fingerprint,
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
const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`

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
	const [passwordTouched, setPasswordTouched] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const lastCheckedRef = useRef("")
	const passwordInputRef = useRef<HTMLInputElement>(null)
	const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
	const [tagError, setTagError] = useState("")
	const [loading, setLoading] = useState(false)
	const [creatingStep, setCreatingStep] = useState(0)
	const [viewportHeight, setViewportHeight] = useState(() =>
		typeof window === "undefined"
			? 0
			: Math.round(window.visualViewport?.height ?? window.innerHeight)
	)

	const steps = isRedeemFlow ? ACTIVATING_STEPS : CREATING_STEPS
	const stepDuration = isRedeemFlow ? ACTIVATING_STEP_DURATION_MS : STEP_DURATION_MS
	const isCompactHeight = viewportHeight > 0 && viewportHeight <= 760
	const isVeryCompactHeight = viewportHeight > 0 && viewportHeight <= 620
	const isUltraCompactHeight = viewportHeight > 0 && viewportHeight <= 560
	const shouldHideInfoCards = isCompactHeight
	const shouldHideNonCustodialNote = viewportHeight > 0 && viewportHeight <= 540
	const topInsetPadding = isUltraCompactHeight
		? "calc(env(safe-area-inset-top) + 2.9rem)"
		: isVeryCompactHeight
			? "calc(env(safe-area-inset-top) + 3.2rem)"
			: "calc(env(safe-area-inset-top) + 3.75rem)"

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

	useEffect(() => {
		if (typeof window === "undefined") return

		const syncViewportHeight = () => {
			setViewportHeight(Math.round(window.visualViewport?.height ?? window.innerHeight))
		}

		syncViewportHeight()
		window.addEventListener("resize", syncViewportHeight)
		window.visualViewport?.addEventListener("resize", syncViewportHeight)

		return () => {
			window.removeEventListener("resize", syncViewportHeight)
			window.visualViewport?.removeEventListener("resize", syncViewportHeight)
		}
	}, [])

	const { len8, mixed, numbers } = passwordRuleChecks(password)
	const pwdRulesOk = len8 && mixed && numbers
	const canSubmit = tagValid && pwdRulesOk && !loading && !tagChecking
	const passwordStrengthCount = [len8, mixed, numbers].filter(Boolean).length
	const passwordStrengthPercent = passwordStrengthCount * 25
	const passwordStrengthLabel =
		passwordStrengthCount >= 3
			? "Strong security"
			: passwordStrengthCount >= 2
				? "Building security"
				: passwordStrengthCount >= 1
					? "Basic security"
					: "Set a secure password"
	const passwordIssues = [
		!len8 ? "At least 8 characters" : "",
		!mixed ? "Upper and lowercase letters" : "",
		!numbers ? "At least one number" : "",
	].filter(Boolean)
	const showPasswordIssues = passwordTouched && password.length > 0 && passwordIssues.length > 0

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
		if (!trimmedTag || !l || !m || !n) return

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
		if (!l || !m || !n) return
		await handleCreateWallet(p)
	}

	if (loading) {
		return (
			<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f9f9fe]">
				{/* 内联 keyframes：与 createBeamioTag.html 一致；scope 到本组件，避免污染全局 */}
				<style>{`
					@keyframes verra-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
					@keyframes verra-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } }
					@keyframes verra-breath { 0%, 100% { box-shadow: 0 0 20px rgba(21, 98, 240, 0.1); } 50% { box-shadow: 0 0 60px rgba(21, 98, 240, 0.3); } }
				`}</style>

				{/* Ambient Glass Background Shapes */}
				<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-[#004bc3]/5 blur-[120px]" />
					<div className="absolute -bottom-[5%] -right-[5%] h-[50%] w-[50%] rounded-full bg-[#a7bcff]/10 blur-[100px]" />
					<div className="absolute right-[10%] top-[20%] h-[30%] w-[30%] rounded-full bg-[#b3c5ff]/10 blur-[80px]" />
				</div>

				{/* main：flex-1 占满除 footer 外的全部高度，内部 justify-center 把内容垂直居中。
				    动画/字号/间距对 max-height ≤ 700 / 640 做两档收缩，避免 iPhone SE 内容被挤出。 */}
				<main className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center self-center overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] text-center">
					{/* 1. Central Visual: Dynamic 3D Loading Animation
					    h-72/w-72(288) → max-h:700 时 h-56/w-56(224) → max-h:640 时 h-44/w-44(176) */}
					<div
						className="relative mb-10 flex h-72 w-72 shrink-0 items-center justify-center
							[@media(max-height:700px)]:mb-6 [@media(max-height:700px)]:h-56 [@media(max-height:700px)]:w-56
							[@media(max-height:640px)]:mb-4 [@media(max-height:640px)]:h-44 [@media(max-height:640px)]:w-44"
					>
						{/* Background Glow */}
						<div
							className="absolute h-48 w-48 rounded-full bg-[#004bc3]/10 blur-3xl
								[@media(max-height:700px)]:h-36 [@media(max-height:700px)]:w-36
								[@media(max-height:640px)]:h-28 [@media(max-height:640px)]:w-28"
							style={{ animation: "verra-breath 4s ease-in-out infinite" }}
							aria-hidden
						/>
						{/* Concentric Rings */}
						<div
							className="absolute inset-0 rounded-full border-[1.5px] border-[#c3c6d8]/30"
							style={{ animation: "verra-spin-slow 12s linear infinite" }}
							aria-hidden
						/>
						<div
							className="absolute inset-4 rounded-full border-[1px] border-[#004bc3]/20 [@media(max-height:640px)]:inset-3"
							style={{ animation: "verra-spin-slow 8s linear infinite reverse" }}
							aria-hidden
						/>
						<div
							className="absolute inset-10 rounded-full border-[2px] border-[#1562f0]/10 [@media(max-height:700px)]:inset-8 [@media(max-height:640px)]:inset-6"
							style={{ animation: "verra-spin-slow 15s linear infinite" }}
							aria-hidden
						/>
						{/* Core Loading Element：玻璃态白圆 + 品牌 app icon */}
						<div
							className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)]
								[@media(max-height:700px)]:h-24 [@media(max-height:700px)]:w-24
								[@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
							style={{ backdropFilter: "blur(20px)", background: "rgba(255, 255, 255, 0.7)" }}
						>
							<img
								src={APP_LOGO_SRC}
								alt="Beamio"
								className="h-14 w-14 rounded-[14px] object-contain [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:w-11 [@media(max-height:700px)]:rounded-[12px] [@media(max-height:640px)]:h-9 [@media(max-height:640px)]:w-9 [@media(max-height:640px)]:rounded-[10px]"
								style={{ animation: "verra-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
								draggable={false}
							/>
						</div>
						{/* Orbiting Particle */}
						<div
							className="absolute inset-0"
							style={{ animation: "verra-spin-slow 12s linear infinite" }}
							aria-hidden
						>
							<div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0] shadow-[0_0_12px_rgba(21,98,240,0.6)] [@media(max-height:640px)]:h-2.5 [@media(max-height:640px)]:w-2.5" />
						</div>
					</div>

					{/* 2. Status Updates
					    space-y-10 → 小屏 space-y-6 → 极小屏 space-y-4；步骤间距同步收缩 */}
					<div className="w-full space-y-8 [@media(max-height:700px)]:space-y-5 [@media(max-height:640px)]:space-y-3">
						<h1 className="text-3xl font-extrabold tracking-tight text-[#1a1c1f] [@media(max-height:700px)]:text-2xl [@media(max-height:640px)]:text-xl">
							Securing your identity...
						</h1>
						<div className="mx-auto max-w-sm space-y-5 text-left [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2">
							{steps.map((s, idx) => {
								const isCompleted = idx < creatingStep
								const isActive = idx === creatingStep
								const Icon = s.icon
								return (
									<div
										key={s.id}
										className={[
											"flex items-center space-x-4 transition-opacity",
											!isCompleted && !isActive ? "opacity-40" : "",
										]
											.filter(Boolean)
											.join(" ")}
									>
										<div
											className={[
												"relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7",
												isCompleted ? "bg-emerald-50" : "",
												isActive ? "bg-[#004bc3]/10" : "",
												!isCompleted && !isActive ? "bg-[#e8e8ed]" : "",
											]
												.filter(Boolean)
												.join(" ")}
										>
											{isActive && (
												<div
													className="absolute inset-0 animate-spin rounded-full border-2 border-[#004bc3] border-t-transparent"
													aria-hidden
												/>
											)}
											{isCompleted ? (
												<Check className="h-4 w-4 text-emerald-600" strokeWidth={3} aria-hidden />
											) : isActive ? (
												<Icon className="h-4 w-4 text-[#004bc3]" strokeWidth={2.5} aria-hidden />
											) : (
												<Icon className="h-4 w-4 text-[#424655]" strokeWidth={2.5} aria-hidden />
											)}
										</div>
										<div className="min-w-0 flex-grow">
											<p
												className={[
													"text-base font-semibold leading-none [@media(max-height:640px)]:text-sm",
													isActive ? "text-[#1a1c1f]" : "",
													isCompleted ? "text-[#1a1c1f]" : "",
													!isCompleted && !isActive ? "text-[#1a1c1f]/90" : "",
												]
													.filter(Boolean)
													.join(" ")}
											>
												{s.title}
											</p>
											{s.desc ? (
												<p className="mt-1 text-xs text-[#424655] [@media(max-height:640px)]:mt-0.5 [@media(max-height:640px)]:text-[11px]">
													{s.desc}
												</p>
											) : null}
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</main>

				{/* 3. Footer Note：作为 flex 项参与布局，绝不会和 main 重叠；自带 safe-area 内边距 */}
				<footer className="shrink-0 px-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 text-center [@media(max-height:700px)]:pt-2 [@media(max-height:640px)]:pt-1.5">
					<div className="mx-auto max-w-xs">
						<p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#424655]/60">
							DO NOT CLOSE THE APP DURING THIS PROCESS
						</p>
						<div className="mt-3 flex justify-center space-x-1 [@media(max-height:640px)]:mt-2" aria-hidden>
							<div
								className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/20"
								style={{ animationDelay: "0s" }}
							/>
							<div
								className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/20"
								style={{ animationDelay: "0.2s" }}
							/>
							<div
								className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/20"
								style={{ animationDelay: "0.4s" }}
							/>
						</div>
					</div>
				</footer>
			</div>
		)
	}

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f3f8] font-[Inter,system-ui,sans-serif] text-[#1a1c1f]">
			<CreateIdentityDecorativeBg />
			<VerraFloatingNavChrome onBack={() => onRequestClose?.()} tone="create" />
			<main
				lang="en"
				className={`flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:pb-[max(0.875rem,env(safe-area-inset-bottom))] [@media(max-height:640px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:px-5 [@media(max-height:560px)]:pb-[max(0.625rem,env(safe-area-inset-bottom))] ${APP_FLOATING_CHROME_MAIN_TOP_PT}`}
				style={{ paddingTop: topInsetPadding }}
			>
				<div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
					<div
						className={`shrink-0 text-center ${APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB} [@media(max-height:780px)]:mb-8 [@media(max-height:700px)]:mb-6 [@media(max-height:640px)]:mb-4 [@media(max-height:560px)]:mb-3`}
					>
						<h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[#1a1c1f] md:text-5xl [@media(max-height:780px)]:text-[2rem] [@media(max-height:700px)]:text-[1.75rem] [@media(max-height:640px)]:mb-2 [@media(max-height:640px)]:text-[1.5rem] [@media(max-height:560px)]:mb-1.5 [@media(max-height:560px)]:text-[1.3rem]">
							Create your Beamio ID
						</h1>
						<p className="text-lg font-medium leading-relaxed text-[#424655] [@media(max-height:780px)]:text-base [@media(max-height:700px)]:text-[15px] [@media(max-height:640px)]:text-sm [@media(max-height:640px)]:leading-snug [@media(max-height:560px)]:text-[12px] [@media(max-height:560px)]:leading-[1.25]">
							Your unique identity in the Beamio network. Use it to connect with friends and local brands.
						</p>
					</div>

					<div className="flex min-h-0 flex-1 flex-col justify-between gap-5 [@media(max-height:780px)]:gap-4 [@media(max-height:700px)]:gap-3 [@media(max-height:640px)]:gap-2.5 [@media(max-height:560px)]:gap-2">
						<div className="space-y-5 [@media(max-height:780px)]:space-y-4 [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:560px)]:space-y-2">
						<div className="space-y-2 [@media(max-height:640px)]:space-y-1.5 [@media(max-height:560px)]:space-y-1">
							<label htmlFor="create-beamio-tag-input" className="block px-4 text-xs font-bold uppercase tracking-widest text-[#424655] [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:text-[11px]">
								BeamioTag
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-5 flex items-center [@media(max-height:560px)]:left-4">
									<span className="text-lg font-bold text-[#004bc3] [@media(max-height:560px)]:text-base">@</span>
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
										"w-full rounded-lg border-none bg-[#e2e2e7] py-5 pl-12 pr-12 text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50 [@media(max-height:780px)]:py-4 [@media(max-height:700px)]:py-3.5 [@media(max-height:640px)]:py-3 [@media(max-height:640px)]:text-[15px] [@media(max-height:560px)]:rounded-[14px] [@media(max-height:560px)]:py-2.5 [@media(max-height:560px)]:pl-10 [@media(max-height:560px)]:pr-10 [@media(max-height:560px)]:text-[14px]",
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
								<div className="pointer-events-none absolute inset-y-0 right-5 flex items-center [@media(max-height:560px)]:right-4">
									{tagChecking && (
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 [@media(max-height:560px)]:h-7 [@media(max-height:560px)]:w-7">
											<div className="h-4 w-4 animate-spin rounded-full border-2 border-[#737687] border-t-[#004bc3] [@media(max-height:560px)]:h-3.5 [@media(max-height:560px)]:w-3.5" />
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
								<div className="flex items-center gap-2 px-4 pt-1 text-orange-600 [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:pt-0.5">
									<AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
									<span className="text-[13px] font-semibold leading-snug [@media(max-height:560px)]:text-[11px]">{tagError}</span>
								</div>
							) : tagValid ? (
								<p className="px-4 text-[13px] font-medium text-emerald-600 [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:text-[11px]">This tag is available</p>
							) : (
								<p className="px-4 text-[13px] font-medium text-[#424655] [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:text-[11px]">Permanent. Cannot be changed later.</p>
							)}
						</div>

						<div className="space-y-3.5 [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:560px)]:space-y-2">
							<div className="space-y-2 [@media(max-height:640px)]:space-y-1.5 [@media(max-height:560px)]:space-y-1">
								<label htmlFor="create-wallet-password" className="block px-4 text-xs font-bold uppercase tracking-widest text-[#424655] [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:text-[11px]">
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
										className="w-full rounded-lg border-none bg-[#e2e2e7] py-5 pl-5 pr-14 text-base font-semibold text-[#1a1c1f] outline-none transition-all placeholder:text-[#737687]/50 focus:ring-2 focus:ring-[#004bc3]/20 disabled:opacity-70 [@media(max-height:780px)]:py-4 [@media(max-height:700px)]:py-3.5 [@media(max-height:640px)]:py-3 [@media(max-height:640px)]:text-[15px] [@media(max-height:560px)]:rounded-[14px] [@media(max-height:560px)]:py-2.5 [@media(max-height:560px)]:pl-4 [@media(max-height:560px)]:pr-12 [@media(max-height:560px)]:text-[14px]"
										value={password}
										placeholder="••••••••••••"
										onChange={(e) => setPassword(e.currentTarget.value)}
										onBlur={() => setPasswordTouched(true)}
										onKeyDown={(e) => {
											if (e.key !== "Enter") return
											e.preventDefault()
											e.stopPropagation()
											if (loading) return
											if (canSubmit) void onSubmitPress()
										}}
									/>
									<button
										type="button"
										tabIndex={-1}
										className="absolute inset-y-0 right-5 flex items-center rounded-lg p-1 text-[#424655] transition-colors hover:text-[#1a1c1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/30 [@media(max-height:560px)]:right-4"
										onClick={() => setShowPassword(!showPassword)}
										aria-label={showPassword ? "Hide password" : "Show password"}
									>
										{showPassword ? <EyeOff className="h-6 w-6 [@media(max-height:560px)]:h-5 [@media(max-height:560px)]:w-5" strokeWidth={2} /> : <Eye className="h-6 w-6 [@media(max-height:560px)]:h-5 [@media(max-height:560px)]:w-5" strokeWidth={2} />}
									</button>
								</div>
							</div>

							<div className="space-y-3 px-2 [@media(max-height:700px)]:space-y-2.5 [@media(max-height:560px)]:space-y-2">
								<div className="flex h-1 gap-1.5" aria-hidden>
									{[0, 1, 2, 3].map((idx) => (
										<div
											key={idx}
											className={[
												"flex-1 rounded-full transition-colors",
												idx < passwordStrengthCount ? "bg-[#004bc3]" : "bg-[#e2e2e7]",
											].join(" ")}
										/>
									))}
								</div>
								<div className="flex items-center justify-between">
									<span className="text-[13px] font-semibold text-[#1a1c1f] [@media(max-height:560px)]:text-[12px]">
										{passwordStrengthLabel}
									</span>
									<span className="text-[13px] font-medium text-[#424655] [@media(max-height:560px)]:text-[12px]">
										{passwordStrengthPercent}%
									</span>
								</div>
								{showPasswordIssues ? (
									<div className="space-y-1 rounded-xl bg-orange-50 px-3 py-2 text-orange-700">
										<p className="text-[12px] font-bold leading-snug">Please fix:</p>
										<ul className="space-y-0.5">
											{passwordIssues.map((issue) => (
												<li key={issue} className="flex items-center gap-1.5 text-[12px] font-semibold leading-snug">
													<AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
													<span>{issue}</span>
												</li>
											))}
										</ul>
									</div>
								) : null}
							</div>
						</div>

						{!shouldHideInfoCards ? (
						<div className="grid grid-cols-2 gap-4 pt-8 [@media(max-height:780px)]:pt-4 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:pt-2 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:pt-1 [@media(max-height:560px)]:hidden">
							<div className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] [@media(max-height:780px)]:p-4 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-3.5 [@media(max-height:640px)]:p-3">
								<Shield className="h-6 w-6 shrink-0 text-[#004bc3] [@media(max-height:640px)]:h-5 [@media(max-height:640px)]:w-5" fill="currentColor" strokeWidth={2} aria-hidden />
								<div className="space-y-1">
									<p className="text-xs font-bold uppercase tracking-widest text-[#424655]">Vault</p>
									<p className="text-sm font-semibold leading-snug text-[#1a1c1f] [@media(max-height:640px)]:text-[13px]">Encrypted Local Storage</p>
								</div>
							</div>
							<div className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] [@media(max-height:780px)]:p-4 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-3.5 [@media(max-height:640px)]:p-3">
								<RefreshCw className="h-6 w-6 shrink-0 text-[#004bc3] [@media(max-height:640px)]:h-5 [@media(max-height:640px)]:w-5" fill="currentColor" strokeWidth={2} aria-hidden />
								<div className="space-y-1">
									<p className="text-xs font-bold uppercase tracking-widest text-[#424655]">Sync</p>
									<p className="text-sm font-semibold leading-snug text-[#1a1c1f] [@media(max-height:640px)]:text-[13px]">Multi-device Continuity</p>
								</div>
							</div>
						</div>
						) : null}

						{!shouldHideNonCustodialNote ? (
						<p className="px-1 text-center text-[13px] leading-snug text-[#424655] [@media(max-height:640px)]:text-[12px] [@media(max-height:560px)]:text-[11px] [@media(max-height:520px)]:hidden">
							Verra is non-custodial. We cannot reset this password for you.
						</p>
						) : null}
						</div>

					<div className="mt-auto flex w-full shrink-0 flex-col items-center px-0 pt-2 [@media(max-height:700px)]:pt-1.5 [@media(max-height:640px)]:pt-1 [@media(max-height:560px)]:pt-0.5">
						<AppButton
							fullWidth
							loading={loading}
							disabled={!canSubmit}
							rightIcon={!loading ? <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : undefined}
							className={[
								"!rounded-full !py-5 !text-lg !font-bold !shadow-[0_8px_30px_rgba(21,98,240,0.3)] !transition-transform active:scale-[0.98] [@media(max-height:780px)]:!py-4 [@media(max-height:780px)]:!text-[17px] [@media(max-height:700px)]:!py-3.5 [@media(max-height:700px)]:!text-base [@media(max-height:640px)]:!py-3 [@media(max-height:640px)]:!text-[15px] [@media(max-height:560px)]:!py-2.5 [@media(max-height:560px)]:!text-[14px]",
								canSubmit
									? "!inline-flex !items-center !justify-center !gap-2 !bg-gradient-to-br !from-[#004bc3] !to-[#1562f0] hover:!opacity-[0.96] !text-white focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/50 focus-visible:!ring-offset-2 focus-visible:!ring-offset-[#f3f3f8]"
									: "!cursor-not-allowed !bg-[#c3c6d8] !text-[#737687] !shadow-none",
							].join(" ")}
							onClick={() => void onSubmitPress()}
						>
							Next
						</AppButton>
						<div className="mt-4 flex max-w-md flex-col gap-1 px-4 text-center text-[13px] font-normal leading-snug text-[#424655] [@media(max-height:700px)]:mt-3 [@media(max-height:640px)]:mt-2 [@media(max-height:640px)]:text-[12px] [@media(max-height:560px)]:mt-1.5 [@media(max-height:560px)]:gap-0.5 [@media(max-height:560px)]:px-2 [@media(max-height:560px)]:text-[11px]">
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
				</div>
			</main>
		</div>
	)
})

export default CreateUsernamePinScreen
