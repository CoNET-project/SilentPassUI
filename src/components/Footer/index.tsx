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
type Phase = 'idle' | 'moving' | 'settling' | 'impact'

const ICON_CLASS = 'w-11 h-11 block'
const SLOT_H = 'h-12'

const Footer = ({ visible, peek }: { visible: boolean; peek: boolean }) => {
	const barControls = useAnimation()

	useEffect(() => {
		let cancelled = false

		const run = async () => {
			// ✅ 避免前一段动画还在跑造成抖动
			barControls.stop()

			if (!visible) {
				await barControls.start({
					y: '110%',
					opacity: 0,
					transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] },
				})
				return
			}

			// ✅ 显示：一气呵成（进场 -> overshoot -> 回落）
			barControls.set({ y: '110%', opacity: 0 })

			await barControls.start({
				y: ['110%', '-10%', '0%'],
				opacity: [0, 1, 1],
				transition: {
					duration: 0.56,
					times: [0, 0.40, 1],
					ease: [0.2, 0.9, 0.2, 1],
				},
			})

			if (cancelled) return
		}

		run()

		return () => {
			cancelled = true
		}

		// ✅ 关键修复：不要依赖 peek（peek 改变会导致滑入动画跑两次）
	}, [visible, barControls])

	const navigate = useNavigate()
	const { pathname } = useLocation()
	const [animId, setAnimId] = useState(0)
	const totalDur = 0.62
	const { hasNewVersion, darkModle, isInitialLoading } = useDaemonContext()
	const [showBar, setShowBar] = useState(true)

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

	const tabs = useMemo(
		() =>
			([
				{
					key: '/' as const,
					iconGrey: <HomeIconGrey className={ICON_CLASS} />,
					iconBlue: <HomeBlueIcon className={ICON_CLASS} />,
					title: 'Home',
				},
				{
					key: '/history' as const,
					iconGrey: <SendIconGrey className={ICON_CLASS} />,
					iconBlue: <SendBlueIcon className={ICON_CLASS} />,
					title: 'Transactions',
				},
				{
					key: '/pay' as const,
					iconGrey: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
					iconBlue: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
					title: '',
				},
				{
					key: '/chat' as const,
					iconGrey: <ChatGreyIcon className={ICON_CLASS} />,
					iconBlue: <ChatBlueIcon className={ICON_CLASS} />,
					title: 'Chat',
				},
				{
					key: '/settings' as const,
					iconGrey: <WalletIconGrey className={ICON_CLASS} />,
					iconBlue: <WalletBlueIcon className={ICON_CLASS} />,
					title: 'Me',
					...(hasNewVersion ? { badge: '1' } : {}),
				},
			] as const),
		[darkModle, hasNewVersion]
	)

	const activeIndex = useMemo(() => {
		const i = tabs.findIndex(t => t.key === activeKey)
		return i >= 0 ? i : 0
	}, [tabs, activeKey])

	useEffect(() => {
		setAnimId(v => v + 1)
	}, [activeIndex])

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

	useEffect(() => {
		if (!shouldRender) return

		let cancelled = false

		const run = async () => {
			dropletControls.set({
				x: `${prevIndexRef.current * 100}%`,
				borderRadius: 999,
				scaleX: 0.5,
				scaleY: 0.5,
			})

			setPhase('moving')

			await dropletControls.start({
				borderRadius: 26,
				scaleX: 1.10,
				scaleY: 0.90,
				transition: {
					duration: 0.12,
					ease: [0.55, 0.0, 1.0, 0.45],
				},
			})
			setPhase('settling')
			if (cancelled) return

			await dropletControls.start({
				borderRadius: 26,
				scaleX: 1.272,
				scaleY: 1.152,
				transition: {
					duration: 0.14,
					ease: [0.55, 0.0, 1.0, 0.45],
				},
			})

			await dropletControls.start({
				scaleX: 1.06,
				scaleY: 0.96,
				transition: {
					duration: 0.55,
					ease: [0.2, 0.9, 0.2, 1],
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

		const iconTarget = (() => {
			if (!active) return { scaleX: 1, scaleY: 1, y: 0 }
			if (phase === 'moving') return { scaleX: 0.7, scaleY: 0.60, y: 2 }
			return { scaleX: 1, scaleY: 1, y: 0 }
		})()

		const iconTransition: Transition = (() => {
			if (!active) return { duration: 0.12 }
			if (phase === 'moving') return { type: 'spring', stiffness: 950, damping: 85, mass: 0.35 }
			if (phase === 'settling') return { duration: 0.6, ease: [0.12, 0.82, 0.18, 1] }
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
					transition={
						phase === 'settling'
							? { duration: 0.38, ease: [0.2, 0.9, 0.2, 1] }
							: { duration: 0.18, ease: 'easeOut' }
					}
				>
					{title}
				</motion.div>
			</button>
		)
	}

	return (
		<motion.div
			className="fixed left-0 right-0 bottom-0 z-50 px-4 pb-4"
			animate={barControls}
			initial={false}
			style={{ willChange: 'transform, opacity' }}
		>
			{/* 下面内容保持你原样 */}
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
						? 'rgba(15, 23, 42, 0.25)'
						: 'rgba(255, 255, 255, 0.25)',
				}}
				animate={phase === 'moving' ? { scale: 1.03 } : { scale: 1 }}
				transition={
					phase === 'moving'
						? { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }
						: { duration: 0.45, ease: [0.2, 0.9, 0.2, 1] }
				}
			>
				<div className="relative">
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
		</motion.div>
	)
}

export default Footer
