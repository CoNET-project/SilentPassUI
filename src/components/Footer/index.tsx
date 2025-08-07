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
import Subscription from '@/components/Subscription/Subscription';
import Status from '@/components/Home/Status/Status';

const Footer = ({}) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { pathname } = location

    const setRouteActive = (value: string) => {
        navigate(value)
		cleanCurrentWaitingTimeout()
    }

    const tabs = [
        {
            key: '/',
            title: '首页',
            icon: (pathname=='/'?<HomeBlueIcon />:<HomeIconGrey />),
        },
        {
            key: '/wallet',
            title: '钱包',
            icon: (pathname=='/wallet'?<WalletBlueIcon />:<WalletIconGrey />),
        },
        {
            key: '/swap',
            title: '兑换',
            icon: (pathname=='/swap'?<SwapBlueIcon />:<SwapIconGrey />),
        },
        {
            key: '/settings',
            title: '设置',
            icon: (pathname=='/settings'?<SettingsIconBlue />:<SettingsIconGrey />),
        },
    ]
    
    return (
        <>
            <TabBar safeArea activeKey={pathname} onChange={value => setRouteActive(value)}>
                {tabs.map(item => (
                    <TabBar.Item key={item.key} icon={item.icon} />
                ))}
            </TabBar>
            <Subscription />
            <Status />
        </>
    )
};

export default Footer