import React from "react"
import { MoreHorizontal, Sparkles, Infinity, FileText } from "lucide-react"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { searchUsername, storeSystemData } from "@/services/beamio"
import { useNavigate } from "react-router-dom"
import { openExternalUrl } from "@/utils/cashTreesNativeNfc"
import { tu } from '@/locale/beamioLocale'

type MessageSendReceiveCardProps = {
	variant: "sent" | "received" | "cashcode" | "membershipActivated"
	status?: "Completed" | "待处理" | "Failed" | string
	amount: number
	title: string
	timeLabel?: string
	onMenu?: () => void
	className?: string
	currency: ICurrency
	usdcAmount: number
	note?: string
	cashcodeUrl: string
	/** 仅 membershipActivated：状态胶囊文案，如 "Confirmed on-chain" */
	statusLabel?: string
	/** 仅 membershipActivated：点击「View Invoice」回调 */
	onViewInvoice?: () => void
}

export function MessageSendReceiveCard({
	variant,
	status = "Completed",
	amount,
	currency,
	title = "",
	usdcAmount,
	timeLabel,
	note,
	cashcodeUrl,
	onMenu,
	className = "",
	statusLabel = "Confirmed on-chain",
	onViewInvoice,
}: MessageSendReceiveCardProps) {
	
	const isSent = variant === "sent"
	const isCashcodeCard = !!cashcodeUrl
	const isMembershipActivated = variant === "membershipActivated"
	const navigate = useNavigate()
	const sign = isCashcodeCard ? "" : isSent ? "-" : "+"
	const displayCurrency: ICurrency = isCashcodeCard ? "USDC" : currency
	const displayAmount = isCashcodeCard
		? (typeof amount === "number" && isFinite(amount) && amount > 0 ? amount : usdcAmount)
		: amount

	const openCashcode = () => {
		if (!cashcodeUrl) return
		openExternalUrl(cashcodeUrl)
	}
	const { setSecureCode, setRedeemCode } = useDaemonContext()


	const checkUrl = async (url: string) => {
		let searchParams: URLSearchParams
		try {
		  const u = new URL(url)
		  searchParams = u.searchParams
		} catch {
		  searchParams = new URLSearchParams(url)
		}
	

		const _secureCode =
		  searchParams.get("secureCode") || searchParams.get("securecode") || ""
		const cashcode = searchParams.get("cashcode") || ""

	

	
	
		if (_secureCode) {
	
			setSecureCode (_secureCode)
			setRedeemCode(cashcode)
			navigate('/History')
			return
		  
		}
	
		
	  }

	// ===================== CASHCODE 卡片（仅由 cashcodeUrl 决定） =====================
	if (isCashcodeCard) {
		return (
			<button
				type="button"
				onClick={() => {
					checkUrl(cashcodeUrl)
				}}
				className={[
					"inline-block w-[220px] max-w-full align-top text-left",
					"relative overflow-hidden rounded-[22px]",
					"bg-[#F5F2FF] text-slate-900 ring-1 ring-black/5",
					"shadow-[0_6px_18px_rgba(2,6,23,0.10)]",
					"active:scale-[0.99] transition",
					className
				].join(" ")}
				aria-label="Open cashcode"
			>
				<div className="p-4">
					{/* header */}
					<div className="flex items-start justify-between">
						<div className="min-w-0">
							<div className="text-[11px] font-extrabold tracking-[0.12em] uppercase leading-none text-[#8B5CF6]">
								CASHCODE
							</div>
						</div>

						<button
							type="button"
							aria-label="More"
							onClick={(e) => {
								checkUrl(cashcodeUrl)
							}}
							className={[
								"h-7 w-7 rounded-full grid place-items-center",
								"transition active:scale-[0.96]",
								"bg-white/70 hover:bg-white/85 ring-1 ring-black/5"
							].join(" ")}
						>
							<MoreHorizontal className="h-4 w-4 text-slate-500" />
						</button>
					</div>

					{/* amount */}
					<div className="mt-3 flex w-full items-end gap-2">
						<span className="tabular-nums text-[34px] font-extrabold leading-none tracking-[0.02em] text-[#7C3AED]">
						{formatAmount(Number(displayAmount), currency)}
						</span>
						<span className="pb-[3px] text-[13px] font-semibold text-slate-500">
							{fiatPrefix(currency)}
						</span>
					</div>

					{/* title */}
					{!!title && (
						<div
							title={title}
							className="mt-2 text-[13px] font-semibold text-slate-500 truncate"
						>
							{title}
						</div>
					)}

					{!!note && (
						<div className="mt-1 text-[11px] leading-[14px] text-slate-400 truncate">
							{note}
						</div>
					)}

					{/* status + time */}
					<div className="mt-4 flex items-center justify-between">
						<div className="flex items-center gap-2 min-w-0">
							<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5CF6] text-white">
								<Sparkles className="h-3.5 w-3.5" />
							</span>
							<span className="text-[12px] font-medium text-slate-500 truncate">
								{status}
							</span>
						</div>

						{!!timeLabel && (
							<span className="text-[12px] font-semibold text-slate-400">
								{timeLabel}
							</span>
						)}
					</div>
				</div>

				<div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.10)]" />
				<div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/35 blur-2xl" />
			</button>
		)
	}

	// ===================== Membership Activated 卡片（Chat 内固定格式） =====================
	if (isMembershipActivated) {
		const amountText = `+${fiatPrefix(currency)}${formatAmount(Number(amount), currency)}`
		return (
			<div
				className={[
					"inline-block w-[260px] max-w-full align-top text-left",
					"relative overflow-hidden rounded-2xl",
					"bg-white text-slate-900 ring-1 ring-black/5",
					"shadow-[0_6px_18px_rgba(2,6,23,0.10)]",
					className
				].join(" ")}
			>
				<div className="p-4">
					{/* Header: 图标 + 标题 + 时间 */}
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3 min-w-0">
							<div className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
								<Infinity className="w-3 h-3 text-emerald-600" strokeWidth={2.5} />
							</div>
							<span className="text-[10px] font-bold text-slate-900 truncate">
								{title || "Membership Activated"}
							</span>
						</div>
						{timeLabel && (
							<span className="shrink-0 text-[10px] text-slate-400">
								{timeLabel}
							</span>
						)}
					</div>

					{/* 金额：大号绿色，左右居中 */}
					<div className="mt-4 tabular-nums text-[20px] font-bold leading-none text-emerald-600 text-center">
						{amountText}
					</div>

					{/* 状态胶囊，左右居中 */}
					<div className="mt-2 flex justify-center">
						<span className="inline-flex items-center px-3 py-1 rounded-full text-[8px] font-semibold bg-emerald-500/80 text-white">
							{statusLabel}
						</span>
					</div>

					{/* View Invoice 按钮 */}
					<button
						type="button"
						onClick={() => onViewInvoice?.()}
						className={[
							"mt-4 w-full flex items-center justify-center gap-2",
							"py-2.5 rounded-xl text-[10px] font-semibold text-slate-700",
							"bg-slate-100 hover:bg-slate-200/90 active:scale-[0.99] transition"
						].join(" ")}
					>
						<FileText className="w-4 h-4 shrink-0" strokeWidth={2} />
							View Invoice
					</button>
				</div>
			</div>
		)
	}

	// ===================== 默认 sent/received 卡片 =====================
	return (
		<div
			className={[
				"inline-block w-[220px] max-w-full align-top",
				"relative overflow-hidden rounded-[22px]",
				"shadow-[0_6px_18px_rgba(2,6,23,0.12)]",
				isSent
					? "bg-white text-slate-900 ring-1 ring-black/5"
					: "bg-[#F3F7FF] text-slate-900 ring-1 ring-[#2F63FF]/20",
				className
			].join(" ")}
		>
			<div className="p-4">
				<div className="flex items-start justify-between">
					<div className="min-w-0">
						<div
							className={[
								"text-[11px] font-extrabold tracking-[0.05em] uppercase leading-none",
								isSent ? "text-slate-400" : "text-[#2F63FF]"
							].join(" ")}
						>
							{`Payment ${variant}`}
						</div>
					</div>

					<button
						type="button"
						aria-label="More"
						onClick={onMenu}
						className={[
							"h-7 w-7 rounded-full grid place-items-center",
							"transition active:scale-[0.96]",
							isSent
								? "bg-slate-100 hover:bg-slate-200"
								: "bg-white/70 hover:bg-white/85 ring-1 ring-[#2F63FF]/15"
						].join(" ")}
					>
						<MoreHorizontal className="h-4 w-4 text-slate-500" />
					</button>
				</div>

				<div className="mt-3 flex w-full items-end gap-1">
					<span
						className={[
							"tabular-nums text-[30px] font-extrabold leading-none tracking-[0.06em]",
							isSent ? "text-slate-900" : "text-[#2F63FF]"
						].join(" ")}
					>
						{sign}
						{formatAmount(Number(displayAmount), displayCurrency)}
					</span>

					{displayCurrency !== "USDC" && (
						<span className="pb-[2px] text-[12px] font-semibold text-slate-400">
							{fiatPrefix(displayCurrency)}
						</span>
					)}
				</div>

				<div className="min-w-0">
					{!!title && (
						<div
							title={title}
							className="mt-2 text-[14px] font-semibold text-slate-500 truncate"
						>
							{title}
						</div>
					)}
					{!!note && (
						<div className="mt-1 text-[11px] leading-[14px] text-slate-400 truncate">
							{note}
						</div>
					)}
				</div>

				<div className="mt-4 flex items-center gap-2">
					<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[12px] font-bold leading-none">
						✓
					</span>
					<span className="text-[12px] font-medium text-slate-500">
						{status}
					</span>

					{!!timeLabel && (
						<span className="ml-auto text-[12px] font-semibold text-slate-400">
							{timeLabel}
						</span>
					)}
				</div>
			</div>

			{!isSent && (
				<div className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_rgba(47,99,255,0.10)]" />
			)}
		</div>
	)
}
