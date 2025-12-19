//		App.tsx

import { useEffect, useState } from "react"
import "./default.scss";
import styles from './layout.module.scss';
import {Route,Routes,MemoryRouter as Router} from 'react-router-dom';
import { useDaemonContext } from "./providers/DaemonProvider"
import Footer from "@/components/Footer";
import Home from "./pages/Home";
import History from './pages/History/History'
import Pay from './pages/Pay'
import Settings from './pages/Settings'
import Chat from './pages/chat'
import ChatDetail from './pages/chatDetail'
import BeamioInstallOnboarding from '@/components/launchPage/BeamioInstallOnboarding'
import RedeemScreen from '@/pages/chat/RedeemScreen'
//			min-h-screen 

global.Buffer = require('buffer').Buffer;

function App() {
  	const { isInitialLoading } = useDaemonContext();

	useEffect(() => {
	
		const handleTouchMove = (e: TouchEvent) => {
			let el = e.target as HTMLElement | null
			if (!el) return

			// 向上爬 DOM，找到第一个 overflow 可滚动的元素
			while (el && el !== document.body) {
			const style = window.getComputedStyle(el)
			const overflowY = style.overflowY

			const isScrollable =
				(overflowY === 'auto' || overflowY === 'scroll') &&
				el.scrollHeight > el.clientHeight

			if (isScrollable) {
				// 允许滚动此容器
				return
			}

			el = el.parentElement
			}

			// 否则禁止页面拖动
			e.preventDefault()
		}

		document.addEventListener('touchmove', handleTouchMove, { passive: false })

		return () => document.removeEventListener('touchmove', handleTouchMove)
	}, [])

  	return (
		<Router initialEntries={['/Onboarding']}>
		    <div className={styles.app}>
		      	<div className={styles.body}>
		        	<Routes>
						<Route path="/Onboarding" element={<BeamioInstallOnboarding />} />
		          		<Route path="/" element={<Home />} />
		          		<Route path="/History" element={<History />} />
						<Route path="/Pay" element={<Pay />} />
		          		<Route path="/Chat" element={<Chat />} />
		          		<Route path='/chat/:id' element={<ChatDetail />} />
		          		<Route path="/settings" element={<Settings />} />
		        	</Routes>
		      	</div>
				{
					!isInitialLoading && 
					<div className={styles.bottom}>
						<Footer />
					</div>
				}
		    </div>
		</Router>
  	)
}

export default App