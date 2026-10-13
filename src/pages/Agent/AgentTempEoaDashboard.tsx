import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	AlertTriangle,
	Check,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	Loader2,
	Plus,
	RefreshCw,
	Wallet,
} from 'lucide-react'
import { ethers } from 'ethers'
import { useTu } from '@/locale/beamioLocale'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useUnlockMerchantWorkspaceDeps } from '@/hooks/useUnlockMerchantWorkspaceDeps'
import { getCoNET_Data } from '@/utils/globals'
import {
	ensureAgentWorkspace,
	loadAgentWorkspace,
	type AgentTempEoaRecord,
	type AgentWorkspaceRecord,
} from '@/utils/agentWorkspaceLocal'
import {
	createAgentTempEoa,
	listTempEoaCardsWithTransferStatus,
	openTempMerchantCard,
	openTempMerchantWorkspace,
	syncTempKnownCardsFromChain,
	type AgentTempCardRow,
} from '@/utils/agentTempEoaOps'
import { getSessionAgentAccessPassword } from '@/utils/agentSessionSecrets'
import { AddressCapsule } from '@/components/AddressCapsule'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'

type RevealState = Record<string, boolean>
type CardsByTemp = Record<string, { loading: boolean; rows: AgentTempCardRow[]; error?: string }>

export default function AgentTempEoaDashboard() {
	const { tu } = useTu()
	const navigate = useNavigate()
	const { profiles, beamio, setShowFooter } = useDaemonContext()
	const unlockDeps = useUnlockMerchantWorkspaceDeps()

	const agentEoa = profiles?.[0]?.keyID?.trim() ?? getCoNET_Data()?.profiles?.[0]?.keyID?.trim() ?? ''
	const agentTag =
		beamio?.accountName?.trim()
		|| getCoNET_Data()?.beamio?.accountName?.trim()
		|| ''

	const [workspace, setWorkspace] = useState<AgentWorkspaceRecord | null>(null)
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [revealPw, setRevealPw] = useState<RevealState>({})
	const [copiedKey, setCopiedKey] = useState<string | null>(null)
	const [cardsByTemp, setCardsByTemp] = useState<CardsByTemp>({})
	const [openingKey, setOpeningKey] = useState<string | null>(null)
	const [openError, setOpenError] = useState('')
	const [missingAgentPassword, setMissingAgentPassword] = useState(false)

	const hydrate = useCallback(() => {
		if (!agentEoa || !ethers.isAddress(agentEoa)) {
			setWorkspace(null)
			return
		}
		const ws = agentTag
			? ensureAgentWorkspace(agentEoa, agentTag)
			: loadAgentWorkspace(agentEoa)
		setWorkspace(ws)
		setMissingAgentPassword(!getSessionAgentAccessPassword())
	}, [agentEoa, agentTag])

	useEffect(() => {
		hydrate()
	}, [hydrate])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const loadCardsForTemp = useCallback(
		async (temp: AgentTempEoaRecord) => {
			const key = temp.eoa.toLowerCase()
			setCardsByTemp((prev) => ({
				...prev,
				[key]: { loading: true, rows: prev[key]?.rows ?? [], error: undefined },
			}))
			try {
				const rows = await listTempEoaCardsWithTransferStatus(
					temp.eoa,
					temp.knownCardAddresses ?? [],
				)
				if (agentEoa && ethers.isAddress(agentEoa)) {
					syncTempKnownCardsFromChain(agentEoa, temp.eoa, rows)
				}
				setCardsByTemp((prev) => ({
					...prev,
					[key]: { loading: false, rows },
				}))
			} catch (e) {
				setCardsByTemp((prev) => ({
					...prev,
					[key]: {
						loading: false,
						rows: prev[key]?.rows ?? [],
						error: (e as Error)?.message || tu('agent_cards_load_failed'),
					},
				}))
			}
		},
		[agentEoa, tu],
	)

	useEffect(() => {
		if (!workspace?.temps?.length) return
		for (const t of workspace.temps) {
			void loadCardsForTemp(t)
		}
	}, [workspace?.temps, loadCardsForTemp])

	const handleCreateTemp = async () => {
		if (creating) return
		setCreateError('')
		setCreating(true)
		try {
			const { workspace: next } = await createAgentTempEoa(unlockDeps)
			setWorkspace(next)
			setMissingAgentPassword(false)
		} catch (e) {
			setCreateError((e as Error)?.message || tu('agent_create_temp_failed'))
		} finally {
			setCreating(false)
		}
	}

	const copyText = async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
		} catch {
			/* ignore */
		}
	}

	const handleOpenWorkspace = async (temp: AgentTempEoaRecord) => {
		if (openingKey) return
		const key = `ws:${temp.eoa}`
		setOpenError('')
		setOpeningKey(key)
		try {
			const result = await openTempMerchantWorkspace(temp, unlockDeps)
			if (!result.ok) {
				setOpenError(tu('agent_open_workspace_failed'))
				return
			}
			navigate('/native-pos')
		} catch {
			setOpenError(tu('agent_open_workspace_failed'))
		} finally {
			setOpeningKey(null)
		}
	}

	const handleOpenCard = async (temp: AgentTempEoaRecord, card: AgentTempCardRow) => {
		if (card.transferred || openingKey) return
		const key = `${temp.eoa}:${card.cardAddress}`
		setOpenError('')
		setOpeningKey(key)
		try {
			const result = await openTempMerchantCard(temp, card.cardAddress, unlockDeps)
			if (!result.ok) {
				if (result.reason === 'transferred') {
					setOpenError(tu('agent_card_transferred_blocked'))
					void loadCardsForTemp(temp)
				} else {
					setOpenError(tu('agent_open_card_failed'))
				}
				return
			}
			navigate('/native-pos')
		} catch {
			setOpenError(tu('agent_open_card_failed'))
		} finally {
			setOpeningKey(null)
		}
	}

	if (!agentEoa || !ethers.isAddress(agentEoa)) {
		return (
			<div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F6F8] px-4">
				<p className="text-center text-[#666666]">{tu('agent_session_required')}</p>
			</div>
		)
	}

	const temps = workspace?.temps ?? []

	return (
		<div
			className="relative min-h-[100dvh] bg-[#050b1d] text-slate-100"
			style={{
				paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
				paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
			}}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(141,58,139,0.35),_transparent_60%)]"
				aria-hidden
			/>

			<div className="relative z-10 mx-auto w-full max-w-2xl px-4">
				<div className="mb-2 flex items-center justify-between">
					<BeamioCircularBackButton
						variant="onDark"
						onClick={() => navigate('/')}
						aria-label={tu('agent_back_home')}
					/>
					<button
						type="button"
						onClick={() => {
							hydrate()
							for (const t of temps) void loadCardsForTemp(t)
						}}
						className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md"
						aria-label={tu('agent_refresh')}
						tabIndex={-1}
					>
						<RefreshCw className="h-4 w-4" aria-hidden />
					</button>
				</div>

				<header className="pb-7 pt-8">
					<p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c4a0c8]">
						{tu('agent_dashboard_eyebrow')}
					</p>
					<h1 className="text-3xl font-semibold tracking-tight text-white">
						{tu('agent_dashboard_title')}
					</h1>
					<p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
						{tu('agent_dashboard_sub')}
					</p>
					{agentTag ? (
						<p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#eadcf7]/40 bg-[#8d3a8b]/25 px-3 py-1 text-sm text-[#f5ecff]">
							<span className="font-semibold">@{agentTag}</span>
						</p>
					) : null}
				</header>

				{missingAgentPassword ? (
					<div
						role="alert"
						className="mb-4 flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{tu('agent_password_session_missing')}</p>
					</div>
				) : null}

				{createError ? (
					<div
						role="alert"
						className="mb-4 flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{createError}</p>
					</div>
				) : null}

				{openError ? (
					<div
						role="alert"
						className="mb-4 flex gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{openError}</p>
					</div>
				) : null}

				<button
					type="button"
					onClick={() => void handleCreateTemp()}
					disabled={creating || missingAgentPassword}
					aria-busy={creating}
					className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8d3a8b] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#8d3a8b]/30 transition enabled:hover:bg-[#7a3178] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{creating ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<Plus className="h-4 w-4" aria-hidden />
					)}
					{creating ? tu('agent_creating_temp') : tu('agent_add_temp_eoa')}
				</button>

				{temps.length === 0 ? (
					<div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center">
						<Wallet className="mx-auto mb-3 h-8 w-8 text-slate-500" aria-hidden />
						<p className="text-sm text-slate-400">{tu('agent_no_temps')}</p>
					</div>
				) : (
					<ul className="space-y-4">
						{temps.map((temp) => {
							const key = temp.eoa.toLowerCase()
							const cardState = cardsByTemp[key]
							const showPw = !!revealPw[key]
							return (
								<li
									key={key}
									className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-lg backdrop-blur-md"
								>
									<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-base font-semibold text-white">@{temp.beamioTag}</p>
											<div className="mt-1.5">
												<AddressCapsule
													address={temp.eoa}
													className="max-w-full border-[#dce2f7]/30 bg-[#e9edff]/10 text-slate-200"
												/>
											</div>
										</div>
										<span className="rounded-full border border-[#eadcf7]/30 bg-[#8d3a8b]/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#f5ecff]">
											{tu('agent_temp_badge')}
										</span>
									</div>

									<div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
										<div className="mb-1 flex items-center justify-between gap-2">
											<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
												{tu('agent_access_password')}
											</span>
											<div className="flex items-center gap-1">
												<button
													type="button"
													tabIndex={-1}
													onClick={() =>
														setRevealPw((prev) => ({ ...prev, [key]: !prev[key] }))
													}
													className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
													aria-label={showPw ? tu('agent_hide_password') : tu('agent_show_password')}
												>
													{showPw ? (
														<EyeOff className="h-4 w-4" aria-hidden />
													) : (
														<Eye className="h-4 w-4" aria-hidden />
													)}
												</button>
												<button
													type="button"
													tabIndex={-1}
													onClick={() => void copyText(`pw:${key}`, temp.accessPassword)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
													aria-label={tu('agent_copy_password')}
												>
													{copiedKey === `pw:${key}` ? (
														<Check className="h-4 w-4 text-emerald-400" aria-hidden />
													) : (
														<Copy className="h-4 w-4" aria-hidden />
													)}
												</button>
											</div>
										</div>
										<p className="font-mono text-sm tracking-wide text-slate-100">
											{showPw ? temp.accessPassword : '••••••••••••'}
										</p>
										<button
											type="button"
											tabIndex={-1}
											onClick={() => void copyText(`tag:${key}`, temp.beamioTag)}
											className="mt-2 text-left text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
										>
											{copiedKey === `tag:${key}`
												? tu('agent_copied')
												: tu('agent_copy_tag')}
										</button>
									</div>

									<button
										type="button"
										onClick={() => void handleOpenWorkspace(temp)}
										disabled={!!openingKey}
										aria-busy={openingKey === `ws:${temp.eoa}`}
										className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#eadcf7]/40 bg-[#8d3a8b]/25 px-3 py-2.5 text-sm font-semibold text-[#f5ecff] transition hover:bg-[#8d3a8b]/40 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{openingKey === `ws:${temp.eoa}` ? (
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										) : (
											<Wallet className="h-4 w-4" aria-hidden />
										)}
										{tu('agent_open_merchant_os')}
									</button>

									<div className="mb-2 flex items-center justify-between">
										<p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
											{tu('agent_merchant_cards')}
										</p>
										<button
											type="button"
											tabIndex={-1}
											onClick={() => void loadCardsForTemp(temp)}
											disabled={cardState?.loading}
											className="text-xs text-[#c4a0c8] hover:underline disabled:opacity-50"
										>
											{tu('agent_refresh_cards')}
										</button>
									</div>

									{cardState?.loading && !cardState.rows.length ? (
										<div className="flex items-center gap-2 py-3 text-sm text-slate-400">
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											{tu('agent_loading_cards')}
										</div>
									) : null}

									{cardState?.error ? (
										<p className="py-2 text-sm text-amber-200" role="alert">
											{cardState.error}
										</p>
									) : null}

									{!cardState?.loading && (cardState?.rows?.length ?? 0) === 0 ? (
										<p className="py-3 text-sm text-slate-500">{tu('agent_no_cards_for_temp')}</p>
									) : null}

									<ul className="space-y-2">
										{(cardState?.rows ?? []).map((card) => {
											const openKey = `${temp.eoa}:${card.cardAddress}`
											const busy = openingKey === openKey
											return (
												<li key={card.cardAddress}>
													{card.transferred ? (
														<div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3">
															<AlertTriangle
																className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
																aria-hidden
															/>
															<div className="min-w-0 flex-1">
																<p className="text-sm font-semibold text-amber-100">
																	{tu('agent_card_transferred_status')}
																</p>
																<p className="mt-0.5 truncate text-xs text-amber-100/70">
																	{card.name || card.cardAddress}
																</p>
																<div className="mt-2 opacity-80">
																	<AddressCapsule
																		address={card.cardAddress}
																		className="max-w-full border-amber-200/20 bg-amber-100/5 text-amber-50"
																	/>
																</div>
																<p className="mt-2 text-xs text-amber-100/80">
																	{tu('agent_card_transferred_hint')}
																</p>
															</div>
														</div>
													) : (
														<button
															type="button"
															onClick={() => void handleOpenCard(temp, card)}
															disabled={!!openingKey}
															aria-busy={busy}
															className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-[#8d3a8b]/50 hover:bg-[#8d3a8b]/15 disabled:cursor-not-allowed disabled:opacity-60"
														>
															<div className="min-w-0 flex-1">
																<p className="truncate text-sm font-semibold text-white">
																	{card.name || tu('agent_unnamed_card')}
																</p>
																<div className="mt-1.5">
																	<AddressCapsule
																		address={card.cardAddress}
																		className="max-w-full border-[#eadcf7]/25 bg-[#f5ecff]/10 text-slate-200"
																	/>
																</div>
															</div>
															{busy ? (
																<Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#c4a0c8]" aria-hidden />
															) : (
																<ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
															)}
														</button>
													)}
												</li>
											)
										})}
									</ul>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
