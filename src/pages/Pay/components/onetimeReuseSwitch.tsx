import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useAnimation,
} from 'framer-motion'
import { QrCode, Link, Play, RotateCw } from 'lucide-react'

export function Onetime_reuse_Drag({
  value,
  onChange
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)

  const tabW = useMemo(() => (w > 0 ? w / 2 : 0), [w])
  const x = useMotionValue(0)

  const shellControls = useAnimation()

  const armedRef = useRef(false)
  const firedRef = useRef(false)
  const MOVE_THRESHOLD = 2

  const LEFT_LABEL = 'One-time'
  const RIGHT_LABEL = 'Reusable'

  const runMovePulse = async () => {
    shellControls.stop()
    await shellControls.start({
      scale: [1, 1.08, 0.88, 1],
      transition: {
        duration: 0.62,
        times: [0, 0.18, 0.32, 1],
        ease: [0.2, 0.9, 0.2, 1],
      },
    })
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const update = () => setW(el.clientWidth || 0)
    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 外部 value 改变，同步滑块位置
  useEffect(() => {
    if (!tabW) return
    const target = value ? tabW : 0
    animate(x, target, { duration: 0.22, ease: [0.2, 0.9, 0.2, 1] })
  }, [value, tabW])

  const setIndex = (idx: 0 | 1) => {
    // 点击切换：明确意图，直接 pulse
    runMovePulse()

    const next = idx === 1
    onChange(next)

    if (!tabW) return
    animate(x, next ? tabW : 0, { duration: 0.22, ease: [0.2, 0.9, 0.2, 1] })
  }

  const snapFromX = (currX: number) => {
    if (!tabW) return 0 as 0 | 1
    return currX >= tabW / 2 ? (1 as const) : (0 as const)
  }

  // ====== 提前变蓝 + easing 偏置 ======
  const BLUE = 'rgb(0,0,255)'
  const INACTIVE = 'rgba(0,0,255,0.15)'
  const EARLY = 0.42
  const smoothstep = (t: number) => t * t * (3 - 2 * t)

  // raw: 0..1
  const raw = useTransform(x, v => {
    if (!tabW) return value ? 1 : 0
    const p = v / tabW
    return Math.min(1, Math.max(0, p))
  })

  // biased: 提前跨过“中线”的感觉
  const biased = useTransform(raw, p => {
    let t = (p - EARLY) / (1 - EARLY)
    t = Math.min(1, Math.max(0, t))
    return smoothstep(t)
  })

  const leftColor = useTransform(biased, [0, 1], [BLUE, INACTIVE])
  const rightColor = useTransform(biased, [0, 1], [INACTIVE, BLUE])

  return (
    <motion.div
		ref={rootRef}
		animate={shellControls}
		initial={false}
		style={{
			transformOrigin: '50% 50%',
			backgroundColor: 'rgba(255,255,255,0.90)',      // ✅ 白
			backgroundImage: 'linear-gradient(0deg, rgba(0,0,255,0.05), rgba(0,0,255,0.05))'
		}}
		className="
			rounded-[18px]
			backdrop-blur-xl
			shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]
			overflow-hidden
			select-none
		"
		>
      <div className="relative h-11">
        {/* 动态滑块（可拖拽） */}
        <motion.div
          className="
            absolute inset-y-0 left-0
            rounded-[16px]
            bg-white/80
            backdrop-blur-xl
            ring-1 ring-white/70
          "
          style={{
            width: tabW || '50%',
            x,
          }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.08}
          dragConstraints={{ left: 0, right: Math.max(0, tabW) }}

          // 精确触发：按下先 armed，不触发 pulse
          onPointerDown={() => {
            armedRef.current = true
            firedRef.current = false
          }}

          // 只有真的移动（超过阈值）才触发一次 pulse
          onPan={(e, info) => {
            if (!armedRef.current || firedRef.current) return
            if (Math.abs(info.offset.x) >= MOVE_THRESHOLD) {
              firedRef.current = true
              runMovePulse()
            }
          }}

          onPanEnd={() => {
            armedRef.current = false
            firedRef.current = false

            const idx = snapFromX(x.get())
            setIndex(idx)
          }}
        />

        {/* 分隔线 */}
        <div className="relative grid grid-cols-2 h-full divide-x divide-white/30">
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="h-11 w-full flex items-center justify-center relative z-10"
          >
            <motion.span
              style={{ color: leftColor }}
              className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold"
            >
              <span>{LEFT_LABEL}</span>
              <Play className="w-4.5 h-4.5" strokeWidth={2.2} />
            </motion.span>
          </button>

          <button
            type="button"
            onClick={() => setIndex(1)}
            className="h-11 w-full flex items-center justify-center relative z-10"
          >
            <motion.span
              style={{ color: rightColor }}
              className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold"
            >
              <span>{RIGHT_LABEL}</span>
              <RotateCw className="w-4.5 h-4.5" strokeWidth={2.2} />
            </motion.span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
