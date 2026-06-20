import React from "react"
import { MoreHorizontal, DollarSign } from "lucide-react"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { tu } from '@/locale/beamioLocale'

type PaymentRequestCardProps = {
	amount: number
	currency: ICurrency
	title: string
	timeStamp: number
	walletType?: string
	requestUrl?: string
	/** 对方点击 Decline；发送方时为 Cancel */
	onDecline?: () => void
	/** 对方点击 Pay：可打开 requestUrl 或跳转支付 */
	onPay?: () => void
	onMore?: () => void
	className?: string
	isMe?: boolean
	/** 请求已被取消时隐藏按钮并显示 "This request has been cancelled." */
	cancelled?: boolean
}

function formatTimeLabel(ts: number): string {
	if (!ts) return ""
	const d = new Date(ts)
	const now = Date.now()
	const diff = now - ts
	if (diff < 60 * 1000) return tu('just_now')
	if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
	if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function PaymentRequestCard({
	amount,
	currency,
	title,
	timeStamp,
	walletType = "Main Wallet • EOA",
	requestUrl,
	onDecline,
	onPay,
	onMore,
	className = "",
	isMe = false,
	cancelled = false,
}: PaymentRequestCardProps) {
	const timeLabel = formatTimeLabel(timeStamp)
	const amountDisplay = `${fiatPrefix(currency)}${formatAmount(Number(amount), currency)}`

	return (
		<div
			className={[
				"inline-block w-[280px] max-w-full align-top text-left",
				"relative overflow-hidden rounded-2xl",
				"bg-white text-slate-900 ring-1 ring-black/5",
				"shadow-[0_6px_18px_rgba(2,6,23,0.10)]",
				className,
			].join(" ")}
		>
			<div className="p-4">
				{/* Header: icon + Payment Request + Just now */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
							<DollarSign className="w-4 h-4 text-slate-500" strokeWidth={2} />
						</div>
						<div>
							<div className="text-[13px] font-bold text-slate-900">Payment Request</div>
							<div className="text-[11px] text-slate-500 mt-0.5">{walletType}</div>
						</div>
					</div>
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[11px] text-slate-400">{timeLabel}</span>
						{onMore && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									onMore()
								}}
								className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
								aria-label="More"
							>
								<MoreHorizontal className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>

				{/* Amount + Title */}
				<div className="mt-4 text-center">
					<div className="text-[22px] font-bold text-slate-900">{amountDisplay}</div>
					{title && (
						<div className="mt-1 text-[13px] text-slate-500 flex items-center justify-center gap-1">
							<span>{title}</span>
						</div>
					)}
				</div>

				{/* Cancelled 状态或 Decline/Cancel + Pay 按钮 */}
				{cancelled ? (
					<div className="mt-4 py-3 text-center text-[13px] text-slate-500">
						This request has been cancelled.
					</div>
				) : (onDecline || onPay) && (
					<div className="mt-4 flex gap-3">
						{onDecline && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									onDecline()
								}}
								className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98]"
							>
								{isMe ? tu('cancel') : 'Decline'}
							</button>
						)}
						{onPay && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									onPay()
								}}
								className="flex-1 py-2.5 rounded-xl bg-[#1652f0] text-white text-sm font-semibold hover:bg-[#1346d4] active:scale-[0.98]"
							>{tu('pay')}</button>
						)}
					</div>
				)}

				{/* Footer: SECURED BY BEAMIO */}
				<div className="mt-4 flex items-center justify-between">
					<span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{tu('secured_by_beamio')}</span>
				</div>
			</div>
		</div>
	)
}
