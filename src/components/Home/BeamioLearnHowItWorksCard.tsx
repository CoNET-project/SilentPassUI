import React from "react";
import { useNavigate } from "react-router-dom"


// Beamio – "Learn how it works" card
// Used from Home empty-state (including starter-not-available state).
// General explanation of how Beamio works, without 0.1 USDC-specific copy.

export default function BeamioLearnHowItWorksCard() {

	const navigate = useNavigate()
  return (
    
      
      <div className="flex flex-col bg-slate-50 text-slate-900">
		<main className="flex-1 px-5 pt-5 pb-8 ">

        {/* Header */}
        <div className="flex flex-col h-[calc(100%-2.5rem)] px-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
              <span className="text-lg">ℹ️</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-900">How Beamio works</span>
              <span className="text-[11px] text-slate-500">A quick guide to your wallet</span>
            </div>
          </div>

          
        </div>

        {/* Wallet basics */}
        <section className="text-[11px] text-slate-700 space-y-2 mb-4">
          <p className="font-semibold text-slate-900">Your Beamio wallet</p>
          <p>
            Beamio creates a wallet on your device for <span className="font-medium">Base 上的 USDC</span>. You can use it to send and receive small payments with <span className="font-medium">no gas fees</span>. This wallet is self-custodial – funds go directly to you.
          </p>
        </section>

        {/* Receive */}
        <section className="text-[11px] text-slate-700 space-y-2 mb-4">
          <p className="font-semibold text-slate-900">Receive USDC</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Open <span className="font-medium">Receive</span> to show your QR code and Beamio address.
            </li>
            <li>
              Share the QR or address from another wallet to send USDC into this wallet.
            </li>
            <li>
              You can also redeem a <span className="font-medium">Beamio Cashcode</span> into this wallet.
            </li>
          </ul>
        </section>

        {/* Send & pay */}
        <section className="text-[11px] text-slate-700 space-y-2 mb-4">
          <p className="font-semibold text-slate-900">Send &amp; pay</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Use <span className="font-medium">Send USDC</span> for direct payments to another address or QR.
            </li>
            <li>
              Use <span className="font-medium">Payment Link</span> when you want to share a link someone can tap to pay you.
            </li>
            <li>
              Use <span className="font-medium">Cashcode</span> as a one-time &quot;digital check&quot; that can be redeemed once.
            </li>
          </ul>
        </section>

        {/* Fees */}
        <section className="text-[11px] text-slate-700 space-y-2 mb-4">
          <p className="font-semibold text-slate-900">Fees</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Direct sends and receives are free for you – Beamio pays the network fee on Base, so these payments are gasless.
            </li>
            <li>
              When someone pays you via a <span className="font-medium">Payment Link</span>, Beamio charges a small service fee.
            </li>
            <li>
              When you pay using a <span className="font-medium">Cashcode</span>, Beamio also charges a service fee.
            </li>
            <li>
              The service fee is <span className="font-medium">0.8%</span> of the payment amount, with a minimum of <span className="font-medium">0.02 USDC</span> and a maximum of <span className="font-medium">2 USDC</span>.
            </li>
          </ul>
        </section>

        {/* Safety note */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900 leading-snug mb-4">
          <p className="font-semibold mb-1">Important</p>
          <ul className="list-disc list-inside space-y-1">
            <li>This wallet is created on your device.</li>
            <li>This wallet is stored in your browser. Clearing browser data can reset it.</li>
            <li>Please don&apos;t store large amounts yet.</li>
          </ul>
        </section>

        {/* Action row */}
        <div className="flex flex-col gap-2">
          
          <button className="w-full rounded-full border border-slate-300 bg-white text-[11px] font-medium text-slate-700 py-2 hover:bg-slate-50"
		  	onClick={() => {
				navigate('/Browser')
			}}
		  >
            	Open Receive
          </button>
        </div>
		</main>
      </div>
    
  );
}
