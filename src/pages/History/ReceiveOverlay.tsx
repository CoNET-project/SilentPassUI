import React from 'react'
import { QRCodeCanvas } from "qrcode.react"
import bIcon from '@/components/assets/32x32.svg'
import styles from './send.module.scss'
import { Toast } from 'antd-mobile'

type ReceiveOverlayProps = {
	onClose: () => void,
	address: string
}
function shortAddr(addr?: string | null): string {
	if (!addr || typeof addr !== "string") return "";
	const trimmed = addr.trim();
	if (trimmed.length <= 10) return trimmed; // 太短就原样返回
	return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export default function ReceiveOverlay({ onClose, address }: ReceiveOverlayProps) {

	  const copyAddress = async () => {
		if (!address) return
		try {
		await navigator.clipboard.writeText(address)
			Toast.show({
				content: 'Address copied',
				duration: 1200,
			})
			} catch (err) {
			Toast.show({
				content: 'Copy failed',
				duration: 1200,
			})
		}
	}
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-transparent">
      {/* Header close */}
      <div className="flex items-center justify-end px-5 pt-5 pb-2">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center 
                     text-lg leading-none 
                     bg-black/5 dark:bg-white/10"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-6 flex flex-col items-center justify-start gap-6">
        {/* QR placeholder */}
        {/* ✅ 二维码 */}
			<div className="border border-black/20 rounded-xl p-3 bg-white text-center qrCard">
				<QRCodeCanvas
					value={address}
					size={160}
					level="H"                      // 高容错，适合加 Logo
					includeMargin={true}
					bgColor="transparent"          // 如果你想透明也 OK
					fgColor="#000"                 
					imageSettings={{
						src: bIcon,                  // 你的 Logo 图片
						height: 40,
						width: 40,
						excavate: true               // 在中心挖空，Logo 更清晰
					}}
					className="rounded-lg inline-block"
					/>

				{/* ✅ WALLET 与地址一行显示，紧贴二维码 */}
				<div className="flex justify-center items-center gap-1 text-[13px] mt-0 pt-0 leading-none">
					<span className="uppercase text-black/50 font-medium tracking-wider text-xs" style={{ color: "#c0c0c0ff" }}>
						WALLET
					</span>
					<span className="font-mono text-black/50 font-semibold text-xs" >
						{shortAddr(address)}
					</span>
				</div>
				
			</div>

        {/* link text */}
        {/* Address card */}
		<div className="
			w-full rounded-2xl 
			bg-slate-100/70 dark:bg-white/5
			border border-slate-300 dark:border-white/10
			px-4 py-3
			">
			<div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
				{shortAddr(address)}
			</div>

			<div className="flex items-center gap-2">
				<div className="
				flex-1 text-sm font-mono truncate
				text-slate-800 dark:text-slate-50
				">
				{address}
				</div>

				<button 
				onClick={copyAddress}
				className="
					px-3 py-1.5 rounded-full 
					bg-gradient-to-r from-sky-500 to-blue-500
					text-xs font-medium text-white
				">
				Copy
				</button>
			</div>

			<div className="mt-2 text-[11px] leading-relaxed
				text-slate-600 dark:text-slate-500
			">
				Use this address to receive USDC on Base via Beamio or any compatible wallet.
			</div>
			</div>
      </div>
    </div>
  )
}
