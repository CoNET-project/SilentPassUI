// TopUpAccount.tsx
import React, { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, CreditCard, Check, RefreshCw } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { formatAmount } from "@/services/currency"
import { getBalanceProcess, storeSystemData } from "@/services/beamio"
import { getAAAccount, postBuyCardPoints } from "@/services/BeamioCard"
import base_ex from "@/components/assets/base-ex.svg"
import usdcIcon from "@/components/assets/usdc.png"
import baseIcon from "@/components/assets/base-logo.png"
import { CCSA_Card_Address } from "@/utils/constants"
import {CoNET_Data, setCoNET_Data} from "@/utils/globals"

type PayMethod = "beamio" | "card"
type Flow = "PURCHASE" | "TOP_UP"

type Props = {
  open?: boolean
  onClose: (val: any) => void
  flow?: Flow
  currencyCode?: "CAD" | "USD"
  presetAmounts?: number[]
  defaultAmount?: number
  purchasePrice?: number
  purchaseTitle?: string
  defaultMethod?: PayMethod
  beamioBalanceText?: string
  onPay?: (p: {
    flow: Flow
    amount: number
    currencyCode: "CAD" | "USD"
    method: PayMethod
  }) => void
}

const NAV_TOP = "env(safe-area-inset-top)"
const NAV_BOTTOM = "env(safe-area-inset-bottom)"

function formatMoney(amount: number, code: "CAD" | "USD") {
  const n = Number.isFinite(amount) ? amount : 0
  const base = n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (code === "CAD") return `CA$${base}`
  return `$${base}`
}

function cx(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(" ")
}

export default function PurchaseAccount({
	open = true,
	onClose,
	flow = "TOP_UP",
	currencyCode = "CAD",
	presetAmounts = [50, 100, 200],
	defaultAmount = 100,
	purchasePrice = 100,
	purchaseTitle = "Purchase Membership",
	defaultMethod = "beamio",
	beamioBalanceText = "Balance: 0.00 USDC",
	onPay,
}: Props) {
	const isPurchase = flow === "PURCHASE"
	const [amount, setAmount] = useState(defaultAmount)
	const [method, setMethod] = useState<PayMethod>(defaultMethod)
	const { currencyData, profiles, usdcbalance, setUsdcbalance, setUsdcToUSD, setProfiles } = useDaemonContext()
	const [error, setError] = useState<string>("")

	useEffect(() => {
		if (!error) return
		setTimeout(() => {
			setError('')
		}, 3000)
	}, [error])

	useEffect(() => {	
		if (!error) return
		setError('')
	}, [method])

	const effectiveAmount = isPurchase ? purchasePrice : amount
	const subtotalText = useMemo(() => formatMoney(effectiveAmount, currencyCode), [effectiveAmount, currencyCode])
	const totalText = subtotalText
	const title = isPurchase ? purchaseTitle : "Top Up Account"
	const [loading, setLoading] = useState(false)

	// 计算USDC金额（字符串格式用于显示）
	const usdcAmount = useMemo(() => {
		// 法币转USDC
		const u2u = currencyData?.USDC ?? 1
		const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
		if (!u2u || !u2c) return formatAmount(0, "USDC")
		const usdc = effectiveAmount / u2c / u2u
		return formatAmount(usdc, "USDC")
	}, [effectiveAmount, currencyCode, currencyData])

	// 计算USDC金额（数字格式用于比较）
	const usdcAmountNumber = useMemo(() => {
		const u2u = currencyData?.USDC ?? 1
		const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
		if (!u2u || !u2c) return 0
		return effectiveAmount / u2c / u2u
	}, [effectiveAmount, currencyCode, currencyData])

	// 计算汇率显示（1 CAD/USD ≈ X USDC）
	const exchangeRate = useMemo(() => {
		const u2u = currencyData?.USDC ?? 1
		const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
		if (!u2u || !u2c) return "0.0000"
		const rate = 1 / u2c / u2u
		return formatAmount(rate, "USDC")
	}, [currencyCode, currencyData])

	const Success = ({amount, successHash}: {amount: string, successHash: string}) => {
		
		return (
			<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center
							bg-transparent text-inherit">

				{/* 蓝色圆圈 ✔ */}
				<div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
					✓
				</div>

				{/* 成功文字 */}
				<div className="font-semibold text-slate-600 dark:text-slate-300 mb-2 mt-4">
					{'Successfully purchased' } 
				</div>

				{/* 金额 */}
				<div className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
					{amount} USDC
				</div>

				{/* 提示 */}
				<div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
					{'It may take a few seconds to appear on-chain.' } 
				</div>

			
				

				{/* 按钮组 */}
				<div className="w-full space-y-3">

					{/* 完成按钮 */}
					<button
						className="w-full h-11 rounded-full
								bg-blue-600 text-white
								text-sm font-medium"
						onClick={() => {
							onClose(null)
						}}
					>
						Done
					</button>

					{/* 查看交易按钮 */}
					<button
						className="
							w-full h-11 rounded-full
							bg-black/5 text-slate-700
							dark:bg-white/10 dark:text-slate-100
							text-sm
							flex items-center justify-center gap-2
						"
						onClick={() => {
							window.open(`https://basescan.org/tx/${successHash}`, '_blank', 'noopener,noreferrer')
						}}
						>
						<img
							src={base_ex}
							alt="Base Explorer"
							className="w-4 h-4 object-contain"
						/>
						<span>
							View transaction
						</span>
					</button>
				</div>
			</div>
		)
	}

	const payUSDCProcess = async () => {
		
		setError("")
	  
		if (method === "beamio") {
		  // Refresh USDC balance
		  const temp = CoNET_Data
		  if (!profiles?.length || !profiles[0]?.keyID || !temp || !temp.profiles?.length || !temp.profiles[0]) {
			setError("Unable to retrieve account information.")
			setLoading(false)
			return
		  }
		  
		  try {
			// Get latest balance
			let latestBalance = 0
	  
			await getBalanceProcess(
			  profiles[0].keyID,
			  (balance) => {
				latestBalance = balance
				setUsdcbalance(balance)
			  },
			  setUsdcToUSD
			)
	  
			const requiredAmount = effectiveAmount
	  
			if (latestBalance < requiredAmount) {
			  setError(
				`Insufficient balance. Current balance: ${formatAmount(
				  latestBalance,
				  "USDC"
				)} USDC. Required: ${usdcAmount} USDC.`
			  )
			  setLoading(false)
			  return
			}

			setLoading(true)
			const requestData = await postBuyCardPoints(requiredAmount, profiles[0], CCSA_Card_Address)
			if (requestData.success) {
				await new Promise(resolve => setTimeout(resolve, 3000))
				setLoading(false)
				onClose(requestData.assets)
				
				
			} else {
				setError(requestData.error ?? "Failed to purchase. Please try again.")
				setLoading(false)
				return
			}

		} catch (err) {
				setError("Failed to purchase. Please try again.")
				setLoading(false)
				return
			}
		} else {
		  // Pay via Stripe
		  window.location.href = "https://stripe.com"
		}
	  }
	  

  return (
    
      
	<div
		className="flex
		justify-center
		sm:items-center"
	
	>
	{/* Backdrop */}
	

	{/* Sheet - 保持 max-w-[560px] 保证全宽观感 */}
	<div
	  className={cx(
		"relative w-full max-w-[560px] mx-auto",
    	"rounded-t-[20px] sm:rounded-[24px]",
	  )}
	 
	>
	  {/* Header - 缩小标题字号 */}
	  <div className="px-6 pt-5 pb-3" style={{ paddingTop: `calc(${NAV_TOP} + 16px)` }}>
		<div className="flex items-center justify-between">
		  <div className="text-[18px] font-bold text-slate-900 leading-tight">
			{title}
		  </div>
		  
		</div>
	  </div>

	  <div className="px-6 pb-4">
		{/* Summary Card - 调整内部间距与字体 */}
		<div className="rounded-xl border border-slate-100 bg-white p-4">
		  {!isPurchase ? (
			<>
			  <div className="text-[10px] tracking-[0.1em] font-bold text-slate-400 uppercase mb-3">
				Amount
			  </div>
			  <div className="grid grid-cols-3 gap-3 mb-5">
				{presetAmounts.map((v) => {
				  const active = v === amount
				  return (
					<button
					  key={v}
					  onClick={() => setAmount(v)}
					  className={cx(
						"h-10 rounded-lg border text-[14px] font-bold transition-all",
						active
						  ? "bg-[#1D5BFF] border-[#1D5BFF] text-white"
						  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
					  )}
					>
					  ${v}
					</button>
				  )
				})}
			  </div>
			</>
		  ) : null}

		  <div className={cx(isPurchase ? "py-1" : "pt-4 border-t border-slate-100")}>
			<div className="flex justify-between text-[13px] text-slate-500">
			  <span>Subtotal</span>
			  <span className="font-medium text-slate-700">{subtotalText}</span>
			</div>
			<div className="mt-2 flex justify-between items-baseline">
			  <span className="text-[16px] font-bold text-slate-900">Total</span>
			  <span className="text-[20px] font-black text-[#1D5BFF]">{totalText}</span>
			</div>
		  </div>
		</div>

		{/* Payment Method - 列表更加精致 */}
		{!loading && (
		<div className="mt-6">
		  <div className="px-1 text-[10px] tracking-[0.1em] font-bold text-slate-400 uppercase mb-3">
			Payment Method
		  </div>
		  <div className="space-y-2">
			{[
			  { id: "beamio", label: "Beamio Wallet", sub: beamioBalanceText, useUsdcBaseIcon: true as const, color: "bg-blue-50 text-blue-500", icon: null, iconSize: "h-5 w-5" },
			  { id: "card", label: "Credit Card", sub: "Via Stripe Secure", useUsdcBaseIcon: false as const, icon: CreditCard, color: "bg-purple-50 text-purple-500", iconSize: "h-5 w-5" }
			].map((item) => {
			  const active = method === item.id
			  const IconComponent = item.icon
			  return (

				<div key={item.id}>
					<button
						
						onClick={() => setMethod(item.id as PayMethod)}
						className={cx(
							"w-full flex items-center gap-4 p-3 rounded-xl border transition-all",
							active ? "border-[#1D5BFF] bg-blue-50/20" : "border-slate-100 bg-white hover:border-slate-200"
						)}
						>
						<div className={cx("h-10 w-10 rounded-full flex items-center justify-center shrink-0", item.color)}>
							{item.useUsdcBaseIcon ? (
								<div className="relative flex-shrink-0 w-5 h-5 min-w-[20px] min-h-[20px]">
									<img
										src={usdcIcon}
										alt="USDC"
										className="block w-5 h-5 rounded-full object-contain"
									/>
									<img
										src={baseIcon}
										alt="Base"
										className="block w-3 h-3 absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white"
									/>
								</div>
							) : IconComponent ? (
								<IconComponent className={item.iconSize} strokeWidth={2.2} />
							) : null}
						</div>
						<div className="flex-1 text-left min-w-0">
							<div className="text-[14px] font-bold text-slate-800">{item.label}</div>
							<div className="text-[12px] text-slate-400 truncate">{item.sub}</div>
						</div>
						<div className={cx(
							"h-5 w-5 rounded-full flex items-center justify-center border transition-all",
							active ? "bg-[#1D5BFF] border-[#1D5BFF]" : "border-slate-200"
						)}>
							{active && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
						</div>
					</button>
					{active && item.id === 'beamio' && (
						<>
							<AnimatePresence>
							
								<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.2 }}
								className="mt-3 overflow-hidden"
								>
								<div
									className="
									rounded-2xl
									border border-[#d9e7ff]
									bg-[#eef5ff]
									px-5 py-4
									"
								>
									{/* top row */}
									<div className="flex items-center justify-between">
									<button
										type="button"
										onClick={() => {
										// refresh logic here
										}}
										className="
										inline-flex items-center gap-2
										text-[13px] font-medium
										text-[#1D5BFF]
										hover:opacity-90
										active:scale-[0.99]
										transition
										"
										aria-label="Refresh rate"
									>
										<RefreshCw className="h-4 w-4" strokeWidth={2.2} />
										<span>Exchange Rate</span>
									</button>

									<div className="text-[13px] font-medium text-[#1D5BFF] tabular-nums">
										1 {currencyCode} ≈ {exchangeRate} USDC
									</div>
									</div>

									{/* you pay row */}
									<div className="mt-3 flex items-baseline justify-between">
									<div className="text-[15px] font-extrabold text-[#1D5BFF]">
										You Pay
									</div>

									<div className="text-[18px] font-extrabold text-[#1D5BFF] tabular-nums">
										{usdcAmount} USDC
									</div>
									</div>

									<div className="mt-1 text-right text-[12px] text-[#8aa6e8]">
									Via Coinbase Oracle
									</div>
								</div>
								</motion.div>
							
							</AnimatePresence>
						</>
					)}
				</div>
				
			  )
			})}
		  </div>

		  
		</div>
		)}

		{/* Error Message */}
		{error && (
			<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
				<p className="text-[14px] font-medium text-rose-700 text-center">
					{error}
				</p>
			</div>
		)}

		{/* Action Button - 紧凑型大按钮 */}
		<div className="mt-8">
			<button
				onClick={() => payUSDCProcess()}
				disabled={loading}
				className="w-full h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] shadow-lg shadow-blue-100 dark:shadow-blue-900/30 active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loading ? (
					<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
				) : (
					<>
						<Sparkles className="h-4 w-4 shrink-0" />
						{method === "beamio" ? (
							<span>Pay {usdcAmount} USDC</span>
						) : (
							<span>Continue to Stripe</span>
						)}
					</>
				)}
			</button>
			<p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-4">
				Secure encrypted transaction
			</p>
		</div>
	  </div>
	</div>
  </div>
    
  )
}