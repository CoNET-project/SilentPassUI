import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './integral.module.scss';
import { useTranslation } from 'react-i18next';
import { List, Popup, NavBar } from 'antd-mobile';
import { GiftOutline,ShopbagOutline } from 'antd-mobile-icons';
import { useDaemonContext } from '@/providers/DaemonProvider';
import _ from 'lodash';

const Integral = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    const { airdropVisible, setAirdropVisible } = useDaemonContext();
    
    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><GiftOutline /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('integral-bar-name')}</div>
                    </div>
                </div>
            </List.Item>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('integral-bar-name')}</NavBar>
                    <div className={styles.bd}>
                        <List>
                            <List.Item prefix={<ShopbagOutline />} onClick={() => {setAirdropVisible(true)}}>
                                {t('integral-list-title-1')}
                            </List.Item>
                        </List>
                    </div>
                </div>
            </Popup>
        </>     
    );
};

export default Integral;