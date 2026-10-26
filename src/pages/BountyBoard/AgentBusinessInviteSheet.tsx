import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Wallet } from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import {
	fetchActiveTempCountOf,
	fetchIsAgent,
	MAX_ACTIVE_TEMPS_PER_AGENT,
	registerAgentOnChain,
	registerMerchantUnderAgent,
	registerTempUnderAgent,
} from '@/utils/agentReferrerRegistryClient'
import {
	createAgentTempAccount,
	listTempMerchantCards,
	loadAgentTempAccounts,
	type AgentTempAccount,
	type AgentTempMerchantCard,
} from '@/utils/agentBusinessWorkspace'
import { getCardsOfOwnerWithDetails } from '@/services/BeamioCard'
import { AgentTempAccountStates } from '@/pages/BountyBoard/AgentTempAccountStates'

export function AgentBusinessInviteSheet({
	open,
	epoch,
	agentEoa,
	agentTag,
	onClose,
}: {
	open: boolean
	epoch: number
	agentEoa: string
	agentTag: string
	onClose: () => void
}) {
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const [temps, setTemps] = useState<AgentTempAccount[]>([])
	const [cardsByTemp, setCardsByTemp] = useState<Record<string, { loading: boolean; rows: AgentTempMerchantCard[]; error?: string }>>({})
	const [agentState, setAgentState] = useState<'checking' | 'agent' | 'merchant' | 'error'>('checking')
	const [statusError, setStatusError] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [activeTempCount, setActiveTempCount] = useState<number | null>(null)
	const { resolveName, registerCardAddresses } = useMerchantCardDatabase()

	const allCardAddresses = useMemo(() => {
		const out: string[] = []
		for (const state of Object.values(cardsByTemp)) {
			for (const row of state.rows) {
				if (row.cardAddress) out.push(row.cardAddress)
			}
		}
		return out
	}, [cardsByTemp])

	useEffect(() => {
		if (!open || allCardAddresses.length === 0) return
		registerCardAddresses(allCardAddresses)
	}, [open, allCardAddresses, registerCardAddresses])

	const refreshActiveTempCount = async () => {
		if (!agentEoa) return
		const count = await fetchActiveTempCountOf(agentEoa)
		setActiveTempCount(count)
	}

	const atTempCap =
		activeTempCount != null && activeTempCount >= MAX_ACTIVE_TEMPS_PER_AGENT

	useEffect(() => {
		if (!open) return
		setClosing(false)
		setEntered(false)
		const frame = window.requestAnimationFrame(() => setEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [open, epoch])

	useEffect(() => {
		if (!open || !agentEoa) return
		let cancelled = false
		setTemps(loadAgentTempAccounts(agentEoa))
		setAgentState('checking')
		setStatusError('')
		void (async () => {
			try {
				const owned = await getCardsOfOwnerWithDetails(agentEoa)
				if (cancelled) return
				if (owned.length > 0) {
					setAgentState('merchant')
					return
				}
				const already = await fetchIsAgent(agentEoa)
				if (cancelled) return
				if (already === true) {
					setAgentState('agent')
					return
				}
				const registered = await registerAgentOnChain()
				if (cancelled) return
				if (!registered.success) {
					setAgentState('error')
					setStatusError(registered.error || 'Could not register this wallet as an agent')
					return
				}
				setAgentState('agent')
			} catch {
				if (cancelled) return
				setAgentState('error')
				setStatusError('Could not read agent status. Try again.')
			}
		})()
		return () => {
			cancelled = true
		}
	}, [open, epoch, agentEoa])

	useEffect(() => {
		if (!open || agentState !== 'agent') return
		let cancelled = false
		void refreshActiveTempCount().then(() => {
			if (cancelled) return
		})
		for (const temp of temps) {
			const key = temp.eoa.toLowerCase()
			void registerTempUnderAgent(temp.eoa).catch(() => undefined)
			setCardsByTemp((prev) => ({
				...prev,
				[key]: { loading: true, rows: prev[key]?.rows ?? [] },
			}))
			void listTempMerchantCards(temp.eoa).then(async (rows) => {
				if (cancelled) return
				setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
				let handedOff = false
				for (const row of rows) {
					if (!row.transferred || !row.owner) continue
					const result = await registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa)
					if (result.success) handedOff = true
				}
				if (handedOff && !cancelled) void refreshActiveTempCount()
			}).catch(() => {
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
	}, [open, temps, agentState, agentEoa])

	const close = () => {
		if (closing) return
		setClosing(true)
		window.setTimeout(onClose, 300)
	}

	const refreshCards = async (temp: AgentTempAccount) => {
		const key = temp.eoa.toLowerCase()
		setCardsByTemp((prev) => ({
			...prev,
			[key]: { loading: true, rows: prev[key]?.rows ?? [] },
		}))
		try {
			const rows = await listTempMerchantCards(temp.eoa)
			setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
			let handedOff = false
			for (const row of rows) {
				if (!row.transferred || !row.owner) continue
				const result = await registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa)
				if (result.success) handedOff = true
			}
			if (handedOff) await refreshActiveTempCount()
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
	}

	const addTemp = async () => {
		if (creating || agentState !== 'agent' || atTempCap) return
		setCreating(true)
		setCreateError('')
		try {
			await createAgentTempAccount(agentEoa)
			setTemps(loadAgentTempAccounts(agentEoa))
			await refreshActiveTempCount()
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'Could not create a temp account')
			await refreshActiveTempCount()
		} finally {
			setCreating(false)
		}
	}

	if (!open) return null

	return (
		<div className="fixed inset-0 z-[140]">
			<div
				className="absolute inset-0 flex h-full w-full flex-col overflow-y-auto bg-[#F2F2F7] transition-transform duration-300 ease-out dark:bg-slate-950"
				style={{
					transform: closing || !entered ? 'translateX(100%)' : 'translateX(0)',
					paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
					paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby="agent-business-title"
			>
				<div className="relative flex items-center px-4 pb-2 pt-2">
					<BeamioCircularBackButton variant="onLight" onClick={close} aria-label="Back" />
					<h2
						id="agent-business-title"
						className="pointer-events-none absolute inset-x-16 truncate text-center text-base font-semibold text-slate-900 dark:text-slate-50"
					>
						Invite a business
					</h2>
				</div>
				<div className="space-y-4 px-4 pt-2">
					<p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
						Use this wallet as an agent to pre-register a merchant. Temp accounts are separate from
						{agentTag ? ` @${agentTag.replace(/^@/, '')}` : ' your Beamio ID'}.
					</p>
					{agentState === 'checking' ? (
						<p className="flex items-center gap-2 text-sm text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Checking agent registration
						</p>
					) : null}
					{agentState === 'agent' ? (
						<p className="text-sm font-medium text-[#8d3a8b]">This wallet is registered as an agent.</p>
					) : null}
					{agentState === 'merchant' ? (
						<div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>This wallet already owns a merchant program card, so it is not registered as an agent.</p>
						</div>
					) : null}
					{statusError ? (
						<div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>{statusError}</p>
						</div>
					) : null}
					{createError ? (
						<div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>{createError}</p>
						</div>
					) : null}
					{atTempCap ? (
						<p className="text-sm text-slate-500 dark:text-slate-400">
							You already have {MAX_ACTIVE_TEMPS_PER_AGENT} active temp accounts. Hand one off to a
							merchant to free a slot.
						</p>
					) : activeTempCount != null && agentState === 'agent' ? (
						<p className="text-sm text-slate-500 dark:text-slate-400">
							Active temps: {activeTempCount} / {MAX_ACTIVE_TEMPS_PER_AGENT}
						</p>
					) : null}
					<button
						type="button"
						onClick={() => void addTemp()}
						disabled={creating || agentState !== 'agent' || atTempCap}
						aria-busy={creating}
						className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8d3a8b] px-4 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
					>
						{creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
						{creating ? 'Creating temp account' : 'Add temp account'}
					</button>
					{temps.length === 0 ? (
						<div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
							<Wallet className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden />
							<p className="text-sm text-slate-500">No temp accounts yet.</p>
						</div>
					) : (
						<ul className="space-y-3">
							{temps.map((temp) => {
								const key = temp.eoa.toLowerCase()
								return (
									<li
										key={key}
										className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
									>
										<AgentTempAccountStates
											temp={temp}
											cards={cardsByTemp[key]}
											agentEoa={agentEoa}
											resolveName={resolveName}
											onRefresh={() => {
												void refreshCards(temp)
											}}
										/>
									</li>
								)
							})}
						</ul>
					)}
				</div>
			</div>
		</div>
	)
}
