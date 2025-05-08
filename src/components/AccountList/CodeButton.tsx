import {useState,useRef,useEffect} from 'react';
import { Modal } from 'antd-mobile';
import { SystemQRcodeOutline,LeftOutline } from 'antd-mobile-icons';
import styles from './codeButton.module.css';
import {QRCodeCanvas} from 'qrcode.react';
import {CopyToClipboard} from 'react-copy-to-clipboard';

interface CopyParams {
  copyVal: string; 
  isEthers: boolean;
}

const CodeButton=({ copyVal,isEthers }: CopyParams)=> {
    const [visible, setVisible] = useState(false);
    const [copyStatus, setCopyStatus] = useState(false);
    const [address,setAddress]=useState(copyVal);

    useEffect(()=>{
        setAddress(copyVal)
    },[copyVal])

    return (
        <>
            <div className={styles.codeBtn} onClick={() => {setVisible(true)}}>
                <SystemQRcodeOutline className={styles.codeIcon} />
                <span className={styles.text}>Receive</span>
            </div>
            <Modal
                visible={visible}
                closeOnAction
                disableBodyScroll={false}
                closeOnMaskClick={true}
                onClose={() => {setVisible(false)}}
                className={styles.codeModal}
                content={<div className={styles.codeCont}>
                    <div className={styles.hd}>Receive Address</div>
                    <div className={styles.bd}>
                        <div className={styles.qrcode}><QRCodeCanvas size={120} value={address} /></div>
                        <div className={styles.label}>Your {isEthers?'Main Wallet':'Solana'} Address</div>
                    </div>
                    <div className={styles.ft}>
                        <div className={styles.val}>{copyVal}</div>
                        <div className={styles.oper}>
                            {copyStatus?<div className={styles.copyBtn}><img src="/assets/check.svg" alt="Copy icon" />Copied</div>:<CopyToClipboard text={address} onCopy={() => {setCopyStatus(true);setTimeout(()=>{setCopyStatus(false)},3000)}}>
                                <div className={styles.copyBtn}><img src="/assets/copy-purple.svg" alt="Copy icon" />Copy</div>
                            </CopyToClipboard>}
                        </div>
                    </div>
                    <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
                </div>}
            />
        </>
    );
}


export default CodeButton;