import {useState,useRef,useEffect} from 'react';
import styles from './recovery.module.css';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { useTranslation } from 'react-i18next'
import { CoNET_Data,setCoNET_Data } from '../../utils/globals';
import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { QuestionCircleOutline,FillinOutline } from 'antd-mobile-icons';
import { Dialog,Input,Button,Toast,Ellipsis } from 'antd-mobile';
import {aesGcmEncrypt} from '../../services/subscription';
import { storeSystemData } from './../../services/wallets';
import _ from 'lodash';

let copyTimeoutId: NodeJS.Timeout;

const Recovery=({  })=> {
    const { t, i18n } = useTranslation();
    const [backup, setBackup] = useState('https://backup.silentpass.io/?words=');
    const [isEditing, setIsEditing] = useState(false);
    const [isWordsHidden, setIsWordsHidden] = useState(true);
    const [copied, setCopied] = useState({address: "",info: ""});
    const [password, setPassword] = useState('');
    const [recoveryLoading, setRecoveryLoading] = useState(false);

    const handleCopy=(info: string) =>{
        let value = '';
        value = backup + (CoNET_Data?.recoveryWords || '');
        navigator.clipboard.writeText(value);
        setCopied({ address: value, info });
        if (copyTimeoutId) clearTimeout(copyTimeoutId)
        copyTimeoutId = setTimeout(() => setCopied({
            address: '',
            info: '',
        }), 3000);
    }
    const makeRecovery=async()=>{
        if(CoNET_Data){
            try{
                setRecoveryLoading(true);
                const obj = { mnemonicPhrase: CoNET_Data?.mnemonicPhrase, solanaPrivate: CoNET_Data?.profiles[1]?.privateKeyArmor}
                const excryptedText = await aesGcmEncrypt(JSON.stringify(obj), password);
                const tmpData = _.cloneDeep(CoNET_Data);
                tmpData.recoveryWords = excryptedText;
                setCoNET_Data(tmpData);
                storeSystemData();
                setRecoveryLoading(false);
                setIsEditing(false);
                Toast.show({icon: 'success',content: t('comp-accountlist-recovery-success')});
            }catch(err){
                Toast.show({icon: 'fail',content: JSON.stringify(err)});
            }
        }
    }

    return (
        <>
            {isEditing || !(CoNET_Data && CoNET_Data.recoveryWords)?<div className={styles.generate}>
                <p>{t('comp-comm-RecoveryPhrase')}<QuestionCircleOutline className={styles.question} onClick={() => Dialog.alert({content: t('comp-comm-RecoveryPhrase-info')})} /></p>
                <div className={styles.inputBox}>
                    <Input
                        className={styles.generateInput}
                        placeholder={t('comp-accountlist-recovery-placeholder')}
                        value={password}
                        onChange={val => {setPassword(val)}}
                    />
                </div>
                <div className={styles.operate}>
                    {(CoNET_Data && CoNET_Data.recoveryWords)?<Button fill='outline' onClick={()=>{setIsEditing(false)}}>{t('comp-accountlist-recovery-cancel')}</Button>:''}
                    <Button className={!(CoNET_Data && CoNET_Data.recoveryWords) ? styles.recoveryBlockBtn: styles.recoveryBtn} block={!(CoNET_Data && CoNET_Data.recoveryWords)} onClick={makeRecovery} loading={recoveryLoading} color='primary' disabled={!password}>{t('comp-accountlist-recovery-confirm')}</Button>
                </div>
            </div>:<>
                <div className={styles.copyText}>
                    <p>{t('comp-comm-RecoveryPhrase')}<QuestionCircleOutline className={styles.question} onClick={() => Dialog.alert({content: t('comp-comm-RecoveryPhrase-info')})} /></p>
                    <div className={isWordsHidden?styles.linkBlur:styles.link}>
                        <a href={backup + (CoNET_Data?.recoveryWords || '')} target="_blank"><Ellipsis direction='end' rows={2} content={backup + (CoNET_Data?.recoveryWords || '')} /></a>
                    </div>
                </div>
                <div className={styles.buttonList}>
                    <FillinOutline className={styles.edit} onClick={()=>{setIsEditing(true)}} />
                    <button onClick={() => handleCopy("words")}>
                        {
                            (copied.address === (backup + (CoNET_Data?.recoveryWords || '')) && copied.info === "words") ? (
                                <img src="/assets/check.svg" alt="Copy icon" />
                            ) : (
                                <img src="/assets/copy-purple.svg" alt="Copy icon" />
                            )
                        }
                    </button>
                    <button className={isWordsHidden ? styles.hidden : ""} onClick={() => setIsWordsHidden((prev) => !prev)}>
                        {
                            isWordsHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                        }
                    </button>
                </div>
            </>}
        </>
    );
}


export default Recovery;