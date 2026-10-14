import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	AlertTriangle,
	Check,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	Link2,
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
	findAgentWorkspaceByTempEoa,
	loadAgentWorkspace,
	type AgentTempEoaRecord,
	type AgentWorkspaceRecord,
} from '@/utils/agentWorkspaceLocal'
import {
	claimTempCreateMerchantCardNft,
	createAgentTempEoa,
	listTempEoaCardsWithTransferStatus,
	openTempMerchantCard,
	openTempMerchantWorkspace,
	returnToAgentWorkspace,
	syncTempKnownCardsFromChain,
	type AgentTempCardRow,
} from '@/utils/agentTempEoaOps'
import { getSessionAgentAccessPassword } from '@/utils/agentSessionSecrets'
import { maybeRegisterMerchantAfterTempHandoff } from '@/utils/agentReferrerRegistryClient'
import { AddressCapsule } from '@/components/AddressCapsule'
import { queryBusinessStartKetBalanceOfOnChain } from '@/services/BeamioCard'

/** Consumer invite URL: app-download unwraps `target=` → `/app/?invite=0x…`. */
function buildAgentInviteAppUrl(introducerEoa: string): string {
	const addr = introducerEoa?.trim()
	if (!addr || !ethers.isAddress(addr)) return ''
	const checksummed = ethers.getAddress(addr)
	const app = `https://beamio.app/app/?invite=${checksummed}`
	return `https://beamio.app/app-download?target=${encodeURIComponent(app)}`
}

async function tempOwnsCreateMerchantCardNft(
	temp: AgentTempEoaRecord,
): Promise<'owns' | 'missing' | 'unavailable'> {
	const rawTargets = [temp.eoa, temp.aaAccount]
		.map((a) => (typeof a === 'string' ? a.trim() : ''))
		.filter((a) => a && ethers.isAddress(a))
	const targets = [...new Set(rawTargets.map((a) => ethers.getAddress(a)))]
	if (targets.length === 0) return 'unavailable'
	let anyOk = false
	let anyPositive = false
	for (const addr of targets) {
		const r = await queryBusinessStartKetBalanceOfOnChain(addr, 0n)
		if (r.ok) {
			anyOk = true
			if (r.balance > 0n) anyPositive = true
		}
	}
	if (!anyOk) return 'unavailable'
	return anyPositive ? 'owns' : 'missing'
}

type RevealState = Record<string, boolean>
type CardsByTemp = Record<string, { loading: boolean; rows: AgentTempCardRow[]; error?: string }>
type KetByTemp = Record<string, { status: 'loading' | 'owns' | 'missing' | 'unavailable' }>
type RedeemByTemp = Record<string, string>

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
	const [ketByTemp, setKetByTemp] = useState<KetByTemp>({})
	const [redeemByTemp, setRedeemByTemp] = useState<RedeemByTemp>({})
	const [openingKey, setOpeningKey] = useState<string | null>(null)
	const [openError, setOpenError] = useState('')
	const [missingAgentPassword, setMissingAgentPassword] = useState(false)
	/** Session wallet is a temp EOA — show return-to-agent recovery UI. */
	const [stuckOnTemp, setStuckOnTemp] = useState(false)
	const [returnPassword, setReturnPassword] = useState('')
	const [returningToAgent, setReturningToAgent] = useState(false)
	const [returnError, setReturnError] = useState('')
	const autoReturnAttempted = useRef(false)
	/**
	 * Set before openTempMerchantWorkspace when we intentionally leave this page
	 * (onboarding / Merchant OS). Prevents hydrate from flashing the stuck-on-temp
	 * password banner and auto-return from racing the navigation.
	 */
	const leavingForTempNavRef = useRef(false)

	const hydrate = useCallback(() => {
		if (!agentEoa || !ethers.isAddress(agentEoa)) {
			setWorkspace(null)
			setStuckOnTemp(false)
			return
		}
		const addr = ethers.getAddress(agentEoa)
		// If the session is still a temp EOA, never write a fake agent workspace under that key.
		const byTemp = findAgentWorkspaceByTempEoa(addr)
		if (byTemp) {
			setWorkspace(byTemp)
			// Intentional leave (Create merchant card / Open Merchant OS): keep the
			// card list layout stable until the route unmounts — do not insert the
			// stuck-on-temp alert (that was the pre-navigate panel shake).
			if (leavingForTempNavRef.current) {
				setStuckOnTemp(false)
				return
			}
			setStuckOnTemp(true)
			setMissingAgentPassword(!getSessionAgentAccessPassword())
			return
		}
		const ws = agentTag
			? ensureAgentWorkspace(addr, agentTag)
			: loadAgentWorkspace(addr)
		setWorkspace(ws)
		setStuckOnTemp(false)
		setMissingAgentPassword(!getSessionAgentAccessPassword())
	}, [agentEoa, agentTag])

	useEffect(() => {
		hydrate()
	}, [hydrate])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	/** Auto-restore agent when we still have the session password. */
	useEffect(() => {
		if (leavingForTempNavRef.current) return
		if (!stuckOnTemp || autoReturnAttempted.current || returningToAgent) return
		const pw = getSessionAgentAccessPassword()
		if (!pw) return
		autoReturnAttempted.current = true
		setReturningToAgent(true)
		setReturnError('')
		void (async () => {
			try {
				if (leavingForTempNavRef.current) return
				const ok = await returnToAgentWorkspace(unlockDeps)
				if (leavingForTempNavRef.current) return
				if (ok) {
					hydrate()
					return
				}
				setMissingAgentPassword(true)
				setReturnError(tu('agent_return_failed'))
			} finally {
				if (!leavingForTempNavRef.current) setReturningToAgent(false)
			}
		})()
	}, [stuckOnTemp, returningToAgent, unlockDeps, hydrate, tu])

	const handleReturnWithPassword = useCallback(async () => {
		if (returningToAgent) return
		const pw = returnPassword.trim()
		if (!pw) {
			setReturnError(tu('agent_return_need_password'))
			return
		}
		setReturningToAgent(true)
		setReturnError('')
		try {
			const ok = await returnToAgentWorkspace(unlockDeps, { agentPassword: pw })
			if (ok) {
				setReturnPassword('')
				setStuckOnTemp(false)
				setMissingAgentPassword(false)
				hydrate()
				return
			}
			setReturnError(tu('agent_return_failed'))
		} finally {
			setReturningToAgent(false)
		}
	}, [returningToAgent, returnPassword, unlockDeps, hydrate, tu])

	const loadKetForTemp = useCallback(async (temp: AgentTempEoaRecord) => {
		const key = temp.eoa.toLowerCase()
		// Stale-while-revalidate: keep owns/missing/unavailable UI; only show
		// loading when this temp has never been checked.
		setKetByTemp((prev) => {
			const cur = prev[key]?.status
			if (cur === 'owns' || cur === 'missing' || cur === 'unavailable') return prev
			return { ...prev, [key]: { status: 'loading' } }
		})
		const status = await tempOwnsCreateMerchantCardNft(temp)
		setKetByTemp((prev) => ({
			...prev,
			[key]: { status },
		}))
	}, [])

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
					// When a card owner left the temp EOA, register that merchant under the agent.
					for (const row of rows) {
						if (!row.transferred || !row.owner || !ethers.isAddress(row.owner)) continue
						void maybeRegisterMerchantAfterTempHandoff({
							agentEoa,
							tempEoa: temp.eoa,
							merchantEoa: row.owner,
						}).catch(() => {
							/* best-effort; next refresh retries */
						})
					}
				}
				setCardsByTemp((prev) => ({
					...prev,
					[key]: { loading: false, rows },
				}))
				const manageable = rows.filter((r) => !r.transferred)
				if (manageable.length === 0) {
					void loadKetForTemp(temp)
				} else {
					setKetByTemp((prev) => {
						if (!prev[key]) return prev
						const next = { ...prev }
						delete next[key]
						return next
					})
				}
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
		[agentEoa, loadKetForTemp, tu],
	)

	const cardsByTempRef = useRef(cardsByTemp)
	cardsByTempRef.current = cardsByTemp

	// Only auto-load newly added temps. Re-running for every temp on Add would
	// flip existing panels into loading / ket-checking and cause layout shake.
	useEffect(() => {
		if (!workspace?.temps?.length) return
		for (const t of workspace.temps) {
			const key = t.eoa.toLowerCase()
			if (cardsByTempRef.current[key]) continue
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
		if (openingKey || missingAgentPassword) return
		const key = `ws:${temp.eoa}`
		setOpenError('')
		setOpeningKey(key)
		leavingForTempNavRef.current = true
		try {
			const result = await openTempMerchantWorkspace(temp, unlockDeps)
			if (!result.ok) {
				leavingForTempNavRef.current = false
				setOpenError(
					result.reason === 'missing_agent_password'
						? tu('agent_password_session_missing')
						: tu('agent_open_workspace_failed'),
				)
				if (result.reason === 'missing_agent_password') setMissingAgentPassword(true)
				setOpeningKey(null)
				return
			}
			navigate('/native-pos')
			// Keep busy until unmount — clearing openingKey after session switch
			// races hydrate and flashes the stuck-on-temp banner.
		} catch {
			leavingForTempNavRef.current = false
			setOpenError(tu('agent_open_workspace_failed'))
			setOpeningKey(null)
		}
	}

	/** Create merchant card — only when temp already holds BusinessStartKet #0. */
	const handleCreateMerchantCard = async (temp: AgentTempEoaRecord) => {
		if (openingKey || missingAgentPassword) return
		const tempKey = temp.eoa.toLowerCase()
		const key = `create:${temp.eoa}`
		setOpenError('')
		setOpeningKey(key)
		leavingForTempNavRef.current = true
		try {
			// Skip re-check when UI already shows owns — avoids ket UI swap mid-click.
			const known = ketByTemp[tempKey]?.status
			let ketStatus = known
			if (ketStatus !== 'owns') {
				ketStatus = await tempOwnsCreateMerchantCardNft(temp)
				setKetByTemp((prev) => ({
					...prev,
					[tempKey]: { status: ketStatus },
				}))
			}
			if (ketStatus !== 'owns') {
				leavingForTempNavRef.current = false
				setOpenError(
					ketStatus === 'unavailable'
						? tu('agent_create_nft_check_failed')
						: tu('agent_temp_needs_create_nft'),
				)
				setOpeningKey(null)
				return
			}
			const result = await openTempMerchantWorkspace(temp, unlockDeps)
			if (!result.ok) {
				leavingForTempNavRef.current = false
				setOpenError(
					result.reason === 'missing_agent_password'
						? tu('agent_password_session_missing')
						: tu('agent_open_workspace_failed'),
				)
				if (result.reason === 'missing_agent_password') setMissingAgentPassword(true)
				setOpeningKey(null)
				return
			}
			navigate('/agent/merchant-onboarding')
		} catch {
			leavingForTempNavRef.current = false
			setOpenError(tu('agent_create_nft_check_failed'))
			setOpeningKey(null)
		}
	}

	/** Claim BusinessStartKet #0 onto the temp EOA via redeem / Start Kit code. */
	const handleClaimCreateNft = async (temp: AgentTempEoaRecord) => {
		if (openingKey) return
		const key = `claim:${temp.eoa}`
		const code = (redeemByTemp[temp.eoa.toLowerCase()] ?? '').trim()
		if (!code) {
			setOpenError(tu('agent_redeem_code_required'))
			return
		}
		setOpenError('')
		setOpeningKey(key)
		try {
			const result = await claimTempCreateMerchantCardNft(temp, code, unlockDeps)
			if (!result.ok) {
				setOpenError(result.error || tu('agent_redeem_claim_failed'))
				return
			}
			setRedeemByTemp((prev) => {
				const next = { ...prev }
				delete next[temp.eoa.toLowerCase()]
				return next
			})
			await loadKetForTemp(temp)
		} catch {
			setOpenError(tu('agent_redeem_claim_failed'))
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
				<div className="mb-2 flex items-center justify-end">
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

				{agentEoa && ethers.isAddress(agentEoa) ? (
					<section
						className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
						aria-label={tu('agent_invite_section_label')}
					>
						<div className="mb-2 flex items-center gap-2 text-[#c4a0c8]">
							<Link2 className="h-4 w-4 shrink-0" aria-hidden />
							<p className="text-sm font-semibold text-white">{tu('agent_invite_title')}</p>
						</div>
						<p className="mb-3 text-xs leading-relaxed text-slate-400">
							{tu('agent_invite_hint')}
						</p>
						<button
							type="button"
							onClick={() => {
								const url = buildAgentInviteAppUrl(agentEoa)
								if (!url) return
								void copyText('invite', url)
							}}
							className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#eadcf7]/35 bg-[#8d3a8b]/30 px-3 py-2.5 text-sm font-semibold text-[#f5ecff] transition hover:bg-[#8d3a8b]/45"
							aria-label={tu('agent_invite_copy')}
						>
							{copiedKey === 'invite' ? (
								<Check className="h-4 w-4 text-emerald-400" aria-hidden />
							) : (
								<Copy className="h-4 w-4" aria-hidden />
							)}
							{copiedKey === 'invite' ? tu('agent_copied') : tu('agent_invite_copy')}
						</button>
					</section>
				) : null}

				{stuckOnTemp || missingAgentPassword ? (
					<div
						role="alert"
						className="mb-4 space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
					>
						<div className="flex gap-3">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>
								{stuckOnTemp
									? tu('agent_return_need_password')
									: tu('agent_password_session_missing')}
							</p>
						</div>
						{stuckOnTemp ? (
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<label className="sr-only" htmlFor="agent-return-password">
									{tu('agent_return_password_label')}
								</label>
								<input
									id="agent-return-password"
									type="password"
									autoComplete="current-password"
									value={returnPassword}
									onChange={(e) => setReturnPassword(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void handleReturnWithPassword()
									}}
									placeholder={tu('agent_return_password_placeholder')}
									disabled={returningToAgent}
									className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#050b1d]/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#8d3a8b] focus:outline-none"
								/>
								<button
									type="button"
									onClick={() => void handleReturnWithPassword()}
									disabled={returningToAgent || !returnPassword.trim()}
									aria-busy={returningToAgent}
									className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8d3a8b] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
								>
									{returningToAgent ? (
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									) : null}
									{tu('agent_return_retry')}
								</button>
							</div>
						) : null}
						{returnError ? <p className="text-amber-50/90">{returnError}</p> : null}
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
							const cardRows = cardState?.rows ?? []
							const cardsLoading = !!cardState?.loading
							const manageableCardCount = cardRows.filter((row) => !row.transferred).length
							// Gate Open Merchant OS until at least one owned (non-transferred) card exists.
							// Once we have a card snapshot, keep CTA height stable while refreshing
							// (do not swap redeem / Create for a loading row).
							const hasCardSnapshot = !!cardState
							const mustCreateCardFirst = hasCardSnapshot && manageableCardCount === 0
							const canOpenMerchantOs = manageableCardCount > 0
							const showCardGateLoading = !hasCardSnapshot && cardsLoading
							const ketState = ketByTemp[key]
							const ketStatus = ketState?.status
							const ketLoading =
								mustCreateCardFirst && (!ketState || ketStatus === 'loading')
							const ketOwns = mustCreateCardFirst && ketStatus === 'owns'
							const ketMissing =
								mustCreateCardFirst
								&& (ketStatus === 'missing' || ketStatus === 'unavailable')
							const redeemCode = redeemByTemp[key] ?? ''
							const claimBusy = openingKey === `claim:${temp.eoa}`
							const createBusy = openingKey === `create:${temp.eoa}`
							return (
								<li
									key={key}
									className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-lg backdrop-blur-md"
								>
									<div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
										<button
											type="button"
											tabIndex={-1}
											onClick={() => void copyText(`tag:${key}`, temp.beamioTag)}
											className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadcf7]/40 bg-[#8d3a8b]/25 py-1.5 pl-3 pr-2 text-[13px] font-semibold text-[#f5ecff] transition hover:bg-[#8d3a8b]/40"
											aria-label={tu('agent_copy_tag')}
											title={tu('agent_copy_tag')}
										>
											<span className="min-w-0 truncate">@{temp.beamioTag}</span>
											{copiedKey === `tag:${key}` ? (
												<Check size={12} className="shrink-0 text-emerald-400" aria-hidden />
											) : (
												<Copy size={12} className="shrink-0 opacity-70" aria-hidden />
											)}
										</button>
										<AddressCapsule
											address={temp.eoa}
											className="max-w-full border-[#dce2f7]/30 bg-[#e9edff]/10 text-slate-200"
										/>
										<div
											className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-black/25 py-1.5 pl-3 pr-1.5 font-mono text-[11px] font-semibold text-slate-200"
											title={tu('agent_access_password')}
										>
											<span className="min-w-0 max-w-[9rem] truncate tracking-wide">
												{showPw ? temp.accessPassword : '••••••••••••'}
											</span>
											<button
												type="button"
												tabIndex={-1}
												onClick={() =>
													setRevealPw((prev) => ({ ...prev, [key]: !prev[key] }))
												}
												className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-70 transition hover:bg-white/10 hover:opacity-100"
												aria-label={
													showPw ? tu('agent_hide_password') : tu('agent_show_password')
												}
											>
												{showPw ? (
													<EyeOff size={12} aria-hidden />
												) : (
													<Eye size={12} aria-hidden />
												)}
											</button>
											<button
												type="button"
												tabIndex={-1}
												onClick={() => void copyText(`pw:${key}`, temp.accessPassword)}
												className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-70 transition hover:bg-white/10 hover:opacity-100"
												aria-label={tu('agent_copy_password')}
												title={tu('agent_copy_password')}
											>
												{copiedKey === `pw:${key}` ? (
													<Check size={12} className="text-emerald-400" aria-hidden />
												) : (
													<Copy size={12} aria-hidden />
												)}
											</button>
										</div>
									</div>

									{ketLoading ? (
										<div className="mb-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400">
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											{tu('agent_checking_create_nft')}
										</div>
									) : null}

									{ketMissing ? (
										<div className="mb-3 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={redeemCode}
													onChange={(e) =>
														setRedeemByTemp((prev) => ({
															...prev,
															[key]: e.target.value,
														}))
													}
													onKeyDown={(e) => {
														if (e.key !== 'Enter') return
														e.preventDefault()
														if (openingKey || !redeemCode.trim() || claimBusy) return
														void handleClaimCreateNft(temp)
													}}
													placeholder={tu('agent_redeem_code_placeholder')}
													aria-label={tu('agent_redeem_code_label')}
													autoComplete="off"
													spellCheck={false}
													disabled={!!openingKey}
													enterKeyHint="done"
													className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#8d3a8b]/60"
												/>
												<button
													type="button"
													tabIndex={-1}
													onClick={() => void handleClaimCreateNft(temp)}
													disabled={!!openingKey || !redeemCode.trim() || claimBusy}
													aria-busy={claimBusy}
													aria-label={tu('agent_claim_create_nft')}
													title={tu('agent_claim_create_nft')}
													className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#eadcf7]/40 bg-[#8d3a8b]/25 text-[#f5ecff] transition hover:bg-[#8d3a8b]/40 disabled:cursor-not-allowed disabled:opacity-60"
												>
													{claimBusy ? (
														<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
													) : (
														<Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
													)}
												</button>
											</div>
											{ketStatus === 'unavailable' ? (
												<button
													type="button"
													tabIndex={-1}
													onClick={() => void loadKetForTemp(temp)}
													disabled={!!openingKey}
													className="w-full text-center text-xs text-[#c4a0c8] hover:underline disabled:opacity-50"
												>
													{tu('agent_retry_create_nft_check')}
												</button>
											) : null}
										</div>
									) : null}

									{ketOwns ? (
										<button
											type="button"
											onClick={() => void handleCreateMerchantCard(temp)}
											disabled={!!openingKey || missingAgentPassword}
											aria-busy={createBusy}
											className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#eadcf7]/40 bg-[#8d3a8b]/25 px-3 py-2.5 text-sm font-semibold text-[#f5ecff] transition hover:bg-[#8d3a8b]/40 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{createBusy ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : (
												<Plus className="h-4 w-4" aria-hidden />
											)}
											{tu('agent_create_merchant_card')}
										</button>
									) : null}

									{canOpenMerchantOs ? (
										<button
											type="button"
											onClick={() => void handleOpenWorkspace(temp)}
											disabled={!!openingKey || missingAgentPassword}
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
									) : null}

									{showCardGateLoading ? (
										<div className="mb-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400">
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											{tu('agent_loading_cards')}
										</div>
									) : null}

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

									{cardState?.error ? (
										<p className="py-2 text-sm text-amber-200" role="alert">
											{cardState.error}
										</p>
									) : null}

									{mustCreateCardFirst && !ketLoading && !ketMissing ? (
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
