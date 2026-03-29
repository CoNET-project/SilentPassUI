import { useState, FormEvent, useEffect, useRef } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { onWalletEvent, restoreWithRedeem } from '@/services/beamio'
import ScanBtn from '@/components/scanBtn/ScanButton' // 引入 ScanBtn
import { Scan, AlertCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'

export const CASHTREES_PRIMARY_BRAND = '#1562f0'
/** @deprecated 使用 CASHTREES_PRIMARY_BRAND */
export const CASHTREES_PRIMARY_LIME = CASHTREES_PRIMARY_BRAND
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
  
  const scanTriggerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const off = onWalletEvent("scan:url", (url: string) => {
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

  const onOpenScanner = () => {
	scanRef.current?.start()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full px-6 pt-6 pb-6 bg-white dark:bg-slate-900"
    >
      <div className="flex-1">
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
          Enter Recovery Code
        </h1>
        <p className="mt-3 text-[18px] text-slate-500 dark:text-slate-400 font-medium">
          Scan QR or paste your code string.
        </p>

        <div ref={scanTriggerRef} style={{ display: 'none' }}>
            <ScanBtn />
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onOpenScanner}
            className="
              w-full h-[64px]
              rounded-[20px]
              bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] hover:opacity-[0.96]
              dark:from-[#3d8ef5] dark:to-[#1562f0]
              text-white text-[18px] font-bold
              flex items-center justify-center gap-2.5
              active:scale-[0.98] transition-all
              shadow-[0_12px_28px_rgba(21,98,240,0.38)] dark:shadow-[0_12px_32px_rgba(21,98,240,0.45)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/75 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
            "
          >
            <Scan className="w-6 h-6" strokeWidth={2.5} />
            Scan QR
          </button>
        </div>

        <div className="relative mt-8 mb-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-slate-900 px-4 text-[15px] text-slate-400 dark:text-slate-500 font-medium">
              or
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            className={`
              w-full h-[200px] 
              rounded-[24px] 
              border bg-white dark:bg-slate-800
              p-5 text-[18px] font-medium text-slate-900 dark:text-slate-100
              placeholder:text-slate-400/80 dark:placeholder:text-slate-500
              resize-none outline-none
              shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-none
              transition-all
              focus:border-[#1562f0]/55 focus:ring-4 focus:ring-[#1562f0]/15 dark:focus:ring-[#1562f0]/20
              ${error ? 'border-red-300 dark:border-red-500/50 ring-4 ring-red-50 dark:ring-red-950/40' : 'border-slate-200 dark:border-slate-600'}
            `}
            placeholder="Paste your code string here..."
            value={recoveryCode}
            onChange={e => setRecoveryCode(e.target.value)}
          />
          
          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[14px] font-semibold">{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pb-[env(safe-area-inset-bottom)] pt-4">
        <AppButton
          type="submit"
          fullWidth
          disabled={loading || !recoveryCode.trim()}
          loading={loading}
          className={`
            h-[64px] rounded-full text-[20px] font-bold
            ${!recoveryCode.trim() && !loading
              ? '!bg-slate-200 dark:!bg-slate-700 !text-slate-400 dark:!text-slate-500 cursor-not-allowed !shadow-none'
              : '!bg-gradient-to-r !from-[#1562f0] !to-[#0e4cbb] hover:!opacity-[0.96] active:!scale-[0.99] !text-white dark:!from-[#3d8ef5] dark:!to-[#1562f0] !shadow-[0_12px_30px_rgba(21,98,240,0.4)] active:!shadow-[0_10px_24px_rgba(21,98,240,0.32)] focus-visible:!ring-2 focus-visible:!ring-[#1562f0]/75 focus-visible:!ring-offset-2 dark:focus-visible:!ring-offset-slate-900 disabled:!opacity-90'}
          `}
        >
          Restore Wallet
        </AppButton>
      </div>
    </form>
  )
}

export default RestoreWithQRScreen
