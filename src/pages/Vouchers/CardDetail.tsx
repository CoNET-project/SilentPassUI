import React from "react"
import {
  Sparkles,
  Coins,
  BadgeCheck,
  ShieldCheck
} from "lucide-react"
import CCSACardVisual from "./CardVisual"


type CardDetailProps = {
  onPurchase?: () => void
}

export default function CardDetail({ onPurchase }: CardDetailProps) {
  return (
    <div className="w-full min-h-screen bg-white flex justify-center">
      <div 
        className="w-full max-w-[420px] px-5 pb-10"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 3rem)`
        }}
      >
        {/* Card Image */}
        <div
			className="
				flex
				justify-center
				items-start
				rounded-[30px]
				overflow-visible
			"
			>
			<div
				className="
					rounded-[30px]
					overflow-hidden
					shadow-[0_26px_50px_rgba(132,120,255,0.62),0_10px_22px_rgba(0,0,0,0.08)]
				"
				style={{ transform: 'scale(0.9)', transformOrigin: 'center top' }}
			>
				<CCSACardVisual
					balance={100}
					hasPass={false}
					showBuy='join'
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
        <h1 className="mt-8 text-center text-[22px] font-extrabold text-slate-900">
          CCSA Membership
        </h1>

        {/* Price */}
        <div className="mt-3 text-center text-[28px] font-extrabold text-blue-600">
          Price: 100 CAD
        </div>

        {/* Benefit List */}
        <div className="mt-10 space-y-4">
          <BenefitItem
            icon={<Coins className="h-6 w-6" />}
            title="100 $CCSA Credits"
            desc="1:1 Value"
          />

          <BenefitItem
            icon={<BadgeCheck className="h-6 w-6" />}
            title="NFT Pass"
            desc="Stored in AA"
          />

          <BenefitItem
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Sponsored Fees"
            desc="No gas fees"
          />
        </div>

        {/* Purchase Button */}
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
          Purchase Membership
        </button>
      </div>
    </div>
  )
}

function BenefitItem({
  icon,
  title,
  desc
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white border border-slate-100 px-5 py-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        {icon}
      </div>

      <div className="flex flex-col">
        <span className="text-[14px] font-semibold text-slate-900">
          {title}
        </span>
        <span className="text-[12px] text-slate-500">
          {desc}
        </span>
      </div>
    </div>
  )
}
