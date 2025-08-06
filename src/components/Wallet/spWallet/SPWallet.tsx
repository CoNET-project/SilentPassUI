import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './spWallet.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Popup,NavBar,Button,Grid } from 'antd-mobile';
import { UndoOutline,ExclamationCircleFill,HandPayCircleOutline } from 'antd-mobile-icons';
import { CoNET_Data } from './../../../utils/globals';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { refreshSolanaBalances, storeSystemData } from './../../../services/wallets';
import SendButton from './../sendBtn/SendButton';
import AutoCodeButton from './../codeButton/AutoCodeButton';
import CopyBtn from './../copyBtn/CopyBtn';
import HideBtn from './../hideBtn/HideBtn';
import History from './../history/History';
import ScanButton from './../scanBtn/ScanButton';
import PayWays from './payWays';

interface params {
    stakeVisible: boolean;
    setStakeVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const SPWallet = ({stakeVisible,setStakeVisible}:params) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    const { profiles, setProfiles, setAirdropSuccess, setAirdropProcess } = useDaemonContext();
    const [isRefreshingSolanaBalances, setIsRefreshingSolanaBalances] = useState(false);
    const [isAddressHidden, setIsAddressHidden] = useState(false);
    const [isKeyHidden, setIsKeyHidden] = useState(true);

    const spSendRef=useRef();
    const solSendRef=useRef();
    const usdtSendRef=useRef();

    const getAddress = (wallet: any) => {
        return wallet?.keyID.slice(0, 7) + '...' + wallet?.keyID.slice(-5);
    }
    const getPrivateKeyArmor = (wallet: any) => {
        return wallet?.privateKeyArmor.slice(0, 7) + '...' + wallet?.privateKeyArmor.slice(-5);
    }
    const getWholeAddress = (wallet: any) => {
        return wallet?.keyID;
    }
    const getWholePrivateKeyArmor = (wallet: any) => {
        return wallet?.privateKeyArmor;
    }
    const handleRefreshSolanaBalances=async()=>{
        setAirdropSuccess(false)
        setAirdropProcess(false)
        setIsRefreshingSolanaBalances(true);
        try {
            await refreshSolanaBalances()
            storeSystemData()
            const tmpData = CoNET_Data;
            if (!tmpData) {
                return;
            }
            tmpData.profiles[1] = profiles?.[1];
            setProfiles(tmpData.profiles);
        } catch (ex) {
            console.log(ex);
        }
        setTimeout(() => setIsRefreshingSolanaBalances(false), 2000);
    }
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
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><SolanaToken /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('wallet-account-sp-wallet')}</div>
                        <div className={styles.subTitle}>(Solana)</div>
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
                    <NavBar right={<ScanButton spSendRef={spSendRef} solSendRef={solSendRef} usdtSendRef={usdtSendRef} />} onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('wallet-account-sp-wallet')} (Solana)</NavBar>
                    <div className={styles.bd}>
                        <div className={styles.toobar}>
                            <div className={styles.description}><ExclamationCircleFill className={styles.icon} />{t('wallet-account-sp-wallet-desc')}</div>
                            <div className={styles.btnWrap}><Button fill='none' size='large' className={styles.btn} disabled={!profiles?.[1]?.keyID} loading={isRefreshingSolanaBalances} loadingIcon={<UndoOutline className="rotatingIcon" />} onClick={handleRefreshSolanaBalances}><UndoOutline /></Button></div>
                        </div>

                        <ul className={styles.list}>
                            <li className={styles.listItem}>
                                <div className={styles.type}>
                                    <ConetToken />
                                    <div className={styles.text}>
                                        <div className={styles.name}>SP</div>
                                        <div className={styles.num}>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className={styles.value}>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</div>
                                <SendButton type={'$SP'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)} balance={(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))} extendref={spSendRef} />
                            </li>
                            {/*<li className={styles.listItemSp}>
                                <div className={styles.type}>
                                    <ConetToken />
                                    <div className={styles.text}>
                                        <div className={styles.name}>SP</div>
                                    </div>
                                </div>
                                <div className={styles.assetsInfo}>
                                    <Grid columns={1} gap={[5,1]}>
                                        <Grid.Item>总资产</Grid.Item>
                                        <Grid.Item>可用余额</Grid.Item>
                                        <Grid.Item>{convertNumberToString(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))}</Grid.Item>
                                        <Grid.Item>1.18k</Grid.Item>
                                        <Grid.Item>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</Grid.Item>
                                        <Grid.Item>$0.8766</Grid.Item>
                                    </Grid>
                                </div>
                                <div className={styles.stakeBtn} onClick={() => {setStakeVisible(true)}}>
                                    <HandPayCircleOutline className={styles.icon} />
                                    <span className={styles.text}>{t('stake-title')}</span>
                                </div>
                                <SendButton type={'$SP'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)} balance={(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))} extendref={spSendRef} />
                            </li>*/}
                            <li className={styles.listItem}>
                                <div className={styles.type}>
                                    <SolanaToken />
                                    <div className={styles.text}>
                                        <div className={styles.name}>SOL</div>
                                        <div className={styles.num}>{convertNumberToString(profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6))}</div>
                                    </div>
                                </div>
                                <div className={styles.value}>${profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)}</div>
                                <SendButton type={'$SOL'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)} balance={profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)} extendref={solSendRef} />
                            </li>
                            {profiles?.[1]?.tokens?.usdt?<li className={styles.listItem}>
                                <div className={styles.type}>
                                    <UsdtToken />
                                    <div className={styles.text}>
                                        <div className={styles.name}>USDT</div>
                                        <div className={styles.num}>{convertNumberToString(profiles?.[1]?.tokens?.usdt?.balance || (0.0).toFixed(6))}</div>
                                    </div>
                                </div>
                                <div className={styles.value}>${profiles?.[1]?.tokens?.usdt?.usd || (0.0).toFixed(2)}</div>
                                <SendButton type={'$USDT'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={profiles?.[1]?.tokens?.usdt?.usd || (0.0).toFixed(2)} balance={profiles?.[1]?.tokens?.usdt?.balance || (0.0).toFixed(6)} extendref={usdtSendRef} />
                            </li>:''}
                        </ul>

                        <div className={styles.payWaysWrap}>
                            <PayWays defaultVisible={false} />
                        </div>

                        {profiles?.[1]?.keyID ?<div className={styles.address}>
                            <div className={styles.cont}>
                                <label>{t('wallet-account-main-wallet-address-title')}</label>
                                <div className={isAddressHidden?styles.valHide:styles.val}>{getAddress(profiles?.[1])}</div>
                            </div>
                            <AutoCodeButton copyVal={getWholeAddress(profiles?.[1])} isEthers={false} />
                            <div className={styles.operation}>
                                <CopyBtn copyVal={getWholeAddress(profiles?.[1])} />
                                <div style={{marginLeft:12}}><HideBtn isHidden={isAddressHidden} setIsHidden={setIsAddressHidden} /></div>
                            </div>
                        </div>:''}

                        {profiles?.[1]?.privateKeyArmor ?<div className={styles.address}>
                            <div className={styles.cont}>
                                <label>{t('wallet-account-main-wallet-privitekey-title')}</label>
                                <div className={isKeyHidden?styles.valHide:styles.val}>{getPrivateKeyArmor(profiles?.[1])}</div>
                            </div>
                            <div className={styles.operation}>
                                <CopyBtn copyVal={getWholePrivateKeyArmor(profiles?.[1])} />
                                <div style={{marginLeft:12}}><HideBtn isHidden={isKeyHidden} setIsHidden={setIsKeyHidden} /></div>
                            </div>
                        </div>:''}
                        <History />
                    </div> 
                </div>
            </Popup>
        </>     
    );
};

export default SPWallet;