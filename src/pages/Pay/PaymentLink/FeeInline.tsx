/** Fee inline: one-line + details (default collapsed) */
import React, {useRef, useState, useEffect, useMemo} from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(2));
}

const CURRENCY_META: Record<
  ICurrency,
  { flag: string; symbol: string; label: string }
> = {
  USD: { flag: "🇺🇸", symbol: "$", label: "USD" },
  CAD: { flag: "🇨🇦", symbol: "$", label: "CAD" },
  EUR: { flag: "🇪🇺", symbol: "€", label: "EUR" },
  JPY: { flag: "🇯🇵", symbol: "¥", label: "JPY" },
  CNY: { flag: "🇨🇳", symbol: "¥", label: "CNY" },
  HKD: { flag: "🇭🇰", symbol: "$", label: "HKD" },
  TWD: { flag: "🇹🇼", symbol: "$", label: "TWD" },
  SGD: { flag: "🇸🇬", symbol: "$", label: "SGD" },
  USDC: {flag:"", symbol: "", label: ""}
};

function fiatPrefix(ccy: ICurrency) {
  if (ccy === "CAD") return "CA$";
  if (ccy === "USD") return "$";
  if (ccy === "EUR") return "€";
  if (ccy === "JPY") return "¥";
  return CURRENCY_META[ccy].symbol;
}

function FeeInline({
  	payUsdc,
	isUSDC,

}: {
  	payUsdc: number
	isUSDC: boolean
}) {
	const [open, setOpen] = useState(false)
	const { usdcbalance, beamio, setCurrencyData, currencyData, setBeamio} = useDaemonContext()
	const [currentCurrency, setcurrentCurrency] = useState<ICurrency>('USDC')

	useEffect (() => {
		if (isUSDC||!beamio) return
		const bo = beamio
		setcurrentCurrency(bo.currency)
	}, [beamio])

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
		return `${c ==='TWD'||c==='JPY' ? v.toFixed(0) : v.toFixed(2)} ${c}`
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
		() => calcFeeFromNumber(payUsdc),
		[payUsdc]
	)

	const receiveUsdc = useMemo(
		() => payUsdc - feeUsdc,
		[payUsdc, feeUsdc]
	)

	const display = useMemo(() => {
		if (isUSDC) {
			return {
				pay: formatAmount(payUsdc, 'USDC'),
				fee: formatAmount(feeUsdc, 'USDC'),
				receive: formatAmount(receiveUsdc, 'USDC'),
			}
		}

		const c = currentCurrency
		return {
			pay: formatAmount(usdcToCurrencyAmount(payUsdc, c), c),
			fee: formatAmount(usdcToCurrencyAmount(feeUsdc, c), c),
			receive: formatAmount(usdcToCurrencyAmount(receiveUsdc, c), c),
		}
	}, [isUSDC, payUsdc, feeUsdc, receiveUsdc, currentCurrency])

	return (
		<div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
			<div className="flex items-center justify-between">
				
				<button
					className="text-sm font-medium text-slate-900 hover:opacity-80"
					onClick={() => setOpen((v) => !v)}
				>
					{open ? "Hide" : "Details"}
				</button>
			</div>

			{!open && (
				<div className="mt-2 flex items-center justify-between text-sm">
					<span className="text-slate-500">
						You receive
						
					</span>
					<span className="font-semibold tabular-nums text-slate-900">
						{fiatPrefix(currentCurrency) + display.pay}
					</span>
				</div>
			)}

		{open && (
			<div className="mt-3 space-y-2 text-sm">

				<div className="flex items-start justify-between">
				{/* 左侧 */}
				<span className="text-slate-500 leading-snug">
					Request
					{!isUSDC && <> (fiat)</>}
				</span>

				{/* 右侧：两行，右对齐 */}
				<div className="flex flex-col items-end leading-snug">
					<span className="font-semibold tabular-nums text-slate-900">
					{fiatPrefix(currentCurrency) + display.pay}
					</span>

					{!isUSDC && (
					<span className="text-xs text-slate-500 tabular-nums">
						{payUsdc} USDC
					</span>
					)}
				</div>
			</div>


			<div className="flex items-start justify-between">
				{/* 左侧 */}
				<span className="text-slate-500 leading-snug">
					Payer pays
					{!isUSDC && <> (est.)</>}
				</span>

				{/* 右侧：两行，右对齐 */}
				<div className="flex flex-col items-end leading-snug">
					<span className="font-semibold tabular-nums text-slate-900">
					{fiatPrefix(currentCurrency) + display.pay}
					</span>

					{!isUSDC && (
					<span className="text-xs text-slate-500 tabular-nums">
						(≈ {payUsdc} USDC)
					</span>
					)}
				</div>
			</div>

			<div className="flex items-center justify-between">
				<span className="text-slate-500">
					Beamio fee
				</span>
				<span className="font-medium tabular-nums text-slate-900">
					{fiatPrefix(currentCurrency) + display.fee}
					{!isUSDC && <> in USDC</>}
				</span>
			</div>

				<div className="flex items-center justify-between">
					<span className="text-slate-500">You will receiv
						{!isUSDC && <> the equivalent of </>}
					</span>
					<span className="font-medium tabular-nums text-slate-900">
						{display.receive} {!isUSDC && <> in USDC</>}
					</span>
				</div>

				<div className="pt-1 text-xs text-slate-400">
					{
						isUSDC ? `USDC amount is fixed · Fee paid by creator · Gas sponsored`
						: `Estimated · Fee paid by creator · Gas sponsored. Final USDC amount, fee, and net receive are calculated when the payer pays, based on the live FX quote.`
					}
					
				</div>
			</div>
		)}
		</div>
	);
	}

export default FeeInline