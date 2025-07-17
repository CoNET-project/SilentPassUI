import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ApplePay } from './../assets/Apple_Pay_logo.svg';
import { Modal } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';

interface payParams {
    parentVisible:boolean;
    setParentVisible:React.Dispatch<React.SetStateAction<boolean>>;
    appleVisible:boolean;
    setAppleVisible:React.Dispatch<React.SetStateAction<boolean>>;
}

const PayAPPLE = ({parentVisible,setParentVisible,appleVisible,setAppleVisible}:payParams) => {

    const handleClick=()=>{
        setParentVisible(false);
        setAppleVisible(true);
    }

    return (
        <>
            <div className={styles.methodIem} onClick={handleClick}>
                <div className={styles.img}><ApplePay /></div>
                <label>APPLE</label>
            </div>
        </>  
    );
};

export default PayAPPLE;