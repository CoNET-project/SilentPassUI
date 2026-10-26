import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
	ArrowDown,
	ArrowLeftRight,
	ArrowRight,
	BadgeCheck,
	Calculator,
	CalendarCheck,
	CalendarDays,
	CheckCheck,
	ChevronDown,
	ChevronRight,
	CreditCard,
	ExternalLink,
	FileCheck2,
	FileText,
	Info,
	KeyRound,
	Layers,
	ListChecks,
	MapPin,
	MousePointer2,
	Plus,
	QrCode,
	RefreshCw,
	Repeat2,
	Route,
	ScanLine,
	ShieldCheck,
	Sparkles,
	Store,
	Ticket,
	UserRoundPlus,
	Users,
	type LucideIcon,
} from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import { pickMerchantCardListTitle } from '@/utils/merchantCardDatabase'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { registerMerchantUnderAgent, registerTempUnderAgent } from '@/utils/agentReferrerRegistryClient'
import { AgentTempAccountStates } from '@/pages/BountyBoard/AgentTempAccountStates'
import {
	isHiddenFromAgentInviteSheet,
	listTempMerchantCards,
	loadAgentTempAccounts,
	type AgentTempAccount,
	type AgentTempMerchantCard,
} from '@/utils/agentBusinessWorkspace'

const M_PURPLE = '#8b3e91'
const M_SOFT = '#f6edf9'
const MERCHANT_OS_AGENT_URL = 'https://biz.beamio.app/biz/'

type PanelView = 'main' | 'partnerPlan' | 'manage'
type EssentialsKey = 'fees' | 'packages' | 'calc' | null

type CardsState = {
	loading: boolean
	rows: AgentTempMerchantCard[]
	error?: string
}

const FEE_ROWS: { label: string; fee: string; note: string; Icon: LucideIcon }[] = [
	{ label: 'Direct USDC settlement', fee: '25', note: 'Per transaction', Icon: ArrowLeftRight },
	{ label: 'Stored-value / membership top-up', fee: '20', note: 'Per transaction', Icon: CreditCard },
	{
		label: 'Spending deduction, Reward PT exchange, coupon claim or redemption',
		fee: '5',
		note: 'Per transaction',
		Icon: ScanLine,
	},
	{ label: 'Coupon issuance', fee: '100', note: 'Per coupon', Icon: Ticket },
	{ label: 'Coupon redemption-code issuance', fee: '10', note: 'Per batch · up to 100 codes', Icon: QrCode },
	{ label: 'Social action', fee: '0.1', note: 'Per action', Icon: MousePointer2 },
]

function formatBUnitCount(raw: string): string {
	const n = Number(String(raw).replace(/,/g, ''))
	if (!Number.isFinite(n)) return raw
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function EssentialsFinePrint({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
			<summary className="cursor-pointer list-none text-[11px] leading-relaxed text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden">
				{title}
			</summary>
			<div className="mt-2.5 space-y-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{children}</div>
		</details>
	)
}

const H_BLUE = '#165ce9'
const H_SOFT = '#eef3ff'

function PartnerDetail({
	icon: Icon,
	title,
	children,
}: {
	icon: LucideIcon
	title: string
	children: React.ReactNode
}) {
	return (
		<details className="group border-t border-slate-200/80 dark:border-slate-800">
			<summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[11px] text-slate-500 marker:content-none dark:text-slate-400 [&::-webkit-details-marker]:hidden">
				<span className="flex items-center gap-2">
					<Icon className="h-[15px] w-[15px] shrink-0" style={{ color: H_BLUE }} strokeWidth={2.25} aria-hidden />
					{title}
				</span>
				<ChevronDown
					className="h-[15px] w-[15px] shrink-0 transition group-open:rotate-180"
					style={{ color: H_BLUE }}
					aria-hidden
				/>
			</summary>
			<div className="space-y-3 pb-3.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{children}</div>
		</details>
	)
}

/** Each path totals the $100 onboarding cap. Amounts are USDC. */
const ONBOARDING_AWARD_PATHS: { buy: string; award: string }[][] = [
	[
		{ buy: '49', award: '40' },
		{ buy: '49', award: '40' },
		{ buy: '49', award: '20' },
	],
	[
		{ buy: '49', award: '40' },
		{ buy: '199', award: '60' },
	],
	[{ buy: '199+', award: '100' }],
]

/** Price + total B-Units only — no Paid/Free split (beamio-fuel-pack-display-no-paid-free). */
const PACKAGE_ROWS: { name: string; priceUsdc: string; totalBUnits: string; badge?: string }[] = [
	{ name: 'Start Kit', priceUsdc: '49', totalBUnits: '5,145', badge: 'First-time' },
	{ name: 'Growth', priceUsdc: '199', totalBUnits: '21,890', badge: 'Best value' },
	{ name: 'Scale', priceUsdc: '999', totalBUnits: '114,885' },
	{ name: 'Enterprise', priceUsdc: '4,999', totalBUnits: '599,880' },
]

function visibleCards(rows: AgentTempMerchantCard[]): AgentTempMerchantCard[] {
	return rows.filter((row) => !isHiddenFromAgentInviteSheet(row.cardAddress))
}

function accountReady(rows: AgentTempMerchantCard[] | undefined): boolean {
	return visibleCards(rows ?? []).some((row) => !row.transferred)
}

function accountClaimed(rows: AgentTempMerchantCard[] | undefined): boolean {
	const list = visibleCards(rows ?? [])
	return list.length > 0 && list.every((row) => row.transferred)
}

function primaryManageableCard(rows: AgentTempMerchantCard[] | undefined): AgentTempMerchantCard | null {
	return visibleCards(rows ?? []).find((row) => !row.transferred) ?? null
}

export function MerchantsBusinessPanel({
	agentTag,
	agentEoa,
	tempsRefreshKey,
	onBack,
	onCreateTemporary,
	onViewAllocationRules,
}: {
	agentTag: string
	agentEoa: string
	/** Bump when AgentBusinessInviteSheet closes so the list reloads. */
	tempsRefreshKey: number
	onBack: () => void
	onCreateTemporary: () => void
	onViewAllocationRules: () => void
}) {
	const [view, setView] = useState<PanelView>('main')
	const [essentialsOpen, setEssentialsOpen] = useState<EssentialsKey>(null)
	const [temps, setTemps] = useState<AgentTempAccount[]>([])
	const [selectedEoa, setSelectedEoa] = useState('')
	const [cardsByTemp, setCardsByTemp] = useState<Record<string, CardsState>>({})
	const { resolveName, registerCardAddresses } = useMerchantCardDatabase()

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

	const refreshCards = useCallback(async (temp: AgentTempAccount) => {
		const key = temp.eoa.toLowerCase()
		setCardsByTemp((prev) => ({
			...prev,
			[key]: { loading: true, rows: prev[key]?.rows ?? [] },
		}))
		try {
			const rows = await listTempMerchantCards(temp.eoa)
			setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
			for (const row of rows) {
				if (!row.transferred || !row.owner) continue
				void registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa).catch(() => undefined)
			}
		} catch {
			setCardsByTemp((prev) => ({
				...prev,
				[key]: {
					loading: false,
					rows: prev[key]?.rows ?? [],
					error: 'Could not load merchant cards',
				},
			}))
		}
	}, [])

	useEffect(() => {
		if (!agentEoa || temps.length === 0) return
		let cancelled = false
		for (const temp of temps) {
			const key = temp.eoa.toLowerCase()
			void registerTempUnderAgent(temp.eoa).catch(() => undefined)
			setCardsByTemp((prev) => ({
				...prev,
				[key]: { loading: true, rows: prev[key]?.rows ?? [] },
			}))
			void listTempMerchantCards(temp.eoa)
				.then((rows) => {
					if (cancelled) return
					setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
					for (const row of rows) {
						if (!row.transferred || !row.owner) continue
						void registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa).catch(
							() => undefined,
						)
					}
				})
				.catch(() => {
					if (cancelled) return
					setCardsByTemp((prev) => ({
						...prev,
						[key]: {
							loading: false,
							rows: prev[key]?.rows ?? [],
							error: prev[key]?.rows?.length ? undefined : 'Could not load merchant cards',
						},
					}))
				})
		}
		return () => {
			cancelled = true
		}
	}, [temps, agentEoa, tempsRefreshKey])

	const selectedTemp = useMemo(
		() => temps.find((t) => t.eoa.toLowerCase() === selectedEoa.toLowerCase()) ?? null,
		[temps, selectedEoa],
	)

	const selectedCards = selectedTemp
		? cardsByTemp[selectedTemp.eoa.toLowerCase()]
		: undefined
	const claimed = accountClaimed(selectedCards?.rows)

	useEffect(() => {
		const addrs = Object.values(cardsByTemp).flatMap((s) => s.rows.map((r) => r.cardAddress))
		if (addrs.length === 0) return
		registerCardAddresses(addrs)
	}, [cardsByTemp, registerCardAddresses])

	const agentLabel = useMemo(() => {
		const tag = agentTag.replace(/^@/, '').trim()
		return tag ? `Agent · @${tag}` : 'Agent'
	}, [agentTag])

	const toggleEssentials = (key: Exclude<EssentialsKey, null>) => {
		setEssentialsOpen((prev) => (prev === key ? null : key))
	}

	const openManage = (temp: AgentTempAccount) => {
		setSelectedEoa(temp.eoa)
		setView('manage')
		void refreshCards(temp)
	}

	const panelBack = (
		title: string,
		onBackClick: () => void,
	) => (
		<div className="relative flex items-center justify-between">
			<BeamioCircularBackButton variant="onLight" onClick={onBackClick} aria-label="Back" />
			<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
				{title}
			</h1>
			<span className="h-9 w-9 shrink-0" aria-hidden />
		</div>
	)

	if (view === 'partnerPlan') {
		return (
			<div className="space-y-0 pb-6">
				<div className="relative mb-2 flex items-center">
					<BeamioCircularBackButton variant="onLight" onClick={() => setView('main')} aria-label="Back" />
				</div>
				<header className="mb-[19px] pt-6">
					<span
						className="inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-medium"
						style={{ backgroundColor: H_SOFT, color: H_BLUE }}
					>
						One-time awards
					</span>
					<h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50">
						One-time partner awards
					</h2>
					<p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
						Help a business launch. Support real usage.
					</p>
				</header>

				<section className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-[#f6edf9] to-white px-4 pb-3.5 pt-5 text-center dark:border-slate-700 dark:from-[#392a45] dark:to-slate-900">
					<p className="text-[12px]" style={{ color: M_PURPLE }}>
						Up to
					</p>
					<p className="mt-1 text-[48px] font-semibold leading-none tracking-tight" style={{ color: M_PURPLE }}>
						$200 <span className="text-[17px] font-medium tracking-normal">USDC</span>
					</p>
					<p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Per qualifying business location</p>
					<div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-200/80 py-4 dark:border-slate-700">
						<div className="min-w-0 flex-1">
							<strong className="block text-[16px] font-medium text-slate-900 dark:text-slate-100">Up to $100</strong>
							<span className="mt-1.5 block text-[11px] text-slate-500 dark:text-slate-400">Paid onboarding</span>
						</div>
						<span className="text-[19px]" style={{ color: M_PURPLE }} aria-hidden>
							+
						</span>
						<div className="min-w-0 flex-1">
							<strong className="block text-[16px] font-medium text-slate-900 dark:text-slate-100">$100</strong>
							<span className="mt-1.5 block text-[11px] text-slate-500 dark:text-slate-400">Day-60 milestone</span>
						</div>
					</div>
					<p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
						For enrolled partners · eligibility applies
					</p>
				</section>

				<section className="mt-[17px] rounded-[21px] border border-slate-200/90 bg-white px-3.5 py-4 dark:border-slate-700 dark:bg-slate-900">
					<div className="mb-[18px] flex items-center gap-2.5">
						<span
							className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
							style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
						>
							<Store className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
						</span>
						<div className="min-w-0">
							<h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">Paid onboarding</h3>
							<p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								One allowance per qualifying location
							</p>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-6 px-1.5 pb-1 text-[11px] text-slate-500 dark:text-slate-400">
						<span>Business buys</span>
						<span>Partner award</span>
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)_19px_minmax(0,1fr)] items-center gap-1.5 border-b border-slate-200/80 px-1.5 py-4 dark:border-slate-800">
						<div>
							<strong className="block text-[22px] font-semibold leading-tight tracking-tight" style={{ color: M_PURPLE }}>
								$49 <small className="text-[11px] font-normal tracking-normal">USDC</small>
							</strong>
							<span className="mt-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">Service package</span>
						</div>
						<ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
						<div>
							<strong className="block text-[22px] font-semibold leading-tight tracking-tight" style={{ color: M_PURPLE }}>
								$40 <small className="text-[11px] font-normal tracking-normal">USDC</small>
							</strong>
							<span className="mt-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								Within the remaining cap
							</span>
						</div>
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)_19px_minmax(0,1fr)] items-center gap-1.5 border-b border-slate-200/80 px-1.5 py-4 dark:border-slate-800">
						<div>
							<strong className="block text-[22px] font-semibold leading-tight tracking-tight" style={{ color: M_PURPLE }}>
								$199+ <small className="text-[11px] font-normal tracking-normal">USDC</small>
							</strong>
							<span className="mt-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">Service package</span>
						</div>
						<ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
						<div>
							<strong
								className="block text-[15px] font-medium leading-snug"
								style={{ color: M_PURPLE }}
							>
								Remaining
								<br />
								allowance
							</strong>
							<span className="mt-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								Up to the $100 USDC cap
							</span>
						</div>
					</div>
					<p className="mx-1 mt-3.5 mb-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
						<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: M_PURPLE }} aria-hidden />
						<span>
							<strong className="font-medium text-slate-800 dark:text-slate-200">$100 USDC maximum</strong> across
							all onboarding installments
						</span>
					</p>
					<PartnerDetail icon={Route} title="See purchase examples">
						<div className="space-y-2.5">
							{ONBOARDING_AWARD_PATHS.map((path) => (
								<div
									key={path.map((step) => step.buy).join('+')}
									className="rounded-[13px] px-2.5 py-3"
									style={{ backgroundColor: H_SOFT }}
								>
									<p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
										Package purchases → partner awards <span>USDC</span>
									</p>
									<div className="mt-3 flex items-end gap-1.5">
										{path.map((step, index) => (
											<React.Fragment key={`${step.buy}-${step.award}-${index}`}>
												{index > 0 ? (
													<span className="self-end pb-0.5 text-[13px] text-slate-400" aria-hidden>
														+
													</span>
												) : null}
												<div className="min-w-0 flex-1 text-center">
													<strong className="block text-[13px] font-medium text-slate-900 dark:text-slate-100">
														${step.buy}
													</strong>
													<span className="my-1.5 flex justify-center text-slate-400">
														<ArrowDown className="h-3.5 w-3.5" aria-hidden />
													</span>
													<b className="block text-[16px] font-medium" style={{ color: H_BLUE }}>
														${step.award}
													</b>
												</div>
											</React.Fragment>
										))}
										<span className="self-end pb-0.5 text-[13px] text-slate-400" aria-hidden>
											=
										</span>
										<div className="min-w-[47px] self-end text-center">
											<small className="mb-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
												Total award
											</small>
											<strong className="block text-[19px] font-medium leading-tight" style={{ color: H_BLUE }}>
												$100
											</strong>
										</div>
									</div>
								</div>
							))}
						</div>
					</PartnerDetail>
					<PartnerDetail icon={BadgeCheck} title="When the award is paid">
						<ul className="list-disc space-y-1.5 pl-[18px]">
							<li>Official account handover, basic training and configuration acceptance are complete.</li>
							<li>Merchant verification and consumer-app public listing are approved.</li>
							<li>Qualifying package purchases meet settlement requirements.</li>
						</ul>
						<p>
							Each $49 USDC package adds $40 USDC, capped by the remaining onboarding allowance. A package of
							$199 USDC or more pays the remaining allowance. After $100 USDC has been paid for the location,
							later purchases earn no further onboarding award.
						</p>
						<p>
							Purchases are merchant B-Units service credits, not customer stored-value top-ups. Purchase alone
							does not guarantee approval. Refund, chargeback, fraud and abnormal-account rules apply.
						</p>
					</PartnerDetail>
				</section>

				<section className="mt-[17px] rounded-[21px] border border-slate-200/90 bg-white px-3.5 py-4 dark:border-slate-700 dark:bg-slate-900">
					<div className="mb-[18px] flex items-center gap-2">
						<span
							className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
							style={{ backgroundColor: H_SOFT, color: H_BLUE }}
						>
							<CalendarCheck className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
						</span>
						<div className="min-w-0 grow">
							<h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Day-60 milestone</h3>
							<p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								One assessment on day 60
							</p>
						</div>
						<p className="shrink-0 text-right text-[27px] font-semibold leading-none tracking-tight" style={{ color: H_BLUE }}>
							$100
							<small className="mt-1 block text-[11px] font-normal tracking-normal">USDC</small>
						</p>
					</div>
					<div className="flex items-center gap-2 border-t border-slate-200/80 py-3.5 dark:border-slate-800">
						<div className="shrink-0">
							<span className="mb-1 block text-[11px] font-medium" style={{ color: H_BLUE }}>
								Day 0
							</span>
							<strong className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
								Official handover
							</strong>
						</div>
						<span className="relative h-0.5 min-w-[14px] flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden>
							<span className="absolute -top-[2px] left-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: H_BLUE }} />
							<span className="absolute -top-[2px] right-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: H_BLUE }} />
						</span>
						<div className="shrink-0 text-right">
							<span className="mb-1 block text-[11px] font-medium" style={{ color: H_BLUE }}>
								Day 60
							</span>
							<strong className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
								One-time review
							</strong>
						</div>
					</div>
					<div
						className="grid grid-cols-3 gap-1.5"
						aria-label="Minimum cumulative targets: 20 unique customers, 5 repeat customers, and $100 USDC of consumed service revenue"
					>
						<div className="min-w-0 rounded-[14px] px-1 py-3 text-center" style={{ backgroundColor: H_SOFT }}>
							<Users className="mx-auto mb-3 h-4 w-4" style={{ color: H_BLUE }} aria-hidden />
							<strong className="block min-h-[45px] text-[25px] font-semibold leading-none tracking-tight" style={{ color: H_BLUE }}>
								20
							</strong>
							<span className="mt-2.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								Unique
								<br />
								customers
							</span>
						</div>
						<div className="min-w-0 rounded-[14px] px-1 py-3 text-center" style={{ backgroundColor: H_SOFT }}>
							<Repeat2 className="mx-auto mb-3 h-4 w-4" style={{ color: H_BLUE }} aria-hidden />
							<strong className="block min-h-[45px] text-[25px] font-semibold leading-none tracking-tight" style={{ color: H_BLUE }}>
								5
							</strong>
							<span className="mt-2.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								Repeat
								<br />
								customers
							</span>
						</div>
						<div className="min-w-0 rounded-[14px] px-1 py-3 text-center" style={{ backgroundColor: H_SOFT }}>
							<Layers className="mx-auto mb-3 h-4 w-4" style={{ color: H_BLUE }} aria-hidden />
							<strong className="block min-h-[45px] text-[25px] font-semibold leading-none tracking-tight" style={{ color: H_BLUE }}>
								$100
								<small className="mt-1 block text-[11px] font-normal tracking-normal">USDC</small>
							</strong>
							<span className="mt-2.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
								Paid service
								<br />
								revenue
							</span>
						</div>
					</div>
					<p className="flex items-start gap-1.5 px-0.5 py-3 text-[11px] leading-snug" style={{ color: H_BLUE }}>
						<CheckCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
						Minimum cumulative targets · all three required.
					</p>
					<PartnerDetail icon={ListChecks} title="What counts toward the targets">
						<h4 className="text-[12px] font-medium text-slate-800 dark:text-slate-200">20 unique customers</h4>
						<p>
							Each completes a successful real top-up, spending redemption or benefit redemption at this
							location. Count each customer once per location; the same customer may count at another location.
						</p>
						<h4 className="text-[12px] font-medium text-slate-800 dark:text-slate-200">5 repeat customers</h4>
						<p>Each completes at least two genuine business actions on different dates.</p>
						<h4 className="text-[12px] font-medium text-slate-800 dark:text-slate-200">$100 USDC in service revenue</h4>
						<p>
							Value consumed B-Units at their attributable purchase-batch consideration, including applicable
							bonuses and discounts. Measure before direct costs. Package purchases, unused balances and
							customer top-up principal do not count as consumed service revenue.
						</p>
						<div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/80">
							<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: H_BLUE }} aria-hidden />
							<p>
								Real complimentary-credit activity can count toward customer and repeat-use targets, but not
								service revenue. Tests, fabricated activity, clicks and duplicate callbacks are excluded.
							</p>
						</div>
						<p>
							Day 0 is official merchant handover with real business enabled. Assess all cumulative targets once
							on day 60. This additional $100 USDC is paid once if all three are met; it does not repeat every
							60 days.
						</p>
					</PartnerDetail>
				</section>

				<div className="flex items-start gap-2.5 px-1 py-[17px]">
					<Repeat2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: M_PURPLE }} aria-hidden />
					<p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
						<strong className="mb-1 block font-medium text-slate-800 dark:text-slate-200">
							Recurring referral rewards are separate.
						</strong>
						Earned from eligible paid service activity at settlement.
					</p>
				</div>

				<div className="rounded-[17px] border border-slate-200/90 bg-white px-3.5 dark:border-slate-700 dark:bg-slate-900">
					<div className="[&>details:first-child]:border-t-0">
						<PartnerDetail icon={MapPin} title="Location eligibility & attribution">
							<p>
								Available to enrolled partners in confirmed open recruitment markets, subject to programme
								terms. Each real location needs its own merchant account and independent qualification.
								Separate chain locations can qualify; a separate legal entity per location is not required.
							</p>
							<p>
								Duplicate registrations, staff subaccounts and additional terminals at the same location do not
								qualify again. Contact details or a free account alone earn no cash award.
							</p>
							<p>
								The merchant confirms referral attribution at handover. Location, account, referrer and
								handover records must match; resolve competing claims before payout. Partners must not retain
								merchant passwords or authorize payments for merchants.
							</p>
						</PartnerDetail>
						<PartnerDetail icon={FileCheck2} title="One-time awards & settlement terms">
							<p>
								The onboarding allowance is capped at $100 USDC per qualifying location and may be paid in
								installments. The day-60 award is a separate, single $100 USDC payment if all three targets are
								met. The combined one-time cap is $200 USDC per qualifying location.
							</p>
							<p>
								There is no day-30 award or final-14-day activity requirement. Recurring network rewards are
								separate from these one-time awards and are paid from the network contribution reward pool.
							</p>
							<p>
								Agree the payment cycle when joining. Eligibility, refunds, reversals, chargebacks, abnormal
								accounts, disputes and settlement follow the applicable published and signed terms. Rewards do
								not guarantee fixed or minimum income.
							</p>
						</PartnerDetail>
					</div>
				</div>
			</div>
		)
	}

	if (view === 'manage' && selectedTemp) {
		return (
			<div className="space-y-4 pb-4">
				{panelBack(claimed ? 'Business overview' : 'Invite a business', () => setView('main'))}
				<AgentTempAccountStates
					temp={selectedTemp}
					cards={selectedCards}
					agentEoa={agentEoa}
					resolveName={resolveName}
					onRefresh={() => {
						void refreshCards(selectedTemp)
					}}
				/>
			</div>
		)
	}

	return (
		<div className="space-y-0 pb-4">
			<div className="relative mb-[17px] flex items-center justify-between">
				<BeamioCircularBackButton variant="onLight" onClick={onBack} aria-label="Back" />
				<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[19px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
					Business
				</h1>
				<span className="h-9 w-9 shrink-0" aria-hidden />
			</div>

			<div
				className="mb-3.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold"
				style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
			>
				<BadgeCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
				{agentLabel}
			</div>

			<section className="rounded-[23px] border border-[#eadcf7] bg-gradient-to-br from-white to-[#f6edf9] px-4 py-[19px] shadow-sm dark:border-purple-900/40 dark:from-slate-900 dark:to-[#392a45]/40">
				<h2 className="max-w-[280px] text-[20px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
					Help a business get started.
				</h2>
				<div
					className="mt-[22px] mb-[18px] grid grid-cols-3 gap-3"
					aria-label="Create a temporary account, set up the business in Business OS, then hand over to the owner"
				>
					{(
						[
							{ Icon: UserRoundPlus, label: 'Create account' },
							{ Icon: Store, label: 'Set up in OS' },
							{ Icon: KeyRound, label: 'Owner handover' },
						] as const
					).map((step, i) => (
						<div key={step.label} className="relative text-center">
							{i < 2 ? (
								<span
									className="pointer-events-none absolute right-[-11px] top-2.5 z-[1] text-[13px] text-slate-400 dark:text-slate-500"
									aria-hidden
								>
									→
								</span>
							) : null}
							<span
								className="mx-auto mb-2 grid h-[38px] w-[38px] place-items-center rounded-[13px] bg-white shadow-[0_3px_10px_rgba(15,23,42,0.08)] dark:bg-slate-800"
								style={{ color: M_PURPLE }}
							>
								<step.Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
							</span>
							<strong className="block text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-200">
								{step.label}
							</strong>
						</div>
					))}
				</div>
				<button
					type="button"
					onClick={onCreateTemporary}
					className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_7px_18px_rgba(139,62,145,0.18)] transition active:scale-[0.99]"
					style={{
						background: `linear-gradient(120deg, ${M_PURPLE}, #a04da1)`,
					}}
				>
					<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
					Create temporary account
				</button>
			</section>

			<section className="mt-[23px]">
				<div className="mb-[11px] flex items-center justify-between gap-2">
					<h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Business accounts</h2>
					<span className="grid h-[23px] min-w-[23px] place-items-center rounded-lg bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
						{temps.length}
					</span>
				</div>
				{temps.length === 0 ? (
					<div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-[17px] dark:border-slate-700 dark:bg-slate-900">
						<span className="grid place-items-center text-slate-400 dark:text-slate-500">
							<Store className="h-5 w-5" strokeWidth={2} aria-hidden />
						</span>
						<p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
							No accounts yet. Create one to begin.
						</p>
					</div>
				) : (
					<ul className="space-y-2">
						{temps.map((temp) => {
							const key = temp.eoa.toLowerCase()
							const cardState = cardsByTemp[key]
							const readyRow = accountReady(cardState?.rows)
							const claimedRow = accountClaimed(cardState?.rows)
							const manageableRow = primaryManageableCard(cardState?.rows)
							const transferredRow = visibleCards(cardState?.rows ?? []).find((r) => r.transferred)
							const title = claimedRow
								? pickMerchantCardListTitle({
										workerName: transferredRow ? resolveName(transferredRow.cardAddress) : '',
										metaName: transferredRow?.name,
										fallback: `@${temp.beamioTag.replace(/^@/, '')}`,
									})
								: readyRow && manageableRow
									? pickMerchantCardListTitle({
											workerName: resolveName(manageableRow.cardAddress),
											metaName: manageableRow.name,
											fallback: `@${temp.beamioTag.replace(/^@/, '')}`,
										})
									: `@${temp.beamioTag.replace(/^@/, '')}`
							const subtitle = claimedRow
								? 'Onboarding complete'
								: readyRow
									? 'Card prepared · temporary account'
									: cardState?.loading
										? 'Loading…'
										: 'Temporary account · setup not started'
							return (
								<li key={key}>
									<button
										type="button"
										onClick={() => openManage(temp)}
										className="flex w-full items-center gap-3 rounded-[18px] border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
									>
										<span
											className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
												claimedRow
													? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
													: 'bg-[#f6edf9] text-[#8b3e91]'
											}`}
										>
											{claimedRow ? (
												<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
											) : (
												<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
											)}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
												{title}
											</span>
											<span className="mt-0.5 block truncate text-[12px] text-slate-500 dark:text-slate-400">
												{subtitle}
											</span>
										</span>
										<span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#8b3e91]">
											{claimedRow ? 'View' : 'Manage'}
											<ChevronRight className="h-4 w-4" aria-hidden />
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</section>

			<section className="mt-6">
				<div className="mb-3 flex items-end justify-between gap-2">
					<h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Referral rewards</h2>
					<span className="text-[11px] font-medium text-slate-400">One-time · per location</span>
				</div>
				<div className="grid grid-cols-2 gap-2.5">
					<div className="rounded-[18px] border border-[#eadcf7] bg-white px-3.5 py-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span
							className="mb-2.5 grid h-9 w-9 place-items-center rounded-[12px]"
							style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
						>
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Paid onboarding</p>
						<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Up to</p>
						<p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 <span className="text-[12px] font-semibold">USDC</span>
						</p>
					</div>
					<div className="rounded-[18px] border border-[#eadcf7] bg-white px-3.5 py-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span
							className="mb-2.5 grid h-9 w-9 place-items-center rounded-[12px]"
							style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
						>
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Day-60 milestone</p>
						<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">One-time</p>
						<p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 <span className="text-[12px] font-semibold">USDC</span>
						</p>
					</div>
				</div>
				<p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
				<button
					type="button"
					onClick={() => setView('partnerPlan')}
					className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-2xl px-4 py-3 text-[13px] font-semibold transition active:scale-[0.99]"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					View reward plan
					<span aria-hidden>→</span>
				</button>
				<p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
					Qualifying locations and enrolled partners only. Conditions apply.
				</p>
			</section>

			<section className="mt-6">
				<h2 className="mb-3 text-[13px] font-semibold text-slate-900 dark:text-slate-50">Business essentials</h2>
				<div className="space-y-2.5">
					{(
						[
							{ key: 'fees' as const, Icon: FileText, title: 'Service fees' },
							{ key: 'packages' as const, Icon: Layers, title: 'Business packages' },
							{ key: 'calc' as const, Icon: Calculator, title: 'Reward calculation' },
						] as const
					).map((row) => {
						const open = essentialsOpen === row.key
						return (
							<div
								key={row.key}
								className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
							>
								<button
									type="button"
									onClick={() => toggleEssentials(row.key)}
									className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-4 text-left"
									aria-expanded={open}
								>
									<span className="flex items-center gap-2.5 min-w-0 flex-1">
										<span className="text-[#0051d1] dark:text-sky-400">
											<row.Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<span className="text-[12px] font-medium text-slate-900 dark:text-slate-50">
											{row.title}
										</span>
									</span>
									<ChevronDown
										className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
										aria-hidden
									/>
								</button>
								{open && row.key === 'fees' ? (
									<div className="border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										<div className="flex items-center gap-2 rounded-[11px] bg-[#eef3ff] px-2.5 py-2.5 text-[11px] leading-snug text-[#165ce9] dark:bg-sky-950/40 dark:text-sky-300">
											<Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
											1 B-Unit · $0.01 USDC nominal service credit
										</div>
										<div>
											{FEE_ROWS.map((fee) => (
												<div
													key={fee.label}
													className="flex items-center gap-2.5 border-b border-slate-100 py-3.5 last:border-b-0 dark:border-slate-800"
												>
													<fee.Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2.25} aria-hidden />
													<div className="min-w-0 flex-1">
														<p className="text-[11px] font-medium leading-snug text-slate-800 dark:text-slate-100">
															{fee.label}
														</p>
														<p className="mt-1 text-[11px] text-slate-400">{fee.note}</p>
													</div>
													<div className="shrink-0 text-right">
														<p className="text-[22px] font-semibold tabular-nums leading-none tracking-tight text-[#165ce9] dark:text-sky-300">
															{formatBUnitCount(fee.fee)}
														</p>
														<p className="mt-1 text-[11px] text-slate-400">B-Units</p>
													</div>
												</div>
											))}
										</div>
										<EssentialsFinePrint title="Billing details">
											<p>
												Businesses pay service fees in B-Units. These are reference service rates; current fees and
												purchase terms apply. Customer top-up principal, merchant-funded rewards and technical service
												fees are accounted for separately. Complex cross-merchant routes and third-party costs follow
												disclosed quotes and terms.
											</p>
										</EssentialsFinePrint>
									</div>
								) : null}
								{open && row.key === 'packages' ? (
									<div className="border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										<div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-2.5 py-2.5 text-[11px] leading-relaxed text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
											<Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
											<span>
												Free onboarding includes <strong className="font-medium">{formatBUnitCount('1000')} B-Units</strong>
											</span>
										</div>
										<div className="mt-3.5 grid grid-cols-2 gap-2.5">
											{PACKAGE_ROWS.map((pkg) => (
												<article
													key={pkg.name}
													className="rounded-[15px] border border-slate-200/90 bg-white px-2.5 py-3 dark:border-slate-700 dark:bg-slate-900"
												>
													<div className="flex items-start justify-between gap-1">
														<p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{pkg.name}</p>
														{pkg.badge ? (
															<span className="shrink-0 rounded-full bg-[#f6edf9] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8b3e91]">
																{pkg.badge}
															</span>
														) : null}
													</div>
													<p className="mt-2 text-[22px] font-semibold tabular-nums leading-none tracking-tight text-[#165ce9] dark:text-sky-300">
														${pkg.priceUsdc}
														<span className="ml-1 text-[11px] font-medium text-slate-400">USDC</span>
													</p>
													<p className="mt-3 border-t border-slate-100 pt-2.5 text-[12px] font-medium tabular-nums text-slate-800 dark:border-slate-800 dark:text-slate-100">
														{formatBUnitCount(pkg.totalBUnits)}
													</p>
													<p className="mt-1 text-[11px] text-slate-400">Total B-Units</p>
												</article>
											))}
										</div>
										<p className="mt-3 text-[11px] text-slate-400">The business chooses and pays in Business OS.</p>
										<a
											href={MERCHANT_OS_AGENT_URL}
											target="_blank"
											rel="noopener noreferrer"
											onClick={(e) => {
												e.preventDefault()
												openExternalUrl(MERCHANT_OS_AGENT_URL)
											}}
											className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
										>
											View Business OS
											<ExternalLink className="h-3.5 w-3.5" aria-hidden />
										</a>
										<EssentialsFinePrint title="Package & verification details">
											<p>
												Reference packages; confirm current pricing and terms before purchase. Businesses select
												according to their service needs. Buying any paid package meets the purchase condition for
												verification; approval also requires business checks. B-Units cannot be redeemed for cash.
												Referral partners must not authorize payments on the business’s behalf.
											</p>
										</EssentialsFinePrint>
									</div>
								) : null}
								{open && row.key === 'calc' ? (
									<div className="border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										<div className="rounded-[17px] bg-[#eef3ff] px-3 py-5 text-center dark:bg-sky-950/40">
											<p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
												Your recurring merchant-referrer share
											</p>
											<p className="mt-2 text-[52px] font-semibold leading-none tracking-[-2px] text-[#165ce9] dark:text-sky-300">
												15
												<small className="text-[25px] font-medium">%</small>
											</p>
											<p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
												of the paid service amount after direct costs
											</p>
										</div>
										<div
											className="mt-4 flex items-center justify-between gap-1"
											aria-label="30 percent interaction allocation times 50 percent merchant-referrer share equals 15 percent of the amount after direct costs"
										>
											<div className="min-w-0 flex-1 text-center">
												<p className="text-[21px] font-medium text-[#165ce9] dark:text-sky-300">30%</p>
												<p className="mt-1.5 text-[11px] leading-snug text-slate-400">Interaction allocation</p>
											</div>
											<span className="text-sm text-slate-400" aria-hidden>
												×
											</span>
											<div className="min-w-0 flex-1 text-center">
												<p className="text-[21px] font-medium text-[#165ce9] dark:text-sky-300">50%</p>
												<p className="mt-1.5 text-[11px] leading-snug text-slate-400">Referrer share</p>
											</div>
											<span className="text-sm text-slate-400" aria-hidden>
												=
											</span>
											<div className="min-w-0 flex-1 text-center">
												<p className="text-[21px] font-medium text-[#165ce9] dark:text-sky-300">15%</p>
												<p className="mt-1.5 text-[11px] leading-snug text-slate-400">Your share</p>
											</div>
										</div>
										<p className="mt-3 text-[11px] text-slate-400">Earned when qualifying paid activity settles.</p>
										<button
											type="button"
											onClick={onViewAllocationRules}
											className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-[#165ce9] dark:border-slate-600 dark:text-sky-300"
										>
											View allocation rules & examples
											<ArrowRight className="h-3.5 w-3.5" aria-hidden />
										</button>
										<EssentialsFinePrint title="Calculation & eligibility details">
											<p>
												30% of a paid B-Units package purchase is reserved for network rewards. Reserved funding is not
												earned income.
											</p>
											<p>
												Merchant-referrer reward = (Paid service settlement − direct costs) × 30% × 50%. Direct costs =
												$0.01 USDC per interaction + 5% of its Paid service settlement amount.
											</p>
											<p>
												Only eligible paid service consumption generates recurring rewards. Free credits generate no
												cash distribution. Unassigned referral shares stay in the shared pool; one-time partner awards
												follow their own conditions. Available to enrolled participants under applicable terms.
											</p>
										</EssentialsFinePrint>
									</div>
								) : null}
							</div>
						)
					})}
				</div>
			</section>

			<p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
				Temporary accounts stay separate from your personal account.
			</p>
		</div>
	)
}
