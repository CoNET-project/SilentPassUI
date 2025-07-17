import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.scss';
import { useTranslation } from 'react-i18next';
import bnb_usdt from './../assets/bnb_usdt_token.png';

type cryptoName = 'BNB' | 'BSC USDT' | 'TRON TRX';

interface paybnbParams {
    purchaseBluePlan:(token: cryptoName) => Promise<void>;
    
}

const PayBSC = ({purchaseBluePlan}:paybnbParams) => {

    return (
        <div className={styles.methodIem} onClick={() => purchaseBluePlan('BSC USDT')}>
            <div className={styles.img}><img src={bnb_usdt} /></div>
            <label>BSC USDT</label>
        </div>    
    );
};

export default PayBSC;