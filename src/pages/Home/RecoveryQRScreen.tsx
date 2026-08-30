import { IpfsImg } from '@/components/IpfsImg';
import React, { useState, useRef, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Download,
  Copy,
  Check,
  Loader,
  KeyRound,
  Lock,
  Wifi,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { VerraBrandLockup } from '@/components/branding/VerraBrandLockup'
import { getCashTreesNativeNfcBridge, getCashTreesNativeNfcHost } from '@/utils/cashTreesNativeNfc'
import { tu } from '@/locale/beamioLocale'

const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`

/** 与 LoadingPage / WalletReady / Home 主色一致（Tailwind 任意类请写死 #hex，勿拼进模板字符串） */
export const CASHTREES_PRIMARY_BRAND = '#1562f0'
/** @deprecated 使用 CASHTREES_PRIMARY_BRAND */
export const CASHTREES_PRIMARY_LIME = CASHTREES_PRIMARY_BRAND
export const CASHTREES_PRIMARY_INK = '#0F172A'
export const CASHTREES_PRIMARY_BRAND_SOFT = '#6ba3ff'

export const ACTIVATING_STEP_DEFS = [
  { id: 0, titleKey: 'generating_secure_id', descKey: 'creating_cryptographic_keys', icon: KeyRound },
  { id: 1, titleKey: 'deploying_smart_vault', descKey: 'establishing_storage_on_base', icon: Lock },
  { id: 2, titleKey: 'minting_membership', descKey: 'adding_card_to_your_wallet', icon: Wifi },
  { id: 3, titleKey: 'verifying_on_base_l2', descKey: 'confirming_on_blockchain', icon: RefreshCw },
] as const

export function getActivatingSteps() {
  return ACTIVATING_STEP_DEFS.map((s) => ({
    ...s,
    title: tu(s.titleKey),
    desc: tu(s.descKey),
  }))
}

/** @deprecated 使用 getActivatingSteps() 以支持 locale 切换 */
export const ACTIVATING_STEPS = getActivatingSteps()
const STEP_DURATION_MS = 5000 // 4 steps × 5s ≈ 20s total
type RecoveryQRScreenProps = {
  qrDataUrl: string
  recoveryCode: string
  showButton: boolean
  /** 用户输入的 beamio tag，用于保存时作为文件名 */
  beamioTag?: string
  isRedeemFlow?: boolean
  redeemActivating?: boolean
  close: () => void | Promise<void>
  /** 与 recoverQR.html 一致：顶栏「返回」；不设则由父级（如 ScreenShell）负责导航 */
  showTopAppBar?: boolean
  onBack?: () => void
  /** 顶栏居中品牌文案，默认 Beamio */
  topBarBrand?: string
}

/** 将 beamio tag 转为安全文件名（去除 @ 和非法字符） */
const toSafeFilename = (tag: string) =>
  tag
    .trim()
    .replace(/^@+/, '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-') || 'beamio-master-key'

const RecoveryQRScreen = ({
  qrDataUrl,
  recoveryCode,
  showButton,
  beamioTag,
  isRedeemFlow = false,
  redeemActivating = false,
  close,
  showTopAppBar = false,
  onBack,
  topBarBrand = 'Beamio',
}: RecoveryQRScreenProps) => {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [activatingStep, setActivatingStep] = useState(0)
  // 新增状态：是否已经执行过备份操作（保存或复制）
  const [hasBackedUp, setHasBackedUp] = useState(false)
  const [saveError, setSaveError] = useState('')

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const activatingSteps = getActivatingSteps()
  const isActivating = (loading || redeemActivating) && isRedeemFlow
  useEffect(() => {
    if (!isActivating) {
      setActivatingStep(0)
      return
    }
    const advance = () => {
      setActivatingStep((prev) => Math.min(prev + 1, ACTIVATING_STEP_DEFS.length - 1))
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < ACTIVATING_STEP_DEFS.length; i++) {
      timers.push(setTimeout(advance, i * STEP_DURATION_MS))
    }
    return () => timers.forEach((t) => clearTimeout(t))
  }, [isActivating])

  const saveImageWithIosBridge = (dataUrl: string, filename: string) => {
    const native = getCashTreesNativeNfcBridge()
    const saveRecoveryQrToPhotos = native?.saveRecoveryQrToPhotos
    if (getCashTreesNativeNfcHost() !== 'ios' || typeof saveRecoveryQrToPhotos !== 'function') {
      return Promise.resolve<'unhandled' | 'saved' | 'failed'>('unhandled')
    }

    const requestId = `recovery-qr-${Date.now()}-${Math.random().toString(36).slice(2)}`
    return new Promise<'saved' | 'failed'>((resolve) => {
      let done = false
      const cleanup = () => {
        window.clearTimeout(timeout)
        window.removeEventListener('cashtreesios', onResult as EventListener)
      }
      const finish = (result: 'saved' | 'failed') => {
        if (done) return
        done = true
        cleanup()
        resolve(result)
      }
      const onResult = (event: Event) => {
        const detail = (event as CustomEvent<Record<string, unknown>>).detail
        if (!detail || detail.action !== 'saveRecoveryQrToPhotos') return
        if (detail.requestId !== requestId) return
        finish(detail.ok === true ? 'saved' : 'failed')
      }
      const timeout = window.setTimeout(() => finish('failed'), 15000)
      window.addEventListener('cashtreesios', onResult as EventListener)
      try {
        saveRecoveryQrToPhotos({ dataUrl, filename, requestId })
      } catch {
        finish('failed')
      }
    })
  }

  const handleSaveImage = async () => {
    if (!qrCanvasRef.current) return
    setSaveError('')
    const dataUrl = qrCanvasRef.current.toDataURL('image/png')
    const filename = `${toSafeFilename(beamioTag ?? '')}.png`

    const nativeSaveResult = await saveImageWithIosBridge(dataUrl, filename)
    if (nativeSaveResult === 'saved') {
      setHasBackedUp(true)
      return
    }
    if (nativeSaveResult === 'failed') {
      setSaveError(tu('unable_to_save_to_photos_please_allow_photos_access_and_try_again'))
      return
    }

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
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
      <div className="flex flex-col h-full min-h-0 items-center justify-center p-6 bg-white overflow-hidden">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-[28px] flex items-center justify-center bg-gradient-to-br from-[#1562f0] to-[#0e4cbb] shadow-[0_14px_40px_rgba(21,98,240,0.38)]">
            <Loader className="w-9 h-9 text-white animate-spin" strokeWidth={2.5} />
          </div>
          <div className="absolute -inset-4 rounded-[40px] bg-[#1562f0] opacity-[0.12] blur-xl animate-pulse" />
        </div>
        <div className="w-full max-w-sm space-y-6">
          {activatingSteps.map((step, idx) => {
            const isCompleted = idx < activatingStep
            const isActive = idx === activatingStep
            const Icon = step.icon
            return (
              <div key={step.id} className="flex items-start gap-4">
                <div
                  className={[
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isCompleted && 'bg-[#0e4cbb]',
                    isActive && 'bg-[#1562f0]',
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
                    <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={[
                      'font-semibold text-[15px] transition-colors',
                      isActive && 'text-[#1562f0] font-bold',
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

  const canUseTopBack = showTopAppBar && typeof onBack === 'function'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f9f9ff] text-[#171c26]">
      {showTopAppBar ? (
        <header className="flex w-full shrink-0 items-center justify-between border-b border-[#e1e7f6] bg-white px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3">
          <button
            type="button"
            onClick={() => canUseTopBack && onBack?.()}
            disabled={!canUseTopBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#e9edfb] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            aria-label={tu('back')}
          >
            <ArrowLeft className="h-6 w-6 text-[#1562f0]" strokeWidth={2.25} />
          </button>
          <div className="flex min-w-0 flex-1 justify-center px-1">
            {topBarBrand === 'Beamio' ? (
              <VerraBrandLockup variant="onLight" size="compact" />
            ) : (
              <span className="text-lg font-bold tracking-tighter text-[#171c26]">{topBarBrand}</span>
            )}
          </div>
          <div className="h-10 w-10" aria-hidden />
        </header>
      ) : null}

      <main className="mx-auto flex min-h-0 w-full max-w-[400px] flex-1 flex-col overflow-hidden bg-transparent">
        {/* Scrollable content */}
        <div
          className={[
            'flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 pb-4',
            showTopAppBar
              ? 'pt-6 [@media(max-height:700px)]:pt-4 [@media(max-height:560px)]:pt-3'
              : [
                  'pt-[calc(env(safe-area-inset-top)+2.5rem)]',
                  '[@media(max-height:700px)]:pt-[calc(env(safe-area-inset-top)+1.5rem)]',
                  '[@media(max-height:560px)]:pt-[calc(env(safe-area-inset-top)+0.75rem)]',
                ].join(' '),
          ].join(' ')}
        >
          <header className="mb-8 w-full shrink-0 text-center [@media(max-height:700px)]:mb-5 [@media(max-height:560px)]:mb-3">
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#171c26] [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:text-[1.65rem] [@media(max-height:560px)]:text-2xl">
              {tu('security_backup')}
            </h1>
            <p className="px-2 text-sm leading-relaxed text-[#414754] [@media(max-height:560px)]:text-[13px]">
              {tu('account_recovery_key_description')}
            </p>
          </header>

          {/* QR card */}
          <div className="mb-6 flex w-full shrink-0 flex-col items-center rounded-2xl border border-[#c1c6d6] bg-white p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] [@media(max-height:700px)]:mb-4 [@media(max-height:700px)]:p-4 [@media(max-height:560px)]:mb-3 [@media(max-height:560px)]:p-3.5">
            <div
              className={[
                'relative mb-5 flex aspect-square w-48 max-w-full items-center justify-center overflow-hidden rounded-xl border border-[#d9e0f3] p-4 shadow-sm',
                '[@media(max-height:700px)]:mb-4 [@media(max-height:700px)]:w-40 [@media(max-height:560px)]:mb-3 [@media(max-height:560px)]:w-36 [@media(max-height:560px)]:p-3',
              ].join(' ')}
              style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}
            >
              {qrDataUrl ? (
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-white">
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={qrDataUrl}
                    size={176}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#000000"
                    className="block h-full w-full rounded-md mix-blend-multiply"
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white shadow-md [@media(max-height:560px)]:h-8 [@media(max-height:560px)]:w-8">
                    <IpfsImg
                      src={APP_LOGO_SRC}
                      alt="Beamio"
                      className="h-full w-full rounded-full object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1562f0] border-t-transparent" />
                </div>
              )}
            </div>

            <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e1e7f6] bg-[#f0f3ff] px-4 py-3 [@media(max-height:560px)]:px-3 [@media(max-height:560px)]:py-2.5">
              <span className="min-w-0 flex-1 select-all break-all font-mono text-xs font-semibold tracking-widest text-[#171c26] uppercase [@media(max-height:560px)]:text-[11px]">
                {recoveryCode || '—'}
              </span>
              <Lock className="h-[18px] w-[18px] shrink-0 text-[#1562f0]" strokeWidth={2.25} aria-hidden />
            </div>
          </div>

          {/* Actions: disable after confirm so only Next advances */}
          <div className="mb-2 flex w-full shrink-0 flex-col gap-3 [@media(max-height:700px)]:gap-2.5 [@media(max-height:560px)]:gap-2">
            <button
              type="button"
              onClick={() => void handleSaveImage()}
              disabled={isConfirmed || !qrDataUrl}
              aria-disabled={isConfirmed || !qrDataUrl}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] py-4 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-[#0f52d4] active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:700px)]:py-3.5 [@media(max-height:560px)]:py-3 [@media(max-height:560px)]:text-sm"
            >
              <Download className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              {tu('save_to_photos')}
            </button>

            {saveError ? (
              <p className="px-2 text-center text-sm font-medium leading-snug text-[#ba1a1a]" role="alert">
                {saveError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleCopyCode()}
              disabled={!recoveryCode || isConfirmed}
              aria-disabled={!recoveryCode || isConfirmed}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e9edfb] py-4 text-[15px] font-semibold text-[#171c26] transition-colors hover:bg-[#e1e7f6] active:bg-[#d9e0f3] disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:700px)]:py-3.5 [@media(max-height:560px)]:py-3 [@media(max-height:560px)]:text-sm"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                  {tu('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 shrink-0 text-[#414754]" strokeWidth={2.25} aria-hidden />
                  {tu('copy_recovery_code')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sticky footer — same page tint as shell (no white panel) */}
        <footer
          className={[
            'shrink-0 border-t border-[#e9edfb] bg-[#f9f9ff] px-6 pt-5',
            'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
            '[@media(max-height:700px)]:pt-4',
            '[@media(max-height:560px)]:px-5 [@media(max-height:560px)]:pt-3',
          ].join(' ')}
        >
          <label
            className={[
              'mb-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-[#d9e0f3] bg-[#f0f3ff] px-4 py-3 transition select-none',
              '[@media(max-height:700px)]:mb-3 [@media(max-height:560px)]:mb-2.5 [@media(max-height:560px)]:gap-2.5 [@media(max-height:560px)]:py-2.5',
              hasBackedUp ? 'text-[#414754]' : 'cursor-not-allowed opacity-60',
            ].join(' ')}
            onClick={(e) => {
              e.preventDefault()
              if (hasBackedUp) setIsConfirmed((v) => !v)
            }}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isConfirmed}
              readOnly
              disabled={!hasBackedUp}
              tabIndex={-1}
            />
            <span
              className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                isConfirmed
                  ? 'border-[#1562f0] bg-[#1562f0] text-white'
                  : hasBackedUp
                    ? 'border-[#c1c6d6] bg-white'
                    : 'border-[#d9e0f3] bg-[#e9edfb]',
              ].join(' ')}
              aria-hidden
            >
              {isConfirmed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="text-sm font-medium leading-snug [@media(max-height:560px)]:text-[13px]">
              {tu('i_have_securely_saved_my_recovery_code')}
            </span>
          </label>

          {showButton ? (
            <AppButton
              fullWidth
              rightIcon={<ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />}
              onClick={async () => {
                setLoading(true)
                await Promise.resolve(close?.())
              }}
              loading={loading && !isRedeemFlow}
              disabled={!isConfirmed}
              className={[
                'group !h-auto !min-h-0 !rounded-xl !py-4 !text-[15px] !font-semibold !shadow-none',
                '[@media(max-height:700px)]:!py-3.5 [@media(max-height:560px)]:!py-3 [@media(max-height:560px)]:!text-sm',
                'transition-colors',
                isConfirmed
                  ? '!bg-[#1562f0] !text-white !shadow-md hover:!bg-[#0f52d4] active:!bg-blue-700 focus-visible:!ring-2 focus-visible:!ring-[#1562f0]/55 focus-visible:!ring-offset-2'
                  : '!cursor-not-allowed !bg-[#d9e0f3] !text-[#727786]',
              ].join(' ')}
            >
              {isRedeemFlow ? tu('continue') : tu('next')}
            </AppButton>
          ) : null}
        </footer>
      </main>
    </div>
  )
}

export default RecoveryQRScreen