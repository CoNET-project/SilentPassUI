import { X, Globe2, ChevronDown, Info } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'

type prof = {
	colse: () => void
}

export default function BeamioRegionCurrencyScreen({colse}:prof) {
  return (
    <div className="">
      {/* Dim background */}
      <div className="" />

      {/* Right-side sheet */}
      <aside className="r">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Globe2 className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Region &amp; currency</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Controls language and the default stablecoin Beamio displays.
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
            <p className="text-xs leading-relaxed text-slate-700">
              For the MVP on Base, Beamio currently supports <span className="font-semibold">English</span> and
              shows balances in <span className="font-semibold">USDC</span>. More regions and stablecoins will be added later.
            </p>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">Region</label>
            <button className="w-full flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 cursor-default">
              <span>Global (Base)</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <p className="text-xs text-slate-500">
              Your wallet works anywhere Base is accessible. Regional options will appear here in future versions.
            </p>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">Language</label>
            <button className="w-full flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 cursor-default">
              <span>English</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <p className="text-xs text-slate-500">
              Beamio launches in English first. Additional languages will be added based on user demand.
            </p>
          </div>

          {/* Default currency */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">Default stablecoin</label>
            <button className="w-full flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 cursor-default">
              <span>USDC on Base</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <p className="text-xs text-slate-500">
              All balances and payments are shown in USDC. Support for other stablecoins may be added later.
            </p>
          </div>
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
