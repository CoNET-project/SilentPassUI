import React, { useState, useRef, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Check, Loader, KeyRound, Lock, Wifi, RefreshCw, ImageDown, ArrowRight } from 'lucide-react'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass, bizBrandOnboardingPrimaryBtnClass } from '@/pages/Home/brandUi'
import { BizOnboardingLocalePicker } from '@/pages/Home/BizOnboardingLocalePicker'
import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'

export const ACTIVATING_STEP_DEFS = [
  { id: 0, titleKey: 'onb_recovery_activate_step0_title', descKey: 'onb_recovery_activate_step0_desc', icon: KeyRound },
  { id: 1, titleKey: 'onb_recovery_activate_step1_title', descKey: 'onb_recovery_activate_step1_desc', icon: Lock },
  { id: 2, titleKey: 'onb_recovery_activate_step2_title', descKey: 'onb_recovery_activate_step2_desc', icon: Wifi },
  { id: 3, titleKey: 'onb_recovery_activate_step3_title', descKey: 'onb_recovery_activate_step3_desc', icon: RefreshCw },
] as const
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
  /** Optional; when set, fixed top bar shows step chip only (back / title removed per product). */
  onBack?: () => void
}

/** 将 beamio tag 转为安全文件名（去除 @ 和非法字符） */
const toSafeFilename = (tag: string) =>
  tag
    .trim()
    .replace(/^@+/, '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-') || 'beamio-master-key'

/** Display-only grouping (clipboard still uses raw `recoveryCode`). */
function formatRecoveryKeyForDisplay(code: string): string {
	if (!code) return ''
	const trimmed = code.trim()
	if (/^(verra-|beamio-)/i.test(trimmed)) return trimmed.toUpperCase()
	const alnum = trimmed.replace(/[^a-zA-Z0-9]/g, '')
	if (alnum.length === 0) return trimmed
	const groups = alnum.toUpperCase().match(/.{1,4}/g) ?? []
	return groups.join('-')
}

const headlineClass = "font-['Manrope',ui-sans-serif,system-ui,sans-serif]"

const RecoveryQRScreen = ({
  qrDataUrl,
  recoveryCode,
  showButton,
  beamioTag,
  isRedeemFlow = false,
  redeemActivating = false,
  close,
  onBack,
}: RecoveryQRScreenProps) => {
  const { tu } = useTu()
  const uiLocale = getCurrentBeamioUiLocale()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [activatingStep, setActivatingStep] = useState(0)
  const [hasBackedUp, setHasBackedUp] = useState(false)

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

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

  const handleSaveImage = () => {
    if (!qrCanvasRef.current) return
    const dataUrl = qrCanvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${toSafeFilename(beamioTag ?? '')}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setHasBackedUp(true)
  }

  const handleCopyCode = async () => {
    if (!recoveryCode) return
    try {
      await navigator.clipboard.writeText(recoveryCode)
      setCopied(true)
      setHasBackedUp(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (isActivating) {
    return (
      <div
        key={uiLocale}
        className="flex flex-col h-full items-center justify-center p-8 bg-white min-h-0 overflow-y-auto"
      >
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-[#1562f0] rounded-[28px] flex items-center justify-center shadow-xl shadow-[#1562f0]/40">
            <Loader className="w-9 h-9 text-white animate-spin" strokeWidth={2.5} />
          </div>
          <div className="absolute -inset-4 bg-[#1562f0] rounded-[40px] opacity-10 blur-xl animate-pulse" />
        </div>
        <div className="w-full max-w-sm space-y-6">
          {ACTIVATING_STEP_DEFS.map((step, idx) => {
            const isCompleted = idx < activatingStep
            const isActive = idx === activatingStep
            const Icon = step.icon
            return (
              <div key={step.id} className="flex items-start gap-4">
                <div
                  className={[
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isCompleted && 'bg-emerald-500',
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
                    <Icon className="w-5 h-5 text-slate-400" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={[
                      'font-semibold text-[15px] transition-colors',
                      isActive && 'text-[#1562f0]',
                      isCompleted && 'text-slate-700',
                      !isCompleted && !isActive && 'text-slate-400',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {tu(step.titleKey)}
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
                    {tu(step.descKey)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const displayRecoveryKey = formatRecoveryKeyForDisplay(recoveryCode)
  const showTopNav = typeof onBack === 'function'

  return (
    <div
      key={uiLocale}
      className="flex min-h-0 w-full flex-1 flex-col bg-[#f8fafc] antialiased text-[#0f172a]"
      style={{
        backgroundImage: `radial-gradient(at 50% 0%, rgba(21, 98, 240, 0.05) 0%, transparent 70%)`,
      }}
    >
      {showTopNav ? (
        <nav
          className="fixed left-0 right-0 top-0 z-[60] flex h-14 min-h-[3.5rem] items-center justify-between gap-3 border-b border-[#e2e8f0]/30 bg-white/80 px-6 backdrop-blur-md"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <span className="rounded-full bg-[#1562F0]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1562F0]">
            {tu('onb_recovery_step_badge')}
          </span>
          <BizOnboardingLocalePicker />
        </nav>
      ) : null}

      <main
        className={`mx-auto flex w-full max-w-lg flex-grow flex-col px-6 pb-[calc(3rem+env(safe-area-inset-bottom))] ${
          showTopNav ? 'pt-[calc(4.5rem+env(safe-area-inset-top))]' : 'pt-6'
        }`}
      >
        {showTopNav ? null : (
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#1562F0]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1562F0]">
              {tu('onb_recovery_step_badge')}
            </span>
            <BizOnboardingLocalePicker />
          </div>
        )}

        <header className="mb-10">
          <h1
            className={`${headlineClass} mb-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#0f172a]`}
          >
            {tu('onb_recovery_title')}
          </h1>
          <p className="text-base leading-relaxed text-[#64748b]">
            {tu('onb_recovery_sub')}
          </p>
        </header>

        <section className="mb-8">
          <div className="flex flex-col items-center rounded-xl border border-[#e2e8f0]/50 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="mb-8 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1562F0]/80">
              {tu('onb_recovery_key_label')}
            </span>

            <div className="mb-8 flex h-44 w-44 items-center justify-center rounded-xl border border-[#f1f5f9] bg-[#f8fafc] p-4">
              {qrDataUrl ? (
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={qrDataUrl}
                  size={160}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#000000"
                  imageSettings={{
                    src: BIZ_PUBLIC_LOGO512,
                    height: 36,
                    width: 36,
                    excavate: true,
                  }}
                  className="h-full w-full rounded-lg object-contain"
                />
              ) : (
                <div className="h-full w-full animate-pulse rounded-lg bg-[#e2e8f0]" />
              )}
            </div>

            <div className="mb-8 w-full rounded-xl border border-[#f1f5f9] bg-[#f8fafc] px-4 py-4">
              <code
                className={`${headlineClass} block select-all text-center text-base font-bold tracking-normal text-[#0f172a] md:text-lg`}
              >
                {displayRecoveryKey || '—'}
              </code>
            </div>

            <div className="grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSaveImage}
                className={`flex items-center justify-center gap-2 rounded-full border border-[#f1f5f9] bg-white py-3.5 text-sm font-semibold text-[#0f172a] transition-all hover:bg-[#f1f5f9]/30 active:scale-95 ${bizBrandFocusRingClass}`}
              >
                <ImageDown className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                {tu('onb_recovery_save_image')}
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`flex items-center justify-center gap-2 rounded-full border border-[#f1f5f9] bg-white py-3.5 text-sm font-semibold text-[#0f172a] transition-all hover:bg-[#f1f5f9]/30 active:scale-95 ${bizBrandFocusRingClass}`}
              >
                {copied ? (
                  <>
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                    <span className="text-emerald-700">{tu('onb_recovery_copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                    {tu('onb_recovery_copy_key')}
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <section
          className={`mb-10 rounded-xl border border-[#e2e8f0]/40 bg-white/50 p-5 transition-opacity ${hasBackedUp ? 'opacity-100' : 'opacity-50'}`}
        >
          <label className={`group flex cursor-pointer items-start gap-4 ${!hasBackedUp ? 'cursor-not-allowed' : ''}`}>
            <div className="pt-0.5">
              <input
                type="checkbox"
                className="h-6 w-6 cursor-pointer rounded-md border-[#e2e8f0] text-[#1562F0] transition-all focus:ring-[#1562F0]/20"
                checked={isConfirmed}
                disabled={!hasBackedUp}
                onChange={(e) => hasBackedUp && setIsConfirmed(e.target.checked)}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-semibold leading-tight text-[#0f172a]">
                {tu('onb_recovery_confirm_label')}
              </span>
              <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
                {tu('onb_recovery_confirm_body')}
              </p>
            </div>
          </label>
        </section>

        {showButton ? (
          <div className="mt-auto pt-4">
            <AppButton
              fullWidth
              onClick={async () => {
                setLoading(true)
                try {
                  await Promise.resolve(close?.())
                } finally {
                  setLoading(false)
                }
              }}
              loading={loading && !isRedeemFlow}
              disabled={!isConfirmed}
              className={`${headlineClass} flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full py-5 text-lg font-bold transition-all active:scale-[0.98] ${
                isConfirmed
                  ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass} shadow-[0_8px_20px_rgba(21,98,240,0.2)] hover:opacity-90`
                  : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
              }`}
            >{tu('continue')}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
            </AppButton>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default RecoveryQRScreen
