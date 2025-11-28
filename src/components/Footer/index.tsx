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
import {isStandalone, MobileType } from '@/services/beamio'
import { TabBar } from 'antd-mobile'

import styles from '@/components/Footer/footer.module.scss';
import { useDaemonContext } from "@/providers/DaemonProvider";

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
    const navigate = useNavigate();
    const location = useLocation();
    const { ruleVisible, setRuleVisible, setPower, hasNewVersion,darkModle, isInitialLoading, beamioAppInstalled} = useDaemonContext();
    const { pathname } = location;


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
    }

    const tabs = [
        {
            key: '/',
            title: 'Home',
            icon: (pathname=='/'?<HomeBlueIcon />:<HomeIconGrey />),
        },
        {
            key: '/History',
            title: 'Transactions',
            icon: (pathname=='/History'?<SendBlueIcon />:<SendIconGrey />),
        },
        {
            key: '/pay',
            title: 'Pay/Request',
			icon: <div style={{ width: '2rem', height: '2rem' }} />,
        },
        {
            key: '/Browser',
            title: "Browser",
            icon: (pathname=='/Browser'?<BrowserBlueIcon />:<BrowserGreyIcon />),
        },
        {
            key: '/settings',
            title: 'Settings',
            icon: (pathname=='/settings'?<WalletBlueIcon />:<WalletIconGrey />),
            ...(hasNewVersion ? { badge: '1' } : {}),
        },
    ]
    
    return (
		<>
		{
			!isInitialLoading && (isStandalone||MobileType() === 'desktop') &&
				<div className={styles.footer}>
					<TabBar safeArea={false} activeKey={pathname} onChange={value => setRouteActive(value)}>
						{tabs.map(item => (
							<TabBar.Item key={item.key} icon={item.icon} title={item.title} badge={item.badge} />
						))}
					</TabBar>

					{/* 悬浮在 TabBar 上方的 BLogo */}
					<div className={styles.payCenterLogo} onClick={() => setRouteActive('/pay')}>
						{darkModle ? <BLogo style={{ width: '4rem', height: '4rem' }} /> : <BLogoLight style={{ width: '4rem', height: '4rem' }} />}
					</div>
					
				</div>
		}
		</>
        
    )
}

export default Footer