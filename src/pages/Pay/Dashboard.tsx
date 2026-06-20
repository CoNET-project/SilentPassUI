// dashboard.tsx
import React from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpRight,
  QrCode,
  Link2,
  Ticket,
  Gift,
  SmartphoneNfc
} from "lucide-react"
import PayScreen from '@/pages/Pay/send'


type DashItem = {
  key: string
  title: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  variant: "blue" | "dark" | "purple" | "orange"
  onClick?: () => void
}

function tileStyles(variant: DashItem["variant"]) {
  // ✅ 尽量贴近截图：柔和渐变 + 轻微内发光 + 圆角大
  if (variant === "blue") {
    return [
      "bg-[linear-gradient(180deg,#2E6BFF_0%,#2B60FF_48%,#2552FF_100%)]",
      "shadow-[0_18px_40px_rgba(31,82,255,0.25)]"
    ].join(" ")
  }

  if (variant === "dark") {
    return [
      "bg-[linear-gradient(180deg,#2A3345_0%,#1D2636_45%,#121A27_100%)]",
      "shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
    ].join(" ")
  }

  if (variant === "purple") {
    return [
      "bg-[linear-gradient(180deg,#9A67FF_0%,#8758FF_55%,#7B4DFF_100%)]",
      "shadow-[0_18px_40px_rgba(123,77,255,0.22)]"
    ].join(" ")
  }

  // orange
  return [
    "bg-[linear-gradient(180deg,#FFB23B_0%,#FFAA2A_55%,#FF9A14_100%)]",
    "shadow-[0_18px_40px_rgba(255,154,20,0.22)]"
  ].join(" ")
}

function iconBadgeStyles(variant: DashItem["variant"]) {
  // ✅ 左上角圆形底：更“雾化”一些
  if (variant === "dark") {
    return "bg-white/14 ring-1 ring-white/10"
  }
  return "bg-white/18 ring-1 ring-white/12"
}

function textStyles(variant: DashItem["variant"]) {
  // ✅ 截图里都是白字
  return variant === "dark" ? "text-white" : "text-white"
}

function DashboardTile({
  title,
  Icon,
  variant,
  onClick
}: {
  title: string
  Icon: DashItem["Icon"]
  variant: DashItem["variant"]
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full",
        "h-[118px] md:h-[128px]",
        "rounded-[20px]",
        "px-5 py-5",
        "overflow-hidden",
        "text-left",
        "transition-transform duration-200 ease-out active:scale-[0.985]",
        "focus:outline-none focus:ring-2 focus:ring-white/35",
        tileStyles(variant)
      ].join(" ")}
    >
      {/* subtle highlight */}
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0",
          "bg-[radial-gradient(70%_90%_at_20%_10%,rgba(255,255,255,0.22),transparent_60%)]",
          "opacity-90"
        ].join(" ")}
      />

      {/* icon badge */}
      <div className="relative z-10">
		{/* ✅ iOS 风：轻微 glow，不要 ring 外框 */}
		<div
			aria-hidden
			className={[
			"absolute inset-[-6px] rounded-full blur-lg",
			variant === "dark"
				? "bg-white/10"
				: "bg-white/14"
			].join(" ")}
		/>

			<div
			className={[
				"relative",
				"w-10 h-10 rounded-full",          // ⬅️ 48 → 40
				"flex items-center justify-center",
				variant === "dark" ? "bg-white/10" : "bg-white/14",
				"shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
			].join(" ")}
			>
			<Icon
				className="w-[26px] h-[26px] text-white/95"  // ⬅️ 22 → 18
				strokeWidth={2}
			/>
			</div>
		</div>

		{/* title */}
		<div className="relative z-10 mt-1 text-white">
		{title.includes("\n") ? (
			<>
			<div className="font-extrabold text-[17px] leading-[1.1] tracking-[-0.01em]">
				{title.split("\n")[0]}
			</div>
			<div className="mt-0.5 font-semibold text-[13px] leading-tight opacity-85 tracking-[-0.005em]">
				{title.split("\n")[1]}
			</div>
			</>
		) : (
			<div className="font-extrabold text-[17px] leading-[1.1] tracking-[-0.01em]">
			{title}
			</div>
		)}
		</div>
    </button>
  )
}

export default function Dashboard({setShowAlphaHowItWorks}: {setShowAlphaHowItWorks: (val:'Payment'|''|'PayRequest'|'Cashcode'|'payme'|'PaymentNFC') => void}) {
  const nav = useNavigate()

  const items: DashItem[] = [
    {
      key: "send",
      title: "发送",
	  //@ts-ignore
      Icon: ArrowUpRight,
      variant: "blue",
      onClick: () => setShowAlphaHowItWorks('Payment')
    },
    {
      key: "payme",
      title: "PayMe",
	  //@ts-ignore
      Icon: QrCode,
      variant: "dark",
      onClick: () => setShowAlphaHowItWorks('PayRequest')
    },
    {
      key: "links_reusable",
      title: "Links (Reusable)",
	  //@ts-ignore
      Icon: Link2,
      variant: "purple",
      onClick: () => setShowAlphaHowItWorks('PayRequest')
    },
    {
      key: "links_onetime",
      title: "Links (One-time)",
	  //@ts-ignore
      Icon: Link2,
      variant: "purple",
      onClick: () => setShowAlphaHowItWorks('PayRequest')
    },
    {
		key: "redeem_cashcodes",
		title: "Redeem\n(Cashcodes)",
		//@ts-ignore
		Icon: Ticket,
		variant: "orange",
		onClick: () => setShowAlphaHowItWorks('PayRequest')
    },
    {
      key: "redeem_vouchers",
      title: "Redeem\n(Vouchers)",
	  //@ts-ignore
      Icon: Gift,
      variant: "orange",
      onClick: () => setShowAlphaHowItWorks('PayRequest')
    },
    {
      key: "payment_nfc",
      title: "Payment\nwith NFC",
	  //@ts-ignore
      Icon: SmartphoneNfc,
      variant: "blue",
      onClick: () => setShowAlphaHowItWorks('PaymentNFC')
    }
  ]

  return (
    <div className="w-full">
      {/* ✅ 背景接近截图的浅灰 */}
      <div className="">
        <div className="w-full px-3 sm:px-4 md:mx-auto md:max-w-[720px]">
          <div className="grid grid-cols-2 gap-5">
            {items.map(it => (
              <DashboardTile
                key={it.key}
                title={it.title}
                Icon={it.Icon}
                variant={it.variant}
                onClick={it.onClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
