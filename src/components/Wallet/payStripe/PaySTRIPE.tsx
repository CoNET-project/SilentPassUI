import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.css';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StripeIcon } from "./../assets/stripe.svg";

const PaySTRIPE = ({}) => {

    return (
        <div className={styles.methodIem}>
            <div className={styles.img}><StripeIcon /></div>
            <label>Stripe</label>
        </div>    
    );
};

export default PaySTRIPE;