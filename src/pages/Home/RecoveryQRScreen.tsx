import React, { useState, useRef } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/logo512.png'

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
      {/* 顶部步骤标题 */}
      <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">
        WALLET · STEP 2 OF 2
      </div>

      {/* 主标题 */}
      <h1 className="text-[26px] font-semibold text-slate-900">
        Recovery QR
      </h1>

      {/* 副标题 */}
      <p className="mt-1 text-[14px] text-slate-500 leading-snug">
        Save this to restore your wallet on a new device.
      </p>

      {/* QR 卡片 */}
      <div className="mt-6 flex flex-col items-center">
        {qrDataUrl ? (
          <div className="relative z-10 flex justify-center">
			<div
										className="
										rounded-[28px]
										bg-white
										p-[18px]
										shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
										"
									>
										<QRCodeCanvas
										ref={qrCanvasRef}
										value={qrDataUrl}
										size={264}
										level="H"
										includeMargin
										bgColor="#ffffff"      // ⬅ 这里改成白底
										fgColor="#000000"
										imageSettings={{
											src: bIcon,
											height: 60,
											width: 60,
											excavate: true,
										}}
										className="rounded-lg inline-block"
										/>
										</div>
									</div>
									) : (
									<div className="w-40 h-40 rounded-xl bg-slate-200" />
									)}

									<p className="mt-4 text-[12px] text-slate-500 text-center leading-snug max-w-xs">
										Anyone with this Recovery QR or recovery code can restore your wallet.
									</p>
									<p className="mt-4 text-[12px] text-slate-500 text-center leading-snug max-w-xs">
										You won’t be able to view this again. Save it now.
									</p>
								</div>

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
            : `Copy recovery code`}
        </button>
      </div>

      {/* Important 提示卡片 */}
      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-xs font-semibold text-amber-800 mb-1">Keep it safe</div>
        <p className="text-[11px] leading-snug text-amber-900">
          If you lose both your password and your Recovery QR/code, your wallet can’t be recovered.
        </p>
      </div>

      {/* 底部主按钮 */}
      <div className="mt-6">
        <AppButton
          fullWidth
          onClick={() => {
			setLoading(true);
			close();
		  }}
		  loading={loading}
          className="rounded-[999px] py-3 text-[15px] font-semibold"
        >
          I&apos;ve saved it
        </AppButton>
      </div>
    </div>
  )
}

export default RecoveryQRScreen
