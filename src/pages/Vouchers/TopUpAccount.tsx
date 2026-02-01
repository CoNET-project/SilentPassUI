// TopUpAccount.tsx - Top Up 流程，依据图片完成，样式参考 PurchaseAccount.tsx
import React, { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, CreditCard, Check, RefreshCw } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { formatAmount } from "@/services/currency"
import { getBalanceProcess } from "@/services/beamio"
import { postBuyCardPoints } from "@/services/BeamioCard"
import { CCSA_Card_Address } from "@/utils/constants"
import { CoNET_Data } from "@/utils/globals"
import usdcIcon from "@/components/assets/usdc.png"
import baseIcon from "@/components/assets/base-logo.png"
type PayMethod = "beamio" | "card"

type Props = {
  onClose?: (val: any) => void
  currencyCode?: "CAD" | "USD"
  presetAmounts?: number[]
  defaultAmount?: number
  beamioBalanceText?: string
  onPay?: (p: {
    amount: number
    currencyCode: "CAD" | "USD"
    method: PayMethod
  }) => void
}

const NAV_TOP = "env(safe-area-inset-top)"

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
  onClose,
  currencyCode = "CAD",
  presetAmounts = [50, 100, 0.1],
  defaultAmount = 100,
  beamioBalanceText = "Balance: 0.00 USDC",
  onPay,
}: Props) {
  const [amount, setAmount] = useState(defaultAmount)
  const [method, setMethod] = useState<PayMethod>("beamio")
  const { currencyData, profiles, setUsdcbalance, setUsdcToUSD, usdcbalance } = useDaemonContext()
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const subtotalText = useMemo(() => formatMoney(amount, currencyCode), [amount, currencyCode])
  const totalText = subtotalText

  const usdcAmount = useMemo(() => {
    const u2u = currencyData?.USDC ?? 1
    const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
    if (!u2u || !u2c) return formatAmount(0, "USDC")
    const usdc = amount / u2c / u2u
    return formatAmount(usdc, "USDC")
  }, [amount, currencyCode, currencyData])

  const usdcAmountNumber = useMemo(() => {
    const u2u = currencyData?.USDC ?? 1
    const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
    if (!u2u || !u2c) return 0
    return amount / u2c / u2u
  }, [amount, currencyCode, currencyData])

  const exchangeRate = useMemo(() => {
    const u2u = currencyData?.USDC ?? 1
    const u2c = currencyCode === "USD" ? 1 : (currencyData?.[currencyCode] ?? 1)
    if (!u2u || !u2c) return "0.0000"
    const rate = 1 / u2c / u2u
    return formatAmount(rate, "USDC")
  }, [currencyCode, currencyData])

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

  const payUSDCProcess = async () => {
    setError("")
	if (loading) return
    if (method === "beamio") {
		const temp = CoNET_Data
		if (!profiles?.length || !profiles[0]?.keyID || !temp || !temp.profiles?.length || !temp.profiles[0]) {
		  setError("Unable to retrieve account information.")
		  return
		}
		
		try {
		  // Get latest balance
		  let latestBalance = usdcbalance
	
		  await getBalanceProcess(
			profiles[0].keyID, setUsdcbalance, setUsdcToUSD
		  )
	
		  const requiredAmount = amount
	
		  if (latestBalance < requiredAmount) {
			setError(
			  `Insufficient balance. Current balance: ${formatAmount(
				latestBalance,
				"USDC"
			  )} USDC. Required: ${usdcAmount} USDC.`
			)
			return
		  }
		  setLoading(true)
		  await new Promise(resolve => setTimeout(resolve, 300))
		  const requestData = await postBuyCardPoints(requiredAmount, profiles[0], CCSA_Card_Address)
		  setLoading(false)
		  if (requestData.success) {
			await new Promise(resolve => setTimeout(resolve, 3000))
			  if (requestData.assets) {
				  onClose?.(requestData.assets ?? null)
			  }
			  
		  } else {
			  setError(requestData.error ?? "Failed to purchase. Please try again.")
			  
			  return
		  }
      } catch {
        setError("Failed to refresh balance. Please try again.")
        setLoading(false)
      }
    } else {
		setLoading(true)
      window.location.href = "https://stripe.com"
    }
  }

  return (
    <div className="flex justify-center sm:items-center">
      <div className={cx("relative w-full max-w-[560px] mx-auto", "rounded-t-[20px] sm:rounded-[24px]")}>
        {/* Header - 仅标题，无关闭按钮 */}
        <div className="px-6 pt-5 pb-3" style={{ paddingTop: `calc(${NAV_TOP} + 16px)` }}>
          <div className="text-[18px] font-bold text-slate-900 leading-tight">
            Top Up Account
          </div>
        </div>

        <div className="px-6 pb-4">
          {/* AMOUNT */}
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="text-[10px] tracking-[0.1em] font-bold text-slate-400 uppercase mb-3">
              AMOUNT
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
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between text-[13px] text-slate-500">
                <span>Subtotal</span>
                <span className="font-medium text-slate-700">{subtotalText}</span>
              </div>
              <div className="mt-2 flex justify-between items-baseline">
                <span className="text-[16px] font-bold text-slate-900">Total</span>
                <span className="text-[20px] font-black text-slate-900">{totalText}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT METHOD */}
          {!loading && (
            <div className="mt-6">
              <div className="px-1 text-[10px] tracking-[0.1em] font-bold text-slate-400 uppercase mb-3">
                PAYMENT METHOD
              </div>
              <div className="space-y-2">
                {[
                  {
                    id: "beamio",
                    label: "Beamio Wallet",
                    sub: beamioBalanceText,
                    useUsdcBaseIcon: true as const,
                    color: "bg-blue-50 text-blue-500",
                    icon: null,
                    iconSize: "h-5 w-5",
                  },
                  {
                    id: "card",
                    label: "Credit Card",
                    sub: "Via Stripe Secure Checkout",
                    useUsdcBaseIcon: false as const,
                    icon: CreditCard,
                    color: "bg-purple-50 text-purple-500",
                    iconSize: "h-5 w-5",
                  },
                ].map((item) => {
                  const active = method === item.id
                  const IconComponent = item.icon
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        onClick={() => setMethod(item.id as PayMethod)}
                        className={cx(
                          "w-full flex items-center gap-4 p-3 rounded-xl border transition-all",
                          active
                            ? "border-[#1D5BFF] bg-blue-50/20"
                            : "border-slate-100 bg-white hover:border-slate-200"
                        )}
                      >
                        <div
                          className={cx(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                            item.color
                          )}
                        >
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
                        <div
                          className={cx(
                            "h-5 w-5 rounded-full flex items-center justify-center border transition-all",
                            active ? "bg-[#1D5BFF] border-[#1D5BFF]" : "border-slate-200"
                          )}
                        >
                          {active && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                        </div>
                      </button>
                      {active && item.id === "beamio" && (
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 overflow-hidden"
                          >
                            <div className="rounded-2xl border border-[#d9e7ff] bg-[#eef5ff] px-5 py-4">
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => {}}
                                  className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1D5BFF] hover:opacity-90 active:scale-[0.99] transition"
                                  aria-label="Refresh rate"
                                >
                                  <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                                  <span>Exchange Rate</span>
                                </button>
                                <span className="text-[13px] font-medium text-[#1D5BFF] tabular-nums">
                                  1 {currencyCode} ≈ {exchangeRate} USDC
                                </span>
                              </div>
                              <div className="mt-3 flex items-baseline justify-between">
                                <span className="text-[15px] font-extrabold text-[#1D5BFF]">
                                  You Pay
                                </span>
                                <span className="text-[18px] font-extrabold text-[#1D5BFF] tabular-nums">
                                  {usdcAmount} USDC
                                </span>
                              </div>
                              <div className="mt-1 text-right text-[12px] text-slate-500">
                                Via Coinbase Oracle
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-[14px] font-medium text-rose-700 text-center">{error}</p>
            </div>
          )}

          <div className="mt-8">
            <button
              type="button"
              onClick={() => payUSDCProcess()}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] shadow-lg shadow-blue-100 active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    {method === "beamio" ? `Pay ${usdcAmount} USDC` : "Continue to Stripe"}
                  </span>
                </>
              )}
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
