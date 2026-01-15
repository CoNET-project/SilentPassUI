import React, { useEffect, useMemo, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import type { Transition } from 'framer-motion'

import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { Globe, Info, Percent } from 'lucide-react'

function TaxSwitch ({
  value,
  onChange,
  taxRate
}: {
  value: boolean
  onChange: (v: boolean) => void
  taxRate: number
}) {

  // ✅ info tip (only for local currency mode)
  const [showInfo, setShowInfo] = useState(false)

  // knob 动画控制器
  const knob = useAnimation()

  // 轨道内偏移：左侧基准 2px，右侧目标 18px，所以 x = 16
  const targetX = useMemo(() => (value ? 16 : 0), [value])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // 确保初始位置正确（避免首次渲染跳动）
      knob.set({
        x: targetX,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
      })

      // 1) 移动开始：变“半透明圆球”，高度扩大 1.5x，并移动到新位置
      const moveT: Transition = {
        x: { type: 'spring', stiffness: 620, damping: 40, mass: 0.6 },
        opacity: { duration: 0.01, ease: 'easeOut' },
        scaleX: { duration: 0.01, ease: 'easeOut' },
        scaleY: { duration: 0.01, ease: 'easeOut' },
      }

      await knob.start({
        x: targetX,
        opacity: 0.3,
        scaleX: 2,
        scaleY: 2,
        transition: moveT,
      })

      if (cancelled) return

      // 2) 到达后：缓缓扁平化（更像“凝胶落地”）
      await knob.start({
        opacity: 0.6,
        scaleX: 1.18,
        scaleY: 1.18,
        transition: { duration: 0.28, ease: [0.2, 0.9, 0.2, 1] },
      })

      if (cancelled) return

      // 3) 最终恢复正常圆形
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

  // ✅ mode changed -> hide info automatically (optional but feels right)
  useEffect(() => {
    if (value) setShowInfo(false)
  }, [value])

  return (
    <div className="w-full mt-6">
      <div className="flex items-center justify-between gap-3 w-full">
        {/* 左侧内容（单层 DOM，opacity 切换） */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Icon */}
          <div className="relative w-6 h-6 flex-shrink-0">
            

            
          </div>

          {/* Text（单层：内容直接切换，不叠） */}
          <div className="min-w-0 transition-opacity duration-150">
            <div className="text-sm font-semibold text-slate-900 leading-snug">
              {value ? `${taxRate}% Tax Include` : 'No Tax'}
            </div>
            {/* <div className="text-xs text-slate-500 leading-snug">
              {!value ? 'USDC at checkout' : ''}
            </div> */}
          </div>

          {/* ✅ Info button (only when !isUSDC) */}
          
			<button
				type="button"
				onClick={() => setShowInfo(v => !v)}
				className={`
				ml-1 h-7 w-7 rounded-full flex items-center justify-center transition
				${showInfo
					? 'text-amber-700 bg-amber-500/15'
					: 'text-amber-600 hover:bg-amber-500/10 active:bg-amber-500/20'}
				`}
				aria-label="Rate info"
				title="Rate info"
			>
				<Info className="h-4 w-4" />
			</button>
			
        </div>

        {/* 右侧 iOS Switch + 水滴滑块 */}
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => {
            
            onChange(value ? false : true)
          }}
          className={`
            relative inline-flex
            w-[44px] h-[26px]
            flex-shrink-0
            rounded-full
            transition-colors duration-200
            focus:outline-none
            ${value ? 'bg-blue-500' : 'bg-slate-300'}
        
          `}
        >
          {/* 轨道高光（可选，让半透明更像 iOS） */}
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

      {/* ✅ Yellow info text under the whole control */}
      {showInfo && (
        <div className="mt-2 text-[12px] leading-snug text-amber-700">
          <div>Estimates additional tax to the amount. Final amount is in USDC.</div>
          <div>Rate source: Coinbase price feed</div>
        </div>
      )}
    </div>
  )
}

export default TaxSwitch
