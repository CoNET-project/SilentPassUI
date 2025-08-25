import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/Content/content.module.scss';
import { useTranslation } from 'react-i18next';
// import ProxyInfo from "@/components/Home/ProxyInfo/ProxyInfo";
import Region from "@/components/Home/Region/Region";
import RenderButton from "@/components/Home/RenderButton/RenderButton";
import { ReactComponent as HeadTitle } from '@/components/Home/assets/header-title.svg';

const Content = ({}) => {

    return (
        <div className={styles.content}>
            <div className={styles.banner}><HeadTitle /></div>
            <RenderButton />
            {/*<ProxyInfo />*/}
            <Region />
        </div>  
    );
};

export default Content;