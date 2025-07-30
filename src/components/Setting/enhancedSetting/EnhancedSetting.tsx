import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './../generalSetting/generalSetting.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Switch } from 'antd-mobile';
import { FilterOutlined,LinkOutlined,GiftOutlined } from '@ant-design/icons';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import Filter from './../../Rules/Filter';

const EnhancedSetting = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const { quickLinksShow, setQuickLinksShow } = useDaemonContext();

    return (
        <>
            <div className={styles.general}>
                <List header={t('Settings_Passcode_Addon')} style={{'--active-background-color':'#323131'}}>
                    <List.Item 
                        prefix={<span className={styles.icon}><GiftOutlined /></span>} 
                        onClick={() => {navigate("/wallet")}}
                    >
                        {t('Settings_Passcode_Reward')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><FilterOutlined /></span>} 
                        onClick={() => {setVisible(true)}}
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
            <Filter visible={visible} setVisible={setVisible} />
        </>
    );
};

export default EnhancedSetting;