import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
	AlertTriangle,
	BadgeCheck,
	Check,
	ChevronDown,
	Code2,
	Copy,
	CreditCard,
	Eye,
	EyeOff,
	ExternalLink,
	KeyRound,
	Loader2,
	Lock,
	Pencil,
	QrCode,
	RefreshCw,
	Send,
	Share2,
	Store,
	UserRound,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { pickMerchantCardListTitle } from '@/utils/merchantCardDatabase'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { buildDiscoverMerchantShareUrl } from '@/utils/discoverMerchantShare'
import { buildAgentCardClaimUrlForTemp } from '@/utils/agentCardClaimDeepLink'
import { registerTempUnderAgent } from '@/utils/agentReferrerRegistryClient'
import {
	isHiddenFromAgentInviteSheet,
	type AgentTempAccount,
	type AgentTempMerchantCard,
} from '@/utils/agentBusinessWorkspace'
import { unlockDetachedRecoverPrivateKey } from '@/services/beamio'

const M_PURPLE = '#8b3e91'
const M_SOFT = '#f6edf9'
const MERCHANT_OS_AGENT_URL = 'https://biz.beamio.app/biz/'

type SubView = 'states' | 'preview' | 'handoff'

export type AgentTempCardsSnapshot = {
	loading: boolean
	rows: AgentTempMerchantCard[]
	error?: string
}

/** Unlock Merchant OS with temp BeamioTag + access password (hash query; stripped on load). */
export function merchantOsUnlockUrl(beamioTag: string, accessPassword: string, flow?: 'business'): string {
	const params = new URLSearchParams({
		tag: beamioTag.replace(/^@/, '').trim(),
		pin: accessPassword,
	})
	if (flow) params.set('flow', flow)
	return `${MERCHANT_OS_AGENT_URL}#/?${params.toString()}`
}

function merchantCardContractCodeUrl(cardAddress: string): string {
	return `https://mainnet.conet.network/address/${encodeURIComponent(cardAddress.trim())}?tab=contract`
}

function shortAddress(address: string): string {
	const raw = address.trim()
	if (raw.length < 12) return raw
	return `${raw.slice(0, 6)}…${raw.slice(-4)}`
}

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

/**
 * Same three account states as Manage on the Business landing:
 * no merchant card, card prepared, and already handed over.
 */
export function AgentTempAccountStates({
	temp,
	cards,
	agentEoa,
	resolveName,
	onRefresh,
}: {
	temp: AgentTempAccount
	cards: AgentTempCardsSnapshot | undefined
	agentEoa: string
	resolveName: (cardAddress: string) => string
	onRefresh: () => void
}) {
	const [subView, setSubView] = useState<SubView>('states')
	const [revealPw, setRevealPw] = useState(false)
	const [copiedKey, setCopiedKey] = useState('')
	const [claimBusy, setClaimBusy] = useState(false)
	const [claimError, setClaimError] = useState('')
	const [claimUrl, setClaimUrl] = useState('')
	const [previewUrl, setPreviewUrl] = useState('')
	const [overlayEntered, setOverlayEntered] = useState(false)
	const [overlayClosing, setOverlayClosing] = useState(false)
	const overlayCloseTimer = useRef<number | undefined>(undefined)

	useEffect(() => {
		if (subView === 'states') return
		setOverlayClosing(false)
		setOverlayEntered(false)
		const frame = requestAnimationFrame(() => setOverlayEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [subView])

	useEffect(
		() => () => {
			if (overlayCloseTimer.current !== undefined) window.clearTimeout(overlayCloseTimer.current)
		},
		[],
	)

	const closeOverlay = () => {
		if (overlayClosing || subView === 'states') return
		setOverlayClosing(true)
		overlayCloseTimer.current = window.setTimeout(() => {
			setSubView('states')
			setOverlayClosing(false)
			setOverlayEntered(false)
			overlayCloseTimer.current = undefined
		}, 300)
	}

	const ready = accountReady(cards?.rows)
	const claimed = accountClaimed(cards?.rows)
	const manageable = primaryManageableCard(cards?.rows)
	const cardsLoading = !!cards?.loading
	const tagPlain = temp.beamioTag.replace(/^@/, '')

	const merchantCardTitle = (card: AgentTempMerchantCard): string =>
		pickMerchantCardListTitle({
			workerName: resolveName(card.cardAddress),
			metaName: card.name,
			fallback: 'Merchant card',
		})

	const businessDisplayName = useMemo(() => {
		if (manageable) return merchantCardTitle(manageable)
		const transferred = visibleCards(cards?.rows ?? []).find((row) => row.transferred)
		if (transferred) return merchantCardTitle(transferred)
		return 'Temporary account'
	}, [manageable, cards?.rows, resolveName])

	const identityTitle = ready || claimed ? businessDisplayName : 'Temporary account'
	const cardInitial =
		(manageable ? merchantCardTitle(manageable) : 'B').trim().charAt(0).toUpperCase() || 'B'

	const copyText = async (key: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 2000)
		} catch {
			/* clipboard may be unavailable */
		}
	}

	const openBusinessOs = async (flow?: 'business') => {
		try {
			await registerTempUnderAgent(temp.eoa)
		} catch {
			/* still open — local sponsored flag covers first create */
		}
		// Unlock-only: wait until AccountRegistry PIN recover is readable (Master lag after create).
		if (!flow) {
			const deadline = Date.now() + 20_000
			while (Date.now() < deadline) {
				const pk = await unlockDetachedRecoverPrivateKey(temp.beamioTag, temp.accessPassword)
				if (pk) break
				await new Promise((resolve) => window.setTimeout(resolve, 1_000))
			}
		}
		openExternalUrl(merchantOsUnlockUrl(temp.beamioTag, temp.accessPassword, flow))
	}

	const openCardPreview = () => {
		if (!manageable || !agentEoa) return
		setPreviewUrl(buildDiscoverMerchantShareUrl(manageable.cardAddress, agentEoa))
		setSubView('preview')
	}

	const openHandoff = async () => {
		if (!manageable || !agentEoa || claimBusy) return
		setClaimBusy(true)
		setClaimError('')
		try {
			const built = await buildAgentCardClaimUrlForTemp({
				temp,
				cardAddress: manageable.cardAddress,
				agentEoa,
				businessName: merchantCardTitle(manageable),
			})
			if (!built.ok) {
				setClaimError(built.error)
				return
			}
			setClaimUrl(built.url)
			setSubView('handoff')
		} catch (err) {
			setClaimError(err instanceof Error ? err.message : 'Could not build the owner link.')
		} finally {
			setClaimBusy(false)
		}
	}

	const temporaryAccountDetails = (
		<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
				<KeyRound className="h-4 w-4 text-[#64748b]" aria-hidden />
				<span className="flex-1">Temporary account details</span>
				<ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
			</summary>
			<div className="space-y-2.5 px-4 pb-1">
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						tabIndex={-1}
						onClick={() => void copyText('tag', temp.beamioTag)}
						className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadcf7] bg-[#f5ecff] px-3 py-1.5 text-[13px] font-semibold text-[#8d3a8b]"
						aria-label="Copy temporary BeamioTag"
					>
						<span className="truncate">@{tagPlain}</span>
						{copiedKey === 'tag' ? (
							<Check className="h-3 w-3 text-emerald-500" />
						) : (
							<Copy className="h-3 w-3" />
						)}
					</button>
					<button
						type="button"
						tabIndex={-1}
						onClick={() => void copyText('eoa', temp.eoa)}
						className="inline-flex items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-3 py-1.5 font-mono text-[11px] text-[#424655]"
						aria-label="Copy account address"
					>
						{shortAddress(temp.eoa)}
						{copiedKey === 'eoa' ? (
							<Check className="h-3 w-3 text-emerald-500" />
						) : (
							<Copy className="h-3 w-3" />
						)}
					</button>
				</div>
				{!claimed ? (
					<>
						<p className="text-[11px] font-medium text-slate-400">Temporary password</p>
						<div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
							<span className="min-w-0 truncate">{revealPw ? temp.accessPassword : '••••••••••••'}</span>
							<button
								type="button"
								tabIndex={-1}
								aria-label={revealPw ? 'Hide password' : 'Show password'}
								onClick={() => setRevealPw((value) => !value)}
								className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
							>
								{revealPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
							</button>
							<button
								type="button"
								tabIndex={-1}
								aria-label="Copy temporary password"
								onClick={() => void copyText('pw', temp.accessPassword)}
								className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
							>
								{copiedKey === 'pw' ? (
									<Check className="h-3 w-3 text-emerald-500" />
								) : (
									<Copy className="h-3 w-3" />
								)}
							</button>
						</div>
						<p className="text-[12px] text-slate-400">
							Temporary access ends when the owner completes onboarding.
						</p>
					</>
				) : null}
			</div>
		</details>
	)

	const overlayShell = (title: string, labelledBy: string, body: React.ReactNode) => {
		if (typeof document === 'undefined') return null
		const offscreen = overlayClosing || !overlayEntered
		return createPortal(
			<div className="fixed inset-0 z-[160]">
				<div
					className="absolute inset-0 flex h-full w-full flex-col overflow-y-auto bg-[#f7f5f8] transition-transform duration-300 ease-out dark:bg-slate-950"
					style={{
						transform: offscreen ? 'translateX(100%)' : 'translateX(0)',
						paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
						paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
					}}
					role="dialog"
					aria-modal="true"
					aria-labelledby={labelledBy}
				>
					<div className="relative flex items-center px-4 pb-2 pt-2">
						<BeamioCircularBackButton variant="onLight" onClick={closeOverlay} aria-label="Back" />
						<h2
							id={labelledBy}
							className="pointer-events-none absolute inset-x-16 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100"
						>
							{title}
						</h2>
					</div>
					<div className="space-y-4 px-4 pb-6 pt-2">{body}</div>
				</div>
			</div>,
			document.body,
		)
	}

	return (
		<div className="space-y-3.5">
			<div className="flex items-start gap-3">
				<span
					className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					{claimed ? (
						<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					) : (
						<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-50">
						{identityTitle}
					</h2>
					<p className="mt-0.5 truncate text-[13px] text-slate-500">@{tagPlain}</p>
				</div>
				<span
					className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
						claimed || ready ? 'bg-[#e7f8ef] text-[#0f7a45]' : 'bg-[#fff3d6] text-[#9a6b00]'
					}`}
				>
					{claimed ? 'Active' : ready ? 'Card ready' : 'Temporary'}
				</span>
			</div>

			{claimed ? (
				<>
					<section className="rounded-[20px] border border-[#b7ebd0] bg-gradient-to-br from-[#f3fff8] to-white p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900">
						<div className="flex items-start gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e7f8ef] text-[#0f7a45]">
								<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
							</span>
							<div className="min-w-0">
								<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">Onboarding complete</h3>
								<p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
									{businessDisplayName} is managed by its owner. Temporary access and the owner onboarding
									link are no longer active.
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => void openBusinessOs()}
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#0f172a] px-4 py-3.5 text-[15px] font-bold text-white"
						>
							Open Business OS
							<ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
						</button>
					</section>
					{temporaryAccountDetails}
					{visibleCards(cards?.rows ?? []).map((card) => (
						<details
							key={card.cardAddress}
							className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900"
						>
							<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
								<Code2 className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
								<span className="min-w-0 flex-1 truncate">Card · {merchantCardTitle(card)}</span>
								<ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
							</summary>
							<div className="space-y-2 px-4 pb-1">
								<div className="flex items-center justify-between gap-2 text-sm">
									<span className="text-slate-500">Card contract</span>
									<strong className="font-mono text-[12px] text-slate-800 dark:text-slate-100">
										{shortAddress(card.cardAddress)}
									</strong>
								</div>
								<button
									type="button"
									onClick={() => openExternalUrl(merchantCardContractCodeUrl(card.cardAddress))}
									className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8b3e91]"
								>
									View on CoNET Explorer
									<ExternalLink className="h-3.5 w-3.5" aria-hidden />
								</button>
							</div>
						</details>
					))}
				</>
			) : (
				<>
					<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<div className="flex items-start gap-3">
							<span
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
								style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
							>
								<Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</span>
							<div className="min-w-0">
								<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">Prepare the business</h3>
								<p className="mt-0.5 text-[13px] text-slate-500">Profile, membership and promotions</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								// Always unlock-only with the Agent temp tag+pin. Never open
								// flow=business (create-wallet / DiscoveryForm) — that page is for
								// cold invites without a temp account, not post-create handoff.
								void openBusinessOs()
							}}
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[15px] font-bold text-white"
							style={{ backgroundColor: M_PURPLE }}
						>
							Open Business OS
							<ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
						</button>
					</section>

					<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<div className="flex items-start gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef3ff] text-[#165ce9] dark:bg-indigo-950/40 dark:text-indigo-200">
								<Eye className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</span>
							<div className="min-w-0 flex-1">
								<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">Consumer app preview</h3>
								<p className="mt-0.5 text-[13px] text-slate-500">See the card as customers will see it.</p>
							</div>
						</div>
						{cardsLoading ? (
							<p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								Loading card
							</p>
						) : ready && manageable ? (
							<>
								<button
									type="button"
									onClick={openCardPreview}
									className="mt-4 w-full overflow-hidden rounded-[18px] border border-white/25 text-left shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
									style={{
										background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 42%, #7c3aed 100%)',
									}}
								>
									<div className="relative min-h-[132px] p-4 text-white">
										<div className="flex items-start gap-3">
											<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/20 text-[18px] font-bold backdrop-blur-sm">
												{cardInitial}
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
													Beamio Business
												</p>
												<p className="mt-1 truncate text-[17px] font-bold leading-tight">
													{merchantCardTitle(manageable)}
												</p>
												<p className="mt-1 text-[12px] font-medium text-white/80">Single Top-up</p>
											</div>
											<CreditCard className="mt-1 h-5 w-5 shrink-0 text-white/70" strokeWidth={1.75} aria-hidden />
										</div>
									</div>
								</button>
								<button
									type="button"
									onClick={openCardPreview}
									className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[13px] border border-[#d7e4ff] bg-[#f5f8ff] px-4 py-3 text-[14px] font-bold text-[#165ce9] dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
								>
									<QrCode className="h-4 w-4" aria-hidden />
									Preview card & QR
								</button>
							</>
						) : (
							<div className="mt-4 rounded-[16px] bg-[#f1f3fa] px-4 py-7 text-center dark:bg-slate-800/60">
								<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#94a3b8] shadow-sm dark:bg-slate-900">
									<CreditCard className="h-5 w-5" strokeWidth={1.75} aria-hidden />
								</div>
								<p className="mt-3 text-[14px] font-bold text-slate-900 dark:text-slate-50">No business card yet</p>
								<p className="mt-1 text-[12px] leading-snug text-slate-500">
									Create the card in Business OS, then refresh.
								</p>
								<button
									type="button"
									onClick={onRefresh}
									disabled={cardsLoading}
									className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#165ce9] disabled:opacity-50"
								>
									{cardsLoading ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
									) : (
										<RefreshCw className="h-3.5 w-3.5" aria-hidden />
									)}
									Refresh card
								</button>
							</div>
						)}
						{cards?.error ? (
							<p className="mt-2 text-sm text-amber-700" role="alert">
								{cards.error}
							</p>
						) : null}
					</section>

					{ready ? (
						<section
							className="rounded-[20px] border border-[#f0dfb4] p-4 shadow-sm dark:border-amber-900/40"
							style={{ background: 'linear-gradient(180deg, #fffaf0 0%, #fff6e5 100%)' }}
						>
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#fff1d2] text-[#9e742b]">
									<KeyRound className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">Hand over to the owner</h3>
									<p className="mt-0.5 text-[13px] text-slate-600">Account setup and recovery-code backup.</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => void openHandoff()}
								disabled={claimBusy}
								aria-busy={claimBusy}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
								style={{ backgroundColor: M_PURPLE }}
							>
								{claimBusy ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<Send className="h-4 w-4" aria-hidden />
								)}
								Owner onboarding link & QR
							</button>
							<p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#9a6b00]">
								<Lock className="h-3 w-3" aria-hidden />
								Private · intended owner only
							</p>
							{claimError ? (
								<div
									role="alert"
									className="mt-2 flex gap-2 rounded-xl border border-amber-300 bg-white/80 px-3 py-2 text-sm text-amber-900"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>{claimError}</p>
								</div>
							) : null}
						</section>
					) : null}

					{temporaryAccountDetails}

					{ready && manageable ? (
						<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
							<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
								<Code2 className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
								<span className="flex-1">Card details</span>
								<ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
							</summary>
							<div className="space-y-2 px-4 pb-1">
								<div className="flex items-center justify-between gap-2 text-sm">
									<span className="text-slate-500">Card contract</span>
									<strong className="font-mono text-[12px] text-slate-800 dark:text-slate-100">
										{shortAddress(manageable.cardAddress)}
									</strong>
								</div>
								<button
									type="button"
									onClick={() => openExternalUrl(merchantCardContractCodeUrl(manageable.cardAddress))}
									className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8b3e91]"
								>
									View on CoNET Explorer
									<ExternalLink className="h-3.5 w-3.5" aria-hidden />
								</button>
								<button
									type="button"
									onClick={onRefresh}
									disabled={cardsLoading}
									className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#165ce9] disabled:opacity-50"
								>
									{cardsLoading ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
									) : (
										<RefreshCw className="h-3.5 w-3.5" aria-hidden />
									)}
									Refresh card
								</button>
							</div>
						</details>
					) : null}
				</>
			)}

			{subView === 'preview' && manageable
				? overlayShell('Card preview', `agent-temp-card-preview-${temp.eoa}`, (
						<>
							<div className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-semibold text-[#4338ca] dark:bg-indigo-950/40 dark:text-indigo-200">
								<Eye className="h-3.5 w-3.5" aria-hidden />
								Consumer app preview
							</div>
							<div>
								<h3 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">
									{merchantCardTitle(manageable)}
								</h3>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Scan to view this card in the Beamio app.
								</p>
							</div>
							<div className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
								<div className="flex items-center gap-3">
									<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6edf9] text-[#8b3e91]">
										<Store className="h-6 w-6" strokeWidth={2} aria-hidden />
									</span>
									<div className="min-w-0">
										<p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
											{merchantCardTitle(manageable)}
										</p>
										<p className="mt-0.5 font-mono text-[11px] text-slate-500">
											{shortAddress(manageable.cardAddress)}
										</p>
									</div>
								</div>
							</div>
							{previewUrl ? (
								<div className="flex flex-col items-center rounded-[20px] border border-slate-200/90 bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<QRCodeCanvas value={previewUrl} size={200} level="M" includeMargin />
									<p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
										<QrCode className="h-3.5 w-3.5" aria-hidden />
										View only · no ownership transfer
									</p>
								</div>
							) : (
								<div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
									This card address cannot be shared.
								</div>
							)}
							<p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
								<Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
								Available by link before public listing.
							</p>
							{previewUrl ? (
								<div className="grid grid-cols-2 gap-2.5">
									<button
										type="button"
										onClick={() => void copyText('preview', previewUrl)}
										className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
									>
										{copiedKey === 'preview' ? (
											<Check className="h-4 w-4 text-emerald-500" aria-hidden />
										) : (
											<Copy className="h-4 w-4" aria-hidden />
										)}
										Copy link
									</button>
									<button
										type="button"
										onClick={() => {
											if (navigator.share) {
												void navigator
													.share({ url: previewUrl, title: merchantCardTitle(manageable) })
													.catch(() => undefined)
											} else {
												void copyText('preview', previewUrl)
											}
										}}
										className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold text-white"
										style={{ backgroundColor: M_PURPLE }}
									>
										<Share2 className="h-4 w-4" aria-hidden />
										Share
									</button>
								</div>
							) : null}
						</>
					))
				: null}

			{subView === 'handoff' && manageable
				? overlayShell('Owner onboarding', `agent-temp-owner-handoff-${temp.eoa}`, (
						<>
							<div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
								<KeyRound className="h-3.5 w-3.5" aria-hidden />
								Transfer to the business owner
							</div>
							<div>
								<h3 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">
									{merchantCardTitle(manageable)}
								</h3>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									The owner opens Business OS to create their BeamioTag and password, back up the Recovery
									Code and complete onboarding.
								</p>
							</div>
							<div
								role="alert"
								className="flex gap-3 rounded-[16px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
							>
								<Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
								<div>
									<p className="font-semibold">Share only with the intended owner</p>
									<p className="mt-0.5 text-[12px] leading-relaxed opacity-90">
										Anyone with this link or QR can take control of the business account.
									</p>
								</div>
							</div>
							{claimUrl ? (
								<div className="flex flex-col items-center rounded-[20px] border border-slate-200/90 bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
									<QRCodeCanvas value={claimUrl} size={200} level="M" includeMargin />
									<p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
										<Lock className="h-3.5 w-3.5" aria-hidden />
										Opens Business OS · owner access
									</p>
								</div>
							) : null}
							<div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-500">
								<span className="inline-flex items-center gap-1">
									<UserRound className="h-3.5 w-3.5" aria-hidden />
									Account
								</span>
								<span aria-hidden>→</span>
								<span className="inline-flex items-center gap-1">
									<Lock className="h-3.5 w-3.5" aria-hidden />
									Back up
								</span>
								<span aria-hidden>→</span>
								<span className="inline-flex items-center gap-1">
									<BadgeCheck className="h-3.5 w-3.5" aria-hidden />
									Complete
								</span>
							</div>
							{claimUrl ? (
								<div className="grid grid-cols-2 gap-2.5">
									<button
										type="button"
										onClick={() => void copyText('owner', claimUrl)}
										className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
									>
										{copiedKey === 'owner' ? (
											<Check className="h-4 w-4 text-emerald-500" aria-hidden />
										) : (
											<Copy className="h-4 w-4" aria-hidden />
										)}
										Copy link
									</button>
									<button
										type="button"
										onClick={() => {
											if (navigator.share) {
												void navigator.share({ url: claimUrl, title: 'Owner onboarding' }).catch(() => undefined)
											} else {
												void copyText('owner', claimUrl)
											}
										}}
										className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-3 py-3 text-sm font-semibold text-white"
									>
										<Send className="h-4 w-4" aria-hidden />
										Share
									</button>
								</div>
							) : null}
						</>
					))
				: null}
		</div>
	)
}
