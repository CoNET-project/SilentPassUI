import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.css';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SP_Token } from './../assets/sp-token.svg';

interface payParams {
    payClick:() => void;
}

const PaySP = ({payClick}:payParams) => {

    return (
        <div className={styles.methodIem} onClick={payClick}>
            <div className={styles.img}><SP_Token /></div>
            <label>SP</label>
        </div>    
    );
};

export default PaySP;