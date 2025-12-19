import React, { useEffect, useMemo } from 'react'
import { motion, useAnimation } from 'framer-motion'
import type { Transition } from 'framer-motion'

function LockModeSwitch({
  value,
  onChange,
  children,
}: {
  value: boolean
  onChange: (v: PaymentLinkLockMode) => void
  children?: React.ReactNode
}) {
  const isLOCK = value

  // knob 动画控制器
  const knob = useAnimation()

  // 轨道内偏移：左侧基准 2px，右侧目标 18px
  const targetX = useMemo(() => (isLOCK ? 16 : 0), [isLOCK])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      knob.set({
        x: targetX,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
      })

      const moveT: Transition = {
        x: { type: 'spring', stiffness: 620, damping: 40, mass: 0.6 },
        opacity: { duration: 0.01 },
        scaleX: { duration: 0.01 },
        scaleY: { duration: 0.01 },
      }

      await knob.start({
        x: targetX,
        opacity: 0.3,
        scaleX: 2,
        scaleY: 2,
        transition: moveT,
      })

      if (cancelled) return

      await knob.start({
        opacity: 0.6,
        scaleX: 1.18,
        scaleY: 1.18,
        transition: { duration: 0.28, ease: [0.2, 0.9, 0.2, 1] },
      })

      if (cancelled) return

      await knob.start({
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        transition: { duration: 0.18, ease: 'easeOut' },
      })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [targetX, knob])

  return (
    <div className="flex items-center gap-3">
      {/* 左侧 title（可选） */}
      {children && (
        <div className="flex-1 text-sm font-medium text-slate-700">
          {children}
        </div>
      )}

      {/* 右侧 iOS Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={isLOCK}
        onClick={() => onChange(isLOCK ? 'FIAT_LOCKED' : 'USDC_LOCKED')}
        className={`
          relative inline-flex
          w-[44px] h-[26px]
          flex-shrink-0
          rounded-full
          transition-colors duration-200
          focus:outline-none
          focus:ring-2 focus:ring-blue-300
          ${isLOCK ? 'bg-blue-500' : 'bg-slate-300'}
        `}
      >
        {/* 轨道高光 */}
        <span
          aria-hidden
          className="
            absolute inset-0 rounded-full
            shadow-inner
            opacity-40
          "
        />

        {/* 水滴滑块 */}
        <motion.span
          className="
            absolute top-[2px] left-[2px]
            w-[22px] h-[22px]
            rounded-full
            bg-white
            shadow
            will-change-transform
          "
          animate={knob}
        />
      </button>
    </div>
  )
}

export default LockModeSwitch
