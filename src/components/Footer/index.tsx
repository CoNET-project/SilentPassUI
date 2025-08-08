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

const Footer = ({}) => {
    const { t, i18n } = useTranslation();
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
        },
    ]
    
    return (
        <div className={styles.footer}>
            <TabBar safeArea activeKey={pathname} onChange={value => setRouteActive(value)}>
                {tabs.map(item => (
                    <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
                ))}
            </TabBar>
            <Subscription />
            <Status />
        </div>
    )
};

export default Footer