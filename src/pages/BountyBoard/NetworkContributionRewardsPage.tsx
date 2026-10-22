import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	ArrowRight,
	BadgeCheck,
	Building2,
	Calculator,
	LineChart,
	Check,
	ChevronDown,
	ChevronRight,
	Gift,
	Layers,
	RotateCcw,
	Split,
	Store,
	UserRound,
	Users,
	type LucideIcon,
} from 'lucide-react'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'

const SLIDE_MS = 300

/** Soft palette aligned with sample Beamio Rewards Hub 2 (`--h-*`). */
const H = {
	soft: '#eef3ff',
	blue: '#165ce9',
	line: '#e6ebf4',
	sub: '#72809a',
	card: '#ffffff',
	purple: '#865ab6',
	purpleBg: '#f6effe',
	shadow: 'rgba(36, 65, 109, 0.035)',
	roleA: '#165ce9',
	roleB: '#865ab6',
	roleC: '#5a91ef',
	roleD: '#8fafe6',
} as const

const NETWORK_ROLES = [
	{
		id: 'merchant-referrer',
		label: 'Merchant referrer',
		pool: 50,
		balance: 15,
		contribution: 'Introduces businesses',
		Icon: Store,
		bar: H.roleA,
	},
	{
		id: 'consumer-referrer',
		label: 'Consumer referrer',
		pool: 10,
		balance: 3,
		contribution: 'Invites consumers',
		Icon: Users,
		bar: H.roleB,
	},
	{
		id: 'consumer',
		label: 'Consumer',
		pool: 20,
		balance: 6,
		contribution: 'Takes part in activity',
		Icon: UserRound,
		bar: H.roleC,
	},
	{
		id: 'merchant',
		label: 'Merchant',
		pool: 20,
		balance: 6,
		contribution: 'Serves customers',
		Icon: Building2,
		bar: H.roleD,
	},
] as const

type NetworkRoleId = (typeof NETWORK_ROLES)[number]['id']

const POOL_SCENARIOS = [
	{ id: 'redemptions', label: 'Redemptions', redemptions: 980, payments: 0 },
	{ id: 'mixed', label: 'Mixed activity', redemptions: 490, payments: 98 },
	{ id: 'payments', label: 'USDC payments', redemptions: 0, payments: 196 },
] as const

type PoolScenarioId = (typeof POOL_SCENARIOS)[number]['id']

const REFERRAL_CASES = [
	{ id: 'both', label: 'Both referrers recorded', missing: 0 },
	{ id: 'no-merchant', label: 'No merchant referrer', missing: 0.5 },
	{ id: 'no-consumer', label: 'No consumer referrer', missing: 0.1 },
	{ id: 'neither', label: 'No referrers', missing: 0.6 },
] as const

type ReferralCaseId = (typeof REFERRAL_CASES)[number]['id']

type PageView = 'rules' | 'allocation'

const FLOW_NODES = [
	{ label: 'Business\naction', Icon: Store },
	{ label: 'Paid\nB-Units', Icon: Layers },
	{ label: 'USDC\nrewards', Icon: Gift },
] as const

function useSlideOut(onClose: () => void) {
	const [isClosing, setIsClosing] = useState(false)
	const [isEntered, setIsEntered] = useState(false)
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [])
	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, SLIDE_MS)
	}, [isClosing, onClose])
	const transform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	return { close, slideStyle: { transform } as React.CSSProperties }
}

function PilotLabel({ children }: { children: React.ReactNode }) {
	return (
		<span
			className="inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-medium"
			style={{ backgroundColor: H.soft, color: H.blue }}
		>
			{children}
		</span>
	)
}

function StatLine({ label, value }: { label: string; value: string }) {
	return (
		<div
			className="flex items-start justify-between gap-3 border-b py-2.5 last:border-0 dark:border-slate-800"
			style={{ borderColor: H.line }}
		>
			<span className="text-[13px]" style={{ color: H.sub }}>
				{label}
			</span>
			<strong className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-[#182238] dark:text-slate-100">
				{value}
			</strong>
		</div>
	)
}

function SoftNotice({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="mt-4 rounded-xl px-3 py-3 text-[11px] leading-relaxed dark:bg-slate-800/80 dark:text-slate-300"
			style={{ backgroundColor: H.soft, color: H.sub }}
		>
			{children}
		</div>
	)
}

function SegmentButton({
	pressed,
	onClick,
	children,
}: {
	pressed: boolean
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			className={`rounded-[10px] px-3 py-2 text-[12px] font-medium transition ${
				pressed
					? 'bg-white text-[#182238] shadow-sm dark:bg-slate-700 dark:text-slate-100'
					: 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
			}`}
		>
			{children}
		</button>
	)
}

function GuideDetail({
	id,
	open,
	onToggle,
	icon: Icon,
	title,
	children,
}: {
	id: string
	open: boolean
	onToggle: () => void
	icon: LucideIcon
	title: string
	children: React.ReactNode
}) {
	return (
		<details
			id={id}
			open={open}
			onToggle={(e) => {
				const next = (e.currentTarget as HTMLDetailsElement).open
				if (next !== open) onToggle()
			}}
			className="mt-2.5 overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900"
			style={{ borderColor: H.line }}
		>
			<summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-4 text-[12px] font-medium text-[#182238] dark:text-slate-100 [&::-webkit-details-marker]:hidden">
				<span className="inline-flex items-center gap-2.5">
					<Icon className="h-4 w-4 shrink-0" style={{ color: H.blue }} strokeWidth={2.25} aria-hidden />
					{title}
				</span>
				<ChevronDown
					className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
					style={{ color: H.blue }}
					aria-hidden
				/>
			</summary>
			<div className="border-t px-3.5 py-4 dark:border-slate-700" style={{ borderColor: H.line }}>
				{children}
			</div>
		</details>
	)
}

/**
 * Across the network — Network contribution rewards explainer.
 * Layout aligned with sample `Beamio-Rewards-Hub 2` `rewardRules` / `roleCards` / `poolExample` / `allocation`.
 */
export default function NetworkContributionRewardsPage() {
	const navigate = useNavigate()
	const { setShowFooter } = useDaemonContext()
	const { close, slideStyle } = useSlideOut(() => navigate('/BountyBoard'))
	const calculationRef = useRef<HTMLDivElement | null>(null)

	const [view, setView] = useState<PageView>('rules')
	const [previewRole, setPreviewRole] = useState<NetworkRoleId>('merchant-referrer')
	const [poolScenario, setPoolScenario] = useState<PoolScenarioId>('redemptions')
	const [referralCase, setReferralCase] = useState<ReferralCaseId>('both')
	const [openGuide, setOpenGuide] = useState<string | null>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const role = useMemo(
		() => NETWORK_ROLES.find((r) => r.id === previewRole) ?? NETWORK_ROLES[0],
		[previewRole],
	)

	const scenario = useMemo(
		() => POOL_SCENARIOS.find((s) => s.id === poolScenario) ?? POOL_SCENARIOS[0],
		[poolScenario],
	)

	const referral = useMemo(
		() => REFERRAL_CASES.find((c) => c.id === referralCase) ?? REFERRAL_CASES[0],
		[referralCase],
	)

	const poolMath = useMemo(() => {
		const count = scenario.redemptions + scenario.payments
		const costs = count * 0.01 + 49 * 0.05
		const allocation = (49 - costs) * 0.3
		const retained = allocation * referral.missing
		const paid = allocation - retained
		const remaining = 14.7 - paid
		return { count, costs, allocation, retained, paid, remaining }
	}, [scenario, referral])

	const roleExampleUsdc = ((0.18 * role.balance) / 100).toFixed(4)

	const openCalculation = useCallback(() => {
		setOpenGuide('network-calculation')
		window.setTimeout(() => {
			calculationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}, 50)
	}, [])

	const onBack = useCallback(() => {
		if (view === 'allocation') {
			setView('rules')
			return
		}
		close()
	}, [view, close])

	const toggleGuide = useCallback((id: string) => {
		setOpenGuide((prev) => (prev === id ? null : id))
	}, [])

	return (
		<div
			className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#eef6ff] text-slate-900 transition-transform duration-300 ease-out dark:bg-slate-950 dark:text-slate-50"
			style={slideStyle}
			role="dialog"
			aria-modal="true"
			aria-label="Across the network"
		>
			<div
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom,0px))]"
				style={{ WebkitOverflowScrolling: 'touch', paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className="mx-auto w-full max-w-2xl">
					<div className={`relative flex items-center ${BEAMIO_CIRCULAR_BACK_ROW_CLASS}`}>
						<BeamioCircularBackButton
							variant="onLight"
							onClick={onBack}
							className="absolute left-0 top-0"
						/>
					</div>

					{view === 'allocation' ? (
						<AllocationRecordView onBackToRules={() => setView('rules')} />
					) : (
						<section className="network-guide pb-6" aria-label="Network contribution rewards">
							<header className="mb-[19px] pt-2">
								<PilotLabel>Across the network</PilotLabel>
								<h1 className="mt-3 text-[25px] font-semibold leading-[1.18] tracking-[-0.8px] text-[#182238] dark:text-slate-100">
									Network contribution
									<br />
									rewards
								</h1>
								<p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: H.sub }}>
									Business activity. Shared rewards.
								</p>
							</header>

							{/* Funding visual — sample `.funding-visual` */}
							<section
								className="rounded-[23px] border p-[19px] dark:border-slate-700"
								style={{
									borderColor: H.line,
									background: `linear-gradient(135deg, ${H.soft}, ${H.card})`,
								}}
								aria-label="Funding and distribution"
							>
								<div
									className="flex items-center gap-[17px] border-b pb-[18px] dark:border-slate-700"
									style={{ borderColor: H.line }}
								>
									<div
										className="shrink-0 whitespace-nowrap text-[48px] font-semibold leading-none tracking-[-2px]"
										style={{ color: H.blue }}
									>
										30<span className="text-[23px] tracking-[-0.5px]">%</span>
									</div>
									<div className="min-w-0">
										<h2 className="text-[13px] font-semibold leading-snug text-[#182238] dark:text-slate-100">
											Reserved for network rewards
										</h2>
										<p className="mt-1 text-[11px] leading-relaxed" style={{ color: H.sub }}>
											From each paid B-Units package purchase
										</p>
									</div>
								</div>

								<div
									className="grid grid-cols-3 gap-3.5 pt-[19px]"
									aria-label="Business action consumes paid service credits and generates a USDC reward"
								>
									{FLOW_NODES.map((node, i) => {
										const Icon = node.Icon
										return (
											<div key={node.label} className="relative text-center">
												<span
													className="mx-auto mb-2.5 grid h-[43px] w-[43px] place-items-center rounded-[14px] bg-white shadow-[0_3px_9px_rgba(36,65,109,0.09)] dark:bg-slate-800"
													style={{ color: H.blue }}
												>
													<Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
												</span>
												<strong className="block whitespace-pre-line text-[11px] font-medium leading-snug text-[#182238] dark:text-slate-100">
													{node.label}
												</strong>
												{i < FLOW_NODES.length - 1 ? (
													<span
														className="pointer-events-none absolute right-[-10px] top-3 text-[15px]"
														style={{ color: H.sub }}
														aria-hidden
													>
														→
													</span>
												) : null}
											</div>
										)
									})}
								</div>
								<p className="mt-[15px] text-center text-[11px]" style={{ color: H.sub }}>
									Shared when eligible activity settles.
								</p>
							</section>

							<div className="flex items-start gap-2.5 px-0.5 pt-[15px]">
								<Split
									className="mt-0.5 h-4 w-4 shrink-0"
									style={{ color: H.blue }}
									strokeWidth={2.25}
									aria-hidden
								/>
								<p className="text-[11px] leading-relaxed" style={{ color: H.sub }}>
									<strong className="mb-0.5 block font-medium text-[#182238] dark:text-slate-100">
										At each settlement
									</strong>
									30% of the paid service amount after direct costs is allocated by role.
								</p>
							</div>

							{/* Shared by contribution — sample `roleCards` */}
							<section className="mt-[23px]" aria-labelledby="role-choices-title">
								<div className="mb-1.5 flex items-end justify-between gap-3">
									<h2
										id="role-choices-title"
										className="text-[17px] font-semibold tracking-tight text-[#182238] dark:text-slate-100"
									>
										Shared by contribution
									</h2>
									<span className="shrink-0 text-[11px]" style={{ color: H.sub }}>
										Tap a role
									</span>
								</div>
								<p className="text-[13px]" style={{ color: H.sub }}>
									Share of each interaction’s reward allocation
								</p>

								<div
									className="mt-3.5 flex h-[9px] gap-[3px] overflow-hidden rounded-lg"
									role="img"
									aria-label="Merchant referrer 50 percent, consumer referrer 10 percent, consumer 20 percent, merchant 20 percent"
								>
									{NETWORK_ROLES.map((r) => (
										<span
											key={r.id}
											className="h-full rounded-sm"
											style={{ flex: r.pool, backgroundColor: r.bar }}
											title={`${r.label} · ${r.pool}%`}
										/>
									))}
								</div>

								<div
									className="mt-3.5 grid grid-cols-2 gap-2.5"
									role="group"
									aria-label="Allocation by role"
								>
									{NETWORK_ROLES.map((r) => {
										const pressed = r.id === role.id
										const Icon = r.Icon
										return (
											<button
												key={r.id}
												type="button"
												aria-pressed={pressed}
												onClick={() => setPreviewRole(r.id)}
												className="flex min-h-[110px] flex-col items-start gap-1.5 rounded-[17px] border px-3.5 py-3.5 text-left transition dark:border-slate-700 dark:bg-slate-900"
												style={{
													borderColor: pressed ? H.blue : H.line,
													backgroundColor: pressed ? H.soft : H.card,
												}}
											>
												<span
													className="mb-0.5 flex w-full items-center justify-between"
													style={{ color: H.blue }}
												>
													<Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
													<span className="text-[22px] font-semibold tracking-[-0.6px] tabular-nums">
														{r.pool}%
													</span>
												</span>
												<strong className="text-[12px] font-medium leading-snug text-[#182238] dark:text-slate-100">
													{r.label}
												</strong>
												<small className="text-[11px] leading-snug" style={{ color: H.sub }}>
													{r.contribution}
												</small>
											</button>
										)
									})}
								</div>

								<p
									className="mt-3.5 flex items-start gap-1.5 text-[11px] leading-relaxed"
									style={{ color: H.sub }}
									aria-live="polite"
								>
									<Check
										className="mt-0.5 h-3.5 w-3.5 shrink-0"
										style={{ color: H.blue }}
										strokeWidth={2.75}
										aria-hidden
									/>
									<span>
										{role.label} selected ·{' '}
										<button
											type="button"
											onClick={openCalculation}
											className="inline-flex items-center gap-1 font-medium"
											style={{ color: H.blue }}
										>
											See calculation
											<ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
										</button>
									</span>
								</p>
							</section>

							{/* No referrer notice — sample `.retention-visual` */}
							<aside
								className="mt-[17px] flex items-start gap-3 rounded-[18px] px-4 py-4 dark:bg-purple-950/40"
								style={{ backgroundColor: H.purpleBg }}
							>
								<span
									className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
									style={{ backgroundColor: 'rgba(134, 90, 182, 0.15)', color: H.purple }}
								>
									<RotateCcw className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h3 className="text-[12px] font-semibold leading-snug text-[#182238] dark:text-slate-100">
										No referrer? The share stays.
									</h3>
									<p className="mt-1 text-[11px] leading-relaxed" style={{ color: H.sub }}>
										Unassigned referral shares remain in the pool for future redistribution.
									</p>
								</div>
							</aside>

							{/* Explore the details — sample `.guide-details` */}
							<div className="mt-[25px]">
								<h2 className="mb-3 text-[13px] font-semibold text-[#182238] dark:text-slate-100">
									Explore the details
								</h2>

								<div ref={calculationRef}>
									<GuideDetail
										id="network-calculation"
										open={openGuide === 'network-calculation'}
										onToggle={() => toggleGuide('network-calculation')}
										icon={Calculator}
										title="Service fees & your share"
									>
										<p className="text-[12px] leading-relaxed" style={{ color: H.sub }}>
											The merchant pays the business action’s service fee in B-Units. Only eligible Paid
											B-Units usage generates cash rewards. Customer purchases and stored-value top-ups
											are separate.
										</p>
										<div className="my-3.5">
											{[
												['Redemption', '5 B-Units'],
												['Store Credit top-up', '20 B-Units'],
												['USDC direct payment', '25 B-Units'],
											].map(([label, value]) => (
												<div
													key={label}
													className="flex items-center justify-between gap-2.5 border-b py-2.5 text-[11px] dark:border-slate-700"
													style={{ borderColor: H.line }}
												>
													<span style={{ color: H.sub }}>{label}</span>
													<strong className="font-medium text-[#182238] dark:text-slate-100">
														{value}
													</strong>
												</div>
											))}
										</div>
										<p className="text-[11px] leading-relaxed" style={{ color: H.sub }}>
											Illustrative service rates. Actual fees and purchase terms apply.
										</p>
										<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
											Direct costs = 0.01 USDC per interaction + 5% of that interaction’s Paid B-Units
											service settlement amount. Customer purchases and stored-value top-up amounts are
											excluded from this cost base.
										</p>
										<h4 className="mt-[18px] text-[13px] font-semibold text-[#182238] dark:text-slate-100">
											One settlement · 0.20 USDC example
										</h4>
										<div className="mt-2">
											<StatLine label="Paid service settlement" value="0.2000 USDC" />
											<StatLine label="Direct costs · 0.01 + 0.20 × 5%" value="−0.0200 USDC" />
											<StatLine label="After direct costs" value="0.1800 USDC" />
											<StatLine label="Interaction reward allocation · 30%" value="0.0540 USDC" />
										</div>
										<div
											className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-3.5 py-3"
											style={{ backgroundColor: '#edf9f3', color: '#23805e' }}
										>
											<span className="text-[13px] font-medium">
												{role.label} · {role.pool}%
											</span>
											<strong className="text-[13px] font-semibold tabular-nums">
												{roleExampleUsdc} USDC
											</strong>
										</div>
										<p className="mt-3 text-[11px] leading-relaxed" style={{ color: H.sub }}>
											30% × {role.pool}% ={' '}
											<span className="font-medium" style={{ color: H.blue }}>
												{role.balance}%
											</span>{' '}
											of the service amount after direct costs. Your recorded role determines
											eligibility; selecting a card only previews the calculation.
										</p>
										<button
											type="button"
											onClick={() => setView('allocation')}
											className="mt-4 flex w-full items-center justify-between gap-3 rounded-[14px] border bg-white px-3.5 py-3 text-left text-[12px] font-medium transition hover:border-[#165ce9]/40 dark:border-slate-700 dark:bg-slate-800"
											style={{ borderColor: H.line, color: H.blue }}
										>
											View sample settlement record
											<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
										</button>
									</GuideDetail>
								</div>

								<GuideDetail
									id="network-package-example"
									open={openGuide === 'network-package-example'}
									onToggle={() => toggleGuide('network-package-example')}
									icon={LineChart}
									title="Explore a package example"
								>
									<p className="mb-2 text-[11px] font-medium" style={{ color: H.purple }}>
										Illustrative package · not an onboarding fee
									</p>
									<p className="text-[12px] leading-relaxed" style={{ color: H.sub }}>
										Businesses choose a service package for their needs. 49 USDC is one package option;
										it is not a required or universal onboarding charge. Merchants can onboard for free
										with the available free credits.
									</p>
									<div className="mt-4">
										<h4 className="text-[13px] font-semibold text-[#182238] dark:text-slate-100">
											49 USDC package · worked example
										</h4>
										<p className="mt-2 text-[12px] leading-relaxed" style={{ color: H.sub }}>
											All 4,900 Paid B-Units consumed. The package’s 245 bonus Free B-Units are
											excluded from this reward calculation.
										</p>

										<div
											className="mt-4 flex flex-wrap gap-1 rounded-[13px] p-1"
											style={{ backgroundColor: '#f1f3fa' }}
											role="group"
											aria-label="Service activity scenario"
										>
											{POOL_SCENARIOS.map((s) => (
												<SegmentButton
													key={s.id}
													pressed={s.id === scenario.id}
													onClick={() => setPoolScenario(s.id)}
												>
													{s.label}
												</SegmentButton>
											))}
										</div>

										<p className="mt-4 text-[12px]" style={{ color: H.sub }}>
											Example referral attribution
										</p>
										<div
											className="mt-2 flex flex-wrap gap-1 rounded-[13px] p-1"
											style={{ backgroundColor: '#f1f3fa' }}
											role="group"
											aria-label="Example referral attribution"
										>
											{REFERRAL_CASES.map((c) => (
												<SegmentButton
													key={c.id}
													pressed={c.id === referral.id}
													onClick={() => setReferralCase(c.id)}
												>
													{c.label}
												</SegmentButton>
											))}
										</div>

										<div className="mt-4" aria-live="polite">
											<StatLine
												label="Redemptions · 0.05 USDC each"
												value={String(scenario.redemptions)}
											/>
											<StatLine
												label="USDC payments · 0.25 USDC each"
												value={String(scenario.payments)}
											/>
											<StatLine label="Total service settlement" value="49.00 USDC" />
											<StatLine
												label={`Direct costs · ${poolMath.count} × 0.01 + 49 × 5%`}
												value={`${poolMath.costs.toFixed(2)} USDC`}
											/>
											<StatLine
												label="After direct costs"
												value={`${(49 - poolMath.costs).toFixed(2)} USDC`}
											/>
											<StatLine label="Added to pool at top-up" value="14.7000 USDC" />
											<StatLine
												label="Calculated interaction allocation · 30%"
												value={`${poolMath.allocation.toFixed(4)} USDC`}
											/>
											<div
												className="flex items-start justify-between gap-3 border-b py-3 text-[12px]"
												style={{ borderColor: H.line, color: H.purple }}
											>
												<span>Unassigned referral shares · retained</span>
												<strong className="shrink-0 font-medium tabular-nums">
													{poolMath.retained.toFixed(4)} USDC
												</strong>
											</div>
											<div
												className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-3.5 py-3"
												style={{ backgroundColor: '#edf9f3', color: '#23805e' }}
											>
												<span className="text-[13px] font-medium">Actually distributed to recipients</span>
												<strong className="text-[13px] font-semibold tabular-nums">
													{poolMath.paid.toFixed(4)} USDC
												</strong>
											</div>
											<div
												className="mt-3 rounded-2xl px-4 py-4 text-center"
												style={{ backgroundColor: H.soft }}
											>
												<p className="text-[12px] font-medium" style={{ color: H.sub }}>
													Remaining in the network reward pool
												</p>
												<p
													className="mt-1 text-[28px] font-semibold tabular-nums"
													style={{ color: H.blue }}
												>
													{poolMath.remaining.toFixed(4)} USDC
												</p>
												<p className="mt-2 text-[12px] leading-relaxed" style={{ color: H.sub }}>
													Includes {poolMath.retained.toFixed(4)} USDC in unassigned referral shares,
													retained for future redistribution.
												</p>
											</div>
										</div>

										<p className="mt-4 text-[13px] font-medium text-[#182238] dark:text-slate-200">
											Pool balance = contributions − rewards actually distributed − campaign rewards.
										</p>
										<p className="mt-2 text-[11px] leading-relaxed" style={{ color: H.sub }}>
											Pure fee example: one CoNET interaction per action. Excludes free-credit usage
											costs, discounts, refunds and campaign payouts. Actual settlement follows
											purchase-batch value and precision rules.
										</p>
									</div>
								</GuideDetail>

								<GuideDetail
									id="network-pool-rules"
									open={openGuide === 'network-pool-rules'}
									onToggle={() => toggleGuide('network-pool-rules')}
									icon={RotateCcw}
									title="Pool balances & redistribution"
								>
									<p className="text-[12px] leading-relaxed" style={{ color: H.sub }}>
										The pool is a shared reward budget, not a personal balance you can claim. Only
										rewards distributed to you count as received income; campaign rewards follow their
										own eligibility and payout rules.
									</p>
									<div className="mt-3">
										<StatLine label="No merchant referrer" value="50% stays in pool" />
										<StatLine label="No consumer referrer" value="10% stays in pool" />
									</div>
									<p className="mt-2 text-[11px] leading-relaxed" style={{ color: H.sub }}>
										Percentages above refer to the interaction reward allocation. If both referrers are
										missing, 60% stays in the pool. Other eligible roles retain their original shares.
									</p>
									<div
										className="my-4 flex items-start gap-2.5 rounded-xl px-3 py-3"
										style={{ backgroundColor: H.soft }}
									>
										<BadgeCheck
											className="mt-0.5 h-4 w-4 shrink-0"
											style={{ color: H.blue }}
											strokeWidth={2.25}
											aria-hidden
										/>
										<p className="text-[11px] leading-relaxed" style={{ color: H.sub }}>
											<strong className="mb-1.5 block font-medium text-[#182238] dark:text-slate-100">
												Keep service reserves protected
											</strong>
											Unused Paid B-Units and triggered but unsettled rewards must remain fully covered.
											Only unassigned shares and available surplus may be redistributed.
										</p>
									</div>
									<p className="text-[12px] leading-relaxed" style={{ color: H.sub }}>
										The pool reserves 30% of paid B-Units package purchases, while interaction rewards
										use 30% of service amounts after direct costs. This difference, together with
										unassigned referral shares, remains in the pool.
									</p>
									<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
										Retained funds are unallocated network rewards. They are not company profit or
										personal earned income. Future distributions follow published contribution and
										campaign rules.
									</p>
								</GuideDetail>

								<GuideDetail
									id="network-eligibility"
									open={openGuide === 'network-eligibility'}
									onToggle={() => toggleGuide('network-eligibility')}
									icon={BadgeCheck}
									title="Eligibility & allocation terms"
								>
									<p className="text-[12px] leading-relaxed" style={{ color: H.sub }}>
										These allocation rules apply across regions. A package purchase reserves a budget; it
										does not immediately pay individual network rewards. Individual rewards arise from
										qualifying activity at settlement. Daily and monthly totals are summaries, not
										additional payout triggers.
									</p>
									<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
										Free B-Units generate no cash distribution. Actual Paid service revenue follows the
										consumed credits’ purchase batch, including applicable discounts and bonuses.
									</p>
									<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
										Merchant-funded offers, Reward PT and one-time onboarding or day-60 awards are
										accounted for separately. Campaigns have their own allocation rules.
									</p>
									<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
										Recorded attribution, account ownership, applicable eligibility, refunds, reversals
										and settlement precision follow published and agreed terms.
									</p>
								</GuideDetail>
							</div>
						</section>
					)}
				</div>
			</div>
		</div>
	)
}

/** Sample `allocation()` — illustrative settlement record. */
function AllocationRecordView({ onBackToRules }: { onBackToRules: () => void }) {
	return (
		<>
			<header className="pb-5 pt-2">
				<PilotLabel>Illustrative settlement record</PilotLabel>
				<h1 className="mt-2.5 text-[22px] font-semibold leading-tight tracking-[-0.6px] text-[#182238] dark:text-slate-100">
					Network allocation
				</h1>
			</header>

			<div
				className="rounded-[21px] border bg-white p-[17px] shadow-[0_4px_13px_rgba(36,65,109,0.035)] dark:border-slate-700 dark:bg-slate-900"
				style={{ borderColor: H.line }}
			>
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-[15px] font-semibold text-[#182238] dark:text-slate-100">
						Store Credit top-up
					</h2>
					<span className="rounded-full bg-[#edf9f3] px-3 py-1 text-[12px] font-medium text-[#23805e]">
						Distributed
					</span>
				</div>
				<p className="mt-2 text-[13px]" style={{ color: H.sub }}>
					Maple Kitchen · Oct 20, 10:42:18 AM
				</p>
				<p
					className="mt-4 inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-medium"
					style={{ backgroundColor: H.soft, color: H.blue }}
				>
					Merchant referrer
				</p>
				<p className="mt-2 text-[28px] font-semibold tabular-nums" style={{ color: H.blue }}>
					+0.0270 <span className="text-[14px] font-normal">USDC received</span>
				</p>
				<div className="mt-3">
					<StatLine label="Interaction ID" value="DEMO-OP-042" />
					<StatLine label="When allocated" value="At interaction settlement" />
					<StatLine label="Applied role share" value="30% × 50% = 15%" />
				</div>
			</div>

			<SoftNotice>
				Example attribution: merchant referrer recorded; no consumer referrer. The unassigned
				consumer-referrer share remains in the network reward pool.
			</SoftNotice>

			<h2 className="mt-8 text-[17px] font-semibold tracking-tight text-[#182238] dark:text-slate-100">
				Service fee &amp; reward calculation
			</h2>
			<div
				className="mt-3 rounded-[21px] border bg-white p-[17px] shadow-[0_4px_13px_rgba(36,65,109,0.035)] dark:border-slate-700 dark:bg-slate-900"
				style={{ borderColor: H.line }}
			>
				<StatLine label="Service fee paid by" value="Merchant · Maple Kitchen" />
				<StatLine label="Paid B-Units charged" value="20 B-Units" />
				<StatLine label="Paid B-Units service settlement" value="0.2000 USDC" />
				<StatLine label="Direct costs · 0.01 + 0.20 × 5%" value="−0.0200 USDC" />
				<StatLine label="Distributable balance" value="0.1800 USDC" />
				<StatLine label="Interaction reward allocation · 30%" value="0.0540 USDC" />
				<StatLine label="Total paid to recorded recipients" value="0.0486 USDC" />
				<div
					className="flex items-start justify-between gap-3 border-b py-3 text-[12px]"
					style={{ borderColor: H.line, color: H.purple }}
				>
					<span>No consumer referrer · retained in pool</span>
					<strong className="shrink-0 font-medium tabular-nums">0.0054 USDC</strong>
				</div>
				<div
					className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
					style={{ backgroundColor: '#edf9f3', color: '#23805e' }}
				>
					<span className="text-[13px] font-medium">My reward · 50% of interaction allocation</span>
					<strong className="text-[15px] font-semibold tabular-nums">0.0270 USDC</strong>
				</div>
			</div>

			<p className="mt-3 text-[12px] leading-relaxed" style={{ color: H.sub }}>
				The merchant pays the B-Units service fee. Your USDC reward is paid from the network contribution
				reward pool. This example values 20 Paid B-Units at 0.2000 USDC; actual value follows their
				purchase batch, including bonuses and discounts. The customer’s stored-value top-up amount is
				excluded.
			</p>

			<SoftNotice>
				Daily and monthly figures summarize settled records. They do not trigger another allocation.
			</SoftNotice>

			<button
				type="button"
				onClick={onBackToRules}
				className="mb-6 mt-4 flex w-full items-center justify-between gap-3 rounded-[18px] border bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[#165ce9]/40 dark:border-slate-700 dark:bg-slate-900"
				style={{ borderColor: H.line }}
			>
				<span className="min-w-0">
					<strong className="block text-[14px] font-semibold text-[#182238] dark:text-slate-100">
						View roles &amp; calculation rules
					</strong>
					<small className="mt-0.5 block text-[12px]" style={{ color: H.sub }}>
						Back to network contribution rewards
					</small>
				</span>
				<ChevronRight className="h-5 w-5 shrink-0" style={{ color: H.blue }} aria-hidden />
			</button>
		</>
	)
}
