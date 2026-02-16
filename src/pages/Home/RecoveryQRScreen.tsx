import React, { useState, useRef, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Copy, Check, Loader, KeyRound, Lock, Wifi, RefreshCw } from 'lucide-react'
import bIcon from '@/components/assets/logo512.png'
import { useNavigate } from 'react-router-dom'

export const ACTIVATING_STEPS = [
  { id: 0, title: 'Generating Secure ID', desc: 'Creating cryptographic keys', icon: KeyRound },
  { id: 1, title: 'Deploying Smart Vault', desc: 'Establishing storage on Base', icon: Lock },
  { id: 2, title: 'Minting Membership', desc: 'Adding card to your wallet', icon: Wifi },
  { id: 3, title: 'Verifying on Base L2', desc: 'Confirming on blockchain', icon: RefreshCw },
] as const
const STEP_DURATION_MS = 5000 // 4 steps × 5s ≈ 20s total
type RecoveryQRScreenProps = {
  qrDataUrl: string
  recoveryCode: string
  showButton: boolean
  isRedeemFlow?: boolean
  redeemActivating?: boolean
  close: () => void | Promise<void>
}

const RecoveryQRScreen = ({
  qrDataUrl,
  recoveryCode,
  showButton,
  isRedeemFlow = false,
  redeemActivating = false,
  close
}: RecoveryQRScreenProps) => {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [activatingStep, setActivatingStep] = useState(0)
  // 新增状态：是否已经执行过备份操作（保存或复制）
  const [hasBackedUp, setHasBackedUp] = useState(false)

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const isActivating = (loading || redeemActivating) && isRedeemFlow
  useEffect(() => {
    if (!isActivating) {
      setActivatingStep(0)
      return
    }
    const advance = () => {
      setActivatingStep((prev) => Math.min(prev + 1, ACTIVATING_STEPS.length - 1))
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < ACTIVATING_STEPS.length; i++) {
      timers.push(setTimeout(advance, i * STEP_DURATION_MS))
    }
    return () => timers.forEach((t) => clearTimeout(t))
  }, [isActivating])

  const handleSaveImage = () => {
    if (!qrCanvasRef.current) return
    const dataUrl = qrCanvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'beamio-master-key.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 标记已备份，解锁复选框
    setHasBackedUp(true)
  }

  const handleCopyCode = async () => {
    if (!recoveryCode) return
    try {
      await navigator.clipboard.writeText(recoveryCode)
      setCopied(true)
      // 标记已备份，解锁复选框
      setHasBackedUp(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // Redeem flow: 进入时或点击后显示 4 步 Activating loading 动画（总长约 30 秒）
  if (isActivating) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 bg-white min-h-0 overflow-y-auto">
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-[#1652f0] rounded-[28px] flex items-center justify-center shadow-xl shadow-blue-500/40">
            <Loader className="w-9 h-9 text-white animate-spin" strokeWidth={2.5} />
          </div>
          <div className="absolute -inset-4 bg-[#1652f0] rounded-[40px] opacity-10 blur-xl animate-pulse" />
        </div>
        <div className="w-full max-w-sm space-y-6">
          {ACTIVATING_STEPS.map((step, idx) => {
            const isCompleted = idx < activatingStep
            const isActive = idx === activatingStep
            const Icon = step.icon
            return (
              <div key={step.id} className="flex items-start gap-4">
                <div
                  className={[
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isCompleted && 'bg-emerald-500',
                    isActive && 'bg-[#1652f0]',
                    !isCompleted && !isActive && 'bg-slate-200',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                  ) : isActive ? (
                    <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={[
                      'font-semibold text-[15px] transition-colors',
                      isActive && 'text-[#1652f0]',
                      isCompleted && 'text-slate-700',
                      !isCompleted && !isActive && 'text-slate-400',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {step.title}
                  </p>
                  <p
                    className={[
                      'text-sm mt-0.5 transition-colors',
                      isActive && 'text-slate-700',
                      isCompleted && 'text-slate-500',
                      !isCompleted && !isActive && 'text-slate-400',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full px-6 pt-6 pb-6 bg-white">
      <div className="flex-1">
        {/* Header */}
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900">
          Master Key
        </h1>

        <p className="mt-3 text-[18px] md:text-[20px] text-slate-500 font-medium leading-snug">
          Your only backup to restore funds.
        </p>

        {/* QR Card */}
        <div className="mt-10 flex justify-center">
          <div
            className="
              relative
              p-6
              bg-white
              rounded-[32px]
              
			  shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
              border border-slate-100
            "
          >
            {qrDataUrl ? (
              <QRCodeCanvas
                ref={qrCanvasRef}
                value={qrDataUrl}
                size={220}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
                imageSettings={{
                  src: bIcon,
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
                className="rounded-xl
				"
              />
            ) : (
              <div className="w-[220px] h-[220px] bg-slate-100 rounded-xl animate-pulse" />
            )}
          </div>
        </div>

        {/* Action Buttons Row (Save & Copy) */}
        <div className="mt-10 grid grid-cols-2 gap-4">
          <button
            onClick={handleSaveImage}
            className="
              flex items-center justify-center gap-2
              h-[64px] rounded-[20px]
              bg-slate-100 hover:bg-slate-200 active:bg-slate-300
              text-slate-900 text-[18px] font-bold
              transition-colors
            "
          >
            <Download className="w-6 h-6" strokeWidth={2.5} />
            Save
          </button>

          <button
            onClick={handleCopyCode}
            className="
              flex items-center justify-center gap-2
              h-[64px] rounded-[20px]
              bg-slate-100 hover:bg-slate-200 active:bg-slate-300
              text-slate-900 text-[18px] font-bold
              transition-colors
            "
          >
            {copied ? (
              <>
                <Check className="w-6 h-6 text-emerald-600" strokeWidth={3} />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-6 h-6" strokeWidth={2.5} />
                Copy
              </>
            )}
          </button>
        </div>
        
        {/* Checkbox Agreement - Logic Modified */}
		<div 
          className={`
            mt-8 flex items-center gap-4 transition-opacity duration-300
            ${hasBackedUp ? 'opacity-100 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
          `}
          onClick={() => {
            if (hasBackedUp) {
              setIsConfirmed(!isConfirmed)
            }
          }}
        >
          {/* 移除 pt-1，利用外层的 items-center 自动居中 */}
          <div className="relative flex items-center pointer-events-none">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isConfirmed}
              readOnly
              disabled={!hasBackedUp}
            />
            <div 
              className={`
                w-6 h-6 rounded-[6px] border-2 transition-all
                flex items-center justify-center
                ${isConfirmed 
                  ? 'bg-slate-900 border-slate-900' 
                  : 'bg-transparent border-slate-300'}
              `}
            >
              {isConfirmed && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
            </div>
          </div>
          <p className="flex-1 text-[16px] leading-snug text-slate-500 font-medium select-none">
            I understand Beamio stores only an encrypted backup.
          </p>
        </div>
      </div>

      {/* Footer Button: Open Wallet */}
	  {
		showButton && 
		<div className="pb-[env(safe-area-inset-bottom)] pt-4">
        <AppButton
          fullWidth
          onClick={async () => {
            setLoading(true)
            await Promise.resolve(close?.())
          }}
          loading={loading && !isRedeemFlow}
          // 只有勾选确认后才启用（而确认本身需要先备份）
          disabled={!isConfirmed}
          className={`
             h-[72px] rounded-full
             text-[22px] font-bold
             transition-all duration-200
             ${isConfirmed
               ? 'bg-[#1652f0] shadow-[0_12px_30px_rgba(22,82,240,0.3)] text-white' 
               : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
           `}
        >
          {isRedeemFlow ? 'Continue' : 'Open Wallet'}
        </AppButton>
      </div>
	  }
      
    </div>
  )
}

export default RecoveryQRScreen