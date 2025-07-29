import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './payBnb.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BNBIcon } from "./../assets/bnb_token.svg";

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

interface paybnbParams {
    purchaseBluePlan:(token: cryptoName) => Promise<void>;
    
}

const PayBNB = ({purchaseBluePlan}:paybnbParams) => {
    
    return (
        <div className={styles.methodIem} onClick={() => purchaseBluePlan('BNB')}>
            <div className={styles.img}><BNBIcon /></div>
            <label>BNB</label>
        </div>    
    );
};

export default PayBNB;