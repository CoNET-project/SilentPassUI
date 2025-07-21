import { useState, useRef, useEffect } from 'react';
import styles from './swapBox.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { ReactComponent as SwapBtn } from './../assets/swap-icon-black.svg';
import { Input,Button } from 'antd-mobile';
import { DownOutline } from 'antd-mobile-icons';
import * as motion from "motion/react-client";

const SwapBox = ({}) => {
    const { t, i18n } = useTranslation();
    const [rotation, setRotation] = useState(0);
    const [options, setOptions] = useState(['SP','SOL','USDT']);
    const [fromToken, setFromToken] = useState();
    const [toToken, setToToken] = useState();
    const [fromAmount, setFromAmount] = useState('0')
    const [toAmount, setToAmount] = useState('0.00000000')

    const handleSwap=()=>{

    }
    
    return (
        <>
            <div className={styles.swapBox}>
                <div className={styles.swapItem}>
                    <div className={styles.view}>
                        <label className={styles.label}>{t('swap-asset-pay')}</label>
                        <Input className={styles.input} clearable type="number" step='0.01' />
                        <div className={styles.price}>$ 0.0000</div>
                    </div>
                    <div className={styles.operation}>
                        <div className={styles.type}><ConetToken className={styles.icon} />SP<DownOutline className={styles.arrow} /></div>
                        <div className={styles.allBtn}>{t('swap-asset-Max')}</div>
                    </div>
                </div>
                <div className={styles.swapItem}>
                    <div className={styles.view}>
                        <label className={styles.label}>{t('swap-asset-Receive')}</label>
                        <Input className={styles.input} clearable type="number" step='0.01' />
                        <div className={styles.price}>$ 0.0000</div>
                    </div>
                    <div className={styles.operation}>
                        <div className={styles.type}><SolanaToken className={styles.icon} />SOL<DownOutline className={styles.arrow} /></div>
                    </div>
                </div>
                <motion.button
                    className={styles.swapBtnWrap}
                    animate={{ rotate: rotation }}
                    transition={{ duration: 0.6 }}
                    onTap={() => {if(rotation % 180 == 0){setRotation(rotation + 180)}}}
                >
                    <div className={styles.swapBtn} onClick={handleSwap}><SwapBtn /></div>
                </motion.button>
            </div>
            <div className={styles.swapTip}>{t('swap-asset-tip')}</div>
            <Button className={styles.confirmBtn} block color='primary' size='large'>{t('swap-asset-confirm')}</Button>
        </>
    );
};

export default SwapBox;