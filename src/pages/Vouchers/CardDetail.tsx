import React from "react"
import {
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Infinity,
} from "lucide-react"
import CCSACardVisual from "./CardVisual"

const CCSA_WEBSITE = "https://www.canadaccsa.com"

type CardDetailProps = {
  onPurchase?: () => void
  isMember?: boolean
}

export default function CardDetail({ onPurchase, isMember }: CardDetailProps) {
  return (
    <div className="w-full min-h-screen bg-white flex justify-center">
      <div
        className="w-full max-w-[420px] px-5 pb-10"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 3rem)`,
        }}
      >
        {/* Card Image */}
        <div className="flex justify-center items-start rounded-[30px] overflow-visible">
          <div
            className="rounded-[30px] overflow-hidden shadow-[0_26px_50px_rgba(132,120,255,0.62),0_10px_22px_rgba(0,0,0,0.08)]"
            style={{ transform: "scale(0.9)", transformOrigin: "center top" }}
          >
            <CCSACardVisual
              balance={0}
              hasPass={false}
              showBuy="buy"
              onBuy={onPurchase}
              onTopUp={() => {}}
              onQR={() => {}}
              onCardClick={() => {}}
              memberNo="M-000000"
              year="2026"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-8 text-center text-[24px] font-extrabold text-slate-900">
          CCSA Alliance Card
        </h1>

        {/* Issuer */}
        <p className="mt-2 text-center text-[14px] text-slate-500">
          Issuer: Canadian Community Service Association (CCSA)
        </p>

        {/* Website Link */}
        <a
          href={CCSA_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 text-[14px] font-medium text-blue-600 hover:underline active:opacity-80"
        >
          <span>www.canadaccsa.com</span>
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
        </a>

        {/* Powered by */}
        <p className="mt-1 text-center text-[12px] text-slate-400">
          Powered by Beamio Technology
        </p>

        {/* Top-up */}
        <div className="mt-6 text-center">
          <span className="text-[22px] font-bold text-blue-600">
            Top-up: 100 CAD
          </span>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-3">
          <FeatureItem
            icon={<Infinity className="h-6 w-6 text-blue-600" />}
            title="$CCSA Credits"
            desc="1 Credit = 1 CAD Value"
          />
          <FeatureItem
            icon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
            title="Digital Identity"
            desc="VIP Status at Partner Merchants"
          />
          <FeatureItem
            icon={<ShieldCheck className="h-6 w-6 text-blue-600" />}
            title="Tech by Beamio"
            desc="Secure & Instant Settlement"
          />
        </div>

        {/* About this Card */}
        <section className="mt-8">
          <h2 className="text-[16px] font-bold text-slate-900">
            About this Card
          </h2>
          <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
            The CCSA Alliance Stored-Value Card is a dual-attribute digital
            asset combining <strong className="text-slate-900">Identity + Payment</strong>.
            It connects high-net-worth consumers with premium merchants in the
            ecosystem.
          </p>
          <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
            For Consumers: One card for all alliance merchants, enjoying VIP
            status and exclusive discounts.
          </p>
        </section>

        {/* Terms & Rules */}
        <section className="mt-8">
          <h2 className="text-[16px] font-bold text-slate-900">
            Terms & Rules
          </h2>
          <ul className="mt-2 space-y-2 text-[14px] text-slate-600 leading-relaxed list-disc list-inside">
            <li>
              <strong className="text-slate-800">Credit Value:</strong> 1 $CCSA
              is always equivalent to 1.00 CAD purchasing power.
            </li>
            <li>
              <strong className="text-slate-800">Management:</strong> Funds are
              held and managed directly by CCSA.
            </li>
            <li>
              <strong className="text-slate-800">Usage:</strong> Accepted at all
              &apos;Official Partner Merchants&apos; (Gold/Green) for payments.
            </li>
            <li>
              <strong className="text-slate-800">Benefits:</strong> Discounts
              (e.g., 5-15%) are automatically applied by the system based on
              card tier.
            </li>
          </ul>
        </section>

        {/* Action Button */}
        <button
          onClick={onPurchase}
          className="
            mt-10
            w-full
            h-[56px]
            rounded-full
            bg-blue-600
            text-white
            text-[17px]
            font-semibold
            flex
            items-center
            justify-center
            gap-2
            shadow-[0_10px_30px_rgba(37,99,235,0.35)]
            active:scale-[0.98]
            transition
          "
        >
          <Sparkles className="h-5 w-5" />
          {isMember ? "Top Up" : "Get Member Card (Deposit 100)"}
        </button>
      </div>
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-100/90 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[14px] font-bold text-slate-900">{title}</span>
        <span className="text-[13px] text-slate-500 mt-0.5">{desc}</span>
      </div>
    </div>
  )
}
