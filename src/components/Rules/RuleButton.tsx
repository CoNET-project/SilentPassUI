import {useState,useRef,useEffect,useCallback,CSSProperties} from 'react';
import { Popup,NavBar,List,SearchBar,Ellipsis,Checkbox,SpinLoading,ErrorBlock,Dialog,Toast,Input } from 'antd-mobile';
import styles from './ruleButton.module.scss';
import { SetOutline } from 'antd-mobile-icons';
import Filter from './Filter';

const RuleButton=({})=> {
    const [visible, setVisible] = useState(false);
    
    return (
        <>
            <div className={styles.ruleBtn} onClick={(e) => {e.preventDefault();e.stopPropagation();setVisible(true)}}>
                <SetOutline />
            </div>
            
            <Filter visible={visible} setVisible={setVisible} />
        </>
    );
}


export default RuleButton;