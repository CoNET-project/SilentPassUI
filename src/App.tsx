//		App.tsx

import { useEffect } from "react";
import "./default.scss";
import styles from './layout.module.scss';
import {Route,Routes,MemoryRouter as Router} from 'react-router-dom';
import { useDaemonContext } from "./providers/DaemonProvider"
import { createOrGetWallet} from "./services/wallets";
import { CoNET_Data, setCoNET_Data } from "./utils/globals";
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
import { useTranslation } from 'react-i18next';
import {getFaucet} from '@/services/beamio'
import { storeSystemData } from '@/services/wallets'


global.Buffer = require('buffer').Buffer;

function App() {
	const { i18n } = useTranslation();
  	const { darkModle, setDarkModle, setProfiles, setIsInitialLoading, isInitialLoading, setBeamio } = useDaemonContext();
 
  	let handlePassportProcess = false
	let secretPhrase: string | null = null;
	let ChannelPartners = ''
	let referrals = ''

  	const init = async () => {
		console.log(isInitialLoading)
		const profiles = await createOrGetWallet(secretPhrase, false, referrals, ChannelPartners)
		setProfiles(profiles)

		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const profile = temp.profiles[0]


		let bo: beamio = temp?.beamio
		if (!bo) {
			bo = {
				accountName: '',
				image: '',
				darkTheme: false,
				isFaucet: false
			}
			temp.beamio = bo
		}
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		if (!bo.isFaucet && profile?.keyID) {
			const res = await getFaucet(profile?.keyID)
			if (res) {
				bo.isFaucet = true
				setIsInitialLoading(true)
				setCoNET_Data(temp)
				await storeSystemData()

			}
		} else {
			setIsInitialLoading(false)
		}
		

		console.log (temp)
  	}

  	let first = true
  	useEffect(() => {
		if (first) {
			first = false
			init()
		}
  	}, [])

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
		      	<div className={styles.bottom}>
		        	<Footer />
		      	</div>
		    </div>
		</Router>
  	)
}

export default App