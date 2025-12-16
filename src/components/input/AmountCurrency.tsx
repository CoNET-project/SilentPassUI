import { useEffect, useMemo, useRef, useState } from "react"
import { useAutoFocus } from "@/components/input/useAutoFocus"
import { XCircle } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getOracle } from "@/services/beamio"

type Prof = {
	setAmount: (usdc: string) => void // ✅ 永远回传 USDC
	amount: string // ✅ 永远是 USDC
	autoEntry: boolean
	showMax: boolean
	readOnly: boolean
	needBalance: boolean
	showLimit: number
	setError: (val: boolean) => void
}



const AmountCurrency = ({ setAmount, amount, autoEntry, showMax, readOnly, needBalance=true, showLimit, setError }: Prof) => {
	const amountInputRef = useAutoFocus<HTMLInputElement>(autoEntry)

	const { usdcbalance, beamio, setCurrencyData, currencyData } = useDaemonContext()

	const [sendError, setSendError] = useState("")
	const [currentCurrency, setcurrentCurrency] = useState<ICurrency>("CAD")
	const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

	// ✅ UI 显示值：当前 currency 的金额（input 只绑定它）
	const [displayAmount, setDisplayAmount] = useState("0")

	const lastSentUsdcRef = useRef<string>("")
	const firstEditArmedRef = useRef(true)

	const maxDp = currentCurrency === "JPY" ? 0 : currentCurrency === "CNY" ? 2 : 4

	// Focus management
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
	const firstOptionRef = useRef<HTMLButtonElement | null>(null)

	// Run oracle once
	const oracleOnce = useRef(false)

	// ---------- FX helpers ----------
	const currencySymbol = (c: ICurrency) => (c === "JPY" || c === "CNY" ? "¥" : "$")

	// 1 USDC -> ? USD, 1 USD -> ? currency
	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	const usdcToCurrencyAmount = (usdc: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		return usdc * u2u * u2c
	}

	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	const formatCurrencyAmount = (n: number, c: ICurrency) => {
		const decimals = c === "JPY" ? 0 : 2
		if (!Number.isFinite(n)) return "0"
		return n.toFixed(decimals)
	}

	const formatUsdc = (n: number) => {
		if (!Number.isFinite(n)) return "0"
		// USDC 常用 6 位，小额也不会丢精度
		return n.toFixed(6).replace(/\.?0+$/, "")
	}

	// ---------- Init currency + oracle ----------
	const getAccountData = () => {
		if (!beamio) return
		if (beamio.currency) setcurrentCurrency(beamio.currency as ICurrency)
	}

	const oracle = async () => {
		getAccountData()
		const data = await getOracle()
		setCurrencyData({
			CAD: Number(data.usdcad),
			JPY: Number(data.usdjpy),
			USD: 1,
			CNY: Number(data.usdcny),
			USDC: Number(data.usdc),
		})
	}

	useEffect(() => {
		if (oracleOnce.current) return
		oracleOnce.current = true
		oracle()
	}, [])

	// ---------- Balance check (USDC truth) ----------
	const checkBalance = (usdcToSend: number) => {
		if (showLimit) {
			if (usdcToSend < showLimit) {
				setSendError(`The minimum amount must be greater than ${showLimit} threshold.`)
				setError(true)
				return false
			}
		}
		if (!needBalance) return
		const bal = Number(usdcbalance || 0)
		if (bal - usdcToSend < 0) {
			setSendError("Insufficient USDC balance")
			setError(true)
			return false
		}
		setSendError("")
		setError(true)
		return true
	}

	// ---------- Input sanitize ----------
	const sanitizeNumeric = (raw: string) => {
		let v = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
		if (v === "") v = "0"
		return v
	}

	// ---------- Keep displayAmount in sync with (USDC amount + currency) ----------
	useEffect(() => {
		// 如果 amount 是我们刚刚从本 input 发出去的，就别反向覆盖 displayAmount（避免光标跳动）
		if (amount === lastSentUsdcRef.current) return

		const usdc = Number(amount || 0)
		const curValue = usdcToCurrencyAmount(Number.isFinite(usdc) ? usdc : 0, currentCurrency)
		setDisplayAmount(formatCurrencyAmount(curValue, currentCurrency))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [amount, currentCurrency, currencyData])

	// ---------- Picker open/close + focus ----------
	const openPicker = () => {
		if (readOnly) return
		setShowCurrencyPicker(true)
	}

	const closePicker = () => setShowCurrencyPicker(false)

	useEffect(() => {
		if (showCurrencyPicker) {
			requestAnimationFrame(() => {
				setTimeout(() => {
					firstOptionRef.current?.focus({ preventScroll: true } as any)
				}, 60)
			})
		} else {
			requestAnimationFrame(() => {
				setTimeout(() => {
					amountInputRef.current?.focus({ preventScroll: true } as any)
				}, 60)
			})
		}
	}, [showCurrencyPicker])

	// Trap focus within picker (Tab cycles)
	const onPickerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!showCurrencyPicker) return
		if (e.key !== "Tab") return

		const els = optionRefs.current.filter(Boolean) as HTMLButtonElement[]
		if (!els.length) return

		const first = els[0]
		const last = els[els.length - 1]
		const active = document.activeElement as HTMLElement | null

		if (e.shiftKey) {
			if (active === first) {
				e.preventDefault()
				last.focus({ preventScroll: true } as any)
			}
		} else {
			if (active === last) {
				e.preventDefault()
				first.focus({ preventScroll: true } as any)
			}
		}
	}

	// ---------- Pick currency (USDC truth stays) ----------
	const pickCurrency = (next: ICurrency) => {
		setcurrentCurrency(next)

		const usdc = Number(amount || 0)
		const nextDisplay = usdcToCurrencyAmount(Number.isFinite(usdc) ? usdc : 0, next)
		setDisplayAmount(formatCurrencyAmount(nextDisplay, next))

		setSendError("")
		setError(false)
		closePicker()
	}

	// ---------- MAX (sets USDC, refresh display) ----------
	const handleMax = () => {
		const usdc = Number(usdcbalance || 0)
		setAmount(formatUsdc(usdc))

		const curValue = usdcToCurrencyAmount(usdc, currentCurrency)
		setDisplayAmount(formatCurrencyAmount(curValue, currentCurrency))

		setSendError("")
		setError(false)
	}

	const approxUsdcText = useMemo(() => {
		const v = Number(displayAmount || 0)
		if (!Number.isFinite(v) || v <= 0) return ""

		const usdc = currencyToUsdcAmount(v, currentCurrency)
		if (!Number.isFinite(usdc) || usdc <= 0) return ""

		return `≈ ${formatUsdc(usdc)} USDC`
	}, [displayAmount, currentCurrency, currencyData])

	return (
		<div className="mb-4 overflow-hidden">
			<div
				className={`
					w-[200%] flex items-stretch
					transition-transform duration-300 ease-out
					${showCurrencyPicker ? "-translate-x-1/2" : "translate-x-0"}
				`}
			>
				{/* ===================== ① Input view ===================== */}
				<div
					className="w-1/2 pr-3"
					aria-hidden={showCurrencyPicker}
					{...(showCurrencyPicker ? ({ inert: "" } as any) : {})}
				>
					{/* Title row: left amount label, right balance */}
					<div className="flex items-center justify-between mb-1">
						<div className="text-[12px] uppercase tracking-wide text-slate-400 text-left pl-1">
							Amount in {currentCurrency}
						</div>

						<div className="text-[12px] tracking-wide text-slate-400 text-right pr-1">
							Balance USDC{" "}
							{typeof usdcbalance === "number"
								? usdcbalance.toLocaleString(undefined, { maximumFractionDigits: 6 })
								: usdcbalance}
						</div>
					</div>

					{/* Input row: fixed height so absolute elements never jump */}
					<div className="relative h-12">
						{/* Left */}
						<div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
							{/* Currency capsule */}
							<button
								type="button"
								onClick={openPicker}
								disabled={readOnly}
								className="
									inline-flex items-center gap-1.5
									px-2.5 py-1
									rounded-full
									bg-slate-900/10
									dark:bg-white/4
									backdrop-blur-sm

									text-left select-none
									hover:bg-slate-900/15
									dark:hover:bg-white/15
									active:scale-95
									transition-all duration-150

									disabled:opacity-60 disabled:active:scale-100
								"
							>
								<span className="text-[16px] leading-none">
									{currentCurrency === "CAD"
										? "🇨🇦"
										: currentCurrency === "USD"
											? "🇺🇸"
											: currentCurrency === "JPY"
												? "🇯🇵"
												: "🇨🇳"}
								</span>

								<span className="text-[14px] font-normal text-slate-700 dark:text-slate-100 leading-none">
									{currencySymbol(currentCurrency)}
								</span>
							</button>

							{/* MAX */}
							{showMax && (
								<button
									type="button"
									onClick={handleMax}
									disabled={readOnly}
									className="
										px-2.5 py-1
										rounded-full
										text-[10px] font-semibold
										text-sky-700 dark:text-sky-300
										bg-sky-100/80 dark:bg-sky-900/40
										hover:bg-sky-200/80 dark:hover:bg-sky-900/60
										active:scale-95
										transition-all duration-150

										disabled:opacity-60 disabled:active:scale-100
									"
								>
									MAX
								</button>
							)}
						</div>

						{/* Right: clear */}
						{!!displayAmount && displayAmount !== "0" && (
							<button
								type="button"
								onClick={() => {
									setDisplayAmount("0")
									setAmount("0")
									setSendError("")
									setError(false)
								}}
								disabled={readOnly}
								className="
									absolute right-0 top-1/2 -translate-y-1/2 
									p-1.5 rounded-full
									text-slate-400 hover:text-slate-600
									active:scale-90 transition
									disabled:opacity-60 disabled:active:scale-100
								"
								aria-label="Clear amount"
							>
								<XCircle className="w-5 h-5" />
							</button>
						)}

						{/* Input: binds to displayAmount, but outputs USDC */}
						<input
							ref={amountInputRef}
							type="text"
							inputMode="decimal"
							pattern="[0-9]*[.,]?[0-9]*"
							autoComplete="off"
							enterKeyHint="done"
							value={displayAmount}
							onFocus={() => {
								// 当显示是默认 0.00（或 JPY 的 0）时，武装“首次键入替换”
								const zeroDisplay = formatCurrencyAmount(0, currentCurrency)
								firstEditArmedRef.current = (displayAmount === zeroDisplay)
							}}
							onKeyDown={e => {
								if (readOnly) return

								const zeroDisplay = formatCurrencyAmount(0, currentCurrency)
								
								if (displayAmount !== zeroDisplay) {
									firstEditArmedRef.current = false
									return
								}

								firstEditArmedRef.current = false
								const k = e.key

								// 首次键入数字：直接替换成该数字
								if (/^[0-9]$/.test(k)) {
									e.preventDefault()
									const next = k
									setDisplayAmount(next)

									const usdc = currencyToUsdcAmount(Number(next), currentCurrency)
									const usdcStr = formatUsdc(usdc)
									lastSentUsdcRef.current = usdcStr
									setAmount(usdcStr)
									checkBalance(usdc)

									requestAnimationFrame(() => {
										const el = amountInputRef.current
										if (!el) return
										el.setSelectionRange(next.length, next.length)
									})

									firstEditArmedRef.current = false
									return
								}

								// 首次键入 "."：替换为 "0."
								if (k === ".") {
									e.preventDefault()
									const next = "0."
									setDisplayAmount(next)

									const usdc = currencyToUsdcAmount(0, currentCurrency)
									const usdcStr = formatUsdc(usdc)
									lastSentUsdcRef.current = usdcStr
									setAmount(usdcStr)
									checkBalance(usdc)

									requestAnimationFrame(() => {
										const el = amountInputRef.current
										if (!el) return
										el.setSelectionRange(next.length, next.length)
									})

									firstEditArmedRef.current = false
									return
								}
							}}
							onChange={e => {
								const raw = e.target.value
								let v = sanitizeNumeric(raw)

								// 如果用户已经开始输入了，就取消“首次替换”武装
								firstEditArmedRef.current = false

								if (displayAmount === "0" && v !== "0" && !v.startsWith("0.")) {
									v = v.replace(/^0+/, "")
									if (v === "") v = "0"
								}

								// ✅ 位数检查：只算数字，不算小数点（例如 123.45 => 5 位）
								if (v.includes(".")) {
									const [, frac = ""] = v.split(".")

									// JPY 不允许小数点
									if (maxDp === 0) {
										setSendError("JPY does not allow decimals")
										return // 不更新 displayAmount → 回滚本次输入
									}

									// 其他币种限制小数位
									if (frac.length > maxDp) {
										setSendError(`Max ${maxDp} decimals`)
										return
									}
								}

								// 通过校验：清掉错误再更新
								setSendError("")
								setError(false)
								setDisplayAmount(v)


								// ✅ 回传给父组件：永远是 USDC
								const usdc = currencyToUsdcAmount(Number(v), currentCurrency)
								const usdcStr = formatUsdc(usdc)
								lastSentUsdcRef.current = usdcStr
								setAmount(usdcStr)
								checkBalance(usdc)
							}}
							readOnly={readOnly}
							className="
								w-full h-12
								text-[32px] leading-none font-semibold
								text-slate-900
								bg-transparent outline-none
								text-center
								selection:bg-sky-200
								px-16
								border-b border-slate-400/20
							"
						/>
						{
							showLimit > 0 && (
								<div className="flex items-center justify-between text-xs MT-6">
									<span className="text-xs text-slate-500 dark:text-slate-400">Amount (required)</span>
									<span className="text-slate-400">Min amount {'> ' + showLimit} USDC</span>
								</div>
							)
						}

						{/* ≈ USDC hint（右侧，20% 灰） */}
						{approxUsdcText && (
							<div
								className="
									pointer-events-none
									absolute right-10 top-1/2 -translate-y-1/2
									text-[11px] 
									text-slate-900/50 dark:text-white/20
									whitespace-nowrap
								"
							>
								{approxUsdcText}
							</div>
						)}
					</div>

					{/* Error line: fixed height placeholder so layout never shifts */}
					<div className="mt-2 min-h-[14px] pl-1">

						<span
							aria-hidden={!sendError}
							className={`
								block text-[11px] text-rose-500
								transition-opacity duration-150 mt-4
								${sendError ? "opacity-100" : "opacity-0"}
							`}
						>
							{sendError || "placeholder"}
						</span>
					</div>
				</div>

				{/* ===================== ② Picker view ===================== */}
				<div
					className="w-1/2 pl-3"
					aria-hidden={!showCurrencyPicker}
					{...(!showCurrencyPicker ? ({ inert: "" } as any) : {})}
					onKeyDown={onPickerKeyDown}
				>
					<div className="rounded-2xl bg-sky-50 border border-sky-100 px-3 py-3">
						<div className="text-[12px] uppercase tracking-wide text-sky-700/70 mb-2">
							Select currency
						</div>

						<div className="grid grid-cols-2 gap-2">
							{(
								[
									{ c: "USD" as const, flag: "🇺🇸", sym: "$" },
									{ c: "CAD" as const, flag: "🇨🇦", sym: "$" },
									{ c: "JPY" as const, flag: "🇯🇵", sym: "¥" },
									{ c: "CNY" as const, flag: "🇨🇳", sym: "¥" },
								] as const
							).map((item, idx) => (
								<button
									key={item.c}
									ref={el => {
										optionRefs.current[idx] = el
										if (idx === 0) firstOptionRef.current = el
									}}
									type="button"
									tabIndex={showCurrencyPicker ? 0 : -1}
									onClick={() => pickCurrency(item.c)}
									className={`
										w-full
										inline-flex items-center justify-center gap-2
										px-3 py-2
										rounded-full
										border
										transition-all duration-150
										active:scale-95
										focus:outline-none focus:ring-2 focus:ring-sky-200
										${item.c === currentCurrency
											? "bg-white border-sky-200 shadow-sm"
											: "bg-white/70 border-sky-100 hover:bg-white"}
									`}
								>
									<span className="text-[16px] leading-none">{item.flag}</span>
									<span className="text-[14px] font-normal text-slate-700 leading-none">{item.sym}</span>
									<span className="text-[12px] font-semibold text-slate-500 leading-none">{item.c}</span>
								</button>
							))}
						</div>

						{/* Optional: Esc closes picker (no close button) */}
						<div className="sr-only" aria-hidden="true" />
					</div>
				</div>
			</div>
		</div>
	)
}

export default AmountCurrency
