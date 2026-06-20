import { X, Lock, Smartphone, Info, Clock } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'
import { tu } from '@/locale/beamioLocale'

type prof = {
	colse: () => void
}

export default function BeamioPasskeyFaceIDSettingsScreen({colse}:prof) {
  return (
    <div className="">
      {/* Dim background */}
      <div className="" />

      {/* Right-side sheet */}
      <aside className="">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Lock className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Passkey &amp; Face ID</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure how Beamio should lock on this device. In this early version, this screen is UI-only and app lock is not live yet.
              </p>
            </div>
          </div>

        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3">
            <div className="mt-0.5">
              <Info className="h-4 w-4 text-sky-500" />
            </div>
            <div className="space-y-1 text-[11px] leading-relaxed text-slate-700">
              <p>
                Beamio uses a non-custodial wallet. When passkeys are enabled, your private key will be stored as a
                passkey on this device via WebAuthn / Face ID / Touch ID. Beamio never sees or stores your passkey.
              </p>
              <p>
                In the current version, these settings are placeholders to show the planned security model. Locking the app with passkey / Face ID / passcode is not active yet.
              </p>
            </div>
          </div>

          {/* Lock method */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Lock method</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Smartphone className="h-3 w-3" />
                <span>This device only</span>
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <button className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-slate-500 cursor-not-allowed">
                <span>Browser passkey / Face ID</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Coming soon</span>
              </button>
              <button className="w-full h-11 px-4 rounded-2xl border border-dashed border-slate-200 bg-white flex items-center justify-between text-slate-400 cursor-not-allowed">
                <span>Numeric passcode</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Planned</span>
              </button>
              <button className="w-full h-11 px-4 rounded-2xl border border-slate-100 bg-white flex items-center justify-between text-slate-700">
                <span>No app lock</span>
                <span className="text-[11px] text-slate-400">Current behavior</span>
              </button>
            </div>
          </section>

          {/* Require unlock when... */}
          <section className="space-y-3">
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium text-slate-800">Require unlock when…</span>
              <span className="text-slate-400">This will apply once passkey / Face ID support is live.</span>
            </div>

            <div className="space-y-3 text-sm">
              {/* Opening the app */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Opening Beamio</span>
                  <span className="text-[11px] text-slate-400">Lock the app after it has been idle or closed.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 cursor-not-allowed">
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>

              {/* Making a payment */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Sending a payment</span>
                  <span className="text-[11px] text-slate-400">Confirm with passkey / Face ID before sending.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 cursor-not-allowed">
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>

              {/* Viewing recovery phrase (for future native app) */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Viewing recovery phrase</span>
                  <span className="text-[11px] text-slate-400">Extra check before showing sensitive recovery info.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 cursor-not-allowed">
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          </section>

          {/* Session timeout */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Session timeout (planned)</span>
              <Clock className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-500">
              In future versions you&apos;ll be able to choose how long Beamio stays unlocked on this device (e.g.
              5 minutes, 30 minutes, 24 hours). For now, Beamio relies on your browser session only.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-auto px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-4 bg-white/90 backdrop-blur">
			<AppButton
				onClick={() => colse()}
				
				fullWidth
			>{tu('done')}</AppButton>
        </footer>
      </aside>
    </div>
  );
}
