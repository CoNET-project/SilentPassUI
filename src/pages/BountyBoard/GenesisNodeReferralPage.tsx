import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import {
	Ban,
	Check,
	ChevronRight,
	Copy,
	ExternalLink,
	Link2,
	Loader2,
	Pencil,
	TicketPlus,
	Users,
	Wallet,
	X,
} from 'lucide-react'
import { Toast } from 'antd-mobile'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSessionEoa } from '@/utils/resolveSessionEoa'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { formatReferralUsdcAmount6 } from '@/services/referralRegistryEarnings'
import { formatBeamioTransactionTimeLabel } from '@/utils/beamioTransactionTimeLabel'
import {
	buildGenesisEvangelistShareUrl,
	cancelGenesisL1RedeemCode,
	claimGenesisL0RedeemCode,
	claimGenesisL1RedeemCode,
	fetchGenesisL0List,
	fetchGenesisL1List,
	fetchGenesisL1RedeemCodesForIssuer,
	fetchGenesisMemberSnapshot,
	issueGenesisL1RedeemCode,
	ratioBpsToPercentLabel,
	readCachedGenesisIncome,
	setGenesisDefaultAdminPayout,
	setGenesisFoundation,
	type GenesisDownstreamL0Item,
	type GenesisDownstreamL1Item,
	type GenesisIncomeItem,
	type GenesisIncomeSnapshot,
	type GenesisL1RedeemRecord,
	type GenesisMemberSnapshot,
} from '@/services/genesisNodeReferral'

const GENESIS_SLIDE_DURATION_MS = 300
const BASE_TX_EXPLORER = 'https://basescan.org/tx/'
const CONET_TX_EXPLORER = 'https://mainnet.conet.network/tx/'

/** Partnership header capsule — CoNET explorer internal txs for this vault address. */
const GENESIS_PARTNERSHIP_VAULT_CAPSULE_ADDRESS = '0xcC300E20Ec69a4cFd692C75A84882f6b4D0d1B39'

function useGenesisSlideOut(onClose: () => void) {
	const [isClosing, setIsClosing] = useState(false)
	const [isEntered, setIsEntered] = useState(false)
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [])
	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, GENESIS_SLIDE_DURATION_MS)
	}, [isClosing, onClose])
	const transform = isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)'
	return { close, slideStyle: { transform } }
}

function shortTxHash(transactionHash: string): string {
	return transactionHash.length > 12
		? `${transactionHash.slice(0, 8)}…${transactionHash.slice(-6)}`
		: transactionHash
}

function isTxHash(value: string | null | undefined): value is string {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value.trim())
}

function GenesisTxHashCapsule({
	transactionHash,
	href,
	label,
	timestampMs,
}: {
	transactionHash: string
	href: string
	label: string
	timestampMs?: number
}) {
	const timeLabel =
		timestampMs != null && timestampMs > 0 ? formatBeamioTransactionTimeLabel(timestampMs) : null
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-left text-xs text-slate-200 transition hover:bg-white/10"
			aria-label={
				timeLabel
					? `Open ${label} ${transactionHash}, ${timeLabel}`
					: `Open ${label} ${transactionHash}`
			}
		>
			<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
				{label}
			</span>
			<span className="truncate font-mono">{shortTxHash(transactionHash)}</span>
			{timeLabel ? <span className="shrink-0 text-slate-400">{timeLabel}</span> : null}
			<ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
		</a>
	)
}

/** Base USDC purchase hash + CoNET voteBridgeOperation (mint/split) hash side by side. */
function GenesisPurchaseHashPair({
	baseTxHash,
	conetSplitTxHash,
	timestampMs,
}: {
	baseTxHash: string
	conetSplitTxHash?: string | null
	timestampMs?: number
}) {
	const conetHash = isTxHash(conetSplitTxHash) ? conetSplitTxHash.trim() : null
	return (
		<div className="flex flex-wrap items-center gap-2">
			<GenesisTxHashCapsule
				transactionHash={baseTxHash}
				href={`${BASE_TX_EXPLORER}${baseTxHash}`}
				label="Base"
				timestampMs={timestampMs}
			/>
			{conetHash ? (
				<GenesisTxHashCapsule
					transactionHash={conetHash}
					href={`${CONET_TX_EXPLORER}${conetHash}`}
					label="CoNET"
				/>
			) : null}
		</div>
	)
}

function genesisIncomeConetSplitHash(item: GenesisIncomeItem): string | null {
	if (isTxHash(item.bridgeSettleTxHash)) return item.bridgeSettleTxHash.trim()
	return null
}

function genesisIncomeRoleLabel(role: GenesisIncomeItem['role']): string {
	switch (role) {
		case 'l0':
			return 'L0 share'
		case 'l1':
			return 'L1 share'
		case 'admin':
			return 'Admin share'
		case 'foundation':
			return 'Foundation share'
		default:
			return 'Share'
	}
}

function incomeAddressKey(address: string): string {
	try {
		return ethers.getAddress(address).toLowerCase()
	} catch {
		return address.toLowerCase()
	}
}

/** Downstream L0/L1 row: income summary only — opens Purchase history page. */
function GenesisDownstreamIncomeSummary({
	earnedUsdc6,
	purchaseCount,
	loading,
	onOpen,
}: {
	earnedUsdc6: string
	purchaseCount: number
	loading?: boolean
	onOpen: () => void
}) {
	const summary =
		loading && purchaseCount === 0
			? 'Loading…'
			: purchaseCount === 0
				? 'No purchases yet'
				: `${purchaseCount} purchase${purchaseCount === 1 ? '' : 's'} · $${formatReferralUsdcAmount6(earnedUsdc6)}`
	return (
		<button
			type="button"
			onClick={onOpen}
			className="mt-2.5 flex w-full items-center justify-between gap-2 border-t border-white/5 pt-2.5 text-left transition hover:opacity-90"
			aria-label={`Income summary: ${summary}. Open purchase history.`}
		>
			<div className="min-w-0">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
					Income summary
				</p>
				<p className="mt-0.5 text-xs text-slate-300">{summary}</p>
			</div>
			{loading ? (
				<Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
			) : (
				<ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
			)}
		</button>
	)
}

function GenesisIncomeDetailPanel({
	earnedUsdc6,
	items,
	loading,
	error,
	onClose,
	heading = 'Income',
	partnerAddress,
}: {
	earnedUsdc6: string
	items: GenesisIncomeItem[]
	loading: boolean
	error: string | null
	onClose: () => void
	/** Top-right page label (e.g. Purchase history for Downstream partners). */
	heading?: string
	/** When set, show partner BeamioTag under the title. */
	partnerAddress?: string | null
}) {
	const { close, slideStyle } = useGenesisSlideOut(onClose)
	const showPurchaseHistoryHeading = heading.toLowerCase().includes('purchase')
	return (
		<div
			className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50 transition-transform duration-300 ease-out"
			style={slideStyle}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent"
				aria-hidden
			/>
			<div
				className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10"
				style={{ WebkitOverflowScrolling: 'touch' }}
			>
				<div
					className="mx-auto w-full max-w-2xl"
					style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
				>
					<div className="flex items-center justify-between">
						<BeamioCircularBackButton onClick={close} />
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
							{heading}
						</p>
					</div>
					{partnerAddress && ethers.isAddress(partnerAddress) ? (
						<div className="mt-5">
							<BeamioTagCapsule address={partnerAddress} />
						</div>
					) : null}
					<div
						className={[
							'rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] p-5',
							partnerAddress ? 'mt-4' : 'mt-6',
						].join(' ')}
					>
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
							Total earned
						</p>
						<p className="mt-1 text-3xl font-semibold tabular-nums text-white">
							${formatReferralUsdcAmount6(earnedUsdc6)}
						</p>
						<p className="mt-2 text-xs text-emerald-100/80">
							{items.length === 0
								? 'No purchase credits yet'
								: `${items.length} purchase credit${items.length === 1 ? '' : 's'}`}
						</p>
					</div>
					<div className="mt-4 space-y-3">
						{!showPurchaseHistoryHeading ? (
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
								Purchase history
							</p>
						) : null}
						{loading && items.length === 0 ? (
							<div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								Loading income items…
							</div>
						) : null}
						{error && items.length === 0 ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
								{error}
							</div>
						) : null}
						{!loading && !error && items.length === 0 ? (
							<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
								No Genesis Seat purchases have credited this wallet yet.
							</div>
						) : null}
						{items.map((item) => (
							<div
								key={`${item.transactionHash}:${item.role}:${item.amountUsdc6}`}
								className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
							>
								<div className="flex items-start justify-between gap-3">
									<p className="text-sm font-medium text-white">{genesisIncomeRoleLabel(item.role)}</p>
									<p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-300">
										+${formatReferralUsdcAmount6(item.amountUsdc6)}
									</p>
								</div>
								{item.qty ? (
									<p className="mt-1 text-xs text-slate-400">
										{item.qty} seat{item.qty === '1' ? '' : 's'}
										{item.testMode ? ' · test mode' : ''}
									</p>
								) : null}
								<div className="mt-2.5">
									<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
										Purchase hashes
									</p>
									<GenesisPurchaseHashPair
										baseTxHash={item.transactionHash}
										conetSplitTxHash={genesisIncomeConetSplitHash(item)}
										timestampMs={item.timestampMs}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

/** Vault proxy address capsule → CoNET explorer internal_txns tab (+ copy full address). */
function GenesisVaultAddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = useState(false)
	const fullAddress = useMemo(() => {
		try {
			return ethers.isAddress(address) ? ethers.getAddress(address) : ''
		} catch {
			return ''
		}
	}, [address])
	if (!fullAddress) return null
	const short = `${fullAddress.slice(0, 6)}…${fullAddress.slice(-4)}`
	const explorerInternalTxnsUrl = `https://mainnet.conet.network/address/${fullAddress}?tab=internal_txns`

	const openInternalTxns = () => {
		openExternalUrl(explorerInternalTxnsUrl)
	}

	const copyAddress = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		try {
			await navigator.clipboard.writeText(fullAddress)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			/* ignore */
		}
	}

	return (
		<div className="mt-2 inline-flex max-w-full items-center overflow-hidden rounded-full border border-white/20 bg-white/15 text-white/90 backdrop-blur-sm">
			<button
				type="button"
				onClick={openInternalTxns}
				className="inline-flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1.5 font-mono text-[11px] font-semibold transition hover:bg-white/20"
				aria-label={`Open vault ${short} internal transactions on CoNET Explorer`}
			>
				<span className="truncate">{short}</span>
				<ExternalLink className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
			</button>
			<button
				type="button"
				onClick={(e) => void copyAddress(e)}
				className="inline-flex h-7 w-7 shrink-0 items-center justify-center border-l border-white/15 transition hover:bg-white/20"
				aria-label={copied ? 'Address copied' : 'Copy vault address'}
			>
				{copied ? (
					<Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.25} aria-hidden />
				) : (
					<Copy className="h-3.5 w-3.5 opacity-80" strokeWidth={2} aria-hidden />
				)}
			</button>
		</div>
	)
}

/** Same capsule chrome as `/wallet/referral-registry` Downstream rows. */
function BeamioTagCapsule({
	address,
	rebatePercent,
	onEdit,
}: {
	address: string
	rebatePercent?: string
	onEdit?: () => void
}) {
	const { resolveTagPlain, avatarImgUrl } = useBeamioTagDatabase()
	const tag = resolveTagPlain(address)
	const displayTag = tag || 'Beamio'
	const hasExtras = rebatePercent != null || Boolean(onEdit)
	return (
		<div
			className={`inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200/20 bg-indigo-300/10 text-sm font-medium text-indigo-100 ${hasExtras ? 'py-1.5 pl-2 pr-1.5' : 'px-2.5 py-1.5'}`}
			aria-label={
				rebatePercent != null
					? `Beamio tag @${displayTag}, ${rebatePercent}%`
					: `Beamio tag @${displayTag}`
			}
		>
			<img
				src={avatarImgUrl(tag, address)}
				alt=""
				className="h-6 w-6 shrink-0 rounded-full object-cover"
				aria-hidden
			/>
			<span className="min-w-0 truncate">@{displayTag}</span>
			{rebatePercent != null ? (
				<span className="shrink-0 rounded-full border border-indigo-200/25 bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
					{rebatePercent}%
				</span>
			) : null}
			{onEdit ? (
				<button
					type="button"
					onClick={onEdit}
					className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-200/30 bg-indigo-200/15 text-indigo-50 transition hover:bg-indigo-200/25"
					aria-label={`Edit @${displayTag}`}
					title="Edit"
				>
					<Pencil className="h-3 w-3" aria-hidden />
				</button>
			) : null}
		</div>
	)
}

function preventNumericStepKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
	if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericWheelStep(e: React.WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

function shortAddr(addr: string): string {
	if (!addr || addr.length < 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function statusChipClass(status: GenesisL1RedeemRecord['status']): string {
	switch (status) {
		case 'pending':
			return 'bg-amber-400/10 text-amber-100 border-amber-300/20'
		case 'claimed':
			return 'bg-emerald-400/10 text-emerald-100 border-emerald-300/20'
		case 'cancelled':
			return 'bg-white/[0.06] text-slate-300 border-white/10'
		default:
			return 'bg-white/[0.06] text-slate-300 border-white/10'
	}
}

/** percent 0–100 → ratioBps */
function percentInputToBps(raw: string): number | null {
	const n = Number(raw)
	if (!Number.isFinite(n) || n < 0 || n > 100) return null
	return Math.round(n * 100)
}

/**
 * Genesis Node referral — full-page secondary screen from Bounty Board Share.
 * Hides global Footer; circular back returns to /BountyBoard.
 */
export default function GenesisNodeReferralPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, genesisIncomeByEoa, registerGenesisIncomeFeedAccounts, refreshGenesisIncomeFeed } =
		useDaemonContext()
	const { ensureProfilesForAddresses } = useBeamioTagDatabase()
	const eoa = useMemo(() => resolveSessionEoa(profiles), [profiles])

	const [snapshot, setSnapshot] = useState<GenesisMemberSnapshot | null>(null)
	const [l0List, setL0List] = useState<GenesisDownstreamL0Item[]>([])
	const [l1List, setL1List] = useState<GenesisDownstreamL1Item[]>([])
	const [l1Codes, setL1Codes] = useState<GenesisL1RedeemRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [issuingL1, setIssuingL1] = useState(false)
	const [cancellingHash, setCancellingHash] = useState<string | null>(null)
	const [claimCode, setClaimCode] = useState('')
	const [claiming, setClaiming] = useState(false)
	const [l1SharePercent, setL1SharePercent] = useState('50')
	const [copiedKey, setCopiedKey] = useState<string | null>(null)
	const [error, setError] = useState('')
	const [lastIssuedL1Secret, setLastIssuedL1Secret] = useState<string | null>(null)
	const [foundationDraft, setFoundationDraft] = useState('')
	const [adminPayoutDraft, setAdminPayoutDraft] = useState('')
	const [editingPayout, setEditingPayout] = useState<'foundation' | 'adminPayout' | null>(null)
	const [savingPayout, setSavingPayout] = useState<'foundation' | 'adminPayout' | null>(null)
	const [payoutDrawerOpen, setPayoutDrawerOpen] = useState(false)
	const [payoutDrawerClosing, setPayoutDrawerClosing] = useState(false)
	const [incomeOpen, setIncomeOpen] = useState(false)
	const [incomeRefreshing, setIncomeRefreshing] = useState(false)
	/** Downstream partner Purchase history slide-out target. */
	const [purchaseHistoryPartner, setPurchaseHistoryPartner] = useState<{
		address: string
		earnedUsdc6: string
	} | null>(null)

	const issueL1InFlightRef = useRef(false)
	const claimInFlightRef = useRef(false)
	const payoutInFlightRef = useRef(false)
	const payoutDrawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const armor = useMemo(
		() => resolveSigningPrivateKeyArmor(profiles?.[0] ?? CoNET_Data?.profiles?.[0]),
		[profiles],
	)

	const reload = useCallback(async () => {
		if (!eoa || !ethers.isAddress(eoa)) {
			setSnapshot(null)
			setL0List([])
			setL1List([])
			setL1Codes([])
			return
		}
		setLoading(true)
		setError('')
		try {
			const snap = await fetchGenesisMemberSnapshot(eoa)
			setSnapshot(snap)
			if (snap) {
				setFoundationDraft(snap.foundation)
				setAdminPayoutDraft(snap.defaultAdminPayout)
			}
			if (snap?.isAdmin) {
				const list = await fetchGenesisL0List(eoa).catch(() => [] as GenesisDownstreamL0Item[])
				setL0List(list)
			} else {
				setL0List([])
			}
			if (snap?.isL0) {
				const [children, issuedL1] = await Promise.all([
					fetchGenesisL1List(eoa).catch(() => [] as GenesisDownstreamL1Item[]),
					fetchGenesisL1RedeemCodesForIssuer(eoa).catch(() => [] as GenesisL1RedeemRecord[]),
				])
				setL1List(children)
				setL1Codes(issuedL1)
			} else {
				setL1List([])
				setL1Codes([])
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not load Genesis referral data.')
		} finally {
			setLoading(false)
		}
	}, [eoa])

	useEffect(() => {
		void reload()
	}, [reload])

	const income = useMemo((): GenesisIncomeSnapshot | null => {
		if (!eoa || !ethers.isAddress(eoa)) return null
		const key = incomeAddressKey(eoa)
		return genesisIncomeByEoa[key] ?? readCachedGenesisIncome(eoa)
	}, [eoa, genesisIncomeByEoa])

	const resolvePartnerIncomeItems = useCallback(
		(address: string): GenesisIncomeItem[] => {
			const key = incomeAddressKey(address)
			return (
				genesisIncomeByEoa[key]?.items ??
				readCachedGenesisIncome(address)?.items ??
				[]
			)
		},
		[genesisIncomeByEoa],
	)

	const downstreamPartnerAddresses = useMemo(() => {
		const keys = new Set<string>()
		const ordered: string[] = []
		for (const row of [...l0List, ...l1List]) {
			if (!row.address || !ethers.isAddress(row.address)) continue
			const key = incomeAddressKey(row.address)
			if (keys.has(key)) continue
			keys.add(key)
			ordered.push(ethers.getAddress(row.address))
		}
		return ordered
	}, [l0List, l1List])

	/** Register self + Downstream partners for daemon incremental purchase-history sync. */
	useEffect(() => {
		const accounts: string[] = []
		if (eoa && ethers.isAddress(eoa)) accounts.push(eoa)
		accounts.push(...downstreamPartnerAddresses)
		if (accounts.length === 0) return
		registerGenesisIncomeFeedAccounts(accounts)
	}, [eoa, downstreamPartnerAddresses, registerGenesisIncomeFeedAccounts])

	const openDownstreamPurchaseHistory = useCallback((address: string, earnedUsdc6: string) => {
		if (!ethers.isAddress(address)) return
		setPurchaseHistoryPartner({ address: ethers.getAddress(address), earnedUsdc6 })
	}, [])

	const handleIssueL1 = useCallback(async () => {
		if (issueL1InFlightRef.current || !snapshot?.isL0) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		const ratioBps = percentInputToBps(l1SharePercent)
		if (ratioBps == null) {
			setError('L1 share must be a number from 0 to 100.')
			return
		}
		issueL1InFlightRef.current = true
		setIssuingL1(true)
		setError('')
		try {
			const issued = await issueGenesisL1RedeemCode({ issuerPrivateKeyArmor: armor, ratioBps })
			setLastIssuedL1Secret(issued.secret)
			Toast.show({ content: 'L1 Evangelist code created', position: 'center' })
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not issue L1 redeem code.')
		} finally {
			issueL1InFlightRef.current = false
			setIssuingL1(false)
		}
	}, [armor, l1SharePercent, reload, snapshot?.isL0])

	const handleCancelL1 = useCallback(
		async (hash: string) => {
			if (!armor || cancellingHash) return
			setCancellingHash(hash)
			setError('')
			try {
				await cancelGenesisL1RedeemCode({ issuerPrivateKeyArmor: armor, hash })
				Toast.show({ content: 'L1 code cancelled', position: 'center' })
				await reload()
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : 'Could not cancel L1 code.')
			} finally {
				setCancellingHash(null)
			}
		},
		[armor, cancellingHash, reload],
	)

	const handleClaim = useCallback(async () => {
		if (claimInFlightRef.current) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		const secret = claimCode.trim()
		if (!secret) {
			setError('Enter a Genesis redeem code.')
			return
		}
		claimInFlightRef.current = true
		setClaiming(true)
		setError('')
		try {
			const isL1Code = secret.toLowerCase().includes('genesis-l1')
			if (isL1Code) {
				await claimGenesisL1RedeemCode({ claimerPrivateKeyArmor: armor, secret })
				Toast.show({ content: 'You are now a Genesis L1 Evangelist', position: 'center' })
			} else {
				await claimGenesisL0RedeemCode({ claimerPrivateKeyArmor: armor, secret })
				Toast.show({ content: 'You are now a Genesis L0', position: 'center' })
			}
			setClaimCode('')
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not claim redeem code.')
		} finally {
			claimInFlightRef.current = false
			setClaiming(false)
		}
	}, [armor, claimCode, reload])

	const handleSaveFoundation = useCallback(async () => {
		if (payoutInFlightRef.current || !snapshot?.isAdmin) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		payoutInFlightRef.current = true
		setSavingPayout('foundation')
		setError('')
		try {
			await setGenesisFoundation({ adminPrivateKeyArmor: armor, foundation: foundationDraft.trim() })
			Toast.show({ content: 'Foundation address updated', position: 'center' })
			setEditingPayout(null)
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update foundation.')
		} finally {
			payoutInFlightRef.current = false
			setSavingPayout(null)
		}
	}, [armor, foundationDraft, reload, snapshot?.isAdmin])

	const handleSaveAdminPayout = useCallback(async () => {
		if (payoutInFlightRef.current || !snapshot?.isAdmin) return
		if (!armor) {
			setError('Unlock your wallet to sign.')
			return
		}
		payoutInFlightRef.current = true
		setSavingPayout('adminPayout')
		setError('')
		try {
			await setGenesisDefaultAdminPayout({
				adminPrivateKeyArmor: armor,
				payout: adminPayoutDraft.trim(),
			})
			Toast.show({ content: 'Default admin payout updated', position: 'center' })
			setEditingPayout(null)
			await reload()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update default admin payout.')
		} finally {
			payoutInFlightRef.current = false
			setSavingPayout(null)
		}
	}, [adminPayoutDraft, armor, reload, snapshot?.isAdmin])

	const cancelPayoutEdit = useCallback(
		(kind: 'foundation' | 'adminPayout') => {
			if (savingPayout) return
			if (kind === 'foundation') setFoundationDraft(snapshot?.foundation ?? '')
			else setAdminPayoutDraft(snapshot?.defaultAdminPayout ?? '')
			setEditingPayout(null)
		},
		[savingPayout, snapshot?.defaultAdminPayout, snapshot?.foundation],
	)

	const closePayoutDrawer = useCallback(() => {
		if (payoutDrawerClosing || !payoutDrawerOpen) return
		if (savingPayout) return
		setPayoutDrawerClosing(true)
		setEditingPayout(null)
		if (snapshot) {
			setFoundationDraft(snapshot.foundation)
			setAdminPayoutDraft(snapshot.defaultAdminPayout)
		}
		if (payoutDrawerCloseTimerRef.current) clearTimeout(payoutDrawerCloseTimerRef.current)
		payoutDrawerCloseTimerRef.current = setTimeout(() => {
			setPayoutDrawerOpen(false)
			setPayoutDrawerClosing(false)
			payoutDrawerCloseTimerRef.current = null
		}, 300)
	}, [payoutDrawerClosing, payoutDrawerOpen, savingPayout, snapshot])

	const openPayoutDrawer = useCallback(() => {
		if (payoutDrawerClosing) return
		if (payoutDrawerCloseTimerRef.current) {
			clearTimeout(payoutDrawerCloseTimerRef.current)
			payoutDrawerCloseTimerRef.current = null
		}
		setPayoutDrawerClosing(false)
		setPayoutDrawerOpen(true)
	}, [payoutDrawerClosing])

	useEffect(() => {
		return () => {
			if (payoutDrawerCloseTimerRef.current) clearTimeout(payoutDrawerCloseTimerRef.current)
		}
	}, [])

	const copyText = useCallback(async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey(null), 2000)
		} catch {
			setError('Could not copy to clipboard.')
		}
	}, [])

	const evangelistUrl = useMemo(() => {
		if (!eoa || !ethers.isAddress(eoa) || !snapshot?.isL1) return ''
		return buildGenesisEvangelistShareUrl(eoa)
	}, [eoa, snapshot?.isL1])

	const profileAddresses = useMemo(() => {
		const addrs: string[] = []
		for (const row of l0List) addrs.push(row.address)
		for (const row of l1List) addrs.push(row.address)
		if (snapshot?.foundation) addrs.push(snapshot.foundation)
		if (snapshot?.defaultAdminPayout) addrs.push(snapshot.defaultAdminPayout)
		if (snapshot?.parentAdmin) addrs.push(snapshot.parentAdmin)
		if (snapshot?.parentL0) addrs.push(snapshot.parentL0)
		return addrs
	}, [l0List, l1List, snapshot?.defaultAdminPayout, snapshot?.foundation, snapshot?.parentAdmin, snapshot?.parentL0])

	useEffect(() => {
		if (profileAddresses.length === 0) return
		void ensureProfilesForAddresses(profileAddresses)
	}, [ensureProfilesForAddresses, profileAddresses.join('|').toLowerCase()])

	/** Hide claim once the wallet is already Admin, L0, or L1. */
	const showClaim = !snapshot?.isL0 && !snapshot?.isL1 && !snapshot?.isAdmin

	const roleLabel = snapshot?.isAdmin
		? 'Admin'
		: snapshot?.isL0
			? 'L0'
			: snapshot?.isL1
				? 'L1 Evangelist'
				: 'Not registered'

	const earnedUsdcLabel = formatReferralUsdcAmount6(snapshot?.earnedUsdc6 ?? '0')

	return (
		<div className="fixed inset-0 z-[90] flex min-h-0 flex-col overflow-hidden bg-[#050b1d] text-slate-50">
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent"
				aria-hidden
			/>
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<div
					className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10"
					style={{ WebkitOverflowScrolling: 'touch' }}
				>
					<div
						className="mx-auto w-full max-w-2xl"
						style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
					>
						<div className="flex items-center justify-between">
							<BeamioCircularBackButton onClick={() => navigate('/BountyBoard')} />
							{snapshot?.isAdmin ? (
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={openPayoutDrawer}
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/20 bg-indigo-300/10 text-indigo-200 transition hover:bg-indigo-300/20"
										aria-label="Payout addresses"
										title="Payout addresses"
									>
										<Wallet className="h-4 w-4" aria-hidden />
									</button>
									<button
										type="button"
										onClick={() => navigate('/BountyBoard/genesis-referral/redeem')}
										className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/20 bg-indigo-300/10 text-indigo-200 transition hover:bg-indigo-300/20"
										aria-label="Manage L0 redeem codes"
										title="Manage L0 redeem codes"
									>
										<TicketPlus className="h-4 w-4" aria-hidden />
									</button>
								</div>
							) : null}
						</div>
						<header className="pb-7 pt-8">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
								Genesis Node
							</p>
							<div className="mt-2 flex items-start gap-3">
								<div className="flex min-w-0 flex-1 items-center gap-2.5 pt-0.5">
									<h1 className="shrink-0 text-3xl font-semibold tracking-tight">Partnership</h1>
									{eoa && snapshot ? (
										<span
											className="shrink-0 rounded-full border border-indigo-200/20 bg-indigo-300/10 px-2.5 py-1 text-xs font-semibold text-indigo-100"
											aria-label={`Current Genesis referral role: ${roleLabel}`}
										>
											{roleLabel}
										</span>
									) : null}
								</div>
								{eoa ? (
									<button
										type="button"
										onClick={() => setIncomeOpen(true)}
										className="shrink-0 text-right"
										aria-label={`Earned USDC $${earnedUsdcLabel}. Open income details.`}
										title="Income details"
									>
										<p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
											Earned USDC
										</p>
										<p className="mt-1 text-3xl font-semibold tabular-nums text-white">
											{loading && !snapshot ? '…' : `$${earnedUsdcLabel}`}
										</p>
									</button>
								) : null}
							</div>
							<GenesisVaultAddressCapsule address={GENESIS_PARTNERSHIP_VAULT_CAPSULE_ADDRESS} />
						</header>

						{!eoa ? (
							<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
								Connect a wallet to manage Genesis referral.
							</div>
						) : loading && !snapshot ? (
							<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
								<Loader2 className="h-5 w-5 animate-spin text-indigo-300" aria-hidden />
								<span>Loading…</span>
							</div>
						) : (
						<div className="space-y-4">
							{error ? (
								<div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100">
									{error}
								</div>
							) : null}

							{eoa ? (
								<section className="rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] p-4">
									<button
										type="button"
										onClick={() => {
											setIncomeOpen(true)
											setIncomeRefreshing(true)
											void refreshGenesisIncomeFeed().finally(() => setIncomeRefreshing(false))
										}}
										className="flex w-full items-center justify-between gap-3 text-left"
										aria-label="Open income details"
									>
										<div className="min-w-0">
											<p className="text-sm font-bold text-emerald-50">Income details</p>
											<p className="mt-0.5 text-xs text-emerald-100/70">
												{(income?.items.length ?? 0) === 0
													? 'No purchase credits yet'
													: `${income?.items.length} purchase hash${
															(income?.items.length ?? 0) === 1 ? '' : 'es'
														}`}
											</p>
										</div>
										{incomeRefreshing ? (
											<Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-200" aria-hidden />
										) : (
											<Wallet className="h-4 w-4 shrink-0 text-emerald-200" aria-hidden />
										)}
									</button>
								</section>
							) : null}

							{snapshot?.isL1 && evangelistUrl ? (
								<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
									<div className="flex items-center gap-2">
										<Link2 className="h-4 w-4 text-purple-200" aria-hidden />
										<h2 className="text-sm font-bold text-slate-50">Evangelist link</h2>
									</div>
									<p className="mt-1 text-xs text-slate-400">
										Buyers must attribute seats to an L1 Evangelist (not L0). Share this Discover link.
									</p>
									<button
										type="button"
										onClick={() => void copyText('evangelist', evangelistUrl)}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8d3a8b] px-3 py-2.5 text-sm font-semibold text-white"
									>
										{copiedKey === 'evangelist' ? (
											<Check className="h-4 w-4 text-emerald-300" aria-hidden />
										) : (
											<Copy className="h-4 w-4" aria-hidden />
										)}
										{copiedKey === 'evangelist' ? 'Copied' : 'Copy Evangelist link'}
									</button>
								</section>
							) : null}

							{snapshot?.isL0 ? (
								<>
									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<TicketPlus className="h-4 w-4 text-purple-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Issue L1 Evangelist</h2>
										</div>
										<p className="mt-1 text-xs text-slate-400">
											Set what percent of your 10% node pool (125 USDC/node) goes to this L1. Remainder stays
											with you.
										</p>
										<label htmlFor="genesis-l1-share" className="mt-3 block text-xs font-semibold text-slate-300">
											L1 share of your 10% pool (%)
										</label>
										<input
											id="genesis-l1-share"
											type="number"
											inputMode="decimal"
											autoComplete="off"
											enterKeyHint="done"
											min={0}
											max={100}
											step={1}
											value={l1SharePercent}
											onChange={(e) => setL1SharePercent(e.target.value)}
											onKeyDown={preventNumericStepKeys}
											onWheel={preventNumericWheelStep}
											className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm tabular-nums text-slate-50 placeholder:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
										/>
										<button
											type="button"
											onClick={() => void handleIssueL1()}
											disabled={issuingL1 || !armor}
											aria-busy={issuingL1}
											className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8d3a8b] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										>
											{issuingL1 ? (
												<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
											) : (
												<TicketPlus className="h-4 w-4" aria-hidden />
											)}
											{issuingL1 ? 'Creating…' : 'Create L1 redeem code'}
										</button>
										{lastIssuedL1Secret ? (
											<div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
												<p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
													New L1 code
												</p>
												<p className="mt-1 break-all font-mono text-xs text-emerald-50">
													{lastIssuedL1Secret}
												</p>
												<button
													type="button"
													onClick={() => void copyText('lastL1', lastIssuedL1Secret)}
													className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200"
												>
													{copiedKey === 'lastL1' ? (
														<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
													) : (
														<Copy className="h-3.5 w-3.5" aria-hidden />
													)}
													Copy code
												</button>
											</div>
										) : null}

										<ul className="mt-4 space-y-2">
											{l1Codes.length === 0 ? (
												<li className="text-xs text-slate-500">No L1 codes yet.</li>
											) : (
												l1Codes.map((row) => (
													<li
														key={row.hash}
														className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0">
																<span
																	className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChipClass(row.status)}`}
																>
																	{row.status}
																</span>
																<span className="ml-2 text-[10px] font-semibold text-slate-400">
																	{ratioBpsToPercentLabel(row.ratioBps)} of L0 pool
																</span>
																<p className="mt-1 break-all font-mono text-[11px] text-slate-300">
																	{row.secret ?? `${shortAddr(row.hash)} (secret not on this device)`}
																</p>
															</div>
															<div className="flex shrink-0 items-center gap-1">
																{row.secret ? (
																	<button
																		type="button"
																		onClick={() => void copyText(row.hash, row.secret!)}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200"
																		aria-label="Copy redeem code"
																	>
																		{copiedKey === row.hash ? (
																			<Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
																		) : (
																			<Copy className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
																{row.status === 'pending' ? (
																	<button
																		type="button"
																		onClick={() => void handleCancelL1(row.hash)}
																		disabled={cancellingHash === row.hash}
																		aria-busy={cancellingHash === row.hash}
																		className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-300"
																		aria-label="Cancel redeem code"
																	>
																		{cancellingHash === row.hash ? (
																			<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
																		) : (
																			<Ban className="h-3.5 w-3.5" aria-hidden />
																		)}
																	</button>
																) : null}
															</div>
														</div>
													</li>
												))
											)}
										</ul>
									</section>

									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-purple-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Downstream L1</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-500">
												{l1List.length} item{l1List.length === 1 ? '' : 's'}
											</span>
										</div>
										{l1List.length === 0 ? (
											<p className="mt-3 text-xs text-slate-500">No L1 Evangelists yet.</p>
										) : (
											<div className="mt-3 space-y-2">
												{l1List.map((row) => {
													const partnerItems = resolvePartnerIncomeItems(row.address)
													return (
														<div
															key={row.address}
															className="rounded-xl border border-white/10 bg-black/10 p-3"
														>
															<div className="flex min-w-0 items-center justify-between gap-2">
																<div className="min-w-0 flex-1">
																	<BeamioTagCapsule
																		address={row.address}
																		rebatePercent={String(Number((row.ratioBps / 100).toFixed(2)))}
																	/>
																</div>
																<p className="shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-200">
																	${formatReferralUsdcAmount6(row.earnedUsdc6)}
																</p>
															</div>
															<GenesisDownstreamIncomeSummary
																earnedUsdc6={row.earnedUsdc6}
																purchaseCount={partnerItems.length}
																onOpen={() =>
																	openDownstreamPurchaseHistory(row.address, row.earnedUsdc6)
																}
															/>
														</div>
													)
												})}
											</div>
										)}
									</section>
								</>
							) : null}

							{snapshot?.isAdmin ? (
								<>
									<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-indigo-200" aria-hidden />
											<h2 className="text-sm font-bold text-slate-50">Downstream L0</h2>
											<span className="ml-auto text-xs font-semibold tabular-nums text-slate-500">
												{l0List.length} item{l0List.length === 1 ? '' : 's'}
											</span>
										</div>
										{l0List.length === 0 ? (
											<p className="mt-3 text-xs text-slate-500">No L0 members yet.</p>
										) : (
											<div className="mt-3 space-y-2">
												{l0List.map((row) => {
													const partnerItems = resolvePartnerIncomeItems(row.address)
													return (
														<div
															key={row.address}
															className="rounded-xl border border-white/10 bg-black/10 p-3"
														>
															<div className="flex min-w-0 items-center justify-between gap-2">
																<div className="min-w-0 flex-1">
																	<BeamioTagCapsule address={row.address} />
																</div>
																<div className="shrink-0 text-right">
																	<p className="text-sm font-semibold tabular-nums text-emerald-200">
																		${formatReferralUsdcAmount6(row.earnedUsdc6)}
																	</p>
																	<p className="text-[10px] text-slate-500">
																		{row.l1Count} item{row.l1Count === 1 ? '' : 's'}
																	</p>
																</div>
															</div>
															<GenesisDownstreamIncomeSummary
																earnedUsdc6={row.earnedUsdc6}
																purchaseCount={partnerItems.length}
																onOpen={() =>
																	openDownstreamPurchaseHistory(row.address, row.earnedUsdc6)
																}
															/>
														</div>
													)
												})}
											</div>
										)}
									</section>
								</>
							) : null}

							{showClaim ? (
								<section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
									<h2 className="text-sm font-bold text-slate-50">Claim redeem code</h2>
									<p className="mt-1 text-xs text-slate-400">
										Paste an L0 code (from Admin) or L1 Evangelist code (from L0). Codes starting with{' '}
										<span className="font-mono text-slate-300">beamio-genesis-l1-</span> register as L1.
									</p>
									<input
										type="text"
										value={claimCode}
										onChange={(e) => setClaimCode(e.target.value)}
										placeholder="beamio-genesis-l0-… or beamio-genesis-l1-…"
										autoComplete="off"
										enterKeyHint="done"
										className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-sm text-slate-50 placeholder:text-slate-500"
									/>
									<button
										type="button"
										onClick={() => void handleClaim()}
										disabled={claiming || !armor || !claimCode.trim()}
										aria-busy={claiming}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
									>
										{claiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
										{claiming ? 'Claiming…' : 'Claim'}
									</button>
								</section>
							) : null}
						</div>
						)}
					</div>
				</div>
			</div>

			{/* Admin payout addresses — bottom sheet (opened from top-right Wallet control). */}
			{snapshot?.isAdmin ? (
				<div
					className={[
						'fixed inset-0 z-[100]',
						payoutDrawerOpen && !payoutDrawerClosing
							? 'pointer-events-auto'
							: 'pointer-events-none',
					].join(' ')}
				>
					<div
						className={[
							'absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out',
							payoutDrawerOpen && !payoutDrawerClosing
								? 'opacity-100'
								: 'opacity-0 pointer-events-none',
						].join(' ')}
						onClick={closePayoutDrawer}
						aria-hidden={!payoutDrawerOpen || payoutDrawerClosing}
					/>
					<div
						className={[
							'absolute inset-x-0 bottom-0 transition-transform duration-300 ease-out will-change-transform',
							payoutDrawerOpen && !payoutDrawerClosing
								? 'translate-y-0'
								: 'translate-y-full pointer-events-none',
						].join(' ')}
						onTouchMove={(e) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
						aria-label="Payout addresses"
					>
						<div className="max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-y-auto rounded-t-[22px] border border-white/10 bg-[#0b1224] pb-[env(safe-area-inset-bottom)] shadow-2xl">
							<div className="flex justify-center pb-1 pt-2">
								<div className="h-1 w-10 rounded-full bg-white/20" />
							</div>
							<div className="relative flex items-center justify-center px-4 pb-3 pt-1">
								<button
									type="button"
									tabIndex={-1}
									onClick={closePayoutDrawer}
									disabled={savingPayout !== null}
									className="absolute left-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-200 transition hover:bg-white/15 disabled:opacity-50"
									aria-label="Close"
								>
									<X className="h-4 w-4" aria-hidden />
								</button>
								<h2 className="text-sm font-bold text-slate-50">Payout addresses</h2>
							</div>
							<div className="px-5 pb-6">
								<p className="text-xs text-slate-400">
									Tap the edit icon on a BeamioTag capsule to change Foundation or Default admin payout
									(gasless).
								</p>
								<div className="mt-4 space-y-4">
									<div>
										<p className="text-xs font-semibold text-slate-400">Foundation</p>
										{editingPayout === 'foundation' ? (
											<div className="mt-2 space-y-2">
												<input
													id="genesis-foundation"
													type="text"
													value={foundationDraft}
													onChange={(e) => setFoundationDraft(e.target.value)}
													autoComplete="off"
													spellCheck={false}
													placeholder="0x…"
													className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-xs text-slate-50 placeholder:text-slate-500"
												/>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => cancelPayoutEdit('foundation')}
														disabled={savingPayout !== null}
														className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"
													>
														<X className="h-4 w-4" aria-hidden />
														Cancel
													</button>
													<button
														type="button"
														onClick={() => void handleSaveFoundation()}
														disabled={
															savingPayout !== null ||
															!armor ||
															!ethers.isAddress(foundationDraft.trim()) ||
															foundationDraft.trim().toLowerCase() ===
																(snapshot.foundation ?? '').toLowerCase()
														}
														aria-busy={savingPayout === 'foundation'}
														className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
													>
														{savingPayout === 'foundation' ? (
															<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
														) : (
															<Check className="h-4 w-4" aria-hidden />
														)}
														{savingPayout === 'foundation' ? 'Saving…' : 'Save'}
													</button>
												</div>
											</div>
										) : (
											<div className="mt-2">
												<BeamioTagCapsule
													address={snapshot.foundation}
													onEdit={() => {
														setFoundationDraft(snapshot.foundation)
														setEditingPayout('foundation')
													}}
												/>
											</div>
										)}
									</div>

									<div>
										<p className="text-xs font-semibold text-slate-400">Default admin payout</p>
										{editingPayout === 'adminPayout' ? (
											<div className="mt-2 space-y-2">
												<input
													id="genesis-admin-payout"
													type="text"
													value={adminPayoutDraft}
													onChange={(e) => setAdminPayoutDraft(e.target.value)}
													autoComplete="off"
													spellCheck={false}
													placeholder="0x…"
													className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 font-mono text-xs text-slate-50 placeholder:text-slate-500"
												/>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => cancelPayoutEdit('adminPayout')}
														disabled={savingPayout !== null}
														className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"
													>
														<X className="h-4 w-4" aria-hidden />
														Cancel
													</button>
													<button
														type="button"
														onClick={() => void handleSaveAdminPayout()}
														disabled={
															savingPayout !== null ||
															!armor ||
															!ethers.isAddress(adminPayoutDraft.trim()) ||
															adminPayoutDraft.trim().toLowerCase() ===
																(snapshot.defaultAdminPayout ?? '').toLowerCase()
														}
														aria-busy={savingPayout === 'adminPayout'}
														className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1562f0] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
													>
														{savingPayout === 'adminPayout' ? (
															<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
														) : (
															<Check className="h-4 w-4" aria-hidden />
														)}
														{savingPayout === 'adminPayout' ? 'Saving…' : 'Save'}
													</button>
												</div>
											</div>
										) : (
											<div className="mt-2">
												<BeamioTagCapsule
													address={snapshot.defaultAdminPayout}
													onEdit={() => {
														setAdminPayoutDraft(snapshot.defaultAdminPayout)
														setEditingPayout('adminPayout')
													}}
												/>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : null}

			{incomeOpen ? (
				<GenesisIncomeDetailPanel
					earnedUsdc6={snapshot?.earnedUsdc6 ?? '0'}
					items={income?.items ?? []}
					loading={incomeRefreshing && (income?.items.length ?? 0) === 0}
					error={null}
					onClose={() => setIncomeOpen(false)}
				/>
			) : null}

			{purchaseHistoryPartner ? (
				<GenesisIncomeDetailPanel
					heading="Purchase history"
					partnerAddress={purchaseHistoryPartner.address}
					earnedUsdc6={purchaseHistoryPartner.earnedUsdc6}
					items={resolvePartnerIncomeItems(purchaseHistoryPartner.address)}
					loading={false}
					error={null}
					onClose={() => setPurchaseHistoryPartner(null)}
				/>
			) : null}
		</div>
	)
}
