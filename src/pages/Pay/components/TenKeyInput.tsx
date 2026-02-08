import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, QrCode, Loader, Check, X } from 'lucide-react'
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from 'ethers'
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { beamioApiBase, readContainerNonceFromAAStorage } from '@/services/AAaccount'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import { baseEndpoint, CCSA_Card_Address, USDCContract_BASE } from '@/utils/constants'


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

const ROUTING_STEPS: Omit<RoutingStep, 'status'>[] = [
	{ id: 'parse', label: 'Validating QR format', detail: 'Checking payload structure' },
	{ id: 'nonce', label: 'Checking nonce', detail: 'AA storage openRelayed nonce' },
	{ id: 'deadline', label: 'Checking validity period', detail: 'QR code expiry' },
	{ id: 'maxAmount', label: 'Checking max amount', detail: 'QR max vs entered amount' },
	{ id: 'balance', label: 'Checking account balance', detail: 'Sufficient funds' },
	{ id: 'ccsaCard', label: 'CCSA card', detail: 'Payment account CCSA NFT card number' },
	{ id: 'submit', label: 'Submitting payment', detail: 'Sending to server' },
	{ id: 'sendTx', label: 'Sending transaction', detail: 'Sending transaction' },
	{ id: 'waitTx', label: 'Waiting for transaction to complete', detail: 'Waiting for server 200' },
]

const STEP_ORDER = ROUTING_STEPS.map((s) => s.id)

const BASE_EXPLORER_TX = 'https://basescan.org/tx/'

function SmartRoutingAnalysis({ steps, onAbandon, successTxHash }: { steps: RoutingStep[]; onAbandon?: () => void; successTxHash?: string }) {
	const hasError = steps.some((s) => s.status === 'error')

	// 独立的已完成列表：新完成的步骤在已完成列表顶部追加一条，已有记录永不重排
	const [completedIdsOrder, setCompletedIdsOrder] = useState<string[]>([])
	useEffect(() => {
		const allPending = steps.every((s) => s.status === 'pending')
		if (allPending) {
			setCompletedIdsOrder([])
			return
		}
		setCompletedIdsOrder((prev) => {
			const next = [...prev]
			for (const id of STEP_ORDER) {
				const step = steps.find((s) => s.id === id)
				if (step && step.status !== 'pending' && !next.includes(id)) next.unshift(id)
			}
			return next
		})
	}, [steps])

	const displayOrder = useMemo(() => {
		const visible = steps.filter((s) => s.status !== 'pending')
		if (visible.length === 0) return []
		const loadingOrError = visible.find((s) => s.status === 'loading' || s.status === 'error')
		const current = loadingOrError ?? visible[visible.length - 1]
		// 已完成部分严格按 completedIdsOrder 顺序，且不包含当前项
		const completedSteps = completedIdsOrder
			.filter((id) => id !== current.id)
			.map((id) => steps.find((s) => s.id === id))
			.filter((s): s is RoutingStep => s != null)
		return [current, ...completedSteps]
	}, [steps, completedIdsOrder])

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
								{step.id === 'waitTx' && step.status === 'success' && successTxHash && (
									<p className="text-sm mt-2">
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
							</div>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
			{(hasError || steps.some((s) => (s.id === 'sendTx' || s.id === 'waitTx') && (s.status === 'success' || s.status === 'error'))) && onAbandon && (
				<div className="shrink-0 px-6 pb-6 pt-4">
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

/** 提交前确认：展示扣款组合（USDC 余额 + CCSA 折算），受益方确认或取消 */
export type ConfirmDeductionPayload = {
	payload: OpenContainerRelayPayload
	amountStr: string
	/** 从客户 USDC 余额扣款（已格式化的金额，如 "1.00"） */
	usdcFromBalance: string
	/** 从 CCSA 折算成 USDC 的金额（已格式化） */
	usdcFromCCSA: string
	/** 客户 QR 展示的 USDC 余额（已格式化，仅说明用） */
	customerUsdcBalance: string
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
	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 px-6">
			<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center pt-8 pb-4">
				Confirm deduction
			</h2>
			<p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
				You (beneficiary) will receive the amount below by deducting from the customer (QR holder). Please confirm the deduction breakdown.
			</p>
			<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 space-y-3 mb-6">
				<div className="flex justify-between text-sm">
					<span className="text-slate-500 dark:text-slate-400">Total to receive (USDC)</span>
					<span className="font-semibold text-slate-900 dark:text-slate-100">${data.amountStr}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-slate-500 dark:text-slate-400">From customer USDC balance</span>
					<span className="font-medium text-slate-800 dark:text-slate-200">${data.usdcFromBalance}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-slate-500 dark:text-slate-400">From CCSA (converted to USDC)</span>
					<span className="font-medium text-slate-800 dark:text-slate-200">${data.usdcFromCCSA}</span>
				</div>
				<div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
					Customer QR USDC balance: ${data.customerUsdcBalance}
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3 mt-auto pb-6">
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="h-12 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={submitting}
					className="h-12 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
				>
					{submitting ? <Loader className="w-5 h-5 animate-spin" /> : null}
					Confirm
				</button>
			</div>
		</div>
	)
}

const TenKeyInputComponent = () => {
	const [value, setValue] = useState('')
	const [showQRSheet, setShowQRSheet] = useState(false)
	const [routingSteps, setRoutingSteps] = useState<RoutingStep[]>(() =>
		ROUTING_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }))
	)
	const [confirmDeduction, setConfirmDeduction] = useState<ConfirmDeductionPayload | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
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

		/** 某步失败：显示红色 X，由用户点击底部 OK 后关闭 */
		const failStep = (stepId: string, detail: string) => {
			setStepError(stepId, detail)
		}

		/** 每项开始时延迟 1 秒，以显示 loading */
		const loadingDelay = () => new Promise<void>((r) => setTimeout(r,2000))
		/** 每项完成后的延迟 2 秒 */
		const doneDelay = () => new Promise<void>((r) => setTimeout(r, 2000))

		;(async () => {
			let payload: OpenContainerRelayPayload

			// Step 1: Parse QR
			setStepLoading('parse')
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
					failStep('parse', 'Invalid Open Relay payload')
					return
				}
				payload = parsed as OpenContainerRelayPayload
			} catch {
				failStep('parse', 'Invalid Open Relay payload')
				return
			}
			setStepSuccess('parse', 'Valid payload')
			await doneDelay()

			// Step 2: Nonce — 用 readContainerNonceFromAAStorage 检查 payload.nonce 与 AA 当前 openRelayed nonce 一致
			setStepLoading('nonce')
			await loadingDelay()
			try {
				const storedNonce = await readContainerNonceFromAAStorage(baseEndpoint, payload.account, 'openRelayed')
				const payloadNonce = BigInt(payload.nonce)
				if (storedNonce !== payloadNonce) {
					failStep('nonce', `Nonce mismatch: expected ${storedNonce}, got ${payloadNonce}`)
					return
				}
				setStepSuccess('nonce', `Nonce ${payload.nonce} OK`)
			} catch (e) {
				console.warn('Nonce check failed', e)
				failStep('nonce', (e as Error)?.message ?? 'Could not read nonce')
				return
			}
			await doneDelay()

			// Step 3: Deadline
			setStepLoading('deadline')
			await loadingDelay()
			const nowSec = Math.floor(Date.now() / 1000)
			const deadlineSec = parseInt(payload.deadline, 10)
			if (Number.isNaN(deadlineSec) || nowSec >= deadlineSec) {
				failStep('deadline', 'QR code has expired')
				return
			}
			setStepSuccess('deadline', 'Within validity period')
			await doneDelay()

			// Step 4: Max amount
			setStepLoading('maxAmount')
			await loadingDelay()
			let enteredWei: bigint
			try {
				enteredWei = ethers.parseUnits(voucherPayAmount || '0', 6)
				const maxWei = BigInt(payload.maxAmount ?? '0')
				if (maxWei < enteredWei) {
					failStep('maxAmount', `Max ${ethers.formatUnits(maxWei, 6)} USDC`)
					return
				}
			} catch {
				enteredWei = 0n
			}
			setStepSuccess('maxAmount', 'Amount within limit')
			await doneDelay()

			// Step 5: Balance（并计算扣款组合：USDC 余额 + CCSA 折算）
			let balanceWei = 0n
			if (enteredWei > 0n) {
				setStepLoading('balance')
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
					if (balanceWei < enteredWei) {
						failStep('balance', 'Insufficient balance')
						return
					}
					setStepSuccess('balance', 'Sufficient')
				} catch (e) {
					console.warn('Balance check failed', e)
					failStep('balance', 'Could not verify balance')
					return
				}
			} else {
				setStepSuccess('balance', 'Skipped (zero amount)')
			}
			await doneDelay()

			// Step 6: 支付账号所持 CCSA 卡 NFT 卡号
			setStepLoading('ccsaCard')
			await loadingDelay()
			try {
				const cardContract = new ethers.Contract(
					CCSA_Card_Address,
					['function getOwnership(address user) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)'],
					baseEndpoint
				)
				const [, nfts] = await cardContract.getOwnership(payload.account)
				const cardNumbers = (nfts || []).map((n: { tokenId: bigint }) => n.tokenId.toString()).filter(Boolean)
				const detail = cardNumbers.length > 0 ? `Card #${cardNumbers.join(', #')}` : 'No CCSA card'
				setStepSuccess('ccsaCard', detail)
			} catch (e) {
				console.warn('CCSA card check failed', e)
				setStepError('ccsaCard', 'Could not read CCSA card')
				return
			}
			await doneDelay()

			// 扣款组合：从客户 USDC 余额扣多少，其余由 CCSA 折算成 USDC
			const usdcFromBalanceWei = enteredWei <= balanceWei ? enteredWei : balanceWei
			const usdcFromCCSAWei = enteredWei - usdcFromBalanceWei
			const amountStr = voucherPayAmount || ethers.formatUnits(enteredWei, 6)
			setConfirmDeduction({
				payload,
				amountStr,
				usdcFromBalance: ethers.formatUnits(usdcFromBalanceWei, 6),
				usdcFromCCSA: ethers.formatUnits(usdcFromCCSAWei, 6),
				customerUsdcBalance: ethers.formatUnits(balanceWei, 6),
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
		setSubmitting(true)
		setConfirmDeduction(null)
		// 使用用户输入的金额（amountStr，USDC 6 位小数）覆盖 payload.items 中的 amount；open relay 签名不包含 itemsHash/to，受益人可任意填写
		const amountWeiStr = ethers.parseUnits(confirmDeduction.amountStr, 6).toString()
		const payload: OpenContainerRelayPayload = {
			...confirmDeduction.payload,
			items: confirmDeduction.payload.items.map((it: { kind: number; asset: string; amount: string; tokenId: string; data: string }) =>
				it.kind === 0 ? { ...it, amount: amountWeiStr } : it
			),
		}

		// 仅使用 /api/AAtoEOA（openContainerPayload），不再调用 voucher/relay
		setStepById('sendTx', 'loading', 'Submitting…')
		setStepById('waitTx', 'loading', 'Waiting for server…')
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
			// 以 body.success 为准：服务端失败时应返回 500，若误返回 200 也按失败处理
			if (res.ok && apiResult.success !== false) {
				if (apiResult.USDC_tx) setSuccessTxHash(apiResult.USDC_tx)
				setStepById('waitTx', 'success', 'Transaction complete')
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

	/** 放弃 Smart Routing Analysis（有错误时点 OK 关闭并回到数字键盘） */
	const handleAbandonRouting = () => {
		setSuccessTxHash(null)
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

	// QR 扫描开始后（scanIntent === 'voucherPay'）即刻显示 Smart Routing Analysis，错误时该项左侧红 X，底部显示 OK，点击后关闭并回到数字键盘
	if (scanIntent === 'voucherPay') {
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