import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { AlertTriangle, Check, Clipboard, Copy, Gift, Loader2, Package, Pencil, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Trash2, XCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { CONET_REFERRAL_REGISTRY_VAULT_V1 } from '@/config/chainAddresses'
import { useReferralRegistryRole } from '@/hooks/useReferralRegistryRole'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { conetDepinProvider } from '@/utils/constants'
import {
	referralRegistryRoleLabel,
	type ReferralRegistryDownstreamItem,
	type ReferralRegistryRoleSnapshot,
} from '@/services/referralRegistryRole'
import {
	assignReferralMerchantToL0,
	fetchReferralL0Quota,
	fetchReferralMerchantCandidates,
	readCachedReferralL0Quota,
	setReferralL0StarterQuota,
	setReferralL0RebateRate,
	type ReferralMerchantCandidate,
} from '@/services/referralRegistryAdminManagement'
import {
	fetchL1MerchantShares,
	fetchMerchantL1Shares,
	l0RemainingOfMerchantFullPercent,
	setMerchantL1Share,
	shareBpsAsMerchantFullPercent,
	type MerchantL1ShareRow,
} from '@/services/referralRegistryMerchantShare'
import {
	cancelAdminMerchantPackageCode,
	cancelReferralRedeemCode,
	fetchAdminMerchantPackageCodes,
	fetchMerchantRedeemBunitAirdrop,
	fetchReferralRedeemCodes,
	issueAdminMerchantPackageCode,
	issueReferralRedeemCode,
	PACKAGE_PAYMENT_METHOD_LABELS,
	referralBpsToPercent,
	referralPercentToBps,
	setMerchantRedeemBunitAirdrop,
	type AdminMerchantPackageRecord,
	type PackagePaymentMethod,
	type ReferralRedeemCodeRecord,
	type ReferralRedeemKind,
} from '@/services/referralRegistryRedeem'
import {
	merchantBackgroundImageFromMetadataRoot,
	merchantIconUrlFromMetadataRoot,
	merchantProgramCardDisplayNameFromMetadataRoot,
} from '@/services/BeamioCard'

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

const REFERRAL_SLIDE_DURATION_MS = 300

function useReferralSlideOut(onClose: () => void) {
	const [isClosing, setIsClosing] = useState(false)
	const [isEntered, setIsEntered] = useState(false)
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [])
	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, REFERRAL_SLIDE_DURATION_MS)
	}, [isClosing, onClose])
	const transform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	return { isClosing, close, slideStyle: { transform } }
}

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

/** Merchant share capsule: icon + share % + optional Edit (L0 → L1 nested list). */
function MerchantShareEditCapsule({
	address,
	sharePercent,
	onEdit,
}: {
	address: string
	/** Percent of merchant full amount (already converted for display). */
	sharePercent: string
	onEdit?: () => void
}) {
	const { resolveTagPlain, avatarImgUrl } = useBeamioTagDatabase()
	const tag = resolveTagPlain(address)
	const displayTag = tag || 'Beamio'
	return (
		<div
			className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 py-1.5 pl-2 pr-1.5 text-sm font-medium text-amber-50"
			aria-label={`Merchant @${displayTag}, ${sharePercent}% of merchant total`}
			title={`${sharePercent}% of merchant total`}
		>
			<img
				src={avatarImgUrl(tag, address)}
				alt=""
				className="h-6 w-6 shrink-0 rounded-full object-cover"
				aria-hidden
			/>
			<span className="min-w-0 truncate text-amber-100/90">@{displayTag}</span>
			<span className="shrink-0 rounded-full border border-amber-200/25 bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
				{sharePercent}%
			</span>
			{onEdit ? (
				<button
					type="button"
					onClick={onEdit}
					className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/15 text-amber-50 transition hover:bg-amber-200/25"
					aria-label={`Edit share for merchant @${displayTag}`}
					title="Edit share"
				>
					<Pencil className="h-3 w-3" aria-hidden />
				</button>
			) : null}
		</div>
	)
}

function L0L1MerchantShareList({
	l0,
	l1,
	l0RebateBps,
	refreshKey,
	onEditShare,
}: {
	l0: string
	l1: string
	/** L0 rebate bps of merchant full — used to convert shareBps → of-merchant %. */
	l0RebateBps: string
	refreshKey: number
	onEditShare: (row: MerchantL1ShareRow) => void
}) {
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const [rows, setRows] = useState<MerchantL1ShareRow[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
		const load = async () => {
			if (!ethers.isAddress(l0) || l0 === ethers.ZeroAddress || !ethers.isAddress(l1)) {
				if (!cancelled) setLoading(false)
				return
			}
			setLoading(true)
			try {
				const next = await fetchL1MerchantShares(l0, l1)
				if (cancelled) return
				setRows(next)
			} catch {
				if (cancelled) return
				// Keep last trusted rows on failure.
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [l0, l1, refreshKey])

	useEffect(() => {
		if (rows.length === 0) return
		void ensureProfilesForAddresses(rows.map((row) => row.merchant))
	}, [ensureProfilesForAddresses, rows.map((row) => row.merchant).join('|')])

	if (loading && rows.length === 0) {
		return (
			<div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
				<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
				Loading merchant shares…
			</div>
		)
	}
	if (rows.length === 0) {
		return <p className="mt-2 text-[11px] text-slate-500">No merchant revenue shares for this L1.</p>
	}
	return (
		<div className="mt-2 flex flex-wrap gap-2">
			{rows.map((row) => (
				<MerchantShareEditCapsule
					key={row.merchant}
					address={row.merchant}
					sharePercent={shareBpsAsMerchantFullPercent(l0RebateBps, row.shareBps)}
					onEdit={() => onEditShare(row)}
				/>
			))}
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
	const cachedQuota = readCachedReferralL0Quota(l0)
	const [starterKetInput, setStarterKetInput] = useState(() => cachedQuota?.starterKetRemaining ?? '')
	const [trustedStarterKetRemaining, setTrustedStarterKetRemaining] = useState<string | null>(() => cachedQuota?.starterKetRemaining ?? null)
	const [loadingQuota, setLoadingQuota] = useState(true)
	const [savingQuota, setSavingQuota] = useState(false)
	const [quotaFeedback, setQuotaFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
	const [assigning, setAssigning] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const { close, slideStyle } = useReferralSlideOut(onClose)

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
		const cached = readCachedReferralL0Quota(l0)
		if (cached) {
			setStarterKetInput(cached.starterKetRemaining)
			setTrustedStarterKetRemaining(cached.starterKetRemaining)
		}
		setLoadingQuota(true)
		void fetchReferralL0Quota(l0)
			.then((quota) => {
				if (cancelled) return
				setStarterKetInput(quota.starterKetRemaining)
				setTrustedStarterKetRemaining(quota.starterKetRemaining)
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
			const confirmedQuota = await fetchReferralL0Quota(l0)
			setStarterKetInput(confirmedQuota.starterKetRemaining)
			setTrustedStarterKetRemaining(confirmedQuota.starterKetRemaining)
			await onUpdated()
			setQuotaFeedback({ kind: 'success', text: 'Redeem quota updated successfully.' })
			setSuccess('L0 redeem quota updated.')
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : 'Could not update the L0 redeem quota.'
			setStarterKetInput(trustedStarterKetRemaining ?? '')
			setQuotaFeedback({ kind: 'error', text: message })
			setError(message)
		} finally {
			setSavingQuota(false)
		}
	}, [adminPrivateKeyArmor, l0, onUpdated, savingQuota, starterKetInput, trustedStarterKetRemaining])


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
			<aside className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-xl min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#071126] text-slate-50 shadow-[-16px_0_48px_rgba(2,6,23,0.35)] transition-transform duration-300 ease-out" style={slideStyle} role="dialog" aria-modal="true" aria-label={`Manage L0 ${l0}`}>
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
									{loadingQuota ? '…' : trustedStarterKetRemaining ?? 'Unavailable'}
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

function L1MerchantSharesSection({
	l0,
	l1,
	refreshKey,
}: {
	l0: string
	l1: string
	refreshKey: number
}) {
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const [rows, setRows] = useState<MerchantL1ShareRow[]>([])
	const [l0RebateBps, setL0RebateBps] = useState('0')
	const [loading, setLoading] = useState(true)
	const [stale, setStale] = useState(false)

	useEffect(() => {
		let cancelled = false
		const load = async () => {
			if (!ethers.isAddress(l0) || l0 === ethers.ZeroAddress || !ethers.isAddress(l1)) {
				if (!cancelled) {
					setLoading(false)
					setStale(false)
				}
				return
			}
			setLoading(true)
			try {
				const registry = new ethers.Contract(
					CONET_REFERRAL_REGISTRY_VAULT_V1,
					['function members(address) view returns (uint8 role, address parentAdmin, address parentL0, uint256 rebateBps, uint256 ratioBps, bool active)'],
					conetDepinProvider,
				)
				const [next, l0Member] = await Promise.all([
					fetchL1MerchantShares(l0, l1),
					registry.members(ethers.getAddress(l0)),
				])
				if (cancelled) return
				setRows(next)
				setL0RebateBps(l0Member.rebateBps.toString())
				setStale(false)
			} catch {
				if (cancelled) return
				// Keep last trusted rows; do not clear on untrusted failure.
				setStale(true)
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [l0, l1, refreshKey])

	useEffect(() => {
		if (rows.length === 0) return
		void ensureProfilesForAddresses(rows.map((row) => row.merchant))
	}, [ensureProfilesForAddresses, rows.map((row) => row.merchant).join('|')])

	return (
		<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h3 className="font-semibold text-white">Your merchant items</h3>
				</div>
				<span className="text-xs text-slate-400">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
			</div>
			{loading && rows.length === 0 ? (
				<div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					Loading merchant shares…
				</div>
			) : rows.length === 0 ? (
				<p className="mt-3 text-sm text-slate-400">No merchant revenue shares assigned to you yet.</p>
			) : (
				<div className="mt-3 space-y-2">
					{rows.map((row) => (
						<div key={row.merchant} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-2.5">
							<div className="min-w-0 flex-1">
								<BeamioTagCapsule address={row.merchant} />
							</div>
							<span
								className="shrink-0 rounded-full border border-amber-200/20 bg-amber-300/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-100"
								title="Your share of merchant total"
							>
								{shareBpsAsMerchantFullPercent(l0RebateBps, row.shareBps)}%
							</span>
						</div>
					))}
				</div>
			)}
			{stale && rows.length > 0 ? (
				<p className="mt-2 text-[11px] text-slate-500">Showing last trusted merchant shares.</p>
			) : null}
		</div>
	)
}

function L0MerchantRemainingShareBadge({
	l0,
	merchant,
	l0RebateBps,
	refreshKey,
}: {
	l0: string
	merchant: string
	l0RebateBps: string
	refreshKey: number
}) {
	const [percent, setPercent] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		const load = async () => {
			try {
				const rows = await fetchMerchantL1Shares(l0, merchant)
				if (cancelled) return
				setPercent(l0RemainingOfMerchantFullPercent(l0RebateBps, rows.map((row) => row.shareBps)))
			} catch {
				if (cancelled) return
				// Keep last trusted percent on failure.
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [l0, merchant, l0RebateBps, refreshKey])

	return (
		<span
			className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-100"
			title="Your remaining share of merchant total after L1 allocations"
		>
			{percent === null ? '…' : `${percent}%`}
		</span>
	)
}

function DownstreamSection({
	snapshot,
	l0Address,
	shareRefreshKey,
	onManageL0,
	onEditL1MerchantShare,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	l0Address?: string
	shareRefreshKey?: number
	onManageL0?: (item: ReferralRegistryDownstreamItem) => void
	onEditL1MerchantShare?: (l1: ReferralRegistryDownstreamItem, row: MerchantL1ShareRow) => void
}) {
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const canView = snapshot.isAdmin || snapshot.role === 'l0'
	const downstream = snapshot.isAdmin
		? snapshot.downstream
		: snapshot.downstream.filter((item) => item.role === 'l1')
	const title = snapshot.isAdmin ? 'Your L0 members' : 'Your L1 members'
	const downstreamAddresses = downstream.flatMap((item) => [
		item.address,
		...(item.merchantItems ?? []).map((merchant) => merchant.address),
	])

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
								{snapshot.isAdmin ? (
									<div className="flex shrink-0 items-center gap-1.5">
										<span className="rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-medium text-indigo-100">
											{Number(item.rebateBps) / 100}%
										</span>
										{item.role === 'l0' && onManageL0 ? (
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
								) : null}
							</div>
							{snapshot.isAdmin && item.role === 'l0' && item.merchantItems?.length ? (
								<div className="mt-2 rounded-lg border border-amber-200/10 bg-amber-200/[0.04] p-2">
									<div className="flex items-center justify-between gap-2">
										<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">Merchants</p>
										<span className="text-[11px] text-slate-400">{item.merchantItems.length}</span>
									</div>
									<div className="mt-1.5 flex flex-wrap gap-1.5">
										{item.merchantItems.map((merchant) => (
											<BeamioTagCapsule key={merchant.address} address={merchant.address} />
										))}
									</div>
								</div>
							) : null}
							{snapshot.role === 'l0' && item.role === 'l1' && l0Address && onEditL1MerchantShare ? (
								<div className="mt-2 rounded-lg border border-amber-200/10 bg-amber-200/[0.04] p-2">
									<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">Merchant shares</p>
									<L0L1MerchantShareList
										l0={l0Address}
										l1={item.address}
										l0RebateBps={snapshot.rebateBps}
										refreshKey={shareRefreshKey ?? snapshot.fetchedAt}
										onEditShare={(row) => onEditL1MerchantShare(item, row)}
									/>
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function L0MerchantItemsPanel({
	snapshot,
	l0Address,
	shareRefreshKey,
	onManageMerchantShare,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	l0Address: string
	shareRefreshKey: number
	onManageMerchantShare?: (item: ReferralRegistryDownstreamItem) => void
}) {
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const merchantItems = snapshot.downstream.filter((item) => item.role === 'merchant')

	useEffect(() => {
		if (merchantItems.length === 0) return
		void ensureProfilesForAddresses(merchantItems.map((item) => item.address))
	}, [ensureProfilesForAddresses, merchantItems.map((item) => item.address).join('|')])

	return (
		<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
			<div className="flex items-center justify-between gap-2">
				<div>
					<h3 className="font-semibold text-white">Your merchant items</h3>
				</div>
				<span className="text-xs text-slate-400">{merchantItems.length} item{merchantItems.length === 1 ? '' : 's'}</span>
			</div>
			{merchantItems.length === 0 ? (
				<p className="mt-3 text-sm text-slate-400">No merchant items found.</p>
			) : (
				<div className="mt-3 space-y-2">
					{merchantItems.map((item) => (
						<div key={item.address} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-2.5">
							<div className="min-w-0 flex-1">
								<BeamioTagCapsule address={item.address} />
							</div>
							<div className="flex shrink-0 items-center gap-1.5">
								<L0MerchantRemainingShareBadge
									l0={l0Address}
									merchant={item.address}
									l0RebateBps={snapshot.rebateBps}
									refreshKey={shareRefreshKey}
								/>
								{onManageMerchantShare ? (
									<button
										type="button"
										onClick={() => onManageMerchantShare(item)}
										className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-100 transition hover:bg-amber-300/20"
										aria-label={`Edit L1 revenue shares for merchant ${item.address}`}
										title="Edit L1 shares"
									>
										<Pencil className="h-3.5 w-3.5" aria-hidden />
									</button>
								) : null}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function L0RevenueSharePanel({
	mode,
	focus,
	l0,
	l1Candidates,
	merchantCandidates,
	privateKeyArmor,
	initialCounterparty,
	initialSharePercent,
	onClose,
	onSharesChanged,
}: {
	mode: 'merchant' | 'l1'
	focus: ReferralRegistryDownstreamItem
	l0: string
	l1Candidates: ReferralRegistryDownstreamItem[]
	merchantCandidates: ReferralRegistryDownstreamItem[]
	privateKeyArmor: string
	initialCounterparty?: string
	initialSharePercent?: string
	onClose: () => void
	onSharesChanged?: () => void
}) {
	const [rows, setRows] = useState<MerchantL1ShareRow[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedCounterparty, setSelectedCounterparty] = useState(initialCounterparty ?? '')
	const [sharePercent, setSharePercent] = useState(initialSharePercent ?? '')
	const [saving, setSaving] = useState(false)
	const [removingKey, setRemovingKey] = useState('')
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const { close, slideStyle } = useReferralSlideOut(onClose)

	const loadRows = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const next = mode === 'merchant'
				? await fetchMerchantL1Shares(l0, focus.address)
				: await fetchL1MerchantShares(l0, focus.address)
			setRows(next)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not load revenue shares.')
		} finally {
			setLoading(false)
		}
	}, [mode, l0, focus.address])

	useEffect(() => {
		void loadRows()
	}, [loadRows])

	useEffect(() => {
		if (initialCounterparty) setSelectedCounterparty(initialCounterparty)
		if (initialSharePercent !== undefined) setSharePercent(initialSharePercent)
	}, [initialCounterparty, initialSharePercent])

	const counterparties = mode === 'merchant' ? l1Candidates : merchantCandidates
	const selectedInList = selectedCounterparty
		? counterparties.some((item) => item.address.toLowerCase() === selectedCounterparty.toLowerCase())
		: true
	const availableCounterparties = counterparties.filter((item) => {
		// Allow the currently selected counterparty so existing rows can be edited.
		if (selectedCounterparty && item.address.toLowerCase() === selectedCounterparty.toLowerCase()) return true
		if (mode === 'merchant') return !rows.some((row) => row.l1.toLowerCase() === item.address.toLowerCase())
		return !rows.some((row) => row.merchant.toLowerCase() === item.address.toLowerCase())
	})
	const selectOptions = !selectedCounterparty || selectedInList
		? availableCounterparties
		: [{ address: selectedCounterparty, role: (mode === 'merchant' ? 'l1' : 'merchant') as 'l1' | 'merchant', rebateBps: '0', ratioBps: '0', active: true }, ...availableCounterparties]

	const handleSave = useCallback(async () => {
		if (saving || !privateKeyArmor) return
		setSaving(true)
		setError('')
		setSuccess('')
		try {
			if (!selectedCounterparty) throw new Error(mode === 'merchant' ? 'Select an L1 member.' : 'Select a merchant.')
			if (!sharePercent.trim()) throw new Error('Enter a share percent.')
			await setMerchantL1Share({
				l0PrivateKeyArmor: privateKeyArmor,
				merchant: mode === 'merchant' ? focus.address : selectedCounterparty,
				l1: mode === 'merchant' ? selectedCounterparty : focus.address,
				sharePercent,
			})
			setSelectedCounterparty('')
			setSharePercent('')
			await loadRows()
			onSharesChanged?.()
			setSuccess('Revenue share updated.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update the revenue share.')
		} finally {
			setSaving(false)
		}
	}, [saving, privateKeyArmor, selectedCounterparty, sharePercent, mode, focus.address, loadRows, onSharesChanged])

	const handleRemove = useCallback(async (row: MerchantL1ShareRow) => {
		if (removingKey || !privateKeyArmor) return
		const key = `${row.merchant}:${row.l1}`
		setRemovingKey(key)
		setError('')
		setSuccess('')
		try {
			await setMerchantL1Share({
				l0PrivateKeyArmor: privateKeyArmor,
				merchant: row.merchant,
				l1: row.l1,
				sharePercent: '0',
			})
			await loadRows()
			onSharesChanged?.()
			setSuccess('Revenue share removed.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not remove the revenue share.')
		} finally {
			setRemovingKey('')
		}
	}, [removingKey, privateKeyArmor, loadRows, onSharesChanged])

	const title = mode === 'merchant' ? 'Merchant revenue shares' : 'L1 merchant shares'
	const description = mode === 'merchant'
		? 'Share a percentage of this merchant’s rebate pool with selected L1 members under you.'
		: 'Pick merchants under you and share a percentage of each merchant’s rebate pool with this L1.'

	return (
		<>
			<div className="fixed inset-0 z-[119] bg-slate-950/60 backdrop-blur-[2px]" aria-hidden />
			<aside className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-xl min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#071126] text-slate-50 transition-transform duration-300 ease-out" style={slideStyle} role="dialog" aria-modal="true" aria-label={title}>
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
					<div className="mx-auto w-full max-w-lg" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={close} />
							<SlidersHorizontal className="h-5 w-5 text-amber-200" aria-hidden />
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">L0 controls</p>
							<h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
							<p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
							<div className="mt-4"><BeamioTagCapsule address={focus.address} /></div>
						</header>

						<section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
							<h3 className="font-semibold text-white">{mode === 'merchant' ? 'Add L1 share' : 'Add merchant share'}</h3>
							<label className="mt-3 block text-xs text-slate-400" htmlFor="share-counterparty">
								{mode === 'merchant' ? 'L1 member' : 'Merchant'}
								<select
									id="share-counterparty"
									value={selectedCounterparty}
									onChange={(event) => setSelectedCounterparty(event.target.value)}
									disabled={saving || selectOptions.length === 0}
									className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/70 disabled:opacity-60"
								>
									<option value="">{selectOptions.length === 0 ? 'No available members' : 'Select…'}</option>
									{selectOptions.map((item) => (
										<option key={item.address} value={item.address}>{item.address}</option>
									))}
								</select>
							</label>
							<label className="mt-3 block text-xs text-slate-400" htmlFor="share-percent">
								Share of merchant rebate (%)
								<input
									id="share-percent"
									type="text"
									inputMode="decimal"
									autoComplete="off"
									value={sharePercent}
									onChange={(event) => setSharePercent(event.target.value)}
									disabled={saving}
									placeholder="10"
									className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/70 disabled:opacity-60"
									aria-label="Share percent"
								/>
							</label>
							<p className="mt-2 text-[11px] leading-5 text-slate-500">All L1 shares for one merchant must total at most 100% of that merchant’s rebate to you.</p>
							<button
								type="button"
								onClick={() => void handleSave()}
								disabled={saving || !privateKeyArmor}
								aria-busy={saving}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
								{saving ? 'Saving…' : 'Save share'}
							</button>
						</section>

						{error ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</div> : null}
						{success ? <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</div> : null}

						<section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
							<div className="flex items-center justify-between gap-3">
								<h3 className="font-semibold text-white">Configured shares</h3>
								<button type="button" onClick={() => void loadRows()} disabled={loading} className="text-xs text-indigo-200 disabled:opacity-50">
									{loading ? 'Refreshing…' : 'Refresh'}
								</button>
							</div>
							<div className="mt-3 space-y-2">
								{loading && rows.length === 0 ? <p className="text-sm text-slate-400">Loading…</p> : null}
								{!loading && rows.length === 0 ? <p className="text-sm text-slate-400">No shares configured yet.</p> : null}
								{rows.map((row) => {
									const key = `${row.merchant}:${row.l1}`
									const counterparty = mode === 'merchant' ? row.l1 : row.merchant
									return (
										<div key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-3">
											<button
												type="button"
												onClick={() => {
													setSelectedCounterparty(counterparty)
													setSharePercent(row.sharePercent)
													setSuccess('')
													setError('')
												}}
												className="min-w-0 flex-1 text-left"
												aria-label={`Edit share for ${counterparty}`}
											>
												<BeamioTagCapsule address={counterparty} />
												<p className="mt-1 text-xs text-slate-400">{row.sharePercent}% of merchant rebate · tap to edit</p>
											</button>
											<button
												type="button"
												onClick={() => void handleRemove(row)}
												disabled={removingKey !== ''}
												aria-busy={removingKey === key}
												aria-label="Remove share"
												className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 text-rose-200 disabled:opacity-50"
											>
												{removingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
											</button>
										</div>
									)
								})}
							</div>
						</section>
					</div>
				</div>
			</aside>
		</>
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
	const { close, slideStyle } = useReferralSlideOut(onClose)

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
				<aside className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-xl min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#071126] text-slate-50 transition-transform duration-300 ease-out" style={slideStyle} role="dialog" aria-modal="true" aria-label="Global referral settings">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
					<div className="mx-auto w-full max-w-lg" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={close} />
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

function L0StartKitQuotaCard({
	starterKetRemaining,
	onIssue,
}: {
	starterKetRemaining: string
	onIssue?: () => void
}) {
	return (
		<div className="rounded-2xl border border-amber-200/20 bg-amber-300/[0.08] p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Start Kits remaining</p>
					<p className="mt-1 text-3xl font-semibold text-white tabular-nums">{starterKetRemaining}</p>
				</div>
				{onIssue ? (
					<button
						type="button"
						onClick={onIssue}
						className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/25 bg-amber-300/15 text-amber-100 transition hover:bg-amber-300/25"
						aria-label="Open Start Kit redeem controls"
						title="Start Kit controls"
					>
						<SlidersHorizontal className="h-4 w-4" aria-hidden />
					</button>
				) : (
					<SlidersHorizontal className="h-7 w-7 shrink-0 text-amber-200" aria-hidden />
				)}
			</div>
		</div>
	)
}

function ReferralRedeemManagementPanel({
	snapshot,
	kind,
	privateKeyArmor,
	onClose,
	onCodesChanged,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	kind: ReferralRedeemKind
	privateKeyArmor: string
	onClose: () => void
	onCodesChanged?: () => void | Promise<void>
}) {
	const { referralL0StartKitQuota, refreshReferralL0StartKitQuota } = useDaemonContext()
	const [records, setRecords] = useState<ReferralRedeemCodeRecord[]>([])
	const [rateInput, setRateInput] = useState(kind === 'l1' ? referralBpsToPercent(snapshot.rebateBps) : '')
	const [loadingRecords, setLoadingRecords] = useState(true)
	const [isCreating, setIsCreating] = useState(false)
	const [cancellingHash, setCancellingHash] = useState('')
	const [error, setError] = useState('')
	const [newSecret, setNewSecret] = useState('')
	const [copiedSecret, setCopiedSecret] = useState(false)
	const [copiedRecordHash, setCopiedRecordHash] = useState('')
	const { close, slideStyle } = useReferralSlideOut(onClose)
	const isL0 = kind === 'l0'
	const isMerchant = kind === 'merchant'
	const starterKetRemaining =
		referralL0StartKitQuota?.eoa.toLowerCase() === snapshot.eoa.toLowerCase()
			? referralL0StartKitQuota.starterKetRemaining
			: null

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
				await refreshReferralL0StartKitQuota()
			}
			await onCodesChanged?.()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue the redeem code.')
		} finally {
			setIsCreating(false)
		}
	}, [isCreating, privateKeyArmor, rateInput, kind, loadRecords, isMerchant, refreshReferralL0StartKitQuota, onCodesChanged])

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
		<div className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[#071126] text-slate-50 transition-transform duration-300 ease-out" style={slideStyle} role="dialog" aria-modal="true" aria-labelledby="referral-code-management-title">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/20 via-indigo-500/10 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={close} />
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
											<p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Start Kits remaining</p>
											<p className="mt-1 text-3xl font-semibold text-white tabular-nums">
												{starterKetRemaining ?? '0'}
											</p>
										</div>
										<Gift className="h-7 w-7 text-amber-200" aria-hidden />
									</div>
									<p className="mt-2 text-xs leading-5 text-slate-400">Each issued code consumes one allowance and grants the current global Start Kit airdrop.</p>
								</div>
							) : null}
							<div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
								{!isMerchant ? (
									<>
										<label htmlFor="referral-rebate-rate" className="text-sm font-semibold text-white">
											{isL0 ? 'L0 rebate rate' : 'L1 rebate rate'}
										</label>
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
										{isL0 ? null : (
											<p className="mt-2 text-xs text-slate-400">
												Current L0 rebate: {referralBpsToPercent(snapshot.rebateBps)}% · L1 ratio: {ratioPreview}
											</p>
										)}
									</>
								) : null}
								<button
									type="button"
									onClick={() => void handleCreate()}
									disabled={isCreating || !privateKeyArmor}
									aria-busy={isCreating}
									className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60${!isMerchant ? ' mt-4' : ''}`}
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

function AdminMerchantPackagePanel({
	snapshot,
	privateKeyArmor,
	onClose,
	onCodesChanged,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	privateKeyArmor: string
	onClose: () => void
	onCodesChanged: () => Promise<void>
}) {
	const { close, slideStyle } = useReferralSlideOut(onClose)
	const [records, setRecords] = useState<AdminMerchantPackageRecord[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [amount, setAmount] = useState('20')
	const [isPaid, setIsPaid] = useState(false)
	const [includeStartKet, setIncludeStartKet] = useState(true)
	const [paymentMethod, setPaymentMethod] = useState<PackagePaymentMethod>(0)
	const [description, setDescription] = useState('')
	const [optionalL0, setOptionalL0] = useState('')
	const [isCreating, setIsCreating] = useState(false)
	const [cancellingHash, setCancellingHash] = useState('')
	const [newSecret, setNewSecret] = useState('')
	const [copiedSecret, setCopiedSecret] = useState(false)
	const [copiedRecordHash, setCopiedRecordHash] = useState('')

	const l0Options = snapshot.downstream.filter((item) => item.role === 'l0')

	const loadRecords = useCallback(async (force = false) => {
		setLoading(true)
		setError('')
		try {
			const next = await fetchAdminMerchantPackageCodes(snapshot.eoa, { force })
			setRecords(next)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not load package codes.')
		} finally {
			setLoading(false)
		}
	}, [snapshot.eoa])

	useEffect(() => {
		void loadRecords()
	}, [loadRecords])

	const handleCreate = useCallback(async () => {
		if (isCreating || !privateKeyArmor) return
		setIsCreating(true)
		setError('')
		setNewSecret('')
		try {
			const issued = await issueAdminMerchantPackageCode({
				adminPrivateKeyArmor: privateKeyArmor,
				optionalL0: optionalL0 || undefined,
				bunitAmount: amount,
				isPaid,
				includeStartKet,
				paymentMethod,
				description,
			})
			setNewSecret(issued.secret)
			await loadRecords(true)
			await onCodesChanged()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not create the package code.')
		} finally {
			setIsCreating(false)
		}
	}, [isCreating, privateKeyArmor, optionalL0, amount, isPaid, includeStartKet, paymentMethod, description, loadRecords, onCodesChanged])

	const handleCancel = useCallback(async (hash: string) => {
		if (cancellingHash || !privateKeyArmor) return
		setCancellingHash(hash)
		setError('')
		try {
			await cancelAdminMerchantPackageCode({ adminPrivateKeyArmor: privateKeyArmor, hash })
			await loadRecords(true)
			await onCodesChanged()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not cancel the package code.')
		} finally {
			setCancellingHash('')
		}
	}, [cancellingHash, privateKeyArmor, loadRecords, onCodesChanged])

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

	const copyRecordSecret = useCallback(async (record: AdminMerchantPackageRecord) => {
		if (!record.secret) return
		try {
			await navigator.clipboard.writeText(record.secret)
			setCopiedRecordHash(record.hash)
			window.setTimeout(() => setCopiedRecordHash(''), 2000)
		} catch {
			setError('Could not copy the redeem code.')
		}
	}, [])

	return (
		<div className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[#071126] text-slate-50 transition-transform duration-300 ease-out" style={slideStyle} role="dialog" aria-modal="true" aria-labelledby="admin-merchant-package-title">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-500/20 via-indigo-500/10 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={close} />
							<div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-emerald-200" aria-hidden>
								<Package className="h-4 w-4" />
							</div>
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Admin redeem management</p>
							<h2 id="admin-merchant-package-title" className="mt-2 text-3xl font-semibold tracking-tight">Start Ket NFT &amp; B-Unit codes</h2>
							<p className="mt-2 text-sm leading-6 text-slate-400">
								Issue redeem codes that grant free or paid B-Units and optionally a Business Start Ket NFT. Payment method and credential notes are stored on-chain as plaintext. Free B-Units are one-time per EOA (shared with any prior free grant). Full redeem codes are saved on this device for Issued codes.
							</p>
						</header>

						<div className="space-y-4">
							<section className="rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] p-5">
								<label className="block text-xs text-slate-400">
									B-Unit amount
									<input
										type="text"
										inputMode="decimal"
										value={amount}
										onChange={(event) => setAmount(event.target.value)}
										disabled={isCreating}
										className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70 disabled:opacity-60"
										aria-label="B-Unit amount"
									/>
								</label>

								<div className="mt-4">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">B-Unit type</p>
									<div className="mt-2 grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={() => setIsPaid(false)}
											disabled={isCreating}
											className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${!isPaid ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-50' : 'border-white/10 bg-black/20 text-slate-300'}`}
										>
											Free
										</button>
										<button
											type="button"
											onClick={() => setIsPaid(true)}
											disabled={isCreating}
											className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${isPaid ? 'border-amber-300/40 bg-amber-400/20 text-amber-50' : 'border-white/10 bg-black/20 text-slate-300'}`}
										>
											Paid
										</button>
									</div>
									{!isPaid ? (
										<p className="mt-2 text-xs leading-5 text-slate-400">Free grants are one-time per EOA. Recipients who already claimed free B-Units cannot claim this code.</p>
									) : null}
								</div>

								<label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3">
									<input
										type="checkbox"
										checked={includeStartKet}
										onChange={(event) => setIncludeStartKet(event.target.checked)}
										disabled={isCreating}
										className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent"
									/>
									<span>
										<span className="block text-sm font-semibold text-white">Include Business Start Ket NFT</span>
										<span className="mt-1 block text-xs leading-5 text-slate-400">
											On claim, mint the Start Ket NFT credential. Merchant card creation still uses createMerchantCard after claim.
										</span>
									</span>
								</label>

								<label className="mt-4 block text-xs text-slate-400">
									Optional L0 bind
									<select
										value={optionalL0}
										onChange={(event) => setOptionalL0(event.target.value)}
										disabled={isCreating || !includeStartKet}
										className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70 disabled:opacity-60"
										aria-label="Optional L0"
									>
										<option value="">None (claimer may supply L0 at card creation)</option>
										{l0Options.map((item) => (
											<option key={item.address} value={item.address}>{item.address}</option>
										))}
									</select>
								</label>

								<label className="mt-4 block text-xs text-slate-400">
									Payment method (on-chain)
									<select
										value={paymentMethod}
										onChange={(event) => setPaymentMethod(Number(event.target.value) as PackagePaymentMethod)}
										disabled={isCreating}
										className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70 disabled:opacity-60"
										aria-label="Payment method"
									>
										{([0, 1, 2, 3] as PackagePaymentMethod[]).map((key) => (
											<option key={key} value={key}>{PACKAGE_PAYMENT_METHOD_LABELS[key]}</option>
										))}
									</select>
								</label>

								<label className="mt-4 block text-xs text-slate-400">
									Credential note (on-chain plaintext, max 512)
									<textarea
										value={description}
										onChange={(event) => setDescription(event.target.value.slice(0, 512))}
										disabled={isCreating}
										rows={3}
										className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/70 disabled:opacity-60"
										aria-label="Credential description"
										placeholder="Invoice #… / cash receipt …"
									/>
									<span className="mt-1 block text-[11px] text-slate-500">{description.length}/512</span>
								</label>

								<button
									type="button"
									onClick={() => void handleCreate()}
									disabled={isCreating || !amount.trim()}
									aria-busy={isCreating}
									className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Package className="h-4 w-4" aria-hidden />}
									{isCreating ? 'Creating code…' : 'Create package code'}
								</button>
							</section>

							{newSecret ? (
								<div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">New code saved on this device</p>
									<p className="mt-1 text-xs leading-5 text-emerald-100/70">
										The full redeem code is kept in local storage on this device only. Only its hash is on CoNET.
									</p>
									<p className="mt-2 break-all font-mono text-sm text-emerald-50">{newSecret}</p>
									<button
										type="button"
										onClick={() => void copySecret()}
										className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"
									>
										{copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
										{copiedSecret ? 'Copied' : 'Copy code'}
									</button>
								</div>
							) : null}

							{error ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div> : null}

							<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-semibold text-white">Issued codes</h3>
									<span className="text-xs text-slate-400">{records.length}</span>
								</div>
								<p className="mt-1 text-xs leading-5 text-slate-500">
									Redeem codes created on this device are saved locally so you can copy them again. Codes issued elsewhere cannot be reconstructed from the on-chain hash.
								</p>
								{loading ? (
									<div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Loading…
									</div>
								) : records.length === 0 ? (
									<p className="mt-3 text-sm text-slate-400">No package codes yet.</p>
								) : (
									<div className="mt-3 space-y-2">
										{records.map((record) => (
											<div key={record.hash} className="rounded-xl border border-white/10 bg-black/15 p-3">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0 flex-1">
														<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
															Redeem code
														</p>
														<div className="mt-1.5 flex items-start gap-2">
															<code className="min-w-0 flex-1 break-all rounded-lg bg-black/25 px-2.5 py-2 font-mono text-xs text-white">
																{record.secret ?? 'Redeem code unavailable on this device'}
															</code>
															{record.secret ? (
																<button
																	type="button"
																	onClick={() => void copyRecordSecret(record)}
																	className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200"
																	aria-label="Copy redeem code"
																>
																	{copiedRecordHash === record.hash ? (
																		<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
																	) : (
																		<Clipboard className="h-3.5 w-3.5" aria-hidden />
																	)}
																</button>
															) : null}
														</div>
														<p className="mt-2 text-sm text-white">
															{Number(record.bunitDisplay).toFixed(2)} {record.isPaid ? 'paid' : 'free'} B-Units
															{record.includeStartKet ? ' · Start Ket' : ''}
														</p>
														<p className="mt-1 text-xs text-slate-400">{record.paymentLabel}{record.description ? ` · ${record.description}` : ''}</p>
														{record.optionalL0 !== ethers.ZeroAddress ? (
															<p className="mt-1 font-mono text-[11px] text-slate-500">L0 {record.optionalL0.slice(0, 6)}…{record.optionalL0.slice(-4)}</p>
														) : null}
													</div>
													<span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${record.status === 'pending' ? 'border-emerald-200/20 bg-emerald-300/10 text-emerald-100' : record.status === 'claimed' ? 'border-blue-200/20 bg-blue-300/10 text-blue-100' : 'border-slate-200/20 bg-slate-300/10 text-slate-200'}`}>
														{record.status}
													</span>
												</div>
												{record.status === 'pending' ? (
													<div className="mt-3 flex flex-wrap items-center gap-2">
														<button
															type="button"
															onClick={() => void handleCancel(record.hash)}
															disabled={!!cancellingHash}
															aria-busy={cancellingHash === record.hash}
															className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-100 disabled:opacity-60"
														>
															{cancellingHash === record.hash ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
															Cancel
														</button>
													</div>
												) : null}
											</div>
										))}
									</div>
								)}
							</section>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default function ReferralRegistryDashboardPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, referralL0StartKitQuota, refreshReferralL0StartKitQuota } = useDaemonContext()
	const profile = profiles?.[0]
	const signingArmor = resolveSigningPrivateKeyArmor(profile)
	const derivedEoa = signingArmor ? new ethers.Wallet(signingArmor).address : ''
	const eoa = profile?.keyID?.trim() || derivedEoa
	const { snapshot, loading, error, isPrivileged, refresh } = useReferralRegistryRole(eoa)
	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')
	const [redeemPanelKind, setRedeemPanelKind] = useState<ReferralRedeemKind | null>(null)
	const [managedL0, setManagedL0] = useState<ReferralRegistryDownstreamItem | null>(null)
	const [shareEditor, setShareEditor] = useState<{
		mode: 'merchant' | 'l1'
		item: ReferralRegistryDownstreamItem
		initialCounterparty?: string
		initialSharePercent?: string
	} | null>(null)
	const [shareRefreshKey, setShareRefreshKey] = useState(0)
	const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)
	const [adminPackageOpen, setAdminPackageOpen] = useState(false)
	const { close, slideStyle } = useReferralSlideOut(() => navigate('/wallet'))

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const handleRefresh = useCallback(async () => {
		if (refreshStatus !== 'idle') return
		setRefreshStatus('loading')
		try {
			await Promise.all([refresh(), refreshReferralL0StartKitQuota()])
			setRefreshStatus('success')
		} catch {
			setRefreshStatus('error')
		} finally {
			window.setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}, [refresh, refreshReferralL0StartKitQuota, refreshStatus])

	const handleManagementUpdated = useCallback(async () => {
		await Promise.all([refresh({ force: true }), refreshReferralL0StartKitQuota()])
	}, [refresh, refreshReferralL0StartKitQuota])

	const l0StartKitRemaining =
		referralL0StartKitQuota && eoa && referralL0StartKitQuota.eoa.toLowerCase() === eoa.toLowerCase()
			? referralL0StartKitQuota.starterKetRemaining
			: snapshot?.role === 'l0'
				? snapshot.starterKetRemaining
				: '0'

	return (
		<div className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50 transition-transform duration-300 ease-out" style={slideStyle}>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent" aria-hidden />
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10" style={{ WebkitOverflowScrolling: 'touch' }}>
					<div className="mx-auto w-full max-w-2xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}>
						<div className="flex items-center justify-between">
									<BeamioCircularBackButton onClick={close} />
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
											onClick={() => setAdminPackageOpen(true)}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-emerald-200 transition hover:bg-emerald-300/20"
											aria-label="Manage Start Ket NFT and B-Unit redeem codes"
											title="Start Ket NFT & B-Unit codes"
										>
											<Package className="h-4 w-4" aria-hidden />
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
											onClick={() => setRedeemPanelKind('l1')}
											className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-amber-200 transition hover:bg-amber-300/20"
											aria-label="Manage L1 redeem codes"
											title="Manage L1 redeem codes"
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
								{snapshot.role === 'l0' ? (
									<L0StartKitQuotaCard
										starterKetRemaining={l0StartKitRemaining}
										onIssue={() => setRedeemPanelKind('merchant')}
									/>
								) : null}
								{snapshot.role === 'l1' ? (
									<L1MerchantSharesSection
										l0={snapshot.parentL0}
										l1={snapshot.eoa}
										refreshKey={snapshot.fetchedAt}
									/>
								) : (
									<>
										<DownstreamSection
											snapshot={snapshot}
											l0Address={snapshot.role === 'l0' ? eoa : undefined}
											shareRefreshKey={snapshot.fetchedAt + shareRefreshKey}
											onManageL0={(item) => setManagedL0(item)}
											onEditL1MerchantShare={(l1Item, row) => setShareEditor({
												mode: 'l1',
												item: l1Item,
												initialCounterparty: row.merchant,
												initialSharePercent: row.sharePercent,
											})}
										/>
										{snapshot.role === 'l0' && eoa ? (
											<L0MerchantItemsPanel
												snapshot={snapshot}
												l0Address={eoa}
												shareRefreshKey={snapshot.fetchedAt + shareRefreshKey}
												onManageMerchantShare={(item) => setShareEditor({ mode: 'merchant', item })}
											/>
										) : null}
									</>
								)}
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
					onCodesChanged={handleManagementUpdated}
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
			{shareEditor && snapshot?.role === 'l0' && signingArmor && eoa ? (
				<L0RevenueSharePanel
					mode={shareEditor.mode}
					focus={shareEditor.item}
					l0={eoa}
					l1Candidates={snapshot.downstream.filter((item) => item.role === 'l1')}
					merchantCandidates={snapshot.downstream.filter((item) => item.role === 'merchant')}
					privateKeyArmor={signingArmor}
					initialCounterparty={shareEditor.initialCounterparty}
					initialSharePercent={shareEditor.initialSharePercent}
					onClose={() => setShareEditor(null)}
					onSharesChanged={() => setShareRefreshKey((n) => n + 1)}
				/>
			) : null}
			{globalSettingsOpen && snapshot?.isAdmin && signingArmor ? (
				<ReferralGlobalSettingsDrawer
					privateKeyArmor={signingArmor}
					onClose={() => setGlobalSettingsOpen(false)}
				/>
			) : null}
			{adminPackageOpen && snapshot?.isAdmin && signingArmor ? (
				<AdminMerchantPackagePanel
					snapshot={snapshot}
					privateKeyArmor={signingArmor}
					onClose={() => setAdminPackageOpen(false)}
					onCodesChanged={handleManagementUpdated}
				/>
			) : null}
		</div>
	)
}
