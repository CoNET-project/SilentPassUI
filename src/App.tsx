import { useEffect } from "react";
import "./reset.scss";
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
import Wallet from './pages/Wallet';
import Swap from './pages/Swap';
import Settings from './pages/Settings';
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import './i18n'; // 加载多语言配置
import { useTranslation } from 'react-i18next';


global.Buffer = require('buffer').Buffer;



function App() {
	const { i18n } = useTranslation();
  	const { setProfiles, setMiningData, setClosestRegion, setaAllNodes, setServerIpAddress, setServerPort, setShowReferralsInput, setActivePassportUpdated, setActivePassport, setRandomSolanaRPC, setIsLocalProxy, setIsIOS, setDuplicateAccount, setCheckinBalanceUP } = useDaemonContext();
  	
  	const setSOlanaRPC = (allNodes: nodes_info[]) => {
    	const randomIndex = Math.floor(Math.random() * (allNodes.length - 1))
    	setRandomSolanaRPC(allNodes[randomIndex])
 	}

  	const _getServerIpAddress = async () => {
		try {
		  	const response = await getServerIpAddress();
		  	const tmpIpAddress = response.data;

		  	setServerIpAddress(tmpIpAddress?.ip || "");
		  	setServerPort('3002');
		  	setIsLocalProxy(true)
		} catch (ex) {
		  	if (window?.webkit) {
			  	setIsIOS(true)
		  	}
		  	setIsLocalProxy(false)
		}
  	}
  
  	let handlePassportProcess = false
  	const handlePassport = async () => {

		if (!CoNET_Data?.profiles[0]?.keyID) return
		if (handlePassportProcess) {
			return
		}
		handlePassportProcess = true

		const info = await getCurrentPassportInfoInChain()
     
		const tmpData = CoNET_Data;

		if (!tmpData) {
	  		return;
		}
		if (info && tmpData.duplicateAccount) {
			tmpData.profiles[0] = {
				...tmpData?.profiles[0],
				activePassport: {
					nftID: info.nftIDs,
					expires: info.expires,
					expiresDays: info.expiresDays,
					premium: info.premium
				},
		};
		}
		

		const activeNFTNumber = tmpData.profiles[0].activePassport||0
		

		setActivePassport(tmpData.profiles[0].activePassport);

		setCoNET_Data(tmpData);
		setDuplicateAccount(tmpData.duplicateAccount)

		if (!CoNET_Data) return;
	
		setProfiles(CoNET_Data?.profiles);
		setActivePassportUpdated(true);
		handlePassportProcess = false
		listenProfileVer(setProfiles, setActivePassport, setMiningData)
  	}

  	const init = async () => {

		const queryParams = parseQueryParams(window.location.search);
		let secretPhrase: string | null = null;
		let ChannelPartners = ''
		let referrals = ''
		if (window.location.search && queryParams) {

			secretPhrase = queryParams.get("secretPhrase");
			ChannelPartners = queryParams.get("ChannelPartners")
			referrals = queryParams.get("referrals")
			secretPhrase = secretPhrase ? secretPhrase.replace(/\-/g, " ") : null;
			if (referrals) {
				setShowReferralsInput(true)
			}
		}

		const profiles = await createOrGetWallet(secretPhrase, false, referrals, ChannelPartners);
		setProfiles(profiles)

		checkCurrentRate(setMiningData)

		getAllNodesV2(setClosestRegion, async (allNodes: nodes_info[]) => {
	  		setSOlanaRPC(allNodes)
	  		setaAllNodes(allNodes)
	  		setGlobalAllNodes(allNodes)
	  		const randomIndex = Math.floor(Math.random() * (allNodes.length - 1))
	  		setRandomSolanaRPC(allNodes[randomIndex])
	  		await _getServerIpAddress()
	  		if (!CoNET_Data || !CoNET_Data?.profiles) {
				return
	  		}

		})
		await handlePassport ()
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
			}
  		let storage = window.localStorage;
  		let lang='en';
  		const antdMLang: AntdLocale={en:enUS,zh:zhCN};
  		if(storage && storage.lang){
  			lang=storage.lang;
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
		<Router initialEntries={['/']}>
		    <div className={styles.app}>
		      	<div className={styles.body}>
		        	<Routes>
		          		<Route path="/" element={<Home />} />
		          		<Route path="/wallet" element={<Wallet />} />
		          		<Route path="/swap" element={<Swap />} />
		          		<Route path="/settings" element={<Settings />} />
		        	</Routes>
		      	</div>
		      	<div className={styles.bottom}>
		        	<Footer />
		      	</div>
		    </div>
		</Router>
  	);
}

export default App;


/**
 * 

curl -H "Origin: http://localhost" https://cd51c37b67388143.conet.network/silentpass-rpc/0.18.0.zip > /dev/null
{
	"ver": "0.18.0",
	"filename": "0.18.0.zip"
}



 */