import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
	Hexagon,
	Loader2,
	Send,
	History,
	AlertTriangle,
	Check,
	Copy,
	Search,
	X,
	ChevronLeft,
	Plus,
	Minus,
	ChevronDown,
	Eye,
	EyeOff,
	ExternalLink,
} from 'lucide-react'
import { Toast } from 'antd-mobile'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import {
	BeamioSearchResultRow,
	beamioSearchAvatarUrl,
	beamioSearchDisplayName,
	beamioSearchShortAddress,
	makeBeamioSearchAddressOnlyResult,
	sortSearchResultsExactFirst,
} from '@/components/Home/beamioSearchResultPresentation'
import { IpfsImg } from '@/components/IpfsImg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { tu } from '@/locale/beamioLocale'
import { CAPSULE_BTN_CLASS } from '@/utils/uiCommon'
import { beamioWalletAccent } from '@/utils/beamioWalletAccent'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'
import { searchUsername } from '@/services/beamio'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { conetDepinProvider } from '@/utils/constants'
import {
	AA_MULTISIG_TASKS_CHANGED_EVENT,
	loadAllAaMultisigTasksForWallet,
	filterPendingAaMultisigTasksForSigner,
	getAaMultisigTaskAny,
	upsertAaMultisigTaskRecord,
	removeAaMultisigTaskRecord,
	pruneFailedAaMultisigTasksForWallet,
} from '@/utils/aaMultisigLocalStore'
import {
	filterPendingCollectingSignatures,
	filterReadyMultisigForManager,
	filterHistoryMultisigForManager,
	formatMultisigSignatureProgress,
	multisigHistorySummary,
	multisigPendingSecondaryMessage,
	multisigTaskDeepLinkTab,
	multisigTaskStatusChipLabel,
	formatBeamioTagDisplayLine,
	resolveAaMultisigPolicyOwnerEoa,
	resolveAaMultisigTaskOwnerEoa,
	resolveMultisigTaskRowMode,
} from '@/utils/aaMultisigTaskUi'
import {
	buildManagersOwnerFirst,
	type AaMultisigTaskLocal,
	type AaMultisigTransferAssetId,
} from '@/utils/aaMultisigProtocol'
import {
	readAaEntryPointNonce,
} from '@/utils/aaMultisigEntryPointNonce'
import {
	AA_MULTISIG_PENDING_NONCE_RECONCILE_MS,
	reconcileAaMultisigPendingNoncesForWallet,
} from '@/utils/aaMultisigPendingNonceReconcile'
import {
	discoverInstitutionalManageableWallets,
	type AaMultisigTransferEligibleWallet,
	type InstitutionalManageableWallet,
} from '@/utils/aaMultisigTransferEligible'
import { createInstitutionalAa, normalizeInstitutionalBeamioTag } from '@/utils/institutionalAaAccounts'
import {
	loadInstitutionalManageableWalletsLocal,
	mergeTrustedInstitutionalManageableWalletsLocal,
	refreshInstitutionalManageablePoliciesFromChain,
	replaceInstitutionalManageableWalletsLocal,
	upsertInstitutionalManageableWalletLocal,
} from '@/utils/institutionalManageableWalletsLocalCache'
import {
	loadInstitutionalAaHiddenSet,
	setInstitutionalAaHidden,
} from '@/utils/institutionalAaListUiPrefs'
import {
	readAaThresholdPolicy,
	resolveEffectiveAaOwner,
	aaMultisigProvider,
} from '@/utils/aaMultisigUserOp'
import {
	formatTransferTaskSummary,
	parseTransferAmountToRaw,
	type AaMultisigTransferAssetOption,
} from '@/utils/aaMultisigConetTransferAssets'
import {
	AA_MULTISIG_OUTBOUND_CHANGED_EVENT,
	AA_MULTISIG_OUTBOUND_FLUSH_INTERVAL_MS,
	buildSignInnerExportForTask,
	buildProposeInnerExportFromTask,
	copyAaMultisigInnerExport,
	dismissAaMultisigOutboundItem,
	autoProcessAaMultisigOutboundQueue,
	ingestAaMultisigFromExport,
	isAaMultisigOutboundPending,
	listAaMultisigOutboundForDisplay,
	publishAaMultisigInnerWithOfflineFallback,
	type AaMultisigOutboundListItem,
} from '@/utils/aaMultisigOfflineSync'
import {
	resolveCosignerEoaFromInput,
	resolveCosignerEoaFromSearchRow,
} from '@/utils/resolveCosignerWalletIdentity'
import {
	defaultAaV2DeadlineSec,
	isInstitutionalAaV2,
	newAaV2SigNonce,
	relayAaV2ProposeSetPolicy,
	relayAaV2ProposeTransfer,
	relayAaV2Vote,
	signAaV2ProposeSetPolicy,
	signAaV2ProposeTransfer,
	signAaV2Vote,
	tokenAddressForTransferAsset,
} from '@/utils/aaInstitutionalV2Eip712'
import {
	attachSignerVoteTxHash,
	getOnChainTaskId,
	isAaV2LocalTask,
	resolveSignatureVoteTxHash,
	syncAaV2TasksIntoLocal,
} from '@/utils/aaInstitutionalV2Tasks'

type TabId = 'pending' | 'transfer' | 'history'

const aaAccent = beamioWalletAccent('aa')

/** Stable empty — avoid new [] each render for daemon asset map misses. */
const EMPTY_INSTITUTIONAL_AA_ASSET_OPTIONS: AaMultisigTransferAssetOption[] = []

function shortAddr(a: string): string {
	if (!a || a.length < 12) return a
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function ThresholdRatioPicker({
	signerCount,
	value,
	onChange,
	accentColor,
	hint,
}: {
	signerCount: number
	value: number
	onChange: (required: number) => void
	accentColor: string
	hint?: string
}) {
	if (signerCount < 1) return null
	const options = Array.from({ length: signerCount }, (_, i) => i + 1)
	return (
		<div className="mt-3">
			<label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
				Required signatures
			</label>
			{hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
			<div className="mt-2 flex flex-wrap gap-2">
				{options.map((required) => {
					const selected = value === required
					return (
						<button
							key={required}
							type="button"
							onClick={() => onChange(required)}
							className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
								selected
									? 'text-white shadow-sm'
									: 'border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
							}`}
							style={selected ? { backgroundColor: accentColor } : undefined}
							aria-pressed={selected}
						>
							{required}/{signerCount}
						</button>
					)
				})}
			</div>
		</div>
	)
}

const CONET_MAINNET_EXPLORER = 'https://mainnet.conet.network'

function conetExplorerAddressUrl(address: string): string {
	return `${CONET_MAINNET_EXPLORER}/address/${encodeURIComponent(address)}`
}

function conetExplorerTxUrl(txHash: string): string {
	const h = txHash.startsWith('0x') ? txHash : `0x${txHash}`
	return `${CONET_MAINNET_EXPLORER}/tx/${encodeURIComponent(h)}`
}

function shortTxHash(hash: string): string {
	const h = hash.trim()
	if (h.length < 14) return h
	return `${h.slice(0, 8)}…${h.slice(-6)}`
}

/** Address capsule → CoNET explorer account page (+ copy). */
function ConetExplorerAddressCapsule({
	address,
	variant = 'eoa',
	beamioTag,
}: {
	address: string
	variant?: 'eoa' | 'aa'
	/** Optional @BeamioTag shown inside the capsule (left of address). */
	beamioTag?: string | null
}) {
	const [copied, setCopied] = React.useState(false)
	const fullAddress = (() => {
		try {
			return ethers.isAddress(address) ? ethers.getAddress(address) : ''
		} catch {
			return ''
		}
	})()
	if (!fullAddress) return null
	const short = shortAddr(fullAddress)
	const tagDisplay = (() => {
		const raw = (beamioTag ?? '').trim()
		if (!raw) return null
		return raw.startsWith('@') ? raw : `@${raw}`
	})()
	const isAa = variant === 'aa'
	const shell = isAa
		? 'border-[#eadcf7] bg-[#f5ecff] text-[#424655] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
		: 'border-[#dce2f7] bg-[#e9edff] text-[#424655] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
	const accent = isAa ? 'text-[#8d3a8b]' : 'text-[#0051d1]'
	const hover = isAa ? 'hover:bg-[#8d3a8b]/10' : 'hover:bg-[#0051d1]/10'

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
		<div className={`inline-flex max-w-full items-center overflow-hidden rounded-full border ${shell}`}>
			<button
				type="button"
				onClick={() => openExternalUrl(conetExplorerAddressUrl(fullAddress))}
				className={`inline-flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1.5 font-mono text-[11px] font-medium transition ${hover}`}
				aria-label={
					tagDisplay
						? `Open ${tagDisplay} (${short}) on CoNET Explorer`
						: `Open ${short} on CoNET Explorer`
				}
			>
				{tagDisplay ? (
					<span
						className={`max-w-[7.5rem] shrink-0 truncate font-sans text-[11px] font-semibold ${accent}`}
					>
						{tagDisplay}
					</span>
				) : null}
				{isAa ? (
					<Hexagon className={`h-3.5 w-3.5 shrink-0 ${accent}`} strokeWidth={2.25} aria-hidden />
				) : null}
				<span className="truncate">{short}</span>
				<ExternalLink className={`h-3 w-3 shrink-0 ${accent}`} strokeWidth={2.25} aria-hidden />
			</button>
			<button
				type="button"
				onClick={(e) => void copyAddress(e)}
				className={`inline-flex h-7 w-7 shrink-0 items-center justify-center ${accent} transition ${hover}`}
				aria-label={copied ? 'Address copied' : 'Copy address'}
			>
				{copied ? (
					<Check className="h-3 w-3 text-emerald-500" strokeWidth={2.4} aria-hidden />
				) : (
					<Copy className="h-3 w-3" strokeWidth={2.2} aria-hidden />
				)}
			</button>
		</div>
	)
}

/** Tx hash capsule → CoNET explorer transaction page (+ copy). */
function ConetExplorerTxHashCapsule({ txHash, label }: { txHash: string; label?: string }) {
	const [copied, setCopied] = React.useState(false)
	const full = (() => {
		const t = txHash.trim()
		if (!/^0x[0-9a-fA-F]{64}$/.test(t)) return ''
		return t.toLowerCase()
	})()
	if (!full) return null
	const short = shortTxHash(full)
	const url = conetExplorerTxUrl(full)

	const copyHash = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		try {
			await navigator.clipboard.writeText(full)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			/* ignore */
		}
	}

	return (
		<div className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
			<button
				type="button"
				onClick={() => openExternalUrl(url)}
				className="inline-flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1.5 font-mono text-[11px] font-medium transition hover:bg-slate-100 dark:hover:bg-slate-700"
				aria-label={label ? `Open ${label} transaction on CoNET Explorer` : `Open transaction ${short}`}
			>
				{label ? (
					<span className="max-w-[5.5rem] shrink-0 truncate font-sans text-[10px] font-semibold text-slate-500">
						{label}
					</span>
				) : null}
				<span className="truncate">{short}</span>
				<ExternalLink className="h-3 w-3 shrink-0 text-slate-500" strokeWidth={2.25} aria-hidden />
			</button>
			<button
				type="button"
				onClick={(e) => void copyHash(e)}
				className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
				aria-label={copied ? 'Transaction hash copied' : 'Copy transaction hash'}
			>
				{copied ? (
					<Check className="h-3 w-3 text-emerald-500" strokeWidth={2.4} aria-hidden />
				) : (
					<Copy className="h-3 w-3" strokeWidth={2.2} aria-hidden />
				)}
			</button>
		</div>
	)
}

function CosignerAddressCapsule({ address }: { address: string }) {
	const [copied, setCopied] = React.useState(false)
	const fullAddress = (() => {
		try {
			return ethers.isAddress(address) ? ethers.getAddress(address) : String(address).trim()
		} catch {
			return String(address).trim()
		}
	})()
	const short = shortAddr(fullAddress)

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!fullAddress || !ethers.isAddress(fullAddress)) return
			try {
				await navigator.clipboard.writeText(fullAddress)
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			} catch {
				// ignore
			}
		},
		[fullAddress]
	)

	if (!fullAddress || !ethers.isAddress(fullAddress)) return null

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] py-1 pl-2.5 pr-2 font-mono text-[11px] font-medium text-[#424655] transition-colors hover:border-[#0051d1]/30 hover:bg-[#0051d1]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d1]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
			title="Copy address"
			aria-label={`Copy address ${short}`}
		>
			<span className="truncate">{short}</span>
			{copied ? (
				<Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.4} aria-hidden />
			) : (
				<Copy className="h-3 w-3 shrink-0 text-[#0051d1]" strokeWidth={2.2} aria-hidden />
			)}
		</button>
	)
}

function AaAccountAddressCapsule({
	address,
	beamioTag,
}: {
	address: string
	/** Optional @BeamioTag shown on the left inside the capsule. */
	beamioTag?: string | null
}) {
	const [copied, setCopied] = React.useState(false)
	const fullAddress = (() => {
		try {
			return ethers.isAddress(address) ? ethers.getAddress(address) : String(address).trim()
		} catch {
			return String(address).trim()
		}
	})()
	const short = shortAddr(fullAddress)
	const tagDisplay = (() => {
		const raw = (beamioTag ?? '').trim()
		if (!raw) return null
		return raw.startsWith('@') ? raw : `@${raw}`
	})()

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (!fullAddress || !ethers.isAddress(fullAddress)) return
			try {
				await navigator.clipboard.writeText(fullAddress)
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			} catch {
				// ignore
			}
		},
		[fullAddress]
	)

	if (!fullAddress || !ethers.isAddress(fullAddress)) return null

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#eadcf7] bg-[#f5ecff] py-1.5 pl-2 pr-2.5 font-mono text-[11px] font-medium text-[#424655] transition-colors hover:border-[#8d3a8b]/30 hover:bg-[#8d3a8b]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
			title="Copy Smart Wallet address"
			aria-label={
				tagDisplay
					? `Copy Smart Wallet address ${short} (${tagDisplay})`
					: `Copy Smart Wallet address ${short}`
			}
		>
			{tagDisplay ? (
				<span className="max-w-[7.5rem] shrink-0 truncate font-sans text-[11px] font-semibold text-[#8d3a8b]">
					{tagDisplay}
				</span>
			) : null}
			<Hexagon className="h-3.5 w-3.5 shrink-0 text-[#8d3a8b]" strokeWidth={2.25} aria-hidden />
			<span className="truncate">{short}</span>
			{copied ? (
				<Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.4} aria-hidden />
			) : (
				<Copy className="h-3 w-3 shrink-0 text-[#8d3a8b]" strokeWidth={2.2} aria-hidden />
			)}
		</button>
	)
}

/** Second row: left = asset-name dropdown only; right = balance + unit (outside the menu).
 * Balances come from DaemonProvider (local-first + 30s feed) — no per-item fetch.
 */
function InstitutionalAaAssetsRow({ aaAccount }: { aaAccount: string }) {
	const { institutionalAaAssetsByAa } = useDaemonContext()
	const aaLower = aaAccount.trim().toLowerCase()
	const options = institutionalAaAssetsByAa[aaLower] ?? EMPTY_INSTITUTIONAL_AA_ASSET_OPTIONS
	const [selectedId, setSelectedId] = useState<AaMultisigTransferAssetId | ''>('')
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)
	const listId = `institutional-aa-asset-list-${aaLower}`

	const optionsKey = options.map((o) => `${o.id}:${o.balanceRaw}`).join('|')

	useEffect(() => {
		setSelectedId((prev) => {
			if (prev && options.some((o) => o.id === prev)) return prev
			return options[0]?.id ?? ''
		})
		if (options.length === 0) setOpen(false)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- optionsKey fingerprints trusted daemon assets
	}, [aaLower, optionsKey])

	useEffect(() => {
		if (!open) return
		const onDocPointer = (e: PointerEvent) => {
			const el = rootRef.current
			if (!el) return
			if (e.target instanceof Node && el.contains(e.target)) return
			setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false)
		}
		document.addEventListener('pointerdown', onDocPointer, true)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('pointerdown', onDocPointer, true)
			document.removeEventListener('keydown', onKey)
		}
	}, [open])

	const selected = options.find((o) => o.id === selectedId) ?? null

	const assetName = (opt: AaMultisigTransferAssetOption) =>
		opt.chain === 'base' ? `${opt.label} · Base` : opt.label

	const balanceSuffix = (opt: AaMultisigTransferAssetOption) => {
		switch (opt.id) {
			case 'cnet':
				return 'CNET'
			case 'usdc':
				return 'USDC'
			case 'gb_paid':
				return 'GB'
			case 'buint_paid':
				return 'B-Unit'
			case 'base_eth':
				return 'ETH'
			case 'base_usdc':
				return 'USDC'
			default:
				return opt.label
		}
	}

	return (
		<div
			ref={rootRef}
			className="relative mt-2"
			data-institutional-aa-no-select
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			onPointerDown={(e) => e.stopPropagation()}
		>
			{options.length === 0 ? (
				<p className="text-xs text-slate-500">No assets in this Smart Wallet</p>
			) : (
				<div className="flex min-w-0 items-center gap-2">
					<div className="relative min-w-0 flex-1">
						<button
							type="button"
							id={`institutional-aa-asset-trigger-${aaAccount.toLowerCase()}`}
							aria-haspopup="listbox"
							aria-expanded={open}
							aria-controls={listId}
							aria-label="Smart Wallet asset"
							onClick={() => setOpen((v) => !v)}
							className="flex w-full min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/30 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500"
						>
							<span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
								{selected ? assetName(selected) : 'Select asset'}
							</span>
							<ChevronDown
								className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
								aria-hidden
								strokeWidth={2.25}
							/>
						</button>
						{open ? (
							<ul
								id={listId}
								role="listbox"
								aria-label="Smart Wallet assets"
								className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
							>
								{options.map((opt) => {
									const isSelected = opt.id === selectedId
									return (
										<li key={opt.id} role="presentation">
											<button
												type="button"
												role="option"
												aria-selected={isSelected}
												onClick={() => {
													setSelectedId(opt.id)
													setOpen(false)
												}}
												className={`w-full truncate px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-[#f5ecff]/80 dark:text-slate-200 dark:hover:bg-slate-700/80 ${
													isSelected ? 'bg-[#f5ecff] dark:bg-slate-700/60' : ''
												}`}
											>
												{assetName(opt)}
											</button>
										</li>
									)
								})}
							</ul>
						) : null}
					</div>
					{selected ? (
						<p
							className="shrink-0 text-right tabular-nums tracking-tight text-slate-900 dark:text-slate-100"
							aria-live="polite"
						>
							<span className="text-sm font-semibold">{selected.balanceDisplay}</span>{' '}
							<span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
								{balanceSuffix(selected)}
							</span>
						</p>
					) : null}
				</div>
			)}
		</div>
	)
}

/** Third row: − / M-of-N sigs / + capsule (hide − when only one signer). */
function InstitutionalSigsCapsule({
	threshold,
	managerCount,
	onAdd,
	onReduce,
}: {
	threshold: number
	managerCount: number
	onAdd: () => void
	onReduce: () => void
}) {
	const canReduce = managerCount > 1
	return (
		<div
			className="mt-2"
			data-institutional-aa-no-select
			onPointerDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
		>
			<div className="flex w-full items-center gap-1 rounded-full border border-[#eadcf7] bg-[#f5ecff] py-1 pl-1 pr-1 dark:border-slate-600 dark:bg-slate-800/80">
				{canReduce ? (
					<button
						type="button"
						onClick={onReduce}
						aria-label="Reduce signers or adjust multisig rule"
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8d3a8b] transition hover:bg-[#8d3a8b]/10 active:scale-[0.96]"
					>
						<Minus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
					</button>
				) : (
					<span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
				)}
				<span className="min-w-0 flex-1 truncate text-center text-xs font-semibold tabular-nums text-[#424655] dark:text-slate-200">
					{threshold}/{managerCount} sigs
				</span>
				<button
					type="button"
					onClick={onAdd}
					aria-label="Add another signing wallet"
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8d3a8b] transition hover:bg-[#8d3a8b]/10 active:scale-[0.96]"
				>
					<Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
				</button>
			</div>
		</div>
	)
}

const INSTITUTIONAL_SELECTED_AA_LS_PREFIX = 'beamio:silentpass:eoa:'

function institutionalSelectedAaStorageKey(eoa: string): string {
	return `${INSTITUTIONAL_SELECTED_AA_LS_PREFIX}${eoa.trim().toLowerCase()}:aa-multisig-selected-institutional-v1`
}

function loadPersistedInstitutionalSelectedAa(eoa: string): string {
	try {
		const raw = localStorage.getItem(institutionalSelectedAaStorageKey(eoa))
		if (!raw || !ethers.isAddress(raw)) return ''
		return ethers.getAddress(raw)
	} catch {
		return ''
	}
}

function persistInstitutionalSelectedAa(eoa: string, aa: string): void {
	try {
		const key = institutionalSelectedAaStorageKey(eoa)
		if (!aa || !ethers.isAddress(aa)) {
			localStorage.removeItem(key)
			return
		}
		localStorage.setItem(key, ethers.getAddress(aa))
	} catch {
		/* ignore */
	}
}

function institutionalToEligibleWallet(w: InstitutionalManageableWallet): AaMultisigTransferEligibleWallet {
	return {
		aaAccount: w.aaAccount,
		policy: w.policy,
		isOwnAa: w.kind === 'own_institutional',
		lastActivityAt: w.lastActivityAt,
	}
}


function signerDisplayName(
	capsule: {
		first_name?: string
		firstName?: string
		last_name?: string
		lastName?: string
	} | null,
	tag: string
): string | null {
	const fn = capsule?.first_name ?? capsule?.firstName ?? ''
	const lnRaw = capsule?.last_name ?? capsule?.lastName ?? ''
	const lastPart = lnRaw.split('\r\n')[0]?.trim() ?? ''
	const ln = /^\{/.test(lastPart) ? '' : lastPart
	const name = `${fn} ${ln}`.trim()
	if (name && !/^\{/.test(name)) return name
	return null
}

/** Compact Beamio capsule for Smart Wallet policy owner (co-signer rows only; owner hides own tag). */
function OwnerBeamioTagCapsule({
	ownerEoa,
	tagLine,
	imgSrc,
	displayName,
	muted = false,
}: {
	ownerEoa: string
	tagLine: string
	imgSrc: string
	displayName?: string | null
	/** Collapsed / hidden list row — gray identity capsule. */
	muted?: boolean
}) {
	return (
		<span
			className={
				muted
					? 'inline-flex max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 py-1 pl-1 pr-2.5 dark:border-slate-600 dark:bg-slate-800/80'
					: 'inline-flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white py-0.5 pl-0.5 pr-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-800'
			}
			title={displayName ? `${displayName} · ${tagLine}` : tagLine}
			aria-label={muted ? `Hidden wallet ${tagLine}` : `Owner ${tagLine}`}
		>
			<img
				src={imgSrc}
				alt=""
				className={
					muted
						? 'h-6 w-6 shrink-0 rounded-full object-cover bg-slate-200 opacity-70 grayscale dark:bg-slate-700'
						: 'h-5 w-5 shrink-0 rounded-full object-cover bg-slate-100 dark:bg-slate-700'
				}
			/>
			<span
				className={
					muted
						? 'min-w-0 truncate text-[12px] font-semibold text-slate-500 dark:text-slate-400'
						: 'min-w-0 truncate text-[11px] font-semibold text-[#424655] dark:text-slate-200'
				}
			>
				{tagLine}
			</span>
			<span className="sr-only">{shortAddr(ownerEoa)}</span>
		</span>
	)
}

function autoRequiredSignaturesAfterAddCosigner(
	currentThreshold: number,
	currentManagerCount: number,
	nextManagerCount: number
): number {
	if (nextManagerCount < 1) return 1
	if (currentManagerCount <= 1 && nextManagerCount >= 2) {
		return Math.min(2, nextManagerCount)
	}
	return Math.min(Math.max(1, currentThreshold), nextManagerCount)
}

function autoRequiredSignaturesAfterRemoveCosigner(
	currentThreshold: number,
	nextManagerCount: number
): number {
	if (nextManagerCount < 1) return 1
	return Math.min(Math.max(1, currentThreshold), nextManagerCount)
}

type SigsDrawerMode = 'add' | 'remove' | null

const OFFLINE_SYNC_PAGE_SIZE = 10

export default function AaMultisigPage() {
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()
	const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
	const { profiles, setShowFooter, allNodes, refreshAaV2PendingTasks, refreshInstitutionalAaAssets, institutionalAaAssetsByAa } =
		useDaemonContext()
	const { opacity: backBtnOpacity, onScroll: onPageScroll, setRef: setPageScrollRef } =
		useScrollCapsuleOpacity(true)
	const { lookupByAddress, toCapsuleItem, avatarImgUrl, ensureProfilesForAddresses, resolveTag } =
		useBeamioTagDatabase()
	const profile = profiles?.[0]
	const eoa = profile?.keyID?.trim() ?? ''
	const [aaAccount, setAaAccount] = useState(profile?.aaAccount?.trim() ?? '')

	const [tab, setTab] = useState<TabId>('pending')
	const [policy, setPolicy] = useState<{ owner: string; managers: string[]; threshold: number } | null>(
		null
	)
	const [policyLoading, setPolicyLoading] = useState(false)
	const [tasks, setTasks] = useState<AaMultisigTaskLocal[]>([])
	const [busy, setBusy] = useState<string | null>(null)

	const [newSignerTag, setNewSignerTag] = useState('')
	const [cosignerSearchResults, setCosignerSearchResults] = useState<searchResult[]>([])
	const [cosignerSearchLoading, setCosignerSearchLoading] = useState(false)
	const [showCosignerDropdown, setShowCosignerDropdown] = useState(false)
	const [selectedCosigner, setSelectedCosigner] = useState<searchResult | null>(null)
	const cosignerSearchRequestId = useRef(0)
	const [transferTo, setTransferTo] = useState('')
	const [transferAmount, setTransferAmount] = useState('')
	const [transferAssetId, setTransferAssetId] = useState<AaMultisigTransferAssetId | ''>('')
	const [transferAssetOptions, setTransferAssetOptions] = useState<AaMultisigTransferAssetOption[]>(
		[]
	)
	const [transferAaAccount, setTransferAaAccount] = useState('')
	const [transferPolicy, setTransferPolicy] = useState<{
		owner: string
		managers: string[]
		threshold: number
	} | null>(null)
	const [institutionalWallets, setInstitutionalWallets] = useState<InstitutionalManageableWallet[]>(
		[]
	)
	/** AA addresses (lower) the user collapsed in the institutional list. */
	const [hiddenInstitutionalAa, setHiddenInstitutionalAa] = useState<Set<string>>(() => new Set())
	/** Session peek: temporarily expand a hidden row to show details. */
	const [peekExpandedInstitutionalAa, setPeekExpandedInstitutionalAa] = useState<Set<string>>(
		() => new Set()
	)
	const [selectedManagedAa, setSelectedManagedAa] = useState('')
	const [institutionalListLoading, setInstitutionalListLoading] = useState(false)
	const [creatingInstitutionalAa, setCreatingInstitutionalAa] = useState(false)
	const [createInstitutionalError, setCreateInstitutionalError] = useState<string | null>(null)
	const [newInstitutionalTag, setNewInstitutionalTag] = useState('')
	/** When user already has institutional wallets, create form is hidden until + is tapped. */
	const [showNewInstitutionalWalletForm, setShowNewInstitutionalWalletForm] = useState(false)
	/** Upward drawer from list sigs capsule: add or reduce signers / adjust M-of-N. */
	const [sigsDrawerMode, setSigsDrawerMode] = useState<SigsDrawerMode>(null)
	const [drawerRemoveTargetEoa, setDrawerRemoveTargetEoa] = useState<string | null>(null)
	const [drawerThreshold, setDrawerThreshold] = useState(1)
	const createInstitutionalInFlightRef = useRef(false)
	/** Derived for existing tab logic (Signers / Transfer / History). */
	const transferEligibleWallets = useMemo(
		() => institutionalWallets.map(institutionalToEligibleWallet),
		[institutionalWallets]
	)
	const transferEligibleLoading = institutionalListLoading
	const hasInstitutionalWallets = institutionalWallets.length > 0
	const showInstitutionalCreateForm = !hasInstitutionalWallets || showNewInstitutionalWalletForm
	/** Persists until the next Create multisig task press (Toast alone disappears too fast). */
	const [transferCreateError, setTransferCreateError] = useState<string | null>(null)
	/** Add / reduce signer drawer: inline error above primary CTA (replaces Toast for failures). */
	const [sigsDrawerError, setSigsDrawerError] = useState<string | null>(null)
	const [signersAaAccount, setSignersAaAccount] = useState('')
	const [importPayload, setImportPayload] = useState('')
	const [showImportPanel, setShowImportPanel] = useState(false)
	const [outboundQueue, setOutboundQueue] = useState<AaMultisigOutboundListItem[]>([])
	const [outboundVisibleCount, setOutboundVisibleCount] = useState(OFFLINE_SYNC_PAGE_SIZE)
	const outboundListRef = useRef<HTMLUListElement>(null)
	const outboundLoadMoreRef = useRef<HTMLLIElement>(null)
	const outboundListScrolledRef = useRef(false)
	const prevMultisigTaskStatusRef = useRef<Map<string, AaMultisigTaskLocal['status']>>(new Map())
	const autoSubmitInFlightRef = useRef(new Set<string>())
	const submitTaskRef = useRef<
		(
			task: AaMultisigTaskLocal,
			opts?: { quiet?: boolean; retainBusy?: boolean },
		) => Promise<{ ok: boolean; error?: string }>
	>(async () => ({ ok: false, error: 'Submit unavailable' }))

	const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)

	const normalizedCosignerQuery = useMemo(
		() => newSignerTag.trim().replace(/^@/, ''),
		[newSignerTag]
	)
	const canSearchCosigner = normalizedCosignerQuery.length >= 2

	useEffect(() => {
		if (selectedCosigner) return

		if (!normalizedCosignerQuery || !canSearchCosigner) {
			setCosignerSearchResults([])
			setCosignerSearchLoading(false)
			setShowCosignerDropdown(false)
			return
		}

		const id = ++cosignerSearchRequestId.current
		const timer = window.setTimeout(async () => {
			setCosignerSearchLoading(true)
			const data = await searchUsername(normalizedCosignerQuery)
			const rows: searchResult[] = data?.results ?? []
			const managerSet = new Set((policy?.managers ?? []).map((m) => m.toLowerCase()))
			const filtered = rows.filter((row) => {
				const addr = (row.address ?? '').trim().toLowerCase()
				if (!addr || !ethers.isAddress(addr)) return false
				if (eoa && addr === eoa.toLowerCase()) return false
				if (managerSet.has(addr)) return false
				return true
			})
			if (!filtered.length && ethers.isAddress(normalizedCosignerQuery)) {
				const identity = await resolveCosignerEoaFromInput(normalizedCosignerQuery)
				if (identity && identity.inputKind !== 'contract') {
					const addr = ethers.getAddress(identity.eoa)
					if (
						(!eoa || addr.toLowerCase() !== eoa.toLowerCase()) &&
						!managerSet.has(addr.toLowerCase())
					) {
						filtered.push(makeBeamioSearchAddressOnlyResult(addr))
					}
				}
			}
			if (id !== cosignerSearchRequestId.current) return
			setCosignerSearchResults(sortSearchResultsExactFirst(filtered, normalizedCosignerQuery))
			setCosignerSearchLoading(false)
			setShowCosignerDropdown(true)
		}, 350)

		return () => window.clearTimeout(timer)
	}, [normalizedCosignerQuery, canSearchCosigner, eoa, policy?.managers, selectedCosigner])

	const refreshOutboundQueue = useCallback(() => {
		if (!eoa) {
			setOutboundQueue([])
			return
		}
		setOutboundQueue(listAaMultisigOutboundForDisplay(eoa))
	}, [eoa])

	const runOutboundAutoProcess = useCallback(async () => {
		if (!eoa || !privateKeyArmor) return { remaining: 0 }
		const result = await autoProcessAaMultisigOutboundQueue({
			walletEoa: eoa,
			privateKeyArmor,
			allNodes: allNodes ?? [],
		})
		refreshOutboundQueue()
		return result
	}, [eoa, privateKeyArmor, allNodes, refreshOutboundQueue])

	useEffect(() => {
		refreshOutboundQueue()
		const onOutbound = () => refreshOutboundQueue()
		window.addEventListener(AA_MULTISIG_OUTBOUND_CHANGED_EVENT, onOutbound)
		return () => window.removeEventListener(AA_MULTISIG_OUTBOUND_CHANGED_EVENT, onOutbound)
	}, [refreshOutboundQueue])

	const outboundNewestFirst = useMemo(
		() => [...outboundQueue].sort((a, b) => b.createdAt - a.createdAt),
		[outboundQueue]
	)

	const visibleOutboundItems = useMemo(
		() => outboundNewestFirst.slice(0, outboundVisibleCount),
		[outboundNewestFirst, outboundVisibleCount]
	)

	const hasMoreOutbound = outboundVisibleCount < outboundNewestFirst.length

	useEffect(() => {
		setOutboundVisibleCount(OFFLINE_SYNC_PAGE_SIZE)
		outboundListScrolledRef.current = false
		outboundListRef.current?.scrollTo({ top: 0 })
	}, [outboundQueue.length])

	const loadMoreOutboundItems = useCallback(() => {
		setOutboundVisibleCount((prev) =>
			Math.min(prev + OFFLINE_SYNC_PAGE_SIZE, outboundNewestFirst.length)
		)
	}, [outboundNewestFirst.length])

	const handleOutboundListScroll = useCallback(() => {
		outboundListScrolledRef.current = true
		const root = outboundListRef.current
		if (!root || !hasMoreOutbound) return
		if (root.scrollTop + root.clientHeight < root.scrollHeight - 24) return
		loadMoreOutboundItems()
	}, [hasMoreOutbound, loadMoreOutboundItems])

	useEffect(() => {
		const root = outboundListRef.current
		const node = outboundLoadMoreRef.current
		if (!root || !node || !hasMoreOutbound) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return
				// Ignore viewport-visible sentinel before the user scrolls inside the list.
				if (!outboundListScrolledRef.current) return
				loadMoreOutboundItems()
			},
			{ root, rootMargin: '0px', threshold: 0 }
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [hasMoreOutbound, loadMoreOutboundItems, visibleOutboundItems.length])

	useEffect(() => {
		if (!eoa || !privateKeyArmor) return
		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined

		const scheduleRetry = (remaining: number) => {
			if (cancelled || remaining <= 0) return
			timer = setTimeout(() => void tick(), AA_MULTISIG_OUTBOUND_FLUSH_INTERVAL_MS)
		}

		const tick = async () => {
			const result = await runOutboundAutoProcess()
			if (cancelled) return
			scheduleRetry(result.remaining)
		}

		void tick()
		return () => {
			cancelled = true
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [eoa, privateKeyArmor, allNodes, runOutboundAutoProcess])

	useEffect(() => {
		if (!eoa) return
		const onTasksChanged = () => {
			void runOutboundAutoProcess()
		}
		window.addEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onTasksChanged)
		return () => window.removeEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onTasksChanged)
	}, [eoa, runOutboundAutoProcess])

	useEffect(() => {
		if (!eoa) {
			setAaAccount('')
			return
		}
		let cancelled = false
		void (async () => {
			const fromProfile = profile?.aaAccount?.trim()
			if (fromProfile && ethers.isAddress(fromProfile)) {
				try {
					const profileCode = await conetDepinProvider.getCode(fromProfile)
					if (profileCode && profileCode !== '0x' && profileCode.length > 2) {
						setAaAccount(ethers.getAddress(fromProfile))
						return
					}
				} catch {
					/* ignore */
				}
			}
			const conetAa = await resolveBeamioAaOnConet(conetDepinProvider, eoa)
			if (cancelled) return
			setAaAccount(conetAa?.trim() ?? '')
		})()
		return () => {
			cancelled = true
		}
	}, [profile?.aaAccount, eoa])

	const reloadTasks = useCallback(() => {
		if (!eoa) {
			setTasks([])
			return
		}
		// Failed submit (usually EntryPoint nonce) must not linger in History.
		pruneFailedAaMultisigTasksForWallet(eoa)
		setTasks(loadAllAaMultisigTasksForWallet(eoa))
	}, [eoa])

	const syncSelectedAaV2Tasks = useCallback(async () => {
		if (!eoa || !selectedManagedAa) return
		try {
			if (!(await isInstitutionalAaV2(selectedManagedAa))) return
			await syncAaV2TasksIntoLocal(eoa, selectedManagedAa, upsertAaMultisigTaskRecord)
			reloadTasks()
			void refreshAaV2PendingTasks()
		} catch {
			/* keep local */
		}
	}, [eoa, selectedManagedAa, reloadTasks, refreshAaV2PendingTasks])

	useEffect(() => {
		void syncSelectedAaV2Tasks()
	}, [syncSelectedAaV2Tasks])

	const reloadTransferAssets = useCallback(async () => {
		if (!transferAaAccount) {
			setTransferAssetOptions([])
			setTransferAssetId('')
			return
		}
		await refreshInstitutionalAaAssets([transferAaAccount])
	}, [transferAaAccount, refreshInstitutionalAaAssets])

	/** Transfer tab assets: local-first from daemon map (no per-page RPC). */
	useEffect(() => {
		if (!transferAaAccount) {
			setTransferAssetOptions([])
			setTransferAssetId('')
			return
		}
		const cached =
			institutionalAaAssetsByAa[transferAaAccount.toLowerCase()] ??
			EMPTY_INSTITUTIONAL_AA_ASSET_OPTIONS
		setTransferAssetOptions(cached)
		setTransferAssetId((prev) => {
			if (prev && cached.some((o) => o.id === prev)) return prev
			return cached[0]?.id ?? ''
		})
	}, [transferAaAccount, institutionalAaAssetsByAa])

	const selectedManagedAaRef = useRef('')
	selectedManagedAaRef.current = selectedManagedAa
	const institutionalTasksRef = useRef(tasks)
	institutionalTasksRef.current = tasks

	const refreshInstitutionalWallets = useCallback(async () => {
		if (!eoa) {
			setInstitutionalWallets([])
			setSelectedManagedAa('')
			setTransferAaAccount('')
			setTransferPolicy(null)
			setSignersAaAccount('')
			return
		}
		// Local-first: show semi-permanent cache immediately (created AAs never disappear).
		const local = loadInstitutionalManageableWalletsLocal(eoa)
		if (local.length > 0) {
			setInstitutionalWallets(local)
		}
		setInstitutionalListLoading(true)
		try {
			const wallets = await discoverInstitutionalManageableWallets(aaMultisigProvider, eoa, {
				primaryAaAccount: aaAccount,
				tasks: institutionalTasksRef.current,
				fallbackEoa: eoa,
			})
			const merged = mergeTrustedInstitutionalManageableWalletsLocal(eoa, wallets)
			// Always re-read chain policy for local rows (incl. legacy V1 AAs discover skips).
			const withFreshPolicy = await refreshInstitutionalManageablePoliciesFromChain(
				aaMultisigProvider,
				eoa,
				merged
			)
			// This page is V2-only — drop Express Pay / legacy V1 institutional rows from the list.
			const v2Only: InstitutionalManageableWallet[] = []
			for (const w of withFreshPolicy) {
				if (await isInstitutionalAaV2(w.aaAccount, aaMultisigProvider)) {
					v2Only.push(w)
				}
			}
			const nextList = replaceInstitutionalManageableWalletsLocal(eoa, v2Only)
			setInstitutionalWallets(nextList)
			// Never clear an in-progress user selection when discover finishes (tasks churn
			// used to re-run this and wipe selectedManagedAa → laggy / missed clicks).
			setSelectedManagedAa((prev) => {
				const current = (prev || selectedManagedAaRef.current || '').trim()
				if (
					current &&
					ethers.isAddress(current) &&
					nextList.some((w) => w.aaAccount.toLowerCase() === current.toLowerCase())
				) {
					return ethers.getAddress(current)
				}
				const persisted = loadPersistedInstitutionalSelectedAa(eoa)
				if (
					persisted &&
					nextList.some((w) => w.aaAccount.toLowerCase() === persisted.toLowerCase())
				) {
					return ethers.getAddress(persisted)
				}
				return ''
			})
			void refreshInstitutionalAaAssets()
		} catch {
			// untrusted — keep previous / local list; never clear created AAs
		} finally {
			setInstitutionalListLoading(false)
		}
	}, [eoa, aaAccount, refreshInstitutionalAaAssets])

	const selectManagedAa = useCallback(
		(aa: string) => {
			if (!aa || !ethers.isAddress(aa)) {
				selectedManagedAaRef.current = ''
				setSelectedManagedAa('')
				if (eoa) persistInstitutionalSelectedAa(eoa, '')
				return
			}
			const checksum = ethers.getAddress(aa)
			selectedManagedAaRef.current = checksum
			setSelectedManagedAa(checksum)
			if (eoa) persistInstitutionalSelectedAa(eoa, checksum)
		},
		[eoa]
	)

	const handleCreateInstitutionalAa = useCallback(async () => {
		if (!eoa || createInstitutionalInFlightRef.current) return
		const tag = normalizeInstitutionalBeamioTag(newInstitutionalTag)
		if (!tag) {
			setCreateInstitutionalError(
				'Enter a BeamioTag (3–26 letters, numbers, _ or .) so others can find this wallet.'
			)
			return
		}
		createInstitutionalInFlightRef.current = true
		setCreatingInstitutionalAa(true)
		setCreateInstitutionalError(null)
		try {
			const result = await createInstitutionalAa(eoa, { accountName: tag })
			if (!result.success) {
				setCreateInstitutionalError(result.error)
				return
			}
			setNewInstitutionalTag('')
			setShowNewInstitutionalWalletForm(false)
			const eoaChecksum = ethers.getAddress(eoa)
			const merged = upsertInstitutionalManageableWalletLocal(eoa, {
				aaAccount: result.aa,
				kind: 'own_institutional',
				index: result.index,
				accountName: result.accountName || tag,
				policy: {
					owner: eoaChecksum,
					managers: [eoaChecksum],
					threshold: 1,
				},
				lastActivityAt: Date.now(),
			})
			setInstitutionalWallets(merged)
			await refreshInstitutionalWallets()
			void refreshInstitutionalAaAssets([result.aa])
			selectManagedAa(result.aa)
			setTab('pending')
		} finally {
			createInstitutionalInFlightRef.current = false
			setCreatingInstitutionalAa(false)
		}
	}, [eoa, newInstitutionalTag, refreshInstitutionalWallets, refreshInstitutionalAaAssets, selectManagedAa])

	useEffect(() => {
		if (!selectedManagedAa) {
			setTransferAaAccount('')
			setSignersAaAccount('')
			return
		}
		setTransferAaAccount(selectedManagedAa)
		setSignersAaAccount(selectedManagedAa)
	}, [selectedManagedAa])

	useEffect(() => {
		const wallet = transferEligibleWallets.find(
			(w) => w.aaAccount.toLowerCase() === transferAaAccount.toLowerCase()
		)
		setTransferPolicy(wallet?.policy ?? null)
	}, [transferAaAccount, transferEligibleWallets])

	const transferWalletOwnerEoas = useMemo(() => {
		const owners = new Set<string>()
		for (const w of transferEligibleWallets) {
			const owner = resolveAaMultisigPolicyOwnerEoa(w.policy.managers)
			if (owner) owners.add(owner)
		}
		return [...owners]
	}, [transferEligibleWallets])

	useEffect(() => {
		if (!transferWalletOwnerEoas.length) return
		void ensureProfilesForAddresses(transferWalletOwnerEoas)
	}, [transferWalletOwnerEoas, ensureProfilesForAddresses])

	const institutionalOwnerEoas = useMemo(() => {
		const owners = new Set<string>()
		for (const w of institutionalWallets) {
			const owner =
				resolveEffectiveAaOwner(w.policy, eoa) ??
				resolveAaMultisigPolicyOwnerEoa(w.policy.managers)
			if (owner) owners.add(owner)
		}
		return [...owners]
	}, [institutionalWallets, eoa])

	useEffect(() => {
		if (!institutionalOwnerEoas.length) return
		void ensureProfilesForAddresses(institutionalOwnerEoas)
	}, [institutionalOwnerEoas, ensureProfilesForAddresses])

	useEffect(() => {
		if (!eoa) {
			setHiddenInstitutionalAa(new Set())
			setPeekExpandedInstitutionalAa(new Set())
			return
		}
		setHiddenInstitutionalAa(loadInstitutionalAaHiddenSet(eoa))
		setPeekExpandedInstitutionalAa(new Set())
	}, [eoa])

	const hideInstitutionalAaRow = useCallback(
		(aa: string) => {
			if (!eoa || !ethers.isAddress(aa)) return
			const next = setInstitutionalAaHidden(eoa, aa, true)
			setHiddenInstitutionalAa(new Set(next))
			const lower = ethers.getAddress(aa).toLowerCase()
			setPeekExpandedInstitutionalAa((prev) => {
				if (!prev.has(lower)) return prev
				const n = new Set(prev)
				n.delete(lower)
				return n
			})
			// Hidden wallets cannot be operated — drop selection so tab bar disappears.
			if (selectedManagedAaRef.current.toLowerCase() === lower) {
				selectManagedAa('')
			}
		},
		[eoa, selectManagedAa]
	)

	const restoreInstitutionalAaRow = useCallback(
		(aa: string) => {
			if (!eoa || !ethers.isAddress(aa)) return
			const next = setInstitutionalAaHidden(eoa, aa, false)
			setHiddenInstitutionalAa(new Set(next))
			const lower = ethers.getAddress(aa).toLowerCase()
			setPeekExpandedInstitutionalAa((prev) => {
				if (!prev.has(lower)) return prev
				const n = new Set(prev)
				n.delete(lower)
				return n
			})
			// Restoring makes the wallet operable again — select it for tabs.
			selectManagedAa(aa)
		},
		[eoa, selectManagedAa]
	)

	const peekInstitutionalAaRow = useCallback((aa: string) => {
		if (!ethers.isAddress(aa)) return
		const lower = ethers.getAddress(aa).toLowerCase()
		setPeekExpandedInstitutionalAa((prev) => {
			if (prev.has(lower)) return prev
			const n = new Set(prev)
			n.add(lower)
			return n
		})
	}, [])

	/** Hidden wallets are view-only until "Show normally" — no Pending/Transfer/History tabs. */
	const selectedManagedAaOperable = useMemo(() => {
		const aa = selectedManagedAa.trim()
		if (!aa || !ethers.isAddress(aa)) return ''
		if (hiddenInstitutionalAa.has(aa.toLowerCase())) return ''
		return aa
	}, [selectedManagedAa, hiddenInstitutionalAa])

	// Drop selection if the current AA became hidden (deep link / race) so tab bar stays off.
	useEffect(() => {
		const aa = selectedManagedAa.trim()
		if (!aa || !ethers.isAddress(aa)) return
		if (!hiddenInstitutionalAa.has(aa.toLowerCase())) return
		selectManagedAa('')
	}, [selectedManagedAa, hiddenInstitutionalAa, selectManagedAa])

	useEffect(() => {
		if (!eoa) {
			setInstitutionalWallets([])
			return
		}
		setInstitutionalWallets(loadInstitutionalManageableWalletsLocal(eoa))
	}, [eoa])

	useEffect(() => {
		void refreshInstitutionalWallets()
	}, [refreshInstitutionalWallets])

	useEffect(() => {
		if (tab !== 'transfer' || !transferAaAccount) return
		void reloadTransferAssets()
	}, [tab, transferAaAccount, reloadTransferAssets])

	const selectedTransferAsset = useMemo(
		() => transferAssetOptions.find((o) => o.id === transferAssetId) ?? null,
		[transferAssetOptions, transferAssetId]
	)

	const applyTransferAmountMax = useCallback(() => {
		if (!selectedTransferAsset || selectedTransferAsset.balanceRaw <= 0n) return
		setTransferAmount(
			ethers.formatUnits(selectedTransferAsset.balanceRaw, selectedTransferAsset.decimals)
		)
	}, [selectedTransferAsset])

	const reloadPolicy = useCallback(async () => {
		if (!signersAaAccount) {
			setPolicy(null)
			return
		}
		setPolicyLoading(true)
		try {
			const p = await readAaThresholdPolicy(aaMultisigProvider, signersAaAccount, {
				fallbackEoa: eoa,
			})
			setPolicy(p)
		} catch (err) {
			console.warn('[AaMultisig] readAaThresholdPolicy failed', err)
			Toast.show({ content: 'Could not read Smart Wallet policy on CoNET.' })
		} finally {
			setPolicyLoading(false)
		}
	}, [signersAaAccount, eoa])

	useEffect(() => {
		const tabParam = searchParams.get('tab')
		const taskId = searchParams.get('taskId')?.trim()
		const aaParam = searchParams.get('aaAccount')?.trim()

		// Chat deep link: select the Smart Wallet so Pending/History tabs are visible.
		let deepLinkAa = ''
		if (aaParam && ethers.isAddress(aaParam)) {
			deepLinkAa = ethers.getAddress(aaParam)
		}
		if (taskId && eoa) {
			const stored = getAaMultisigTaskAny(eoa, taskId)
			if (stored?.aaAccount && ethers.isAddress(stored.aaAccount) && !deepLinkAa) {
				deepLinkAa = ethers.getAddress(stored.aaAccount)
			}
			if (stored) {
				setTab(multisigTaskDeepLinkTab(stored))
				setFocusTaskId(taskId)
				if (deepLinkAa && !hiddenInstitutionalAa.has(deepLinkAa.toLowerCase())) {
					selectManagedAa(deepLinkAa)
				}
				return
			}
		}
		if (deepLinkAa && !hiddenInstitutionalAa.has(deepLinkAa.toLowerCase())) {
			selectManagedAa(deepLinkAa)
		}

		if (tabParam === 'pending' || tabParam === 'transfer' || tabParam === 'history') {
			setTab(tabParam)
		} else if (tabParam === 'signers' || taskId) {
			setTab('pending')
		}
		if (taskId) setFocusTaskId(taskId)
	}, [searchParams, eoa, selectManagedAa, hiddenInstitutionalAa])

	useEffect(() => {
		if (!focusTaskId || (tab !== 'pending' && tab !== 'history')) return
		if (!selectedManagedAaOperable) return
		const el = document.getElementById(`aa-multisig-task-${focusTaskId}`)
		if (!el) return
		el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		const clear = window.setTimeout(() => {
			setFocusTaskId(null)
			setSearchParams({}, { replace: true })
		}, 2400)
		return () => window.clearTimeout(clear)
	}, [focusTaskId, tab, selectedManagedAaOperable, tasks, setSearchParams])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		setSelectedCosigner(null)
		setNewSignerTag('')
		setCosignerSearchResults([])
		setShowCosignerDropdown(false)
	}, [signersAaAccount])

	useEffect(() => {
		void reloadPolicy()
		reloadTasks()
	}, [reloadPolicy, reloadTasks])

	useEffect(() => {
		const onChange = () => reloadTasks()
		window.addEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onChange)
		return () => window.removeEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onChange)
	}, [reloadTasks])

	const pendingNeedsSign = useMemo(
		() => (eoa ? filterPendingAaMultisigTasksForSigner(tasks, eoa) : []),
		[tasks, eoa]
	)
	const pendingWaiting = useMemo(() => {
		if (!eoa) return []
		const collecting = filterPendingCollectingSignatures(tasks, eoa)
		const needsSignIds = new Set(pendingNeedsSign.map((t) => t.taskId))
		return collecting.filter((t) => !needsSignIds.has(t.taskId))
	}, [tasks, eoa, pendingNeedsSign])

	const pendingWaitingOwnerEoaByTaskId = useMemo(() => {
		const map = new Map<string, string>()
		for (const task of pendingWaiting) {
			const owner = resolveAaMultisigTaskOwnerEoa(task)
			if (owner) map.set(task.taskId, owner)
		}
		return map
	}, [pendingWaiting])

	useEffect(() => {
		const owners = [...new Set(pendingWaitingOwnerEoaByTaskId.values())]
		if (!owners.length) return
		void ensureProfilesForAddresses(owners)
	}, [pendingWaitingOwnerEoaByTaskId, ensureProfilesForAddresses])
	const readyTasks = useMemo(
		() => (eoa ? filterReadyMultisigForManager(tasks, eoa) : []),
		[tasks, eoa]
	)
	const history = useMemo(() => {
		if (!eoa || !selectedManagedAa) return []
		const aaLower = selectedManagedAa.toLowerCase()
		return filterHistoryMultisigForManager(tasks, eoa).filter(
			(t) => t.aaAccount.toLowerCase() === aaLower
		)
	}, [tasks, eoa, selectedManagedAa])

	useEffect(() => {
		if (tab !== 'history' || history.length === 0) return
		const addrs: string[] = []
		for (const t of history) {
			addrs.push(t.aaAccount, t.creatorEoa, ...(t.toEoa ? [t.toEoa] : []))
			for (const s of t.signatures) addrs.push(s.signer)
		}
		void ensureProfilesForAddresses(addrs)
	}, [tab, history, ensureProfilesForAddresses])

	const [chainEntryPointNonce, setChainEntryPointNonce] = useState<string | null>(null)
	const nonceReconcileInFlightRef = useRef(false)

	const reconcilePendingMultisigNonces = useCallback(async (): Promise<boolean> => {
		if (!eoa) return false
		const extraAa = transferEligibleWallets.map((w) => w.aaAccount)
		const { expired, chainNonceByAa } = await reconcileAaMultisigPendingNoncesForWallet(eoa, extraAa)
		for (const task of expired) {
			upsertAaMultisigTaskRecord(eoa, task)
		}
		if (signersAaAccount) {
			const chainNonce = chainNonceByAa.get(signersAaAccount.toLowerCase())
			if (chainNonce != null) setChainEntryPointNonce(String(chainNonce))
		}
		if (expired.length > 0) {
			reloadTasks()
			refreshOutboundQueue()
		}
		return expired.length > 0
	}, [eoa, signersAaAccount, transferEligibleWallets, reloadTasks, refreshOutboundQueue])

	const refreshChainEntryPointNonce = useCallback(async () => {
		if (!signersAaAccount) {
			setChainEntryPointNonce(null)
			return
		}
		try {
			const n = await readAaEntryPointNonce(aaMultisigProvider, signersAaAccount)
			setChainEntryPointNonce(String(n))
		} catch {
			// untrusted — keep previous
		}
	}, [signersAaAccount])

	useEffect(() => {
		if (!eoa) return
		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined

		const scheduleNext = () => {
			if (cancelled) return
			timer = setTimeout(() => void tick(), AA_MULTISIG_PENDING_NONCE_RECONCILE_MS)
		}

		const tick = async () => {
			if (cancelled) return
			if (nonceReconcileInFlightRef.current) {
				scheduleNext()
				return
			}
			nonceReconcileInFlightRef.current = true
			try {
				await reconcilePendingMultisigNonces()
			} finally {
				nonceReconcileInFlightRef.current = false
				scheduleNext()
			}
		}

		void tick()
		return () => {
			cancelled = true
			if (timer) clearTimeout(timer)
		}
	}, [eoa, reconcilePendingMultisigNonces])

	useEffect(() => {
		if (tab !== 'pending' || !eoa) return
		void reconcilePendingMultisigNonces()
		void runOutboundAutoProcess()
	}, [tab, eoa, reconcilePendingMultisigNonces, runOutboundAutoProcess])

	useEffect(() => {
		if (!signersAaAccount) return
		void refreshChainEntryPointNonce()
	}, [signersAaAccount, refreshChainEntryPointNonce])

	const requireWalletReady = (): boolean => {
		if (!eoa || !signersAaAccount) {
			Toast.show({
				content:
					transferEligibleLoading && transferEligibleWallets.length === 0
						? 'Loading Smart Wallets you can manage…'
						: 'Select an institutional Smart Wallet above.',
			})
			return false
		}
		if (
			!policy?.managers.some((m) => m.toLowerCase() === eoa.toLowerCase())
		) {
			Toast.show({ content: 'You are not a signer on this Smart Wallet.' })
			return false
		}
		if (!privateKeyArmor) {
			Toast.show({ content: 'Wallet signing key unavailable.' })
			return false
		}
		return true
	}

	const requireTransferWalletReady = (): boolean => {
		if (!eoa || !transferAaAccount) {
			setTransferCreateError(
				transferEligibleLoading
					? 'Loading Smart Wallets you can sign for…'
					: 'No Smart Wallet available where you are a co-signer.',
			)
			return false
		}
		if (
			!transferPolicy?.managers.some((m) => m.toLowerCase() === eoa.toLowerCase())
		) {
			setTransferCreateError('You are not a signer on this Smart Wallet.')
			return false
		}
		if (!privateKeyArmor) {
			setTransferCreateError('Wallet signing key unavailable.')
			return false
		}
		return true
	}

	const proposeSetPolicyMultisigTask = async (opts: {
		newManagers: string[]
		newThreshold: number
		title: string
		busyKey: string
		gossipRecipients: string[]
		onAfterSuccess?: () => void
		/** When set, failures go here instead of Toast (e.g. Add signing wallet drawer). */
		reportError?: (message: string) => void
	}) => {
		const fail = (message: string) => {
			const msg = message.trim() || 'Request failed.'
			if (opts.reportError) opts.reportError(msg)
			else Toast.show({ content: msg.slice(0, 120) })
		}
		if (opts.reportError) {
			if (!eoa || !signersAaAccount) {
				fail(
					transferEligibleLoading && transferEligibleWallets.length === 0
						? 'Loading Smart Wallets you can manage…'
						: 'Select an institutional Smart Wallet above.'
				)
				return
			}
			if (!policy?.managers.some((m) => m.toLowerCase() === eoa.toLowerCase())) {
				fail('You are not a signer on this Smart Wallet.')
				return
			}
			if (!privateKeyArmor) {
				fail('Wallet signing key unavailable.')
				return
			}
		} else if (!requireWalletReady() || !policy || !signersAaAccount) {
			return
		}
		if (!policy || !signersAaAccount) return
		if (opts.newThreshold < 1 || opts.newThreshold > opts.newManagers.length) {
			fail('Required signatures must be between 1 and the total signer count.')
			return
		}
		setBusy(opts.busyKey)
		try {
			if (!(await isInstitutionalAaV2(signersAaAccount))) {
				fail(
					'This page only manages institutional Smart Wallets on Factory V2. Create a new institutional wallet, then add co-signers there.'
				)
				return
			}
			const ownerAddr =
				resolveEffectiveAaOwner(policy, eoa) ??
				(ethers.isAddress(policy.owner) ? ethers.getAddress(policy.owner) : eoa)
			const managersSorted = buildManagersOwnerFirst(ownerAddr, opts.newManagers)
			const aaRead = new ethers.Contract(
				signersAaAccount,
				[
					'function threshold() view returns (uint256)',
					'function getTask(uint256) view returns (uint8,uint8)',
				],
				aaMultisigProvider
			)
			// Auto-exec on propose uses *pre*-policy threshold. Reading threshold after
			// a 1→N set_policy would see the new T>1 and wrongly attempt a second vote
			// ("Task is not pending" — already Executed in the propose tx).
			const thrBefore = (await aaRead.threshold()) as bigint
			const deadline = defaultAaV2DeadlineSec()
			const nonce = newAaV2SigNonce()
			const signature = await signAaV2ProposeSetPolicy({
				privateKeyArmor,
				account: signersAaAccount,
				managersSorted,
				newThreshold: opts.newThreshold,
				deadline,
				nonce,
			})
			const proposed = await relayAaV2ProposeSetPolicy({
				account: signersAaAccount,
				managersSorted,
				newThreshold: opts.newThreshold,
				deadline,
				nonce,
				signature,
				signerEoa: eoa,
			})
			if (!proposed.success) {
				fail(proposed.error.slice(0, 240))
				return
			}
			if (thrBefore > 1n) {
				// Proposer auto-approve (counts toward threshold > 1); skip if already executed.
				let stillPending = true
				try {
					const t = await aaRead.getTask(BigInt(proposed.taskId))
					const status = Number(t[1] ?? t.status)
					stillPending = status === 1 // TaskStatus: None=0, Pending=1, Executed=2
				} catch {
					stillPending = true
				}
				if (stillPending) {
					const voteNonce = newAaV2SigNonce()
					const voteDeadline = defaultAaV2DeadlineSec()
					const voteSig = await signAaV2Vote({
						privateKeyArmor,
						account: signersAaAccount,
						taskId: proposed.taskId,
						approve: true,
						deadline: voteDeadline,
						nonce: voteNonce,
					})
					const voted = await relayAaV2Vote({
						account: signersAaAccount,
						taskId: proposed.taskId,
						approve: true,
						deadline: voteDeadline,
						nonce: voteNonce,
						signature: voteSig,
						signerEoa: eoa,
					})
					if (!voted.success) {
						fail(
							`Proposed on-chain (#${proposed.taskId}). Auto-approve failed: ${voted.error.slice(0, 160)}`
						)
						await syncAaV2TasksIntoLocal(eoa, signersAaAccount, upsertAaMultisigTaskRecord)
						reloadTasks()
						return
					}
				}
			}
			Toast.show({
				content:
					thrBefore === 1n
						? `Policy updated on-chain (#${proposed.taskId}).`
						: `Policy update proposed on-chain (#${proposed.taskId}).`,
			})
			await syncAaV2TasksIntoLocal(eoa, signersAaAccount, upsertAaMultisigTaskRecord)
			if (proposed.txHash) {
				const tid = `v2-${signersAaAccount.toLowerCase()}-${proposed.taskId}`
				const prev = getAaMultisigTaskAny(eoa, tid)
				if (prev) {
					upsertAaMultisigTaskRecord(
						eoa,
						attachSignerVoteTxHash(prev, eoa, proposed.txHash)
					)
				}
			}
			void refreshInstitutionalWallets()
			opts.onAfterSuccess?.()
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			fail(msg.slice(0, 240))
		} finally {
			setBusy(null)
		}
	}

	const handleSelectCosigner = async (item: searchResult) => {
		const signerEoa = await resolveCosignerEoaFromSearchRow(item)
		if (!signerEoa) {
			const msg = 'Co-signer must be a Beamio EOA (not a contract).'
			if (sigsDrawerMode === 'add') setSigsDrawerError(msg)
			else Toast.show({ content: msg })
			return
		}
		setSigsDrawerError(null)
		setSelectedCosigner({ ...item, address: signerEoa })
		setNewSignerTag('')
		setCosignerSearchResults([])
		setShowCosignerDropdown(false)
	}

	const resolveNewSignerEoa = async (): Promise<string | null> => {
		if (selectedCosigner) {
			return resolveCosignerEoaFromSearchRow(selectedCosigner)
		}
		const tag = newSignerTag.trim().replace(/^@/, '')
		if (!tag) return null
		if (ethers.isAddress(tag)) {
			const identity = await resolveCosignerEoaFromInput(tag)
			if (!identity || identity.inputKind === 'contract') return null
			return ethers.getAddress(identity.eoa)
		}
		const search = await searchUsername(tag)
		const row = search?.results?.[0]
		if (!row) return null
		return resolveCosignerEoaFromSearchRow(row)
	}

	const closeSigsDrawer = useCallback(() => {
		setSigsDrawerMode(null)
		setDrawerRemoveTargetEoa(null)
		setSelectedCosigner(null)
		setNewSignerTag('')
		setShowCosignerDropdown(false)
		setCosignerSearchResults([])
		setSigsDrawerError(null)
	}, [])

	const openSigsDrawer = useCallback(
		(aa: string, mode: Exclude<SigsDrawerMode, null>, walletPolicy: {
			owner: string
			managers: string[]
			threshold: number
		}) => {
			selectManagedAa(aa)
			setSigsDrawerMode(mode)
			setDrawerRemoveTargetEoa(null)
			setSelectedCosigner(null)
			setNewSignerTag('')
			setShowCosignerDropdown(false)
			setCosignerSearchResults([])
			setSigsDrawerError(null)
			if (mode === 'add') {
				setDrawerThreshold(
					autoRequiredSignaturesAfterAddCosigner(
						walletPolicy.threshold,
						walletPolicy.managers.length,
						walletPolicy.managers.length + 1
					)
				)
			} else {
				setDrawerThreshold(
					autoRequiredSignaturesAfterRemoveCosigner(
						walletPolicy.threshold,
						Math.max(1, walletPolicy.managers.length - 1)
					)
				)
			}
		},
		[selectManagedAa]
	)

	const drawerPolicy = useMemo(() => {
		if (policy && selectedManagedAa) {
			return policy
		}
		const w = institutionalWallets.find(
			(x) =>
				selectedManagedAa &&
				x.aaAccount.toLowerCase() === selectedManagedAa.toLowerCase()
		)
		return w?.policy ?? null
	}, [policy, selectedManagedAa, institutionalWallets])

	const drawerRemovableManagers = useMemo(() => {
		if (!drawerPolicy) return []
		const owner =
			resolveEffectiveAaOwner(drawerPolicy, eoa) ?? drawerPolicy.owner
		return drawerPolicy.managers.filter(
			(m) => m && m !== ethers.ZeroAddress && m.toLowerCase() !== owner.toLowerCase()
		)
	}, [drawerPolicy, eoa])

	const drawerAddSignerCount = useMemo(() => {
		if (!drawerPolicy) return 0
		return selectedCosigner ? drawerPolicy.managers.length + 1 : drawerPolicy.managers.length
	}, [drawerPolicy, selectedCosigner])

	const drawerRemoveSignerCount = useMemo(() => {
		if (!drawerPolicy) return 0
		return drawerRemoveTargetEoa
			? Math.max(1, drawerPolicy.managers.length - 1)
			: drawerPolicy.managers.length
	}, [drawerPolicy, drawerRemoveTargetEoa])

	useEffect(() => {
		if (sigsDrawerMode !== 'add' || !drawerPolicy) return
		if (selectedCosigner) {
			setDrawerThreshold(
				autoRequiredSignaturesAfterAddCosigner(
					drawerPolicy.threshold,
					drawerPolicy.managers.length,
					drawerPolicy.managers.length + 1
				)
			)
			return
		}
		setDrawerThreshold(drawerPolicy.threshold)
	}, [
		sigsDrawerMode,
		selectedCosigner,
		drawerPolicy?.threshold,
		drawerPolicy?.managers.length,
	])

	useEffect(() => {
		if (sigsDrawerMode !== 'remove' || !drawerPolicy) return
		setDrawerThreshold(
			autoRequiredSignaturesAfterRemoveCosigner(
				drawerPolicy.threshold,
				drawerRemoveTargetEoa
					? Math.max(1, drawerPolicy.managers.length - 1)
					: drawerPolicy.managers.length
			)
		)
	}, [
		sigsDrawerMode,
		drawerRemoveTargetEoa,
		drawerPolicy?.threshold,
		drawerPolicy?.managers.length,
	])

	const proposeAddSignerFromDrawer = async () => {
		setSigsDrawerError(null)
		if (!policy) {
			setSigsDrawerError('Smart Wallet policy unavailable.')
			return
		}
		if (
			!selectedManagedAa ||
			!signersAaAccount ||
			signersAaAccount.toLowerCase() !== selectedManagedAa.toLowerCase()
		) {
			setSigsDrawerError('Loading Smart Wallet policy…')
			return
		}
		try {
			const signerEoa = await resolveNewSignerEoa()
			if (!signerEoa) {
				setSigsDrawerError('Search and select a @BeamioTag for the new signer.')
				return
			}
			if (signerEoa.toLowerCase() === eoa.toLowerCase()) {
				setSigsDrawerError('You cannot add yourself as a co-signer.')
				return
			}
			if (policy.managers.some((m) => m.toLowerCase() === signerEoa.toLowerCase())) {
				setSigsDrawerError('This address is already a co-signer.')
				return
			}
			const managers = buildManagersOwnerFirst(
				resolveEffectiveAaOwner(policy, eoa) ?? policy.owner,
				[
					...policy.managers.filter((m) => m.toLowerCase() !== signerEoa.toLowerCase()),
					signerEoa,
				]
			)
			await proposeSetPolicyMultisigTask({
				newManagers: managers,
				newThreshold: Math.min(drawerThreshold, managers.length),
				title: 'Update multisig signers',
				busyKey: 'policy',
				gossipRecipients: managers,
				reportError: setSigsDrawerError,
				onAfterSuccess: () => {
					setNewSignerTag('')
					setSelectedCosigner(null)
					closeSigsDrawer()
				},
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			setSigsDrawerError(msg.slice(0, 240))
		}
	}

	const proposeRemoveSignerFromDrawer = async () => {
		if (!requireWalletReady() || !policy) return
		if (
			!selectedManagedAa ||
			!signersAaAccount ||
			signersAaAccount.toLowerCase() !== selectedManagedAa.toLowerCase()
		) {
			Toast.show({ content: 'Loading Smart Wallet policy…' })
			return
		}
		if (!drawerRemoveTargetEoa) {
			Toast.show({ content: 'Select a co-signer to remove.' })
			return
		}
		const owner = resolveEffectiveAaOwner(policy, eoa) ?? policy.owner
		if (drawerRemoveTargetEoa.toLowerCase() === owner.toLowerCase()) {
			Toast.show({ content: 'The owner cannot be removed from the signer set.' })
			return
		}
		const managers = buildManagersOwnerFirst(
			owner,
			policy.managers.filter(
				(m) => m.toLowerCase() !== drawerRemoveTargetEoa.toLowerCase()
			)
		)
		if (managers.length < 1) {
			Toast.show({ content: 'At least one signer must remain.' })
			return
		}
		const nextThreshold = Math.min(Math.max(1, drawerThreshold), managers.length)
		await proposeSetPolicyMultisigTask({
			newManagers: managers,
			newThreshold: nextThreshold,
			title: `Remove signer (${nextThreshold}/${managers.length})`,
			busyKey: 'policy',
			gossipRecipients: managers,
			onAfterSuccess: () => {
				setDrawerRemoveTargetEoa(null)
				closeSigsDrawer()
			},
		})
	}

	useEffect(() => {
		if (sigsDrawerMode !== 'remove' || drawerRemovableManagers.length === 0) return
		void ensureProfilesForAddresses(drawerRemovableManagers)
	}, [sigsDrawerMode, drawerRemovableManagers, ensureProfilesForAddresses])

	const proposeTransfer = async () => {
		setTransferCreateError(null)
		if (!requireTransferWalletReady()) return
		if (!selectedTransferAsset || !transferAssetId) {
			setTransferCreateError('No transferable assets in this Smart Wallet.')
			return
		}
		const useV2Early = await isInstitutionalAaV2(transferAaAccount)
		if (!useV2Early) {
			setTransferCreateError(
				'Transfers on this page require an institutional Smart Wallet on Factory V2. Create a new institutional wallet first.'
			)
			return
		}
		try {
			const aa = new ethers.Contract(
				transferAaAccount,
				['function policyLockActive() view returns (bool)'],
				aaMultisigProvider
			)
			if (await aa.policyLockActive()) {
				setTransferCreateError(
					'A policy change is pending — transfers are frozen until it completes.'
				)
				return
			}
		} catch {
			/* continue; Cluster will re-check */
		}
		setBusy('transfer')
		try {
			const to = transferTo.trim()
			if (!ethers.isAddress(to)) {
				setTransferCreateError('Invalid recipient address.')
				return
			}
			const amountRaw = parseTransferAmountToRaw(transferAmount, selectedTransferAsset.decimals)
			if (amountRaw == null || amountRaw <= 0n) {
				setTransferCreateError('Enter a positive amount.')
				return
			}
			if (amountRaw > selectedTransferAsset.balanceRaw) {
				setTransferCreateError('Amount exceeds available balance.')
				return
			}

			const token = tokenAddressForTransferAsset(transferAssetId)
			const deadline = defaultAaV2DeadlineSec()
			const nonce = newAaV2SigNonce()
			const signature = await signAaV2ProposeTransfer({
				privateKeyArmor,
				account: transferAaAccount,
				token,
				to: ethers.getAddress(to),
				amount: amountRaw,
				deadline,
				nonce,
			})
			const proposed = await relayAaV2ProposeTransfer({
				account: transferAaAccount,
				token,
				to: ethers.getAddress(to),
				amount: amountRaw.toString(),
				deadline,
				nonce,
				signature,
				signerEoa: eoa,
			})
			if (!proposed.success) {
				setTransferCreateError(proposed.error)
				return
			}

			// Current threshold == 1: Account executes in the same propose tx (no second vote).
			const aaRead = new ethers.Contract(
				transferAaAccount,
				['function threshold() view returns (uint256)', 'function getTask(uint256) view returns (uint8,uint8)'],
				aaMultisigProvider
			)
			const thr = (await aaRead.threshold()) as bigint
			if (thr === 1n) {
				try {
					const t = await aaRead.getTask(BigInt(proposed.taskId))
					const status = Number(t[1] ?? t.status)
					if (status !== 2) {
						setTransferCreateError(
							`Transfer #${proposed.taskId} did not execute (status ${status}). Check balance and try again.`
						)
						await syncAaV2TasksIntoLocal(eoa, transferAaAccount, upsertAaMultisigTaskRecord)
						reloadTasks()
						return
					}
				} catch {
					/* sync below */
				}
				Toast.show({ content: `Transfer completed (#${proposed.taskId}).` })
			} else {
				// T>1: proposer auto-approve counts toward threshold; execution waits for remaining sigs.
				const voteNonce = newAaV2SigNonce()
				const voteDeadline = defaultAaV2DeadlineSec()
				const voteSig = await signAaV2Vote({
					privateKeyArmor,
					account: transferAaAccount,
					taskId: proposed.taskId,
					approve: true,
					deadline: voteDeadline,
					nonce: voteNonce,
				})
				const voted = await relayAaV2Vote({
					account: transferAaAccount,
					taskId: proposed.taskId,
					approve: true,
					deadline: voteDeadline,
					nonce: voteNonce,
					signature: voteSig,
					signerEoa: eoa,
				})
				if (!voted.success) {
					Toast.show({
						content: `Transfer proposed (#${proposed.taskId}). Auto-approve failed: ${voted.error.slice(0, 80)}`,
					})
				} else {
					Toast.show({
						content: `Transfer #${proposed.taskId} proposed — you signed (1/${thr.toString()}). Waiting for co-signers.`,
					})
				}
				setTab('pending')
			}
			await syncAaV2TasksIntoLocal(eoa, transferAaAccount, upsertAaMultisigTaskRecord)
			if (proposed.txHash) {
				const tid = `v2-${transferAaAccount.toLowerCase()}-${proposed.taskId}`
				const prev = getAaMultisigTaskAny(eoa, tid)
				if (prev) {
					upsertAaMultisigTaskRecord(
						eoa,
						attachSignerVoteTxHash(prev, eoa, proposed.txHash)
					)
				}
			}
			reloadTasks()
			void refreshInstitutionalWallets()
			setTransferAmount('')
			setTransferTo('')
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			setTransferCreateError(msg.trim() || 'Create multisig task failed.')
		} finally {
			setBusy(null)
		}
	}

	const signTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
		if (!isAaV2LocalTask(task)) {
			Toast.show({
				content:
					'This page only signs institutional Factory V2 tasks. Legacy V1 UserOp requests are not supported.',
			})
			return
		}
		const onChainId = getOnChainTaskId(task)
		if (!onChainId) {
			Toast.show({ content: 'Missing on-chain task id.' })
			return
		}
		setBusy(task.taskId)
		try {
			const deadline = defaultAaV2DeadlineSec()
			const nonce = newAaV2SigNonce()
			const signature = await signAaV2Vote({
				privateKeyArmor,
				account: task.aaAccount,
				taskId: onChainId,
				approve: true,
				deadline,
				nonce,
			})
			const voted = await relayAaV2Vote({
				account: task.aaAccount,
				taskId: onChainId,
				approve: true,
				deadline,
				nonce,
				signature,
				signerEoa: eoa,
			})
			if (!voted.success) {
				Toast.show({ content: voted.error.slice(0, 120) })
				return
			}
			if (voted.txHash) {
				const prev = getAaMultisigTaskAny(eoa, task.taskId)
				if (prev) {
					upsertAaMultisigTaskRecord(eoa, attachSignerVoteTxHash(prev, eoa, voted.txHash))
				}
			}
			await syncAaV2TasksIntoLocal(eoa, task.aaAccount, upsertAaMultisigTaskRecord)
			Toast.show({ content: 'Approved on-chain.' })
			reloadTasks()
			if (task.kind === 'set_policy') {
				void reloadPolicy()
				void refreshInstitutionalWallets()
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const rejectTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
		if (!isAaV2LocalTask(task)) {
			Toast.show({
				content:
					'This page only rejects institutional Factory V2 tasks. Legacy V1 UserOp requests are not supported.',
			})
			return
		}
		const onChainId = getOnChainTaskId(task)
		if (!onChainId) {
			Toast.show({ content: 'Missing on-chain task id.' })
			return
		}
		setBusy(`reject-${task.taskId}`)
		try {
			const deadline = defaultAaV2DeadlineSec()
			const nonce = newAaV2SigNonce()
			const signature = await signAaV2Vote({
				privateKeyArmor,
				account: task.aaAccount,
				taskId: onChainId,
				approve: false,
				deadline,
				nonce,
			})
			const voted = await relayAaV2Vote({
				account: task.aaAccount,
				taskId: onChainId,
				approve: false,
				deadline,
				nonce,
				signature,
				signerEoa: eoa,
			})
			if (!voted.success) {
				Toast.show({ content: voted.error.slice(0, 120) })
				return
			}
			await syncAaV2TasksIntoLocal(eoa, task.aaAccount, upsertAaMultisigTaskRecord)
			Toast.show({ content: 'Rejected on-chain.' })
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const submitTask = async (
		task: AaMultisigTaskLocal,
		opts?: { quiet?: boolean; retainBusy?: boolean },
	): Promise<{ ok: boolean; error?: string }> => {
		const fail = (error: string): { ok: false; error: string } => {
			if (!opts?.quiet) Toast.show({ content: error.slice(0, 120) })
			return { ok: false, error }
		}
		if (!requireWalletReady()) return fail('Wallet not ready.')
		if (!isAaV2LocalTask(task)) {
			return fail(
				'This page only supports institutional Factory V2 tasks. Legacy V1 UserOp submit is not available.'
			)
		}
		// V2 executes on-chain when threshold is met during vote — no UserOp submit.
		await syncAaV2TasksIntoLocal(eoa, task.aaAccount, upsertAaMultisigTaskRecord)
		reloadTasks()
		return { ok: true }
	}

	submitTaskRef.current = submitTask

	useEffect(() => {
		if (!eoa || !privateKeyArmor) return
		let cancelled = false
		void (async () => {
			await reconcilePendingMultisigNonces()
			if (cancelled) return
			const freshTasks = loadAllAaMultisigTasksForWallet(eoa)
			const viewer = eoa.toLowerCase()
			for (const task of freshTasks) {
				const prevStatus = prevMultisigTaskStatusRef.current.get(task.taskId)
				prevMultisigTaskStatusRef.current.set(task.taskId, task.status)
				if (task.status !== 'ready') continue
				if (prevStatus === 'ready') continue
				if (!task.managers.some((m) => m.toLowerCase() === viewer)) continue
				if (autoSubmitInFlightRef.current.has(task.taskId)) continue
				autoSubmitInFlightRef.current.add(task.taskId)
				try {
					await submitTaskRef.current(task)
				} finally {
					autoSubmitInFlightRef.current.delete(task.taskId)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [tasks, eoa, privateKeyArmor, reconcilePendingMultisigNonces])

	const importOfflinePacket = async () => {
		if (!requireWalletReady()) return
		const result = ingestAaMultisigFromExport({ payloadText: importPayload, walletEoa: eoa })
		if (!result.ok) {
			Toast.show({ content: result.error.slice(0, 120) })
			return
		}
		setImportPayload('')
		setShowImportPanel(false)
		reloadTasks()
		Toast.show({ content: 'Multisig packet imported.' })
	}

	const copyQueuedPacket = async (item: AaMultisigOutboundListItem) => {
		const ok = await copyAaMultisigInnerExport(item.inner)
		Toast.show({
			content: ok ? 'Packet copied. Share with co-signers offline.' : 'Copy failed.',
		})
	}

	const dismissQueuedPacket = (item: AaMultisigOutboundListItem) => {
		if (!eoa) return
		if (!dismissAaMultisigOutboundItem(eoa, item.id)) return
		refreshOutboundQueue()
		Toast.show({ content: 'Removed from offline sync queue.' })
	}

	const exportTaskSignPacket = async (task: AaMultisigTaskLocal) => {
		const inner = buildSignInnerExportForTask(task, eoa)
		if (!inner) {
			Toast.show({ content: 'No signature to export for this task.' })
			return
		}
		const ok = await copyAaMultisigInnerExport(inner)
		Toast.show({
			content: ok ? 'Sign packet copied. Share with co-signers offline.' : 'Copy failed.',
		})
	}

	const exportTaskProposalPacket = async (task: AaMultisigTaskLocal) => {
		if (task.creatorEoa.toLowerCase() !== eoa.toLowerCase()) return
		const inner = buildProposeInnerExportFromTask(task)
		const ok = await copyAaMultisigInnerExport(inner)
		Toast.show({
			content: ok ? 'Proposal packet copied. Share with co-signers offline.' : 'Copy failed.',
		})
	}

	const renderTaskRow = (task: AaMultisigTaskLocal, actions?: 'pending' | 'ready' | 'history') => {
		const rowMode = actions ? resolveMultisigTaskRowMode(task, eoa) : 'history'
		const effectiveMode =
			actions === 'ready'
				? 'ready'
				: actions === 'history'
					? 'history'
					: rowMode
		const userSigned = task.signatures.some((s) => s.signer.toLowerCase() === eoa.toLowerCase())
		const syncPending = userSigned && isAaMultisigOutboundPending(eoa, task.taskId, eoa)
		const userIsCreator = task.creatorEoa.toLowerCase() === eoa.toLowerCase()
		const progressLabel = formatMultisigSignatureProgress(task)
		const secondaryPending = multisigPendingSecondaryMessage(task, eoa)
		const historySummary = multisigHistorySummary(task)
		const statusChip = multisigTaskStatusChipLabel(task, eoa)
		// V1 UserOp self-execute wrap is obsolete; V2 set_policy never uses that encoding.
		const brokenSetPolicyEncoding = false
		const aaOwnerEoa =
			effectiveMode === 'waiting' ? resolveAaMultisigTaskOwnerEoa(task) : null
		const aaOwnerTagRaw = aaOwnerEoa ? resolveTag(aaOwnerEoa) : ''
		const aaOwnerTagLine = aaOwnerTagRaw
			? aaOwnerTagRaw.startsWith('@')
				? aaOwnerTagRaw
				: `@${aaOwnerTagRaw}`
			: null

		return (
		<div
			id={`aa-multisig-task-${task.taskId}`}
			key={task.taskId}
			className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
				focusTaskId === task.taskId ? 'ring-2 ring-[#8d3a8b]/60' : ''
			}`}
			style={{ borderColor: aaAccent.border }}
		>
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
						{task.title ?? task.kind}
					</p>
					<p className="mt-0.5 text-xs text-slate-500">
						{task.kind === 'transfer' ? formatTransferTaskSummary(task) : task.kind}
					</p>
					{effectiveMode === 'waiting' && aaOwnerEoa ? (
						<p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
							Smart Wallet owner {aaOwnerTagLine ?? '@Beamio'}
						</p>
					) : null}
					{effectiveMode !== 'history' &&
					aaAccount &&
					task.aaAccount.toLowerCase() !== aaAccount.toLowerCase() ? (
						<p className="mt-0.5 font-mono text-[11px] text-slate-400">
							Smart Wallet {task.aaAccount.slice(0, 6)}…{task.aaAccount.slice(-4)}
						</p>
					) : null}
					<p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{progressLabel}</p>
					{effectiveMode === 'waiting' && secondaryPending ? (
						<p className="mt-1 text-xs font-medium" style={{ color: aaAccent.accent }}>
							{secondaryPending}
						</p>
					) : null}
					{effectiveMode === 'ready' ? (
						<p className="mt-1 text-xs font-medium text-emerald-700">
							All signatures collected — submit to finish
						</p>
					) : null}
					{historySummary ? (
						<p
							className={`mt-1 text-xs font-medium ${
								task.status === 'expired'
									? 'text-amber-700'
									: task.status === 'completed'
										? 'text-emerald-700'
										: 'text-slate-600 dark:text-slate-300'
							}`}
						>
							{historySummary}
						</p>
					) : null}
					{syncPending ? (
						<p className="mt-1 text-xs font-medium text-amber-600">Sync pending (offline sign)</p>
					) : null}
					{brokenSetPolicyEncoding ? (
						<p className="mt-1 text-xs font-medium text-amber-700">
							Outdated call encoding — reject and propose again.
						</p>
					) : null}
					{task.status === 'failed' ? (
						<p className="mt-1 text-xs font-medium text-red-600">
							On-chain submit failed — reject and re-propose with nonce {chainEntryPointNonce ?? '…'}.
						</p>
					) : null}
				</div>
				<span
					className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
					style={{ backgroundColor: aaAccent.surfaceBg, color: aaAccent.accent }}
				>
					{statusChip}
				</span>
			</div>
			{effectiveMode === 'sign' ? (
				<div className="mt-3 flex gap-2">
					<button
						type="button"
						disabled={busy === task.taskId}
						onClick={() => void signTask(task)}
						className="flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-white"
						style={{ backgroundColor: aaAccent.accent }}
					>
						{busy === task.taskId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
						Sign
					</button>
					<button
						type="button"
						disabled={busy === `reject-${task.taskId}`}
						onClick={() => void rejectTask(task)}
						className="rounded-xl border px-3 py-2 text-sm font-medium text-amber-700 border-amber-200 bg-amber-50"
					>
						Reject
					</button>
				</div>
			) : null}
			{effectiveMode !== 'history' && userIsCreator ? (
				<button
					type="button"
					onClick={() => void exportTaskProposalPacket(task)}
					className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
				>
					<Copy className="h-3.5 w-3.5" aria-hidden />
					Copy proposal packet
				</button>
			) : null}
			{effectiveMode !== 'history' && userSigned ? (
				<button
					type="button"
					onClick={() => void exportTaskSignPacket(task)}
					className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
				>
					<Copy className="h-3.5 w-3.5" aria-hidden />
					Copy sign packet
				</button>
			) : null}
			{effectiveMode === 'ready' ? (
				<button
					type="button"
					disabled={busy === `submit-${task.taskId}` || brokenSetPolicyEncoding}
					onClick={() => void submitTask(task)}
					className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50"
					style={{ backgroundColor: aaAccent.accent }}
				>
					{busy === `submit-${task.taskId}` ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Send className="h-4 w-4" />
					)}
					{task.kind === 'transfer' ? 'Submit transfer' : 'Submit'}
				</button>
			) : null}
			{effectiveMode === 'history' ? (
				<div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
					{task.kind === 'transfer' && task.toEoa && ethers.isAddress(task.toEoa) ? (
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
								Recipient
							</p>
							<div className="mt-1">
								<ConetExplorerAddressCapsule
									address={task.toEoa}
									variant="eoa"
									beamioTag={resolveTag(task.toEoa) || null}
								/>
							</div>
						</div>
					) : null}
					{task.signatures.length > 0 ? (
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
								Signatures
							</p>
							<ul className="mt-1.5 space-y-2">
								{task.signatures.map((sig) => {
									const tag = resolveTag(sig.signer)
									const tagLine = tag
										? tag.startsWith('@')
											? tag
											: `@${tag}`
										: null
									const voteTx = resolveSignatureVoteTxHash(sig, task)
									return (
										<li
											key={`${task.taskId}-sig-${sig.signer}`}
											className="flex flex-nowrap items-center gap-1.5 overflow-x-auto"
										>
											<ConetExplorerAddressCapsule
												address={sig.signer}
												variant="eoa"
												beamioTag={tagLine}
											/>
											{voteTx ? (
												<ConetExplorerTxHashCapsule txHash={voteTx} />
											) : null}
										</li>
									)
								})}
							</ul>
						</div>
					) : null}
					{task.txHash ? (
						<div>
							<p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
								Execution
							</p>
							<div className="mt-1">
								<ConetExplorerTxHashCapsule txHash={task.txHash} label="Tx" />
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
		)
	}

	return (
		<>
		<div className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#F2F2F7] dark:bg-slate-950">
			<button
				type="button"
				onClick={() => navigate('/wallet')}
				className={`fixed left-4 z-10 ${CAPSULE_BTN_CLASS}`}
				style={{
					top: 'max(1rem, env(safe-area-inset-top))',
					opacity: backBtnOpacity,
					pointerEvents: backBtnOpacity < 0.05 ? 'none' : 'auto',
				}}
				aria-label={tu('back')}
			>
				<ChevronLeft className="h-6 w-6 text-slate-900 dark:text-slate-100" strokeWidth={2.6} />
			</button>

			<div
				ref={setPageScrollRef}
				onScroll={onPageScroll}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
			>
				<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 5rem)' }} />
				<div className="mx-auto w-full max-w-lg pb-10">
				<div className="mb-4 flex items-center gap-3">
					<div
						className="flex h-11 w-11 items-center justify-center rounded-full text-white"
						style={{ backgroundColor: aaAccent.accent }}
					>
						<Hexagon className="h-6 w-6" strokeWidth={2.25} />
					</div>
					<div>
						<h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Smart Wallet Multisig</h1>
					</div>
				</div>

				<section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
					<div className="flex items-center justify-between gap-2">
						<h2 className="min-w-0 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
							Manage your institutional-grade smart wallets
						</h2>
						{hasInstitutionalWallets ? (
							<button
								type="button"
								onClick={() => {
									setShowNewInstitutionalWalletForm((open) => {
										const next = !open
										if (!next) {
											setCreateInstitutionalError(null)
											setNewInstitutionalTag('')
										}
										return next
									})
								}}
								disabled={creatingInstitutionalAa}
								aria-expanded={showInstitutionalCreateForm}
								aria-label={
									showInstitutionalCreateForm
										? 'Hide new institutional wallet form'
										: 'New institutional-grade smart wallet'
								}
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
								style={
									showInstitutionalCreateForm
										? undefined
										: { color: aaAccent.accent, borderColor: `${aaAccent.accent}55` }
								}
							>
								{showInstitutionalCreateForm ? (
									<X className="h-4 w-4" aria-hidden strokeWidth={2.25} />
								) : (
									<Plus className="h-4 w-4" aria-hidden strokeWidth={2.25} />
								)}
							</button>
						) : null}
					</div>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
						Create and manage Smart Wallets beyond your personal Express Pay wallet. Give each wallet
						a unique @BeamioTag so others can search and find its address. Use + / − on a wallet to
						change co-signers; select a wallet for pending approvals, transfers, and history. Hide a
						wallet to collapse it to a gray owner tag; tap to expand, or choose Show normally.
					</p>

					{institutionalListLoading && !hasInstitutionalWallets ? (
						<p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading institutional Smart Wallets…
						</p>
					) : !hasInstitutionalWallets ? (
						<p className="mt-3 text-sm text-slate-500">
							No institutional Smart Wallets yet. Create one with a BeamioTag, or wait until you are
							added as a co-signer on another wallet.
						</p>
					) : (
						<div className="mt-3 max-h-[min(50vh,28rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600">
							<ul className="space-y-2" role="listbox" aria-label="Institutional Smart Wallets">
								{institutionalWallets.map((w) => {
									const aaLower = w.aaAccount.toLowerCase()
									const isHidden = hiddenInstitutionalAa.has(aaLower)
									const isPeeking = peekExpandedInstitutionalAa.has(aaLower)
									const showCompact = isHidden && !isPeeking
									const selected =
										!!selectedManagedAaOperable &&
										aaLower === selectedManagedAaOperable.toLowerCase()
									const walletTagLine = w.accountName
										? w.accountName.startsWith('@')
											? w.accountName
											: `@${w.accountName}`
										: null
									const ownerEoa =
										resolveEffectiveAaOwner(w.policy, eoa) ??
										resolveAaMultisigPolicyOwnerEoa(w.policy.managers)
									/** Self-owned AA: hide owner @tag chrome; co-signers see owner BeamioTag. */
									const viewerIsOwner =
										!!eoa &&
										!!ownerEoa &&
										eoa.toLowerCase() === ownerEoa.toLowerCase()
									const showOwnerBeamioTag = !!ownerEoa && !viewerIsOwner
									const ownerTag = ownerEoa ? resolveTag(ownerEoa) : ''
									const ownerCapsule = ownerEoa ? toCapsuleItem(ownerEoa) : null
									const ownerRecord = ownerEoa ? lookupByAddress(ownerEoa) : null
									const ownerTagLine = (() => {
										if (ownerEoa) {
											const t = (ownerTag ?? '').trim()
											if (t) return formatBeamioTagDisplayLine(t)
											if (walletTagLine) return walletTagLine
											return formatBeamioTagDisplayLine('')
										}
										if (walletTagLine) return walletTagLine
										return `@${shortAddr(w.aaAccount)}`
									})()
									const ownerImgSrc =
										ownerRecord?.image?.trim() ||
										ownerCapsule?.image?.trim() ||
										(ownerEoa
											? avatarImgUrl(ownerRecord?.accountName ?? ownerTag, ownerEoa)
											: avatarImgUrl(walletTagLine?.replace(/^@/, '') ?? '', w.aaAccount))
									const ownerDisplayName = ownerEoa
										? signerDisplayName(ownerCapsule, ownerTag)
										: null
									const compactSelfLabel =
										walletTagLine ?? `@${shortAddr(w.aaAccount)}`
									const compactSelfImg = avatarImgUrl(
										walletTagLine?.replace(/^@/, '') ?? '',
										w.aaAccount
									)
									/** Owner vs co-signer card chrome (AA purple vs EOA blue surfaces). */
									const institutionalItemShellClass = (() => {
										if (isHidden) {
											return viewerIsOwner
												? 'cursor-default border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'
												: 'cursor-default border-[#dce2f7] bg-[#e9edff]/70 dark:border-slate-600 dark:bg-slate-900/60'
										}
										if (viewerIsOwner) {
											return selected
												? 'cursor-pointer border-[#8d3a8b] bg-[#f5ecff] ring-2 ring-[#8d3a8b]/20 dark:border-[#8d3a8b]/60 dark:bg-slate-800/80'
												: 'cursor-pointer border-[#eadcf7] bg-white hover:border-[#8d3a8b]/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600'
										}
										return selected
											? 'cursor-pointer border-[#0051d1] bg-[#e9edff] ring-2 ring-[#0051d1]/20 dark:border-[#0051d1]/50 dark:bg-slate-800/80'
											: 'cursor-pointer border-[#dce2f7] bg-[#e9edff] hover:border-[#0051d1]/35 dark:border-slate-600 dark:bg-[#1a2338]/80 dark:hover:border-slate-500'
									})()
									const compactShellClass = viewerIsOwner
										? 'flex w-full items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1 transition-colors hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600'
										: 'flex w-full items-center rounded-full border border-[#dce2f7] bg-[#e9edff] px-1.5 py-1 transition-colors hover:border-[#0051d1]/35 hover:bg-[#e0e8ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d1]/40 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:border-slate-500'

									if (showCompact) {
										return (
											<li key={w.aaAccount}>
												<button
													type="button"
													role="option"
													aria-selected={false}
													aria-label={
														showOwnerBeamioTag
															? `Expand hidden wallet ${ownerTagLine}`
															: `Expand hidden wallet ${compactSelfLabel}`
													}
													onClick={() => {
														// Peek only — hidden wallets cannot be selected for tabs / operations.
														peekInstitutionalAaRow(w.aaAccount)
													}}
													className={compactShellClass}
												>
													{showOwnerBeamioTag ? (
														<OwnerBeamioTagCapsule
															ownerEoa={ownerEoa || w.aaAccount}
															tagLine={ownerTagLine}
															imgSrc={ownerImgSrc}
															displayName={ownerDisplayName}
															muted
														/>
													) : (
														<OwnerBeamioTagCapsule
															ownerEoa={w.aaAccount}
															tagLine={compactSelfLabel}
															imgSrc={compactSelfImg}
															muted
														/>
													)}
												</button>
											</li>
										)
									}

									return (
										<li key={w.aaAccount}>
											<div
												role="option"
												aria-selected={!!selected}
												tabIndex={isHidden ? -1 : 0}
												onPointerDown={(e) => {
													if (isHidden) return
													const target = e.target as HTMLElement | null
													if (
														target?.closest(
															'select, option, label, a, button, [data-institutional-aa-no-select]'
														)
													) {
														return
													}
													selectManagedAa(w.aaAccount)
												}}
												onKeyDown={(e) => {
													if (isHidden) return
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault()
														selectManagedAa(w.aaAccount)
													}
												}}
												className={`rounded-2xl border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/40 ${institutionalItemShellClass}`}
											>
												<div className="flex min-w-0 flex-wrap items-center gap-2">
													{showOwnerBeamioTag ? (
														<span data-institutional-aa-no-select>
															<OwnerBeamioTagCapsule
																ownerEoa={ownerEoa || w.aaAccount}
																tagLine={ownerTagLine}
																imgSrc={ownerImgSrc}
																displayName={ownerDisplayName}
															/>
														</span>
													) : null}
													<div
														className="min-w-0 max-w-full"
														data-institutional-aa-no-select
														onPointerDown={(e) => e.stopPropagation()}
													>
														<AaAccountAddressCapsule
															address={w.aaAccount}
															beamioTag={walletTagLine}
														/>
													</div>
													<div
														className="ml-auto flex shrink-0 items-center gap-1"
														data-institutional-aa-no-select
														onPointerDown={(e) => e.stopPropagation()}
													>
														{isHidden ? (
															<button
																type="button"
																onClick={() => restoreInstitutionalAaRow(w.aaAccount)}
																className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
																aria-label="Show this wallet normally"
															>
																<Eye className="h-3.5 w-3.5" aria-hidden />
																Show normally
															</button>
														) : (
															<button
																type="button"
																onClick={() => hideInstitutionalAaRow(w.aaAccount)}
																className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
																aria-label="Hide this wallet"
																title="Hide"
															>
																<EyeOff className="h-3.5 w-3.5" aria-hidden />
															</button>
														)}
													</div>
												</div>
												{isHidden ? (
													<p className="mt-2 text-[11px] text-slate-500">
														This wallet is hidden. Choose Show normally to use Pending,
														Transfer, and History.
													</p>
												) : (
													<>
														<div data-institutional-aa-no-select>
															<InstitutionalAaAssetsRow aaAccount={w.aaAccount} />
														</div>
														<InstitutionalSigsCapsule
															threshold={w.policy.threshold}
															managerCount={w.policy.managers.length}
															onAdd={() => openSigsDrawer(w.aaAccount, 'add', w.policy)}
															onReduce={() =>
																openSigsDrawer(w.aaAccount, 'remove', w.policy)
															}
														/>
													</>
												)}
											</div>
										</li>
									)
								})}
							</ul>
						</div>
					)}

					{showInstitutionalCreateForm ? (
						<>
							{createInstitutionalError ? (
								<div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p className="min-w-0 break-words">{createInstitutionalError}</p>
								</div>
							) : null}

							<label
								htmlFor="institutional-aa-beamio-tag"
								className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400"
							>
								BeamioTag for new wallet
							</label>
							<div className="relative mt-1">
								<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
									@
								</span>
								<input
									id="institutional-aa-beamio-tag"
									type="text"
									value={newInstitutionalTag.replace(/^@+/, '')}
									onChange={(e) => {
										setNewInstitutionalTag(e.target.value.replace(/^@+/, ''))
										if (createInstitutionalError) setCreateInstitutionalError(null)
									}}
									placeholder="treasury_ops"
									autoComplete="off"
									autoCapitalize="off"
									spellCheck={false}
									enterKeyHint="done"
									disabled={creatingInstitutionalAa}
									className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-sm text-slate-900 outline-none focus:border-[#8d3a8b] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
								/>
							</div>
							<p className="mt-1 text-[11px] text-slate-500">
								3–26 characters (letters, numbers, _ or .). Others can search this tag to get the
								wallet address.
							</p>

							<button
								type="button"
								onClick={() => void handleCreateInstitutionalAa()}
								disabled={creatingInstitutionalAa || !eoa}
								aria-busy={creatingInstitutionalAa}
								aria-label="New institutional-grade smart wallet"
								className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
								style={{ backgroundColor: aaAccent.accent }}
							>
								{creatingInstitutionalAa ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : (
									<Plus className="h-4 w-4" aria-hidden />
								)}
								{creatingInstitutionalAa
									? 'Creating…'
									: 'New institutional-grade smart wallet'}
							</button>
						</>
					) : null}
				</section>

				{selectedManagedAaOperable ? (
				<>
				<div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm dark:bg-slate-900">
					{(
						[
							['pending', Check],
							['transfer', Send],
							['history', History],
						] as const
					).map(([id, Icon]) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={`flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-xs font-semibold capitalize ${
								tab === id ? 'text-white' : 'text-slate-600'
							}`}
							style={tab === id ? { backgroundColor: aaAccent.accent } : undefined}
						>
							<Icon className="h-3.5 w-3.5" />
							{id}
						</button>
					))}
				</div>

				{tab === 'pending' ? (
					<div className="space-y-3">
						{readyTasks.length > 0 ? (
							<>
								<p className="text-xs font-semibold uppercase text-slate-500">Ready to submit</p>
								{readyTasks.map((t) => renderTaskRow(t, 'ready'))}
							</>
						) : null}
						{pendingNeedsSign.length > 0 ? (
							<>
								<p className="text-xs font-semibold uppercase text-slate-500">Needs your signature</p>
								{pendingNeedsSign.map((t) => renderTaskRow(t, 'pending'))}
							</>
						) : null}
						{pendingWaiting.length > 0 ? (
							<>
								<p className="text-xs font-semibold uppercase text-slate-500">Waiting for co-signers</p>
								{pendingWaiting.map((t) => renderTaskRow(t, 'pending'))}
							</>
						) : null}
						<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Offline sync</p>
								{outboundNewestFirst.length > 0 ? (
									<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
										{outboundNewestFirst.length} queued
									</span>
								) : null}
							</div>
							<p className="mt-1 text-xs text-slate-500">
								Automatic CoNET chat sync retries in the background. Copy a packet only when a
								co-signer cannot receive chat. Items clear once sent, merged locally, or the task
								ends.
							</p>
							{outboundNewestFirst.length > 0 ? (
								<ul
									ref={outboundListRef}
									onScroll={handleOutboundListScroll}
									className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto overscroll-contain"
								>
									{visibleOutboundItems.map((item) => (
										<li
											key={item.id}
											className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/25"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
															{item.actionLabel}
														</span>
														<p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
															{item.title}
														</p>
													</div>
													<p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<button
														type="button"
														onClick={() => void copyQueuedPacket(item)}
														className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
														style={{ color: aaAccent.accent }}
													>
														<Copy className="h-3.5 w-3.5" aria-hidden />
														Copy
													</button>
													<button
														type="button"
														onClick={() => dismissQueuedPacket(item)}
														className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
														aria-label="Dismiss queued packet"
													>
														<X className="h-3.5 w-3.5" aria-hidden />
														Dismiss
													</button>
												</div>
											</div>
										</li>
									))}
									{hasMoreOutbound ? (
										<li ref={outboundLoadMoreRef} className="h-px list-none" aria-hidden />
									) : null}
								</ul>
							) : null}
							{outboundNewestFirst.length > OFFLINE_SYNC_PAGE_SIZE ? (
								<p className="mt-2 text-center text-[11px] text-slate-500">
									{hasMoreOutbound
										? `Showing ${visibleOutboundItems.length} of ${outboundNewestFirst.length} · scroll for older`
										: `Showing all ${outboundNewestFirst.length} queued`}
								</p>
							) : null}
							{hasMoreOutbound ? (
								<button
									type="button"
									onClick={() => {
										outboundListScrolledRef.current = true
										loadMoreOutboundItems()
									}}
									className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
									style={{ color: aaAccent.accent }}
								>
									Show {Math.min(
										OFFLINE_SYNC_PAGE_SIZE,
										outboundNewestFirst.length - visibleOutboundItems.length
									)}{' '}
									older
								</button>
							) : null}
							<button
								type="button"
								onClick={() => setShowImportPanel((v) => !v)}
								className="mt-3 text-xs font-semibold underline"
								style={{ color: aaAccent.accent }}
							>
								{showImportPanel ? 'Hide import' : 'Import offline packet'}
							</button>
							{showImportPanel ? (
								<>
									<textarea
										value={importPayload}
										onChange={(e) => setImportPayload(e.target.value)}
										placeholder='Paste propose or sign JSON…'
										rows={5}
										className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
									/>
									<button
										type="button"
										onClick={() => void importOfflinePacket()}
										className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-white"
										style={{ backgroundColor: aaAccent.accent }}
									>
										Import
									</button>
								</>
							) : null}
						</div>
						{pendingNeedsSign.length === 0 && pendingWaiting.length === 0 && readyTasks.length === 0 ? (
							<p className="text-center text-sm text-slate-500">No active multisig tasks.</p>
						) : null}
					</div>
				) : null}

				{tab === 'transfer' ? (
					<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
						<p className="text-sm font-semibold">New transfer</p>
						{transferAssetOptions.length === 0 && transferAaAccount ? (
							<p className="mt-1 text-xs text-slate-500">
								Currently supports CoNET L1 and Base L2.
							</p>
						) : null}
						{transferAaAccount ? (
							<p className="mt-2 text-xs text-slate-500">
								From selected institutional Smart Wallet
							</p>
						) : null}
						{transferAaAccount ? (
							<div className="mt-2">
								<AaAccountAddressCapsule address={transferAaAccount} />
							</div>
						) : null}
						{transferAaAccount ? (
							transferAssetOptions.length === 0 ? (
							<p className="mt-4 text-sm text-slate-500">
								No transferable assets in this Smart Wallet.
							</p>
						) : (
							<>
								<label className="mt-3 block text-xs font-medium text-slate-600">Asset</label>
								<select
									value={transferAssetId}
									onChange={(e) => setTransferAssetId(e.target.value as AaMultisigTransferAssetId)}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
								>
									{transferAssetOptions.map((opt) => (
										<option key={opt.id} value={opt.id}>
											{opt.chain === 'base' ? `[Base] ` : ''}
											{opt.label} — {opt.balanceDisplay} available
										</option>
									))}
								</select>
								<label className="mt-3 block text-xs font-medium text-slate-600">Recipient EOA</label>
								<input
									value={transferTo}
									onChange={(e) => setTransferTo(e.target.value)}
									placeholder="0x…"
									className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800"
								/>
								<label className="mt-3 block text-xs font-medium text-slate-600">
									Amount
									{selectedTransferAsset ? ` (${selectedTransferAsset.label})` : ''}
								</label>
								<div className="relative mt-1">
									<input
										type="number"
										min={0}
										step={
											selectedTransferAsset?.decimals === 6
												? '0.000001'
												: selectedTransferAsset?.decimals === 9
													? '0.000000001'
													: '0.000000000000000001'
										}
										inputMode="decimal"
										autoComplete="off"
										value={transferAmount}
										onChange={(e) => setTransferAmount(e.target.value)}
										className="w-full rounded-xl border border-slate-200 py-2 pl-3 pr-14 text-sm dark:border-slate-600 dark:bg-slate-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
									/>
									<button
										type="button"
										onClick={applyTransferAmountMax}
										disabled={!selectedTransferAsset || selectedTransferAsset.balanceRaw <= 0n}
										className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-sky-700 transition active:scale-95 disabled:opacity-40 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-900/40 hover:bg-sky-200/80 dark:hover:bg-sky-900/60 disabled:active:scale-100"
									>
										Max
									</button>
								</div>
								{selectedTransferAsset ? (
									<p className="mt-1 text-xs text-slate-400">
										Available: {selectedTransferAsset.balanceDisplay} {selectedTransferAsset.label}
									</p>
								) : null}
								{transferCreateError ? (
									<p
										className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
										role="alert"
									>
										{transferCreateError}
									</p>
								) : null}
								<button
									type="button"
									disabled={busy === 'transfer' || !selectedTransferAsset}
									onClick={() => void proposeTransfer()}
									className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
									style={{ backgroundColor: aaAccent.accent }}
								>
									{busy === 'transfer' ? 'Creating…' : 'Create multisig task'}
								</button>
							</>
						)
						) : null}
					</div>
				) : null}

				{tab === 'history' ? (
					<div className="space-y-3">
						{history.length === 0 ? (
							<p className="text-center text-sm text-slate-500">No history yet.</p>
						) : (
							history.map((t) => renderTaskRow(t, 'history'))
						)}
					</div>
				) : null}
				</>
				) : (
					<p className="mb-4 text-center text-sm text-slate-500">
						Select a visible institutional Smart Wallet above to manage pending approvals,
						transfers, and history. Hidden wallets stay collapsed until you choose Show
						normally.
					</p>
				)}
				</div>
			</div>
		</div>
		{sigsDrawerMode
			? createPortal(
					<div
						className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/45"
						role="dialog"
						aria-modal="true"
						aria-label={
							sigsDrawerMode === 'add'
								? 'Add signing wallet'
								: 'Reduce signing wallet or adjust multisig rule'
						}
					>
						<button
							type="button"
							className="absolute inset-0 cursor-default"
							aria-label="Close"
							onClick={closeSigsDrawer}
						/>
						<div
							className="relative z-10 flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl animate-slide-up dark:bg-slate-950"
							style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-start justify-between gap-3 px-5 pt-5">
								<div className="min-w-0">
									<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
										{sigsDrawerMode === 'add'
											? 'Add signing wallet'
											: 'Reduce signers / adjust rule'}
									</h2>
									<p className="mt-1 text-xs text-slate-500">
										{sigsDrawerMode === 'add'
											? 'Search a @BeamioTag and propose a new M-of-N policy. All signers are notified via CoNET chat.'
											: 'Remove a co-signer (owner cannot be removed) and set the required signatures for the remaining set.'}
									</p>
								</div>
								<button
									type="button"
									onClick={closeSigsDrawer}
									className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
									aria-label="Close panel"
								>
									<X className="h-5 w-5" aria-hidden />
								</button>
							</div>

							<div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 pb-2">
								{policyLoading && !drawerPolicy ? (
									<p className="flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Loading policy…
									</p>
								) : !drawerPolicy ? (
									<p className="text-sm text-slate-500">Smart Wallet policy unavailable.</p>
								) : sigsDrawerMode === 'add' ? (
									<div className="space-y-3">
										<p className="text-xs text-slate-500">
											Current: {drawerPolicy.threshold}/{drawerPolicy.managers.length} required
										</p>
										{selectedCosigner ? (
											<div className="rounded-2xl border border-[#eadcf7] bg-[#f5ecff] p-3 dark:border-slate-600 dark:bg-slate-800/80">
												<div className="flex items-start justify-between gap-3">
													<div className="flex min-w-0 flex-1 items-center gap-2.5">
														<IpfsImg
															src={
																selectedCosigner.image?.trim() ||
																beamioSearchAvatarUrl(
																	selectedCosigner.username || selectedCosigner.address
																)
															}
															alt=""
															className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
														/>
														<div className="min-w-0 flex-1 leading-tight">
															<p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
																{beamioSearchDisplayName(selectedCosigner)}
															</p>
															<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
																@{selectedCosigner.username} ·{' '}
																{beamioSearchShortAddress(selectedCosigner.address)}
															</p>
														</div>
													</div>
													<button
														type="button"
														className="rounded-full p-2 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-700"
														onClick={() => {
															setSelectedCosigner(null)
															setSigsDrawerError(null)
														}}
														aria-label="Clear selected co-signer"
													>
														<X className="h-4 w-4" aria-hidden />
													</button>
												</div>
											</div>
										) : (
											<div className="relative">
												<div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm ring-1 ring-transparent focus-within:ring-slate-300 dark:border-slate-600 dark:bg-slate-800">
													<Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
													<input
														value={newSignerTag}
														onChange={(e) => setNewSignerTag(e.currentTarget.value)}
														onFocus={() => {
															if (
																canSearchCosigner &&
																(cosignerSearchResults.length > 0 || cosignerSearchLoading)
															) {
																setShowCosignerDropdown(true)
															}
														}}
														placeholder="Search @BeamioTag or wallet address"
														autoComplete="off"
														inputMode="search"
														className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
													/>
													{cosignerSearchLoading ? (
														<Loader2
															className="h-4 w-4 shrink-0 animate-spin text-slate-400"
															aria-hidden
														/>
													) : null}
												</div>
												{showCosignerDropdown && canSearchCosigner ? (
													<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
														<div className="max-h-60 overflow-y-auto py-1">
															{!cosignerSearchLoading &&
																cosignerSearchResults.map((item) => (
																	<BeamioSearchResultRow
																		key={item.address}
																		item={item}
																		query={normalizedCosignerQuery}
																		onSelect={(row) => void handleSelectCosigner(row)}
																	/>
																))}
															{!cosignerSearchLoading && cosignerSearchResults.length === 0 ? (
																<div className="px-3 py-2.5 text-xs text-slate-400">
																	No results
																</div>
															) : null}
														</div>
													</div>
												) : null}
											</div>
										)}
										{selectedCosigner ? (
											<ThresholdRatioPicker
												signerCount={drawerAddSignerCount}
												value={Math.min(drawerThreshold, Math.max(1, drawerAddSignerCount))}
												onChange={setDrawerThreshold}
												accentColor={aaAccent.accent}
												hint={`After adding this co-signer, ${drawerAddSignerCount} signers total. Pick a new M-of-N.`}
											/>
										) : (
											<p className="text-xs text-slate-500">
												Select a co-signer above to continue.
											</p>
										)}
									</div>
								) : (
									<div className="space-y-3">
										<p className="text-xs text-slate-500">
											Current: {drawerPolicy.threshold}/{drawerPolicy.managers.length} required.
											Owner cannot be removed.
										</p>
										{drawerRemovableManagers.length === 0 ? (
											<p className="text-sm text-slate-500">
												No removable co-signers. Only the owner remains on this Smart Wallet.
											</p>
										) : (
											<ul className="space-y-2">
												{drawerRemovableManagers.map((manager) => {
													const tag = resolveTag(manager)
													const capsule = toCapsuleItem(manager)
													const record = lookupByAddress(manager)
													const imgSrc =
														record?.image?.trim() ||
														capsule?.image?.trim() ||
														avatarImgUrl(record?.accountName ?? tag, manager)
													const displayName = signerDisplayName(capsule, tag)
													const tagLine = tag
														? tag.startsWith('@')
															? tag
															: `@${tag}`
														: '@Beamio'
													const selected =
														drawerRemoveTargetEoa != null &&
														drawerRemoveTargetEoa.toLowerCase() === manager.toLowerCase()
													return (
														<li key={manager}>
															<button
																type="button"
																onClick={() => setDrawerRemoveTargetEoa(manager)}
																aria-pressed={selected}
																className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
																	selected
																		? 'border-[#8d3a8b] bg-[#f5ecff] ring-2 ring-[#8d3a8b]/20 dark:border-[#8d3a8b]/60 dark:bg-slate-800/80'
																		: 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40'
																}`}
															>
																<img
																	src={imgSrc}
																	alt=""
																	className="h-10 w-10 shrink-0 rounded-full object-cover bg-white"
																/>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-semibold text-[#424655] dark:text-slate-100">
																		{displayName || tagLine}
																	</p>
																	{displayName ? (
																		<p className="truncate text-xs text-slate-600 dark:text-slate-400">
																			{tagLine}
																		</p>
																	) : null}
																	<p className="mt-0.5 font-mono text-[11px] text-slate-500">
																		{shortAddr(manager)}
																	</p>
																</div>
															</button>
														</li>
													)
												})}
											</ul>
										)}
										{drawerRemoveTargetEoa ? (
											<ThresholdRatioPicker
												signerCount={drawerRemoveSignerCount}
												value={Math.min(
													drawerThreshold,
													Math.max(1, drawerRemoveSignerCount)
												)}
												onChange={setDrawerThreshold}
												accentColor={aaAccent.accent}
												hint={`After removal, ${drawerRemoveSignerCount} signers remain. Pick the new M-of-N.`}
											/>
										) : drawerRemovableManagers.length > 0 ? (
											<p className="text-xs text-slate-500">
												Select a co-signer to remove, then set the required signatures.
											</p>
										) : null}
									</div>
								)}
							</div>

							<div className="border-t border-slate-100 px-5 pt-3 dark:border-slate-800">
								{sigsDrawerMode === 'add' && sigsDrawerError ? (
									<p
										className="mb-3 whitespace-pre-wrap break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
										role="alert"
									>
										{sigsDrawerError}
									</p>
								) : null}
								{sigsDrawerMode === 'add' ? (
									<button
										type="button"
										disabled={!selectedCosigner || busy === 'policy' || policyLoading}
										onClick={() => void proposeAddSignerFromDrawer()}
										className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										style={{ backgroundColor: aaAccent.accent }}
									>
										{busy === 'policy' ? 'Proposing…' : 'Propose add signer'}
									</button>
								) : (
									<button
										type="button"
										disabled={
											!drawerRemoveTargetEoa || busy === 'policy' || policyLoading
										}
										onClick={() => void proposeRemoveSignerFromDrawer()}
										className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
										style={{ backgroundColor: aaAccent.accent }}
									>
										{busy === 'policy' ? 'Proposing…' : 'Propose remove / adjust rule'}
									</button>
								)}
							</div>
						</div>
						<style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1); }`}</style>
					</div>,
					document.body
				)
			: null}
		</>
	)
}
