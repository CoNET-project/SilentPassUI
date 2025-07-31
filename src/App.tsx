import { useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { Home, Region } from "./pages";
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfoInChain, getAllPassports } from "./services/wallets";
import { getAllNodesV2 } from "./services/mining";
import { checkCurrentRate } from "./services/passportPurchase";
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "./utils/globals";

import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import Transfer from './pages/Transfer';
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import './i18n'; // 加载多语言配置

import { useTranslation } from 'react-i18next';

type AntdLocale = {
	en: typeof enUS;
	zh: typeof zhCN;
}

global.Buffer = require('buffer').Buffer;

function App() {
	const { i18n } = useTranslation();

  const { setProfiles, setMiningData, allRegions, setClosestRegion, _vpnTimeUsedInMin} = useDaemonContext();


  const init = async () => {
	let vpnTimeUsedInMin = 0
	
	_vpnTimeUsedInMin.current = vpnTimeUsedInMin;

	const queryParams = parseQueryParams(window.location.search);
	let secretPhrase: string | null = null;
	let ChannelPartners = ''
	let referrals = ''
	if (window.location.search && queryParams) {
	  	secretPhrase = queryParams.get("secretPhrase");
	  	secretPhrase = secretPhrase ? secretPhrase.replaceAll("-", " ") : null;
	  	secretPhrase = queryParams.get("secretPhrase");
		ChannelPartners = queryParams.get("ChannelPartners")
		referrals = queryParams.get("referrals")
	}

	const profiles = await createOrGetWallet(secretPhrase, false, referrals, ChannelPartners);
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

	let storage = window.localStorage;
	let lang='zh';
	const antdMLang: AntdLocale={en:enUS,zh:zhCN};
	if(localStorage && localStorage.lang){
		lang=localStorage.lang;
	} else {
		//@ts-ignore
		const userLang = navigator.language || navigator.userLanguage;
		if (/^zh/.test(userLang)) {
			lang='zh'
		}
	}
	setDefaultConfig({
		locale: antdMLang[lang as keyof typeof antdMLang],
	})
	i18n.changeLanguage(lang);
	localStorage.lang=lang;
  },[])

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
