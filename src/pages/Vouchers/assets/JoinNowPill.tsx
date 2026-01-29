import React from "react"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"

const BEAMIO_BLUE_RGBA_40 = "rgba(29, 91, 255, 0.4)"

export function JoinNowPill({
  onClick,
  label = "JOIN",
}: {
  onClick?: () => void
  label?: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="
        relative
        h-7
        px-4
        rounded-full
        inline-flex items-center justify-center gap-2
        select-none
        whitespace-nowrap
        leading-none
        text-white
        font-extrabold
        tracking-wide
        backdrop-blur-xl
        bg-white/12
        border border-white/18
        shadow-[0_18px_45px_rgba(0,0,0,0.18)]
        hover:bg-white/16
        active:bg-white/14
        transition
      "
    >
      {/* iOS-style inner highlight */}
      <span
        aria-hidden
        className="
          pointer-events-none
          absolute inset-[2px]
          rounded-full
          bg-gradient-to-b
          from-white/22
          via-white/10
          to-white/0
        "
      />

      <span className="relative text-[10px] whitespace-nowrap">
        {label}
      </span>
    </motion.button>
  )
}
