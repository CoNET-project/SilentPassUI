import { useState, useRef, useEffect } from 'react';
import styles from './confirmOrder.module.scss';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { purchasePassport} from '@/services/passportPurchase';
import { ClockCircleOutline } from 'antd-mobile-icons';
import { ReactComponent as SpToken } from './../assets/sp-token.svg';
import { ReactComponent as SolToken } from './../assets/solana-token.svg';

type Step = 2 | 3 | 4 | 5;

interface params {
    price: string;
    gasfee: string;
    updateCounter:any;
    spInUsd:any;
    solInUsd:any;
    SP_balance:any;
    SolBalance:any;
    isSubmitButtonDisabled:boolean;
    step:Step;
    setStep:any;
}

const ConfirmOrder = ({ price, gasfee, updateCounter, spInUsd, solInUsd, SP_balance, SolBalance, isSubmitButtonDisabled, step, setStep }:params) => {
    const { t, i18n } = useTranslation();
    const { setAirdropProcess, setSuccessNFTID, setSubscriptionVisible, selectedPlan, profiles } = useDaemonContext();

    const nextStep=()=> {
        if (step > 4) return;
        setStep((prev: Step) => (prev + 1 as Step));
    }
    const handleButtonAction = async () => {
        setAirdropProcess(false);
        try {
            nextStep();
            const tx = await purchasePassport(price)
            if (!tx) {
                return setStep(5);
            }
            setSuccessNFTID(tx.toString())
            setSubscriptionVisible(false);
        } catch (error) {
            setStep(5);
        }
    }

    return (
        <div className={styles.confirmOrder}>
            <div className={styles.title}>{t('Subscription-SecondStep-title')}</div>
            <div className={styles.goodsInfo}>
                <div className={styles.spec}>
                    <span className={styles.specName}>{selectedPlan === '12' ? t('passport_Annually') : selectedPlan === '1' ? t('passport_Monthly') :t('comp-accountlist-SpClub-detail-1') }</span>
                    <span>{selectedPlan === '1' ? '30' : selectedPlan === '12' ? '365': t('passport_unlimit')}  {selectedPlan !== '3100' && t('passport_day')}</span>
                </div>
                <div className={styles.extra}>{t('comp-RedeemPassport-1device')},{t('passport_unlimitBandweidth')} {price} SP</div>
            </div>
            <div className={styles.title}>{t('comp-comm-Paywith')}</div>
            <div className={styles.payList}>
                <div className={styles.payItem}>
                    <div className={styles.lt}>
                        <SpToken className={styles.icon} />
                        <span>{t('comp-comm-Balance')}</span>
                    </div>
                    <span>{SP_balance} SP</span>
                </div>
                <div className={styles.payItem}>
                    <div className={styles.lt}>
                        <SolToken className={styles.icon} />
                        <span>{t('comp-comm-Balance')}</span>
                    </div>
                    <span>{SolBalance.toFixed(6)} SOL</span>
                </div>
            </div>
            <div className={styles.title}>
                {t('comp-comm-Summary')}
                <div className={styles.extra}><ClockCircleOutline className={styles.icon} />{t('comp-comm-QuoteUpdates')} {updateCounter >= 0 ? updateCounter : 0} {t('passport_secound')}</div>
            </div>
            <div className={styles.aboutInfo}>
                <div className={styles.item}>
                    <label className={styles.label}>{selectedPlan === '12' ? t('passport_Annually') : selectedPlan === '1' ? t('passport_Monthly'): t('comp-accountlist-SpClub-detail-1')}</label>
                    <div className={styles.val}>{price} $SP</div>
                </div>
                <div className={styles.item}>
                    <label className={styles.label}>{t('comp-comm-GASFee')}</label>
                    <div className={styles.val}>{parseFloat(gasfee).toFixed(6)} SOL</div>
                </div>
                <div className={styles.total}>
                    <label className={styles.label}>{t('comp-comm-Total')}</label>
                    <div className={styles.val}>{parseFloat(price).toFixed(0)} SP + {parseFloat(gasfee).toFixed(6)} SOL</div>
                </div>
            </div>
            <div className={styles.oper}>
                <Button onClick={handleButtonAction} disabled={isSubmitButtonDisabled} block color='primary' size='large'>{isSubmitButtonDisabled ? t('comp-comm-Insufficient-balance') : t('comp-comm-Pay')}</Button>
            </div>
        </div>
    );
};

export default ConfirmOrder;