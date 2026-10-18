import React, { useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Copy, Eye, EyeOff, ExternalLink, Loader2, Plus, Store, Wallet } from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import {
	fetchIsAgent,
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

const MERCHANT_OS_AGENT_URL = 'https://biz.beamio.app/biz/'

/** Hash fragment only — the access password must not appear in the server request. */
function merchantOsUnlockUrl(beamioTag: string, accessPassword: string): string {
	const params = new URLSearchParams({
		tag: beamioTag.replace(/^@/, '').trim(),
		pin: accessPassword,
	})
	return `${MERCHANT_OS_AGENT_URL}#/?${params.toString()}`
}

function shortAddress(address: string): string {
	const raw = address.trim()
	if (raw.length < 12) return raw
	return `${raw.slice(0, 6)}…${raw.slice(-4)}`
}

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
	const [itemError, setItemError] = useState<Record<string, string>>({})
	const [agentState, setAgentState] = useState<'checking' | 'agent' | 'merchant' | 'error'>('checking')
	const [statusError, setStatusError] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [revealPw, setRevealPw] = useState<Record<string, boolean>>({})
	const [copiedKey, setCopiedKey] = useState('')

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
				for (const row of rows) {
					if (!row.transferred || !row.owner) continue
					await registerMerchantUnderAgent(row.owner, temp.eoa)
				}
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
	}, [open, temps, agentState])

	const close = () => {
		if (closing) return
		setClosing(true)
		window.setTimeout(onClose, 300)
	}

	const copyText = async (key: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 2000)
		} catch {
			setCreateError('Could not copy to the clipboard')
		}
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
			for (const row of rows) {
				if (!row.transferred || !row.owner) continue
				await registerMerchantUnderAgent(row.owner, temp.eoa)
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
	}

	const addTemp = async () => {
		if (creating || agentState !== 'agent') return
		setCreating(true)
		setCreateError('')
		try {
			const created = await createAgentTempAccount(agentEoa)
			setTemps(loadAgentTempAccounts(agentEoa))
			setRevealPw((prev) => ({ ...prev, [created.eoa.toLowerCase()]: true }))
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'Could not create a temp account')
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
					<button
						type="button"
						onClick={() => void addTemp()}
						disabled={creating || agentState !== 'agent'}
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
								const cardState = cardsByTemp[key]
								const cards = cardState?.rows ?? []
								const showPw = !!revealPw[key]
								const manageable = cards.filter((row) => !row.transferred)
								const hasSnapshot = !!cardState && !cardState.loading
								const mustCreate = hasSnapshot && manageable.length === 0
								const canOpen = manageable.length > 0
								return (
									<li key={key} className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
										<div className="flex flex-wrap items-center gap-2">
											<button
												type="button"
												tabIndex={-1}
												onClick={() => void copyText(`tag:${key}`, temp.beamioTag)}
												className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadcf7] bg-[#f5ecff] px-3 py-1.5 text-[13px] font-semibold text-[#8d3a8b]"
												aria-label="Copy temp Beamio ID"
											>
												<span className="truncate">@{temp.beamioTag}</span>
												{copiedKey === `tag:${key}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
											</button>
											<button
												type="button"
												tabIndex={-1}
												onClick={() => void copyText(`eoa:${key}`, temp.eoa)}
												className="inline-flex items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-3 py-1.5 font-mono text-[11px] text-[#424655]"
												aria-label="Copy temp address"
											>
												{shortAddress(temp.eoa)}
												{copiedKey === `eoa:${key}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
											</button>
										</div>
										<div className="mt-3 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800">
											<span className="min-w-0 flex-1 truncate">{showPw ? temp.accessPassword : '••••••••••••'}</span>
											<button
												type="button"
												tabIndex={-1}
												aria-label={showPw ? 'Hide access password' : 'Show access password'}
												onClick={() => setRevealPw((prev) => ({ ...prev, [key]: !prev[key] }))}
												className="inline-flex h-6 w-6 items-center justify-center"
											>
												{showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
											</button>
											<button
												type="button"
												tabIndex={-1}
												aria-label="Copy access password"
												onClick={() => void copyText(`pw:${key}`, temp.accessPassword)}
												className="inline-flex h-6 w-6 items-center justify-center"
											>
												{copiedKey === `pw:${key}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
											</button>
										</div>
										{mustCreate ? (
											<button
												type="button"
												onClick={() => openExternalUrl(merchantOsUnlockUrl(temp.beamioTag, temp.accessPassword))}
												className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8d3a8b]/30 bg-[#f5ecff] px-3 py-2.5 text-sm font-semibold text-[#8d3a8b]"
											>
												<Plus className="h-4 w-4" aria-hidden />
												Create merchant card
												<ExternalLink className="h-3.5 w-3.5" aria-hidden />
											</button>
										) : null}
										{canOpen ? (
											<button
												type="button"
												onClick={() => openExternalUrl(merchantOsUnlockUrl(temp.beamioTag, temp.accessPassword))}
												className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8d3a8b]/30 bg-[#f5ecff] px-3 py-2.5 text-sm font-semibold text-[#8d3a8b]"
											>
												<Store className="h-4 w-4" aria-hidden />
												Open Merchant OS
												<ExternalLink className="h-3.5 w-3.5" aria-hidden />
											</button>
										) : null}
										{!hasSnapshot && cardState?.loading ? (
											<div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500">
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
												Loading merchant cards
											</div>
										) : null}
										<div className="mt-3 mb-2 flex items-center justify-between">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Merchant cards</p>
											<button
												type="button"
												tabIndex={-1}
												onClick={() => void refreshCards(temp)}
												disabled={cardState?.loading}
												className="text-xs text-[#8d3a8b] disabled:opacity-50"
											>
												Refresh
											</button>
										</div>
										{cardState?.error ? (
											<p className="py-2 text-sm text-amber-700" role="alert">{cardState.error}</p>
										) : null}
										{mustCreate ? (
											<p className="py-2 text-sm text-slate-500">No program card on this temp account yet.</p>
										) : null}
										<ul className="space-y-2">
											{cards.map((card) => (
												<li key={card.cardAddress}>
													{card.transferred ? (
														<div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3">
															<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
															<div className="min-w-0">
																<p className="text-sm font-semibold text-amber-900">Transferred</p>
																<p className="mt-0.5 truncate text-xs text-amber-800">{card.name}</p>
																<p className="mt-1 font-mono text-[11px] text-amber-800">{shortAddress(card.cardAddress)}</p>
																<p className="mt-2 text-xs text-amber-800">Ownership has moved. This card can no longer be managed from the agent workspace.</p>
															</div>
														</div>
													) : (
														<button
															type="button"
															onClick={() => openExternalUrl(merchantOsUnlockUrl(temp.beamioTag, temp.accessPassword))}
															className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-left dark:border-slate-700"
														>
															<div className="min-w-0 flex-1">
																<p className="truncate text-sm font-semibold">{card.name}</p>
																<p className="mt-1 font-mono text-[11px] text-slate-500">{shortAddress(card.cardAddress)}</p>
															</div>
															<ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
														</button>
													)}
												</li>
											))}
										</ul>
										{itemError[key] ? (
											<div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
												<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
												<p>{itemError[key]}</p>
											</div>
										) : null}
										{mustCreate || canOpen ? (
											<p className="mt-2 text-xs leading-relaxed text-slate-500">
												Opens Merchant OS and unlocks this temp account so you can {canOpen ? 'manage' : 'create'} the program card.
											</p>
										) : null}
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
