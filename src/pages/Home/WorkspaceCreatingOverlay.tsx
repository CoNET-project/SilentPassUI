import React, { useEffect, useState } from "react"
import { Briefcase, KeyRound, RefreshCw, Zap } from "lucide-react"
import { useTu } from "@/locale/beamioLocale"

/**
 * Full-screen workspace creation UI — layout aligned with the
 * Beamio Business Lite “Deploying your global commerce node” minting screen.
 */
export const WORKSPACE_CREATING_STEP_DURATION_MS = 2000
export const WORKSPACE_CREATING_LEAD_MS = 300

export const WORKSPACE_CREATING_STEPS = [
	{ id: 0, titleKey: "onb_workspace_step0_title", icon: KeyRound },
	{ id: 1, titleKey: "onb_workspace_step1_title", icon: RefreshCw },
] as const

const WORKSPACE_CREATING_STYLE = `
	@keyframes biz-orb-glow {
		0%, 100% { box-shadow: 0 0 20px 5px rgba(21, 98, 240, 0.2); }
		50% { box-shadow: 0 0 40px 15px rgba(21, 98, 240, 0.4); }
	}
	@keyframes biz-orbit {
		0% { transform: translate(-50%, -50%) rotate(0deg) translateX(80px) rotate(0deg); }
		100% { transform: translate(-50%, -50%) rotate(360deg) translateX(80px) rotate(-360deg); }
	}
	@keyframes biz-ping-slow {
		75%, 100% { transform: scale(1.35); opacity: 0; }
	}
	@keyframes biz-spin-slow {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	@keyframes biz-pulse-slow {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}
`

export type WorkspaceCreatingOverlayProps = {
	creatingStep?: number
}

export default function WorkspaceCreatingOverlay({ creatingStep }: WorkspaceCreatingOverlayProps) {
	const { tu } = useTu()
	const [autoStep, setAutoStep] = useState(0)
	const controlled = typeof creatingStep === "number"
	const step = controlled ? creatingStep : autoStep

	useEffect(() => {
		if (controlled) return
		const t = window.setTimeout(
			() => setAutoStep(1),
			WORKSPACE_CREATING_LEAD_MS + WORKSPACE_CREATING_STEP_DURATION_MS
		)
		return () => window.clearTimeout(t)
	}, [controlled])

	return (
		<div
			className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col items-center justify-between overflow-hidden font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#1b1b1e]"
			style={{
				paddingLeft: "env(safe-area-inset-left)",
				paddingRight: "env(safe-area-inset-right)",
				boxSizing: "border-box",
				background: "radial-gradient(circle at top, #f0f4ff 0%, #faf9fe 60%)",
			}}
		>
			<style>{WORKSPACE_CREATING_STYLE}</style>

			<main className="flex min-h-0 w-full max-w-md flex-1 flex-col items-center justify-center px-6 pt-[max(3rem,calc(env(safe-area-inset-top)+2.5rem))]">
				<div className="relative mb-12 flex h-64 w-64 shrink-0 items-center justify-center [@media(max-height:700px)]:mb-8 [@media(max-height:700px)]:h-52 [@media(max-height:700px)]:w-52 [@media(max-height:640px)]:mb-6 [@media(max-height:640px)]:h-44 [@media(max-height:640px)]:w-44">
					<div
						className="absolute inset-0 rounded-full border border-[#dfe8ff]/50 opacity-20"
						style={{ animation: "biz-ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
						aria-hidden
					/>
					<div className="absolute inset-4 rounded-full border border-[#dfe8ff]/80" aria-hidden />
					<div className="absolute inset-10 rounded-full border border-[#dfe8ff]" aria-hidden />
					<div
						className="absolute inset-16 rounded-full border border-[#1562f0]/20 [@media(max-height:700px)]:inset-12"
						style={{ animation: "biz-spin-slow 8s linear infinite" }}
						aria-hidden
					/>
					<div
						className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#1562f0] shadow-[0_0_8px_rgba(21,98,240,0.8)]"
						style={{ animation: "biz-orbit 4s linear infinite" }}
						aria-hidden
					/>
					<div
						className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] [@media(max-height:640px)]:h-20 [@media(max-height:640px)]:w-20"
						style={{ animation: "biz-orb-glow 4s ease-in-out infinite" }}
					>
						<div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#111c2e] [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:w-10">
							<div
								className="pointer-events-none absolute inset-0"
								style={{ background: "radial-gradient(circle, rgba(21,98,240,0.3) 0%, transparent 70%)" }}
								aria-hidden
							/>
							<Zap className="relative z-10 h-6 w-6 text-[#1562f0]" strokeWidth={2.5} fill="currentColor" aria-hidden />
						</div>
					</div>
				</div>

				<div className="mb-12 w-full text-center [@media(max-height:700px)]:mb-8 [@media(max-height:640px)]:mb-6">
					<h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1b1b1e]">
						{tu("onb_workspace_creating_title")}
					</h1>
				</div>

				<div className="flex w-full flex-col gap-6 [@media(max-height:640px)]:gap-4">
					{WORKSPACE_CREATING_STEPS.map((s, idx) => {
						const isDoneLook = idx === 0
						const isLoadingLook = idx === 1 && step >= 1
						const Icon = s.icon
						return (
							<div key={s.id} className="flex items-start gap-4" aria-current={idx === Math.min(step, 1) ? "step" : undefined}>
								<div
									className={[
										"mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
										isDoneLook ? "bg-[#dfe8ff] text-[#1562f0]" : "bg-[#eeeeef] text-[#75777c]",
									].join(" ")}
									style={isLoadingLook ? { animation: "biz-pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : undefined}
								>
									<Icon
										className={["h-5 w-5", isLoadingLook || idx === 1 ? "animate-spin" : ""].filter(Boolean).join(" ")}
										strokeWidth={2.5}
										aria-hidden
									/>
								</div>
								<div className="flex min-w-0 flex-col pt-2">
									<span
										className={[
											"text-base",
											isDoneLook ? "font-semibold text-[#1b1b1e]" : "font-medium text-[#75777c]",
										].join(" ")}
									>
										{tu(s.titleKey)}
									</span>
								</div>
							</div>
						)
					})}
				</div>
			</main>

			<footer className="flex w-full max-w-md shrink-0 flex-col items-center justify-center gap-6 px-6 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] pt-4">
				<div className="flex flex-col items-center gap-2">
					<p className="text-center text-xs font-bold uppercase tracking-widest text-[#75777c]">
						{tu("onb_workspace_do_not_close")}
					</p>
					<div className="flex gap-1" aria-hidden>
						<div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1562f0]/30" />
						<div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1562f0]/60" style={{ animationDelay: "75ms" }} />
						<div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1562f0]" style={{ animationDelay: "150ms" }} />
					</div>
				</div>
				<div className="flex items-center gap-2 rounded-full border border-[#c5c6cc] bg-white px-4 py-2 shadow-sm">
					<Briefcase className="h-3.5 w-3.5 text-[#1562f0]" strokeWidth={2.5} aria-hidden />
					<span className="text-[11px] font-bold uppercase tracking-wider text-[#545f74]">
						{tu("onb_workspace_setup_in_progress")}
					</span>
				</div>
			</footer>
		</div>
	)
}

/** Let loading UI paint before heavy createRecover / argon2 work.
 * Safari Private may never fire rAF while a full-screen overlay is up — always fall back to setTimeout. */
export function awaitWorkspaceCreatingPaint(
	leadMs: number = WORKSPACE_CREATING_LEAD_MS
): Promise<void> {
	return new Promise((resolve) => {
		let done = false
		const finish = () => {
			if (done) return
			done = true
			resolve()
		}
		window.setTimeout(finish, leadMs + 50)
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				window.setTimeout(finish, leadMs)
			})
		})
	})
}
