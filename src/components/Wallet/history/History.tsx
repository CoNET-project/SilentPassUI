import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './history.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { Ellipsis, Empty, Skeleton } from 'antd-mobile';
import { ClockCircleFill,CloseCircleFill,LocationOutline } from 'antd-mobile-icons';
import {openWebLinkNative} from './../../../api';
import { useDaemonContext } from "./../../../providers/DaemonProvider";
import { useHistoryManager } from './useHistoryManager';

const History = ({}) => {
    const { isIOS, isLocalProxy } = useDaemonContext();
    const { t, i18n } = useTranslation();
    const { history, addRecord, editRecord, deleteRecord, clearRecords } = useHistoryManager();

    const renderTag=(type:string,showName:boolean=true)=>{
        switch(type) {
            case 'SP':
                return <><ConetToken className={styles.icon} />{showName?'SP':''}</>;
                break;
            case 'SOL':
                return <><SolanaToken className={styles.icon} />{showName?'SOL':''}</>;
                break;
            case 'USDT':
                return <><UsdtToken className={styles.icon} />{showName?'USDT':''}</>;
                break;
            default:
                return <><ConetToken className={styles.icon} />{showName?'SP':''}</>;
        }
    }
    const getIcon=(item:any)=>{
        if(item.status === 'failed'){
            return <CloseCircleFill className={styles.failedIcon} />;
        }
        if(item.operation === 'swap'){
            return (<div className={styles.swapIcon}>
                <div className={styles.formType}>{renderTag(item.fromType,false)}</div>
                <div className={styles.toType}>{renderTag(item.toType,false)}</div>
            </div>)
        }
        if(item.operation === 'send'){
            return (<div className={styles.sendIcon}>
                {renderTag(item.fromType,false)}
                <span className={styles.sendTag}><LocationOutline /></span>
            </div>)
        }
    }
    const getType=(item:any)=>{
        if(item.operation === 'swap'){
            return item.status === 'failed'?t('transaction-history-swap-fail'):(item.status === 'loading'?t('transaction-history-swap-ing')+'...':t('transaction-history-swap-success'))
        }
        if(item.operation === 'send'){
            return item.status === 'failed'?t('transaction-history-send-fail'):(item.status === 'loading'?t('transaction-history-send-ing')+'...':t('transaction-history-send-success'))
        }
    }
    const getVal=(item:any,type:string)=>{
        if(item.operation === 'swap'){
            return type=='from' ? <span className={styles.green}>{'+' + item.toVal + ' ' + item.toType}</span> : ('-' + item.fromVal + ' ' + item.fromType);
        }
        if(item.operation === 'send'){
            return type=='from' ? <span className={styles.green}>{'+' + item.toVal + ' ' + item.toType}</span> : '';
        }
    }
    const getDesc=(item:any)=>{
        if(item.operation === 'swap'){
            return 'Jupiter';
        }
        if(item.operation === 'send'){
            return <>{t('transaction-history-send-to')} <Ellipsis direction='middle' content={item.toAddress} className={styles.address} /></>;
        }
    }
    const handleClick=(signature:string)=>{
        if(signature) openWebLinkNative('https://solscan.io/tx/'+signature,isIOS,isLocalProxy)
    }

    return (
        <div className={styles.history}>
            <div className={styles.title}><ClockCircleFill className={styles.icon} />{t('transaction-history-title')}</div>
            
            {history && history.length > 0 ?<div className={styles.list}>
                {history.map((item,index)=>{
                    return (
                        <div key={index} className={styles.listItem} onClick={()=>{handleClick(item?.hash)}}>
                            <div className={styles.icon}>
                                {getIcon(item)}
                            </div>
                            <div className={styles.infos}>
                                <div className={styles.from}>
                                    <div className={styles.type}>{getType(item)}</div>
                                    <div className={styles.val}>{getVal(item,'from')}</div>
                                </div>
                                <div className={styles.to}>
                                    <div className={styles.type}>{getDesc(item)}</div>
                                    <div className={styles.val}>{getVal(item,'to')}</div>
                                </div>
                            </div>
                            {item && item?.status === 'loading' ? <Skeleton animated className={styles.loading} />:''}
                        </div>
                    )
                })}
            </div>:<div className={styles.empty}>
                <Empty description={t('transaction-history-empty')} />
            </div>}
        </div>    
    );
};

export default History;