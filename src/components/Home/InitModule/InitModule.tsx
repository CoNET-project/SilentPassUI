import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/InitModule/initModule.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SPLoading } from '@/components/Home/assets/silent-pass-logo-grey.svg';

interface params {
    initPercentage: number;
}

const InitModule = ({initPercentage}:params) => {

    return (
        <div className={styles.initModule}>
            <div className={styles.round}>
                <div className={styles.loading}><SPLoading /></div>
            </div>
            <div className={styles.progress}>Welcome to Silent Pass {initPercentage} %</div>
        </div>    
    );
};

export default InitModule;