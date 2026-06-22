import React from "react"
import { IpfsImg } from "@/components/IpfsImg"
import { Briefcase, Check, KeyRound, RefreshCw } from "lucide-react"
import { BIZ_PUBLIC_LOGO512 } from "@/pages/Home/brandUi"
import { useTu } from "@/locale/beamioLocale"

/**
 * Full-screen workspace creation UI — layout aligned with SilentPassUI
 * `CreateUsernamePinScreen` loading branch (compositor-friendly CSS animations).
 */
export const WORKSPACE_CREATING_STEP_DURATION_MS = 2000
export const WORKSPACE_CREATING_LEAD_MS = 300

export const WORKSPACE_CREATING_STEPS = [
	{ id: 0, titleKey: "onb_workspace_step0_title", descKey: "onb_workspace_step0_desc", icon: KeyRound },
	{ id: 1, titleKey: "onb_workspace_step1_title", descKey: "onb_workspace_step1_desc", icon: RefreshCw },
] as const

const WORKSPACE_CREATING_STYLE = `
	@keyframes biz-workspace-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	@keyframes biz-workspace-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } }
	@keyframes biz-workspace-breath { 0%, 100% { box-shadow: 0 0 20px rgba(21, 98, 240, 0.1); } 50% { box-shadow: 0 0 60px rgba(21, 98, 240, 0.3); } }
`

export type WorkspaceCreatingOverlayProps = {
	creatingStep?: number
}

export default function WorkspaceCreatingOverlay({ creatingStep = 0 }: WorkspaceCreatingOverlayProps) {
	const { tu } = useTu()
	const steps = WORKSPACE_CREATING_STEPS

	return (
		<div
			className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#f9f9fe] text-[#1a1c1f]"
			style={{
				paddingLeft: "env(safe-area-inset-left)",
				paddingRight: "env(safe-area-inset-right)",
				boxSizing: "border-box",
			}}
		>
			<style>{WORKSPACE_CREATING_STYLE}</style>

			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-[#004bc3]/5 blur-[120px]" />
				<div className="absolute -bottom-[5%] -right-[5%] h-[50%] w-[50%] rounded-full bg-[#a7bcff]/10 blur-[100px]" />
				<div className="absolute right-[10%] top-[20%] h-[30%] w-[30%] rounded-full bg-[#b3c5ff]/10 blur-[80px]" />
			</div>

			<main className="flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center self-center overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] text-center">
				<div
					className="relative mb-10 flex h-72 w-72 shrink-0 items-center justify-center
						[@media(max-height:700px)]:mb-6 [@media(max-height:700px)]:h-56 [@media(max-height:700px)]:w-56
						[@media(max-height:640px)]:mb-4 [@media(max-height:640px)]:h-44 [@media(max-height:640px)]:w-44"
				>
					<div
						className="absolute h-48 w-48 rounded-full bg-[#004bc3]/10 blur-3xl
							[@media(max-height:700px)]:h-36 [@media(max-height:700px)]:w-36
							[@media(max-height:640px)]:h-28 [@media(max-height:640px)]:w-28"
						style={{ animation: "biz-workspace-breath 4s ease-in-out infinite" }}
						aria-hidden
					/>
					<div
						className="absolute inset-0 rounded-full border-[1.5px] border-[#c3c6d8]/30 will-change-transform"
						style={{ animation: "biz-workspace-spin-slow 12s linear infinite" }}
						aria-hidden
					/>
					<div
						className="absolute inset-4 rounded-full border border-[#004bc3]/20 will-change-transform [@media(max-height:640px)]:inset-3"
						style={{ animation: "biz-workspace-spin-slow 8s linear infinite reverse" }}
						aria-hidden
					/>
					<div
						className="absolute inset-10 rounded-full border-2 border-[#1562f0]/10 will-change-transform [@media(max-height:700px)]:inset-8 [@media(max-height:640px)]:inset-6"
						style={{ animation: "biz-workspace-spin-slow 15s linear infinite" }}
						aria-hidden
					/>
					<div
						className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)]
							[@media(max-height:700px)]:h-24 [@media(max-height:700px)]:w-24
							[@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
						style={{ backdropFilter: "blur(20px)", background: "rgba(255, 255, 255, 0.7)" }}
					>
						<IpfsImg
							src={BIZ_PUBLIC_LOGO512}
							alt={tu('onb_beamio_business_lite')}
							className="h-14 w-14 rounded-[14px] object-contain [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:w-11 [@media(max-height:700px)]:rounded-[12px] [@media(max-height:640px)]:h-9 [@media(max-height:640px)]:w-9 [@media(max-height:640px)]:rounded-[10px]"
							style={{ animation: "biz-workspace-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
							draggable={false}
						/>
					</div>
					<div
						className="absolute inset-0 will-change-transform"
						style={{ animation: "biz-workspace-spin-slow 12s linear infinite" }}
						aria-hidden
					>
						<div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1562f0] shadow-[0_0_12px_rgba(21,98,240,0.6)] [@media(max-height:640px)]:h-2.5 [@media(max-height:640px)]:w-2.5" />
					</div>
				</div>

				<div className="w-full space-y-8 [@media(max-height:700px)]:space-y-5 [@media(max-height:640px)]:space-y-3">
					<h1 className="text-3xl font-extrabold tracking-tight text-[#1a1c1f] [@media(max-height:700px)]:text-2xl [@media(max-height:640px)]:text-xl">
						{tu('onb_workspace_creating_title')}
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
										{isActive ? (
											<div
												className="absolute inset-0 animate-spin rounded-full border-2 border-[#004bc3] border-t-transparent"
												aria-hidden
											/>
										) : null}
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
												isActive || isCompleted ? "text-[#1a1c1f]" : "text-[#1a1c1f]/90",
											]
												.filter(Boolean)
												.join(" ")}
										>
											{tu(s.titleKey)}
										</p>
										{s.descKey ? (
											<p className="mt-1 text-xs text-[#424655] [@media(max-height:640px)]:mt-0.5 [@media(max-height:640px)]:text-[11px]">
												{tu(s.descKey)}
											</p>
										) : null}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</main>

			<footer className="shrink-0 px-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 text-center [@media(max-height:700px)]:pt-2 [@media(max-height:640px)]:pt-1.5">
				<div className="mx-auto max-w-xs">
					<p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#424655]/60">
						{tu('onb_workspace_do_not_close')}
					</p>
					<div className="mt-3 flex justify-center space-x-1 [@media(max-height:640px)]:mt-2" aria-hidden>
						<div className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/20" style={{ animationDelay: "0s" }} />
						<div className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/40" style={{ animationDelay: "0.15s" }} />
						<div className="h-1 w-1 animate-bounce rounded-full bg-[#004bc3]/20" style={{ animationDelay: "0.3s" }} />
					</div>
					<div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#dfe3eb]/80 bg-white/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#424655]/70">
						<Briefcase className="h-3 w-3 text-[#1562f0]/70" strokeWidth={2.25} aria-hidden />
						{tu('onb_workspace_setup_in_progress')}
					</div>
				</div>
			</footer>
		</div>
	)
}

/** Let loading UI paint and start compositor animations before heavy createRecover / argon2 work. */
export function awaitWorkspaceCreatingPaint(
	leadMs: number = WORKSPACE_CREATING_LEAD_MS
): Promise<void> {
	return new Promise((resolve) => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				window.setTimeout(resolve, leadMs)
			})
		})
	})
}
