import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { AlertTriangle, Check, Clipboard, Copy, Gift, Loader2, RefreshCw, Settings2, ShieldCheck, XCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useReferralRegistryRole } from '@/hooks/useReferralRegistryRole'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	referralRegistryRoleLabel,
	type ReferralRegistryDownstreamItem,
	type ReferralRegistryRoleSnapshot,
} from '@/services/referralRegistryRole'
import {
	assignReferralMerchantToL0,
	fetchReferralL0Quota,
	fetchReferralMerchantCandidates,
	setReferralL0StarterQuota,
	setReferralL0RebateRate,
	type ReferralMerchantCandidate,
} from '@/services/referralRegistryAdminManagement'
import {
	cancelReferralRedeemCode,
	fetchMerchantRedeemBunitAirdrop,
	fetchReferralRedeemCodes,
	issueReferralRedeemCode,
	referralBpsToPercent,
	referralPercentToBps,
	setMerchantRedeemBunitAirdrop,
	type ReferralRedeemCodeRecord,
	type ReferralRedeemKind,
} from '@/services/referralRegistryRedeem'
import {
	merchantBackgroundImageFromMetadataRoot,
	merchantIconUrlFromMetadataRoot,
	merchantProgramCardDisplayNameFromMetadataRoot,
} from '@/services/BeamioCard'

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

function AddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const short = `${address.slice(0, 6)}…${address.slice(-4)}`
	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			setCopied(false)
		}
	}, [address])
	return (
		<button
			type="button"
			onClick={() => void copy()}
			className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-left font-mono text-xs text-slate-200 transition hover:bg-white/10"
			aria-label={`Copy address ${address}`}
		>
			<span className="truncate">{short}</span>
			{copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden /> : <Clipboard className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
		</button>
	)
}

function BeamioTagCapsule({ address }: { address: string }) {
	const { resolveTagPlain, avatarImgUrl } = useBeamioTagDatabase()
	const tag = resolveTagPlain(address)
	const displayTag = tag || 'Beamio'
	return (
		<div
			className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1.5 text-sm font-medium text-indigo-100"
			aria-label={`Beamio tag @${displayTag}`}
		>
			<img
				src={avatarImgUrl(tag, address)}
				alt=""
				className="h-6 w-6 shrink-0 rounded-full object-cover"
				aria-hidden
			/>
			<span className="truncate">@{displayTag}</span>
		</div>
	)
}

function AdminL0ManagementPanel({
	adminPrivateKeyArmor,
	l0,
	item,
	onClose,
	onUpdated,
}: {
	adminPrivateKeyArmor: string
	l0: string
	item: ReferralRegistryDownstreamItem
	onClose: () => void
	onUpdated: () => Promise<void>
}) {
	const [rebateInput, setRebateInput] = useState((Number(item.rebateBps) / 100).toString())
	const [candidates, setCandidates] = useState<ReferralMerchantCandidate[]>([])
	const [selectedCandidates, setSelectedCandidates] = useState<string[]>([])
	const [loadingCandidates, setLoadingCandidates] = useState(true)
	const [savingRate, setSavingRate] = useState(false)
	const [starterKetInput, setStarterKetInput] = useState('')
	const [loadingQuota, setLoadingQuota] = useState(true)
	const [savingQuota, setSavingQuota] = useState(false)
	const [quotaFeedback, setQuotaFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
	const [assigning, setAssigning] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	useEffect(() => {
		let cancelled = false
		void fetchReferralMerchantCandidates(new ethers.Wallet(adminPrivateKeyArmor).address)
			.then((next) => {
				if (!cancelled) setCandidates(next)
			})
			.catch((cause) => {
				if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load merchant candidates.')
			})
			.finally(() => {
				if (!cancelled) setLoadingCandidates(false)
			})
		return () => {
			cancelled = true
		}
	}, [adminPrivateKeyArmor])

	useEffect(() => {
		let cancelled = false
		setLoadingQuota(true)
		void fetchReferralL0Quota(l0)
			.then((quota) => {
				if (cancelled) return
				setStarterKetInput(quota.starterKetRemaining)
			})
			.catch((cause) => {
				if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load the L0 redeem quota.')
			})
			.finally(() => {
				if (!cancelled) setLoadingQuota(false)
			})
		return () => {
			cancelled = true
		}
	}, [l0])


	const handleSaveRate = useCallback(async () => {
		if (savingRate) return
		setSavingRate(true)
		setError('')
		setSuccess('')
		try {
			const numeric = Number(rebateInput)
			if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) throw new Error('Rebate rate must be between 0% and 100%.')
			const rebateBps = BigInt(Math.round(numeric * 100))
			await setReferralL0RebateRate({ adminPrivateKeyArmor, l0, rebateBps })
			await onUpdated()
			setSuccess('L0 rebate rate updated.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update the L0 rebate rate.')
		} finally {
			setSavingRate(false)
		}
	}, [adminPrivateKeyArmor, l0, onUpdated, rebateInput, savingRate])

	const handleSaveQuota = useCallback(async () => {
		if (savingQuota) return
		setSavingQuota(true)
		setQuotaFeedback(null)
		setError('')
		setSuccess('')
		try {
			if (!/^\d+$/.test(starterKetInput.trim())) {
				throw new Error('Start Kit limit must be a whole number.')
			}
			await setReferralL0StarterQuota({
				adminPrivateKeyArmor,
				l0,
				starterKetRemaining: BigInt(starterKetInput.trim()),
			})
			await onUpdated()
			setQuotaFeedback({ kind: 'success', text: 'Redeem quota updated successfully.' })
			setSuccess('L0 redeem quota updated.')
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Could not update the L0 redeem quota.'
			setQuotaFeedback({ kind: 'error', text: message })
			setError(message)
		} finally {
			setSavingQuota(false)
		}
	}, [adminPrivateKeyArmor, l0, onUpdated, savingQuota, starterKetInput])


	const handleAssign = useCallback(async () => {
		if (assigning || selectedCandidates.length === 0) return
		const selected = candidates.filter((candidate) =>
			selectedCandidates.some((merchant) => merchant.toLowerCase() === candidate.merchant.toLowerCase()),
		)
		if (selected.length === 0) return
		setAssigning(true)
		setError('')
		setSuccess('')
		const assignedMerchants: string[] = []
		try {
			for (const candidate of selected) {
				await assignReferralMerchantToL0({
					adminPrivateKeyArmor,
					l0,
					merchant: candidate.merchant,
					card: candidate.cardAddress,
				})
				assignedMerchants.push(candidate.merchant)
			}
			await onUpdated()
			setCandidates((previous) => previous.filter((candidate) =>
				!assignedMerchants.some((merchant) => merchant.toLowerCase() === candidate.merchant.toLowerCase()),
			))
			setSelectedCandidates([])
			setSuccess(`${assignedMerchants.length} merchant${assignedMerchants.length === 1 ? '' : 's'} assigned to this L0.`)
		} catch (cause) {
			setCandidates((previous) => previous.filter((candidate) =>
				!assignedMerchants.some((merchant) => merchant.toLowerCase() === candidate.merchant.toLowerCase()),
			))
			setSelectedCandidates((previous) => previous.filter((merchant) =>
				!assignedMerchants.some((assigned) => assigned.toLowerCase() === merchant.toLowerCase()),
			))
			setError(cause instanceof Error ? cause.message : 'Could not assign the merchant.')
		} finally {
			setAssigning(false)
		}
	}, [adminPrivateKeyArmor, assigning, candidates, l0, onUpdated, selectedCandidates])

	return (
		<>
			<div className="fixed inset-0 z-[109] bg-slate-950/55 backdrop-blur-[2px]" aria-hidden />
			<aside className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-xl min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#071126] text-slate-50 shadow-[-16px_0_48px_rgba(2,6,23,0.35)] animate-in slide-in-from-right duration-300" role="dialog" aria-modal="true" aria-label={`Manage L0 ${l0}`}>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
				<div className="mx-auto w-full max-w-lg" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
					<div className="flex items-center justify-between">
						<BeamioCircularBackButton onClick={onClose} />
						<span className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">L0 management</span>
					</div>
					<header className="pb-6 pt-8">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Manage member</p>
						<h2 className="mt-2 text-2xl font-semibold text-white"><BeamioTagCapsule address={l0} /></h2>
					</header>

					<div className="space-y-4">
						<section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
							<h3 className="font-semibold text-white">L0 rebate rate</h3>
							<div className="mt-3 flex items-center gap-2">
								<input
									type="text"
									inputMode="decimal"
									value={rebateInput}
									onChange={(event) => setRebateInput(event.target.value)}
									className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-indigo-300/70"
									aria-label="L0 rebate rate percentage"
								/>
								<span className="text-slate-400">%</span>
							</div>
							<button
								type="button"
								onClick={() => void handleSaveRate()}
								disabled={savingRate}
								aria-busy={savingRate}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
							>
								{savingRate ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
								{savingRate ? 'Saving…' : 'Save rebate rate'}
							</button>
						</section>

						<section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
							<h3 className="font-semibold text-white">Redeem code quota</h3>
							<p className="mt-2 text-sm leading-6 text-slate-400">Set how many merchant redeem codes this L0 can issue. Each code uses the current global Start Kit airdrop amount.</p>
							<div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200/20 bg-amber-300/[0.08] px-3 py-2.5">
								<span className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">Unused Start Kits</span>
								<span className="rounded-full border border-amber-200/25 bg-amber-200/15 px-2.5 py-1 text-sm font-semibold text-amber-50">
									{loadingQuota ? '…' : starterKetInput || '0'}
								</span>
							</div>
							<div className="mt-3">
								<label className="text-xs text-slate-400">
									Start Kit remaining
									<input
										type="text"
										inputMode="numeric"
										value={starterKetInput}
										onChange={(event) => setStarterKetInput(event.target.value)}
										disabled={loadingQuota || savingQuota}
										className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-300/70 disabled:opacity-60"
										aria-label="Start Kit remaining"
									/>
								</label>
							</div>
							<button
								type="button"
								onClick={() => void handleSaveQuota()}
								disabled={loadingQuota || savingQuota}
								aria-busy={savingQuota}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
							>
								{savingQuota ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
								{savingQuota ? 'Saving…' : 'Save redeem quota'}
							</button>
							{quotaFeedback ? (
								<div className={`mt-3 rounded-xl border p-3 text-sm ${quotaFeedback.kind === 'success' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/20 bg-rose-400/10 text-rose-100'}`} role={quotaFeedback.kind === 'error' ? 'alert' : 'status'}>
									{quotaFeedback.kind === 'success' ? <Check className="mr-2 inline-block h-4 w-4" aria-hidden /> : <AlertTriangle className="mr-2 inline-block h-4 w-4" aria-hidden />}
									{quotaFeedback.text}
								</div>
							) : null}
						</section>

						<section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
							<h3 className="font-semibold text-white">Assign unregistered merchant</h3>
							<p className="mt-2 text-sm leading-6 text-slate-400">Select a merchant card owner with no current referral relationship.</p>
							<div className="mt-4 space-y-2">
								{loadingCandidates ? (
									<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-400">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading merchants…
									</div>
								) : candidates.length === 0 ? (
									<div className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-400">No unregistered merchant cards found.</div>
								) : candidates.map((candidate) => {
									const selected = selectedCandidates.some((merchant) => merchant.toLowerCase() === candidate.merchant.toLowerCase())
									const businessName = merchantProgramCardDisplayNameFromMetadataRoot(candidate.metadata) || 'Unnamed business'
									const businessImage = merchantBackgroundImageFromMetadataRoot(candidate.metadata) ?? merchantIconUrlFromMetadataRoot(candidate.metadata)
									return (
										<button
											key={`${candidate.merchant}:${candidate.cardAddress}`}
											type="button"
											onClick={() => setSelectedCandidates((previous) =>
												selected
													? previous.filter((merchant) => merchant.toLowerCase() !== candidate.merchant.toLowerCase())
													: [...previous, candidate.merchant],
											)}
											disabled={assigning}
											className={`block w-full rounded-xl border p-3 text-left transition ${selected ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-black/10 hover:border-white/25'}`}
											aria-pressed={selected}
										>
											<div className="flex items-center gap-3">
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm font-semibold text-white">{businessName}</div>
													<div className="mt-2"><AddressCapsule address={candidate.cardAddress} /></div>
												</div>
												{businessImage ? (
													<IpfsImg
														src={businessImage}
														alt={businessName}
														className="h-16 w-16 shrink-0 rounded-xl border border-white/15 object-cover"
														draggable={false}
													/>
												) : null}
											</div>
										</button>
									)
								})}
							</div>
							<button
								type="button"
								onClick={() => void handleAssign()}
								disabled={assigning || selectedCandidates.length === 0}
								aria-busy={assigning}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{assigning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
								{assigning ? 'Assigning…' : selectedCandidates.length > 0 ? `Assign ${selectedCandidates.length} merchant${selectedCandidates.length === 1 ? '' : 's'} to this L0` : 'Assign selected merchants'}
							</button>
						</section>

						{error ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div> : null}
						{success ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</div> : null}
					</div>
				</div>
			</div>
			</aside>
		</>
	)
}

function DownstreamSection({
	snapshot,
	onManageL0,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	onManageL0?: (item: ReferralRegistryDownstreamItem) => void
}) {
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const canView = snapshot.isAdmin || snapshot.role === 'l0' || snapshot.role === 'l1'
	const downstream = snapshot.isAdmin
		? snapshot.downstream
		: snapshot.role === 'l0'
			? snapshot.downstream.filter((item) => item.role === 'l1')
			: snapshot.downstream.filter((item) => item.role === 'merchant')
	const merchantItems = snapshot.role === 'l0'
		? snapshot.downstream.filter((item) => item.role === 'merchant')
		: []
	const title = snapshot.isAdmin ? 'Your L0 members' : snapshot.role === 'l0' ? 'Your L1 members' : 'Your merchant items'
	const downstreamAddresses = downstream.flatMap((item) => [
		item.address,
		...(item.merchantItems ?? []).map((merchant) => merchant.address),
	]).concat(merchantItems.map((item) => item.address))

	useEffect(() => {
		if (downstreamAddresses.length === 0) return
		void ensureProfilesForAddresses(downstreamAddresses)
	}, [ensureProfilesForAddresses, downstreamAddresses.join('|')])

	if (!canView) return null

	return (
		<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="font-semibold text-white">{title}</h3>
				<span className="text-xs text-slate-400">{downstream.length} item{downstream.length === 1 ? '' : 's'}</span>
			</div>
			{downstream.length === 0 ? (
				<p className="mt-3 text-sm text-slate-400">No downstream members found.</p>
			) : (
				<div className="mt-3 space-y-2">
					{downstream.map((item) => (
						<div key={`${item.role}:${item.address}`} className={`border border-white/10 bg-black/10 ${snapshot.isAdmin ? 'rounded-lg p-2' : 'rounded-xl p-3'}`}>
							<div className="flex min-w-0 items-center justify-between gap-2">
								<div className="min-w-0 flex-1">
									<BeamioTagCapsule address={item.address} />
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<span className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-medium text-indigo-100">
										{Number(item.rebateBps) / 100}%
									</span>
									{item.role === 'l1' ? (
										<span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300">
											R {Number(item.ratioBps) / 100}%
										</span>
									) : null}
									{snapshot.isAdmin && item.role === 'l0' && onManageL0 ? (
										<button
											type="button"
											onClick={() => onManageL0(item)}
											className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-medium text-indigo-100"
											aria-label={`Manage L0 ${item.address}`}
										>
											Edit
										</button>
									) : null}
								</div>
							</div>
							{snapshot.isAdmin && item.role === 'l0' && item.merchantItems?.length ? (
								<div className="mt-2 rounded-lg border border-amber-200/10 bg-amber-200/[0.04] p-2">
									<div className="flex items-center justify-between gap-2">
										<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">Merchants</p>
										<span className="text-[11px] text-slate-400">{item.merchantItems.length}</span>
									</div>
									<div className="mt-1.5 flex flex-wrap gap-1.5">
										{item.merchantItems.map((merchant) => (
											<div key={merchant.address} className="rounded-md border border-white/10 bg-black/10 p-1">
												<BeamioTagCapsule address={merchant.address} />
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
			{snapshot.role === 'l0' ? (
				<div className="mt-4 border-t border-white/10 pt-3">
					<div className="flex items-center justify-between gap-2">
						<h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">Your merchant items</h4>
						<span className="text-[11px] text-slate-400">{merchantItems.length}</span>
					</div>
					{merchantItems.length === 0 ? (
						<p className="mt-2 text-xs text-slate-500">No merchant items found.</p>
					) : (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{merchantItems.map((item) => (
								<div key={item.address} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/10 p-1">
									<BeamioTagCapsule address={item.address} />
									<span className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-medium text-indigo-100">
										{Number(item.rebateBps) / 100}%
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			) : null}
		</div>
	)
}

function ReferralGlobalSettingsDrawer({
	privateKeyArmor,
	onClose,
}: {
	privateKeyArmor: string
	onClose: () => void
}) {
	const [amount, setAmount] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	useEffect(() => {
		let cancelled = false
		void fetchMerchantRedeemBunitAirdrop()
			.then((value) => {
				if (!cancelled) setAmount(value)
			})
			.catch((cause) => {
				if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load global settings.')
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	const save = useCallback(async () => {
		if (saving) return
		setSaving(true)
		setError('')
		setSuccess('')
		try {
			if (!/^\d+(?:\.\d{1,6})?$/.test(amount.trim()) || Number(amount) <= 0) {
				throw new Error('Start Kit airdrop must be a positive B-Unit amount.')
			}
			await setMerchantRedeemBunitAirdrop({ adminPrivateKeyArmor: privateKeyArmor, amountBunits: amount })
			setSuccess('Global Start Kit airdrop updated.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update global settings.')
		} finally {
			setSaving(false)
		}
	}, [amount, privateKeyArmor, saving])

	return (
		<>
			<div className="fixed inset-0 z-[119] bg-slate-950/60 backdrop-blur-[2px]" aria-hidden />
			<aside className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-xl min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#071126] text-slate-50 shadow-[-16px_0_48px_rgba(2,6,23,0.35)] animate-in slide-in-from-right duration-300" role="dialog" aria-modal="true" aria-label="Global referral settings">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
					<div className="mx-auto w-full max-w-lg" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={onClose} />
							<Settings2 className="h-5 w-5 text-indigo-200" aria-hidden />
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Admin controls</p>
							<h2 className="mt-2 text-3xl font-semibold tracking-tight">Global referral settings</h2>
							<p className="mt-2 text-sm leading-6 text-slate-400">These values apply to all newly issued Start Kit redeem codes. Existing codes keep their original amount.</p>
						</header>
						<section className="rounded-2xl border border-amber-200/20 bg-amber-300/[0.08] p-5">
							<h3 className="font-semibold text-white">Start Kit airdrop</h3>
							<label className="mt-3 block text-xs text-slate-400">
								Paid B-Units per code
								<input
									type="text"
									inputMode="decimal"
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									disabled={loading || saving}
									className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/70 disabled:opacity-60"
									aria-label="Paid B-Units per Start Kit code"
								/>
							</label>
							<button
								type="button"
								onClick={() => void save()}
								disabled={loading || saving}
								aria-busy={saving}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
								{saving ? 'Saving…' : 'Save global setting'}
							</button>
						</section>
						{error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div> : null}
						{success ? <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</div> : null}
					</div>
				</div>
			</aside>
		</>
	)
}

function ReferralRedeemManagementPanel({
	snapshot,
	kind,
	privateKeyArmor,
	onClose,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	kind: ReferralRedeemKind
	privateKeyArmor: string
	onClose: () => void
}) {
	const [records, setRecords] = useState<ReferralRedeemCodeRecord[]>([])
	const [rateInput, setRateInput] = useState(kind === 'l1' ? referralBpsToPercent(snapshot.rebateBps) : '')
	const [loadingRecords, setLoadingRecords] = useState(true)
	const [starterKetRemaining, setStarterKetRemaining] = useState<string | null>(null)
	const [loadingQuota, setLoadingQuota] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [cancellingHash, setCancellingHash] = useState('')
	const [error, setError] = useState('')
	const [newSecret, setNewSecret] = useState('')
	const [copiedSecret, setCopiedSecret] = useState(false)
	const [copiedRecordHash, setCopiedRecordHash] = useState('')
	const isL0 = kind === 'l0'
	const isMerchant = kind === 'merchant'

	const loadRecords = useCallback(async (force = false) => {
		setLoadingRecords(true)
		try {
			const next = await fetchReferralRedeemCodes(kind, snapshot.eoa, { force })
			setRecords(next)
			setError('')
		} catch {
			setError('Could not load redeem code history from CoNET. The previous list was kept.')
		} finally {
			setLoadingRecords(false)
		}
	}, [kind, snapshot.eoa])

	useEffect(() => {
		void loadRecords()
	}, [loadRecords])

	useEffect(() => {
		if (kind !== 'merchant') return
		let cancelled = false
		setLoadingQuota(true)
		void fetchReferralL0Quota(snapshot.eoa)
			.then((quota) => {
				if (!cancelled) setStarterKetRemaining(quota.starterKetRemaining)
			})
			.catch(() => {
				if (!cancelled) setStarterKetRemaining(null)
			})
			.finally(() => {
				if (!cancelled) setLoadingQuota(false)
			})
		return () => {
			cancelled = true
		}
	}, [kind, snapshot.eoa])

	const handleCreate = useCallback(async () => {
		if (isCreating || !privateKeyArmor) return
		setIsCreating(true)
		setError('')
		setNewSecret('')
		try {
			const rebateBps = isMerchant ? 0n : referralPercentToBps(rateInput)
			const created = await issueReferralRedeemCode({ kind, issuerPrivateKeyArmor: privateKeyArmor, rebateBps })
			setNewSecret(created.secret)
			await loadRecords(true)
			if (isMerchant) {
				const quota = await fetchReferralL0Quota(snapshot.eoa)
				setStarterKetRemaining(quota.starterKetRemaining)
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue the redeem code.')
		} finally {
			setIsCreating(false)
		}
	}, [isCreating, privateKeyArmor, rateInput, kind, loadRecords, isL0, snapshot.eoa])

	const handleCancel = useCallback(async (hash: string) => {
		if (cancellingHash || !privateKeyArmor) return
		setCancellingHash(hash)
		setError('')
		try {
			await cancelReferralRedeemCode({ kind, issuerPrivateKeyArmor: privateKeyArmor, hash })
			await loadRecords(true)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not cancel the redeem code.')
		} finally {
			setCancellingHash('')
		}
	}, [cancellingHash, privateKeyArmor, kind, loadRecords])

	const copySecret = useCallback(async () => {
		if (!newSecret) return
		try {
			await navigator.clipboard.writeText(newSecret)
			setCopiedSecret(true)
			window.setTimeout(() => setCopiedSecret(false), 2000)
		} catch {
			setError('Could not copy the redeem code.')
		}
	}, [newSecret])

	const copyRecordSecret = useCallback(async (record: ReferralRedeemCodeRecord) => {
		if (!record.secret) return
		try {
			await navigator.clipboard.writeText(record.secret)
			setCopiedRecordHash(record.hash)
			window.setTimeout(() => setCopiedRecordHash(''), 2000)
		} catch {
			setError('Could not copy the redeem code.')
		}
	}, [])

	const title = isL0 ? 'L0 redeem codes' : isMerchant ? 'Start Kit redeem codes' : 'L1 redeem codes'
	const description = isL0
		? 'Create permanent codes that register a new L0 under this Admin.'
		: isMerchant
			? 'Create permanent codes that grant a new merchant the fixed Start Kit airdrop.'
			: 'Create permanent codes that register a new L1 under this L0.'
	let ratioPreview = '0.00%'
	if (!isL0 && snapshot.rebateBps && Number(snapshot.rebateBps) > 0) {
		try {
			ratioPreview = `${((Number(referralPercentToBps(rateInput)) / Number(snapshot.rebateBps)) * 100).toFixed(2)}%`
		} catch {
			ratioPreview = 'Enter a valid rate'
		}
	}

	return (
		<div className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[#071126] text-slate-50 animate-in slide-in-from-right duration-300" role="dialog" aria-modal="true" aria-labelledby="referral-code-management-title">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/20 via-indigo-500/10 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={onClose} />
							<div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-200" aria-hidden>
								<Gift className="h-4 w-4" />
							</div>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Referral management</p>
							<h2 id="referral-code-management-title" className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
							<p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
						</header>

						<div className="space-y-4">
							{isMerchant ? (
								<div className="rounded-2xl border border-amber-200/20 bg-amber-300/[0.08] p-5">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Start Kit remaining</p>
											<p className="mt-1 text-3xl font-semibold text-white">
												{loadingQuota ? '…' : starterKetRemaining ?? 'Unavailable'}
											</p>
										</div>
										<Gift className="h-7 w-7 text-amber-200" aria-hidden />
									</div>
									<p className="mt-2 text-xs leading-5 text-slate-400">Each issued code consumes one allowance and grants 2,000 paid B-Units.</p>
								</div>
							) : null}
							<div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
								{isMerchant ? null : <label htmlFor="referral-rebate-rate" className="text-sm font-semibold text-white">
									{isL0 ? 'L0 rebate rate' : 'L1 rebate rate'}
								</label>}
								<div className="mt-2 flex items-center gap-2">
									<input
										id="referral-rebate-rate"
										type="text"
										inputMode="decimal"
										autoComplete="off"
										value={rateInput}
										onChange={(event) => setRateInput(event.target.value)}
										placeholder="5"
										className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-indigo-300/70"
									/>
									<span className="text-slate-400">%</span>
								</div>
								{isL0 || isMerchant ? null : (
									<p className="mt-2 text-xs text-slate-400">
										Current L0 rebate: {referralBpsToPercent(snapshot.rebateBps)}% · L1 ratio: {ratioPreview}
									</p>
								)}
								<button
									type="button"
									onClick={() => void handleCreate()}
									disabled={isCreating || !privateKeyArmor}
									aria-busy={isCreating}
									className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
									{isCreating ? 'Creating code…' : `Create ${isL0 ? 'L0' : isMerchant ? 'Start Kit' : 'L1'} redeem code`}
								</button>
							</div>

							{newSecret ? (
								<div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5">
									<p className="text-sm font-semibold text-emerald-100">Save this code now</p>
									<p className="mt-1 text-xs leading-5 text-emerald-100/70">The secret is shown once. Only its hash is stored on CoNET.</p>
									<div className="mt-3 flex items-center gap-2">
										<code className="min-w-0 flex-1 break-all rounded-lg bg-black/20 px-3 py-2 text-xs text-white">{newSecret}</code>
										<button type="button" onClick={() => void copySecret()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-100" aria-label="Copy redeem code">
											{copiedSecret ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
										</button>
									</div>
								</div>
							) : null}

							{error ? <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</div> : null}

							<div className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.07] p-5">
								<div className="flex items-start gap-3">
									<Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
									<div>
										<h3 className="font-semibold text-white">Code rules</h3>
										<p className="mt-2 text-sm leading-6 text-slate-300">Each code is permanent after the creation transaction is confirmed. Pending codes can be cancelled by the issuer.</p>
										<p className="mt-3 text-xs leading-5 text-slate-400">Keep the secret code private and deliver it directly to the intended wallet.</p>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-semibold text-white">Created codes</h3>
									<button type="button" onClick={() => void loadRecords(true)} disabled={loadingRecords} className="text-xs text-indigo-200 disabled:opacity-50">
										{loadingRecords ? 'Refreshing…' : 'Refresh'}
									</button>
								</div>
								<div className="mt-3 space-y-2">
									{!loadingRecords && records.length === 0 ? <p className="text-sm text-slate-400">No codes created yet.</p> : null}
									{records.map((record) => (
										<div key={record.hash} className="rounded-xl border border-white/10 bg-black/10 p-3">
											<div className="flex items-center justify-between gap-3">
												<span className={`text-xs font-semibold uppercase ${record.status === 'pending' ? 'text-amber-200' : record.status === 'claimed' ? 'text-emerald-300' : 'text-slate-400'}`}>{record.status}</span>
												{record.status === 'pending' ? (
													<button type="button" onClick={() => void handleCancel(record.hash)} disabled={cancellingHash !== ''} aria-busy={cancellingHash === record.hash} className="inline-flex items-center gap-1 text-xs text-rose-300 disabled:opacity-50">
														{cancellingHash === record.hash ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
														Cancel
													</button>
												) : null}
											</div>
											<div className="mt-2 flex items-start gap-2">
												<code className="min-w-0 flex-1 break-all rounded-lg bg-black/20 px-2 py-1.5 font-mono text-xs text-white">
													{record.secret ?? 'Redeem code unavailable on this device'}
												</code>
												{record.secret ? (
													<button
														type="button"
														onClick={() => void copyRecordSecret(record)}
														className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200"
														aria-label="Copy redeem code"
													>
														{copiedRecordHash === record.hash ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
													</button>
												) : null}
											</div>
											<p className="mt-2 text-xs text-slate-300">
												{isMerchant ? 'Start Kit · 2,000 paid B-Units' : `Rebate ${referralBpsToPercent(record.rebateBps)}%${kind === 'l1' ? ` · Ratio ${referralBpsToPercent(record.ratioBps)}%` : ''}`}
											</p>
											<p className="mt-1 text-[10px] text-slate-500">{record.validBefore === 0 ? 'Permanent code' : `Expires ${new Date(record.validBefore * 1000).toLocaleString()}`}</p>
										</div>
									))}
								</div>
							</div>

							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Issuer wallet</p>
								<div className="mt-3"><AddressCapsule address={snapshot.eoa} /></div>
								<p className="mt-3 text-xs text-slate-500">Code status is read directly from the CoNET referral registry.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default function ReferralRegistryDashboardPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const profile = profiles?.[0]
	const signingArmor = resolveSigningPrivateKeyArmor(profile)
	const derivedEoa = signingArmor ? new ethers.Wallet(signingArmor).address : ''
	const eoa = profile?.keyID?.trim() || derivedEoa
	const { snapshot, loading, error, isPrivileged, refresh } = useReferralRegistryRole(eoa)
	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')
	const [redeemPanelKind, setRedeemPanelKind] = useState<ReferralRedeemKind | null>(null)
	const [managedL0, setManagedL0] = useState<ReferralRegistryDownstreamItem | null>(null)
	const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const handleRefresh = useCallback(async () => {
		if (refreshStatus !== 'idle') return
		setRefreshStatus('loading')
		try {
			await refresh()
			setRefreshStatus('success')
		} catch {
			setRefreshStatus('error')
		} finally {
			window.setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [refresh, refreshStatus])

	const handleManagementUpdated = useCallback(async () => {
		await refresh()
	}, [refresh])

	return (
		<div className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50 animate-in slide-in-from-right duration-300">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={() => navigate('/wallet')} />
								<div className="flex items-center gap-2">
									{snapshot?.isAdmin ? (
										<button
											type="button"
											onClick={() => setGlobalSettingsOpen(true)}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/20 bg-indigo-300/10 text-indigo-200 transition hover:bg-indigo-300/20"
											aria-label="Open global referral settings"
											title="Global referral settings"
										>
											<Settings2 className="h-4 w-4" aria-hidden />
										</button>
									) : null}
									{snapshot?.isAdmin ? (
										<button
											type="button"
											onClick={() => setRedeemPanelKind('l0')}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200/20 bg-blue-300/10 text-blue-200 transition hover:bg-blue-300/20"
											aria-label="Manage L0 redeem codes"
											title="Manage L0 redeem codes"
										>
											<ShieldCheck className="h-4 w-4" aria-hidden />
										</button>
									) : null}
									{snapshot?.role === 'l0' ? (
										<button
											type="button"
											onClick={() => setRedeemPanelKind('merchant')}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-200 transition hover:bg-amber-300/20"
											aria-label="Issue Start Kit redeem codes"
											title="Issue Start Kit redeem codes"
										>
											<Gift className="h-4 w-4" aria-hidden />
										</button>
									) : null}
									<button
										type="button"
										onClick={() => void handleRefresh()}
										disabled={refreshStatus !== 'idle'}
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md disabled:cursor-not-allowed"
										aria-label="Refresh referral dashboard"
										aria-busy={refreshStatus === 'loading'}
									>
										{refreshStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : refreshStatus === 'success' ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : refreshStatus === 'error' ? <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
									</button>
								</div>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">On-chain management</p>
							<div className="mt-2 flex items-center justify-between gap-3">
								<h1 className="text-3xl font-semibold tracking-tight">Referral dashboard</h1>
								{snapshot ? (
									<span
										className="shrink-0 rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1 text-xs font-semibold text-indigo-100"
										aria-label={`Current referral role: ${snapshot.isAdmin ? 'Admin' : referralRegistryRoleLabel(snapshot.role)}`}
									>
										{snapshot.isAdmin ? 'Admin' : referralRegistryRoleLabel(snapshot.role)}
									</span>
								) : null}
							</div>
						</header>

						{loading && !snapshot ? (
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
								<Loader2 className="h-5 w-5 animate-spin text-indigo-300" aria-hidden />
								<span>Checking your CoNET role…</span>
							</div>
						) : error && !snapshot ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								{error}
							</div>
						) : snapshot && isPrivileged ? (
							<div className="space-y-4">
								{snapshot.isAdmin ? (
									<div className="rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4">
										<div className="flex items-center gap-3">
											<ShieldCheck className="h-5 w-5 text-blue-200" aria-hidden />
											<div><p className="font-semibold text-white">Contract Admin</p><p className="mt-1 text-xs text-blue-100/70">Administrative permissions are active for this EOA.</p></div>
										</div>
									</div>
								) : null}
								<DownstreamSection snapshot={snapshot} onManageL0={(item) => setManagedL0(item)} />
							</div>
						) : (
							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">This wallet is not registered as a contract Admin, L0, or L1.</div>
						)}
					</div>
				</div>
			</div>
			{redeemPanelKind && snapshot && signingArmor ? (
				<ReferralRedeemManagementPanel
					snapshot={snapshot}
					kind={redeemPanelKind}
					privateKeyArmor={signingArmor}
					onClose={() => setRedeemPanelKind(null)}
				/>
			) : null}
			{managedL0 && snapshot?.isAdmin && signingArmor ? (
				<AdminL0ManagementPanel
					adminPrivateKeyArmor={signingArmor}
					l0={managedL0.address}
					item={managedL0}
					onClose={() => setManagedL0(null)}
					onUpdated={handleManagementUpdated}
				/>
			) : null}
			{globalSettingsOpen && snapshot?.isAdmin && signingArmor ? (
				<ReferralGlobalSettingsDrawer
					privateKeyArmor={signingArmor}
					onClose={() => setGlobalSettingsOpen(false)}
				/>
			) : null}
		</div>
	)
}
