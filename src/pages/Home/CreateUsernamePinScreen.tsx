import { IpfsImg } from '@/components/IpfsImg';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
import { warmArgon2Worker } from "@/services/argon2WorkerBridge"
import {
	Eye,
	EyeOff,
	AlertTriangle,
	Check,
	RefreshCw,
	Shield,
	ArrowRight,
} from "lucide-react"
import { getActivatingSteps } from "./RecoveryQRScreen"
import { VerraFloatingNavChrome } from "./VerraFloatingNavChrome"
import { APP_FLOATING_CHROME_MAIN_TOP_PT, APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB } from "@/ui/appContentSpacing"
import { tu } from '@/locale/beamioLocale'
import { getCurrentBeamioUiLocale } from '@/locale/i18n'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'

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

const CREATING_STEP_DEFS = [
	{ id: 0, titleKey: 'configuring_global_network', icon: Shield },
	{ id: 1, titleKey: 'preparing_your_smart_wallet', icon: RefreshCw },
] as const
const STEP_DURATION_MS = 2000
const ACTIVATING_STEP_DURATION_MS = 5000

export type CreateUsernamePinScreenRef = { goBack: () => boolean }

/** Brief pause so React can commit the loading tree before crypto starts. */
const CREATE_RECOVER_START_DELAY_MS = 100

/** Double rAF + micro-delay so CSS animations paint before async crypto work. */
function waitForLoadingPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.setTimeout(resolve, CREATE_RECOVER_START_DELAY_MS)
			})
		})
	})
}

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
	const [createError, setCreateError] = useState("")
	const [loading, setLoading] = useState(false)
	const [creatingStep, setCreatingStep] = useState(0)
	const [viewportHeight, setViewportHeight] = useState(() =>
		typeof window === "undefined"
			? 0
			: Math.round(window.visualViewport?.height ?? window.innerHeight)
	)

	// Prefetch Argon2 Worker while the user fills the form (avoids cold-start on Next)
	useEffect(() => {
		warmArgon2Worker()
	}, [])

	const steps = isRedeemFlow
		? getActivatingSteps()
		: CREATING_STEP_DEFS.map((s) => ({
				...s,
				title: tu(s.titleKey),
				desc: '',
			}))
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
		if (!trimmed) return { ok: false, v: "", msg: tu('please_enter_a_beamiotag') }
		if (!/^[a-zA-Z0-9_\.]{3,26}$/.test(trimmed)) {
			return { ok: false, v: trimmed, msg: tu('use_3_20_letters_numbers_dots_or_underscores') }
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
				setTagError(tu('tag_is_already_taken', { tag: v }))
				return false
			}
			setTagStatus("valid")
			setTagError("")
			return true
		} catch {
			setTagStatus("invalid")
			setTagError(tu('network_error_try_again'))
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
			const nextHeight = Math.round(window.visualViewport?.height ?? window.innerHeight)
			setViewportHeight(nextHeight)
			// Do not write --beamio-native-viewport-height here: LoadingPage onboarding
			// overlay uses that variable for height; shrinking it exposes App shell (#000414).
		}

		syncViewportHeight()
		window.addEventListener("resize", syncViewportHeight)
		window.visualViewport?.addEventListener("resize", syncViewportHeight)
		window.visualViewport?.addEventListener("scroll", syncViewportHeight)

		return () => {
			window.removeEventListener("resize", syncViewportHeight)
			window.visualViewport?.removeEventListener("resize", syncViewportHeight)
			window.visualViewport?.removeEventListener("scroll", syncViewportHeight)
		}
	}, [])

	const { len8, mixed, numbers } = passwordRuleChecks(password)
	const pwdRulesOk = len8 && mixed && numbers
	const canSubmit = tagValid && pwdRulesOk && !loading && !tagChecking
	const passwordStrengthCount = [len8, mixed, numbers].filter(Boolean).length
	const passwordStrengthPercent = passwordStrengthCount * 25
	const passwordStrengthLabel =
		passwordStrengthCount >= 3
			? tu('strong_security')
			: passwordStrengthCount >= 2
				? tu('building_security')
				: passwordStrengthCount >= 1
					? tu('basic_security')
					: tu('set_a_secure_password')
	const passwordIssues = [
		!len8 ? tu('at_least_8_characters') : "",
		!mixed ? tu('upper_and_lowercase_letters') : "",
		!numbers ? tu('at_least_one_number') : "",
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
		const lead = CREATE_RECOVER_START_DELAY_MS + 50
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
		setCreateError("")
		// Argon2 runs in a Worker; still wait one paint so ripple/orbit start before network/crypto
		await waitForLoadingPaint()

		let kks: Awaited<ReturnType<typeof createRecover>> = null
		try {
			kks = await createRecover(trimmedTag, pwd)
		} catch {
			setCreateError(tu('network_error_try_again'))
		} finally {
			setLoading(false)
		}

		if (!kks) {
			if (!createError) setCreateError(tu('network_error_try_again'))
			return
		}

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
			<div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f9f9ff] font-[Inter,system-ui,sans-serif] text-[#151c27]">
				<style>{`
					@keyframes beamio-passport-ripple {
						0% { transform: translateZ(0) scale(0.5); opacity: 0; }
						50% { opacity: 1; }
						100% { transform: translateZ(0) scale(1.2); opacity: 0; }
					}
					@keyframes beamio-passport-orbit {
						from { transform: translateZ(0) rotate(0deg); }
						to { transform: translateZ(0) rotate(360deg); }
					}
				`}</style>

				<main className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center self-center overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] py-12 text-center [@media(max-height:700px)]:py-8 [@media(max-height:640px)]:py-6">
					{/* Ripple + orbit + logo */}
					<div
						className="relative mb-12 flex w-full max-w-[320px] aspect-square shrink-0 items-center justify-center
							[@media(max-height:700px)]:mb-8 [@media(max-height:700px)]:max-w-[260px]
							[@media(max-height:640px)]:mb-6 [@media(max-height:640px)]:max-w-[220px]"
					>
						<div className="absolute inset-0 -z-10 rounded-full bg-[#004bc3]/5 blur-3xl" aria-hidden />
						<div className="relative flex h-[240px] w-[240px] items-center justify-center [@media(max-height:700px)]:h-[200px] [@media(max-height:700px)]:w-[200px] [@media(max-height:640px)]:h-[168px] [@media(max-height:640px)]:w-[168px]">
							{[0, 1, 2].map((i) => (
								<div
									key={i}
									className="absolute rounded-full border border-[rgba(21,98,240,0.1)]"
									style={{
										width: `${100 - i * 20}%`,
										height: `${100 - i * 20}%`,
										animation: `beamio-passport-ripple 3s linear infinite`,
										animationDelay: `${i}s`,
										opacity: 0,
										willChange: 'transform, opacity',
										transform: 'translateZ(0)',
									}}
									aria-hidden
								/>
							))}
							<div
								className="absolute inset-0"
								style={{
									animation: 'beamio-passport-orbit 4s linear infinite',
									willChange: 'transform',
									transform: 'translateZ(0)',
								}}
								aria-hidden
							>
								<div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0]" />
							</div>
							<div
								className="relative z-10 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg [@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
								style={{ transform: 'translateZ(0)' }}
							>
								<IpfsImg
									src={APP_LOGO_SRC}
									alt="Beamio"
									className="h-16 w-16 rounded-xl object-contain shadow-[0_4px_20px_rgba(0,75,195,0.15)] [@media(max-height:640px)]:h-12 [@media(max-height:640px)]:w-12 [@media(max-height:640px)]:rounded-lg"
									draggable={false}
								/>
							</div>
						</div>
					</div>

					<h1 className="mb-8 max-w-md text-center text-[32px] font-bold leading-10 tracking-[-0.02em] text-[#151c27] [@media(max-height:700px)]:mb-6 [@media(max-height:700px)]:text-[28px] [@media(max-height:700px)]:leading-9 [@media(max-height:640px)]:mb-4 [@media(max-height:640px)]:text-[22px] [@media(max-height:640px)]:leading-7">
						{isRedeemFlow ? tu('securing_your_identity') : tu('issuing_your_digital_passport')}
					</h1>

					<div className="w-full max-w-md space-y-4 px-4 text-left [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:640px)]:px-2">
						{steps.map((s, idx) => {
							const isCompleted = idx < creatingStep
							const isActive = idx === creatingStep
							const isPending = !isCompleted && !isActive
							return (
								<div
									key={s.id}
									className={[
										'flex items-start space-x-4 transition-opacity',
										isActive ? 'opacity-70' : '',
										isPending ? 'opacity-40' : '',
									]
										.filter(Boolean)
										.join(' ')}
								>
									<div
										className={[
											'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-[0_4px_10px_rgba(0,0,0,0.03)]',
											isCompleted
												? 'border-[#dce2f3] bg-[#e2e8f8]'
												: isActive
													? 'border-[#1562f0] bg-white text-[#1562f0] shadow-[0_4px_20px_rgba(21,98,240,0.1)]'
													: 'border-[#dce2f3] bg-white',
										].join(' ')}
									>
										{isCompleted ? (
											<Check className="h-5 w-5 text-[#22c55e]" strokeWidth={3} aria-hidden />
										) : isActive ? (
											<RefreshCw className="h-5 w-5 animate-spin text-[#1562f0]" strokeWidth={2.25} aria-hidden />
										) : (
											<span className="h-2 w-2 rounded-full bg-[#c3c6d8]" aria-hidden />
										)}
									</div>
									<div className="flex min-w-0 flex-col pt-1">
										<span className="text-lg font-semibold leading-7 text-[#151c27] [@media(max-height:640px)]:text-base [@media(max-height:640px)]:leading-6">
											{s.title}
										</span>
										{s.desc ? (
											<span className="mt-0.5 text-xs text-[#424655] [@media(max-height:640px)]:text-[11px]">
												{s.desc}
											</span>
										) : null}
									</div>
								</div>
							)
						})}
					</div>
				</main>

				<footer className="flex shrink-0 flex-col items-center px-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 [@media(max-height:700px)]:pt-2 [@media(max-height:640px)]:pt-1.5">
					<p className="mb-2 text-center text-xs font-semibold uppercase leading-4 tracking-[0.05em] text-[#737687]">
						{tu('do_not_close_the_app_during_this_process')}
					</p>
					<div className="flex space-x-1.5" aria-hidden>
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]/40" />
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]" />
						<div className="h-1.5 w-1.5 rounded-full bg-[#1562f0]/40" />
					</div>
				</footer>
			</div>
		)
	}

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f9f9ff] font-[Inter,system-ui,sans-serif] text-[#151c27]">
			<CreateIdentityDecorativeBg />
			<VerraFloatingNavChrome onBack={() => onRequestClose?.()} tone="create" />
			<main
				lang={getCurrentBeamioUiLocale() === 'zh-CN' ? 'zh-CN' : 'en'}
				className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:pb-[max(0.875rem,env(safe-area-inset-bottom))] [@media(max-height:640px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:px-5 [@media(max-height:560px)]:pb-[max(0.625rem,env(safe-area-inset-bottom))] ${APP_FLOATING_CHROME_MAIN_TOP_PT}`}
				style={{ paddingTop: topInsetPadding }}
			>
				<div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
					<div
						className={`shrink-0 text-center ${APP_TITLE_BLOCK_TO_FIRST_CONTROL_MB} [@media(max-height:780px)]:mb-8 [@media(max-height:700px)]:mb-6 [@media(max-height:640px)]:mb-4 [@media(max-height:560px)]:mb-3`}
					>
						<h1 className="mb-2 text-[32px] font-bold leading-10 tracking-[-0.02em] text-[#151c27] [@media(max-height:780px)]:text-[28px] [@media(max-height:780px)]:leading-9 [@media(max-height:700px)]:text-[24px] [@media(max-height:700px)]:leading-8 [@media(max-height:640px)]:mb-1.5 [@media(max-height:640px)]:text-[22px] [@media(max-height:640px)]:leading-7 [@media(max-height:560px)]:mb-1 [@media(max-height:560px)]:text-[20px]">
							{tu('create_your_beamio_id')}
						</h1>
						<p className="px-4 text-base font-normal leading-6 text-[#424655] [@media(max-height:700px)]:text-[15px] [@media(max-height:640px)]:px-2 [@media(max-height:640px)]:text-sm [@media(max-height:640px)]:leading-snug [@media(max-height:560px)]:text-[12px] [@media(max-height:560px)]:leading-[1.25]">
							{tu('your_unique_identity_in_the_beamio_network_use_it_to_connect_with_friend')}
						</p>
					</div>

					<div className="flex min-h-0 flex-1 flex-col justify-between gap-5 [@media(max-height:780px)]:gap-4 [@media(max-height:700px)]:gap-3 [@media(max-height:640px)]:gap-2.5 [@media(max-height:560px)]:gap-2">
						<div className="space-y-5 [@media(max-height:780px)]:space-y-4 [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:560px)]:space-y-2">
						<div className="space-y-2 [@media(max-height:640px)]:space-y-1.5 [@media(max-height:560px)]:space-y-1">
							<label htmlFor="create-beamio-tag-input" className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#424655] [@media(max-height:560px)]:text-[11px]">
								{tu('beamiotag')}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
									<span className="mr-1 text-lg font-normal text-[#004bc3] [@media(max-height:560px)]:text-base">@</span>
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
										"w-full rounded-lg border-none bg-[#dce2f3] py-3 pl-10 pr-12 text-lg font-normal text-[#151c27] outline-none transition-all placeholder:text-[#737687] focus:bg-white focus:ring-1 focus:ring-[#004bc3] [@media(max-height:780px)]:py-3 [@media(max-height:700px)]:py-2.5 [@media(max-height:640px)]:py-2.5 [@media(max-height:640px)]:text-base [@media(max-height:560px)]:rounded-lg [@media(max-height:560px)]:py-2 [@media(max-height:560px)]:pl-9 [@media(max-height:560px)]:pr-10 [@media(max-height:560px)]:text-[15px]",
										"disabled:opacity-70",
										tagStatus === "invalid" ? "ring-2 ring-orange-400/80 focus:ring-orange-400/30" : "",
									].join(" ")}
									value={beamioName}
									placeholder={tu('username')}
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
								<p className="px-4 text-[13px] font-medium text-emerald-600 [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:text-[11px]">{tu('this_tag_is_available')}</p>
							) : (
								<p className="text-sm font-medium leading-5 text-[#737687] [@media(max-height:560px)]:text-[12px]">{tu('permanent_cannot_be_changed_later')}</p>
							)}
						</div>

						<div className="mt-4 space-y-3.5 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:space-y-3 [@media(max-height:640px)]:space-y-2.5 [@media(max-height:560px)]:mt-2 [@media(max-height:560px)]:space-y-2">
							<div className="space-y-2 [@media(max-height:640px)]:space-y-1.5 [@media(max-height:560px)]:space-y-1">
								<label htmlFor="create-wallet-password" className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#424655] [@media(max-height:560px)]:text-[11px]">
									{tu('secure_password')}
								</label>
								<div className="relative">
									<input
										ref={passwordInputRef}
										id="create-wallet-password"
										readOnly={loading}
										type={showPassword ? "text" : "password"}
										autoComplete="new-password"
										enterKeyHint="next"
										className="w-full rounded-lg border-none bg-[#dce2f3] py-3 pl-4 pr-12 text-lg font-normal tracking-widest text-[#151c27] outline-none transition-all placeholder:text-[#737687] focus:bg-white focus:ring-1 focus:ring-[#004bc3] disabled:opacity-70 [@media(max-height:700px)]:py-2.5 [@media(max-height:640px)]:text-base [@media(max-height:560px)]:py-2 [@media(max-height:560px)]:pr-11 [@media(max-height:560px)]:text-[15px]"
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
										className="absolute inset-y-0 right-3 flex items-center rounded-lg p-1 text-[#737687] transition-colors hover:text-[#424655] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/30"
										onClick={() => setShowPassword(!showPassword)}
										aria-label={showPassword ? tu('hide_password') : tu('show_password')}
									>
										{showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2} /> : <Eye className="h-5 w-5" strokeWidth={2} />}
									</button>
								</div>
							</div>

							<div className="mt-2 space-y-1 [@media(max-height:560px)]:space-y-1">
								<div className="flex h-1 gap-1" aria-hidden>
									{[0, 1, 2, 3].map((idx) => (
										<div
											key={idx}
											className={[
												"flex-1 rounded-full transition-colors",
												idx < passwordStrengthCount ? "bg-[#004bc3]" : "bg-[#dce2f3]",
											].join(" ")}
										/>
									))}
								</div>
								<div className="mt-1 flex items-center justify-between">
									<span className="text-sm font-medium leading-5 text-[#424655] [@media(max-height:560px)]:text-[12px]">
										{passwordStrengthLabel}
									</span>
									<span className="text-sm font-medium leading-5 text-[#737687] [@media(max-height:560px)]:text-[12px]">
										{passwordStrengthPercent}%
									</span>
								</div>
								{showPasswordIssues ? (
									<div className="space-y-1 rounded-xl bg-orange-50 px-3 py-2 text-orange-700">
										<p className="text-[12px] font-bold leading-snug">{tu('please_fix')}</p>
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
						<div className="mt-2 grid grid-cols-2 gap-4 pt-2 [@media(max-height:780px)]:pt-1 [@media(max-height:700px)]:gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:560px)]:hidden">
							<div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-3.5 [@media(max-height:640px)]:p-3">
								<div className="flex h-8 w-8 items-center justify-center text-[#004bc3]">
									<Shield className="h-6 w-6 shrink-0" fill="currentColor" strokeWidth={0} aria-hidden />
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#424655]">{tu('vault')}</p>
									<p className="text-sm font-medium leading-5 text-[#151c27] [@media(max-height:640px)]:text-[13px]">{tu('encrypted_local_storage')}</p>
								</div>
							</div>
							<div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-3.5 [@media(max-height:640px)]:p-3">
								<div className="flex h-8 w-8 items-center justify-center text-[#004bc3]">
									<RefreshCw className="h-6 w-6 shrink-0" strokeWidth={2.25} aria-hidden />
								</div>
								<div className="flex flex-col gap-1">
									<p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#424655]">{tu('sync')}</p>
									<p className="text-sm font-medium leading-5 text-[#151c27] [@media(max-height:640px)]:text-[13px]">{tu('multi_device_continuity')}</p>
								</div>
							</div>
						</div>
						) : null}

						{!shouldHideNonCustodialNote ? (
						<p className="px-4 text-center text-sm font-medium leading-5 text-[#737687] [@media(max-height:640px)]:px-2 [@media(max-height:640px)]:text-[12px] [@media(max-height:560px)]:text-[11px] [@media(max-height:520px)]:hidden">
							{tu('beamio_is_non_custodial_we_cannot_reset_this_password_for_you')}
						</p>
						) : null}
						</div>

					<div className="mt-auto flex w-full shrink-0 flex-col items-center px-0 pt-2 [@media(max-height:700px)]:pt-1.5 [@media(max-height:640px)]:pt-1 [@media(max-height:560px)]:pt-0.5">
						{createError ? (
							<div className="mb-3 flex w-full items-start gap-1.5 px-1 text-red-600">
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
								<span className="text-[11px] font-semibold leading-snug">{createError}</span>
							</div>
						) : null}
						<AppButton
							fullWidth
							loading={loading}
							disabled={!canSubmit}
							rightIcon={!loading ? <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : undefined}
							className={[
								"!rounded-full !py-4 !text-sm !font-medium !transition-transform active:scale-95 [@media(max-height:700px)]:!py-3.5 [@media(max-height:640px)]:!py-3 [@media(max-height:560px)]:!py-2.5",
								canSubmit
									? "!inline-flex !items-center !justify-center !gap-2 !bg-[#004bc3] !text-white !shadow-[0_8px_30px_rgba(0,75,195,0.1)] hover:!bg-[#004bc3]/90 focus-visible:!ring-2 focus-visible:!ring-[#004bc3]/50 focus-visible:!ring-offset-2 focus-visible:!ring-offset-[#f9f9ff]"
									: "!cursor-not-allowed !bg-[#c3c6d8] !text-[#737687] !shadow-none",
							].join(" ")}
							onClick={() => void onSubmitPress()}
						>{tu('next')}</AppButton>
						<div className="mt-4 flex max-w-md flex-col gap-1 px-2 text-center text-xs font-semibold uppercase tracking-[0.05em] leading-4 text-[#737687] [@media(max-height:700px)]:mt-3 [@media(max-height:640px)]:mt-2 [@media(max-height:560px)]:mt-1.5 [@media(max-height:560px)]:text-[11px]">
							<p>
								{tu('by_continuing_you_agree_to_our')}
								<br />
								<button
									type="button"
									onClick={() => openExternalUrl(BEAMIO_TERMS_URL)}
									className="text-[#004bc3] hover:underline"
								>
									{tu('terms_of_service')}
								</button>
								{' '}
								{tu('and')}
								{' '}
								<button
									type="button"
									onClick={() => openExternalUrl(BEAMIO_PRIVACY_URL)}
									className="text-[#004bc3] hover:underline"
								>
									{tu('privacy_policy')}
								</button>
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
