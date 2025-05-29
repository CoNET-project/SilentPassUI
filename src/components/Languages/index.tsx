import React,{useState,useRef,useEffect,useCallback} from 'react';
import styles from './index.module.css';
import { useTranslation } from 'react-i18next';
import { NavBar,Popup,CheckList,setDefaultConfig } from 'antd-mobile';
import type { CheckListValue } from 'antd-mobile/es/components/check-list';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';

interface LanguagesProps {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const languageList = [{name:"English",value:'en'},{name:"中文",value:'zh'}];

const Languages=({visible, setVisible}: LanguagesProps)=> {
    const { t,i18n } = useTranslation();
	
    const handleBack=()=>{
        setVisible(false);
    }
    const handleChange=(value: CheckListValue[])=>{
        type AntdLocale = {
            en: typeof enUS;
            zh: typeof zhCN;
        }
        const antdMLang: AntdLocale={en:enUS,zh:zhCN};
        let storage = window.localStorage;
        localStorage.lang=value;
        i18n.changeLanguage(value);
        if(value && value[0]) setDefaultConfig({locale: antdMLang[value[0] as keyof typeof antdMLang]});
        setVisible(false)
    }

    return (
        <Popup
            visible={visible}
            onMaskClick={() => {
                setVisible(false)
            }}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.languagePopup}
        >
            <div className={styles.languageCont}>
                <NavBar back={t('back')} onBack={handleBack} style={{'--height': '70px'}}></NavBar>
                <div className={styles.languageMain}>
                    <h1 className={styles.title}>{t('language')}</h1>
                    <div className={styles.list}>
                        <CheckList value={[i18n.language]} onChange={handleChange}>
                            {languageList.map((item, index) => (
                                <CheckList.Item key={index} value={item.value}>{item.name}</CheckList.Item>
                            ))}
                        </CheckList>
                    </div>
                </div>
            </div>
        </Popup>
    )
}
export default Languages;