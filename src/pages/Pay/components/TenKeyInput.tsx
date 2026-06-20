import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, QrCode, Loader, Check, X, RefreshCw, Zap, Copy, ExternalLink, SmartphoneNfc } from 'lucide-react'
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from 'ethers'
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { beamioApiBase, readContainerNonceFromAAStorage, signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen } from '@/services/AAaccount'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import contracts from '@/utils/contracts'
import { baseEndpoint, CCSA_Card_Address, USDCContract_BASE, BeamioCardFactorySC } from '@/utils/constants'
import { searchUsername, fetchNfcCardStatus, payByNfcUid } from '@/services/beamio'
import { useNfcRead } from '@/hooks/useNfcRead'
import { formatAmount } from '@/services/currency'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { tu } from '@/locale/beamioLocale'


//		
interface TenKeyInputProps {
	value: string
	onChange: (value: string) => void
	maxLength?: number
	allowDecimal?: boolean
	label?: string
	currency?: string
	onScanUser?: () => void
	onShowQR?: () => void
	onPaymentWithNfc?: () => void
	/** 显示在金额与键盘之间的错误信息（如 QR 最大金额不足） */
	errorMessage?: string
}

const TenKeyInput = ({ 
	value, 
	onChange, 
	maxLength = 10,
	allowDecimal = false,
	label = "输入收款金额 (CAD)",
	currency = "$",
	onScanUser,
	onShowQR,
	onPaymentWithNfc,
	errorMessage,
}: TenKeyInputProps) => {
	const handleKeyClick = (key: number | string) => {
		if (key === 'del') {
			onChange(value.slice(0, -1))
		} else {
			// 限制最大长度为 maxLength（默认 10 位）
			if (value.length < maxLength) {
				// 如果允许小数点，检查是否已经存在小数点
				if (key === '.' && allowDecimal) {
					if (!value.includes('.')) {
						onChange(value + key)
					}
				} else if (key !== '.') {
					onChange(value + key)
				}
			}
		}
	}

	// 格式化显示值：添加货币符号
	const displayValue = value ? `${currency}${value}` : `${currency}0`

	// 键盘布局：4x3 网格（按图片顺序：1-9, ., 0, del）
	const keys = allowDecimal 
		? [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'del']
		: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 'del']

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			{/* 顶部自适应区域：金额显示 */}
			<div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4">
				<p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-center">
					{label}
				</p>
				<div className="text-5xl sm:text-6xl font-black tracking-wider text-[#1d1d1f]">
					{displayValue}
				</div>
			</div>

			{/* 错误信息：金额与键盘之间 */}
			{errorMessage && (
				<div className="shrink-0 px-4 py-2 text-center">
					<p className="text-sm font-semibold text-red-600 dark:text-red-400">
						{errorMessage}
					</p>
				</div>
			)}

			{/* 数字键盘 - 最小 6rem，最大 10rem，空间不足时自适应缩小 */}
			<div className="min-h-[26rem] max-h-[50rem] shrink grid grid-cols-3 grid-rows-[repeat(4,minmax(0,1fr))] gap-1.5 sm:gap-2 px-3 pb-3">
				{keys.map((k) => (
					<button
						key={k}
						type="button"
						onClick={() => handleKeyClick(k)}
						className="min-h-0 h-full bg-gray-50 rounded-xl text-xl sm:text-2xl font-bold hover:bg-gray-100 active:scale-95 transition-all text-[#1d1d1f] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
						disabled={k === 'del' && !value}
					>
						{k === 'del' ? '←' : k}
					</button>
				))}
			</div>

			{/* 底部操作按钮 */}
			{(onScanUser || onShowQR || onPaymentWithNfc) && (
				<div className={`grid gap-2 shrink-0 px-3 pb-4 pt-1 ${onPaymentWithNfc ? 'grid-cols-3' : 'grid-cols-2'}`}>
					{onScanUser && (
						<button
							type="button"
							onClick={onScanUser}
							disabled={!value}
							className="h-14 rounded-xl bg-[#1562f0] text-white shadow-lg flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<Camera size={20} />
							<span className="text-[10px] font-bold uppercase tracking-wider">{tu('scan_user')}</span>
						</button>
					)}
					{onPaymentWithNfc && (
						<button
							type="button"
							onClick={onPaymentWithNfc}
							disabled={!value}
							className="h-14 rounded-xl bg-[#0d9488] text-white shadow-lg flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<SmartphoneNfc size={20} />
							<span className="text-[10px] font-bold uppercase tracking-wider">NFC</span>
						</button>
					)}
					{onShowQR && (
						<button
							type="button"
							onClick={onShowQR}
							disabled={!value}
							className="h-14 rounded-xl bg-white border-2 border-[#1562f0] text-[#1562f0] flex flex-col items-center justify-center gap-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<QrCode size={20} />
							<span className="text-[10px] font-bold uppercase tracking-wider">SHOW QR</span>
						</button>
					)}
				</div>
			)}
		</div>
	)
}

type StepStatus = 'pending' | 'loading' | 'success' | 'error'
type RoutingStep = { id: string; label: string; detail: string; status: StepStatus }

// 4 steps shown in design; sendTx/waitTx shown only when loading or error (hidden when passed)
const ROUTING_STEPS: Omit<RoutingStep, 'status'>[] = [
	{ id: 'detectingUser', label: tu('detecting_user'), detail: '' },
	{ id: 'membership', label: tu('checking_membership'), detail: '' },
	{ id: 'analyzingAssets', label: tu('analyzing_assets'), detail: '' },
	{ id: 'optimizingRoute', label: tu('optimizing_route'), detail: '' },
	{ id: 'sendTx', label: tu('sending_transaction'), detail: '' },
	{ id: 'waitTx', label: tu('waiting_for_transaction'), detail: '' },
]
const VISIBLE_STEP_IDS = ['detectingUser', 'membership', 'analyzingAssets', 'optimizingRoute']

const STEP_ORDER = ROUTING_STEPS.map((s) => s.id)

const BASE_EXPLORER_TX = 'https://basescan.org/tx/'

const RPC_ERROR_MSG = tu('rpc')

const retryRpcCall = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
	let lastErr: unknown
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn()
		} catch (e) {
			lastErr = e
			if (i < retries) await new Promise((r) => setTimeout(r, 800))
		}
	}
	throw lastErr
}

function SmartRoutingAnalysis({ steps, onAbandon, onRetry, successTxHash }: { steps: RoutingStep[]; onAbandon?: () => void; onRetry?: () => void; successTxHash?: string }) {
	const hasError = steps.some((s) => s.status === 'error')

	// Steps not in the 4-panel design: show only when loading or error (hide when passed)
	const displaySteps = useMemo(() => {
		return steps.filter(
			(s) => VISIBLE_STEP_IDS.includes(s.id) || s.status === 'loading' || s.status === 'error'
		)
	}, [steps])

	const [completedIdsOrder, setCompletedIdsOrder] = useState<string[]>([])
	useEffect(() => {
		const allPending = displaySteps.every((s) => s.status === 'pending')
		if (allPending) {
			setCompletedIdsOrder([])
			return
		}
		setCompletedIdsOrder((prev) => {
			const next = [...prev]
			for (const id of STEP_ORDER) {
				const step = displaySteps.find((s) => s.id === id)
				if (step && step.status !== 'pending' && !next.includes(id)) next.unshift(id)
			}
			return next
		})
	}, [displaySteps])

	const displayOrder = useMemo(() => {
		const visible = displaySteps.filter((s) => s.status !== 'pending')
		if (visible.length === 0) return []
		const loadingOrError = visible.find((s) => s.status === 'loading' || s.status === 'error')
		const current = loadingOrError ?? visible[visible.length - 1]
		const completedSteps = completedIdsOrder
			.filter((id) => id !== current.id)
			.map((id) => displaySteps.find((s) => s.id === id))
			.filter((s): s is RoutingStep => s != null)
		return [current, ...completedSteps]
	}, [displaySteps, completedIdsOrder])

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 pt-[6rem]">
			<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center pt-8 pb-6">{tu('smart_routing_analysis')}</h2>
			<div className="flex flex-col gap-4 px-6 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
				<AnimatePresence initial={false}>
					{displayOrder.map((step, index) => (
						<motion.div
							key={step.id}
							layout
							initial={index === 0 ? { x: '100%', opacity: 0 } : false}
							animate={{ x: 0, opacity: 1 }}
							transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
							className="flex items-start gap-4 flex-shrink-0 ml-4"
						>
							<div
								className={[
									'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
									step.status === 'loading' && 'bg-blue-500',
									step.status === 'success' && 'bg-emerald-500',
									step.status === 'error' && 'bg-red-500',
									step.status === 'pending' && 'bg-slate-200 dark:bg-slate-600',
								].filter(Boolean).join(' ')}
							>
								{step.status === 'loading' && <Loader className="w-5 h-5 text-white animate-spin" />}
								{step.status === 'success' && <Check className="w-5 h-5 text-white" strokeWidth={2.5} />}
								{step.status === 'error' && <X className="w-5 h-5 text-white" strokeWidth={2.5} />}
								{step.status === 'pending' && <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-500" />}
							</div>
							<div className="min-w-0 flex-1 pt-0.5">
								<p className="font-semibold text-slate-800 dark:text-slate-200 text-[15px]">
									{step.label}
								</p>
								<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
									{step.detail}
								</p>
							</div>
							{step.status === 'error' && step.detail === RPC_ERROR_MSG && onRetry && (
								<button
									type="button"
									onClick={onRetry}
									className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center gap-1.5"
								>
									<RefreshCw className="w-4 h-4" strokeWidth={2.5} />{tu('try_again')}</button>
							)}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
			{(hasError || steps.some((s) => (s.id === 'sendTx' || s.id === 'waitTx') && (s.status === 'success' || s.status === 'error'))) && onAbandon && (
				<div className="shrink-0 px-6 pb-6 pt-4 space-y-3">
					{successTxHash && (
						<p className="text-sm text-center">
							<span className="text-slate-500 dark:text-slate-400 font-mono">
								{successTxHash.slice(0, 10)}…{successTxHash.slice(-8)}
							</span>
							{' · '}
							<button
								type="button"
								onClick={() => openExternalUrl(`${BASE_EXPLORER_TX}${successTxHash}`)}
								className="text-blue-600 dark:text-blue-400 hover:underline"
							>{tu('view_on_basescan')}</button>
						</p>
					)}
					<button
						type="button"
						onClick={onAbandon}
						className="w-full h-12 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-semibold active:scale-[0.98] transition-transform"
					>
						{hasError ? tu('ok') : tu('done')}
					</button>
				</div>
			)}
		</div>
	)
}

/** 提交前确认：展示扣款组合（USDC 余额 + CCSA 折算），受益方确认或取消。金额展示用 CAD（换算自链上汇率）。 */
export type ConfirmDeductionPayload = {
	payload: OpenContainerRelayPayload
	amountStr: string
	usdcFromBalance: string
	usdcFromCCSA: string
	customerUsdcBalance: string
	totalRequestedStr?: string
	hasDiscount?: boolean
	/** 展示用：换算后的 CAD 金额（链上 USDC→CAD） */
	amountStrCAD?: string
	usdcFromBalanceCAD?: string
	usdcFromCCSACAD?: string
	customerUsdcBalanceCAD?: string
	totalRequestedStrCAD?: string
	/** 顶部展示：扣款者（QR 持有者）Beamio 名称，无则用短地址 */
	payerDisplayName?: string
	/** 扣款者会员标签，如 CCSA Member (Genesis) */
	payerMemberLabel?: string
	/** 扣款者 Beamio 标签/全名（first_name + last_name），用于 Payer 区块展示 */
	payerBeamioTag?: string
	usdcFromBalanceWeiStr?: string
	ccsaPointsWeiStr?: string
	/** Bill 支付：无预签 payload，确认时由付款人签名；to 为 bill 的 AA */
	isBillPay?: boolean
	billPayeeAA?: string
	/** Bill 支付时：URL 中的 requestHash（bytes32），供记账写入 originalPaymentHash 以关联 request_create */
	billRequestHash?: string
	/** 请求备注 forText，供 BeamioIndexerDiamond displayJson 记账 */
	forText?: string
	/** Bill 支付时：请求方商家展示名（Beamio 名），无则用短地址 */
	payeeDisplayName?: string
	/** NFC 卡支付：使用 UID 调用 payByNfcUid 端点 */
	isNfcPay?: boolean
	nfcUid?: string
	/** Bill 支付时：商家会员标签（可选） */
	payeeMemberLabel?: string
}

function ConfirmDeductionView({
	data,
	onConfirm,
	onCancel,
	submitting,
}: {
	data: ConfirmDeductionPayload
	onConfirm: () => void
	onCancel: () => void
	submitting: boolean
}) {
	// 仅使用真实 container item 数据，与 POST/链上一致，不做多余再计算
	const amount = data.amountStrCAD ?? data.amountStr
	const totalReq = data.totalRequestedStrCAD ?? data.totalRequestedStr ?? data.amountStr ?? ''
	const fromBal = data.usdcFromBalanceCAD ?? data.usdcFromBalance
	const fromCCSA = data.usdcFromCCSACAD ?? data.usdcFromCCSA
	const discountVal = data.hasDiscount && data.totalRequestedStr != null && data.amountStr != null
		? (data.totalRequestedStrCAD != null && data.amountStrCAD != null
			? Number(data.totalRequestedStrCAD) - Number(data.amountStrCAD)
			: Number(data.totalRequestedStr) - Number(data.amountStr))
		: null
	const hasCCSA = Number(fromCCSA) > 0
	const hasUSDC = Number(fromBal) > 0
	const payerName = data.payerDisplayName ?? (data.payload?.account
		? `${data.payload.account.slice(0, 6)}…${data.payload.account.slice(-4)}`
		: tu('payer'))
	const isBillPay = !!data.isBillPay
	const payeeAddr = data.billPayeeAA ?? data.payload?.to ?? ''
	const payeeName = data.payeeDisplayName ?? (payeeAddr ? `${payeeAddr.slice(0, 6)}…${payeeAddr.slice(-4)}` : tu('merchant'))

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16">
			{/* 标题：Pay bill 时显示 */}
			{isBillPay && (
				<h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center mb-4">{tu('pay_bill')}</h1>
			)}
			{/* Bill 时显示请求方商家信息，否则显示 Payer (扣款者 / QR holder) 信息 */}
			<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 flex items-center gap-4 mb-6">
				<div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
					{isBillPay ? tu('pay_to') : tu('payer')}
				</div>
				<div className="min-w-0 flex-1">
					{isBillPay ? (
						<>
							<p className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">
								{data.payeeDisplayName ? `@${data.payeeDisplayName}` : payeeName}
							</p>
							{payeeAddr ? (
								<p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">
									{payeeAddr.slice(0, 6)}…{payeeAddr.slice(-4)}
								</p>
							) : null}
							{data.payeeMemberLabel && (
								<p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
									<span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
										<Check className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
									</span>
									{data.payeeMemberLabel}
								</p>
							)}
						</>
					) : (
						<>
							<p className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">
								{data.payerDisplayName ? `@${data.payerDisplayName}` : payerName}
							</p>
							{(data.payerBeamioTag || data.payerMemberLabel) && (
								<p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
									{data.payerMemberLabel && (
										<>
											<span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
												<Check className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
											</span>
											<span>{data.payerMemberLabel}</span>
										</>
									)}
									{data.payerBeamioTag && (
										<span>{data.payerMemberLabel ? ` · ${data.payerBeamioTag}` : data.payerBeamioTag}</span>
									)}
								</p>
							)}
						</>
					)}
				</div>
			</div>

			{/* Bill Amount：真实 totalRequested（与 POST/链上 container 一致） */}
			<div className="flex justify-between items-center mb-2 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400 text-sm">{tu('bill_amount')}</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">CA${formatAmount(totalReq, 'CAD')}</span>
			</div>

			{/* Member Discount (10%)：真实 totalRequested − amount（与 POST/链上一致） */}
			{data.hasDiscount && discountVal != null && (
				<div className="flex justify-between items-center mb-4 leading-[1.375rem]">
					<span className="text-slate-500 dark:text-slate-400 text-sm">{tu('member_discount_10')}</span>
					<span className="font-bold text-blue-600 dark:text-blue-400">-CA${formatAmount(discountVal, 'CAD')}</span>
				</div>
			)}

			{/* $CCSA Balance (only if deduction from CCSA > 0) */}
			{hasCCSA && (
				<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center justify-between gap-3 mb-3">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
							C
						</div>
						<span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">{tu('ccsa_balance')}</span>
					</div>
					<span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm flex-shrink-0">-CA${formatAmount(fromCCSA, 'CAD')}</span>
				</div>
			)}

			{/* USDC Top-up (only if deduction from USDC balance > 0) */}
			{hasUSDC && (
				<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center justify-between gap-3 mb-4">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
							$
						</div>
						<span className="text-blue-700 dark:text-blue-400 font-medium text-sm">{tu('usdc_top_up')}</span>
					</div>
					<span className="font-bold text-blue-700 dark:text-blue-400 text-sm flex-shrink-0">-CA${formatAmount(fromBal, 'CAD')}</span>
				</div>
			)}

			{/* forText：请求备注，记账到 BeamioIndexerDiamond displayJson */}
			{data.forText && data.forText.trim() && (
				<div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 mb-4">
					<p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Memo</p>
					<p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">{data.forText.trim()}</p>
				</div>
			)}

			{/* Total Charge - prominent */}
			<div className="flex justify-between items-baseline mt-2 mb-6 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400 text-sm">{tu('total_charge')}</span>
				<span className="text-4xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">CA${formatAmount(amount, 'CAD')}</span>
			</div>

			{/* Actions */}
			<div className="mt-auto pt-4 pb-6 flex flex-col items-center gap-3">
				<button
					type="button"
					onClick={onConfirm}
					disabled={submitting}
					className="w-full h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
				>
					{submitting ? <Loader className="w-5 h-5 animate-spin" /> : null}
					Confirm
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="text-slate-500 dark:text-slate-400 text-sm font-normal hover:underline disabled:opacity-50"
				>{tu('cancel')}</button>
			</div>
		</div>
	)
}

export type PaymentSuccessData = {
	txHash: string
	amountCAD: string
	amountUSDC: string
	exchangeRateCADtoUSDC?: string
	paidWithCCSACAD?: string
	recipientName?: string
}

function PaymentSuccessView({ data, onDone }: { data: PaymentSuccessData; onDone: () => void }) {
	const [copied, setCopied] = useState(false)
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const rate = data.exchangeRateCADtoUSDC ?? (data.amountUSDC && data.amountCAD ? (Number(data.amountUSDC) / Number(data.amountCAD)).toFixed(4) : '—')
	const copyTx = () => {
		if (!data.txHash) return
		navigator.clipboard.writeText(`${BASE_EXPLORER_TX}${data.txHash}`)
		setCopied(true)
		if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
		copyTimeoutRef.current = setTimeout(() => {
			setCopied(false)
			copyTimeoutRef.current = null
		}, 2000)
	}
	useEffect(() => () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current) }, [])
	// 判断是否需要从 USDC 扣款：如果完全用 CCSA 支付（paidWithCCSACAD 等于 amountCAD），则不需要显示 PAYMENT DETAILS
	const needsUSDCCharge = !(data.paidWithCCSACAD != null && Number(data.paidWithCCSACAD) > 0 && Math.abs(Number(data.paidWithCCSACAD) - Number(data.amountCAD)) < 0.01)
	
	// 计算从 USDC 扣款的金额：总金额（USDC）- CCSA 支付的金额（转换为 USDC）
	// rate 是 1 CAD = rate USDC，所以 CCSA 支付的 USDC = paidWithCCSACAD * rate
	const paidWithCCSAUSDC = data.paidWithCCSACAD && rate && Number(rate) > 0
		? (Number(data.paidWithCCSACAD) * Number(rate)).toFixed(6)
		: '0'
	const usdcFromBalance = data.amountUSDC && paidWithCCSAUSDC
		? (Number(data.amountUSDC) - Number(paidWithCCSAUSDC)).toFixed(6)
		: data.amountUSDC
	
	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16 pb-6">
			<h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-1">{tu('payment_successful')}</h1>
			<p className="text-lg font-bold text-slate-800 dark:text-slate-200 text-center">
				{data.recipientName ? `@${data.recipientName}` : tu('payment')}
			</p>
			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
				{data.txHash ? `${data.txHash.slice(0, 6)}…${data.txHash.slice(-4)} • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
			</p>

			<div className="flex justify-between items-center mb-4 leading-[1.5rem]">
				<span className="font-bold text-slate-700 dark:text-slate-300">{tu('total_paid')}</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">CA${data.amountCAD}</span>
			</div>

			{needsUSDCCharge && (
				<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 mb-3">
					<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm mb-3">
						<RefreshCw className="w-4 h-4" />{tu('payment_details')}</div>
					<div className="flex justify-between text-sm mb-1">
						<span className="text-slate-600 dark:text-slate-400">{tu('exchange_rate')}</span>
						<span className="text-slate-800 dark:text-slate-200">1 CAD ≈ {rate} USDC</span>
					</div>
					<div className="flex justify-between items-center mt-2">
						<span className="font-bold text-slate-700 dark:text-slate-300">{tu('total_paid_in_usdc')}</span>
						<span className="font-bold text-blue-600 dark:text-blue-400">{usdcFromBalance} USDC</span>
					</div>
				</div>
			)}

			{data.paidWithCCSACAD != null && Number(data.paidWithCCSACAD) > 0 && (
				<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 mb-4">
					<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-3">
						<Zap className="w-4 h-4" />{tu('payment_source')}</div>
					<div className="flex justify-between items-center">
						<span className="font-bold text-emerald-700 dark:text-emerald-600">{tu('paid_with_ccsa')}</span>
						<span className="font-bold text-emerald-700 dark:text-emerald-600">$CCSA {data.paidWithCCSACAD}</span>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">1 $CCSA = 1.00 CAD</p>
				</div>
			)}

			<div className="flex justify-between text-sm mb-1 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400">{tu('network')}</span>
				<span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
					<span className="w-2 h-2 rounded-full bg-blue-500" />{tu('base_mainnet')}</span>
			</div>
			<div className="flex justify-between items-center text-sm mb-6 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400">Transaction ID</span>
				<div className="flex items-center gap-2">
					<button type="button" onClick={copyTx} className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:underline">
						{data.txHash ? `${data.txHash.slice(0, 6)}…${data.txHash.slice(-4)}` : '—'}
						{copied ? (
							<Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
						) : (
							<Copy className="w-3.5 h-3.5 flex-shrink-0" />
						)}
					</button>
					{data.txHash && (
						<button
							type="button"
							onClick={() => openExternalUrl(`${BASE_EXPLORER_TX}${data.txHash}`)}
							className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
							title={tu('view_on_basescan')}
						>
							<ExternalLink className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">GRAND TOTAL PAID</p>
			<p className="text-4xl font-bold text-blue-600 dark:text-blue-400 text-center mb-6">CA${data.amountCAD}</p>

			<button
				type="button"
				onClick={onDone}
				className="w-full h-14 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-base"
			>{tu('done_go_to_chat')}</button>
		</div>
	)
}

export type TenKeyInputComponentProps = {
	/** 支付成功并点击 Done 后调用，用于关闭本组件并回到父页面（父页面可在此安排刷新 AA 资产等） */
	onPaymentSuccess?: () => void
}

const TenKeyInputComponent = (props: TenKeyInputComponentProps) => {
	const { onPaymentSuccess } = props
	const [value, setValue] = useState('')
	const [showQRSheet, setShowQRSheet] = useState(false)
	const [routingSteps, setRoutingSteps] = useState<RoutingStep[]>(() =>
		ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }))
	)
	const [routingRetryTrigger, setRoutingRetryTrigger] = useState(0)
	const [confirmDeduction, setConfirmDeduction] = useState<ConfirmDeductionPayload | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
	const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentSuccessData | null>(null)
	const routingDoneRef = useRef(false)
	const { readUid } = useNfcRead()
	const {
		beamio,
		profiles,
		scanRef,
		scanIntent,
		scanData,
		setScanIntent,
		setScanData,
		voucherPayAmount,
		setVoucherPayAmount,
		voucherPayToAA,
		setVoucherPayToAA,
		voucherPayError,
		setVoucherPayError,
		setVoucherPayFromScan,
		currencyData,
	} = useDaemonContext()
	const maxLength = 10
	const allowDecimal = true

	// 使用全局 Oracle 喂料器提供的 currencyData，每 5 分钟自动刷新
	type OracleRates = { USDC: number; CAD: number }
	const ensureOracle = (): OracleRates => ({
		USDC: Number((currencyData as any)?.USDC) || 1,
		CAD: Number((currencyData as any)?.CAD) || 1.35
	})
	const cadToUsdc6 = (rates: OracleRates, cadStr: string): bigint => {
		if (!rates.USDC || !rates.CAD) return 0n
		const cad = Number(cadStr)
		if (!Number.isFinite(cad) || cad <= 0) return 0n
		const usdc = cad / rates.CAD / rates.USDC
		try {
			return ethers.parseUnits(usdc.toFixed(6), 6)
		} catch {
			return 0n
		}
	}
	/** Bill 金额按 currency 换算为 USDC6：USD/USDC 用 1:1，CAD 用 cadToUsdc6 */
	const fiatToUsdc6 = (rates: OracleRates, amountStr: string, currency: string): bigint => {
		const n = Number(amountStr)
		if (!Number.isFinite(n) || n <= 0) return 0n
		const cur = (currency || '').toUpperCase()
		if (cur === 'USD' || cur === 'USDC') {
			const usdc = rates.USDC ? n / rates.USDC : n
			try {
				return ethers.parseUnits(usdc.toFixed(6), 6)
			} catch {
				return 0n
			}
		}
		return cadToUsdc6(rates, amountStr)
	}
	const usdcToCadStr = (rates: OracleRates, usdcStr: string): string => {
		if (!rates.USDC || !rates.CAD) return usdcStr
		const n = Number(usdcStr)
		if (!Number.isFinite(n)) return '0.00'
		return (n * rates.USDC * rates.CAD).toFixed(2)
	}

	// 每次挂载时清空上一次遗留的 scan/voucher 状态；若已是 voucherPay/payBill/payByNfc 则保留
	useEffect(() => {
		if (scanIntent !== 'voucherPay' && scanIntent !== 'payBill' && scanIntent !== 'payByNfc') {
			setScanData('')
			setScanIntent('')
			setVoucherPayAmount('')
			setVoucherPayToAA('')
			setVoucherPayError('')
			routingDoneRef.current = false
		}
	}, [scanIntent, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayError])

	// 输入变化时清除扫码错误提示
	useEffect(() => {
		if (voucherPayError) setVoucherPayError('')
	}, [value])

	// payBill：仅当 scanData 为空时自动打开扫描；若 scanData 已存在（如从 PayScreen 重定向而来），则直接走 Smart Routing，不打开扫码
	useEffect(() => {
		if (scanIntent === 'payBill' && !scanData) {
			scanRef.current?.start()
		}
	}, [scanIntent, scanData, scanRef])

	// voucherPay 流程：当 scanIntent === 'voucherPay' 且 scanData 到位时执行步骤并更新 UI；也处理 payBill 扫到的 paymentUrl
	useEffect(() => {
		const isVoucherOrBill = scanIntent === 'voucherPay' || scanIntent === 'payBill'
		if (!isVoucherOrBill || !scanData || routingDoneRef.current) return
		routingDoneRef.current = true
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))

		const setStep = (id: string, status: StepStatus, detail?: string) => {
			setRoutingSteps((prev) =>
				prev.map((s) =>
					s.id === id ? { ...s, status, ...(detail != null ? { detail } : {}) } : s
				)
			)
		}
		const setStepLoading = (id: string) => setStep(id, 'loading')
		const setStepSuccess = (id: string, detail?: string) => setStep(id, 'success', detail)
		const setStepError = (id: string, detail: string) => setStep(id, 'error', detail)

		const finish = (clearIntent = true) => {
			if (clearIntent) {
				setScanData('')
				setScanIntent('')
			}
			setVoucherPayAmount('')
			setVoucherPayToAA('')
			routingDoneRef.current = false
		}

		/** 某步失败：显示红色 X 及错误信息（图中没有的 step 失败时也显示该 step 的错误） */
		const failStep = (stepId: string, detail: string) => {
			setStepError(stepId, detail)
		}

		/** 每项开始时延迟 1 秒，以显示 loading */
		const loadingDelay = () => new Promise<void>((r) => setTimeout(r,2000))
		/** 每项完成后的延迟 2 秒 */
		const doneDelay = () => new Promise<void>((r) => setTimeout(r, 2000))

		;(async () => {
			let payload: OpenContainerRelayPayload
			const payerAA = profiles?.[0]?.aaAccount ?? ''

			// --- Bill paymentUrl 分支：Amount、currency、acceptTokens、to 均为必选项，缺一视为非法 bill ---
			try {
				const u = scanData.startsWith('http') ? new URL(scanData) : new URL(scanData, 'http://beamio.app')
				const amountParam = u.searchParams.get('Amount') ?? u.searchParams.get('amount')
				const currencyParam = u.searchParams.get('currency') ?? u.searchParams.get('Currency') ?? ''
				const acceptTokensParam = u.searchParams.get('acceptTokens') ?? u.searchParams.get('accepttokens') ?? ''
				const toParam = u.searchParams.get('to') ?? u.searchParams.get('payee') ?? ''
				// 有金额即视为 bill URL：必须带 currency 和 acceptTokens，否则非法
				if (amountParam && Number(amountParam) > 0) {
					if (!currencyParam || !acceptTokensParam) {
						setStepLoading('detectingUser')
						await loadingDelay()
						failStep('detectingUser', 'Invalid bill: missing currency or acceptTokens')
						return
					}
					if (!toParam || !ethers.isAddress(toParam)) {
						setStepLoading('detectingUser')
						await loadingDelay()
						failStep('detectingUser', 'Invalid bill: missing or invalid payee (to)')
						return
					}
					const billPayeeAA = ethers.getAddress(toParam)
					setVoucherPayAmount(amountParam)
					setVoucherPayToAA(billPayeeAA)
					setStepLoading('detectingUser')
					await loadingDelay()
					// 使用 Beamio Account Factory 校验 to 是否为合法 BeamioAccount
					try {
						const aaFactory = new ethers.Contract(
							contracts.BeamioAAAcountFactory.address,
							contracts.BeamioAAAcountFactory.abi,
							baseEndpoint
						)
						const isBeamio = await retryRpcCall(() => aaFactory.isBeamioAccount(billPayeeAA))
						if (!isBeamio) {
							failStep('detectingUser', 'Bill payee is not a Beamio AA account')
							return
						}
					} catch (e) {
						failStep('detectingUser', RPC_ERROR_MSG)
						return
					}
					if (!payerAA || !ethers.isAddress(payerAA)) {
						failStep('detectingUser', 'Payer AA not found')
						return
					}
					setStepSuccess('detectingUser', 'Bill payee validated')
					await doneDelay()

					let enteredWei: bigint
					try {
						const rates = ensureOracle()
						enteredWei = fiatToUsdc6(rates, amountParam, currencyParam)
					} catch (e) {
						console.warn('Bill currency to USDC (shared oracle) failed', e)
						enteredWei = 0n
					}

					setStepLoading('membership')
					await loadingDelay()
					let cardNumbers: string[] = []
					let pointsBalanceWei = 0n
					try {
						const cardContract = new ethers.Contract(
							CCSA_Card_Address,
							['function getOwnership(address user) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)'],
							baseEndpoint
						)
						const [pt, nfts] = await retryRpcCall(() => cardContract.getOwnership(payerAA))
						pointsBalanceWei = BigInt(pt?.toString() ?? 0)
						cardNumbers = (nfts || []).map((n: { tokenId: bigint }) => n.tokenId.toString()).filter(Boolean)
						setStepSuccess('membership', cardNumbers.length > 0 ? 'Cardholder (10% OFF)' : 'No membership discount')
					} catch (e) {
						failStep('membership', RPC_ERROR_MSG)
						return
					}
					await doneDelay()

					const effectiveWei = cardNumbers.length > 0 ? (enteredWei * 9n) / 10n : enteredWei
					let ccsaCapacityUsdcWei = 0n
					let unitPriceUSDC6 = 0n
					if (pointsBalanceWei > 0n) {
						try {
							const quote = await retryRpcCall(() => BeamioCardFactorySC.quoteUnitPointInUSDC6(CCSA_Card_Address))
							unitPriceUSDC6 = BigInt(quote?.toString() ?? 0)
							ccsaCapacityUsdcWei = (pointsBalanceWei * unitPriceUSDC6) / 1_000_000n
						} catch (e) {
							setStepLoading('analyzingAssets')
							await loadingDelay()
							failStep('analyzingAssets', RPC_ERROR_MSG)
							return
						}
					}

					setStepLoading('analyzingAssets')
					await loadingDelay()
					let balanceWei = 0n
					try {
						const tokenContract = new ethers.Contract(
							USDCContract_BASE,
							usdc_abi as ethers.InterfaceAbi,
							baseEndpoint
						)
						const bal = await retryRpcCall(() => tokenContract.balanceOf(payerAA))
						balanceWei = BigInt(bal.toString())
						const totalAvailableWei = balanceWei + ccsaCapacityUsdcWei
						if (effectiveWei > 0n && totalAvailableWei < effectiveWei) {
							const reqStr = ethers.formatUnits(effectiveWei, 6)
							const balStr = ethers.formatUnits(totalAvailableWei, 6)
							const shortfallWei = effectiveWei - totalAvailableWei
							const shortfallStr = ethers.formatUnits(shortfallWei, 6)
							failStep('analyzingAssets', `Insufficient balance. Requested: ${reqStr} USDC, Balance: ${balStr} USDC, Shortfall: ${shortfallStr} USDC`)
							return
						}
						const detail = ccsaCapacityUsdcWei >= effectiveWei
							? '$CCSA: (Sufficient)'
							: ccsaCapacityUsdcWei > 0n
								? '$CCSA: (Partial)'
								: 'USDC sufficient'
						setStepSuccess('analyzingAssets', detail)
					} catch (e) {
						failStep('analyzingAssets', RPC_ERROR_MSG)
						return
					}
					await doneDelay()

					setStepLoading('optimizingRoute')
					await loadingDelay()
					const usdcFromCCSAWei = effectiveWei <= ccsaCapacityUsdcWei ? effectiveWei : ccsaCapacityUsdcWei
					const usdcFromBalanceWei = effectiveWei - usdcFromCCSAWei
					const amountStr = ethers.formatUnits(effectiveWei, 6)
					const ccsaPointsWei = usdcFromCCSAWei > 0n && unitPriceUSDC6 > 0n
						? (usdcFromCCSAWei * 1_000_000n) / unitPriceUSDC6
						: 0n
					setStepSuccess('optimizingRoute', usdcFromCCSAWei > 0n && usdcFromBalanceWei > 0n ? 'Hybrid: CCSA + USDC' : usdcFromCCSAWei > 0n ? 'CCSA only' : 'USDC only')
					await doneDelay()

					const usdcFromBalanceStr = ethers.formatUnits(usdcFromBalanceWei, 6)
					const usdcFromCCSAStr = ethers.formatUnits(usdcFromCCSAWei, 6)
					const customerUsdcBalanceStr = ethers.formatUnits(balanceWei, 6)
					const totalRequestedStrVal = ethers.formatUnits(enteredWei, 6)
					let amountStrCAD: string | undefined
					let usdcFromBalanceCAD: string | undefined
					let usdcFromCCSACAD: string | undefined
					let customerUsdcBalanceCAD: string | undefined
					let totalRequestedStrCAD: string | undefined
					try {
						const rates = ensureOracle()
						amountStrCAD = usdcToCadStr(rates, amountStr)
						usdcFromBalanceCAD = usdcToCadStr(rates, usdcFromBalanceStr)
						usdcFromCCSACAD = usdcToCadStr(rates, usdcFromCCSAStr)
						customerUsdcBalanceCAD = usdcToCadStr(rates, customerUsdcBalanceStr)
						totalRequestedStrCAD = usdcToCadStr(rates, totalRequestedStrVal)
					} catch (e) {
						console.warn('USDC to CAD (shared oracle) failed', e)
					}

					// Bill 请求方商家展示名：通过 AA.owner() 得 EOA，再 searchUsername 获取
					let payeeDisplayName: string | undefined
					try {
						const aaContract = new ethers.Contract(
							billPayeeAA,
							['function owner() view returns (address)'],
							baseEndpoint
						)
						const merchantEOA = (await aaContract.owner()) as string
						if (merchantEOA && merchantEOA !== ethers.ZeroAddress) {
							const account = await searchUsername(merchantEOA)
							if (account?.results?.[0]?.username) {
								payeeDisplayName = account.results[0].username
							}
						}
					} catch (e) {
						console.warn('Bill payee Beamio lookup failed (searchUsername by EOA)', e)
					}

					const syntheticPayload: OpenContainerRelayPayload = {
						account: payerAA,
						to: billPayeeAA,
						items: [],
						currencyType: 4,
						maxAmount: '0',
						nonce: '0',
						deadline: String(Math.floor(Date.now() / 1000) + 300),
						signature: '0x',
					}
					setConfirmDeduction({
						payload: syntheticPayload,
						amountStr,
						usdcFromBalance: usdcFromBalanceStr,
						usdcFromCCSA: usdcFromCCSAStr,
						customerUsdcBalance: customerUsdcBalanceStr,
						totalRequestedStr: totalRequestedStrVal,
						hasDiscount: cardNumbers.length > 0,
						amountStrCAD,
						usdcFromBalanceCAD,
						usdcFromCCSACAD,
						customerUsdcBalanceCAD,
						totalRequestedStrCAD,
						payerDisplayName: undefined,
						payerMemberLabel: cardNumbers.length > 0 ? 'CCSA Member (Genesis)' : undefined,
						usdcFromBalanceWeiStr: usdcFromBalanceWei > 0n ? usdcFromBalanceWei.toString() : undefined,
						ccsaPointsWeiStr: ccsaPointsWei > 0n ? ccsaPointsWei.toString() : undefined,
						isBillPay: true,
						billPayeeAA,
						payeeDisplayName,
						payeeMemberLabel: undefined,
						billRequestHash: (() => {
							const rh = u.searchParams.get('requestHash') ?? u.searchParams.get('requesthash')
							return rh && ethers.isHexString(rh) && ethers.dataLength(rh) === 32 ? rh : undefined
						})(),
						forText: u.searchParams.get('forText') ?? undefined,
					})
					return
				}
			} catch (_) {
				/* not a bill URL, fall through to JSON payload */
			}

			// Step 1: Detecting User (parse + beneficiary AA + nonce + deadline + maxAmount; failures show under this step)
			setStepLoading('detectingUser')
			await loadingDelay()
			try {
				const parsed = JSON.parse(scanData) as unknown
				if (
					!parsed ||
					typeof parsed !== 'object' ||
					!Array.isArray((parsed as OpenContainerRelayPayload).items) ||
					typeof (parsed as OpenContainerRelayPayload).account !== 'string' ||
					typeof (parsed as OpenContainerRelayPayload).to !== 'string' ||
					typeof (parsed as OpenContainerRelayPayload).currencyType !== 'number' ||
					typeof (parsed as OpenContainerRelayPayload).maxAmount !== 'string' ||
					typeof (parsed as OpenContainerRelayPayload).nonce !== 'string' ||
					typeof (parsed as OpenContainerRelayPayload).deadline !== 'string' ||
					typeof (parsed as OpenContainerRelayPayload).signature !== 'string'
				) {
					failStep('detectingUser', 'Invalid Open Relay payload')
					return
				}
				payload = parsed as OpenContainerRelayPayload
			} catch {
				failStep('detectingUser', 'Invalid Open Relay payload')
				return
			}
			try {
				const aaFactory = new ethers.Contract(
					contracts.BeamioAAAcountFactory.address,
					contracts.BeamioAAAcountFactory.abi,
					baseEndpoint
				)
				const primary = await retryRpcCall(() => aaFactory.primaryAccountOf(payload.to))
				if (!primary || primary === ethers.ZeroAddress) {
					failStep('detectingUser', 'Beneficiary has no AA account')
					return
				}
			} catch (e) {
				failStep('detectingUser', RPC_ERROR_MSG)
				return
			}
			try {
				const storedNonce = await retryRpcCall(() => readContainerNonceFromAAStorage(baseEndpoint, payload.account, 'openRelayed'))
				const payloadNonce = BigInt(payload.nonce)
				if (storedNonce !== payloadNonce) {
					failStep('detectingUser', `Nonce mismatch: expected ${storedNonce}, got ${payloadNonce}`)
					return
				}
			} catch (e) {
				failStep('detectingUser', RPC_ERROR_MSG)
				return
			}
			const nowSec = Math.floor(Date.now() / 1000)
			const deadlineSec = parseInt(payload.deadline, 10)
			if (Number.isNaN(deadlineSec) || nowSec >= deadlineSec) {
				failStep('detectingUser', 'QR code has expired')
				return
			}
			// 金额优先用 voucherPayAmount（Scan User 时设置），若无则用本页数字键输入的 value，避免被 effect 清空或其它入口未设导致 zero amount
			const amountSource = (voucherPayAmount && Number(voucherPayAmount) > 0) ? voucherPayAmount : (value && Number(value) > 0 ? value : '')
			let enteredWei: bigint
			try {
				if (amountSource) {
					const rates = ensureOracle()
					enteredWei = cadToUsdc6(rates, amountSource)
				} else {
					enteredWei = 0n
				}
				const maxWei = BigInt(payload.maxAmount ?? '0')
				if (maxWei > 0n && maxWei < enteredWei) {
					failStep('detectingUser', `Max ${ethers.formatUnits(maxWei, 6)} USDC`)
					return
				}
			} catch (e) {
				console.warn('CAD to USDC quote or maxAmount check failed', e)
				enteredWei = 0n
			}
			setStepSuccess('detectingUser', 'User validated')
			await doneDelay()

			// Step 2: Checking Membership (CCSA card; 10% off for cardholder)
			setStepLoading('membership')
			await loadingDelay()
			let cardNumbers: string[] = []
			let pointsBalanceWei = 0n
			try {
				const cardContract = new ethers.Contract(
					CCSA_Card_Address,
					['function getOwnership(address user) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)'],
					baseEndpoint
				)
				const [pt, nfts] = await retryRpcCall(() => cardContract.getOwnership(payload.account))
				pointsBalanceWei = BigInt(pt?.toString() ?? 0)
				cardNumbers = (nfts || []).map((n: { tokenId: bigint }) => n.tokenId.toString()).filter(Boolean)
				const detail = cardNumbers.length > 0 ? 'Cardholder (10% OFF)' : 'No membership discount'
				setStepSuccess('membership', detail)
			} catch (e) {
				failStep('membership', RPC_ERROR_MSG)
				return
			}
			await doneDelay()

			// 持卡者 10% 折扣：受益人实收 = 输入金额 * 0.9
			const effectiveWei = cardNumbers.length > 0 ? (enteredWei * 9n) / 10n : enteredWei

			// CCSA 可折算 USDC 容量（点数 × 单价，6 位小数）；保留 unitPriceUSDC6 供后续折算扣款点数量
			let ccsaCapacityUsdcWei = 0n
			let unitPriceUSDC6 = 0n
			if (pointsBalanceWei > 0n) {
				try {
					const quote = await retryRpcCall(() => BeamioCardFactorySC.quoteUnitPointInUSDC6(CCSA_Card_Address))
					unitPriceUSDC6 = BigInt(quote?.toString() ?? 0)
					ccsaCapacityUsdcWei = (pointsBalanceWei * unitPriceUSDC6) / 1_000_000n
				} catch (e) {
					setStepLoading('analyzingAssets')
					await loadingDelay()
					failStep('analyzingAssets', RPC_ERROR_MSG)
					return
				}
			}

			// Step 3: Analyzing Assets (balance check; USDC + CCSA 合计，CCSA 不足时用 USDC 补足)
			let balanceWei = 0n
			if (effectiveWei > 0n) {
				setStepLoading('analyzingAssets')
				await loadingDelay()
				const usdcAsset = payload.items?.find((it: { kind: number }) => it.kind === 0)?.asset ?? USDCContract_BASE
				const usdcContract = new ethers.Contract(
					USDCContract_BASE,
					usdc_abi as ethers.InterfaceAbi,
					baseEndpoint
				)
				try {
					let bal: unknown
					try {
						bal = await retryRpcCall(() => usdcContract.balanceOf(payload.account))
					} catch {
						const altContract = usdcAsset && usdcAsset.toLowerCase() !== USDCContract_BASE.toLowerCase()
							? new ethers.Contract(usdcAsset, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
							: usdcContract
						bal = await retryRpcCall(() => altContract.balanceOf(payload.account))
					}
					balanceWei = BigInt((bal as bigint)?.toString?.() ?? String(bal ?? 0))
				} catch (e2) {
					failStep('analyzingAssets', RPC_ERROR_MSG)
					return
				}
				const totalAvailableWei = balanceWei + ccsaCapacityUsdcWei
				if (totalAvailableWei < effectiveWei) {
					const reqStr = ethers.formatUnits(effectiveWei, 6)
					const balStr = ethers.formatUnits(totalAvailableWei, 6)
					const shortfallWei = effectiveWei - totalAvailableWei
					const shortfallStr = ethers.formatUnits(shortfallWei, 6)
					failStep('analyzingAssets', `Insufficient balance. Requested: ${reqStr} USDC, Balance: ${balStr} USDC, Shortfall: ${shortfallStr} USDC`)
					return
				}
				const detail = ccsaCapacityUsdcWei >= effectiveWei
					? '$CCSA: (Sufficient)'
					: ccsaCapacityUsdcWei > 0n
						? '$CCSA: (Partial)'
						: 'USDC sufficient'
				setStepSuccess('analyzingAssets', detail)
			} else {
				setStepSuccess('analyzingAssets', 'Skipped (zero amount)')
			}
			await doneDelay()

			// Step 4: Optimizing Route (deduction split: CCSA + USDC)
			setStepLoading('optimizingRoute')
			await loadingDelay()
			const usdcFromCCSAWei = effectiveWei <= ccsaCapacityUsdcWei ? effectiveWei : ccsaCapacityUsdcWei
			const usdcFromBalanceWei = effectiveWei - usdcFromCCSAWei
			const amountStr = ethers.formatUnits(effectiveWei, 6)
			const ccsaPointsWei = usdcFromCCSAWei > 0n && unitPriceUSDC6 > 0n
				? (usdcFromCCSAWei * 1_000_000n) / unitPriceUSDC6
				: 0n
			setStepSuccess('optimizingRoute', usdcFromCCSAWei > 0n && usdcFromBalanceWei > 0n ? 'Hybrid: CCSA + USDC' : usdcFromCCSAWei > 0n ? 'CCSA only' : 'USDC only')
			await doneDelay()

			const usdcFromBalanceStr = ethers.formatUnits(usdcFromBalanceWei, 6)
			const usdcFromCCSAStr = ethers.formatUnits(usdcFromCCSAWei, 6)
			const customerUsdcBalanceStr = ethers.formatUnits(balanceWei, 6)
			const totalRequestedStrVal = ethers.formatUnits(enteredWei, 6)
			let amountStrCAD: string | undefined
			let usdcFromBalanceCAD: string | undefined
			let usdcFromCCSACAD: string | undefined
			let customerUsdcBalanceCAD: string | undefined
			let totalRequestedStrCAD: string | undefined
			try {
				const rates = ensureOracle()
				amountStrCAD = usdcToCadStr(rates, amountStr)
				usdcFromBalanceCAD = usdcToCadStr(rates, usdcFromBalanceStr)
				usdcFromCCSACAD = usdcToCadStr(rates, usdcFromCCSAStr)
				customerUsdcBalanceCAD = usdcToCadStr(rates, customerUsdcBalanceStr)
				totalRequestedStrCAD = usdcToCadStr(rates, totalRequestedStrVal)
			} catch (e) {
				console.warn('USDC to CAD (shared oracle) failed, Confirm deduction will show USDC amounts', e)
			}

			// 付款人 Beamio 信息：通过 AA.owner() 得到付款人 EOA，再 searchUsername(EOA) 获取 username / first_name+last_name
			let payerDisplayName: string | undefined
			let payerBeamioTag: string | undefined
			try {
				const aaContract = new ethers.Contract(
					payload.account,
					['function owner() view returns (address)'],
					baseEndpoint
				)
				const payerEOA = await aaContract.owner() as string
				if (payerEOA && payerEOA !== ethers.ZeroAddress) {
					const account = await searchUsername(payerEOA)
					const peer = account?.results?.[0]
					if (peer) {
						if (peer.username) payerDisplayName = peer.username
						const lastname = (peer as { last_name?: string }).last_name?.split?.('\r\n')?.[0] ?? ''
						const firstName = (peer as { first_name?: string }).first_name ?? ''
						const fullName = `${firstName || ''} ${/^\{/.test(String(lastname)) ? '' : lastname || ''}`.trim()
						if (fullName) payerBeamioTag = fullName
					}
				}
			} catch (e) {
				console.warn('Payer Beamio lookup failed (searchUsername by EOA)', e)
			}

			// 记账用：Voucher/请求 URL 的 requestHash、forText（用于 BeamioIndexerDiamond displayJson、originalPaymentHash）
			let voucherRequestHash: string | undefined
			let voucherForText: string | undefined
			try {
				if (typeof window !== 'undefined' && window.location?.search) {
					const u = new URL(window.location.href)
					const rh = u.searchParams.get('requestHash') ?? u.searchParams.get('requesthash')
					voucherRequestHash = rh && ethers.isHexString(rh) && ethers.dataLength(rh) === 32 ? rh : undefined
					voucherForText = u.searchParams.get('forText') ?? undefined
				}
			} catch (_) {}

			setConfirmDeduction({
				payload,
				amountStr,
				usdcFromBalance: usdcFromBalanceStr,
				usdcFromCCSA: usdcFromCCSAStr,
				customerUsdcBalance: customerUsdcBalanceStr,
				totalRequestedStr: totalRequestedStrVal,
				hasDiscount: cardNumbers.length > 0,
				amountStrCAD,
				usdcFromBalanceCAD,
				usdcFromCCSACAD,
				customerUsdcBalanceCAD,
				totalRequestedStrCAD,
				payerDisplayName,
				payerMemberLabel: cardNumbers.length > 0 ? 'CCSA Member (Genesis)' : undefined,
				payerBeamioTag,
				usdcFromBalanceWeiStr: usdcFromBalanceWei > 0n ? usdcFromBalanceWei.toString() : undefined,
				ccsaPointsWeiStr: ccsaPointsWei > 0n ? ccsaPointsWei.toString() : undefined,
				billRequestHash: voucherRequestHash,
				forText: voucherForText,
			})
			// 不在此处 submit；等用户确认后再提交
			return
		})()
	}, [scanIntent, scanData, voucherPayAmount, voucherPayToAA, profiles, routingRetryTrigger, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayError])

	// 进入 voucherPay / payBill / payByNfc 时重置步骤为 pending（等待 scanData），并清空确认
	useEffect(() => {
		if (scanIntent === 'voucherPay' || scanIntent === 'payBill' || scanIntent === 'payByNfc') {
			setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
			setConfirmDeduction(null)
			routingDoneRef.current = false
		}
	}, [scanIntent])

	// payByNfc 流程：UID 已就绪时执行 Smart Routing 步骤并设置确认
	useEffect(() => {
		if (scanIntent !== 'payByNfc' || !scanData || !voucherPayAmount || !voucherPayToAA || routingDoneRef.current) return
		routingDoneRef.current = true
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
		const setStep = (id: string, status: StepStatus, detail?: string) => {
			setRoutingSteps((prev) =>
				prev.map((s) => (s.id === id ? { ...s, status, ...(detail != null ? { detail } : {}) } : s))
			)
		}
		const loadingDelay = () => new Promise<void>((r) => setTimeout(r, 2000))
		const doneDelay = () => new Promise<void>((r) => setTimeout(r, 2000))
		;(async () => {
			const payeeAA = ethers.getAddress(voucherPayToAA)
			setStep('detectingUser', 'loading')
			await loadingDelay()
			try {
				const aaFactory = new ethers.Contract(
					contracts.BeamioAAAcountFactory.address,
					contracts.BeamioAAAcountFactory.abi,
					baseEndpoint
				)
				const isBeamio = await retryRpcCall(() => aaFactory.isBeamioAccount(payeeAA))
				if (!isBeamio) {
					setStep('detectingUser', 'error', 'Payee is not a Beamio AA account')
					routingDoneRef.current = false
					return
				}
			} catch (e) {
				setStep('detectingUser', 'error', RPC_ERROR_MSG)
				routingDoneRef.current = false
				return
			}
			setStep('detectingUser', 'success', 'Merchant validated')
			await doneDelay()
			setStep('membership', 'loading')
			await loadingDelay()
			setStep('membership', 'success', 'NFC card payment')
			await doneDelay()
			setStep('analyzingAssets', 'loading')
			await loadingDelay()
			setStep('analyzingAssets', 'success', 'NFC card balance')
			await doneDelay()
			setStep('optimizingRoute', 'loading')
			await loadingDelay()
			setStep('optimizingRoute', 'success', 'Direct: NFC → Merchant')
			await doneDelay()
			const rates = ensureOracle()
			const amountUsdc6 = cadToUsdc6(rates, voucherPayAmount)
			const amountStr = ethers.formatUnits(amountUsdc6, 6)
			let amountStrCAD: string | undefined
			try {
				amountStrCAD = usdcToCadStr(rates, amountStr)
			} catch {
				amountStrCAD = voucherPayAmount
			}
			const syntheticPayload: OpenContainerRelayPayload = {
				account: ethers.ZeroAddress,
				to: payeeAA,
				items: [],
				currencyType: 4,
				maxAmount: '0',
				nonce: '0',
				deadline: String(Math.floor(Date.now() / 1000) + 300),
				signature: '0x',
			}
			setConfirmDeduction({
				payload: syntheticPayload,
				amountStr,
				usdcFromBalance: amountStr,
				usdcFromCCSA: '0',
				customerUsdcBalance: '0',
				totalRequestedStr: amountStr,
				amountStrCAD,
				usdcFromBalanceCAD: amountStrCAD,
				usdcFromCCSACAD: '0',
				customerUsdcBalanceCAD: '0',
				totalRequestedStrCAD: amountStrCAD,
				usdcFromBalanceWeiStr: amountUsdc6.toString(),
				ccsaPointsWeiStr: undefined,
				payerDisplayName: 'NFC Card',
				payeeDisplayName: undefined,
				isNfcPay: true,
				nfcUid: scanData,
			})
		})()
	}, [scanIntent, scanData, voucherPayAmount, voucherPayToAA, routingRetryTrigger])

	const setStepById = (id: string, status: StepStatus, detail?: string) => {
		setRoutingSteps((prev) =>
			prev.map((s) => (s.id === id ? { ...s, status, ...(detail != null ? { detail } : {}) } : s))
		)
	}

	const handleConfirmDeduction = async () => {
		if (!confirmDeduction || submitting) return
		const data = confirmDeduction
		setSubmitting(true)
		setConfirmDeduction(null)

		// NFC 卡支付：调用 payByNfcUid 端点
		if (data.isNfcPay && data.nfcUid && voucherPayToAA) {
			setStepById('sendTx', 'loading', 'Submitting…')
			try {
				const amountUsdc6 = data.usdcFromBalanceWeiStr ?? ethers.parseUnits(data.amountStr, 6).toString()
				const result = await payByNfcUid({
					uid: data.nfcUid,
					amountUsdc6,
					payee: voucherPayToAA,
				})
				setStepById('sendTx', 'success', 'Sent')
				if (result.success && result.USDC_tx) {
					setSuccessTxHash(result.USDC_tx)
					setStepById('waitTx', 'success', 'Transaction complete')
					const amountCAD = data.amountStrCAD ?? data.amountStr
					const amountUSDC = data.amountStr
					const rate = amountCAD && amountUSDC ? (Number(amountUSDC) / Number(amountCAD)).toFixed(4) : undefined
					setPaymentSuccessData({
						txHash: result.USDC_tx,
						amountCAD,
						amountUSDC,
						exchangeRateCADtoUSDC: rate,
						recipientName: data.payeeDisplayName,
					})
				} else {
					setSubmitting(false)
					setStepById('waitTx', 'error', result.error ?? 'Payment failed')
					setVoucherPayError(result.error ?? 'Payment failed')
					return
				}
			} catch (e) {
				console.warn('payByNfcUid failed', e)
				setSubmitting(false)
				const errMsg = (e as Error)?.message ?? tu('request_failed')
				setStepById('sendTx', 'error', errMsg)
				setVoucherPayError(errMsg)
				return
			}
			setSubmitting(false)
			return
		}

		// Build items from deduction split: only include items with amount > 0; do not add zero-amount items.
		const usdcWei = data.usdcFromBalanceWeiStr ? BigInt(data.usdcFromBalanceWeiStr) : 0n
		const ccsaPointsWei = data.ccsaPointsWeiStr ? BigInt(data.ccsaPointsWeiStr) : 0n
		const items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[] = []
		if (usdcWei > 0n) {
			items.push({ kind: 0, asset: USDCContract_BASE, amount: usdcWei.toString(), tokenId: '0', data: '0x' })
		}
		if (ccsaPointsWei > 0n) {
			items.push({ kind: 1, asset: CCSA_Card_Address, amount: ccsaPointsWei.toString(), tokenId: '0', data: '0x' })
		}
		if (items.length === 0) {
			const amountWeiStr = ethers.parseUnits(data.amountStr, 6).toString()
			items.push({ kind: 0, asset: USDCContract_BASE, amount: amountWeiStr, tokenId: '0', data: '0x' })
		}

		let payload: OpenContainerRelayPayload
		if (data.isBillPay && data.billPayeeAA && profiles?.[0]) {
			// Bill 支付：由付款人签名 Open Container，to 指向 bill 的 AA
			try {
				const signed = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(profiles[0], data.amountStr, { to: data.billPayeeAA })
				payload = { ...signed, to: ethers.getAddress(data.billPayeeAA), items }
			} catch (e) {
				setSubmitting(false)
				setVoucherPayError((e as Error)?.message ?? tu('sign_failed'))
				return
			}
		} else {
			const beneficiaryAA = voucherPayToAA || profiles?.[0]?.aaAccount || ''
			if (!beneficiaryAA || !ethers.isAddress(beneficiaryAA)) {
				setSubmitting(false)
				setVoucherPayError('Beneficiary AA not found. Please use the account that will receive the payment.')
				return
			}
			payload = { ...data.payload, to: ethers.getAddress(beneficiaryAA), items }
		}

		setStepById('sendTx', 'loading', 'Submitting…')
		try {
			const url = `${beamioApiBase.replace(/\/$/, '')}/api/AAtoEOA`
			// currency 和 currencyAmount 用于服务器端记账：按 item 拆分
			// 如果 items.length > 1，需要发送数组形式的 currency 和 currencyAmount
			const USDCContract_BASE_lower = USDCContract_BASE.toLowerCase()
			const CCSA_Card_Address_lower = CCSA_Card_Address.toLowerCase()
			let currency: string | string[]
			let currencyAmount: string | string[]
			
			if (items.length > 1) {
				// 多个 items：构建数组
				const currencyArray: string[] = []
				const currencyAmountArray: string[] = []
				for (const item of items) {
					const itemAssetLower = item.asset.toLowerCase()
					if (item.kind === 0 && itemAssetLower === USDCContract_BASE_lower) {
						// USDC item
						currencyArray.push('CAD')
						currencyAmountArray.push(data.usdcFromBalanceCAD ?? data.amountStrCAD ?? data.amountStr)
					} else if (item.kind === 1 && itemAssetLower === CCSA_Card_Address_lower) {
						// CCSA item
						currencyArray.push('CAD')
						currencyAmountArray.push(data.usdcFromCCSACAD ?? data.amountStrCAD ?? data.amountStr)
					} else {
						// 其他类型（不应该发生，但兜底）
						currencyArray.push('CAD')
						currencyAmountArray.push(data.amountStrCAD ?? data.amountStr)
					}
				}
				currency = currencyArray
				currencyAmount = currencyAmountArray
			} else {
				// 单个 item：使用单个值
				currency = 'CAD'
				currencyAmount = data.totalRequestedStrCAD ?? data.amountStrCAD ?? data.amountStr
			}

			// 会员折扣：送出 currencyDiscount（折扣金额）和 currencyDiscountAmount（折后实付），供服务器记账
			const discountVal = data.hasDiscount && data.totalRequestedStr != null && data.amountStr != null
				? (data.totalRequestedStrCAD != null && data.amountStrCAD != null
					? Number(data.totalRequestedStrCAD) - Number(data.amountStrCAD)
					: Number(data.totalRequestedStr) - Number(data.amountStr))
				: null
			const currencyDiscount = discountVal != null ? String(discountVal) : undefined
			const currencyDiscountAmount = data.hasDiscount ? (data.amountStrCAD ?? data.amountStr) : undefined
			const bodyPayload: Record<string, unknown> = {
				openContainerPayload: payload,
				currency,
				currencyAmount,
			}
			if (currencyDiscount != null) bodyPayload.currencyDiscount = currencyDiscount
			if (currencyDiscountAmount != null) bodyPayload.currencyDiscountAmount = currencyDiscountAmount
			// 记账到 BeamioIndexerDiamond：requestHash（originalPaymentHash）、forText（displayJson）
			if (data.forText?.trim()) bodyPayload.forText = data.forText.trim()
			if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) {
				bodyPayload.requestHash = data.billRequestHash
			}

			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(bodyPayload),
			})
			const apiResult = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; USDC_tx?: string }
			setStepById('sendTx', 'success', 'Sent')
			if (res.ok && apiResult.success !== false) {
				if (apiResult.USDC_tx) setSuccessTxHash(apiResult.USDC_tx)
				setStepById('waitTx', 'success', 'Transaction complete')
				// 仅设置 paymentSuccessData，下一帧渲染 PaymentSuccessView；不在此处关闭或调用 onPaymentSuccess，需用户点击「Done & Go to Chat」后才回到父页面
				const amountCAD = data.amountStrCAD ?? data.amountStr
				const amountUSDC = data.amountStr
				const rate = amountCAD && amountUSDC ? (Number(amountUSDC) / Number(amountCAD)).toFixed(4) : undefined
				setPaymentSuccessData({
					txHash: apiResult.USDC_tx ?? '',
					amountCAD,
					amountUSDC,
					exchangeRateCADtoUSDC: rate,
					paidWithCCSACAD: data.usdcFromCCSACAD && Number(data.usdcFromCCSACAD) > 0 ? data.usdcFromCCSACAD : undefined,
					recipientName: data.payerDisplayName,
				})
			} else {
				setSubmitting(false)
				setStepById('waitTx', 'error', apiResult.error ?? `HTTP ${res.status}`)
				setVoucherPayError(apiResult.error ?? `HTTP ${res.status}`)
				return
			}
		} catch (e) {
			console.warn('AAtoEOA POST failed', e)
			setSubmitting(false)
			const errMsg = (e as Error)?.message ?? tu('request_failed')
			setStepById('sendTx', 'error', errMsg)
			setVoucherPayError(errMsg)
			return
		}
		setSubmitting(false)
	}

	const handleCancelDeduction = () => {
		setVoucherPayError('')
		setConfirmDeduction(null)
		setSuccessTxHash(null)
		setPaymentSuccessData(null)
		setScanData('')
		setScanIntent('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
		setVoucherPayFromScan?.(false)
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
		routingDoneRef.current = false
	}

	/**
	 * 放弃当前流程：Smart Routing 错误时点 OK，或 Payment Success 时点「Done & Go to Chat」.
	 * Workflow：Submitting 成功后仅设置 paymentSuccessData，显示 PaymentSuccessView；不在此处关闭或回调。
	 * 只有用户点击「Done & Go to Chat」时传入 fromPaymentSuccess=true，才调用 onPaymentSuccess() 回到父页面。
	 */
	const handleAbandonRouting = (fromPaymentSuccess?: boolean) => {
		if (fromPaymentSuccess && onPaymentSuccess) onPaymentSuccess()
		setSuccessTxHash(null)
		setPaymentSuccessData(null)
		setScanData('')
		setScanIntent('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
		routingDoneRef.current = false
	}

	const handleRetryRouting = () => {
		routingDoneRef.current = false
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
		setRoutingRetryTrigger((r) => r + 1)
	}

	const handleScanUser = () => {
		if (!value) return
		const toAA = profiles?.[0]?.aaAccount ?? ''
		if (!toAA) return
		setVoucherPayError('')
		setVoucherPayAmount(value)
		setVoucherPayToAA(toAA)
		setScanIntent('voucherPay')
		scanRef.current?.start()
	}

	const handleShowQR = () => {
		if (!value) return
		setShowQRSheet(true)
	}

	const handlePaymentWithNfc = async () => {
		if (!value || Number(value) <= 0) return
		const merchantAA = profiles?.[0]?.aaAccount ?? ''
		if (!merchantAA || !ethers.isAddress(merchantAA)) {
			setVoucherPayError('Merchant AA not found')
			return
		}
		setVoucherPayError('')
		const uid = await readUid()
		if (!uid) {
			setVoucherPayError('NFC 读取失败，请重试')
			return
		}
		try {
			const result = await fetchNfcCardStatus(uid)
			if (!result.registered) {
				setVoucherPayError('不存在该卡')
				return
			}
			if (!result.address) {
				setVoucherPayError('卡已登记但无法获取地址')
				return
			}
			setVoucherPayAmount(value)
			setVoucherPayToAA(merchantAA)
			setScanData(uid)
			setScanIntent('payByNfc')
		} catch (e) {
			setVoucherPayError((e as Error)?.message ?? '查询失败')
		}
	}

	// 商家 bill 必选项：Amount、currency、acceptTokens、to（收款方 AA）；to 为当前商家 AA，支付方扫码后款项转入此地址
	const merchantAA = profiles?.[0]?.aaAccount
	const paymentUrl = value && merchantAA && ethers.isAddress(merchantAA)
		? `http://beamio.app/Vouchers?Amount=${encodeURIComponent(value)}&currency=CAD&acceptTokens=USDC,CCSA&to=${encodeURIComponent(merchantAA)}`
		: ''

	// voucherPay / payBill / payByNfc workflow：Confirm → Submitting 成功 → 显示 PaymentSuccessView；仅当用户点击「Done & Go to Chat」才 onPaymentSuccess 回到父页面（不在此前关闭）
	if (scanIntent === 'voucherPay' || scanIntent === 'payBill' || scanIntent === 'payByNfc') {
		if (paymentSuccessData) {
			return (
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
					<PaymentSuccessView
						data={paymentSuccessData}
						onDone={() => handleAbandonRouting(true)}
					/>
				</div>
			)
		}
		if (confirmDeduction) {
			return (
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
					<ConfirmDeductionView
						data={confirmDeduction}
						onConfirm={handleConfirmDeduction}
						onCancel={handleCancelDeduction}
						submitting={submitting}
					/>
				</div>
			)
		}
		return (
			<>
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
					<SmartRoutingAnalysis steps={routingSteps} onAbandon={handleAbandonRouting} onRetry={handleRetryRouting} successTxHash={successTxHash ?? undefined} />
				</div>
			</>
		)
	}

	return (
		<>
			<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
				<TenKeyInput
					value={value}
					onChange={setValue}
					maxLength={maxLength}
					allowDecimal={allowDecimal}
					label={tu('enter_charge_cad')}
					currency="$"
					onScanUser={handleScanUser}
					onShowQR={handleShowQR}
					onPaymentWithNfc={handlePaymentWithNfc}
					errorMessage={voucherPayError}
				/>
			</div>

			{/* 底部滑出窗口 - 显示二维码 */}
			<div
				className={[
					"fixed inset-0 z-50",
					showQRSheet ? "pointer-events-auto" : "pointer-events-none"
				].join(" ")}
			>
				{/* 灰色遮罩 */}
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						showQRSheet ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => setShowQRSheet(false)}
				/>

				{/* Bottom Sheet：从底部滑出 */}
				<div
					className={[
						"absolute inset-x-0 bottom-0",
						"transition-transform duration-300 ease-out",
						showQRSheet ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体 */}
					<div
						className={[
							"w-full",
							"bg-white dark:bg-slate-900",
							"rounded-t-[32px]",
							"max-h-[90vh] overflow-y-auto"
						].join(" ")}
					>
						{/* 关闭按钮 */}
						<div className="sticky top-0 z-10 flex justify-end p-4 bg-white dark:bg-slate-900">
							<button
								type="button"
								onClick={() => setShowQRSheet(false)}
								className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						{/* ShowPayQR 组件内容 */}
						{paymentUrl && (
							<>
								<ShowPayQR
									successUrl={paymentUrl}
									beamio={beamio}
									amount={value}
									currency="$"
									hideActions={true}
									hideUrl={true}
								/>
								{/* 底部附加空间 */}
								<div className="h-64" />
							</>
						)}
					</div>
				</div>
			</div>
		</>
	)
}

export default TenKeyInputComponent;