import { QRCodeCanvas } from 'qrcode.react'
import { Copy, ExternalLink } from 'lucide-react'
import bIcon from '@/components/assets/32x32.svg'
import { X } from 'lucide-react'

type RedeemOrLinkCardProps = {
  isPay: boolean                     // true = Redeem code 模式, false = Payment link 模式
  amt: number                        // 金额（用于 Redeem 侧显示）
  note?: string                      // 备注
  securityCode?: string       // 安全码
  successUrl: string                 // 支付链接 / 二维码内容
  tip: number                        // tip 金额
  redeemCode?: string                 // Redeem code 文本
  onReset: () => void                // 关闭按钮（✕
  isCompleted: boolean
  createdAt: number
}

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
  if (!isFinite(base) || base <= 0) return 0;
  const raw = base * 0.008;
  const clamped = Math.min(Math.max(raw, 0.02), 2);
  return Number(clamped.toFixed(2));
}

export const RedeemOrLinkCard = ({
	isPay,
	amt,
	note,
	securityCode='',
	successUrl,
	tip,
	redeemCode = '',
	onReset,
	isCompleted,
	createdAt
}: RedeemOrLinkCardProps) => {
	
  const handleCopyLink = async () => {
    if (!successUrl) return

    try {
      await navigator.clipboard.writeText(successUrl)
    } catch (e) {
      console.error('Failed to copy link', e)
    }
  }

  const handleCopyCode = async () => {
    if (!redeemCode) return



    try {
      await navigator.clipboard.writeText(redeemCode)
    } catch (e) {
      console.error('Failed to copy redeem code', e)
    }
  }

  const handleOpenLink = () => {
    if (!successUrl) return
    window.open(successUrl, '_blank')
  }
    const requestGross = amt + tip; // payer will pay
	const feeBase = isPay ? amt : amt + tip;
  const displayGeneratedAmount = isPay ? amt : requestGross;
  const fee = feeBase > 0 ? calcFeeFromNumber(feeBase) : 0;
  const requestNet = requestGross > 0 ? Math.max(requestGross - fee, 0) : 0;

  return (
    <div
      className="
        relative
        rounded-3xl 
        bg-slate-50/80 dark:bg-slate-900/60 
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

      {/* === 内容区 === */}
      {isPay ? (
        <>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Redeem code
          </div>
          <div
            className="
              h-10 rounded-xl 
              bg-white/70 dark:bg-slate-900/70 
              border border-slate-200/80 dark:border-slate-700 
              flex items-center px-3 justify-between 
              text-xs font-mono 
              text-slate-800 dark:text-slate-100
            "
          >
            <span className="truncate mr-2">{redeemCode}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[11px] font-medium text-sky-600 dark:text-sky-400"
            >
              Copy
            </button>
          </div>

          <div
            className="
              mt-2 rounded-2xl 
              bg-white/80 dark:bg-slate-900/70 
              border border-slate-200/80 dark:border-slate-700 
              px-4 py-3 text-center
            "
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
              {amt.toFixed(2)} USDC
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Zero and {Math.round(amt * 100).toString().padStart(2, '0')} / 100 dollars
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Security code
          </div>
          <div className="text-sm text-slate-900 dark:text-slate-100 mb-2">
            {securityCode ? securityCode : 'Not set'}
          </div>

          {note && (
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                Notes
              </div>

              <div
                className="
                  mt-1 rounded-2xl
                  bg-white/80 dark:bg-slate-900/70
                  border border-slate-200/80 dark:border-slate-700
                  px-4 py-3
                  text-sm text-slate-900 dark:text-slate-100
                  leading-snug
                "
              >
                {note}
              </div>
            </>
          )}
        </>
      ) : (
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
			<div className="flex-1 text-center font-medium text-slate-600 dark:text-slate-300">
				Payment link
			</div>

			{/* 右边：状态 */}
			<div className="flex-1 text-right">
				{isCompleted ? (
				<span className="text-green-600 dark:text-green-400 font-medium">
					Completed
				</span>
				) : (
				<span className="text-amber-600 dark:text-amber-400 font-medium">
					Pending
				</span>
				)}
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
                <Copy className="w-3.5 h-3.5" />
              </button>

              {/* Open icon button */}
              <button
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
              </button>
            </div>
          </div>

          {note && (
            <div
              className="
                mt-3 rounded-2xl
                bg-white/80 dark:bg-slate-900/70
                border border-slate-200/80 dark:border-slate-700
                px-4 py-3
                text-slate-900 dark:text-slate-100
                space-y-1.5
              "
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Notes
              </div>

              <div className="text-sm leading-snug whitespace-pre-wrap">
                {note}
              </div>
            </div>
          )}

          <div
            className="
              mt-3 rounded-2xl 
              bg-slate-100/80 dark:bg-slate-900/70 
              border border-slate-200/80 dark:border-slate-700 
              px-4 py-3 
              text-xs text-slate-700 dark:text-slate-300 
              space-y-1.5
            "
          >
            <div className="flex items-center justify-between">
              <span>Payer will pay</span>
              <span>{requestGross > 0 ? requestGross.toFixed(2) : '0.00'} USDC</span>
            </div>
            {tip > 0 && (
              <div className="flex items-center justify-between">
                <span>Includes tip</span>
                <span>{tip.toFixed(2)} USDC</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>You will receive</span>
              <span>{requestNet.toFixed(2)} USDC</span>
            </div>
          </div>
        </>
      )}

      {/* QR area */}
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
              {displayGeneratedAmount.toFixed(2)} USDC
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
