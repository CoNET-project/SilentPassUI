import React from "react";
import { useNavigate } from "react-router-dom"

// Beamio – "About this 0.2 USDC" card
// Explains the test tasks + thank-you reward.

export default function BeamioTestBalanceDetailsCard() {
	const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Card */}
      <div className="flex-1 px-5 pt-5 pb-8 overflow-y-auto">
        {/* Handle bar for sheet style */}
       

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-900">
                About this 0.2 USDC
              </span>
              <span className="text-[11px] text-slate-500">
                Starter balance for Beamio testing
              </span>
            </div>
          </div>

          
        </div>

        {/* Why you received this */}
        <div className="text-[11px] text-slate-700 space-y-2 mb-4">
          <p>
            You&apos;re one of the first people trying Beamio. This{" "}
            <span className="font-medium">0.2 USDC</span> is a small test balance
            so you can see how Beamio works with real USDC and no gas fees.
          </p>
        </div>

        {/* What to do */}
        <div className="text-[11px] text-slate-700 space-y-1 mb-4">
          <p className="font-semibold text-slate-900">
            What to do (about 10–15 minutes)
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Send and receive a few very small transfers (for example{" "}
              <span className="font-medium">0.01 USDC</span>) with a friend or
              family member.
            </li>
            <li>
              Include at least <span className="font-medium">one QR payment</span>{" "}
              in those transfers.
            </li>
            <li>
              Try creating <span className="font-medium">one Payment Link</span>{" "}
              and using it to pay.
            </li>
            <li>
              Try creating <span className="font-medium">one Cashcode</span>{" "}
              (a &quot;digital check&quot;) and redeeming it.
            </li>
            <li>
              After you&apos;re done, fill in the short{" "}
              <span className="font-medium">Google Form</span> we shared with you.
            </li>
          </ul>
        </div>

        {/* Thank-you reward */}
        <div className="text-[11px] text-slate-700 space-y-1 mb-4">
          <p className="font-semibold text-slate-900">Thank-you reward</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              You&apos;ll use this <span className="font-medium">0.2 USDC</span>{" "}
              during the test flows.
            </li>
            <li>
              After you complete the tasks and the 1–2 minute feedback form, we&apos;ll
              send you a Beamio Cashcode of about{" "}
              <span className="font-medium">1.0 USDC</span> to your Beamio wallet.
            </li>
            <li>
              In total you&apos;ll receive around{" "}<span className="font-medium">1.2 USDC</span> as an early tester.
            </li>
          </ul>
        </div>

        {/* Safety note */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900 leading-snug mb-4">
          <p className="font-semibold mb-1">Important</p>
          <ul className="list-disc list-inside space-y-1">
            <li>This wallet is created on your device.</li>
            <li>
              This wallet is stored in your browser. Clearing browser data can
              reset it.
            </li>
            <li>Please don&apos;t store large amounts yet.</li>
          </ul>
        </div>

        {/* Action row */}
        <div className="flex flex-col gap-2">
          
          <button className="w-full rounded-full border border-slate-300 bg-white text-[11px] font-medium text-slate-700 py-2 hover:bg-slate-50"
		  	onClick={() => {
				navigate('/Pay')
			}}
		  >
            Start a payment
          </button>
        </div>
      </div>
    </div>
  );
}
