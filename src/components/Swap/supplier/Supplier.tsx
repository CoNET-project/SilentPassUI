import { useState, useRef, useEffect } from 'react';
import styles from './supplier.module.scss';
import { useTranslation } from 'react-i18next';

const Supplier = ({}) => {
    const { t, i18n } = useTranslation();

    return (
        <div className={styles.supplier}>
            <div className={styles.item}>
                <label className={styles.label}>{t('comp-TokenTab-provide')}</label>
                <div className={styles.val}>{t('comp-SwapInput-provide')}</div>
            </div>
            <div className={styles.item}>
                <label className={styles.label}>{t('comp-TokenTab-Slippage')}</label>
                <div className={styles.val}>{t('comp-TokenTab-Auto')} 2.50%</div>
            </div>
            <div className={styles.item}>
                <label className={styles.label}>{t('comp-TokenTab-fee')}</label>
                <div className={styles.val}>$ 0</div>
            </div>
        </div>
    );
};

export default Supplier;