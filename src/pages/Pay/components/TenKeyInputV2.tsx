import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, QrCode, Loader, Check, X, RefreshCw, Zap, Copy, ExternalLink, Wallet, CreditCard } from 'lucide-react'
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import ConformView from '@/pages/Pay/send/ConformView'
import { AppButton } from '@/components/button/AppButton'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from 'ethers'
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { beamioApiBase, readContainerNonceFromAAStorage, signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen } from '@/services/AAaccount'
import { AuthorizationSign } from '@/services/beamio'
import { getAAAccount } from '@/services/BeamioCard'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import contracts from '@/utils/contracts'
import { baseEndpoint, CCSA_Card_Address, USDCContract_BASE, BeamioCardFactorySC } from '@/utils/constants'
import { searchUsername } from '@/services/beamio'
import { formatAmount, fiatPrefix } from '@/services/currency'

const aptEndpoint = 'https://api.settleonbase.xyz'
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
const getImg = (seed: string | undefined) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(seed || '@Beamio')}`

/** Beamio last_name 格式：普通 lastname + '\\r\\n' + 设定 JSON，取第一个非 JSON 片段作为展示用 */
const getDisplayLastName = (lastName: string | undefined): string => {
	if (!lastName) return ''
	const parts = lastName.split('\r\n')
	const displayPart = parts.find((p) => (p?.trim() ?? '') && !/^\{/.test((p ?? '').trim()))
	return (displayPart ?? '').trim()
}


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

const RPC_ERROR_MSG = 'RPC错误'

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
									<RefreshCw className="w-4 h-4" strokeWidth={2.5} />
									Try again
								</button>
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
	/** 扣款者 Beamio 标签/全名（first_name + last_name），用于 Payer 区块展示 */
	payerBeamioTag?: string
	usdcFromBalanceWeiStr?: string
	ccsaPointsWeiStr?: string
	/** Bill 支付：无预签 payload，确认时由付款人签名；to 为 bill 的 AA */
	isBillPay?: boolean
	billPayeeAA?: string
	/** Bill 受益方为 EOA 时：true 使用 AA→EOA，false 使用 EOA→EOA */
	billPayeeIsEOA?: boolean
	useAaToEoa?: boolean
	/** AA+EOA 组合：先 AA 转 aaAmountStr，再 EOA 转 eoaAmountStr，合计为 amountStr */
	useAaPlusEoa?: boolean
	aaAmountStr?: string
	eoaAmountStr?: string
	/** Bill 的 forText 参数（付款备注） */
	forText?: string
	/** Bill 支付时：请求方商家展示名（Beamio 名），无则用短地址 */
	payeeDisplayName?: string
	/** Bill 支付时：受益人 Beamio 信息（头像、姓名、beamioTag） */
	payeeImage?: string
	payeeFirstName?: string
	payeeLastName?: string
	payeeAccountName?: string
	/** Bill 支付时：商家会员标签（可选） */
	payeeMemberLabel?: string
	/** Bill 请求币种（如 USD、JPY），用于金额展示；无则用 CAD */
	billCurrency?: string
	/** Bill 支付时：URL 中的 requestHash（bytes32），供记账写入 originalPaymentHash 以关联 request_create */
	billRequestHash?: string
	/** Bill 时：请求币种的展示金额（与 amountStr 等对应） */
	amountStrFiat?: string
	usdcFromBalanceFiat?: string
	usdcFromCCSAFiat?: string
	totalRequestedStrFiat?: string
	/** Bill 支付方无 AA、仅用 EOA USDC 支付（受益方可为 AA 或 EOA） */
	billPayerEoaOnly?: boolean
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
	const reqCur = (data.billCurrency || 'CAD').toUpperCase() as 'CAD'|'USD'|'JPY'|'EUR'|'CNY'|'HKD'|'TWD'|'SGD'
	const sym = fiatPrefix(reqCur) || `${reqCur} `
	// Bill 时优先用请求币种展示，否则用 CAD
	const amount = data.billCurrency ? (data.amountStrFiat ?? data.amountStr) : (data.amountStrCAD ?? data.amountStr)
	const totalReq = data.billCurrency ? (data.totalRequestedStrFiat ?? data.totalRequestedStr ?? data.amountStr ?? '') : (data.totalRequestedStrCAD ?? data.totalRequestedStr ?? data.amountStr ?? '')
	const fromBal = data.billCurrency ? (data.usdcFromBalanceFiat ?? data.usdcFromBalance) : (data.usdcFromBalanceCAD ?? data.usdcFromBalance)
	const fromCCSA = data.billCurrency ? (data.usdcFromCCSAFiat ?? data.usdcFromCCSA) : (data.usdcFromCCSACAD ?? data.usdcFromCCSA)
	const discountVal = data.hasDiscount && data.totalRequestedStr != null && data.amountStr != null
		? (data.billCurrency && data.totalRequestedStrFiat != null && data.amountStrFiat != null
			? Number(data.totalRequestedStrFiat) - Number(data.amountStrFiat)
			: data.totalRequestedStrCAD != null && data.amountStrCAD != null
				? Number(data.totalRequestedStrCAD) - Number(data.amountStrCAD)
				: Number(data.totalRequestedStr) - Number(data.amountStr))
		: null
	const hasCCSA = Number(fromCCSA) > 0
	const hasUSDC = Number(fromBal) > 0
	const payerName = data.payerDisplayName ?? (data.payload?.account
		? `${data.payload.account.slice(0, 6)}…${data.payload.account.slice(-4)}`
		: 'Payer')
	const isBillPay = !!data.isBillPay
	const payeeAddr = data.billPayeeAA ?? data.payload?.to ?? ''
	const payeeName = data.payeeDisplayName ?? (payeeAddr ? `${payeeAddr.slice(0, 6)}…${payeeAddr.slice(-4)}` : 'Merchant')
	// Beamio 标准格式：fullName = firstName + lastName（首行），无则 fallback accountName / 地址
	const payeeFullName = [data.payeeFirstName, data.payeeLastName].filter(Boolean).join(' ').trim() || data.payeeAccountName || payeeName
	// 支付来源：无 AA 时用 EOA；EOA 受益方时 useAaToEoa/useAaPlusEoa 决定；否则为 Express Pay
	const isPayingFromAA = data.billPayerEoaOnly ? false : (data.billPayeeIsEOA ? (!!data.useAaToEoa || !!data.useAaPlusEoa) : true)
	const payingFromAddr = data.payload?.account ?? ''
	const payingFromLabel = data.useAaPlusEoa ? 'Smart Routing (AA + EOA)' : (isPayingFromAA ? 'Express Pay' : 'Main Vault')
	const payingFromSubLabel = data.useAaPlusEoa ? 'Combined transfer' : (isPayingFromAA ? 'Smart Account' : 'EOA')

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16">
			{/* 标题：Pay bill 时显示 */}
			{isBillPay && (
				<h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center mb-4">
					Pay bill
				</h1>
			)}
			{/* Bill 时显示请求方商家信息（Beamio 标准：头像、firstName+lastName、@beamioTag），否则显示 Payer (扣款者 / QR holder) 信息 */}
			<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 flex items-center gap-4 mb-6">
				{isBillPay ? (
					<div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
						{data.payeeImage ? (
							<img src={data.payeeImage} alt="" className="w-full h-full object-cover" />
						) : (
							<img src={getImg(data.payeeAccountName ?? payeeAddr)} alt="" className="w-full h-full object-cover" />
						)}
					</div>
				) : (
					<div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
						Payer
					</div>
				)}
				<div className="min-w-0 flex-1">
					{isBillPay ? (
						<>
							<p className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
								Pay to
							</p>
							{(payeeFullName || payeeName) ? (
								<p className="font-bold text-slate-900 dark:text-slate-100 text-base truncate mt-0.5">
									{payeeFullName || payeeName}
								</p>
							) : null}
							{data.payeeAccountName ? (
								<p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-0.5">
									@{data.payeeAccountName}
								</p>
							) : null}
							{payeeAddr ? (
								<p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">
									{shortAddr(payeeAddr)}
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
							{/* forText：请求 URL 中的备注，iOS 风格 note 胶囊 */}
							{data.forText && data.forText.trim() && (
								<div className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200/80 dark:border-amber-700/40 px-4 py-3">
									<p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">{data.forText.trim()}</p>
								</div>
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

			{/* Paying from：显示用于支付的钱包（Express Pay / Main Vault） */}
			{isBillPay && payingFromAddr && (
				<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 flex items-center gap-4 mb-6">
					<div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-200 dark:bg-slate-700">
						{isPayingFromAA ? (
							<CreditCard className="w-6 h-6 text-violet-600 dark:text-violet-400" strokeWidth={2.2} />
						) : (
							<Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={2.2} />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
							Paying from
						</p>
						<p className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">
							{payingFromLabel}
						</p>
						<p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">
							{shortAddr(payingFromAddr)} · {payingFromSubLabel}
						</p>
					</div>
				</div>
			)}

			{/* Bill Amount：真实 totalRequested（与 POST/链上 container 一致） */}
			<div className="flex justify-between items-center mb-2 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400 text-sm">Bill Amount</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">{sym}{formatAmount(totalReq, reqCur)}</span>
			</div>

			{/* Member Discount (10%)：真实 totalRequested − amount（与 POST/链上一致） */}
			{data.hasDiscount && discountVal != null && (
				<div className="flex justify-between items-center mb-4 leading-[1.375rem]">
					<span className="text-slate-500 dark:text-slate-400 text-sm">Member Discount (10%)</span>
					<span className="font-bold text-blue-600 dark:text-blue-400">-{sym}{formatAmount(discountVal, reqCur)}</span>
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
					<span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm flex-shrink-0">-{sym}{formatAmount(fromCCSA, reqCur)}</span>
				</div>
			)}

			{/* USDC / USDC Top-up (toEOA 时用 USDC，否则用 USDC Top-up) */}
			{hasUSDC && (
				<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center justify-between gap-3 mb-4">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
							$
						</div>
						<span className="text-blue-700 dark:text-blue-400 font-medium text-sm">{data.billPayeeIsEOA ? 'USDC' : 'USDC Top-up'}</span>
					</div>
					<span className="font-bold text-blue-700 dark:text-blue-400 text-sm flex-shrink-0">-{sym}{formatAmount(fromBal, reqCur)}</span>
				</div>
			)}

			{/* Total Charge - prominent */}
			<div className="flex justify-between items-baseline mt-2 mb-6 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400 text-sm">Total Charge</span>
				<span className="text-4xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{sym}{formatAmount(amount, reqCur)}</span>
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
				>
					Cancel
				</button>
			</div>
		</div>
	)
}

export type PaymentSuccessData = {
	txHash: string
	/** 多笔转账时（如 AA+EOA 组合）展示所有 hash；单笔时可用 txHash */
	txHashes?: string[]
	amountCAD: string
	amountUSDC: string
	/** 请求币种（CAD/USD/JPY 等），用于 fiatPrefix 和 formatAmount；EOA 直转时为 USDC */
	currency?: string
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
	// Beamio 标准：fiatPrefix + formatAmount 展示币种
	const reqCur = (data.currency || 'CAD').toUpperCase() as ICurrency
	const sym = fiatPrefix(reqCur) || `${reqCur} `
	// 法币金额（Total Paid）：法币时用 amountCAD，USDC 时用 amountUSDC
	const amountFiat = reqCur === 'USDC' ? Number(data.amountUSDC) : Number(data.amountCAD)
	const totalPaidFormatted = `${sym}${formatAmount(amountFiat, reqCur)}`
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
	const usdcFormatted = usdcFromBalance ? formatAmount(Number(usdcFromBalance), 'USDC') : '0'
	
	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-16 pb-6">
			<h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-1">
				Payment Successful
			</h1>
			<p className="text-lg font-bold text-slate-800 dark:text-slate-200 text-center">
				{data.recipientName ? `@${data.recipientName}` : 'Payment'}
			</p>
			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
				{data.txHashes && data.txHashes.length > 1
					? `${data.txHashes.length} transactions • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
					: data.txHash ? `${data.txHash.slice(0, 6)}…${data.txHash.slice(-4)} • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
			</p>

			{/* 多笔转账时展示两个 hash */}
			{data.txHashes && data.txHashes.length >= 2 && (
				<div className="mb-6 space-y-3">
					<p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Transaction IDs</p>
					{data.txHashes.map((h, i) => (
						<div key={h} className="flex justify-between items-center text-sm">
							<span className="text-slate-500 dark:text-slate-400">{(i === 0 ? 'AA→EOA' : 'EOA→EOA')}</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										navigator.clipboard.writeText(`${BASE_EXPLORER_TX}${h}`)
										setCopied(true)
										if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
										copyTimeoutRef.current = setTimeout(() => { setCopied(false); copyTimeoutRef.current = null }, 2000)
									}}
									className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:underline"
								>
									{h.slice(0, 6)}…{h.slice(-4)}
									<Copy className="w-3.5 h-3.5 flex-shrink-0" />
								</button>
								<a href={`${BASE_EXPLORER_TX}${h}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600" title="View on BaseScan">
									<ExternalLink className="w-4 h-4" />
								</a>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="flex justify-between items-center mb-4 leading-[1.5rem]">
				<span className="font-bold text-slate-700 dark:text-slate-300">Total Paid</span>
				<span className="font-bold text-slate-900 dark:text-slate-100">{totalPaidFormatted}</span>
			</div>

			{needsUSDCCharge && (
				<div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 mb-3">
					<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm mb-3">
						<RefreshCw className="w-4 h-4" />
						PAYMENT DETAILS
					</div>
					<div className="flex justify-between text-sm mb-1">
						<span className="text-slate-600 dark:text-slate-400">Exchange Rate</span>
						<span className="text-slate-800 dark:text-slate-200">1 {reqCur} ≈ {rate} USDC</span>
					</div>
					<div className="flex justify-between items-center mt-2">
						<span className="font-bold text-slate-700 dark:text-slate-300">Total Paid in USDC</span>
						<span className="font-bold text-blue-600 dark:text-blue-400">{usdcFormatted} USDC</span>
					</div>
				</div>
			)}

			{data.paidWithCCSACAD != null && Number(data.paidWithCCSACAD) > 0 && (
				<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 mb-4">
					<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-3">
						<Zap className="w-4 h-4" />
						PAYMENT SOURCE
					</div>
					<div className="flex justify-between items-center">
						<span className="font-bold text-emerald-700 dark:text-emerald-600">Paid with $CCSA</span>
						<span className="font-bold text-emerald-700 dark:text-emerald-600">{fiatPrefix('CAD')}{formatAmount(Number(data.paidWithCCSACAD), 'CAD')}</span>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">1 $CCSA = {fiatPrefix('CAD')}1.00</p>
				</div>
			)}

			<div className="flex justify-between text-sm mb-1 leading-[1.375rem]">
				<span className="text-slate-500 dark:text-slate-400">Network</span>
				<span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
					<span className="w-2 h-2 rounded-full bg-blue-500" />
					Base Mainnet
				</span>
			</div>
			{(!data.txHashes || data.txHashes.length < 2) && (
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
			)}

			<p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">GRAND TOTAL PAID</p>
			<p className="text-4xl font-bold text-blue-600 dark:text-blue-400 text-center mb-6">{totalPaidFormatted}</p>

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

const TenKeyInputComponentNew = (props: TenKeyInputComponentProps) => {
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
	const [eoaTransferMessage, setEoaTransferMessage] = useState<any>(null)
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
		setVoucherPayFromScan,
		currencyData,
		myAddress,
		usdcbalance,
	} = useDaemonContext()
	const maxLength = 10
	const allowDecimal = true

	// 使用全局 Oracle 喂料器提供的 currencyData
	type OracleRates = { USDC: number; CAD: number; USD: number; JPY?: number; EUR?: number; CNY?: number; HKD?: number; TWD?: number; SGD?: number }
	const ensureOracle = (): OracleRates => {
		const d = (currencyData as any) || {}
		return {
			USDC: Number(d.USDC) || 1,
			CAD: Number(d.CAD) || 1.35,
			USD: 1,
			JPY: Number(d.JPY) || 150,
			EUR: Number(d.EUR) || 0.92,
			CNY: Number(d.CNY) || 7.2,
			HKD: Number(d.HKD) || 7.8,
			TWD: Number(d.TWD) || 31,
			SGD: Number(d.SGD) || 1.35
		}
	}
	/** 汇率：1 USD = rate 该币种。如 1 USD = 1.35 CAD → usdToCur['CAD']=1.35 */
	const usdToCur = (r: OracleRates, c: string): number => {
		const cur = (c || '').toUpperCase()
		if (cur === 'USD' || cur === 'USDC') return 1
		const v = (r as any)[cur]
		return Number.isFinite(v) && v > 0 ? v : 1
	}
	/** Bill 金额（request currency）按支付时牌价换算为 USDC6 */
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
		// amount 在 cur 币种，1 cur = 1/usdToCur USD，1 USD = 1/USDC USDC
		const amountUsd = n / usdToCur(rates, cur)
		const usdc = rates.USDC ? amountUsd / rates.USDC : amountUsd
		try {
			return ethers.parseUnits(usdc.toFixed(6), 6)
		} catch {
			return 0n
		}
	}
	const usdcToCadStr = (rates: OracleRates, usdcStr: string): string => {
		if (!rates.USDC || !rates.CAD) return usdcStr
		const n = Number(usdcStr)
		if (!Number.isFinite(n)) return '0.00'
		return (n * rates.USDC * rates.CAD).toFixed(2)
	}
	/** USDC 换算为指定 currency 的显示金额 */
	const usdcToFiatStr = (rates: OracleRates, usdcStr: string, currency: string): string => {
		const n = Number(usdcStr)
		if (!Number.isFinite(n)) return '0.00'
		const cur = (currency || '').toUpperCase()
		if (cur === 'USD' || cur === 'USDC') return (n * (rates.USDC || 1)).toFixed(2)
		const amountUsd = n * (rates.USDC || 1)
		const amountCur = amountUsd * usdToCur(rates, cur)
		return (cur === 'JPY' || cur === 'TWD' ? Math.round(amountCur) : amountCur.toFixed(2)).toString()
	}

	// 每次挂载时清空上一次遗留的 scan/voucher 状态；若已是 voucherPay/payBill 则保留 scanData/scanIntent 及金额（voucherPayAmount）供本组件消费
	// 仅当不在 voucherPay/payBill 时清空，避免用户点击 Scan User 后 setScanIntent('voucherPay') 触发本 effect 把刚设的 voucherPayAmount 清掉导致 Analyzing Assets 出现 Skipped (zero amount)
	useEffect(() => {
		if (scanIntent !== 'voucherPay' && scanIntent !== 'payBill') {
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

	// payBill：进入后自动打开扫描，让用户扫商家的 bill paymentUrl
	useEffect(() => {
		if (scanIntent === 'payBill') {
			scanRef.current?.start()
		}
	}, [scanIntent, scanRef])

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
					const billPayeeAddr = ethers.getAddress(toParam)
					setVoucherPayAmount(amountParam)
					setVoucherPayToAA(billPayeeAddr)
					setStepLoading('detectingUser')
					await loadingDelay()
					// 使用 Beamio Account Factory 校验 to 是否为合法 BeamioAccount；若为 EOA 则进入 toEOA 流程
					let billPayeeIsEOA = false
					try {
						const aaFactory = new ethers.Contract(
							contracts.BeamioAAAcountFactory.address,
							contracts.BeamioAAAcountFactory.abi,
							baseEndpoint
						)
						const isBeamio = await retryRpcCall(() => aaFactory.isBeamioAccount(billPayeeAddr))
						if (!isBeamio) {
							billPayeeIsEOA = true
							setStepSuccess('detectingUser', 'Payee is EOA, using Smart Routing')
						} else {
							setStepSuccess('detectingUser', 'Bill payee validated')
						}
					} catch (e) {
						failStep('detectingUser', RPC_ERROR_MSG)
						return
					}

					// 受益方为 EOA：Smart Routing（AA 充足则 AA→EOA，否则 EOA→EOA）
					if (billPayeeIsEOA) {
						const payerEOA = myAddress ?? profiles?.[0]?.keyID ?? ''
						if (!payerEOA || !ethers.isAddress(payerEOA)) {
							failStep('detectingUser', 'Payer EOA not found')
							return
						}
						let enteredWei: bigint
						try {
							const rates = ensureOracle()
							enteredWei = fiatToUsdc6(rates, amountParam, currencyParam)
						} catch (e) {
							console.warn('Bill currency to USDC (shared oracle) failed', e)
							enteredWei = 0n
						}
						await doneDelay()

						setStepLoading('membership')
						await loadingDelay()
						setStepSuccess('membership', 'N/A (EOA payee)')
						await doneDelay()

						const effectiveWei = enteredWei
						setStepLoading('analyzingAssets')
						await loadingDelay()
						let payerAaBalanceWei = 0n
						let payerEoaBalanceWei = 0n
						let payerChainAA: string | undefined
						try {
							if (payerAA && ethers.isAddress(payerAA)) {
								const tokenContract = new ethers.Contract(
									USDCContract_BASE,
									usdc_abi as ethers.InterfaceAbi,
									baseEndpoint
								)
								payerAaBalanceWei = BigInt((await retryRpcCall(() => tokenContract.balanceOf(payerAA))).toString())
								payerChainAA = payerAA
							}
							payerEoaBalanceWei = BigInt((await retryRpcCall(() =>
								new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
									.balanceOf(payerEOA)
							)).toString())
						} catch (e) {
							failStep('analyzingAssets', RPC_ERROR_MSG)
							return
						}
						const totalAvailableWei = payerAaBalanceWei + payerEoaBalanceWei
						if (effectiveWei > 0n && totalAvailableWei < effectiveWei) {
							const reqStr = ethers.formatUnits(effectiveWei, 6)
							const balStr = ethers.formatUnits(totalAvailableWei, 6)
							failStep('analyzingAssets', `Insufficient balance. Requested: ${reqStr} USDC, Available: ${balStr} USDC`)
							return
						}
						const useAaToEoa = payerChainAA && payerAaBalanceWei >= effectiveWei
						const useAaPlusEoa = !useAaToEoa && !!payerChainAA && payerAaBalanceWei > 0n && payerEoaBalanceWei >= (effectiveWei - payerAaBalanceWei)
						const routeDetail = useAaToEoa ? 'AA→EOA (sufficient)' : useAaPlusEoa ? 'AA+EOA (Hybrid)' : 'EOA→EOA'
						setStepSuccess('analyzingAssets', `AA: ${ethers.formatUnits(payerAaBalanceWei, 6)}, EOA: ${ethers.formatUnits(payerEoaBalanceWei, 6)}`)
						await doneDelay()

						setStepLoading('optimizingRoute')
						await loadingDelay()
						setStepSuccess('optimizingRoute', routeDetail)
						await doneDelay()

						const amountStr = ethers.formatUnits(effectiveWei, 6)
						const amountStrFiat = (() => {
							try {
								return usdcToFiatStr(ensureOracle(), amountStr, (currencyParam || 'USD').toUpperCase())
							} catch {
								return amountStr
							}
						})()

						// EOA 受益方：通过 searchUsername 获取 Beamio 信息
						let payeeImage: string | undefined
						let payeeFirstName: string | undefined
						let payeeLastName: string | undefined
						let payeeAccountName: string | undefined
						try {
							const account = await searchUsername(billPayeeAddr)
							const peer = account?.results?.[0]
							if (peer) {
								payeeAccountName = (peer as { username?: string }).username
								payeeImage = (peer as { image?: string }).image
								payeeFirstName = (peer as { first_name?: string }).first_name
								payeeLastName = getDisplayLastName((peer as { last_name?: string }).last_name)
							}
						} catch (e) {
							console.warn('Bill payee EOA Beamio lookup failed', e)
						}

						const aaAmountWei = useAaPlusEoa ? payerAaBalanceWei : (useAaToEoa ? effectiveWei : 0n)
						const eoaAmountWei = useAaPlusEoa ? (effectiveWei - payerAaBalanceWei) : (useAaToEoa ? 0n : effectiveWei)
						setConfirmDeduction({
							payload: {
								account: (useAaPlusEoa ? payerChainAA : payerChainAA || payerEOA) ?? payerEOA,
								to: billPayeeAddr,
								items: [{ kind: 0, asset: USDCContract_BASE, amount: (useAaPlusEoa ? aaAmountWei : effectiveWei).toString(), tokenId: '0', data: '0x' }],
								currencyType: 4,
								maxAmount: '0',
								nonce: '0',
								deadline: String(Math.floor(Date.now() / 1000) + 300),
								signature: '0x',
							} as OpenContainerRelayPayload,
							amountStr,
							usdcFromBalance: amountStr,
							usdcFromCCSA: '0',
							customerUsdcBalance: ethers.formatUnits(useAaToEoa ? payerAaBalanceWei : (useAaPlusEoa ? payerEoaBalanceWei : payerEoaBalanceWei), 6),
							totalRequestedStr: amountStr,
							hasDiscount: false,
							isBillPay: true,
							billPayeeAA: billPayeeAddr,
							billPayeeIsEOA: true,
							useAaToEoa: !!useAaToEoa,
							useAaPlusEoa: !!useAaPlusEoa,
							aaAmountStr: useAaPlusEoa ? ethers.formatUnits(aaAmountWei, 6) : undefined,
							eoaAmountStr: useAaPlusEoa ? ethers.formatUnits(eoaAmountWei, 6) : undefined,
							billCurrency: currencyParam,
							amountStrFiat,
							totalRequestedStrFiat: amountStrFiat,
							usdcFromBalanceWeiStr: effectiveWei.toString(),
							ccsaPointsWeiStr: undefined,
							forText: u.searchParams.get('forText') ?? undefined,
									billRequestHash: (() => {
										const rh = u.searchParams.get('requestHash') ?? u.searchParams.get('requesthash')
										return rh && ethers.isHexString(rh) && ethers.dataLength(rh) === 32 ? rh : undefined
									})(),
									payeeImage,
							payeeFirstName,
							payeeLastName,
							payeeAccountName,
						})
						return
					}

					// 受益方为 AA 但支付方无 AA：使用 EOA USDC，按 oracle 换算后支付
					if (!payerAA || !ethers.isAddress(payerAA)) {
						const payerEOA = myAddress ?? profiles?.[0]?.keyID ?? ''
						if (!payerEOA || !ethers.isAddress(payerEOA)) {
							failStep('detectingUser', 'Payer EOA not found')
							return
						}
						let enteredWei: bigint
						try {
							const rates = ensureOracle()
							enteredWei = fiatToUsdc6(rates, amountParam, currencyParam)
						} catch (e) {
							console.warn('Bill currency to USDC (shared oracle) failed', e)
							failStep('detectingUser', 'Currency conversion failed')
							return
						}
						if (enteredWei <= 0n) {
							failStep('detectingUser', 'Invalid amount')
							return
						}
						setStepSuccess('detectingUser', 'EOA-only payer, using Main Vault (USDC)')
						await doneDelay()

						setStepLoading('membership')
						await loadingDelay()
						setStepSuccess('membership', 'N/A (EOA-only, no membership)')
						await doneDelay()

						setStepLoading('analyzingAssets')
						await loadingDelay()
						let payerEoaBalanceWei = 0n
						try {
							payerEoaBalanceWei = BigInt((await retryRpcCall(() =>
								new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
									.balanceOf(payerEOA)
							)).toString())
						} catch (e) {
							failStep('analyzingAssets', RPC_ERROR_MSG)
							return
						}
						if (payerEoaBalanceWei < enteredWei) {
							const reqStr = ethers.formatUnits(enteredWei, 6)
							const balStr = ethers.formatUnits(payerEoaBalanceWei, 6)
							failStep('analyzingAssets', `Insufficient balance. Requested: ${reqStr} USDC, Available: ${balStr} USDC`)
							return
						}
						setStepSuccess('analyzingAssets', `EOA: ${ethers.formatUnits(payerEoaBalanceWei, 6)} USDC`)
						await doneDelay()

						setStepLoading('optimizingRoute')
						await loadingDelay()
						setStepSuccess('optimizingRoute', 'EOA→AA (USDC)')
						await doneDelay()

						const amountStr = ethers.formatUnits(enteredWei, 6)
						const amountStrFiat = (() => {
							try {
								return usdcToFiatStr(ensureOracle(), amountStr, (currencyParam || 'USD').toUpperCase())
							} catch {
								return amountStr
							}
						})()

						let payeeImage: string | undefined
						let payeeFirstName: string | undefined
						let payeeLastName: string | undefined
						let payeeAccountName: string | undefined
						try {
							const account = await searchUsername(billPayeeAddr)
							const peer = account?.results?.[0]
							if (peer) {
								payeeAccountName = (peer as { username?: string }).username
								payeeImage = (peer as { image?: string }).image
								payeeFirstName = (peer as { first_name?: string }).first_name
								payeeLastName = getDisplayLastName((peer as { last_name?: string }).last_name)
							}
						} catch (e) {
							console.warn('Bill payee AA Beamio lookup failed', e)
						}

						setConfirmDeduction({
							payload: {
								account: payerEOA,
								to: billPayeeAddr,
								items: [{ kind: 0, asset: USDCContract_BASE, amount: enteredWei.toString(), tokenId: '0', data: '0x' }],
								currencyType: 4,
								maxAmount: '0',
								nonce: '0',
								deadline: String(Math.floor(Date.now() / 1000) + 300),
								signature: '0x',
							} as OpenContainerRelayPayload,
							amountStr,
							usdcFromBalance: amountStr,
							usdcFromCCSA: '0',
							customerUsdcBalance: ethers.formatUnits(payerEoaBalanceWei, 6),
							totalRequestedStr: amountStr,
							hasDiscount: false,
							isBillPay: true,
							billPayeeAA: billPayeeAddr,
							billPayeeIsEOA: false,
							billPayerEoaOnly: true,
							amountStrFiat,
							totalRequestedStrFiat: amountStrFiat,
							usdcFromBalanceWeiStr: enteredWei.toString(),
							forText: u.searchParams.get('forText') ?? undefined,
							billRequestHash: (() => {
								const rh = u.searchParams.get('requestHash') ?? u.searchParams.get('requesthash')
								return rh && ethers.isHexString(rh) && ethers.dataLength(rh) === 32 ? rh : undefined
							})(),
							payeeImage,
							payeeFirstName,
							payeeLastName,
							payeeAccountName,
						})
						return
					}

					const billPayeeAA = billPayeeAddr
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
					let amountStrFiat: string | undefined
					let usdcFromBalanceFiat: string | undefined
					let usdcFromCCSAFiat: string | undefined
					let totalRequestedStrFiat: string | undefined
					try {
						const rates = ensureOracle()
						amountStrCAD = usdcToCadStr(rates, amountStr)
						usdcFromBalanceCAD = usdcToCadStr(rates, usdcFromBalanceStr)
						usdcFromCCSACAD = usdcToCadStr(rates, usdcFromCCSAStr)
						customerUsdcBalanceCAD = usdcToCadStr(rates, customerUsdcBalanceStr)
						totalRequestedStrCAD = usdcToCadStr(rates, totalRequestedStrVal)
						// Bill 请求币种展示
						const bc = (currencyParam || 'USD').toUpperCase()
						amountStrFiat = usdcToFiatStr(rates, amountStr, bc)
						usdcFromBalanceFiat = usdcToFiatStr(rates, usdcFromBalanceStr, bc)
						usdcFromCCSAFiat = usdcToFiatStr(rates, usdcFromCCSAStr, bc)
						totalRequestedStrFiat = usdcToFiatStr(rates, totalRequestedStrVal, bc)
					} catch (e) {
						console.warn('USDC to CAD (shared oracle) failed', e)
					}

					// Bill 请求方商家 Beamio 信息：通过 AA.owner() 得 EOA，再 searchUsername 获取
					let payeeDisplayName: string | undefined
					let payeeImage: string | undefined
					let payeeFirstName: string | undefined
					let payeeLastName: string | undefined
					let payeeAccountName: string | undefined
					try {
						const aaContract = new ethers.Contract(
							billPayeeAA,
							['function owner() view returns (address)'],
							baseEndpoint
						)
						const merchantEOA = (await aaContract.owner()) as string
						if (merchantEOA && merchantEOA !== ethers.ZeroAddress) {
							const account = await searchUsername(merchantEOA)
							const peer = account?.results?.[0]
							if (peer) {
								payeeAccountName = (peer as { username?: string }).username
								payeeDisplayName = payeeAccountName
								payeeImage = (peer as { image?: string }).image
								payeeFirstName = (peer as { first_name?: string }).first_name
								payeeLastName = getDisplayLastName((peer as { last_name?: string }).last_name)
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
						payeeImage,
						payeeFirstName,
						payeeLastName,
						payeeAccountName,
						payeeMemberLabel: undefined,
						billCurrency: currencyParam,
						amountStrFiat,
						usdcFromBalanceFiat,
						usdcFromCCSAFiat,
						totalRequestedStrFiat,
						forText: u.searchParams.get('forText') ?? undefined,
						billRequestHash: (() => {
							const rh = u.searchParams.get('requestHash') ?? u.searchParams.get('requesthash')
							return rh && ethers.isHexString(rh) && ethers.dataLength(rh) === 32 ? rh : undefined
						})(),
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
					enteredWei = fiatToUsdc6(rates, amountSource, 'CAD')
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
								const firstName = (peer as { first_name?: string }).first_name ?? ''
								const displayLast = getDisplayLastName((peer as { last_name?: string }).last_name)
								const fullName = `${firstName || ''} ${displayLast || ''}`.trim()
								if (fullName) payerBeamioTag = fullName
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
				payerBeamioTag,
				usdcFromBalanceWeiStr: usdcFromBalanceWei > 0n ? usdcFromBalanceWei.toString() : undefined,
				ccsaPointsWeiStr: ccsaPointsWei > 0n ? ccsaPointsWei.toString() : undefined,
			})
			// 不在此处 submit；等用户确认后再提交
			return
		})()
	}, [scanIntent, scanData, voucherPayAmount, voucherPayToAA, profiles, routingRetryTrigger, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayError])

	// 进入 voucherPay / payBill 时重置步骤为 pending（等待 scanData），并清空确认
	useEffect(() => {
		if (scanIntent === 'voucherPay' || scanIntent === 'payBill') {
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

		// Bill 支付方无 AA（EOA-only）或 受益方为 EOA 且使用 EOA→EOA：走 BeamioTransfer 402 流程（需 ConformView 二次确认）
		// useAaPlusEoa 时在下方直接执行两次转账，不走此分支
		if (data.isBillPay && data.billPayeeAA && (data.billPayerEoaOnly || (data.billPayeeIsEOA && !data.useAaToEoa && !data.useAaPlusEoa)) && profiles?.[0] && myAddress) {
			const noteMeta: Record<string, string> = { currency: data.billCurrency || 'USD', currencyAmount: data.amountStrFiat ?? data.amountStr }
			if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) {
				noteMeta.requestHash = data.billRequestHash
			}
			const sendNote = (data.forText || '') + `\r\n${JSON.stringify(noteMeta)}`
			const params = new URLSearchParams({
				amount: data.amountStr,
				toAddress: data.billPayeeAA,
				note: sendNote.trim(),
			})
			if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) {
				params.set('requestHash', data.billRequestHash)
			}
			const paramsStr = params.toString()
			const requestEndpoint = `${aptEndpoint}/api/BeamioTransfer?${paramsStr}`
			try {
				const response = await fetch(requestEndpoint, { method: 'GET' })
				if (response.status !== 402) {
					setSubmitting(false)
					setVoucherPayError('RPC Error!')
					return
				}
				const { accepts } = await response.json()
				const MessageData = accepts[0]
				const msgData: IMessageData = {
					receive: {
						accountName: shortAddr(data.billPayeeAA),
						firstName: '',
						lastName: JSON.stringify({}),
						address: data.billPayeeAA,
						image: '',
					},
					sender: {
						accountName: beamio?.accountName ?? '',
						firstName: beamio?.firstName ?? '',
						lastName: beamio?.language ?? '',
						address: myAddress,
						image: beamio?.image ?? '',
					},
					node: sendNote,
					sginTatle: 'send',
					reqUrl: requestEndpoint,
					amount: data.amountStr,
					currencyAmount: data.amountStrFiat ?? data.amountStr,
				}
				MessageData.data = msgData
				MessageData.data.reqUrl = requestEndpoint
				MessageData.reqUrl = requestEndpoint
				setEoaTransferMessage(MessageData)
				setConfirmDeduction(null)
			} catch (e) {
				setSubmitting(false)
				setVoucherPayError((e as Error)?.message ?? 'Request failed')
				return
			}
			setSubmitting(false)
			return
		}

		// AA+EOA 组合：AA→EOA 与 EOA→EOA 并行执行，用户已在确认页确认总金额
		if (data.isBillPay && data.billPayeeIsEOA && data.useAaPlusEoa && data.aaAmountStr && data.eoaAmountStr && data.billPayeeAA && profiles?.[0] && myAddress) {
			setConfirmDeduction(null)
			setStepById('sendTx', 'loading', 'AA→EOA…')
			setStepById('waitTx', 'loading', 'EOA→EOA…')
			try {
				const profile = profiles[0]
				const chainAA = await getAAAccount(profile)
				if (!chainAA) {
					setSubmitting(false)
					setVoucherPayError('Express Pay not found')
					return
				}

				// 按 USDC 比例拆分总金额：AA 与 EOA 各自发送对应 portion 的 currencyAmount
				const totalUsdc = Number(data.amountStr) || 1
				const aaUsdc = Number(data.aaAmountStr) || 0
				const eoaUsdc = Number(data.eoaAmountStr) || 0
				const totalFiat = Number(data.amountStrFiat ?? data.amountStr) || totalUsdc
				const aaCurrencyAmount = totalUsdc > 0 ? String((aaUsdc / totalUsdc) * totalFiat) : data.aaAmountStr
				const eoaCurrencyAmount = totalUsdc > 0 ? String((eoaUsdc / totalUsdc) * totalFiat) : data.eoaAmountStr

				const runAA = async (): Promise<string | null> => {
					const aaAmountWei = ethers.parseUnits(data.aaAmountStr!, 6)
					const aaItems = [{ kind: 0, asset: USDCContract_BASE, amount: aaAmountWei.toString(), tokenId: '0', data: '0x' }]
					const profileWithAA = { ...profile, aaAccount: chainAA }
					const signed = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(profileWithAA, data.aaAmountStr!, { to: data.billPayeeAA })
					const payload = { ...signed, to: ethers.getAddress(data.billPayeeAA!), items: aaItems }
					const body: Record<string, unknown> = {
						openContainerPayload: payload,
						currency: data.billCurrency ?? 'CAD',
						currencyAmount: aaCurrencyAmount,
					}
					if (data.forText?.trim()) body.forText = data.forText.trim()
					if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) body.requestHash = data.billRequestHash
					const res = await fetch(`${beamioApiBase.replace(/\/$/, '')}/api/AAtoEOA`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					})
					const apiResult = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; USDC_tx?: string }
					if (!res.ok || apiResult.success === false) throw new Error(apiResult.error ?? `HTTP ${res.status}`)
					return apiResult.USDC_tx ?? null
				}

				const runEOA = async (): Promise<string | null> => {
					const noteMeta: Record<string, string> = { currency: data.billCurrency || 'USD', currencyAmount: eoaCurrencyAmount }
					if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) {
						noteMeta.requestHash = data.billRequestHash
					}
					const sendNote = (data.forText || '') + `\r\n${JSON.stringify(noteMeta)}`
					const params = new URLSearchParams({
						amount: data.eoaAmountStr!,
						toAddress: data.billPayeeAA!,
						note: sendNote.trim(),
					})
					if (data.billRequestHash && ethers.isHexString(data.billRequestHash) && ethers.dataLength(data.billRequestHash) === 32) {
						params.set('requestHash', data.billRequestHash)
					}
					const requestEndpoint = `${aptEndpoint}/api/BeamioTransfer?${params.toString()}`
					const response = await fetch(requestEndpoint, { method: 'GET' })
					if (response.status !== 402) throw new Error('RPC Error on EOA step')
					const { accepts } = await response.json()
					const msgData = accepts[0]
					const pay = BigInt(Number(msgData?.maxAmountRequired ?? 0).toFixed(0))
					const paymentHeader = await AuthorizationSign(pay, msgData?.payTo ?? data.billPayeeAA)
					const res2 = await fetch(requestEndpoint, {
						method: 'GET',
						headers: { 'X-PAYMENT': paymentHeader, 'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE' },
					})
					const body2 = await res2.json().catch(() => ({}))
					if (!res2.ok || !body2.USDC_tx) throw new Error((body2 as { error?: string }).error ?? 'EOA transfer failed')
					return body2.USDC_tx
				}

				const [aaHash, eoaHash] = await Promise.all([runAA(), runEOA()])
				const hashes = [aaHash, eoaHash].filter((h): h is string => !!h)
				setStepById('sendTx', 'success', 'AA sent')
				setStepById('waitTx', 'success', 'Transaction complete')
				setSuccessTxHash(hashes[0] ?? hashes[1] ?? '')
				setPaymentSuccessData({
					txHash: hashes[0] ?? hashes[1] ?? '',
					txHashes: hashes,
					amountCAD: data.amountStrFiat ?? data.amountStr,
					amountUSDC: data.amountStr,
					currency: data.billCurrency ?? 'CAD',
					recipientName: data.payeeAccountName,
				})
			} catch (e) {
				setSubmitting(false)
				setVoucherPayError((e as Error)?.message ?? 'Request failed')
				return
			}
			setSubmitting(false)
			return
		}

		setConfirmDeduction(null)
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
			// Bill 支付：由付款人签名 Open Container，to 指向 bill 的 AA 或 EOA
			try {
				const profile = profiles[0]
				const chainAA = await getAAAccount(profile)
				if (!chainAA && data.useAaToEoa) {
					setSubmitting(false)
					setVoucherPayError('Express Pay not found')
					return
				}
				const profileWithAA = chainAA ? { ...profile, aaAccount: chainAA } : profile
				const signed = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(profileWithAA, data.amountStr, { to: data.billPayeeAA })
				payload = { ...signed, to: ethers.getAddress(data.billPayeeAA), items }
			} catch (e) {
				setSubmitting(false)
				setVoucherPayError((e as Error)?.message ?? 'Sign failed')
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
					currency: data.billCurrency ?? 'CAD',
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

	const handleSignEoaTransfer = async () => {
		if (!eoaTransferMessage || submitting || !profiles?.[0]) return
		setSubmitting(true)
		try {
			const pay = BigInt(Number(eoaTransferMessage.maxAmountRequired).toFixed(0))
			const paymentHeader = await AuthorizationSign(pay, eoaTransferMessage.payTo)
			const res = await fetch(eoaTransferMessage.reqUrl ?? eoaTransferMessage.data?.reqUrl, {
				method: 'GET',
				headers: { 'X-PAYMENT': paymentHeader, 'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE' },
			})
			const body = await res.json().catch(() => ({}))
			setSubmitting(false)
			setEoaTransferMessage(null)
			if (res.ok && body.USDC_tx) {
				setSuccessTxHash(body.USDC_tx)
				setStepById('sendTx', 'success', 'Sent')
				setStepById('waitTx', 'success', 'Transaction complete')
				const amt = eoaTransferMessage.data?.amount ?? eoaTransferMessage.amount ?? '0'
				setPaymentSuccessData({
					txHash: body.USDC_tx,
					amountCAD: amt,
					amountUSDC: amt,
					currency: 'USDC',
					exchangeRateCADtoUSDC: undefined,
					paidWithCCSACAD: undefined,
					recipientName: undefined,
				})
			} else {
				setVoucherPayError(body.error ?? 'Transfer failed')
			}
		} catch (e) {
			setSubmitting(false)
			setVoucherPayError((e as Error)?.message ?? 'Sign failed')
		}
	}

	const handleCancelDeduction = () => {
		setVoucherPayError('')
		setConfirmDeduction(null)
		setEoaTransferMessage(null)
		setSuccessTxHash(null)
		setPaymentSuccessData(null)
		setScanData('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
		setVoucherPayFromScan?.(false)
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
		routingDoneRef.current = false
		// 保持 scanIntent 为 payBill/voucherPay，回到 Smart Routing 等待新扫描；重新打开扫码
		scanRef.current?.start()
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
		setConfirmDeduction(null)
		setEoaTransferMessage(null)
		setScanData('')
		setScanIntent('')
		setVoucherPayAmount('')
		setVoucherPayToAA('')
		setVoucherPayFromScan?.(false)
		setRoutingSteps(ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })))
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

	// 商家 bill 必选项：Amount、currency、acceptTokens、to（收款方 AA）；to 为当前商家 AA，支付方扫码后款项转入此地址
	const merchantAA = profiles?.[0]?.aaAccount
	const paymentUrl = value && merchantAA && ethers.isAddress(merchantAA)
		? `http://beamio.app/Vouchers?Amount=${encodeURIComponent(value)}&currency=CAD&acceptTokens=USDC,CCSA&to=${encodeURIComponent(merchantAA)}`
		: ''

	// voucherPay / payBill workflow：Confirm → Submitting 成功 → 显示 PaymentSuccessView；仅当用户点击「Done & Go to Chat」才 onPaymentSuccess 回到父页面（不在此前关闭）
	if (scanIntent === 'voucherPay' || scanIntent === 'payBill') {
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
		if (eoaTransferMessage) {
			const data = eoaTransferMessage.data
			return (
				<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6 pt-8 pb-6">
					<div className="text-center mb-4">
						<div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
							{data?.amount ?? eoaTransferMessage.amount} USDC
						</div>
						<div className="text-sm text-slate-500 mt-1">
							To {shortAddr(data?.receive?.address ?? '')}
						</div>
					</div>
					<ConformView messageData={eoaTransferMessage} />
					<div className="mt-6">
						<AppButton
							fullWidth
							onClick={handleSignEoaTransfer}
							loading={submitting}
						>
							Confirm & Send
						</AppButton>
					</div>
					<button
						type="button"
						onClick={() => setEoaTransferMessage(null)}
						className="mt-3 w-full py-2.5 text-sm text-slate-500 hover:text-slate-700"
					>
						Cancel
					</button>
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

export default TenKeyInputComponentNew;