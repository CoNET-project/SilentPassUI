import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hexagon, Loader2, Users, Send, History, AlertTriangle, Check, Copy } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
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
	buildUnsignedAaMultisigUserOp,
	encodeAAExecuteConetAssetTransfer,
	encodeAAExecuteSetThresholdPolicy,
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
	countAaMultisigOutboundPending,
	flushAaMultisigOutboundQueue,
	ingestAaMultisigFromExport,
	isAaMultisigOutboundPending,
	publishAaMultisigInnerWithOfflineFallback,
} from '@/utils/aaMultisigOfflineSync'

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

export default function AaMultisigPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, allNodes } = useDaemonContext()
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
	const [transferTo, setTransferTo] = useState('')
	const [transferAmount, setTransferAmount] = useState('')
	const [transferAssetId, setTransferAssetId] = useState<AaMultisigTransferAssetId | ''>('')
	const [transferAssetOptions, setTransferAssetOptions] = useState<AaMultisigTransferAssetOption[]>(
		[]
	)
	const [transferAssetsLoading, setTransferAssetsLoading] = useState(false)
	const [importPayload, setImportPayload] = useState('')
	const [showImportPanel, setShowImportPanel] = useState(false)
	const [outboundPendingCount, setOutboundPendingCount] = useState(0)

	const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)

	const refreshOutboundCount = useCallback(() => {
		if (!eoa) {
			setOutboundPendingCount(0)
			return
		}
		setOutboundPendingCount(countAaMultisigOutboundPending(eoa))
	}, [eoa])

	useEffect(() => {
		refreshOutboundCount()
		const onOutbound = () => refreshOutboundCount()
		window.addEventListener(AA_MULTISIG_OUTBOUND_CHANGED_EVENT, onOutbound)
		return () => window.removeEventListener(AA_MULTISIG_OUTBOUND_CHANGED_EVENT, onOutbound)
	}, [refreshOutboundCount])

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
			setOutboundPendingCount(result.remaining)
			scheduleRetry(result.remaining)
		}

		void tick()
		return () => {
			cancelled = true
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [eoa, privateKeyArmor, allNodes])

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

	const proposePolicyUpdate = async () => {
		if (!requireWalletReady() || !policy) return
		setBusy('policy')
		try {
			const tag = newSignerTag.trim().replace(/^@/, '')
			if (!tag) {
				Toast.show({ content: 'Enter a @BeamioTag for the new signer.' })
				return
			}
			const search = await searchUsername(tag)
			const rows = search?.results ?? []
			const signerEoa = rows[0]?.address?.trim()
			if (!signerEoa || !ethers.isAddress(signerEoa)) {
				Toast.show({ content: 'Signer not found on Beamio.' })
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
			refreshOutboundCount()
			Toast.show({
				content:
					pub.mode === 'broadcast' && pub.sent > 0
						? `Policy update proposed (${pub.sent} peer${pub.sent > 1 ? 's' : ''} notified via CoNET chat).`
						: 'Proposed locally. Export or sync when CoNET chat is online.',
			})
			setNewSignerTag('')
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
			refreshOutboundCount()
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
			refreshOutboundCount()
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
			refreshOutboundCount()
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

	const submitTask = async (task: AaMultisigTaskLocal) => {
		if (!requireWalletReady()) return
		if (task.signatures.length < task.threshold) {
			Toast.show({ content: 'Not enough signatures yet.' })
			return
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
				})
				if (!res.success) {
					const failed: AaMultisigTaskLocal = { ...task, status: 'failed', updatedAt: Date.now() }
					upsertAaMultisigTask(eoa, aaAccount, failed)
					Toast.show({ content: res.error ?? 'Submit failed' })
					reloadTasks()
					return
				}
				hash = res.hash
			} else if (task.kind === 'set_policy') {
				const res = await submitAaMultisigUserOp({
					toEOA: task.creatorEoa,
					amountUSDC6: '1',
					packedUserOp,
				})
				if (!res.success) {
					const failed: AaMultisigTaskLocal = { ...task, status: 'failed', updatedAt: Date.now() }
					upsertAaMultisigTask(eoa, aaAccount, failed)
					Toast.show({ content: res.error ?? 'Submit failed' })
					reloadTasks()
					return
				}
				hash = res.hash
				void reloadPolicy()
			} else {
				Toast.show({ content: 'Unsupported task kind for submit.' })
				return
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
				refreshOutboundCount()
			}
			Toast.show({ content: 'Multisig transfer submitted.' })
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
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
				<button
					type="button"
					disabled={busy === `submit-${task.taskId}`}
					onClick={() => void submitTask(task)}
					className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-white"
					style={{ backgroundColor: aaAccent.accent }}
				>
					{busy === `submit-${task.taskId}` ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Send className="h-4 w-4" />
					)}
					Submit transfer
				</button>
			) : null}
			{actions === 'history' && task.txHash ? (
				<p className="mt-2 truncate text-xs text-slate-500">Tx {task.txHash}</p>
			) : null}
		</div>
		)
	}

	return (
		<div className="flex min-h-[100dvh] flex-col bg-[#F2F2F7] dark:bg-slate-950">
			<div className={BEAMIO_CIRCULAR_BACK_ROW_CLASS} style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
				<BeamioCircularBackButton onClick={() => navigate('/wallet')} className="absolute left-4 top-0" />
			</div>

			<div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-14">
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

						<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add co-signer</p>
							<p className="mt-1 text-xs text-slate-500">
								Proposes a policy update via CoNET chat. Owner must remain the lowest address among signers.
							</p>
							<label className="mt-3 block text-xs font-medium text-slate-600">@BeamioTag</label>
							<input
								value={newSignerTag}
								onChange={(e) => setNewSignerTag(e.target.value)}
								placeholder="@alice"
								className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
							/>
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
						<div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Offline sync</p>
								{outboundPendingCount > 0 ? (
									<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
										{outboundPendingCount} queued
									</span>
								) : null}
							</div>
							<p className="mt-1 text-xs text-slate-500">
								Sign without CoNET chat, then copy the sign packet or import co-signer packets below.
							</p>
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
						{readyTasks.length > 0 ? (
							<>
								<p className="pt-2 text-xs font-semibold uppercase text-slate-500">Ready to submit</p>
								{readyTasks.map((t) => renderTaskRow(t, 'ready'))}
							</>
						) : null}
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
	)
}
