import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
	Hexagon,
	Loader2,
	Users,
	Send,
	History,
	AlertTriangle,
	Check,
	Copy,
	Search,
	X,
	ChevronLeft,
	Wallet,
	Plus,
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
} from '@/components/Home/beamioSearchResultPresentation'
import { IpfsImg } from '@/components/IpfsImg'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { tu } from '@/locale/beamioLocale'
import { CAPSULE_BTN_CLASS } from '@/utils/uiCommon'
import { beamioWalletAccent } from '@/utils/beamioWalletAccent'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'
import { searchUsername } from '@/services/beamio'
import { conetDepinProvider } from '@/utils/constants'
import {
	AA_MULTISIG_TASKS_CHANGED_EVENT,
	loadAllAaMultisigTasksForWallet,
	filterPendingAaMultisigTasksForSigner,
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
	multisigTaskStatusChipLabel,
	AA_MULTISIG_BLOCK_NEW_TRANSFER_TOAST,
	formatBeamioTagDisplayLine,
	hasActiveMultisigTasksForAa,
	resolveAaMultisigPolicyOwnerEoa,
	resolveAaMultisigTaskOwnerEoa,
	resolveMultisigTaskRowMode,
} from '@/utils/aaMultisigTaskUi'
import {
	concatMultisigSignatures,
	isSoleSelfSignerMultisig,
	mergeInboundMultisigInner,
	sortManagersStrict,
	type AaMultisigTaskLocal,
	type AaMultisigTransferAssetId,
} from '@/utils/aaMultisigProtocol'
import {
	buildProposeInner,
	buildRejectInner,
	buildSignInner,
	buildSubmittedInner,
} from '@/services/aaMultisigGossip'
import {
	assertAaMultisigTaskEntryPointNonceFresh,
	markAaMultisigTaskExpiredIfNonceStale,
	readAaEntryPointNonce,
} from '@/utils/aaMultisigEntryPointNonce'
import {
	AA_MULTISIG_PENDING_NONCE_RECONCILE_MS,
	prepareAaMultisigNewTaskNonce,
	reconcileAaMultisigPendingNoncesForWallet,
} from '@/utils/aaMultisigPendingNonceReconcile'
import {
	discoverInstitutionalManageableWallets,
	type AaMultisigTransferEligibleWallet,
	type InstitutionalManageableWallet,
} from '@/utils/aaMultisigTransferEligible'
import { createInstitutionalAa } from '@/utils/institutionalAaAccounts'
import {
	buildUnsignedAaMultisigUserOp,
	encodeAAExecuteConetAssetTransfer,
	encodeAAExecuteSetThresholdPolicy,
	isSetPolicyCallDataSelfExecuteWrapped,
	readAaThresholdPolicy,
	signAaUserOpHash,
	submitAaMultisigUserOp,
	orderAaCosignersWithOwnerFirst,
	resolveEffectiveAaOwner,
	aaMultisigProvider,
} from '@/utils/aaMultisigUserOp'
import {
	fetchAaMultisigTransferAssetOptions,
	buildTransferTaskTitle,
	formatTransferTaskSummary,
	parseTransferAmountToRaw,
	relayAmountUsdc6ForTransferAsset,
	userOpProviderForTransferAsset,
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

type TabId = 'signers' | 'pending' | 'transfer' | 'history'

const aaAccent = beamioWalletAccent('aa')

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

function AaAccountAddressCapsule({ address }: { address: string }) {
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
			className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#eadcf7] bg-[#f5ecff] py-1.5 pl-2 pr-2.5 font-mono text-[11px] font-medium text-[#424655] transition-colors hover:border-[#8d3a8b]/30 hover:bg-[#8d3a8b]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
			title="Copy Smart Wallet address"
			aria-label={`Copy Smart Wallet address ${short}`}
		>
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

type BeamioTagCapsuleLookupProps = {
	ownerEoa: string | null
	resolveTag: (address: string) => string
	lookupByAddress: (address: string) => { image?: string; accountName?: string } | undefined
	toCapsuleItem: (address: string) => {
		first_name?: string
		last_name?: string
		username?: string
		image?: string
	} | null
	avatarImgUrl: (preferred: string | undefined, address?: string) => string
}

/** Smart Wallet owner EOA — Beamio capsule (avatar + name + @tag), EOA blue chrome. */
function SmartWalletOwnerBeamioCapsule({
	ownerEoa,
	resolveTag,
	lookupByAddress,
	toCapsuleItem,
	avatarImgUrl,
}: BeamioTagCapsuleLookupProps) {
	if (!ownerEoa || !ethers.isAddress(ownerEoa)) {
		return (
			<div className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-[#dce2f7] bg-[#e9edff] py-1.5 pl-1.5 pr-3 dark:border-slate-600 dark:bg-slate-800/80">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-700">
					<Wallet className="h-4 w-4 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
				</div>
				<span className="truncate text-[13px] font-semibold text-[#424655] dark:text-slate-200">
					@Beamio
				</span>
			</div>
		)
	}

	const record = lookupByAddress(ownerEoa)
	const capsule = toCapsuleItem(ownerEoa)
	const tagRaw = resolveTag(ownerEoa)
	const tagLine = formatBeamioTagDisplayLine(tagRaw)
	const displayName = signerDisplayName(capsule, tagRaw)
	const imgSrc =
		record?.image?.trim() ||
		capsule?.image?.trim() ||
		avatarImgUrl(record?.accountName ?? tagRaw, ownerEoa)

	return (
		<div className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-[#dce2f7] bg-[#e9edff] py-1.5 pl-1.5 pr-3 dark:border-slate-600 dark:bg-slate-800/80">
			<img
				src={imgSrc}
				alt=""
				className="h-8 w-8 shrink-0 rounded-full border border-white/80 object-cover bg-white dark:border-slate-600"
			/>
			<div className="min-w-0">
				{displayName ? (
					<p className="truncate text-[13px] font-semibold leading-tight text-[#424655] dark:text-slate-100">
						{displayName}
					</p>
				) : null}
				<p
					className={`truncate text-[12px] font-bold leading-tight text-[#424655] dark:text-slate-200 ${
						displayName ? '' : 'text-[13px]'
					}`}
				>
					{tagLine}
				</p>
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

const OFFLINE_SYNC_PAGE_SIZE = 10

export default function AaMultisigPage() {
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()
	const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
	const { profiles, setShowFooter, allNodes } = useDaemonContext()
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
	const [proposedRequiredSigs, setProposedRequiredSigs] = useState(1)
	const cosignerSearchRequestId = useRef(0)
	const [transferTo, setTransferTo] = useState('')
	const [transferAmount, setTransferAmount] = useState('')
	const [transferAssetId, setTransferAssetId] = useState<AaMultisigTransferAssetId | ''>('')
	const [transferAssetOptions, setTransferAssetOptions] = useState<AaMultisigTransferAssetOption[]>(
		[]
	)
	const [transferAssetsLoading, setTransferAssetsLoading] = useState(false)
	const [transferAaAccount, setTransferAaAccount] = useState('')
	const [transferPolicy, setTransferPolicy] = useState<{
		owner: string
		managers: string[]
		threshold: number
	} | null>(null)
	const [institutionalWallets, setInstitutionalWallets] = useState<InstitutionalManageableWallet[]>(
		[]
	)
	const [selectedManagedAa, setSelectedManagedAa] = useState('')
	const [institutionalListLoading, setInstitutionalListLoading] = useState(false)
	const [creatingInstitutionalAa, setCreatingInstitutionalAa] = useState(false)
	const [createInstitutionalError, setCreateInstitutionalError] = useState<string | null>(null)
	const createInstitutionalInFlightRef = useRef(false)
	/** Derived for existing tab logic (Signers / Transfer / History). */
	const transferEligibleWallets = useMemo(
		() => institutionalWallets.map(institutionalToEligibleWallet),
		[institutionalWallets]
	)
	const transferEligibleLoading = institutionalListLoading
	/** Persists until the next Create multisig task press (Toast alone disappears too fast). */
	const [transferCreateError, setTransferCreateError] = useState<string | null>(null)
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
			const lower = normalizedCosignerQuery.toLowerCase()
			const data = await searchUsername(lower)
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
			setCosignerSearchResults(filtered)
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

	const reloadTransferAssets = useCallback(async () => {
		if (!transferAaAccount) {
			setTransferAssetOptions([])
			setTransferAssetId('')
			return
		}
		setTransferAssetsLoading(true)
		try {
			const options = await fetchAaMultisigTransferAssetOptions(transferAaAccount, {
				previousBase: transferAssetOptions.filter((o) => o.chain === 'base'),
			})
			setTransferAssetOptions(options)
			setTransferAssetId((prev) => {
				if (prev && options.some((o) => o.id === prev)) return prev
				return options[0]?.id ?? ''
			})
		} catch {
			// untrusted — keep previous options
		} finally {
			setTransferAssetsLoading(false)
		}
	}, [transferAaAccount])

	const refreshInstitutionalWallets = useCallback(async () => {
		if (!eoa) {
			setInstitutionalWallets([])
			setSelectedManagedAa('')
			setTransferAaAccount('')
			setTransferPolicy(null)
			setSignersAaAccount('')
			return
		}
		setInstitutionalListLoading(true)
		try {
			const wallets = await discoverInstitutionalManageableWallets(aaMultisigProvider, eoa, {
				primaryAaAccount: aaAccount,
				tasks,
				fallbackEoa: eoa,
			})
			setInstitutionalWallets(wallets)
			setSelectedManagedAa((prev) => {
				const persisted = prev || loadPersistedInstitutionalSelectedAa(eoa)
				if (
					persisted &&
					wallets.some((w) => w.aaAccount.toLowerCase() === persisted.toLowerCase())
				) {
					return ethers.getAddress(persisted)
				}
				// Do not auto-select — tabs stay hidden until the user picks an item.
				return ''
			})
		} catch {
			// untrusted — keep previous list
		} finally {
			setInstitutionalListLoading(false)
		}
	}, [eoa, aaAccount, tasks])

	const selectManagedAa = useCallback(
		(aa: string) => {
			if (!aa || !ethers.isAddress(aa)) {
				setSelectedManagedAa('')
				if (eoa) persistInstitutionalSelectedAa(eoa, '')
				return
			}
			const checksum = ethers.getAddress(aa)
			setSelectedManagedAa(checksum)
			if (eoa) persistInstitutionalSelectedAa(eoa, checksum)
		},
		[eoa]
	)

	const handleCreateInstitutionalAa = useCallback(async () => {
		if (!eoa || createInstitutionalInFlightRef.current) return
		createInstitutionalInFlightRef.current = true
		setCreatingInstitutionalAa(true)
		setCreateInstitutionalError(null)
		try {
			const result = await createInstitutionalAa(eoa)
			if (!result.success) {
				setCreateInstitutionalError(result.error)
				return
			}
			await refreshInstitutionalWallets()
			selectManagedAa(result.aa)
			setTab('signers')
		} finally {
			createInstitutionalInFlightRef.current = false
			setCreatingInstitutionalAa(false)
		}
	}, [eoa, refreshInstitutionalWallets, selectManagedAa])

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

	const transferAaHasActiveTasks = useMemo(
		() => (transferAaAccount ? hasActiveMultisigTasksForAa(tasks, transferAaAccount) : false),
		[tasks, transferAaAccount]
	)
	/** While Create is in-flight the draft may already be `ready` in local store — do not treat that as a block. */
	const transferCreateBlockedByActive =
		transferAaHasActiveTasks && busy !== 'transfer'

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
		if (tabParam === 'signers' || tabParam === 'pending' || tabParam === 'transfer' || tabParam === 'history') {
			setTab(tabParam)
		} else if (taskId) {
			setTab('pending')
		}
		if (taskId) setFocusTaskId(taskId)
	}, [searchParams])

	useEffect(() => {
		if (!focusTaskId || tab !== 'pending') return
		const el = document.getElementById(`aa-multisig-task-${focusTaskId}`)
		if (!el) return
		el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		const clear = window.setTimeout(() => {
			setFocusTaskId(null)
			setSearchParams({}, { replace: true })
		}, 2400)
		return () => window.clearTimeout(clear)
	}, [focusTaskId, tab, tasks, setSearchParams])

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

	const selectedSignersWallet = useMemo(
		() =>
			transferEligibleWallets.find(
				(w) => w.aaAccount.toLowerCase() === signersAaAccount.toLowerCase()
			) ?? null,
		[transferEligibleWallets, signersAaAccount]
	)

	const selectedSignersOwnerEoa = useMemo(
		() =>
			selectedSignersWallet
				? resolveAaMultisigPolicyOwnerEoa(selectedSignersWallet.policy.managers)
				: null,
		[selectedSignersWallet]
	)

	useEffect(() => {
		if (!selectedSignersOwnerEoa) return
		void ensureProfilesForAddresses([selectedSignersOwnerEoa])
	}, [selectedSignersOwnerEoa, ensureProfilesForAddresses])

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
	const history = useMemo(
		() => (eoa ? filterHistoryMultisigForManager(tasks, eoa) : []),
		[tasks, eoa]
	)

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

	const previewRequiredSignatures = useMemo(() => {
		if (!policy) return null
		return autoRequiredSignaturesAfterAddCosigner(
			policy.threshold,
			policy.managers.length,
			policy.managers.length + 1
		)
	}, [policy])

	const proposedSignerCount = useMemo(() => {
		if (!policy) return 0
		return selectedCosigner ? policy.managers.length + 1 : policy.managers.length
	}, [policy, selectedCosigner])

	const canSubmitPolicyProposal = useMemo(() => {
		if (!policy) return false
		if (selectedCosigner) return true
		return proposedRequiredSigs !== policy.threshold
	}, [policy, selectedCosigner, proposedRequiredSigs])

	useEffect(() => {
		if (!policy) return
		if (selectedCosigner && previewRequiredSignatures != null) {
			setProposedRequiredSigs(previewRequiredSignatures)
			return
		}
		setProposedRequiredSigs(policy.threshold)
	}, [selectedCosigner, policy?.threshold, policy?.managers.length, previewRequiredSignatures])

	const displayCosigners = useMemo(() => {
		if (policy) {
			const effectiveOwner = resolveEffectiveAaOwner(policy, eoa)
			if (!effectiveOwner) return policy.managers.filter((m) => m && m !== ethers.ZeroAddress)
			return orderAaCosignersWithOwnerFirst(effectiveOwner, policy.managers)
		}
		if (eoa && ethers.isAddress(eoa)) return [ethers.getAddress(eoa)]
		return []
	}, [policy, eoa])

	const cosignersFromChainFallback = !policy && displayCosigners.length > 0

	const viewerIsPolicyManager = useMemo(() => {
		if (!eoa || !policy?.managers?.length) return false
		return policy.managers.some((m) => m.toLowerCase() === eoa.toLowerCase())
	}, [policy, eoa])

	const canProposeSignerChanges = viewerIsPolicyManager || cosignersFromChainFallback

	const effectiveOwner = useMemo(
		() => resolveEffectiveAaOwner(policy, eoa),
		[policy, eoa]
	)

	const viewerIsOwnerOnSelectedSignersWallet = useMemo(() => {
		if (!eoa || !effectiveOwner) return false
		return effectiveOwner.toLowerCase() === eoa.toLowerCase()
	}, [eoa, effectiveOwner])

	useEffect(() => {
		if (!displayCosigners.length) return
		void ensureProfilesForAddresses(displayCosigners)
	}, [displayCosigners, ensureProfilesForAddresses])

	const requireWalletReady = (): boolean => {
		if (!eoa || !signersAaAccount) {
			Toast.show({
				content:
					transferEligibleLoading && transferEligibleWallets.length === 0
						? 'Loading Smart Wallets you can manage…'
						: 'Select a Smart Wallet on the Signers tab.',
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

	const sortedCurrentPolicyManagers = (): string[] => {
		if (!policy) return []
		const owner = resolveEffectiveAaOwner(policy, eoa) ?? policy.owner
		return sortManagersStrict(owner, policy.managers)
	}

	const proposeSetPolicyMultisigTask = async (opts: {
		newManagers: string[]
		newThreshold: number
		title: string
		busyKey: string
		gossipRecipients: string[]
		onAfterSuccess?: () => void
	}) => {
		if (!requireWalletReady() || !policy || !signersAaAccount) return
		if (opts.newThreshold < 1 || opts.newThreshold > opts.newManagers.length) {
			Toast.show({ content: 'Required signatures must be between 1 and the total signer count.' })
			return
		}
		setBusy(opts.busyKey)
		try {
			const { userOpNonce, expired, chainNonce } = await prepareAaMultisigNewTaskNonce(
				eoa,
				signersAaAccount,
				{ supersedeSameSlot: true }
			)
			setChainEntryPointNonce(String(chainNonce))
			for (const task of expired) {
				upsertAaMultisigTaskRecord(eoa, task)
			}
			if (expired.length > 0) reloadTasks()

			const callData = encodeAAExecuteSetThresholdPolicy(
				signersAaAccount,
				opts.newManagers,
				opts.newThreshold
			)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				aaMultisigProvider,
				signersAaAccount,
				callData,
				undefined,
				{ nonce: userOpNonce }
			)
			const creatorSignature = await signAaUserOpHash(privateKeyArmor, userOpHash)
			const taskId = crypto.randomUUID().toLowerCase()
			const now = Date.now()
			const inner = buildProposeInner({
				taskId,
				aaAccount: signersAaAccount,
				createdAt: now,
				kind: 'set_policy',
				creatorEoa: eoa,
				threshold: policy.threshold,
				managers: policy.managers,
				entryPointNonce: packedUserOp.nonce,
				userOpHash,
				packedUserOp,
				newManagers: opts.newManagers,
				newThreshold: opts.newThreshold,
				title: opts.title,
				creatorSignature,
			})
			const merged = mergeInboundMultisigInner(null, inner, eoa)
			if (merged) upsertAaMultisigTaskRecord(eoa, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: opts.gossipRecipients,
				inner,
				privateKeyArmor,
				allNodes: allNodes ?? [],
				excludeEoa: eoa,
			})
			refreshOutboundQueue()
			Toast.show({
				content:
					pub.mode === 'broadcast' && pub.sent > 0
						? `Policy update proposed (${pub.sent} peer${pub.sent > 1 ? 's' : ''} notified via CoNET chat).`
						: 'Proposed locally. Export or sync when CoNET chat is online.',
			})
			opts.onAfterSuccess?.()
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const handleSelectCosigner = async (item: searchResult) => {
		const signerEoa = await resolveCosignerEoaFromSearchRow(item)
		if (!signerEoa) {
			Toast.show({ content: 'Co-signer must be a Beamio EOA (not a contract).' })
			return
		}
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

	const proposePolicyUpdate = async () => {
		if (!requireWalletReady() || !policy) return
		try {
			const signerEoa = await resolveNewSignerEoa()
			if (!signerEoa) {
				Toast.show({ content: 'Search and select a @BeamioTag for the new signer.' })
				return
			}
			if (signerEoa.toLowerCase() === eoa.toLowerCase()) {
				Toast.show({ content: 'You cannot add yourself as a co-signer.' })
				return
			}
			if (policy.managers.some((m) => m.toLowerCase() === signerEoa.toLowerCase())) {
				Toast.show({ content: 'This address is already a co-signer.' })
				return
			}
			const managers = sortManagersStrict(resolveEffectiveAaOwner(policy, eoa) ?? policy.owner, [
				...policy.managers.filter((m) => m.toLowerCase() !== signerEoa.toLowerCase()),
				signerEoa,
			])
			await proposeSetPolicyMultisigTask({
				newManagers: managers,
				newThreshold: proposedRequiredSigs,
				title: 'Update multisig signers',
				busyKey: 'policy',
				gossipRecipients: managers,
				onAfterSuccess: () => {
					setNewSignerTag('')
					setSelectedCosigner(null)
				},
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		}
	}

	const proposeThresholdChange = async () => {
		if (!requireWalletReady() || !policy || !viewerIsPolicyManager) return
		const managers = sortedCurrentPolicyManagers()
		if (proposedRequiredSigs === policy.threshold) {
			Toast.show({ content: 'Select a different required signature count or add a co-signer.' })
			return
		}
		await proposeSetPolicyMultisigTask({
			newManagers: managers,
			newThreshold: proposedRequiredSigs,
			title: `Update required signatures (${proposedRequiredSigs}/${managers.length})`,
			busyKey: 'policy',
			gossipRecipients: managers,
		})
	}

	const proposePolicyChange = async () => {
		if (selectedCosigner) {
			await proposePolicyUpdate()
			return
		}
		await proposeThresholdChange()
	}

	const proposeTransfer = async () => {
		setTransferCreateError(null)
		if (!requireTransferWalletReady()) return
		if (!selectedTransferAsset || !transferAssetId) {
			setTransferCreateError('No transferable assets in this Smart Wallet.')
			return
		}
		if (hasActiveMultisigTasksForAa(tasks, transferAaAccount)) {
			setTransferCreateError(AA_MULTISIG_BLOCK_NEW_TRANSFER_TOAST)
			return
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
			const { chainNonce, userOpNonce, expired } = await prepareAaMultisigNewTaskNonce(
				eoa,
				transferAaAccount,
				{ supersedeSameSlot: false }
			)
			setChainEntryPointNonce(String(chainNonce))
			for (const task of expired) {
				upsertAaMultisigTaskRecord(eoa, task)
			}
			if (expired.length > 0) reloadTasks()

			const callData = encodeAAExecuteConetAssetTransfer({
				asset: transferAssetId,
				toEOA: to,
				amountRaw,
			})
			const opProvider = userOpProviderForTransferAsset(transferAssetId)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				opProvider,
				transferAaAccount,
				callData,
				undefined,
				{ nonce: userOpNonce }
			)
			const creatorSignature = await signAaUserOpHash(privateKeyArmor, userOpHash)
			const managers = transferPolicy?.managers?.length ? transferPolicy.managers : [eoa]
			const threshold = transferPolicy?.threshold ?? 1
			const taskId = crypto.randomUUID().toLowerCase()
			const now = Date.now()
			const amountRawStr = amountRaw.toString()
			const inner = buildProposeInner({
				taskId,
				aaAccount: transferAaAccount,
				createdAt: now,
				kind: 'transfer',
				creatorEoa: eoa,
				threshold,
				managers,
				entryPointNonce: packedUserOp.nonce,
				userOpHash,
				packedUserOp,
				toEoa: to,
				transferAsset: transferAssetId,
				amountRaw: amountRawStr,
				amountUsdc6:
					transferAssetId === 'usdc' || transferAssetId === 'base_usdc' ? amountRawStr : undefined,
				title: buildTransferTaskTitle(transferAssetId, amountRaw),
				creatorSignature,
			})
			const merged = mergeInboundMultisigInner(null, inner, eoa)
			const soleSignerReady =
				merged?.kind === 'transfer' &&
				merged.status === 'ready' &&
				isSoleSelfSignerMultisig(eoa, managers, threshold)

			// Claim auto-submit before upsert so the tasks useEffect cannot double-submit the same draft.
			const soleSubmitClaimedId =
				soleSignerReady && merged ? merged.taskId : null
			if (soleSubmitClaimedId) {
				autoSubmitInFlightRef.current.add(soleSubmitClaimedId)
			}
			try {
				if (merged) upsertAaMultisigTaskRecord(eoa, merged)
				const pub = await publishAaMultisigInnerWithOfflineFallback({
					walletEoa: eoa,
					recipients: managers,
					inner,
					privateKeyArmor,
					allNodes: allNodes ?? [],
					excludeEoa: eoa,
				})
				refreshOutboundQueue()

				if (soleSignerReady && merged) {
					// Quiet: keep Transfer chrome until we finish; parent owns busy='transfer'.
					const result = await submitTask(merged, { quiet: true, retainBusy: true })
					if (result.ok) {
						Toast.show({ content: 'Multisig transfer submitted.' })
						setTransferCreateError(null)
						setTransferTo('')
						setTransferAmount('')
						void reloadTransferAssets()
						setTab('history')
						return
					}
					setTransferCreateError(result.error?.trim() || 'Submit failed')
					reloadTasks()
					return
				}

				Toast.show({
					content:
						pub.mode === 'broadcast' && pub.sent > 0
							? 'Transfer task created and sent to co-signers via CoNET chat.'
							: 'Transfer task saved locally. Export or sync when CoNET chat is online.',
				})
				setTransferCreateError(null)
				setTransferTo('')
				setTransferAmount('')
				reloadTasks()
				setTab('pending')
			} finally {
				if (soleSubmitClaimedId) {
					autoSubmitInFlightRef.current.delete(soleSubmitClaimedId)
				}
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			setTransferCreateError(msg.trim() || 'Create multisig task failed.')
		} finally {
			setBusy(null)
		}
	}

	const signTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
		const nonceCheck = await assertAaMultisigTaskEntryPointNonceFresh(task.aaAccount, task)
		if (!nonceCheck.ok) {
			const expired = markAaMultisigTaskExpiredIfNonceStale(task, nonceCheck.chainNonce)
			if (expired) upsertAaMultisigTaskRecord(eoa, expired)
			reloadTasks()
			Toast.show({
				content: 'This signing request expired and was moved to History.',
			})
			return
		}
		setBusy(task.taskId)
		try {
			const signature = await signAaUserOpHash(privateKeyArmor, task.userOpHash)
			const now = Date.now()
			const inner = buildSignInner({
				taskId: task.taskId,
				aaAccount: task.aaAccount,
				createdAt: now,
				signerEoa: eoa,
				userOpHash: task.userOpHash,
				signature,
			})
			const merged = mergeInboundMultisigInner(task, inner, eoa)
			if (merged) upsertAaMultisigTaskRecord(eoa, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: task.managers,
				inner,
				privateKeyArmor,
				allNodes: allNodes ?? [],
				excludeEoa: eoa,
			})
			refreshOutboundQueue()

			if (merged?.status === 'ready') {
				autoSubmitInFlightRef.current.add(merged.taskId)
				const submitted = await submitTask(merged)
				autoSubmitInFlightRef.current.delete(merged.taskId)
				if (submitted.ok) return
			}

			if (pub.mode === 'broadcast' && pub.sent > 0) {
				Toast.show({ content: 'Signature recorded and shared with all co-signers via CoNET chat.' })
			} else if (pub.apiError) {
				Toast.show({
					content: `Signed locally. Offline submit needs 0.1 B-Unit: ${pub.apiError.slice(0, 80)}`,
				})
			} else {
				Toast.show({
					content: 'Signed offline. Copy export below or wait for chat sync.',
				})
			}
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const rejectTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
		setBusy(`reject-${task.taskId}`)
		try {
			const now = Date.now()
			const inner = buildRejectInner({
				taskId: task.taskId,
				aaAccount: task.aaAccount,
				createdAt: now,
				signerEoa: eoa,
				reason: 'Rejected by signer',
			})
			const merged = mergeInboundMultisigInner(task, inner, eoa)
			if (merged) upsertAaMultisigTaskRecord(eoa, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: task.managers,
				inner,
				privateKeyArmor,
				allNodes: allNodes ?? [],
				excludeEoa: eoa,
			})
			refreshOutboundQueue()
			Toast.show({
				content:
					pub.mode === 'broadcast' && pub.sent > 0
						? 'Task rejected. Co-signers notified; nonce stays free for new tasks.'
						: 'Rejected locally. Export or sync when CoNET chat is online.',
			})
			reloadTasks()
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
		if (task.signatures.length < task.threshold) {
			return fail('Not enough signatures yet.')
		}
		if (
			task.kind === 'set_policy' &&
			isSetPolicyCallDataSelfExecuteWrapped(task.aaAccount, task.packedUserOp.callData)
		) {
			return fail('Outdated policy UserOp encoding. Reject this task and propose again.')
		}
		// Already completed (e.g. raced auto-submit) — treat as success for the caller.
		const latest = loadAllAaMultisigTasksForWallet(eoa).find((t) => t.taskId === task.taskId)
		if (latest?.status === 'completed' || task.status === 'completed') {
			if (!opts?.quiet) {
				reloadTasks()
				setTab('history')
			}
			return { ok: true }
		}
		const nonceCheck = await assertAaMultisigTaskEntryPointNonceFresh(task.aaAccount, task)
		if (!nonceCheck.ok) {
			const expired = markAaMultisigTaskExpiredIfNonceStale(task, nonceCheck.chainNonce)
			if (expired) upsertAaMultisigTaskRecord(eoa, expired)
			reloadTasks()
			return fail('This signing request expired and was moved to History.')
		}
		if (!opts?.retainBusy) {
			setBusy(`submit-${task.taskId}`)
		}
		try {
			const combinedSig = concatMultisigSignatures(task.signatures)
			const packedUserOp = { ...task.packedUserOp, signature: combinedSig }
			let hash: string | undefined

			const discardFailedSubmit = (err: string): { ok: false; error: string } => {
				// Do not archive FAILED in History — user must re-propose with a fresh nonce.
				removeAaMultisigTaskRecord(eoa, task)
				reloadTasks()
				const hint =
					chainEntryPointNonce != null
						? ` Re-propose with EntryPoint nonce ${chainEntryPointNonce}.`
						: ' Re-propose with a fresh EntryPoint nonce.'
				const base = (err.trim() || 'Submit failed').replace(/\.\s*$/, '')
				return fail(`${base}.${hint}`)
			}

			if (
				task.kind === 'transfer' &&
				task.toEoa &&
				(task.amountRaw || task.amountUsdc6)
			) {
				const relayAmount = relayAmountUsdc6ForTransferAsset(
					task.transferAsset ?? 'usdc',
					BigInt(task.amountRaw ?? task.amountUsdc6 ?? '1')
				)
				const res = await submitAaMultisigUserOp({
					toEOA: task.toEoa,
					amountUSDC6: relayAmount,
					packedUserOp,
					transferAsset: task.transferAsset ?? 'usdc',
				})
				if (!res.success) {
					return discardFailedSubmit(res.error ?? 'Submit failed')
				}
				hash = res.hash
			} else if (task.kind === 'set_policy') {
				const res = await submitAaMultisigUserOp({
					toEOA: task.creatorEoa,
					amountUSDC6: '1',
					packedUserOp,
					transferAsset: 'cnet',
				})
				if (!res.success) {
					return discardFailedSubmit(res.error ?? 'Submit failed')
				}
				hash = res.hash
				void reloadPolicy()
			} else {
				return fail('Unsupported task kind for submit.')
			}
			const completed: AaMultisigTaskLocal = {
				...task,
				status: 'completed',
				txHash: hash,
				updatedAt: Date.now(),
			}
			upsertAaMultisigTaskRecord(eoa, completed)
			if (hash) {
				const inner = buildSubmittedInner({
					taskId: task.taskId,
					aaAccount: task.aaAccount,
					createdAt: Date.now(),
					submitterEoa: eoa,
					txHash: hash,
				})
				await publishAaMultisigInnerWithOfflineFallback({
					walletEoa: eoa,
					recipients: task.managers,
					inner,
					privateKeyArmor,
					allNodes: allNodes ?? [],
					excludeEoa: eoa,
				})
				refreshOutboundQueue()
			}
			if (!opts?.quiet) Toast.show({ content: 'Multisig transfer submitted.' })
			reloadTasks()
			// Parent Create flow navigates after clearing busy; avoid mid-flight tab steal.
			if (!opts?.quiet) setTab('history')
			return { ok: true }
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			return fail(msg.trim() || 'Submit failed')
		} finally {
			if (!opts?.retainBusy) {
				setBusy(null)
			}
		}
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
		const brokenSetPolicyEncoding =
			task.kind === 'set_policy' &&
			isSetPolicyCallDataSelfExecuteWrapped(task.aaAccount, task.packedUserOp.callData)
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
					{aaAccount && task.aaAccount.toLowerCase() !== aaAccount.toLowerCase() ? (
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
			{userIsCreator ? (
				<button
					type="button"
					onClick={() => void exportTaskProposalPacket(task)}
					className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
				>
					<Copy className="h-3.5 w-3.5" aria-hidden />
					Copy proposal packet
				</button>
			) : null}
			{userSigned ? (
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
			{effectiveMode === 'history' && task.txHash ? (
				<p className="mt-2 truncate text-xs text-slate-500">Tx {task.txHash}</p>
			) : null}
		</div>
		)
	}

	return (
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
					<h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
						Manage your institutional-grade smart wallets
					</h2>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
						Create and manage Smart Wallets beyond your personal Express Pay wallet. Select a wallet
						below to configure co-signers, pending approvals, transfers, and history.
					</p>

					{institutionalListLoading && institutionalWallets.length === 0 ? (
						<p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading institutional Smart Wallets…
						</p>
					) : institutionalWallets.length === 0 ? (
						<p className="mt-3 text-sm text-slate-500">
							No institutional Smart Wallets yet. Create one, or wait until you are added as a
							co-signer on another wallet.
						</p>
					) : (
						<ul className="mt-3 space-y-2" role="listbox" aria-label="Institutional Smart Wallets">
							{institutionalWallets.map((w) => {
								const selected =
									selectedManagedAa &&
									w.aaAccount.toLowerCase() === selectedManagedAa.toLowerCase()
								return (
									<li key={w.aaAccount}>
										<button
											type="button"
											role="option"
											aria-selected={!!selected}
											onClick={() => selectManagedAa(w.aaAccount)}
											className={`w-full rounded-2xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8d3a8b]/40 ${
												selected
													? 'border-[#8d3a8b] bg-[#f5ecff] ring-2 ring-[#8d3a8b]/20 dark:border-[#8d3a8b]/60 dark:bg-slate-800/80'
													: 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600'
											}`}
										>
											<div className="flex flex-wrap items-center gap-2">
												{w.kind === 'own_institutional' ? (
													<span className="shrink-0 rounded-full bg-[#8d3a8b]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8d3a8b]">
														Institutional #{w.index ?? '?'}
													</span>
												) : (
													<span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
														Co-managed
													</span>
												)}
												<span className="text-[10px] font-medium text-slate-500">
													{w.policy.threshold}/{w.policy.managers.length} sigs
												</span>
											</div>
											<div className="mt-2">
												<AaAccountAddressCapsule address={w.aaAccount} />
											</div>
										</button>
									</li>
								)
							})}
						</ul>
					)}

					{createInstitutionalError ? (
						<div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p className="min-w-0 break-words">{createInstitutionalError}</p>
						</div>
					) : null}

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
				</section>

				{selectedManagedAa ? (
				<>
				<div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm dark:bg-slate-900">
					{(
						[
							['signers', Users],
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

				{tab === 'signers' ? (
					<div className="space-y-4">
						{!canProposeSignerChanges && policy && !cosignersFromChainFallback ? (
									<div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
										<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
										You are not listed as a signer on the selected Smart Wallet policy.
									</div>
								) : null}

						<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Current co-signers</p>
							{selectedSignersWallet && signersAaAccount ? (
								<p className="mt-1 text-xs text-slate-500">
									For{' '}
									{selectedSignersWallet.isOwnAa
										? `institutional Smart Wallet #${
												institutionalWallets.find(
													(w) =>
														w.aaAccount.toLowerCase() === signersAaAccount.toLowerCase()
												)?.index ?? '?'
											}`
										: `co-managed Smart Wallet (${signersAaAccount.slice(0, 6)}…${signersAaAccount.slice(-4)})`}
									{policy && !cosignersFromChainFallback
										? ` · ${policy.threshold}/${policy.managers.length} required`
										: ''}
								</p>
							) : null}
							{policyLoading ? (
								<Loader2
									className="mt-3 h-5 w-5 animate-spin"
									style={{ color: aaAccent.accent }}
									aria-hidden
								/>
							) : displayCosigners.length > 0 ? (
								<>
									{cosignersFromChainFallback ? (
										<p className="mt-2 text-xs text-slate-500">
											On-chain policy unavailable; showing your wallet as the sole signer.
										</p>
									) : null}
									<ul className="mt-3 space-y-2">
									{displayCosigners.map((manager) => {
										const tag = resolveTag(manager)
										const capsule = toCapsuleItem(manager)
										const record = lookupByAddress(manager)
										const imgSrc =
											record?.image?.trim() ||
											capsule?.image?.trim() ||
											avatarImgUrl(record?.accountName ?? tag, manager)
										const displayName = signerDisplayName(capsule, tag)
										const tagLine = tag ? (tag.startsWith('@') ? tag : `@${tag}`) : '@Beamio'
										const isOwner =
											effectiveOwner != null &&
											effectiveOwner.toLowerCase() === manager.toLowerCase()
										const isYou = eoa.toLowerCase() === manager.toLowerCase()
										return (
											<li
												key={manager}
												className="flex items-center gap-3 rounded-xl border border-[#eadcf7] bg-[#f5ecff] px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/80"
											>
												<img
													src={imgSrc}
													alt=""
													className="h-10 w-10 shrink-0 rounded-full object-cover bg-white"
												/>
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-1.5">
														{displayName ? (
															<p className="truncate text-sm font-semibold text-[#424655] dark:text-slate-100">
																{displayName}
															</p>
														) : (
															<p className="truncate text-sm font-semibold text-[#424655] dark:text-slate-100">
																{tagLine}
															</p>
														)}
														{isOwner ? (
															<span
																className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
																style={{ backgroundColor: aaAccent.accent }}
															>
																Owner
															</span>
														) : null}
														{isYou ? (
															<span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
																You
															</span>
														) : null}
													</div>
													{displayName ? (
														<p className="truncate text-xs text-slate-600 dark:text-slate-400">
															{tagLine}
														</p>
													) : null}
													<CosignerAddressCapsule address={manager} />
												</div>
											</li>
										)
									})}
									</ul>
								</>
							) : (
								<p className="mt-3 text-sm text-slate-500">No co-signers on chain yet.</p>
							)}
						</div>

						{canProposeSignerChanges && policy && !cosignersFromChainFallback ? (
						<div className="relative overflow-visible rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
								Update co-signers &amp; signatures
							</p>
							<p className="mt-1 text-xs text-slate-500">
								Add a co-signer or change the M-of-N rule. Proposals go to all signers via CoNET chat.
								Owner must remain the lowest address among signers.
							</p>
							<div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50">
								<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
									Updating this Smart Wallet
								</p>
								<div className="mt-2 flex flex-wrap items-center gap-2">
									<SmartWalletOwnerBeamioCapsule
										ownerEoa={selectedSignersOwnerEoa}
										resolveTag={resolveTag}
										lookupByAddress={lookupByAddress}
										toCapsuleItem={toCapsuleItem}
										avatarImgUrl={avatarImgUrl}
									/>
									{selectedSignersWallet?.isOwnAa ? (
										<span className="shrink-0 rounded-full bg-[#0051d1]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0051d1]">
											Your Smart Wallet
										</span>
									) : (
										<span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
											Co-signer
										</span>
									)}
									{viewerIsOwnerOnSelectedSignersWallet ? (
										<span
											className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
											style={{ backgroundColor: aaAccent.accent }}
										>
											You are owner
										</span>
									) : eoa && policy.managers.some((m) => m.toLowerCase() === eoa.toLowerCase()) ? (
										<span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
											You are co-signer
										</span>
									) : null}
								</div>
								{signersAaAccount ? (
									<div className="mt-2">
										<AaAccountAddressCapsule address={signersAaAccount} />
									</div>
								) : null}
							</div>
							<label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
								Add co-signer (optional)
							</label>
							{selectedCosigner ? (
								<div className="mt-1 rounded-2xl border border-[#eadcf7] bg-[#f5ecff] p-3 dark:border-slate-600 dark:bg-slate-800/80">
									<div className="flex items-start justify-between gap-3">
										<div className="flex min-w-0 flex-1 items-center gap-2.5">
											<IpfsImg
												src={
													selectedCosigner.image?.trim() ||
													beamioSearchAvatarUrl(selectedCosigner.username || selectedCosigner.address)
												}
												alt=""
												className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
											/>
											<div className="min-w-0 flex-1 leading-tight">
												<p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
													{beamioSearchDisplayName(selectedCosigner)}
												</p>
												<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
													@{selectedCosigner.username} · {beamioSearchShortAddress(selectedCosigner.address)}
												</p>
											</div>
										</div>
										<button
											type="button"
											className="rounded-full p-2 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-700"
											onClick={() => setSelectedCosigner(null)}
											aria-label="Clear selected co-signer"
										>
											<X className="h-4 w-4" aria-hidden />
										</button>
									</div>
								</div>
							) : (
								<div className="relative mt-1">
									<div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm ring-1 ring-transparent focus-within:ring-slate-300 dark:border-slate-600 dark:bg-slate-800">
										<Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
										<input
											value={newSignerTag}
											onChange={(e) => setNewSignerTag(e.currentTarget.value)}
											onFocus={() => {
												if (canSearchCosigner && (cosignerSearchResults.length > 0 || cosignerSearchLoading)) {
													setShowCosignerDropdown(true)
												}
											}}
											placeholder="Search @BeamioTag or wallet address"
											autoComplete="off"
											inputMode="search"
											className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
										/>
										{cosignerSearchLoading ? (
											<Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
										) : null}
									</div>
									{showCosignerDropdown && canSearchCosigner ? (
										<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
											<div className="max-h-72 overflow-y-auto py-1">
												{!cosignerSearchLoading &&
													cosignerSearchResults.map((item) => (
														<BeamioSearchResultRow
															key={item.address}
															item={item}
															onSelect={(row) => void handleSelectCosigner(row)}
														/>
													))}
												{!cosignerSearchLoading && cosignerSearchResults.length === 0 ? (
													<div className="px-3 py-2.5 text-xs text-slate-400">No results</div>
												) : null}
											</div>
										</div>
									) : null}
								</div>
							)}
							{selectedCosigner || policy.managers.length > 1 ? (
								<ThresholdRatioPicker
									signerCount={proposedSignerCount}
									value={Math.min(proposedRequiredSigs, proposedSignerCount)}
									onChange={setProposedRequiredSigs}
									accentColor={aaAccent.accent}
									hint={
										selectedCosigner
											? `After adding this co-signer, ${proposedSignerCount} signers total (was ${policy.threshold}/${policy.managers.length}). Pick a new M-of-N.`
											: `Current: ${policy.threshold}/${policy.managers.length}. Select a new ratio.`
									}
								/>
							) : (
								<p className="mt-3 text-xs text-slate-500">
									Required signatures: {policy.threshold}/{policy.managers.length}. Search above to add
									a co-signer.
								</p>
							)}
							<button
								type="button"
								disabled={!canSubmitPolicyProposal || busy === 'policy'}
								onClick={() => void proposePolicyChange()}
								className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
								style={{ backgroundColor: aaAccent.accent }}
							>
								{busy === 'policy' ? 'Proposing…' : 'Propose threshold'}
							</button>
						</div>
						) : null}
					</div>
				) : null}

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
							transferAssetsLoading && transferAssetOptions.length === 0 ? (
							<p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								Loading wallet balances…
							</p>
						) : transferAssetOptions.length === 0 ? (
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
								{transferCreateBlockedByActive ? (
									<p className="mt-3 text-xs font-medium text-amber-700">
										{AA_MULTISIG_BLOCK_NEW_TRANSFER_TOAST} Use the Pending tab to sign,
										submit, or reject it first.
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
									disabled={
										busy === 'transfer' || !selectedTransferAsset || transferCreateBlockedByActive
									}
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
						Select an institutional Smart Wallet above to manage co-signers, pending approvals,
						transfers, and history.
					</p>
				)}
				</div>
			</div>
		</div>
	)
}
