// Footer/index.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, useAnimation } from 'framer-motion'

import { ReactComponent as HomeIconGrey } from './assets/home-icon-grey.svg'
import { ReactComponent as HomeBlueIcon } from './assets/home-icon-blue.svg'
import { ReactComponent as SendIconGrey } from './assets/send-icon-grey.svg'
import { ReactComponent as SendBlueIcon } from './assets/send-icon-blue.svg'
import { ReactComponent as WalletBlueIcon } from './assets/wallet-icon-blue.svg'
import { ReactComponent as WalletIconGrey } from './assets/wallet-icon-grey.svg'
import { ReactComponent as ChatBlueIcon } from './assets/chat-blue.svg'
import { ReactComponent as ChatGreyIcon } from './assets/chat-grey.svg'

import { ReactComponent as BLogo } from './assets/B-icon.svg'
import { ReactComponent as BLogoLight } from './assets/B-icon-light.svg'

import { isStandalone, MobileType } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import type { Transition } from 'framer-motion'

type TabKey = '/' | '/history' | '/pay' | '/chat' | '/settings'
type Phase = 'idle' | 'moving' | 'settling'|'impact'

const ICON_CLASS = 'w-11 h-11 block'
const SLOT_H = 'h-12'

const Footer = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
	const [animId, setAnimId] = useState(0)
const totalDur = 0.62 // 整体动画时长（前快后慢的手感关键）
  const { hasNewVersion, darkModle, isInitialLoading } = useDaemonContext()
  const [showBar, setShowBar] = useState(true)

  // ✅ 水珠动画控制（两段式：球 -> 移动 -> 压扁）
  const dropletControls = useAnimation()
  const [phase, setPhase] = useState<Phase>('idle')

  useEffect(() => {
    const root = document.documentElement
    if (darkModle) {
      root.classList.add('dark', 'theme-dark')
      root.classList.remove('theme-light')
    } else {
      root.classList.remove('dark', 'theme-dark')
      root.classList.add('theme-light')
    }
  }, [darkModle])

  useEffect(() => {
    setShowBar(!isInitialLoading)
  }, [isInitialLoading])

  const activeKey = useMemo<TabKey>(() => {
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return
      const tag = el.tagName?.toLowerCase()
      const editable =
        tag === 'input' || tag === 'textarea' || (el as any).isContentEditable
      if (editable) el.blur()
    })

    const p = (pathname || '/').toLowerCase()
    if (p === '/' || p.startsWith('/?')) return '/'
    if (p.startsWith('/history')) return '/history'
    if (p.startsWith('/pay')) return '/pay'
    if (p.startsWith('/chat')) return '/chat'
    if (p.startsWith('/settings')) return '/settings'
    return '/'
  }, [pathname])

  const go = (k: TabKey) => {
    const el = document.activeElement as HTMLElement | null
    el?.blur()
    navigate(k)
  }

  const tabs = useMemo(() => ([
    {
      key: '/' as const,
      iconGrey: <HomeIconGrey className={ICON_CLASS} />,
      iconBlue: <HomeBlueIcon className={ICON_CLASS} />,
	  title: 'Home'
    },
    {
      key: '/history' as const,
      iconGrey: <SendIconGrey className={ICON_CLASS} />,
      iconBlue: <SendBlueIcon className={ICON_CLASS} />,
	  title: 'Transactions'
    },
    {
      key: '/pay' as const,
      iconGrey: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
      iconBlue: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
	  title: ''
    },
    {
      key: '/chat' as const,
      iconGrey: <ChatGreyIcon className={ICON_CLASS} />,
      iconBlue: <ChatBlueIcon className={ICON_CLASS} />,
	  title: 'Chat'
    },
    {
      key: '/settings' as const,
      iconGrey: <WalletIconGrey className={ICON_CLASS} />,
      iconBlue: <WalletBlueIcon className={ICON_CLASS} />,
	  title: 'Me',
      ...(hasNewVersion ? { badge: '1' } : {}),
    },
  ] as const), [darkModle, hasNewVersion])

  const activeIndex = useMemo(() => {
    const i = tabs.findIndex(t => t.key === activeKey)
    return i >= 0 ? i : 0
  }, [tabs, activeKey])

  useEffect(() => {
  setAnimId(v => v + 1)
}, [activeIndex])

  // ✅ 方向判定（右移 +1 / 左移 -1）
  const prevIndexRef = useRef(activeIndex)
  const [direction, setDirection] = useState<1 | -1>(1)

  useEffect(() => {
    const prev = prevIndexRef.current
    const next = activeIndex
    if (next === prev) return

    setDirection(next > prev ? 1 : -1)
    prevIndexRef.current = next
  }, [activeIndex])

  const shouldRender = useMemo(() => {
    return showBar && (isStandalone || MobileType() === 'desktop')
  }, [showBar])

  // ✅ 两段式：球形移动 -> 缓慢压扁
useEffect(() => {
  if (!shouldRender) return

  let cancelled = false

  const run = async () => {
    

	/* ================================
     * ① 移动开始：瞬间缩小到 10%
     * ================================ */
    dropletControls.set({
	x: `${prevIndexRef.current * 100}%`,   // ✅ 用旧位置（很关键）
	borderRadius: 999,
	scaleX: 0.5,
	scaleY: 0.5,
	})

	setPhase('moving')
    /* ================================
     * ② 快速放大成球体 + 同时移动
     * ================================ */
    await dropletControls.start({
		borderRadius: 26,
		scaleX: 1.10,
		scaleY: 0.90,
		transition: {
			duration: 0.12,
			ease: [0.55, 0.0, 1.0, 0.45], // ✅ 加速结束（无减速）
		},
	})
	setPhase('settling')
    if (cancelled) return


		// ③A：高速进入「120% 扁平态」（承接上一段高速）
		await dropletControls.start({
		borderRadius: 26,
		scaleX: 1.272, // 1.06 * 1.2
		scaleY: 1.152, // 0.96 * 1.2
		transition: {
			duration: 0.14,
			ease: [0.55, 0.0, 1.0, 0.45], // ✅ 加速结束（无减速）
		},
		})

		// ④：从 120% 慢慢恢复到 100%（最终尺寸）
		await dropletControls.start({
		scaleX: 1.06,
		scaleY: 0.96,
		transition: {
			duration: 0.55,
			ease: [0.2, 0.9, 0.2, 1], // ✅ 缓慢收尾
		},
		})

    if (cancelled) return
    setPhase('idle')
  }

  run()

  return () => {
    cancelled = true
  }
}, [activeIndex, shouldRender, dropletControls])

  if (!shouldRender) return null

  const iconMotion = (active: boolean) => {
    if (!active) return { scaleX: 1, scaleY: 1, y: 0 }

    // ✅ icon 被“球珠”挤压：moving 时更明显，settling 时再恢复
    if (phase === 'moving') {
      return {
        scaleX: 1.18,
        scaleY: 0.72,
        y: 2,
      }
    }

    if (phase === 'settling') {
      return {
        scaleX: 1,
        scaleY: 1,
        y: 0,
      }
    }

    return { scaleX: 1, scaleY: 1, y: 0 }
  }

const Item = ({
  k,
  iconGrey,
  iconBlue,
  title,
  badge,
}: {
  k: TabKey
  iconGrey: React.ReactNode
  iconBlue: React.ReactNode
  title: string
  badge?: string
}) => {
  const active = activeKey === k

  // ✅ iOS 风格：impact 快速压一下（无反弹），settling 慢慢恢复
// ✅ iOS 风格：moving 快速压一下（无反弹），settling 慢慢恢复（前快后慢）
const iconTarget = (() => {
  if (!active) return { scaleX: 1, scaleY: 1, y: 0 }

  // 球体移动阶段：icon 被挤压
  if (phase === 'moving') {
    return { scaleX: 0.7, scaleY: 0.60, y: 2 }
  }

  // 到达后压扁阶段 + idle：icon 恢复原样
  return { scaleX: 1, scaleY: 1, y: 0 }
})()

const iconTransition: Transition = (() => {
  if (!active) return { duration: 0.12 }

  // ✅ 挤压要快、稳、无抖：高阻尼 spring
  if (phase === 'moving') {
    return { type: 'spring', stiffness: 950, damping: 85, mass: 0.35 }
  }

  // ✅ 恢复要“从急速到结束缓慢”：用 easeOut tween（前快后慢）
  if (phase === 'settling') {
    return { duration: 0.6, ease: [0.12, 0.82, 0.18, 1] }
  }

  // idle：小幅修正（基本不需要动）
  return { duration: 0.18, ease: 'easeOut' }
})()

  return (
    <button
      type="button"
      onClick={() => go(k)}
      className="
        relative w-full h-12 px-0.5
		flex flex-col items-center justify-center
		gap-[2px]
		select-none focus:outline-none
      "
    >
      {/* Icon */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={iconTarget}
        transition={iconTransition}
      >
        {active ? iconBlue : iconGrey}

        {badge && (
          <span
            className="
              absolute -top-1 -right-1
              min-w-[16px] h-[16px] px-1
              rounded-full
              bg-rose-500
              text-[11px] leading-[16px]
              text-white
              flex items-center justify-center
            "
          >
            {badge}
          </span>
        )}
      </motion.div>

      {/* Label */}
      <motion.div
        className={`
          text-[11px] leading-none font-medium
          ${active ? 'text-[#9fbfe5]' : 'text-slate-400 dark:text-slate-500'}
        `}
        animate={
          active && (phase === 'impact' || phase === 'settling')
            ? { opacity: 0.85, y: 1 }
            : { opacity: 1, y: 0 }
        }
        transition={phase === 'settling' ? { duration: 0.38, ease: [0.2, 0.9, 0.2, 1] } : { duration: 0.18, ease: 'easeOut' }}
      >
        {title}
      </motion.div>
    </button>
  )
}


  return (
    <div className="fixed left-0 right-0 bottom-0 z-50 px-4 pb-4">
      <motion.div
        className="
           mx-auto max-w-[520px]
		rounded-[24px]
		px-1 py-1.5
		bg-white/90 dark:bg-slate-900/40
		backdrop-blur-lg
		border border-white/10 dark:border-white/10
		shadow-[0_14px_40px_rgba(0,0,0,0.18)]
        "
		
        style={{
          background: darkModle
      ? 'rgba(15, 23, 42, 0.25)'   // 深色半透明
      : 'rgba(255, 255, 255, 0.25)' // 浅色半透明
        }}

		animate={
			phase === 'moving'
			? { scale: 1.03 }
			: { scale: 1 }
		}
		transition={
			phase === 'moving'
			? { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }
			: { duration: 0.45, ease: [0.2, 0.9, 0.2, 1] }
		}
      >
        <div className="relative">
          {/* ✅ 水珠：放在同一个 5 等分容器中，不会漂移 */}
          <motion.div
            className="
              absolute inset-y-0 left-0 w-1/5
              overflow-hidden
			  -top-2 -bottom-2
              backdrop-blur-3xl
              shadow-[0_14px_36px_rgba(0,0,0,0.20)]
              border border-white/60 dark:border-slate-700/70
              pointer-events-none
            "
            style={{
              background: darkModle
                ? 'radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,0.12), rgba(15,23,42,0.78) 55%)'
                : 'radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,0.98), rgba(255,255,255,0.70) 58%)',
            }}
            initial={{
              x: `${activeIndex * 100}%`,
              borderRadius: 26,
              scaleX: 1.06,
              scaleY: 0.96,
            }}
            animate={dropletControls}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ x: ['-18%', '18%', '-18%'] }}
              transition={{ duration: 3.0, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.36) 45%, transparent 60%)',
                filter: 'blur(10px)',
              }}
            />
          </motion.div>

          <div className="relative grid grid-cols-5 items-center gap-0">
			{tabs.map(t => (
				<Item
				key={t.key}
				k={t.key}
				iconGrey={t.iconGrey}
				iconBlue={t.iconBlue}
				title={t.title}
				badge={(t as any).badge}
				/>
			))}
			</div>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </motion.div>
    </div>
  )
}

export default Footer
