import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.scss';
import { useTranslation } from 'react-i18next';
import alipay from './../assets/alipay.png';

interface payParams {
    payClick:() => void | {};
}

const PayALI = ({payClick}:payParams) => {

    return (
        <div className={styles.methodIem} onClick={payClick}>
            <div className={styles.img}><img src={alipay} /></div>
            <label>Alipay</label>
        </div>    
    );
};

export default PayALI;