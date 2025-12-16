// Footer/index.tsx

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'

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

import styles from '@/components/Footer/footer.module.scss'

const Footer = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { pathname } = location

	const { hasNewVersion, darkModle, isInitialLoading } = useDaemonContext()
	const [showBar, setShowBar] = useState(true)

	// 主题切换
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

	const tabs = [
		{
			key: '/',
			title: 'Home',
			iconGrey: <HomeIconGrey />,
			iconBlue: <HomeBlueIcon />,
		},
		{
			key: '/history',
			title: 'Transactions',
			iconGrey: <SendIconGrey />,
			iconBlue: <SendBlueIcon />,
		},
		{
			key: '/pay',
			title: 'Pay & Request',
			iconGrey: <div style={{ width: '2rem', height: '2rem' }} />,
			iconBlue: <div style={{ width: '2rem', height: '2rem' }} />,
		},
		{
			key: '/chat',
			title: 'Chat',
			iconGrey: <ChatGreyIcon />,
			iconBlue: <ChatBlueIcon />,
		},
		{
			key: '/settings',
			title: 'Me',
			iconGrey: <WalletIconGrey />,
			iconBlue: <WalletBlueIcon />,
			...(hasNewVersion ? { badge: '1' } : {}),
		},
	] as const

	// ✅ 关键：把 pathname 归一成一个“TabBar activeKey”
	// - 大小写不敏感
	// - 支持子路由：/history/xxx 也归到 /history
	const activeKey = useMemo(() => {
		const p = (pathname || '/').toLowerCase()

		if (p === '/' || p.startsWith('/?')) return '/'
		if (p.startsWith('/history')) return '/history'
		if (p.startsWith('/chat')) return '/chat'
		if (p.startsWith('/settings')) return '/settings'
		if (p.startsWith('/pay')) return '/pay'

		return p
	}, [pathname])

	const setRouteActive = (value: string) => {
		navigate(value)
	}

	if (!showBar || (!isStandalone && MobileType() !== 'desktop')) return null

	return (
		<div className={styles.footer}>
			<TabBar safeArea={false} activeKey={activeKey} onChange={setRouteActive}>
				{tabs.map(item => (
					<TabBar.Item
						key={item.key}
						title={item.title}
						badge={(item as any).badge}
						icon={activeKey === item.key ? item.iconBlue : item.iconGrey}
					/>
				))}
			</TabBar>

			{/* 悬浮在 TabBar 上方的 BLogo */}
			<div className={styles.payCenterLogo} onClick={() => setRouteActive('/pay')}>
				{darkModle ? (
					<BLogo style={{ width: '4rem', height: '4rem' }} />
				) : (
					<BLogoLight style={{ width: '4rem', height: '4rem' }} />
				)}
			</div>
		</div>
	)
}

export default Footer
