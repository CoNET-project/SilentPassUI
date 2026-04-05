import { ArrowLeft } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { BIZ_PUBLIC_LOGO512 } from "@/pages/Home/brandUi"

type ShowPrintProps = {
	title?: string
	merchantName: string
	handle: string // "@BeamioDemo"
	payTitle?: string // "Beamio PayMe"
	paySubtitle?: string // "USDC · Any amount"
	payLink: string
	qrValue: string
	onDone: () => void
	onBack: () => void
	onPrint: () => void
}

export function ShowPrint(props: ShowPrintProps) {
  const {
    title = "Your Beamio QR Kit",
    merchantName,
    handle,
    payTitle = "Beamio PayMe",
    paySubtitle = "USDC · Any amount",
    payLink,
    qrValue,
    onDone,
    onBack,
    onPrint,
  } = props

  return (
    <div className="fixed inset-0 z-[999] bg-white">
      {/* 顶部导航（iOS 风） */}
		<div
		className={[
			"sticky top-0 z-10",
			"pt-[env(safe-area-inset-top)]",
			"bg-white/90 backdrop-blur-xl",
			"border-b border-black/5",
		].join(" ")}
		>
		<div className="relative h-12 px-4 flex items-center">
			{/* 左侧返回 */}
			<div className="w-9 flex justify-start">
			<button
				type="button"
				onClick={onBack}
				className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-[0.98] transition"
				aria-label="Back"
			>
				<ArrowLeft className="w-5 h-5 text-slate-700" />
			</button>
			</div>

			{/* 中间标题（真正居中） */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div className="text-[18px] font-extrabold text-slate-900 truncate">
				{title}
			</div>
			</div>

			{/* 右侧占位（保持对称） */}
			<div className="w-9" />
		</div>
		</div>

      {/* 内容 */}
      <div
        className={[
          "mx-auto w-full max-w-[560px]",
          "px-4",
          "pt-4 pb-6",
          "overflow-y-auto",
        ].join(" ")}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* 外层淡蓝背景框 */}
        <div className="rounded-[28px] bg-blue-50/60 ring-1 ring-black/5 p-4">
          {/* 白卡 */}
          <div className="rounded-[26px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/10 overflow-hidden">
            <div className="p-5">
              {/* 顶部 header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[rgb(0_0_255)] flex items-center justify-center shadow-sm">
                  <span className="text-white text-[30px] font-black italic leading-none">
                    B
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[22px] font-extrabold text-slate-900">
                    {payTitle}
                  </div>
                  <div className="text-[16px] font-semibold text-slate-500">
                    {paySubtitle}
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="px-4 h-10 rounded-full bg-slate-100 ring-1 ring-black/10 flex items-center justify-center text-[16px] font-bold text-slate-600">
                    {handle}
                  </div>
                </div>
              </div>

              {/* QR 区块 */}
              <div className="mt-5 rounded-[26px] bg-white ring-1 ring-black/10 shadow-sm p-5">
                <div className="text-center">
                  <div className="text-[42px] font-black text-slate-900">
                    {merchantName || "Demo"}
                  </div>
                  <div className="mt-1 text-[22px] font-semibold text-slate-400">
                    {handle}
                  </div>
                </div>

                <div className="mt-5 flex justify-center">
                  <div className="rounded-[26px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/10">
                    <QRCodeCanvas
                      value={qrValue}
                      size={260}
                      level="H"
                      includeMargin
                      bgColor="white"
                      fgColor="#000000"
                      imageSettings={{
                        src: BIZ_PUBLIC_LOGO512,
                        height: 92,
                        width: 92,
                        excavate: true,
                      }}
                      className="rounded-[18px] inline-block"
                    />
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="text-[22px] font-semibold text-slate-500">
                    Scan to pay
                  </div>

                  <div className="mt-2">
                    <span className="text-[46px] font-black italic tracking-tight text-slate-900">
                      beamio
                    </span>
                    
                    
                  </div>
                </div>

                {/* Payment link box */}
                <div className="mt-5 rounded-[18px] bg-slate-50 ring-1 ring-black/10 p-4">
                  <div className="text-[12px] font-extrabold text-slate-500">
                    Payment link (opens in browser / app)
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-slate-700 break-all leading-snug">
                    {payLink}
                  </div>
                </div>

                {/* Tip */}
                <div className="mt-4 text-center text-[12px] font-semibold text-slate-400">
                  Tip for merchants: print and place in a table stand near the register.
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="h-14 rounded-[18px] bg-slate-100 text-slate-700 font-extrabold text-[20px] ring-1 ring-black/10 active:scale-[0.99] transition"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={onPrint}
                  className="h-14 rounded-[18px] bg-[rgb(0_0_255)] text-white font-extrabold text-[20px] shadow-sm ring-1 ring-black/10 active:scale-[0.99] transition"
                >
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 打印提示（可选：仅屏幕显示） */}
        <div className="mt-4 text-center text-[12px] text-slate-400">
          Tip: On desktop, use your browser print dialog to save as PDF.
        </div>
      </div>
    </div>
  )
}
