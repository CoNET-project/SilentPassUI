import { useState, useRef, useEffect } from 'react';
import styles from './faq.module.scss';
import { useTranslation,Trans } from 'react-i18next';
import { Collapse,Popup,NavBar } from 'antd-mobile';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { ReactComponent as SilentPassServiceTable } from './assets/silent-pass-service-table.svg';
import { ReactComponent as SilentPassBenefitsTable } from './assets/silent-pass-benefits-table.svg';
import {openWebLinkNative} from './../../../api';

interface faqParams {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Faq = ({visible,setVisible}:faqParams) => {
    const { t, i18n } = useTranslation();
    const { isLocalProxy, isIOS } = useDaemonContext();
    
    return (
        <Popup
            visible={visible}
            onMaskClick={() => {setVisible(false)}}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.popup}
            closeOnMaskClick={true}
        >
            <div className={styles.modalWrap}>
                <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('faq')}</NavBar>
                <div className={styles.bd}>
                    <>
                        <Collapse>
                            <Collapse.Panel key='1' title={t('faq-membership')}>
                                <p className={styles.text}>{t('faq-benefits')}</p>
                                <p className={styles.img}><SilentPassBenefitsTable /></p>
                            </Collapse.Panel>
                            <Collapse.Panel key='2' title={t('faq-price')}>
                                <p className={styles.img}><SilentPassServiceTable /></p>
                            </Collapse.Panel>
                            <Collapse.Panel key='3' title={t('faq-wallet')}>
                                <p className={styles.text}>{t('faq-wallet-2')}</p>
                                <p className={styles.text}>
                                    <Trans
                                        i18nKey="faq-wallet-3"
                                        components={{
                                            1: (<a onClick={()=>{openWebLinkNative("https://youtube.com/shorts/O6l3r_qpqzo?feature=shared",isIOS,isLocalProxy)}} />)
                                        }}
                                    />
                                </p>
                            </Collapse.Panel>
                            <Collapse.Panel key='4' title={t('faq-expiry')}>
                                <p className={styles.text}>
                                    <Trans
                                        i18nKey="faq-expiry-2"
                                        components={{
                                            1: (<a onClick={()=>{openWebLinkNative("https://www.youtube.com/watch?v=0YmHHe4PEkk",isIOS,isLocalProxy)}} />)
                                        }}
                                    />
                                </p>
                            </Collapse.Panel>
                            <Collapse.Panel key='5' title={t('faq-difference')}>
                                <p className={styles.text}>{t('faq-difference-2')}</p>
                                <ul className={styles.list}>
                                    <li>
                                        <Trans
                                            i18nKey="faq-difference-3"
                                            components={{
                                                1: (<span className={styles.bold}></span>)
                                            }}
                                        />
                                    </li>
                                    <li>
                                        <Trans
                                            i18nKey="faq-difference-4"
                                            components={{
                                                1: (<span className={styles.bold} />)
                                            }}
                                        />
                                    </li>
                                </ul>
                            </Collapse.Panel>
                            <Collapse.Panel key='6' title={t('faq-support')}>
                                <p className={styles.text}>
                                    <a onClick={() => {openWebLinkNative('https://vue.comm100.com/chatwindow.aspx?siteId=90007504&planId=efd822ce-7299-4fda-9fc1-252dd2f01fc5#',isIOS,isLocalProxy)}}>{t('customer-service')}</a>
                                </p>
                            </Collapse.Panel>
                        </Collapse>
                        <h2 className={styles.title}>Silent Pass VPN</h2>
                        <Collapse>
                            <Collapse.Panel key='1' title={t('faq-vpn')}>
                                <p className={styles.text}>
                                    <Trans
                                        i18nKey="faq-vpn-2"
                                        components={{
                                            1: (<a onClick={()=>{openWebLinkNative("https://youtube.com/shorts/ZhhF7_uCrZ4",isIOS,isLocalProxy)}} />)
                                        }}
                                    />
                                </p>
                            </Collapse.Panel>
                            <Collapse.Panel key='2' title={t('faq-telegram')}>
                                <p className={styles.text}>{t('faq-telegram-2')}</p>
                                <ol className={styles.list}>
                                    <li>{t('faq-telegram-3')}</li>
                                    <li>{t('faq-telegram-4')}</li>
                                    <li>{t('faq-telegram-5')}</li>
                                    <li>{t('faq-telegram-6')}</li>
                                </ol>
                                <p className={styles.text}>
                                    <Trans
                                        i18nKey="faq-telegram-7"
                                        components={{
                                            1: (<a onClick={()=>{openWebLinkNative("https://www.youtube.com/watch?v=15fJpywnFFM",isIOS,isLocalProxy)}} />)
                                        }}
                                    />
                                </p>
                            </Collapse.Panel>
                        </Collapse>
                        <h2 className={styles.title}>{t('faq-proxy-title')}</h2>
                        <h3 className={styles.subTitle}>{t('faq-proxy-2')}</h3>
                        <Collapse>
                            <Collapse.Panel key='1' title={t('faq-proxy')}>
                                <ol className={styles.list}>
                                    <li>
                                        <p className={styles.text}>
                                            <Trans
                                                i18nKey="faq-proxy-3"
                                                components={{
                                                    1: (<a onClick={()=>{openWebLinkNative("https://youtu.be/Zgsy10RBBNY?si=LgA19a8E6F_Zwm5B",isIOS,isLocalProxy)}} />)
                                                }}
                                            />
                                        </p>
                                    </li>
                                    <li>
                                        <p className={styles.text}>{t('faq-proxy-4')}</p>
                                        <p className={styles.text}>
                                            <Trans
                                                i18nKey="faq-proxy-5"
                                                components={{
                                                    1: (<a onClick={()=>{openWebLinkNative("https://youtu.be/EcimpQrlTg0",isIOS,isLocalProxy)}} />)
                                                }}
                                            />
                                        </p>
                                        <p className={styles.text}>
                                            <Trans
                                                i18nKey="faq-proxy-6"
                                                components={{
                                                    1: (<a onClick={()=>{openWebLinkNative("https://youtu.be/jqjSDED8k2o",isIOS,isLocalProxy)}} />)
                                                }}
                                            />
                                        </p>
                                    </li>
                                </ol>
                            </Collapse.Panel>
                        </Collapse>
                    </>
                </div>
            </div>
        </Popup>
    );
};

export default Faq;