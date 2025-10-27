import { useState, useRef, useEffect } from 'react';
import styles from './ranking.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { Ellipsis,Tabs } from 'antd-mobile';

const Ranking = ({}) => {
    const { t, i18n } = useTranslation();
    const [period, setPeriod] = useState(0);
    const [periodList, setPeriodList] = useState([{name:t('integral-airdrop-ranking-tab-1-1')},{name:t('integral-airdrop-ranking-tab-1-2')},{name:t('integral-airdrop-ranking-tab-1-3')}]);
    const [classify, setClassify] = useState(0);
    const [classifyList, setClassifyList] = useState([{name:t('integral-airdrop-ranking-tab-2-1')},{name:t('integral-airdrop-ranking-tab-2-2')},{name:t('integral-airdrop-ranking-tab-2-3')},{name:t('integral-airdrop-ranking-tab-2-4')},{name:t('integral-airdrop-ranking-tab-2-5')},{name:t('integral-airdrop-ranking-tab-2-6')}]);

    useEffect(() => {
        setPeriodList([{name:t('integral-airdrop-ranking-tab-1-1')},{name:t('integral-airdrop-ranking-tab-1-2')},{name:t('integral-airdrop-ranking-tab-1-3')}]);
        setClassifyList([{name:t('integral-airdrop-ranking-tab-2-1')},{name:t('integral-airdrop-ranking-tab-2-2')},{name:t('integral-airdrop-ranking-tab-2-3')},{name:t('integral-airdrop-ranking-tab-2-4')},{name:t('integral-airdrop-ranking-tab-2-5')},{name:t('integral-airdrop-ranking-tab-2-6')}]);
    }, [i18n.language, t]);
    
    return (
        <div className={styles.ranking}>
            <div className={styles.rule}>
                <div className={styles.item}>
                    <div className={styles.name}>{t('integral-airdrop-ranking-rule-1')}</div>
                    <div className={styles.desc}>
                        <ul className={styles.descList}>
                            <li>{t('integral-airdrop-ranking-rule-2')}</li>
                            <li>{t('integral-airdrop-ranking-rule-3')}</li>
                        </ul>
                    </div>
                </div>
                <div className={`${styles.item} ${styles.itemNum} `}>
                    <div className={styles.name}>{t('integral-airdrop-ranking-rule-4')}</div>
                    <div className={styles.desc}>
                        <ul className={styles.descList}>
                            <li>{t('integral-airdrop-ranking-rule-5')}</li>
                            <li>{t('integral-airdrop-ranking-rule-6')}</li>
                            <li>{t('integral-airdrop-ranking-rule-7')}</li>
                            <li>{t('integral-airdrop-ranking-rule-8')}</li>
                            <li>{t('integral-airdrop-ranking-rule-9')}</li>
                        </ul>
                    </div>
                </div>
                <div className={styles.extra}>{t('integral-airdrop-ranking-rule-10')}</div>
            </div>
            <div className={styles.rankingCont}>
                <div className={styles.periodTab}>
                    {periodList.map((item,i)=>{
                        return <div key={i} onClick={()=>{setPeriod(i)}} className={i==period?`${styles.periodTabItem} ${styles.cur}`:styles.periodTabItem}>{item.name}</div>
                    })}
                </div>
                {/*<div className={styles.classifyTab}>
                    {classifyList.map((item,i)=>{
                        return <div onClick={()=>{setClassify(i)}} className={i==classify?`${styles.classifyTabItem} ${styles.cur}`:styles.classifyTabItem}>{item.name}</div>
                    })}
                </div>*/}
                <div className={styles.classifyTab}>
                    <Tabs activeKey={classify+''} onChange={(key:string)=>{setClassify(Number(key))}}>
                        {classifyList.map((item,i)=>{
                            return <Tabs.Tab title={item.name} key={i}></Tabs.Tab>
                        })}
                    </Tabs>
                </div>
                <div className={styles.myInfo}>
                    <div className={styles.tag}>{t('integral-airdrop-ranking-me')}</div>
                    <div className={styles.cont}>
                        <div className={styles.address}><Ellipsis direction='middle' content={'0x370441A81441D3A5407B338bC73e33ce4b23d05A'} /></div>
                        <div className={styles.total}>{t('integral-airdrop-ranking-me-total')}：44.80 {t('integral-airdrop-total-2')}</div>
                    </div>
                </div>
                <div className={styles.list}>
                    <div className={styles.item}>
                        <div className={styles.disc}>1</div>
                        <div className={styles.cont}>
                            <div className={styles.address}><Ellipsis direction='middle' content={'0x370441A81441D3A5407B338bC73e33ce4b23d05A'} /></div>
                            <div className={styles.type}>Genesis</div>
                        </div>
                        <div className={styles.total}>96.70 {t('integral-airdrop-total-2')}</div>
                    </div>
                    <div className={styles.item}>
                        <div className={styles.disc}>2</div>
                        <div className={styles.cont}>
                            <div className={styles.address}><Ellipsis direction='middle' content={'0x370441A81441D3A5407B338bC73e33ce4b23d05A'} /></div>
                            <div className={styles.type}>Genesis</div>
                        </div>
                        <div className={styles.total}>96.70 {t('integral-airdrop-total-2')}</div>
                    </div>
                    <div className={styles.item}>
                        <div className={styles.disc}>3</div>
                        <div className={styles.cont}>
                            <div className={styles.address}><Ellipsis direction='middle' content={'0x370441A81441D3A5407B338bC73e33ce4b23d05A'} /></div>
                            <div className={styles.type}>Genesis</div>
                        </div>
                        <div className={styles.total}>96.70 {t('integral-airdrop-total-2')}</div>
                    </div>
                </div>
                <div className={styles.tips}>{t('integral-airdrop-ranking-tip')}</div>
            </div>
        </div>
    );
};

export default Ranking;