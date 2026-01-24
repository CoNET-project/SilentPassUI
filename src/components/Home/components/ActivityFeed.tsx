import React from "react"
import { Check } from "lucide-react"

type ActivityItem =
  | {
      id: string
      kind: "cashback"
      icon: React.ReactNode
      title: string
      time: string
    }
  | {
      id: string
      kind: "payment"
      avatar: React.ReactNode
      actor: string
      actionText: string
      target: string
      time: string
      note?: string
    }
  | {
      id: string
      kind: "promo"
      avatar: React.ReactNode
      merchant: string
      time: string
      desc: string
      verified?: boolean
      promoLabel?: string
    }
  | {
      id: string
      kind: "join"
      avatar: React.ReactNode
      actor: string
      target: string
      time: string
      quote?: string
    }
  | {
      id: string
      kind: "merchant"
      avatar: React.ReactNode
      merchant: string
      time: string
      desc: string
      verified?: boolean
    }

type ActivityFeedProps = {
  items?: ActivityItem[]
  className?: string
}

function AvatarCircle({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode
  tone?: "neutral" | "blue" | "pink" | "lavender"
}) {
  const bg =
    tone === "blue"
      ? "bg-[#EAF2FF]"
      : tone === "pink"
        ? "bg-[#FFE9EA]"
        : tone === "lavender"
          ? "bg-[#F3ECFF]"
          : "bg-slate-100"

  return (
    <div
      className={[
        "relative shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
        bg
      ].join(" ")}
    >
      {children}
    </div>
  )
}

function VerifiedDot() {
  return (
    <div className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-[#2E6BFF] flex items-center justify-center ring-2 ring-white">
      <Check className="h-3 w-3 text-white stroke-[3]" />
    </div>
  )
}

function CardShell({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={[
        "w-full rounded-[22px]",
        "bg-white",
        "ring-1 ring-black/5",
        "shadow-[0_8px_18px_rgba(2,6,23,0.06)]",
        "px-5 py-4",
        className ?? ""
      ].join(" ")}
    >
      {children}
    </div>
  )
}

function QuotePill({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-[14px] bg-slate-100/70 px-4 py-3 text-slate-600 text-[13px] leading-snug">
      {children}
    </div>
  )
}


export function ActivityFeed({ items, className }: ActivityFeedProps) {
  const demo: ActivityItem[] = [
    // {
    //   id: "a1",
    //   kind: "cashback",
    //   icon: <span className="text-[18px]">✨</span>,
    //   title: "🎉 You earned $2.40 Cashback this week!",
    //   time: "2h ago"
    // },
    // {
    //   id: "a2",
    //   kind: "payment",
    //   avatar: <span className="text-[18px]">🧑🏻‍🍳</span>,
    //   actor: "Sarah Chen",
    //   actionText: "paid",
    //   target: "Daily Grind Cafe",
    //   time: "3h ago",
    //   note: "Best latte in town! ☕️"
    // },
    // {
    //   id: "a3",
    //   kind: "promo",
    //   avatar: <span className="text-[20px]">🍔</span>,
    //   merchant: "Burger King",
    //   time: "4h ago",
    //   desc: "Whopper Wednesday! 50% off when paying with Beamio.",
    //   verified: true,
    //   promoLabel: "PROMO"
    // },
    // {
    //   id: "a4",
    //   kind: "join",
    //   avatar: <span className="text-[18px]">🐱</span>,
    //   actor: "Mike Ross",
    //   target: "Beamio",
    //   time: "5h ago",
    //   quote: "Finally joined the future! 👋"
    // },
    // {
    //   id: "a5",
    //   kind: "merchant",
    //   avatar: <span className="text-[18px]">🍸</span>,
    //   merchant: "Neon Bar",
    //   time: "6h ago",
    //   desc: "Happy Hour starts at 5pm. Win free drinks with Lucky Pay!",
    //   verified: true
    // }
  ]

  const data = items ?? demo

  return (
    <div className={["w-full mt-8", className ?? ""].join(" ")}>
      <div className="px-1">
        <div className="text-[12px] font-extrabold tracking-[0.18em] text-slate-500/80">
          ACTIVITY FEED
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {data.map(item => {
          if (item.kind === "cashback") {
            return (
              <CardShell key={item.id}>
                <div className="flex items-center gap-4">
                  <AvatarCircle tone="blue">{item.icon}</AvatarCircle>
                  <div>
                    <div className="text-[15px] font-extrabold text-slate-900 leading-snug">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">{item.time}</div>
                  </div>
                </div>
              </CardShell>
            )
          }

          if (item.kind === "payment") {
            return (
              <CardShell key={item.id}>
                <div className="flex gap-4">
                  <AvatarCircle>{item.avatar}</AvatarCircle>
                  <div className="flex-1">
                    <div className="text-[15px] leading-snug text-slate-900">
                      <span className="font-extrabold">{item.actor}</span>{" "}
                      <span className="text-slate-700">{item.actionText}</span>{" "}
                      <span className="font-extrabold">{item.target}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">{item.time}</div>
                    {item.note && <QuotePill>{item.note}</QuotePill>}
                  </div>
                </div>
              </CardShell>
            )
          }

          if (item.kind === "promo") {
            return (
              <CardShell key={item.id}>
                <div className="flex gap-4">
                  <div className="relative">
                    <AvatarCircle tone="pink">{item.avatar}</AvatarCircle>
                    {item.verified && <VerifiedDot />}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div className="text-[16px] font-extrabold text-slate-900">
                        {item.merchant}
                      </div>
                      <div className="text-[12px] text-slate-500">{item.time}</div>
                    </div>

                    <div className="mt-1 text-[14px] text-slate-600">
                      {item.desc}
                    </div>

                    <div className="mt-3 h-[150px] rounded-[16px] bg-[linear-gradient(135deg,#FF8A00_0%,#FF3D5A_100%)] flex items-center justify-center">
                      <div className="text-white/40 text-[28px] font-extrabold tracking-[0.12em]">
                        {item.promoLabel ?? "PROMO"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardShell>
            )
          }

          if (item.kind === "join") {
            return (
              <CardShell key={item.id}>
                <div className="flex gap-4">
                  <AvatarCircle>{item.avatar}</AvatarCircle>
                  <div className="flex-1">
                    <div className="text-[15px] text-slate-900">
                      <span className="font-extrabold">{item.actor}</span>{" "}
                      <span className="text-slate-700">joined</span>{" "}
                      <span className="font-extrabold">{item.target}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">{item.time}</div>
                    {item.quote && <QuotePill>{item.quote}</QuotePill>}
                  </div>
                </div>
              </CardShell>
            )
          }

          return (
            <CardShell key={item.id}>
              <div className="flex gap-4">
                <div className="relative">
                  <AvatarCircle tone="lavender">{item.avatar}</AvatarCircle>
                  {item.verified && <VerifiedDot />}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between">
                    <div className="text-[16px] font-extrabold text-slate-900">
                      {item.merchant}
                    </div>
                    <div className="text-[12px] text-slate-500">{item.time}</div>
                  </div>
                  <div className="mt-1 text-[14px] text-slate-600">
                    {item.desc}
                  </div>
                </div>
              </div>
            </CardShell>
          )
        })}
      </div>
    </div>
  )
}
