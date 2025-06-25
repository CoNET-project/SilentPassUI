import React,{ useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './hideBtn.module.css';
import { ReactComponent as VisibilityOnIcon } from "./../assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./../assets/visibility-off.svg";

interface HideParams {
    isHidden: Boolean; 
    setIsHidden: React.Dispatch<React.SetStateAction<boolean>>;
}

const HideBtn = ({ isHidden,setIsHidden }: HideParams) => {
    return (
        <button className={styles.button} onClick={() => setIsHidden((prev) => !prev)}>
            {isHidden ? <VisibilityOffIcon style={{marginTop:2}} /> : <VisibilityOnIcon />}
        </button>
    );
};

export default HideBtn;