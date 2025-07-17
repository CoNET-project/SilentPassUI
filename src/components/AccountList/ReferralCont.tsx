import {useState,useRef,useEffect} from 'react';
import { UserOutline,LinkOutline } from 'antd-mobile-icons';
import { Button,Ellipsis,Input,Toast } from 'antd-mobile';
import styles from './referralCont.module.scss';
import { useTranslation } from 'react-i18next';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getirDropForSPReff } from '../../services/subscription';

interface CopyBtnParams {
    text:string;
}

const CopyBtn=({text}:CopyBtnParams)=>{
    const [copyStatus, setCopyStatus] = useState(false);
    const { t, i18n } = useTranslation();
    const { profiles } = useDaemonContext();

    return (
        <>
            {copyStatus?<span className={styles.copied}>{t('comp-accountlist-Referral-copied-text')}</span>:<CopyToClipboard text={text} onCopy={() => {setCopyStatus(true);setTimeout(()=>{setCopyStatus(false)},3000)}}>
                <Button className={styles.copyBtn} color='primary' fill='none' size="mini">{t('comp-accountlist-Referral-copy-text')}</Button>
            </CopyToClipboard>}
        </>
    )
}

const ReferralCont=({  })=> {
    const { t, i18n } = useTranslation();
    const { profiles, setAirdropSuccess, setAirdropTokens, setAirdropProcess, setAirdropProcessReff } = useDaemonContext();
    const [inviter, setInviter] = useState('');
    const [subLoading, setSubLoading] = useState(false);
    const handleSetInviter = async () => {
		if (subLoading) {
			return
		}
        setSubLoading(true);
        const result = await getirDropForSPReff(inviter)
		
        setSubLoading(false);

        if (typeof result === 'boolean') {
            Toast.show({icon: 'fail',content:t('comp-accountlist-Referral-Inviter-fail')});
            return ;
        }

        
        // setAirdropTokens(result)
        
        // setAirdropProcessReff(false)
		// setAirdropProcess(true)
		// setAirdropSuccess(true)
        // Toast.show({icon: 'success',content:t('comp-accountlist-Referral-Inviter-success')});
    }

    return (
        <div className={styles.referralCont}>
            <div className={styles.tips}>{t('comp-accountlist-Referral-copy')}</div>
            <div className={styles.label}>
                <UserOutline className={styles.icon} /> {t('comp-accountlist-Referral-detail')}
            </div>
            {profiles?.[0]?.keyID ?<div className={styles.val}>
                <div className={styles.address}><Ellipsis direction='middle' content={profiles[0].keyID} /></div>
                <CopyBtn text={profiles[0].keyID} />
            </div>:''}
            <div className={styles.label}>
                <LinkOutline className={styles.icon} /> {t('comp-accountlist-Referral-Inviter')}
            </div>
            {profiles?.[0]?.referrer ?<div className={styles.val}>
                <div className={styles.address}><Ellipsis direction='middle' content={profiles[0].referrer} /></div>
                <CopyBtn text={profiles[0].referrer} />
            </div>:<div className={styles.form}>
                <Input
                    className={styles.input}
                    placeholder={t('comp-accountlist-Referral-Inviter-placeholder')}
                    value={inviter}
                    onChange={val => {setInviter(val)}}
                />
                <Button onClick={handleSetInviter} className={styles.subBtn} block loading={subLoading} color='primary' size='small' disabled={!(inviter)}>{t('comp-accountlist-Referral-Inviter-confirm')}</Button>
            </div>}
            
        </div>
    );
}


export default ReferralCont;