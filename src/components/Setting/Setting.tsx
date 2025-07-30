import { useState, useRef, useEffect } from 'react';
import styles from './setting.module.scss';
import { useTranslation } from 'react-i18next';
import Passport from './passport/Passport';
import GeneralSetting from './generalSetting/GeneralSetting';
import EnhancedSetting from './enhancedSetting/EnhancedSetting';
import ProxyInfo from './proxyInfo/ProxyInfo';
import { NoticeBar } from 'antd-mobile';
import packageJson from './../../../package.json';

const Setting = ({}) => {
    const { t, i18n } = useTranslation();
    
    return (
        <div className={styles.setting}>
            <h1 className={styles.title}>{t('Settings_Title')}</h1>
            <div className={styles.version}>
                <NoticeBar
                    color='default'
                    shape='neutral'
                    bordered={false}
                    content={t('setting-current-version')}
                    extra={<span>v {packageJson.version}</span>}
                    style={{'--background-color':'#191919'}}
                />
            </div>
            <Passport />
            <GeneralSetting />
            <EnhancedSetting />
            <ProxyInfo />
        </div>
    );
};

export default Setting;