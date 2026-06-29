import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from 'react'
import { ethers } from 'ethers'
import { X, Copy, Check, Loader2, AlertTriangle, Ban, TicketPlus, Gift } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	generateValidatorDepositRedeemSecretCode,
	isValidTargetNodeIp,
	resolveValidatorDepositRedeemDisplayStatus,
	signAndSubmitValidatorDepositRedeemCancel,
	signAndSubmitValidatorDepositRedeemCreate,
	validatorDepositRedeemStatusLabel,
} from '@/services/validatorDepositRedeemAdmin'
import {
	deleteValidatorDepositRedeemIssued,
	listValidatorDepositRedeemIssuedForAdmin,
	mergeValidatorDepositRedeemIssued,
	newValidatorDepositRedeemIssuedDraft,
	putValidatorDepositRedeemIssued,
	type ValidatorDepositRedeemIssuedRecord,
	type ValidatorDepositRedeemIssuedStatus,
} from '@/utils/validatorDepositRedeemIssuedDb'
import { syncValidatorDepositRedeemIssuedForAdmin } from '@/utils/syncValidatorDepositRedeemIssuedRecords'

const NUMERIC_SPINNER_HIDE =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

const STATUS_SYNC_MS = 30_000

function preventNumericInputStepKeys(e: KeyboardEvent<HTMLInputElement>): void {
	const blocked = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
	if (blocked.has(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericInputWheelStep(e: WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

function statusChipClass(status: ValidatorDepositRedeemIssuedStatus): string {
	switch (status) {
		case 'pending':
			return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/50'
		case 'claimed':
			return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900/50'
		case 'cancelled':
			return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
		case 'submitting':
			return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900/50'
		case 'create_failed':
			return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-100 dark:border-red-900/50'
		default:
			return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
	}
}

type Props = {
	open: boolean
	onClose: () => void
	adminEoa: string
	canCreate: boolean
}

export function ValidatorDepositRedeemAdminSheet({ open, onClose, adminEoa, canCreate }: Props) {
	const { profiles } = useDaemonContext()
	const adminLower = adminEoa.trim().toLowerCase()
	const [validatorCountInput, setValidatorCountInput] = useState('1')
	const [targetNodeIp, setTargetNodeIp] = useState('38.102.85.33')
	const [allowedClaimerInput, setAllowedClaimerInput] = useState('')
	const [referrerInput, setReferrerInput] = useState('')
	const [airdrop, setAirdrop] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [formError, setFormError] = useState('')
	const [rows, setRows] = useState<ValidatorDepositRedeemIssuedRecord[]>([])
	const [loadingRows, setLoadingRows] = useState(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [cancellingId, setCancellingId] = useState<string | null>(null)
	const syncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const syncRunningRef = useRef(false)

	const reloadRows = useCallback(async () => {
		if (!adminLower) {
			setRows([])
			return
		}
		setLoadingRows(true)
		try {
			const list = await listValidatorDepositRedeemIssuedForAdmin(adminLower)
			setRows(list)
		} finally {
			setLoadingRows(false)
		}
	}, [adminLower])

	const createInFlightRef = useRef(false)

	const syncRowStatuses = useCallback(async () => {
		if (!adminLower || syncRunningRef.current || createInFlightRef.current) return
		syncRunningRef.current = true
		try {
			await syncValidatorDepositRedeemIssuedForAdmin(adminLower)
			await reloadRows()
		} finally {
			syncRunningRef.current = false
		}
	}, [adminLower, reloadRows])

	useEffect(() => {
		if (!open) return
		void (async () => {
			await reloadRows()
			await syncRowStatuses()
		})()
	}, [open, adminLower, reloadRows, syncRowStatuses])

	useEffect(() => {
		if (!open) {
			if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
			syncTimerRef.current = undefined
			return
		}
		const schedule = () => {
			syncTimerRef.current = setTimeout(async () => {
				await syncRowStatuses()
				schedule()
			}, STATUS_SYNC_MS)
		}
		schedule()
		return () => {
			if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
		}
	}, [open, adminLower, syncRowStatuses])

	const handleCreate = useCallback(async () => {
		setFormError('')
		if (!canCreate) {
			setFormError('Redeem admin role is required to create codes.')
			return
		}
		if (!adminEoa) {
			setFormError('Wallet EOA unavailable.')
			return
		}
		const validatorCount = Number(validatorCountInput)
		if (!Number.isFinite(validatorCount) || validatorCount <= 0 || !Number.isInteger(validatorCount)) {
			setFormError('Enter a valid validator count (positive integer).')
			return
		}
		if (!isValidTargetNodeIp(targetNodeIp)) {
			setFormError('Enter a valid target validator node IP.')
			return
		}
		// GB mining node count is auto-set equal to validator count (API + claim allocation).
		const gbMiningNodeCount = validatorCount
		let allowedClaimer = ''
		if (allowedClaimerInput.trim()) {
			if (!ethers.isAddress(allowedClaimerInput.trim())) {
				setFormError('Allowed claimer must be a valid address or empty.')
				return
			}
			allowedClaimer = ethers.getAddress(allowedClaimerInput.trim())
		}
		let referrer = ''
		if (referrerInput.trim()) {
			if (!ethers.isAddress(referrerInput.trim())) {
				setFormError('Referrer must be a valid EOA address or empty.')
				return
			}
			referrer = ethers.getAddress(referrerInput.trim())
		}

		const armor = resolveSigningPrivateKeyArmor(profiles?.[0])
		if (!armor) {
			setFormError('Unlock your wallet to sign the redeem authorization.')
			return
		}

		const { code, codeHash } = generateValidatorDepositRedeemSecretCode()
		const draft = newValidatorDepositRedeemIssuedDraft({
			adminEoa: adminEoa,
			secretCode: code,
			codeHash,
			validatorCount: String(validatorCount),
			targetNodeIp: targetNodeIp.trim(),
			gbMiningNodeCount: String(gbMiningNodeCount),
			allowedClaimer: allowedClaimer || '0x0000000000000000000000000000000000000000',
			referrer: referrer || '0x0000000000000000000000000000000000000000',
			validAfter: '0',
			validBefore: '0',
			airdrop,
		})
		createInFlightRef.current = true
		setSubmitting(true)
		try {
			await putValidatorDepositRedeemIssued(draft)
			await reloadRows()

			const res = await signAndSubmitValidatorDepositRedeemCreate({
				adminEoa,
				codeHash,
				validatorCount,
				targetNodeIp: targetNodeIp.trim(),
				gbMiningNodeCount,
				allowedClaimer: allowedClaimer || undefined,
				referrer: referrer || undefined,
				airdrop,
				privateKeyArmor: armor,
			})
			if (!res.success) {
				await deleteValidatorDepositRedeemIssued(codeHash)
				setFormError(res.error)
				await reloadRows()
				return
			}
			await mergeValidatorDepositRedeemIssued(codeHash, {
				localStatus: 'pending',
				createTxHash: res.txHash,
				chainActive: true,
				chainConsumed: false,
			})
			await reloadRows()
			Toast.show({ content: 'Redeem code created', position: 'top' })
		} catch (e: unknown) {
			await deleteValidatorDepositRedeemIssued(codeHash)
			const err = e as { message?: string }
			setFormError(err?.message ?? String(e))
			await reloadRows()
		} finally {
			createInFlightRef.current = false
			setSubmitting(false)
		}
	}, [
		adminEoa,
		airdrop,
		allowedClaimerInput,
		canCreate,
		profiles,
		referrerInput,
		reloadRows,
		targetNodeIp,
		validatorCountInput,
	])

	const copyCode = useCallback(async (row: ValidatorDepositRedeemIssuedRecord) => {
		try {
			await navigator.clipboard.writeText(row.secretCode)
			setCopiedId(row.id)
			window.setTimeout(() => setCopiedId((cur) => (cur === row.id ? null : cur)), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	const handleCancel = useCallback(
		async (row: ValidatorDepositRedeemIssuedRecord) => {
			const display = resolveValidatorDepositRedeemDisplayStatus({
				localStatus: row.localStatus,
				chain:
					row.chainActive != null
						? {
								ok: true,
								exists: true,
								allowedClaimer: row.allowedClaimer,
								referrer: row.referrer ?? ethers.ZeroAddress,
								validatorCount: row.validatorCount,
								targetNodeIp: row.targetNodeIp,
								gbMiningNodeCount: row.gbMiningNodeCount,
								validAfter: row.validAfter,
								validBefore: row.validBefore,
								active: Boolean(row.chainActive),
								consumed: Boolean(row.chainConsumed),
							}
						: null,
			})
			if (display !== 'pending') return

			const armor = resolveSigningPrivateKeyArmor(profiles?.[0])
			if (!armor) {
				Toast.show({ content: 'Unlock wallet to cancel', position: 'top' })
				return
			}

			setCancellingId(row.id)
			try {
				const res = await signAndSubmitValidatorDepositRedeemCancel({
					adminEoa,
					codeHash: row.codeHash,
					privateKeyArmor: armor,
				})
				if (!res.success) {
					Toast.show({ content: res.error, position: 'top' })
					return
				}
				await mergeValidatorDepositRedeemIssued(row.id, {
					localStatus: 'cancelled',
					cancelTxHash: res.txHash,
					chainActive: false,
				})
				await reloadRows()
				Toast.show({ content: 'Redeem cancelled', position: 'top' })
			} finally {
				setCancellingId(null)
			}
		},
		[adminEoa, profiles, reloadRows],
	)

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45" role="dialog" aria-modal="true">
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				aria-label="Close"
				onClick={onClose}
			/>
			<div
				className="relative z-10 flex max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-t-[28px] bg-[#F2F2F7] shadow-2xl dark:bg-slate-950"
				style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
			>
				<div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
					<div className="flex items-center gap-2.5">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1562f0] text-white">
							<TicketPlus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</div>
						<div>
							<h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Validator Redeem</h2>
							<p className="text-xs text-slate-500">Create & manage redeem codes</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
						aria-label="Close panel"
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
					<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Create redeem code</h3>
						<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
							Each code allocates validators on claim. DePIN GB node slots match the validator count automatically.
							The secret code is stored locally on this device only.
						</p>

						<div className="mt-4 space-y-3">
							<div>
								<label htmlFor="vdr-validator-count" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Validators
								</label>
								<input
									id="vdr-validator-count"
									type="number"
									inputMode="numeric"
									min={1}
									step={1}
									autoComplete="off"
									enterKeyHint="next"
									value={validatorCountInput}
									onChange={(e) => setValidatorCountInput(e.target.value)}
									onKeyDown={preventNumericInputStepKeys}
									onWheel={preventNumericInputWheelStep}
									disabled={submitting || !canCreate}
									className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold tabular-nums dark:border-slate-600 dark:bg-slate-800 ${NUMERIC_SPINNER_HIDE}`}
								/>
							</div>

							<div>
								<label htmlFor="vdr-target-ip" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Target validator node IP
								</label>
								<input
									id="vdr-target-ip"
									type="text"
									autoComplete="off"
									enterKeyHint="next"
									value={targetNodeIp}
									onChange={(e) => setTargetNodeIp(e.target.value)}
									disabled={submitting || !canCreate}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
									placeholder="38.102.85.33"
								/>
							</div>

							<div>
								<label htmlFor="vdr-referrer" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Referrer (optional)
								</label>
								<input
									id="vdr-referrer"
									type="text"
									autoComplete="off"
									enterKeyHint="next"
									value={referrerInput}
									onChange={(e) => setReferrerInput(e.target.value)}
									disabled={submitting || !canCreate}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
									placeholder="No referrer if empty"
								/>
								<p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
									Bound when this code is issued. On claim, the referrer extension credits this EOA for
									introduced validators (milestone reward nodes). Requires on-chain referrerExtension.
								</p>
							</div>

							<div>
								<label htmlFor="vdr-allowed-claimer" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Allowed claimer (optional)
								</label>
								<input
									id="vdr-allowed-claimer"
									type="text"
									autoComplete="off"
									enterKeyHint="done"
									value={allowedClaimerInput}
									onChange={(e) => setAllowedClaimerInput(e.target.value)}
									disabled={submitting || !canCreate}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
									placeholder="Any wallet if empty"
								/>
								<p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
									Restricts who may submit the claim transaction (the signer / claimer EOA). Leave empty for any
									wallet. This is not the beneficiary — the beneficiary is chosen when the code is redeemed.
								</p>
							</div>

							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800">
								<button
									type="button"
									role="switch"
									aria-checked={airdrop}
									onClick={() => setAirdrop((v) => !v)}
									disabled={submitting || !canCreate}
									className="flex w-full items-center justify-between gap-3 disabled:opacity-60"
								>
									<span className="flex items-center gap-2.5 text-left">
										<span
											className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
												airdrop ? 'bg-[#1562f0] text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
											}`}
										>
											<Gift className="h-4.5 w-4.5" aria-hidden />
										</span>
										<span className="flex flex-col">
											<span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Airdrop</span>
											<span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
												Accrues 100 CNET per validator node on claim, claimable after the on-chain date.
											</span>
										</span>
									</span>
									<span
										className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
											airdrop ? 'bg-[#1562f0]' : 'bg-slate-300 dark:bg-slate-600'
										}`}
									>
										<span
											className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
												airdrop ? 'translate-x-[22px]' : 'translate-x-0.5'
											}`}
										/>
									</span>
								</button>
								{airdrop ? (
									<p className="mt-2 text-[11px] font-semibold tabular-nums text-[#1562f0]">
										≈ {100 * Math.max(0, Number(validatorCountInput) || 0)} CNET airdrop on claim
									</p>
								) : null}
							</div>

							{formError ? (
								<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<span>{formError}</span>
								</div>
							) : null}

							<button
								type="button"
								onClick={() => void handleCreate()}
								disabled={submitting || !canCreate}
								className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(21,98,240,0.35)] disabled:opacity-60"
							>
								{submitting ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Creating…
									</>
								) : (
									'Create Redeem Code'
								)}
							</button>
						</div>
					</section>

					<section className="mt-4 space-y-3">
						<div className="flex items-center justify-between px-1">
							<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Issued codes</h3>
							{loadingRows ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden /> : null}
						</div>

						{rows.length === 0 ? (
							<p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
								No redeem codes on this device yet.
							</p>
						) : (
							rows.map((row) => {
								const displayStatus = resolveValidatorDepositRedeemDisplayStatus({
									localStatus: row.localStatus,
									chain:
										row.chainActive != null
											? {
													ok: true,
													exists: true,
													allowedClaimer: row.allowedClaimer,
													referrer: row.referrer ?? ethers.ZeroAddress,
													validatorCount: row.validatorCount,
													targetNodeIp: row.targetNodeIp,
													gbMiningNodeCount: row.gbMiningNodeCount,
													validAfter: row.validAfter,
													validBefore: row.validBefore,
													active: Boolean(row.chainActive),
													consumed: Boolean(row.chainConsumed),
												}
											: null,
								})
								const canCancel = displayStatus === 'pending' && canCreate
								return (
									<div
										key={row.id}
										className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<span
														className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusChipClass(displayStatus)}`}
													>
														{validatorDepositRedeemStatusLabel(displayStatus)}
													</span>
													<span className="text-xs text-slate-500">
														{row.validatorCount} validator{row.validatorCount === '1' ? '' : 's'} · IP {row.targetNodeIp}
													</span>
													{row.airdrop ? (
														<span className="inline-flex items-center gap-1 rounded-full border border-[#1562f0]/30 bg-[#1562f0]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1562f0]">
															<Gift className="h-3 w-3" aria-hidden />
															Airdrop
														</span>
													) : null}
												</div>
												<p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Secret code</p>
												<p className="mt-0.5 break-all font-mono text-sm text-slate-900 dark:text-slate-100">{row.secretCode}</p>
												{row.referrer && row.referrer !== ethers.ZeroAddress ? (
													<p className="mt-1 font-mono text-[10px] text-slate-500">
														Referrer {row.referrer.slice(0, 6)}…{row.referrer.slice(-4)}
													</p>
												) : null}
												{row.createTxHash ? (
													<p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={row.createTxHash}>
														Create tx {row.createTxHash.slice(0, 10)}…{row.createTxHash.slice(-6)}
													</p>
												) : null}
											</div>
											<div className="flex shrink-0 flex-col gap-2">
												<button
													type="button"
													onClick={() => void copyCode(row)}
													className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#1562f0] dark:border-slate-600 dark:bg-slate-800"
													aria-label="Copy redeem code"
												>
													{copiedId === row.id ? (
														<Check className="h-4 w-4 text-emerald-500" aria-hidden />
													) : (
														<Copy className="h-4 w-4" aria-hidden />
													)}
												</button>
												{canCancel ? (
													<button
														type="button"
														onClick={() => void handleCancel(row)}
														disabled={cancellingId === row.id}
														className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 disabled:opacity-60 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
														aria-label="Cancel redeem"
													>
														{cancellingId === row.id ? (
															<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
														) : (
															<Ban className="h-4 w-4" aria-hidden />
														)}
													</button>
												) : null}
											</div>
										</div>
									</div>
								)
							})
						)}
					</section>
				</div>
			</div>
		</div>
	)
}
