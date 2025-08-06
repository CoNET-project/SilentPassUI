import { useState, useRef, useEffect } from 'react';
import styles from './stake.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar,Button,Empty,Grid } from 'antd-mobile';
import PayWays from './../spWallet/payWays';
import { PushpinOutlined } from '@ant-design/icons';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ExclamationShieldOutline,ClockCircleOutline } from 'antd-mobile-icons';

interface stakeParams {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Stake = ({visible,setVisible}:stakeParams) => {
    const { t, i18n } = useTranslation();
    const { profiles } = useDaemonContext();

    console.log(profiles,'profiles')

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
                <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>SP 质押</NavBar>
                <div className={styles.bd}>
                    <div className={styles.totalInfo}>
                        <div className={styles.totalInfoItem}>
                            <label className={styles.label}>当前质押总额</label> 
                            <div className={styles.val}>8882841 SP <span>/（$75）</span></div>
                        </div>
                        <div className={styles.totalInfoItem}>
                            <label className={styles.label}>当前可用余额</label> 
                            <div className={styles.val}>2112 SP / <span>（$75）</span></div>
                        </div>
                        <div className={styles.stakeBox}>
                            <div className={styles.oper}><Button block color='primary' size='middle'>立即质押</Button></div>
                            <ul className={styles.stakeBoxList}>
                                <li className={styles.stakeBoxListItem}><ExclamationShieldOutline className={styles.icon} />每个质押需等值市价25美元的SP代币</li>
                                <li className={styles.stakeBoxListItem}><ExclamationShieldOutline className={styles.icon} />每个账号限4个质押，质押期为一年 </li>
                            </ul>
                        </div>
                    </div>
                    <div className={styles.history}>
                        <div className={styles.title}><ClockCircleOutline className={styles.icon} />历史记录</div>
                        <div className={styles.historyList}>
                            <div className={styles.gridbox}>
                                <Grid columns={3} gap={8}>
                                    <Grid.Item><span className={styles.hd}>日期</span></Grid.Item>
                                    <Grid.Item><span className={styles.hd}>数量</span></Grid.Item>
                                    <Grid.Item><span className={styles.hd}>状态</span></Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item>锁仓中</Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item>锁仓中</Grid.Item>

                                    <Grid.Item>2025-07-01</Grid.Item>
                                    <Grid.Item>12312412 SP</Grid.Item>
                                    <Grid.Item>锁仓中</Grid.Item>
                                </Grid>
                            </div>
                            {/*<div className={styles.empty}>
                                <Empty description={'暂无数据'} />
                            </div>*/}
                        </div>
                    </div>
                    <div className={styles.stakeInfos}>
                        <div className={styles.title}><PushpinOutlined className={styles.icon} />质押说明</div>
                        <ul className={styles.stakeInfosList}>
                            <li className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />固定年化收益 20%，每日释放奖励</li>
                            <li className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />所有过程由链上合约自动执行 </li>
                            <li className={styles.stakeInfosListItem}><ExclamationShieldOutline className={styles.icon} />奖励可随时领取，资金链上托管</li>
                        </ul>
                    </div>
                    <div className={styles.payWaysWrap}>
                        <PayWays defaultVisible={true} />
                    </div>
                </div>
            </div>
        </Popup>
    );
};

export default Stake;