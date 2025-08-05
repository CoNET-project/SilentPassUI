import { useState, useRef, useEffect } from 'react';
import styles from './subscription.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import Loading from '@/components/Subscription/Loading/Loading';
import Failed from '@/components/Subscription/Failed/Failed';
import Success from '@/components/Subscription/Success/Success';
import ConfirmOrder from '@/components/Subscription/ConfirmOrder/ConfirmOrder';
import { openWebLinkNative} from '@/api/index';
import { getPaymentUrl, waitingPaymentStatus, getPaypalUrl, spRewardRequest, RealizationRedeem, changeActiveNFT } from '@/services/wallets';
import {getOracle} from '@/services/passportPurchase';

type Step = 2 | 3 | 4 | 5;

const Subscription = ({}) => {
    const { t, i18n } = useTranslation();
    const { subscriptionVisible, setSubscriptionVisible, profiles, paymentKind, setPaymentKind, selectedPlan, setSelectedPlan, setSuccessNFTID, isIOS, isLocalProxy } = useDaemonContext();
    const [step, setStep] = useState<Step>(2);
    const [price, setPriceInSp] = useState('0');
    const [gasfee, setGasfee] = useState('0');
    const [updateCounter, setUpdateCounter] = useState(0);
    const [spInUsd, setSpInUsd] = useState(0);
    const [solInUsd, setSolInUsd] = useState(0);
    const [spBalance, setSPBalance] = useState('');
    const [solBalance, setSolBalance] = useState(0);
    const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(false);
    const firstRef=useRef(false);

    useEffect(() => {
        const result = (!profiles?.[1]?.tokens?.sp?.balance || (Number(price) > profiles?.[1]?.tokens?.sp?.balance) || (Number(gasfee) > profiles?.[1]?.tokens?.sol?.balance));
        setIsSubmitButtonDisabled(result);
    }, [step, price, gasfee, profiles]);

    useEffect(() => {
        if (updateCounter) {
            setTimeout(() => setUpdateCounter((prev) => prev - 1), 1000)
            return
        }
        getSolanaQuote()
    }, [updateCounter])

    useEffect(() => {
        if(subscriptionVisible){
            if (firstRef.current) {
                return
            }
            firstRef.current = true;
            processVisa()
        }else{
            firstRef.current = false;
        }
        
    }, [subscriptionVisible])

    const showTitle=()=>{
        switch(step){
            case 2:
                return t('Subscription-Header-title');
                break;
            case 3:
                return t('Subscription-Header-progress');
                break;
            case 4:
                return t('subscription-transaction-success');
                break;
            case 5:
                return t('comp-comm-declined');
                break;
            default:
                return '';
        }
    }
    const setReflashQuote = () => {
        setUpdateCounter((prev) => prev - 1)
    }
    const getPlan = async () => {
        const quote = await getOracle()
        if (quote?.data) {
            const data = quote.data
            let ret = 0
            switch(selectedPlan) {
                case '1': {
                    setPriceInSp(data.sp249)
                    ret = 2.49/parseFloat(data.sp249)
                    break
                }
                case '12': {
                    setPriceInSp(data.sp2499)
                    ret = 24.99/parseFloat(data.sp2499)
                    break
                }
                case '3100': {
                    const price = 31*parseFloat(data.sp2499)/24.99
                    setPriceInSp(price.toFixed(2))
                    ret = 31/price
                    
                    break
                }
                default: {
                    setPriceInSp('0')
                    ret = 0
                }
            }
            setSolInUsd(parseFloat(data.so))
            setGasfee('0.00007999')
            setSpInUsd(ret)
            return ret
        }
    }
    const getSolanaQuote = async () => {
        const spPrice = await getPlan();
        if (!spPrice) {
            return 
        }
        if (profiles && profiles?.length) {
            const profile: profile = profiles[1]
            const _spBalance= profile.tokens.sp.balance||'0'
            const _solBalance = profile.tokens.sol.balance1||0
            setSPBalance(_spBalance)
            setSolBalance(_solBalance)
        }
        setUpdateCounter(60)
        setReflashQuote()
    }
    const changeActiveNFTProcess = async (nft: number) => {
        await changeActiveNFT(nft.toString())
    }
    const processVisa = async () => {
        switch(paymentKind) {
            //      redeemCode
            case 6: {
                setStep(3)
                const redeemCode = selectedPlan
                const redeem = await RealizationRedeem(redeemCode)
                setSelectedPlan('12')
                if (!redeem) {
                    return setStep(5)
                }
                
                setSuccessNFTID(redeem.toString())
                setPaymentKind(0)
                await changeActiveNFTProcess(redeem)
                return setSubscriptionVisible(false);
            }
            //      get SP Reword
            case 5: {
                setStep(3)
                const re1 = await spRewardRequest ()
                if (re1 < 0) {
                    return setStep(5)
                }
                
                setSuccessNFTID(re1.toString())
                setPaymentKind(0)
                return setSubscriptionVisible(false);
                
            }

            //      Pay with Paypal
            case 4: {
                
                setStep(3)
                const price = selectedPlan === '1' ? 1 : 2
                const result = await getPaypalUrl(price)
                if(result && result.code===0){
                    let codeUrl=(result.data && result.data.ordersPayVo && result.data.ordersPayVo.payUrl && JSON.parse(result.data.ordersPayVo.payUrl).code_url?result.data && result.data.ordersPayVo && result.data.ordersPayVo.payUrl && JSON.parse(result.data.ordersPayVo.payUrl).code_url || '' :'');
                    if (!codeUrl) {
                        return setStep(5);
                    }
                    openWebLinkNative(codeUrl,isIOS,isLocalProxy)
                    const re1 = await waitingPaymentStatus()
                    if (!re1) {
                        return setStep(5);
                    }
                    setSuccessNFTID(re1)
                    setPaymentKind(0)
                    return setSubscriptionVisible(false);
                }
                return setStep(5);
                
            }
            //      pay with Stripe
            case 2: {
                setStep(3)
                const price = selectedPlan
                const result = await getPaymentUrl(price)
                if (result === null || !result?.url) {
                    return setStep(5);
                }

                openWebLinkNative(result.url, isIOS, isLocalProxy)

                ///                 Stripe充值

                if (selectedPlan === '3') {
                    const re1 = await waitingPaymentStatus()

                }

                const re1 = await waitingPaymentStatus()
                if (!re1) {
                    return setStep(5);
                }
                
                setSuccessNFTID(re1)
                setPaymentKind(0)
                return setSubscriptionVisible(false);
            }
            //      Apple Pay
            case 3: {
                setStep(3)

                const re1 = await waitingPaymentStatus()
                if (!re1) {
                    return setStep(5);
                }
                setSuccessNFTID(re1)
                setPaymentKind(0)
                return setSubscriptionVisible(false);
            }
            //      Pay with SP
            case 1: {
                setStep(2);
                return getSolanaQuote();
            }            
        }
    }
    
    
    return (
        <Popup
            visible={subscriptionVisible}
            onMaskClick={() => {setSubscriptionVisible(false)}}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.popup}
            closeOnMaskClick={true}
        >
            <div className={styles.modalWrap}>
                <NavBar onBack={() => {setSubscriptionVisible(false)}} style={{'--height': '70px'}}>{showTitle()}</NavBar>
                <div className={styles.bd}>
                    {step===2?<ConfirmOrder price={price} gasfee={gasfee} updateCounter={updateCounter} spInUsd={spInUsd} solInUsd={solInUsd} SP_balance={spBalance} SolBalance={solBalance} isSubmitButtonDisabled={isSubmitButtonDisabled} step={step} setStep={setStep} />:''}
                    {step===3?<Loading />:''}
                    {step===4?<Success price={price} gasfee={gasfee} />:''}
                    {step===5?<Failed />:''}
                </div>
            </div>
        </Popup>
    );
};

export default Subscription;