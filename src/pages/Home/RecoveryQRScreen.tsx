import React, { useState, useRef, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Check, Loader, KeyRound, Lock, Wifi, RefreshCw, ImageDown, ArrowRight } from 'lucide-react'
import { BIZ_PUBLIC_LOGO512, bizBrandFocusRingClass, bizBrandOnboardingPrimaryBtnClass } from '@/pages/Home/brandUi'

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
	if (/^verra-/i.test(trimmed)) return trimmed.toUpperCase()
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
    link.download = `${toSafeFilename(beamioTag ?? '')}.png`
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
          <div className="w-20 h-20 bg-[#1562f0] rounded-[28px] flex items-center justify-center shadow-xl shadow-[#1562f0]/40">
            <Loader className="w-9 h-9 text-white animate-spin" strokeWidth={2.5} />
          </div>
          <div className="absolute -inset-4 bg-[#1562f0] rounded-[40px] opacity-10 blur-xl animate-pulse" />
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

  const displayRecoveryKey = formatRecoveryKeyForDisplay(recoveryCode)
  const showTopNav = typeof onBack === 'function'

  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col bg-[#f8fafc] antialiased text-[#0f172a]"
      style={{
        backgroundImage: `radial-gradient(at 50% 0%, rgba(21, 98, 240, 0.05) 0%, transparent 70%)`,
      }}
    >
      {showTopNav ? (
        <nav
          className="fixed left-0 right-0 top-0 z-[60] flex h-14 min-h-[3.5rem] items-center justify-end border-b border-[#e2e8f0]/30 bg-white/80 px-6 backdrop-blur-md"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <span className="rounded-full bg-[#1562F0]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1562F0]">
            Step 2 of 2
          </span>
        </nav>
      ) : null}

      <main
        className={`mx-auto flex w-full max-w-lg flex-grow flex-col px-6 pb-[calc(3rem+env(safe-area-inset-bottom))] ${
          showTopNav ? 'pt-[calc(4.5rem+env(safe-area-inset-top))]' : 'pt-6'
        }`}
      >
        {showTopNav ? null : (
          <div className="mb-6 flex justify-end">
            <span className="rounded-full bg-[#1562F0]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1562F0]">
              Step 2 of 2
            </span>
          </div>
        )}

        <header className="mb-10">
          <h1
            className={`${headlineClass} mb-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#0f172a]`}
          >
            Protect your business access.
          </h1>
          <p className="text-base leading-relaxed text-[#64748b]">
            Save your recovery key so you can restore access to your Verra Business workspace if this device is lost or replaced.
          </p>
        </header>

        <section className="mb-8">
          <div className="flex flex-col items-center rounded-xl border border-[#e2e8f0]/50 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span className="mb-8 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1562F0]/80">
              Business recovery key
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
                Save key image
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`flex items-center justify-center gap-2 rounded-full border border-[#f1f5f9] bg-white py-3.5 text-sm font-semibold text-[#0f172a] transition-all hover:bg-[#f1f5f9]/30 active:scale-95 ${bizBrandFocusRingClass}`}
              >
                {copied ? (
                  <>
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                    Copy recovery key
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
                I have safely stored my recovery key
              </span>
              <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
                Keep this key in a secure place. You&apos;ll need it to restore business access on a new or reset device.
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
                await Promise.resolve(close?.())
              }}
              loading={loading && !isRedeemFlow}
              disabled={!isConfirmed}
              className={`${headlineClass} flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full py-5 text-lg font-bold transition-all active:scale-[0.98] ${
                isConfirmed
                  ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass} shadow-[0_8px_20px_rgba(21,98,240,0.2)] hover:opacity-90`
                  : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
              }`}
            >
              Continue
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
            </AppButton>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default RecoveryQRScreen