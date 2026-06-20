/** Fee inline: one-line + details (default collapsed) */
import React, {useRef, useState, useEffect, useMemo} from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import IOSBlurPillButton from '@/components/button/IOSButton'
import LockModeSwitch from '@/components/switch/LockModeSegmented'
import {
  ArrowLeft,
  Camera,
  Check,
  Search,
  ChevronRight,
  X,
  Copy,
  Info,
  ExternalLink,
} from "lucide-react"

import FeeInfo from '@/pages/Pay/PaymentLink/FeeInfo'
import {fiatPrefix, formatTimeDetail} from '@/services/currency'
import { tu } from '@/locale/beamioLocale'


// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped)
}



function FeeInline({
  	payUsdc,
	currentCurrency='USDC',
	
	txDetail
}: {
  	payUsdc: number
	currentCurrency: ICurrency
	
	txDetail?: IRequestCurrencyDetail
}) {
	const [open, setOpen] = useState(false)
	const { usdcbalance, beamio, setCurrencyData, currencyData, setBeamio} = useDaemonContext()
	const [openInof, setOpenInfo] = useState(false)

	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	function formatAmount(v: number, c: ICurrency) {
		if (!isFinite(v)) return `0 ${c}`
		return `${c ==='TWD'||c==='JPY' ? v.toFixed(0) : c ==='USDC' ? v.toFixed(4) : v.toFixed(2)}`
	}

	function usdcToCurrencyAmount(usdc: number, c: ICurrency) {
		const rate = fxRateUSDCToCurrency(c)
		return usdc * rate
	}


	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}

	const feeUsdc = useMemo(
		() => calcFeeFromNumber(payUsdc).toFixed(4),
		[payUsdc]
	)

	const receiveUsdc = useMemo(
		() => payUsdc - Number(feeUsdc),
		[payUsdc, feeUsdc]
	)

	const display = useMemo(() => {
		if (currentCurrency === 'USDC') {
			return {
				pay: formatAmount( txDetail?.totalPayUSDC||payUsdc, 'USDC'),
				fee: formatAmount(Number( txDetail?.feeUSDC|| feeUsdc), 'USDC'),
				receive: formatAmount(txDetail?.receivedUSDC|| receiveUsdc, 'USDC'),
			}
		}

		const c = currentCurrency
		return {
			pay: formatAmount(txDetail?.totalPayCurrency||usdcToCurrencyAmount(payUsdc, c), c),
			fee: formatAmount(txDetail?.feeCurrency|| usdcToCurrencyAmount(Number(feeUsdc), c), c),
			receive: formatAmount( txDetail?.receivedCurrency|| usdcToCurrencyAmount(receiveUsdc, c), c),
		}
	}, [payUsdc, feeUsdc, receiveUsdc, currentCurrency])

	
	return (
		<div className="h-px bg-slate-100" >
			
				<div className="flex items-center justify-between px-4 py-2.5 bg-white" >
					

					{
						!open && (
							<>
								<span className="text-[14px] text-slate-500">Beamio fee</span>
							</>
							// <div className="mt-2 flex items-center justify-between text-sm">
							// 	<span className="text-slate-500 mr-2">
							// 		{" "}
							// 	</span>
							// 	<span className="font-semibold tabular-nums text-slate-900">
							// 		{currentCurrency === 'USDC' ? `${display.fee} USDC` : fiatPrefix(currentCurrency) + display.fee}
							// 	</span>
							// </div>
						)
					}
						
					

					{open && (
						<div className="mt-3 space-y-2 text-sm">

						<div className="flex items-start justify-between">
							{/* 左侧 */}
							<span className="text-slate-500 leading-snug">
								Payer pays
							</span>

							{/* 右侧：两行，右对齐 */}
							<div className="flex flex-col items-end leading-snug">
								<span className="font-mono font-medium text-[13px] text-black/60">
									{ currentCurrency === 'USDC' ? `${display.pay} USDC` : fiatPrefix(currentCurrency) + display.pay}
								</span>

								{currentCurrency !== 'USDC'  && (
									<span className="text-xs text-slate-500 tabular-nums">
										≈ {payUsdc.toFixed(4)} USDC
									</span>
								)}
							</div>
						</div>

						<div className="flex items-start justify-between">
							{/* 左侧 */}
							<span className="text-slate-500 leading-snug">
								Beamio fee
							</span>

							{/* 右侧：两行，右对齐 */}
							<div className="flex flex-col items-end leading-snug">
								<span className="font-mono font-medium text-[13px] text-black/60">
									{ currentCurrency === 'USDC' ? `${display.fee} USDC` : fiatPrefix(currentCurrency) + display.fee}
								</span>

								{currentCurrency !== 'USDC' && (
								<span className="text-xs text-slate-500 tabular-nums">
									≈ {feeUsdc} USDC
								</span>
								)}
							</div>
						</div>
						
						<div className="flex items-start justify-between">
							{/* 左侧 */}
							<span className="text-slate-500 leading-snug">{tu('receive')}</span>

							{/* 右侧：两行，右对齐 */}
							<div className="flex flex-col items-end leading-snug">
								<span className="font-semibold tabular-nums text-slate-900">
									{ currentCurrency === 'USDC' ? `${display.receive} USDC` : fiatPrefix(currentCurrency) + display.receive}
								</span>

								{currentCurrency !== 'USDC' && (
									<span className="text-xs text-slate-500 tabular-nums">
										≈ {receiveUsdc.toFixed(4)} USDC
									</span>
								)}
							</div>
						</div>
						</div>
					)}
				</div>
							{/* ✅ 只对弹出窗口本身做模糊 + 透明 */}
				{openInof && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center px-4"
						onClick={() => setOpenInfo(false)}
					>
						<div
						className="
							relative rounded-2xl shadow-2xl p-4
							max-w-sm w-[90vw]
							bg-white/12 backdrop-blur-xl border border-white/20
							transition-all duration-300 ease-out
							scale-100 translate-y-0
						"
						style={{
							WebkitBackdropFilter: "blur(18px) saturate(160%)",
							backdropFilter: "blur(18px) saturate(160%)"
						}}
						onClick={(e) => e.stopPropagation()}
						>
						<FeeInfo 
							close={() => setOpenInfo(false)}
							isUSDCFixed={currentCurrency === 'USDC'}
						/>
						</div>
					</div>
				)}
		</div>
	);
	}

export default FeeInline