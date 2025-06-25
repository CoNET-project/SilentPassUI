import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './payBnb.module.css';
import { useTranslation } from 'react-i18next';
import bnb_token from './../assets/bnb_token.png';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

interface paybnbParams {
    purchaseBluePlan:(token: cryptoName) => Promise<void>;
    
}

const PayBNB = ({purchaseBluePlan}:paybnbParams) => {
    
    return (
        <div className={styles.methodIem} onClick={() => purchaseBluePlan('BNB')}>
            <div className={styles.img}><img src={bnb_token} /></div>
            <label>BNB</label>
        </div>    
    );
};

export default PayBNB;