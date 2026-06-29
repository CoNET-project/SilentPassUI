import React, { useCallback, useMemo, useState } from 'react'
import { X, Lock, Loader2, Check, AlertTriangle, ArrowDownToLine } from 'lucide-react'
import type { AirdropInfo } from '@/services/validatorWalletNodeProfile'
import {
	releaseValidatorDepositRedeemAirdropSelf,
	VALIDATOR_DEPOSIT_REDEEM_AIRDROP_VESTING_DURATION_SECONDS,
} from '@/services/validatorDepositRedeemAirdrop'
import { showBeamioToast, showBeamioToastError } from '@/locale/beamioToast'

type Props = {
	open: boolean
	onClose: () => void
	airdrop: AirdropInfo | null
	/** Beneficiary EOA (Main Wallet) that signs + pays gas for the self release. */
	eoa: string | null
}

type ReleaseStatus = 'idle' | 'loading' | 'success' | 'error'

/** CNET 数字展示：两位小数（如 100.00）。 */
function formatCnet(value: string | number): string {
	const n = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(n)) return String(value)
	return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** unix 秒 → UTC 日期（如 "Dec 1, 2026 UTC"）；0/无效返回 null。 */
function formatDate(unixSec: number): string | null {
	if (!Number.isFinite(unixSec) || unixSec <= 0) return null
	const d = new Date(unixSec * 1000)
	if (Number.isNaN(d.getTime())) return null
	return `${d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	})} UTC`
}

/**
 * Genesis Loyalty Reward — bottom-up drawer opened from the L1 GAS EARNED "Vesting" line.
 *
 * 链上模型（ValidatorDepositRedeem，单一事实来源）：6 个月线性解锁。
 * - `AIRDROP_CNET_PER_NODE = 100 CNET`，每历史节点授予 100 CNET（accrued）。
 * - `claimableAt`：链上线性解锁起始 unix 秒；其后 180 天内按比例解锁，满 180 天解锁全部 accrued。
 * - `claimable`（来自合约 airdropInfoOf）= 当前已解锁未领取额（vested − claimed）。
 * - 释放：用户用 EOA 签名并自付 gas 直接提交 claimAirdropFor，释放当前可解锁额到 Main Wallet。
 *
 * 解锁起始/结束日期一律取链上 `claimableAt` + 固定 180 天周期，不在前端编造任意日期。
 */
export function GenesisLoyaltyVestingSheet({ open, onClose, airdrop, eoa }: Props) {
	const [status, setStatus] = useState<ReleaseStatus>('idle')

	const view = useMemo(() => {
		const accrued = Number(airdrop?.accrued ?? '0')
		const claimed = Number(airdrop?.claimed ?? '0')
		const releasable = Number(airdrop?.claimable ?? '0') // vested − claimed (on-chain)
		const startAt = airdrop?.claimableAt ?? 0
		const endAt = startAt > 0 ? startAt + VALIDATOR_DEPOSIT_REDEEM_AIRDROP_VESTING_DURATION_SECONDS : 0
		const startDate = formatDate(startAt)
		const endDate = formatDate(endAt)
		const nowSec = Math.floor(Date.now() / 1000)
		const started = startAt > 0 && nowSec >= startAt
		const vested = Math.max(0, Math.min(accrued, claimed + releasable))
		const pct = accrued > 0 ? Math.max(0, Math.min(100, Math.round((vested / accrued) * 100))) : 0
		return { accrued, claimed, releasable, startAt, startDate, endDate, started, vested, pct }
	}, [airdrop])

	const canRelease = status !== 'loading' && view.releasable > 0 && view.started && !!eoa

	const handleRelease = useCallback(async () => {
		if (!eoa) {
			showBeamioToast('Unlock your wallet to claim the airdrop.')
			return
		}
		setStatus('loading')
		try {
			const res = await releaseValidatorDepositRedeemAirdropSelf({ beneficiaryEoa: eoa })
			if (res.success) {
				setStatus('success')
				showBeamioToast('Claim submitted — CNET is on its way to your Main Wallet.')
				window.setTimeout(() => setStatus('idle'), 3000)
			} else {
				setStatus('error')
				showBeamioToastError(res.error)
				window.setTimeout(() => setStatus('idle'), 3000)
			}
		} catch (e: unknown) {
			setStatus('error')
			showBeamioToastError(e)
			window.setTimeout(() => setStatus('idle'), 3000)
		}
	}, [eoa])

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45" role="dialog" aria-modal="true">
			<button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
			<div
				className="relative z-10 flex max-h-[min(92dvh,680px)] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-slate-950"
				style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
			>
				<div className="flex items-start justify-between gap-3 px-6 pt-6">
					<div className="flex items-center gap-2.5">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0]/10 text-[#1562f0]">
							<Lock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</div>
						<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
							Genesis Loyalty Reward
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
						aria-label="Close panel"
					>
						<X className="h-5 w-5" aria-hidden />
					</button>
				</div>

				<div className="overflow-y-auto px-6 pt-3">
					<p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
						100 $CNET per historical node. Vests linearly over 6 months{' '}
						{view.startDate
							? view.started
								? `(started ${view.startDate}${view.endDate ? `, fully unlocks ${view.endDate}` : ''}).`
								: `starting ${view.startDate}.`
							: '(start date to be announced).'}
					</p>

					{/* Available to claim (currently unlockable amount) */}
					<div className="mt-5 rounded-2xl border border-[#1562f0]/15 bg-[#1562f0]/5 px-4 py-4">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-[#1562f0]">Available to Claim</p>
						<p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
							{formatCnet(view.releasable)}{' '}
							<span className="text-base font-semibold text-slate-400">CNET</span>
						</p>
						<p className="mt-0.5 text-xs text-slate-400">Tokens remain in smart contract until claimed.</p>
					</div>

					{/* Vesting progress */}
					<div className="mt-5 flex items-baseline justify-between gap-2 text-sm">
						<span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
							Total Vested: {formatCnet(view.vested)} / {formatCnet(view.accrued)}
						</span>
						<span className="font-semibold tabular-nums text-slate-400">{view.pct}%</span>
					</div>
					<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
						<div
							className="h-full rounded-full bg-[#1562f0] transition-[width] duration-500"
							style={{ width: `${view.pct}%` }}
						/>
					</div>

					<div className="mt-4 flex items-baseline justify-between gap-2 text-sm">
						<span className="text-slate-500 dark:text-slate-400">Already Claimed:</span>
						<span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
							{formatCnet(view.claimed)} $CNET
						</span>
					</div>
				</div>

				<div className="px-6 pb-6 pt-5">
					<button
						type="button"
						onClick={handleRelease}
						disabled={!canRelease}
						className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1562f0] py-3.5 text-base font-bold text-white transition hover:bg-[#1257d6] disabled:cursor-not-allowed disabled:opacity-40"
					>
						{status === 'loading' ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								Claiming…
							</>
						) : status === 'success' ? (
							<>
								<Check className="h-4 w-4" aria-hidden />
								Claimed
							</>
						) : status === 'error' ? (
							<>
								<AlertTriangle className="h-4 w-4" aria-hidden />
								Try again
							</>
						) : (
							<>
								<ArrowDownToLine className="h-4 w-4" aria-hidden />
								Claim to Wallet
							</>
						)}
					</button>
					<p className="mt-2.5 text-center text-[11px] leading-relaxed text-slate-400">
						{view.releasable > 0
							? 'Claimed to your Main Wallet (EOA). Network gas is paid from your wallet.'
							: view.started
								? 'No CNET unlocked to claim yet.'
								: view.startDate
									? `Claiming opens once vesting begins on ${view.startDate}.`
									: 'Claiming opens once vesting begins.'}
					</p>
				</div>
			</div>
		</div>
	)
}
