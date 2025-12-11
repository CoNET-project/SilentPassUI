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
      {/* 顶部步骤标题 */}
      <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">
        Account · Step 2 of 2
      </div>

      {/* 主标题 */}
      <h1 className="text-[26px] font-semibold text-slate-900">
        Your Recovery QR
      </h1>

      {/* 副标题 */}
      <p className="mt-1 text-[14px] text-slate-500 leading-snug">
        If you change devices or clear your browser, this QR plus your PIN is
        how you restore your Beamio wallet.
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

        <p className="mt-4 text-[12px] text-slate-500 text-center leading-snug max-w-xs">
          Save this QR somewhere safe (print it or store the image). Do not
          share it with anyone. Combined with your PIN, it can fully restore
          your wallet.
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
            : `Copy recovery code${recoveryCode ? ` (${recoveryCode})` : ' (S)'}`}
        </button>
      </div>

      {/* Important 提示卡片 */}
      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-xs font-semibold text-amber-800 mb-1">Important</div>
        <p className="text-[11px] leading-snug text-amber-900">
          Anyone with this QR and your PIN can restore your wallet on another
          device. Treat it like a physical key to your funds. If you lose both
          this QR/code and your PIN, Beamio cannot recover your wallet.
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
          I&apos;ve saved my Recovery QR
        </AppButton>
      </div>
    </div>
  )
}

export default RecoveryQRScreen
