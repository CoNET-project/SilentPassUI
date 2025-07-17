import {useState,useRef,useEffect} from 'react';
import { Modal,Selector,Form,Input,Button,Switch,Toast } from 'antd-mobile';
import { SystemQRcodeOutline,LeftOutline } from 'antd-mobile-icons';
import styles from './autoCodeButton.module.scss';
import {QRCodeCanvas} from 'qrcode.react';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion';

interface CopyParams {
    copyVal: string; 
    isEthers: boolean;
}

const AutoCodeButton=({ copyVal,isEthers }: CopyParams)=> {
    const [visible, setVisible] = useState(false);
    const [copyStatus, setCopyStatus] = useState(false);
    const [address,setAddress]=useState(copyVal);
	const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [showCodeArea,setShowCodeArea]=useState(false);
    const [codeString,setCodeString]=useState('');

    const initialValues={type:['$SP'],needAmount:false,amount:undefined};
    const options = [
        {
            label: '$SP',
            value: '$SP',
        },
        {
            label: '$SOL',
            value: '$SOL',
        }
    ]

    useEffect(()=>{
        setAddress(copyVal)
    },[copyVal])

    useEffect(()=>{
        if(visible){
            setShowCodeArea(false);
            form?.resetFields();
        }
    },[visible])

    const onFinish=(values:any)=>{
        const { type, needAmount, amount } = values;
        if (!type) {
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-tips-1')
            })
            return ;
        }
        // 判断 needAmount 是否为 true，且 amount 不能为空
        if (needAmount && !amount) {
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-tips-2')
            })
            return ;
        }
        if (needAmount && amount && amount<=0) {
            Toast.show({
                icon: 'fail',
                content: t('wallet-receive-code-tips-3')
            })
            return ;
        }
        setCodeString(JSON.stringify(needAmount?{type:type[0],address:address,amount:amount}:{type:type[0],address:address}));
        setShowCodeArea(true);
    }
    const handleValuesChange=(changedValues:any, allValues:any)=>{
        if(!allValues.type?.length){
            form.setFieldsValue({type:[options[0].value]})
        }
    }

    return (
        <>
            <div className={styles.codeBtn} onClick={() => {setVisible(true)}}>
                <SystemQRcodeOutline className={styles.codeIcon} />
                <span className={styles.text}>{t('comp-comm-receive')} </span>
            </div>
            <Modal
                visible={visible}
                closeOnAction
                disableBodyScroll={false}
                closeOnMaskClick={true}
                onClose={() => {setVisible(false)}}
                className={styles.codeModal}
                content={<>
                    {!showCodeArea?<div className={styles.codeConditions}>
                        <div className={styles.hd}>{t('wallet-receive-code-title-1')}</div>
                        <div className={styles.bd}>
                            <Form
                                form={form}
                                layout='horizontal'
                                name='form'
                                onFinish={onFinish}
                                onValuesChange={handleValuesChange}
                                initialValues={initialValues}
                                footer={<Button className={styles.subBtn} block type='submit' color='primary' size='middle'>{t('wallet-receive-code-confirm')}</Button>}
                                style={{'--prefix-width':'6.1em'}}
                            >
                                <Form.Item name='type' label={t('wallet-receive-code-label-1')}>
                                    <Selector
                                        options={options}
                                        showCheckMark={false}
                                        style={{
                                            '--border-radius': '8px',
                                            '--border': 'solid #797979 1px',
                                            '--checked-border': 'solid #4487f7 1px',
                                            '--padding': '2px 16px',
                                            '--color': 'transparent',
                                            '--checked-color': '#122541',
                                            '--text-color':'#797979',
                                            '--checked-text-color':'#4487f7'
                                        }}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name='needAmount'
                                    label={t('wallet-receive-code-label-2')}
                                    valuePropName="checked"
                                    childElementPosition='normal'
                                >
                                    <Switch style={{
                                        '--height': '22px',
                                        '--width': '50px',
                                    }} />
                                </Form.Item>
                                <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.needAmount !== currentValues.needAmount} noStyle>
                                    {({ getFieldValue }) => {
                                        const show = getFieldValue('needAmount');
                                        return (
                                            <AnimatePresence mode="wait">
                                                {show && (
                                                    <motion.div
                                                        key="amountInput"
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <Form.Item name="amount" label={t('wallet-receive-code-label-3')}>
                                                            <Input
                                                                className={styles.amountInput}
                                                                min={0}
                                                                type="number"
                                                                step="any"
                                                                placeholder={t('comp-accountlist-SendButton-Amount')}
                                                            />
                                                        </Form.Item>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        );
                                    }}
                                </Form.Item>
                            </Form>
                        </div>
                        <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
                    </div>:<div className={styles.codeCont}>
                        <div className={styles.hd}>{t('wallet-receive-code-title-2')}</div>
                        <div className={styles.bd}>
                            <div className={styles.qrcode}><QRCodeCanvas size={120} value={codeString} /></div>
                            <div className={styles.label}>
                                <span className={styles.labelItem}>{JSON.parse(codeString)&&JSON.parse(codeString).type?<>{t('wallet-receive-code-label-1')}：{JSON.parse(codeString)?.type}</>:''}</span>
                                <span className={styles.labelItem}>{JSON.parse(codeString)&&JSON.parse(codeString).amount?<>{t('wallet-receive-code-label-3')}：{JSON.parse(codeString)?.amount}</>:''}</span>
                            </div>
                        </div>
                        <div className={styles.ft}>
                            <div className={styles.val}>{t('wallet-receive-code-address-label')}：{copyVal}</div>
                            <div className={styles.oper}>
                                {copyStatus?<div className={styles.copyBtn}><img src="/assets/check.svg" alt="Copy icon" />{t('comp-comm-copied')} </div>:<CopyToClipboard text={address} onCopy={() => {setCopyStatus(true);setTimeout(()=>{setCopyStatus(false)},3000)}}>
                                    <div className={styles.copyBtn}><img src="/assets/copy-purple.svg" alt="Copy icon" />{t('comp-comm-copy')}</div>
                                </CopyToClipboard>}
                            </div>
                        </div>
                        <LeftOutline className={styles.close} onClick={() => {setVisible(false)}} />
                    </div>}
                </>}
            />
        </>
    );
}


export default AutoCodeButton;