import { useState, useRef, useEffect } from 'react';
import styles from './mine.module.scss';
import { useTranslation } from 'react-i18next';
import { Button,ProgressBar } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { KeyOutline,FileOutline,CheckCircleOutline,StarOutline } from 'antd-mobile-icons';
import Addition from './addition';

const Mine = ({}) => {
    const { t, i18n } = useTranslation();
    const { referralsVisible, setReferralsVisible, setPassportVisible, setCheckInVisible, setGenesisVisible, setSelectedPlan } = useDaemonContext();

    return (
        <div className={styles.mine}>
            <div className={styles.flow}>
                <div className={styles.partFlow}>
                    <label className={styles.label}>{t('integral-airdrop-flow-1')} GB</label>
                    <div className={styles.val}>5.8 GB</div>
                    <div className={styles.progressBar}><ProgressBar percent={80} /></div>
                    <div className={styles.extra}>{t('integral-airdrop-flow-3')} 15 · {t('integral-airdrop-flow-4')} 9.2 GB</div>
                </div>
                <div className={styles.partFlow}>
                    <label className={styles.label}>{t('integral-airdrop-flow-2')} GB</label>
                    <div className={styles.val}>5.8 GB</div>
                    <div className={styles.progressBar}><ProgressBar percent={60} /></div>
                    <div className={styles.extra}>{t('integral-airdrop-flow-3')} 15 · {t('integral-airdrop-flow-4')} 9.2 GB</div>
                </div>
            </div>
            <Addition />

            <div className={styles.friend}>
                <div className={styles.hd}><KeyOutline className={styles.icon} />{t('integral-airdrop-addition-friend-1')}</div>
                <div className={styles.bd}>
                    <div className={styles.desc}>{t('integral-airdrop-addition-friend-2')}</div>
                    <div className={styles.oper}>
                        <a className={styles.btn} onClick={()=>{setReferralsVisible(true)}}>{t('integral-airdrop-addition-friend-3')}</a>
                        {/*<a className={styles.done}>{t('integral-airdrop-addition-friend-5')}</a>*/}
                    </div>
                </div>
                <div className={styles.tips}>{t('integral-airdrop-addition-friend-4')}</div>
            </div>

            <div className={styles.book}>
                <div className={styles.hd}><FileOutline className={styles.icon} />{t('integral-airdrop-addition-book-1')}</div>
                <div className={styles.bd}>
                    <div className={styles.desc}>{t('integral-airdrop-addition-book-2')}</div>
                    <div className={styles.oper}>
                        <a className={styles.btn} onClick={()=>{setSelectedPlan('1');setPassportVisible(true)}}>{t('integral-airdrop-addition-book-4')}</a>
                        <a className={styles.btn} onClick={()=>{setSelectedPlan('12');setPassportVisible(true)}}>{t('integral-airdrop-addition-book-5')}</a>
                        {/*<a className={styles.done}>{t('integral-airdrop-addition-book-6')}</a>*/}
                    </div>
                </div>
                <div className={styles.tips}>{t('integral-airdrop-addition-book-3')}</div>
            </div>

            <div className={styles.sign}>
                <div className={styles.hd}><CheckCircleOutline className={styles.icon} />{t('integral-airdrop-addition-sign-1')}</div>
                <div className={styles.bd}>
                    <div className={styles.desc}>{t('integral-airdrop-addition-sign-2')}</div>
                    <div className={styles.oper}><a className={styles.btn} onClick={()=>{setCheckInVisible(true)}}>{t('integral-airdrop-addition-sign-4')}</a></div>
                </div>
                <div className={styles.tips}>{t('integral-airdrop-addition-sign-3')}</div>
            </div>

            <div className={styles.genesis}>
                <div className={styles.hd}><StarOutline className={styles.icon} />Genesis</div>
                <div className={styles.bd}>
                    <div className={styles.desc}>{t('integral-airdrop-addition-genesis-1')}</div>
                    <div className={styles.oper}>
                        <a className={styles.btn} onClick={()=>{setGenesisVisible(true)}}>{t('integral-airdrop-addition-genesis-3')}</a>
                        {/*<a className={styles.done}>{t('integral-airdrop-addition-genesis-4')}</a>*/}
                    </div>
                </div>
                <div className={styles.tips}>{t('integral-airdrop-addition-genesis-2')}</div>
            </div>
            

            <div className={styles.myInfo}>
                <div className={styles.hd}>
                    <label className={styles.label}>{t('integral-airdrop-total-1')}（{t('integral-airdrop-total-2')}）</label>
                    <div className={styles.val}>44.80</div>
                </div>
                <div className={styles.warning}>{t('integral-airdrop-progress-3')}：{t('integral-airdrop-progress-4')}（{t('integral-airdrop-progress-5')}：2025-07-16 18:00 PT）</div>
                <div className={styles.bd}>
                    <div className={styles.item}>
                        <label className={styles.label}>{t('integral-airdrop-addition-info-1')}</label>
                        <div className={styles.val}>18.00 {t('integral-airdrop-total-2')}</div>
                    </div>
                    <div className={styles.item}>
                        <label className={styles.label}>{t('integral-airdrop-addition-info-2')}</label>
                        <div className={styles.val}>44.80 {t('integral-airdrop-total-2')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Mine;