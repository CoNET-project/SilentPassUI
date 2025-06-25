import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './copyBtn.module.css';
import { ReactComponent as CopyIcon } from "./../assets/copy-purple.svg";
import { ReactComponent as CopiedIcon } from "./../assets/check.svg";
import {CopyToClipboard} from 'react-copy-to-clipboard';

interface CopyParams {
  copyVal: string; 
}

const CopyBtn = ({ copyVal }: CopyParams) => {
    const [copyStatus, setCopyStatus] = useState(false);
    const [address,setAddress]=useState(copyVal);

    useEffect(()=>{
        setAddress(copyVal)
    },[copyVal])

    return (
        <button className={styles.button}>
            {copyStatus?<CopiedIcon />:<CopyToClipboard text={address} onCopy={() => {setCopyStatus(true);setTimeout(()=>{setCopyStatus(false)},3000)}}><CopyIcon /></CopyToClipboard>}
        </button>
    );
};

export default CopyBtn;