import { useDaemonContext } from './../../../providers/DaemonProvider'
import { useTranslation,Trans } from 'react-i18next';
import { Collapse,Popup,NavBar } from 'antd-mobile';
import styles from './airdrop.module.scss'
import AirdropTaskIOS from './index'

interface faqParams {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Airdrop = ({visible,setVisible}:faqParams) => {
    const { t, i18n } = useTranslation();
    const { isLocalProxy, isIOS } = useDaemonContext();
    return (
			<Popup
				visible={visible}
				onMaskClick={() => setVisible(false)}
				position="right"
				bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
				>
				<div className={styles.modalWrap}>
					<NavBar
					onBack={() => setVisible(false)}
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
    )
}

export default Airdrop;