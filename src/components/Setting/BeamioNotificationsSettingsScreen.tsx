import { X, Bell, Info, Mail, Smartphone } from "lucide-react";

import {AppButton} from '@/components/button/AppButton'

type prof = {
	colse: () => void
}
export default function BeamioNotificationsSettingsScreen({colse}:prof) {
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
              <Bell className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose which alerts you want from Beamio. This screen is UI-only in the early access version.
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
                In this early version, notifications are kept simple. Beamio may use email or in-app banners to send
                important alerts. Push notifications will be added later.
              </p>
            </div>
          </div>

          {/* Payments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Payments</span>
              <Smartphone className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="space-y-3 text-sm">
              {/* Payment received */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Payment received</span>
                  <span className="text-[11px] text-slate-400">Get a notification when someone pays you.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#1652f0] cursor-not-allowed">
                  <span className="absolute right-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>

              {/* Payment sent or failed */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Payment sent or failed</span>
                  <span className="text-[11px] text-slate-400">Confirm when a payment is sent, or if something goes wrong.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#1652f0] cursor-not-allowed">
                  <span className="absolute right-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          </section>

          {/* Security alerts */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Security alerts</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Suspicious activity</span>
                  <span className="text-[11px] text-slate-400">Unusual login or device activity related to your wallet.</span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#1652f0] cursor-not-allowed">
                  <span className="absolute right-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          </section>

          {/* Email updates */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Email updates</span>
              <Mail className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-800">Product news (optional)</span>
                  <span className="text-[11px] text-slate-400">
                    Occasional updates about new features and improvements. Planned for a later version.
                  </span>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 cursor-not-allowed">
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-auto px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-4 bg-white/90 backdrop-blur">
          <AppButton
						onClick={() => colse()}
						
						fullWidth
					>
						Done
					</AppButton>
        </footer>
      </aside>
    </div>
  );
}
