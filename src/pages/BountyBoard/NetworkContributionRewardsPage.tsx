import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Building2,
	Check,
	ChevronRight,
	CheckCircle,
	Network,
	Store,
	UserRound,
	Users,
} from 'lucide-react'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'

const SLIDE_MS = 300

const NETWORK_ROLES = [
	{ id: 'merchant-referrer', label: 'Merchant referrer', pool: 50, balance: 15, Icon: Store },
	{ id: 'consumer-referrer', label: 'Consumer referrer', pool: 10, balance: 3, Icon: Users },
	{ id: 'consumer', label: 'Consumer', pool: 20, balance: 6, Icon: UserRound },
	{ id: 'merchant', label: 'Merchant', pool: 20, balance: 6, Icon: Building2 },
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

const FAQ_ITEMS: { summary: string; body: string }[] = [
	{
		summary: 'Is the pool balance a reward I can claim?',
		body: 'The pool is a shared reward budget, not a personal balance. Only rewards distributed to you count as received income. Campaign rewards follow their own eligibility and payout rules.',
	},
	{
		summary: 'Does a top-up pay rewards immediately?',
		body: 'A paid B-Units top-up funds the pool; it does not pay individual network rewards. Interaction rewards are calculated and distributed when eligible paid service activity settles. Daily and monthly totals only summarize those records.',
	},
	{
		summary: 'How are direct costs calculated?',
		body: 'Direct costs = 0.01 USDC per interaction + 5% of that interaction’s Paid B-Units service settlement amount. This calculation uses the service amount, not the customer’s purchase or stored-value top-up amount.',
	},
	{
		summary: 'What happens when there is no referrer?',
		body: 'If no merchant referrer is recorded, the 50% merchant-referrer share stays in the network reward pool. If no consumer referrer is recorded, the 10% consumer-referrer share stays there. If neither exists, both shares remain in the pool for future redistribution. Other recipients keep their original shares; they do not automatically receive the unassigned portion.',
	},
	{
		summary: 'Why does money remain in the pool?',
		body: 'The pool receives 30% of paid B-Units top-ups, while interaction rewards use 30% of service amounts after direct costs. The difference and any unassigned referral shares stay in the pool. Unused service credits still require a reward reserve; the remainder after consumption supports future contributor campaigns.',
	},
	{
		summary: 'Do Free B-Units generate distributions?',
		body: 'No. Complimentary credits generate no cash distribution. Paid usage is valued at the consideration attributable to the consumed credits’ purchase batch, including package bonuses and discounts.',
	},
	{
		summary: 'Who pays the B-Units service fee?',
		body: 'The fee for a business action is charged to the merchant’s B-Units account when that action settles. A reward record shows the merchant, Paid B-Units consumed, service settlement amount, direct costs and your allocation. B-Units are service credits; your received reward is shown in USDC.',
	},
	{
		summary: 'Which top-ups are included?',
		body: 'The pool contribution applies to merchant paid B-Units top-ups. Customer stored-value top-ups and purchases are separate. Merchant-funded referral offers, Reward PT and one-time partner awards follow their own rules.',
	},
	{
		summary: 'Which allocation terms apply?',
		body: 'These role weights apply across all regions. Recorded attribution, applicable published or signed terms, eligibility and account ownership determine each allocation. Campaign rewards do not automatically use the per-interaction role weights.',
	},
]

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

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="mt-8 text-[17px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">{children}</h2>
	)
}

function StatLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
	return (
		<div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
			<span className={`text-[13px] ${muted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
				{label}
			</span>
			<strong className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-[#0F172A] dark:text-slate-100">
				{value}
			</strong>
		</div>
	)
}

function ChipButton({
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
			className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
				pressed
					? 'bg-[#1562f0] text-white shadow-sm'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
			}`}
		>
			{children}
		</button>
	)
}

/**
 * Across the network — Network contribution rewards explainer.
 * Secondary page: hide Footer, circular back onLight, slide from right 300ms.
 */
export default function NetworkContributionRewardsPage() {
	const navigate = useNavigate()
	const { setShowFooter } = useDaemonContext()
	const { close, slideStyle } = useSlideOut(() => navigate('/BountyBoard'))

	const [previewRole, setPreviewRole] = useState<NetworkRoleId>('merchant-referrer')
	const [poolScenario, setPoolScenario] = useState<PoolScenarioId>('redemptions')
	const [referralCase, setReferralCase] = useState<ReferralCaseId>('both')

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
							onClick={close}
							className="absolute left-0 top-0"
						/>
					</div>

					<header className="pb-5 pt-2">
						<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
							Across the network
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
							Network contribution rewards
						</h1>
						<p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
							Merchants pay service fees in B-Units. Eligible activity turns those fees into contribution
							rewards.
						</p>
					</header>

					{/* Funded at top-up */}
					<section
						className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
						aria-label="How the network reward pool works"
					>
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-[16px] font-bold text-[#0F172A] dark:text-slate-100">Funded at top-up</h2>
							<span className="shrink-0 rounded-full bg-[#e9edff] px-3 py-1 text-[12px] font-semibold text-[#0051d1]">
								30% to the pool
							</span>
						</div>
						<p className="mt-4 text-[36px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F172A] dark:text-slate-100">
							14.70 <span className="text-[20px] font-bold text-slate-500">USDC</span>
						</p>
						<p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
							From a 49 USDC paid B-Units top-up
						</p>
						<ol className="mt-5 space-y-4">
							{[
								{
									n: '1',
									title: 'Top up paid B-Units',
									body: '30% of the top-up amount is allocated to the network contribution reward pool.',
								},
								{
									n: '2',
									title: 'Merchant activity earns contribution rewards',
									body: 'When an eligible business action settles, its B-Units service fee is charged to the merchant. 30% of the service amount after direct costs is shared among eligible roles.',
								},
								{
									n: '3',
									title: 'Keep the rewards circulating',
									body: 'Unassigned referral shares stay in the pool for future redistribution. Funds left after service credits are consumed also support future contributor rewards.',
								},
							].map((step) => (
								<li key={step.n} className="flex gap-3">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-[12px] font-bold text-white">
										{step.n}
									</span>
									<div className="min-w-0">
										<p className="text-[14px] font-semibold text-[#0F172A] dark:text-slate-100">
											{step.title}
										</p>
										<p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
											{step.body}
										</p>
									</div>
								</li>
							))}
						</ol>
					</section>

					<div className="mt-4 rounded-[20px] border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
						Merchant service fees fund interaction rewards. The calculation uses the B-Units service amount,
						not the customer’s purchase or stored-value balance.
					</div>

					{/* Role shares */}
					<section aria-labelledby="role-choices-title" className="mt-2">
						<SectionHeading>How each role shares</SectionHeading>
						<p id="role-choices-title" className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
							Choose a role to see its share of each interaction’s reward allocation.
						</p>
						<div
							className="mt-4 grid grid-cols-2 gap-3"
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
										className={`relative flex flex-col items-start rounded-[20px] border p-4 text-left transition ${
											pressed
												? 'border-[#1562f0] bg-[#e9edff] shadow-sm dark:border-blue-400 dark:bg-blue-950/40'
												: 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
										}`}
									>
										<span
											className={`relative flex h-10 w-10 items-center justify-center rounded-2xl ${
												pressed
													? 'bg-[#1562f0] text-white'
													: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
											}`}
										>
											<Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
											{pressed ? (
												<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
													<CheckCircle className="h-3 w-3" strokeWidth={3} aria-hidden />
												</span>
											) : null}
										</span>
										<strong className="mt-3 text-[14px] font-semibold text-[#0F172A] dark:text-slate-100">
											{r.label}
										</strong>
										<span className="mt-1 text-[20px] font-extrabold tabular-nums text-[#1562f0]">
											{r.pool}%
										</span>
										<small className="mt-0.5 text-[11px] font-medium text-slate-400">
											of the interaction allocation
										</small>
									</button>
								)
							})}
						</div>

						<div
							className="mt-4 flex items-center justify-between gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900"
							aria-live="polite"
						>
							<div className="min-w-0">
								<h3 className="text-[15px] font-bold text-[#0F172A] dark:text-slate-100">{role.label}</h3>
								<p className="mt-1 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
									Equivalent share of the service amount
									<br />
									after direct costs
								</p>
							</div>
							<strong className="shrink-0 text-[32px] font-extrabold tabular-nums text-[#1562f0]">
								{role.balance}%
							</strong>
						</div>

						<p className="mt-3 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
							30% interaction allocation × {role.pool}% role share = {role.balance}%. If a referrer is not
							recorded, that share stays in the network reward pool for future redistribution. Other role
							shares remain unchanged. This preview does not change your eligibility.
						</p>

						<details className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
							<summary className="cursor-pointer list-none px-5 py-3.5 text-[14px] font-semibold text-[#0F172A] dark:text-slate-100 [&::-webkit-details-marker]:hidden">
								<span className="inline-flex w-full items-center justify-between gap-2">
									See a 0.20 USDC settlement example
									<ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
								</span>
							</summary>
							<div className="border-t border-slate-100 px-5 pb-4 pt-1 dark:border-slate-800">
								<StatLine label="Paid service settlement" value="0.2000 USDC" />
								<StatLine label="Direct costs · 0.01 + 0.20 × 5%" value="−0.0200 USDC" />
								<StatLine label="Amount after direct costs" value="0.1800 USDC" />
								<StatLine label="Interaction reward allocation · 30%" value="0.0540 USDC" />
								<div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#e9edff] px-4 py-3 dark:bg-blue-950/50">
									<span className="text-[13px] font-semibold text-[#0051d1]">
										{role.label} · {role.pool}%
									</span>
									<strong className="text-[15px] font-bold tabular-nums text-[#0051d1]">
										{roleExampleUsdc} USDC
									</strong>
								</div>
								<p className="mt-3 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
									Rewards are paid from the network reward pool. Any share without a recorded merchant
									or consumer referrer stays in the pool for future redistribution.
								</p>
							</div>
						</details>
					</section>

					{/* Pool example */}
					<section className="mt-2" aria-labelledby="pool-example-title">
						<SectionHeading>Follow the pool balance</SectionHeading>
						<div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<h3
								id="pool-example-title"
								className="text-[16px] font-bold text-[#0F172A] dark:text-slate-100"
							>
								One top-up. Different activity.
							</h3>
							<p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
								49 USDC in paid service credits, fully consumed. Compare activity and referral
								attribution.
							</p>

							<div
								className="mt-4 flex flex-wrap gap-2"
								role="group"
								aria-label="Service activity scenario"
							>
								{POOL_SCENARIOS.map((s) => (
									<ChipButton
										key={s.id}
										pressed={s.id === scenario.id}
										onClick={() => setPoolScenario(s.id)}
									>
										{s.label}
									</ChipButton>
								))}
							</div>

							<p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
								Example referral attribution
							</p>
							<div
								className="mt-2 flex flex-wrap gap-2"
								role="group"
								aria-label="Example referral attribution"
							>
								{REFERRAL_CASES.map((c) => (
									<ChipButton
										key={c.id}
										pressed={c.id === referral.id}
										onClick={() => setReferralCase(c.id)}
									>
										{c.label}
									</ChipButton>
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
								<div className="flex items-start justify-between gap-3 border-b border-amber-100 py-2.5 dark:border-amber-900/40">
									<span className="text-[13px] text-amber-700 dark:text-amber-300">
										Unassigned referral shares · retained
									</span>
									<strong className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-amber-800 dark:text-amber-200">
										{poolMath.retained.toFixed(4)} USDC
									</strong>
								</div>
								<div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#e9edff] px-4 py-3 dark:bg-blue-950/50">
									<span className="text-[13px] font-semibold text-[#0051d1]">
										Actually distributed to recipients
									</span>
									<strong className="text-[15px] font-bold tabular-nums text-[#0051d1]">
										{poolMath.paid.toFixed(4)} USDC
									</strong>
								</div>
								<div className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-center dark:bg-slate-800/60">
									<p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
										Remaining in the network reward pool
									</p>
									<p className="mt-1 text-[28px] font-extrabold tabular-nums text-[#0F172A] dark:text-slate-100">
										{poolMath.remaining.toFixed(4)} USDC
									</p>
									<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
										Includes {poolMath.retained.toFixed(4)} USDC in unassigned referral shares,
										retained for future redistribution.
									</p>
								</div>
							</div>

							<p className="mt-4 text-[13px] font-medium text-slate-600 dark:text-slate-300">
								Pool balance = contributions − rewards actually distributed − campaign rewards.
							</p>
							<p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
								Illustrative attribution only. No campaign rewards have been paid in these examples.
								Unused service credits still require a reserve for future interaction rewards.
							</p>
						</div>
					</section>

					{/* FAQ */}
					<section className="mt-8 pb-6" aria-label="Frequently asked questions">
						<div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
							{FAQ_ITEMS.map((item, i) => (
								<details
									key={item.summary}
									className={`group ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
								>
									<summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-semibold text-[#0F172A] dark:text-slate-100 [&::-webkit-details-marker]:hidden">
										<span className="inline-flex w-full items-center justify-between gap-3">
											{item.summary}
											<ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
										</span>
									</summary>
									<p className="px-5 pb-4 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
										{item.body}
									</p>
								</details>
							))}
						</div>
					</section>

					{/* Decorative network mark — matches capsule affordance */}
					<div className="mb-4 flex items-center justify-center gap-2 text-slate-400" aria-hidden>
						<span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1562f0]">
							<Network className="h-4 w-4" strokeWidth={2.25} />
						</span>
						<span className="flex items-center gap-1 text-[12px] font-medium">
							<Check className="h-3.5 w-3.5 text-emerald-500" />
							Network contribution rewards
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
