import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hexagon, Loader2, Users, Send, History, AlertTriangle, Check, Copy, Search, X, ChevronLeft } from 'lucide-react'
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
	loadAaMultisigTasks,
	listAaMultisigHistory,
	listPendingAaMultisigForSigner,
	listReadyAaMultisigTasks,
	upsertAaMultisigTask,
} from '@/utils/aaMultisigLocalStore'
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
	formatAaMultisigStaleNonceMessage,
	readAaEntryPointNonce,
} from '@/utils/aaMultisigEntryPointNonce'
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
	buildSignInnerExportForTask,
	buildProposeInnerExportFromTask,
	copyAaMultisigInnerExport,
	flushAaMultisigOutboundQueue,
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
	const cosignerSearchRequestId = useRef(0)
	const [transferTo, setTransferTo] = useState('')
	const [transferAmount, setTransferAmount] = useState('')
	const [transferAssetId, setTransferAssetId] = useState<AaMultisigTransferAssetId | ''>('')
	const [transferAssetOptions, setTransferAssetOptions] = useState<AaMultisigTransferAssetOption[]>(
		[]
	)
	const [transferAssetsLoading, setTransferAssetsLoading] = useState(false)
	const [importPayload, setImportPayload] = useState('')
	const [showImportPanel, setShowImportPanel] = useState(false)
	const [outboundQueue, setOutboundQueue] = useState<AaMultisigOutboundListItem[]>([])
	const [outboundVisibleCount, setOutboundVisibleCount] = useState(OFFLINE_SYNC_PAGE_SIZE)
	const outboundListRef = useRef<HTMLUListElement>(null)
	const outboundLoadMoreRef = useRef<HTMLLIElement>(null)
	const outboundListScrolledRef = useRef(false)

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
		if (!eoa || !privateKeyArmor || !allNodes?.length) return
		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined

		const scheduleRetry = (remaining: number) => {
			if (cancelled || remaining <= 0) return
			timer = setTimeout(() => void tick(), 15_000)
		}

		const tick = async () => {
			const result = await flushAaMultisigOutboundQueue({
				walletEoa: eoa,
				privateKeyArmor,
				allNodes,
			})
			if (cancelled) return
			refreshOutboundQueue()
			scheduleRetry(result.remaining)
		}

		void tick()
		return () => {
			cancelled = true
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [eoa, privateKeyArmor, allNodes, refreshOutboundQueue])

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

	const reloadTransferAssets = useCallback(async () => {
		if (!aaAccount) {
			setTransferAssetOptions([])
			setTransferAssetId('')
			return
		}
		setTransferAssetsLoading(true)
		try {
			const options = await fetchAaMultisigTransferAssetOptions(aaAccount, {
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
	}, [aaAccount])

	useEffect(() => {
		if (tab !== 'transfer' || !aaAccount) return
		void reloadTransferAssets()
	}, [tab, aaAccount, reloadTransferAssets])

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

	const reloadTasks = useCallback(() => {
		if (!eoa || !aaAccount) {
			setTasks([])
			return
		}
		setTasks(loadAaMultisigTasks(eoa, aaAccount))
	}, [eoa, aaAccount])

	const reloadPolicy = useCallback(async () => {
		if (!aaAccount) return
		setPolicyLoading(true)
		try {
			const p = await readAaThresholdPolicy(aaMultisigProvider, aaAccount, { fallbackEoa: eoa })
			setPolicy(p)
		} catch (err) {
			console.warn('[AaMultisig] readAaThresholdPolicy failed', err)
			Toast.show({ content: 'Could not read Smart Wallet policy on CoNET.' })
		} finally {
			setPolicyLoading(false)
		}
	}, [aaAccount, eoa])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		void reloadPolicy()
		reloadTasks()
	}, [reloadPolicy, reloadTasks])

	useEffect(() => {
		const onChange = () => reloadTasks()
		window.addEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onChange)
		return () => window.removeEventListener(AA_MULTISIG_TASKS_CHANGED_EVENT, onChange)
	}, [reloadTasks])

	const pendingForMe = useMemo(
		() => (eoa && aaAccount ? listPendingAaMultisigForSigner(eoa, aaAccount, eoa) : []),
		[tasks, eoa, aaAccount]
	)
	const readyTasks = useMemo(
		() => (eoa && aaAccount ? listReadyAaMultisigTasks(eoa, aaAccount) : []),
		[tasks, eoa, aaAccount]
	)
	const history = useMemo(
		() => (eoa && aaAccount ? listAaMultisigHistory(eoa, aaAccount) : []),
		[tasks, eoa, aaAccount]
	)

	const [chainEntryPointNonce, setChainEntryPointNonce] = useState<string | null>(null)

	const refreshChainEntryPointNonce = useCallback(async () => {
		if (!aaAccount) {
			setChainEntryPointNonce(null)
			return
		}
		try {
			const n = await readAaEntryPointNonce(aaMultisigProvider, aaAccount)
			setChainEntryPointNonce(String(n))
		} catch {
			// untrusted — keep previous
		}
	}, [aaAccount])

	useEffect(() => {
		if (tab !== 'pending' && tab !== 'history') return
		void refreshChainEntryPointNonce()
	}, [tab, aaAccount, tasks, refreshChainEntryPointNonce])

	const previewRequiredSignatures = useMemo(() => {
		if (!policy) return null
		return autoRequiredSignaturesAfterAddCosigner(
			policy.threshold,
			policy.managers.length,
			policy.managers.length + 1
		)
	}, [policy])

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

	const effectiveOwner = useMemo(
		() => resolveEffectiveAaOwner(policy, eoa),
		[policy, eoa]
	)

	useEffect(() => {
		if (!displayCosigners.length) return
		void ensureProfilesForAddresses(displayCosigners)
	}, [displayCosigners, ensureProfilesForAddresses])

	const requireWalletReady = (): boolean => {
		if (!eoa || !aaAccount) {
			Toast.show({ content: 'Unlock wallet and ensure Smart Wallet (AA) is available.' })
			return false
		}
		if (!privateKeyArmor) {
			Toast.show({ content: 'Wallet signing key unavailable.' })
			return false
		}
		return true
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
		setBusy('policy')
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
			const managers = sortManagersStrict(
				resolveEffectiveAaOwner(policy, eoa) ?? policy.owner,
				[
				...policy.managers.filter((m) => m.toLowerCase() !== signerEoa.toLowerCase()),
				signerEoa,
			])
			const thresholdNum = autoRequiredSignaturesAfterAddCosigner(
				policy.threshold,
				policy.managers.length,
				managers.length
			)
			if (thresholdNum > managers.length) {
				Toast.show({ content: 'Threshold cannot exceed number of signers.' })
				return
			}
			const callData = encodeAAExecuteSetThresholdPolicy(aaAccount, managers, thresholdNum)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				aaMultisigProvider,
				aaAccount,
				callData
			)
			const creatorSignature = await signAaUserOpHash(privateKeyArmor, userOpHash)
			const taskId = crypto.randomUUID().toLowerCase()
			const now = Date.now()
			const inner = buildProposeInner({
				taskId,
				aaAccount,
				createdAt: now,
				kind: 'set_policy',
				creatorEoa: eoa,
				threshold: policy.threshold,
				managers: policy.managers,
				entryPointNonce: packedUserOp.nonce,
				userOpHash,
				packedUserOp,
				newManagers: managers,
				newThreshold: thresholdNum,
				title: 'Update multisig signers',
				creatorSignature,
			})
			const merged = mergeInboundMultisigInner(null, inner, eoa)
			if (merged) upsertAaMultisigTask(eoa, aaAccount, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: policy.managers,
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
			setNewSignerTag('')
			setSelectedCosigner(null)
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const proposeTransfer = async () => {
		if (!requireWalletReady()) return
		if (!selectedTransferAsset || !transferAssetId) {
			Toast.show({ content: 'No transferable assets in this Smart Wallet.' })
			return
		}
		setBusy('transfer')
		try {
			const to = transferTo.trim()
			if (!ethers.isAddress(to)) {
				Toast.show({ content: 'Invalid recipient address.' })
				return
			}
			const amountRaw = parseTransferAmountToRaw(transferAmount, selectedTransferAsset.decimals)
			if (amountRaw == null || amountRaw <= 0n) {
				Toast.show({ content: 'Enter a positive amount.' })
				return
			}
			if (amountRaw > selectedTransferAsset.balanceRaw) {
				Toast.show({ content: 'Amount exceeds available balance.' })
				return
			}
			const callData = encodeAAExecuteConetAssetTransfer({
				asset: transferAssetId,
				toEOA: to,
				amountRaw,
			})
			const opProvider = userOpProviderForTransferAsset(transferAssetId)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				opProvider,
				aaAccount,
				callData
			)
			const creatorSignature = await signAaUserOpHash(privateKeyArmor, userOpHash)
			const managers = policy?.managers?.length ? policy.managers : [eoa]
			const threshold = policy?.threshold ?? 1
			const taskId = crypto.randomUUID().toLowerCase()
			const now = Date.now()
			const amountRawStr = amountRaw.toString()
			const inner = buildProposeInner({
				taskId,
				aaAccount,
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
			if (merged) upsertAaMultisigTask(eoa, aaAccount, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: managers,
				inner,
				privateKeyArmor,
				allNodes: allNodes ?? [],
				excludeEoa: eoa,
			})
			refreshOutboundQueue()

			const soleSignerReady =
				merged?.kind === 'transfer' &&
				merged.status === 'ready' &&
				isSoleSelfSignerMultisig(eoa, managers, threshold)

			if (soleSignerReady && merged) {
				const submitted = await submitTask(merged)
				setTransferTo('')
				setTransferAmount('')
				void reloadTransferAssets()
				if (submitted) {
					setTab('history')
				} else {
					setTab('pending')
				}
				return
			}

			Toast.show({
				content:
					pub.mode === 'broadcast' && pub.sent > 0
						? 'Transfer task created and sent to co-signers via CoNET chat.'
						: 'Transfer task saved locally. Export or sync when CoNET chat is online.',
			})
			setTransferTo('')
			setTransferAmount('')
			reloadTasks()
			setTab('pending')
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const signTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
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
			if (merged) upsertAaMultisigTask(eoa, aaAccount, merged)
			const pub = await publishAaMultisigInnerWithOfflineFallback({
				walletEoa: eoa,
				recipients: task.managers,
				inner,
				privateKeyArmor,
				allNodes: allNodes ?? [],
				excludeEoa: eoa,
			})
			refreshOutboundQueue()
			if (pub.mode === 'broadcast' && pub.sent > 0) {
				Toast.show({ content: 'Signature recorded and shared via CoNET chat.' })
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
			if (merged) upsertAaMultisigTask(eoa, aaAccount, merged)
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

	const submitTask = async (task: AaMultisigTaskLocal): Promise<boolean> => {
		if (!requireWalletReady()) return false
		if (task.signatures.length < task.threshold) {
			Toast.show({ content: 'Not enough signatures yet.' })
			return false
		}
		if (
			task.kind === 'set_policy' &&
			isSetPolicyCallDataSelfExecuteWrapped(task.aaAccount, task.packedUserOp.callData)
		) {
			Toast.show({
				content: 'Outdated policy UserOp encoding. Reject this task and propose again.',
			})
			return false
		}
		const nonceCheck = await assertAaMultisigTaskEntryPointNonceFresh(task.aaAccount, task)
		if (!nonceCheck.ok) {
			Toast.show({ content: nonceCheck.message })
			void refreshChainEntryPointNonce()
			return false
		}
		setBusy(`submit-${task.taskId}`)
		try {
			const combinedSig = concatMultisigSignatures(task.signatures)
			const packedUserOp = { ...task.packedUserOp, signature: combinedSig }
			let hash: string | undefined
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
					const failed: AaMultisigTaskLocal = { ...task, status: 'failed', updatedAt: Date.now() }
					upsertAaMultisigTask(eoa, aaAccount, failed)
					Toast.show({ content: res.error ?? 'Submit failed' })
					reloadTasks()
					return false
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
					const failed: AaMultisigTaskLocal = { ...task, status: 'failed', updatedAt: Date.now() }
					upsertAaMultisigTask(eoa, aaAccount, failed)
					Toast.show({ content: res.error ?? 'Submit failed' })
					reloadTasks()
					return false
				}
				hash = res.hash
				void reloadPolicy()
			} else {
				Toast.show({ content: 'Unsupported task kind for submit.' })
				return false
			}
			const completed: AaMultisigTaskLocal = {
				...task,
				status: 'completed',
				txHash: hash,
				updatedAt: Date.now(),
			}
			upsertAaMultisigTask(eoa, aaAccount, completed)
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
			Toast.show({ content: 'Multisig transfer submitted.' })
			reloadTasks()
			return true
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
			return false
		} finally {
			setBusy(null)
		}
	}

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

	const renderTaskRow = (task: AaMultisigTaskLocal, actions: 'pending' | 'ready' | 'history') => {
		const userSigned = task.signatures.some((s) => s.signer.toLowerCase() === eoa.toLowerCase())
		const syncPending = userSigned && isAaMultisigOutboundPending(eoa, task.taskId, eoa)
		const userIsCreator = task.creatorEoa.toLowerCase() === eoa.toLowerCase()
		const brokenSetPolicyEncoding =
			task.kind === 'set_policy' &&
			isSetPolicyCallDataSelfExecuteWrapped(task.aaAccount, task.packedUserOp.callData)
		const entryPointNonceStale =
			chainEntryPointNonce != null && task.entryPointNonce !== chainEntryPointNonce
		const submitBlocked = brokenSetPolicyEncoding || entryPointNonceStale

		return (
		<div
			key={task.taskId}
			className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
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
					<p className="mt-1 text-xs text-slate-400">
						Signatures {task.signatures.length}/{task.threshold} · nonce {task.entryPointNonce}
					</p>
					{syncPending ? (
						<p className="mt-1 text-xs font-medium text-amber-600">Sync pending (offline sign)</p>
					) : null}
					{brokenSetPolicyEncoding ? (
						<p className="mt-1 text-xs font-medium text-amber-700">
							Outdated call encoding — reject and propose again.
						</p>
					) : null}
					{entryPointNonceStale && chainEntryPointNonce != null ? (
						<p className="mt-1 text-xs font-medium text-amber-700">
							{formatAaMultisigStaleNonceMessage(task.entryPointNonce, BigInt(chainEntryPointNonce))}
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
					{task.status}
				</span>
			</div>
			{actions === 'pending' ? (
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
			{actions === 'ready' ? (
				<>
					<button
						type="button"
						disabled={busy === `submit-${task.taskId}` || submitBlocked}
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
					{submitBlocked ? (
						<button
							type="button"
							disabled={busy === `reject-${task.taskId}`}
							onClick={() => void rejectTask(task)}
							className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-medium text-amber-800"
						>
							Reject expired task
						</button>
					) : null}
				</>
			) : null}
			{actions === 'history' && task.txHash ? (
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

				{!aaAccount ? (
					<div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
						<AlertTriangle className="h-4 w-4 shrink-0" />
						Smart Wallet (AA) not available for this profile.
					</div>
				) : null}

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
						<div
							className="rounded-2xl border p-4"
							style={{ borderColor: aaAccent.border, backgroundColor: aaAccent.surfaceBg }}
						>
							<p className="text-xs font-medium uppercase tracking-wide" style={{ color: aaAccent.accent }}>
								On-chain policy
							</p>
							{policyLoading ? (
								<Loader2 className="mt-2 h-5 w-5 animate-spin" style={{ color: aaAccent.accent }} />
							) : policy ? (
								<p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
									Threshold {policy.threshold} of {policy.managers.length}
								</p>
							) : (
								<p className="mt-2 text-sm text-slate-500">Unavailable</p>
							)}
							<button
								type="button"
								onClick={() => void reloadPolicy()}
								className="mt-3 text-xs font-medium underline"
								style={{ color: aaAccent.accent }}
							>
								Refresh from chain
							</button>
						</div>

						<div className="relative overflow-visible rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add co-signer</p>
							<p className="mt-1 text-xs text-slate-500">
								Proposes a policy update via CoNET chat. Owner must remain the lowest address among signers.
							</p>
							<label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
								@BeamioTag
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
							{previewRequiredSignatures != null ? (
								<p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
									Required signatures:{' '}
									<span className="font-semibold text-slate-900 dark:text-slate-100">
										{previewRequiredSignatures}
									</span>
								</p>
							) : null}
							<button
								type="button"
								disabled={busy === 'policy'}
								onClick={() => void proposePolicyUpdate()}
								className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
								style={{ backgroundColor: aaAccent.accent }}
							>
								{busy === 'policy' ? 'Proposing…' : 'Propose via CoNET chat'}
							</button>
						</div>

						<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Current co-signers</p>
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
								Sign without CoNET chat, then copy the sign packet or import co-signer packets below.
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
												<button
													type="button"
													onClick={() => void copyQueuedPacket(item)}
													className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
													style={{ color: aaAccent.accent }}
												>
													<Copy className="h-3.5 w-3.5" aria-hidden />
													Copy packet
												</button>
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
						{pendingForMe.length === 0 ? (
							<p className="text-center text-sm text-slate-500">No tasks waiting for your signature.</p>
						) : (
							pendingForMe.map((t) => renderTaskRow(t, 'pending'))
						)}
					</div>
				) : null}

				{tab === 'transfer' ? (
					<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
						<p className="text-sm font-semibold">New transfer</p>
						{transferAssetOptions.length === 0 ? (
							<p className="mt-1 text-xs text-slate-500">
								Currently supports CoNET L1 and Base L2.
							</p>
						) : null}
						{aaAccount ? (
							<div className="mt-3">
								<AaAccountAddressCapsule address={aaAccount} />
							</div>
						) : null}
						{transferAssetsLoading && transferAssetOptions.length === 0 ? (
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
						)}
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
				</div>
			</div>
		</div>
	)
}
