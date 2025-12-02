import React from "react";

// Beamio – "How it works" screen (Alpha)
// Explains the 0.2 USDC test balance and the three MVP flows.

export default function BeamioAlphaHowItWorks() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">


      {/* Content */}
      <main className="flex-1 px-5 pt-5 pb-8 overflow-y-auto">
        {/* Intro card */}
        <section className="mb-5">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-4 flex flex-col gap-2">
            <h1 className="text-base font-semibold text-slate-900 mb-1">You get 0.2 USDC to test Beamio</h1>
            <p className="text-xs text-slate-600 leading-snug">
              During this closed alpha, Beamio adds <span className="font-medium">0.2 USDC</span> to your wallet so you can try our three core flows with
              <span className="font-medium"> no gas fees</span>.
            </p>
          </div>
        </section>

        {/* What you can test */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase mb-3">What you can test</h2>

          <ol className="space-y-3 text-xs text-slate-700">
            {/* 1. Direct send / receive */}
            <li className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-semibold mt-0.5">
                1
              </div>
              <div>
                <p className="font-semibold mb-1">Send & receive USDC directly</p>
                <p className="leading-snug">
                  Use <span className="font-medium">Send USDC</span> to send a small amount to a friend or family member. Enter their wallet address or
                  scan their Receive QR. They can also send USDC back to you.
                </p>
              </div>
            </li>

            {/* 2. Payment Link */}
            <li className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-semibold mt-0.5">
                2
              </div>
              <div>
                <p className="font-semibold mb-1">Try a Payment Link</p>
                <p className="leading-snug">
                  On the <span className="font-medium">Payments</span> tab, choose <span className="font-medium">Payment Link</span>, set an amount and note,
                  then tap <span className="font-medium">Generate Payment Link</span>. Share it as a link or QR. The payer opens it and pays from Beamio or
                  another Base wallet, and you receive USDC in your Beamio wallet.
                </p>
              </div>
            </li>

            {/* 3. Cashcode */}
            <li className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-semibold mt-0.5">
                3
              </div>
              <div>
                <p className="font-semibold mb-1">Create a Cashcode (digital check)</p>
                <p className="leading-snug">
                  On the <span className="font-medium">Payments</span> tab, choose <span className="font-medium">Cashcode</span>. Enter how much the other
                  person will receive and, if you like, set a 3-3 digit security code. Share the Cashcode (and security code if set); they redeem it once
                  into their wallet as USDC.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Fees + safety */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 leading-snug">
            <p className="font-semibold mb-1">Fees</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Direct sends and receives are free for you – Beamio pays the network fee on Base, so these payments are gasless.
              </li>
              <li>
                When someone pays you via a Payment Link, Beamio charges a small service fee.
              </li>
              <li>
                When you pay using a Cashcode, Beamio also charges a service fee.
              </li>
              <li>
                The service fee is 0.8% of the payment amount, with a minimum of 0.02 USDC and a maximum of 2 USDC.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-snug">
            <p className="font-semibold mb-1">Important</p>
            <ul className="list-disc list-inside space-y-1">
              <li>This wallet is created on your device.</li>
              <li>This wallet is stored in your browser. Clearing browser data can reset it.</li>
              <li>Please don&apos;t store large amounts yet.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
