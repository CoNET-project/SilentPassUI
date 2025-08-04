import { useEffect, useState } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { Home, Region } from "./pages";
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfoInChain, getAllPassports } from "./services/wallets";
import { getAllNodesV2 } from "./services/mining";
import { checkCurrentRate } from "./services/passportPurchase";
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "./utils/globals";
import {getChannelPartners} from './services/subscription'
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import Transfer from './pages/Transfer';
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import './i18n'; // 加载多语言配置

import { useTranslation } from 'react-i18next'

type AntdLocale = {
	en: typeof enUS;
	zh: typeof zhCN;
}

global.Buffer = require('buffer').Buffer;

function App() {
	const { i18n } = useTranslation();

const { setProfiles, setMiningData, allRegions, setClosestRegion, _vpnTimeUsedInMin, setChannelPartners, setShowReferralsInput} = useDaemonContext();
	const [language, setLanguage] = useState('en')

  const init = async () => {
		let vpnTimeUsedInMin = 0
		
		_vpnTimeUsedInMin.current = vpnTimeUsedInMin;

		const queryParams = parseQueryParams(window.location.search);
		let secretPhrase: string | null = null;
		let channelPartners = ''
		let referrals = ''

		if (window.location.search && queryParams) {
			secretPhrase = queryParams.get("secretPhrase");
			secretPhrase = secretPhrase ? secretPhrase.replaceAll("-", " ") : null;
			secretPhrase = queryParams.get("secretPhrase");
			channelPartners = queryParams.get("ChannelPartners")
			referrals = queryParams.get("referrals")

			//		language setup
				const language = queryParams.get("language")
				let userLang = language||navigator.language||'en'
				userLang = /^zh/i.test(userLang) ? 'zh' : 'en'
				setLanguage(userLang)
			
			//		channelPartners setup
			if (channelPartners) {
				const ischannelPartners = await getChannelPartners(channelPartners)
				if (ischannelPartners) {
					setChannelPartners(channelPartners)
				}
			}

			//		referrals setup
			if (referrals) {
				setShowReferralsInput(referrals)
			}
		
		}
		const profiles = await createOrGetWallet(secretPhrase, false, referrals, channelPartners);
		setProfiles(profiles)

		getAllNodesV2(setClosestRegion, async (allNodes: nodes_info[]) => {
			console.log(`kkkkk`)
		})
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
		locale: zhCN,
	})
	let lang=language
	const antdMLang: AntdLocale={en:enUS,zh:zhCN};
	if (!lang) {
		const userLang = navigator.language
		if (/^zh/.test(userLang)) {
			lang='zh'
		}
	}
	
	setDefaultConfig({
		locale: antdMLang[lang as keyof typeof antdMLang],
	})
	i18n.changeLanguage(lang)
  },[language])

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Home />}></Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
