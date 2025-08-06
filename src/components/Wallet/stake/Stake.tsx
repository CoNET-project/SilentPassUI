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
                                <Button block color='primary' size='middle'>立即质押</Button>{/*追加质押／质押上限，已满*/}
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
                                    <Grid.Item><LockOutline /></Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item><LockOutline /></Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item><LockOutline /></Grid.Item>
                                </Grid>
                            </div>
                            {/*<div className={styles.empty}>
                                <Empty description={'暂无数据'} />
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
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />每笔质押需等值 $25 美元 的 $SP</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />每个账号最多质押 4 笔 / 总额 $100 美元</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />每笔质押锁仓周期为 12 个月，期间不可提前取出本金</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />奖励可随时领取，本金到期后可手动解锁取回</div>
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
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />从每笔质押 第 1 分钟 起，奖励开始按年奖励率 20% 实时释放</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />奖励实时累计，可随时点击领取，不自动复投</div>
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
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />点击【领取奖励】，支付少量链上 Gas，即可将可领取奖励转入 SP 钱包</div>
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
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />每分钟释放额度 = 质押数量 × 20% ÷ 365 ÷ 24 ÷ 60</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />示例：质押 100,000 SP → 每分钟释放 ≈ 0.38 SP</div>
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
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />所有质押与奖励操作由链上智能合约自动执行，安全透明</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />奖励与本金独立，领取奖励不影响质押状态</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />奖励转入钱包后可自由支配或转出</div>
                                    <div className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />到期后的本金需用户主动点击【取回本金】操作</div>
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