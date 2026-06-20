import React from 'react'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { IpfsImg } from '@/components/IpfsImg'
import { BIZ_PUBLIC_LOGO512 } from '@/pages/Home/brandUi'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { LongDhangConetMigrationPanel } from './longDhangConetMigrationPanel'
import type { LongDhangMigrationAutoPhase, LongDhangMigrationAutoResult } from '@/services/BeamioCard'

const PHASE_LABEL: Record<LongDhangMigrationAutoPhase, string> = {
	'loading-members': 'Loading frozen Base snapshot (5 members, 3 terminals)…',
	'creating-card': 'Creating CoNET card (inherits Base metadata)…',
	'authorizing-admin': 'Authorizing migration admin…',
	migrating: 'Airdropping member balances on CoNET…',
	'migrate-admins': 'Registering POS terminals under merchant owner admin…',
	completed: 'Migration complete',
	failed: 'Migration failed',
}

export type LongDhangConetMigrationFullScreenProps = {
	currentEoa: string
	privateKeyArmor?: string | null
	authorizedOwnerEoa?: string[] | null
	migrationBusy?: boolean
	migrationPhase: LongDhangMigrationAutoPhase | null
	migrationPhaseDetail: string | null
	migrationResult: LongDhangMigrationAutoResult | null
	onDismiss: () => void
	onStartMigration: () => void
}

/**
 * Full-screen LongDhang Base → CoNET migration workspace (authorized owner EOAs only).
 * Shown instead of generic Lite onboarding / empty LoadingPage shell.
 */
export function LongDhangConetMigrationFullScreen({
	currentEoa,
	privateKeyArmor,
	authorizedOwnerEoa,
	migrationBusy = false,
	migrationPhase,
	migrationPhaseDetail,
	migrationResult,
	onDismiss,
	onStartMigration,
}: LongDhangConetMigrationFullScreenProps) {
	const walletReady = Boolean(privateKeyArmor?.trim())

	return (
		<div
			className="fixed inset-0 z-[10060] flex min-h-[100dvh] flex-col overflow-hidden bg-[#f5f7f9] text-[#2c2f31]"
			style={{
				paddingTop: 'env(safe-area-inset-top)',
				paddingBottom: 'env(safe-area-inset-bottom)',
				paddingLeft: 'env(safe-area-inset-left)',
				paddingRight: 'env(safe-area-inset-right)',
			}}
		>
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
				<div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-[#7a9dff]/5 blur-[120px]" />
				<div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-amber-200/20 blur-[120px]" />
			</div>

			<header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[#abadaf]/20 bg-[#f5f7f9]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
				<div className="flex min-w-0 items-center gap-2.5">
					<IpfsImg src={BIZ_PUBLIC_LOGO512} alt="Beamio" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
					<div className="min-w-0">
						<p className="truncate font-manrope text-base font-extrabold tracking-tight text-[#0051d1]">
							LongDhang Migration
						</p>
						<p className="truncate text-[11px] font-semibold text-[#595c5e]">Base program card → CoNET</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onDismiss}
					disabled={migrationBusy}
					className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#abadaf]/30 bg-white px-3 py-2 text-xs font-bold text-[#515c70] transition hover:bg-[#eef1f3] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
					Workspace
				</button>
			</header>

			<main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6 sm:py-6">
				<div className="mx-auto max-w-4xl space-y-4">
					<section className="rounded-2xl border border-[#1562f0]/15 bg-white/80 p-4 shadow-sm sm:p-5">
						<div className="flex items-start gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0051d1]/10">
								<Briefcase className="h-5 w-5 text-[#0051d1]" strokeWidth={2} aria-hidden />
							</div>
							<div className="min-w-0">
								<h1 className="font-manrope text-xl font-extrabold tracking-tight text-[#2c2f31] sm:text-2xl">
									Migrate LongDhang to CoNET
								</h1>
								<p className="mt-1 text-sm font-medium leading-relaxed text-[#595c5e]">
									Press <strong>Start Migration</strong> once — the system creates a CoNET card, copies Base metadata,
									airdrops all Members&apos; balances, migrates sub-admins/terminals, and verifies automatically.
								</p>
							</div>
						</div>
					</section>

					{!walletReady ? (
						<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
							Unlock this workspace with your @BeamioTag and access password to sign migration steps.
						</div>
					) : null}

					{migrationPhase ? (
						<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
								{migrationBusy ? (
									<Loader2 className="h-4 w-4 animate-spin text-[#1562f0]" aria-hidden />
								) : migrationPhase === 'completed' ? (
									<Check className="h-4 w-4 text-emerald-500" aria-hidden />
								) : migrationPhase === 'failed' ? (
									<AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
								) : null}
								{PHASE_LABEL[migrationPhase]}
							</p>
							{migrationPhaseDetail ? (
								<p className="mt-1 break-all text-xs font-semibold text-slate-500">{migrationPhaseDetail}</p>
							) : null}
							{migrationResult && !migrationResult.success ? (
								<p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
									{migrationResult.error ?? migrationPhaseDetail ?? 'Migration failed.'}
								</p>
							) : null}
						</div>
					) : null}

					<LongDhangConetMigrationPanel
						currentEoa={currentEoa}
						privateKeyArmor={privateKeyArmor}
						authorizedOwnerEoa={authorizedOwnerEoa}
						className="shadow-md"
						busy={migrationBusy}
						phase={migrationPhase}
						phaseDetail={migrationPhaseDetail}
						result={migrationResult}
						onStart={onStartMigration}
					/>
				</div>
			</main>
		</div>
	)
}
