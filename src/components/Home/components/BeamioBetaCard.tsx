import React from "react"
import { ArrowUpRight, Zap } from "lucide-react"

type BeamioBetaCardProps = {
  onLearnMore?: () => void
  className?: string
  badgeLeft?: string
  badgeRight?: string
  title?: string
  subtitle?: string
}

function EnergyBoltBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft glows (跟 demo 一样：右上白光、左下蓝光) */}
      <div className="absolute right-0 top-0 h-[180px] w-[180px] translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute left-0 bottom-0 h-[120px] w-[120px] rounded-full bg-blue-400/20 blur-2xl" />

      {/* main “energy block / lightning” */}
      <svg
        viewBox="0 0 1000 700"
        className="
          absolute
          -right-10
          bottom-[-6px]
          w-[540px]
          h-[380px]
          opacity-[0.26]
          rotate-[10deg]
        "
        aria-hidden
      >
        <defs>
          {/* 蓝灰能量块渐变 */}
          <linearGradient id="beamio-energy-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E6F0FF" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#BFD3FF" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#6E8BFF" stopOpacity="0.14" />
          </linearGradient>

          {/* 内层高光 */}
          <linearGradient id="beamio-energy-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
          </linearGradient>

          {/* soft edge */}
          <filter id="beamio-energy-soft" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="10" />
          </filter>

          {/* 右侧渐隐，让它融进背景 */}
          <mask id="beamio-energy-fade">
            <rect width="100%" height="100%" fill="white" />
            <linearGradient id="beamio-energy-fade-g" x1="0.68" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </linearGradient>
            <rect width="100%" height="100%" fill="url(#beamio-energy-fade-g)" />
          </mask>
        </defs>

        <g filter="url(#beamio-energy-soft)" mask="url(#beamio-energy-fade)">
          {/* 大块主形状（圆角厚实） */}
          <path
            d="
              M 320 170
              A 92 92 0 0 1 412 78
              H 690
              A 92 92 0 0 1 750 104
              L 922 242
              A 92 92 0 0 1 922 280
              L 750 418
              A 92 92 0 0 1 690 444
              H 412
              A 92 92 0 0 1 320 352
              V 314
              H 255
              A 78 78 0 0 1 177 236
              A 78 78 0 0 1 255 158
              H 320
              Z
            "
            fill="url(#beamio-energy-grad)"
          />

          {/* 内层高光，让它更像“软块” */}
          <path
            d="
              M 372 205
              A 72 72 0 0 1 444 133
              H 666
              A 72 72 0 0 1 712 151
              L 850 262
              L 712 373
              A 72 72 0 0 1 666 391
              H 444
              A 72 72 0 0 1 372 319
              V 300
              H 300
              A 60 60 0 0 1 240 240
              A 60 60 0 0 1 300 180
              H 372
              Z
            "
            fill="url(#beamio-energy-hi)"
          />

          {/* 小碎能量块 1 */}
          <path
            d="M 760 110 L 840 170 L 760 230 L 680 170 Z"
            fill="#FFFFFF"
            opacity="0.06"
          />

          {/* 小碎能量块 2 */}
          <path
            d="M 560 520 L 620 565 L 560 610 L 500 565 Z"
            fill="#FFFFFF"
            opacity="0.05"
          />
        </g>
      </svg>

      {/* 右下角的 Zap 轮廓氛围（跟 demo 一样：大 icon + 低透明度） */}
      <div className="absolute -right-4 bottom-2 rotate-12 opacity-30">
        <Zap size={110} className="text-white fill-white" />
      </div>
    </div>
  )
}

export function BeamioBetaCard({
  onLearnMore,
  className,
  badgeLeft = "Official Launch",
  badgeRight = "v1.0 Beta",
  title = "Beamio Beta\nis Finally Here!",
  subtitle = "Experience gas-free USDC\npayments. Join the revolution\ntoday."
}: BeamioBetaCardProps) {
  return (
    <div
      className={[
        "relative overflow-hidden",
        "rounded-[24px]",
        "bg-gradient-to-r from-[#0052FF] to-[#0A2540]",
        "p-6",
        "shadow-lg shadow-blue-900/20",
        className ?? ""
      ].join(" ")}
    >
      <EnergyBoltBg />

      <div className="relative z-10">
        {/* badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md border border-white/20">
            {badgeLeft}
          </span>
          <span className="text-blue-200 text-[10px] font-medium tracking-wide">
            {badgeRight}
          </span>
        </div>

        {/* title */}
        <div className="text-white text-2xl font-bold leading-tight mb-2">
          {title.split("\n").map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        {/* subtitle */}
        <div className="text-blue-100/80 text-xs mb-4 max-w-[200px] leading-relaxed">
          {subtitle.split("\n").map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onLearnMore}
          className="
            bg-white text-[#0052FF]
            text-xs font-bold
            px-5 py-2.5
            rounded-full
            shadow-sm
            active:scale-95 transition-all
            inline-flex items-center gap-1
          "
        >
          <span>Learn More</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  )
}
