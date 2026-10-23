import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
	BadgeCheck,
	Building2,
	Calculator,
	CalendarDays,
	ChevronDown,
	ChevronRight,
	FileText,
	KeyRound,
	Layers,
	Plus,
	RefreshCw,
	Store,
	UserRound,
} from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import {
	loadAgentTempAccounts,
	type AgentTempAccount,
} from '@/utils/agentBusinessWorkspace'

const M_PURPLE = '#8b3e91'
const M_SOFT = '#f6edf9'

type PanelView = 'main' | 'partnerPlan'
type EssentialsKey = 'fees' | 'packages' | 'calc' | null

const FEE_ROWS: { label: string; fee: string; note: string }[] = [
	{ label: 'Create Coupon', fee: '100 B-Units', note: 'per coupon creation' },
	{ label: 'Create Catalog', fee: '100 B-Units', note: 'per catalog creation' },
	{ label: 'Charge', fee: '5 B-Units', note: 'per charge' },
	{ label: 'Top-up', fee: '20 B-Units', note: 'per top-up' },
	{ label: 'Redeem / Burn', fee: '5 B-Units', note: 'per redeem or burn' },
]

/** Price + total B-Units only — no Paid/Free split (beamio-fuel-pack-display-no-paid-free). */
const PACKAGE_ROWS: { name: string; priceUsdc: string; totalBUnits: string; badge?: string }[] = [
	{ name: 'Start Kit', priceUsdc: '49', totalBUnits: '5,000', badge: 'First-time' },
	{ name: 'Growth', priceUsdc: '199', totalBUnits: '21,890', badge: 'Best value' },
	{ name: 'Scale', priceUsdc: '499', totalBUnits: '59,880' },
	{ name: 'Enterprise', priceUsdc: '999', totalBUnits: '129,870' },
]

function formatTempCreatedAt(createdAt: number): string {
	if (!Number.isFinite(createdAt) || createdAt <= 0) return 'Temporary account'
	try {
		return `Created ${new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
	} catch {
		return 'Temporary account'
	}
}

export function MerchantsBusinessPanel({
	agentTag,
	agentEoa,
	tempsRefreshKey,
	onBack,
	onCreateTemporary,
}: {
	agentTag: string
	agentEoa: string
	/** Bump when AgentBusinessInviteSheet closes so the list reloads. */
	tempsRefreshKey: number
	onBack: () => void
	onCreateTemporary: () => void
}) {
	const [view, setView] = useState<PanelView>('main')
	const [essentialsOpen, setEssentialsOpen] = useState<EssentialsKey>(null)
	const [temps, setTemps] = useState<AgentTempAccount[]>([])

	const reloadTemps = useCallback(() => {
		if (!agentEoa) {
			setTemps([])
			return
		}
		setTemps(loadAgentTempAccounts(agentEoa))
	}, [agentEoa])

	useEffect(() => {
		reloadTemps()
	}, [reloadTemps, tempsRefreshKey])

	const agentLabel = useMemo(() => {
		const tag = agentTag.replace(/^@/, '').trim()
		return tag ? `Agent · @${tag}` : 'Agent'
	}, [agentTag])

	const toggleEssentials = (key: Exclude<EssentialsKey, null>) => {
		setEssentialsOpen((prev) => (prev === key ? null : key))
	}

	if (view === 'partnerPlan') {
		return (
			<div className="space-y-4 pb-4">
				<div className="relative flex items-center justify-between">
					<BeamioCircularBackButton variant="onLight" onClick={() => setView('main')} aria-label="Back" />
					<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
						Partner reward plan
					</h1>
					<span className="inline-flex h-11 w-11" aria-hidden />
				</div>

				<section className="overflow-hidden rounded-[24px] border border-[#eadcf7] bg-white shadow-[0_8px_28px_rgba(139,62,145,0.08)] dark:border-purple-900/40 dark:bg-slate-900">
					<div className="bg-gradient-to-br from-[#faf5fb] to-white px-5 pb-5 pt-5 dark:from-purple-950/40 dark:to-slate-900">
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b3e91]">Business partner</p>
						<h2 className="mt-1 text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-slate-50">
							How you earn
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
							One-time rewards per qualifying location, plus recurring rewards from eligible paid usage.
						</p>
					</div>
					<div className="space-y-3 px-5 py-5">
						<div className="rounded-2xl border border-[#eadcf7] bg-[#faf5fb] p-4 dark:border-purple-900/50 dark:bg-purple-950/30">
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#8b3e91] shadow-sm dark:bg-slate-800">
									<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Paid onboarding</p>
									<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">When the location completes paid setup</p>
									<p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
										100 <span className="text-base font-bold">USDC</span>
									</p>
									<p className="mt-1 text-xs font-medium text-slate-400">Up to · one-time</p>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-[#eadcf7] bg-[#faf5fb] p-4 dark:border-purple-900/50 dark:bg-purple-950/30">
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#8b3e91] shadow-sm dark:bg-slate-800">
									<CalendarDays className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Day-60 milestone</p>
									<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">After 60 days of qualifying activity</p>
									<p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
										100 <span className="text-base font-bold">USDC</span>
									</p>
									<p className="mt-1 text-xs font-medium text-slate-400">One-time · per location</p>
								</div>
							</div>
						</div>
						<div className="rounded-2xl border border-dashed border-[#d4b8d8] bg-white px-4 py-3.5 dark:border-purple-800 dark:bg-slate-900">
							<p className="flex items-center gap-2 text-sm font-semibold text-[#8b3e91]">
								<RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
								Recurring from paid usage
							</p>
							<p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
								Eligible Charge and Top-up volume at enrolled partner locations can generate ongoing rewards per the partner
								program.
							</p>
						</div>
					</div>
					<p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800">
						Qualifying locations and enrolled partners only. Conditions apply.
					</p>
				</section>
			</div>
		)
	}

	return (
		<div className="space-y-5 pb-4">
			<div className="relative flex items-center justify-between">
				<BeamioCircularBackButton variant="onLight" onClick={onBack} aria-label="Back" />
				<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
					Business
				</h1>
				<span className="inline-flex h-11 w-11" aria-hidden />
			</div>

			<div className="flex justify-center">
				<span
					className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					<BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
					{agentLabel}
				</span>
			</div>

			<section className="overflow-hidden rounded-[28px] border border-[#eadcf7] bg-gradient-to-b from-[#faf5fb] to-white p-5 shadow-[0_12px_36px_rgba(139,62,145,0.1)] dark:border-purple-900/40 dark:from-purple-950/35 dark:to-slate-900">
				<h2 className="text-[22px] font-bold leading-snug tracking-tight text-[#0F172A] dark:text-slate-50">
					Help a business get started.
				</h2>
				<div className="mt-5 flex items-start justify-between gap-1">
					{[
						{ Icon: UserRound, label: 'Create account' },
						{ Icon: Building2, label: 'Set up in OS' },
						{ Icon: KeyRound, label: 'Owner handover' },
					].map((step, i) => (
						<React.Fragment key={step.label}>
							{i > 0 ? (
								<span className="mt-4 flex shrink-0 items-center text-[#d4b8d8]" aria-hidden>
									<ChevronRight className="h-4 w-4" />
								</span>
							) : null}
							<div className="flex min-w-0 flex-1 flex-col items-center text-center">
								<span
									className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#eadcf7] dark:bg-slate-800 dark:ring-purple-800"
									style={{ color: M_PURPLE }}
								>
									<step.Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<p className="mt-2 text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
									{step.label}
								</p>
							</div>
						</React.Fragment>
					))}
				</div>
				<button
					type="button"
					onClick={onCreateTemporary}
					className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(139,62,145,0.35)] transition active:scale-[0.99]"
					style={{ backgroundColor: M_PURPLE }}
				>
					<Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
					Create temporary account
				</button>
			</section>

			<section>
				<div className="mb-2.5 flex items-center justify-between gap-2">
					<h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">Temporary accounts</h2>
					<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
						{temps.length}
					</span>
				</div>
				{temps.length === 0 ? (
					<div className="flex flex-col items-center rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-6 w-6" strokeWidth={2} aria-hidden />
						</span>
						<p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
							No accounts yet. Create one to begin.
						</p>
					</div>
				) : (
					<ul className="space-y-2.5">
						{temps.map((temp) => (
							<li
								key={temp.eoa.toLowerCase()}
								className="rounded-[20px] border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
											@{temp.beamioTag.replace(/^@/, '')}
										</p>
										<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
											{formatTempCreatedAt(temp.createdAt)}
										</p>
									</div>
									<button
										type="button"
										onClick={onCreateTemporary}
										className="shrink-0 text-xs font-semibold text-[#8b3e91]"
									>
										Manage
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<section>
				<div className="mb-2.5 flex items-end justify-between gap-2">
					<h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">Referral rewards</h2>
					<span className="text-[11px] font-medium text-slate-400">One-time · per location</span>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Paid onboarding</p>
						<p className="mt-1 text-[11px] text-slate-400">Up to</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">100 USDC</p>
					</div>
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Day-60 milestone</p>
						<p className="mt-1 text-[11px] text-slate-400">One-time</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">100 USDC</p>
					</div>
				</div>
				<p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
				<button
					type="button"
					onClick={() => setView('partnerPlan')}
					className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					View reward plan
					<span aria-hidden>→</span>
				</button>
				<p className="mt-2.5 text-center text-[11px] leading-relaxed text-slate-400">
					Qualifying locations and enrolled partners only. Conditions apply.
				</p>
			</section>

			<section>
				<h2 className="mb-2.5 text-[17px] font-semibold text-slate-900 dark:text-slate-50">Business essentials</h2>
				<div className="overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
					{(
						[
							{ key: 'fees' as const, Icon: FileText, title: 'Service fees' },
							{ key: 'packages' as const, Icon: Layers, title: 'Business packages' },
							{ key: 'calc' as const, Icon: Calculator, title: 'Reward calculation' },
						] as const
					).map((row, idx) => {
						const open = essentialsOpen === row.key
						return (
							<div
								key={row.key}
								className={idx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : undefined}
							>
								<button
									type="button"
									onClick={() => toggleEssentials(row.key)}
									className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
									aria-expanded={open}
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
										<row.Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</span>
									<span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
										{row.title}
									</span>
									<ChevronDown
										className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
										aria-hidden
									/>
								</button>
								{open && row.key === 'fees' ? (
									<div className="space-y-2 px-4 pb-4">
										{FEE_ROWS.map((fee) => (
											<div
												key={fee.label}
												className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80"
											>
												<div className="min-w-0">
													<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fee.label}</p>
													<p className="text-[11px] text-slate-400">{fee.note}</p>
												</div>
												<p className="shrink-0 text-sm font-bold tabular-nums text-[#8b3e91]">{fee.fee}</p>
											</div>
										))}
									</div>
								) : null}
								{open && row.key === 'packages' ? (
									<div className="space-y-2 px-4 pb-4">
										{PACKAGE_ROWS.map((pkg) => (
											<div
												key={pkg.name}
												className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80"
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{pkg.name}</p>
													{pkg.badge ? (
														<span className="rounded-full bg-[#f6edf9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b3e91]">
															{pkg.badge}
														</span>
													) : null}
												</div>
												<p className="mt-1 text-[15px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
													${pkg.priceUsdc} USDC
												</p>
												<p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
													{pkg.totalBUnits} B-Units
												</p>
											</div>
										))}
									</div>
								) : null}
								{open && row.key === 'calc' ? (
									<div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										<p>
											One-time partner rewards are paid per qualifying location for paid onboarding and the Day-60
											milestone (up to 100 USDC each).
										</p>
										<p>
											Recurring rewards follow eligible paid Charge and Top-up usage at enrolled partner locations under
											the partner program rules.
										</p>
									</div>
								) : null}
							</div>
						)
					})}
				</div>
			</section>

			<p className="text-center text-[12px] leading-relaxed text-slate-400">
				Temporary accounts stay separate from your personal account.
			</p>
		</div>
	)
}
