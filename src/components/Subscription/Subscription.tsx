import { useState, useRef, useEffect } from 'react';
import styles from './subscription.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar } from 'antd-mobile';

interface params {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Subscription = ({}) => {
    const { t, i18n } = useTranslation();
    const [visible, setVisible] = useState<boolean>(false);
    
    return (
        <Popup
            visible={visible}
            onMaskClick={() => {setVisible(false)}}
            position='right'
            bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
            className={styles.popup}
            closeOnMaskClick={true}
        >
            <div className={styles.modalWrap}>
                <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}></NavBar>
                <div className={styles.bd}>
                    
                </div>
            </div>
        </Popup>
    );
};

export default Subscription;