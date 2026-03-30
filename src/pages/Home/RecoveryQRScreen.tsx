import React, { useState, useRef, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Check, Loader, KeyRound, Lock, Wifi, RefreshCw, Building2, ShieldCheck, ImageDown, ArrowRight } from 'lucide-react'
import bIcon from '@/components/assets/logo512.png'
import { bizBrandFocusRingClass, bizBrandOnboardingPrimaryBtnClass } from '@/pages/Home/brandUi'

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

const RecoveryQRScreen = ({
  qrDataUrl,
  recoveryCode,
  showButton,
  beamioTag,
  isRedeemFlow = false,
  redeemActivating = false,
  close
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

  return (
    <div
      className="flex min-h-full w-full flex-col text-[#0f172a]"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `radial-gradient(at 50% 0%, rgba(21, 98, 240, 0.05) 0%, transparent 70%)`,
      }}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-10 px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:grid-cols-2 lg:gap-12 lg:py-10">
        {/* Left: editorial (align with Step 1 onboarding) */}
        <div className="flex flex-col space-y-8 lg:pr-12">
          <header className="px-0 pt-2 pb-2 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1562f0] text-white">
                <Building2 className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#1562f0]">Verra Business</span>
            </div>
          </header>

          <div className="space-y-6">
            <div className="mb-1 hidden items-center gap-2 lg:flex">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1562f0] text-white">
                <Building2 className="h-6 w-6" strokeWidth={2.25} aria-hidden />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-[#1562f0]">Verra Business</span>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0f172a] sm:text-4xl lg:text-5xl">
              Secure your <span className="text-[#1562f0]">business</span> access.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-[#64748b] lg:text-lg">
              The Recovery Key is the only way to restore access to your business account and assets if you lose access.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0]/80 bg-[#f8fafc]/80 p-6 lg:p-8">
              <KeyRound className="h-6 w-6 text-[#1562f0]" strokeWidth={1.75} aria-hidden />
              <h3 className="font-bold text-[#0f172a]">Account Continuity</h3>
              <p className="text-sm leading-relaxed text-[#64748b]">Keep this key in a safe, physical location.</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-[#e2e8f0]/80 bg-[#f8fafc]/80 p-6 lg:p-8">
              <ShieldCheck className="h-6 w-6 text-[#1562f0]" strokeWidth={1.75} aria-hidden />
              <h3 className="font-bold text-[#0f172a]">Permanent Access</h3>
              <p className="text-sm leading-relaxed text-[#64748b]">
                Verra cannot reset this key for you. Permanent access belongs solely to you.
              </p>
            </div>
          </div>

          <div className="relative hidden aspect-video overflow-hidden rounded-2xl border border-[#e2e8f0]/60 bg-gradient-to-b from-[#f8faff] to-[#eff4ff] lg:block">
            <div
              className="absolute h-px w-full bg-gradient-to-r from-transparent via-[#1562f0]/10 to-transparent"
              style={{ top: '30%' }}
            />
            <div
              className="absolute h-px w-full bg-gradient-to-r from-transparent via-[#1562f0]/10 to-transparent opacity-50"
              style={{ top: '60%' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-3">
                <div className="h-1 w-12 rounded-full bg-[#1562f0]/10" />
                <div className="h-1 w-24 rounded-full bg-[#1562f0]/20" />
                <div className="h-1 w-16 rounded-full bg-[#1562f0]/10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white/40 to-transparent p-6">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#1562f0]/70">Verra Workspace Infrastructure</span>
            </div>
          </div>
        </div>

        {/* Right: recovery card — newOnloading.html style */}
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="rounded-2xl border border-[#e2e8f0]/80 bg-white/95 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="mb-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[#1562f0]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1562f0]">
                  Step 2 of 2
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b]">Recovery setup</span>
              </div>
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-[#0f172a]">Secure your recovery key</h2>
              <p className="text-sm leading-relaxed text-[#64748b]">
                This key helps restore access to your business account if you lose this device or need to recover admin access.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-[#e2e8f0]/80 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="mb-6 flex h-44 w-44 items-center justify-center rounded-xl border border-[#f1f5f9] bg-[#f8fafc] p-3">
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
                      src: bIcon,
                      height: 36,
                      width: 36,
                      excavate: true,
                    }}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="h-40 w-40 animate-pulse rounded-lg bg-[#e2e8f0]" />
                )}
              </div>

              <div className="mb-2 w-full rounded-xl border border-[#f1f5f9] bg-[#f8fafc] py-4">
                <code className="block select-all break-all px-3 text-center font-mono text-base font-bold tracking-tight text-[#1562f0] md:text-lg">
                  {displayRecoveryKey || '—'}
                </code>
              </div>
              <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1562f0]/80">Business recovery key</p>

              <div className="grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSaveImage}
                  className={`flex items-center justify-center gap-2 rounded-full border border-[#f1f5f9] bg-white py-3.5 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] active:scale-[0.98] ${bizBrandFocusRingClass}`}
                >
                  <ImageDown className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  Save key image
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className={`flex items-center justify-center gap-2 rounded-full border border-[#f1f5f9] bg-white py-3.5 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#f8fafc] active:scale-[0.98] ${bizBrandFocusRingClass}`}
                >
                  {copied ? (
                    <>
                      <Check className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                      Recovery key
                    </>
                  )}
                </button>
              </div>
            </div>

            <div
              className={`mt-8 rounded-xl border border-[#e2e8f0]/60 bg-[#f8fafc]/50 p-5 transition-opacity ${hasBackedUp ? 'opacity-100' : 'opacity-50'}`}
            >
              <label className={`flex cursor-pointer items-start gap-4 ${!hasBackedUp ? 'cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[#cbd5e1] text-[#1562f0] focus:ring-[#1562f0]/20"
                  checked={isConfirmed}
                  disabled={!hasBackedUp}
                  onChange={(e) => hasBackedUp && setIsConfirmed(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight text-[#0f172a]">I have safely stored my recovery key</span>
                  <span className="mt-2 block text-sm leading-relaxed text-[#64748b]">
                    Keep this key in a secure place. You&apos;ll need it to restore business access if this device is lost, replaced, or reset.
                  </span>
                </span>
              </label>
            </div>

            {showButton ? (
              <div className="mt-8 pt-2">
                <AppButton
                  fullWidth
                  onClick={async () => {
                    setLoading(true)
                    await Promise.resolve(close?.())
                  }}
                  loading={loading && !isRedeemFlow}
                  disabled={!isConfirmed}
                  className={`flex h-14 items-center justify-center gap-2 rounded-full text-base font-bold transition-all duration-200 sm:h-16 sm:text-lg ${
                    isConfirmed
                      ? `${bizBrandOnboardingPrimaryBtnClass} ${bizBrandFocusRingClass} shadow-[0_8px_20px_rgba(21,98,240,0.2)]`
                      : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
                  }`}
                >
                  {isRedeemFlow ? 'Continue' : 'Continue to Business Setup'}
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                </AppButton>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecoveryQRScreen