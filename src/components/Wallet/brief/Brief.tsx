import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './brief.module.scss';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd-mobile';
import { BankcardOutline } from 'antd-mobile-icons';
import { getRewordStaus } from '@/services/wallets';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "@/utils/utils";
import { ReactComponent as CrownBadge } from '@/components/Wallet/assets/GC.svg';
import { ReactComponent as ArmBand } from '@/components/Wallet/assets/blue-badge.svg';
import { Popup, NavBar } from 'antd-mobile';
import AirdropTaskIOS from '@/components/Setting/airdrop'
const Brief = ({}) => {
    const { profiles, activePassport } = useDaemonContext();
    const { t, i18n } = useTranslation();
	const [popupVisible, setPopupVisible] = useState(false);

    return (
		<>
		
			<div className={styles.briefWrap}>
				<div className={styles.iconBox}>
					<div className={styles.armBand}>
						{getPassportTitle(activePassport) === 'passport_Freemium'?<BankcardOutline className={styles.icon} />:''}
						{getPassportTitle(activePassport) === 'passport_Monthly'?<ArmBand />:''}
						{getPassportTitle(activePassport) === 'passport_Annually'?<ArmBand />:''}
						{getPassportTitle(activePassport) === 'passport_Infinite'?<CrownBadge />:''}
					</div>
				</div>
				<div className={styles.briefCont}>
					<div className={styles.type}><label>{t('wallet-account-brief-label')}：</label>{t(getPassportTitle(activePassport))}</div>
					<div className={styles.time}><label>{t('wallet-account-brief-remain')}：</label>
						{
							profiles?.[0]?.activePassport?.expires ?
								<p>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
								: '--'
						}
					</div>
				</div>
				<div className={styles.gbToken} onClick={() => setPopupVisible(true)}>
					<span className={styles.gbValue}>123.4</span>
					<span className={styles.gbLabel}>GB</span>
				</div>
			</div>
			<Popup
				visible={popupVisible}
				onMaskClick={() => setPopupVisible(false)}
				position="right"
				bodyStyle={{ width: '100%', height: '100vh', background: "rgba(0, 0, 0, 0.9)" }}
				>
				<div className={styles.airdropPopup}>
					<NavBar
					onBack={() => setPopupVisible(false)}
					style={{ '--height': '60px', borderBottom: '1px solid #eee' }}
					>
					Airdrop 积分任务
					</NavBar>
					<div className={styles.airdropContent}>
						<div style={{ maxWidth: 428, width: '100%', margin: '0 auto', padding: 16, fontSize: 14, color: '#918f8fff', lineHeight: 1.5 }}>
							<AirdropTaskIOS />
						</div>
						
					</div>
				</div>
			</Popup>
		</>
    );
};

export default Brief;