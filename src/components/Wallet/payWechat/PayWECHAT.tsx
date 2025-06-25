import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.css';
import { useTranslation } from 'react-i18next';
import wechat from './../assets/wechat.png';

interface payParams {
    payClick:() => {};
}

const PayWECHAT = ({payClick}:payParams) => {

    return (
        <div className={styles.methodIem} onClick={payClick}>
            <div className={styles.img}><img src={wechat} /></div>
            <label>WeChat</label>
        </div>    
    );
};

export default PayWECHAT;