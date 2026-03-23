import { useState, FormEvent, useEffect, useRef } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { onWalletEvent, restoreWithRedeem } from '@/services/beamio'
import ScanBtn from '@/components/scanBtn/ScanButton' // 引入 ScanBtn
import { Scan, AlertCircle } from 'lucide-react' 
import { useDaemonContext } from '@/providers/DaemonProvider'

/** 与 LoadingPage 主色一致 */
export const CASHTREES_PRIMARY_LIME = '#96EB3C'
export const CASHTREES_PRIMARY_INK = '#0F172A'

type RestoreWithQRScreenProps = {
  onRestore: (temp: encrypt_keys_object) => void
  /** 从 URL 等途径预填的 recovery code（如 PWA 从 Save to Home Screen 携带） */
  initialRecoveryCode?: string
}

const RestoreWithQRScreen = ({ onRestore, initialRecoveryCode = '' }: RestoreWithQRScreenProps) => {
  const [recoveryCode, setRecoveryCode] = useState(initialRecoveryCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { scanRef } = useDaemonContext()
  const { scanData } = useDaemonContext()

  useEffect(() => {
    if (initialRecoveryCode) setRecoveryCode(initialRecoveryCode)
  }, [initialRecoveryCode])

  useEffect(() => {
    

    const run = async () => {
		// 简单过滤 http 链接，保留纯 code
		if (!scanData || /^http/i.test(scanData)) {
				setError('Invalid recovery code format')
				return
		}
       	setRecoveryCode(scanData)
    }

    run()
  }, [scanData])
  
  // ⭐ 1. 创建 Ref 用于引用隐藏的 ScanBtn 容器
  const scanTriggerRef = useRef<HTMLDivElement>(null)

  // 错误信息自动清除
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(timer)
  }, [error])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!recoveryCode.trim()) {
      setError('Please enter your recovery code.')
      return
    }

    setLoading(true)
    const canRestore = await restoreWithRedeem(recoveryCode, '')
    setLoading(false)

    if (!canRestore) {
      setError('Invalid recovery code')
      return
    }

    onRestore(canRestore)
  }

  // ⭐ 2. 核心 workflow：监听扫描结果
  // ScanBtn 负责唤起摄像头/相册，结果通过这个事件回传
  useEffect(() => {
    const off = onWalletEvent("scan:url", (url: string) => {
      // 简单过滤 http 链接，保留纯 code
      if (/^http/i.test(url)) {
        setError('Invalid recovery code format')
        return
      }
      if (url?.length) {
        setRecoveryCode(url)
      }
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])

  // ⭐ 3. 触发器：将点击事件传送到 ScanBtn
  const onOpenScanner = () => {
	scanRef.current?.start()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full px-6 pt-6 pb-6 bg-white"
    >
      <div className="flex-1">
        {/* 标题区域 */}
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900">
          Enter Recovery Code
        </h1>
        <p className="mt-3 text-[18px] text-slate-500 font-medium">
          Scan QR or paste your code string.
        </p>

        {/* ⭐ 隐藏的 ScanBtn (实际功能的承载者) */}
        <div ref={scanTriggerRef} style={{ display: 'none' }}>
            <ScanBtn />
        </div>

        {/* Scan QR — 主色与 LoadingPage 一致 */}
        <div className="mt-8">
          <button
            type="button"
            onClick={onOpenScanner}
            className="
              w-full h-[64px]
              rounded-[20px]
              bg-[#96EB3C] hover:bg-[#8ADC32] active:bg-[#7ECF28]
              text-[#0F172A] text-[18px] font-bold
              flex items-center justify-center gap-2.5
              active:scale-[0.98] transition-all
              shadow-[0_12px_28px_rgba(150,235,60,0.35)]
            "
          >
            <Scan className="w-6 h-6" strokeWidth={2.5} />
            Scan QR
          </button>
        </div>

        {/* OR 分隔符 */}
        <div className="relative mt-8 mb-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-[15px] text-slate-400 font-medium">
              or
            </span>
          </div>
        </div>

        {/* 输入框区域 */}
        <div className="relative">
          <textarea
            className={`
              w-full h-[200px] 
              rounded-[24px] 
              border bg-white
              p-5 text-[18px] font-medium text-slate-900
              placeholder:text-slate-400/80
              resize-none outline-none
              shadow-[0_4px_12px_rgba(0,0,0,0.02)]
              transition-all
              focus:border-[#96EB3C]/50 focus:ring-4 focus:ring-[#96EB3C]/12
              ${error ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200'}
            `}
            placeholder="Paste your code string here..."
            value={recoveryCode}
            onChange={e => setRecoveryCode(e.target.value)}
          />
          
          {/* 错误提示 */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[14px] font-semibold">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="pb-[env(safe-area-inset-bottom)] pt-4">
        <AppButton
          type="submit"
          fullWidth
          disabled={loading || !recoveryCode.trim()}
          loading={loading}
          className={`
            h-[64px] rounded-full text-[20px] font-bold
            ${!recoveryCode.trim() && !loading
              ? '!bg-slate-200 !text-slate-400 cursor-not-allowed !shadow-none'
              : '!bg-[#96EB3C] hover:!bg-[#8ADC32] active:!bg-[#7ECF28] !text-[#0F172A] !shadow-[0_12px_30px_rgba(150,235,60,0.42)] active:!shadow-[0_10px_24px_rgba(150,235,60,0.32)] focus-visible:!ring-2 focus-visible:!ring-[#96EB3C]/50 disabled:!opacity-90'}
          `}
        >
          Restore Wallet
        </AppButton>
      </div>
    </form>
  )
}

export default RestoreWithQRScreen