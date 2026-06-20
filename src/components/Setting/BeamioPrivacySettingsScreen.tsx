import { X, Shield, Info, Globe2, FileText } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { tu } from '@/locale/beamioLocale'

type prof = {
	colse: () => void
}

export default function BeamioPrivacySettingsScreen({colse}:prof) {
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
              <Shield className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Legal &amp; Privacy</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                A quick summary of what Beamio can see, what others can see, and links to the full legal documents.
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
                Beamio is a non-custodial wallet. We don&apos;t run a centralized user database and we don&apos;t see your
                contacts, bank logins or card numbers.
              </p>
            </div>
          </div>

          {/* What Beamio can see */}
          <section className="space-y-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-800">What Beamio can see</h2>
            <p className="text-[11px] text-slate-500">
              To run the app, Beamio only reads a small set of information:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
              <li>Your Beamio wallet address and on-chain balances on supported networks.</li>
              <li>On-chain payment activity made through Beamio (for receipts and history).</li>
              <li>Basic device and browser info to keep your session secure.</li>
            </ul>
          </section>

          {/* What others can see */}
          <section className="space-y-3">
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-semibold text-slate-800">What other people can see</span>
              <span className="text-[11px] text-slate-500">
                Beamio doesn&apos;t show your phone number or email to anyone. People you pay or receive from can see:
              </span>
            </div>

            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
              <li>Your Beamio name and profile photo.</li>
              <li>Your @handle, when you send payment links or cashcodes.</li>
              <li>The amount and notes for payments you share with them.</li>
            </ul>

            {/* Simple switch: show name & avatar (UI only for now) */}
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-slate-800">Show my name &amp; avatar</span>
                <span className="text-[11px] text-slate-400">
                  When this is on, people you interact with on Beamio can see your Beamio name and profile photo.
                </span>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#1652f0] cursor-not-allowed">
                <span className="absolute right-0.5 h-5 w-5 rounded-full bg-white shadow" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              In this early version, this switch is UI-only. Your profile is shown using the information you set on the
              Account screen.
            </p>
          </section>

          {/* Legal links */}
          <section className="space-y-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5 text-slate-500" />
              Full policies
            </h2>
            <p className="text-[11px] text-slate-500 mb-1">
              For full legal details, read Beamio&apos;s Privacy Policy and Terms of Service on the web.
            </p>

            <div className="space-y-2 text-sm">
              <button
                type="button"
                onClick={() => openExternalUrl("https://beamio.app/privacy")}
                className="w-full h-10 px-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Open Privacy Policy</span>
                </span>
                <span className="text-[11px] text-slate-400">Opens beamio.app/privacy</span>
              </button>

              <button
                type="button"
                onClick={() => openExternalUrl("https://beamio.app/terms")}
                className="w-full h-10 px-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-slate-700"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Open Terms of Service</span>
                </span>
                <span className="text-[11px] text-slate-400">Opens beamio.app/terms</span>
              </button>
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
