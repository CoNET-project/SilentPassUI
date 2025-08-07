import { useState, useRef, useEffect } from 'react';
import styles from './stake.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar,Button,Empty,Grid,Collapse } from 'antd-mobile';
import PayWays from './../spWallet/payWays';
import { PushpinOutlined } from '@ant-design/icons';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { RightOutline,ExclamationShieldOutline,ClockCircleOutline,LockOutline,TextOutline,CompassOutline,CalculatorOutline,GiftOutline } from 'antd-mobile-icons';

interface stakeParams {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Stake = ({visible,setVisible}:stakeParams) => {
    const { t, i18n } = useTranslation();
    const { profiles } = useDaemonContext();

    const convertNumberToString = (numval: number): string => {
        const num = Number(numval);
        const units = [
            { value: 1e12, symbol: 'T' },
            { value: 1e9, symbol: 'B' },
            { value: 1e6, symbol: 'M' },
            { value: 1e3, symbol: 'K' }
        ];
        
        const absNum = Math.abs(num);
        for (const unit of units) {
            if (absNum >= unit.value) {
                return (num / unit.value).toFixed(2) + unit.symbol;
            }
        }
        return num.toFixed(2).toString();
    }
    
    return (
        <Popup
            visible={visible}
            onMaskClick={() => {setVisible(false)}}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.popup}
            closeOnMaskClick={true}
        >
            <div className={styles.modalWrap}>
                <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('stake-modal-title')}</NavBar>
                <div className={styles.bd}>
                    <div className={styles.totalInfo}>
                        <div className={styles.totalInfoItem}>
                            <label className={styles.label}>{t('stake-modal-total-label-1')}</label> 
                            <div className={styles.val}>8882841 SP <span>（≈ $75）</span></div>
                        </div>
                        <div className={styles.totalInfoItem}>
                            <label className={styles.label}>{t('stake-modal-total-label-2')}</label> 
                            <div className={styles.val}>2112 SP / <span>（≈ $75）</span></div>
                        </div>
                        <div className={styles.totalInfoItem}>
                            <label className={styles.label}>{t('stake-modal-total-label-3')}</label> 
                            <div className={styles.val}>2112 SP / <span>（≈ $75）</span></div>
                        </div>
                        <div className={styles.stakeBox}>
                            <div className={styles.oper}>
                                <Button block color='primary' size='middle' style={{marginRight:'10px'}}>领取奖励</Button>
                                <Button block color='primary' size='middle'>立即质押</Button>{/*追加质押／质押上限，已满 Claim Rewards] Stake Now] / [Add More] / [Maxed Out]*/}
                            </div>
                        </div>
                    </div>
                    <div className={styles.history}>
                        <div className={styles.title}><ClockCircleOutline className={styles.icon} />{t('stake-modal-extra-title-1')}</div>
                        <div className={styles.historyList}>
                            <div className={styles.gridbox}>
                                <Grid columns={3} gap={8}>
                                    <Grid.Item><span className={styles.hd}>{t('stake-modal-history-th-1')}</span></Grid.Item>
                                    <Grid.Item><span className={styles.hd}>{t('stake-modal-history-th-2')}</span></Grid.Item>
                                    <Grid.Item><span className={styles.hd}>{t('stake-modal-history-th-3')}</span></Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item><LockOutline />Locked</Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item><LockOutline />Locked</Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item><LockOutline />Locked</Grid.Item>
                                </Grid>
                            </div>
                            {/*<div className={styles.empty}>
                                <Empty description={t('quick-links-manage-empty')} />
                            </div>*/}
                        </div>
                    </div>
                    <div className={styles.stakeInfos}>
                        <Collapse 
                            defaultActiveKey={[]}
                            arrow={<RightOutline />}
                        >
                            <Collapse.Panel key='1' title={<><TextOutline className={styles.icon} />{t('stake-modal-extra-title-2')}</>}>
                                <div className={styles.stakeInfosList}>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-1')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-2')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-3')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-4')}</div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                    <div className={styles.stakeInfos}>
                        <Collapse 
                            defaultActiveKey={[]}
                            arrow={<RightOutline />}
                        >
                            <Collapse.Panel key='1' title={<><CompassOutline className={styles.icon} />{t('stake-modal-extra-title-3')}</>}>
                                <div className={styles.stakeInfosList}>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-5')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-6')}</div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                    <div className={styles.stakeInfos}>
                        <Collapse 
                            defaultActiveKey={[]}
                            arrow={<RightOutline />}
                        >
                            <Collapse.Panel key='1' title={<><GiftOutline className={styles.icon} />{t('stake-modal-extra-title-4')}</>}>
                                <div className={styles.stakeInfosList}>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-7')}</div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                    <div className={styles.stakeInfos}>
                        <Collapse 
                            defaultActiveKey={[]}
                            arrow={<RightOutline />}
                        >
                            <Collapse.Panel key='1' title={<><CalculatorOutline className={styles.icon} />{t('stake-modal-extra-title-5')}</>}>
                                <div className={styles.stakeInfosList}>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-8')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-9')}</div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                    <div className={styles.stakeInfos}>
                        <Collapse 
                            defaultActiveKey={[]}
                            arrow={<RightOutline />}
                        >
                            <Collapse.Panel key='1' title={<><PushpinOutlined className={styles.icon} />{t('stake-modal-extra-title-6')}</>}>
                                <div className={styles.stakeInfosList}>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-10')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-11')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-12')}</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />{t('stake-modal-extra-desc-13')}</div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                    <div className={styles.payWaysWrap}>
                        <PayWays defaultVisible={false} />
                    </div>
                </div>
            </div>
        </Popup>
    );
};

export default Stake;