import React from 'react'
import {
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Shield,
  ArrowRight,
} from 'lucide-react'

export type OnboardingWelcomeScreenProps = {
  beamioTag?: string
  onEnterHome: () => void
}

/**
 * Post Security Backup — welcomrPage.html style success / welcome.
 */
export default function OnboardingWelcomeScreen({ beamioTag, onEnterHome }: OnboardingWelcomeScreenProps) {
  const handle = (beamioTag || '').replace(/^@+/, '').trim()
  const displayHandle = handle ? `@${handle}` : '@you'

  return (
    <div className="relative flex h-full min-h-0 w-full max-h-full flex-col overflow-x-hidden overflow-y-hidden overscroll-none bg-[#f9f9fe] text-[#1a1c1f]">
      {/* Ambient background (absolute: clipped to panel, avoids extra document scroll) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-[#004bc3]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#465c99]/5 blur-[120px]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(21, 98, 240, 0.08) 0%, rgba(249, 249, 254, 0) 70%)',
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex min-h-0 min-w-0 w-full max-w-lg flex-1 flex-col items-center justify-center gap-3 overflow-x-hidden overflow-y-hidden px-5 py-2 text-center sm:gap-4 sm:px-6 md:gap-5 pb-[max(2.75rem,env(safe-area-inset-bottom)+1.5rem)] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="relative shrink-0">
          <div
            className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-white/40 shadow-[0_8px_32px_rgba(21,98,240,0.1)] backdrop-blur-xl sm:h-44 sm:w-44 md:h-52 md:w-52"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#004bc3]/10 to-transparent" />
            <div className="relative flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-gradient-to-br from-[#004bc3] to-[#1562f0] text-white shadow-xl sm:h-28 sm:w-28 md:h-[7.5rem] md:w-[7.5rem]">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="absolute left-8 top-4 h-2 w-2 rounded-full bg-[#dbe1ff] opacity-60" />
            <div className="absolute bottom-10 right-4 h-3 w-3 rounded-full bg-[#dbe1ff] opacity-40" />
            <div className="absolute left-4 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#ffdbce] opacity-50" />
          </div>
          <div
            className="absolute -right-6 -top-6 flex h-12 w-12 rotate-12 items-center justify-center rounded-lg bg-white/80 shadow-sm backdrop-blur-xl"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <ShieldCheck className="h-7 w-7 text-[#004bc3]" strokeWidth={2} />
          </div>
          <div
            className="absolute -bottom-2 -left-8 flex h-14 w-14 -rotate-12 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-xl"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <Wallet className="h-7 w-7 text-[#465c99]" strokeWidth={2} />
          </div>
        </div>

        <div className="max-w-2xl shrink-0 space-y-2 sm:space-y-3">
          <h1 className="text-[clamp(1.75rem,7vw,2.75rem)] font-extrabold leading-[1.12] tracking-tighter text-[#1a1c1f] sm:text-4xl md:text-5xl">
            Welcome, <span className="break-all text-[#004bc3]">{displayHandle}</span>
          </h1>
          <p className="mx-auto max-w-md text-sm font-medium leading-snug text-[#424655] sm:text-base md:text-lg md:leading-relaxed">
            Your high-security digital perimeter is now active and ready for your first transaction.
          </p>
        </div>

        <div className="grid w-full max-w-md shrink-0 grid-cols-1">
          <div className="flex flex-col gap-2 rounded-lg bg-[#f3f3f8] p-4 text-left sm:p-5">
            <Shield className="h-6 w-6 text-[#004bc3]" strokeWidth={2} aria-hidden />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#424655]">Security Status</p>
              <p className="font-semibold text-[#1a1c1f]">Fortified</p>
            </div>
          </div>

        </div>

        <div className="w-full max-w-sm shrink-0 space-y-2 sm:space-y-3">
          <button
            type="button"
            onClick={onEnterHome}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#004bc3] to-[#1562f0] text-base font-bold text-white shadow-[0_8px_24px_rgba(21,98,240,0.25)] transition-all hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f9fe] sm:h-16 sm:gap-3 sm:text-lg"
          >
            Enter Home
            <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} aria-hidden />
          </button>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#424655] sm:text-xs sm:tracking-[0.2em]">Next: Secure Account Activation</p>
        </div>
      </main>

      {/* Bottom activation peek */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-30 h-2 w-full shrink-0 bg-[#e8e8ed] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div
          className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-full items-center gap-2 rounded-t-xl bg-white px-4 py-1.5 shadow-sm backdrop-blur-xl"
          style={{ WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div className="h-2 w-2 rounded-full bg-[#004bc3]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#424655]">Activation Pending</span>
        </div>
      </div>
    </div>
  )
}
