import { QRCodeCanvas } from "qrcode.react"
import { BIZ_PUBLIC_LOGO512 } from "@/pages/Home/brandUi"
import { Copy, Check, Printer, Share2, Clock } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { formatAmount } from "@/services/currency"

const displayName = (item: beamio | null) => {
	if (!item) return ""
	const lastname = item.lastName?.split("\r\n") || []
	const fullName = `${item.firstName || ""} ${/^\{/.test(lastname[0]) ? "" : lastname[0] || ""}`.trim()
	return fullName || item.accountName || item.address
}

function cx(...v: Array<string | false | undefined | null>) {
	return v.filter(Boolean).join(" ")
}

/** 判断是否为“数据 JSON”模式（非 http URL）：用于隐藏 Print/Share 和文字内容、显示倒计时 */
function isDataMode(value: string): boolean {
	const trimmed = value.trim()
	return trimmed.startsWith("{") || (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))
}

function formatCountdown(secondsLeft: number): string {
	if (secondsLeft <= 0) return "0:00"
	const m = Math.floor(secondsLeft / 60)
	const s = secondsLeft % 60
	return `${m}:${s.toString().padStart(2, "0")}`
}

export default function ShowPayQR({
	successUrl,
	beamio,
	qrValue,
	amount,
	currency,
	hideActions,
	hideUrl,
	hideName,
}: {
	successUrl: string
	beamio: beamio | null
	/** 当为卡 QR（ERC3009 离线签名数据）时传入，QR 与复制内容以此为准 */
	qrValue?: string
	/** 显示的金额值 */
	amount?: string
	/** 货币符号 */
	currency?: string
	/** 是否隐藏 Print 和 Share 按钮 */
	hideActions?: boolean
	/** 是否隐藏 URL 显示区域 */
	hideUrl?: boolean
	/** 是否隐藏 displayName 和 @accountName */
	hideName?: boolean
}) {
	const [copied, setCopied] = useState(false)
	const valueForQR = qrValue ?? successUrl
	const isData = useMemo(() => isDataMode(valueForQR), [valueForQR])

	// 从 JSON 中解析 ERC3009 数据
	const erc3009Data = useMemo(() => {
		if (!qrValue || !isData) return null
		try {
			const parsed = JSON.parse(qrValue) as { 
				validBefore?: string
				maxAmount?: string
			}
			return parsed
		} catch {
			return null
		}
	}, [qrValue, isData])

	// 从 JSON 中解析 validBefore（unix 秒），用于倒计时
	const validBeforeSec = useMemo(() => {
		if (!erc3009Data) return null
		const v = erc3009Data.validBefore
		return v != null ? parseInt(String(v), 10) : null
	}, [erc3009Data])

	// 解析最大可使用金额（maxAmount 是 wei 格式，USDC 使用 6 位小数）
	const maxUsableAmount = useMemo(() => {
		if (!erc3009Data?.maxAmount) return null
		try {
			// maxAmount 是字符串格式的 wei（6位小数）
			const amountWei = BigInt(erc3009Data.maxAmount)
			// 转换为 USDC 金额（除以 10^6）
			const amountUSDC = Number(ethers.formatUnits(amountWei, 6))
			return formatAmount(amountUSDC, "USDC")
		} catch {
			return null
		}
	}, [erc3009Data])

	const [secondsLeft, setSecondsLeft] = useState<number>(() => {
		if (validBeforeSec == null) return 0
		return Math.max(0, validBeforeSec - Math.floor(Date.now() / 1000))
	})

	const expired = isData && validBeforeSec != null && secondsLeft <= 0

	useEffect(() => {
		if (validBeforeSec == null) return
		setSecondsLeft(Math.max(0, validBeforeSec - Math.floor(Date.now() / 1000)))
		const timer = setInterval(() => {
			setSecondsLeft((prev) => {
				const next = Math.max(0, validBeforeSec - Math.floor(Date.now() / 1000))
				return next
			})
		}, 1000)
		return () => clearInterval(timer)
	}, [validBeforeSec])

	const onCopyPayLink = async () => {
		const ok = await copyText(valueForQR)
		if (ok) setCopied(true)
	}

	const copyText = async (t: string) => {
		try {
			await navigator.clipboard.writeText(t)
			return true
		} catch {
			return false
		}
	}
	const onPrint = () => {
		window.print()
	}
	const onShare = () => {
		if (qrValue) return
		window.open(successUrl, "_blank")
	}

	useEffect(() => {
		if (!copied) return
		const t = window.setTimeout(() => setCopied(false), 3000)
		return () => window.clearTimeout(t)
	}, [copied])

	return (
		<>
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
    	"",
	  )}
	 
	>

			<div className="mt-6">
					<div className="px-6 pt-4 pb-6">
						<div className="text-center">
						{!hideName && (
						<div className="flex items-baseline justify-center gap-2 text-[20px] font-extrabold tracking-tight text-slate-900">
						<span className="truncate">
						{displayName(beamio)}
						</span>

						<span className="font-semibold text-[var(--beamio-brand,#2F78FF)]">
						@{beamio?.accountName}
						</span>
					</div>
						)}
						{/* 显示金额 */}
						{amount && (
							<div className="mt-3 text-[24px] font-bold text-slate-900">
								{currency}{amount}
							</div>
						)}
						</div>

						{/* QR Card */}
							<div className="mt-4 flex justify-center">
							<div className="relative isolate">
								{/* glow：强制放到最底层 */}
								<div
								aria-hidden
								className="
									absolute inset-[-12px]
									-z-10
									rounded-[36px]
									bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.18),rgba(132,120,255,0.05)_60%,transparent_75%)]
									blur-xl
									pointer-events-none
								"
								/>

								{/* QR 白底板：强制放到上层；过期时加模糊层 + 中央 "已过期" */}
								<div className="relative z-10 flex justify-center">
									<div
										className={cx(
											"relative rounded-[28px] bg-white p-[18px]",
											"shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]",
										)}
									>
										<QRCodeCanvas
											value={valueForQR}
											size={264}
											level="H"
											includeMargin={false}
											bgColor="white"
											fgColor="#000000"
											imageSettings={{
												src: BIZ_PUBLIC_LOGO512,
												height: 95,
												width: 95,
												excavate: true,
											}}
											className="block"
										/>
										{expired && (
											<div
												className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-white/10 backdrop-blur-md"
												aria-label="Voucher expired"
											>
												<span className="text-3xl font-bold tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.25)]">
													Expired
												</span>
											</div>
										)}
									</div>
								</div>
								
								{/* <div className="mt-6 text-center">
									<div className="mt-3 text-[18px] font-semibold text-slate-500">
										Scan to pay (Any amount)
									</div>
								</div> */}
								{/* <TaxSwitch value={isUSDC} onChange={setIsUSDC} taxRate={getBeamio?.tax ? Number(getBeamio.tax):0} /> */}
							</div>
							</div>

						{/* 数据模式：有效期倒计时和最大可使用金额 */}
						{isData && validBeforeSec != null && (
							<div className="mt-6 flex flex-col items-center gap-3">
								{/* 最大可使用金额 */}
								{/* {maxUsableAmount && (
									<div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 border border-blue-200">
										<span className="text-[15px] font-semibold text-blue-700">
											Max Amount: {maxUsableAmount} USDC
										</span>
									</div>
								)} */}
								{/* 有效期倒计时 */}
								<div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
									<Clock className="h-5 w-5 text-slate-600" />
									<span className="text-[15px] font-semibold text-slate-700">
										{secondsLeft > 0
											? `Valid for ${formatCountdown(secondsLeft)}`
											: "已过期"}
									</span>
								</div>
							</div>
						)}

						{/* Payment link / 文字内容：仅 URL 模式显示 */}
						{!isData && !hideUrl && (
						<div className="mt-10">
						<div className="rounded-[14px] bg-slate-50 ring-1 ring-black/10 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
							<div className="min-w-0 flex flex-col justify-center">
								<div className="text-[12px] leading-snug text-slate-700 break-all">
									{valueForQR}
								</div>
							</div>
							<button
								type="button"
								onClick={onCopyPayLink}
								className={[
									"shrink-0 w-[36px] h-[36px] rounded-[18px]",
									"bg-white/85 backdrop-blur-md",
									"ring-1 ring-black/10 shadow-sm",
									"flex items-center justify-center",
									"active:scale-[0.96] transition-transform duration-150",
									copied
										? "ring-[rgba(0,0,255,0.25)] shadow-[0_10px_24px_rgba(0,0,255,0.12)]"
										: "",
								].join(" ")}
								aria-label="Copy payment link"
								title={copied ? "已复制" : "复制"}
							>
								<span className="relative w-5 h-5 leading-none">
									<span
										className={[
											"absolute inset-0 flex items-center justify-center leading-none",
											"transition-all duration-200 ease-out",
											copied ? "opacity-0 scale-75" : "opacity-100 scale-100",
										].join(" ")}
										aria-hidden={copied}
									>
										<Copy className="w-5 h-5 text-slate-700 leading-none" />
									</span>
									<span
										className={[
											"absolute inset-0 flex items-center justify-center leading-none",
											"transition-all duration-200 ease-out",
											copied ? "opacity-100 scale-100" : "opacity-0 scale-75",
										].join(" ")}
										aria-hidden={!copied}
									>
										<Check className="w-5 h-5 text-[rgb(0_0_255)] leading-none" />
									</span>
								</span>
							</button>
						</div>
						</div>
						)}

						{/* Actions：仅 URL 模式显示 Print / Share */}
						{!isData && !hideActions && (
						<div className="mt-10 flex items-center justify-center gap-16">
							<button type="button" onClick={onPrint} className="group flex flex-col items-center">
								<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
									<Printer className="h-7 w-7 text-slate-600" />
								</div>
								<div className="mt-3 text-[18px] font-semibold text-slate-600">打印</div>
							</button>
							<button type="button" onClick={onShare} className="group flex flex-col items-center">
								<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
									<Share2 className="h-7 w-7 text-slate-600" />
								</div>
								<div className="mt-3 text-[18px] font-semibold text-slate-600">分享</div>
							</button>
						</div>
						)}

					</div>
					</div>
					</div>
					</div>
		</>

	)
}