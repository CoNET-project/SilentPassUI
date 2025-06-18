import {useState,useRef,useEffect} from 'react';
import styles from './recovery.module.css';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { useTranslation } from 'react-i18next'
import { CoNET_Data } from '../../utils/globals';
import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { QuestionCircleOutline,FillinOutline } from 'antd-mobile-icons';
import { Dialog,Input,Button } from 'antd-mobile';
import {aesGcmEncrypt} from '../../services/subscription';

interface CopyParams {
  copyVal: string; 
  isEthers: boolean;
}
let copyTimeoutId: NodeJS.Timeout;

const Recovery=({  })=> {
    const { t, i18n } = useTranslation();
    const [backup, setBackup] = useState('https://backup.silentpass.io/?words=');
    const [isEditing, setIsEditing] = useState(true);
    const [isWordsHidden, setIsWordsHidden] = useState(true);
    const [copied, setCopied] = useState({address: "",info: ""});
    const [password, setPassword] = useState('');

    const handleCopy=(info: string) =>{
        let value = '';
        value = backup + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')
        navigator.clipboard.writeText(value);
        setCopied({ address: value, info });
        if (copyTimeoutId) clearTimeout(copyTimeoutId)
        copyTimeoutId = setTimeout(() => setCopied({
            address: '',
            info: '',
        }), 3000);
    }
    const getWords=async()=>{

    }
    const makeRecovery=async()=>{
        const obj = { mnemonicPhrase: CoNET_Data?.mnemonicPhrase, solanaPrivate: CoNET_Data?.profiles[1]?.privateKeyArmor}
        const excryptedText = await aesGcmEncrypt(JSON.stringify(obj), password)
        console.log(excryptedText,'excryptedText')
        const href=`https://backup.silentpass.io/?words=${excryptedText}`
    }
console.log(CoNET_Data,'CoNET_Data')

    return (
        <>
            {isEditing?<div className={styles.generate}>
                <p>{t('comp-comm-RecoveryPhrase')}<QuestionCircleOutline className={styles.question} onClick={() => Dialog.alert({content: t('comp-comm-RecoveryPhrase-info')})} /></p>
                <div className={styles.inputBox}>
                    <Input
                        className={styles.generateInput}
                        placeholder='请输入密码生成备份链接'
                        value={password}
                        onChange={val => {setPassword(val)}}
                    />
                </div>
                <div className={styles.operate}>
                    <Button fill='outline' onClick={()=>{setIsEditing(false)}}>取消</Button>
                    <Button className={styles.recoveryBtn} onClick={makeRecovery} color='primary' disabled={!password}>生成备份链接</Button>
                </div>
            </div>:<>
                <div className={styles.copyText}>
                    <p>{t('comp-comm-RecoveryPhrase')}<QuestionCircleOutline className={styles.question} onClick={() => Dialog.alert({content: t('comp-comm-RecoveryPhrase-info')})} /></p>
                    <div className={isWordsHidden?styles.linkBlur:styles.link}>
                        <a href={backup + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')} target="_blank">{backup + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')}</a>
                    </div>
                </div>
                <div className={styles.buttonList}>
                    <FillinOutline className={styles.edit} onClick={()=>{setIsEditing(true)}} />
                    <button onClick={() => handleCopy("words")}>
                        {
                            (copied.address === (backup + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')) && copied.info === "words") ? (
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