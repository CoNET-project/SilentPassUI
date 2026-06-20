import { X, Smartphone, Info, Link2, Repeat } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'
import { tu } from '@/locale/beamioLocale'

type prof = {
	colse: () => void
}


export default function BeamioCashcodesLinksSettingsScreen({colse}:prof) {
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
              <Smartphone className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Cashcodes &amp; links</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Defaults for payment links and cashcodes. These settings only affect new links you create.
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
                Cashcodes and payment links are Beamio&apos;s lightweight tools for sharing USDC with a URL or QR code.
              </p>
              <p>
                Each transaction includes a <span className="font-semibold">0.8% Beamio fee</span> with a
                minimum of <span className="font-semibold">0.02 USDC</span> and a maximum of
                <span className="font-semibold"> 2.00 USDC</span>. Direct Send/Receive stays
                <span className="font-semibold"> 0% Beamio fee</span>.
              </p>
            </div>
          </div>

          {/* Default memo */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Default memo</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Link2 className="h-3 w-3" />
                <span>Shown on new links</span>
              </span>
            </div>
            <textarea
              placeholder="e.g. Thanks from Beamio, lunch split, support my work..."
              className="w-full min-h-[72px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
            <p className="text-[11px] text-slate-500">
              This text is pre-filled when you create a new payment link or cashcode. You can always edit it per link.
            </p>
          </section>

          {/* Expiry */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Default expiry</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Repeat className="h-3 w-3" />
                <span>Applies to new links</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                24 hours
              </button>
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                7 days
              </button>
              <button className="h-9 rounded-2xl border border-slate-900 bg-slate-900 text-white font-medium">
                No expiry
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              After a link expires, Beamio will treat it as inactive. Existing funds stay in your wallet; people
              just won&apos;t be able to pay or claim through that URL anymore.
            </p>
          </section>

          {/* Behaviour summary */}
          <section className="space-y-2 text-[11px] text-slate-600">
            <h2 className="text-xs font-semibold text-slate-800">How links behave</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <span className="font-medium">Payment link</span>: one payer sends you the amount you request. They pay
                the amount you enter, and you receive that amount minus the Beamio fee.
              </li>
              <li>
                <span className="font-medium">Cashcode</span>: a reusable claim link. People who have the link can
                claim the amount you set; you pay the amount plus the Beamio fee.
              </li>
              <li>
                Links are created and verified on-chain. Beamio does not store any personal data in a centralized
                database.
              </li>
            </ul>
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
