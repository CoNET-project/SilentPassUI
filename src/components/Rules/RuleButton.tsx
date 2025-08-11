import {useState,useRef,useEffect,useCallback,CSSProperties} from 'react';
import { Popup,NavBar,List,SearchBar,Ellipsis,Checkbox,SpinLoading,ErrorBlock,Dialog,Toast,Input } from 'antd-mobile';
import styles from './ruleButton.module.scss';
import { SetOutline } from 'antd-mobile-icons';
import { useDaemonContext } from '@/providers/DaemonProvider';

const RuleButton=({})=> {
    const { setRuleVisible } = useDaemonContext();
    
    return (
        <>
            <div className={styles.ruleBtn} onClick={(e) => {e.preventDefault();e.stopPropagation();setRuleVisible(true)}}>
                <SetOutline />
            </div>
            
        </>
    );
}


export default RuleButton;