import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/Region/region.module.scss';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from "@/providers/DaemonProvider";
import ReactCountryFlag from 'react-country-flag';
import RuleButton from '@/components/Rules/RuleButton';
import SignalIndicator from '@/components/Home/SignalIndicator/SignalIndicator';
import { RightOutline } from 'antd-mobile-icons';
import { Popup,NavBar } from 'antd-mobile';

const Region = ({}) => {
    const { t, i18n } = useTranslation();
    const { power, isLocalProxy, allRegions, sRegion, setIsRandom, setSRegion } = useDaemonContext();
    const [visible, setVisible] = useState<boolean>(false);

    const convertCN = (code: string) => {
        if (code === 'CN') {
            return 'HK'
        }
        return code
    }
    const handleRegion = (code: number) => {
        if (code === -1) setIsRandom(true);
        else setIsRandom(false);
        setSRegion(code);
        setVisible(false);
    }
    const handleGoSelect=()=>{
        if(!power){
            setVisible(true)
        }
    }
    
    return (
        <>
            <div className={`${styles.region} ${power ? styles.regionDisabled : ''}`} onClick={handleGoSelect}>
                <div className={styles.country}>
                    <ReactCountryFlag
                        countryCode={allRegions?.[sRegion]?.code}
                        svg
                        aria-label="United States"
                        style={{width:'30px',height:'30px'}}
                    />
                    <div className={styles.countryName}>{t('region_' + convertCN(allRegions?.[sRegion]?.code))}</div>
                </div>
                <div className={styles.extraInfo}>
                    {isLocalProxy && <RuleButton />}
                    <RightOutline className={styles.icon} />
                </div>
            </div> 
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.popup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('region_select')}</NavBar>
                    <div className={styles.bd}>
                        {allRegions.map((region, index) => {
                            return (
                                <div className={styles.item} key={index} onClick={() => handleRegion(index)}>
                                    <div className={styles.country}>
                                        <ReactCountryFlag
                                            countryCode={convertCN(region.code)}
                                            svg
                                            aria-label="United States"
                                            style={{width:'30px',height:'30px'}}
                                        />
                                        <div className={styles.countryName}>{t(`region_${convertCN(region.code)}`)}</div>
                                    </div>
                                    <div className={styles.status}>
                                        <SignalIndicator level={4} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div> 
            </Popup>
        </>
    );
};

export default Region;