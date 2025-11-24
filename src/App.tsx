//		App.tsx

import { useEffect, useState } from "react";
import "./default.scss";
import styles from './layout.module.scss';
import {Route,Routes,MemoryRouter as Router} from 'react-router-dom';
import { useDaemonContext } from "./providers/DaemonProvider"

import Footer from "@/components/Footer";
import Home from "./pages/Home";
import Send from './pages/Send/Send'
import Pay from './pages/Pay'
import Settings from './pages/Settings'
import Browser from './pages/Browser'
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import jaJP from 'antd-mobile/es/locales/ja-JP';
import './i18n'; // 加载多语言配置
import { useTranslation } from 'react-i18next'


global.Buffer = require('buffer').Buffer;

function App() {
	const { i18n } = useTranslation();
  	const { darkModle, setDarkModle, setProfiles, setIsInitialLoading, isInitialLoading, setBeamio, beamio } = useDaemonContext();


	useEffect(() => {
	const root = document.documentElement
	if (darkModle) {
		root.classList.add('dark')
	} else {
		root.classList.remove('dark')
	}
	}, [darkModle])

  	useEffect(() => {
  		setDefaultConfig({
			locale: enUS,
		})
  		type AntdLocale = {
		  	en: typeof enUS;
		  	zh: typeof zhCN;
		  	jp: typeof jaJP;
		}
  		let storage = window.localStorage;
  		let lang='en';
  		const antdMLang: AntdLocale={en:enUS,zh:zhCN,jp:jaJP};
  		if(storage && storage.lang){
  			lang=storage.lang;
  		} else {
			//@ts-ignore
			const userLang = navigator.language || navigator.userLanguage;
			if (/^zh/.test(userLang)) {
				lang='zh';
			}else if (/^ja/.test(userLang)) {
			  	lang = 'ja';
			}
		}
  		setDefaultConfig({
			locale: antdMLang[lang as keyof typeof antdMLang],
		})
		i18n.changeLanguage(lang);
		localStorage.lang=lang;
  	},[])

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
		<Router initialEntries={['/']}>
		    <div className={styles.app}>
		      	<div className={styles.body}>
		        	<Routes>
		          		<Route path="/" element={<Home />} />
		          		<Route path="/Send" element={<Send />} />
						<Route path="/Pay" element={<Pay />} />
		          		<Route path="/Browser" element={<Browser />} />
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