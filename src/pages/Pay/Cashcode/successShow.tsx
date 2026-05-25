import { QRCodeCanvas } from 'qrcode.react'
import React, {useRef, useState, useEffect, useMemo} from "react"
import { Copy, ExternalLink, Check, Lock, Unlock } from 'lucide-react'
import bIcon from '@/components/assets/logo512.png'
import { X } from 'lucide-react'
import { useDaemonContext } from "@/providers/DaemonProvider"
import base_ex from '@/components/assets/base-ex.svg'
import IOSBounceCloseButton from '@/components/button/CloseButton'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
type RedeemOrLinkCardProps = {
	valueUSDCAmount: string                  // 金额（用于 Redeem 侧显示）
	valueCurrencyAmount: string
	note?: string                      // 备注
	successUrl: string                 // 支付链接 / 二维码内容
	onReset: () => void                // 关闭按钮（✕
	lockMode: PaymentLinkLockMode
	security: boolean
	successHash: string
	linkTitle?: string
}

const displayName = (item: beamio) => {
	const lastname = item?.lastName?.split('\r\n')||''
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.accountName
}

const SuccessShow = ({
	valueUSDCAmount,
	note,
	successUrl,
	onReset,
	lockMode,
	security,
	successHash,
	linkTitle

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
	const { beamio } = useDaemonContext()
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
			
			
				<>
					
					{/* Header row: Created date | Cashcode | Status */}
					<div className="
						mb-1
						flex items-center justify-between
						text-[11px]
						text-slate-500 dark:text-slate-400
					">

						{/* 左边：创建时间 */}
						<div className="flex-1 text-left">
							
						</div>

						{/* 中间：Payment link */}
						<div className="flex-1 text-center font-medium text-xl text-slate-600 dark:text-slate-300">
							Cashcode
						</div>

						{/* 右边：状态 */}
						<div className="flex-1 text-right">
							
							<span className="text-amber-600 dark:text-amber-400 font-medium">
								Active
							</span>
							
						</div>
					</div>
					<div className="flex items-center justify-between">
						<div>
						<div className="text-xs text-slate-400">Value</div>
							<div className="mt-1 text-lg font-semibold text-slate-900">
								{Number(valueUSDCAmount).toFixed(4)} USDC
							</div>
						</div>
						{lockMode === "FIAT_LOCKED" ? (
							<div className="text-right">
								<div className="text-xs text-slate-400">Security</div>
								<div className="mt-1 text-sm font-semibold text-slate-600 tabular-nums">
									<div className="mt-1 text-sm font-semibold tabular-nums">
									{security ? (
										<span className="inline-flex items-center gap-1 text-rose-500">
										<Lock className="w-4 h-4" />
											on
										</span>
									) : (
										<span className="inline-flex items-center gap-1 text-slate-400">
										<Unlock className="w-4 h-4" />
											off
										</span>
									)}
									</div>
								</div>
							</div>
							) : (
							<div className="text-right">
								<div className="text-xs text-slate-400">Status</div>
								<div className="mt-1 text-sm font-semibold text-slate-600">Fixed</div>
							</div>
						)}
					</div>
					{linkTitle && (
						<div className="text-lg font-semibold">
							{linkTitle}
						</div>
					)}

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
					
						<div className="flex flex-col items-center gap-0.5 mt-0 pt-0 leading-tight">
							<span
								className="uppercase font-medium tracking-wider text-[11px]"
								style={{ color: '#c0c0c0ff' }}
							>
								{username}
							</span>
						</div>
						<div
										className="
										rounded-[28px]
										bg-white
										p-[18px]
										shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
										"
									>
						<QRCodeCanvas
							value={successUrl}
							size={220}
							level="H"
							includeMargin
							bgColor="transparent"
							fgColor="#000000"
							imageSettings={{
								src: bIcon,
								height: 80,
								width: 80,
								excavate: true,
							}}
							className="rounded-lg inline-block"
						/>
						</div>

						<div className="flex flex-col items-center gap-0.5 mt-0 pt-0 leading-tight">
							<span
								className="uppercase font-medium tracking-wider text-[11px]"
								style={{ color: '#c0c0c0ff' }}
							>
								Amount
							</span>

							<span className="font-mono font-semibold text-[13px] text-black/60">
								{Number(valueUSDCAmount).toFixed(4)} USDC
							</span>
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
						openExternalUrl(`https://basescan.org/tx/${successHash}`)
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
		)
}

export default SuccessShow