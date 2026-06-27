import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Plus, Shield, XCircle } from 'lucide-react'
import { ethers } from 'ethers'
import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
import {
	fetchValidatorDepositRedeemAdminNonce,
	generateValidatorRedeemCode,
	postValidatorDepositRedeemAdminCancel,
	postValidatorDepositRedeemAdminCreate,
	queryValidatorDepositRedeemOnChain,
	signValidatorDepositRedeemCancel,
	signValidatorDepositRedeemCreate,
	validatorDepositRedeemCodeHash,
} from '@/services/BeamioCard'
import { tu } from '@/locale/beamioLocale'
import {
	appendStoredValidatorRedeemCode,
	loadStoredValidatorRedeemCodes,
	patchStoredValidatorRedeemCode,
	type StoredValidatorRedeemCode,
} from '@/utils/validatorDepositRedeemLocal'

type ValidatorDepositRedeemManagementPanelProps = {
	currentEoa?: string | null
	privateKeyArmor?: string | null
	className?: string
}

function shortAddr(address: string | undefined): string {
	if (!address || !ethers.isAddress(address)) return '—'
	const a = ethers.getAddress(address)
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function formatTs(sec: number): string {
	if (!sec) return '—'
	try {
		return new Date(sec * 1000).toLocaleString()
	} catch {
		return String(sec)
	}
}

export function ValidatorDepositRedeemManagementPanel({
	currentEoa,
	privateKeyArmor,
	className = '',
}: ValidatorDepositRedeemManagementPanelProps) {
	const adminEoa = useMemo(() => {
		try {
			return currentEoa && ethers.isAddress(currentEoa) ? ethers.getAddress(currentEoa) : null
		} catch {
			return null
		}
	}, [currentEoa])

	const [stored, setStored] = useState<StoredValidatorRedeemCode[]>([])
	const [busy, setBusy] = useState<'create' | 'cancel' | 'refresh' | null>(null)
	const [notice, setNotice] = useState<{ kind: 'success' | 'warn' | 'error'; text: string } | null>(null)

	const [allowedClaimer, setAllowedClaimer] = useState('')
	const [validatorCount, setValidatorCount] = useState('1')
	const [targetNodeIp, setTargetNodeIp] = useState('')
	const [gbMiningNodeCount, setGbMiningNodeCount] = useState('')
	const [validDays, setValidDays] = useState('30')

	const reloadStored = useCallback(() => {
		if (!adminEoa) {
			setStored([])
			return
		}
		setStored(loadStoredValidatorRedeemCodes(adminEoa))
	}, [adminEoa])

	useEffect(() => {
		reloadStored()
	}, [reloadStored])

	const requirePrivateKey = (): string => {
		const pk = privateKeyArmor?.trim()
		if (!pk) throw new Error('Unlock wallet first — admin EIP-712 signature requires your local private key.')
		return pk
	}

	const refreshChainStatus = async () => {
		if (!adminEoa) return
		setBusy('refresh')
		setNotice(null)
		try {
			const rows = loadStoredValidatorRedeemCodes(adminEoa)
			await Promise.all(
				rows.map(async (row) => {
					const chain = await queryValidatorDepositRedeemOnChain(row.code)
					if (chain.valid) {
						patchStoredValidatorRedeemCode(adminEoa, row.id, {
							...row,
						})
					}
				})
			)
			reloadStored()
			setNotice({ kind: 'success', text: 'Chain status refreshed.' })
		} catch (e: unknown) {
			const err = e as { message?: string }
			setNotice({ kind: 'error', text: err?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleCreate = async () => {
		if (!adminEoa) return
		setBusy('create')
		setNotice(null)
		try {
			const pk = requirePrivateKey()
			const count = Number.parseInt(validatorCount, 10)
			if (!Number.isFinite(count) || count <= 0) throw new Error('validatorCount must be a positive integer.')
			const targetIp = targetNodeIp.trim().toLowerCase()
			if (!targetIp || !/^[a-z0-9.:-]+$/.test(targetIp)) throw new Error('Invalid target validator node IP.')
			const gbCountRaw = gbMiningNodeCount.trim() ? Number.parseInt(gbMiningNodeCount, 10) : count
			if (!Number.isFinite(gbCountRaw) || gbCountRaw < 0) throw new Error('gbMiningNodeCount must be a non-negative integer.')
			const days = Number.parseInt(validDays, 10)
			if (!Number.isFinite(days) || days <= 0) throw new Error('Validity days must be positive.')

			let claimer = ethers.ZeroAddress
			if (allowedClaimer.trim()) {
				if (!ethers.isAddress(allowedClaimer.trim())) throw new Error('Invalid allowedClaimer address.')
				claimer = ethers.getAddress(allowedClaimer.trim())
			}

			const code = generateValidatorRedeemCode()
			const codeHash = validatorDepositRedeemCodeHash(code)
			const now = BigInt(Math.floor(Date.now() / 1000))
			const validAfter = 0n
			const validBefore = now + BigInt(days * 86400)
			const deadline = now + 600n

			const nonceRes = await fetchValidatorDepositRedeemAdminNonce(adminEoa)
			if (!nonceRes.ok) throw new Error(nonceRes.error)
			const nonce = BigInt(nonceRes.nonce)

			const signature = await signValidatorDepositRedeemCreate(pk, {
				admin: adminEoa,
				codeHash,
				allowedClaimer: claimer,
				validatorCount: BigInt(count),
				targetNodeIp: targetIp,
				gbMiningNodeCount: BigInt(gbCountRaw),
				validAfter,
				validBefore,
				nonce,
				deadline,
			})

			const res = await postValidatorDepositRedeemAdminCreate({
				admin: adminEoa,
				codeHash,
				allowedClaimer: claimer,
				validatorCount: String(count),
				targetNodeIp: targetIp,
				gbMiningNodeCount: String(gbCountRaw),
				validAfter: validAfter.toString(),
				validBefore: validBefore.toString(),
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			})
			if (!res.success) throw new Error(res.error ?? 'Create redeem failed.')

			const row: StoredValidatorRedeemCode = {
				id: codeHash,
				code,
				codeHash,
				allowedClaimer: claimer,
				validatorCount: count,
				targetNodeIp: targetIp,
				gbMiningNodeCount: gbCountRaw,
				validAfter: Number(validAfter),
				validBefore: Number(validBefore),
				createdAt: new Date().toISOString(),
				createTxHash: res.txHash,
			}
			appendStoredValidatorRedeemCode(adminEoa, row)
			reloadStored()
			setNotice({
				kind: 'success',
				text: `Redeem created. Code saved locally on this device.${res.txHash ? ` Tx: ${res.txHash.slice(0, 10)}…` : ''}`,
			})
		} catch (e: unknown) {
			const err = e as { message?: string }
			setNotice({ kind: 'error', text: err?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleCancel = async (row: StoredValidatorRedeemCode) => {
		if (!adminEoa) return
		if (!window.confirm('Cancel this redeem on chain? The code will no longer be claimable.')) return
		setBusy('cancel')
		setNotice(null)
		try {
			const pk = requirePrivateKey()
			const now = BigInt(Math.floor(Date.now() / 1000))
			const deadline = now + 600n
			const nonceRes = await fetchValidatorDepositRedeemAdminNonce(adminEoa)
			if (!nonceRes.ok) throw new Error(nonceRes.error)
			const nonce = BigInt(nonceRes.nonce)
			const signature = await signValidatorDepositRedeemCancel(pk, {
				admin: adminEoa,
				codeHash: row.codeHash,
				nonce,
				deadline,
			})
			const res = await postValidatorDepositRedeemAdminCancel({
				admin: adminEoa,
				codeHash: row.codeHash,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			})
			if (!res.success) throw new Error(res.error ?? 'Cancel redeem failed.')
			patchStoredValidatorRedeemCode(adminEoa, row.id, {
				cancelledAt: new Date().toISOString(),
				cancelTxHash: res.txHash,
			})
			reloadStored()
			setNotice({ kind: 'success', text: 'Redeem cancelled on chain.' })
		} catch (e: unknown) {
			const err = e as { message?: string }
			setNotice({ kind: 'error', text: err?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	if (!adminEoa) return null

	return (
		<section
			className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_40px_rgba(21,98,240,0.06)] ${className}`}
		>
			<div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-[#e9edff]/60 px-5 py-4 sm:px-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0051d1]/10 text-[#0051d1]">
							<Shield className="h-5 w-5" strokeWidth={2} aria-hidden />
						</div>
						<div>
							<h3 className="text-lg font-extrabold tracking-tight text-[#2c2f31]">验证者管理</h3>
							<p className="text-xs font-medium text-slate-500">
								Redeem admin · {shortAddr(adminEoa)} · contract {shortAddr(CONET_VALIDATOR_DEPOSIT_REDEEM)}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => void refreshChainStatus()}
						disabled={busy != null}
						className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
					>
						{busy === 'refresh' ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : 'Refresh status'}
					</button>
				</div>
			</div>

			<div className="space-y-6 p-5 sm:p-6">
				{notice ? (
					<div
						className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
							notice.kind === 'success'
								? 'border-emerald-200 bg-emerald-50 text-emerald-800'
								: notice.kind === 'warn'
									? 'border-amber-200 bg-amber-50 text-amber-900'
									: 'border-red-200 bg-red-50 text-red-800'
						}`}
					>
						{notice.kind === 'error' ? (
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
						) : (
							<Check className="mt-0.5 h-4 w-4 shrink-0" />
						)}
						<span>{notice.text}</span>
					</div>
				) : null}

				<div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
					<h4 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-600">
						<Plus className="h-4 w-4" /> Create redeem
					</h4>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block text-xs font-semibold text-slate-600">
							Allowed claimer (optional, blank = anyone)
							<input
								value={allowedClaimer}
								onChange={(e) => setAllowedClaimer(e.target.value)}
								placeholder="0x… or leave empty"
								className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm"
							/>
						</label>
						<label className="block text-xs font-semibold text-slate-600">
							Validator count
							<input
								type="number"
								min={1}
								value={validatorCount}
								onChange={(e) => setValidatorCount(e.target.value)}
								className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
							/>
						</label>
						<label className="block text-xs font-semibold text-slate-600">
							Target validator node IP
							<input
								value={targetNodeIp}
								onChange={(e) => setTargetNodeIp(e.target.value)}
								placeholder="66.179.255.8"
								className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm"
							/>
						</label>
						<label className="block text-xs font-semibold text-slate-600">
							GB mining node count (default = validator count)
							<input
								type="number"
								min={0}
								value={gbMiningNodeCount}
								onChange={(e) => setGbMiningNodeCount(e.target.value)}
								placeholder="same as validator count"
								className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
							/>
						</label>
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-700 sm:col-span-2">
							CoNET DePIN nodes are <span className="font-semibold">auto-allocated</span> from Guardian at claim time
							(Validator count = nodes assigned). The beneficiary cannot revoke this allocation. Manual IP entry is no
							longer required.
						</div>
						<label className="block text-xs font-semibold text-slate-600">
							Valid for (days)
							<input
								type="number"
								min={1}
								value={validDays}
								onChange={(e) => setValidDays(e.target.value)}
								className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
							/>
						</label>
					</div>
					<p className="mt-3 text-[11px] leading-relaxed text-slate-500">
						Redeem codes are generated randomly and saved in plaintext on this browser only. Share codes securely with claimers.
					</p>
					<button
						type="button"
						onClick={() => void handleCreate()}
						disabled={busy != null}
						className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0051d1] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0051d1]/20 transition hover:bg-[#0046b8] disabled:opacity-60"
					>
						{busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
						Create &amp; save locally
					</button>
				</div>

				<div>
					<h4 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-600">Saved redeems (this device)</h4>
					{stored.length === 0 ? (
						<p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
							No redeem codes saved on this device yet.
						</p>
					) : (
						<ul className="space-y-3">
							{stored.map((row) => (
								<StoredRedeemRow
									key={row.id}
									row={row}
									busy={busy != null}
									onCancel={() => void handleCancel(row)}
								/>
							))}
						</ul>
					)}
				</div>
			</div>
		</section>
	)
}

function StoredRedeemRow({
	row,
	busy,
	onCancel,
}: {
	row: StoredValidatorRedeemCode
	busy: boolean
	onCancel: () => void
}) {
	const [copied, setCopied] = useState(false)
	const [chain, setChain] = useState<Awaited<ReturnType<typeof queryValidatorDepositRedeemOnChain>> | null>(null)

	useEffect(() => {
		let cancelled = false
		void queryValidatorDepositRedeemOnChain(row.code).then((r) => {
			if (!cancelled) setChain(r)
		})
		return () => {
			cancelled = true
		}
	}, [row.code])

	const statusLabel = row.cancelledAt
		? 'Cancelled (local)'
		: chain?.consumed
			? 'Consumed'
			: chain?.active
				? 'Active'
				: chain?.valid
					? 'Inactive'
					: '未知'

	return (
		<li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
								statusLabel === 'Active'
									? 'bg-emerald-100 text-emerald-800'
									: statusLabel === 'Consumed'
										? 'bg-slate-100 text-slate-600'
										: 'bg-amber-100 text-amber-900'
							}`}
						>
							{statusLabel}
						</span>
						<span className="font-mono text-[11px] text-slate-400">{row.codeHash.slice(0, 14)}…</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<code className="max-w-full truncate rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-800">
							{row.code}
						</code>
						<button
							type="button"
							title="Copy code"
							onClick={async () => {
								await navigator.clipboard.writeText(row.code)
								setCopied(true)
								window.setTimeout(() => setCopied(false), 2000)
							}}
							className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
						>
							{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
						</button>
					</div>
					<dl className="grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
						<div>
							<span className="font-semibold text-slate-500">Target node:</span> {row.targetNodeIp}
						</div>
						<div>
							<span className="font-semibold text-slate-500">Validators:</span> {row.validatorCount}
						</div>
						<div>
							<span className="font-semibold text-slate-500">Valid until:</span> {formatTs(row.validBefore)}
						</div>
						<div>
							<span className="font-semibold text-slate-500">Claimer:</span>{' '}
							{row.allowedClaimer === ethers.ZeroAddress ? 'Anyone' : shortAddr(row.allowedClaimer)}
						</div>
					</dl>
				</div>
				{!row.cancelledAt && chain?.active && !chain.consumed ? (
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
					>
						<XCircle className="h-3.5 w-3.5" />{tu('cancel')}</button>
				) : null}
			</div>
			{row.cancelTxHash ? (
				<p className="mt-2 font-mono text-[10px] text-slate-400">Cancel tx: {row.cancelTxHash}</p>
			) : null}
		</li>
	)
}
