import React from "react"
import { Briefcase, Building2 } from "lucide-react"

/** Full-screen “Creating your business workspace” UI — z above Recovery modal (9998). */
/** Layout aligned with `Vouchers/example/Untitled` (Verra Identity | Business Workspace Setup). */
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

const PRIMARY = "#0051d1"
const ON_SURFACE = "#1a1c1e"
const ON_SURFACE_VARIANT = "#44474e"

export default function WorkspaceCreatingOverlay() {
	return (
		<>
			<style>{WORKSPACE_CREATING_STYLE}</style>
			<div
				className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col items-center overflow-hidden bg-white text-[#1a1c1e]"
				style={{
					paddingLeft: "env(safe-area-inset-left)",
					paddingRight: "env(safe-area-inset-right)",
					boxSizing: "border-box",
				}}
			>
				{/* TopAppBar — Untitled: corporate_fare tile + Beamio Business Lite, transparent, center / lg:start */}
				<header
					className="relative z-[10052] flex w-full items-center justify-center gap-2 bg-transparent px-8 pt-8 lg:justify-start lg:px-12"
					style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
				>
					<div
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-white"
						style={{ backgroundColor: PRIMARY }}
						aria-hidden
					>
						<Building2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
					</div>
					<span
						className="biz-identity-headline text-xl font-extrabold tracking-tighter"
						style={{ color: PRIMARY }}
					>
						Beamio Business Lite
					</span>
				</header>

				{/* Main canvas — fluid-bg, centered ring + copy */}
				<main className="biz-workspace-fluid-bg relative z-[10051] mx-auto flex w-full max-w-lg flex-grow flex-col items-center justify-center px-8">
					<div className="relative mb-16 flex h-48 w-48 shrink-0 items-center justify-center">
						<div className="biz-workspace-soft-pulse absolute inset-0 rounded-full" style={{ backgroundColor: `${PRIMARY}0D` }} aria-hidden />
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
								style={{ color: PRIMARY }}
							/>
						</svg>
						<div className="absolute inset-0 flex items-center justify-center">
							<Briefcase className="h-10 w-10" strokeWidth={1.5} style={{ color: `${PRIMARY}66` }} aria-hidden />
						</div>
					</div>

					<div className="max-w-sm space-y-4 text-center">
						<h2 className="biz-identity-headline text-2xl font-extrabold tracking-tight md:text-3xl" style={{ color: ON_SURFACE }}>
							Creating your business lite workspace...
						</h2>
						<p className="text-base font-medium leading-relaxed" style={{ color: ON_SURFACE_VARIANT }}>
							We&apos;re preparing your business identity and getting your Verra workspace ready.
						</p>
						<div className="pt-2">
							<p className="text-sm font-medium" style={{ color: `${ON_SURFACE_VARIANT}66` }}>
								This usually takes a few seconds.
							</p>
						</div>
					</div>
				</main>

				{/* Footer status — fixed bottom-12 */}
				<footer
					className="fixed left-0 right-0 z-[10052] w-full px-4 text-center"
					style={{ bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" }}
				>
					<div
						className="inline-flex items-center gap-2.5 rounded-full border bg-white px-6 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
						style={{ borderColor: "rgba(223, 226, 235, 0.2)" }}
					>
						<div
							className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
							style={{ backgroundColor: `${PRIMARY}4D` }}
							aria-hidden
						/>
						<span
							className="biz-identity-headline text-[10px] font-bold uppercase tracking-[0.15em]"
							style={{ color: `${ON_SURFACE_VARIANT}B3` }}
						>
							Business setup in progress
						</span>
					</div>
				</footer>

				{/* Decorative blurs */}
				<div
					className="pointer-events-none fixed left-0 top-1/4 -left-32 z-[10048] h-96 w-96 rounded-full blur-[120px]"
					style={{ backgroundColor: `${PRIMARY}08` }}
					aria-hidden
				/>
				<div
					className="pointer-events-none fixed -right-32 bottom-1/4 z-[10048] h-80 w-80 rounded-full blur-[100px]"
					style={{ backgroundColor: `${PRIMARY}08` }}
					aria-hidden
				/>
			</div>
		</>
	)
}
