import {useState,useRef,useEffect} from 'react';
import { Modal,Button,Form,Input,Toast } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import styles from './addItem.module.scss';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

interface AddParams {
    getCustomSetting: () => void;
}
const AddItem=({getCustomSetting}:AddParams)=> {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState('');
    const { t, i18n } = useTranslation();

    const handleAddItem=()=>{
        setVisible(true);
    }
    const handleConfirm=(values: any)=>{
        // 匹配 IPv4 地址，支持 CIDR（如 192.168.1.1/32）
        const ipWithCidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/(?:\d|[12]\d|3[0-2]))?$/;

        // 校验每段是否在 0~255
        const isValidIp = (ip: any) => {
            const [address] = ip.split('/');
            return address.split('.').every((segment: any) => {
                const n = Number(segment);
                return n >= 0 && n <= 255;
            });
        };

        // 匹配域名（支持 abc.com、abc.io、abc.dd.ys、abc.yr 等）
        const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

        if((ipWithCidrRegex.test(values.address) && isValidIp(values.address)) || domainRegex.test(values.address)){
            let storage = window.localStorage;
            if(storage.specialList){
                let specialList=JSON.parse(storage.specialList);
                if(_.some(specialList, item => _.isEqual(item.valueTag, values.address))){
                    Toast.show({
                        icon: 'fail',
                        content: t('filter-tip-2'),
                    })
                }else{
                    specialList.push({"name":values.address,"value":values.address,"valueTag":values.address,checked:"false"});
                    storage.specialList=JSON.stringify(specialList);
                    setVisible(false);
                    //更新列表
                    getCustomSetting();

                    Toast.show({
                        icon: 'success',
                        content: t('success'),
                    })
                }
            }else{
                storage.specialList=JSON.stringify([{"name":values.address,"value":values.address,"valueTag":values.address,checked:"false"}]);
                setVisible(false);
                
                //更新列表
                getCustomSetting();

                Toast.show({
                    icon: 'success',
                    content: t('success'),
                })
            }
        }else{
            Toast.show({
                icon: 'fail',
                content: t('filter-tip-1'),
            })
        }
    }
    return (
        <>
            <Button size='mini' color='primary' fill='solid' className={styles.addBtn} onClick={handleAddItem}><AddOutline /><span>{t('add')}</span></Button>
            <Modal
                visible={visible}
                closeOnAction
                disableBodyScroll={false}
                closeOnMaskClick={true}
                onClose={() => {setVisible(false)}}
                className={styles.addModal}
                content={<div className={styles.addCont}>
                    <div className={styles.hd}>{t('filter-tip-3')}</div>
                    <Form 
                        requiredMarkStyle='text-required'
                        layout='horizontal'
                        style={{'--prefix-width':'auto'}}
                        onFinish={handleConfirm}
                        footer={
                            <>
                                <Button block disabled={!value} type='submit' color='primary' size='middle'>{t('confirm')}</Button>
                                <Button onClick={()=>{setVisible(false)}} className={styles.cancelBtn} block fill='outline' color='default' size='middle'>{t('cancel')}</Button>
                            </>
                        }
                    >
                        <Form.Item name='address'>
                            <Input placeholder={t('filter-placeholder-1')} value={value} onChange={val => {setValue(val)}} />
                        </Form.Item>
                    </Form>
                </div>}
            />
        </>
    );
}


export default AddItem;