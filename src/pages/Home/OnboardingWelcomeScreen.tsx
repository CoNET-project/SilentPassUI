import React, { useState } from 'react'
import { tu } from '@/locale/beamioLocale'
import { Check, ShieldCheck, BookMarked, ArrowRight, Loader2 } from 'lucide-react'

export type OnboardingWelcomeScreenProps = {
  beamioTag?: string
  onEnterHome: () => void | Promise<void>
}

/**
 * Post Security Backup — welcome / passport-active success (Beamio Welcome mockup).
 */
export default function OnboardingWelcomeScreen({ beamioTag, onEnterHome }: OnboardingWelcomeScreenProps) {
  const [entering, setEntering] = useState(false)
  const handle = (beamioTag || '').replace(/^@+/, '').trim()
  const displayHandle = handle ? `@${handle}` : '@you'

  const handleEnterHome = () => {
    if (entering) return
    setEntering(true)
    void Promise.resolve(onEnterHome()).catch(() => {
      setEntering(false)
    })
  }

  return (
    <div className="relative flex h-full min-h-0 w-full max-h-full flex-col overflow-x-hidden overflow-y-hidden overscroll-none bg-[#f9f9ff] text-[#151c27] antialiased">
      <style>{`
        @keyframes onboardingWelcomeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes onboardingWelcomeFloatRot12 {
          0%, 100% { transform: translateY(0) rotate(12deg); }
          50% { transform: translateY(-10px) rotate(12deg); }
        }
        @keyframes onboardingWelcomeFloatRotNeg12 {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-10px) rotate(-12deg); }
        }
        .onboarding-welcome-float {
          animation: onboardingWelcomeFloat 6s ease-in-out infinite;
        }
        .onboarding-welcome-float-rot12 {
          animation: onboardingWelcomeFloatRot12 6s ease-in-out infinite;
          animation-delay: -1s;
        }
        .onboarding-welcome-float-rot-neg12 {
          animation: onboardingWelcomeFloatRotNeg12 6s ease-in-out infinite;
          animation-delay: -2s;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(226, 232, 248, 0.5) 0%, transparent 70%)',
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex min-h-0 min-w-0 w-full max-w-md flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-hidden px-6 py-2 text-center pb-[max(4.5rem,env(safe-area-inset-bottom)+3rem)] pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Central celebration graphic */}
        <div className="onboarding-welcome-float relative mb-8 flex shrink-0 items-center justify-center sm:mb-10">
          <div
            className="absolute h-48 w-48 animate-ping rounded-full bg-[#004bc3]/5"
            style={{ animationDuration: '3s' }}
            aria-hidden
          />
          <div
            className="absolute h-32 w-32 rounded-full bg-[#004bc3]/10"
            style={{ boxShadow: '0 0 60px 20px rgba(0, 75, 195, 0.15)' }}
            aria-hidden
          />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-[#004bc3]/55 shadow-lg shadow-[#004bc3]/25 backdrop-blur-[2px]">
            <Check className="h-10 w-10 text-white drop-shadow-sm" strokeWidth={3} aria-hidden />
          </div>
          <div className="onboarding-welcome-float-rot12 absolute -top-4 right-4 z-0 rounded-xl bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <ShieldCheck className="h-6 w-6 text-[#004bc3]" strokeWidth={2} aria-hidden />
          </div>
          <div className="onboarding-welcome-float-rot-neg12 absolute -bottom-2 left-0 z-0 rounded-xl bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <BookMarked className="h-6 w-6 text-[#004bc3]" strokeWidth={2} aria-hidden />
          </div>
        </div>

        {/* Welcome typography */}
        <div className="mb-8 w-full shrink-0 space-y-2 sm:mb-10">
          <h1 className="text-[clamp(1.5rem,6vw,2rem)] font-bold leading-10 tracking-tight text-[#151c27]">
            {tu('welcome_aboard')}{' '}
            <span className="break-all text-[#004bc3]">{displayHandle}</span>
          </h1>
          <p className="mx-auto max-w-[280px] text-base font-normal leading-6 text-[#424655]">
            {tu('onboarding_welcome_passport_body')}
          </p>
        </div>

        {/* Status card */}
        <div className="mb-8 flex w-full shrink-0 items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:mb-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e7eefe]">
            <ShieldCheck className="h-6 w-6 text-[#004bc3]" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#737687]">
              {tu('status')}
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#151c27]">
              {tu('passport_active')}
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
            </p>
          </div>
        </div>

        {/* Primary action */}
        <div className="w-full shrink-0 space-y-4">
          <button
            type="button"
            onClick={handleEnterHome}
            disabled={entering}
            aria-busy={entering}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#004bc3] text-sm font-semibold text-white shadow-lg shadow-[#004bc3]/20 transition-all hover:bg-[#004bc3]/90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f9ff] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {entering ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} aria-hidden />
                {tu('entering_home')}
              </>
            ) : (
              <>
                {tu('enter_home')}
                <ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </>
            )}
          </button>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#737687]">
            {tu('next_secure_account_activation')}
          </p>
        </div>
      </main>

      {/* Bottom indicator */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#004bc3]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#424655]">
            {tu('activation_pending')}
          </span>
        </div>
      </div>
    </div>
  )
}
