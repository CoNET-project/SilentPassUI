import { X, CreditCard, ArrowUpRight, ArrowDownRight, ExternalLink, Info } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'

type prof = {
	colse: () => void
}

export default function BeamioPaymentMethodsScreen({colse}:prof) {
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
              <CreditCard className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Payment methods</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Beamio connects to Coinbase for on-ramp and off-ramp. This screen is UI-only in the MVP.
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
              Beamio never takes custody of your funds and does not hold card or bank details. Fiat on-ramp and
              off-ramp are processed directly by <span className="font-semibold">Coinbase</span>, with balances
              delivered as USDC on Base.
            </p>
          </div>

          {/* Connected Coinbase account */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">Coinbase account</span>
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                UI only · no live connection
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
              <div className="flex flex-col">
                <span className="text-slate-800">Not connected</span>
                <span className="text-xs text-slate-500">In production, you&apos;ll link your Coinbase account here.</span>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* On-ramp card */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Add funds (on-ramp)</h2>
            <button className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-4 text-left shadow-sm hover:border-sky-200 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-xs font-semibold text-white">
                    CB
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">Buy USDC with Coinbase</span>
                    <span className="text-xs text-slate-500">
                      Use cards or bank accounts via Coinbase to get USDC on Base in your Beamio wallet.
                    </span>
                  </div>
                </div>
                <ArrowDownRight className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                In the live app, this button will open Coinbase&apos;s on-ramp flow in a secure webview or deep link.
              </p>
            </button>
          </div>

          {/* Off-ramp card */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Cash out (off-ramp)</h2>
            <button className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-4 text-left shadow-sm hover:border-sky-200 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-xs font-semibold text-white">
                    CB
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">Withdraw to bank with Coinbase</span>
                    <span className="text-xs text-slate-500">
                      Send USDC from Beamio to Coinbase, then cash out to your local currency.
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                In the live app, this button will guide users through off-ramping USDC via Coinbase to their bank.
              </p>
            </button>
          </div>

          {/* Availability note */}
          <div className="text-[11px] text-slate-500 leading-relaxed">
            <p>
              Availability of on-ramp / off-ramp depends on Coinbase&apos;s supported regions and compliance rules.
              Beamio simply initiates these flows and never touches fiat.
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
