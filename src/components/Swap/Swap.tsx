import { useState, useRef, useEffect } from 'react';
import styles from './swap.module.scss';
import { useTranslation } from 'react-i18next';
import SwapBox from './swapBox/SwapBox';
import Property from './property/Property';
import Supplier from './supplier/Supplier';

const Swap = ({}) => {
    const { t, i18n } = useTranslation();
    
    return (
        <div className={styles.swap}>
            <SwapBox />
            <Property />
            <Supplier />
        </div>
    );
};

export default Swap;