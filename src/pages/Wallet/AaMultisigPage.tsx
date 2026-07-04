import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hexagon, Loader2, Users, Send, History, AlertTriangle, Check } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
import { beamioWalletAccent } from '@/utils/beamioWalletAccent'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { searchUsername } from '@/services/beamio'
import { baseEndpoint } from '@/utils/constants'
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
} from '@/utils/aaMultisigProtocol'
import {
	broadcastAaMultisigInner,
	buildProposeInner,
	buildRejectInner,
	buildSignInner,
	buildSubmittedInner,
} from '@/services/aaMultisigGossip'
import {
	buildUnsignedAaMultisigUserOp,
	encodeAAExecuteSetThresholdPolicy,
	encodeAAExecuteUsdcTransfer,
	readAaThresholdPolicy,
	signAaUserOpHash,
	submitAaMultisigUserOp,
} from '@/utils/aaMultisigUserOp'

type TabId = 'signers' | 'pending' | 'transfer' | 'history'

const aaAccent = beamioWalletAccent('aa')

function shortAddr(a: string): string {
	if (!a || a.length < 12) return a
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function formatUsdc6(amount: string | undefined): string {
	if (!amount) return '—'
	try {
		return (Number(amount) / 1e6).toFixed(2)
	} catch {
		return amount
	}
}

export default function AaMultisigPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter, allNodes } = useDaemonContext()
	const profile = profiles?.[0]
	const eoa = profile?.keyID?.trim() ?? ''
	const aaAccount = profile?.aaAccount?.trim() ?? ''

	const [tab, setTab] = useState<TabId>('pending')
	const [policy, setPolicy] = useState<{ owner: string; managers: string[]; threshold: number } | null>(
		null
	)
	const [policyLoading, setPolicyLoading] = useState(false)
	const [tasks, setTasks] = useState<AaMultisigTaskLocal[]>([])
	const [busy, setBusy] = useState<string | null>(null)

	const [newSignerTag, setNewSignerTag] = useState('')
	const [newThreshold, setNewThreshold] = useState('2')
	const [transferTo, setTransferTo] = useState('')
	const [transferAmount, setTransferAmount] = useState('')

	const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)

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
			const p = await readAaThresholdPolicy(baseEndpoint, aaAccount)
			setPolicy(p)
			setNewThreshold(String(Math.max(2, p.threshold)))
		} catch {
			Toast.show({ content: 'Could not read Smart Wallet policy on-chain.' })
		} finally {
			setPolicyLoading(false)
		}
	}, [aaAccount])

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

	const requireReady = (): boolean => {
		if (!eoa || !aaAccount) {
			Toast.show({ content: 'Unlock wallet and ensure Smart Wallet (AA) is available.' })
			return false
		}
		if (!privateKeyArmor) {
			Toast.show({ content: 'Wallet signing key unavailable.' })
			return false
		}
		if (!allNodes?.length) {
			Toast.show({ content: 'CoNET chat nodes unavailable. Open the app and wait for chat sync.' })
			return false
		}
		return true
	}

	const proposePolicyUpdate = async () => {
		if (!requireReady() || !policy) return
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
			const thresholdNum = Math.max(1, Math.floor(Number(newThreshold)))
			const managers = sortManagersStrict(policy.owner, [
				...policy.managers.filter((m) => m.toLowerCase() !== signerEoa.toLowerCase()),
				signerEoa,
			])
			if (thresholdNum > managers.length) {
				Toast.show({ content: 'Threshold cannot exceed number of signers.' })
				return
			}
			const callData = encodeAAExecuteSetThresholdPolicy(aaAccount, managers, thresholdNum)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				baseEndpoint,
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
			const { sent, failed } = await broadcastAaMultisigInner({
				recipients: policy.managers,
				inner,
				privateKeyArmor,
				allNodes,
				excludeEoa: eoa,
			})
			Toast.show({
				content:
					sent > 0
						? `Policy update proposed (${sent} peer${sent > 1 ? 's' : ''} notified via CoNET chat).`
						: 'Could not reach peers via CoNET chat.',
			})
			if (failed > 0 && sent === 0) return
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
		if (!requireReady()) return
		setBusy('transfer')
		try {
			const to = transferTo.trim()
			if (!ethers.isAddress(to)) {
				Toast.show({ content: 'Invalid recipient address.' })
				return
			}
			const amountNum = Number(transferAmount)
			if (!(amountNum > 0)) {
				Toast.show({ content: 'Enter a positive USDC amount.' })
				return
			}
			const amountUSDC6 = String(Math.round(amountNum * 1e6))
			const callData = encodeAAExecuteUsdcTransfer(to, amountUSDC6)
			const { packedUserOp, userOpHash } = await buildUnsignedAaMultisigUserOp(
				baseEndpoint,
				aaAccount,
				callData
			)
			const creatorSignature = await signAaUserOpHash(privateKeyArmor, userOpHash)
			const managers = policy?.managers?.length ? policy.managers : [eoa]
			const threshold = policy?.threshold ?? 1
			const taskId = crypto.randomUUID().toLowerCase()
			const now = Date.now()
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
				amountUsdc6: amountUSDC6,
				title: `Transfer $${formatUsdc6(amountUSDC6)} USDC`,
				creatorSignature,
			})
			const merged = mergeInboundMultisigInner(null, inner, eoa)
			if (merged) upsertAaMultisigTask(eoa, aaAccount, merged)
			await broadcastAaMultisigInner({
				recipients: managers,
				inner,
				privateKeyArmor,
				allNodes,
				excludeEoa: eoa,
			})
			Toast.show({ content: 'Transfer task created and sent to co-signers via CoNET chat.' })
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
		if (!requireReady()) return
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
			await broadcastAaMultisigInner({
				recipients: task.managers,
				inner,
				privateKeyArmor,
				allNodes,
				excludeEoa: eoa,
			})
			Toast.show({ content: 'Signature recorded and shared via CoNET chat.' })
			reloadTasks()
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			Toast.show({ content: msg.slice(0, 120) })
		} finally {
			setBusy(null)
		}
	}

	const rejectTask = async (task: AaMultisigTaskLocal) => {
		if (!requireReady()) return
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
			await broadcastAaMultisigInner({
				recipients: task.managers,
				inner,
				privateKeyArmor,
				allNodes,
				excludeEoa: eoa,
			})
			Toast.show({ content: 'Task rejected. Co-signers notified; nonce stays free for new tasks.' })
			reloadTasks()
		} finally {
			setBusy(null)
		}
	}

	const submitTask = async (task: AaMultisigTaskLocal) => {
		if (!requireReady()) return
		if (task.signatures.length < task.threshold) {
			Toast.show({ content: 'Not enough signatures yet.' })
			return
		}
		setBusy(`submit-${task.taskId}`)
		try {
			const combinedSig = concatMultisigSignatures(task.signatures)
			const packedUserOp = { ...task.packedUserOp, signature: combinedSig }
			let hash: string | undefined
			if (task.kind === 'transfer' && task.toEoa && task.amountUsdc6) {
				const res = await submitAaMultisigUserOp({
					toEOA: task.toEoa,
					amountUSDC6: task.amountUsdc6,
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
				await broadcastAaMultisigInner({
					recipients: task.managers,
					inner,
					privateKeyArmor,
					allNodes,
					excludeEoa: eoa,
				})
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

	const renderTaskRow = (task: AaMultisigTaskLocal, actions: 'pending' | 'ready' | 'history') => (
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
						{task.kind === 'transfer'
							? `$${formatUsdc6(task.amountUsdc6)} → ${shortAddr(task.toEoa ?? '')}`
							: task.kind}
					</p>
					<p className="mt-1 text-xs text-slate-400">
						Signatures {task.signatures.length}/{task.threshold} · nonce {task.entryPointNonce}
					</p>
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
						<p className="text-xs text-slate-500">CoNET chat sync · local-first</p>
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
								<>
									<p className="mt-2 text-sm text-slate-700">
										Threshold {policy.threshold} of {policy.managers.length}
									</p>
									<ul className="mt-2 space-y-1 text-xs text-slate-600">
										{policy.managers.map((m) => (
											<li key={m}>{shortAddr(m)}</li>
										))}
									</ul>
								</>
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
							<label className="mt-3 block text-xs font-medium text-slate-600">Required signatures</label>
							<input
								type="number"
								min={1}
								value={newThreshold}
								onChange={(e) => setNewThreshold(e.target.value)}
								className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
							/>
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
					</div>
				) : null}

				{tab === 'pending' ? (
					<div className="space-y-3">
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
						<p className="text-sm font-semibold">New USDC transfer (Base)</p>
						<label className="mt-3 block text-xs font-medium text-slate-600">Recipient EOA</label>
						<input
							value={transferTo}
							onChange={(e) => setTransferTo(e.target.value)}
							placeholder="0x…"
							className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800"
						/>
						<label className="mt-3 block text-xs font-medium text-slate-600">Amount (USDC)</label>
						<input
							type="number"
							min={0}
							step="0.01"
							value={transferAmount}
							onChange={(e) => setTransferAmount(e.target.value)}
							className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
						/>
						<button
							type="button"
							disabled={busy === 'transfer'}
							onClick={() => void proposeTransfer()}
							className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
							style={{ backgroundColor: aaAccent.accent }}
						>
							{busy === 'transfer' ? 'Creating…' : 'Create multisig task'}
						</button>
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
