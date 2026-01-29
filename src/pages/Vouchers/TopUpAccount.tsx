// TopUpAccount.tsx
import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, CreditCard, DollarSign, Check } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { formatAmount } from "@/services/currency"

type PayMethod = "beamio" | "card"
type Flow = "PURCHASE" | "TOP_UP"

type Props = {
  open?: boolean
  onClose: () => void
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

export default function TopUpAccount({
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
  const { currencyData } = useDaemonContext()

  const effectiveAmount = isPurchase ? purchasePrice : amount
  const subtotalText = useMemo(() => formatMoney(effectiveAmount, currencyCode), [effectiveAmount, currencyCode])
  const totalText = subtotalText
  const title = isPurchase ? purchaseTitle : "Top Up Account"

  // 计算USDC金额
  const usdcAmount = useMemo(() => {
    // 法币转USDC
    const u2u = currencyData?.USDC ?? 1
    const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
    if (!u2u || !u2c) return formatAmount(0, "USDC")
    const usdc = effectiveAmount / u2c / u2u
    return formatAmount(usdc, "USDC")
  }, [effectiveAmount, currencyCode, currencyData])

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
		<div className="mt-6">
		  <div className="px-1 text-[10px] tracking-[0.1em] font-bold text-slate-400 uppercase mb-3">
			Payment Method
		  </div>
		  <div className="space-y-2">
			{[
			  { id: "beamio", label: "Beamio Wallet", sub: beamioBalanceText, icon: DollarSign, color: "bg-blue-50 text-blue-500", iconSize: "h-5 w-5" },
			  { id: "card", label: "Credit Card", sub: "Via Stripe Secure", icon: CreditCard, color: "bg-purple-50 text-purple-500", iconSize: "h-5 w-5" }
			].map((item) => {
			  const active = method === item.id
			  return (
				<button
				  key={item.id}
				  onClick={() => setMethod(item.id as PayMethod)}
				  className={cx(
					"w-full flex items-center gap-4 p-3 rounded-xl border transition-all",
					active ? "border-[#1D5BFF] bg-blue-50/20" : "border-slate-100 bg-white hover:border-slate-200"
				  )}
				>
				  <div className={cx("h-10 w-10 rounded-full flex items-center justify-center shrink-0", item.color)}>
					<item.icon className={item.iconSize} strokeWidth={2.2} />
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
			  )
			})}
		  </div>
		</div>

		{/* Action Button - 紧凑型大按钮 */}
		<div className="mt-8">
		  <button
			onClick={() => onPay?.({ flow, amount: effectiveAmount, currencyCode, method })}
			className="w-full h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] shadow-lg shadow-blue-100 active:scale-[0.99] transition-transform flex flex-col items-center justify-center gap-0.5"
		  >
			<div className="flex items-center gap-2">
			  <Sparkles className="h-4 w-4" />
			  <span>Pay {totalText}</span>
			</div>
			<span className="text-[12px] font-medium text-white/80">≈ {usdcAmount} USDC</span>
		  </button>
		  <p className="text-center text-[11px] text-slate-400 mt-4">
			Secure encrypted transaction
		  </p>
		</div>
	  </div>
	</div>
  </div>
    
  )
}