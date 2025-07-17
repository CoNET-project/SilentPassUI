import {useState,useRef,useEffect} from 'react';
import { Popup,NavBar,Button,TextArea,Toast } from 'antd-mobile';
import { ExclamationTriangleOutline } from 'antd-mobile-icons';
import styles from './importButton.module.scss';
import { useTranslation } from 'react-i18next';
import bs58 from "bs58";
import _ from 'lodash';
import { Keypair, Connection } from "@solana/web3.js";
import { CoNET_Data, setCoNET_Data, globalAllNodes } from "./../../utils/globals";
import { useDaemonContext } from "./../../providers/DaemonProvider";
import { refreshSolanaBalances, storeSystemData } from './../../services/wallets';

const ImportButton=({  }) => {
    const { setProfiles } = useDaemonContext();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isRightKey, setIsRightKey] = useState(true);
    const [value, setValue] = useState('');
	const { t, i18n } = useTranslation();

    const checkValue=(input: string)=>{
        try{
            let keypair: Keypair;
            const decoded = bs58.decode(input);
            if (decoded.length !== 64) {
                return setIsRightKey(false);
            }
            keypair = Keypair.fromSecretKey(decoded);
            if (!keypair || !keypair.publicKey) {
                return setIsRightKey(false);
            }
            return setIsRightKey(true);
        }catch(error){
            setIsRightKey(false);
        }
    }
    const handleChange=(val: string)=>{
        setValue(val);
        if(val){
            checkValue(val);
        }else{
            setIsRightKey(true);
        }
    }
    const goImport=async()=>{
        if(isRightKey && CoNET_Data?.profiles[1]?.keyID){

            // 从 base58 私钥生成钱包
            const privateKey = value;
            const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
            const publicKey = wallet.publicKey.toBase58();
            
            setLoading(true);

            const tmpData = _.cloneDeep(CoNET_Data);
            tmpData.profiles[1].privateKeyArmor = privateKey;
            tmpData.profiles[1].keyID = publicKey;
            tmpData.profiles[1].type = "solana";

            setCoNET_Data(tmpData);
			setProfiles(tmpData.profiles)
            storeSystemData()
            refreshSolanaBalances();

            Toast.show({
                icon: 'success',
            });
            setValue('');
            setLoading(false);
            setVisible(false);
        }
    }

    return (
        <>
            <Button block color='primary' size='large' className={styles.importBtn} onClick={()=>{setVisible(true)}}>
                {t('comp-comm-import')}
            </Button>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.importBtnPopup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('comp-comm-import')}</NavBar>
                    <div className={styles.cont}>
                        <TextArea value={value} onChange={handleChange} className={styles.textarea} placeholder={t('comp-comm-private-key')} rows={5} />
                        <div className={styles.warning}>
                            <div className={styles.title}><ExclamationTriangleOutline style={{marginRight:3}} />{t('comp-comm-private-warning-1')}</div>
                            {t('comp-comm-private-warning-2')}
                        </div>
                        <Button className={isRightKey?styles.btn:styles.errorBtn} onClick={goImport} loading={loading} block color='primary' disabled={!value} size='large'>{isRightKey?t('comp-comm-import-btn'):t('comp-comm-import-error')}</Button>
                    </div>
                </div>
            </Popup>
        </>
    );
}


export default ImportButton;