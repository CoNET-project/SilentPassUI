import { QRCodeCanvas } from 'qrcode.react'
import { Copy, ExternalLink, Check } from 'lucide-react'
import bIcon from '@/components/assets/32x32.svg'
import { X } from 'lucide-react'
import {useState} from 'react'
import { HistoryFilter} from './HistoryFilterTabs'
import { ethers } from "ethers"
import {AppButton} from '@/components/button/AppButton'

const capitalize = (str: string) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
type Mode = "pay" | "request" | 'cashcode'
type RedeemOrLinkCardProps = {
	isPay: boolean                     // true = Redeem code 模式, false = Payment link 模式
	amt: number                        // 金额（用于 Redeem 侧显示）
	note?: string                      // 备注
	securityCode?: string       // 安全码
	successUrl: string                 // 支付链接 / 二维码内容
	tip: number                        // tip 金额
	redeemCode?: string                 // Redeem code 文本
	onReset: () => void                // 关闭按钮（✕
	type: HistoryFilter
	createdAt: number
	fee: number
	account: string
	hash: string
	mode: Mode
}

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
  if (!isFinite(base) || base <= 0) return 0;
  const raw = base * 0.008;
  const clamped = Math.min(Math.max(raw, 0.02), 2);
  return Number(clamped.toFixed(2));
}

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

export const RedeemOrLinkCard = ({
	isPay,
	amt,
	note,
	securityCode='',
	successUrl,
	tip,
	redeemCode = '',
	onReset,
	type,
	createdAt,
	fee,
	account,
	hash,
	mode
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


	const handleCopyCode = async () => {
			try {
				await navigator.clipboard.writeText(redeemCode)
				setCopied(true)

				setTimeout(() => {
				setCopied(false)
				}, 2000)
			} catch (e) {
				console.error('Copy failed:', e)
			}
	}

  const handleOpenLink = () => {
    if (!successUrl) return
    window.open(successUrl, '_blank')
  }
    const requestGross = amt + tip; // payer will pay
	
	const displayGeneratedAmount = isPay ? amt : requestGross;
	
	
	const [copied, setCopied] = useState(false)
	const [copied1, setCopied1] = useState(false)

	function CopyLinkButton({ appUrl }: { appUrl: string }) {
		const [copied, setCopied] = useState(false)

		const handleCopy = async () => {
			try {
			await navigator.clipboard.writeText(appUrl)
			setCopied(true)

			// 2 秒后恢复
			setTimeout(() => setCopied(false), 2000)
			} catch (e) {
			console.error("Copy failed", e)
			}
		}

		return (
			 <button
				type="button"
				onClick={handleCopy}
				className="
					inline-flex items-center justify-center
					h-7 w-7 rounded-md border border-slate-200 
					text-slate-700 shrink-0
					active:scale-95 transition-transform
				"
				>
				{copied ? (
					<Check className="w-4 h-4 text-green-500" />
				) : (
					<Copy className="w-4 h-4 text-slate-600" />
				)}
			</button>
		)
	}
	
  return (
	<div
		className="
			relative
			rounded-3xl 
			
			border border-slate-200/80 dark:border-slate-700/80 
			px-4 py-4 
			flex-1 flex flex-col gap-4
		"
	>
		{/* Close button: top-right, iOS frosted style */}
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

		{/* cashcode */}
		{isPay ? (
			<>
			{/* Header row: Created date | Payment link | Status */}
				<div className="
					mb-1
					flex items-center justify-between
					text-[11px]
					text-slate-500 dark:text-slate-400
				">

					{/* 左边：创建时间 */}
					<div className="flex-1 text-left">
						{new Date(createdAt).toLocaleString()}
					</div>

					{/* 中间：Payment link */}
					<div className="flex-1 text-center font-medium text-xl text-slate-600 dark:text-slate-300">
						Cashcode
					</div>

					{/* 右边：状态 */}
					<div className="flex-1 text-right">
						{type !== 'pending' ? (
						<span className="text-green-600 dark:text-green-400 font-medium">
							{capitalize(type)}
						</span>
						) : (
						<span className="text-amber-600 dark:text-amber-400 font-medium">
							{capitalize(type)}
						</span>
						)}
					</div>
				</div>
				<div
					className="
						rounded-xl 
						bg-white/70 dark:bg-slate-900/70 
						border border-slate-200/80 dark:border-slate-700
						px-3 py-2
						text-xs font-mono
						text-slate-800 dark:text-slate-100
						space-y-2
					"
					>
						{/**		When pending show cashcode information */}
						{
							type ==='pending' && (
								<>
									{/* 第一行：Redeem code + Copy */}
									<div className="flex items-center gap-1 min-w-0">
										{/* 标题 */}
										<span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
											Redeem code:
										</span>

										{/* redeemCode + Copy 按钮并排 */}
										<div className="flex items-center gap-1 min-w-0">
											<span className="truncate text-xs text-slate-800 dark:text-slate-100">
											{redeemCode}
											</span>

											{/* Copy icon 按钮 */}
											<button
												type="button"
												onClick={handleCopyCode}
												className="
													shrink-0
													text-sky-600 dark:text-sky-400
													hover:text-sky-700 dark:hover:text-sky-300
													active:scale-90
													transition-all duration-150
												"
											>
											{copied ? (
												<Check className="w-4 h-4 text-green-500" />
											) : (
												<Copy className="w-4 h-4" />
											)}
											</button>
										</div>
									</div>
									{/* 第二行：Security code */}
									<div className="flex items-center gap-1 min-w-0">
										<span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
											Security code:
										</span>

										<span className="truncate text-xs text-slate-800 dark:text-slate-100">
											{securityCode ? securityCode : 'Not set'}
										</span>
									</div>
								</>
							)
						}
					

				

					{/* 第三行：Notes */}
					{note && (
						<div className="flex items-center gap-1 min-w-0">
							<span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
								Notes:
							</span>

							<span className="truncate text-xs text-slate-800 dark:text-slate-100">
								{note}
							</span>
						</div>
					)}
				</div>
				{
					type === 'deposited' ? (
						<>
							<div
								className="
									mt-2 rounded-2xl 
									bg-white/80 dark:bg-slate-900/70 
									border border-slate-200/80 dark:border-slate-700 
									px-4 py-3
								"
								>
								<div className="flex items-center justify-between">
									{/* 左侧 label */}
									<span className="text-xs font-medium text-slate-500 dark:text-slate-400">
										Amount deposited
									</span>

									{/* 右侧 — 保留你的布局与样式 */}
									<span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
										{formatMoney(amt)} USDC
									</span>
								</div>
							</div>
						</>
					) : (
						<>
						 <section className="px-5 pb-4">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] space-y-2">
							<div className="flex items-baseline justify-between">
								<span className="text-xs text-slate-500">They received</span>
								<span className="text-xl font-semibold text-slate-900">
								{formatMoney(amt - calcFeeFromNumber(amt))} USDC
								</span>
							</div>

							<div className="pt-2 mt-1 border-t border-slate-200 space-y-1 text-[11px]">
								<div className="flex items-center justify-between">
								<span className="text-slate-500">Beamio service fee (0.8%)</span>
								<span className="font-medium text-slate-900">{formatMoney(calcFeeFromNumber(amt))} USDC</span>
								</div>
								<div className="flex items-center justify-between">
								<span className="text-slate-500">Locked from your wallet</span>
								<span className="font-semibold text-slate-900">{formatMoney(amt)} USDC</span>
								</div>
							</div>
							</div>
						</section>
						</>
					)
				}
				

			

			
			</>
		) : (
			<>
				{/**		Payment Link  */}
				{/* Header row: Created date | Payment link | Status */}
				<div className="
					mb-1
					flex items-center justify-between
					text-[11px]
					text-slate-500 dark:text-slate-400
				">

					{/* 左边：创建时间 */}
					<div className="flex-1 text-left">
						{new Date(createdAt).toLocaleString()}
					</div>

					{/* 中间：Payment link */}
					<div className="flex-1 text-center font-medium text-xl text-slate-600 dark:text-slate-300">
						Payment link
					</div>

					{/* 右边：状态 */}
					<div className="flex-1 text-right">
						{type !== 'pending' ? (
							<span className="text-green-600 dark:text-green-400 font-medium">
								{capitalize(type)}
							</span>
							) : (
							<span className="text-amber-600 dark:text-amber-400 font-medium">
								{capitalize(type)}
							</span>
						)}
					</div>
				</div>

			{note && (
				<section className="mb-3">
					<span className="block text-[11px] font-medium text-slate-600 mb-1">
						Notes
					</span>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900">
						{note}
				</div>
				</section>
			)}

			
				
					
			{/* Payer info */}
			{
				type !== 'pending' && (
					<section className="mb-3">
						<span className="block text-[11px] font-medium text-slate-600 mb-1">
							{ type === 'completed' ? 'Paid by' : 'Paid to'}	
						</span>
						<div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-2">
							<span className="text-[13px] font-mono text-slate-800">
								{fmtAddr(account)}
							</span>
							<CopyLinkButton appUrl={account} />
						</div>
					</section>

				)
			}
				

			{/* Amount summary */}
				<section className="mb-3">
					<div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[11px] space-y-1">
						<div className="flex items-center justify-between">
						<span className="text-slate-500">{ type === 'paid' ? 'You paid' : type ==='completed'?  'Payer paid' : 'Payer will pay' } </span>
						<span className="font-semibold text-slate-900">{formatMoney(type === 'paid' ? amt: amt + fee )} USDC</span>
						</div>
						{
							type !== 'paid' && (
								<>
									<div className="flex items-center justify-between">
										<span className="text-slate-500">{type === 'pending' ? 'You will receive' : 'You received' }</span>
										<span className="font-semibold text-slate-900">{formatMoney(amt)} USDC</span>
									</div>
									<div className="flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
										<span className="text-slate-500">Beamio service fee (0.8%)</span>
										<span className="font-medium text-slate-900">{formatMoney(fee)} USDC</span>
									</div>
								</>
							)
						}
						
					</div>
				</section>
					
					
				
			
			
			</>
		)}

			{/* QR area */}
			{ type === 'pending' && (
				<>
					<div className="mt-4 flex flex-col items-center gap-2">
						<div className="border border-black/20 rounded-xl p-3 bg-white text-center qrCard">
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

							<div className="flex justify-center items-center gap-1 text-[13px] mt-0 pt-0 leading-none">
								<span
								className="uppercase font-medium tracking-wider text-xs"
								style={{ color: '#c0c0c0ff' }}
								>
									Amount
								</span>
								<span className="font-mono text-black/50 font-semibold text-xs">
									{formatMoney(amt+ fee)} USDC
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

						{/* Open icon button */}
						{/* <button
							type="button"
							onClick={handleOpenLink}
							className="
							w-6 h-6 rounded-full
							flex items-center justify-center
							bg-slate-200/70 text-slate-700 
							dark:bg-slate-800/80 dark:text-slate-200
							hover:bg-slate-300/80 dark:hover:bg-slate-700
							transition
							"
							title="Open link"
						>
							<ExternalLink className="w-3.5 h-3.5" />
						</button> */}

						
						</div>
						
					</div>
				</>
				
			)}
			
			{

				<p className='text-[11px] text-slate-600 dark:text-slate-300'>
					{
						type === 'paid' ? (
							<>
								You paid the full “You paid” amount shown above.
								There is no extra Beamio service fee for you.
								Any Beamio fee is taken from the amount the recipient receives.
								Beamio also pays the network fee on Base, so this payment was gasless for you.
							</>
						) : type === 'deposited' ? (
							<>
								The sender paid the Beamio service fee when they created this Cashcode.
								You received the full amount shown above into your wallet.
								Beamio fee is 0.8% of the Cashcode amount (min 0.02, max 2.00 USDC), paid by the sender.
								Direct Send / Receive has 0% Beamio fee.
							</>
						) : mode === 'cashcode' ? type === 'completed' ? 
								(
									<>
										This Cashcode has been redeemed. The smart contract released {formatMoney(amt-calcFeeFromNumber(amt))} USDC to the recipient's wallet and {calcFeeFromNumber(amt)} USDC to Beamio as the service fee.
										You paid the Beamio service fee when creating this Cashcode. The recipient received the full amount you set. 
										Beamio fee is 0.8% of the Cashcode amount (min 0.02, max 2.00 USDC). Direct Send / Receive has 0% Beamio fee.
									</>
								) : type === 'pending' ?  (
									<>
										This Cashcode hasn't been redeemed yet. Share the redeem code (and Security code if you set one) with the person who should receive it.
										You pay the Beamio service fee. The recipient will receive the full {formatMoney(amt-calcFeeFromNumber(amt))} USDC when they redeem this Cashcode. 
										Beamio fee is 0.8% of the amount (min 0.02, max 2.00 USDC). Direct Send / Receive has 0% Beamio fee.
									</>
								) : (<>
									The payer covers the Beamio fee. You always receive the full "You will receive" amount you entered when creating this Payment Link.
									Beamio fee is 0.8% of the payment amount and is capped at 2.00 USDC per Payment Link. Direct Send / Receive has 0% Beamio fee.
								</>) :
						(
							<>
								The payer covers the Beamio fee. You always receive the full "You will receive" amount you entered when creating this Payment Link.
								Beamio fee is 0.8% of the payment amount and is capped at 2.00 USDC per Payment Link. Direct Send / Receive has 0% Beamio fee.
							</>
						)
					}

				</p>

				
			}
			

			{
				type !== 'pending' && (
					<AppButton
						fullWidth
						variant='secondary'
						onClick={() => {
							window.open(`https://basescan.org/tx/${hash}`, '_blank', 'noopener,noreferrer')
						}}
					>
						View on explorer
					</AppButton>
				)
			}
		</div>
	)
}
