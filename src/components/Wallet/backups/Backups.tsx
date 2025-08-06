import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './backups.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Popup,NavBar,Button,Space,Ellipsis,Input,Modal,Result,Toast } from 'antd-mobile';
import { LockOutline,ExclamationTriangleOutline,GiftOutline,SystemQRcodeOutline,LoopOutline,LeftOutline } from 'antd-mobile-icons';
import { ReactComponent as ConetToken } from './../assets/main-wallet.svg';
import CopyBtn from './../copyBtn/CopyBtn';
import {QRCodeCanvas} from 'qrcode.react';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { CoNET_Data, setCoNET_Data } from './../../../utils/globals';
import {restoreAccount, initializeDuplicateCode} from '../../../services/subscription'
import { useDaemonContext } from "../../../providers/DaemonProvider"

const Backups = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    const [code,setCode]=useState('');	//备份码
    const [password, setPassword] = useState('');	//恢复填写 backup code
    const [initCode, setInitCode] = useState('');	//恢复填写 init code
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [inputError, setInputError] = useState(false);
    const [codeVisible, setCodeVisible] = useState(false);	//二维码弹框
    const [copyStatus, setCopyStatus] = useState(false);
    const [customInitCode, setCustomInitCode] = useState('');	//设置密码
	const [codeInputError, setCodeInputError] = useState(false);
	const [customInitCodeLoading, setCustomInitCodeLoading] = useState(false);
	const [backupCodeShow, setBackupCodeShow] = useState(false);
	const [lookCode, setLookCode] = useState('');	//查看备份码密码
	const [lookCodeError, setLookCodeError] = useState(false);
	const {setActivePassportUpdated, setActivePassport, setRandomSolanaRPC, setIsLocalProxy, setIsIOS, setDuplicateAccount, setProfiles } = useDaemonContext();
    
    useEffect(()=>{
        if(CoNET_Data?.duplicateCode) setCode(CoNET_Data?.duplicateCode);
    },[CoNET_Data?.duplicateCode])

    //恢复
    const handleRecovery=async ()=>{
		setInputError(false);
		if (!CoNET_Data || password === CoNET_Data?.duplicateCode||!initCode||!password) {
			return setInputError(true);
		}
		setRecoveryLoading(true);
		const kkk = await restoreAccount (password, initCode, CoNET_Data, setProfiles);
		if (!kkk) {
			setRecoveryLoading(false);
			return setInputError(true);
		}
        Modal.alert({
            bodyClassName:styles.successModalWrap,
            content: <div className={styles.successModal}>
                <Result
                    status='success'
                    title={t('backup-sub-restore-successful')}
                />
            </div>,
            confirmText:'Close',
        });
		setRecoveryLoading(false);
    }
	const initializeCode = async () => {
		setCustomInitCodeLoading(true);
		setCodeInputError(false);
		const result = await initializeDuplicateCode(customInitCode);
		setCustomInitCodeLoading(false);
		if (!result) {
			Toast.show({
                icon: 'fail',
                content: t('backup-sub-create-code-password-error')
            });
			return setCodeInputError (true)
		}
		setCustomInitCode('')
	}
	const verifyInitCodeToShow=()=>{
		if(lookCode === CoNET_Data?.duplicatePassword){
			setBackupCodeShow(true);
		}else{
			Toast.show({
                icon: 'fail',
                content: t('backup-sub-look-code-tip')
            });
			setLookCodeError(true);
		}
	}
    
    return (
        <>
            <List.Item onClick={() => {setVisible(true)}}>
                <div className={styles.item}>
                    <div className={styles.icon}><ConetToken /></div>
                    <div className={styles.text}>
                        <div className={styles.title}>{t('backup-name')}</div>
                        <div className={styles.subTitle}>(CoNET)</div>
                    </div>
                </div>
            </List.Item>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('backup-title')}</NavBar>
                    <div className={styles.bd}>
                        <div className={styles.introduce}>
                            <div className={styles.title}><LockOutline className={styles.icon} />{t('backup-sub-title-1')}</div>
                            <div className={styles.desc}>{t('backup-sub-desc-1')}</div>
                        </div>
                        <div className={styles.backup}>
                            <div className={styles.title}><GiftOutline className={styles.icon} />{t('backup-sub-title-2')}</div>
                            <div className={styles.desc}>{t('backup-sub-desc-2')}</div>
                            <div className={styles.listTitle}>{t('backup-sub-label-1')}：</div>
                            <ul className={styles.list}>
                                <li className={styles.listItem}>1.{t('backup-sub-list-1')}</li>
                                <li className={styles.listItem}>2.{t('backup-sub-list-2')}</li>
                            </ul>
                            <div className={styles.tips}><ExclamationTriangleOutline className={styles.icon} />{t('backup-sub-code-tip')}</div>
							{code && <>
								{backupCodeShow?<>
									<div className={styles.valTitle}>{t('backup-sub-label-2')}</div>
									<div className={styles.valCont}>
										<div className={styles.val}><Ellipsis direction='middle' content={code} /></div>
										<CopyBtn copyVal={code} />
									</div>
									<div className={styles.valCode}>
										<Button className={styles.codeBtn} block size="small" onClick={()=>{setCodeVisible(true)}}>
											<Space>
												<SystemQRcodeOutline />
												<span>{t('backup-sub-code-btn')}</span>
											</Space>
										</Button>
									</div>
								</>:<div className={styles.verifyBox}>
									<div className={styles.inputBox}>
										<Input
											className={lookCodeError ? styles.generateInputError :styles.generateInput}
											style={{color: codeInputError ? 'red': 'unset'}}
											placeholder={t('backup-sub-init-password')}
											value={lookCode}
											onChange={val => {
												setLookCodeError(false)
												setLookCode(val)
											}}
										/>
									</div>
									<Button onClick={verifyInitCodeToShow} block className={styles.showBtn} color='primary' disabled={!lookCode}>{t('backup-sub-look-code-btn')}</Button>
								</div>}
							</>}
                            {!code && <>
	                            <div className={styles.initBox}>
	                            	<div className={styles.inputBox}>
										<Input
											className={codeInputError ? styles.generateInputError :styles.generateInput}
											style={{color: codeInputError ? 'red': 'unset'}}
											placeholder={t('backup-sub-create-code-password')}
											value={customInitCode}
											disabled={customInitCodeLoading}
											onChange={val => {
												setCodeInputError(false)
												setCustomInitCode(val)
											}}
										/>
									</div>
									<Button onClick={initializeCode} block className={styles.initBtn} loading={customInitCodeLoading} color='primary' disabled={!customInitCode}>{t('backup-sub-create-code-password-button')}</Button>
	                            </div>
                        	</>}
                        </div>
                        <div className={styles.restore}>
                            <div className={styles.title}><LoopOutline className={styles.icon} />{t('backup-sub-title-3')}</div>
                            <div className={styles.desc}>{t('backup-sub-desc-3')}</div>
							<div className={styles.inputBox}>
								<Input
									className={inputError ? styles.generateInputError :styles.generateInput}
									style={{color: inputError ? 'red': 'unset'}}
									placeholder={t('backup-sub-init-password')}
									value={initCode}
									disabled={recoveryLoading}
									onChange={val => {
										setInputError(false)
										setInitCode(val)
									}}
								/>
							</div>
                            <div className={styles.inputBox}>
                                <Input
                                    className={inputError ? styles.generateInputError :styles.generateInput}
									style={{color: inputError ? 'red': 'unset'}}
                                    placeholder={t('backup-sub-restore-input')}
                                    value={password}
									disabled={recoveryLoading}
                                    onChange={val => {
										setInputError(false)
										setPassword(val)
									}}
                                />
                            </div>
                            <Button onClick={handleRecovery} block className={styles.recoveryBtn} loading={recoveryLoading} color='primary' disabled={!password||!initCode}>{t('backup-sub-restore-btn')}</Button>
                        </div>
                    </div> 
                </div>
            </Popup>
            <Modal
                visible={codeVisible}
                closeOnAction
                disableBodyScroll={false}
                closeOnMaskClick={true}
                onClose={() => {setCodeVisible(false)}}
                className={styles.codeModal}
                content={<div className={styles.codeCont}>
                    <div className={styles.hd}>{t('backup-sub-code-modal-title')}</div>
                    <div className={styles.bd}>
                        <div className={styles.qrcode}><QRCodeCanvas size={120} value={code} /></div>
                    </div>
                    <div className={styles.ft}>
                        <div className={styles.val}>{code}</div>
                        <div className={styles.oper}>
                            {copyStatus?<div className={styles.copyBtn}><img src="/assets/check.svg" alt="Copy icon" />{t('comp-comm-copied')} </div>:<CopyToClipboard text={code} onCopy={() => {setCopyStatus(true);setTimeout(()=>{setCopyStatus(false)},3000)}}>
                                <div className={styles.copyBtn}><img src="/assets/copy-purple.svg" alt="Copy icon" />{t('comp-comm-copy')}</div>
                            </CopyToClipboard>}
                        </div>
                    </div>
                    <LeftOutline className={styles.close} onClick={() => {setCodeVisible(false)}} />
                </div>}
            />
        </>     
    );
};

export default Backups;