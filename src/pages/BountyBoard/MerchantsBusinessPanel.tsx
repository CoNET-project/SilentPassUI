import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
	BadgeCheck,
	Calculator,
	CalendarDays,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	FileText,
	KeyRound,
	Layers,
	Plus,
	RefreshCw,
	Store,
	UserRoundPlus,
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

const FEE_ROWS: { label: string; fee: string; note: string }[] = [
	{ label: 'Direct USDC settlement', fee: '25', note: 'Per transaction' },
	{ label: 'Stored-value / membership top-up', fee: '20', note: 'Per transaction' },
	{ label: 'Spending, points exchange, coupon claim or redemption', fee: '5', note: 'Per transaction' },
	{ label: 'Coupon issuance', fee: '100', note: 'Per coupon' },
	{ label: 'Coupon redemption-code issuance', fee: '10', note: 'Per batch · up to 100 codes' },
	{ label: 'Social action', fee: '0.1', note: 'Per action' },
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
			<div className="space-y-4 pb-4">
				{panelBack('Partner reward plan', () => setView('main'))}
				<section className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
					<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
						Qualifying locations and enrolled partners can earn one-time rewards for paid onboarding and
						the Day-60 milestone (up to 100 USDC each), plus recurring rewards from eligible paid Charge
						and Top-up usage.
					</p>
				</section>
				<section className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Paid onboarding</p>
						<p className="mt-1 text-[11px] text-slate-400">Up to</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 USDC
						</p>
					</div>
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Day-60 milestone</p>
						<p className="mt-1 text-[11px] text-slate-400">One-time</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 USDC
						</p>
					</div>
				</section>
				<p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
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
										<div
											className="mb-2 flex items-center gap-2 rounded-[11px] px-2.5 py-2.5 text-[11px] leading-snug"
											style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
										>
											<Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
											1 B-Unit · 0.01 USDC nominal service credit
										</div>
										<div className="divide-y divide-slate-100 dark:divide-slate-800">
											{FEE_ROWS.map((fee) => (
												<div key={fee.label} className="flex items-center gap-2.5 py-3.5">
													<div className="min-w-0 flex-1">
														<p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
															{fee.label}
														</p>
														<p className="text-[11px] text-slate-400">{fee.note}</p>
													</div>
													<div className="shrink-0 text-right">
														<p className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
															{fee.fee}
														</p>
														<p className="text-[10px] font-medium text-slate-400">B-Units</p>
													</div>
												</div>
											))}
										</div>
									</div>
								) : null}
								{open && row.key === 'packages' ? (
									<div className="space-y-2 border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										{PACKAGE_ROWS.map((pkg) => (
											<div
												key={pkg.name}
												className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80"
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
														{pkg.name}
													</p>
													{pkg.badge ? (
														<span className="rounded-full bg-[#f6edf9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b3e91]">
															{pkg.badge}
														</span>
													) : null}
												</div>
												<p className="mt-1 text-[18px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
													{pkg.priceUsdc}{' '}
													<span className="text-[12px] font-semibold text-slate-500">USDC</span>
												</p>
												<p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
													{pkg.totalBUnits} B-Units
												</p>
											</div>
										))}
										<p className="pt-1 text-[11px] text-slate-400">
											The business chooses and pays in Business OS.
										</p>
										<a
											href={MERCHANT_OS_AGENT_URL}
											target="_blank"
											rel="noopener noreferrer"
											onClick={(e) => {
												e.preventDefault()
												openExternalUrl(MERCHANT_OS_AGENT_URL)
											}}
											className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
										>
											View Business OS
											<ExternalLink className="h-3.5 w-3.5" aria-hidden />
										</a>
									</div>
								) : null}
								{open && row.key === 'calc' ? (
									<div className="space-y-2 border-t border-slate-100 px-3.5 pb-4 pt-3 text-[12px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
										<p>
											One-time partner rewards are paid per qualifying location for paid onboarding and the
											Day-60 milestone (up to 100 USDC each).
										</p>
										<p>
											Recurring rewards follow eligible paid Charge and Top-up usage at enrolled partner
											locations under the partner program rules.
										</p>
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
