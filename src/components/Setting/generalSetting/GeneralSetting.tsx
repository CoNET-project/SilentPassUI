import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './generalSetting.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Switch } from 'antd-mobile';
import { GlobalOutlined,CustomerServiceOutlined,QuestionCircleOutlined,ApiOutlined } from '@ant-design/icons';
import Languages from './../../Languages';
import {openWebLinkNative} from './../../../api';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import Faq from './../faq/Faq';

const GeneralSetting = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const [faqVisible, setFaqVisible] = useState(false);
    const { isLocalProxy, isIOS, power, switchValue, setSwitchValue } = useDaemonContext();

    const handleChangeSwitch=(val:boolean)=>{
        setSwitchValue(val)
        if(val && power){
            if (window?.webkit) {
                window?.webkit?.messageHandlers["startProxy"].postMessage("")
            }
        }else{
            if (window?.webkit) {
                window?.webkit?.messageHandlers["stopProxy"].postMessage("")
            }
        }
    }

    return (
        <>
            <div className={styles.general}>
                <List header={t('Settings_General')} style={{'--active-background-color':'#323131'}}>
                    <List.Item 
                        prefix={<span className={styles.icon}><GlobalOutlined /></span>} 
                        extra={t(i18n.language)} 
                        onClick={() => {setVisible(true)}}
                    >
                        {t('language')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><QuestionCircleOutlined /></span>} 
                        onClick={() => {setFaqVisible(true)}}
                    >
                        {t('faq')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><CustomerServiceOutlined /></span>} 
                        onClick={() => {openWebLinkNative('https://vue.comm100.com/chatwindow.aspx?siteId=90007504&planId=efd822ce-7299-4fda-9fc1-252dd2f01fc5#',isIOS,isLocalProxy)}}
                    >
                        {t('customer-service')}
                    </List.Item>

                    { isLocalProxy ?<List.Item 
                        prefix={<span className={styles.icon}><ApiOutlined /></span>} 
                        extra={<Switch disabled={power} checked={switchValue} onChange={handleChangeSwitch} style={{'--height': '18px','--width': '38px'}} />}
                    >
                        {t('system-proxy')}
                    </List.Item>:''}
                </List>
            </div>
            <Languages visible={visible} setVisible={setVisible} />
            <Faq visible={faqVisible} setVisible={setFaqVisible} />
        </>
    );
};

export default GeneralSetting;