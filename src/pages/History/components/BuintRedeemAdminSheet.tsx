/**
 * B-Unit redeem admin: create / cancel on CoNET BuintRedeemAirdrop (EOA must be redeemAdmins on-chain).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { X, Loader2, Check, AlertTriangle, RefreshCw, Copy, ExternalLink } from 'lucide-react'
import { conetDepinProvider } from '@/utils/constants'
import { CONET_BUINT_REDEEM_AIRDROP } from '@/config/chainAddresses'
import BUINT_REDEEM_ADMIN_ABI from '@/services/ABI/BuintRedeemAirdrop_admin.json'
import { generateCODE } from '@/services/beamio'

const STORAGE_KEY = (eoa: string) => `beamio:buint-redeem-tracked:v1:${eoa.toLowerCase()}`

export type BuintRedeemTracked = {
	codeHash: string
	/** Redeem string for `redeemWithCode` (from `generateCODE` `.code`; with empty passcode this is the full secret) */
	plainCode?: string
	note?: string
	createdAt: number
}

function loadTracked(eoa: string): BuintRedeemTracked[] {
	if (typeof window === 'undefined' || !eoa) return []
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY(eoa))
		if (!raw) return []
		const parsed = JSON.parse(raw) as BuintRedeemTracked[]
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function saveTracked(eoa: string, rows: BuintRedeemTracked[]) {
	if (typeof window === 'undefined' || !eoa) return
	try {
		window.localStorage.setItem(STORAGE_KEY(eoa), JSON.stringify(rows))
	} catch {}
}

export async function checkBuintRedeemAdmin(eoaAddress: string): Promise<boolean> {
	if (!eoaAddress || !ethers.isAddress(eoaAddress)) return false
	const c = new ethers.Contract(CONET_BUINT_REDEEM_AIRDROP, BUINT_REDEEM_ADMIN_ABI, conetDepinProvider)
	try {
		return await c.redeemAdmins!(ethers.getAddress(eoaAddress))
	} catch {
		return false
	}
}

type ChainRow = BuintRedeemTracked & {
	amount: string
	validAfter: number
	validBefore: number
	active: boolean
	consumed: boolean
}

type RefreshStatus = 'idle' | 'loading' | 'success' | 'error'

type Props = {
	open: boolean
	onClose: () => void
	eoaAddress: string
	privateKeyArmor: string
}

export default function BuintRedeemAdminSheet({ open, onClose, eoaAddress, privateKeyArmor }: Props) {
	const [chainRows, setChainRows] = useState<ChainRow[]>([])
	const [listLoading, setListLoading] = useState(false)
	const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>('idle')

	const [amountBuint, setAmountBuint] = useState('10')
	const [submitting, setSubmitting] = useState(false)
	const [lastCreatedPlainCode, setLastCreatedPlainCode] = useState<string | null>(null)
	const [cancelHash, setCancelHash] = useState<string | null>(null)
	const [formError, setFormError] = useState('')
	const [actionMsg, setActionMsg] = useState('')
	const [copiedHash, setCopiedHash] = useState<string | null>(null)

	const readContract = useCallback(
		() => new ethers.Contract(CONET_BUINT_REDEEM_AIRDROP, BUINT_REDEEM_ADMIN_ABI, conetDepinProvider),
		[]
	)

	const refreshChainRows = useCallback(async () => {
		if (!eoaAddress) return
		const rows = loadTracked(eoaAddress)
		if (rows.length === 0) {
			setChainRows([])
			return
		}
		setListLoading(true)
		try {
			const rc = readContract()
			const enriched = await Promise.all(
				rows.map(async (t) => {
					try {
						const r = await rc.getRedeem!(t.codeHash)
						const tup = r as unknown as [bigint, bigint, bigint, boolean, boolean]
						return {
							...t,
							amount: String(tup[0] ?? 0n),
							validAfter: Number(tup[1] ?? 0n),
							validBefore: Number(tup[2] ?? 0n),
							active: Boolean(tup[3]),
							consumed: Boolean(tup[4]),
						} as ChainRow
					} catch {
						return {
							...t,
							amount: '0',
							validAfter: 0,
							validBefore: 0,
							active: false,
							consumed: false,
						} as ChainRow
					}
				})
			)
			setChainRows(enriched)
		} finally {
			setListLoading(false)
		}
	}, [eoaAddress, readContract])

	useEffect(() => {
		if (!open || !eoaAddress) return
		void refreshChainRows()
	}, [open, eoaAddress, refreshChainRows])

	useEffect(() => {
		if (!copiedHash) return
		const t = setTimeout(() => setCopiedHash(null), 2000)
		return () => clearTimeout(t)
	}, [copiedHash])

	const handleTopRefresh = async () => {
		if (refreshStatus === 'loading') return
		setRefreshStatus('loading')
		try {
			await refreshChainRows()
			setRefreshStatus('success')
			setTimeout(() => setRefreshStatus('idle'), 3000)
		} catch {
			setRefreshStatus('error')
			setTimeout(() => setRefreshStatus('idle'), 3000)
		}
	}

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		setFormError('')
		setActionMsg('')
		setLastCreatedPlainCode(null)
		const amountNum = parseFloat(amountBuint)
		if (!Number.isFinite(amountNum) || amountNum <= 0) {
			setFormError('Amount must be a positive number')
			return
		}
		const amountWei = BigInt(Math.round(amountNum * 1e6))
		if (amountWei > BigInt('0xffffffffffffffffffffffffffffffff')) {
			setFormError('Amount too large')
			return
		}

		const { code: plainCode, hash: codeHash } = generateCODE('')

		setSubmitting(true)
		try {
			const wallet = new ethers.Wallet(privateKeyArmor, conetDepinProvider)
			if (ethers.getAddress(wallet.address) !== ethers.getAddress(eoaAddress)) {
				setFormError('Wallet does not match your account')
				return
			}
			const wc = new ethers.Contract(CONET_BUINT_REDEEM_AIRDROP, BUINT_REDEEM_ADMIN_ABI, wallet)
			const tx = await wc.createRedeem!(codeHash, amountWei, 0n, 0n)
			setActionMsg(`Submitted: ${tx.hash.slice(0, 10)}…`)
			await tx.wait()
			setActionMsg('Create confirmed on-chain.')
			setLastCreatedPlainCode(plainCode)
			const next: BuintRedeemTracked[] = [
				...loadTracked(eoaAddress).filter((x) => x.codeHash.toLowerCase() !== codeHash.toLowerCase()),
				{ codeHash, plainCode, createdAt: Date.now() },
			]
			saveTracked(eoaAddress, next)
			await refreshChainRows()
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			setFormError(msg)
		} finally {
			setSubmitting(false)
		}
	}

	const handleCancel = async (codeHash: string) => {
		setFormError('')
		setActionMsg('')
		setCancelHash(codeHash)
		try {
			const wallet = new ethers.Wallet(privateKeyArmor, conetDepinProvider)
			const wc = new ethers.Contract(CONET_BUINT_REDEEM_AIRDROP, BUINT_REDEEM_ADMIN_ABI, wallet)
			const tx = await wc.cancelRedeem!(codeHash)
			setActionMsg(`Cancel submitted: ${tx.hash.slice(0, 10)}…`)
			await tx.wait()
			setActionMsg('Cancel confirmed.')
			await refreshChainRows()
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			setFormError(msg)
		} finally {
			setCancelHash(null)
		}
	}

	if (!open) return null

	return (
		<div className="fixed inset-0 z-[100] pointer-events-auto">
			<div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} aria-hidden />
			<div className="absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl flex flex-col">
				<div className="pt-2 pb-1 flex justify-center shrink-0">
					<div className="h-1 w-10 rounded-full bg-slate-500/70" />
				</div>
				<div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 shrink-0">
					<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">B-Unit Redeem Admin</h2>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handleTopRefresh}
							disabled={refreshStatus !== 'idle' || listLoading}
							className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400"
							aria-label="Refresh list"
						>
							{refreshStatus === 'loading' || listLoading ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : refreshStatus === 'success' ? (
								<Check className="w-5 h-5 text-emerald-500" />
							) : refreshStatus === 'error' ? (
								<AlertTriangle className="w-5 h-5 text-amber-500" />
							) : (
								<RefreshCw className="w-5 h-5" />
							)}
						</button>
						<button
							type="button"
							onClick={onClose}
							className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
							aria-label="Close"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
					<p className="text-xs text-slate-500 dark:text-slate-400">
						B-Unit (6 decimals) redeem codes on CoNET. Each create uses <code className="mx-1 font-mono text-[10px]">generateCODE</code>
						(hash + code). You pay CoNET gas; the holder redeems with <code className="mx-1 font-mono text-[10px]">redeemWithCode(code)</code>.
					</p>
					{actionMsg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{actionMsg}</p> : null}
					{formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}
					{lastCreatedPlainCode ? (
						<div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-2">
							<p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Redeem code (share this; local copy below)</p>
							<div className="flex items-center gap-2 min-w-0">
								<code className="flex-1 min-w-0 text-xs font-mono text-slate-900 dark:text-slate-100 break-all">{lastCreatedPlainCode}</code>
								<button
									type="button"
									onClick={() => {
										navigator.clipboard?.writeText(lastCreatedPlainCode)
										setCopiedHash('__last_created_code__')
									}}
									className="shrink-0 p-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/80"
									aria-label="Copy redeem code"
								>
									{copiedHash === '__last_created_code__' ? (
										<Check className="w-4 h-4 text-emerald-500" />
									) : (
										<Copy className="w-4 h-4 text-slate-600" />
									)}
								</button>
							</div>
						</div>
					) : null}

					<form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
						<h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Create redeem</h3>
						<div>
							<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">B-Unit amount</label>
							<input
								type="number"
								inputMode="decimal"
								value={amountBuint}
								onChange={(ev) => setAmountBuint(ev.target.value)}
								className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
								min={0}
								step="0.000001"
								autoComplete="off"
								enterKeyHint="done"
							/>
						</div>
						<button
							type="submit"
							disabled={submitting}
							className="w-full py-3 rounded-xl bg-[#1562f0] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
						>
							{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
							{submitting ? 'Sending…' : 'Create on-chain'}
						</button>
					</form>

					<div>
						<h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Tracked redeems (this device)</h3>
						{listLoading && chainRows.length === 0 ? (
							<div className="flex justify-center py-8">
								<Loader2 className="w-8 h-8 animate-spin text-slate-400" />
							</div>
						) : chainRows.length === 0 ? (
							<p className="text-sm text-slate-500 dark:text-slate-400 py-4">No entries yet. After you create a code, it appears here.</p>
						) : (
							<ul className="space-y-3">
								{chainRows.map((row) => {
									const amt = Number(row.amount) / 1e6
									const short = `${row.codeHash.slice(0, 10)}…${row.codeHash.slice(-6)}`
									const explorer = `https://mainnet.conet.network/address/${CONET_BUINT_REDEEM_AIRDROP}`
									const plain = row.plainCode?.trim()
									return (
										<li
											key={row.codeHash}
											className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2"
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													{plain ? (
														<div className="flex items-center gap-1 min-w-0">
															<p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate" title={plain}>
																{plain.length > 24 ? `${plain.slice(0, 14)}…${plain.slice(-8)}` : plain}
															</p>
															<button
																type="button"
																onClick={() => {
																	navigator.clipboard?.writeText(plain)
																	setCopiedHash(`plain:${row.codeHash}`)
																}}
																className="shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
																aria-label="Copy redeem code"
															>
																{copiedHash === `plain:${row.codeHash}` ? (
																	<Check className="w-3.5 h-3.5 text-emerald-500" />
																) : (
																	<Copy className="w-3.5 h-3.5 text-slate-500" />
																)}
															</button>
														</div>
													) : null}
													<p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate" title={row.codeHash}>
														{short}
													</p>
													{row.note ? <p className="text-xs text-slate-500 mt-0.5">{row.note}</p> : null}
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
														{amt.toFixed(2)} B-Unit
													</p>
													<p className="text-[11px] text-slate-500">
														{row.active ? <span className="text-emerald-600 font-medium">Active</span> : null}
														{row.consumed ? <span className="text-slate-500"> · Consumed</span> : null}
														{!row.active && !row.consumed ? <span className="text-slate-400">Inactive</span> : null}
													</p>
												</div>
												<div className="flex flex-col gap-1 shrink-0">
													<button
														type="button"
														onClick={() => {
															navigator.clipboard?.writeText(row.codeHash)
															setCopiedHash(row.codeHash)
														}}
														className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
														aria-label="Copy code hash"
													>
														{copiedHash === row.codeHash ? (
															<Check className="w-4 h-4 text-emerald-500" />
														) : (
															<Copy className="w-4 h-4 text-slate-500" />
														)}
													</button>
													<a
														href={explorer}
														target="_blank"
														rel="noopener noreferrer"
														className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex"
														aria-label="Open contract on explorer"
													>
														<ExternalLink className="w-4 h-4 text-slate-500" />
													</a>
												</div>
											</div>
											{row.active ? (
												<button
													type="button"
													onClick={() => handleCancel(row.codeHash)}
													disabled={cancelHash !== null}
													className="w-full py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold disabled:opacity-50"
												>
													{cancelHash === row.codeHash ? (
														<span className="inline-flex items-center justify-center gap-2">
															<Loader2 className="w-4 h-4 animate-spin" /> Canceling…
														</span>
													) : (
														'Cancel redeem'
													)}
												</button>
											) : null}
										</li>
									)
								})}
							</ul>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
