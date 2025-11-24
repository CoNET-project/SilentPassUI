//		Footer/index.tsx

import { useEffect } from 'react';
import {Route,Routes,useNavigate,useLocation,MemoryRouter as Router} from 'react-router-dom';
import { ReactComponent as HomeIconGrey } from "./assets/home-icon-grey.svg";
import { ReactComponent as HomeBlueIcon } from "./assets/home-icon-blue.svg";
import { ReactComponent as SendIconGrey } from "./assets/send-icon-grey.svg";
import { ReactComponent as SendBlueIcon } from "./assets/send-icon-blue.svg";
import { ReactComponent as WalletBlueIcon } from "./assets/wallet-icon-blue.svg";
import { ReactComponent as WalletIconGrey } from "./assets/wallet-icon-grey.svg";
import { ReactComponent as BrowserBlueIcon } from "./assets/browser-icon-blue.svg";
import { ReactComponent as BrowserGreyIcon } from "./assets/browser-icon-grey.svg";
import { ReactComponent as SwapBlueIcon } from "./assets/swap-icon-blue.svg";
import { ReactComponent as SwapIconGrey } from "./assets/swap-icon-grey.svg";
import { cleanCurrentWaitingTimeout } from './../../services/wallets'
import { TabBar } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import Subscription from '@/components/Subscription/Subscription';
import Status from '@/components/Home/Status/Status';
import styles from '@/components/Footer/footer.module.scss';
import { useDaemonContext } from "@/providers/DaemonProvider";
import Filter from '@/components/Rules/Filter';
import AirdropTask from '@/components/Wallet/airdropTask/AirdropTask';
import {Bridge} from '@/bridge/webview-bridge';
import { getiOSVPNStatus, getAndroidVPNStatus} from "../../api"
import { ReactComponent as BLogo } from './assets/B-icon.svg'
import { ReactComponent as BLogoLight } from './assets/B-icon-light.svg'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'

interface BridgeMessage {
    event?: string;
    data?: any;
    callbackId?: string;
    response?: any;
}



const Footer = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { ruleVisible, setRuleVisible, setPower, hasNewVersion,darkModle, isInitialLoading} = useDaemonContext();
    const { pathname } = location;


	const status = async () => {
		window.addEventListener('message', (e) => {
            Bridge.receive(e.data, makeListener)
        })
				
		window.addEventListener("visibilitychange", async () => {
		})
		
	}

useEffect(() => {
  	const root = document.documentElement // <html>

	if (darkModle) {
		// 你的自定义暗色主题
		root.classList.add('dark')
		root.classList.add('theme-dark')
		root.classList.remove('theme-light')
	} else {
		root.classList.remove('dark')
		root.classList.remove('theme-dark')
		root.classList.add('theme-light')
	}
}, [darkModle])

	useEffect(() => {
		const root = document.documentElement; // <html>

		if (darkModle) {
			root.classList.add('theme-dark');
			root.classList.remove('theme-light');
		} else {
			root.classList.add('theme-light');
			root.classList.remove('theme-dark');
		}
	}, [darkModle])

    useEffect(()=>{
        // 监听 Electron 或 Native 的回传
        status()

    },[])

    const makeListener=(message: BridgeMessage, makeSend:any)=>{

		console.log(`makeListener got message`, message)


        if (message.event === 'native_VPNStatus') {
            if(message?.data?.VPNStatus===1){
                setPower(false);
            }
            if(message?.data?.VPNStatus===3){
                setPower(true);
            }
        }
    }

    const setRouteActive = (value: string) => {
        navigate(value)
		cleanCurrentWaitingTimeout()
    }

    const tabs = [
        {
            key: '/',
            title: t('footer-nav-1'),
            icon: (pathname=='/'?<HomeBlueIcon />:<HomeIconGrey />),
        },
        {
            key: '/Send',
            title: t('comp-comm-Send'),
            icon: (pathname=='/Send'?<SendBlueIcon />:<SendIconGrey />),
        },
        {
            key: '/pay',
            title: t('footer-nav-6'),
			icon: <div style={{ width: '2rem', height: '2rem' }} />,
        },
        {
            key: '/Browser',
            title: t('footer-nav-5'),
            icon: (pathname=='/Browser'?<BrowserBlueIcon />:<BrowserGreyIcon />),
        },
        {
            key: '/settings',
            title: t('footer-nav-2'),
            icon: (pathname=='/settings'?<WalletBlueIcon />:<WalletIconGrey />),
            ...(hasNewVersion ? { badge: '1' } : {}),
        },
    ]
    
    return (
		<>
		{
			!isInitialLoading &&
				<div className={styles.footer}>
					<TabBar safeArea activeKey={pathname} onChange={value => setRouteActive(value)}>
						{tabs.map(item => (
							<TabBar.Item key={item.key} icon={item.icon} title={item.title} badge={item.badge} />
						))}
					</TabBar>

					{/* 悬浮在 TabBar 上方的 BLogo */}
					<div className={styles.payCenterLogo} onClick={() => setRouteActive('/pay')}>
						{darkModle ? <BLogo style={{ width: '4rem', height: '4rem' }} /> : <BLogoLight style={{ width: '4rem', height: '4rem' }} />}
					</div>

					<Subscription />
					<Status />
					<Filter visible={ruleVisible} setVisible={setRuleVisible} />
					<AirdropTask />
				</div>
		}
		</>
        
    )
}

export default Footer