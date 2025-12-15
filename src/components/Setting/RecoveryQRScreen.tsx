import React, { useState, useRef } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/32x32.svg'

const RecoveryQRScreen = ({
	qrDataUrl,
	recoveryCode,
	close
}: {
	qrDataUrl: string
	recoveryCode: string
	close: () => void
}) => {
	const [copied, setCopied] = useState(false)
	const [loading, setLoading] = useState(false)

	// ⭐ 绑定 QR 的 canvas
	const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

	const handleSaveImage = () => {
		if (!qrCanvasRef.current) return

		// 从 canvas 导出 PNG
		const dataUrl = qrCanvasRef.current.toDataURL('image/png')

		const link = document.createElement('a')
		link.href = dataUrl
		link.download = 'beamio-recovery-qr.png'

		// 兼容部分浏览器
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	const handleCopyCode = async () => {
		if (!recoveryCode) return
		try {
		await navigator.clipboard.writeText(recoveryCode)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
		// ignore
		}
	}


  return (
    <div className="px-6 pt-8 pb-10">
      <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          You&apos;re viewing the Recovery QR and recovery code (S) that are
          already saved for this wallet. Combined with your PIN, they can fully
          restore your Beamio wallet on another device.
        </p>
      </div>


      <div className="px-4 pt-4 pb-6 bg-slate-50">
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-4 py-5">
			<h1 className="text-lg font-semibold text-slate-900">
				Your Recovery QR &amp; code
			</h1>
			 <p className="mt-2 text-xs text-slate-600 leading-relaxed">
				Save this QR and recovery code somewhere safe (print it or store the
				image). Don&apos;t share them with anyone. Together with your PIN,
				they can fully restore your wallet.
			</p>

			{/* QR 卡片 */}
			<div className="mt-6 flex flex-col items-center">
				{qrDataUrl ? (
				<div className="border border-black/20 rounded-xl p-3 bg-white text-center qrCard">
					<QRCodeCanvas
					ref={qrCanvasRef}
					value={qrDataUrl}
					size={160}
					level="H"
					includeMargin
					bgColor="#ffffff"      // ⬅ 这里改成白底
					fgColor="#000000"
					imageSettings={{
						src: bIcon,
						height: 40,
						width: 40,
						excavate: true,
					}}
					className="rounded-lg inline-block"
					/>
				</div>
				) : (
				<div className="w-40 h-40 rounded-xl bg-slate-200" />
				)}
			 {/* 中间两个按钮 */}
			<div className="mt-6 space-y-3">
				<button
				onClick={handleSaveImage}
				className="
					w-full rounded-[999px] border border-slate-200
					bg-white text-[15px] font-semibold text-slate-800
					py-3
				"
				>
				Save QR image
				</button>

				<button
				onClick={handleCopyCode}
				className="
					w-full rounded-[999px] border border-slate-200
					bg-white text-[15px] font-semibold text-slate-800
					py-3
				"
				>
				{copied
					? 'Copied!'
					: `Copy recovery code${recoveryCode ? ` (${recoveryCode})` : ' (S)'}`}
				</button>
			</div>
					 {/* 危险提示 */}
			<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
				<p className="text-xs font-semibold text-amber-900">Important</p>
				<p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
					Anyone with this QR or recovery code (S) plus your PIN can restore
					your wallet on another device. Treat them like a physical key to
					your funds. If you lose both your Recovery and your PIN, Beamio
					cannot recover your wallet.
				</p>
			</div>
			</div>
		</div>
		</div>
    </div>
  )
}

export default RecoveryQRScreen
