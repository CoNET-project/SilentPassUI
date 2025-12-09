import React from "react";
import { getUSDCFaucet} from '@/services/beamio'
// Beamio – Alpha Drop Confirm Screen
// Full-screen confirm page (can also be implemented as a modal/sheet)
import {AppButton} from'@/components/button/AppButton'

type Prof = {
	wallet: string
	close: (success: 'success'|'error'|'') => void
}
export default function BeamioAlphaDropConfirm({close, wallet}: Prof) {
  return (
    <div className="flex flex-col bg-slate-50 text-slate-900">

      {/* Content */}
      <main className="flex-1 px-5 pt-6 pb-6 flex flex-col gap-6">
        {/* Icon + title */}
        <div className="flex flex-col items-center text-center gap-3 mt-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-2xl">🔥</span>
          </div>
          <div className="max-w-xs">
            <h1 className="text-base font-semibold text-slate-900 mb-1">
              Claim 0.2 USDC to get started
            </h1>
            <p className="text-xs text-slate-500 leading-snug">
              Beamio will add <span className="font-semibold">0.2 USDC</span> to your wallet so you can try everyday payments with no gas fees.
            </p>
          </div>
        </div>

        {/* Summary card */}
        <section className="mt-2">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="font-medium text-slate-900">0.20 USDC</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Network fee</span>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[11px] text-rose-400 line-through">
                  USD$ 0.00021 · 0.0000001 ETH
                </span>
                <span className="text-[11px] text-emerald-500 font-medium">
                  Paid by Beamio
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Important */}
        <section>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-snug">
            <p className="font-semibold mb-1">Important</p>
            <p>
              This wallet is created on your device and stored in your browser. Clearing browser data can reset it. Please don&apos;t store large amounts yet.
            </p>
          </div>
        </section>
		<div className="flex gap-3 w-full">
			<AppButton
				variant="secondary"
				className="flex-1"
				fullWidth
				onClick={() => close('')}
			>
				Not now
			</AppButton>

			<AppButton
				className="flex-1"
				fullWidth
				onClick={async () => {



					
					const result = await getUSDCFaucet(wallet)
					if (result) {
						return close('success')
					}
					close('error')

				}}
			>
				Confirm Claim
			</AppButton>
		</div>

      </main>
    </div>
  );
}
