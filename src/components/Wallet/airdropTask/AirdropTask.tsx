import { useState, useRef, useEffect } from 'react';
import styles from './airdropTask.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar,Button,Space,Collapse } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ExclamationCircleOutline,GiftOutline } from 'antd-mobile-icons';
import AirdropTaskCont from './AirdropTaskCont';

const AirdropTask = ({}) => {
    const { t, i18n } = useTranslation();
    const { airdropVisible, setAirdropVisible, profiles, currentBlock } = useDaemonContext();
    const [ruleVisible, setRuleVisible] = useState<boolean>(false)
	const [totalThresholdGB, setTotalThresholdGB] = useState('')

    useEffect(() => {
		
		const airdrop: IAirdrop = profiles?.[0]?.airdropEvent

		if (airdrop) {
			const tGB = parseFloat(airdrop.currectThresholdGB)
			setTotalThresholdGB(tGB.toFixed(2))

		}



  	}, [currentBlock])

    const showRuleBox=()=>{
        setRuleVisible(true);
    }

    return (
        <>
            <Popup
                visible={airdropVisible}
                onMaskClick={() => {setAirdropVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar right={<Button size='mini' color='primary' className={styles.ruleBtnWrap} onClick={showRuleBox}><div className={styles.ruleBtn}><ExclamationCircleOutline className={styles.icon} />{t('integral-list-title-rule')}</div></Button>} onBack={() => {setAirdropVisible(false)}} style={{'--height': '70px'}}>{t('integral-list-title-1')}</NavBar>
                    <div className={styles.bd}>
                        <div className={styles.tips}><ExclamationCircleOutline className={styles.icon} />{t('integral-airdrop-tips-1')}<b>{t('integral-airdrop-tips-2')}</b>{t('integral-airdrop-tips-3')}</div>
                        <AirdropTaskCont setRuleVisible={setRuleVisible} />
                    </div>
                    <div className={styles.bottom}>
                        <div className={styles.bottomLeft}>
                            <label className={styles.label}>{t('integral-airdrop-total-1')}</label>
                            <div className={styles.val}>{totalThresholdGB} {t('integral-airdrop-total-2')}</div>
                        </div>
                        <div className={styles.bottomRight}>
                            <Button size='mini' color='primary' className={styles.ruleBtnWrap} onClick={showRuleBox}><div className={styles.ruleBtn}><ExclamationCircleOutline className={styles.icon} />{t('integral-list-title-rule')}</div></Button>
                            <Button disabled size='mini' color='primary' className={styles.ruleBtnWrap} style={{marginLeft:'2vw'}}><div className={styles.ruleBtn}><GiftOutline className={styles.icon} />{t('integral-airdrop-total-3')}</div></Button>
                        </div>
                    </div>

                    <Popup
                        className={styles.rulesPopup}
                        style={{zIndex:1013}}
                        visible={ruleVisible}
                        onMaskClick={()=>{setRuleVisible(false)}}
                        showCloseButton={true}
                        onClose={() => {setRuleVisible(false)}}
                        bodyStyle={{borderTopLeftRadius: '5vw',borderTopRightRadius: '5vw',minHeight: '70vh'}}
                    >
                        <div className={styles.ruleBox}>
                            <div className={styles.hd}>{t('integral-airdrop-rule-1')}</div>
                            <div className={styles.bd}>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-2')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-3')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-4')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-5')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-6')}</div>
                                    <div className={styles.desc}>
                                        <ul className={styles.descList}>
                                            <li>{t('integral-airdrop-rule-7')}</li>
                                            <li>{t('integral-airdrop-rule-8')}</li>
                                            <li>{t('integral-airdrop-rule-9')}</li>
                                            <li>{t('integral-airdrop-rule-10')}</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-11')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-12')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-13')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-14')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-15')}</div>
                                    <div className={styles.desc}>
                                        <ul className={styles.descList}>
                                            <li>{t('integral-airdrop-rule-16')}</li>
                                            <li>{t('integral-airdrop-rule-17')}</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-18')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-19')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div className={styles.name}>{t('integral-airdrop-rule-20')}</div>
                                    <div className={styles.desc}>{t('integral-airdrop-rule-21')}</div>
                                </div>
                                <div className={styles.item}>
                                    <div  className={styles.examples}>
                                        <Collapse>
                                            <Collapse.Panel key='1' title={t('integral-airdrop-rule-22')}>
                                                <div className={styles.subItem}>
                                                    <div className={styles.subItemName}>{t('integral-airdrop-rule-23')}</div>
                                                    <div className={styles.subItemDesc}>{t('integral-airdrop-rule-24')}</div>
                                                </div>
                                                <div className={styles.subItem}>
                                                    <div className={styles.subItemName}>{t('integral-airdrop-rule-25')}</div>
                                                    <div className={styles.subItemDesc}>{t('integral-airdrop-rule-26')}</div>
                                                </div>
                                            </Collapse.Panel>
                                        </Collapse>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </div>
            </Popup>
        </>
    );
};

export default AirdropTask;