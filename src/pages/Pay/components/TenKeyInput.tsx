import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, QrCode, Loader, Check, X, RefreshCw, Zap, Copy, ExternalLink } from 'lucide-react'
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from 'ethers'
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { beamioApiBase, readContainerNonceFromAAStorage } from '@/services/AAaccount'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import contracts from '@/utils/contracts'
import { baseEndpoint, CCSA_Card_Address, USDCContract_BASE, BeamioCardFactorySC } from '@/utils/constants'
import { quoteCurrencyAmountInUSDC, quoteUSDCToCAD } from '@/services/BeamioCard'
import { searchUsername } from '@/services/beamio'


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
	/** 显示在金额与键盘之间的错误信息（如 QR 最大金额不足） */
	errorMessage?: string
}

const TenKeyInput = ({ 
	value, 
	onChange, 
	maxLength = 10,
	allowDecimal = false,
	label = "ENTER CHARGE (CAD)",
	currency = "$",
	onScanUser,
	onShowQR,
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
			{(onScanUser || onShowQR) && (
				<div className="grid grid-cols-2 gap-2 shrink-0 px-3 pb-4 pt-1">
					{onScanUser && (
						<button
							type="button"
							onClick={onScanUser}
							disabled={!value}
							className="h-14 rounded-xl bg-[#1562f0] text-white shadow-lg flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<Camera size={20} />
							<span className="text-[10px] font-bold uppercase tracking-wider">SCAN USER</span>
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
	{ id: 'detectingUser', label: 'Detecting User', detail: '' },
	{ id: 'membership', label: 'Checking Membership', detail: '' },
	{ id: 'analyzingAssets', label: 'Analyzing Assets', detail: '' },
	{ id: 'optimizingRoute', label: 'Optimizing Route', detail: '' },
	{ id: 'sendTx', label: 'Sending transaction', detail: '' },
	{ id: 'waitTx', label: 'Waiting for transaction', detail: '' },
]
const VISIBLE_STEP_IDS = ['detectingUser', 'membership', 'analyzingAssets', 'optimizingRoute']

const STEP_ORDER = ROUTING_STEPS.map((s) => s.id)

const BASE_EXPLORER_TX = 'https://basescan.org/tx/'

function SmartRoutingAnalysis({ steps, onAbandon, successTxHash }: { steps: RoutingStep[]; onAbandon?: () => void; successTxHash?: string }) {
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
			<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center pt-8 pb-6">
				Smart Routing Analysis
			</h2>
			<div className="flex flex-col gap-4 px-6 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
				<AnimatePresence initial={false}>
					{displayOrder.map((step, index) => (
						<motion.div
							key={step.id}
							layout
							initial={index === 0 ? { x: '100%', opacity: 0 } : false}
							animate={{ x: 0, opacity: 1 }}
							transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
							className="flex items-start gap-4 flex-shrink-0"
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
							<a
								href={`${BASE_EXPLORER_TX}${successTxHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 dark:text-blue-400 hover:underline"
							>
								View on BaseScan
							</a>
						</p>
					)}
					<button
						type="button"
						onClick={onAbandon}
						className="w-full h-12 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-semibold active:scale-[0.98] transition-transform"
					>
						{hasError ? 'OK' : 'Done'}
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
	usdcFromBalanceWeiStr?: string
	ccsaPointsWeiStr?: string
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
	const totalReq = data.totalRequestedStrCAD ?? data.totalRequestedStr ?? data.amountStr
	const amount = data.amountStrCAD ?? data.amountStr
	const fromBal = data.usdcFromBalanceCAD ?? data.usdcFromBalance
	const fromCCSA = data.usdcFromCCSACAD ?? data.usdcFromCCSA
	const discountVal = data.hasDiscount && data.totalRequestedStr != null && data.amountStr != null
		? (data.totalRequestedStrCAD != null && data.amountStrCAD != null
			? (Number(data.totalRequestedStrCAD) - Number(data.amountStrCAD)).toFixed(2)
			: (Number(data.totalRequestedStr) - Number(data.amountStr)).toFixed(2))
		: null
	const hasCCSA = Number(fromCCSA) > 0
	const hasUSDC = Number(fromBal) > 0
	const payerName = data.payerDisplayName ?? (data.payload?.account
		? `${data.payload.account.slice(0, 6)}…${data.payload.account.slice(-4)}`
		: 'Payer')

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16">
			{/* Payer (扣款者 / QR holder) info header */}
			<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 flex items-center gap-4 mb-6">
				<div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
					Payer
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">
						{data.payerDisplayName ? `@${data.payerDisplayName}` : payerName}
					</p>
					{data.payerMemberLabel && (
						<p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
							<span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
								<Check className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
							</span>
							{data.payerMemberLabel}
						</p>
					)}
				</div>
			</div>

			{/* Bill Amount */}
			<div className="flex justify-between items-center mb-2">
				<span className="text-slate-500 dark:text-slate-400 text-sm">Bill Amount</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">CA${totalReq}</span>
			</div>

			{/* Member Discount (only if has discount) */}
			{data.hasDiscount && discountVal != null && (
				<div className="flex justify-between items-center mb-4 pl-1">
					<span className="text-slate-500 dark:text-slate-400 text-sm">Member Discount (10%)</span>
					<span className="font-bold text-blue-600 dark:text-blue-400">-CA${discountVal}</span>
				</div>
			)}

			{/* $CCSA Balance (only if deduction from CCSA > 0) */}
			{hasCCSA && (
				<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center justify-between gap-3 mb-3">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
							C
						</div>
						<span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">$CCSA Balance</span>
					</div>
					<span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm flex-shrink-0">-CA${fromCCSA}</span>
				</div>
			)}

			{/* USDC Top-up (only if deduction from USDC balance > 0) */}
			{hasUSDC && (
				<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center justify-between gap-3 mb-4">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
							$
						</div>
						<span className="text-blue-700 dark:text-blue-400 font-medium text-sm">USDC Top-up</span>
					</div>
					<span className="font-bold text-blue-700 dark:text-blue-400 text-sm flex-shrink-0">-CA${fromBal}</span>
				</div>
			)}

			{/* Total Charge - prominent */}
			<div className="flex justify-between items-baseline mt-2 mb-6">
				<span className="text-slate-500 dark:text-slate-400 text-sm">Total Charge</span>
				<span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">CA${amount}</span>
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
					Confirm Charge
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="text-slate-500 dark:text-slate-400 text-sm font-normal hover:underline disabled:opacity-50"
				>
					Cancel
				</button>
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
	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16 pb-6">
			<h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-1">
				Payment Successful
			</h1>
			<p className="text-lg font-bold text-slate-800 dark:text-slate-200 text-center">
				{data.recipientName ? `@${data.recipientName}` : 'Payment'}
			</p>
			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
				{data.txHash ? `${data.txHash.slice(0, 6)}…${data.txHash.slice(-4)} • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
			</p>

			<div className="flex justify-between items-center mb-4">
				<span className="font-bold text-slate-700 dark:text-slate-300">Total Paid</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">CA${data.amountCAD}</span>
			</div>

			<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 mb-3">
				<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm mb-3">
					<RefreshCw className="w-4 h-4" />
					PAYMENT DETAILS
				</div>
				<div className="flex justify-between text-sm mb-1">
					<span className="text-slate-600 dark:text-slate-400">Exchange Rate</span>
					<span className="text-slate-800 dark:text-slate-200">1 CAD ≈ {rate} USDC</span>
				</div>
				<div className="flex justify-between items-center mt-2">
					<span className="font-bold text-slate-700 dark:text-slate-300">Total Paid in USDC</span>
					<span className="font-bold text-blue-600 dark:text-blue-400">{data.amountUSDC} USDC</span>
				</div>
			</div>

			{data.paidWithCCSACAD != null && Number(data.paidWithCCSACAD) > 0 && (
				<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 mb-4">
					<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-3">
						<Zap className="w-4 h-4" />
						PAYMENT SOURCE
					</div>
					<div className="flex justify-between items-center">
						<span className="font-bold text-emerald-700 dark:text-emerald-600">Paid with $CCSA</span>
						<span className="font-bold text-emerald-700 dark:text-emerald-600">$CCSA {data.paidWithCCSACAD}</span>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">1 $CCSA = 1.00 CAD</p>
				</div>
			)}

			<div className="flex justify-between text-sm mb-1">
				<span className="text-slate-500 dark:text-slate-400">Network</span>
				<span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
					<span className="w-2 h-2 rounded-full bg-blue-500" />
					Base Mainnet
				</span>
			</div>
			<div className="flex justify-between items-center text-sm mb-6">
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
						<a
							href={`${BASE_EXPLORER_TX}${data.txHash}`}
							target="_blank"
							rel="noopener noreferrer"
							className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
							title="View on BaseScan"
						>
							<ExternalLink className="w-4 h-4" />
						</a>
					)}
				</div>
			</div>

			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">GRAND TOTAL PAID</p>
			<p className="text-3xl font-bold text-blue-600 dark:text-blue-400 text-center mb-6">CA${data.amountCAD}</p>

			<button
				type="button"
				onClick={onDone}
				className="w-full h-14 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-base"
			>
				Done & Go to Chat
			</button>
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
	const [confirmDeduction, setConfirmDeduction] = useState<ConfirmDeductionPayload | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
	const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentSuccessData | null>(null)
	const routingDoneRef = useRef(false)
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
	} = useDaemonContext()
	const maxLength = 10
	const allowDecimal = true

	// 每次挂载时清空上一次遗留的 scan/voucher 状态，避免复用旧 scan 数据导致 QR code has expired
	useEffect(() => {
		setScanData('')
		setScanIntent('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
		setVoucherPayError('')
		routingDoneRef.current = false
	}, [setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayError])

	// 输入变化时清除扫码错误提示
	useEffect(() => {
		if (voucherPayError) setVoucherPayError('')
	}, [value])

	// voucherPay 流程：当 scanIntent === 'voucherPay' 且 scanData 到位时执行步骤并更新 UI
	useEffect(() => {
		if (scanIntent !== 'voucherPay' || !scanData || routingDoneRef.current) return
		routingDoneRef.current = true

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
				const primary = await aaFactory.primaryAccountOf(payload.to)
				if (!primary || primary === ethers.ZeroAddress) {
					failStep('detectingUser', 'Beneficiary has no AA account')
					return
				}
			} catch (e) {
				failStep('detectingUser', (e as Error)?.message ?? 'Could not verify beneficiary AA')
				return
			}
			try {
				const storedNonce = await readContainerNonceFromAAStorage(baseEndpoint, payload.account, 'openRelayed')
				const payloadNonce = BigInt(payload.nonce)
				if (storedNonce !== payloadNonce) {
					failStep('detectingUser', `Nonce mismatch: expected ${storedNonce}, got ${payloadNonce}`)
					return
				}
			} catch (e) {
				failStep('detectingUser', (e as Error)?.message ?? 'Could not read nonce')
				return
			}
			const nowSec = Math.floor(Date.now() / 1000)
			const deadlineSec = parseInt(payload.deadline, 10)
			if (Number.isNaN(deadlineSec) || nowSec >= deadlineSec) {
				failStep('detectingUser', 'QR code has expired')
				return
			}
			let enteredWei: bigint
			try {
				if (voucherPayAmount && Number(voucherPayAmount) > 0) {
					const { usdc6 } = await quoteCurrencyAmountInUSDC(CCSA_Card_Address, 'CAD', voucherPayAmount)
					enteredWei = usdc6
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
				const [pt, nfts] = await cardContract.getOwnership(payload.account)
				pointsBalanceWei = BigInt(pt?.toString() ?? 0)
				cardNumbers = (nfts || []).map((n: { tokenId: bigint }) => n.tokenId.toString()).filter(Boolean)
				const detail = cardNumbers.length > 0 ? 'Cardholder (10% OFF)' : 'No membership discount'
				setStepSuccess('membership', detail)
			} catch (e) {
				console.warn('CCSA card check failed', e)
				failStep('membership', 'Could not read CCSA card')
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
					unitPriceUSDC6 = BigInt((await BeamioCardFactorySC.quoteUnitPointInUSDC6(CCSA_Card_Address))?.toString() ?? 0)
					ccsaCapacityUsdcWei = (pointsBalanceWei * unitPriceUSDC6) / 1_000_000n
				} catch (e) {
					console.warn('CCSA quote UnitPointInUSDC6 failed', e)
				}
			}

			// Step 3: Analyzing Assets (balance check; show CCSA amount or sufficient)
			let balanceWei = 0n
			if (effectiveWei > 0n) {
				setStepLoading('analyzingAssets')
				await loadingDelay()
				try {
					const usdcAsset = payload.items?.find((it: { kind: number }) => it.kind === 0)?.asset ?? USDCContract_BASE
					const tokenContract = new ethers.Contract(
						usdcAsset,
						usdc_abi as ethers.InterfaceAbi,
						baseEndpoint
					)
					const bal = await tokenContract.balanceOf(payload.account)
					balanceWei = BigInt(bal.toString())
					const totalAvailableWei = balanceWei + ccsaCapacityUsdcWei
					if (totalAvailableWei < effectiveWei) {
						failStep('analyzingAssets', 'Insufficient balance')
						return
					}
					const ccsaFormatted = ethers.formatUnits(ccsaCapacityUsdcWei, 6)
					const detail = ccsaCapacityUsdcWei > 0n
						? `$CCSA: ${Number(ccsaFormatted).toFixed(2)} (Partial)`
						: 'USDC sufficient'
					setStepSuccess('analyzingAssets', detail)
				} catch (e) {
					console.warn('Balance check failed', e)
					failStep('analyzingAssets', 'Could not verify balance')
					return
				}
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
				amountStrCAD = await quoteUSDCToCAD(CCSA_Card_Address, amountStr)
				usdcFromBalanceCAD = await quoteUSDCToCAD(CCSA_Card_Address, usdcFromBalanceStr)
				usdcFromCCSACAD = await quoteUSDCToCAD(CCSA_Card_Address, usdcFromCCSAStr)
				customerUsdcBalanceCAD = await quoteUSDCToCAD(CCSA_Card_Address, customerUsdcBalanceStr)
				totalRequestedStrCAD = await quoteUSDCToCAD(CCSA_Card_Address, totalRequestedStrVal)
			} catch (e) {
				console.warn('USDC to CAD quote failed, Confirm deduction will show USDC amounts', e)
			}

			// 付款人 Beamio 信息：通过 AA.owner() 得到付款人 EOA，再 searchUsername(EOA) 获取
			let payerDisplayName: string | undefined
			try {
				const aaContract = new ethers.Contract(
					payload.account,
					['function owner() view returns (address)'],
					baseEndpoint
				)
				const payerEOA = await aaContract.owner() as string
				if (payerEOA && payerEOA !== ethers.ZeroAddress) {
					const account = await searchUsername(payerEOA)
					if (account?.results?.[0]?.username) {
						payerDisplayName = account.results[0].username
					}
				}
			} catch (e) {
				console.warn('Payer Beamio lookup failed (searchUsername by EOA)', e)
			}

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
				usdcFromBalanceWeiStr: usdcFromBalanceWei > 0n ? usdcFromBalanceWei.toString() : undefined,
				ccsaPointsWeiStr: ccsaPointsWei > 0n ? ccsaPointsWei.toString() : undefined,
			})
			// 不在此处 submit；等用户确认后再提交
			return
		})()
	}, [scanIntent, scanData, voucherPayAmount, voucherPayToAA, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayError])

	// 进入 voucherPay 时重置步骤为 pending（等待 scanData），并清空确认
	useEffect(() => {
		if (scanIntent === 'voucherPay') {
			setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
			setConfirmDeduction(null)
			routingDoneRef.current = false
		}
	}, [scanIntent])

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
		// Build items from deduction split: only include items with amount > 0; do not add zero-amount items.
		// ERC1155 asset uses the same CCSA card as Step 6 (balance check): the account’s balance is on this card; factory.beamioUserCard() must be set to this address on-chain.
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
		// openContainerPayload.to 填受益人 AA = 自己（当前扫码确认的用户），非 QR 里的签字人（被扣款人）
		const beneficiaryAA = voucherPayToAA || profiles?.[0]?.aaAccount || ''
		if (!beneficiaryAA || !ethers.isAddress(beneficiaryAA)) {
			setSubmitting(false)
			setVoucherPayError('Beneficiary AA not found. Please use the account that will receive the payment.')
			return
		}
		const toAddress = ethers.getAddress(beneficiaryAA)
		const payload: OpenContainerRelayPayload = {
			...data.payload,
			to: toAddress,
			items,
		}

		setStepById('sendTx', 'loading', 'Submitting…')
		try {
			const url = `${beamioApiBase.replace(/\/$/, '')}/api/AAtoEOA`
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					openContainerPayload: payload,
				}),
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
			const errMsg = (e as Error)?.message ?? 'Request failed'
			setStepById('sendTx', 'error', errMsg)
			setVoucherPayError(errMsg)
			return
		}
		setSubmitting(false)
	}

	const handleCancelDeduction = () => {
		setVoucherPayError('Cancelled')
		setConfirmDeduction(null)
		setSuccessTxHash(null)
		setScanData('')
		setScanIntent('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
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

	const paymentUrl = value ? `http://beamio.app/Vouchers?Amount=${value}` : ''

	// voucherPay workflow：Confirm → Submitting 成功 → 显示 PaymentSuccessView；仅当用户点击「Done & Go to Chat」才 onPaymentSuccess 回到父页面（不在此前关闭）
	if (scanIntent === 'voucherPay') {
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
					<SmartRoutingAnalysis steps={routingSteps} onAbandon={handleAbandonRouting} successTxHash={successTxHash ?? undefined} />
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
					label="ENTER CHARGE (CAD)"
					currency="$"
					onScanUser={handleScanUser}
					onShowQR={handleShowQR}
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