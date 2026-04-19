/**
 * BusinessStartKetRedeem admin: EIP-712 authorize create/cancel; beamio.app Cluster → Master relays gas on CoNET.
 * Each create mints Start Ket #0 ×1 plus the specified B-Unit (6 decimals) on redeem.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { X, Loader2, Check, AlertTriangle, RefreshCw, Copy, ExternalLink } from 'lucide-react'
import { conetDepinProvider } from '@/utils/constants'
import { CONET_BUSINESS_START_KET_REDEEM, CONET_BUINT_REDEEM_AIRDROP, CONET_MAINNET_CHAIN_ID } from '@/config/chainAddresses'
import KET_REDEEM_ADMIN_ABI from '@/services/ABI/BusinessStartKetRedeem_admin.json'
import { generateCODE } from '@/services/beamio'

const BEAMIO_API_ORIGIN = 'https://beamio.app'

/** CoNET Blockscout：用 /tx/路径展示 32-byte 十六进制（与交易哈希同形，便于在浏览器中查看该值） */
const CONET_EXPLORER_TX_BASE = 'https://mainnet.conet.network/tx'

const STORAGE_KEY = (eoa: string) => `beamio:business-start-ket-redeem-tracked:v1:${eoa.toLowerCase()}`

function shortenHash32(hex: string): string {
	const h = hex.trim()
	if (h.length < 12) return h
	return `${h.slice(0, 6)}…${h.slice(-4)}`
}

function conetExplorerUrlForHash(hex: string): string {
	return `${CONET_EXPLORER_TX_BASE}/${encodeURIComponent(hex)}`
}

/** 与地址胶囊一致：短缩 + 内联复制；点击短缩打开 CoNET 浏览器查看该 hash */
function HashCapsule({
	fullHash,
	copyKey,
	copiedKey,
	setCopiedKey,
	className = '',
}: {
	fullHash: string
	copyKey: string
	copiedKey: string | null
	setCopiedKey: (key: string | null) => void
	className?: string
}) {
	const explorerHref = conetExplorerUrlForHash(fullHash)
	const short = shortenHash32(fullHash)
	const copied = copiedKey === copyKey
	return (
		<div
			className={`inline-flex max-w-full items-center rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 ${className}`}
		>
			<a
				href={explorerHref}
				target="_blank"
				rel="noopener noreferrer"
				className="min-w-0 shrink pl-3 pr-1 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200 hover:opacity-90"
				title={fullHash}
			>
				{short}
			</a>
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					navigator.clipboard?.writeText(fullHash)
					setCopiedKey(copyKey)
				}}
				className="shrink-0 p-1.5 mr-0.5 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-700"
				aria-label="Copy full hash"
			>
				{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
			</button>
		</div>
	)
}

const KET_REDEEM_CREATE_TOKEN_ID = 0n
const KET_REDEEM_CREATE_KET_AMOUNT = 1n

const CREATE_TYPED_TYPES: Record<string, { name: string; type: string }[]> = {
	CreateRedeem: [
		{ name: 'admin', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'tokenId', type: 'uint256' },
		{ name: 'amount', type: 'uint256' },
		{ name: 'buintAmount', type: 'uint256' },
		{ name: 'validAfter', type: 'uint256' },
		{ name: 'validBefore', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

const CANCEL_TYPED_TYPES: Record<string, { name: string; type: string }[]> = {
	CancelRedeem: [
		{ name: 'admin', type: 'address' },
		{ name: 'codeHash', type: 'bytes32' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

function ketRedeemEip712Domain() {
	return {
		name: 'BusinessStartKetRedeem',
		version: '1',
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: ethers.getAddress(CONET_BUSINESS_START_KET_REDEEM),
	}
}

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

/** 与 BuintRedeemAirdrop / BusinessStartKetRedeem 的 `mapping(address => bool) public redeemAdmins` 对齐 */
const REDEEM_ADMIN_BOOL_ABI = ['function redeemAdmins(address) view returns (bool)'] as const

/**
 * History 顶部 Ticket 入口：任一合约上为 redeem admin 即显示。
 * （Sheet 内创建/取消仍仅针对 BusinessStartKetRedeem + beamio.app Master API；纯 BuintRedeemAirdrop admin 若需链上制码需另行接入。）
 */
export async function checkBuintRedeemAdmin(eoaAddress: string): Promise<boolean> {
	if (!eoaAddress || !ethers.isAddress(eoaAddress)) return false
	const addr = ethers.getAddress(eoaAddress)
	for (const contractAddress of [CONET_BUSINESS_START_KET_REDEEM, CONET_BUINT_REDEEM_AIRDROP]) {
		try {
			const c = new ethers.Contract(contractAddress, REDEEM_ADMIN_BOOL_ABI, conetDepinProvider)
			if (await c.redeemAdmins!(addr)) return true
		} catch {
			/* 错误地址 / RPC 失败则尝试下一合约 */
		}
	}
	return false
}

type ChainRow = BuintRedeemTracked & {
	tokenId: string
	ketAmount: string
	buintAmount: string
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
	const [lastCreatedCodeHash, setLastCreatedCodeHash] = useState<string | null>(null)
	const [cancelHash, setCancelHash] = useState<string | null>(null)
	const [formError, setFormError] = useState('')
	const [actionMsg, setActionMsg] = useState('')
	const [copiedHash, setCopiedHash] = useState<string | null>(null)

	const readContract = useCallback(
		() => new ethers.Contract(CONET_BUSINESS_START_KET_REDEEM, KET_REDEEM_ADMIN_ABI, conetDepinProvider),
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
						const tup = r as unknown as [bigint, bigint, bigint, bigint, bigint, boolean, boolean]
						return {
							...t,
							tokenId: String(tup[0] ?? 0n),
							ketAmount: String(tup[1] ?? 0n),
							buintAmount: String(tup[2] ?? 0n),
							validAfter: Number(tup[3] ?? 0n),
							validBefore: Number(tup[4] ?? 0n),
							active: Boolean(tup[5]),
							consumed: Boolean(tup[6]),
						} as ChainRow
					} catch {
						return {
							...t,
							tokenId: '0',
							ketAmount: '0',
							buintAmount: '0',
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
		setLastCreatedCodeHash(null)
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
			const admin = ethers.getAddress(wallet.address)
			if (admin !== ethers.getAddress(eoaAddress)) {
				setFormError('Wallet does not match your account')
				return
			}
			const rc = readContract()
			const nonce = await rc.redeemAdminNonces!(admin)
			const deadline = Math.floor(Date.now() / 1000) + 600
			const domain = ketRedeemEip712Domain()
			const message = {
				admin,
				codeHash,
				tokenId: KET_REDEEM_CREATE_TOKEN_ID,
				amount: KET_REDEEM_CREATE_KET_AMOUNT,
				buintAmount: amountWei,
				validAfter: 0n,
				validBefore: 0n,
				nonce,
				deadline: BigInt(deadline),
			}
			const signature = await wallet.signTypedData(domain, CREATE_TYPED_TYPES, message)

			setActionMsg('Submitting to beamio.app…')
			const resp = await fetch(`${BEAMIO_API_ORIGIN}/api/businessStartKetRedeemAdminCreate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					admin,
					codeHash,
					buintAmount: amountWei.toString(),
					validAfter: '0',
					validBefore: '0',
					nonce: nonce.toString(),
					deadline: String(deadline),
					signature,
				}),
			})
			const j = (await resp.json().catch(() => ({}))) as { success?: boolean; error?: string; txHash?: string }
			if (!resp.ok || !j.success) {
				throw new Error(j.error || `Create failed (${resp.status})`)
			}
			setActionMsg(j.txHash ? `Create confirmed. Tx: ${j.txHash.slice(0, 10)}…` : 'Create confirmed.')
			setLastCreatedPlainCode(plainCode)
			setLastCreatedCodeHash(codeHash)
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
			const admin = ethers.getAddress(wallet.address)
			if (admin !== ethers.getAddress(eoaAddress)) {
				setFormError('Wallet does not match your account')
				return
			}
			const rc = readContract()
			const nonce = await rc.redeemAdminNonces!(admin)
			const deadline = Math.floor(Date.now() / 1000) + 600
			const domain = ketRedeemEip712Domain()
			const message = {
				admin,
				codeHash,
				nonce,
				deadline: BigInt(deadline),
			}
			const signature = await wallet.signTypedData(domain, CANCEL_TYPED_TYPES, message)

			setActionMsg('Canceling via beamio.app…')
			const resp = await fetch(`${BEAMIO_API_ORIGIN}/api/businessStartKetRedeemAdminCancel`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					admin,
					codeHash,
					nonce: nonce.toString(),
					deadline: String(deadline),
					signature,
				}),
			})
			const j = (await resp.json().catch(() => ({}))) as { success?: boolean; error?: string; txHash?: string }
			if (!resp.ok || !j.success) {
				throw new Error(j.error || `Cancel failed (${resp.status})`)
			}
			setActionMsg(j.txHash ? `Cancel confirmed. Tx: ${j.txHash.slice(0, 10)}…` : 'Cancel confirmed.')
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
					<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ket + B-Unit Redeem Admin</h2>
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
						CoNET redeem codes via <code className="mx-1 font-mono text-[10px]">BusinessStartKetRedeem</code>: each create locks Start Ket #0 × 1
						plus your B-Unit amount (6 decimals). You sign EIP-712; gas is paid by the relay. Holders redeem with{' '}
						<code className="mx-1 font-mono text-[10px]">redeemWithCode(code)</code>.
					</p>
					{actionMsg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{actionMsg}</p> : null}
					{formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}
					{lastCreatedPlainCode ? (
						<div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-3">
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
							{lastCreatedCodeHash ? (
								<div className="space-y-1">
									<p className="text-[11px] font-medium text-emerald-800/90 dark:text-emerald-200/90">Code hash (on-chain)</p>
									<HashCapsule
										fullHash={lastCreatedCodeHash}
										copyKey="__last_created_hash__"
										copiedKey={copiedHash}
										setCopiedKey={setCopiedHash}
										className="border-emerald-200/80 dark:border-emerald-800/80 bg-white/50 dark:bg-slate-900/40"
									/>
								</div>
							) : null}
						</div>
					) : null}

					<form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
						<h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Create redeem</h3>
						<div>
							<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">B-Unit amount (Start Ket #0 × 1 included)</label>
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
							{submitting ? 'Sending…' : 'Sign & create (relay gas)'}
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
									const buintDisp = Number(row.buintAmount) / 1e6
									const ketN = Number(row.ketAmount)
									const contractExplorer = `https://mainnet.conet.network/address/${CONET_BUSINESS_START_KET_REDEEM}`
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
													<div className="mt-1">
														<HashCapsule
															fullHash={row.codeHash}
															copyKey={`hash:${row.codeHash}`}
															copiedKey={copiedHash}
															setCopiedKey={setCopiedHash}
														/>
													</div>
													{row.note ? <p className="text-xs text-slate-500 mt-0.5">{row.note}</p> : null}
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
														Start Ket #{row.tokenId} × {ketN}{' '}
														<span className="text-slate-500 font-normal">·</span> {buintDisp.toFixed(2)} B-Unit
													</p>
													<p className="text-[11px] text-slate-500">
														{row.active ? <span className="text-emerald-600 font-medium">Active</span> : null}
														{row.consumed ? <span className="text-slate-500"> · Consumed</span> : null}
														{!row.active && !row.consumed ? <span className="text-slate-400">Inactive</span> : null}
													</p>
												</div>
												<div className="flex flex-col gap-1 shrink-0">
													<a
														href={contractExplorer}
														target="_blank"
														rel="noopener noreferrer"
														className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex"
														aria-label="Open BusinessStartKetRedeem on explorer"
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
