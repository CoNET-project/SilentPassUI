import { useState, useRef, useEffect } from 'react';
import styles from './airdropTaskCont.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar,Button,Space,Collapse,ProgressBar,Tag,Tabs } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ExclamationCircleOutline,GiftOutline } from 'antd-mobile-icons';
import Mine from './mine';
import Ranking from './ranking';

interface AirdropTaskContParams {
    setRuleVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const AirdropTaskCont = ({setRuleVisible}:AirdropTaskContParams) => {
    const { t, i18n } = useTranslation();


    return (
        <>
            <div className={styles.progress}>
                <div className={styles.progressHd}>
                    <label className={styles.label}>{t('integral-airdrop-progress-1')}</label>
                    <div className={styles.warnText}>{t('integral-airdrop-progress-2')}</div>
                </div>
                <div className={styles.progressBd}>
                    <ProgressBar percent={100} />
                    <div className={styles.progressBdText}>
                        <span>0</span>
                        <span>Soft-cap 100,000 GB</span>
                    </div>
                </div>
                <div className={styles.progressFt}>{t('integral-airdrop-progress-3')}：{t('integral-airdrop-progress-4')}（{t('integral-airdrop-progress-5')}：2025-07-16 18:00 PT）</div>
            </div>
            
            <div className={styles.waysList}>
                <div className={styles.waysBox}>
                    <Space wrap>
                        <Tag round color='#49494a'>{t('integral-airdrop-way-1')}×1.00</Tag>
                        <Tag round color='#49494a'>Genesis×1.55</Tag>
                        <Tag round color='#49494a'>{t('integral-airdrop-way-2')}×1.15</Tag>
                    </Space>
                </div>
                <div className={styles.waysTotal}>{t('integral-airdrop-way-3')} ≤ 2.00×</div>
            </div>

            <div className={styles.tabWrap}>
                <Tabs className={styles.parentTab}>
                    <Tabs.Tab title={t('integral-airdrop-parent-tab-1')} key='1'>
                        <Mine />
                    </Tabs.Tab>
                    <Tabs.Tab title={t('integral-airdrop-parent-tab-2')} key='2'>
                        <Ranking />
                    </Tabs.Tab>
                </Tabs>
            </div>

            
        </>
    );
};

export default AirdropTaskCont;