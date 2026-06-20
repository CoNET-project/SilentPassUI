import { IpfsImg } from '@/components/IpfsImg';
import { useMemo, useState, useEffect } from 'react'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import VscodeJsonBlock from '@/components/VscodeJsonBlock'
import base_ex from '@/components/assets/base-ex.svg'
import { CoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import base_ex_dark from '@/components/assets/base-ex-dark.svg'
import {ethers} from 'ethers'
import styles from './send.module.scss'
import { tu } from '@/locale/beamioLocale'

type ShowSignInfoProps = {
	originUrl: string                             
	messageData: any                // 展开时展示的 Message data 内容
	processing: boolean                         // 处理中时禁用按钮
	processError: string
}

const fmtAddr = (a?: string) =>
  !a ? '' : `${a.slice(0, 6)}…${a.slice(-4)}`

const fmtAmount = (n?: number) => {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  const s = Math.abs(n).toFixed(2) // 始终两位小数
  return (n < 0 ? '-' : '') + s
}

export function ConformSignInfo({
	originUrl,
	messageData,
	processing,
	processError

}: ShowSignInfoProps) {
 	const [openMsg, setOpenMsg] = useState(false)
	const [address, setAddress] = useState('')
	const { darkModle } = useDaemonContext()
	const amount = ethers.formatUnits(messageData?.maxAmountRequired, 6)
	const assetLine = useMemo(() => {
		const amt = fmtAmount(Number(amount))
		return `${amt} USDC`
	}, [amount])

	const recipientLine = useMemo(() => {
		const amt = Number(amount)
		const net = Number(messageData.Beamiofee)
		return `${fmtAmount(amt - net)} USDC`
	}, [amount])

	const init = () => {
		const temp = CoNET_Data?.profiles?.[0]
		if (!temp) return
		setAddress(temp.keyID)
	}
		useEffect(() => {
			init()
		}, [])

    return (
    // 根节点：不设颜色，继承外层（系统）颜色
    <div>
      {/* Header */}
      {/* <div className="px-5 pt-1 mb-2">
        
        <h2 className="text-xl font-semibold font-bold text-center">
          Beamio
        </h2>
      </div> */}

     	<div className="flex-1 px-6 pt-8 pb-12 overflow-auto">
			<h4 className="text-lg font-semibold text-center">
				{messageData?.sginTatle} Signature
			</h4>

        	{/* Signing with ... */}
	
			<div className="max-w-2xl mx-auto space-y-6 text-sm mt-6">
				<section className="border-b border-slate-200 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-0.5">
							<span className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
								Signing with
							</span>
							<span className="text-sm font-medium text-slate-900">
								Your Beamio wallet
							</span>
							<span className="text-[11px] text-slate-500">
								Request from https://beamio.app
							</span>
						</div>
						<div className="flex flex-col items-end gap-0.5 text-xs text-slate-600">
							<span className="font-mono text-sm text-slate-800">{fmtAddr(address)}</span>
							<span className="text-[11px] text-slate-500">Your address</span>
						</div>
					</div>
				</section>
     

				{/* Review / From host */}
				<section className="space-y-2">
					<div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
						You will pay
					</div>

					{/* 文字 + 图标 同一行 */}
					<div className="flex items-center justify-between">
						<div className="text-2xl font-semibold text-slate-900">
							{assetLine}
						</div>

						{/* USDC + Base icon */}
						<div className="relative w-9 h-9 rounded-full border border-slate-200 dark:border-white/10 grid place-items-center">
						<IpfsImg
							src={usdcIcon}
							alt="USDC"
							className="w-7 h-7"
						/>
						<IpfsImg
							src={baseIcon}
							alt="Base"
							className="
							absolute
							w-4 h-4
							bottom-[-2px] right-[-2px]
							rounded-full
							border border-white
							dark:border-black
							"
						/>
						</div>
					</div>
				</section>

			    {/* Note for the recipient (read-only preview) */}
				{/* <section className="space-y-1">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
							Note for the recipient
						</span>
						
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800">
						{messageData?.note}
					</div>
				</section> */}

			</div>
		</div>

      {/* Pay to */}
		<div className="px-5 py-4 border-t border-slate-200 dark:border-white/10">
			<div className="text-sm flex items-center justify-between opacity-80 w-full">

				{/* 左侧：Pay to */}
				<div className="font-semibold">
					{messageData?.payToTitle || '付款给'}
				</div>

				{/* 右侧：地址 + icon */}
				<div className="flex items-center gap-2">
					<span className="font-mono">
						{fmtAddr(messageData?.showPayToAddress || messageData?.payTo)}
					</span>

					<a
						href={`https://basescan.org/address/${messageData?.showPayToAddress || messageData?.payTo}`}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
						aria-label="在 BaseScan 查看"
						title="在 BaseScan 查看"
					>
						<IpfsImg
							src={darkModle ? base_ex_dark : base_ex}
							alt=""
							className="w-4 h-4"
						/>
						<span className="sr-only">在 BaseScan 查看</span>
					</a>
				</div>

			</div>
		</div>
		<div className="px-5 py-4 border-t border-slate-200 dark:border-white/10 space-y-3">
			{
				!messageData?.Beamiofee && <>
					<div className="flex items-start justify-between w-full text-sm opacity-80">
					
						{/* 左边：Network fee */}
						<div className="font-semibold">
							Network fee
						</div>

						{/* 右边：分上下两行 */}
						<div className="flex flex-col items-end">
						
							{/* 上：USD + ETH */}
							<div className="flex items-center gap-2">
								<span
								className="
									text-red-400/70 dark:text-red-300/70
									line-through 
									decoration-[1px] font-bold
								"
								>
								USD$ {messageData?.gas?.gasUSD}
								</span>

								<span
								className="
									text-red-400/70 dark:text-red-300/70
									line-through 
									decoration-[1px] font-bold
								"
								>
								{messageData?.gas?.gasETH} ETH
								</span>
							</div>

							{/* 下：Paid by Beamio */}
							<div className="text-emerald-500 dark:text-emerald-400 mt-0.5">
								Paid by Beamio
							</div>
						</div>
					</div>
				</>
			}
			
			{
				messageData?.Beamiofee &&
					<div className="flex justify-between w-full text-sm opacity-80">
						{/* 左侧：Beamio fee */}
						<div className="font-semibold">
							Beamio fee
						</div>

						{/* 右侧：费用 + 说明 */}
						<div className="flex flex-col items-end text-xs">
							<span className="text-slate-800 text-sm font-semibold">
								{messageData.Beamiofee} USDC
							</span>
							{/* <span className="text-slate-500">
								Includes all on-chain costs for this Cashcode.
							</span> */}
						</div>
					</div>
			}
			

		</div>

      {/* Message data (collapsible) */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10">
			<button
				type="button"
				onClick={() => setOpenMsg(v => !v)}
				className="w-full flex items-center justify-between text-left"
			>
				<span className="font-semibold">
					Message data
				</span>
				<span className="opacity-60">
					{openMsg ? '▾' : '▸'}
				</span>
			</button>

        {openMsg && (
          <div className="mt-3 text-sm opacity-80 break-words">
            {messageData ? (
				<VscodeJsonBlock data={messageData} />
            ) : (
				<div className="italic opacity-70">
					Show the raw payload or a summary to be signed here
				</div>
            )}
          </div>
        )}
      </div>

      	{/* Disclaimer */}
		{
			/cashcode/i.test(messageData.sginTatle) ? 
				
				<p className="px-5 py-4 text-sm opacity-70 border-t space-y-3 border-slate-200 dark:border-white/10">
					<p>
						You are authorizing the Beamio Cashcode smart contract (non-custodial, with no admin access) to lock 
						<span className="text-slate-800 text-sm font-semibold"> {assetLine} </span>for this Cashcode.
					</p>
					<p>
						When the recipient redeems, 
						<span className="text-slate-800 text-sm font-semibold"> {recipientLine} </span> 
						will be released from the contract to their wallet.
					</p>
					<p>
						Beamio collects the service fee from the contract and cannot move any other funds.
					</p>
					<p>
						The person redeeming this Cashcode does not see your full wallet history, and your wallet address is not shown to them inside the redeem flow.
					</p>
					
					

					
				</p>
				
			 : 
				<div className="px-5 py-4 text-sm opacity-70 border-t border-slate-200 dark:border-white/10">
					By signing this request, you allow Beamio to use your wallet to create a USDC transfer on Base.<br />
					Those changes may not occur immediately. Beamio pays the network fee, so you will not pay gas for this payment.
				</div>
			

		}
		

      {/* Footer buttons */}
		<div
			className={`
				px-5 pb-5 pt-6
				grid gap-3 mb-12
				border-t border-slate-200 dark:border-white/10
				${processing ? 'grid-cols-1' : 'grid-cols-2'}
			`}
		>
			{/* Cancel：只在非 processing 的时候显示 */}
			{!processing && (
				<button
					type="button"
					onClick={() => {
						window.dispatchEvent(
						new CustomEvent('sign:final', { detail: { action: 'cancel' } })
						)
					}}
					className={`
						h-11 rounded-2xl border border-slate-300 dark:border-white/20
						transition
						hover:bg-slate-100 dark:hover:bg-white/10
					`}
				>{tu('cancel')}</button>
			)}

			{/* Confirm */}
			<button
				type="button"
				disabled={processing}
				onClick={() => {
					if (processing) return
					window.dispatchEvent(
						new CustomEvent('sign:final', {
						detail: { action: 'sign', messageDataRe: messageData },
						})
					)
				}}
				className={`
					h-11 rounded-2xl
					bg-[#2c4cff] text-white font-medium
					transition
					flex items-center justify-center
					${processing
						? 'opacity-50 cursor-not-allowed'
						: 'hover:brightness-110'}
				`}
			>
				{processing ? (
					<span className="flex items-center gap-2">
						{/* 乒乓球 loading 动画 */}
						<span className={styles.loadingDots} aria-hidden="true" />
						<span>Processing…</span>
					</span>
				) : (
					'确认'
				)}
			</button>
		</div>
    </div>
  )


}
