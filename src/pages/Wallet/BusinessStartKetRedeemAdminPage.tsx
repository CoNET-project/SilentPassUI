import React, { useCallback, useEffect, useState, type KeyboardEvent, type WheelEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Copy, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useBusinessStartKetRedeemAdmin } from '@/hooks/useBusinessStartKetRedeemAdmin'
import { BeamioCircularBackButton, BEAMIO_CIRCULAR_BACK_ROW_CLASS } from '@/components/BeamioCircularBackButton'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	formatBuintAmount6ForDisplay,
	generateBusinessStartKetRedeemSecretCode,
	parseBuintAmount6FromDisplay,
	signAndSubmitBusinessStartKetRedeemCreate,
} from '@/services/businessStartKetRedeem'

const NUMERIC_SPINNER_HIDE =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

function preventNumericInputStepKeys(e: KeyboardEvent<HTMLInputElement>): void {
	const blocked = new Set([
		'ArrowUp',
		'ArrowDown',
		'PageUp',
		'PageDown',
		'Home',
		'End',
	])
	if (blocked.has(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericInputWheelStep(e: WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

type CreatedRedeemRow = {
	id: string
	code: string
	buintDisplay: string
	txHash?: string
	createdAt: number
}

export default function BusinessStartKetRedeemAdminPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)

	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const { isRedeemAdmin, loading: adminLoading } = useBusinessStartKetRedeemAdmin(eoa)
	const [buintInput, setBuintInput] = useState('2.00')
	const [submitting, setSubmitting] = useState(false)
	const [formError, setFormError] = useState('')
	const [createdRows, setCreatedRows] = useState<CreatedRedeemRow[]>([])
	const [copiedId, setCopiedId] = useState<string | null>(null)

	const handleCreate = useCallback(async () => {
		setFormError('')
		if (!eoa) {
			setFormError('Wallet EOA unavailable.')
			return
		}
		const buintAmount6 = parseBuintAmount6FromDisplay(buintInput)
		if (buintAmount6 == null) {
			setFormError('Enter a valid B-Unit amount greater than 0.')
			return
		}
		const armor = resolveSigningPrivateKeyArmor(profiles?.[0])
		if (!armor) {
			setFormError('Unlock your wallet to sign the redeem authorization.')
			return
		}

		const { code, codeHash } = generateBusinessStartKetRedeemSecretCode()
		setSubmitting(true)
		try {
			const res = await signAndSubmitBusinessStartKetRedeemCreate({
				adminEoa: eoa,
				codeHash,
				buintAmount6,
				privateKeyArmor: armor,
			})
			if (!res.success) {
				setFormError(res.error)
				return
			}
			const row: CreatedRedeemRow = {
				id: codeHash,
				code,
				buintDisplay: formatBuintAmount6ForDisplay(buintAmount6),
				txHash: res.txHash,
				createdAt: Date.now(),
			}
			setCreatedRows((prev) => [row, ...prev])
			Toast.show({ content: 'Redeem code created', position: 'top' })
		} finally {
			setSubmitting(false)
		}
	}, [buintInput, eoa, profiles])

	const copyCode = useCallback(async (row: CreatedRedeemRow) => {
		try {
			await navigator.clipboard.writeText(row.code)
			setCopiedId(row.id)
			window.setTimeout(() => setCopiedId((cur) => (cur === row.id ? null : cur)), 2000)
		} catch {
			Toast.show({ content: 'Copy failed', position: 'top' })
		}
	}, [])

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		if (adminLoading || isRedeemAdmin === null) return
		if (!isRedeemAdmin) {
			navigate('/wallet', { replace: true })
		}
	}, [adminLoading, isRedeemAdmin, navigate])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	if (adminLoading || isRedeemAdmin !== true) {
		return (
			<div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-[#F2F2F7] text-slate-500">
				<Loader2 className="h-6 w-6 animate-spin text-[#1562f0]" aria-hidden />
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50">
			<div
				className="fixed left-4 right-4 z-40 flex items-center justify-between gap-2 transition-opacity duration-300"
				style={{
					top: 'max(1rem, env(safe-area-inset-top, 0px))',
					opacity: capsuleOpacity,
				}}
			>
				<div
					className="flex items-center gap-2.5 rounded-full border border-slate-100/90 bg-white py-2 pl-2 pr-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800"
					style={{ pointerEvents: capsulePointer }}
				>
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white">
						<Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</div>
					<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
						Redeem Admin
					</span>
				</div>
			</div>

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-10"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
				/>
				<main className="mx-auto w-full max-w-2xl space-y-6 px-6 pt-2">
					<div className={BEAMIO_CIRCULAR_BACK_ROW_CLASS}>
						<BeamioCircularBackButton
							onClick={() => navigate('/wallet')}
							className="absolute left-0 top-0 border-slate-200/80 bg-white/80 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
						/>
					</div>

					<section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
							Create Redeem Code
						</h2>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
							Each code airdrops Ket #0 ×1 plus the B-Unit amount you specify. The secret code is shown
							only once — copy it before leaving this page.
						</p>

						<div className="mt-5 space-y-4">
							<div>
								<label htmlFor="buint-amount" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									B-Unit amount
								</label>
								<input
									id="buint-amount"
									type="number"
									inputMode="decimal"
									autoComplete="off"
									enterKeyHint="done"
									min={0}
									step="0.01"
									value={buintInput}
									onChange={(e) => setBuintInput(e.target.value)}
									onKeyDown={preventNumericInputStepKeys}
									onWheel={preventNumericInputWheelStep}
									disabled={submitting}
									className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 ${NUMERIC_SPINNER_HIDE}`}
									placeholder="2.00"
								/>
								<p className="mt-1.5 text-xs text-slate-400">Displayed with 2 decimal places (6-digit on-chain precision).</p>
							</div>

							{formError ? (
								<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<span>{formError}</span>
								</div>
							) : null}

							<button
								type="button"
								onClick={() => void handleCreate()}
								disabled={submitting}
								className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1562f0] py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(21,98,240,0.35)] transition active:scale-[0.98] disabled:opacity-60"
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

					{createdRows.length > 0 ? (
						<section className="space-y-3">
							<h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
								Created this session
							</h3>
							{createdRows.map((row) => (
								<div
									key={row.id}
									className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
												Secret code
											</p>
											<p className="mt-1 break-all font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
												{row.code}
											</p>
											<p className="mt-2 text-xs text-slate-500">
												B-Unit: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">{row.buintDisplay}</span>
												{' · '}
												Ket #0 ×1
											</p>
											{row.txHash ? (
												<p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={row.txHash}>
													Tx {row.txHash.slice(0, 10)}…{row.txHash.slice(-6)}
												</p>
											) : null}
										</div>
										<button
											type="button"
											onClick={() => void copyCode(row)}
											className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#1562f0] transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
											aria-label="Copy redeem code"
										>
											{copiedId === row.id ? (
												<Check className="h-4 w-4 text-emerald-500" aria-hidden />
											) : (
												<Copy className="h-4 w-4" aria-hidden />
											)}
										</button>
									</div>
								</div>
							))}
						</section>
					) : null}
				</main>
			</div>
		</div>
	)
}
