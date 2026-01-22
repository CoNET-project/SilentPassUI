// Footer/index.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, useAnimation } from 'framer-motion'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
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

import { isStandalone, MobileType, searchUsername, storeSystemData} from '@/services/beamio'
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
		barControls.stop()

		const HIDE_Y = 140 // ✅ 往下移出屏幕

		if (!visible) {
		await barControls.start({
			y: HIDE_Y,
			opacity: 0,
			transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }
		})
		return
		}

		// ✅ 显示：从下面上来 -> overshoot -> 回落
		barControls.set({ y: HIDE_Y, opacity: 0 })

		await barControls.start({
		y: [HIDE_Y, -12, 0], // -12 = 轻微上冲
		opacity: [0, 1, 1],
		transition: {
			duration: 0.56,
			times: [0, 0.40, 1],
			ease: [0.2, 0.9, 0.2, 1]
		}
		})

		if (cancelled) return
	}

	run()

	return () => {
		cancelled = true
	}
	}, [visible, barControls])

	const navigate = useNavigate()
	const { pathname } = useLocation()
	const [animId, setAnimId] = useState(0)
	const totalDur = 0.62
	const { hasNewVersion, darkModle, isInitialLoading, charts, profiles, setCharts, setProfiles } = useDaemonContext()
	const [messageCount, setMessageCount] = useState(0)
	const [showBar, setShowBar] = useState(true)
	const runningRef = useRef(false)
	const seenMsgRef = useRef<Set<string>>(new Set())

	const getMsgKey = (raw: any) => {
		// charts 可能是 string(JSON) 或对象
		try {
			const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
			const ts = Number(obj?.timestamp)
			const from = String(obj?.from || '')
			// ✅ 只要 timestamp 有意义，就用 timestamp；更保险可以加 from
			if (Number.isFinite(ts) && ts > 0) return `${ts}` // 或 `${from}_${ts}`
		} catch {}
		return null
	}


	useEffect(() => {
		
		if (!Array.isArray(charts) || charts.length === 0) return
		if (runningRef.current) return

		runningRef.current = true

		try {
			let delta = 0
			const seen = seenMsgRef.current

			for (const raw of charts) {
				const key = getMsgKey(raw)
				if (!key) continue
				if (seen.has(key)) continue
				seen.add(key)
				delta += 1
			}

			if (delta > 0) {
			// ✅ 用函数式更新，避免闭包旧值
			setMessageCount(prev => {
				const next = prev + delta

				// ✅ badge 也用 next（而不是旧 messageCount）
				setBadgeMap(v => ({
					...v,
					'/chat': next
				}))

				return next
			})
			}
		} finally {
			runningRef.current = false
		}
		
	}, [charts])
	
	const [badgeMap, setBadgeMap] = useState<Record<TabKey, number>>({
		'/': 0,
		'/history': 0,
		'/pay': 0,        // ✅ 中间 B icon 不用（即使有值也不会显示）
		'/chat': 0,
		'/settings': hasNewVersion ? 1 : 0
	})

	// 如果 hasNewVersion 变化，你希望 settings badge 跟着更新
	useEffect(() => {
		setBadgeMap(v => ({
		...v,
		'/settings': hasNewVersion ? Math.max(v['/settings'] || 0, 1) : 0
		}))
	}, [hasNewVersion])

	const getBadge = React.useCallback((k: TabKey) => {
		if (k === '/pay') return undefined
		const n = badgeMap[k] || 0
		if (n <= 0) return undefined
		return n > 99 ? '99+' : String(n)
	}, [badgeMap])
	
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

		// ✅ 进入页面即清除该 tab badge（中间 /pay 跳过）
		if (k !== '/pay') {
			setBadgeMap(v => ({ ...v, [k]: 0 }))
			if (k === '/chat') {
				setMessageCount(0)
				seenMsgRef.current.clear() // ✅ 需要“彻底重置计数”才开
			}
		}

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
				badge: getBadge('/'),
			},
			{
			key: '/history' as const,
				iconGrey: <SendIconGrey className={ICON_CLASS} />,
				iconBlue: <SendBlueIcon className={ICON_CLASS} />,
				title: 'Transactions',
				badge: getBadge('/history'),
			},
			{
				key: '/pay' as const,
				iconGrey: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
				iconBlue: darkModle ? <BLogo className={ICON_CLASS} /> : <BLogoLight className={ICON_CLASS} />,
				title: '',
				// ✅ 不要 badge
			},
			{
				key: '/chat' as const,
				iconGrey: <ChatGreyIcon className={ICON_CLASS} />,
				iconBlue: <ChatBlueIcon className={ICON_CLASS} />,
				title: 'Chat',
				badge: getBadge('/chat'),
			},
			{
				key: '/settings' as const,
				iconGrey: <WalletIconGrey className={ICON_CLASS} />,
				iconBlue: <WalletBlueIcon className={ICON_CLASS} />,
				title: 'Me',
				badge: getBadge('/settings') // ✅ charts.length 在这里生效
			},
		] as const),
		// ✅ 依赖 getBadge / badgeMap / darkModle
		// getBadge 是闭包函数，这里最简单就是把 badgeMap 放进依赖，并且保证 getBadge 不在 useMemo 外重建也行
		// 你如果担心 eslint，可以把 getBadge 用 useCallback 包一下
		[darkModle, badgeMap]
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


	//					紅色氣泡表示
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
							absolute top-[2px] right-[2px]
							z-20
							min-w-[16px] h-[16px] px-1
							rounded-full
							bg-rose-500
							text-[11px] leading-[16px]
							text-white
							flex items-center justify-center
							ring-2 ring-white/70 dark:ring-slate-900/60
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
			className="fixed left-0 right-0 z-50"
			animate={barControls}
			initial={false}
			style={{
				bottom: '1rem',//'calc(1rem + env(safe-area-inset-bottom))',
				willChange: 'bottom, opacity',
				pointerEvents: 'none'
			}}
		>
			 {/* ✅ 玻璃层：不做 transform，只负责 blur */}
			<div className="mx-auto max-w-[800px] px-4 pointer-events-auto">
				<div
					className="
						relative
						rounded-[28px]
						overflow-visible
						shadow-[0_10px_28px_rgba(0,0,0,0.18)]
					"
					>
					{/* ✅ 背景玻璃层：负责圆角裁切 + blur */}
					<div
						className="
						absolute inset-0
						rounded-[28px]
						overflow-hidden
						border border-white/60 dark:border-white/10
						pt-2 pb-2.5
						"
						style={{
						backgroundColor: darkModle
							? 'rgba(10, 10, 30, 0.4)'
							: 'rgba(240, 240, 255, 0.95)',
						WebkitBackdropFilter: 'blur(36px) saturate(150%)',
						backdropFilter: 'blur(36px) saturate(150%)',
						transform: 'translate3d(0,0,0)',
						WebkitTransform: 'translate3d(0,0,0)',
						pointerEvents: 'none'
						}}
					>
						{/* ✅ droplet 放在背景层里（被圆角裁切没问题） */}
						<div className="relative h-full">
						<motion.div
							className="
							absolute inset-y-0 left-0 w-1/5
							overflow-hidden
							-top-2 -bottom-2
							border border-white/60 dark:border-slate-700/70
							pointer-events-none
							"
							style={{
							background: darkModle
								? 'radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,0.12), rgba(15,23,42,0.78) 55%)'
								: 'radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,0.98), rgba(255,255,255,0.70) 58%)'
							}}
							initial={{
							x: `${activeIndex * 100}%`,
							borderRadius: 26,
							scaleX: 1.06,
							scaleY: 0.96
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
								filter: 'blur(10px)'
							}}
							/>
						</motion.div>
						</div>
					</div>

					{/* ✅ 前景内容层：不裁切，所以 badge 可以越界 */}
					<div className="relative pt-2 pb-2.5 overflow-visible pointer-events-auto">
						<div className="relative grid grid-cols-5 items-center gap-0 overflow-visible">
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
					</div>
				
			</div>
			
		</motion.div>
	)
}

export default Footer
