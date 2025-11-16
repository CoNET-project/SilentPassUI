//		App.tsx

import { useEffect } from "react";
import "./default.scss";
import styles from './layout.module.scss';
import {Route,Routes,useNavigate,useLocation,MemoryRouter as Router} from 'react-router-dom';
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfoInChain, getAllPassports } from "./services/wallets";
import { getAllNodesV2 } from "./services/mining";
import { checkCurrentRate } from "./services/passportPurchase";
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";
import Footer from "@/components/Footer";
import Home from "./pages/Home";
import Send from './pages/Send/Send'
import Pay from './pages/Pay'
import Settings from './pages/Settings'
import Wallet from './pages/Wallet'
import Browser from './pages/Browser'
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import jaJP from 'antd-mobile/es/locales/ja-JP';
import './i18n'; // 加载多语言配置
import { useTranslation } from 'react-i18next';


global.Buffer = require('buffer').Buffer;

function App() {
	const { i18n } = useTranslation();
  	const { darkModle, setDarkModle, setProfiles } = useDaemonContext();
 
  	let handlePassportProcess = false
	let secretPhrase: string | null = null;
	let ChannelPartners = ''
	let referrals = ''

  	const init = async () => {
		const profiles = await createOrGetWallet(secretPhrase, false, referrals, ChannelPartners)
		setProfiles(profiles)
  	}

  	let first = true
  	useEffect(() => {
		if (first) {
			first = false
			init()
		}
  	}, [])

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