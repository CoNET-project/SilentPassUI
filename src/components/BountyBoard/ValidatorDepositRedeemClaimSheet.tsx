import React, { useCallback, useState } from 'react'
import { X, Loader2, Ticket, ShieldCheck } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	previewValidatorDepositRedeemClaim,
	signAndSubmitValidatorDepositRedeemClaim,
	type ValidatorDepositRedeemClaimPreview,
} from '@/services/validatorDepositRedeemClaim'

type Props = {
	open: boolean
	onClose: () => void
	claimerEoa: string
	onClaimSuccess?: () => void
}

export function ValidatorDepositRedeemClaimSheet({ open, onClose, claimerEoa, onClaimSuccess }: Props) {
	const { profiles } = useDaemonContext()
	const [codeInput, setCodeInput] = useState('')
	const [preview, setPreview] = useState<ValidatorDepositRedeemClaimPreview | null>(null)
	const [previewLoading, setPreviewLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [formError, setFormError] = useState('')

	const resetForm = useCallback(() => {
		setCodeInput('')
		setPreview(null)
		setFormError('')
	}, [])

	const handleClose = useCallback(() => {
		resetForm()
		onClose()
	}, [onClose, resetForm])

	const handleVerify = useCallback(async () => {
		setFormError('')
		setPreview(null)
		setPreviewLoading(true)
		try {
			const result = await previewValidatorDepositRedeemClaim({
				secretCode: codeInput,
				claimerEoa,
			})
			setPreview(result)
			if (!result.ok) setFormError(result.error)
		} finally {
			setPreviewLoading(false)
		}
	}, [claimerEoa, codeInput])

	const handleClaim = useCallback(async () => {
		setFormError('')
		const armor = resolveSigningPrivateKeyArmor(profiles?.[0])
		if (!armor) {
			setFormError('Unlock your wallet to sign the claim.')
			return
		}
		if (!codeInput.trim()) {
			setFormError('Enter a redeem code.')
			return
		}

		setSubmitting(true)
		try {
			const res = await signAndSubmitValidatorDepositRedeemClaim({
				claimerEoa,
				secretCode: codeInput.trim(),
				privateKeyArmor: armor,
			})
			if (!res.success) {
				setFormError(res.error)
				return
			}
			Toast.show({ content: 'Validator claim submitted', position: 'top' })
			onClaimSuccess?.()
			handleClose()
		} finally {
			setSubmitting(false)
		}
	}, [claimerEoa, codeInput, handleClose, onClaimSuccess, profiles])

	if (!open) return null

	const previewOk = preview?.ok === true ? preview.redeem : null

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45" role="dialog" aria-modal="true">
			<button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={handleClose} />
			<div
				className="relative z-10 flex max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-t-[28px] bg-[#F2F2F7] shadow-2xl dark:bg-slate-950"
				style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
			>
				<div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
					<div className="flex items-center gap-2.5">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1562f0] text-white">
							<Ticket className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</div>
						<div>
							<h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Claim validators</h2>
							<p className="text-xs text-slate-500">Redeem a code to allocate validator nodes</p>
						</div>
					</div>
					<button
						type="button"
						onClick={handleClose}
						className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
						aria-label="Close panel"
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
					<section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<p className="text-xs text-slate-500 dark:text-slate-400">
							Enter the secret redeem code from your operator. Your wallet signs the claim; gas is relayed by
							Beamio API.
						</p>

						<div className="mt-4 space-y-3">
							<div>
								<label htmlFor="vdr-claim-code" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
									Redeem code
								</label>
								<input
									id="vdr-claim-code"
									type="text"
									autoComplete="off"
									enterKeyHint="done"
									value={codeInput}
									onChange={(e) => {
										setCodeInput(e.target.value)
										setPreview(null)
										setFormError('')
									}}
									disabled={submitting}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
									placeholder="Paste redeem code"
								/>
							</div>

							<button
								type="button"
								onClick={() => void handleVerify()}
								disabled={previewLoading || submitting || !codeInput.trim()}
								className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
							>
								{previewLoading ? (
									<span className="inline-flex items-center justify-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Verifying…
									</span>
								) : (
									'Verify code'
								)}
							</button>

							{previewOk ? (
								<div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
									<div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-100">
										<ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
										<span className="text-sm font-semibold">Code valid — ready to claim</span>
									</div>
									<dl className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
										<div className="flex justify-between gap-2">
											<dt className="text-slate-500">Validators</dt>
											<dd className="font-bold tabular-nums">{previewOk.validatorCount}</dd>
										</div>
										<div className="flex justify-between gap-2">
											<dt className="text-slate-500">DePIN GB slots</dt>
											<dd className="font-bold tabular-nums">{previewOk.gbMiningNodeCount}</dd>
										</div>
										<div className="flex justify-between gap-2">
											<dt className="text-slate-500">Target node IP</dt>
											<dd className="truncate font-mono font-semibold">{previewOk.targetNodeIp || '—'}</dd>
										</div>
									</dl>
								</div>
							) : null}

							{formError ? (
								<p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
									{formError}
								</p>
							) : null}

							<button
								type="button"
								onClick={() => void handleClaim()}
								disabled={submitting || !codeInput.trim()}
								className="w-full rounded-xl bg-[#1562f0] py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
							>
								{submitting ? (
									<span className="inline-flex items-center justify-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Claiming…
									</span>
								) : (
									'Claim validators'
								)}
							</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}
