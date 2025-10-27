import { useEffect } from "react";
import "./reset.scss";
import "./default.scss";
import styles from './layout.module.scss';
import {Route,Routes,useNavigate,useLocation,HashRouter as Router} from 'react-router-dom';
import { useDaemonContext } from "./providers/DaemonProvider";
import ConetDashboard from "./components/Setting/CoNET_Dashboard/index";
import Home from "./pages/Home/index";
import { setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import jaJP from 'antd-mobile/es/locales/ja-JP';
import './i18n'; // 加载多语言配置
import { useTranslation } from 'react-i18next';


global.Buffer = require('buffer').Buffer;



function App() {
	const { i18n } = useTranslation();
  	const { setProfiles, setMiningData, setClosestRegion, setaAllNodes, setServerIpAddress, setServerPort, setShowReferralsInput, setActivePassportUpdated, setActivePassport, setRandomSolanaRPC, setIsLocalProxy, setIsIOS, setDuplicateAccount, setCheckinBalanceUP } = useDaemonContext();
  	
  
  	const init = async () => {

  	}

  	let first = true
  	useEffect(() => {
		if (first) {
			first = false
			// init()
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
		<Router basename="/">
	      <div className={styles.app}>
	        <div className={styles.body}>
	          <Routes>
	            <Route path="/" element={<Home />} />
	            <Route path="/conet" element={<ConetDashboard />} />
	          </Routes>
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