import { useMemo, useState, useEffect } from 'react'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import {JsonViewer} from './JsonViewer'
import base_ex from '@/components/assets/base-ex.svg'
import { CoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import base_ex_dark from '@/components/assets/base-ex-dark.svg'
import {ethers} from 'ethers'
import styles from './send.module.scss'

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
      <div className="px-5 pt-1 mb-2">
        {/* 这个 h2 你说没问题，就保持 */}
        <h2 className="text-xl font-semibold font-bold text-center">
          Beamio
        </h2>
      </div>

      <div className="px-5 pb-3">
        <h4 className="text-lg font-semibold text-center">
          Confirm ERC-3009 signature request
        </h4>

        {/* Signing with ... */}
			<div className="mt-3 flex items-center justify-between px-2 text-sm opacity-80 w-full">

			{/* 左侧：Signing with（系统默认颜色） */}
			<div>
				Signing with
			</div>

			{/* 右侧：address + link */}
			<div className="flex items-center gap-2">
				<span className="font-medium">
				{fmtAddr(address)}
				</span>

				<a
					href={`https://basescan.org/address/${address}`}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
					aria-label="View on BaseScan"
					title="View on BaseScan"
				>
				<img
					src={darkModle ? base_ex_dark : base_ex}
					alt=""
					className="w-4 h-4"
				/>
				<span className="sr-only">View on BaseScan</span>
				</a>
			</div>

			</div>
      </div>

      {/* Review / From host */}
		<div className="px-5 py-3 border-t border-slate-200 dark:border-white/10">
		<div className="flex items-center w-full">
			
			{/* 左边：图标 + Request Review */}
			<div className="flex items-center gap-3 flex-none">
			<img
				src={`${originUrl}/favicon.ico`}
				alt="site icon"
				className="w-9 h-9 rounded"
			/>
			<span className="font-semibold text-sm">
				Request Review
			</span>
			</div>

			{/* 右边：originUrl → 自动右对齐 + 自动向左伸张 */}
			<div className="flex-1 text-right text-sm opacity-70 truncate ml-3">
			{originUrl}
			</div>

		</div>
		</div>

      {/* Asset changes */}
      <div className="px-5 py-4 border-t border-slate-200 dark:border-white/10">
        <div className="text-sm opacity-80">
          Asset changes (estimate)
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-wide">
            {assetLine}
          </div>
          <div className="relative w-9 h-9 rounded-full border border-slate-200 dark:border-white/10 grid place-items-center">
            {/* 主图：USDC */}
            <img
              src={usdcIcon}
              alt="USDC"
              className="w-7 h-7"
            />

            {/* 右下角叠加 Base Icon */}
            <img
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
      </div>

      {/* Pay to */}
			<div className="px-5 py-4 border-t border-slate-200 dark:border-white/10">
				<div className="text-sm flex items-center justify-between opacity-80 w-full">

					{/* 左侧：Pay to */}
					<div className="font-semibold">
					Pay to
					</div>

					{/* 右侧：地址 + icon */}
					<div className="flex items-center gap-2">
						<span className="font-mono">
							{fmtAddr(messageData?.payTo)}
						</span>

						<a
							href={`https://basescan.org/address/${messageData?.payTo}`}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
							aria-label="View on BaseScan"
							title="View on BaseScan"
						>
							<img
							src={darkModle ? base_ex_dark : base_ex}
							alt=""
							className="w-4 h-4"
							/>
							<span className="sr-only">View on BaseScan</span>
						</a>
					</div>

				</div>
			</div>
				<div className="px-5 py-4 border-t border-slate-200 dark:border-white/10">
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
              typeof messageData === 'object' ? (
                <JsonViewer data={messageData} />
              ) : (
                <pre className="
                  whitespace-pre-wrap font-mono text-[13px]
                  bg-slate-100 dark:bg-slate-900/40
                  rounded-lg p-2
                  border border-slate-200 dark:border-white/10
                  overflow-x-auto
                ">
                  {messageData}
                </pre>
              )
            ) : (
              <div className="italic opacity-70">
                Show the raw payload or a summary to be signed here
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-5 py-4 text-sm opacity-70 border-t border-slate-200 dark:border-white/10">
        By signing this request, you will allow the dapp to create a transaction
        for the above asset changes in the future. Those changes may not occur
        immediately.
      </div>

      {/* Footer buttons */}
		<div
		className={`
			px-5 pb-5 pt-3
			grid gap-3
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
			>
			Cancel
			</button>
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
			'Confirm'
			)}
		</button>
		</div>
    </div>
  )


}
