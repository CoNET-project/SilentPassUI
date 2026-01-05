import { useEffect, useMemo, useRef, useState } from "react"
import { useAutoFocus } from "@/components/input/useAutoFocus"
import { XCircle } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getOracle, postBeamio, storeSystemData } from "@/services/beamio"
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import IOSGlassPillButton from '@/components/button/IOSButton'
import CurrencyPicker from './SelectCurrent'



type Prof = {
	setAmount: (usdc: string) => void // ✅ 永远回传 USDC
	amount: string // ✅ 永远是 USDC
	autoEntry: boolean
	showMax: boolean
	readOnly: boolean
	needBalance: boolean
	showLimit: number
	setError: (val: boolean) => void
	focusSignal?: boolean
	currencyUSDC?: boolean
	feePlus?: boolean
	currencyChange?: (val: ICurrency) => void
}

//@ts-ignore
const CURRENCY_META: Record<ICurrency, { flag: string; sym: string; maxDp: number }> = {
	USD: { flag: "🇺🇸", sym: "$", maxDp: 2 },
	CAD: { flag: "🇨🇦", sym: "$", maxDp: 2 },
	EUR: { flag: "🇪🇺", sym: "€", maxDp: 2 },
	JPY: { flag: "🇯🇵", sym: "¥", maxDp: 0 },
	CNY: { flag: "🇨🇳", sym: "¥", maxDp: 2 },
	HKD: { flag: "🇭🇰", sym: "$", maxDp: 2 },
	TWD: { flag: "🇹🇼", sym: "NT$", maxDp: 0 },
	SGD: { flag: "🇸🇬", sym: "$", maxDp: 2 },
}

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped)
}

const formatMoney = (n: number, fixed: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: fixed, maximumFractionDigits: fixed })

const isCurrency = (v: any): v is ICurrency =>
	['USD','CAD','EUR','JPY','CNY','HKD','TWD','SGD'].includes(String(v))

// 根据「到账金额 received」反推 fee
function calcFeeFromReceived(received: number) {
	if (!isFinite(received) || received <= 0) return 0

	// 1️⃣ 尝试比例区间（最常见）
	const baseByRatio = received / 0.992
	const feeByRatio = baseByRatio - received

	if (feeByRatio > 0.02 && feeByRatio < 2) {
		return Number(feeByRatio.toFixed(4))
	}

	// 2️⃣ 尝试最小 fee
	const baseMin = received + 0.02
	if (baseMin * 0.008 <= 0.02) {
		return 0.02
	}

	// 3️⃣ 尝试最大 fee
	const baseMax = received + 2
	if (baseMax * 0.008 >= 2) {
		return 2
	}

	// 理论上不会到这里
	return Number(feeByRatio.toFixed(4))
}

const AmountCurrency = ({ setAmount, amount, autoEntry, showMax, readOnly, needBalance=true, showLimit, setError, focusSignal, currencyUSDC=false, feePlus=false, currencyChange}: Prof) => {
	const amountInputRef = useAutoFocus<HTMLInputElement>(autoEntry)

	const { usdcbalance, beamio, setCurrencyData, currencyData, setBeamio} = useDaemonContext()

	const [sendError, setSendError] = useState("")
	const [currentCurrency, setcurrentCurrency] = useState<ICurrency>('USD')
	const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

	// ✅ UI 显示值：当前 currency 的金额（input 只绑定它）
	const [displayAmount, setDisplayAmount] = useState("0")

	const lastSentUsdcRef = useRef<string>("")
	const firstEditArmedRef = useRef(true)
	const prevModeRef = useRef<boolean>(currencyUSDC)
	

	// Focus management
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
	const firstOptionRef = useRef<HTMLButtonElement | null>(null)

	

	// ---------- FX helpers ----------
	const maxDp = currencyUSDC ? 4 : (CURRENCY_META[currentCurrency]?.maxDp ?? 2)
	const currencySymbol = (c: ICurrency) => CURRENCY_META[c]?.sym ?? "$"
	const currencyFlag = (c: ICurrency) => CURRENCY_META[c]?.flag ?? ""

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
		const decimals = (c === "JPY" || c==='TWD') ? 0 : 2
		if (!Number.isFinite(n)) return "0"
		return n.toFixed(decimals)
	}

	const formatUsdc = (n: number) => {
		if (!Number.isFinite(n)) return "0"
		// USDC 常用 6 位，小额也不会丢精度
		return n.toFixed(4).replace(/\.?0+$/, "")
	}


	useEffect(() => {

		oracle()
	}, [])

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}

	const oracle = async () => {
		const data = await getOracle()
		setCurrencyData({
			CAD: Number(data.usdcad),
			JPY: Number(data.usdjpy),
			USD: 1,
			CNY: Number(data.usdcny),
			USDC: Number(data.usdc),
			HKD: Number(data.usdhkd),
			TWD: Number(data.usdtwd),
			EUR: Number(data.usdeur),
			SGD: Number(data.usdsgd),
		})
	}

	useEffect(() => {
		const prev = prevModeRef.current
		if (prev === currencyUSDC) return
		prevModeRef.current = currencyUSDC

		firstEditArmedRef.current = true

		// ✅ 对齐成 0，避免后续 sync effect “认为不是本组件刚发出的”
		const zeroUsdcStr = formatUsdc(0)
		lastSentUsdcRef.current = zeroUsdcStr

		setAmount(zeroUsdcStr)
		setDisplayAmount(currencyUSDC ? zeroUsdcStr : formatCurrencyAmount(0, currentCurrency))

		setSendError("")
		setError(false)
	}, [currencyUSDC]) // 保持依赖不变即可
	
	useEffect(() => {
		if (currencyUSDC) return // ✅ USDC 模式不改 currentCurrency（保留上一次法币）
		if (beamio) return setcurrentCurrency(beamio.currency)
		setcurrentCurrency('USD')
	}, [currencyUSDC, beamio])

	useEffect(() => {
		if (!focusSignal) return
		requestAnimationFrame(() => {
			amountInputRef.current?.focus({ preventScroll: true } as any)
		})
	}, [focusSignal])

	useEffect(() => {
		const c = beamio?.currency
		if (!c) return
		const curr = isCurrency(c) ? c : 'USD'
		setcurrentCurrency(curr)
		if (currencyChange) {
			currencyChange(curr)
		}
	}, [])

	// ---------- Balance check (USDC truth) ----------
	const checkBalance = (usdcToSend: number) => {
		if (showLimit) {
			if (usdcToSend <= showLimit) {
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
		setError(false)
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
		const safeUsdc = Number.isFinite(usdc) ? usdc : 0

		if (currencyUSDC) {
			setDisplayAmount(formatUsdc(safeUsdc)) // ✅ USDC 模式：显示 USDC
		} else {
			const curValue = usdcToCurrencyAmount(safeUsdc, currentCurrency)
			setDisplayAmount(formatCurrencyAmount(curValue, currentCurrency)) // ✅ 法币模式：显示法币
		}
		
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [amount, currentCurrency, currencyData, currencyUSDC, showCurrencyPicker, displayAmount])

	// ---------- Picker open/close ----------
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

	const handleSaveAvatar = async (curr: ICurrency) => {
		if (!CoNET_Data||!beamio ) return
		
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio

		if (!beamio?.pgpPublicKeyID) {
			
		}

		bo.currency = curr
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})
	}

	// ---------- Pick currency (USDC truth stays) ----------
	const pickCurrency = (next: ICurrency) => {
		setcurrentCurrency(next)
		if (currencyChange) {
			currencyChange(next)
		}
		const usdc = Number(amount || 0)
		const nextDisplay = usdcToCurrencyAmount(Number.isFinite(usdc) ? usdc : 0, next)
		setDisplayAmount(formatCurrencyAmount(nextDisplay, next))
		
		handleSaveAvatar(next)
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

		let decimals = 0
		if (usdc < 10) decimals = 4
		else if (usdc < 100) decimals = 2
		else if (usdc >= 1000) decimals = 0
		else decimals = 2 // 100–999

		const formatted = usdc.toLocaleString(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		})

		return `${formatted}`
	}, [displayAmount, currentCurrency, currencyData])

	const onVChange = (n: number) => {

		if (currencyUSDC) {
			const fee = feePlus ? calcFeeFromReceived(n) :calcFeeFromNumber(n)

			if (feePlus) {
				n += fee
			}
			const usdc = Number.isFinite(n) ? n : 0
			const usdcStr = formatUsdc(usdc)
			lastSentUsdcRef.current = usdcStr
			setAmount(usdcStr)
			checkBalance(usdc)
		} else {
		
			let usdc = currencyToUsdcAmount(Number.isFinite(n) ? n : 0, currentCurrency)
			
			const fee = feePlus ? calcFeeFromReceived(usdc) :calcFeeFromNumber(usdc)
			if (feePlus) {
				usdc += fee
			}


			const usdcStr = formatUsdc(usdc)
			lastSentUsdcRef.current = usdcStr
			setAmount(usdcStr)
			checkBalance(usdc)
		}
	}

	return (
		<div className="mb-3 overflow-visible" onKeyDown={onPickerKeyDown}>
			{/* ===================== Input view ===================== */}
			<div>
				{/**		Balance  */}
				<div className="flex items-center justify-between text-[12px] tracking-wide text-slate-400 pr-1">
					{/* 左侧：currentCurrency 计价 */}
					<div className="leading-none opacity-70">
						{typeof usdcbalance === "number" && (
							<>
								{currentCurrency}{" "}
								{formatMoney(usdcbalance * fxRateUSDCToCurrency(currentCurrency), currentCurrency === "JPY" ? 0 : 2)}
							</>
						)}
					</div>

					{/* 右侧：USDC 余额（保持原样） */}
					<div className="inline-flex items-center gap-1">
						<span className="leading-none">
							{formatMoney(usdcbalance,4)} USDC
						</span>
					</div>
				</div>

				{/* Input row: fixed height so absolute elements never jump */}
				<div className="relative h-12">
					{/* Left */}
					<div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
						{/* Currency capsule */}
						{
							currencyUSDC ? (
								<div
									className="
										relative
										flex-shrink-0
										w-4 h-4
										min-w-[16px] min-h-[16px]
									"
								>
									<img
										src={usdcIcon}
										alt="USDC"
										className="
											block
											w-4 h-4
											rounded-full
											object-contain
										"
									/>
									<img
										src={baseIcon}
										alt="Base"
										className="
											block
											w-2.5 h-2.5
											absolute -bottom-0.5 -right-0.5
											rounded-full
											border border-white dark:border-slate-900
											bg-white
										"
									/>
								</div>
							) : (
								<>
									<IOSGlassPillButton open={showCurrencyPicker} onToggle={openPicker} >
										<span className="text-[15px] leading-none">   
											{currencyFlag(currentCurrency)}
										</span>

										<span className="text-[13px] font-normal text-slate-700 dark:text-slate-100 leading-none">
											{currencySymbol(currentCurrency)}
										</span>
									</IOSGlassPillButton>
									
								</>
								
							)
						}
							

						{/* MAX */}
						{currencyUSDC && showMax && (
							<button
								type="button"
								onClick={handleMax}
								disabled={readOnly}
								className="
									px-1 py-1            
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
							// 当显示是默认 0.00（或 JPY 的 0）时，武装"首次键入替换"
							const zeroDisplay = formatCurrencyAmount(0, currentCurrency)
							firstEditArmedRef.current = (displayAmount === zeroDisplay)
						}}
						onKeyDown={e => {
							if (readOnly) return
							setSendError("")
							const zeroDisplay = currencyUSDC ? formatUsdc(0) : formatCurrencyAmount(0, currentCurrency)
							
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

								// ✅ 关键：让 onVChange 统一处理 feePlus / 换算 / setAmount / checkBalance
								onVChange(Number(next))

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

								// 这里 Number("0.") === 0
								onVChange(Number(next))

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
							setSendError("")
							let v = sanitizeNumeric(raw)

							// 如果用户已经开始输入了，就取消"首次替换"武装
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
									setSendError("JPY & TW does not allow decimals")
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

							let n = Number(v)
							
							onVChange(n)
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
								<span className="text-slate-400">Min {'> ' + showLimit} USDC</span>
							</div>
						)
					}

					{/* ≈ USDC hint（右侧，20% 灰） */}
					{approxUsdcText && !currencyUSDC && (
						<div
							className="
								pointer-events-none
								absolute right-1 top-1/2 -translate-y-1/2
								flex items-center gap-1.5
								text-[11px]
								text-slate-900/50 dark:text-white/20
								whitespace-nowrap
							"
						>
							<span>
								≈ 
							</span>
							

							{/* USDC on Base icon（尺寸锁死） */}
							<div
								className="
									relative
									flex-shrink-0
									w-4 h-4
									min-w-[16px] min-h-[16px]
								"
							>
								<img
									src={usdcIcon}
									alt="USDC"
									className="
										block
										w-4 h-4
										rounded-full
										object-contain
									"
								/>
								<img
									src={baseIcon}
									alt="Base"
									className="
										block
										w-2.5 h-2.5
										absolute -bottom-0.5 -right-0.5
										rounded-full
										border border-white dark:border-slate-900
										bg-white
									"
								/>
							</div>
							{/* ≈ 文本 */}
							<span className="leading-none">
								{approxUsdcText}
							</span>
						</div>
					)}
				</div>

				{/* Error line: fixed height placeholder so layout never shifts */}

				{
					sendError && (
						<div className="mt-2 min-h-[14px] pl-1">
							<span
								aria-hidden={!sendError}
								className={`
									font-medium
									block text-[13px] text-rose-500 -ml-1
									transition-opacity duration-150 mt-6
									${sendError ? "opacity-100" : "opacity-0"}
								`}
							>
								{sendError || "placeholder"}
							</span>
						</div>
					)
				}
				
			</div>

			{/* ===================== 浮层背景 + Picker Modal ===================== */}



			
			<div
				className={`
					fixed inset-0
					flex items-center justify-center
					z-50
					transition-all duration-300
					${showCurrencyPicker ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
				`}
				>
				{/* ❌ 不加任何背景遮罩、不模糊外层 */}

					  {/* ✅ 半透明 + 模糊的浮层背景 */}
						{/* <div
							aria-hidden
							className={`
							absolute inset-0
							
							backdrop-blur-md
							transition-opacity
							${showCurrencyPicker ? "opacity-0.4" : "opacity-0"}
							`}
							style={{ WebkitBackdropFilter: "blur(4px)" }}
							onClick={closePicker}
						/> */}
				{/* ✅ 只对弹出窗口本身做模糊 + 透明 */}
				<div
					className={`
						relative
						rounded-2xl
						shadow-2xl
						p-4
						max-w-sm w-[90vw]
						transition-all duration-300 ease-out

						/* ✅ glass */
						bg-white/12
						backdrop-blur-xl
						border border-white/20

						${showCurrencyPicker ? "scale-100 translate-y-0" : "scale-75 translate-y-8"}
					`}
					style={{
						WebkitBackdropFilter: "blur(18px) saturate(160%)",
						backdropFilter: "blur(18px) saturate(160%)"
					}}
				>
					

					{/* Grid */}
					
					{/* Picker 浮层：从小到大长出来 */}
			
					

					{/* 货币网格 */}
					<CurrencyPicker setCurrentCurrency={pickCurrency} currentCurrency={currentCurrency} />

				
				</div>
			</div>
</div>

			
		
	)
}

export default AmountCurrency