import { X, HelpCircle, Info, Mail, MessageSquare, Bug, ExternalLink } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'
import { tu } from '@/locale/beamioLocale'

type prof = {
	colse: () => void
}


export default function BeamioGetHelpSettingsScreen({colse}:prof) {
  return (
    <div className="">
      {/* Dim background */}
      <div className="" />

      {/* Right-side sheet */}
      <aside className="l">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">获取帮助</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Find answers to common questions or reach the Beamio team if something doesn&apos;t look right.
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
                Beamio is in early access. If you get stuck, see the help center or contact us — we&apos;d love to hear your
                feedback.
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <section className="space-y-3 text-sm">
            {/* Help center */}
            <button
              type="button"
              onClick={() =>
                window.open("https://beamio.app/help", "_blank", "noopener,noreferrer")
              }
              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Info className="h-4 w-4" />
                </span>
                <div className="flex flex-col items-start">
                  <span>Open help center</span>
                  <span className="text-[11px] text-slate-400">
                    FAQs and step-by-step guides (opens beamio.app/help)
                  </span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </button>

            {/* Email support */}
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "mailto:support@beamio.app?subject=Beamio%20support%20request&body=Please%20describe%20your%20question%20or%20issue.%20If%20possible%2C%20include%20your%20browser%20and%20device%20info.";
              }}
              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between text-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Mail className="h-4 w-4" />
                </span>
                <div className="flex flex-col items-start">
                  <span>Email support</span>
                  <span className="text-[11px] text-slate-400">
                    support@beamio.app — we read every message during early access.
                  </span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </button>

            {/* Report an issue */}
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "mailto:support@beamio.app?subject=Beamio%20bug%20report&body=Please%20describe%20what%20happened%2C%20the%20steps%20to%20reproduce%20it%2C%20and%20your%20browser%20%2F%20device%20info.";
              }}
              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between text-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-red-500">
                  <Bug className="h-4 w-4" />
                </span>
                <div className="flex flex-col items-start">
                  <span>Report a bug or issue</span>
                  <span className="text-[11px] text-slate-400">
                    Opens an email draft so you can send us details and a screenshot.
                  </span>
                </div>
              </div>
            </button>
          </section>

          {/* Contact channels (optional, planned) */}
          <section className="space-y-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-800">Contact channels (planned)</h2>
            <p className="text-[11px] text-slate-500">
              In future versions, you&apos;ll be able to reach Beamio from more places.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>In-app chat</span>
                </div>
                <span className="text-[11px] uppercase tracking-[0.16em]">Planned</span>
              </div>
            </div>
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
