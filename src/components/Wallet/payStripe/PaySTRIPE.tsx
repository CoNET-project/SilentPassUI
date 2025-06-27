import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './../payBnb/payBnb.module.css';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StripeIcon } from "./../assets/stripe.svg";

interface payParams {
    stripeClick:() => void;
}

const PaySTRIPE = ({stripeClick}:payParams) => {

    return (
        <div className={styles.methodIem} onClick={stripeClick}>
            <div className={styles.img}><StripeIcon /></div>
            <label>Stripe</label>
        </div>    
    );
};

export default PaySTRIPE;