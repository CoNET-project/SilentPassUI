import React from "react"
import { Briefcase, User } from "lucide-react"
import { BIZ_PUBLIC_LOGO512 } from "@/pages/Home/brandUi"

/** Full-screen “Creating your business workspace” UI — z above Recovery modal (9998). */
export const WORKSPACE_CREATING_STYLE = `
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

export default function WorkspaceCreatingOverlay() {
	return (
		<>
			<style>{WORKSPACE_CREATING_STYLE}</style>
			<div
				className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#1a1c1e]"
				style={{
					paddingLeft: "env(safe-area-inset-left)",
					paddingRight: "env(safe-area-inset-right)",
					boxSizing: "border-box",
				}}
			>
				<header
					className="fixed left-0 right-0 top-0 z-[10052] flex items-center justify-between bg-white/80 px-6 py-5 backdrop-blur-xl"
					style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
				>
					<div className="flex items-center gap-2">
						<img
							src={BIZ_PUBLIC_LOGO512}
							alt=""
							className="h-7 w-7 shrink-0 rounded-md object-contain"
						/>
						<h1 className="biz-identity-headline text-lg font-bold tracking-tight text-[#0051d1]">Verra Identity</h1>
					</div>
					<div className="flex items-center gap-4">
						<span className="biz-identity-headline text-[10px] font-bold uppercase tracking-widest text-[#44474e]/60">
							Step 1 of 2
						</span>
						<div
							className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-[#dfe3e6] shadow-sm"
							aria-hidden
						>
							<User className="h-4 w-4 text-[#44474e]/55" strokeWidth={2} aria-hidden />
						</div>
					</div>
				</header>

				<main
					className="biz-workspace-fluid-bg relative z-[10051] flex min-h-[100dvh] w-full flex-grow flex-col items-center justify-center px-8"
					style={{
						paddingTop: "calc(5.5rem + env(safe-area-inset-top))",
						paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
					}}
				>
					<div className="mx-auto flex w-full max-w-lg flex-col items-center">
						<div className="relative mb-16 flex h-48 w-48 shrink-0 items-center justify-center">
							<div className="biz-workspace-soft-pulse absolute inset-0 rounded-full bg-[#0051d1]/5" aria-hidden />
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
								<Briefcase className="h-10 w-10 text-[#0051d1]/40" strokeWidth={1.5} aria-hidden />
							</div>
						</div>

						<div className="max-w-sm space-y-4 text-center">
							<h2 className="biz-identity-headline text-2xl font-extrabold tracking-tight text-[#1a1c1e] md:text-3xl">
								Creating your business workspace…
							</h2>
							<p className="text-base font-medium leading-relaxed text-[#44474e]">
								We&apos;re preparing your business identity and getting your Verra workspace ready.
							</p>
							<div className="pt-2">
								<p className="text-sm font-medium text-[#44474e]/40">This usually takes a few seconds.</p>
							</div>
						</div>
					</div>
				</main>

				<footer
					className="fixed left-0 right-0 z-[10052] flex w-full justify-center px-4 text-center"
					style={{ bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" }}
				>
					<div className="inline-flex items-center gap-2.5 rounded-full border border-[#dfe2eb]/20 bg-white px-6 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
						<div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#0051d1]/30" aria-hidden />
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
}
