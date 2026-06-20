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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-[#1a1c1f]">
      {showTopAppBar && (
        <header className="flex w-full shrink-0 items-center justify-between border-b border-[#e8e8ed]/90 bg-white px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3">
          <button
            type="button"
            onClick={() => canUseTopBack && onBack?.()}
            disabled={!canUseTopBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#e8e8ed] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            aria-label={tu('back')}
          >
            <ArrowLeft className="h-6 w-6 text-[#1562f0]" strokeWidth={2.25} />
          </button>
          <div className="flex min-w-0 flex-1 justify-center px-1">
            {topBarBrand === 'Beamio' ? (
              <VerraBrandLockup variant="onLight" size="compact" />
            ) : (
              <span className="text-lg font-bold tracking-tighter text-[#1a1c1f]">{topBarBrand}</span>
            )}
          </div>
          <div className="h-10 w-10" aria-hidden />
        </header>
      )}

      <main
        className={[
          'mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] [@media(max-height:640px)]:px-4 [@media(max-height:560px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]',
          showTopAppBar
            ? 'pt-3 [@media(max-height:700px)]:pt-2 [@media(max-height:560px)]:pt-1'
            : 'pt-[calc(env(safe-area-inset-top)+3.75rem)] [@media(max-height:760px)]:pt-[calc(env(safe-area-inset-top)+2.75rem)] [@media(max-height:700px)]:pt-[calc(env(safe-area-inset-top)+2rem)] [@media(max-height:640px)]:pt-[calc(env(safe-area-inset-top)+1.25rem)] [@media(max-height:560px)]:pt-[calc(env(safe-area-inset-top)+0.75rem)]',
        ].join(' ')}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-5 shrink-0 text-center md:text-left [@media(max-height:760px)]:mb-4 [@media(max-height:700px)]:mb-3 [@media(max-height:640px)]:mb-2 [@media(max-height:560px)]:mb-1.5">
            <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-[#1a1c1f] [@media(max-height:700px)]:text-[22px] [@media(max-height:640px)]:text-xl [@media(max-height:560px)]:text-lg">
              {tu('security_backup')}
            </h1>
            <div className="space-y-0.5 text-sm font-medium leading-snug text-[#424655] [@media(max-height:700px)]:text-[13px] [@media(max-height:640px)]:text-[12px] [@media(max-height:560px)]:hidden">
              <p>{tu('your_recovery_code_is_your_master_key')}</p>
              <p>{tu('if_you_lose_your_phone')}</p>
              <p>{tu('this_is_the_only_way_to_get_your_funds_back')}</p>
            </div>
          </div>

          <section className="min-h-0 shrink py-1 [@media(max-height:700px)]:py-0.5 [@media(max-height:560px)]:py-0">
            <div className="relative mx-auto w-full max-w-[272px] shrink [@media(max-height:700px)]:max-w-[220px] [@media(max-height:640px)]:max-w-[180px] [@media(max-height:560px)]:max-w-[156px]">
              <div className="absolute inset-0 rounded-full bg-[#1562f0] opacity-[0.06] blur-2xl [@media(max-height:700px)]:blur-xl" />
              <div className="relative flex flex-col items-center rounded-2xl border border-[#e8e8ed]/80 bg-white/95 p-4 shadow-sm backdrop-blur-sm [@media(max-height:700px)]:p-3 [@media(max-height:640px)]:p-2 [@media(max-height:560px)]:rounded-xl [@media(max-height:560px)]:p-1.5">
                <div className="relative mb-3 flex h-[208px] w-[208px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e2e2e7] p-2 [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:h-[160px] [@media(max-height:700px)]:w-[160px] [@media(max-height:640px)]:mb-1.5 [@media(max-height:640px)]:h-[128px] [@media(max-height:640px)]:w-[128px] [@media(max-height:640px)]:p-1 [@media(max-height:560px)]:mb-1 [@media(max-height:560px)]:h-[108px] [@media(max-height:560px)]:w-[108px]">
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
                        className="block h-full w-full rounded-md"
                      />
                      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[14px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] [@media(max-height:700px)]:h-10 [@media(max-height:700px)]:w-10 [@media(max-height:700px)]:rounded-[12px] [@media(max-height:640px)]:h-8 [@media(max-height:640px)]:w-8 [@media(max-height:640px)]:rounded-[10px]">
                        <IpfsImg
                          src={APP_LOGO_SRC}
                          alt="Beamio"
                          className="h-full w-full rounded-[10px] object-contain [@media(max-height:700px)]:rounded-[9px] [@media(max-height:640px)]:rounded-[8px]"
                          draggable={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full min-h-[120px] animate-pulse rounded-md bg-slate-200/90" />
                  )}
                </div>
                <div className="relative z-10 flex min-w-0 w-full items-center justify-between gap-2 rounded-md bg-[#f3f3f8] px-3 py-2.5 [@media(max-height:700px)]:py-2 [@media(max-height:640px)]:px-2 [@media(max-height:640px)]:py-1.5 [@media(max-height:560px)]:py-1">
                  <span className="select-all break-all font-mono text-xs font-medium tracking-widest text-[#1a1c1f] uppercase [@media(max-height:640px)]:text-[11px] [@media(max-height:560px)]:text-[10px]">
                    {recoveryCode || '—'}
                  </span>
                  <Lock className="h-4 w-4 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
                </div>
              </div>
            </div>
          </section>

          {/* Save / Copy 两个按钮：勾选 "I have securely saved..." 后保留可见但 disable，
              只允许通过下方 Next/Continue 推进，避免确认后又被误触备份操作 */}
          <div className="flex shrink-0 flex-col gap-2 pt-1 [@media(max-height:700px)]:gap-1.5 [@media(max-height:700px)]:pt-0.5 [@media(max-height:560px)]:gap-1">
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isConfirmed}
              aria-disabled={isConfirmed}
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#004bc3] to-[#1562f0] px-6 py-3 text-base font-bold text-white shadow-md transition-transform hover:opacity-[0.96] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:from-[#737687] disabled:to-[#737687] [@media(max-height:700px)]:py-2.5 [@media(max-height:700px)]:text-[15px] [@media(max-height:640px)]:py-2 [@media(max-height:640px)]:text-sm [@media(max-height:560px)]:py-1.5 [@media(max-height:560px)]:text-[13px]"
            >
              <Download className="h-5 w-5 [@media(max-height:640px)]:h-4 [@media(max-height:640px)]:w-4" strokeWidth={2.5} />
              {tu('save_to_photos')}
            </button>

            {saveError ? (
              <p className="px-2 text-center text-[12px] font-semibold leading-snug text-[#ba1a1a]">
                {saveError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!recoveryCode || isConfirmed}
              aria-disabled={!recoveryCode || isConfirmed}
              className="flex items-center justify-center gap-2 rounded-full bg-[#e8e8ed] px-6 py-3 text-base font-bold text-[#1a1c1f] transition-colors hover:bg-[#e2e2e7] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:700px)]:py-2.5 [@media(max-height:700px)]:text-[15px] [@media(max-height:640px)]:py-2 [@media(max-height:640px)]:text-sm [@media(max-height:560px)]:py-1.5 [@media(max-height:560px)]:text-[13px]"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 text-[#1562f0] [@media(max-height:640px)]:h-4 [@media(max-height:640px)]:w-4" strokeWidth={2.5} />
                  {tu('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 [@media(max-height:640px)]:h-4 [@media(max-height:640px)]:w-4" strokeWidth={2.5} />
                  {tu('copy_recovery_code')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 固定底栏：confirm 复选框 + Next 按钮，永远可见，不进入滚动区。
            shrink-0 + 主轴外，确保 iPhone SE 等小屏不会把它顶出可视区。 */}
        <div className="shrink-0 pt-2 [@media(max-height:700px)]:pt-1.5 [@media(max-height:560px)]:pt-1">
          <div
            className={[
              'rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3 transition-opacity duration-300 [@media(max-height:700px)]:p-2.5 [@media(max-height:640px)]:p-2 [@media(max-height:560px)]:p-1.5',
              hasBackedUp ? 'opacity-100' : 'cursor-not-allowed opacity-40',
            ].join(' ')}
          >
            <label
              className={`flex items-center gap-3 ${hasBackedUp ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              onClick={(e) => {
                e.preventDefault()
                if (hasBackedUp) setIsConfirmed((v) => !v)
              }}
            >
              <div className="pointer-events-none relative flex shrink-0 items-center justify-center">
                <input type="checkbox" className="peer sr-only" checked={isConfirmed} readOnly disabled={!hasBackedUp} />
                <div
                  className={[
                    'flex h-5 w-5 items-center justify-center rounded-md transition-colors',
                    isConfirmed ? 'bg-[#004bc3]' : 'bg-[#e2e2e7]',
                  ].join(' ')}
                >
                  {isConfirmed && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </div>
              </div>
              <span className="select-none text-sm font-medium text-[#1a1c1f] leading-snug [@media(max-height:700px)]:text-[13px] [@media(max-height:640px)]:text-[12px] [@media(max-height:560px)]:text-[11px]">
                {tu('i_have_securely_saved_my_recovery_code')}
              </span>
            </label>
          </div>

          {showButton && (
            <div className="mt-2 pt-1 pb-2 [@media(max-height:700px)]:mt-1.5 [@media(max-height:700px)]:pb-1 [@media(max-height:640px)]:mt-1 [@media(max-height:640px)]:pb-0 [@media(max-height:560px)]:mt-0.5 [@media(max-height:560px)]:pt-0">
              <AppButton
                fullWidth
                rightIcon={<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />}
                onClick={async () => {
                  setLoading(true)
                  await Promise.resolve(close?.())
                }}
                loading={loading && !isRedeemFlow}
                disabled={!isConfirmed}
                className={`
                  group !h-auto min-h-[52px] rounded-full !py-3 !text-base !font-bold !shadow-none [@media(max-height:700px)]:!min-h-[46px] [@media(max-height:700px)]:!py-2.5 [@media(max-height:700px)]:!text-[15px] [@media(max-height:640px)]:!min-h-[42px] [@media(max-height:640px)]:!py-2 [@media(max-height:640px)]:!text-sm [@media(max-height:560px)]:!min-h-[36px] [@media(max-height:560px)]:!py-1.5 [@media(max-height:560px)]:!text-[13px]
                  transition-all duration-200
                  ${isConfirmed
                    ? '!bg-[#004bc3] hover:!bg-[#003fa5] active:!scale-[0.98] !text-white !shadow-lg focus-visible:!ring-2 focus-visible:!ring-[#1562f0]/75 focus-visible:!ring-offset-2 focus-visible:!ring-offset-white'
                    : '!cursor-not-allowed !bg-[#d9dade] !text-[#737687]'}
                `}
              >
                {isRedeemFlow ? tu('continue') : tu('next')}
              </AppButton>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default RecoveryQRScreen