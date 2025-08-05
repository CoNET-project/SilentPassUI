import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './inviteBtn.module.scss';
import { useTranslation } from 'react-i18next';
import { Button,Modal,Ellipsis,Toast } from 'antd-mobile';
import {getRandomNodeDomain} from '@/services/mining';
import { useDaemonContext } from '@/providers/DaemonProvider';

const InviteBtn = ({}) => {
    const { t, i18n } = useTranslation();
    const { duplicateAccount } = useDaemonContext();
    const [visible, setVisible] = useState(false);

    const handleShowInviteInfo=()=>{
        setVisible(true);
    }
    const fallbackCopy = () => {
        const content = document.getElementById("contentToCopy");
        if (!content) {
            return;
        }
        const range = document.createRange();
        range.selectNode(content);
        const selection = window.getSelection();
        if (!selection) {
            return;
        }
        selection.removeAllRanges();
        selection.addRange(range);
        try {
            const success = document.execCommand("copy");
            if (success) {
                Toast.show({icon: 'success',content: t('invite-copy-success')});
            } else {
                Toast.show({icon: 'fail',content: t('invite-copy-failed')});
            }
        } catch (err) {
            Toast.show({icon: 'fail',content: t('invite-copy-failed')});
        }
        selection.removeAllRanges();
    }
    const copyHTML = async () => {
        if (!navigator.clipboard || !window.ClipboardItem) {
            fallbackCopy();
            return;
        }
        const element = document.getElementById('contentToCopy');
        if (!element) {
            return;
        }
        const html = element.innerHTML;
        const text = element.innerText;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([text], { type: "text/plain" }),
                }),
            ]);
            Toast.show({icon: 'success',content: t('invite-copy-success')});
        } catch (err) {
            Toast.show({icon: 'fail',content: t('invite-copy-failed')});
        }
    }

    return (
        <>
            <Button onClick={handleShowInviteInfo} className={styles.inviteBtn} color='primary' fill='none' size="mini">{t('referrals-title-panel-ReferralCont')}</Button>
            <Modal
                visible={visible}
                className={styles.inviteInfoModal}
                content={(<div className={styles.InviteText}>
                    <div className={styles.label}>
                        {t('comp-accountlist-Referral-contant-title')}
                    </div>
                    <div id="contentToCopy">
                        <div className={styles.detail}>
                            {t('comp-accountlist-Referral-contant-detail1')}
                        </div>
                        <div className={styles.detail}>
                            {t('comp-accountlist-Referral-contant-detail2')}https://{getRandomNodeDomain()}/download/?referrals={duplicateAccount.keyID}&language={i18n.language}
                        </div>
                        <div className={styles.detail}>
                            {t('comp-accountlist-Referral-contant-detail3')}<Ellipsis direction='middle' content={duplicateAccount.keyID} />
                        </div>
                        <div className={styles.detail}>
                            {t('comp-accountlist-Referral-contant-detail4')}
                        </div>
                        <div className={styles.detail}>
                            {t('comp-accountlist-Referral-contant-detail5')}
                        </div>
                    </div>
                    <div className={styles.oper}>
                        <Button onClick={()=>{setVisible(false)}} className={styles.cancelBtn} size='small' color='primary' fill='outline'>{t('invite-copy-cancel-btn')}</Button>
                        <Button onClick={copyHTML} className={styles.copyBtn} size='small' color='primary' fill='solid'>{t('invite-copy-confirm-btn')}</Button>
                    </div>
                </div>)}
                showCloseButton={true}
                closeOnMaskClick={true}
                onClose={() => {
                    setVisible(false)
                }}
            />
        </>
    );
};

export default InviteBtn;