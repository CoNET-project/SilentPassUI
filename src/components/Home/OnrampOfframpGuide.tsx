// src/pages/OnrampOfframpGuide.tsx
import { useNavigate } from 'react-router-dom'

export default function OnrampOfframpGuide() {
  const navigate = useNavigate()

  return (
    <main className="flex-1 px-5 pt-4 pb-6">
      {/* Top back */}

      <h1 className="text-lg font-semibold text-slate-900 mb-1">
        How to use Beamio “Add or Withdraw USDC” via Onramp / Offramp
      </h1>
      <p className="text-[13px] text-slate-500 mb-4">
        This guide explains how to top up USDC into Beamio (onramp) and how to
        withdraw USDC back to your bank or card (offramp) using the Coinbase
        Onramp / Offramp widget.
      </p>

      {/* Section: Onramp */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          1. Onramp — Add USDC to Beamio
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-[13px] text-slate-700">
          <li>
            On the Beamio home screen, tap{' '}
            <span className="font-medium">“Add or Withdraw USDC”</span>.
          </li>
          <li>
            The Coinbase Onramp / Offramp widget opens in a secure in-app view.
          </li>
          <li>
            Make sure the asset is{' '}
            <span className="font-semibold">USDC</span> and the network is{' '}
            <span className="font-semibold">Base</span>.
          </li>
          <li>
            Choose a <span className="font-medium">payment method</span> that is
            supported in your region (card, bank transfer, or other local
            methods shown in the widget).
          </li>
          <li>
            Enter the amount of USDC you want to buy / add and follow the
            on-screen instructions to complete KYC (if required) and payment.
          </li>
          <li>
            After the onramp transaction is confirmed, USDC will be delivered to
            the wallet that Beamio is connected to on Base. Beamio then uses
            this balance for Cashcodes, Payments, and Requests.
          </li>
        </ol>
      </section>

      {/* Section: Offramp */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          2. Offramp — Withdraw USDC from Beamio
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-[13px] text-slate-700">
          <li>
            On the Beamio home screen, tap{' '}
            <span className="font-medium">“Add or Withdraw USDC”</span> again.
          </li>
          <li>
            In the Coinbase widget, switch to the{' '}
            <span className="font-medium">Sell / Cash out / Offramp</span> flow
            (the exact wording may depend on your region and provider).
          </li>
          <li>
            Confirm the asset is{' '}
            <span className="font-semibold">USDC on Base</span>.
          </li>
          <li>
            Enter the amount of USDC you want to withdraw and select your payout
            method, such as bank account or card, if available in your country.
          </li>
          <li>
            Review the{' '}
            <span className="font-medium">fees, FX (if any), and timing</span>{' '}
            shown in the widget, then confirm the off-ramp transaction.
          </li>
          <li>
            Once processed by the provider, funds will arrive in your selected
            payout destination. The exact time depends on the local rails and
            the partner used by Coinbase.
          </li>
        </ol>
      </section>

      {/* Section: Notes */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          3. Notes & responsibilities
        </h2>
        <ul className="list-disc pl-5 space-y-2 text-[13px] text-slate-700">
          <li>
            Beamio is a non-custodial app. Your USDC is held in your connected
            wallet on the Base network.
          </li>
          <li>
            The onramp / offramp experience (KYC, limits, supported countries,
            methods) is provided by Coinbase and its partners, not Beamio.
          </li>
          <li>
            All fees related to buying or selling USDC (and any FX conversion)
            are shown in the widget before you confirm.
          </li>
          <li>
            If something gets stuck inside the Onramp / Offramp widget, please
            follow the support / help link inside that widget to contact
            Coinbase support.
          </li>
        </ul>
      </section>
    </main>
  )
}
