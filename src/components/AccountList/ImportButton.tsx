import {useState,useRef,useEffect} from 'react';
import { Popup,NavBar,Button,TextArea } from 'antd-mobile';
import { ExclamationTriangleOutline } from 'antd-mobile-icons';
import styles from './importButton.module.css';
import { useTranslation } from 'react-i18next';
import bs58 from "bs58";
import _ from 'lodash';
import { Keypair, Connection } from "@solana/web3.js";
import { CoNET_Data, setCoNET_Data, globalAllNodes } from "./../../utils/globals";
import { getCurrentPassportInfoInChain } from "./../../services/wallets";
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useDaemonContext } from "./../../providers/DaemonProvider";

interface SendParams {
    type: string; 
    balance: number|string;
    handleRefreshSolanaBalances:()=>Promise<void>;
    usd:number;
    wallet:any;
    isEthers:boolean;
}


const ImportButton=({  })=> {
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
            // Solana主网连接
            const _node1 = globalAllNodes[Math.floor(Math.random() * (globalAllNodes.length - 1))]
            const SOLANA_CONNECTION = new Connection(`https://${_node1.domain}/solana-rpc`, "confirmed");
            setLoading(true);
            // 查询 SOL 余额
            const solBalanceLamports = await SOLANA_CONNECTION.getBalance(wallet.publicKey);
            const solBalance = solBalanceLamports / 1e9;

            const tmpData = _.cloneDeep(CoNET_Data);


            tmpData.profiles[1].tokens.sol.balance = solBalance.toFixed(6);
            tmpData.profiles[1].tokens.sol.balance1 = solBalance;


            tmpData.profiles[1].keyID = publicKey;
            tmpData.profiles[1].type = "solana";

            setCoNET_Data(tmpData);
            setLoading(false);

            console.log(CoNET_Data,'CoNET_Data')
            // const info = await getCurrentPassportInfoInChain(CoNET_Data?.profiles[1]?.keyID);
            // console.log(info,'infoinfoinfoinfoinfoinfoinfo')
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