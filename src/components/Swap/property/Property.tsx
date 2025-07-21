import { useState, useRef, useEffect } from 'react';
import styles from './property.module.scss';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import { Popup,NavBar } from 'antd-mobile';
import Chart from './Chart';

interface CopyParams {
  copyVal: string; 
}

const Property = ({}) => {
    const { t, i18n } = useTranslation();
    const { profiles, setProfiles } = useDaemonContext();
    const [visible, setVisible] = useState(false);
    const [code, setCode] = useState('');
    const [navBarTitle, setNavBarTitle] = useState('');

    const handleGoChart=(name:string)=>{
        switch(name){
            case 'Silent Pass':
                setCode('9AGSjaHxuTm4sLHAyRvn1eb4UT6rvuBwkb3Y6wP26BPu');
                break;
            case 'Solana':
                setCode('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE');
                break;
            // case 'USDT':
            //     setCode('9AGSjaHxuTm4sLHAyRvn1eb4UT6rvuBwkb3Y6wP26BPu');
            //     break;
        }
        setNavBarTitle(name);
        setVisible(true);
    }

    return (
        <>
            <div className={styles.property}>
                <div className={styles.title}>{t('swap-asset-title')}</div>
                <ul className={styles.list}>
                    <li className={styles.listItem} onClick={()=>{handleGoChart('Silent Pass')}}>
                        <div className={styles.type}>
                            <div className={styles.icon}><ConetToken /></div>
                            <div className={styles.name}>Silent Pass</div>
                        </div>
                        <div className={styles.val}>
                            <div className={styles.price}>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</div>
                            <div className={styles.amount}>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2)}</div>
                        </div>
                    </li>
                    <li className={styles.listItem} onClick={()=>{handleGoChart('Solana')}}>
                        <div className={styles.type}>
                            <div className={styles.icon}><SolanaToken /></div>
                            <div className={styles.name}>Solana</div>
                        </div>
                        <div className={styles.val}>
                            <div className={styles.price}>${profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)}</div>
                            <div className={styles.amount}>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)}</div>
                        </div>
                    </li>
                    {/*{profiles?.[1]?.tokens?.usdt?<li className={styles.listItem} onClick={()=>{handleGoChart('USDT')}}>
                        <div className={styles.type}>
                            <div className={styles.icon}><UsdtToken /></div>
                            <div className={styles.name}>USDT</div>
                        </div>
                        <div className={styles.val}>
                            <div className={styles.price}>${profiles?.[1]?.tokens?.usdt?.usd || (0.0).toFixed(2)}</div>
                            <div className={styles.amount}>{profiles?.[1]?.tokens?.usdt?.balance || (0.0).toFixed(6)}</div>
                        </div>
                    </li>:''}*/}
                </ul>
            </div>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.chartPopup}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{navBarTitle}</NavBar>
                    <Chart code={code} />
                </div>
            </Popup>
        </>
    );
};

export default Property;