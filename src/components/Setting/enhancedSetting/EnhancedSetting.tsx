import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './../generalSetting/generalSetting.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Switch } from 'antd-mobile';
import { FilterOutlined,LinkOutlined,GiftOutlined,SyncOutlined } from '@ant-design/icons';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import Airdrop from '../airdrop/airdrop'
import CoNET_Dashboard from '../CoNET_Dashboard/CoNETDashboard'
const EnhancedSetting = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { quickLinksShow, setQuickLinksShow, setRuleVisible } = useDaemonContext();
    const [airdropVisible, setAirdropVisible] = useState(false);
    const [CoNET_DashboardVisible, setCoNET_DashboardVisible] = useState(false);

    return (
        <>
            <div className={styles.general}>
                <List header={t('Settings_Passcode_Addon')} style={{'--active-background-color':'#323131'}}>
                    <List.Item 
                        prefix={<span className={styles.icon}><GiftOutlined /></span>} 
                        onClick={() => setCoNET_DashboardVisible(true)}
                    >
                        {t('Settings_Passcode_CoNET_Dashboard')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><GiftOutlined /></span>} 
                        onClick={() => setAirdropVisible(true)}
                    >
                        {t('Settings_Passcode_Reward')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><FilterOutlined /></span>} 
                        onClick={() => {setRuleVisible(true)}}
                    >
                        {t('Settings_Passcode_WebsiteFilter')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><LinkOutlined /></span>} 
                        extra={<Switch checked={quickLinksShow} onChange={(val:boolean)=>{setQuickLinksShow(val)}} style={{'--height': '18px','--width': '38px'}} />}
                    >
                        {t('quick-links')}
                    </List.Item>
                </List>
            </div>
            <Airdrop visible={airdropVisible} setVisible={setAirdropVisible} />
            <CoNET_Dashboard visible={CoNET_DashboardVisible} setVisible={setCoNET_DashboardVisible} />
        </>
    );
};

export default EnhancedSetting;