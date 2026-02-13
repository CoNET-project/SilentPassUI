import { QRCodeCanvas } from 'qrcode.react'
import React, {useRef, useState, useEffect, useMemo} from "react"
import { Copy, ExternalLink, Check, Currency } from 'lucide-react'
import bIcon from '@/components/assets/32x32.svg'
import { X } from 'lucide-react'
import AmountCurrency from '@/components/input/AmountCurrency'
import FeeInline from './FeeInline'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { PaymentRequestCard } from '@/pages/chat/components/PaymentRequestCard'

type RedeemOrLinkCardProps = {
	payAmount: string                  // 金额（用于 Redeem 侧显示）
	note?: string                      // 备注
	successUrl: string                 // 支付链接 / 二维码内容
	onReset: () => void                // 关闭按钮（✕
	lockMode: PaymentLinkLockMode
	currency: ICurrency
	requestNet: string
	creatorEstUsdcFromFiat?: string
	/** 为 true 时表示本次成功是「Payment Request 已通过 message 送出」，只显示发送成功状态，不显示二维码/复制链接 */
	sentViaMessage?: boolean
	/** sentViaMessage 时卡片用的数字金额（与 message 中卡片格式一致） */
	paymentRequestAmount?: number
	/** sentViaMessage 时卡片显示的 wallet 标签，如 "Main Wallet • EOA" */
	paymentRequestWalletLabel?: string
}

const displayName = (item: beamio) => {
	const lastname = item?.lastName?.split('\r\n')||''
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.accountName
}

const SuccessShow = ({
	payAmount,
	note,
	successUrl,
	onReset,
	lockMode,
	requestNet,
	currency,
	creatorEstUsdcFromFiat,
	sentViaMessage = false,
	paymentRequestAmount = 0,
	paymentRequestWalletLabel = "Main Wallet • EOA"
}: RedeemOrLinkCardProps) => {
	
	const handleCopyLink = async () => {
		if (!successUrl) return

		try {
			await navigator.clipboard.writeText(successUrl)
			setCopied1(true)

			setTimeout(() => {
				setCopied1(false)
			}, 2000)
		} catch (e) {
			console.error('Failed to copy link', e)
		}
	}
	const [copied1, setCopied1] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles } = useDaemonContext()
	const [username, setusername] = useState('')

	useEffect(() => {
		if (!beamio) return
		setusername(`@${beamio.accountName}`)
		
	}, [beamio])

	return (
		<div
			className="
				relative
				px-4 py-4 
				flex-1 flex flex-col gap-4
			"
		>
			{/* Close button: top-right, only when not sentViaMessage */}
			{!sentViaMessage && (
				<div className="absolute -top-4 -right-4 z-30">
					<button
						type="button"
						onClick={onReset}
						className="
							w-9 h-9
							rounded-2xl
							flex items-center justify-center
							shadow-lg
							border border-white/40
							bg-white/20 dark:bg-slate-900/30
							backdrop-blur-md
							text-slate-700 dark:text-slate-100
							hover:bg-white/30 dark:hover:bg-slate-900/45
							transition
							"
						aria-label="Close"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			)}

			{sentViaMessage ? (
				<div className="flex flex-col items-center py-6 px-4">
					<h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
						Payment Request Sent
					</h2>
					<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
						Sent via chat. The recipient will see the Payment Request card in the conversation.
					</p>
					<PaymentRequestCard
						amount={paymentRequestAmount}
						currency={currency}
						title={note ?? ''}
						timeStamp={Date.now()}
						walletType={paymentRequestWalletLabel}
						requestUrl={successUrl}
						isMe
						className="mx-auto"
					/>
				</div>
			) : (
				<>
			{/* Cashcode area */}
			
				<>
					{/* Payment Link */}
					{/* Header row: Created date | Payment link | Status */}
					<div className="
						mb-1
						flex items-center justify-between
						text-[11px]
						text-slate-500 dark:text-slate-400
					">

						{/* 左边：创建时间 */}
						<div className="flex-1 text-left">
							{new Date().toLocaleString()}
						</div>

						{/* 中间：Payment link */}
						<div className="flex-1 text-center font-medium text-xl text-slate-600 dark:text-slate-300">
							Payment Link
						</div>

						{/* 右边：状态 */}
						<div className="flex-1 text-right">
							
							<span className="text-amber-600 dark:text-amber-400 font-medium">
								Pending
							</span>
							
						</div>
					</div>
					<div className="flex items-center justify-between">
						<div>
						<div className="text-xs text-slate-400">Requested</div>
						<div className="mt-1 text-lg font-semibold text-slate-900">
							{lockMode === 'FIAT_LOCKED' ? payAmount : `${creatorEstUsdcFromFiat} USDC` }
						</div>
						</div>
						{lockMode === "FIAT_LOCKED" ? (
							<div className="text-right">
								<div className="text-xs text-slate-400">Estimate</div>
								<div className="mt-1 text-sm font-semibold text-slate-600 tabular-nums">
									{creatorEstUsdcFromFiat ? creatorEstUsdcFromFiat : ''} USDC
								</div>
							</div>
							) : (
							<div className="text-right">
								<div className="text-xs text-slate-400">Status</div>
								<div className="mt-1 text-sm font-semibold text-slate-600">Fixed</div>
							</div>
						)}
					</div>

					{note && (
						<div
							className="
								mt-3 rounded-2xl
								bg-yellow-50/80 dark:bg-yellow-900/20
								border border-yellow-200/80 dark:border-yellow-800/40
								px-4 py-3
								text-yellow-900 dark:text-yellow-100
								space-y-1.5
							"
						>
							<div className="text-sm leading-snug whitespace-pre-wrap">
								{note}
							</div>
						</div>
					)}

				</>
			

				{/* QR area */}
				<div className="mt-4 flex flex-col items-center gap-2">
					<div className="border border-black/20 rounded-xl p-3 bg-white text-center qrCard">
						<div className="flex flex-col items-center gap-0.5 mt-0 pt-0 leading-tight">
							<span
								className="uppercase font-medium tracking-wider text-[11px]"
								style={{ color: '#c0c0c0ff' }}
							>
								{username}
							</span>
						</div>
						<QRCodeCanvas
							value={successUrl}
							size={160}
							level="H"
							includeMargin
							bgColor="transparent"
							fgColor="#000000"
							imageSettings={{
								src: bIcon,
								height: 40,
								width: 40,
								excavate: true,
							}}
							className="rounded-lg inline-block"
						/>

						<div className="flex flex-col items-center gap-0.5 mt-0 pt-0 leading-tight">
							<span
								className="uppercase font-medium tracking-wider text-[11px]"
								style={{ color: '#c0c0c0ff' }}
							>
								Amount
							</span>

							<span className="font-mono font-semibold text-[13px] text-black/60">
								{lockMode === 'FIAT_LOCKED' ? payAmount : `${creatorEstUsdcFromFiat} USDC` }
							</span>
						</div>
					</div>
				</div>
				<div
					className="
					rounded-xl 
					bg-white/80 dark:bg-slate-900/70 
					border border-slate-200/80 dark:border-slate-700 
					px-3 py-2 
					text-[11px] text-slate-600 dark:text-slate-300 
					leading-snug 
					flex items-start gap-2
					"
				>
					{/* 左侧 URL 文本 */}
					<div className="flex-1 break-all pr-1">
						{successUrl}
					</div>

					{/* 右侧竖排 icon 区域 */}
					<div className="flex flex-col items-center gap-1 ml-1 pt-0.5">
						{/* Copy icon button */}
						<button
							type="button"
							onClick={handleCopyLink}
							className="
							w-6 h-6 rounded-full
							flex items-center justify-center
							bg-slate-200/70 text-slate-700 
							dark:bg-slate-800/80 dark:text-slate-200
							hover:bg-slate-300/80 dark:hover:bg-slate-700
							transition
							"
							title="Copy link"
						>
							{copied1 ? (
									<Check className="w-4 h-4 text-green-500" />
								) : (
									<Copy className="w-4 h-4" />
								)}
						</button>
					</div>
					
				</div>
				<div className="mt-5">

					<FeeInline
						payUsdc={Number(creatorEstUsdcFromFiat)}
						currentCurrency={beamio?.currency||'USDC'}
					/>
				
				</div>
				</>
			)}
				
			</div>
		)
}

export default SuccessShow