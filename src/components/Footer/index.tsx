import { useEffect } from 'react';
import {Route,Routes,useNavigate,useLocation,MemoryRouter as Router} from 'react-router-dom';
import { ReactComponent as HomeIconGrey } from "./assets/home-icon-grey.svg";
import { ReactComponent as HomeBlueIcon } from "./assets/home-icon-blue.svg";
import { ReactComponent as WalletIconGrey } from "./assets/wallet-icon-grey.svg";
import { ReactComponent as WalletBlueIcon } from "./assets/wallet-icon-blue.svg";
import { ReactComponent as SettingsIconBlue } from "./assets/settings-icon-blue.svg";
import { ReactComponent as SettingsIconGrey } from "./assets/settings-icon-grey.svg";
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
import NewVersion from "@/components/Home/NewVersion/NewVersion";
import { getiOSVPNStatus, getAndroidVPNStatus} from "../../api"

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
    const { ruleVisible, setRuleVisible, setPower, hasNewVersion, setHasNewVersion, setIsIOS } = useDaemonContext();
    const { pathname } = location;


	const status = async () => {
		window.addEventListener('message', (e) => {
            Bridge.receive(e.data, makeListener)
        })
				// 页面重新获得焦点/从后台回前台时，自动同步一次 VPN 状态
		window.addEventListener("visibilitychange", async () => {
			const [iOS, android]= await Promise.all([
				getiOSVPNStatus(),
				getAndroidVPNStatus()
			])
			
			if (typeof iOS == 'boolean') {
				setPower(iOS)
				setIsIOS(true)
			} else if (typeof android === 'boolean') {
				setPower(android)
			}
			
		})
		const android = await getAndroidVPNStatus()
		if (android) {
			setPower(true)
		}
	}
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
            key: '/wallet',
            title: t('footer-nav-2'),
            icon: (pathname=='/wallet'?<WalletBlueIcon />:<WalletIconGrey />),
        },
        {
            key: '/swap',
            title: t('footer-nav-3'),
            icon: (pathname=='/swap'?<SwapBlueIcon />:<SwapIconGrey />),
        },
        {
            key: '/settings',
            title: t('footer-nav-4'),
            icon: (pathname=='/settings'?<SettingsIconBlue />:<SettingsIconGrey />),
            ...(hasNewVersion ? { badge: '1' } : {}),
        },
    ]
    
    return (
        <div className={styles.footer}>
            <TabBar safeArea activeKey={pathname} onChange={value => setRouteActive(value)}>
                {tabs.map(item => (
                    <TabBar.Item key={item.key} icon={item.icon} title={item.title} badge={item.badge} />
                ))}
            </TabBar>
            <NewVersion />
            <Subscription />
            <Status />
            <Filter visible={ruleVisible} setVisible={setRuleVisible} />
            <AirdropTask />
        </div>
    )
};

export default Footer