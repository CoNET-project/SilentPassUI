import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './mainWallet.module.css';
import { useTranslation } from 'react-i18next';
import { List,Popup,NavBar,Empty,Radio,SpinLoading,Toast } from 'antd-mobile';
import { LockFill,ExclamationCircleFill } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { changeActiveNFT } from './../../../services/wallets';
import { ReactComponent as ConetToken } from './../assets/main-wallet.svg';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import PassportItem from './passportItem/PassportItem';
import { ethers } from 'ethers';
import CodeButton from './../codeButton/CodeButton';
import CopyBtn from './../copyBtn/CopyBtn';
import HideBtn from './../hideBtn/HideBtn';
import Recovery from './../recovery/Recovery';
import _ from 'lodash';

const MainWallet = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    const { profiles,activePassport,setActivePassport } = useDaemonContext();
    const [isAddressHidden, setIsAddressHidden] = useState(false);
    const [isKeyHidden, setIsKeyHidden] = useState(true);
    const [isChangeLoading, setIsChangeLoading] = useState(false);

    const getAddress = (wallet: any) => {
        return ethers.getAddress(wallet?.keyID).slice(0, 7) + '...' + ethers.getAddress(wallet?.keyID).slice(-5);
    }
    const getPrivateKeyArmor = (wallet: any) => {
        return wallet?.privateKeyArmor.slice(0, 7) + '...' + wallet?.privateKeyArmor.slice(-5);
    }
    const getWholeAddress = (wallet: any) => {
        return ethers.getAddress(wallet?.keyID);
    }
    const getWholePrivateKeyArmor = (wallet: any) => {
        return wallet?.privateKeyArmor;
    }
    const getNewPassport=(id: string)=>{
        return _.find(profiles?.[0]?.silentPassPassports,(item) => String(item.nftID) === String(id));
    }
    const handleChangeActiveNFT=async(newPassportNftID:any)=> {
        setIsChangeLoading(true);
        const result = await changeActiveNFT(newPassportNftID);
        if (!result) {
            Toast.show({
                icon: 'fail',
                content: t('wallet-account-main-wallet-change-fail'),
            })
            return ;
        }
        await new Promise((resolve) => setTimeout(resolve, 6000));
        setIsChangeLoading(false);
        const newItem=getNewPassport(String(newPassportNftID));
        setActivePassport(newItem);
    }
    const handleChangePassport=(passport:any)=>{
        handleChangeActiveNFT(passport);
    }

    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><ConetToken /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('wallet-account-main-wallet')}</div>
                        <div className={styles.subTitle}>(CoNET)</div>
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
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('wallet-account-main-wallet')} (CoNET)</NavBar>
                    <div className={styles.bd}>
                        <div className={styles.description}><ExclamationCircleFill className={styles.icon} />{t('wallet-account-main-wallet-desc')}</div>

                        <div className={styles.passport}>
                            <div className={styles.label}>{t('wallet-account-brief-label')}</div>
                                {
                                    (profiles?.[0]?.silentPassPassports && profiles?.[0]?.activePassport && profiles?.[0]?.silentPassPassports?.length)
                                    ? <div className={styles.passportList}>
                                        <Radio.Group value={activePassport?.nftID?.toString()} onChange={handleChangePassport}>
                                            {
                                                [...profiles?.[0]?.silentPassPassports]
                                                .sort((a: any, b: any) => {
                                                    const isAActive = String(a?.nftID) === String(activePassport?.nftID);
                                                    const isBActive = String(b?.nftID) === String(activePassport?.nftID);
                                                    return isAActive === isBActive ? 0 : isAActive ? -1 : 1;
                                                })
                                                .map((passport: any) => (
                                                    <PassportItem key={passport.nftID} passportInfo={passport} />
                                                ))
                                            }
                                        </Radio.Group>
                                    </div>: <Empty
                                        style={{ padding: '12px 0 0' }}
                                        image={
                                            <div className={styles.empty}>
                                                <LockFill
                                                    style={{
                                                        color: '#f1943f',
                                                        fontSize: 14,
                                                        marginRight:2
                                                    }}
                                                />
                                                {t('wallet-account-main-wallet-passport-empty')}
                                            </div>
                                      }
                                    />
                                }
                        </div>

                        {profiles?.[0]?.keyID ?<div className={styles.address}>
                            <div className={styles.cont}>
                                <label>{t('wallet-account-main-wallet-address-title')}</label>
                                <div className={isAddressHidden?styles.valHide:styles.val}>{getAddress(profiles?.[0])}</div>
                            </div>
                            <CodeButton copyVal={getWholeAddress(profiles?.[0])} isEthers={true} />
                            <div className={styles.operation}>
                                <CopyBtn copyVal={getWholeAddress(profiles?.[0])} />
                                <div style={{marginLeft:12}}><HideBtn isHidden={isAddressHidden} setIsHidden={setIsAddressHidden} /></div>
                            </div>
                        </div>:''}

                        {profiles?.[0]?.privateKeyArmor ?<div className={styles.address}>
                            <div className={styles.cont}>
                                <label>{t('wallet-account-main-wallet-privitekey-title')}</label>
                                <div className={isKeyHidden?styles.valHide:styles.val}>{getPrivateKeyArmor(profiles?.[0])}</div>
                            </div>
                            <div className={styles.operation}>
                                <CopyBtn copyVal={getWholePrivateKeyArmor(profiles?.[0])} />
                                <div style={{marginLeft:12}}><HideBtn isHidden={isKeyHidden} setIsHidden={setIsKeyHidden} /></div>
                            </div>
                        </div>:''}

                        {CoNET_Data?.mnemonicPhrase ? <div className={styles.recovery}><Recovery /></div> : ''}
                    </div>
                    {isChangeLoading?<div className={styles.loading}><div className={styles.spinBox}><SpinLoading /></div></div>:''}
                </div>
            </Popup>
        </>     
    );
};

export default MainWallet;