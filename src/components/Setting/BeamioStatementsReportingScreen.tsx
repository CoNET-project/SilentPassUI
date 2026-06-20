import { X, FileText, Info, CalendarDays, Download } from "lucide-react";
import {AppButton} from '@/components/button/AppButton'
import { tu } from '@/locale/beamioLocale'

type prof = {
	colse: () => void
}

export default function BeamioStatementsReportingScreen({colse}:prof) {
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
              <FileText className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Statements</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Export simple wallet statements for your own records. This screen is UI-only in the early access version.
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
                Beamio doesn&apos;t keep a separate centralized ledger. Statements are generated from your on-chain
                payment history on supported networks.
              </p>
              <p>
                In this early version, exporting statements (PDF / CSV) is planned but not live yet.
              </p>
            </div>
          </div>

          {/* Period selector */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Statement period</span>
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">{tu('this_month')}</button>
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                Last month
              </button>
              <button className="h-9 rounded-2xl border border-slate-100 bg-white text-slate-500 cursor-not-allowed">
                Custom (planned)
              </button>
            </div>
          </section>

          {/* Format (planned) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">Export format (planned)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2">
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>PDF</span>
              </button>
              <button className="h-9 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2">
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>CSV</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              In a future version, you&apos;ll be able to download a PDF or CSV summary of your incoming and outgoing
              payments for the selected period.
            </p>
          </section>

          {/* Example summary (static preview) */}
          <section className="space-y-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-800">Preview for this month</h2>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2 text-[11px] text-slate-700">
              <div className="flex items-center justify-between">
                <span>Total received</span>
                <span className="font-mono font-semibold">+ 245.30 USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total sent</span>
                <span className="font-mono font-semibold">- 198.75 USDC</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-1">
                <span>Net change</span>
                <span className="font-mono font-semibold text-emerald-600">+ 46.55 USDC</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Numbers above are an example preview. Actual statement values will be calculated from your on-chain
                history when exporting is available.
              </p>
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
