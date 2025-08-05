import { useState, useRef, useEffect } from 'react';
import styles from './loading.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ReactComponent as Dentro } from './../assets/dentro.svg';
import { ReactComponent as Fora } from './../assets/fora.svg';
import { Button } from 'antd-mobile';

const Loading = ({}) => {
    const { t, i18n } = useTranslation();
    const { paymentKind } = useDaemonContext();
    
    return (
        <div className={styles.loading}>
            <div className={styles.desc}>{t('Subscription-Header-progress-detail')}</div>
            <div className={styles.loadingRing}>
                <Dentro className={styles.rotationClock} />
                <Fora className={styles.rotation} />
            </div>
            <div className={styles.loadingText}>{t('comp-comm-LoadingRing')}</div>

            {paymentKind === 1 ? <div className={styles.tips}>{t('Subscription-Footer-transferInfo')}</div>:''}

            <div className={styles.oper}>
                <Button block color='primary' size='large' loading={true} disabled={true}></Button>
            </div>
        </div>
    );
};

export default Loading;